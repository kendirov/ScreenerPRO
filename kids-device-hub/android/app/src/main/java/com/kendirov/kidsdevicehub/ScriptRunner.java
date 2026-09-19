package com.kendirov.kidsdevicehub;

import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicBoolean;

public final class ScriptRunner {
    private static final AtomicBoolean STOP=new AtomicBoolean(true);
    private static volatile String status="idle";
    private ScriptRunner(){}

    public static String status(){ return status; }
    public static void stop(){ STOP.set(true); status="stopping"; }

    public static void start(Context context,String json) throws Exception {
        JSONArray steps=new JSONArray(json);
        if(steps.length()>100) throw new IllegalArgumentException("max_100_steps");
        STOP.set(true);
        STOP.set(false); status="running";
        new Thread(() -> run(context.getApplicationContext(),steps),"kids-device-script").start();
    }

    private static void run(Context c,JSONArray steps) {
        try {
            for(int i=0;i<steps.length()&&!STOP.get();i++) {
                JSONObject s=steps.getJSONObject(i);
                String a=s.optString("action","");
                HubAccessibilityService h=HubAccessibilityService.INSTANCE;
                if(a.equals("wait")) Thread.sleep(Math.min(30000,Math.max(0,s.optLong("ms",500))));
                else if(a.equals("tap")&&h!=null) h.tap((float)s.getDouble("x"),(float)s.getDouble("y"));
                else if(a.equals("longPress")&&h!=null) h.swipe((float)s.getDouble("x"),(float)s.getDouble("y"),(float)s.getDouble("x"),(float)s.getDouble("y"),Math.min(3000,s.optLong("ms",800)));
                else if(a.equals("swipe")&&h!=null) h.swipe((float)s.getDouble("x1"),(float)s.getDouble("y1"),(float)s.getDouble("x2"),(float)s.getDouble("y2"),Math.min(5000,s.optLong("ms",300)));
                else if(a.equals("drag")&&h!=null) h.drag((float)s.getDouble("x1"),(float)s.getDouble("y1"),(float)s.getDouble("x2"),(float)s.getDouble("y2"),Math.min(3000,s.optLong("holdMs",700)),Math.min(5000,s.optLong("moveMs",600)));
                else if(a.equals("text")&&h!=null) h.setFocusedText(s.optString("value",""));
                else if(a.equals("clickText")&&h!=null) h.clickText(s.optString("text",""));
                else if(a.equals("home")&&h!=null) h.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
                else if(a.equals("back")&&h!=null) h.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK);
                else if(a.equals("launch")) {
                    Intent x=c.getPackageManager().getLaunchIntentForPackage(s.optString("package",""));
                    if(x!=null){x.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);c.startActivity(x);}
                }
            }
            status=STOP.get()?"stopped":"completed";
        } catch(Exception e){ status="error:"+e.getClass().getSimpleName(); }
        STOP.set(true);
    }
}
