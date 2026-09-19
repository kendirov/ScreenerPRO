using System.Net;
using System.Text;
using System.Text.Json;

namespace Kendirov.KirillDeviceHub;

internal sealed class AgentServer : IDisposable
{
    public const int Port = 8772;
    private readonly HttpListener listener = new();
    private readonly UsageTracker usage;
    private readonly CancellationTokenSource cts = new();
    private Task? loop;
    private readonly string token;

    public AgentServer(UsageTracker usage)
    {
        this.usage=usage;
        Directory.CreateDirectory(Installer.DataDir);
        token=File.Exists(Installer.TokenFile)?File.ReadAllText(Installer.TokenFile).Trim():"";
        listener.Prefixes.Add($"http://+:{Port}/");
    }

    public void Start()
    {
        try
        {
            listener.Start();
            loop=Task.Run(()=>Loop(cts.Token));
            AuditLog.Write("agent-start",true,new{port=Port});
        }
        catch(Exception e)
        {
            AuditLog.Write("agent-start",false,e.Message);
            MessageBox.Show("Не удалось запустить Family Device Hub: "+e.Message,"Family Device Hub");
        }
    }

    private async Task Loop(CancellationToken ct)
    {
        while(!ct.IsCancellationRequested && listener.IsListening)
        {
            HttpListenerContext ctx;
            try { ctx=await listener.GetContextAsync(); }
            catch { break; }
            _=Task.Run(()=>Handle(ctx),ct);
        }
    }

