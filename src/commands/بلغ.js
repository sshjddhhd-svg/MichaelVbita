"use strict";
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  نظام البلاغات الذكي — Facebook Community Standards Engine v2.0    ║
 * ║  تحليل عميق متعدد الطبقات مع تطبيع النصوص ودعم اللهجات العربية    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const sleep   = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

// ══════════════════════════════════════════════════════════════════════════════
// الطبقة 1 — تطبيع النص (Text Normalization)
// يُزيل التشكيل، يوحّد أشكال الحروف، يكشف التمويه المتعمد
// ══════════════════════════════════════════════════════════════════════════════
function normalize(text) {
  if (!text) return "";
  let t = text;

  // إزالة التشكيل
  t = t.replace(/[\u064B-\u065F\u0670]/g, "");

  // توحيد الهمزات والألف
  t = t.replace(/[أإآاٱ]/g, "ا");
  t = t.replace(/[ؤئء]/g, "ء");
  t = t.replace(/ة/g, "ه");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/گ/g, "ك");

  // كشف التمويه بالأرقام (1337-speak عربي)
  t = t.replace(/3/g, "ع").replace(/5/g, "خ").replace(/6/g, "ط")
       .replace(/7/g, "ح").replace(/8/g, "ق").replace(/9/g, "ص")
       .replace(/2/g, "ء").replace(/4/g, "ا");

  // حذف مسافات مدسوسة بين حروف الكلمة
  t = t.replace(/([أ-ي])\s+([أ-ي])/g, "$1$2");

  // تحويل إلى أحرف صغيرة للإنجليزية
  t = t.toLowerCase();

  // إزالة تكرار الحرف أكثر من 3 مرات (يييييي → ي)
  t = t.replace(/(.)\1{3,}/g, "$1$1$1");

  return t;
}

// ══════════════════════════════════════════════════════════════════════════════
// الطبقة 2 — كلمات الخطر المفردة (Token Blacklist)
// كلمات مفردة ذات وزن مخالفة — كل كلمة لها درجة وفئة
// ══════════════════════════════════════════════════════════════════════════════
const TOKEN_BLACKLIST = [
  // خطاب كراهية — صريح
  { token: /\bقرد\b|\bقرود\b/,           cat: "HATE_SPEECH",   score: 6  },
  { token: /\bخنزير\b|\bخنازير\b/,        cat: "HATE_SPEECH",   score: 6  },
  { token: /\bكلب\b|\bكلاب\b/,            cat: "HATE_SPEECH",   score: 5  },
  { token: /\bزبال\b|\bزباله\b/,          cat: "HATE_SPEECH",   score: 4  },
  { token: /\bوسخ\b|\bنجس\b/,             cat: "HATE_SPEECH",   score: 4  },
  { token: /\bحقير\b|\bتافه\b/,           cat: "HATE_SPEECH",   score: 3  },
  { token: /\bغبي\b|\bاحمق\b|\bبليد\b/,  cat: "BULLYING",      score: 3  },
  { token: /\bشرموطه?\b|\bقحبه?\b/,       cat: "HATE_SPEECH",   score: 8  },
  { token: /\bعاهر\b|\bعاهره\b/,          cat: "HATE_SPEECH",   score: 8  },
  { token: /\bزانيه?\b|\bفاحشه?\b/,       cat: "SEXUAL_CONTENT",score: 7  },
  { token: /\bمنيوك\b|\bمنيك\b/,          cat: "SEXUAL_CONTENT",score: 9  },
  { token: /\bنيك\b|\bتنيك\b/,            cat: "SEXUAL_CONTENT",score: 9  },
  { token: /\bخول\b|\bشاذ\b|\bمخنث\b/,   cat: "HATE_SPEECH",   score: 7  },
  { token: /\bلوطي\b/,                    cat: "HATE_SPEECH",   score: 7  },
  { token: /\bداعش\b/,                    cat: "TERRORISM",     score: 8  },
  { token: /\bالقاعده?\b/,                cat: "TERRORISM",     score: 8  },
  { token: /\bارهابي\b|\bارهابيون\b/,     cat: "TERRORISM",     score: 7  },
  { token: /\bمتفجره?\b|\bقنبله?\b/,      cat: "VIOLENCE",      score: 8  },
  { token: /\bانتحار\b/,                   cat: "SELF_HARM",    score: 7  },
  { token: /\bاذبح\b|\bاطعن\b/,           cat: "VIOLENCE",      score: 8  },
  { token: /\bاقتل\b|\bاقتله\b/,          cat: "VIOLENCE",      score: 7  },
  { token: /\bدم\b.*\bيسيل\b/,            cat: "VIOLENCE",      score: 6  },
  { token: /\bcsam\b|\bcp\b/,             cat: "CHILD_EXPLOIT", score: 10 },
  { token: /\bporn\b|\bxxx\b/,            cat: "SEXUAL_CONTENT",score: 9  },
  { token: /\bonlyfans\b/,                cat: "SEXUAL_CONTENT",score: 6  },
  { token: /\bdox(ing)?\b/,               cat: "PRIVACY",       score: 8  },
  { token: /\bphishing\b/,                cat: "SCAM",          score: 7  },
  { token: /\bابتزاز\b/,                  cat: "BLACKMAIL",     score: 9  },
  { token: /\bتهديد\b/,                   cat: "VIOLENCE",      score: 5  },
  { token: /\bمخدر\b|\bمخدرات\b/,         cat: "DRUGS",         score: 7  },
  { token: /\bهيروين\b|\bكوكايين\b/,      cat: "DRUGS",         score: 9  },
  { token: /\bحشيش\b|\bبانجو\b/,          cat: "DRUGS",         score: 6  },
  { token: /\bسلاح\b|\bمسدس\b/,           cat: "WEAPONS",       score: 6  },
  { token: /\bكلاشن\b|\brpg\b/,           cat: "WEAPONS",       score: 8  },
  { token: /\bعنصريه?\b|\bتمييز\b/,       cat: "HATE_SPEECH",   score: 6  },
  { token: /\bابادة\b/,                   cat: "HATE_SPEECH",   score: 9  },
  { token: /\bاغتصاب\b/,                  cat: "SEXUAL_CONTENT",score: 10 },
];

