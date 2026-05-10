"use strict";
/**
 * MQTT Health Check — WHITE Engine (fixed v2)
 * - silence timeout: 60 min (رُفع من 45 → أقل تدخلاً)
 * - قبل إعادة الدخول الكامل: يتحقق من صلاحية الجلسة عبر getUserInfo
 * - يحاول soft restart أولاً (3 مرات) قبل اللجوء لإعادة الدخول
 * - لا يُعيد الدخول إلا إذا ثبت انتهاء الجلسة فعلاً
 */

let healthTimer    = null;
let restartCount   = 0;
let backoffMs      = 0;
let lastSuccessTime = Date.now();

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getConfig() {
  const cfg = global.config?.mqttHealthCheck || {};
  return {
    enable:             cfg.enable !== false,
    // 60 دقيقة — لا نتدخل إلا إذا صمت فعلاً مدة طويلة
    silentTimeoutMs:    (cfg.silentTimeoutMinutes    || 60) * 60_000,
    checkIntervalMinMs: (cfg.checkIntervalMinMinutes || 18) * 60_000,
    checkIntervalMaxMs: (cfg.checkIntervalMaxMinutes || 28) * 60_000,
    maxRestarts:        cfg.maxRestarts     || 4,
    backoffMultiplier:  cfg.backoffMultiplier || 2,
    maxBackoffMs:       (cfg.maxBackoffMinutes || 30) * 60_000,
  };
}

function notifyOwner(msg) {
  try {
    const api   = global.api;
    const owner = String(global.ownerID || "");
    if (!api || !owner) return;
    api.sendMessage(msg, owner, () => {});
  } catch (_) {}
}

// ─── تحقق من صلاحية الجلسة قبل اتخاذ قرار إعادة الدخول ─────────────────────
async function isSessionAlive() {
  const api = global.api;
  if (!api) return false;
  const uid = String(api.getCurrentUserID() || "");
  if (!uid) return false;

  return new Promise((resolve) => {
    try {
      api.getUserInfo([uid], (err, data) => {
        if (!err && data) {
          // الجلسة حية — حدّث الطوابع الزمنية
          global._lastActivity     = Date.now();
          global._lastMqttActivity = Date.now();
          resolve(true);
        } else {
          const msg = String(err?.error || err?.message || err || "");
          const isAuth = msg.toLowerCase().includes("login") ||
                         msg.toLowerCase().includes("session") ||
                         msg.toLowerCase().includes("auth") ||
                         msg.toLowerCase().includes("checkpoint") ||
                         msg.toLowerCase().includes("logged");
          // إذا كان خطأ auth → الجلسة منتهية | إذا شبكي → نعتبرها حية
          resolve(!isAuth);
        }
      });
    } catch (_) { resolve(false); }
    // timeout 15s إذا لم يرد FCA
    setTimeout(() => resolve(null), 15000);
  });
}

async function doHealthCheck() {
  const cfg = getConfig();
  if (!cfg.enable) return scheduleNext();
  const api = global.api;
  if (!api) return scheduleNext();

  const lastActivity = global._lastMqttActivity || Date.now();
  const silentFor    = Date.now() - lastActivity;

  // لم يمضِ وقت كافٍ → لا داعي للتدخل
  if (silentFor < cfg.silentTimeoutMs) {
    if (restartCount > 0) { restartCount = 0; backoffMs = 0; lastSuccessTime = Date.now(); }
    return scheduleNext();
  }

  if (restartCount >= cfg.maxRestarts) {
    console.log(`[MQTT_HEALTH] Max restarts (${cfg.maxRestarts}) — pausing 1 hour`);
    restartCount = 0;
    backoffMs    = 0;
    global._lastMqttActivity = Date.now();
    return scheduleNext();
  }

  if (backoffMs === 0) backoffMs = randInt(20000, 50000);
  await new Promise(r => setTimeout(r, backoffMs));

  restartCount++;
  const silentMin = Math.round(silentFor / 60000);
  console.log(`[MQTT_HEALTH] Silent ${silentMin} min — attempt ${restartCount}/${cfg.maxRestarts}`);

  // ── محاولة 1 و 2 و 3: تحقق من الجلسة أولاً ─────────────────────────────────
  if (restartCount <= 3) {
    console.log(`[MQTT_HEALTH] Checking session validity before action…`);
    const alive = await isSessionAlive();

    if (alive === true) {
      // الجلسة حية — فقط الـ listener صامت، أعده
      console.log(`[MQTT_HEALTH] Session alive ✔ — doing soft listener restart`);
      global._lastMqttActivity = Date.now();
      try {
        if (typeof global.restartListener === "function") await global.restartListener();
      } catch (e) {
        console.log(`[MQTT_HEALTH] Soft restart error: ${e?.message || e}`);
      }
    } else if (alive === null) {
      // timeout — شبكة بطيئة، حدّث الطابع فقط
      console.log(`[MQTT_HEALTH] Session check timeout — assuming alive, updating timestamp`);
      global._lastMqttActivity = Date.now();
    } else {
      // الجلسة منتهية فعلاً
      console.log(`[MQTT_HEALTH] Session expired — escalating to re-login`);
      restartCount = cfg.maxRestarts; // اقفز مباشرة لإعادة الدخول
    }
  }

  // ── المحاولة الأخيرة: إعادة تسجيل الدخول الكامل ─────────────────────────────
  if (restartCount >= cfg.maxRestarts) {
    console.log(`[MQTT_HEALTH] Full re-login…`);
    notifyOwner(`⚠️ البوت: إعادة الاتصال بعد ${silentMin} دقيقة انقطاع…`);
    try {
      const reLogin = global.reLoginBot || global._reLoginBot;
      if (typeof reLogin === "function") {
        global._lastMqttActivity = Date.now();
        await reLogin();
        restartCount = 0;
        backoffMs    = 0;
      }
    } catch (e) {
      console.log(`[MQTT_HEALTH] Re-login error: ${e?.message || e}`);
    }
  }

  backoffMs = Math.min(backoffMs * cfg.backoffMultiplier, cfg.maxBackoffMs);
  scheduleNext();
}

function scheduleNext() {
  if (healthTimer) clearTimeout(healthTimer);
  const cfg = getConfig();
  if (!cfg.enable) return;
  const delay = randInt(cfg.checkIntervalMinMs, cfg.checkIntervalMaxMs);
  healthTimer = setTimeout(doHealthCheck, delay);
}

function startHealthCheck() {
  if (healthTimer) clearTimeout(healthTimer);
  restartCount = 0; backoffMs = 0;
  lastSuccessTime = global._lastMqttActivity = Date.now();
  const cfg = getConfig();
  if (!cfg.enable) return;
  console.log(`[MQTT_HEALTH] Started — silence timeout: ${cfg.silentTimeoutMs / 60000} min, check every ${cfg.checkIntervalMinMs / 60000}–${cfg.checkIntervalMaxMs / 60000} min`);
  scheduleNext();
}

function stopHealthCheck() {
  if (healthTimer) clearTimeout(healthTimer);
  healthTimer = null;
}

function onMqttActivity() {
  const now = Date.now();
  global._lastMqttActivity = now;
  if (restartCount > 0 && (now - lastSuccessTime) > 5 * 60_000) {
    restartCount = 0; backoffMs = 0; lastSuccessTime = now;
  }
}

module.exports = { startHealthCheck, stopHealthCheck, onMqttActivity };
