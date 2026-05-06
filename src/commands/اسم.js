"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
    if (!global._lockedNames)    global._lockedNames    = new Map();
    if (!global._nameRestoring) global._nameRestoring  = new Set();

    const sub = (args[0] || "").trim();

    // ── إيقاف القفل ──────────────────────────────────────────────────────────
    if (sub === "ايقاف") {
      if (!global._lockedNames.has(threadID)) {
        return api.sendMessage("❌ لا يوجد قفل اسم نشط في هذه المجموعة.", threadID);
      }
      global._lockedNames.delete(threadID);
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

    // ── محاكاة سلوك بشري قبل التغيير ─────────────────────────────────────────
    try { api.sendTypingIndicator(threadID); } catch (_) {}
    await sleep(randInt(1200, 3000));

    // ── تغيير اسم المجموعة ────────────────────────────────────────────────────
    try {
      await new Promise((res, rej) =>
        api.setTitle(newName, threadID, (e) => (e ? rej(e) : res()))
      );
    } catch (e) {
      return api.sendMessage(`❌ فشل تغيير الاسم: ${e.message || e}`, threadID);
    }

    // ── حفظ القفل ────────────────────────────────────────────────────────────
    global._lockedNames.set(threadID, newName);

    api.sendMessage(
      `✅ تم تغيير اسم المجموعة إلى:\n"${newName}"\n\n🔒 الاسم مقفل — سيُعاد تلقائياً عند أي تغيير.\nلإيقاف القفل: اسم ايقاف`,
      threadID
    );
  },
};
