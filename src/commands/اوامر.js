"use strict";

module.exports = {
  config: {
    name: "اوامر",
    aliases: ["help", "cmds"],
    description: "عرض قائمة جميع الأوامر المتاحة",
    usage: "اوامر  |  اوامر [اسم الأمر]",
    adminOnly: true,
    ownerOnly: false,
    category: "general",
  },

  async run({ api, event, args, threadID }) {
    const commands = global.commands;
    const prefix   = global.commandPrefix || "/";
    const sep      = " "; // مسافة بين البريفكس والأمر

    // ── تفاصيل أمر واحد ─────────────────────────────────────────────────────
    if (args[0]) {
      const target = args[0].toLowerCase().trim();
      const cmd    = commands.get(target);
      if (!cmd)
        return api.sendMessage(`❌ الأمر "${target}" غير موجود.`, threadID);

      return api.sendMessage(
        `┌─────────────────────────┐\n` +
        `│     📌 تفاصيل الأمر     │\n` +
        `└─────────────────────────┘\n\n` +
        `🔹 الاسم   : ${prefix}${sep}${cmd.config.name}\n` +
        `📝 الوصف   : ${cmd.config.description || "—"}\n` +
        `⚙️ الاستخدام: ${prefix}${sep}${cmd.config.usage || cmd.config.name}\n` +
        `🔒 المستوى : ${cmd.config.ownerOnly ? "المالك فقط" : cmd.config.adminOnly !== false ? "أدمن" : "الجميع"}`,
        threadID
      );
    }

    // ── قائمة كاملة ──────────────────────────────────────────────────────────
    const seen = new Set();
    const list = [];
    let   num  = 1;

    for (const [, cmd] of commands) {
      if (seen.has(cmd.config.name)) continue;
      seen.add(cmd.config.name);
      list.push(`${num}. ${prefix}${sep}${cmd.config.name}\n   ▸ ${cmd.config.description || "—"}`);
      num++;
    }

    const header =
      `╔══════════════════════════╗\n` +
      `║    🤖  قائمة الأوامر    ║\n` +
      `╚══════════════════════════╝\n`;

    const footer =
      `\n─────────────────────────────\n` +
      `✦ المجموع : ${list.length} أمر\n` +
      `✦ للتفاصيل: ${prefix}${sep}اوامر [اسم الأمر]`;

    api.sendMessage(header + "\n" + list.join("\n\n") + footer, threadID);
  },
};
