package com.carlos.ambitions;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Writes a text file the user can actually find.
 *
 * The web `<a download>` trick does nothing inside an Android WebView — Capacitor
 * registers no DownloadListener, so the click is silently dropped. Since the JSON
 * export is this app's only backup, that failure is not cosmetic.
 *
 * On API 29+ we write through MediaStore into the public Downloads collection,
 * which needs no storage permission. Older devices fall back to the app's own
 * external Documents directory.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "export.json");
        String content = call.getString("content", "");
        String mime = call.getString("mime", "application/json");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                cv.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri item = getContext().getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (item == null) throw new Exception("Downloads folder refused the file");

                OutputStream os = getContext().getContentResolver().openOutputStream(item);
                try { os.write(content.getBytes("UTF-8")); } finally { if (os != null) os.close(); }

                cv.clear();
                cv.put(MediaStore.Downloads.IS_PENDING, 0);
                getContext().getContentResolver().update(item, cv, null, null);

                JSObject ret = new JSObject();
                ret.put("location", "Downloads/" + name);
                call.resolve(ret);
            } else {
                File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
                if (dir != null && !dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(f);
                try { fos.write(content.getBytes("UTF-8")); } finally { fos.close(); }

                JSObject ret = new JSObject();
                ret.put("location", f.getAbsolutePath());
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Could not save file: " + e.getMessage());
        }
    }
}
