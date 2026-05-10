"use strict";
/**
 * Keep-Alive — WHITE Engine (V1 original)
 * لا طلبات HTTP خارجية إلى فيسبوك — يستخدم FCA API فقط
 * يحافظ على الجلسة عبر استدعاء خفيف عبر القناة الموجودة
 */

let pingTimer = null;

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
        // getUserInfo استدعاء خفيف جداً لا يُثير الشكوك
        api.getUserInfo([uid], (err, data) => {
          if (!err && data) {
            global._lastMqttActivity = Date.now();
            console.log("[KEEP_ALIVE] ✔ Session alive (FCA ping OK)");
          } else if (err) {
            const msg = String(err.error || err.message || err);
            if (msg.includes("login") || msg.includes("session") || msg.includes("auth")) {
              console.log("[KEEP_ALIVE] ⚠️ Session may have expired:", msg);
              try {
                const { getIO } = require("../dashboard/server");
                const io = getIO();
                if (io) io.emit("bot-status", { status: "error", message: "الجلسة انتهت — أعد رفع الكوكيز" });
              } catch (_) {}
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
  // كل 35-55 دقيقة — بدون أي HTTP مستقل لفيسبوك
  pingTimer = setTimeout(doPing, randMs(35, 55));
}

function start() {
  if (pingTimer) clearTimeout(pingTimer);
  console.log("[KEEP_ALIVE] Started — FCA ping every 35–55 min (no external HTTP)");
  schedulePing();
}

function stop() {
  if (pingTimer) clearTimeout(pingTimer);
  pingTimer = null;
}

module.exports = { start, stop };
