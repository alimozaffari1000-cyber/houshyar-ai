import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const failures = [];
const warnings = [];
const read = (path) => readFileSync(path, 'utf8');
const html = read('index.html');
const js = read('src/main.js');
const css = read('src/style.css');

if (!/<html[^>]*lang="fa"[^>]*dir="rtl"/i.test(html)) failures.push('صفحه باید زبان فارسی و جهت RTL داشته باشد.');
if (!/<meta[^>]*name="viewport"[^>]*>/i.test(html)) failures.push('متاتگ viewport برای موبایل وجود ندارد.');
if (!/<meta[^>]*name="description"[^>]*content="[^"]+"/i.test(html)) warnings.push('توضیحات SEO صفحه خالی یا ناموجود است.');
if (!/<title>[^<]{3,}<\/title>/i.test(html)) failures.push('عنوان صفحه مناسب نیست.');
if (!/aria-live="polite"/i.test(js)) warnings.push('ناحیه پیام‌ها بهتر است aria-live داشته باشد.');
if (!/aria-label=/.test(js) && !/label[^>]*for=/i.test(js)) failures.push('ورودی پیام برچسب دسترس‌پذیر ندارد.');
if (!/@media\s*\(/.test(css)) failures.push('هیچ breakpoint واکنش‌گرایی در CSS پیدا نشد.');
if (!/box-sizing\s*:\s*border-box/.test(css)) warnings.push('box-sizing سراسری توصیه می‌شود.');
if (/https?:\/\/[^\s"'\x60]+/.test(js) && !/https:\/\/api\.groq\.com/.test(js)) warnings.push('آدرس خارجی در کد فرانت‌اند بررسی شود.');
if (/console\.(log|debug)\(/.test(js)) warnings.push('لاگ‌های توسعه در کد فرانت‌اند وجود دارند.');

const walk = (dir) => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
if (!existsSync('dist')) failures.push('خروجی build در dist ساخته نشده است.');
else {
  const files = walk('dist');
  const assets = files.filter(path => ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(extname(path).toLowerCase()));
  const total = assets.reduce((sum, path) => sum + statSync(path).size, 0);
  const jsBytes = assets.filter(path => extname(path).toLowerCase() === '.js').reduce((sum, path) => sum + statSync(path).size, 0);
  const cssBytes = assets.filter(path => extname(path).toLowerCase() === '.css').reduce((sum, path) => sum + statSync(path).size, 0);
  if (jsBytes > 300 * 1024) failures.push(`حجم JavaScript از سقف 300KB بیشتر است: ${Math.round(jsBytes / 1024)}KB`);
  if (cssBytes > 100 * 1024) failures.push(`حجم CSS از سقف 100KB بیشتر است: ${Math.round(cssBytes / 1024)}KB`);
  if (total > 1024 * 1024) failures.push(`حجم کل assetها از سقف 1MB بیشتر است: ${Math.round(total / 1024)}KB`);
  for (const path of assets.filter(path => /\.(png|jpe?g)$/i.test(path))) {
    if (statSync(path).size > 500 * 1024) warnings.push(`تصویر حجیم است؛ WebP/AVIF بررسی شود: ${path}`);
  }
  console.log(`Build budget: JS ${Math.round(jsBytes/1024)}KB / 300KB, CSS ${Math.round(cssBytes/1024)}KB / 100KB, assets ${Math.round(total/1024)}KB / 1024KB`);
}

if (failures.length) {
  console.error('HOUSHYAR QUALITY AGENT: FAILED');
  failures.forEach(item => console.error('- ' + item));
  process.exitCode = 1;
} else {
  console.log('HOUSHYAR QUALITY AGENT: static quality checks passed.');
}
warnings.forEach(item => console.warn('WARNING: ' + item));
console.log('این بررسی ایستا است؛ سنجش واقعی سرعت، Core Web Vitals و تست مرورگر پس از مشخص شدن URL عمومی سایت اضافه می‌شود.');
