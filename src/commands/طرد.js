"use strict";

module.exports = {
  config: {
    name: "طرد",
    aliases: ["kick", "remove"],
    description: "طرد عضو من المجموعة عبر الردّ على رسالته",
    usage: "طرد  (ردّ على رسالة العضو)",
    adminOnly: true,
    ownerOnly: false,
    category: "group",
  },

  async run({ api, event, threadID }) {
    const reply = event.messageReply;

    if (!reply) {
      return api.sendMessage(
        "⚠️ ردّ على رسالة العضو الذي تريد طرده.",
        threadID
      );
    }

    const targetID = String(reply.senderID || "");
    const botID    = String(api.getCurrentUserID());

    if (!targetID) {
      return api.sendMessage("❌ تعذّر تحديد هوية العضو.", threadID);
    }

    if (targetID === botID) {
      return api.sendMessage("❌ لا أستطيع طرد نفسي.", threadID);
    }

    // منع طرد الأدمنز
    if (global.isAdmin && global.isAdmin(targetID)) {
      return api.sendMessage("❌ لا يمكن طرد أدمن البوت.", threadID);
    }

    try {
      await new Promise((res, rej) =>
        api.removeUserFromGroup(targetID, threadID, (e) => (e ? rej(e) : res()))
      );
    } catch (e) {
      return api.sendMessage(
        `❌ فشل الطرد: ${e?.message || e}\n(تأكد أن البوت أدمن في المجموعة)`,
        threadID
      );
    }
  },
};
