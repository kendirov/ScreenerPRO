package com.kendirov.kidsdevicehub;

import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.UUID;

public class MainActivity extends Activity {
    public static final int PORT = 8766;
    public static final String STABLE_APK_URL = "http://100.95.246.112:8770/Kendirov-Kids-Device-Hub-stable.apk";

    public static String token(Context c) {
        var p=c.getSharedPreferences("hub",MODE_PRIVATE);
        String t=p.getString("token",null);
        if(t==null){t=UUID.randomUUID().toString().replace("-","");p.edit().putString("token",t).apply();}
        return t;
    }

    public static String ips() {
        StringBuilder b=new StringBuilder();
        try {
            for(NetworkInterface n:Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if(!n.isUp()||n.isLoopback()) continue;
                for(var a:Collections.list(n.getInetAddresses())) {
                    String s=a.getHostAddress();
                    if(s!=null&&s.indexOf(':')<0) b.append(n.getName()).append(": ").append(s).append("\n");
                }
            }
        } catch(Exception ignored){}
        return b.length()==0?"No network address yet":b.toString().trim();
    }

    private Button button(String text,View.OnClickListener listener) {
        Button b=new Button(this); b.setText(text); b.setAllCaps(false); b.setOnClickListener(listener); return b;
    }

    private boolean hasUsageAccess() {
        try {
            android.app.AppOpsManager ops=(android.app.AppOpsManager)getSystemService(Context.APP_OPS_SERVICE);
            int mode=ops.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),getPackageName());
            return mode==android.app.AppOpsManager.MODE_ALLOWED;
        } catch(Exception e){ return false; }
    }

    private boolean batteryUnrestricted() {
        try {
            android.os.PowerManager pm=(android.os.PowerManager)getSystemService(Context.POWER_SERVICE);
            return pm!=null && pm.isIgnoringBatteryOptimizations(getPackageName());
        } catch(Exception e){ return false; }
    }

    private String infoText() {
        DevicePolicyManager dpm=getSystemService(DevicePolicyManager.class);
        boolean admin=dpm.isAdminActive(new ComponentName(this,HubDeviceAdminReceiver.class));
        boolean owner=dpm.isDeviceOwnerApp(getPackageName());
        boolean install=Build.VERSION.SDK_INT<26||getPackageManager().canRequestPackageInstalls();
        return "Roma Lenovo Tab\nVersion: "+BuildConfig.VERSION_NAME+
                "\nAgent port: "+PORT+"\nMode: low-load / on-demand / Tailscale-first\n\n"+ips()+
                "\n\nAccessibility: "+(HubAccessibilityService.INSTANCE!=null?"ON":"check settings")+
                "\nUsage access: "+(hasUsageAccess()?"ON":"permission needed")+
                "\nInstall apps: "+(install?"ON":"permission needed")+
                "\nAll files: "+(FileOps.hasAccess()?"ON":"optional permission needed")+
                "\nBattery unrestricted: "+(batteryUnrestricted()?"ON":"check settings")+
                "\nDevice Admin: "+admin+"\nDevice Owner: "+owner;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        token(this);
        startForegroundService(new Intent(this,HubService.class));
        LinearLayout l=new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL); l.setPadding(36,42,36,24); l.setBackgroundColor(Color.rgb(244,246,250));

        TextView title=new TextView(this);
        title.setText("Kendirov Family Device Hub"); title.setTextSize(25); title.setTextColor(Color.rgb(20,24,32)); l.addView(title);

        TextView info=new TextView(this);
        info.setText(infoText()); info.setTextSize(15); info.setTextColor(Color.DKGRAY); info.setPadding(0,18,0,20); l.addView(info);

        l.addView(button("1. Accessibility",v->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))));
        l.addView(button("2. Usage access",v->startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))));
        l.addView(button("3. Allow app installs",v->{
            if(Build.VERSION.SDK_INT>=26) startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())));
        }));
        l.addView(button("4. All files access (optional)",v->{
            if(Build.VERSION.SDK_INT>=30) startActivity(new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,Uri.parse("package:"+getPackageName())));
        }));
        l.addView(button("5. Device Admin",v->{
            ComponentName admin=new ComponentName(this,HubDeviceAdminReceiver.class);
            Intent i=new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            i.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN,admin);
            i.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,"Parent-authorized family device management.");
            startActivity(i);
        }));
        l.addView(button("6. Battery optimization",v->startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))));
        l.addView(button("7. Update Family Device Hub",v->{
            ApkInstaller.installFromUrl(this,STABLE_APK_URL);
            android.widget.Toast.makeText(this,"Update started. Android may show an install confirmation.",android.widget.Toast.LENGTH_LONG).show();
        }));
        l.addView(button("Refresh status",v->info.setText(infoText()+"\nUpdater: "+ApkInstaller.status())));
        setContentView(l);
    }
}
