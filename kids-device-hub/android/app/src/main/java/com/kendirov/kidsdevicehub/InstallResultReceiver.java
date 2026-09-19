package com.kendirov.kidsdevicehub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

public class InstallResultReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent) {
        int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
        String msg=intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        if(status==PackageInstaller.STATUS_PENDING_USER_ACTION) {
            ApkInstaller.setStatus("waiting_confirmation");
            Intent confirm;
            if(Build.VERSION.SDK_INT>=33) confirm=intent.getParcelableExtra(Intent.EXTRA_INTENT,Intent.class);
            else confirm=(Intent)intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if(confirm!=null){confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(confirm);}
        } else if(status==PackageInstaller.STATUS_SUCCESS) {
            ApkInstaller.setStatus("success");
        } else {
            ApkInstaller.setStatus("failed:"+status+":"+String.valueOf(msg));
        }
    }
}
