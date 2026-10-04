package ir.dal.app;

import android.content.Context;
import android.content.SharedPreferences;

/** ذخیره‌ی تنظیمات اپ: آدرس سرور، نشست کاربر (برای اعلان‌ها) و آخرین اعلان دیده‌شده. */
final class Prefs {
    private Prefs() {}

    private static SharedPreferences sp(Context c) {
        return c.getApplicationContext().getSharedPreferences("dal", Context.MODE_PRIVATE);
    }

    static String server(Context c) {
        String s = sp(c).getString("server", "");
        if (s == null || s.isEmpty()) s = BuildConfig.DEFAULT_SERVER;
        return s == null ? "" : s;
    }

    static void setServer(Context c, String s) {
        sp(c).edit().putString("server", s).putLong("lastId", -1).apply();
    }

    static String token(Context c) {
        String t = sp(c).getString("token", "");
        return t == null ? "" : t;
    }

    static void setToken(Context c, String t) {
        String old = token(c);
        SharedPreferences.Editor e = sp(c).edit().putString("token", t == null ? "" : t);
        if (t == null || !t.equals(old)) e.putLong("lastId", -1);
        e.apply();
    }

    static long lastId(Context c) {
        return sp(c).getLong("lastId", -1);
    }

    static void setLastId(Context c, long id) {
        sp(c).edit().putLong("lastId", id).apply();
    }
}
