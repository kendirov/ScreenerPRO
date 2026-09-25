using Microsoft.Web.WebView2.Core;
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
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
    private readonly TqsApiClient _api = new();
    private readonly DispatcherTimer _statusTimer;
    private bool _allowClose;
    private bool _busy;
    private bool _isWorking;
    private bool _syncingUi;
    private string _currentMode = "stop";
    private double _lastCpu;
    private double _lastRam;
    private DateTime _lastGovernorApply = DateTime.MinValue;
    private LoadProfile? _lastAppliedProfile;

    private static readonly Brush MutedBrush = Brush("#59616B");
    private static readonly Brush GreenBrush = Brush("#63C18E");
    private static readonly Brush AmberBrush = Brush("#CDA25F");
    private static readonly Brush RedBrush = Brush("#E16F73");

    private static string Ru(string value) => value switch
    {
        "start" => "\u041d\u0430\u0447\u0430\u0442\u044c \u0440\u0430\u0431\u043e\u0442\u0443",
        "pause" => "\u041f\u0430\u0443\u0437\u0430",
        "online" => "\u0420\u0410\u0411\u041e\u0422\u0410\u0415\u0422",
        "paused" => "\u041f\u0410\u0423\u0417\u0410",
        "starting" => "\u0417\u0410\u041f\u0423\u0421\u041a",
        "offline" => "\u041d\u0415\u0422 \u0421\u0412\u042f\u0417\u0418",
        _ => value
    };

    public MainWindow()
    {
        InitializeComponent();
        _statusTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        _statusTimer.Tick += async (_, _) => await RefreshStateAsync();
        LoadSlider.ValueChanged += (_, _) => LoadValueText.Text = $"{LoadSlider.Value:0}%";
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        Closed += (_, _) => { _api.Dispose(); _runtime.Dispose(); };
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
        LoadSlider.IsEnabled = false;
        await InitWebViewAsync();
        await RunBusyAsync("\u0417\u0430\u043f\u0443\u0441\u043a TQS\u2026", async () =>
        {
            if (await _runtime.StartAsync())
                await ShowCockpitAsync("");
        });
        _statusTimer.Start();
        await RefreshStateAsync();
    }

    private async Task InitWebViewAsync()
    {
        try
        {
            await Cockpit.EnsureCoreWebView2Async();
            Cockpit.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, 12, 16, 20);
            Cockpit.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            Cockpit.CoreWebView2.Settings.IsStatusBarEnabled = false;
            Cockpit.CoreWebView2.Settings.AreDevToolsEnabled = true;
            Cockpit.NavigationCompleted += async (_, _) => await InjectEmbeddedModeAsync();
        }
        catch (Exception ex)
        {
            OfflineTitle.Text = "\u041d\u0435 \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u043b\u0441\u044f \u0432\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0439 \u044d\u043a\u0440\u0430\u043d";
            OfflineDetail.Text = ex.Message;
        }
    }

    private async Task InjectEmbeddedModeAsync()
    {
        if (Cockpit.CoreWebView2 == null) return;
        var script = @"(() => {
          let s=document.getElementById('tqs-desktop-embed');
          if(!s){s=document.createElement('style');s.id='tqs-desktop-embed';document.head.appendChild(s);}
          s.textContent='.sidebar,.topbar{display:none!important}.app{display:block!important;min-height:100vh!important}.main{margin:0!important;width:100%!important;max-width:none!important}.view{padding-top:0!important}.eyebrow{display:none!important}body{overflow-x:hidden!important}';
          document.documentElement.style.background='#0c1014';
          document.body.style.background='#0c1014';
        })();";
        try { await Cockpit.CoreWebView2.ExecuteScriptAsync(script); } catch { }
    }

    private async Task ShowCockpitAsync(string view)
    {
        if (!(await _runtime.GetStatusAsync()).Online) return;
        try
        {
            if (Cockpit.CoreWebView2 == null)
                await Cockpit.EnsureCoreWebView2Async();
            if (Cockpit.Source == null)
                Cockpit.Source = new Uri(_api.BaseUrl + "/");

            OfflinePanel.Visibility = Visibility.Collapsed;
            Cockpit.Visibility = Visibility.Visible;
            await InjectEmbeddedModeAsync();

            if (!string.IsNullOrWhiteSpace(view) && Cockpit.CoreWebView2 != null)
            {
                var safe = view.Replace("'", "");
                await Cockpit.CoreWebView2.ExecuteScriptAsync(
                    $"document.querySelector('[data-view=\"{safe}\"]')?.click();");
            }
        }
        catch (Exception ex)
        {
            OfflinePanel.Visibility = Visibility.Visible;
            Cockpit.Visibility = Visibility.Collapsed;
            OfflineTitle.Text = "\u042d\u043a\u0440\u0430\u043d TQS \u043d\u0435 \u043e\u0442\u043a\u0440\u044b\u043b\u0441\u044f";
            OfflineDetail.Text = ex.Message;
        }
    }

    private async Task RefreshStateAsync()
    {
        if (_busy) return;
        var status = await _runtime.GetStatusAsync();
        if (!status.Online)
        {
            SetRuntimeVisual(false, false);
            return;
        }

        var resourcesTask = _api.GetJsonAsync("/api/resources");
        var overviewTask = _api.GetJsonAsync("/api/overview");
        var jobsTask = _api.GetJsonAsync("/api/jobs?limit=24");
        await Task.WhenAll(resourcesTask, overviewTask, jobsTask);

        using var resources = resourcesTask.Result;
        using var overview = overviewTask.Result;
        using var jobs = jobsTask.Result;

        if (resources != null) ReadResources(resources.RootElement);
        if (overview != null) ReadOverview(overview.RootElement);
        if (jobs != null) RenderJobs(jobs.RootElement);

        SetRuntimeVisual(true, _isWorking);
        await MaybeApplyAutoGovernorAsync();
    }

    private void ReadResources(JsonElement root)
    {
        if (!TryGet(root, "system", out var sys)) return;

        _lastCpu = Num(sys, "cpu_percent");
        _lastRam = Num(sys, "ram_percent");
        CpuText.Text = $"{_lastCpu:0}%";
        RamText.Text = $"{_lastRam:0}%";

        var tqsCpu = 0.0;
        var tqsRam = 0.0;
        var uiRam = 0.0;
        var engineRam = 0.0;
        var engineCpu = 0.0;

        if (TryGet(root, "tqs_processes", out var procs) && procs.ValueKind == JsonValueKind.Array)
        {
            foreach (var p in procs.EnumerateArray())
            {
                var name = Str(p, "name");
                var cmd = Str(p, "command");
                var cpu = Num(p, "cpu_percent");
                var mem = Num(p, "memory_mb");
                if (name.Equals("TQS.Desktop.exe", StringComparison.OrdinalIgnoreCase))
                {
                    tqsCpu += cpu; tqsRam += mem; uiRam += mem;
                }
                else if (name.Contains("python", StringComparison.OrdinalIgnoreCase) &&
                         cmd.Contains("tqs_intelligence", StringComparison.OrdinalIgnoreCase))
                {
                    tqsCpu += cpu; tqsRam += mem; engineRam += mem; engineCpu += cpu;
                }
            }
        }

        TqsCpuText.Text = $"TQS {tqsCpu:0.0}%";
        TqsRamText.Text = $"TQS {tqsRam:0} \u041c\u0411";
        ProcessSummaryText.Text =
            $"\u0418\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441 {uiRam:0} \u041c\u0411  \u00b7  \u0434\u0432\u0438\u0436\u043e\u043a {engineRam:0} \u041c\u0411 / {engineCpu:0.0}% CPU";

        if (TryGet(sys, "network_io", out var net))
            NetworkText.Text = $"\u2193 {Num(net, "recv_mb_s"):0.00}  \u2191 {Num(net, "sent_mb_s"):0.00} \u041c\u0411/\u0441";
        if (TryGet(sys, "disk_io", out var disk))
            DiskText.Text = $"{Num(disk, "read_mb_s"):0.00} / {Num(disk, "write_mb_s"):0.00} \u041c\u0411/\u0441";

        var mode = "";
        var desired = 0;
        var active = 0;
        var throttled = false;
        var reason = "";
        if (TryGet(root, "policy", out var policy))
        {
            mode = Str(policy, "mode");
            _currentMode = string.IsNullOrWhiteSpace(mode) ? "stop" : mode;
            var autoPlan = Bool(policy, "auto_plan_enabled");
            if (AutoTasksCheck.IsChecked != autoPlan)
            {
                _syncingUi = true;
                AutoTasksCheck.IsChecked = autoPlan;
                _syncingUi = false;
            }
        }
        if (TryGet(root, "effective", out var eff))
        {
            desired = Int(eff, "research_desired_workers");
            active = Int(eff, "research_active_jobs");
            throttled = Bool(eff, "research_throttled");
            reason = Str(eff, "research_throttle_reason");
        }
        _isWorking = mode != "stop";
        WorkerText.Text = throttled
            ? $"\u0412\u043e\u0440\u043a\u0435\u0440\u044b: {active}/{desired}  \u00b7  \u0430\u0432\u0442\u043e-\u043f\u0430\u0443\u0437\u0430 {reason}"
            : $"\u0412\u043e\u0440\u043a\u0435\u0440\u044b: {active}/{desired}";
    }

    private void ReadOverview(JsonElement root)
    {
        var mode = "";
        if (TryGet(root, "control", out var control)) mode = Str(control, "mode");
        _isWorking = mode != "stop";

        if (TryGet(root, "runtime", out var runtime) && Bool(runtime, "refreshing"))
        {
            CurrentActionText.Text = "\u041e\u0431\u043d\u043e\u0432\u043b\u044f\u044e \u0440\u044b\u043d\u043e\u043a";
            CurrentActionDetail.Text = "\u0417\u0430\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u044e \u0441\u0432\u0435\u0436\u0438\u0435 \u043a\u043e\u0442\u0438\u0440\u043e\u0432\u043a\u0438 \u0438 \u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438";
        }
        else if (!_isWorking)
        {
            CurrentActionText.Text = "\u0420\u0430\u0431\u043e\u0442\u0430 \u043d\u0430 \u043f\u0430\u0443\u0437\u0435";
            CurrentActionDetail.Text = "\u0414\u0432\u0438\u0436\u043e\u043a \u0437\u0430\u043f\u0443\u0449\u0435\u043d, \u043d\u043e \u0441\u0431\u043e\u0440 \u0438 \u0442\u044f\u0436\u0451\u043b\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u043f\u0440\u0438\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u044b";
        }
    }

    private void RenderJobs(JsonElement root)
    {
        TasksPanel.Children.Clear();
        if (root.ValueKind != JsonValueKind.Array)
        {
            NoTasksText.Visibility = Visibility.Visible;
            return;
        }

        var rows = root.EnumerateArray()
            .Where(x => { var s = Str(x, "status"); return s is "running" or "queued"; })
            .OrderBy(x => Str(x, "status") == "running" ? 0 : 1)
            .ThenByDescending(x => TryGet(x, "control", out var c) ? Int(c, "priority") : 50)
            .Take(8).ToList();

        NoTasksText.Visibility = rows.Count == 0 ? Visibility.Visible : Visibility.Collapsed;

        if (rows.Count > 0 && !rows.Any(x => Str(x, "status") == "running") && _isWorking)
        {
            CurrentActionText.Text = "\u041e\u0447\u0435\u0440\u0435\u0434\u044c \u0433\u043e\u0442\u043e\u0432\u0430";
            CurrentActionDetail.Text = $"{rows.Count} \u0437\u0430\u0434\u0430\u0447 \u0436\u0434\u0443\u0442 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u0433\u043e \u0432\u043e\u0440\u043a\u0435\u0440\u0430";
        }

        foreach (var job in rows)
        {
            var id = Str(job, "id");
            var status = Str(job, "status");
            var progress = Math.Clamp(Num(job, "progress") * 100.0, 0, 100);
            var control = TryGet(job, "control", out var ctl) ? ctl : default;
            var paused = control.ValueKind == JsonValueKind.Object && Bool(control, "paused");
            var priority = control.ValueKind == JsonValueKind.Object ? Int(control, "priority") : 50;
            var title = JobTitle(job);

            if (status == "running")
            {
                CurrentActionText.Text = title;
                CurrentActionDetail.Text = paused
                    ? "\u041f\u0430\u0443\u0437\u0430 \u043f\u043e\u0441\u043b\u0435 \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0433\u043e \u0448\u0430\u0433\u0430"
                    : $"\u0412\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442\u0441\u044f  \u00b7  {progress:0}%";
            }

            var card = new Border
            {
                Background = Brush("#10151A"), BorderBrush = Brush("#252D35"), BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10), Padding = new Thickness(10), Margin = new Thickness(0,0,0,7)
            };
            var stack = new StackPanel();
            card.Child = stack;

            var head = new Grid();
            head.ColumnDefinitions.Add(new ColumnDefinition());
            head.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            var titleBlock = new TextBlock { Text = title, FontSize = 11, FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0,0,8,0) };
            head.Children.Add(titleBlock);
            var stateBlock = new TextBlock { Text = paused ? "\u041f\u0430\u0443\u0437\u0430" : StatusRu(status),
                Foreground = paused ? AmberBrush : (status == "running" ? GreenBrush : MutedBrush), FontSize = 9,
                VerticalAlignment = VerticalAlignment.Top };
            Grid.SetColumn(stateBlock, 1); head.Children.Add(stateBlock);
            stack.Children.Add(head);

            var bar = new ProgressBar { Minimum = 0, Maximum = 100, Value = progress, Margin = new Thickness(0,8,0,8) };
            stack.Children.Add(bar);

            var actions = new StackPanel { Orientation = Orientation.Horizontal };
            var pauseButton = NewTinyButton(paused ? "\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c" : "\u041f\u0430\u0443\u0437\u0430");
            pauseButton.Click += async (_, _) =>
            {
                if (paused)
                {
                    var profile = AutoLoadCheck.IsChecked == true
                        ? LoadProfile.Auto(_lastCpu, _lastRam)
                        : LoadProfile.FromLevel(LoadSlider.Value);
                    await _api.SetJobControlAsync(id, paused: false);
                    await _api.SetControlAsync("max", profile.Workers, profile.CpuLimit, profile.RamLimit,
                                               profile.HistoryBatch, profile.MetricBatch);
                    _currentMode = "max";
                }
                else
                {
                    await _api.SetJobControlAsync(id, paused: true);
                }
                await RefreshStateAsync();
            };
            actions.Children.Add(pauseButton);

            foreach (var option in new[] { (25, "\u041d\u0438\u0437\u043a\u0438\u0439"), (50, "\u041e\u0431\u044b\u0447\u043d\u044b\u0439"), (90, "\u0412\u044b\u0441\u043e\u043a\u0438\u0439") })
            {
                var b = NewTinyButton(option.Item2);
                b.Margin = new Thickness(5,0,0,0);
                if (Math.Abs(priority - option.Item1) <= 10) b.BorderBrush = AmberBrush;
                var p = option.Item1;
                b.Click += async (_, _) => await _api.SetJobControlAsync(id, priority: p);
                actions.Children.Add(b);
            }
            stack.Children.Add(actions);
            TasksPanel.Children.Add(card);
        }
    }

    private Button NewTinyButton(string text)
    {
        var button = new Button { Content = text };
        button.Style = (Style)FindResource("TinyButton");
        return button;
    }

    private async Task MaybeApplyAutoGovernorAsync()
    {
        if (AutoLoadCheck.IsChecked != true || !_isWorking) return;
        if (DateTime.UtcNow - _lastGovernorApply < TimeSpan.FromSeconds(10)) return;

        var profile = LoadProfile.Auto(_lastCpu, _lastRam);
        LoadSlider.Value = profile.Level;
        LoadValueText.Text = $"{profile.Level}%";
        LoadModeText.Text = "\u0410\u0432\u0442\u043e  \u00b7  " + AutoLabel(profile.Level);

        if (_lastAppliedProfile != profile)
        {
            if (await _api.SetControlAsync(_currentMode, profile.Workers, profile.CpuLimit, profile.RamLimit,
                                           profile.HistoryBatch, profile.MetricBatch))
                _lastAppliedProfile = profile;
        }
        _lastGovernorApply = DateTime.UtcNow;
    }

    private static string AutoLabel(int level) =>
        level <= 35 ? "\u0442\u0438\u0445\u043e" :
        level <= 60 ? "\u0431\u0435\u0440\u0435\u0436\u043d\u043e" :
        level <= 82 ? "\u0441\u0431\u0430\u043b\u0430\u043d\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043e" :
        "\u043c\u0430\u043a\u0441. \u043f\u0440\u0438 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u043c \u041f\u041a";

    private async void WorkToggle_Click(object sender, RoutedEventArgs e)
    {
        if (_isWorking)
        {
            await _api.SetModeAsync("stop");
        }
        else
        {
            var profile = AutoLoadCheck.IsChecked == true
                ? LoadProfile.Auto(_lastCpu, _lastRam)
                : LoadProfile.FromLevel(LoadSlider.Value);
            await _api.SetControlAsync("light", profile.Workers, profile.CpuLimit, profile.RamLimit,
                                       profile.HistoryBatch, profile.MetricBatch);
            _lastAppliedProfile = profile;
        }
        await RefreshStateAsync();
    }

    private async void RefreshMarket_Click(object sender, RoutedEventArgs e)
    {
        if (!_isWorking)
        {
            CurrentActionText.Text = "\u0420\u0430\u0431\u043e\u0442\u0430 \u043d\u0430 \u043f\u0430\u0443\u0437\u0435";
            CurrentActionDetail.Text = "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u041d\u0430\u0447\u0430\u0442\u044c \u0440\u0430\u0431\u043e\u0442\u0443\u00bb, \u0437\u0430\u0442\u0435\u043c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0440\u044b\u043d\u043e\u043a";
            return;
        }
        var ok = await _api.RefreshMarketAsync();
        CurrentActionText.Text = ok ? "\u041e\u0431\u043d\u043e\u0432\u043b\u044f\u044e \u0440\u044b\u043d\u043e\u043a" : "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u043d\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u043e";
    }

    private async void LoadSlider_MouseUp(object sender, MouseButtonEventArgs e)
    {
        if (AutoLoadCheck.IsChecked == true) return;
        var p = LoadProfile.FromLevel(LoadSlider.Value);
        LoadModeText.Text = "\u0412\u0440\u0443\u0447\u043d\u0443\u044e";
        await _api.SetControlAsync(_isWorking ? _currentMode : "stop", p.Workers, p.CpuLimit, p.RamLimit,
                                   p.HistoryBatch, p.MetricBatch);
        _lastAppliedProfile = p;
    }

    private async void AutoLoadCheck_Changed(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded) return;
        LoadSlider.IsEnabled = AutoLoadCheck.IsChecked != true;
        LoadModeText.Text = AutoLoadCheck.IsChecked == true ? "\u0410\u0432\u0442\u043e" : "\u0412\u0440\u0443\u0447\u043d\u0443\u044e";
        _lastAppliedProfile = null;
        _lastGovernorApply = DateTime.MinValue;
        if (_isWorking) await MaybeApplyAutoGovernorAsync();
    }

    private async void AutoTasksCheck_Changed(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded || _syncingUi) return;
        await _api.SetAutoPlanAsync(AutoTasksCheck.IsChecked == true);
        await RefreshStateAsync();
    }

    private void SetRuntimeVisual(bool online, bool working)
    {
        if (!online)
        {
            StatusDot.Fill = RedBrush; SidebarDot.Fill = RedBrush;
            StatusText.Text = Ru("offline"); SidebarState.Text = "\u041d\u0435\u0442 \u0441\u0432\u044f\u0437\u0438";
            WorkToggle.IsEnabled = false;
            return;
        }

        WorkToggle.IsEnabled = true;
        StatusDot.Fill = working ? GreenBrush : AmberBrush;
        SidebarDot.Fill = working ? GreenBrush : AmberBrush;
        StatusText.Text = working ? Ru("online") : Ru("paused");
        SidebarState.Text = working ? "\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442" : "\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043d\u0430 \u043f\u0430\u0443\u0437\u0435";
        WorkToggle.Content = working ? Ru("pause") : Ru("start");
    }

    private async void Nav_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button b) return;
        SectionTitle.Text = b.Content?.ToString() ?? "TQS";
        await ShowCockpitAsync(b.Tag?.ToString() ?? "");
    }

    private async Task RunBusyAsync(string text, Func<Task> work)
    {
        if (_busy) return;
        _busy = true; BusyText.Text = text; BusyOverlay.Visibility = Visibility.Visible;
        try { await work(); }
        finally { BusyOverlay.Visibility = Visibility.Collapsed; _busy = false; }
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2) { WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized; return; }
        if (e.ButtonState == MouseButtonState.Pressed) DragMove();
    }
    private void Minimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void Maximize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    private void Close_Click(object sender, RoutedEventArgs e) => Close();

    private async void MainWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (_allowClose) return;
        e.Cancel = true; _statusTimer.Stop(); IsEnabled = false;
        BusyText.Text = "\u0417\u0430\u043a\u0440\u044b\u0432\u0430\u044e TQS \u0438 \u043e\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u044e \u0432\u0441\u0435 \u0435\u0433\u043e \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u044b\u2026";
        BusyOverlay.Visibility = Visibility.Visible;
        try { await _runtime.StopAsync(); } catch { }
        _allowClose = true; Close();
    }

    private static string JobTitle(JsonElement job)
    {
        var kind = Str(job, "kind");
        var payload = TryGet(job, "payload", out var p) ? p : default;
        var provider = payload.ValueKind == JsonValueKind.Object ? Str(p, "provider").ToUpperInvariant() : "";
        var symbol = payload.ValueKind == JsonValueKind.Object ? Str(p, "symbol") : "";
        var canonical = payload.ValueKind == JsonValueKind.Object ? Str(p, "canonical_id") : "";
        var strategy = payload.ValueKind == JsonValueKind.Object ? Str(p, "strategy_id") : "";
        var research = payload.ValueKind == JsonValueKind.Object ? Str(p, "research_project_id") : "";

        return kind switch
        {
            "historical_backfill" => $"\u0418\u0441\u0442\u043e\u0440\u0438\u044f {provider} {symbol}".Trim(),
            "derivative_metric_backfill" => $"\u041c\u0435\u0442\u0440\u0438\u043a\u0438 \u0434\u0435\u0440\u0438\u0432\u0430\u0442\u0438\u0432\u043e\u0432 {provider} {symbol}".Trim(),
            "research_project_run" => $"\u0418\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u0435 {research} {ShortInstrument(canonical)}".Trim(),
            "strategy_run" => $"\u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044f {strategy} {ShortInstrument(canonical)}".Trim(),
            "historical_replay" => $"\u0418\u0441\u0442\u043e\u0440\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0442\u0435\u0441\u0442 {ShortInstrument(canonical)}".Trim(),
            "verify_lake" => "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0430 \u0434\u0430\u043d\u043d\u044b\u0445",
            _ => "\u0424\u043e\u043d\u043e\u0432\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430"
        };
    }

    private static string ShortInstrument(string canonical)
    {
        if (string.IsNullOrWhiteSpace(canonical)) return "";
        var parts = canonical.Split(':');
        return parts.Length > 0 ? parts[^1] : canonical;
    }

    private static string StatusRu(string status) => status switch
    {
        "running" => "\u0412\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442\u0441\u044f",
        "queued" => "\u0412 \u043e\u0447\u0435\u0440\u0435\u0434\u0438",
        "done" => "\u0413\u043e\u0442\u043e\u0432\u043e",
        "failed" => "\u041e\u0448\u0438\u0431\u043a\u0430",
        "cancelled" => "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u043e",
        _ => status
    };

    private static bool TryGet(JsonElement e, string name, out JsonElement value)
    {
        value = default;
        return e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out value);
    }
    private static string Str(JsonElement e, string name) =>
        TryGet(e, name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    private static double Num(JsonElement e, string name) =>
        TryGet(e, name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var n) ? n : 0;
    private static int Int(JsonElement e, string name) =>
        TryGet(e, name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) ? n : 0;
    private static bool Bool(JsonElement e, string name) =>
        TryGet(e, name, out var v) && (v.ValueKind == JsonValueKind.True || (v.ValueKind == JsonValueKind.String && bool.TryParse(v.GetString(), out var b) && b));
    private static SolidColorBrush Brush(string hex) => new((Color)ColorConverter.ConvertFromString(hex));

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
}
