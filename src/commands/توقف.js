
"use strict";

module.exports = {
  config: {
    name: "توقف",
    aliases: [],
    description: "إيقاف الإرسال التلقائي في هذه المحادثة",
    usage: "توقف",
    adminOnly: false,
    ownerOnly: false,
    category: "auto",
  },

  async run({ api, threadID }) {
    // دراكاريس يحفظ المؤقتات في هذه الخريطة. كان الأمر يبحث في
    // _michaelAutoJobs، لذلك كان يرفض الإيقاف رغم أن الإرسال فعال.
    const jobs = global._dracarysAutoJobs;
    if (!jobs || !jobs.has(threadID)) {
      return api.sendMessage(
        "❌ لا يوجد إرسال تلقائي نشط في هذه المحادثة.",
        threadID
      );
    }

    const t = jobs.get(threadID);
    clearTimeout(t);
    jobs.delete(threadID);

    await api.sendMessage("⛔ تم إيقاف الإرسال التلقائي في هذه المحادثة.", threadID);
  },
};
