package com.kendirov.kidsdevicehub;

import android.os.Environment;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import org.json.JSONArray;
import org.json.JSONObject;

public final class FileOps {
    private FileOps() {}

    public static boolean hasAccess() {
        return android.os.Build.VERSION.SDK_INT < 30 || Environment.isExternalStorageManager();
    }

    private static File resolve(String path) throws Exception {
        File root=Environment.getExternalStorageDirectory().getCanonicalFile();
        String clean=path==null?"":path.replace("\\","/");
        while(clean.startsWith("/")) clean=clean.substring(1);
        File f=new File(root,clean).getCanonicalFile();
        String rp=root.getPath(), fp=f.getPath();
        if(!fp.equals(rp) && !fp.startsWith(rp+File.separator)) throw new SecurityException("outside_shared_storage");
        return f;
    }

    public static String list(String path) throws Exception {
        File f=resolve(path);
        JSONObject o=new JSONObject().put("path",f.getAbsolutePath()).put("exists",f.exists()).put("access",hasAccess());
        JSONArray a=new JSONArray();
        File[] xs=f.listFiles();
        if(xs!=null) for(File x:xs) a.put(new JSONObject()
                .put("name",x.getName()).put("dir",x.isDirectory())
                .put("size",x.isFile()?x.length():0).put("modified",x.lastModified()));
        return o.put("items",a).toString();
    }

    public static boolean mkdir(String path) throws Exception {
        return resolve(path).mkdirs() || resolve(path).isDirectory();
    }

    public static boolean move(String src,String dst) throws Exception {
        File a=resolve(src), b=resolve(dst);
        File parent=b.getParentFile(); if(parent!=null) parent.mkdirs();
        Files.move(a.toPath(),b.toPath(),StandardCopyOption.REPLACE_EXISTING);
        return true;
    }

    public static String trash(String path) throws Exception {
        File a=resolve(path);
        File trash=resolve("KidsDeviceHub_Trash");
        trash.mkdirs();
        File b=new File(trash,System.currentTimeMillis()+"_"+a.getName());
        Files.move(a.toPath(),b.toPath(),StandardCopyOption.REPLACE_EXISTING);
        return b.getAbsolutePath();
    }
}
