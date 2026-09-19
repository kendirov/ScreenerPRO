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
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class HubAccessibilityService extends AccessibilityService {
    public static volatile HubAccessibilityService INSTANCE;

    @Override protected void onServiceConnected() { INSTANCE = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) {}
    @Override public void onInterrupt() {}
    @Override public void onDestroy() { if (INSTANCE == this) INSTANCE = null; super.onDestroy(); }

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
