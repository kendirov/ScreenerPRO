using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace Kendirov.KirillDeviceHub;

internal static class NetworkUtil
{
    public static string? GetTailscaleIpv4()
    {
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus != OperationalStatus.Up) continue;
                foreach (var ua in nic.GetIPProperties().UnicastAddresses)
                {
                    if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                    var b = ua.Address.GetAddressBytes();
                    if (b[0] == 100 && b[1] >= 64 && b[1] <= 127)
                        return ua.Address.ToString();
                }
            }
        }
        catch { }
        return null;
    }

    public static string MachineName => Environment.MachineName;
}
