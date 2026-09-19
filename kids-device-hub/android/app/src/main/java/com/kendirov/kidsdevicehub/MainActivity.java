package com.kendirov.kidsdevicehub;

import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
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

    public static String token(Context c) {
        var p = c.getSharedPreferences("hub", MODE_PRIVATE);
        String t = p.getString("token", null);
        if (t == null) {
            t = UUID.randomUUID().toString().replace("-", "");
            p.edit().putString("token", t).apply();
        }
        return t;
    }

    public static String ips() {
        StringBuilder b = new StringBuilder();
        try {
            for (NetworkInterface n : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!n.isUp() || n.isLoopback()) continue;
                for (var a : Collections.list(n.getInetAddresses())) {
                    String s = a.getHostAddress();
                    if (s != null && s.indexOf(':') < 0) b.append(n.getName()).append(": ").append(s).append("\n");
                }
            }
        } catch (Exception ignored) {}
        return b.length() == 0 ? "No network address yet" : b.toString().trim();
    }

    private Button button(String text, View.OnClickListener listener) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setOnClickListener(listener);
        return b;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        startForegroundService(new Intent(this, HubService.class));

        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(36, 42, 36, 24);
        l.setBackgroundColor(Color.rgb(244,246,250));

        TextView title = new TextView(this);
        title.setText("Kendirov Kids Device Hub\nRoma Lenovo Tab");
        title.setTextSize(25);
        title.setTextColor(Color.rgb(20,24,32));
        title.setPadding(0,0,0,18);
        l.addView(title);

        TextView info = new TextView(this);
        info.setText("Agent: http://<tablet-ip>:" + PORT + "\n\n" + ips() +
                "\n\nPair token:\n" + token(this) +
                "\n\nEnable Accessibility + Usage Access. Device Admin is optional. " +
                "For maximum managed-device controls, provision Device Owner during dedicated setup.");
        info.setTextSize(16);
        info.setTextColor(Color.DKGRAY);
        info.setTextIsSelectable(true);
        info.setPadding(0,0,0,20);
        l.addView(info);

        l.addView(button("Open Accessibility settings", v ->
                startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))));
        l.addView(button("Open Usage Access settings", v ->
                startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))));
        l.addView(button("Enable Device Admin", v -> {
            ComponentName admin = new ComponentName(this, HubDeviceAdminReceiver.class);
            Intent i = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            i.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin);
            i.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "Allows parent-authorized lock and future managed-device policies.");
            startActivity(i);
        }));
        l.addView(button("Refresh addresses", v -> info.setText(
                "Agent: http://<tablet-ip>:" + PORT + "\n\n" + ips() +
                "\n\nPair token:\n" + token(this))));
        setContentView(l);
    }
}
