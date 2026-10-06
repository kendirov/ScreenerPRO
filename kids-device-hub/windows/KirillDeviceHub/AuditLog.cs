using System.Text.Json;

namespace Kendirov.KirillDeviceHub;

internal static class AuditLog
{
    private static readonly object Gate = new();
    private static string FilePath => Path.Combine(Installer.DataDir, "logs", "audit.jsonl");

    public static void Write(string action, bool ok, object? detail = null)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
            var row = JsonSerializer.Serialize(new
            {
                ts = DateTimeOffset.Now,
                action,
                ok,
                detail
            });
            lock (Gate) File.AppendAllText(FilePath, row + Environment.NewLine);
        }
        catch { }
    }
}
