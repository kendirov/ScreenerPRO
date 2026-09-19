using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace Kendirov.KirillDeviceHub;

internal static class InputAutomation
{
    public static void Click(int x,int y,string button="left")
    {
        Native.SetCursorPos(x,y);
        if(button.Equals("right",StringComparison.OrdinalIgnoreCase))
        {
            Native.mouse_event(Native.MOUSEEVENTF_RIGHTDOWN,0,0,0,UIntPtr.Zero);
            Native.mouse_event(Native.MOUSEEVENTF_RIGHTUP,0,0,0,UIntPtr.Zero);
        }
        else
        {
            Native.mouse_event(Native.MOUSEEVENTF_LEFTDOWN,0,0,0,UIntPtr.Zero);
            Native.mouse_event(Native.MOUSEEVENTF_LEFTUP,0,0,0,UIntPtr.Zero);
        }
    }

    public static void Key(byte vk,int repeats=1,int delayMs=80)
    {
        repeats=Math.Clamp(repeats,1,500);
        for(int i=0;i<repeats;i++)
        {
            Native.keybd_event(vk,0,0,UIntPtr.Zero);
            Native.keybd_event(vk,0,Native.KEYEVENTF_KEYUP,UIntPtr.Zero);
            Thread.Sleep(Math.Clamp(delayMs,10,5000));
        }
    }

    public static void Text(string value)
    {
        if(string.IsNullOrEmpty(value)) return;
        Exception? error=null;
        var t=new Thread(()=>{
            try { Clipboard.SetText(value); }
            catch(Exception e){ error=e; }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start(); t.Join();
        if(error!=null) throw error;

        Native.keybd_event(0x11,0,0,UIntPtr.Zero);
        Native.keybd_event(0x56,0,0,UIntPtr.Zero);
        Native.keybd_event(0x56,0,Native.KEYEVENTF_KEYUP,UIntPtr.Zero);
        Native.keybd_event(0x11,0,Native.KEYEVENTF_KEYUP,UIntPtr.Zero);
    }

    public static object RunScript(JsonElement steps)
    {
        if(steps.ValueKind!=JsonValueKind.Array) throw new ArgumentException("steps must be array");
        if(steps.GetArrayLength()>200) throw new ArgumentException("max 200 steps");

        foreach(var s in steps.EnumerateArray())
        {
            var action=s.GetProperty("action").GetString() ?? "";
            switch(action)
            {
                case "wait":
                    Thread.Sleep(Math.Clamp(s.GetProperty("ms").GetInt32(),0,30000));
                    break;
                case "click":
                    Click(s.GetProperty("x").GetInt32(),s.GetProperty("y").GetInt32(),s.TryGetProperty("button",out var b)?b.GetString()??"left":"left");
                    break;
                case "move":
                    Native.SetCursorPos(s.GetProperty("x").GetInt32(),s.GetProperty("y").GetInt32());
                    break;
                case "key":
                    Key((byte)s.GetProperty("vk").GetInt32(),
                        s.TryGetProperty("repeats",out var r)?r.GetInt32():1,
                        s.TryGetProperty("delayMs",out var d)?d.GetInt32():80);
                    break;
                case "text":
                    Text(s.GetProperty("value").GetString() ?? "");
                    break;
                case "launch":
                    Process.Start(new ProcessStartInfo{FileName=s.GetProperty("file").GetString()??"",UseShellExecute=true});
                    break;
                case "overlay":
                    OverlayManager.Show(
                        s.GetProperty("text").GetString()??"",
                        s.TryGetProperty("seconds",out var sec)?sec.GetInt32():10,
                        s.TryGetProperty("mode",out var mode)?mode.GetString()??"card":"card");
                    break;
                default:
                    throw new ArgumentException("unsupported action: "+action);
            }
        }
        return new{ok=true,steps=steps.GetArrayLength()};
    }
}
