"use strict";
/**
 * Scroll Simulator — WHITE Engine
 * ==================================
 * يُحاكي التمرير الطبيعي عبر ماسنجر وقائمة المحادثات
 * يُرسل طلبات HTTP لصفحات ماسنجر المختلفة بأنماط تدريجية
 * مختلف تماماً عن stealth — يُركّز على ماسنجر حصراً
 */

const axios = require("axios");

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randMs(minMin, maxMin) { return randInt(minMin * 60000, maxMin * 60000); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const chalk = require("chalk");
  const ts = new Date().toLocaleTimeString("en", { hour12: false });
  console.log(`${chalk.gray(ts)} ${chalk.cyan("•")} ${chalk.cyan("[SCROLL]")} ${msg}`);
}

function localHour() {
  const tz = global.config?.timezone || "Africa/Algiers";
  try { return parseInt(new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }), 10); }
  catch (_) { return new Date().getHours(); }
}

// قائمة صفحات ماسنجر المختلفة
const MESSENGER_PAGES = [
  { url: "https://m.me/",                                       label: "Messenger home",    w: 15 },
  { url: "https://www.messenger.com/",                          label: "Messenger web",     w: 12 },
  { url: "https://m.facebook.com/messages/",                    label: "Messages list",     w: 20 },
  { url: "https://m.facebook.com/messages/t/",                  label: "Thread list",       w: 18 },
  { url: "https://m.facebook.com/?sk=h_nor",                    label: "News feed scroll",  w: 10 },
  { url: "https://m.facebook.com/messages/read/?action=forward",label: "Fwd msg page",      w: 5  },
  { url: "https://mbasic.facebook.com/messages/",               label: "mbasic msgs",       w: 10 },
  { url: "https://m.facebook.com/messages/seen/",               label: "Seen tracker",      w: 8  },
  { url: "https://m.facebook.com/saved/",                       label: "Saved items",       w: 5  },
  { url: "https://m.facebook.com/notifications/",               label: "Notifications",     w: 7  },
];

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + (i.w || 1), 0);
  let r = Math.random() * total;
  for (const item of items) { r -= (item.w || 1); if (r <= 0) return item; }
  return items[0];
}

function cookieStr(api) {
  try {
    const st = api.getAppState();
    if (!st?.length) return null;
    return st.map(c => `${c.key}=${c.value}`).join("; ");
  } catch (_) { return null; }
}

function getUA() {
  try {
    const stealth = require("./stealth");
    if (stealth.isRunning()) return stealth.getCurrentUA();
  } catch (_) {}
  return global.config?.userAgent ||
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
}

let _running = false;
let _api = null;
let _scrollCount = 0;
const _timers = [];

function addTimer(fn, ms) {
  const id = setTimeout(() => { const i = _timers.indexOf(id); if (i !== -1) _timers.splice(i, 1); fn(); }, ms);
  _timers.push(id); return id;
}
function clearAll() { _timers.forEach(id => clearTimeout(id)); _timers.length = 0; }

async function doScroll() {
  if (!_running || !_api) return;

  const h = localHour();
  // لا نتصفح في وقت النوم
  if (h >= 1 && h < 7) return addTimer(doScroll, randMs(45, 90));

  const cookies = cookieStr(_api);
  if (!cookies) return addTimer(doScroll, randMs(10, 20));

  const page = weightedRandom(MESSENGER_PAGES);
  const ua = getUA();

  // عدد الصفحات في الجلسة الواحدة (1-4 صفحات تتالياً)
  const sessLen = randInt(1, 4);
  log(`📱 Scroll session (${sessLen} pages)…`);

  for (let i = 0; i < sessLen; i++) {
    if (!_running) break;
    const p = i === 0 ? page : weightedRandom(MESSENGER_PAGES);
    try {
      await axios.get(p.url, {
        headers: {
          cookie: cookies,
          "user-agent": ua,
          "accept": "text/html,application/xhtml+xml,*/*;q=0.9",
          "accept-language": "ar-DZ,ar;q=0.9,en;q=0.7",
          "cache-control": "max-age=0",
          "referer": "https://m.facebook.com/",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "same-origin",
        },
        timeout: 12000, validateStatus: null, maxRedirects: 3,
      });
      _scrollCount++;
      log(`✅ ${p.label}`);
    } catch (_) {}

    if (i < sessLen - 1) await sleep(randInt(1500, 6000)); // تأخير بين الصفحات
  }

  // جدول الجلسة التالية بناءً على الوقت
  const nextMin = h >= 18 && h < 23 ? randMs(8, 20) : h >= 8 && h < 12 ? randMs(10, 25) : randMs(20, 50);
  addTimer(doScroll, nextMin);
}

function start(api) {
  const cfg = global.config?.scrollSimulator || {};
  // مُعطَّل افتراضياً — يتطلب تفعيلاً صريحاً في config.json
  // لأنه يُرسل طلبات HTTP بكثافة مما قد يُسبب طرد الجلسة
  if (cfg.enable !== true) return;
  if (_running) return;
  _running = true;
  _api = api;
  log("🚀 Scroll Simulator started");
  addTimer(doScroll, randMs(5, 15));
}

function stop() { _running = false; clearAll(); log("🛑 Scroll Simulator stopped"); }

module.exports = {
  start, stop,
  getStatus: () => ({ running: _running, scrollCount: _scrollCount }),
  isRunning: () => _running,
};
