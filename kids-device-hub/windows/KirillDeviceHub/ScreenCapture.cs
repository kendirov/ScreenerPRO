using System.Drawing;
using System.Drawing.Imaging;

namespace Kendirov.KirillDeviceHub;

internal static class ScreenCapture
{
    public static byte[] CapturePng()
    {
        var bounds=SystemInformation.VirtualScreen;
        using var bmp=new Bitmap(bounds.Width,bounds.Height,PixelFormat.Format32bppArgb);
        using(var g=Graphics.FromImage(bmp))
            g.CopyFromScreen(bounds.Left,bounds.Top,0,0,bounds.Size,CopyPixelOperation.SourceCopy);
        using var ms=new MemoryStream();
        bmp.Save(ms,ImageFormat.Png);
        return ms.ToArray();
    }
}
