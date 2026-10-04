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
adb shell am start -n ir.dal.app/.MainActivity --es link "#/install" ; sleep 8; shot 3-install
adb shell am start -n ir.dal.app/.MainActivity --es link "#/search" ; sleep 8; shot 4-search

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

adb logcat -d | grep -E "AndroidRuntime|FATAL|ir.dal.app" | tail -60 > $OUT/logcat.txt || true
exit 0
