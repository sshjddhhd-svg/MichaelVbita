"use strict";
/**
 * Keep-Alive — WHITE Engine (fixed v2)
 * لا طلبات HTTP خارجية إلى فيسبوك — يستخدم FCA API فقط
 * يحافظ على الجلسة عبر استدعاء خفيف كل 12-20 دقيقة
 * يُحدِّث _lastMqttActivity حتى عند عدم وجود رسائل
 */

let pingTimer = null;
let _failStreak = 0;
const MAX_FAIL_STREAK = 3;

function randMs(minMin, maxMin) {
  return Math.floor(Math.random() * ((maxMin - minMin) * 60_000 + 1)) + minMin * 60_000;
}

async function doPing() {
  try {
    const api = global.api;
    if (!api) return schedulePing();

    const uid = String(api.getCurrentUserID() || "");
    if (!uid) return schedulePing();

    await new Promise((resolve) => {
      try {
        api.getUserInfo([uid], (err, data) => {
          if (!err && data) {
            // الجلسة حية — حدّث الطابع الزمني
            global._lastActivity     = Date.now();
            global._lastMqttActivity = Date.now();
            _failStreak = 0;
            try { require("./mqttHealthCheck").onMqttActivity(); } catch (_) {}
            console.log("[KEEP_ALIVE] ✔ Session alive (FCA ping OK)");
          } else if (err) {
            const msg = String(err.error || err.message || err);
            _failStreak++;

            // خطأ شبكي عابر — لا يعني انتهاء الجلسة
            const isAuthErr = msg.toLowerCase().includes("login") ||
                              msg.toLowerCase().includes("session") ||
                              msg.toLowerCase().includes("auth") ||
                              msg.toLowerCase().includes("checkpoint") ||
                              msg.toLowerCase().includes("logged");

            if (isAuthErr) {
              console.log(`[KEEP_ALIVE] ⚠️ Session expired (${_failStreak}/${MAX_FAIL_STREAK}): ${msg.slice(0, 80)}`);
              // أبلغ الداشبورد فوراً
              try {
                const { getIO } = require("../dashboard/server");
                const io = getIO();
                if (io) io.emit("bot-status", { status: "error", message: "الجلسة انتهت — أعد رفع الكوكيز" });
              } catch (_) {}
              // بعد 3 فشل متتالي بسبب auth → أعد الدخول
              if (_failStreak >= MAX_FAIL_STREAK) {
                _failStreak = 0;
                console.log("[KEEP_ALIVE] 🔄 Auto re-login triggered after repeated auth failures");
                try {
                  if (typeof global.reLoginBot === "function") global.reLoginBot();
                } catch (_) {}
              }
            } else {
              // خطأ شبكي عادي — لا نُعيد الدخول، فقط نسجّل
              // حدّث الطابع لمنع health-check من الذعر
              global._lastMqttActivity = Date.now();
              try { require("./mqttHealthCheck").onMqttActivity(); } catch (_) {}
              console.log(`[KEEP_ALIVE] ⚠ Network hiccup (not auth): ${msg.slice(0, 60)}`);
            }
          }
          resolve();
        });
      } catch (_) { resolve(); }
    });
  } catch (_) {}

  schedulePing();
}

function schedulePing() {
  if (pingTimer) clearTimeout(pingTimer);
  // كل 12-20 دقيقة — قصير بما يكفي لإبقاء الجلسة حية
  pingTimer = setTimeout(doPing, randMs(12, 20));
}

function start() {
  if (pingTimer) clearTimeout(pingTimer);
  _failStreak = 0;
  console.log("[KEEP_ALIVE] Started — FCA ping every 12–20 min (no external HTTP)");
  // أول نبضة بعد 5 دقائق فقط
  pingTimer = setTimeout(doPing, randMs(5, 8));
}

function stop() {
  if (pingTimer) clearTimeout(pingTimer);
  pingTimer = null;
  _failStreak = 0;
}

module.exports = { start, stop };