    private async Task Handle(HttpListenerContext ctx)
    {
        var started=DateTime.UtcNow;
        try
        {
            var path=ctx.Request.Url?.AbsolutePath ?? "/";
            if(!Authorized(ctx))
            {
                await Json(ctx,403,new{error="forbidden"});
                return;
            }

            switch(path.ToLowerInvariant())
            {
                case "/status":
                    await Json(ctx,200,SystemAudit.Status(usage)); break;
                case "/screenshot":
                    await Bytes(ctx,200,"image/png",ScreenCapture.CapturePng()); break;
                case "/usage":
                    await Json(ctx,200,usage.Snapshot()); break;
                case "/processes":
                    await Json(ctx,200,SystemAudit.Processes()); break;
                case "/apps":
                    await Json(ctx,200,SystemAudit.InstalledApps()); break;
                case "/startup":
                    await Json(ctx,200,SystemAudit.Startup()); break;
                case "/services":
                    await Json(ctx,200,SystemAudit.Services()); break;
                case "/drives":
                    await Json(ctx,200,SystemAudit.Drives()); break;
                case "/files":
                    await Json(ctx,200,SystemAudit.Files(Q(ctx,"path",Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)))); break;
                case "/large-files":
                    await Json(ctx,200,SystemAudit.LargeFiles(
                        Q(ctx,"path",Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)),
                        LongQ(ctx,"minBytes",500L*1024*1024),
                        (int)LongQ(ctx,"max",200))); break;
                case "/click":
                    InputAutomation.Click((int)LongQ(ctx,"x",0),(int)LongQ(ctx,"y",0),Q(ctx,"button","left"));
                    AuditLog.Write("click",true,new{x=Q(ctx,"x","0"),y=Q(ctx,"y","0")});
                    await Json(ctx,200,new{ok=true}); break;
                case "/move":
                    Native.SetCursorPos((int)LongQ(ctx,"x",0),(int)LongQ(ctx,"y",0));
                    await Json(ctx,200,new{ok=true}); break;
                case "/key":
                    InputAutomation.Key((byte)LongQ(ctx,"vk",0),(int)LongQ(ctx,"repeats",1),(int)LongQ(ctx,"delayMs",80));
                    AuditLog.Write("key",true,new{vk=Q(ctx,"vk",""),repeats=Q(ctx,"repeats","1")});
                    await Json(ctx,200,new{ok=true}); break;
                case "/text":
                    InputAutomation.Text(Q(ctx,"value",""));
                    AuditLog.Write("text-input",true,new{length=Q(ctx,"value","").Length});
                    await Json(ctx,200,new{ok=true}); break;
                case "/overlay":
                    OverlayManager.Show(Q(ctx,"text",""),(int)LongQ(ctx,"seconds",10),Q(ctx,"mode","card"));
                    AuditLog.Write("overlay",true,new{text=Q(ctx,"text",""),seconds=LongQ(ctx,"seconds",10)});
                    await Json(ctx,200,new{ok=true}); break;
                case "/timer":
                    OverlayManager.StartTimer((int)LongQ(ctx,"minutes",60),Q(ctx,"text",""),Q(ctx,"endAction","none"));
                    AuditLog.Write("timer",true,new{minutes=LongQ(ctx,"minutes",60),endAction=Q(ctx,"endAction","none")});
                    await Json(ctx,200,new{ok=true}); break;
                case "/lock":
                    Native.LockWorkStation();
                    AuditLog.Write("lock",true);
                    await Json(ctx,200,new{ok=true}); break;
                case "/launch":
                    await Json(ctx,200,SoftwareManager.Launch(Q(ctx,"file",""),Q(ctx,"args",""))); break;
                case "/kill":
                    await Json(ctx,200,SoftwareManager.Kill((int)LongQ(ctx,"pid",0))); break;
                case "/safe-delete":
                    await Json(ctx,200,SoftwareManager.SafeDelete(Q(ctx,"path",""))); break;
                case "/install-url":
                    await Json(ctx,200,await SoftwareManager.InstallUrl(Q(ctx,"url",""))); break;
                case "/winget-install":
                    await Json(ctx,200,SoftwareManager.WingetInstall(Q(ctx,"id",""))); break;
                case "/winget-uninstall":
                    await Json(ctx,200,SoftwareManager.WingetUninstall(Q(ctx,"id",""))); break;
                case "/script":
                    {
                        string body;
                        if(ctx.Request.HttpMethod.Equals("POST",StringComparison.OrdinalIgnoreCase))
                        {
                            using var sr=new StreamReader(ctx.Request.InputStream,ctx.Request.ContentEncoding);
                            body=await sr.ReadToEndAsync();
                        }
                        else body=Q(ctx,"json","[]");
                        using var doc=JsonDocument.Parse(body);
                        var result=InputAutomation.RunScript(doc.RootElement);
                        AuditLog.Write("script",true,new{steps=doc.RootElement.GetArrayLength()});
                        await Json(ctx,200,result);
                        break;
                    }
                case "/audit":
                    await Json(ctx,200,new{
                        status=SystemAudit.Status(usage),
                        drives=SystemAudit.Drives(),
                        startup=SystemAudit.Startup(),
                        processes=SystemAudit.Processes()
                    }); break;
                case "/self-update":
                    await Json(ctx,200,SelfUpdater.Start(Q(ctx,"url",""))); break;
                default:
                    await Json(ctx,404,new{error="not_found",path}); break;
            }
        }
        catch(Exception e)
        {
            AuditLog.Write("request",false,new{path=ctx.Request.Url?.AbsolutePath,error=e.Message});
            try { await Json(ctx,500,new{error=e.GetType().Name,message=e.Message}); } catch { }
        }
        finally
        {
            try { ctx.Response.Close(); } catch { }
        }
    }

    private bool Authorized(HttpListenerContext ctx)
    {
        if(ctx.Request.RemoteEndPoint?.Address.Equals(IPAddress.Loopback)==true) return true;
        var supplied=ctx.Request.Headers["X-Hub-Token"] ?? ctx.Request.QueryString["token"] ?? "";
        return token.Length>=32 && CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(token),
            Encoding.UTF8.GetBytes(supplied.PadRight(token.Length).Substring(0,token.Length))) && supplied.Length==token.Length;
    }

    private static string Q(HttpListenerContext ctx,string key,string fallback)
        => ctx.Request.QueryString[key] ?? fallback;

    private static long LongQ(HttpListenerContext ctx,string key,long fallback)
        => long.TryParse(ctx.Request.QueryString[key],out var n)?n:fallback;

    private static async Task Json(HttpListenerContext ctx,int status,object obj)
    {
        var bytes=JsonSerializer.SerializeToUtf8Bytes(obj,new JsonSerializerOptions{PropertyNamingPolicy=JsonNamingPolicy.CamelCase});
        await Bytes(ctx,status,"application/json; charset=utf-8",bytes);
    }

    private static async Task Bytes(HttpListenerContext ctx,int status,string type,byte[] bytes)
    {
        ctx.Response.StatusCode=status;
        ctx.Response.ContentType=type;
        ctx.Response.ContentLength64=bytes.LongLength;
        await ctx.Response.OutputStream.WriteAsync(bytes);
    }

    public void Dispose()
    {
        cts.Cancel();
        try{listener.Stop();listener.Close();}catch{}
    }
}
