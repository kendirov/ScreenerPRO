using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace Kendirov.KirillDeviceHub;

internal sealed class ReverseControlClient : IDisposable
{
    private readonly HttpClient http = new(){Timeout=TimeSpan.FromSeconds(20)};
    private readonly CancellationTokenSource cts = new();
    private readonly UsageTracker usage;
    private Task? loop;
    private const string ControllerBase = "http://100.95.246.112:8775";
    private const string DeviceKey = "kirill";

    public ReverseControlClient(UsageTracker usage){this.usage=usage;}

    public void Start(){loop=Task.Run(()=>Loop(cts.Token));}

    private async Task Loop(CancellationToken ct)
    {
        while(!ct.IsCancellationRequested)
        {
            try
            {
                var token=File.Exists(Installer.TokenFile)?File.ReadAllText(Installer.TokenFile).Trim():"";
                if(token.Length<32){await Task.Delay(5000,ct);continue;}
                using var req=new HttpRequestMessage(HttpMethod.Get,$"{ControllerBase}/poll?device={DeviceKey}");
                req.Headers.Add("X-Hub-Token",token);
                using var resp=await http.SendAsync(req,ct);
                if(resp.StatusCode==System.Net.HttpStatusCode.NoContent){await Task.Delay(2500,ct);continue;}
                resp.EnsureSuccessStatusCode();
                var json=await resp.Content.ReadAsStringAsync(ct);
                using var doc=JsonDocument.Parse(json);
                var id=doc.RootElement.GetProperty("id").GetString()??"";
                var action=doc.RootElement.GetProperty("action").GetString()??"";
                var args=doc.RootElement.TryGetProperty("args",out var a)?a.Clone():default;
                var result=Execute(action,args);
                var body=JsonSerializer.Serialize(new{id,device=DeviceKey,ok=true,result});
                using var post=new HttpRequestMessage(HttpMethod.Post,$"{ControllerBase}/result");
                post.Headers.Add("X-Hub-Token",token);
                post.Content=new StringContent(body,Encoding.UTF8,"application/json");
                await http.SendAsync(post,ct);
            }
            catch(OperationCanceledException){break;}
            catch(Exception e)
            {
                AuditLog.Write("reverse-control",false,e.Message);
                try{await Task.Delay(5000,ct);}catch{}
            }
        }
    }

    private object Execute(string action,JsonElement args)
    {
        object result=action switch
        {
            "status" => SystemAudit.Status(usage),
            "usage" => usage.Snapshot(),
            "processes" => SystemAudit.Processes(),
            "apps" => SystemAudit.InstalledApps(),
            "startup" => SystemAudit.Startup(),
            "services" => SystemAudit.Services(),
            "drives" => SystemAudit.Drives(),
            "files" => SystemAudit.Files(S(args,"path",Environment.GetFolderPath(Environment.SpecialFolder.UserProfile))),
            "large-files" => SystemAudit.LargeFiles(S(args,"path",Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)),L(args,"minBytes",500L*1024*1024),(int)L(args,"max",200)),
            "screenshot" => new{pngBase64=Convert.ToBase64String(ScreenCapture.CapturePng())},
            "click" => Do(()=>InputAutomation.Click((int)L(args,"x",0),(int)L(args,"y",0),S(args,"button","left"))),
            "move" => Do(()=>Native.SetCursorPos((int)L(args,"x",0),(int)L(args,"y",0))),
            "key" => Do(()=>InputAutomation.Key((byte)L(args,"vk",0),(int)L(args,"repeats",1),(int)L(args,"delayMs",80))),
            "text" => Do(()=>InputAutomation.Text(S(args,"value",""))),
            "overlay" => Do(()=>OverlayManager.Show(S(args,"text",""),(int)L(args,"seconds",10),S(args,"mode","card"),S(args,"position","top-right"))),
            "timer" => Do(()=>OverlayManager.StartTimer((int)L(args,"minutes",60),S(args,"text",""),S(args,"endAction","none"))),
            "lock" => Do(()=>Native.LockWorkStation()),
            "launch" => SoftwareManager.Launch(S(args,"file",""),S(args,"arguments","")),
            "kill" => SoftwareManager.Kill((int)L(args,"pid",0)),
            "safe-delete" => SoftwareManager.SafeDelete(S(args,"path","")),
            "winget-install" => SoftwareManager.WingetInstall(S(args,"id","")),
            "winget-uninstall" => SoftwareManager.WingetUninstall(S(args,"id","")),
            _ => new{error="unsupported_action",action}
        };
        AuditLog.Write("reverse-"+action,true);
        return result;
    }

    private static object Do(Action a){a();return new{ok=true};}
    private static string S(JsonElement e,string n,string f)=>e.ValueKind==JsonValueKind.Object&&e.TryGetProperty(n,out var v)?v.GetString()??f:f;
    private static long L(JsonElement e,string n,long f)=>e.ValueKind==JsonValueKind.Object&&e.TryGetProperty(n,out var v)&&v.TryGetInt64(out var x)?x:f;

    public void Dispose(){cts.Cancel();http.Dispose();}
}
