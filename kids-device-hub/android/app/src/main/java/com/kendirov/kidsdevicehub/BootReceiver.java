package com.kendirov.kidsdevicehub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action=intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Intent s=new Intent(context,HubService.class);
            if(Build.VERSION.SDK_INT>=26) context.startForegroundService(s); else context.startService(s);
        }
    }
}
