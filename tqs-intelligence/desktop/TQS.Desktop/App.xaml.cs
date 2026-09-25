using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace TQS.Desktop;

public partial class App : Application
{
    private Mutex? _singleInstance;

    protected override async void OnStartup(StartupEventArgs e)
    {
        _singleInstance = new Mutex(true, @"Local\TQS.Intelligence.Desktop", out var createdNew);
        if (!createdNew)
        {
            Shutdown(3);
            return;
        }

        base.OnStartup(e);

        if (e.Args.Contains("--lifecycle-smoke", StringComparer.OrdinalIgnoreCase))
        {
            var code = await RunLifecycleSmokeAsync();
            Shutdown(code);
            return;
        }

        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }

    private static async Task<int> RunLifecycleSmokeAsync()
    {
        using var runtime = new ProcessSupervisor();
        var started = false;
        var onlineBeforeStop = false;
        var offlineAfterStop = false;
        string? error = null;

        try
        {
            started = await runtime.StartAsync();
            onlineBeforeStop = (await runtime.GetStatusAsync()).Online;
            await runtime.StopAsync();
            await Task.Delay(1200);
            offlineAfterStop = !(await runtime.GetStatusAsync()).Online;
        }
        catch (Exception ex)
        {
            error = ex.ToString();
            try { await runtime.StopAsync(); } catch { }
        }

        var result = new
        {
            timestamp = DateTimeOffset.Now,
            started,
            online_before_stop = onlineBeforeStop,
            offline_after_stop = offlineAfterStop,
            pass = started && onlineBeforeStop && offlineAfterStop && error == null,
            error
        };

        var path = Path.Combine(runtime.Root, "data", "desktop-lifecycle-smoke.json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine(JsonSerializer.Serialize(result));
        return result.pass ? 0 : 2;
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try
        {
            _singleInstance?.ReleaseMutex();
            _singleInstance?.Dispose();
        }
        catch { }

        base.OnExit(e);
    }
}
