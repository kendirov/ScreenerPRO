using System.Diagnostics;
using System.Security.Cryptography;

namespace Kendirov.KirillDeviceHub;

internal static class Installer
{
    public static readonly string DataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "KendirovFamilyDeviceHub");
    public static readonly string InstalledExe = Path.Combine(DataDir, "Kirill-Family-Device-Hub.exe");
    public static readonly string TokenFile = Path.Combine(DataDir, "pair-token.txt");
    public const string TaskName = "Kendirov Family Device Hub - Kirill";

    public static bool IsInstalledPath()
    {
        try
        {
            return string.Equals(
                Path.GetFullPath(Environment.ProcessPath ?? ""),
                Path.GetFullPath(InstalledExe),
                StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    public static void Install()
    {
        if (!Program.IsAdministrator())
        {
            MessageBox.Show("Для установки нужны права администратора.", "Family Device Hub");
            return;
        }

        Directory.CreateDirectory(DataDir);
        Directory.CreateDirectory(Path.Combine(DataDir, "logs"));
        Directory.CreateDirectory(Path.Combine(DataDir, "screenshots"));
        Directory.CreateDirectory(Path.Combine(DataDir, "updates"));

        if (!File.Exists(TokenFile))
        {
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
            File.WriteAllText(TokenFile, token);
        }

        var source = Environment.ProcessPath!;
        if (!string.Equals(Path.GetFullPath(source), Path.GetFullPath(InstalledExe), StringComparison.OrdinalIgnoreCase))
            File.Copy(source, InstalledExe, true);

        Run("netsh", $"advfirewall firewall delete rule name=\"{TaskName}\"");
        Run("netsh", $"advfirewall firewall add rule name=\"{TaskName}\" dir=in action=allow protocol=TCP localport={AgentServer.Port} profile=any");

        var tr = $"\"{InstalledExe}\" --agent";
        Run("schtasks", $"/Create /F /SC ONLOGON /RL HIGHEST /TN \"{TaskName}\" /TR \"{tr}\"");
        Run("schtasks", $"/Run /TN \"{TaskName}\"");

        var tailscale = NetworkUtil.GetTailscaleIpv4();
        var msg = "Установка завершена.\n\n" +
                  $"Agent: {InstalledExe}\n" +
                  $"Port: {AgentServer.Port}\n" +
                  $"Tailscale: {tailscale ?? "не найден — установите/войдите в Tailscale один раз"}\n\n" +
                  "Приложение будет запускаться автоматически при входе в Windows.";
        MessageBox.Show(msg, "Kendirov Family Device Hub — Kirill", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    public static void Uninstall()
    {
        if (!Program.IsAdministrator())
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = Environment.ProcessPath!,
                    Arguments = "--uninstall",
                    UseShellExecute = true,
                    Verb = "runas"
                });
            }
            catch { }
            return;
        }

        Run("schtasks", $"/End /TN \"{TaskName}\"");
        Run("schtasks", $"/Delete /F /TN \"{TaskName}\"");
        Run("netsh", $"advfirewall firewall delete rule name=\"{TaskName}\"");
        MessageBox.Show("Агент отключён. Папка данных оставлена для журналов и восстановления.", "Family Device Hub");
    }

    public static void RestartTask()
    {
        Run("schtasks", $"/End /TN \"{TaskName}\"");
        Thread.Sleep(500);
        Run("schtasks", $"/Run /TN \"{TaskName}\"");
    }

    private static void Run(string file, string args)
    {
        try
        {
            using var p = Process.Start(new ProcessStartInfo
            {
                FileName = file,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
            p?.WaitForExit(15000);
        }
        catch { }
    }
}
