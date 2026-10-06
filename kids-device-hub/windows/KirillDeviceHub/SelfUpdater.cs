using System.Diagnostics;
using System.Net.Http;

namespace Kendirov.KirillDeviceHub;

internal static class SelfUpdater
{
    private static readonly HttpClient Http=new(){Timeout=TimeSpan.FromMinutes(10)};

    public static object Start(string url)
    {
        if(string.IsNullOrWhiteSpace(url)) return new{ok=false,error="url_required"};
        var updates=Path.Combine(Installer.DataDir,"updates");
        Directory.CreateDirectory(updates);
        var next=Path.Combine(updates,"Kirill-Family-Device-Hub.new.exe");
        var script=Path.Combine(updates,"apply-update.cmd");

        Http.GetByteArrayAsync(url).ContinueWith(t=>{
            if(t.IsFaulted)
            {
                AuditLog.Write("self-update-download",false,t.Exception?.GetBaseException().Message);
                return;
            }
            try
            {
                File.WriteAllBytes(next,t.Result);
                var pid=Environment.ProcessId;
                var cmd=$@"@echo off
setlocal
:wait
tasklist /FI ""PID eq {pid}"" | find ""{pid}"" >nul
if not errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)
copy /y ""{next}"" ""{Installer.InstalledExe}"" >nul
schtasks /Run /TN ""{Installer.TaskName}""
del /q ""{next}""
del /q ""%~f0""
";
                File.WriteAllText(script,cmd);
                AuditLog.Write("self-update-download",true,new{url,next});
                Process.Start(new ProcessStartInfo{
                    FileName="cmd.exe",
                    Arguments=$"/c start \"\" /min \"{script}\"",
                    UseShellExecute=false,
                    CreateNoWindow=true
                });
                Environment.Exit(0);
            }
            catch(Exception e){AuditLog.Write("self-update-stage",false,e.Message);}
        });

        return new{ok=true,status="downloading",url};
    }
}
