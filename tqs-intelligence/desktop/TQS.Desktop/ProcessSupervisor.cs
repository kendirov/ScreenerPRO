using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace TQS.Desktop;

public sealed class ProcessSupervisor : IDisposable
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(2) };
    private readonly SemaphoreSlim _gate = new(1, 1);
    private WindowsJob? _job;
    private Process? _supervisor;
    private bool _disposed;

    public string Root { get; }
    public string BaseUrl { get; } = "http://127.0.0.1:8787";
    public bool OwnsRuntime => _supervisor is { HasExited: false };
    public int? OwnedPid => OwnsRuntime ? _supervisor!.Id : null;

    public ProcessSupervisor()
    {
        Root = ResolveRoot();
    }

    public static string ResolveRoot()
    {
        var env = Environment.GetEnvironmentVariable("TQS_INTELLIGENCE_ROOT");
        if (!string.IsNullOrWhiteSpace(env) && File.Exists(Path.Combine(env, "pyproject.toml")))
            return Path.GetFullPath(env);

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 10 && current != null; i++, current = current.Parent)
        {
            if (File.Exists(Path.Combine(current.FullName, "pyproject.toml")) &&
                Directory.Exists(Path.Combine(current.FullName, "src", "tqs_intelligence")))
                return current.FullName;
        }

        var fallback = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "GitHub", "ScreenerPRO", "tqs-intelligence");
        if (File.Exists(Path.Combine(fallback, "pyproject.toml")))
            return fallback;

        throw new DirectoryNotFoundException("Не найден каталог tqs-intelligence.");
    }

    public async Task<RuntimeStatus> GetStatusAsync()
    {
        try
        {
            using var response = await _http.GetAsync(BaseUrl + "/api/health");
            var json = await response.Content.ReadAsStringAsync();
            return new RuntimeStatus(response.IsSuccessStatusCode, json, OwnsRuntime, OwnedPid, null);
        }
        catch (Exception ex)
        {
            return new RuntimeStatus(false, null, OwnsRuntime, OwnedPid, ex.GetType().Name);
        }
    }

    public async Task<bool> StartAsync()
    {
        await _gate.WaitAsync();
        try
        {
            var health = await GetStatusAsync();
            if (health.Online && !OwnsRuntime)
            {
                await CleanupOrphansAsync();
                await Task.Delay(500);
            }
            else if (health.Online)
            {
                return true;
            }

            var python = Path.Combine(Root, ".venv", "Scripts", "python.exe");
            if (!File.Exists(python))
                throw new FileNotFoundException("Не найден .venv\\Scripts\\python.exe", python);

            SetSafeStartupControl();

            var stopMarker = Path.Combine(Root, "data", "server-stop.flag");
            if (File.Exists(stopMarker))
                File.Delete(stopMarker);

            Directory.CreateDirectory(Path.Combine(Root, "data"));
            var logPath = Path.Combine(Root, "data", "desktop-runtime.log");

            _job?.Dispose();
            _job = new WindowsJob();

            var psi = new ProcessStartInfo
            {
                FileName = python,
                Arguments = "-m tqs_intelligence.supervisor",
                WorkingDirectory = Root,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            psi.Environment["TQS_DESKTOP_SESSION"] = Environment.ProcessId.ToString();

            _supervisor = new Process { StartInfo = psi, EnableRaisingEvents = true };
            _supervisor.Start();
            try { _supervisor.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
            _job.Assign(_supervisor);

            _ = PumpAsync(_supervisor.StandardOutput, logPath);
            _ = PumpAsync(_supervisor.StandardError, logPath);

            var deadline = DateTime.UtcNow.AddSeconds(55);
            while (DateTime.UtcNow < deadline)
            {
                if (_supervisor.HasExited)
                    break;
                if ((await GetStatusAsync()).Online)
                    return true;
                await Task.Delay(600);
            }

            return (await GetStatusAsync()).Online;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task StopAsync()
    {
        await _gate.WaitAsync();
        try
        {
            Directory.CreateDirectory(Path.Combine(Root, "data"));
            await File.WriteAllTextAsync(Path.Combine(Root, "data", "server-stop.flag"),
                "desktop session closed\n");

            try
            {
                using var body = new StringContent("{\"mode\":\"stop\"}", Encoding.UTF8, "application/json");
                await _http.PostAsync(BaseUrl + "/api/control", body);
            }
            catch { }

            if (_supervisor is { HasExited: false })
            {
                try
                {
                    await _supervisor.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromSeconds(3)).Token);
                }
                catch { }
            }

            _job?.Dispose();
            _job = null;

            try
            {
                if (_supervisor is { HasExited: false })
                    _supervisor.Kill(entireProcessTree: true);
            }
            catch { }

            _supervisor?.Dispose();
            _supervisor = null;

            await CleanupOrphansAsync();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task RestartAsync()
    {
        await StopAsync();
        var stopMarker = Path.Combine(Root, "data", "server-stop.flag");
        if (File.Exists(stopMarker)) File.Delete(stopMarker);
        await StartAsync();
    }

    public async Task SetModeAsync(string mode)
    {
        if (mode is not ("stop" or "light" or "max"))
            throw new ArgumentOutOfRangeException(nameof(mode));

        using var body = new StringContent(
            JsonSerializer.Serialize(new { mode }),
            Encoding.UTF8,
            "application/json");
        using var response = await _http.PostAsync(BaseUrl + "/api/control", body);
        response.EnsureSuccessStatusCode();
    }

    private void SetSafeStartupControl()
    {
        try
        {
            var dataDir = Path.Combine(Root, "data");
            Directory.CreateDirectory(dataDir);
            var path = Path.Combine(dataDir, "control.json");
            Dictionary<string, object?> state;
            if (File.Exists(path))
            {
                state = JsonSerializer.Deserialize<Dictionary<string, object?>>(
                    File.ReadAllText(path)) ?? new Dictionary<string, object?>();
            }
            else
            {
                state = new Dictionary<string, object?>();
            }
            state["mode"] = "stop";
            state["changed_by"] = "tqs-desktop-safe-start";
            File.WriteAllText(path, JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch { }
    }

    private async Task CleanupOrphansAsync()
    {
        var script =
            "$ErrorActionPreference='SilentlyContinue';" +
            "$me=" + Environment.ProcessId + ";" +
            "Get-CimInstance Win32_Process | Where-Object {" +
            "$_.ProcessId -ne $me -and ($_.CommandLine -match 'tqs_intelligence\\.supervisor' -or " +
            "$_.CommandLine -match 'uvicorn.*tqs_intelligence' -or $_.CommandLine -match 'tqs_intelligence\\.api')" +
            "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"" +
                        script.Replace("\"", "\\\"") + "\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        using var p = Process.Start(psi);
        if (p != null)
        {
            try { await p.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromSeconds(8)).Token); }
            catch { try { p.Kill(); } catch { } }
        }
    }

    private static async Task PumpAsync(StreamReader reader, string path)
    {
        try
        {
            await using var writer = new StreamWriter(
                new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite))
            { AutoFlush = true };
            while (await reader.ReadLineAsync() is { } line)
                await writer.WriteLineAsync($"[{DateTime.Now:HH:mm:ss}] {line}");
        }
        catch { }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try { _job?.Dispose(); } catch { }
        try
        {
            if (_supervisor is { HasExited: false })
                _supervisor.Kill(entireProcessTree: true);
        }
        catch { }
        _supervisor?.Dispose();
        _http.Dispose();
        _gate.Dispose();
    }
}

public sealed record RuntimeStatus(
    bool Online,
    string? HealthJson,
    bool Owned,
    int? Pid,
    string? Error);

internal sealed class WindowsJob : IDisposable
{
    private IntPtr _handle;

    public WindowsJob()
    {
        _handle = CreateJobObject(IntPtr.Zero, null);
        if (_handle == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error());

        var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        var length = Marshal.SizeOf<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>();
        var ptr = Marshal.AllocHGlobal(length);
        try
        {
            Marshal.StructureToPtr(info, ptr, false);
            if (!SetInformationJobObject(_handle, JobObjectInfoType.ExtendedLimitInformation, ptr, (uint)length))
                throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        finally
        {
            Marshal.FreeHGlobal(ptr);
        }
    }

    public void Assign(Process process)
    {
        if (!AssignProcessToJobObject(_handle, process.Handle))
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    public void Dispose()
    {
        if (_handle == IntPtr.Zero) return;
        CloseHandle(_handle);
        _handle = IntPtr.Zero;
    }

    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

    private enum JobObjectInfoType
    {
        ExtendedLimitInformation = 9
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string? lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(
        IntPtr hJob,
        JobObjectInfoType infoType,
        IntPtr lpJobObjectInfo,
        uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr hObject);
}
