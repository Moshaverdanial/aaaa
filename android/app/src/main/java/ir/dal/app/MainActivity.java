package ir.dal.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.KeyguardManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * پوسته‌ی اندروید دال: سایت دالِ خودِ شما را در یک WebView تمام‌صفحه نشان می‌دهد
 * و چیزهایی را که مرورگر معمولی ندارد اضافه می‌کند:
 * انتخاب عکس، موقعیت مکانی، دانلود فایل، اشتراک‌گذاری، پیوندهای تماس/واتساپ،
 * صفحه‌ی خطای فارسی و اعلان‌های گوشی (حتی وقتی برنامه بسته است).
 */
public class MainActivity extends Activity {
    private static final int REQ_FILE = 11;
    private static final int REQ_LOC = 12;
    private static final int REQ_NOTIF = 13;
    private static final int REQ_UNLOCK = 14;
    private static final int NAVY = 0xFF0B1230;
    private static final int GOLD = 0xFFE6C76F;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private WebView web;
    private ProgressBar bar;
    private View setupView;
    private ValueCallback<Uri[]> fileCb;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    private String failedUrl = "";
    private boolean offlineShown = false;
    private long lastBack = 0;
    private long pausedAt = 0;
    private boolean suppressLock = false;
    private View lockView;
    private ConnectivityManager.NetworkCallback netCb;

    // ------------------------------------------------------------------ چرخه‌ی عمر
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(NAVY);
        getWindow().setNavigationBarColor(NAVY);
        root = new FrameLayout(this);
        root.setBackgroundColor(NAVY);
        setContentView(root);

