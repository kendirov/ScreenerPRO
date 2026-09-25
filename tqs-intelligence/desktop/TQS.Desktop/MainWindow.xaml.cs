using Microsoft.Web.WebView2.Core;
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;

namespace TQS.Desktop;

public partial class MainWindow : Window
{
    private readonly ProcessSupervisor _runtime = new();
    private readonly DispatcherTimer _statusTimer;
    private bool _allowClose;
    private bool _busy;

    private static readonly Brush MutedBrush = new SolidColorBrush(Color.FromRgb(89, 97, 107));
    private static readonly Brush GreenBrush = new SolidColorBrush(Color.FromRgb(99, 193, 142));
    private static readonly Brush AmberBrush = new SolidColorBrush(Color.FromRgb(205, 162, 95));
    private static readonly Brush RedBrush = new SolidColorBrush(Color.FromRgb(225, 111, 115));

    public MainWindow()
    {
        InitializeComponent();

        _statusTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        _statusTimer.Tick += async (_, _) => await RefreshStatusAsync();

        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        Closed += (_, _) => _runtime.Dispose();
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        try
        {
            var hwnd = new WindowInteropHelper(this).Handle;
            var dark = 1;
            DwmSetWindowAttribute(hwnd, 20, ref dark, sizeof(int));
            var backdrop = 2;
            DwmSetWindowAttribute(hwnd, 38, ref backdrop, sizeof(int));
        }
        catch { }
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        await InitWebViewAsync();
        _statusTimer.Start();
        await RunBusyAsync("Запуск TQS…", async () =>
        {
            var ok = await _runtime.StartAsync();
            if (ok) await ShowCockpitAsync();
        });
        await RefreshStatusAsync();
    }

    private async Task InitWebViewAsync()
    {
        try
        {
            await Cockpit.EnsureCoreWebView2Async();
            Cockpit.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, 13, 17, 21);
            Cockpit.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            Cockpit.CoreWebView2.Settings.IsStatusBarEnabled = false;
            Cockpit.CoreWebView2.Settings.AreDevToolsEnabled = true;
        }
        catch (Exception ex)
        {
            OfflineTitle.Text = "WebView2 недоступен";
            OfflineDetail.Text = ex.Message;
        }
    }

    private async Task RefreshStatusAsync()
    {
        if (_busy) return;
        var status = await _runtime.GetStatusAsync();

        if (status.Online)
        {
            StatusDot.Fill = GreenBrush;
            SidebarDot.Fill = GreenBrush;
            StatusText.Text = "ONLINE";
            SidebarState.Text = "Runtime online";
            SessionText.Text = status.Owned ? "Desktop-owned" : "External";
            PidText.Text = status.Pid?.ToString() ?? "external";
            StartButton.IsEnabled = !status.Owned;
            StopButton.IsEnabled = true;
            RestartButton.IsEnabled = true;

            if (Cockpit.Visibility != Visibility.Visible)
                await ShowCockpitAsync();
        }
        else
        {
            StatusDot.Fill = MutedBrush;
            SidebarDot.Fill = MutedBrush;
            StatusText.Text = "STOPPED";
            SidebarState.Text = "Runtime stopped";
            SessionText.Text = "Not running";
            PidText.Text = "—";
            StartButton.IsEnabled = true;
            StopButton.IsEnabled = false;
            RestartButton.IsEnabled = false;
            Cockpit.Visibility = Visibility.Collapsed;
            OfflinePanel.Visibility = Visibility.Visible;
        }
    }

    private async Task ShowCockpitAsync(string fragment = "")
    {
        var status = await _runtime.GetStatusAsync();
        if (!status.Online) return;

        var target = _runtime.BaseUrl + "/" + (string.IsNullOrWhiteSpace(fragment) ? "" : "#" + fragment);
        try
        {
            if (Cockpit.CoreWebView2 == null)
                await Cockpit.EnsureCoreWebView2Async();
            Cockpit.Source = new Uri(target);
            OfflinePanel.Visibility = Visibility.Collapsed;
            Cockpit.Visibility = Visibility.Visible;
        }
        catch (Exception ex)
        {
            OfflinePanel.Visibility = Visibility.Visible;
            Cockpit.Visibility = Visibility.Collapsed;
            OfflineTitle.Text = "Cockpit не открылся";
            OfflineDetail.Text = ex.Message;
        }
    }

    private async Task RunBusyAsync(string text, Func<Task> work)
    {
        if (_busy) return;
        _busy = true;
        BusyText.Text = text;
        BusyOverlay.Visibility = Visibility.Visible;
        try
        {
            await work();
        }
        catch (Exception ex)
        {
            OfflinePanel.Visibility = Visibility.Visible;
            Cockpit.Visibility = Visibility.Collapsed;
            OfflineTitle.Text = "TQS: ошибка запуска";
            OfflineDetail.Text = ex.Message;
        }
        finally
        {
            BusyOverlay.Visibility = Visibility.Collapsed;
            _busy = false;
        }
    }

    private async void Start_Click(object sender, RoutedEventArgs e)
    {
        await RunBusyAsync("Запуск TQS…", async () =>
        {
            if (await _runtime.StartAsync())
                await ShowCockpitAsync();
        });
        await RefreshStatusAsync();
    }

    private async void Stop_Click(object sender, RoutedEventArgs e)
    {
        await RunBusyAsync("Остановка всех процессов TQS…", async () =>
        {
            await _runtime.StopAsync();
            await Task.Delay(250);
        });
        await RefreshStatusAsync();
    }

    private async void Restart_Click(object sender, RoutedEventArgs e)
    {
        await RunBusyAsync("Перезапуск TQS…", async () =>
        {
            await _runtime.RestartAsync();
            await ShowCockpitAsync();
        });
        await RefreshStatusAsync();
    }

    private async void ModeStop_Click(object sender, RoutedEventArgs e) => await SetModeAsync("stop");
    private async void ModeLight_Click(object sender, RoutedEventArgs e) => await SetModeAsync("light");
    private async void ModeMax_Click(object sender, RoutedEventArgs e) => await SetModeAsync("max");

    private async Task SetModeAsync(string mode)
    {
        try
        {
            await _runtime.SetModeAsync(mode);
            SessionText.Text = "Mode: " + mode.ToUpperInvariant();
        }
        catch (Exception ex)
        {
            SessionText.Text = "Mode error: " + ex.GetType().Name;
        }
    }

    private async void Nav_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button b) return;
        var tag = b.Tag?.ToString() ?? "";
        SectionTitle.Text = b.Content?.ToString() ?? "TQS";
        await ShowCockpitAsync(tag);
    }

    private async void NewResearch_Click(object sender, RoutedEventArgs e)
    {
        SectionTitle.Text = "Новое исследование";
        await ShowCockpitAsync("research");
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2)
        {
            WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
            return;
        }
        if (e.ButtonState == MouseButtonState.Pressed) DragMove();
    }

    private void Minimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void Maximize_Click(object sender, RoutedEventArgs e) =>
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    private void Close_Click(object sender, RoutedEventArgs e) => Close();

    private async void MainWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (_allowClose) return;

        e.Cancel = true;
        _statusTimer.Stop();
        IsEnabled = false;
        BusyText.Text = "Закрытие: останавливаю TQS и очищаю процессы…";
        BusyOverlay.Visibility = Visibility.Visible;

        try
        {
            await _runtime.StopAsync();
        }
        catch { }

        _allowClose = true;
        Close();
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
}
