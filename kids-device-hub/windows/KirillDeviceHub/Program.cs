using System.Diagnostics;
using System.Security.Principal;

namespace Kendirov.KirillDeviceHub;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        if (args.Contains("--install", StringComparer.OrdinalIgnoreCase))
        {
            Installer.Install();
            return;
        }

        if (args.Contains("--uninstall", StringComparer.OrdinalIgnoreCase))
        {
            Installer.Uninstall();
            return;
        }

        if (!args.Contains("--agent", StringComparer.OrdinalIgnoreCase) && !Installer.IsInstalledPath())
        {
            if (!IsAdministrator())
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = Environment.ProcessPath!,
                        Arguments = "--install",
                        UseShellExecute = true,
                        Verb = "runas"
                    });
                }
                catch { }
                return;
            }

            Installer.Install();
            return;
        }

        Application.Run(new AgentApplicationContext());
    }

    public static bool IsAdministrator()
    {
        using var id = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
    }
}

internal sealed class AgentApplicationContext : ApplicationContext
{
    private readonly NotifyIcon tray;
    private readonly AgentServer server;
    private readonly UsageTracker usage;

    public AgentApplicationContext()
    {
        usage = new UsageTracker();
        server = new AgentServer(usage);
        server.Start();
        usage.Start();

        tray = new NotifyIcon
        {
            Text = "Kendirov Family Device Hub — Kirill",
            Icon = SystemIcons.Shield,
            Visible = true,
            ContextMenuStrip = new ContextMenuStrip()
        };

        tray.ContextMenuStrip.Items.Add("Статус", null, (_, _) => StatusWindow.ShowStatus(server, usage));
        tray.ContextMenuStrip.Items.Add("Папка данных", null, (_, _) => Process.Start("explorer.exe", Installer.DataDir));
        tray.ContextMenuStrip.Items.Add("Перезапустить агент", null, (_, _) => Installer.RestartTask());
        tray.ContextMenuStrip.Items.Add("Выход", null, (_, _) => ExitThread());
    }

    protected override void ExitThreadCore()
    {
        tray.Visible = false;
        tray.Dispose();
        server.Dispose();
        usage.Dispose();
        base.ExitThreadCore();
    }
}

internal static class StatusWindow
{
    public static void ShowStatus(AgentServer server, UsageTracker usage)
    {
        var text = $"Kendirov Family Device Hub — KIRILL\n" +
                   $"Version: {ThisAssembly.Version}\n" +
                   $"Port: {AgentServer.Port}\n" +
                   $"Tailscale IPv4: {NetworkUtil.GetTailscaleIpv4() ?? "not detected"}\n" +
                   $"Usage today: {TimeSpan.FromSeconds(usage.TotalSecondsToday):hh\\:mm\\:ss}\n" +
                   $"Controller: Tailscale + Pair Token\n\n" +
                   $"Agent is running in the interactive user session.";
        MessageBox.Show(text, "Family Device Hub", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }
}

internal static class ThisAssembly
{
    public static string Version => typeof(ThisAssembly).Assembly.GetName().Version?.ToString(3) ?? "1.0.0";
}
