#!/usr/bin/env bash
# به‌روزرسانی دال روی سرور، بدون از دست رفتن داده‌ها.
#   sudo bash update.sh ./dal.js [./dal.apk]
# اول از پایگاه‌داده پشتیبان می‌گیرد، فایل جدید را می‌گذارد، سرویس را دوباره روشن می‌کند و اگر بالا نیامد، نسخه‌ی قبلی را برمی‌گرداند.
set -euo pipefail
APP=/opt/dal
NEW="${1:-./dal.js}"; APK="${2:-}"
[ "$(id -u)" = 0 ] || { echo "با sudo اجرا کنید."; exit 1; }
[ -f "$NEW" ] || { echo "فایل پیدا نشد: $NEW"; exit 1; }
NODE="$APP/node/bin/node"; [ -x "$NODE" ] || NODE="$(command -v node)"

echo "← پشتیبان‌گیری از پایگاه‌داده…"
runuser -u dal -- "$NODE" --no-warnings "$APP/dal.js" backup || echo "(پشتیبان‌گیری ناموفق بود؛ ادامه می‌دهیم)"

cp -a "$APP/dal.js" "$APP/dal.js.prev"
install -m 0644 -o dal -g dal "$NEW" "$APP/dal.js"
if [ -n "$APK" ] && [ -f "$APK" ]; then install -m 0644 -o dal -g dal "$APK" "$APP/data/dal.apk"; echo "← فایل اپ اندروید به‌روز شد"; fi

systemctl restart dal
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null; then echo "✅ به‌روزرسانی انجام شد."; exit 0; fi
  sleep 1
done
echo "❌ سرویس بالا نیامد؛ نسخه‌ی قبلی برگردانده می‌شود."
install -m 0644 -o dal -g dal "$APP/dal.js.prev" "$APP/dal.js"
systemctl restart dal
exit 1
