import passport from "./passport.json";

export const REFUSAL =
  "I only have information for Farm 147 and this batch (CC-AR-2026-00481).";

const ALLOW =
  /\b(farm\s*147|batch|shipment|po-?2026|ship-?2026|cc-ar|crop|health|ndvi|heatmap|moisture|eudr|accept|reject|risk|lab|voyage|container|carbon|kodagu|surlabbi|somwarpet|continental|arabica|harvest|passport|quality|hamburg|certificate|ochratoxin|pesticide|weather|disease|canopy|polygon|gps|roasting|importer|verdict|eu\b|mrl|iot|seal|phytosanitary|coa|pallet|bag|truck|processing|warehouse|customs|twin|satellite|stress|dense|sparse|yield|elevation|soil|rainfall|block\s*a)\b/i;

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
  /\b(write|generate|run)\s+(some\s+)?(code|python|javascript|typescript|sql)\b/i,
  /\b(bitcoin|ethereum|stock\s+tip|who\s+is\s+the\s+president|recipe\s+for)\b/i,
  /\b(other\s+farms?|another\s+farm|different\s+farm)\b/i,
];

export function gateQuestion(question: string, hasHistory: boolean): { ok: boolean; refusal: string } {
  const q = String(question || "").trim();
  if (!q || q.length > 500) return { ok: false, refusal: REFUSAL };
  for (const re of BLOCK) {
    if (re.test(q)) return { ok: false, refusal: REFUSAL };
  }
  if (ALLOW.test(q)) return { ok: true, refusal: REFUSAL };
  if (hasHistory && q.length <= 80 && !/[`{}<>]/.test(q)) return { ok: true, refusal: REFUSAL };
  return { ok: false, refusal: REFUSAL };
}

export function gateAnswer(answer: string): string {
  const text = String(answer || "").trim();
  if (!text) return REFUSAL;
  if (text.includes("I only have information for Farm 147")) return text;
  const offOrigin =
    /\b(brazil|colombia|ethiopia|vietnam|guatemala|honduras)\b/i.test(text) &&
    !/\bfarm\s*147\b/i.test(text);
  const leak = /system prompt|as a large language model|ignore my previous/i.test(text);
  const otherFarm = /\bfarm\s*(?!147\b)\d+\b/i.test(text);
  if (offOrigin || leak || otherFarm) return REFUSAL;
  return text;
}

export function buildSystemPrompt(): string {
  return `You are NIVI Intelligence for Continental Coffee, Farm 147, Kodagu, India (batch CC-AR-2026-00481 → Hamburg).

Answer helpfully using only the CONTEXT below. Cover crop health, NDVI/heatmap, harvest, lab/EU risk, voyage, EUDR, carbon, and accept/reject when asked.
If something is not in CONTEXT, say: "${REFUSAL}"
Stay on Farm 147 / this batch. Keep answers concise with short paragraphs or simple hyphen bullets. English only. Do not invent other farms or market news.

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
