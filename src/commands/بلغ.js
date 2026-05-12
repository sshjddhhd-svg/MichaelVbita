"use strict";
/**
 * أمر البلاغات — نظام تحليل المحتوى وفق قوانين مجتمع فيسبوك
 * الاستخدام: ميكائيل بلغ  (ردّ على رسالة الشخص المستهدف)
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ══════════════════════════════════════════════════════════════════════════════
// قاعدة بيانات قوانين مجتمع فيسبوك — Facebook Community Standards
// المصدر: https://transparency.meta.com/policies/community-standards/
// ══════════════════════════════════════════════════════════════════════════════
const FB_RULES = [

  // ──────────────── 1. خطاب الكراهية / Hate Speech ────────────────────────
  {
    id: "HATE_SPEECH",
    category: "خطاب الكراهية",
    severity: "HIGH",
    reportType: "خطاب كراهية",
    description: "محتوى يهاجم أشخاصاً بسبب العرق أو الدين أو الجنس أو الجنسية",
    patterns: [
      /قر(د|ود|ده)|خنز(ير|ير|يرة)|كلب\s*(ابن|يا|وسخ)/i,
      /يهود\s*(ازبال|خنازير|قتل|ابادة)/i,
      /مسلم(ين|ون)\s*(ارهاب|قتل|ابادة|حرق)/i,
      /عرب\s*(قذر|خنازير|حيوان|نجس)/i,
      /اقتل\s*(ال|كل)\s*(يهود|مسلم|مسيحي|عرب|عجم)/i,
      /ازيل\s*(العرق|الجنس|الدين)/i,
      /احتقر\s*(الدين|العرق|الجنس)/i,
      /(نساء|المرأة)\s*(اقل|ادنى|عاهر|شرموط)/i,
      /شرموط[ةه]|عاهر[ةه]|قحب[ةه]/i,
      /(زنج|زنجي|كافر|ملعون)\s*(يستحق|يجب|اقتل)/i,
      /الله\s*(يلعن|يخزي)\s*(الدين|الرب|الاسلام|المسيح)/i,
    ],
  },

  // ──────────────── 2. التنمر والمضايقة / Bullying & Harassment ─────────────
  {
    id: "BULLYING",
    category: "تنمر ومضايقة",
    severity: "HIGH",
    reportType: "تنمر أو مضايقة",
    description: "مهاجمة شخص معين أو تهديده أو إذلاله بشكل متكرر",
    patterns: [
      /انت\s*(بكل\s*)?(حقير|تافه|زباله|قمامة|نجس|وسخ|مثلي|خول|شاذ)/i,
      /(سأ|سو|راح|هـ)(قتل|ضرب|أذي|هاجم)\s*ك/i,
      /يجب\s*(إيذاء|ضرب|قتل|تدمير)\s*(ك|ه|ها|هم)/i,
      /روح\s*(انتحر|اموت|تشنق)/i,
      /العالم\s*(افضل|احسن)\s*(بدون|من غير)\s*ك/i,
      /تستاهل\s*(تموت|تنتحر|تتعذب)/i,
      /اكشف\s*(سرك|معلوماتك|بياناتك)/i,
      /(كشفت|كاشف|سأكشف)\s*(سرك|عنوانك|معلوماتك)/i,
      /هاجمو(ا|ه)\s*(على|في)\s*(بيته|عمله|مدرسته)/i,
    ],
  },

  // ──────────────── 3. المحتوى الجنسي / Sexual Content ────────────────────
  {
    id: "SEXUAL_CONTENT",
    category: "محتوى جنسي",
    severity: "CRITICAL",
    reportType: "محتوى جنسي أو إباحي",
    description: "محتوى جنسي صريح أو إباحي أو استغلال جنسي",
    patterns: [
      /porn|xxx|sex\s*tape|nude|نيك|جماع|شهوة\s*جنسية/i,
      /ارسل\s*(صور|فيديو)\s*(عارية|اباحية|جنسية)/i,
      /ابيع\s*(صور|فيديوهات)\s*(بنات|نساء|بنوت)/i,
      /صور\s*(اباحية|جنسية|عارية)\s*(للبيع|مجانا)/i,
      /(قضيب|عضو\s*ذكري|فرج)\s*(صور|فيديو|ارسل)/i,
      /تبادل\s*صور\s*(جنسية|اباحية)/i,
      /مجموعة\s*(اباحية|جنسية|للكبار)/i,
      /onlyfans|فانز\s*اون\s*لي/i,
    ],
  },

  // ──────────────── 4. العنف والتهديد / Violence & Threats ─────────────────
  {
    id: "VIOLENCE",
    category: "عنف وتهديدات",
    severity: "CRITICAL",
    reportType: "عنف أو تهديد",
    description: "تهديدات بالعنف الجسدي أو تمجيد أعمال العنف",
    patterns: [
      /(سأ|سو|راح\s*أ)(قتل|اذبح|أطعن|أضرب)\s*(ك|ه|ها|هم|كم)/i,
      /سوف\s*(أقتل|أنهي|أدمر)\s*(ك|حياتك)/i,
      /سترى\s*(دمك|النهاية|ما\s*يحدث)/i,
      /قنبلة|متفجرات|سلاح\s*(ابيع|اشتري|عندي)/i,
      /(شاهد|انظر)\s*كيف\s*(اقتل|اذبح|ادمر)/i,
      /اطعن(ه|ها|هم)|ذبح(ه|ها|هم)|مزق(ه|ها|هم)/i,
      /ارهاب|تفجير|هجوم\s*(مسلح|انتحاري)/i,
      /داعش|القاعدة|بوكوحرام|طالبان\s*(احييهم|انصرهم|معهم)/i,
    ],
  },

  // ──────────────── 5. الانتحار وإيذاء النفس / Suicide & Self-Harm ─────────
  {
    id: "SELF_HARM",
    category: "انتحار وإيذاء النفس",
    severity: "CRITICAL",
    reportType: "انتحار أو إيذاء نفس",
    description: "محتوى يشجع أو يروج للانتحار أو إيذاء النفس",
    patterns: [
      /كيف\s*(أنتحر|انتحر|تنتحر)\s*(بسهولة|بدون\s*ألم|بطريقة)/i,
      /أفضل\s*طريقة\s*للانتحار/i,
      /انتحر\s*(معي|معنا|الآن)/i,
      /جرب\s*(الانتحار|قطع\s*الأوردة|البلع\s*الحبوب)/i,
      /قطع\s*(الأوردة|الشريان)\s*(طريقة|كيف)/i,
    ],
  },

  // ──────────────── 6. الاحتيال والنصب / Scam & Fraud ────────────────────
  {
    id: "SCAM",
    category: "احتيال ونصب",
    severity: "MEDIUM",
    reportType: "احتيال أو نصب",
    description: "عمليات احتيال أو نصب أو انتحال شخصية",
    patterns: [
      /ارسل\s*(مبلغ|فلوس|مال|دولار)\s*(وسترد|وراح\s*ترجع|وتكسب)\s*\d*\s*(ضعف|مرة)/i,
      /(ربح|فزت|اخترناك)\s*(مليون|الف|جائزة|هدية)\s*(ارسل|ادفع)/i,
      /(ادفع|ارسل)\s*(رسوم|ضريبة|عمولة)\s*(لاستلام\s*الجائزة|لتفعيل)/i,
      /حسابك\s*(مخترق|معطل|موقوف)\s*(ارسل\s*بياناتك|ادخل\s*معلوماتك)/i,
      /كلمة\s*(سر|مرور|السر)\s*(ارسل|اعطني|شاركني)/i,
      /(بنك|paypal|moneygram|western\s*union)\s*(ارسل|حول|اضغط\s*الرابط)/i,
      /استثمار\s*مضمون\s*(ربح|عائد)\s*\d+\s*%/i,
      /(تسجيل\s*دخول|login)\s*(فيسبوك|حسابك)\s*(هنا|اضغط)/i,
    ],
  },

  // ──────────────── 7. الخصوصية / Privacy Violation ────────────────────────
  {
    id: "PRIVACY",
    category: "انتهاك الخصوصية",
    severity: "HIGH",
    reportType: "انتهاك الخصوصية",
    description: "نشر معلومات شخصية أو بيانات خاصة بدون إذن",
    patterns: [
      /عنوان(ه|ها|ك)\s*(هو|في)\s*\S+/i,
      /رقم\s*(هاتف|تليفون|جوال|موبايل)(ه|ها|ك)\s*[:هو]\s*\d{7,}/i,
      /(كشف|كشفت|سأكشف)\s*(هويت|بيانات|معلومات|عنوان)\s*(ك|ه|ها)/i,
      /دوكس|dox(ing)?/i,
      /(صور|فيديو)\s*(خاصة|سرية|منزلية)\s*(نشر|توزيع|ارسل)/i,
      /ايبي|ip\s*(عنوان|address)\s*(ك|ه|ها)\s*[:هو]/i,
    ],
  },

  // ──────────────── 8. الإرهاب والتطرف / Terrorism ────────────────────────
  {
    id: "TERRORISM",
    category: "إرهاب وتطرف",
    severity: "CRITICAL",
    reportType: "إرهاب أو تطرف",
    description: "محتوى يروج للإرهاب أو المنظمات الإرهابية",
    patterns: [
      /(انضم|انتسب|بيعة)\s*(داعش|القاعدة|الدولة\s*الاسلامية|بوكوحرام)/i,
      /(جهاد|قتال)\s*(ضد|على)\s*(المسلمين|المسيحيين|الكفار|اليهود)/i,
      /عملية\s*انتحارية\s*(خطة|تنفيذ|تنظيم)/i,
      /تجنيد\s*(مقاتلين|اعضاء)\s*(لداعش|للقاعدة|للتنظيم)/i,
      /(تمويل|دعم)\s*(الإرهاب|التنظيم\s*الإرهابي)/i,
    ],
  },

  // ──────────────── 9. السبام والمحتوى المضلل / Spam & Misinformation ──────
  {
    id: "SPAM",
    category: "سبام ومحتوى مضلل",
    severity: "LOW",
    reportType: "سبام أو محتوى مضلل",
    description: "رسائل متكررة أو روابط مشبوهة أو معلومات مضللة",
    patterns: [
      /(اضغط|زور|انقر)\s*(الرابط|الموقع|الصفحة)\s*(لربح|للفوز|للحصول)/i,
      /شارك\s*(هذه\s*الرسالة|المنشور)\s*(مع|في)\s*\d+\s*(شخص|مجموعة)/i,
      /وإلا\s*(سيحدث|ستتعرض|ستفشل)\s*(لك|في\s*حياتك)/i,
      /رسالة\s*(عاجلة|مهمة\s*جداً)\s*(انتشر|شارك)\s*(الآن|فوراً)/i,
      /فيسبوك\s*(سيغلق|سيحذف|سيوقف)\s*(حسابك|الخدمة)/i,
    ],
  },

  // ──────────────── 10. استغلال الأطفال / Child Exploitation ──────────────
  {
    id: "CHILD_EXPLOITATION",
    category: "استغلال الأطفال",
    severity: "CRITICAL",
    reportType: "استغلال الأطفال",
    description: "أي محتوى يستغل أو يؤذي الأطفال",
    patterns: [
      /صور\s*(أطفال|طفل|قاصر)\s*(جنسية|عارية|اباحية)/i,
      /(طفل|قاصر)\s*(جنس|نيك|استغلال)/i,
      /csam|child\s*(porn|sex|nude)/i,
      /(تعارف|علاقة)\s*(مع\s*طفل|مع\s*قاصر|مع\s*اطفال)/i,
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// دالة تحليل الرسالة
// ══════════════════════════════════════════════════════════════════════════════
function analyzeMessage(text) {
  if (!text || typeof text !== "string" || text.trim().length < 3) return [];

  const violations = [];
  for (const rule of FB_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        violations.push({
          ruleId:      rule.id,
          category:    rule.category,
          severity:    rule.severity,
          reportType:  rule.reportType,
          description: rule.description,
        });
        break; // كافٍ لنفس الفئة
      }
    }
  }
  return violations;
}

// ══════════════════════════════════════════════════════════════════════════════
// الحصول على سجل رسائل شخص معين من الـ thread
// ══════════════════════════════════════════════════════════════════════════════
async function getUserMessages(api, threadID, targetUID, maxFetch = 200) {
  const messages = [];
  let timestamp = null;
  const batchSize = 50;
  const maxBatches = Math.ceil(maxFetch / batchSize);

  for (let i = 0; i < maxBatches; i++) {
    let batch;
    try {
      batch = await new Promise((res, rej) =>
        api.getThreadHistory(threadID, batchSize, timestamp, (e, d) => e ? rej(e) : res(d || []))
      );
    } catch { break; }

    if (!batch.length) break;

    for (const msg of batch) {
      const sender = String(msg.senderID || msg.authorID || "");
      if (sender === targetUID && msg.body && msg.body.trim().length >= 3) {
        messages.push({ body: msg.body, messageID: msg.messageID, timestamp: msg.timestamp });
      }
    }

    // timestamp الأقدم للـ batch التالي
    const oldest = batch[0]?.timestamp;
    if (!oldest || oldest === timestamp) break;
    timestamp = oldest;

    // توقف إذا جمعنا ما يكفي
    if (messages.length >= maxFetch) break;
    await sleep(randInt(300, 700));
  }

  return messages;
}

// ══════════════════════════════════════════════════════════════════════════════
// محاولة الإبلاغ عبر FCA (إن كانت متاحة)
// ══════════════════════════════════════════════════════════════════════════════
async function tryReport(api, msgData) {
  try {
    if (typeof api.reportMessage === "function") {
      await new Promise((res, rej) =>
        api.reportMessage(msgData.messageID, (e) => e ? rej(e) : res())
      );
      return true;
    }
  } catch (_) {}

  try {
    if (typeof api.report === "function") {
      await new Promise((res, rej) =>
        api.report(msgData.messageID, (e) => e ? rej(e) : res())
      );
      return true;
    }
  } catch (_) {}

  return false; // FCA لا تدعم الإبلاغ المباشر — نسجّل فقط
}

// ══════════════════════════════════════════════════════════════════════════════
// رمز الخطورة
// ══════════════════════════════════════════════════════════════════════════════
function severityIcon(s) {
  if (s === "CRITICAL") return "🔴";
  if (s === "HIGH")     return "🟠";
  if (s === "MEDIUM")   return "🟡";
  return "🟢";
}

// ══════════════════════════════════════════════════════════════════════════════
// الأمر الرئيسي
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name: "بلغ",
    aliases: ["report", "balagh"],
    description: "مراجعة رسائل شخص والإبلاغ عن المخالفات وفق قوانين مجتمع فيسبوك",
    usage: "بلغ  (ردّ على رسالة الشخص المستهدف)",
    adminOnly: true,
    ownerOnly: false,
    category: "admin",
  },

  async run({ api, event, threadID, senderName }) {
    const reply = event.messageReply;

    // ── يجب الرد على رسالة ────────────────────────────────────────────────
    if (!reply) {
      return api.sendMessage(
        "⚠️ يجب الرد على رسالة الشخص الذي تريد الإبلاغ عنه.\n"
        + "مثال: ردّ على رسالته ثم اكتب: ميكائيل بلغ",
        threadID
      );
    }

    const targetUID  = String(reply.senderID || "");
    const botUID     = String(api.getCurrentUserID());

    if (!targetUID) return api.sendMessage("❌ تعذّر تحديد هوية الشخص.", threadID);
    if (targetUID === botUID) return api.sendMessage("❌ لا أستطيع الإبلاغ عن نفسي.", threadID);
    if (global.isAdmin && global.isAdmin(targetUID))
      return api.sendMessage("❌ لا يمكن الإبلاغ عن أدمن البوت.", threadID);

    // ── جلب اسم الهدف ─────────────────────────────────────────────────────
    let targetName = String(targetUID);
    try {
      const info = await new Promise((res, rej) =>
        api.getUserInfo([targetUID], (e, d) => e ? rej(e) : res(d || {}))
      );
      targetName = info[targetUID]?.name || targetUID;
    } catch (_) {}

    // ── رسالة بدء المراجعة ─────────────────────────────────────────────────
    await new Promise(r =>
      api.sendMessage(
        `🔍 جارٍ مراجعة رسائل ${targetName} بحثاً عن مخالفات قوانين مجتمع فيسبوك…\n`
        + "⏳ قد يستغرق ذلك بضع ثوانٍ.",
        threadID, r
      )
    );

    await sleep(1000);

    // ── جلب الرسائل ────────────────────────────────────────────────────────
    let userMessages;
    try {
      userMessages = await getUserMessages(api, threadID, targetUID, 150);
    } catch (e) {
      return api.sendMessage(`❌ فشل جلب الرسائل: ${e?.message || e}`, threadID);
    }

    if (!userMessages.length) {
      return api.sendMessage(
        `ℹ️ لم أجد أي رسائل لـ ${targetName} في هذه المحادثة.`,
        threadID
      );
    }

    // ── تحليل الرسائل ──────────────────────────────────────────────────────
    const violations = []; // { msg, violations[], reported }

    for (const msg of userMessages) {
      const found = analyzeMessage(msg.body);
      if (found.length) {
        const reported = await tryReport(api, msg);
        violations.push({ msg, violations: found, reported });
        await sleep(randInt(200, 500));
      }
    }

    // ── لا مخالفات ────────────────────────────────────────────────────────
    if (!violations.length) {
      return api.sendMessage(
        `✅ راجعت ${userMessages.length} رسالة لـ ${targetName}\n\n`
        + "لم أعثر على أي مخالفات لقوانين مجتمع فيسبوك.\n"
        + "الرسائل تبدو عادية ولا تستوجب بلاغاً.",
        threadID
      );
    }

    // ── بناء تقرير البلاغات ────────────────────────────────────────────────
    // تجميع فريد حسب الفئة
    const byCategory = new Map();
    for (const v of violations) {
      for (const viol of v.violations) {
        if (!byCategory.has(viol.ruleId)) {
          byCategory.set(viol.ruleId, { ...viol, count: 0, samples: [] });
        }
        const entry = byCategory.get(viol.ruleId);
        entry.count++;
        if (entry.samples.length < 2) {
          entry.samples.push(v.msg.body.slice(0, 60) + (v.msg.body.length > 60 ? "…" : ""));
        }
      }
    }

    // ترتيب حسب الخطورة
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sorted = [...byCategory.values()].sort(
      (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
    );

    // عدد الرسائل الموبَّخ عليها
    const reportedCount = violations.filter(v => v.reported).length;
    const totalViolations = violations.length;

    let report = `⚠️ نتائج مراجعة رسائل ${targetName}\n`;
    report += `${"─".repeat(35)}\n`;
    report += `📊 تم فحص: ${userMessages.length} رسالة\n`;
    report += `🚫 مخالفات مكتشفة: ${totalViolations} رسالة\n`;

    if (reportedCount > 0) {
      report += `📤 تم الإبلاغ فعلياً: ${reportedCount} رسالة\n`;
    }

    report += `${"─".repeat(35)}\n\n`;
    report += `📋 تفاصيل المخالفات:\n\n`;

    for (const cat of sorted) {
      report += `${severityIcon(cat.severity)} ${cat.category}\n`;
      report += `   📌 النوع: ${cat.reportType}\n`;
      report += `   📝 التفاصيل: ${cat.description}\n`;
      report += `   🔢 عدد الرسائل المخالفة: ${cat.count}\n`;
      if (cat.samples.length) {
        report += `   💬 مثال: "${cat.samples[0]}"\n`;
      }
      report += "\n";
    }

    report += `${"─".repeat(35)}\n`;

    if (reportedCount > 0) {
      report += `✅ تم تقديم البلاغات على ${reportedCount} رسالة بنجاح.\n`;
      report += `⏳ سيراجع فريق فيسبوك المحتوى خلال 24-48 ساعة.`;
    } else {
      report += `ℹ️ تم رصد المخالفات وتسجيلها.\n`;
      report += `📌 البلاغ المناسب: ${sorted.map(c => c.reportType).join(" | ")}\n`;
      report += `💡 يمكنك الإبلاغ يدوياً بالضغط على الرسالة ← تبليغ.`;
    }

    await api.sendMessage(report, threadID);

    // ── تفصيل إضافي للمخالفات الحرجة ────────────────────────────────────
    const critical = violations.filter(v =>
      v.violations.some(x => x.severity === "CRITICAL")
    );

    if (critical.length > 0) {
      await sleep(1500);
      let critMsg = `🔴 تحذير — مخالفات حرجة تستوجب إجراءاً فورياً:\n\n`;
      for (const v of critical.slice(0, 3)) {
        const cats = [...new Set(v.violations.map(x => x.category))].join(", ");
        critMsg += `• فئة: ${cats}\n`;
        critMsg += `  الرسالة: "${v.msg.body.slice(0, 80)}${v.msg.body.length > 80 ? "…" : ""}"\n\n`;
      }
      critMsg += "⚡ هذه المخالفات تستوجب حذف المحتوى فوراً وتقديم بلاغ عاجل لفيسبوك.";
      await api.sendMessage(critMsg, threadID);
    }
  },
};
