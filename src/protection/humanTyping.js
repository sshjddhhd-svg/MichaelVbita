"use strict";

/**
 * Human Typing Simulation — WHITE Engine
 * ==========================================
 * يعمل على مستوى api.sendMessage مباشرةً.
 * أي أمر (حالي أو مستقبلي) يستدعي api.sendMessage
 * سيحصل تلقائياً على مؤشر الكتابة + تأخير واقعي
 * بدون أي تعديل في كود الأمر.
 *
 * إصلاح v2: cooldown للـ typing indicator لكل thread
 * منع spam مؤشر الكتابة عند الأوامر المتعددة المتزامنة
 */

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Cooldown map: threadID → last typing indicator timestamp ──────────────
// نتجنب إرسال typing indicator إذا أُرسل منذ أقل من TYPING_COOLDOWN_MS
const _typingLastSent = new Map();
const TYPING_COOLDOWN_MS = 5000; // 5 ثوانٍ

function canSendTyping(threadID) {
  const last = _typingLastSent.get(String(threadID)) || 0;
  return (Date.now() - last) >= TYPING_COOLDOWN_MS;
}

function markTypingSent(threadID) {
  _typingLastSent.set(String(threadID), Date.now());
}

// تنظيف دوري لمنع تراكم الـ map
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [k, v] of _typingLastSent.entries()) {
    if (v < cutoff) _typingLastSent.delete(k);
  }
}, 30000);

// ─── حساب مدة الكتابة بناءً على طول النص ──────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function extractText(msg) {
  if (!msg) return "";
  if (typeof msg === "string") return msg;
  if (typeof msg === "object") {
    return msg.body || msg.message || msg.text || "";
  }
  return "";
}

/**
 * يحسب مدة الكتابة الواقعية بناءً على طول النص
 * تخفيض الحد الأقصى من 7000ms → 3500ms لتقليل التراكم
 */
function calcTypingDelay(text) {
  const len = (text || "").length;
  if (len === 0) return randInt(400, 900);

  // 28ms لكل حرف، حد أدنى 500ms، حد أقصى 3500ms (خُفِّض من 7000)
  const base = Math.min(Math.max(len * 28, 500), 3500);

  // تشويش ±20%
  const jitter = base * (0.80 + Math.random() * 0.40);

  return Math.round(jitter);
}

// ─── إرسال مؤشر الكتابة مع cooldown ────────────────────────────────────────
async function sendTypingIndicator(api, threadID) {
  // تجاهل إذا أُرسل مؤخراً لنفس الـ thread
  if (!canSendTyping(threadID)) return;

  try {
    markTypingSent(threadID);
    await new Promise((resolve) => {
      const result = api.sendTypingIndicator(threadID, () => resolve());
      if (result && typeof result.then === "function") {
        result.then(resolve).catch(resolve);
      }
      setTimeout(resolve, 500);
    });
  } catch (_) {}
}

// ─── المحاكاة الكاملة: مؤشر + انتظار ─────────────────────────────────────
async function simulateTyping(api, threadID, msg) {
  const cfg = global.config?.humanTyping || {};
  if (cfg.enable === false) return;

  const text = extractText(msg);
  const delay = calcTypingDelay(text);

  // أرسل مؤشر الكتابة (مع cooldown — لن يُرسَل إذا أُرسل منذ أقل من 5 ثوانٍ)
  await sendTypingIndicator(api, threadID);

  // انتظر المدة الواقعية
  await sleep(delay);

  // وقفة صغيرة قبل الإرسال
  await sleep(randInt(100, 300));
}

// ─── تغليف api.sendMessage ─────────────────────────────────────────────────
function wrapWithTyping(api) {
  if (api.__typingWrapped) {
    console.log("[HUMAN_TYPING] ⚡ Already wrapped — skipping");
    return;
  }
  api.__typingWrapped = true;

  const _originalSend = api.sendMessage.bind(api);

  api.sendMessage = async function wrappedSendMessage(msg, threadID, callback, messageID) {
    try {
      await simulateTyping(api, threadID, msg);
    } catch (_) {}

    return _originalSend(msg, threadID, callback, messageID);
  };

  console.log("[HUMAN_TYPING] ✅ api.sendMessage wrapped — typing simulation active (cooldown: 5s/thread)");
}

function unwrapTyping(api) {
  if (!api.__typingWrapped) return;
  delete api.__typingWrapped;
}

module.exports = { wrapWithTyping, unwrapTyping, simulateTyping, calcTypingDelay };
