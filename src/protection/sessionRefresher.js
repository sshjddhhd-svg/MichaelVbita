"use strict";
/**
 * Session Refresher — WHITE Engine (fixed v2)
 * ===================================
 * 1. يحفظ AppState المحدَّث دورياً (محلياً) لمنع فقدان الكوكيز عند الكراش
 * 2. يُنفّذ "session touch" عبر getUserInfo لتجديد الجلسة على سيرفرات فيسبوك
 *    دون أي طلب HTTP مستقل — يسير عبر قناة FCA الموجودة
 */

const fs   = require("fs-extra");
const path = require("path");

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randMs(minMin, maxMin) { return randInt(minMin * 60000, maxMin * 60000); }

function log(level, msg) {
  const chalk = require("chalk");
  const ts = new Date().toLocaleTimeString("en", { hour12: false });
  if (level === "ok")   console.log(`${chalk.gray(ts)} ${chalk.green("✔")} ${chalk.green("[SESS_REF] " + msg)}`);
  if (level === "warn") console.log(`${chalk.gray(ts)} ${chalk.yellow("⚠")} ${chalk.yellow("[SESS_REF] " + msg)}`);
  if (level === "info") console.log(`${chalk.gray(ts)} ${chalk.cyan("•")} [SESS_REF] ${msg}`);
}

const ACCOUNT_PATH = path.join(__dirname, "../../account.txt");

let _running   = false;
let _api       = null;
let _saveCount = 0;
let _lastSave  = 0;
let _touchCount= 0;
let _lastTouch = 0;
const _timers  = [];

function addTimer(fn, ms) {
  const id = setTimeout(() => { const i = _timers.indexOf(id); if (i !== -1) _timers.splice(i, 1); fn(); }, ms);
  _timers.push(id); return id;
}
function clearAll() { _timers.forEach(id => clearTimeout(id)); _timers.length = 0; }

// ─── حفظ AppState محلياً ───────────────────────────────────────────────────────
async function doSave() {
  if (!_running || !_api) return;

  try {
    const fresh = _api.getAppState();
    if (fresh?.length) {
      const { dedup } = require("../utils/cookieParser");
      const deduped = dedup(fresh);
      global._selfWrite = true;
      fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(deduped, null, 2), "utf8");
      setTimeout(() => { global._selfWrite = false; }, 6000);
      _saveCount++;
      _lastSave = Date.now();
      log("ok", `AppState saved (${deduped.length} cookies) ×${_saveCount}`);
    }
  } catch (_) {}

  const cfg = global.config?.sessionRefresher || {};
  const minMin = cfg.minIntervalMinutes ?? 20;
  const maxMin = cfg.maxIntervalMinutes ?? 35;
  addTimer(doSave, randMs(minMin, maxMin));
}

// ─── Session Touch — تجديد الجلسة على سيرفرات فيسبوك ─────────────────────────
async function doTouch() {
  if (!_running || !_api) return;

  try {
    const uid = String(_api.getCurrentUserID() || "");
    if (uid) {
      await new Promise((resolve) => {
        try {
          // getUserInfo يمر عبر قناة FCA الموجودة → يُجدّد token على فيسبوك
          _api.getUserInfo([uid], (err, data) => {
            if (!err && data) {
              _touchCount++;
              _lastTouch = Date.now();
              // حدّث الطابع الزمني لـ health-check
              global._lastActivity     = Date.now();
              global._lastMqttActivity = Date.now();
              try { require("./mqttHealthCheck").onMqttActivity(); } catch (_) {}
              log("ok", `Session touch OK ✔ (UID: ${uid}) ×${_touchCount}`);
            } else if (err) {
              const msg = String(err.error || err.message || err);
              log("warn", `Session touch failed: ${msg.slice(0, 80)}`);
            }
            resolve();
          });
        } catch (_) { resolve(); }
      });
    }
  } catch (_) {}

  // Touch كل 15-25 دقيقة بشكل مستقل عن الحفظ
  const cfg = global.config?.sessionRefresher || {};
  const minMin = cfg.touchIntervalMinutes ?? 15;
  const maxMin = cfg.touchMaxIntervalMinutes ?? 25;
  addTimer(doTouch, randMs(minMin, maxMin));
}

function start(api) {
  const cfg = global.config?.sessionRefresher || {};
  if (cfg.enable === false) return;
  if (_running) return;
  _running = true;
  _api     = api;
  log("info", "🚀 Session Refresher started (save + touch mode)");

  // حفظ محلي: أول مرة بعد 15-25 دقيقة
  addTimer(doSave, randMs(15, 25));
  // session touch: أول مرة بعد 8-12 دقيقة
  addTimer(doTouch, randMs(8, 12));
}

function stop() {
  _running = false;
  clearAll();
  log("warn", "🛑 Session Refresher stopped");
}

module.exports = {
  start, stop,
  getStatus: () => ({
    running:    _running,
    saveCount:  _saveCount,
    lastSave:   _lastSave,
    touchCount: _touchCount,
    lastTouch:  _lastTouch,
  }),
  isRunning: () => _running,
};
