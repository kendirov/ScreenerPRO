using System.Text.Json;

namespace Kendirov.KirillDeviceHub;

internal sealed class UsageTracker : IDisposable
{
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 5000 };
    private readonly Dictionary<string,long> today = new(StringComparer.OrdinalIgnoreCase);
    private DateOnly day = DateOnly.FromDateTime(DateTime.Now);
    private readonly string file = Path.Combine(Installer.DataDir,"usage-today.json");

    public UsageTracker()
    {
        Load();
        timer.Tick += (_,_) => Tick();
    }

    public void Start() => timer.Start();

    private void Tick()
    {
        var nowDay = DateOnly.FromDateTime(DateTime.Now);
        if (nowDay != day)
        {
            day = nowDay;
            today.Clear();
        }

        var p = Native.ForegroundProcess();
        if (!string.IsNullOrWhiteSpace(p))
            today[p] = today.GetValueOrDefault(p) + 5;

        if (DateTime.Now.Second < 6) Save();
    }

    public long TotalSecondsToday => today.Values.Sum();

    public object Snapshot() => new
    {
        date = day.ToString("yyyy-MM-dd"),
        totalSeconds = TotalSecondsToday,
        apps = today.OrderByDescending(x=>x.Value)
                    .Select(x=>new { process=x.Key, seconds=x.Value })
                    .ToArray()
    };

    private void Load()
    {
        try
        {
            if (!File.Exists(file)) return;
            var doc = JsonDocument.Parse(File.ReadAllText(file));
            var d = doc.RootElement.GetProperty("date").GetString();
            if (d != day.ToString("yyyy-MM-dd")) return;
            foreach(var e in doc.RootElement.GetProperty("apps").EnumerateArray())
                today[e.GetProperty("process").GetString() ?? "unknown"] = e.GetProperty("seconds").GetInt64();
        }
        catch { }
    }

    private void Save()
    {
        try
        {
            Directory.CreateDirectory(Installer.DataDir);
            File.WriteAllText(file, JsonSerializer.Serialize(Snapshot(), new JsonSerializerOptions{WriteIndented=true}));
        }
        catch { }
    }

    public void Dispose()
    {
        timer.Stop();
        timer.Dispose();
        Save();
    }
}
