package com.kendirov.kidsdevicehub;

import android.app.admin.DevicePolicyManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

public class HubApiServer {
    private final Context context;
    private final int port;
    private volatile boolean running;
    private ServerSocket socket;
    private Thread serverThread;
    private Thread macroThread;
    private final AtomicBoolean macroStop = new AtomicBoolean(true);

    HubApiServer(Context c, int p) { context=c.getApplicationContext(); port=p; }

    public void start() {
        running=true;
        serverThread=new Thread(() -> {
            try {
                socket=new ServerSocket();
                socket.setReuseAddress(true);
                socket.bind(new InetSocketAddress("0.0.0.0",port));
                while(running) {
                    try { handle(socket.accept()); } catch(Exception ignored) {}
                }
            } catch(Exception ignored) {}
        },"kids-device-hub-api");
        serverThread.start();
    }

    public void close() {
        running=false; macroStop.set(true);
        try { if(socket!=null) socket.close(); } catch(Exception ignored) {}
    }

    private void handle(Socket client) {
        new Thread(() -> {
            try(client) {
                client.setSoTimeout(5000);
                BufferedReader r=new BufferedReader(new InputStreamReader(client.getInputStream(),StandardCharsets.UTF_8));
                String first=r.readLine();
                if(first==null) return;
                String[] p=first.split(" ");
                if(p.length<2) return;
                String method=p[0], raw=p[1];
                Map<String,String> headers=new HashMap<>();
                String line;
                while((line=r.readLine())!=null && !line.isEmpty()) {
                    int k=line.indexOf(':');
                    if(k>0) headers.put(line.substring(0,k).trim().toLowerCase(),line.substring(k+1).trim());
                }
                URI u=URI.create(raw);
                Map<String,String> q=query(u.getRawQuery());
                String supplied=headers.getOrDefault("x-hub-token",q.getOrDefault("token",""));
                if(!MainActivity.token(context).equals(supplied)) {
                    send(client,403,"application/json","{\"error\":\"forbidden\"}".getBytes(StandardCharsets.UTF_8)); return;
                }
                route(client,method,u.getPath(),q);
            } catch(Exception ignored) {}
        },"kids-device-hub-client").start();
    }

    private void route(Socket c,String method,String path,Map<String,String> q) throws Exception {
        HubAccessibilityService a=HubAccessibilityService.INSTANCE;
        if(path.equals("/status")) {
            DevicePolicyManager dpm=context.getSystemService(DevicePolicyManager.class);
            boolean admin=dpm.isAdminActive(new ComponentName(context,HubDeviceAdminReceiver.class));
            boolean owner=dpm.isDeviceOwnerApp(context.getPackageName());
            String app=a==null?"":a.currentPackage();
            String s="{\"ok\":true,\"accessibility\":"+(a!=null)+",\"deviceAdmin\":"+admin+
                    ",\"deviceOwner\":"+owner+",\"currentPackage\":\""+esc(app)+"\",\"port\":"+port+"}";
            sendJson(c,s); return;
        }
        if(path.equals("/ui")) {
            if(a==null){sendJson(c,"{\"error\":\"accessibility_disabled\"}");return;}
            sendJson(c,a.tree()); return;
        }
        if(path.equals("/screenshot")) {
            if(a==null){sendJson(c,"{\"error\":\"accessibility_disabled\"}");return;}
            byte[] png=a.screenshotPng();
            if(png==null){sendJson(c,"{\"error\":\"screenshot_failed\"}");return;}
            send(c,200,"image/png",png); return;
        }
        if(path.equals("/tap")) {
            need(a,c); if(a==null)return;
            boolean ok=a.tap(f(q,"x"),f(q,"y")); sendOk(c,ok); return;
        }
        if(path.equals("/swipe")) {
            need(a,c); if(a==null)return;
            boolean ok=a.swipe(f(q,"x1"),f(q,"y1"),f(q,"x2"),f(q,"y2"),lng(q,"ms",300)); sendOk(c,ok); return;
        }
        if(path.equals("/click-text")) {
            need(a,c); if(a==null)return;
            sendOk(c,a.clickText(q.getOrDefault("text",""))); return;
        }
        if(path.equals("/text")) {
            need(a,c); if(a==null)return;
            sendOk(c,a.setFocusedText(q.getOrDefault("value",""))); return;
        }
        if(path.equals("/global")) {
            need(a,c); if(a==null)return;
            String x=q.getOrDefault("action","");
            int action=x.equals("home")?android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME:
                    x.equals("back")?android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK:
                    x.equals("recents")?android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS:
                    x.equals("notifications")?android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS:-1;
            sendOk(c,action>0 && a.performGlobalAction(action)); return;
        }
        if(path.equals("/launch")) {
            String pkg=q.getOrDefault("package","");
            Intent i=context.getPackageManager().getLaunchIntentForPackage(pkg);
            if(i==null){sendJson(c,"{\"ok\":false,\"error\":\"not_launchable\"}");return;}
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(i); sendOk(c,true); return;
        }
        if(path.equals("/apps")) { sendJson(c,apps()); return; }
        if(path.equals("/usage")) { sendJson(c,usage((int)lng(q,"days",1))); return; }
        if(path.equals("/lock")) {
            DevicePolicyManager dpm=context.getSystemService(DevicePolicyManager.class);
            ComponentName admin=new ComponentName(context,HubDeviceAdminReceiver.class);
            if(!dpm.isAdminActive(admin)){sendJson(c,"{\"ok\":false,\"error\":\"device_admin_disabled\"}");return;}
            dpm.lockNow(); sendOk(c,true); return;
        }
        if(path.equals("/suspend")) {
            DevicePolicyManager dpm=context.getSystemService(DevicePolicyManager.class);
            if(!dpm.isDeviceOwnerApp(context.getPackageName())) {
                sendJson(c,"{\"ok\":false,\"error\":\"device_owner_required\"}"); return;
            }
            String pkg=q.getOrDefault("package","");
            boolean val=Boolean.parseBoolean(q.getOrDefault("value","true"));
            String[] failed=dpm.setPackagesSuspended(new ComponentName(context,HubDeviceAdminReceiver.class),new String[]{pkg},val);
            sendJson(c,"{\"ok\":"+(failed.length==0)+",\"suspended\":"+val+"}"); return;
        }
        if(path.equals("/repeat-tap")) {
            need(a,c); if(a==null)return;
            int count=(int)Math.min(2000,Math.max(1,lng(q,"count",20)));
            long interval=Math.max(100,lng(q,"intervalMs",1000));
            float x=f(q,"x"), y=f(q,"y");
            startMacro(x,y,count,interval); sendJson(c,"{\"ok\":true,\"macro\":\"repeat-tap\"}"); return;
        }
        if(path.equals("/stop-macro")) { macroStop.set(true); sendOk(c,true); return; }
        send(c,404,"application/json","{\"error\":\"not_found\"}".getBytes(StandardCharsets.UTF_8));
    }