        debugHooks(getIntent());
        if (Prefs.lock(this)) getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        if (!buildWebView()) return;
        watchNetwork();
        if (Prefs.server(this).isEmpty()) showSetup(null);
        else {
            openSite(getIntent());
            if (!Prefs.token(this).isEmpty()) PollJobService.schedule(this);
        }
        if (Prefs.lock(this) && deviceSecure()) {
            showLock();
            ui.post(new Runnable() {
                @Override
                public void run() {
                    askUnlock();
                }
            });
        }
    }

    /** فقط در نسخه‌ی debug (برای آزمون خودکار): ورود با توکن از طریق intent. */
    private void debugHooks(Intent in) {
        if (BuildConfig.DEBUG && in != null && in.hasExtra("dbg_token")) {
            Prefs.setToken(this, in.getStringExtra("dbg_token"));
            PollJobService.schedule(this);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        debugHooks(intent);
        if (web != null && !Prefs.server(this).isEmpty() && setupView == null) openSite(intent);
    }

    @Override
    public void onBackPressed() {
        if (setupView != null && !Prefs.server(this).isEmpty()) {
            hideSetup();
            return;
        }
        if (web != null && setupView == null && web.canGoBack()) {
            web.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBack < 2000) super.onBackPressed();
        else {
            lastBack = now;
            toast("برای خروج یک بار دیگر «بازگشت» را بزنید.");
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausedAt = System.currentTimeMillis();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (Prefs.lock(this) && deviceSecure() && lockView == null && !suppressLock && pausedAt > 0
                && System.currentTimeMillis() - pausedAt > 60000) {
            showLock();
            askUnlock();
        }
    }

    @Override
    protected void onDestroy() {
        if (netCb != null) {
            try {
                ((ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE)).unregisterNetworkCallback(netCb);
            } catch (Exception ignored) {
                // هیچ
            }
        }
        if (web != null) {
            web.stopLoading();
            web.destroy();
        }
        super.onDestroy();
    }

    // ------------------------------------------------------------------ WebView
    private boolean buildWebView() {
        try {
            web = new WebView(this);
        } catch (Throwable t) {
            TextView tv = new TextView(this);
            tv.setText("WebView روی این گوشی در دسترس نیست. «Android System WebView» را از فروشگاه به‌روزرسانی یا فعال کنید.");
            tv.setTextColor(Color.WHITE);
            tv.setPadding(48, 96, 48, 48);
            root.addView(tv);
            return false;
        }
        web.setBackgroundColor(NAVY);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setGeolocationEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " DalApp/" + BuildConfig.VERSION_NAME);
        if (Build.VERSION.SDK_INT >= 29 && Build.VERSION.SDK_INT < 33) {
            s.setForceDark(WebSettings.FORCE_DARK_OFF); // دال تم تیره/روشن خودش را دارد
        }
        web.addJavascriptInterface(new Bridge(), "DalAndroid");
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        web.setOnTouchListener(new View.OnTouchListener() {
            private float startY = 0;
            private boolean armed = false;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        startY = e.getY();
                        armed = web.getScrollY() == 0 && e.getY() < dp(150);
                        break;
                    case MotionEvent.ACTION_MOVE:
                        if (armed && e.getY() - startY > dp(130)) {
                            armed = false;
                            toast("در حال بازخوانی…");
                            retryNow();
                        }
                        break;
                    default:
                        armed = false;
                }
                return false;
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return handleUrl(r.getUrl());
            }

            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap icon) {
                if (url == null || !url.startsWith("file:///android_asset/")) offlineShown = false;
                bar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                bar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    failedUrl = r.getUrl().toString();
                    offlineShown = true;
                    v.loadUrl("file:///android_asset/offline.html");
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                bar.setProgress(p);
                bar.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                suppressLock = true;
                try {
                    startActivityForResult(p.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCb = null;
                    toast("برنامه‌ای برای انتخاب فایل پیدا نشد.");
                    return false;
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                        && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    geoOrigin = origin;
                    geoCb = cb;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOC);
                } else {
                    cb.invoke(origin, true, false);
                }
            }
        });

        web.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String ua, String cd, String mime, long len) {
                if (url.startsWith("blob:") || url.startsWith("data:")) {
                    toast("این فایل از داخل برنامه ذخیره نشد؛ دوباره امتحان کنید.");
                    return;
                }
                try {
                    String name = URLUtil.guessFileName(url, cd, mime);
                    DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                    if (mime != null && !mime.isEmpty()) r.setMimeType(mime);
                    r.setTitle(name);
                    r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
                    toast("دانلود شروع شد: " + name);
                } catch (Exception e) {
                    openExternal(Uri.parse(url));
                }
            }
        });

        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setVisibility(View.GONE);
        root.addView(bar, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP));
        return true;
    }

    private boolean handleUrl(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        if (scheme.equals("http") || scheme.equals("https")) {
            String host = u.getHost();
            String mine = Uri.parse(Prefs.server(this)).getHost();
            if (host != null && mine != null && host.equalsIgnoreCase(mine)) return false;
            openExternal(u);
            return true;
        }
        if (scheme.equals("file") || scheme.equals("about") || scheme.equals("blob") || scheme.equals("data") || scheme.equals("javascript")) {
            return false;
        }
        openExternal(u);
        return true;
    }

    private void openExternal(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            if ("webcal".equalsIgnoreCase(u.getScheme())) {
                copyText(u.toString().replaceFirst("(?i)^webcal", "https"));
                toast("برنامه‌ی تقویم لینک را نپذیرفت؛ لینک کپی شد، در Google Calendar اضافه کنید.");
            } else {
                toast("برنامه‌ای برای باز کردن این پیوند پیدا نشد.");
            }
        }
    }

    private void openSite(Intent in) {
        String server = Prefs.server(this);
        String url = server + "/";
        String link = in == null ? null : in.getStringExtra("link");
        if (link != null && link.startsWith("#")) url = server + "/" + link;
        else if (link != null && link.startsWith("/")) url = server + "/#" + link;
        else if (in != null && in.getData() != null && Intent.ACTION_VIEW.equals(in.getAction())) {
            Uri d = in.getData();
            String mine = Uri.parse(server).getHost();
            if (d.getHost() != null && d.getHost().equalsIgnoreCase(mine)) url = d.toString();
        }
        if (in != null) in.removeExtra("link");
        web.loadUrl(url);
    }

    // ------------------------------------------------------------------ صفحه‌ی تنظیم سرور
    private void showSetup(String error) {
        hideSetup();
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(NAVY);
        box.setPadding(dp(28), dp(28), dp(28), dp(28));
        box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        TextView logo = new TextView(this);
        logo.setText("د");
        logo.setTextColor(GOLD);
        logo.setTextSize(46);
        logo.setTypeface(Typeface.DEFAULT_BOLD);
        logo.setGravity(Gravity.CENTER);
        GradientDrawable ring = new GradientDrawable();
        ring.setCornerRadius(dp(24));
        ring.setStroke(dp(2), GOLD);
        logo.setBackground(ring);
        box.addView(logo, new LinearLayout.LayoutParams(dp(88), dp(88)));

        TextView title = text("به دال خوش آمدید", 24, GOLD, true);
        title.setPadding(0, dp(18), 0, dp(6));
        box.addView(title);
        box.addView(text("آدرس سایت دالِ خودتان را وارد کنید. این آدرس را مدیر سایت به شما می‌دهد؛ فقط یک بار پرسیده می‌شود.", 15, 0xFFDFE5FF, false));

        final EditText input = new EditText(this);
        input.setHint("https://dal.example.ir");
        input.setHintTextColor(0x88FFFFFF);
        input.setTextColor(Color.WHITE);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setTextDirection(View.TEXT_DIRECTION_LTR);
        input.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable fieldBg = new GradientDrawable();
        fieldBg.setColor(0x22FFFFFF);
        fieldBg.setCornerRadius(dp(14));
        fieldBg.setStroke(dp(1), 0x66E6C76F);
        input.setBackground(fieldBg);
        String cur = Prefs.server(this);
        if (!cur.isEmpty()) input.setText(cur);
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ip.topMargin = dp(18);
        box.addView(input, ip);

        final TextView err = text(error == null ? "" : error, 14, 0xFFFF9A9A, false);
        box.addView(err);

        final Button go = new Button(this);
        go.setText("اتصال");
        go.setTextSize(17);
        go.setTypeface(Typeface.DEFAULT_BOLD);
        go.setTextColor(0xFF1B1405);
        go.setAllCaps(false);
        GradientDrawable goBg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFFF0D98C, 0xFFB88A2A});
        goBg.setCornerRadius(dp(14));
        go.setBackground(goBg);
        LinearLayout.LayoutParams gp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        gp.topMargin = dp(14);
        box.addView(go, gp);

        final View.OnClickListener connect = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                connect(input.getText().toString(), err, go);
            }
        };
        go.setOnClickListener(connect);
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, android.view.KeyEvent e) {
                connect.onClick(v);
                return true;
            }
        });

        setupView = box;
        root.addView(box, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setVisibility(View.INVISIBLE);
        input.requestFocus();
    }

    private void hideSetup() {
        if (setupView != null) {
            root.removeView(setupView);
            setupView = null;
        }
        if (web != null) web.setVisibility(View.VISIBLE);
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        t.setLineSpacing(0, 1.35f);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private void connect(final String raw, final TextView err, final Button go) {
        final String in = raw == null ? "" : raw.trim();
        if (in.isEmpty()) {
            err.setText("آدرس را بنویسید.");
            return;
        }
        err.setText("");
        go.setEnabled(false);
        go.setText("در حال بررسی…");
        new Thread(new Runnable() {
            @Override
            public void run() {
                final List<String> cands = new ArrayList<String>();
                if (in.toLowerCase().startsWith("http://") || in.toLowerCase().startsWith("https://")) {
                    cands.add(origin(in));
                } else {
                    cands.add(origin("https://" + in));
                    cands.add(origin("http://" + in));
                }
                String found = null;
                for (String c : cands) {
                    if (c != null && ping(c)) {
                        found = c;
                        break;
                    }
                }
                final String f = found;
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        go.setEnabled(true);
                        go.setText("اتصال");
                        if (f == null) {
                            err.setText("به این آدرس وصل نشدیم یا دال نیست. آدرس را بدون خطا و با اینترنت روشن بررسی کنید.");
                            return;
                        }
                        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                        if (imm != null) imm.hideSoftInputFromWindow(root.getWindowToken(), 0);
                        Prefs.setServer(MainActivity.this, f);
                        Prefs.setToken(MainActivity.this, "");
                        PollJobService.cancel(MainActivity.this);
                        hideSetup();
                        web.clearHistory();
                        openSite(null);
                    }
                });
            }
        }).start();
    }

    /** فقط «پروتکل + میزبان + پورت» را نگه می‌دارد. */
    private static String origin(String s) {
        try {
            Uri u = Uri.parse(s);
            if (u.getScheme() == null || u.getAuthority() == null || u.getHost() == null) return null;
            return u.getScheme().toLowerCase() + "://" + u.getAuthority();
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean ping(String base) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(base + "/api/health").openConnection();
            con.setConnectTimeout(8000);
            con.setReadTimeout(8000);
            if (con.getResponseCode() != 200) return false;
            InputStream in = con.getInputStream();
            byte[] buf = new byte[2048];
            int n = in.read(buf);
            in.close();
            String body = n > 0 ? new String(buf, 0, n, "UTF-8") : "";
            return body.contains("\"ok\":true");
        } catch (Exception e) {
            return false;
        } finally {
            if (con != null) con.disconnect();
        }
    }

    // ------------------------------------------------------------------ نتیجه‌ی اجازه‌ها و انتخاب فایل
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_UNLOCK) {
            if (res == RESULT_OK) hideLock();
            return;
        }
        if (req == REQ_FILE) {
            suppressLock = false;
            if (fileCb != null) {
                fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
                fileCb = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        if (req == REQ_LOC && geoCb != null) {
            boolean ok = false;
            for (int r : results) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
            geoCb.invoke(geoOrigin, ok, false);
            geoCb = null;
            return;
        }
        super.onRequestPermissionsResult(req, perms, results);
    }

    // ------------------------------------------------------------------ قفل برنامه، شبکه، نوار وضعیت
    private boolean deviceSecure() {
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        return km != null && km.isDeviceSecure();
    }

    private void showLock() {
        if (lockView != null || root == null) return;
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(NAVY);
        box.setClickable(true);
        TextView logo = new TextView(this);
        logo.setText("د");
        logo.setTextColor(GOLD);
        logo.setTextSize(46);
        logo.setTypeface(Typeface.DEFAULT_BOLD);
        logo.setGravity(Gravity.CENTER);
        GradientDrawable ring = new GradientDrawable();
        ring.setCornerRadius(dp(24));
        ring.setStroke(dp(2), GOLD);
        logo.setBackground(ring);
        box.addView(logo, new LinearLayout.LayoutParams(dp(88), dp(88)));
        TextView t = text("دال قفل است", 20, GOLD, true);
        t.setPadding(0, dp(16), 0, dp(14));
        box.addView(t);
        Button b = new Button(this);
        b.setText("باز کردن قفل");
        b.setAllCaps(false);
        b.setTextColor(0xFF1B1405);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFFF0D98C, 0xFFB88A2A});
        bg.setCornerRadius(dp(14));
        b.setBackground(bg);
        b.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                askUnlock();
            }
        });
        box.addView(b, new LinearLayout.LayoutParams(dp(220), dp(50)));
        lockView = box;
        root.addView(box, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void hideLock() {
        if (lockView != null) {
            root.removeView(lockView);
            lockView = null;
        }
    }

    private void askUnlock() {
        try {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            Intent i = km == null ? null : km.createConfirmDeviceCredentialIntent("دال", "برای ادامه، قفل گوشی را وارد کنید");
            if (i == null) hideLock();
            else startActivityForResult(i, REQ_UNLOCK);
        } catch (Exception e) {
            hideLock();
        }
    }

    private void watchNetwork() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            netCb = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network n) {
                    ui.post(new Runnable() {
                        @Override
                        public void run() {
                            if (offlineShown && setupView == null) retryNow();
                        }
                    });
                }
            };
            cm.registerDefaultNetworkCallback(netCb);
        } catch (Exception e) {
            netCb = null;
        }
    }

    private void retryNow() {
        if (offlineShown) {
            String u = failedUrl;
            if (u == null || u.isEmpty()) u = Prefs.server(this) + "/";
            web.loadUrl(u);
        } else {
            web.reload();
        }
    }

    private void setBars(String color, boolean lightIcons) {
        try {
            int c = Color.parseColor(color);
            getWindow().setStatusBarColor(c);
            getWindow().setNavigationBarColor(c);
            root.setBackgroundColor(c);
            if (Build.VERSION.SDK_INT >= 23) {
                int f = getWindow().getDecorView().getSystemUiVisibility();
                if (lightIcons) f &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                else f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= 26) {
                    if (lightIcons) f &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    else f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                getWindow().getDecorView().setSystemUiVisibility(f);
            }
        } catch (Exception ignored) {
            // رنگ نامعتبر
        }
    }

    // ------------------------------------------------------------------ کمک‌ها
    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_LONG).show();
    }

    private void copyText(String s) {
        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("dal", s));
    }

    private boolean notificationsAllowed() {
        if (Build.VERSION.SDK_INT >= 33) {
            return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void askNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && !notificationsAllowed()) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }
    }

    private void saveFile(String name, String mime, String b64) {
        try {
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            String safe = (name == null || name.isEmpty() ? "dal-file" : name).replaceAll("[\\\\/:*?\"<>|]", "_");
            String type = (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                v.put(MediaStore.MediaColumns.MIME_TYPE, type);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Dal");
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("insert failed");
                OutputStream os = getContentResolver().openOutputStream(uri);
                try {
                    os.write(data);
                } finally {
                    os.close();
                }
                toast("ذخیره شد: پوشه‌ی Downloads/Dal ← " + safe);
            } else if (type.startsWith("text/")) {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, new String(data, "UTF-8"));
                startActivity(Intent.createChooser(send, "ذخیره یا ارسال " + safe));
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File f = new File(dir, safe);
                FileOutputStream fo = new FileOutputStream(f);
                try {
                    fo.write(data);
                } finally {
                    fo.close();
                }
                toast("ذخیره شد: " + f.getAbsolutePath());
            }
        } catch (Exception e) {
            toast("ذخیره‌ی فایل ناموفق بود.");
        }
    }

    // ------------------------------------------------------------------ پلِ جاوااسکریپت (window.DalAndroid)
    private class Bridge {
        @JavascriptInterface
        public boolean isApp() {
            return true;
        }

        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")";
        }

        @JavascriptInterface
        public String server() {
            return Prefs.server(MainActivity.this);
        }

        @JavascriptInterface
        public void setToken(final String t) {
            Prefs.setToken(MainActivity.this, t == null ? "" : t);
            if (t != null && !t.isEmpty()) {
                PollJobService.schedule(MainActivity.this);
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        askNotifications();
                    }
                });
            } else {
                PollJobService.cancel(MainActivity.this);
            }
        }

        @JavascriptInterface
        public void clearToken() {
            Prefs.setToken(MainActivity.this, "");
            PollJobService.cancel(MainActivity.this);
        }

        @JavascriptInterface
        public boolean notificationsEnabled() {
            return notificationsAllowed();
        }

        @JavascriptInterface
        public void enableNotifications() {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= 33 && !notificationsAllowed()) {
                        askNotifications();
                    } else if (Build.VERSION.SDK_INT >= 26) {
                        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                        i.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                        try {
                            startActivity(i);
                        } catch (Exception ignored) {
                            // هیچ
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public void changeServer() {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    showSetup(null);
                }
            });
        }

        @JavascriptInterface
        public void retry() {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    retryNow();
                }
            });
        }

        @JavascriptInterface
        public void share(final String title, final String text) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_SUBJECT, title);
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, title));
                }
            });
        }

        @JavascriptInterface
        public void copy(final String text) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    copyText(text);
                }
            });
        }

        @JavascriptInterface
        public void openExternal(final String url) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.openExternal(Uri.parse(url));
                }
            });
        }

        @JavascriptInterface
        public boolean lockEnabled() {
            return Prefs.lock(MainActivity.this);
        }

        @JavascriptInterface
        public boolean setLock(final boolean on) {
            if (on && !deviceSecure()) {
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        toast("اول در تنظیمات گوشی یک قفل صفحه (الگو، پین یا اثرانگشت) فعال کنید.");
                    }
                });
                return false;
            }
            Prefs.setLock(MainActivity.this, on);
            ui.post(new Runnable() {
                @Override
                public void run() {
                    if (on) getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }
            });
            return true;
        }

        @JavascriptInterface
        public void setBars(final String color, final boolean lightIcons) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.setBars(color, lightIcons);
                }
            });
        }

        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String b64) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.saveFile(name, mime, b64);
                }
            });
        }
    }
}
