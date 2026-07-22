/* Farm 147 access control — client-side gate (server enforces the same rules). */
(function (global) {
  const REFUSAL =
    "I only have information for Farm 147 and this batch (CC-AR-2026-00481).";

  const ALLOW =
    /\b(farm\s*147|batch|shipment|po-?2026|ship-?2026|cc-ar|crop|health|ndvi|heatmap|moisture|eudr|accept|reject|risk|lab|voyage|container|carbon|kodagu|surlabbi|somwarpet|continental|arabica|coffee|harvest|passport|quality|hamburg|certificate|ochratoxin|pesticide|weather|disease|canopy|polygon|gps|roasting|importer|verdict|eu\b|mrl|iot|seal|phytosanitary|coa|pallet|bag|truck|processing|warehouse|customs|twin|satellite|stress|dense|sparse|yield|elevation|soil|rainfall|block\s*a|history|historical|origin|journey|story|background|previous|past|memory|bean|cherry|grade|plantation|shade|farmer|ramesh|gowda|tell me|about this|this batch|this farm|price|pricing|market|rate|cost|₹|inr|eur|euro|rupee|100\s*g|100g|gram|kg|fob|retail|premium)\b/i;

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

  function gateQuestion(question, hasHistory) {
    const q = String(question || "").trim();
    if (!q) return { ok: false, refusal: REFUSAL };
    if (q.length > 500) return { ok: false, refusal: REFUSAL };
    for (let i = 0; i < BLOCK.length; i += 1) {
      if (BLOCK[i].test(q)) return { ok: false, refusal: REFUSAL };
    }
    if (ALLOW.test(q)) return { ok: true, refusal: REFUSAL };
    if (hasHistory && q.length <= 80 && !/[`{}<>]/.test(q)) return { ok: true, refusal: REFUSAL };
    return { ok: false, refusal: REFUSAL };
  }

  function gateAnswer(answer) {
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

  global.NIVI_FARM_GUARD = {
    REFUSAL,
    gateQuestion,
    gateAnswer,
  };
})(window);