    private void startMacro(float x,float y,int count,long interval) {
        macroStop.set(true);
        if(macroThread!=null) try { macroThread.join(150); } catch(Exception ignored) {}
        macroStop.set(false);
        macroThread=new Thread(() -> {
            for(int i=0;i<count && !macroStop.get();i++) {
                HubAccessibilityService a=HubAccessibilityService.INSTANCE;
                if(a==null) break;
                a.tap(x,y);
                try { Thread.sleep(interval); } catch(InterruptedException e) { break; }
            }
            macroStop.set(true);
        },"kids-device-hub-macro");
        macroThread.start();
    }

    private String apps() {
        PackageManager pm=context.getPackageManager();
        List<ApplicationInfo> xs=pm.getInstalledApplications(0);
        xs.sort(Comparator.comparing(x -> pm.getApplicationLabel(x).toString().toLowerCase()));
        StringBuilder b=new StringBuilder("{\"apps\":[");
        boolean first=true;
        for(ApplicationInfo x:xs) {
            Intent launch=pm.getLaunchIntentForPackage(x.packageName);
            if(launch==null) continue;
            if(!first)b.append(','); first=false;
            b.append("{\"label\":\"").append(esc(pm.getApplicationLabel(x).toString()))
             .append("\",\"package\":\"").append(esc(x.packageName)).append("\"}");
        }
        return b.append("]}").toString();
    }

    private String usage(int days) {
        long end=System.currentTimeMillis(), start=end-Math.max(1,Math.min(days,30))*86400000L;
        UsageStatsManager m=(UsageStatsManager)context.getSystemService(Context.USAGE_STATS_SERVICE);
        List<UsageStats> xs=m.queryUsageStats(UsageStatsManager.INTERVAL_DAILY,start,end);
        Map<String,Long> sum=new HashMap<>();
        for(UsageStats s:xs) if(s.getTotalTimeInForeground()>0)
            sum.merge(s.getPackageName(),s.getTotalTimeInForeground(),Long::sum);
        List<Map.Entry<String,Long>> rows=new ArrayList<>(sum.entrySet());
        rows.sort((a,b)->Long.compare(b.getValue(),a.getValue()));
        PackageManager pm=context.getPackageManager();
        StringBuilder b=new StringBuilder("{\"days\":"+days+",\"usage\":[");
        boolean first=true;
        for(var e:rows) {
            if(!first)b.append(','); first=false;
            String label=e.getKey();
            try { label=pm.getApplicationLabel(pm.getApplicationInfo(e.getKey(),0)).toString(); } catch(Exception ignored) {}
            b.append("{\"label\":\"").append(esc(label)).append("\",\"package\":\"")
             .append(esc(e.getKey())).append("\",\"foregroundMs\":").append(e.getValue()).append("}");
        }
        return b.append("]}").toString();
    }

    private void need(HubAccessibilityService a,Socket c) throws IOException {
        if(a==null) sendJson(c,"{\"error\":\"accessibility_disabled\"}");
    }
    private void sendOk(Socket c,boolean ok)throws IOException{sendJson(c,"{\"ok\":"+ok+"}");}
    private void sendJson(Socket c,String s)throws IOException{send(c,200,"application/json; charset=utf-8",s.getBytes(StandardCharsets.UTF_8));}
    private void send(Socket c,int code,String type,byte[] body)throws IOException{
        OutputStream o=c.getOutputStream();
        String h="HTTP/1.1 "+code+" "+(code==200?"OK":code==403?"Forbidden":"Not Found")+"\r\n"+
                "Content-Type: "+type+"\r\nContent-Length: "+body.length+"\r\nConnection: close\r\n\r\n";
        o.write(h.getBytes(StandardCharsets.UTF_8));o.write(body);o.flush();
    }
    private static Map<String,String> query(String raw)throws Exception{
        Map<String,String> m=new HashMap<>();if(raw==null)return m;
        for(String s:raw.split("&")){String[] p=s.split("=",2);m.put(URLDecoder.decode(p[0],"UTF-8"),URLDecoder.decode(p.length>1?p[1]:"","UTF-8"));}
        return m;
    }
    private static float f(Map<String,String> q,String k){return Float.parseFloat(q.getOrDefault(k,"0"));}
    private static long lng(Map<String,String> q,String k,long d){try{return Long.parseLong(q.getOrDefault(k,String.valueOf(d)));}catch(Exception e){return d;}}
    private static String esc(String s){return s==null?"":s.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","");}
}
