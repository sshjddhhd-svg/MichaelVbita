"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

module.exports = {
  config: {
    name: "احذف",
    aliases: ["unsend", "del"],
    description: "حذف رسالة مُردّ عليها، أو حذف عدد من آخر الرسائل",
    usage: "احذف  (ردّ على رسالة)  |  احذف [عدد]",
    adminOnly: true,
    ownerOnly: false,
    category: "admin",
  },

  async run({ api, event, args, threadID }) {
    const count = parseInt(args[0], 10);

    // ── وضع الردّ: حذف رسالة واحدة مُحدَّدة ──────────────────────────────────
    if (!count || isNaN(count)) {
      const reply = event.messageReply;
      if (!reply)
        return api.sendMessage(
          "⚠️ ردّ على الرسالة التي تريد حذفها، أو اكتب:\n احذف [عدد] — لحذف آخر N رسالة",
          threadID
        );

      try {
        await api.unsendMessage(reply.messageID);
      } catch (e) {
        api.sendMessage(`❌ فشل الحذف: ${e.message || e}`, threadID);
      }
      return;
    }

    // ── وضع الكمية: حذف آخر N رسالة بطريقة بشرية ──────────────────────────
    const limit = Math.min(Math.max(count, 1), 50); // حد أقصى 50

    let history;
    try {
      history = await new Promise((res, rej) =>
        api.getThreadHistory(threadID, limit + 5, undefined, (e, d) => (e ? rej(e) : res(d)))
      );
    } catch (e) {
      return api.sendMessage(`❌ فشل جلب سجل الرسائل: ${e.message || e}`, threadID);
    }

    if (!history || !history.length)
      return api.sendMessage("❌ لا توجد رسائل لحذفها.", threadID);

    // استبعاد رسالة الأمر الحالية نفسها
    const msgs = history
      .filter((m) => m.messageID !== event.messageID)
      .slice(-limit)
      .reverse(); // الأحدث أولاً

    if (!msgs.length)
      return api.sendMessage("❌ لا توجد رسائل كافية لحذفها.", threadID);

    let deleted = 0;
    for (const msg of msgs) {
      // تأخير عشوائي بشري بين كل حذف (0.8s - 2.2s)
      await sleep(randInt(800, 2200));
      try {
        await api.unsendMessage(msg.messageID);
        deleted++;
      } catch (_) {
        // تجاوز الرسائل التي لا يمكن حذفها (رسائل الآخرين)
      }

      // توقف قصير إضافي كل 5 رسائل لتجنب الكشف
      if (deleted > 0 && deleted % 5 === 0) {
        await sleep(randInt(2000, 4000));
      }
    }

    if (deleted === 0) {
      api.sendMessage("⚠️ لم أتمكن من حذف أي رسالة.\n(البوت يستطيع حذف رسائله فقط في الغالب)", threadID);
    }
  },
};
