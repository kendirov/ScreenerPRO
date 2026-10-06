package com.kendirov.kidsdevicehub;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.accessibilityservice.AccessibilityService.ScreenshotResult;
import android.graphics.Bitmap;
import android.graphics.ColorSpace;
import android.graphics.Path;
import android.hardware.HardwareBuffer;
import android.os.SystemClock;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.view.Display;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class HubAccessibilityService extends AccessibilityService {
    public static volatile HubAccessibilityService INSTANCE;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private View messageOverlay;
    private Runnable removeOverlayTask;

    @Override protected void onServiceConnected() { INSTANCE = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() {}
    @Override public void onDestroy() {
        removeMessageOverlay();
        if (INSTANCE == this) INSTANCE = null;
        super.onDestroy();
    }

    private int dp(int v) {
        return (int)(v * getResources().getDisplayMetrics().density + 0.5f);
    }

    public boolean showMessage(String titleText, String bodyText, int seconds) {
        mainHandler.post(() -> {
            try {
                removeMessageOverlay();

                WindowManager wm=(WindowManager)getSystemService(WINDOW_SERVICE);
                int screenW=getResources().getDisplayMetrics().widthPixels;
                int width=Math.min(dp(620),screenW-dp(32));

                LinearLayout card=new LinearLayout(this);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(dp(24),dp(20),dp(24),dp(18));
                GradientDrawable bg=new GradientDrawable(
                        GradientDrawable.Orientation.TL_BR,
                        new int[]{Color.rgb(36,19,55),Color.rgb(20,35,67)});
                bg.setCornerRadius(dp(24));
                bg.setStroke(dp(2),Color.rgb(255,166,52));
                card.setBackground(bg);
                card.setElevation(dp(18));

                TextView steam=new TextView(this);
                steam.setText("♨   ♨   ♨");
                steam.setTextColor(Color.rgb(255,231,166));
                steam.setTextSize(20);
                steam.setGravity(Gravity.CENTER);
                card.addView(steam,new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,dp(30)));

                TextView title=new TextView(this);
                title.setText("🥟  "+titleText);
                title.setTextColor(Color.WHITE);
                title.setTextSize(26);
                title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
                title.setGravity(Gravity.CENTER);
                card.addView(title);

                TextView body=new TextView(this);
                body.setText(bodyText);
                body.setTextColor(Color.rgb(255,226,158));
                body.setTextSize(17);
                body.setGravity(Gravity.CENTER);
                body.setPadding(0,dp(8),0,dp(12));
                card.addView(body);

                TextView bonus=new TextView(this);
                bonus.setText("🔥 горячо   •   ⚡ энергия +100   •   🎮 игра подождёт");
                bonus.setTextColor(Color.rgb(224,229,255));
                bonus.setTextSize(13);
                bonus.setGravity(Gravity.CENTER);
                bonus.setPadding(0,0,0,dp(14));
                card.addView(bonus);

                LinearLayout row=new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER);

                Button ok=new Button(this);
                ok.setText("🥟  ОК, ИДУ!");
                ok.setAllCaps(false);
                ok.setTextColor(Color.WHITE);
                ok.setTextSize(15);
                GradientDrawable okBg=new GradientDrawable();
                okBg.setColor(Color.rgb(55,214,122)); okBg.setCornerRadius(dp(14));
                ok.setBackground(okBg);
                ok.setOnClickListener(v->removeMessageOverlay());

                Button later=new Button(this);
                later.setText("Ещё 5 минут");
                later.setAllCaps(false);
                later.setTextColor(Color.WHITE);
                later.setTextSize(14);
                GradientDrawable laterBg=new GradientDrawable();
                laterBg.setColor(Color.rgb(67,61,92)); laterBg.setCornerRadius(dp(14));
                later.setBackground(laterBg);
                later.setOnClickListener(v->{
                    body.setText("Хорошо 🙂 Напомню ещё раз через 5 минут");
                    if(removeOverlayTask!=null) mainHandler.removeCallbacks(removeOverlayTask);
                    removeOverlayTask=this::removeMessageOverlay;
                    mainHandler.postDelayed(removeOverlayTask,5*60*1000L);
                });

                LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(0,dp(48),1f);
                bp.setMargins(dp(4),0,dp(4),0);
                row.addView(ok,bp); row.addView(later,bp);
                card.addView(row);

                WindowManager.LayoutParams lp=new WindowManager.LayoutParams(
                        width,WindowManager.LayoutParams.WRAP_CONTENT,
                        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                        PixelFormat.TRANSLUCENT);
                lp.gravity=Gravity.TOP|Gravity.END;
                lp.x=dp(16); lp.y=dp(28);

                card.setAlpha(0f); card.setTranslationY(-dp(18));
                wm.addView(card,lp);
                messageOverlay=card;
                card.animate().alpha(1f).translationY(0f).setDuration(280).start();

                steam.animate().translationY(-dp(10)).alpha(0.25f).setDuration(1200).start();

                if(seconds>0) {
                    removeOverlayTask=this::removeMessageOverlay;
                    mainHandler.postDelayed(removeOverlayTask,Math.max(5,seconds)*1000L);
                }
            } catch(Exception ignored) {}
        });
        return true;
    }

    public void removeMessageOverlay() {
        mainHandler.post(() -> {
            try {
                if(removeOverlayTask!=null) mainHandler.removeCallbacks(removeOverlayTask);
                removeOverlayTask=null;
                if(messageOverlay!=null) {
                    WindowManager wm=(WindowManager)getSystemService(WINDOW_SERVICE);
                    wm.removeView(messageOverlay);
                    messageOverlay=null;
                }
            } catch(Exception ignored) {}
        });
    }

    public boolean tap(float x, float y) {
        Path p = new Path(); p.moveTo(x,y);
        GestureDescription g = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(p,0,70)).build();
        return dispatchGesture(g, null, null);
    }

    public boolean swipe(float x1,float y1,float x2,float y2,long ms) {
        Path p = new Path(); p.moveTo(x1,y1); p.lineTo(x2,y2);
        GestureDescription g = new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(p,0,Math.max(80,ms))).build();
        return dispatchGesture(g, null, null);
    }

    public boolean drag(float x1,float y1,float x2,float y2,long holdMs,long moveMs) {
        Path hold = new Path(); hold.moveTo(x1,y1);
        GestureDescription.StrokeDescription first =
                new GestureDescription.StrokeDescription(hold,0,Math.max(300,holdMs),true);
        final boolean[] ok={false};
        CountDownLatch done=new CountDownLatch(1);
        GestureDescription g1=new GestureDescription.Builder().addStroke(first).build();
        boolean started=dispatchGesture(g1,new GestureResultCallback(){
            @Override public void onCompleted(GestureDescription gestureDescription) {
                Path move=new Path(); move.moveTo(x1,y1); move.lineTo(x2,y2);
                GestureDescription.StrokeDescription second=
                        first.continueStroke(move,0,Math.max(150,moveMs),false);
                GestureDescription g2=new GestureDescription.Builder().addStroke(second).build();
                dispatchGesture(g2,new GestureResultCallback(){
                    @Override public void onCompleted(GestureDescription g){ok[0]=true;done.countDown();}
                    @Override public void onCancelled(GestureDescription g){done.countDown();}
                },null);
            }
            @Override public void onCancelled(GestureDescription gestureDescription){done.countDown();}
        },null);
        if(!started) return false;
        try { done.await(5,TimeUnit.SECONDS); } catch(InterruptedException ignored) {}
        return ok[0];
    }

    public boolean setFocusedText(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        AccessibilityNodeInfo focus = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (focus == null) return false;
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
        return focus.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
    }

    public boolean clickText(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        var found = root.findAccessibilityNodeInfosByText(text);
        for (AccessibilityNodeInfo n : found) {
            AccessibilityNodeInfo c = n;
            while (c != null) {
                if (c.isClickable() && c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
                c = c.getParent();
            }
        }
        return false;
    }

    public String currentPackage() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        return root == null || root.getPackageName() == null ? "" : root.getPackageName().toString();
    }

    public String tree() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "{\"error\":\"no_active_window\"}";
        StringBuilder b = new StringBuilder();
        nodeJson(root,b,0);
        return b.toString();
    }

    private void nodeJson(AccessibilityNodeInfo n,StringBuilder b,int depth) {
        if (depth > 35) { b.append("{\"truncated\":true}"); return; }
        b.append("{\"class\":\"").append(esc(n.getClassName())).append("\",")
         .append("\"text\":\"").append(esc(n.getText())).append("\",")
         .append("\"desc\":\"").append(esc(n.getContentDescription())).append("\",")
         .append("\"id\":\"").append(esc(n.getViewIdResourceName())).append("\",")
         .append("\"clickable\":").append(n.isClickable()).append(",\"children\":[");
        for (int i=0;i<n.getChildCount();i++) {
            if (i>0) b.append(",");
            AccessibilityNodeInfo c=n.getChild(i);
            if(c==null) b.append("null"); else nodeJson(c,b,depth+1);
        }
        b.append("]}");
    }

    private static String esc(Object o) {
        if(o==null) return "";
        return o.toString().replace("\\","\\\\").replace("\"","\\\"")
                .replace("\n","\\n").replace("\r","");
    }

    public byte[] screenshotPng() {
        final byte[][] out = new byte[1][];
        CountDownLatch latch = new CountDownLatch(1);
        takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
            @Override public void onSuccess(ScreenshotResult r) {
                try {
                    HardwareBuffer hb = r.getHardwareBuffer();
                    ColorSpace cs = r.getColorSpace();
                    Bitmap wrapped = Bitmap.wrapHardwareBuffer(hb, cs);
                    if (wrapped != null) {
                        Bitmap copy = wrapped.copy(Bitmap.Config.ARGB_8888,false);
                        ByteArrayOutputStream os=new ByteArrayOutputStream();
                        copy.compress(Bitmap.CompressFormat.PNG,100,os);
                        out[0]=os.toByteArray();
                        copy.recycle();
                    }
                    hb.close();
                } finally { latch.countDown(); }
            }
            @Override public void onFailure(int errorCode) { latch.countDown(); }
        });
        try { latch.await(4, TimeUnit.SECONDS); } catch (InterruptedException ignored) {}
        return out[0];
    }
}
