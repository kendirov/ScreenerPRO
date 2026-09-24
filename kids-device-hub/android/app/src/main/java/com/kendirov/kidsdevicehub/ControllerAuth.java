package com.kendirov.kidsdevicehub;

import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Map;

public final class ControllerAuth {
    private static final String PUBLIC_KEY_B64="MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA1E/fHtUsplO4+7fKjDZ7cZWXbPz0a+d3qDRDKAdgu/DUNo9mQKs4HjNWkfHSx0BFiv/cBEEd/GxENfFSLUz9m0N/fl1FInA5ubh3vIQBI2SJBqxTRkFetkb233WxViLXUvVUUh/kg1KOLF2iIO4HaGY6iXRuVb4j1Ylm+otGbB7BZbR7KdGxjvnQWTEvzybkzworK24NhpSZJv927hxZba8YIm0pSj+RhHlaamadR/S56JkKkSwigJiUsVZzs9FAH3Z6mYFy2652+aYRHvdWWHgHF12jAy9CSnzgXVlemjRgUmAvIphv9LegaJPwcU2+jpQ6C8TRrFOjYrSVbYqQLefxqSf9axwFv424u+cwmWklBZa32z3c2qf8FluqkKULkOAVQ8HVO2tqbIbpokj9RzWXdWu5EICIIwQCE43YyMN3LwnCBJnKmrM3PKdIEuerFUFFtL9jDsLN1KIuv7XwnP3LoXmuBuhWlJXRMqGJvd4cFFW/3UkbOjpJpocFym8hAgMBAAE=";
    private static final long MAX_SKEW_MS=300000L;
    private ControllerAuth(){}

    public static boolean verify(String method,String path,String rawQuery,Map<String,String> headers) {
        try {
            String ts=headers.getOrDefault("x-hub-time","");
            String sig=headers.getOrDefault("x-hub-signature","");
            if(ts.isEmpty()||sig.isEmpty()) return false;
            long when=Long.parseLong(ts);
            if(Math.abs(System.currentTimeMillis()-when)>MAX_SKEW_MS) return false;
            String canonical=ts+"\n"+method+"\n"+path+"\n"+(rawQuery==null?"":rawQuery);
            byte[] keyBytes=Base64.decode(PUBLIC_KEY_B64,Base64.DEFAULT);
            PublicKey key=KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(keyBytes));
            Signature v=Signature.getInstance("SHA256withRSA");
            v.initVerify(key);
            v.update(canonical.getBytes(StandardCharsets.UTF_8));
            return v.verify(Base64.decode(sig,Base64.DEFAULT));
        } catch(Exception e){ return false; }
    }
}
