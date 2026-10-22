#!/usr/bin/env bash
# فایل‌های ساخته‌شده را به همین شاخه برمی‌گرداند:  commit-back.sh "پیام" مسیر1 مسیر2 ...
msg="$1"; shift
git config user.name "dal-ci"; git config user.email "dal-ci@users.noreply.github.com"
git add -f "$@"
git diff --cached --quiet && { echo "تغییری نیست"; exit 0; }
git commit -q -m "$msg [skip ci]"
for i in 1 2 3 4; do
  git pull -q --rebase origin "$GITHUB_REF_NAME" && git push -q origin "HEAD:$GITHUB_REF_NAME" && exit 0
  sleep 5
done
exit 1
