"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Polling interval ─────────────────────────────────────────────────────────
const POLL_MS = 5000; // فحص سريع احتياطي، بالإضافة إلى أحداث المجموعة
const MAX_ATTEMPTS = 5;

async function changeNicknameWithRetry(api, nickname, threadID, uid) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await new Promise((resolve, reject) =>
        api.changeNickname(nickname, threadID, uid, (error) =>
          error ? reject(error) : resolve()
        )
      );
      return true;
    } catch (_) {
      if (attempt < MAX_ATTEMPTS) await sleep(700 * attempt);
    }
  }
  return false;
}

/**
 * يستخرج الكنيات الحالية من معلومات المجموعة
 * @returns {Map<string, string>} uid → nickname
 */
function extractNicknames(info) {
  const map = new Map();
  if (!info) return map;

  // المصدر الأول: userInfo (الأكثر شيوعاً)
  if (Array.isArray(info.userInfo)) {
    for (const u of info.userInfo) {
      const uid = String(u.uid || u.userID || "");
      if (uid) map.set(uid, String(u.nickname || ""));
    }
  }

  // المصدر الثاني: customizations.nicknames
  if (info.customizations?.nicknames && typeof info.customizations.nicknames === "object") {
    for (const [uid, nick] of Object.entries(info.customizations.nicknames)) {
      map.set(String(uid), String(nick || ""));
    }
  }

  // المصدر الثالث: nicknames مباشرة
  if (info.nicknames && typeof info.nicknames === "object") {
    for (const [uid, nick] of Object.entries(info.nicknames)) {
      map.set(String(uid), String(nick || ""));
    }
  }

  return map;
}

/**
 * يبدأ حلقة polling لمراقبة كنيات المجموعة وإعادتها فوراً عند تغييرها.
 */
function startNickPoller(threadID) {
  if (!global._nickPollers)         global._nickPollers         = new Map();
  if (!global._perMemberNicknames)  global._perMemberNicknames  = new Map();
  if (!global._nickRestoring)       global._nickRestoring       = new Set();

  // أوقف الـ poller القديم
  if (global._nickPollers.has(threadID)) {
    clearInterval(global._nickPollers.get(threadID));
    global._nickPollers.delete(threadID);
  }

  const id = setInterval(async () => {
    const api = global.api;
    if (!api) return;

    const memberMap = global._perMemberNicknames?.get(threadID);
    if (!memberMap || memberMap.size === 0) {
      clearInterval(id);
      global._nickPollers?.delete(threadID);
      return;
    }

    try {
      const info = await new Promise((res, rej) =>
        api.getThreadInfo(threadID, (e, d) => (e ? rej(e) : res(d)))
      );

      const currentNicks = extractNicknames(info);

      for (const [uid, lockedNick] of memberMap.entries()) {
        const restoreKey = `${threadID}:${uid}`;
        if (global._nickRestoring?.has(restoreKey)) continue;

        const current = currentNicks.get(uid) ?? "";
        if (current === lockedNick) continue;

        // الكنية تغيَّرت → أعدها
        if (!global._nickRestoring) global._nickRestoring = new Set();
        global._nickRestoring.add(restoreKey);

        const uidRef  = uid;
        const nickRef = lockedNick;

        (async () => {
          try {
            await sleep(randInt(800, 2500));
            if (!global._perMemberNicknames?.get(threadID)?.has(uidRef)) return;
            await changeNicknameWithRetry(api, nickRef, threadID, uidRef);
          } catch (_) {}
          setTimeout(() => global._nickRestoring?.delete(restoreKey), 5000);
        })();
      }
    } catch (_) {}
  }, POLL_MS);

  global._nickPollers.set(threadID, id);
}

module.exports = {
  config: {
    name: "كنيات",
    aliases: [],
    description: "قفل كنيات أعضاء المجموعة وإعادتها تلقائياً — يحفظ تغييرات الأدمن",
    usage: "كنيات [الكنية]  |  كنيات ايقاف",
    adminOnly: true,
    ownerOnly: false,
    category: "group",
  },

  async run({ api, event, args, threadID, senderID }) {
    if (!global._perMemberNicknames)  global._perMemberNicknames  = new Map();
    if (!global._nickPollers)         global._nickPollers         = new Map();
    if (!global._nickRestoring)       global._nickRestoring       = new Set();
    // نحتفظ بـ _nicknameJobs للتوافق مع الهاندلر القديم
    if (!global._nicknameJobs)        global._nicknameJobs        = new Map();

    const sub = (args[0] || "").trim();

    // ── إيقاف القفل ──────────────────────────────────────────────────────────
    if (sub === "ايقاف") {
      if (!global._perMemberNicknames.has(threadID) || global._perMemberNicknames.get(threadID).size === 0) {
        return api.sendMessage("❌ لا يوجد قفل كنيات نشط في هذه المجموعة.", threadID);
      }
      global._perMemberNicknames.delete(threadID);
      global._nicknameJobs.delete(threadID);

      if (global._nickPollers.has(threadID)) {
        clearInterval(global._nickPollers.get(threadID));
        global._nickPollers.delete(threadID);
      }
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

    // ── إنشاء/تحديث خريطة الكنيات لكل عضو ───────────────────────────────────
    const memberMap = new Map();
    for (const uid of participants) {
      memberMap.set(uid, nickname);
    }
    global._perMemberNicknames.set(threadID, memberMap);
    // للتوافق مع الهاندلر القديم
    global._nicknameJobs.set(threadID, nickname);

    await api.sendMessage(
      `🔄 جارٍ تغيير كنيات ${participants.length} عضو إلى "${nickname}"…\n(يستغرق وقتاً لتجنب الكشف)`,
      threadID
    );

    // ── تغيير الكنيات واحدة تلو الأخرى مع إعادة المحاولة ────────────────────
    let changed = 0;
    for (const uid of participants) {
      if (!global._perMemberNicknames.has(threadID)) break;
      try {
        await sleep(randInt(300, 700));
        if (await changeNicknameWithRetry(api, nickname, threadID, uid)) changed++;
      } catch (_) {}
    }

    // تحقق إضافي من الأعضاء الذين فشلوا في المحاولة الأولى، حتى لا يبقى
    // القفل مسجلاً بينما بعض الكنيات لم تتغير فعلياً.
    for (const uid of participants) {
      if (!global._perMemberNicknames.has(threadID)) break;
      try {
        const info = await new Promise((res, rej) =>
          api.getThreadInfo(threadID, (e, d) => e ? rej(e) : res(d))
        );
        const current = extractNicknames(info).get(uid);
        if (current !== nickname && await changeNicknameWithRetry(api, nickname, threadID, uid)) {
          changed++;
        }
      } catch (_) {}
    }

    // ── تشغيل المراقبة المستمرة ─────────────────────────────────────────────
    startNickPoller(threadID);

    if (global._perMemberNicknames.has(threadID)) {
      api.sendMessage(
        `✅ تم تغيير ${changed}/${participants.length} كنية إلى "${nickname}".\n\n` +
        `🔒 الكنيات مقفلة — ستُعاد تلقائياً إذا غيّرها أي شخص.\n` +
        `🚫 أي تغيير من أي شخص سيُعاد تلقائياً إلى الكنية المقفلة.\n` +
        `لإيقاف القفل: كنيات ايقاف`,
        threadID
      );
    }
  },
};

module.exports.startNickPoller   = startNickPoller;
module.exports.extractNicknames  = extractNicknames;
