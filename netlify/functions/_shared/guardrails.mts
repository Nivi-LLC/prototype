import passport from "./passport.json";

export const REFUSAL =
  "I only have information for Farm 147 and this batch (CC-AR-2026-00481).";

const ALLOW =
  /\b(farm\s*147|batch|shipment|po-?2026|ship-?2026|cc-ar|crop|health|ndvi|heatmap|moisture|eudr|accept|reject|risk|lab|voyage|container|carbon|kodagu|surlabbi|somwarpet|continental|arabica|coffee|harvest|passport|quality|hamburg|certificate|ochratoxin|pesticide|weather|disease|canopy|polygon|gps|roasting|importer|verdict|eu\b|mrl|iot|seal|phytosanitary|coa|pallet|bag|truck|processing|warehouse|customs|twin|satellite|stress|dense|sparse|yield|elevation|soil|rainfall|block\s*a|history|historical|origin|journey|story|background|previous|past|memory|bean|cherry|grade|plantation|shade|farmer|ramesh|gowda|tell me|about this|this batch|this farm|price|pricing|market|rate|cost|₹|inr|eur|euro|rupee|100\s*g|100g|gram|kg|fob|retail|premium)\b/i;

/** Short follow-ups only — not open-ended off-topic questions. */
const FOLLOWUP =
  /^(why|how|what about|and\b|also\b|more\b|explain|details?|yes|no|ok|please|continue|go on|tell me more|same|that|those|it)\b/i;

const BLOCK = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)/i,
  /disregard\s+(all\s+)?(previous|prior|above|instructions|rules)/i,
  /system\s+prompt/i,
  /\b(jailbreak|developer\s+mode|dan\b)/i,
  /you\s+are\s+now\b/i,
  /pretend\s+(you|to\s+be)/i,
  /act\s+as\s+if\s+you\s+have\s+no/i,
  /new\s+instructions\s*:/i,
  /\bfarm\s*(?!147\b)\d+\b/i,
  /\b(brazil|colombia|ethiopia|vietnam|guatemala|honduras|peru|mexico|uganda)\b/i,
  /\b(code|python|javascript|typescript|sql|script|program|function|hello\s*world)\b/i,
  /\b(write|generate|run|create|show|give)\b.{0,40}\b(code|script|program|function|snippet)\b/i,
  /\b(bitcoin|ethereum|stock\s+tip|who\s+is\s+the\s+president|recipe\s+for)\b/i,
  /\b(other\s+farms?|another\s+farm|different\s+farm)\b/i,
  /\b(kansas|overland\s*park|tourism|things\s+to\s+do|vacation|hotel|restaurant)\b/i,
];

export function gateQuestion(question: string, hasHistory: boolean): { ok: boolean; refusal: string } {
  const q = String(question || "").trim();
  if (!q || q.length > 500) return { ok: false, refusal: REFUSAL };
  for (const re of BLOCK) {
    if (re.test(q)) return { ok: false, refusal: REFUSAL };
  }
  if (ALLOW.test(q)) return { ok: true, refusal: REFUSAL };
  if (hasHistory && q.length <= 60 && FOLLOWUP.test(q) && !/[`{}<>]/.test(q)) {
    return { ok: true, refusal: REFUSAL };
  }
  return { ok: false, refusal: REFUSAL };
}

export function gateAnswer(answer: string): string {
  const text = String(answer || "").trim();
  if (!text) return REFUSAL;

  // Soft refusals that keep talking ("However…", code, travel tips) → hard refuse
  if (text.includes("I only have information for Farm 147")) {
    if (text.length > REFUSAL.length + 12) return REFUSAL;
    return REFUSAL;
  }

  const hasCode =
    /```/.test(text) ||
    /\b(import\s+\w+|def\s+\w+\s*\(|print\s*\(|console\.log|function\s+\w+\s*\()/i.test(text);
  const offTopic =
    /\b(kansas|overland\s*park|hello\s*,?\s*world|tourism|vacation|hotel)\b/i.test(text);
  const offOrigin =
    /\b(brazil|colombia|ethiopia|vietnam|guatemala|honduras)\b/i.test(text) &&
    !/\bfarm\s*147\b/i.test(text);
  const leak = /system prompt|as a large language model|ignore my previous/i.test(text);
  const otherFarm = /\bfarm\s*(?!147\b)\d+\b/i.test(text);
  if (hasCode || offTopic || offOrigin || leak || otherFarm) return REFUSAL;
  // Long answers must still look farm/batch-related
  if (text.length > 80 && !ALLOW.test(text)) return REFUSAL;
  return text;
}

export function buildSystemPrompt(): string {
  return `You are NIVI Intelligence for Continental Coffee, Farm 147, Kodagu, India (batch CC-AR-2026-00481 → Hamburg).

STRICT RULES:
- Answer ONLY about Farm 147 / this batch using CONTEXT below.
- If the user asks for code, programming, travel, cities, general knowledge, or anything outside CONTEXT, reply with EXACTLY this sentence and nothing else: ${REFUSAL}
- Never say "However", never add examples, never invent code, never discuss other places.
- Cover farm/coffee history for this farm and batch, crop health, NDVI/heatmap, harvest, processing, lab/EU risk, voyage, EUDR, carbon, accept/reject, and marketPricing when asked.
- For price / market rate / 100g questions, use CONTEXT.marketPricing (demo rates). State asOf and that figures are demo batch-linked.
- Keep answers concise. English only. Do not invent other farms or live market quotes outside CONTEXT.marketPricing.

CONTEXT:
${JSON.stringify(passport, null, 2)}`;
}

type ChatTurn = { role: string; content: string };

export function sanitizeHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return [];
  const out: ChatTurn[] = [];
  for (const item of history.slice(-6)) {
    if (!item || typeof item !== "object") continue;
    const role = String((item as ChatTurn).role || "");
    const content = String((item as ChatTurn).content || "").trim();
    if ((role !== "user" && role !== "assistant") || !content) continue;
    if (content.length > 2000) continue;
    if (/system prompt|ignore previous/i.test(content) && role === "user") continue;
    // Drop off-topic / code turns so the model is not steered away from the farm
    if (role === "user" && !gateQuestion(content, true).ok) continue;
    if (role === "assistant") {
      const cleaned = gateAnswer(content);
      if (cleaned === REFUSAL && content !== REFUSAL) continue;
      out.push({ role, content: cleaned });
      continue;
    }
    out.push({ role, content });
  }
  return out;
}

export function sseText(text: string): string {
  const payload = JSON.stringify({
    choices: [{ delta: { content: text } }],
  });
  return `data: ${payload}\n\ndata: [DONE]\n\n`;
}
