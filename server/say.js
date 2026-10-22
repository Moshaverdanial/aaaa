'use strict';
/* پیام‌های ترمینال: ویندوز (سی‌ام‌دی و پاورشل) فارسی راست‌به‌چپ را درست نشان نمی‌دهد؛
   پس روی ویندوز پیام‌ها انگلیسی چاپ می‌شوند. با DAL_LOG_LANG=fa یا en می‌شود اجبارش کرد. */
const forced = (process.env.DAL_LOG_LANG || '').toLowerCase();
const en = forced ? forced === 'en' : process.platform === 'win32';
module.exports = (fa, eng) => (en ? eng : fa);
module.exports.en = en;
