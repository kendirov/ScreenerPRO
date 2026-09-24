using System.Diagnostics;
using System.Net.Http;

namespace Kendirov.KirillDeviceHub;

internal static class SoftwareManager
{
    private static readonly HttpClient Http=new(){Timeout=TimeSpan.FromMinutes(10)};

    public static async Task<object> InstallUrl(string url)
    {
        var uri=new Uri(url);
        var name=Path.GetFileName(uri.LocalPath);
        if(string.IsNullOrWhiteSpace(name)) name="download.bin";
        var dst=Path.Combine(Path.GetTempPath(),"KDH-"+Guid.NewGuid().ToString("N")+"-"+name);
        var bytes=await Http.GetByteArrayAsync(uri);
        await File.WriteAllBytesAsync(dst,bytes);

        ProcessStartInfo psi;
        if(dst.EndsWith(".msi",StringComparison.OrdinalIgnoreCase))
            psi=new ProcessStartInfo("msiexec.exe",$"/i \"{dst}\""){UseShellExecute=true,Verb="runas"};
        else
            psi=new ProcessStartInfo(dst){UseShellExecute=true,Verb="runas"};

        Process.Start(psi);
        AuditLog.Write("install-url",true,new{url,file=dst});
        return new{ok=true,file=dst};
    }

    public static object WingetInstall(string id)
    {
        var p=Process.Start(new ProcessStartInfo{
            FileName="winget",
            Arguments=$"install --id \"{id}\" --exact --accept-package-agreements --accept-source-agreements",
            UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true
        });
        var output=p?.StandardOutput.ReadToEnd()??"";
        var error=p?.StandardError.ReadToEnd()??"";
        p?.WaitForExit(10*60*1000);
        var ok=p?.ExitCode==0;
        AuditLog.Write("winget-install",ok,new{id,output=output[^Math.Min(output.Length,2000)..],error=error[^Math.Min(error.Length,1000)..]});
        return new{ok,exitCode=p?.ExitCode,output,error};
    }

    public static object WingetUninstall(string id)
    {
        var p=Process.Start(new ProcessStartInfo{
            FileName="winget",
            Arguments=$"uninstall --id \"{id}\" --exact --accept-source-agreements",
            UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true
        });
        var output=p?.StandardOutput.ReadToEnd()??"";
        var error=p?.StandardError.ReadToEnd()??"";
        p?.WaitForExit(10*60*1000);
        var ok=p?.ExitCode==0;
        AuditLog.Write("winget-uninstall",ok,new{id});
        return new{ok,exitCode=p?.ExitCode,output,error};
    }

    public static object Launch(string file,string? args)
    {
        var p=Process.Start(new ProcessStartInfo{
            FileName=file,Arguments=args??"",UseShellExecute=true
        });
        AuditLog.Write("launch",true,new{file,args});
        return new{ok=true,pid=p?.Id};
    }

    public static object Kill(int pid)
    {
        var p=Process.GetProcessById(pid);
        var name=p.ProcessName;
        p.Kill(true);
        AuditLog.Write("kill-process",true,new{pid,name});
        return new{ok=true,pid,name};
    }

    public static object SafeDelete(string path)
    {
        path=Path.GetFullPath(Environment.ExpandEnvironmentVariables(path));
        if(File.Exists(path))
        {
            Microsoft.VisualBasic.FileIO.FileSystem.DeleteFile(path,
                Microsoft.VisualBasic.FileIO.UIOption.OnlyErrorDialogs,
                Microsoft.VisualBasic.FileIO.RecycleOption.SendToRecycleBin);
            AuditLog.Write("safe-delete",true,new{path});
            return new{ok=true,path};
        }
        if(Directory.Exists(path))
        {
            Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory(path,
                Microsoft.VisualBasic.FileIO.UIOption.OnlyErrorDialogs,
                Microsoft.VisualBasic.FileIO.RecycleOption.SendToRecycleBin);
            AuditLog.Write("safe-delete",true,new{path});
            return new{ok=true,path};
        }
        return new{ok=false,error="not_found",path};
    }
}
