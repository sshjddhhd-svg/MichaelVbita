"use strict";
/**
 * MQTT Health Check — WHITE Engine (V1 original)
 * - silence timeout: 45 min — صمت المجموعة طبيعي
 * - يحاول إعادة تشغيل الـ listener فقط أولاً (بدون re-login)
 * - يلجأ لـ reLoginBot فقط كآخر خيار
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
    // 45 دقيقة — الصمت الطبيعي للمجموعة لا يعني موت الاتصال
    silentTimeoutMs:    (cfg.silentTimeoutMinutes    || 45) * 60_000,
    checkIntervalMinMs: (cfg.checkIntervalMinMinutes || 15) * 60_000,
    checkIntervalMaxMs: (cfg.checkIntervalMaxMinutes || 25) * 60_000,
    maxRestarts:        cfg.maxRestarts     || 3,
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
    console.log(`[MQTT_HEALTH] Max restarts (${cfg.maxRestarts}) — giving up for this cycle`);
    // إعادة الضبط بعد ساعة والمحاولة مجدداً بدلاً من التوقف نهائياً
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

  // ── محاولة 1 و 2: إعادة تشغيل الـ listener بدون re-login ──────────────────
  if (restartCount <= 2) {
    console.log(`[MQTT_HEALTH] Trying soft restart (listener only)…`);
    try {
      if (typeof global.restartListener === "function") {
        global._lastMqttActivity = Date.now();
        await global.restartListener();
        console.log("[MQTT_HEALTH] Soft restart done ✔");
      } else {
        global._lastMqttActivity = Date.now();
      }
    } catch (e) {
      console.log(`[MQTT_HEALTH] Soft restart error: ${e?.message || e}`);
    }
  } else {
    // ── محاولة 3 (أخيرة): إعادة تسجيل الدخول الكامل ────────────────────────
    console.log(`[MQTT_HEALTH] Trying full re-login…`);
    notifyOwner(`⚠️ البوت: جاري إعادة الاتصال بعد ${silentMin} دقيقة انقطاع…`);
    try {
      const reLogin = global.reLoginBot || global._reLoginBot;
      if (typeof reLogin === "function") {
        global._lastMqttActivity = Date.now();
        await reLogin();
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
