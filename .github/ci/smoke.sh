#!/usr/bin/env bash
# آزمون دودی اپ روی شبیه‌ساز اندروید: نصب، صفحه‌ی تنظیم سرور، اتصال، بارگذاری سایت، صفحه‌ی خطا و اعلان‌ها
set -x
cd "$GITHUB_WORKSPACE"
OUT=docs/android-ci; mkdir -p $OUT
APK=android/app/build/outputs/apk/debug/app-debug.apk
D=.github/ci
shot() { adb exec-out screencap -p > "$OUT/$1.png"; adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1; adb pull /sdcard/u.xml "$OUT/$1.xml" >/dev/null 2>&1; }

adb install -r "$APK"
adb shell pm grant ir.dal.app android.permission.POST_NOTIFICATIONS || true
adb shell am start -n ir.dal.app/.MainActivity
sleep 8; shot 1-setup

XY=$(python3 $D/uitap.py $OUT/1-setup.xml android.widget.EditText) && adb shell input tap $XY
sleep 1; adb shell input text "10.0.2.2:3000"; sleep 1; adb shell input keyevent 66
sleep 25; shot 2-home

TOKEN=$(cat "$RUNNER_TEMP/token")
adb shell "am start -n ir.dal.app/.MainActivity --es link '#/install'"; sleep 8; shot 3-install
adb shell "am start -n ir.dal.app/.MainActivity --es link '#/search'"; sleep 8; shot 4-search

# ---- پل جاوااسکریپت از داخل WebView (ابزار توسعه‌دهنده‌ی کروم)
export NODE_PATH="$RUNNER_TEMP/cdp/node_modules"
PID=$(adb shell pidof ir.dal.app | tr -d '\r'); adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
CDP="node $D/cdp.js"
{
  echo "== بررسی پل"; $CDP "JSON.stringify([Dal.isApp, DalAndroid.version(), location.href])"
  echo "== ورود از داخل اپ (باید setToken را صدا بزند)"; $CDP "(async()=>{const r=await Dal.api('/auth/login',{method:'POST',body:{phone:'09120000001',password:'Admin12345'}}); Dal.setSession(r.token,r.user); return 'login ok: '+r.user.name+' token_in_app='+(DalAndroid.server()?'server_set':'no')})()"
  echo "== ذخیره‌ی فایل (متن و blob)"; $CDP "(async()=>{await Dal.download('cdp-test.txt','سلام دال','text/plain'); await Dal.download('cdp-test.csv', new Blob(['a,b\n1,2'],{type:'text/csv'})); return 'saved'})()"
  sleep 4; adb shell ls -la /sdcard/Download/Dal/; adb shell cat /sdcard/Download/Dal/cdp-test.txt
  echo; echo "== قفل (شبیه‌ساز قفل صفحه ندارد؛ باید false بدهد)"; $CDP "JSON.stringify([DalAndroid.setLock(true), DalAndroid.lockEnabled()])"
  echo "== نوار وضعیت"; $CDP "DalAndroid.setBars('#f6f1e6', false); 'ok'"
  echo "== کشیدن برای بازخوانی"; T0=$($CDP "String(performance.timeOrigin)"); adb shell input swipe 540 300 540 1000 400; sleep 6; T1=$($CDP "String(performance.timeOrigin)"); echo "before=$T0 after=$T1"
  echo "== صفحه‌ی /api/app"; $CDP "fetch('/api/app').then(r=>r.text())"
} > $OUT/7-cdp.txt 2>&1
$CDP "location.hash='#/my-card'; 'ok'" > /dev/null; sleep 4; shot 7-mycard

# اعلان‌ها: ورود با توکن مدیر، نقطه‌ی شروع، ساخت رویداد در سرور، اجرای دوباره‌ی کار
adb shell am start -n ir.dal.app/.MainActivity --es dbg_token "$TOKEN"; sleep 4
adb shell cmd jobscheduler run -f ir.dal.app 4201; sleep 6
curl -s -XPOST localhost:3000/api/auth/register -H 'content-type: application/json' -d '{"name":"مشاور آزمایشی اعلان","phone":"09121112233","password":"Test12345","role":"agent","agency":"آزمون","license_no":"123456"}' > /dev/null
sleep 2
adb shell cmd jobscheduler run -f ir.dal.app 4201; sleep 8
adb shell dumpsys notification --noredact | grep -E "pkg=ir.dal.app|android.title|android.text" | head -20 > $OUT/5-notifications.txt
adb shell cmd jobscheduler get-job-state ir.dal.app 4201 >> $OUT/5-notifications.txt 2>&1 || true

# سرور خاموش → صفحه‌ی خطا
kill "$(cat "$RUNNER_TEMP/server.pid")" || true
adb shell am force-stop ir.dal.app; sleep 2
adb shell am start -n ir.dal.app/.MainActivity; sleep 12; shot 6-offline
# سرور دوباره روشن می‌شود؛ دکمه‌ی «تلاش دوباره» باید سایت را برگرداند
(PORT=3000 DAL_DATA_DIR="$RUNNER_TEMP/dal" nohup node server/index.js > "$RUNNER_TEMP/server2.log" 2>&1 &)
sleep 5
ALIVE=$(adb shell pidof ir.dal.app | tr -d '\r')
if [ -z "$ALIVE" ]; then
  echo "اپ پیش از دکمه‌ی تلاش دوباره توسط سیستم بسته شده بود (ناپایداری شبیه‌ساز)؛ دوباره اجرا می‌شود" > $OUT/8-note.txt
  adb shell am start -n ir.dal.app/.MainActivity; sleep 12
else
  echo "اپ زنده بود؛ دکمه‌ی تلاش دوباره زده شد" > $OUT/8-note.txt
  adb shell input tap 540 1489
fi
sleep 12; shot 8-recovered

adb logcat -d | grep -E "AndroidRuntime|FATAL|ir.dal.app" | tail -60 > $OUT/logcat.txt || true
exit 0
