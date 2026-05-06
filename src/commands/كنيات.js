"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  config: {
    name: "كنيات",
    aliases: [],
    description: "قفل كنيات جميع أعضاء المجموعة وإعادتها تلقائياً",
    usage: "كنيات [الكنية]  |  كنيات ايقاف",
    adminOnly: true,
    ownerOnly: false,
    category: "group",
  },

  async run({ api, event, args, threadID, senderID }) {
    if (!global._nicknameJobs)  global._nicknameJobs  = new Map();
    if (!global._nickRestoring) global._nickRestoring = new Set();

    const sub = (args[0] || "").trim();

    // ── إيقاف القفل ──────────────────────────────────────────────────────────
    if (sub === "ايقاف") {
      if (!global._nicknameJobs.has(threadID)) {
        return api.sendMessage("❌ لا يوجد قفل كنيات نشط في هذه المجموعة.", threadID);
      }
      global._nicknameJobs.delete(threadID);
      return api.sendMessage("✅ تم إيقاف قفل الكنيات. يمكن للجميع تغيير كنياتهم الآن.", threadID);
    }

    // ── التحقق من الكنية ──────────────────────────────────────────────────────
    const nickname = args.join(" ").trim();
    if (!nickname) {
      return api.sendMessage(
        "⚠️ حدد الكنية:\n• كنيات [الكنية] — قفل الكنيات\n• كنيات ايقاف — إيقاف القفل",
        threadID
      );
    }

    // ── جلب معلومات المجموعة ──────────────────────────────────────────────────
    let threadInfo;
    try {
      threadInfo = await new Promise((res, rej) =>
        api.getThreadInfo(threadID, (e, d) => (e ? rej(e) : res(d)))
      );
    } catch (e) {
      return api.sendMessage(`❌ فشل جلب بيانات المجموعة: ${e.message || e}`, threadID);
    }

    const participants = (threadInfo?.participantIDs || []).map(String);
    if (!participants.length) {
      return api.sendMessage("❌ تعذّر جلب قائمة الأعضاء.", threadID);
    }

    // ── تفعيل القفل فوراً ────────────────────────────────────────────────────
    global._nicknameJobs.set(threadID, nickname);

    await api.sendMessage(
      `🔄 جارٍ تغيير كنيات ${participants.length} عضو إلى "${nickname}"…\n(يستغرق وقتاً لتجنب الكشف)`,
      threadID
    );

    // ── تغيير الكنيات واحدة تلو الأخرى بتأخير عشوائي بشري ──────────────────
    let changed = 0;
    for (const uid of participants) {
      if (!global._nicknameJobs.has(threadID)) break; // أُوقف القفل أثناء التغيير

      try {
        await sleep(randInt(600, 1800));
        await new Promise((res, rej) =>
          api.changeNickname(nickname, threadID, uid, (e) => (e ? rej(e) : res()))
        );
        changed++;
      } catch (_) {}
    }

    if (global._nicknameJobs.has(threadID)) {
      api.sendMessage(
        `✅ تم تغيير ${changed}/${participants.length} كنية إلى "${nickname}".\n\n🔒 الكنيات مقفلة — ستُعاد تلقائياً إذا غيّرها أي شخص.\n(الأدمنز يستطيعون تغييرها دون إعادة)\nلإيقاف القفل: كنيات ايقاف`,
        threadID
      );
    }
  },
};
