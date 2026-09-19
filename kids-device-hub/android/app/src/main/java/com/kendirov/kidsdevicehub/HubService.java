package com.kendirov.kidsdevicehub;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import androidx.annotation.Nullable;

public class HubService extends Service {
    private HubApiServer server;
    private static final String CH="kids_device_hub";

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager nm=getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CH,"Kids Device Hub",NotificationManager.IMPORTANCE_LOW));
        var n=new android.app.Notification.Builder(this,CH)
                .setContentTitle("Kids Device Hub active")
                .setContentText("Parent-authorized device control is available")
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setOngoing(true).build();
        startForeground(1042,n);
        server=new HubApiServer(this, MainActivity.PORT);
        server.start();
    }

    @Override public void onDestroy() { if(server!=null) server.close(); super.onDestroy(); }
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