// ══════════════════════════════════════════════════════════════════════════════
// الطبقة 3 — أنماط السياق (Contextual Pattern Rules)
// أنماط تراعي السياق المحيط — مجمّعة في 17 فئة
// ══════════════════════════════════════════════════════════════════════════════
const CONTEXT_RULES = [

  // ─── 1. خطاب الكراهية ────────────────────────────────────────────────────
  {
    id: "HATE_SPEECH", category: "خطاب الكراهية", severity: "HIGH",
    reportType: "خطاب كراهية", score: 7,
    description: "محتوى يهاجم أشخاصاً بسبب العرق أو الدين أو الجنس أو الجنسية",
    patterns: [
      /يهود\s*(ازبال|خنازير|قتل|ابادة|مجرمون)/,
      /مسلم(ين|ون|)\s*(ارهاب|قتل|ابادة|حرق|مجرمون)/,
      /عرب\s*(قذر|خنازير|حيوان|نجس|ضيعه)/,
      /(عجم|فرس|ترك)\s*(خنازير|قذرون|كفار)/,
      /اقتل\s*(ال|كل\s*)?(يهود|مسلم|مسيحي|عرب|عجم|الزنج)/,
      /ازيل\s*(العرق|الجنس|الدين|الامه)/,
      /(نساء|المرءه|البنات)\s*(اقل|ادنى|عاهر|ناقصات)/,
      /الله\s*(يلعن|يخزي)\s*(الدين|الرب|الاسلام|المسيح|الكعبه)/,
      /كل\s*(المسلمين|المسيحيين|اليهود|العرب)\s*(يجب\s*)?(اقتلوا|ابيدوا|احرقوا)/,
      /الإسلام\s*(دين\s*)?(عنف|ارهاب|بربريه|دمويه)/,
      /المسيحيه\s*(باطل|كفر|ضلال|شرك)/,
      /(الزنج|السود|العبيد)\s*(ادنى|اوطأ|اقل\s*من)/,
      /تفوق\s*(العرق|الجنس|الديانه)/,
      /(كافر|ملعون|شيطان)\s*(يستحق|يجب\s*ان)\s*(يموت|يقتل|يحرق)/,
      /(عرقي|طائفي|ديني)\s*(صراع|حرب|اباده)/,
    ],
  },

  // ─── 2. التنمر والمضايقة ──────────────────────────────────────────────────
  {
    id: "BULLYING", category: "تنمر ومضايقة", severity: "HIGH",
    reportType: "تنمر أو مضايقة", score: 7,
    description: "مهاجمة شخص معين أو تهديده أو إذلاله بشكل متكرر",
    patterns: [
      /انت\s*(بكل\s*)?(حقير|تافه|زباله|قمامه|نجس|وسخ|مثلي|خول|شاذ|مجنون|اهبل)/,
      /(روح|اذهب)\s*(انتحر|اموت|تشنق|فوق\s*جسر|من\s*شاهق)/,
      /العالم\s*(افضل|احسن|اجمل)\s*(بدون|من\s*غير|دونك|لو\s*مت)/,
      /تستاهل\s*(تموت|تنتحر|تتعذب|تتألم|الذل|الهوان)/,
      /(هاجم|ادمر|خرب)\s*(حياته|سمعته|علاقاته|عمله|دراسته)/,
      /(كشف|سأكشف|سننشر)\s*(سره|بياناته|عنوانه|صوره|معلوماته)/,
      /حياتك\s*(لا\s*قيمه\s*لها|بلا\s*معنى|تافهه|انهيها)/,
      /لن\s*(يحبك|يقبلك|يريدك)\s*(أحد|أي\s*شخص)/,
      /(ضرب|أذية|تعذيب)\s*(يستحقه|يستاهله|يستاهلها)/,
      /(الكل|الجميع)\s*(يكرهك|يمقتك|يحتقرك|ضدك)/,
      /اتمنى\s*(موتك|تعذبك|سجنك|ضياعك|فشلك)/,
      /انت\s*(سبب|مصدر)\s*(كل\s*)?(بلاء|شر|مصيبه)/,
    ],
  },

  // ─── 3. المحتوى الجنسي ───────────────────────────────────────────────────
  {
    id: "SEXUAL_CONTENT", category: "محتوى جنسي صريح", severity: "CRITICAL",
    reportType: "محتوى جنسي أو إباحي", score: 9,
    description: "محتوى جنسي صريح أو إباحي أو استغلال جنسي",
    patterns: [
      /porn|xxx|sex\s*tape|nude\s*pic/,
      /ارسل\s*(صور|فيديو|مقطع)\s*(عاريه|اباحيه|جنسيه|ساخنه)/,
      /ابيع\s*(صور|فيديوهات|مقاطع)\s*(بنات|نساء|بنوت|حريم)/,
      /صور\s*(اباحيه|جنسيه|عاريه)\s*(للبيع|مجانا|مقابل)/,
      /(قضيب|عضو\s*ذكري|فرج|كس)\s*(صور|فيديو|ارسل|ارى)/,
      /تبادل\s*صور\s*(جنسيه|اباحيه|ساخنه|خاصه)/,
      /مجموعه\s*(اباحيه|جنسيه|للكبار\s*فقط)/,
      /(sex|sexual)\s*(video|photo|pic|content)\s*(for\s*sale|free)/,
      /سكس|بورن|اباحي\s*(فيديو|مقطع|صور)/,
      /ممارسه\s*(الجنس|العلاقه\s*الحميميه)\s*(بالمال|للبيع)/,
      /اغتصاب\s*(فيديو|صور|قصه|تجربه)/,
      /تحرش\s*(جنسي|بالاطفال|بالقاصرين)/,
      /(نساء|بنات)\s*(عاريات|بالكامل|بدون\s*ملابس)\s*(مجانا|للتحميل)/,
    ],
  },

  // ─── 4. العنف والتهديد المباشر ────────────────────────────────────────────
  {
    id: "VIOLENCE", category: "عنف وتهديدات", severity: "CRITICAL",
    reportType: "عنف أو تهديد مباشر", score: 9,
    description: "تهديدات بالعنف الجسدي أو الدعوة للعنف",
    patterns: [
      /(سأ|سو|راح\s*ا|هـ)(قتل|اذبح|اطعن|اضرب|اجرح|اؤذي)\s*(ك|كم|كن|ه|ها|هم|هن)/,
      /سوف\s*(اقتل|انهي|ادمر|اجرح|افتك\s*ب)\s*(ك|حياتك|ه|ها)/,
      /سترى\s*(دمك|النهايه|ما\s*يحدث\s*لك|مصيرك)/,
      /(شاهد|انظر)\s*كيف\s*(اقتل|اذبح|ادمر|افعل\s*بك)/,
      /اطعن(ه|ها|هم|ك)|اذبح(ه|ها|هم|ك)|مزق(ه|ها|هم|ك)/,
      /(تفجير|هجوم)\s*(مسلح|انتحاري|ارهابي|عشوائي)/,
      /قنبله\s*(بشريه|ناسفه|يدويه)\s*(ارمي|انفجر|ضد)/,
      /(سلاح|مسدس|بندقيه|سكين)\s*(سأستخدمه|سأطلق|سأطعن)/,
      /دم\s*(ك|ه|ها|هم)\s*(سيسيل|سيُراق|على\s*يدي)/,
      /سوف\s*(اضرب|ادمر)\s*(بيتك|سيارتك|عملك|اسرتك)/,
      /اجمع\s*(اناسا|ناسا|شبابا)\s*(لضرب|لمهاجمه|لتأديب)/,
      /(حرق|اضرام\s*النار)\s*(في\s*)?(بيته|سيارته|ممتلكاته)/,
    ],
  },

  // ─── 5. الانتحار وإيذاء النفس ────────────────────────────────────────────
  {
    id: "SELF_HARM", category: "انتحار وإيذاء النفس", severity: "CRITICAL",
    reportType: "محتوى يشجع على الانتحار أو إيذاء النفس", score: 9,
    description: "محتوى يشجع أو يروج أو يُعلّم الانتحار أو إيذاء النفس",
    patterns: [
      /كيف\s*(انتحر|تنتحر|اقتل\s*نفسي)\s*(بسهوله|بدون\s*الم|بطريقه|بسرعه)/,
      /افضل\s*طريقه\s*(للانتحار|لإنهاء\s*الحياه|لقتل\s*النفس)/,
      /انتحر\s*(معي|معنا|الان|هيا|نتحر)/,
      /جرب\s*(الانتحار|قطع\s*الاوردة|بلع\s*الحبوب|الشنق)/,
      /قطع\s*(الاوردة|الشريان|الوريد)\s*(طريقه|كيف|سكين)/,
      /(اقتل|انهِ)\s*نفسك\s*(الان|فورا|بسرعه)/,
      /الموت\s*(احسن|افضل|اريح)\s*(من\s*)?(هذه\s*الحياه|هكذا|منك)/,
      /الحياه\s*(لا\s*تستحق|بلا\s*معنى)\s*(فأنهها|فاقتل\s*نفسك)/,
      /دواء\s*(زائد|جرعه\s*كبيره|جرعه\s*زائده)\s*(لاموت|لانتحر)/,
      /(تسمم|بلع)\s*(نفسك|ذاتك)\s*(بالحبوب|بالسم|بالكيماويات)/,
    ],
  },

  // ─── 6. الاحتيال والنصب ──────────────────────────────────────────────────
  {
    id: "SCAM", category: "احتيال ونصب", severity: "HIGH",
    reportType: "احتيال أو نصب مالي", score: 7,
    description: "عمليات احتيال مالي أو نصب أو انتحال شخصية",
    patterns: [
      /ارسل\s*(مبلغ|فلوس|مال|دولار|ريال|دينار)\s*(وستردها|وراح\s*ترجع|وتكسب|وتضاعف)\s*(\d+\s*)?(ضعف|مره|مرات)/,
      /(ربحت|فزت|اخترناك|اخترتك)\s*(بجائزة|بمليون|بالف|بمبلغ)\s*(ارسل|ادفع|سجل)/,
      /(ادفع|ارسل)\s*(رسوم|ضريبه|عموله|تأمين)\s*(لاستلام\s*الجائزه|لتفعيل\s*الحساب)/,
      /حسابك\s*(مخترق|معطل|موقوف|محجوب)\s*(ارسل\s*بياناتك|ادخل\s*معلوماتك|فعّله)/,
      /كلمة?\s*(سر|مرور|السر)\s*(ارسل|اعطني|شاركني|اكتب\s*هنا)/,
      /(paypal|moneygram|western\s*union|binance|usdt)\s*(ارسل|حول|اضغط\s*الرابط)/,
      /استثمار\s*(مضمون|مريح|سهل)\s*(ربح|عائد)\s*\d+\s*%/,
      /(تسجيل\s*دخول|login|sign\s*in)\s*(فيسبوك|حسابك|انستجرام)\s*(هنا|اضغط|عبر\s*الرابط)/,
      /تجارة\s*(مضمونه|مريحه|سهله)\s*(ارسل|استثمر|ابدأ)\s*(مبلغ|مال)/,
      /ارسل\s*بيانات\s*(بطاقتك|كرديتك|ماستركارد|فيزا)\s*(للتحقق|لاستكمال)/,
      /(حساب|محفظه)\s*(ممتلئه|كبيره|مجميه)\s*(لا\s*يريدها|اعطيها|اتصل)/,
    ],
  },

  // ─── 7. التصيد الإلكتروني / Phishing ────────────────────────────────────
  {
    id: "PHISHING", category: "تصيد إلكتروني", severity: "HIGH",
    reportType: "محتوى تصيد إلكتروني", score: 8,
    description: "روابط أو محتوى يهدف لسرقة بيانات الدخول أو المعلومات الشخصية",
    patterns: [
      /http[s]?:\/\/[^\s]*?(faceb00k|f4cebook|facebok|facbook|faecbook|fb-login)/i,
      /http[s]?:\/\/[^\s]*?(paypa1|paypa-l|paypall|paipal)/i,
      /http[s]?:\/\/bit\.ly\/|tinyurl\.com\/|t\.co\/[^\s]+\s*(ادخل|سجل|اضغط)/i,
      /(اضغط|انقر|زر)\s*(هذا\s*)?(الرابط|اللنك|link)\s*(وسجل|لتفعيل|لتتحقق)/,
      /يجب\s*(تأكيد|تحديث|تفعيل)\s*(بياناتك|حسابك|هويتك)\s*(خلال|قبل)/,
      /(حسابك|اكاونتك)\s*(سيُغلق|سيُحذف|سيُعطل)\s*(اذا\s*لم|الا\s*اذا)\s*(تؤكد|تُفعّل)/,
      /ادخل\s*(الرمز|الكود|otp|pin)\s*(هنا|في\s*الرابط|لتفعيل)/,
      /كسب\s*(مجاني|سريع|ضخم)\s*(اضغط|سجل|ادخل)\s*(الان|هنا|رابط)/,
    ],
  },

  // ─── 8. انتهاك الخصوصية ──────────────────────────────────────────────────
  {
    id: "PRIVACY", category: "انتهاك الخصوصية", severity: "HIGH",
    reportType: "انتهاك الخصوصية ونشر بيانات شخصية", score: 8,
    description: "نشر معلومات شخصية أو بيانات خاصة بدون إذن صاحبها",
    patterns: [
      /عنوان(ه|ها|ك|هم)\s*(الكامل|البيت|السكن)\s*(هو|في|هنا|نشرت)/,
      /رقم\s*(هاتف|تليفون|جوال|موبايل|ايفون)(ه|ها|ك|هم)\s*[:]\s*[\d\+\-\s]{7,}/,
      /(كشف|كشفت|سأكشف|سننشر|سأنشر)\s*(هويت|بيانات|معلومات|عنوان|سجل)\s*(ه|ها|ك|هم)/,
      /(صور|فيديو)\s*(خاصه|سريه|منزليه|حميميه)\s*(نشر|توزيع|ارسل|سربت)/,
      /ip\s*(address|عنوانه|ايبي|الخاص)\s*[:]\s*[\d\.]+/,
      /بطاقة?\s*(هوية|الاحوال|الجنسيه|شخصيه)\s*(رقم|نشر|كشف)/,
      /ايميل(ه|ها|ك)\s*(وباسورد|وكلمة\s*المرور)\s*(هو|هنا)/,
      /كشف\s*(هويه|معلومات)\s*(شخص|مجهول|عضو)\s*(دون\s*اذنه|علنا)/,
    ],
  },

  // ─── 9. الإرهاب والتطرف ──────────────────────────────────────────────────
  {
    id: "TERRORISM", category: "إرهاب وتطرف", severity: "CRITICAL",
    reportType: "إرهاب أو تطرف أو دعم منظمات إرهابية", score: 10,
    description: "محتوى يروج للإرهاب أو يدعم المنظمات الإرهابية أو يجنّد لها",
    patterns: [
      /(انضم|انتسب|بايع|قدّم\s*بيعه)\s*(داعش|القاعده|الدوله\s*الإسلاميه|بوكوحرام|حماس|طالبان)/,
      /(جهاد|قتال\s*الكفار|الجهاد\s*المسلح)\s*(ضد|في\s*سبيل)\s*(المسلمين|الدوله)/,
      /عمليه\s*انتحاريه\s*(خطه|تنفيذ|تنظيم|تدريب)/,
      /تجنيد\s*(مقاتلين|اعضاء|شباب)\s*(ل|الى)\s*(داعش|القاعده|التنظيم)/,
      /(تمويل|دعم|تجهيز)\s*(الإرهاب|التنظيم\s*الإرهابي|المسلحين)/,
      /(مجد|عظّم|احتفل\s*ب)\s*(هجوم\s*ارهابي|تفجير\s*ارهابي|عمليه\s*قتل)/,
      /خريطه\s*(هجوم|تفجير|مخطط\s*ارهابي)/,
      /كيف\s*(تصنع|تعمل|تجهز)\s*(متفجره|قنبله|سلاح\s*كيماوي)/,
    ],
  },

  // ─── 10. السبام والمحتوى المضلل ──────────────────────────────────────────
  {
    id: "SPAM", category: "سبام ومحتوى مضلل", severity: "MEDIUM",
    reportType: "سبام أو محتوى مضلل", score: 5,
    description: "رسائل متكررة أو روابط مشبوهة أو معلومات مضللة مقصودة",
    patterns: [
      /(اضغط|زور|انقر)\s*(الرابط|الموقع|اللينك)\s*(لربح|للفوز|للحصول\s*على)/,
      /شارك\s*(هذه\s*الرساله|المنشور|الخبر)\s*(مع|الى)\s*(\d+|جميع)\s*(اشخاص|مجموعات)/,
      /وإلا\s*(سيحدث|ستتعرض|ستُصاب|ستفشل)\s*(لك|في\s*حياتك|بالمصيبه)/,
      /رساله\s*(عاجله|مهمه\s*جدا)\s*(انتشر|شارك|أرسل)\s*(الان|فورا)/,
      /فيسبوك\s*(سيغلق|سيحذف|سيوقف)\s*(حسابك|الخدمه|المنصه)/,
      /هذا\s*(صحيح\s*100\s*%|مؤكد|خبر\s*عاجل)\s*(شارك|انشر|ارسل)/,
      /اخبار\s*(كاذبه|ملفقه|مفبركه)\s*(لتضليل|لإثاره|لتحريض)/,
      /(ادعو|صوتوا|ايدوا)\s*(مرشح|شخص|حزب)\s*(لان|لانه|بسبب)\s*(كذبه|زائف)/,
    ],
  },

  // ─── 11. استغلال الأطفال ─────────────────────────────────────────────────
  {
    id: "CHILD_EXPLOIT", category: "استغلال الأطفال", severity: "CRITICAL",
    reportType: "استغلال جنسي للأطفال أو إساءة لهم", score: 10,
    description: "أي محتوى يستغل أو يؤذي أو يُجند الأطفال",
    patterns: [
      /صور\s*(اطفال|طفل|قاصر|بنت\s*صغيره)\s*(جنسيه|عاريه|اباحيه)/,
      /(طفل|قاصر|صغير)\s*(جنس|نيك|استغلال|تحرش|اغتصاب)/,
      /csam|child\s*(porn|sex|nude|abuse|exploitation)/,
      /(تعارف|علاقه\s*مع)\s*(طفل|قاصر|صغيره|ابن\s*\d+\s*سنوات)/,
      /ارسل\s*(لي|لينا)\s*صور\s*(ابنك|ابنتك|اطفالك)\s*(وحدهم|بالبيت)/,
      /(بيع|اشتري|احصل)\s*(على\s*)?(اطفال|قاصرين|صغار)\s*(للعمل|للجنس)/,
      /تشغيل\s*اطفال\s*(بالسخره|قسرا|بالقوه|دون\s*اجر)/,
    ],
  },

  // ─── 12. الابتزاز والتهديد بالمعلومات ───────────────────────────────────
  {
    id: "BLACKMAIL", category: "ابتزاز وتهديد", severity: "CRITICAL",
    reportType: "ابتزاز إلكتروني أو تهديد بنشر معلومات", score: 9,
    description: "تهديد الضحايا بنشر صورهم أو معلوماتهم مقابل المال أو الجنس",
    patterns: [
      /(عندي|لدي|احتفظ\s*ب)\s*(صور|فيديو|لقطات)\s*(ك|ه|ها|سريه|خاصه)\s*(وسانشرها|سأكشفها|إذا\s*لم)/,
      /انشر\s*(صورك|فيديوك|لقطاتك)\s*(اذا\s*لم|إن\s*لم|الا\s*اذا)\s*(ترسل|دفعت|وافقت)/,
      /(ادفع|ارسل)\s*(مبلغ|فلوس|مال)\s*(والا|وإلا)\s*(سانشر|سأكشف|سأُرسل)/,
      /تهديد\s*(بالصور|بالفيديو|بالاسرار|بالفضيحه)/,
      /(اعطني|ارسلي)\s*(صور|فيديو|مال)\s*(والا|وإلا)\s*(سأ|سو|هـ)(كشف|نشر|فضح)/,
      /(فضيحه|فضح|كشف)\s*(سره|اسراره|صوره)\s*(مقابل|الا\s*اذا|حتى\s*لا)/,
    ],
  },

  // ─── 13. المخدرات والمواد المحظورة ──────────────────────────────────────
  {
    id: "DRUGS", category: "مخدرات ومواد محظورة", severity: "HIGH",
    reportType: "ترويج أو بيع مخدرات ومواد محظورة", score: 8,
    description: "بيع أو ترويج أو تشجيع استخدام المخدرات والمواد المحظورة",
    patterns: [
      /(ابيع|اشتري|اوفر|اوصّل)\s*(حشيش|هيروين|كوكايين|بودر|كريستال|مدعوم)/,
      /(مخدر|قرص|حبوب\s*هلوسه)\s*(للبيع|مجانا|رخيص|جديد)/,
      /(جرعه|دوز)\s*(مخدر|هيروين|كوكايين|شابو)\s*(كيف|طريقه)/,
      /كيف\s*(تستخدم|تعمل|تتعاطى)\s*(المخدرات|الهيروين|الكوكايين|الكريستال)/,
      /(واتس|تيليجرام|خاص)\s*(للطلب|للشراء|للتواصل)\s*(مخدرات|حشيش|شابو)/,
      /ترويج\s*(مخدرات|حبوب|كريستال)\s*(بين|لـ)\s*(الشباب|الطلاب|الاطفال)/,
    ],
  },

  // ─── 14. الأسلحة غير المشروعة ────────────────────────────────────────────
  {
    id: "WEAPONS", category: "أسلحة غير مشروعة", severity: "HIGH",
    reportType: "ترويج أو بيع أسلحة غير مشروعة", score: 8,
    description: "بيع أو شراء أو ترويج أسلحة غير مرخصة أو أسلحة الدمار الشامل",
    patterns: [
      /(ابيع|اشتري|اوفر)\s*(مسدس|بندقيه|كلاشن|سلاح|خنجر|سكين\s*مطواه)/,
      /سلاح\s*(غير\s*مسجل|بدون\s*ترخيص|مهرب|مفصلص)/,
      /كيف\s*(تصنع|تعمل|تجهز)\s*(مسدس|قنبله\s*يدويه|سلاح\s*نار)/,
      /(rpg|صاروخ|قذيفه)\s*(للبيع|متوفر|اشتري|اوفر)/,
      /سلاح\s*كيماوي\s*(كيف|طريقه|وصفه|تصنيع)/,
      /ذخيره\s*(بدون\s*ترخيص|مهربه|رخيصه)\s*(للبيع|متوفره)/,
    ],
  },

  // ─── 15. انتحال الشخصية ──────────────────────────────────────────────────
  {
    id: "IMPERSONATION", category: "انتحال شخصية", severity: "MEDIUM",
    reportType: "انتحال شخصية شخص آخر أو جهة رسمية", score: 6,
    description: "ادعاء الهوية المزيفة بقصد الإيهام أو الاحتيال",
    patterns: [
      /انا\s*(موظف|مسؤول|مدير)\s*(فيسبوك|ميتا|شركه\s*ميتا)\s*(وسنحذف|ونطلب)/,
      /(انا|اعمل|من\s*طرف)\s*(الشرطه|الامن|المباحث|النيابه)\s*(وسنعتقل|وسنحقق)/,
      /هذا\s*(الحساب\s*الرسمي|الصفحه\s*الرسميه)\s*(ل|للـ)\s*(مشهور|سياسي|حكومه)/,
      /ادعاء\s*(الشهره|الرسميه|العمل\s*لصالح)\s*(زورا|دون\s*اذن)/,
      /اعطني\s*(بياناتك|معلوماتك)\s*(لان|لاني)\s*(موظف|مسؤول|من\s*الاداره)/,
    ],
  },

  // ─── 16. التحريض الطائفي والعنصري ───────────────────────────────────────
  {
    id: "INCITEMENT", category: "تحريض طائفي أو عنصري", severity: "CRITICAL",
    reportType: "تحريض على العنف الطائفي أو العنصري", score: 9,
    description: "محتوى يحرّض على الكراهية أو العنف بين الطوائف أو الأعراق",
    patterns: [
      /الحرب\s*(الطائفيه|المذهبيه|الدينيه)\s*(واجبه|ضروريه|حان\s*وقتها)/,
      /(اقتل|ابيد|طرد)\s*(السنه|الشيعه|المسيحيين|اليهود|الاكراد)\s*(من)/,
      /(طهّر|نظّف)\s*(البلد|المنطقه|الحي)\s*(من|منهم)\s*(العرق|الطائفه|الديانه)/,
      /(حرب|صراع)\s*(ديني|طائفي|مذهبي|عرقي)\s*(لابد\s*منه|واجب|ضروره)/,
      /لا\s*مكان\s*(ل|لـ)\s*(المسيحيين|اليهود|الشيعه|السنه)\s*(في|بهذا)/,
      /(حرق|هدم)\s*(كنائس|مساجد|معابد|جوامع)\s*(واجب|ضروره|مطلوب)/,
    ],
  },

  // ─── 17. التشهير والقذف ──────────────────────────────────────────────────
  {
    id: "DEFAMATION", category: "تشهير وقذف", severity: "MEDIUM",
    reportType: "تشهير أو قذف بشخص أو جهة", score: 6,
    description: "نشر معلومات كاذبة وهادفة للإساءة لشخص أو جهة",
    patterns: [
      /(يسرق|نصاب|احتال\s*على)\s*(الناس|الزبائن|الشركاء)\s*(وهو|لكنه|لانه)/,
      /(كذاب|منافق|نصاب)\s*(حقيقي|صح|فعلا)\s*(وعندي|ولدي)\s*(اثبات|دليل|صور)/,
      /فاضح(ه|)\s*(الحقيقه|المستور|الخفي)\s*(عنه|عنها)\s*(الان|للجميع)/,
      /(شركه|متجر|شخص)\s*(مزيف|نصاب|محتال)\s*(وهنا|وهذا)\s*(اثبات|دليل)/,
      /انشر\s*(سر|اسرار|فضيحه)\s*(ه|ها)\s*(لفضحه|لتشويه\s*سمعته)/,
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// الطبقة 4 — كشف السلوك التكراري عبر مجموعة الرسائل
// ══════════════════════════════════════════════════════════════════════════════
function detectBehavioralPatterns(messages) {
  const behaviorViolations = [];

  // أ) رسائل متكررة بالكامل (spam)
  const bodyCount = new Map();
  for (const m of messages) {
    const key = m.body.trim().toLowerCase().replace(/\s+/g, " ");
    bodyCount.set(key, (bodyCount.get(key) || 0) + 1);
  }
  const spamMsgs = [...bodyCount.entries()].filter(([, c]) => c >= 4);
  if (spamMsgs.length > 0) {
    behaviorViolations.push({
      id: "SPAM_BEHAVIOR", category: "سبام تكراري", severity: "MEDIUM",
      reportType: "سبام — رسائل متكررة", score: 5,
      description: `تكرار نفس الرسالة ${spamMsgs[0][1]} مرات: "${spamMsgs[0][0].slice(0, 50)}…"`,
    });
  }

  // ب) روابط مشبوهة متعددة
  const urlPattern = /https?:\/\/[^\s]{10,}/gi;
  let linkCount = 0;
  for (const m of messages) {
    const matches = m.body.match(urlPattern) || [];
    linkCount += matches.length;
  }
  if (linkCount >= 5) {
    behaviorViolations.push({
      id: "EXCESSIVE_LINKS", category: "روابط مفرطة", severity: "MEDIUM",
      reportType: "سبام — نشر روابط مفرطة", score: 5,
      description: `نشر ${linkCount} رابطاً — سلوك مشبوه`,
    });
  }

  // ج) كثافة الشتائم العامة
  const insultWords = /\b(غبي|احمق|بليد|حقير|تافه|معتوه|ابله|فاشل|خاسر|زباله|حيوان|بهيمه)\b/gi;
  let insultTotal = 0;
  for (const m of messages) insultTotal += (m.body.match(insultWords) || []).length;
  if (insultTotal >= 6) {
    behaviorViolations.push({
      id: "INSULT_PATTERN", category: "نمط إهانات متكرر", severity: "HIGH",
      reportType: "تنمر أو مضايقة", score: 7,
      description: `استخدم ${insultTotal} شتيمة/إهانة عبر رسائله — نمط تنمر ممنهج`,
    });
  }

  return behaviorViolations;
}

// ══════════════════════════════════════════════════════════════════════════════
// المحرك الرئيسي — تحليل رسالة واحدة (طبقات متعددة)
// ══════════════════════════════════════════════════════════════════════════════
function analyzeMessage(rawText) {
  if (!rawText || typeof rawText !== "string" || rawText.trim().length < 2) return [];

  const norm  = normalize(rawText);
  const found = new Map(); // ruleId → { ...rule, matchScore }

  // ── الطبقة 2: كلمات سوداء مفردة ──────────────────────────────────────────
  for (const item of TOKEN_BLACKLIST) {
    if (item.token.test(norm)) {
      const existing = found.get(item.cat);
      const entry = existing || { id: item.cat, score: 0 };
      entry.score = (entry.score || 0) + item.score;
      if (!existing) found.set(item.cat, entry);
    }
  }

  // ── الطبقة 3: أنماط السياق ──────────────────────────────────────────────
  for (const rule of CONTEXT_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(norm)) {
        const existing = found.get(rule.id);
        if (existing) {
          existing.score = Math.max(existing.score, rule.score) + 2; // تعزيز
        } else {
          found.set(rule.id, { ...rule, score: rule.score });
        }
        break;
      }
    }
  }

  // ── تجميع النتائج مع عتبة الثقة ──────────────────────────────────────────
  const violations = [];
  for (const [id, entry] of found.entries()) {
    // ابحث عن تفاصيل القاعدة
    const rule = CONTEXT_RULES.find(r => r.id === id) || {};
    const catMap = {
      HATE_SPEECH:    { category: "خطاب الكراهية",           severity: "HIGH",     reportType: "خطاب كراهية",                       description: "هجوم على أشخاص بسبب العرق أو الدين أو الجنس" },
      BULLYING:       { category: "تنمر ومضايقة",             severity: "HIGH",     reportType: "تنمر أو مضايقة",                   description: "إذلال أو مهاجمة شخص محدد" },
      SEXUAL_CONTENT: { category: "محتوى جنسي",               severity: "CRITICAL", reportType: "محتوى جنسي أو إباحي",              description: "محتوى جنسي صريح أو إباحي" },
      VIOLENCE:       { category: "عنف وتهديدات",             severity: "CRITICAL", reportType: "عنف أو تهديد مباشر",               description: "تهديد بالعنف أو الدعوة له" },
      SELF_HARM:      { category: "انتحار وإيذاء النفس",      severity: "CRITICAL", reportType: "محتوى يشجع على الانتحار",          description: "دعوة للانتحار أو إيذاء النفس" },
      SCAM:           { category: "احتيال ونصب",              severity: "HIGH",     reportType: "احتيال أو نصب مالي",               description: "عمليات احتيال أو نصب مالي" },
      PHISHING:       { category: "تصيد إلكتروني",            severity: "HIGH",     reportType: "تصيد إلكتروني",                    description: "سرقة بيانات الدخول" },
      PRIVACY:        { category: "انتهاك الخصوصية",          severity: "HIGH",     reportType: "انتهاك الخصوصية",                  description: "نشر بيانات شخصية بدون إذن" },
      TERRORISM:      { category: "إرهاب وتطرف",              severity: "CRITICAL", reportType: "إرهاب أو تطرف",                    description: "ترويج للإرهاب أو المنظمات الإرهابية" },
      SPAM:           { category: "سبام ومحتوى مضلل",         severity: "MEDIUM",   reportType: "سبام أو محتوى مضلل",              description: "رسائل سبام أو معلومات مضللة" },
      CHILD_EXPLOIT:  { category: "استغلال الأطفال",          severity: "CRITICAL", reportType: "استغلال جنسي للأطفال",             description: "محتوى يستغل أو يؤذي الأطفال" },
      BLACKMAIL:      { category: "ابتزاز إلكتروني",          severity: "CRITICAL", reportType: "ابتزاز إلكتروني",                  description: "تهديد بنشر معلومات مقابل المال أو الجنس" },
      DRUGS:          { category: "مخدرات ومواد محظورة",      severity: "HIGH",     reportType: "ترويج مخدرات",                     description: "بيع أو ترويج المخدرات" },
      WEAPONS:        { category: "أسلحة غير مشروعة",         severity: "HIGH",     reportType: "ترويج أسلحة غير مشروعة",           description: "بيع أو ترويج أسلحة بدون ترخيص" },
      IMPERSONATION:  { category: "انتحال شخصية",             severity: "MEDIUM",   reportType: "انتحال شخصية",                     description: "ادعاء هوية مزيفة للإيهام" },
      INCITEMENT:     { category: "تحريض طائفي/عنصري",        severity: "CRITICAL", reportType: "تحريض على العنف الطائفي",           description: "تحريض على الكراهية بين الطوائف" },
      DEFAMATION:     { category: "تشهير وقذف",               severity: "MEDIUM",   reportType: "تشهير أو قذف",                     description: "نشر معلومات كاذبة للإساءة" },
    };

    const meta = rule.id ? rule : (catMap[id] || {});
    const confidence = Math.min(100, Math.round((entry.score / 10) * 100));

    if (confidence >= 40) { // عتبة الثقة: 40%+
      violations.push({
        ruleId:      id,
        category:    meta.category    || id,
        severity:    meta.severity    || "MEDIUM",
        reportType:  meta.reportType  || id,
        description: meta.description || "",
        score:       entry.score,
        confidence,
      });
    }
  }

  return violations;
}

// ══════════════════════════════════════════════════════════════════════════════
// جلب رسائل المستخدم المستهدف من الـ thread
// ══════════════════════════════════════════════════════════════════════════════
async function getUserMessages(api, threadID, targetUID, maxFetch = 300) {
  const messages   = [];
  let   timestamp  = null;
  const batchSize  = 50;
  const maxBatches = Math.ceil(maxFetch / batchSize);
  let   seen       = new Set();

  for (let i = 0; i < maxBatches; i++) {
    let batch;
    try {
      batch = await new Promise((res, rej) =>
        api.getThreadHistory(threadID, batchSize, timestamp, (e, d) => e ? rej(e) : res(d || []))
      );
    } catch { break; }

    if (!batch || !batch.length) break;

    for (const msg of batch) {
      const sender = String(msg.senderID || msg.authorID || "");
      if (
        sender === targetUID &&
        msg.body && msg.body.trim().length >= 2 &&
        !seen.has(msg.messageID)
      ) {
        seen.add(msg.messageID);
        messages.push({
          body:      msg.body.trim(),
          messageID: msg.messageID,
          timestamp: msg.timestamp,
        });
      }
    }

    const oldest = batch[0]?.timestamp;
    if (!oldest || oldest === timestamp) break;
    timestamp = oldest;
    if (messages.length >= maxFetch) break;
    await sleep(randInt(200, 500));
  }

  return messages;
}

// ══════════════════════════════════════════════════════════════════════════════
// محاولة الإبلاغ عبر FCA API
// ══════════════════════════════════════════════════════════════════════════════
async function tryReport(api, msg) {
  for (const fn of ["reportMessage", "report", "reportSpam"]) {
    if (typeof api[fn] === "function") {
      try {
        await new Promise((res, rej) =>
          api[fn](msg.messageID, (e) => e ? rej(e) : res())
        );
        return true;
      } catch (_) {}
    }
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// أدوات العرض
// ══════════════════════════════════════════════════════════════════════════════
const SEV_ICON   = { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢" };
const SEV_ORDER  = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const CONF_LABEL = (c) => c >= 90 ? "مؤكد ✅" : c >= 70 ? "عالية ⬆" : c >= 50 ? "متوسطة ➡" : "محتملة ⬇";

// ══════════════════════════════════════════════════════════════════════════════
// الأمر الرئيسي
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  config: {
    name:        "بلغ",
    aliases:     ["report", "balagh", "balaghna"],
    description: "مراجعة عميقة لرسائل شخص والإبلاغ عن المخالفات وفق قوانين مجتمع فيسبوك",
    usage:       "بلغ  (ردّ على رسالة الشخص المستهدف)",
    adminOnly:   true,
    ownerOnly:   false,
    category:    "admin",
  },

  async run({ api, event, threadID }) {
    const reply = event.messageReply;

    if (!reply) {
      return api.sendMessage(
        "⚠️ ردّ على رسالة الشخص الذي تريد الإبلاغ عنه ثم اكتب:\nميكائيل بلغ",
        threadID
      );
    }

    const targetUID = String(reply.senderID || "");
    const botUID    = String(api.getCurrentUserID());

    if (!targetUID)
      return api.sendMessage("❌ تعذّر تحديد هوية الشخص.", threadID);
    if (targetUID === botUID)
      return api.sendMessage("❌ لا أستطيع الإبلاغ عن نفسي.", threadID);
    if (global.isAdmin && global.isAdmin(targetUID))
      return api.sendMessage("❌ لا يمكن الإبلاغ عن أدمن البوت.", threadID);

    // ── اسم الهدف ─────────────────────────────────────────────────────────
    let targetName = targetUID;
    try {
      const info = await new Promise((res, rej) =>
        api.getUserInfo([targetUID], (e, d) => e ? rej(e) : res(d || {}))
      );
      targetName = info[targetUID]?.name || targetUID;
    } catch (_) {}

    // ── بدء التحليل ────────────────────────────────────────────────────────
    const scanMsg = await new Promise(r =>
      api.sendMessage(
        `🔎 جارٍ الفحص العميق لرسائل ${targetName}…\n` +
        `⚙️ المحرك: 17 فئة مخالفة | طبقات تحليل متعددة | تطبيع اللهجات\n` +
        `⏳ انتظر من فضلك…`,
        threadID, (_, info) => r(info)
      )
    );

    // ── جلب الرسائل ────────────────────────────────────────────────────────
    let userMessages;
    try {
      userMessages = await getUserMessages(api, threadID, targetUID, 300);
    } catch (e) {
      return api.sendMessage(`❌ فشل جلب الرسائل: ${e?.message || e}`, threadID);
    }

    if (!userMessages.length) {
      return api.sendMessage(`ℹ️ لم أجد رسائل لـ ${targetName} في هذه المحادثة.`, threadID);
    }

    // ── تحليل كل رسالة ─────────────────────────────────────────────────────
    const violations = [];
    let reportedCount = 0;

    for (const msg of userMessages) {
      const found = analyzeMessage(msg.body);
      if (found.length) {
        const reported = await tryReport(api, msg);
        if (reported) reportedCount++;
        violations.push({ msg, violations: found, reported });
      }
      // تأخير خفيف بين كل رسالة لتخفيف حمل المعالج
      await sleep(20);
    }

    // ── تحليل السلوك العام ────────────────────────────────────────────────
    const behaviorViolations = detectBehavioralPatterns(userMessages);

    // ── لا مخالفات ────────────────────────────────────────────────────────
    if (!violations.length && !behaviorViolations.length) {
      return api.sendMessage(
        `✅ فحص اكتمل — لا مخالفات\n` +
        `${"─".repeat(32)}\n` +
        `👤 الشخص: ${targetName}\n` +
        `📊 عدد الرسائل المفحوصة: ${userMessages.length}\n` +
        `🔍 طبقات التحليل: كلمات | سياق | سلوك | لهجات\n\n` +
        `✅ جميع الرسائل نظيفة ولا تخالف قوانين مجتمع فيسبوك.`,
        threadID
      );
    }

    // ══════════════════════════════════════════════════════════════════════
    // بناء التقرير التفصيلي
    // ══════════════════════════════════════════════════════════════════════

    // تجميع حسب الفئة مع أعلى درجة ثقة
    const byCategory = new Map();
    for (const v of violations) {
      for (const viol of v.violations) {
        const existing = byCategory.get(viol.ruleId);
        if (!existing) {
          byCategory.set(viol.ruleId, {
            ...viol, count: 1, samples: [v.msg.body.slice(0, 70)],
          });
        } else {
          existing.count++;
          existing.confidence = Math.max(existing.confidence, viol.confidence);
          if (existing.samples.length < 3)
            existing.samples.push(v.msg.body.slice(0, 70));
        }
      }
    }

    // إضافة مخالفات سلوكية
    for (const bv of behaviorViolations) {
      byCategory.set(bv.id, { ...bv, count: 1, samples: [], confidence: 80 });
    }

    const sorted = [...byCategory.values()].sort(
      (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
    );

    const totalViolatingMsgs = violations.length;
    const criticalCount      = [...byCategory.values()].filter(c => c.severity === "CRITICAL").length;

    // ── الرسالة الرئيسية ──────────────────────────────────────────────────
    let report = `🚨 تقرير البلاغات — ${targetName}\n`;
    report += `${"═".repeat(34)}\n`;
    report += `👤 الهدف: ${targetName} (${targetUID})\n`;
    report += `📊 رسائل مفحوصة: ${userMessages.length}\n`;
    report += `🚫 رسائل مخالفة: ${totalViolatingMsgs}\n`;
    report += `📂 فئات مخالفة: ${byCategory.size}\n`;
    if (reportedCount > 0)
      report += `📤 تم الإبلاغ فعلياً: ${reportedCount} رسالة\n`;
    if (criticalCount > 0)
      report += `🔴 مخالفات حرجة: ${criticalCount} فئة\n`;
    report += `${"─".repeat(34)}\n\n`;

    report += `📋 تفاصيل الفئات:\n\n`;

    for (const cat of sorted) {
      const icon = SEV_ICON[cat.severity] || "⚪";
      const conf = CONF_LABEL(cat.confidence || 70);
      report += `${icon} ${cat.category}\n`;
      report += `   📌 البلاغ: ${cat.reportType}\n`;
      report += `   🔢 عدد الرسائل: ${cat.count}\n`;
      report += `   🎯 درجة الثقة: ${conf}\n`;
      report += `   📝 ${cat.description}\n`;
      if (cat.samples?.length) {
        report += `   💬 "${cat.samples[0].slice(0, 65)}${cat.samples[0].length > 65 ? "…" : ""}"\n`;
      }
      report += "\n";
    }

    report += `${"─".repeat(34)}\n`;
    if (reportedCount > 0) {
      report += `✅ تم تقديم ${reportedCount} بلاغ لفيسبوك.\n`;
      report += `⏳ ستُراجَع خلال 24-48 ساعة.`;
    } else {
      report += `📌 البلاغات المناسبة:\n`;
      sorted.forEach(c => { report += `  • ${c.reportType}\n`; });
      report += `\n💡 ادخل على الرسائل يدوياً وابلغ ← الإبلاغ ← ${sorted[0]?.reportType || "مخالفة"}.`;
    }

    await api.sendMessage(report, threadID);

    // ── رسالة المخالفات الحرجة بالتفصيل ────────────────────────────────
    const criticals = violations.filter(v =>
      v.violations.some(x => x.severity === "CRITICAL")
    );

    if (criticals.length > 0) {
      await sleep(1500);
      let critMsg = `🔴 مخالفات حرجة — تفاصيل دقيقة:\n${"═".repeat(30)}\n\n`;
      for (const v of criticals.slice(0, 4)) {
        const cats = [...new Set(v.violations.filter(x => x.severity === "CRITICAL").map(x => x.category))];
        const maxConf = Math.max(...v.violations.map(x => x.confidence || 70));
        critMsg += `⛔ الفئة: ${cats.join(" | ")}\n`;
        critMsg += `   📊 ثقة التحليل: ${CONF_LABEL(maxConf)}\n`;
        critMsg += `   💬 "${v.msg.body.slice(0, 90)}${v.msg.body.length > 90 ? "…" : ""}"\n\n`;
      }
      critMsg += `${"─".repeat(30)}\n`;
      critMsg += `⚡ هذه المخالفات تستلزم حذف المحتوى فوراً وتقديم بلاغ عاجل.`;
      await api.sendMessage(critMsg, threadID);
    }

    // ── ملخص نهائي مضغوط ────────────────────────────────────────────────
    await sleep(1200);
    const riskLevel =
      criticalCount >= 3 ? "🔴 خطر شديد" :
      criticalCount >= 1 ? "🟠 خطر عالٍ" :
      sorted.some(c => c.severity === "HIGH") ? "🟡 خطر متوسط" : "🟢 منخفض";

    await api.sendMessage(
      `📊 ملخص نهائي:\n` +
      `${"─".repeat(28)}\n` +
      `👤 ${targetName}\n` +
      `⚠️ مستوى الخطر: ${riskLevel}\n` +
      `🚫 ${totalViolatingMsgs} / ${userMessages.length} رسالة مخالفة\n` +
      `📂 ${byCategory.size} فئة مخالفة مكتشفة\n` +
      (reportedCount > 0 ? `📤 ${reportedCount} بلاغ قُدّم لفيسبوك ✅` : `💡 ابلغ يدوياً من داخل الرسائل`),
      threadID
    );
  },
};
