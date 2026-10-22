package ir.dal.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * هر ۱۵ دقیقه (حداقل زمان اندروید) اعلان‌های تازه‌ی کاربر را از سرور خودِ دال می‌پرسد
 * و به‌صورت اعلان گوشی نشان می‌دهد. به سرویس‌های گوگل (FCM) نیازی ندارد، پس در ایران هم کار می‌کند.
 * یادآور پیگیری‌ها و گزارش‌ها هم از همین راه به گوشی می‌رسند.
 */
public class PollJobService extends JobService {
    static final int JOB_ID = 4201;
    static final String CHANNEL = "dal_main";

    static void schedule(Context c) {
        try {
            JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js == null) return;
            if (js.getPendingJob(JOB_ID) != null) return;
            JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(c, PollJobService.class))
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPeriodic(15L * 60L * 1000L)
                    .setPersisted(true)
                    .build();
            js.schedule(info);
        } catch (Throwable ignored) {
            // بعضی گوشی‌ها زمان‌بندی را محدود می‌کنند؛ اپ همچنان کار می‌کند.
        }
    }

    static void cancel(Context c) {
        try {
            JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js != null) js.cancel(JOB_ID);
        } catch (Throwable ignored) {
            // هیچ
        }
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    poll(getApplicationContext());
                } catch (Throwable ignored) {
                    // شبکه قطع بوده؛ دور بعدی دوباره امتحان می‌شود.
                }
                jobFinished(params, false);
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    static void poll(Context ctx) throws Exception {
        String server = Prefs.server(ctx);
        String token = Prefs.token(ctx);
        if (server.isEmpty() || token.isEmpty()) return;

        HttpURLConnection con = (HttpURLConnection) new URL(server + "/api/notifications").openConnection();
        con.setConnectTimeout(15000);
        con.setReadTimeout(20000);
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setRequestProperty("Accept", "application/json");
        if (con.getResponseCode() != 200) {
            con.disconnect();
            return;
        }
        InputStream in = con.getInputStream();
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        in.close();
        con.disconnect();

        JSONObject o = new JSONObject(bo.toString("UTF-8"));
        JSONArray items = o.optJSONArray("items");
        if (items == null) return;

        long last = Prefs.lastId(ctx);
        long max = Math.max(last, 0);
        for (int i = 0; i < items.length(); i++) max = Math.max(max, items.getJSONObject(i).optLong("id", 0));
        if (last < 0) { // اولین بار: فقط نقطه‌ی شروع را ثبت کن تا اعلان‌های قدیمی یک‌جا نیایند
            Prefs.setLastId(ctx, max);
            return;
        }
        int shown = 0;
        for (int i = items.length() - 1; i >= 0; i--) { // قدیمی به جدید
            JSONObject it = items.getJSONObject(i);
            long id = it.optLong("id", 0);
            if (id <= last || it.optInt("read", 0) != 0) continue;
            if (shown >= 5) break;
            show(ctx, id, it.optString("title", "دال"), it.optString("body", ""), it.optString("link", ""));
            shown++;
        }
        Prefs.setLastId(ctx, max);
    }

    static void show(Context ctx, long id, String title, String body, String link) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "اعلان‌های دال", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("پیگیری‌ها، پیام‌ها و گزارش‌ها");
            nm.createNotificationChannel(ch);
        }
        Intent i = new Intent(ctx, MainActivity.class);
        i.putExtra("link", link);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, (int) (id % 100000), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setColor(0xFF1F3A8A);
        try {
            nm.notify((int) (id % 100000), b.build());
        } catch (Throwable ignored) {
            // اجازه‌ی اعلان داده نشده
        }
    }
}
