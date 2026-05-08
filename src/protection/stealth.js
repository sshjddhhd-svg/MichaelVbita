"use strict";

const axios = require("axios");

function log(level, msg) {
  const chalk = require("chalk");
  const ts = new Date().toLocaleTimeString("en", { hour12: false });
  if (level === "info") console.log(`${chalk.gray(ts)} ${chalk.cyan("•")} ${chalk.cyan("[STEALTH]")} ${msg}`);
  if (level === "warn") console.log(`${chalk.gray(ts)} ${chalk.yellow("⚠")} ${chalk.yellow("[STEALTH] " + msg)}`);
}

function randMs(minMin, maxMin) {
  return Math.floor(Math.random() * ((maxMin - minMin) * 60_000 + 1)) + minMin * 60_000;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function localHour() {
  const tz = global.config?.timezone || "Africa/Algiers";
  try {
    return parseInt(new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }), 10);
  } catch (_) { return new Date().getHours(); }
}

function isSleepHour() {
  const cfg = global.config?.stealth || {};
  const start = cfg.sleepHourStart ?? 1;
  const end   = cfg.sleepHourEnd   ?? 8;
  const h = localHour();
  return start < end ? (h >= start && h < end) : (h >= start || h < end);
}

function cookieStr(api) {
  try {
    const st = api.getAppState();
    if (!st?.length) return null;
    return st.map(c => `${c.key}=${c.value}`).join("; ");
  } catch (_) { return null; }
}

const UA_POOL = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; M2102J20SG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; OnePlus 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/459.0.0.29.109;]",
];

let _uaIdx = randInt(0, UA_POOL.length - 1);
function getUA() { return UA_POOL[_uaIdx]; }
function rotateUA() {
  _uaIdx = (_uaIdx + randInt(1, UA_POOL.length - 1)) % UA_POOL.length;
  log("info", `🔄 UA rotated → ${UA_POOL[_uaIdx].slice(0, 60)}…`);
}

const PAGE_POOL = [
  { url: "https://m.facebook.com/",               label: "Home feed",     method: "GET"  },
  { url: "https://m.facebook.com/?sk=h_nor",       label: "News feed",     method: "HEAD" },
  { url: "https://m.facebook.com/notifications",   label: "Notifications", method: "GET"  },
  { url: "https://m.facebook.com/messages",        label: "Messages",      method: "HEAD" },
  { url: "https://m.facebook.com/profile.php",     label: "Own profile",   method: "GET"  },
  { url: "https://mbasic.facebook.com/",           label: "mbasic home",   method: "GET"  },
  { url: "https://mbasic.facebook.com/me",         label: "mbasic profile","method": "HEAD" },
  { url: "https://mbasic.facebook.com/notifications","label":"mbasic notifs","method":"HEAD" },
];

let running = false;
let _api    = null;
let _startTime = Date.now();
const _timers = [];

// ─── آخر حالة حضور أُرسلت لمنع الاستدعاءات المكررة ───────────────────────
let _lastPresenceState = null;

function addTimer(fn, ms) {
  const id = setTimeout(() => { const i = _timers.indexOf(id); if (i !== -1) _timers.splice(i, 1); fn(); }, ms);
  _timers.push(id);
  return id;
}
function clearAll() { _timers.forEach(id => clearTimeout(id)); _timers.length = 0; }

function isWarmup() {
  const w = (global.config?.stealth?.warmupMinutes ?? 15) * 60_000;
  return (Date.now() - _startTime) < w;
}

async function presenceLoop() {
  if (!running) return;
  const api = _api;
  try {
    if (isSleepHour()) {
      if (_lastPresenceState !== "offline") {
        try { api.setOptions({ online: false }); } catch (_) {}
        _lastPresenceState = "offline";
        log("info", "🌙 Sleep — presence: offline");
      }
      // فترة أطول في وقت النوم: 30-60 دقيقة (تقليل استدعاءات api.setOptions)
      return addTimer(presenceLoop, randMs(30, 60));
    }
    if (isWarmup()) {
      if (_lastPresenceState !== "offline") {
        try { api.setOptions({ online: false }); } catch (_) {}
        _lastPresenceState = "offline";
      }
      return addTimer(presenceLoop, randMs(5, 10));
    }
    const roll = Math.random();
    let newState;
    let nextInterval;

    if (roll < 0.50) {
      newState = "online";
      nextInterval = randMs(12, 25); // 12-25 دقيقة (زيادة من 6-18)
    } else if (roll < 0.80) {
      newState = "idle";
      nextInterval = randMs(10, 20); // 10-20 دقيقة (زيادة من 5-15)
    } else {
      newState = "offline_break";
      nextInterval = randMs(15, 30); // 15-30 دقيقة (زيادة من 10-25)
    }

    // لا نستدعي api.setOptions إذا الحالة لم تتغير → تقليل الضوضاء
    if (newState !== _lastPresenceState) {
      if (newState === "online") {
        try { api.setOptions({ online: true }); } catch (_) {}
        log("info", "🟢 Presence → online");
      } else {
        try { api.setOptions({ online: false }); } catch (_) {}
        log("info", newState === "idle" ? "💤 Presence → idle" : "📴 Presence → offline break");
      }
      _lastPresenceState = newState;
    }

    addTimer(presenceLoop, nextInterval);
  } catch (_) { addTimer(presenceLoop, randMs(15, 25)); }
}

module.exports.start = function(api) {
  if (running) return;
  const cfg = global.config?.stealth || {};
  if (cfg.enable === false) { log("info", "Stealth disabled in config."); return; }
  running    = true;
  _api       = api;
  _startTime = Date.now();
  _lastPresenceState = null;
  log("info", `🕵️ Stealth engine started (sleep: ${cfg.sleepHourStart ?? 1}:00–${cfg.sleepHourEnd ?? 8}:00)`);
  // presenceLoop فقط — آمن 100%، فترات أطول لتقليل api.setOptions calls
  addTimer(presenceLoop, randMs(3, 8)); // أول تغيير بعد 3-8 دقائق
};

module.exports.stop = function() {
  running = false;
  _lastPresenceState = null;
  clearAll();
  log("info", "🛑 Stealth stopped.");
};
module.exports.isRunning   = () => running;
module.exports.getCurrentUA = getUA;
module.exports.jitter = (ms) => Math.round(ms * (0.85 + Math.random() * 0.30));
module.exports.getStatus = function() {
  const cfg = global.config?.stealth || {};
  return { running, isSleepHour: isSleepHour(), isWarmup: isWarmup(), localHour: localHour(),
    sleepStart: cfg.sleepHourStart ?? 1, sleepEnd: cfg.sleepHourEnd ?? 8,
    warmupMinutes: cfg.warmupMinutes ?? 15, currentUA: getUA().slice(0, 60) + "…" };
};
