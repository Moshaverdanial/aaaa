#!/usr/bin/env bash
# فعال‌کردن HTTPS (گواهی رایگان) برای دال روی سرور لینوکس (Ubuntu/Debian).
#   sudo bash https.sh dal.example.ir [email]
# پیش‌نیاز: دامنه با رکورد A به IP همین سرور اشاره کند و پورت‌های ۸۰ و ۴۴۳ باز باشند.
# اول Caddy را امتحان می‌کند (گواهی را خودکار می‌گیرد)، اگر نصبش نشد Nginx + certbot.
set -euo pipefail

DOMAIN="${1:-}"; EMAIL="${2:-}"
[ -n "$DOMAIN" ] || { echo "استفاده: sudo bash https.sh دامنه [ایمیل]"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "با sudo اجرا کنید."; exit 1; }
APP=/opt/dal
ENVF="$APP/data/.env"
mkdir -p "$APP/data"; touch "$ENVF"

set_env() { if grep -q "^$1=" "$ENVF"; then sed -i "s|^$1=.*|$1=$2|" "$ENVF"; else echo "$1=$2" >> "$ENVF"; fi; }
set_env DAL_BASE_URL "https://$DOMAIN"
set_env TRUST_PROXY 1
chmod 0644 "$ENVF"
systemctl restart dal 2>/dev/null || true

if command -v ufw >/dev/null 2>&1; then ufw allow 80/tcp || true; ufw allow 443/tcp || true; fi

install_caddy() {
  apt-get update -y
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
}

if command -v caddy >/dev/null 2>&1 || install_caddy; then
  cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy localhost:3000
}
EOF
  systemctl enable --now caddy
  systemctl restart caddy
  echo "✅ Caddy فعال شد. چند ثانیه صبر کنید و باز کنید: https://$DOMAIN"
else
  echo "نصب Caddy ممکن نشد؛ Nginx + certbot امتحان می‌شود…"
  apt-get update -y
  apt-get install -y nginx certbot python3-certbot-nginx
  cat > /etc/nginx/sites-available/dal <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/dal /etc/nginx/sites-enabled/dal
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "${EMAIL:-admin@$DOMAIN}" --redirect
  echo "✅ Nginx و گواهی فعال شد: https://$DOMAIN"
fi
