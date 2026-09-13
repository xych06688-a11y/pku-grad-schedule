package cn.edu.pku.schedule;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;

public class MainActivity extends Activity {

    private WebView wv;
    private ValueCallback<Uri[]> filePathCallback;
    private android.content.SharedPreferences prefs;
    private static final int REQ_FILE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(Color.parseColor("#3b5bdb"));
        }

        wv = new WebView(this);
        setContentView(wv);

        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setDefaultTextEncodingName("utf-8");
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return false;
            }
        });

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = cb;
                try {
                    Intent i = params.createIntent();
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, "选择课程表文件"), REQ_FILE);
                } catch (Exception e) {
                    filePathCallback = null;
                    toast("无法打开文件选择器");
                    return false;
                }
                return true;
            }
        });

        wv.addJavascriptInterface(this, "Android");
        prefs = getSharedPreferences("schedule", MODE_PRIVATE);
        wv.loadUrl("file:///android_asset/index.html");
    }

    /** 页面数据持久化：SharedPreferences 兜底（file:// 下 localStorage 可能不可用） */
    @JavascriptInterface
    public String loadData() {
        String s = prefs.getString("data", "");
        return s == null ? "" : s;
    }

    @JavascriptInterface
    public void saveData(String data) {
        prefs.edit().putString("data", data == null ? "" : data).commit();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            if (filePathCallback == null) {
                super.onActivityResult(req, res, data);
                return;
            }
            Uri[] results = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                    int n = data.getClipData().getItemCount();
                    results = new Uri[n];
                    for (int i = 0; i < n; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT >= 19 && wv != null) {
            wv.evaluateJavascript(
                "(function(){var o=document.getElementById('ov');" +
                "if(o&&o.className.indexOf('on')>=0){closeM();return 'modal';}return 'none';})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value == null || value.indexOf("modal") < 0) {
                            MainActivity.this.finish();
                        }
                    }
                });
        } else {
            super.onBackPressed();
        }
    }

    @JavascriptInterface
    public void saveFile(final String name, final String content) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, name);
                    FileOutputStream fos = new FileOutputStream(f);
                    OutputStreamWriter osw = new OutputStreamWriter(fos, "UTF-8");
                    osw.write(content);
                    osw.flush();
                    osw.close();
                    toast("已导出到 " + f.getAbsolutePath());
                } catch (Exception e) {
                    toast("导出失败：" + e.getMessage());
                }
            }
        });
    }

    @JavascriptInterface
    public void toastMsg(final String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                toast(msg);
            }
        });
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onDestroy() {
        if (wv != null) {
            wv.destroy();
            wv = null;
        }
        super.onDestroy();
    }
}
