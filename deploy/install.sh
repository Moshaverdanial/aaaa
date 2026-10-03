#!/usr/bin/env bash
# نصب دال روی سرور لینوکس (Ubuntu/Debian/…)، بدون Docker و بدون npm.
#   sudo bash install.sh [مسیر dal.js] [--node-tarball /path/node-v22.x-linux-x64.tar.xz]
# اگر سرور به اینترنت جهانی دسترسی ندارد: dal.js و فایل Node را با scp ببرید و مسیرشان را بدهید.
set -euo pipefail

APP=/opt/dal
NODE_VERSION="${NODE_VERSION:-22.14.0}"
DAL_JS="${1:-./dal.js}"; NODE_TAR=""
if [ "${2:-}" = "--node-tarball" ]; then NODE_TAR="${3:-}"; fi
[ "$(id -u)" = 0 ] || { echo "با sudo اجرا کنید."; exit 1; }
[ -f "$DAL_JS" ] || { echo "فایل dal.js پیدا نشد: $DAL_JS"; exit 1; }

case "$(uname -m)" in x86_64) ARCH=x64;; aarch64|arm64) ARCH=arm64;; *) echo "معماری پشتیبانی‌نشده: $(uname -m)"; exit 1;; esac
id dal >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin dal
mkdir -p "$APP/data"

need_node() {
  local n="${1:-node}"; command -v "$n" >/dev/null 2>&1 || [ -x "$n" ] || return 0
  "$n" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a==22&&b>=13)?0:1)' && return 1 || return 0
}

NODE_BIN=""
if ! need_node "$(command -v node || echo node)"; then NODE_BIN="$(command -v node)"; echo "Node سیستمی مناسب است: $NODE_BIN"; fi
if [ -z "$NODE_BIN" ]; then
  FILE="node-v$NODE_VERSION-linux-$ARCH.tar.xz"; TMP="$(mktemp -d)"
  if [ -n "$NODE_TAR" ]; then cp "$NODE_TAR" "$TMP/$FILE"
  else
    # آینه‌ها به ترتیب امتحان می‌شوند؛ هر کدام که از سرور شما در دسترس بود
    for M in "https://nodejs.org/dist/v$NODE_VERSION" "https://npmmirror.com/mirrors/node/v$NODE_VERSION" "https://mirrors.aliyun.com/nodejs-release/v$NODE_VERSION" "https://cdn.npmmirror.com/binaries/node/v$NODE_VERSION"; do
      echo "تلاش: $M/$FILE"; if curl -fL --connect-timeout 10 --max-time 600 -o "$TMP/$FILE" "$M/$FILE"; then break; fi; rm -f "$TMP/$FILE"
    done
    [ -f "$TMP/$FILE" ] || { echo "دانلود Node ناموفق بود. فایل را دستی بیاورید و با --node-tarball بدهید."; exit 1; }
  fi
  rm -rf "$APP/node"; mkdir -p "$APP/node"; tar -xJf "$TMP/$FILE" -C "$APP/node" --strip-components=1; rm -rf "$TMP"
  NODE_BIN="$APP/node/bin/node"
fi

install -m 0644 "$DAL_JS" "$APP/dal.js"
chown -R dal:dal "$APP"
SRC="$(dirname "$0")/dal.service"; [ -f "$SRC" ] || SRC="$(dirname "$DAL_JS")/deploy/dal.service"
if [ -f "$SRC" ]; then sed "s#/opt/dal/node/bin/node#$NODE_BIN#" "$SRC" > /etc/systemd/system/dal.service
else  # فایل dal.service همراه نبود؛ سرویس را همین‌جا می‌سازیم
cat > /etc/systemd/system/dal.service <<UNIT
[Unit]
Description=Dal real-estate platform
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$APP
ExecStart=$NODE_BIN --no-warnings $APP/dal.js
Environment=PORT=3000
Environment=TRUST_PROXY=1
EnvironmentFile=-$APP/data/.env
Restart=always
RestartSec=3
User=dal
Group=dal
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$APP
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
UNIT
fi
systemctl daemon-reload && systemctl enable --now dal
sleep 2; systemctl --no-pager --lines=8 status dal || true
echo
echo "کد راه‌اندازی مدیر:  journalctl -u dal | grep -i -A2 setup   (یا فایل $APP/data/.setup-token)"
echo "سپس باز کنید:  http://<IP>:3000/#/setup   — برای HTTPS، nginx یا Caddy را جلوی پورت ۳۰۰۰ بگذارید (راهنما در README)."
