using Microsoft.Win32;
using System.Diagnostics;
using System.Management;
using System.Text.Json;

namespace Kendirov.KirillDeviceHub;

internal static class SystemAudit
{
    public static object Status(UsageTracker usage) => new
    {
        ok = true,
        device = "kirill",
        version = ThisAssembly.Version,
        machine = Environment.MachineName,
        user = Environment.UserName,
        os = Environment.OSVersion.VersionString,
        is64Bit = Environment.Is64BitOperatingSystem,
        elevated = Program.IsAdministrator(),
        tailscaleIp = NetworkUtil.GetTailscaleIpv4(),
        port = AgentServer.Port,
        foregroundProcess = Native.ForegroundProcess(),
        foregroundTitle = Native.ForegroundTitle(),
        usageTodaySeconds = usage.TotalSecondsToday
    };

    public static object Processes()
    {
        var rows = new List<object>();
        foreach (var p in Process.GetProcesses())
        {
            try
            {
                rows.Add(new {
                    pid=p.Id,
                    name=p.ProcessName,
                    memory=p.WorkingSet64,
                    cpu=p.TotalProcessorTime.TotalSeconds,
                    responding=p.Responding,
                    path=Try(()=>p.MainModule?.FileName)
                });
            }
            catch { }
        }
        return new { processes=rows.OrderByDescending(x=>GetMemory(x)).Take(250).ToArray() };
    }

    private static long GetMemory(object o)
    {
        var prop=o.GetType().GetProperty("memory");
        return prop == null ? 0 : (long)(prop.GetValue(o) ?? 0L);
    }

    public static object Drives()
    {
        return new {
            drives=DriveInfo.GetDrives().Where(d=>d.IsReady).Select(d=>new {
                name=d.Name,type=d.DriveType.ToString(),format=d.DriveFormat,
                total=d.TotalSize,free=d.AvailableFreeSpace
            }).ToArray()
        };
    }

    public static object InstalledApps()
    {
        var list = new Dictionary<string,object>(StringComparer.OrdinalIgnoreCase);
        foreach (var hive in new[]{Registry.LocalMachine,Registry.CurrentUser})
        {
            foreach (var view in new[]{RegistryView.Registry64,RegistryView.Registry32})
            {
                try
                {
                    using var baseKey = RegistryKey.OpenBaseKey(hive==Registry.LocalMachine?RegistryHive.LocalMachine:RegistryHive.CurrentUser,view);
                    using var key=baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
                    if(key==null) continue;
                    foreach(var sub in key.GetSubKeyNames())
                    {
                        using var k=key.OpenSubKey(sub);
                        var name=k?.GetValue("DisplayName") as string;
                        if(string.IsNullOrWhiteSpace(name)) continue;
                        list[name]=new{
                            name,
                            version=k?.GetValue("DisplayVersion")?.ToString(),
                            publisher=k?.GetValue("Publisher")?.ToString(),
                            installLocation=k?.GetValue("InstallLocation")?.ToString(),
                            uninstall=k?.GetValue("UninstallString")?.ToString(),
                            quietUninstall=k?.GetValue("QuietUninstallString")?.ToString()
                        };
                    }
                } catch { }
            }
        }
        return new { apps=list.Values.OrderBy(x=>x.GetType().GetProperty("name")?.GetValue(x)?.ToString()).ToArray() };
    }

    public static object Startup()
    {
        var rows=new List<object>();
        foreach(var tuple in new[]{
            (Registry.CurrentUser,@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run","HKCU Run"),
            (Registry.LocalMachine,@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run","HKLM Run"),
            (Registry.LocalMachine,@"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run","HKLM32 Run")
        })
        {
            try
            {
                using var k=tuple.Item1.OpenSubKey(tuple.Item2);
                if(k==null) continue;
                foreach(var n in k.GetValueNames())
                    rows.Add(new {source=tuple.Item3,name=n,command=k.GetValue(n)?.ToString()});
            } catch { }
        }
        foreach(var folder in new[]{
            Environment.GetFolderPath(Environment.SpecialFolder.Startup),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup)
        })
        {
            try {
                foreach(var f in Directory.GetFiles(folder))
                    rows.Add(new {source="Startup folder",name=Path.GetFileName(f),command=f});
            } catch {}
        }
        return new { startup=rows.ToArray() };
    }

    public static object Services()
    {
        var rows=new List<object>();
        try
        {
            foreach(var s in System.ServiceProcess.ServiceController.GetServices())
            {
                try { rows.Add(new{name=s.ServiceName,display=s.DisplayName,status=s.Status.ToString(),type=s.ServiceType.ToString()}); }
                catch {}
            }
        } catch {}
        return new { services=rows.ToArray() };
    }

    public static object Files(string path)
    {
        path=Path.GetFullPath(Environment.ExpandEnvironmentVariables(path));
        if(!Directory.Exists(path)) return new {path,exists=false,items=Array.Empty<object>()};
        var items=Directory.EnumerateFileSystemEntries(path).Take(1000).Select(p=>{
            try{
                if(Directory.Exists(p)) return (object)new{name=Path.GetFileName(p),dir=true,size=0L,modified=Directory.GetLastWriteTime(p)};
                var fi=new FileInfo(p);
                return new{name=fi.Name,dir=false,size=fi.Length,modified=fi.LastWriteTime};
            }catch{return new{name=Path.GetFileName(p),dir=false,size=0L,modified=DateTime.MinValue};}
        }).ToArray();
        return new {path,exists=true,items};
    }

    public static object LargeFiles(string root,long minBytes,int max=300)
    {
        var list=new List<object>();
        root=Path.GetFullPath(Environment.ExpandEnvironmentVariables(root));
        if(!Directory.Exists(root)) return new{root,files=Array.Empty<object>()};
        var stack=new Stack<string>(); stack.Push(root);
        while(stack.Count>0 && list.Count<max)
        {
            var dir=stack.Pop();
            try{
                foreach(var sub in Directory.EnumerateDirectories(dir)) stack.Push(sub);
                foreach(var f in Directory.EnumerateFiles(dir))
                {
                    try{
                        var fi=new FileInfo(f);
                        if(fi.Length>=minBytes) list.Add(new{path=fi.FullName,size=fi.Length,modified=fi.LastWriteTime});
                    }catch{}
                }
            }catch{}
        }
        return new{root,files=list.OrderByDescending(x=>(long)(x.GetType().GetProperty("size")!.GetValue(x)!)).Take(max).ToArray()};
    }

    private static T? Try<T>(Func<T> f) { try{return f();}catch{return default;} }
}
