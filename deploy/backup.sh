#!/usr/bin/env bash
# پشتیبان کامل داده‌های دال (پایگاه‌داده، عکس‌ها، تنظیمات) در یک فایل فشرده.
#   sudo bash backup.sh                      ← ذخیره در /var/backups/dal (۱۴ نسخه‌ی آخر نگه داشته می‌شود)
#   sudo bash backup.sh user@host:/path/     ← علاوه بر آن، با scp به سرور دیگر هم می‌فرستد
# هر شب خودکار:  echo '0 3 * * * root bash /root/backup.sh' | sudo tee /etc/cron.d/dal-backup
# برگرداندن: systemctl stop dal && tar xzf dal-XXXX.tar.gz -C /opt/dal && chown -R dal:dal /opt/dal/data && systemctl start dal
set -euo pipefail
APP=/opt/dal; DEST=/var/backups/dal; TS=$(date +%F-%H%M)
mkdir -p "$DEST"; chmod 700 "$DEST"
NODE="$APP/node/bin/node"; [ -x "$NODE" ] || NODE="$(command -v node)"
runuser -u dal -- "$NODE" --no-warnings "$APP/dal.js" backup >/dev/null 2>&1 || true
OUT="$DEST/dal-$TS.tar.gz"
tar czf "$OUT" -C "$APP" --exclude=data/tiles --exclude=data/dal.db-shm --exclude=data/dal.db-wal data
chmod 600 "$OUT"
ls -1t "$DEST"/dal-*.tar.gz | tail -n +15 | xargs -r rm -f
echo "✅ $OUT ($(du -h "$OUT" | cut -f1))"
if [ -n "${1:-}" ]; then scp -q "$OUT" "$1" && echo "✅ به $1 فرستاده شد"; fi
