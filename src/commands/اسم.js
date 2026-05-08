"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Polling interval ─────────────────────────────────────────────────────────
const POLL_MS = 15000; // فحص اسم المجموعة كل 15 ثانية

/**
 * يبدأ حلقة polling لمراقبة اسم المجموعة وإعادته فوراً عند تغييره.
 * يستخدم global.api دائماً لمواجهة hot-swap.
 */
function startNamePoller(threadID) {
  if (!global._namePollers)   global._namePollers   = new Map();
  if (!global._lockedNames)   global._lockedNames   = new Map();
  if (!global._nameRestoring) global._nameRestoring = new Set();

  // أوقف الـ poller القديم إن وُجد
  if (global._namePollers.has(threadID)) {
    clearInterval(global._namePollers.get(threadID));
    global._namePollers.delete(threadID);
  }

  const id = setInterval(async () => {
    const api = global.api;
    if (!api) return; // البوت غير متصل

    // القفل أُلغي → أوقف الـ poller
    if (!global._lockedNames?.has(threadID)) {
      clearInterval(id);
      global._namePollers?.delete(threadID);
      return;
    }

    // عملية إعادة جارية → تخطَّ هذه الدورة
    if (global._nameRestoring?.has(threadID)) return;

    const locked = global._lockedNames.get(threadID);
    if (!locked) return;

    try {
      const info = await new Promise((res, rej) =>
        api.getThreadInfo(threadID, (e, d) => (e ? rej(e) : res(d)))
      );

      const current = String(info?.threadName || "").trim();
      if (current === locked) return; // الاسم صحيح

      // الاسم تغيَّر → أعده فوراً
      global._nameRestoring.add(threadID);
      try {
        await sleep(randInt(1000, 2500));
        if (!global._lockedNames?.has(threadID)) return;
        try { api.sendTypingIndicator(threadID); } catch (_) {}
        await sleep(randInt(600, 1400));
        await new Promise((res, rej) =>
          api.setTitle(locked, threadID, (e) => (e ? rej(e) : res()))
        );
      } catch (_) {}
      setTimeout(() => global._nameRestoring?.delete(threadID), 6000);

    } catch (_) {}
  }, POLL_MS);

  global._namePollers.set(threadID, id);
}

module.exports = {
  config: {
    name: "اسم",
    aliases: [],
    description: "قفل اسم المجموعة وإعادته تلقائياً عند تغييره",
    usage: "اسم [الاسم الجديد]  |  اسم ايقاف",
    adminOnly: true,
    ownerOnly: false,
    category: "group",
  },

  async run({ api, event, args, threadID }) {
    if (!global._lockedNames)   global._lockedNames   = new Map();
    if (!global._namePollers)   global._namePollers   = new Map();
    if (!global._nameRestoring) global._nameRestoring = new Set();

    const sub = (args[0] || "").trim();

    // ── إيقاف القفل ──────────────────────────────────────────────────────────
    if (sub === "ايقاف") {
      if (!global._lockedNames.has(threadID)) {
        return api.sendMessage("❌ لا يوجد قفل اسم نشط في هذه المجموعة.", threadID);
      }
      global._lockedNames.delete(threadID);
      global._nameRestoring.delete(threadID);
      if (global._namePollers.has(threadID)) {
        clearInterval(global._namePollers.get(threadID));
        global._namePollers.delete(threadID);
      }
      return api.sendMessage("✅ تم إيقاف قفل اسم المجموعة.", threadID);
    }

    // ── التحقق من الاسم ───────────────────────────────────────────────────────
    const newName = args.join(" ").trim();
    if (!newName) {
      return api.sendMessage(
        "⚠️ حدد الاسم:\n• اسم [الاسم] — قفل الاسم\n• اسم ايقاف — إيقاف القفل",
        threadID
      );
    }

    // محاكاة سلوك بشري قبل التغيير
    try { api.sendTypingIndicator(threadID); } catch (_) {}
    await sleep(randInt(1200, 3000));

    // تغيير اسم المجموعة
    try {
      await new Promise((res, rej) =>
        api.setTitle(newName, threadID, (e) => (e ? rej(e) : res()))
      );
    } catch (e) {
      return api.sendMessage(`❌ فشل تغيير الاسم: ${e.message || e}`, threadID);
    }

    // حفظ القفل + بدء المراقبة المزدوجة
    global._lockedNames.set(threadID, newName);
    startNamePoller(threadID);

    api.sendMessage(
      `✅ تم تغيير اسم المجموعة إلى:\n"${newName}"\n\n🔒 الاسم مقفل — سيُعاد تلقائياً عند أي تغيير.\nلإيقاف القفل: اسم ايقاف`,
      threadID
    );
  },
};

// تصدير startNamePoller لإعادة الاستخدام بعد hot-swap
module.exports.startNamePoller = startNamePoller;
