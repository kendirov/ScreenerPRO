package com.kendirov.kidsdevicehub;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

public final class ApkInstaller {
    private static volatile String status="idle";
    private ApkInstaller(){}

    public static String status(){ return status; }
    public static void setStatus(String s){ status=s; }

    public static void installFromUrl(Context context,String url) {
        Context c=context.getApplicationContext();
        if(Build.VERSION.SDK_INT>=26 && !c.getPackageManager().canRequestPackageInstalls()) {
            status="permission_required";
            Intent i=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:"+c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return;
        }
        status="downloading";
        new Thread(() -> downloadAndInstall(c,url),"kids-device-apk-install").start();
    }

    private static void downloadAndInstall(Context c,String url) {
        File apk=new File(c.getCacheDir(),"remote-install.apk");
        try {
            HttpURLConnection conn=(HttpURLConnection)new URL(url).openConnection();
            conn.setConnectTimeout(15000); conn.setReadTimeout(60000);
            conn.setInstanceFollowRedirects(true); conn.connect();
            if(conn.getResponseCode()/100!=2) throw new IOException("http_"+conn.getResponseCode());
            try(InputStream in=conn.getInputStream(); OutputStream out=new FileOutputStream(apk)){
                byte[] buf=new byte[65536]; int n; long total=0;
                while((n=in.read(buf))>0){ total+=n; if(total>500L*1024*1024) throw new IOException("apk_too_large"); out.write(buf,0,n); }
            }
            status="preparing_install";
            PackageInstaller pi=c.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams p=new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            if(Build.VERSION.SDK_INT>=31) p.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            int id=pi.createSession(p);
            try(PackageInstaller.Session s=pi.openSession(id)) {
                try(InputStream in=new FileInputStream(apk);
                    OutputStream out=s.openWrite("base.apk",0,apk.length())) {
                    byte[] buf=new byte[65536]; int n;
                    while((n=in.read(buf))>0) out.write(buf,0,n);
                    s.fsync(out);
                }
                Intent result=new Intent(c,InstallResultReceiver.class).setAction("com.kendirov.kidsdevicehub.INSTALL_RESULT");
                PendingIntent pending=PendingIntent.getBroadcast(c,id,result,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE);
                status="committing";
                s.commit(pending.getIntentSender());
            }
        } catch(Exception e){ status="error:"+e.getClass().getSimpleName()+":"+String.valueOf(e.getMessage()); }
    }
}
