using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace TQS.Desktop;

public sealed class TqsApiClient : IDisposable
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(3) };
    public string BaseUrl { get; } = "http://127.0.0.1:8787";

    public async Task<JsonDocument?> GetJsonAsync(string path)
    {
        try
        {
            using var response = await _http.GetAsync(BaseUrl + path);
            if (!response.IsSuccessStatusCode) return null;
            await using var stream = await response.Content.ReadAsStreamAsync();
            return await JsonDocument.ParseAsync(stream);
        }
        catch { return null; }
    }

    public async Task<bool> PostAsync(string path, object? payload = null)
    {
        try
        {
            HttpContent? content = null;
            if (payload != null)
                content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var response = await _http.PostAsync(BaseUrl + path, content);
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    public Task<bool> SetControlAsync(string? mode, int workers, int cpuLimit, int ramLimit,
                                      int historyBatch, int metricBatch)
        => PostAsync("/api/control", new
        {
            mode,
            heavy_workers = workers,
            cpu_soft_limit_pct = cpuLimit,
            ram_soft_limit_pct = ramLimit,
            history_batch_size = historyBatch,
            metric_batch_size = metricBatch
        });

    public Task<bool> SetModeAsync(string mode)
        => PostAsync("/api/control", new { mode });

    public Task<bool> SetAutoPlanAsync(bool enabled)
        => PostAsync("/api/control", new { auto_plan_enabled = enabled });

    public Task<bool> RefreshMarketAsync()
        => PostAsync("/api/refresh");

    public Task<bool> SetJobControlAsync(string jobId, bool? paused = null, int? priority = null)
        => PostAsync("/api/jobs/" + Uri.EscapeDataString(jobId) + "/control", new
        {
            paused,
            priority
        });

    public void Dispose() => _http.Dispose();
}

public readonly record struct LoadProfile(int Level, int Workers, int CpuLimit, int RamLimit,
                                          int HistoryBatch, int MetricBatch)
{
    public static LoadProfile FromLevel(double value)
    {
        var level = Math.Clamp((int)Math.Round(value), 20, 100);
        if (level <= 35) return new(level, 1, 58, 82, 1, 1);
        if (level <= 60) return new(level, 2, 70, 86, 2, 1);
        if (level <= 82) return new(level, 3, 82, 90, 4, 2);
        return new(level, 4, 90, 92, 6, 3);
    }

    public static LoadProfile Auto(double cpu, double ram)
    {
        if (cpu >= 75 || ram >= 88) return FromLevel(25);
        if (cpu >= 50 || ram >= 82) return FromLevel(45);
        if (cpu >= 25 || ram >= 75) return FromLevel(70);
        return FromLevel(92);
    }
}
