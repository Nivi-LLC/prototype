/* Farm 147 access control — client-side gate (server enforces the same rules). */
(function (global) {
  const REFUSAL_EN = "I don't have that in this passport. I can only answer about Farm 147 and this batch's risk factors.";
  const REFUSAL_KN = "ಈ ಪಾಸ್‌ಪೋರ್ಟ್‌ನಲ್ಲಿ ಅದು ಇಲ್ಲ. ನಾನು ಕೇವಲ Farm 147 ಮತ್ತು ಈ ಬ್ಯಾಚ್‌ನ ಅಪಾಯ ಅಂಶಗಳ ಬಗ್ಗೆ ಮಾತ್ರ ಉತ್ತರಿಸಬಲ್ಲೆ.";
  const REFUSAL_TE = "ఈ పాస్‌ಪోర్ట్‌లో అది లేదు. నేను Farm 147 మరియు ఈ బ్యాచ్ రిస్క్ అంశాల గురించి మాత్రమే సమాధానం ఇవ్వగలను.";

  const HAS_KANNADA = /[\u0C80-\u0CFF]/;
  const HAS_TELUGU = /[\u0C00-\u0C7F]/;

  const ALLOW =
    /\b(farm\s*147|batch|shipment|po-?2026|ship-?2026|cc-ar|crop|health|ndvi|heatmap|moisture|eudr|accept|reject|risk|lab|voyage|container|carbon|kodagu|surlabbi|somwarpet|continental|arabica|harvest|passport|quality|hamburg|certificate|ochratoxin|pesticide|weather|disease|canopy|polygon|gps|roasting|importer|verdict|eu\b|mrl|iot|seal|phytosanitary|coa|pallet|bag|truck|processing|warehouse|customs|twin|satellite|stress|dense|sparse|yield|elevation|soil|rainfall|block\s*a|kannada|telugu)\b|ಕನ್ನಡ|తెలుగు/i;

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

  function detectLang(text) {
    const t = String(text || "");
    if (HAS_KANNADA.test(t) || /\bkannada\b/i.test(t)) return "kn";
    if (HAS_TELUGU.test(t) || /\btelugu\b/i.test(t)) return "te";
    return "en";
  }

  function refusalFor(question) {
    const lang = detectLang(question);
    if (lang === "kn") return REFUSAL_KN;
    if (lang === "te") return REFUSAL_TE;
    return REFUSAL_EN;
  }

  function gateQuestion(question, hasHistory) {
    const q = String(question || "").trim();
    const refusal = refusalFor(q);
    if (!q) return { ok: false, refusal };
    if (q.length > 500) return { ok: false, refusal };
    for (let i = 0; i < BLOCK.length; i += 1) {
      if (BLOCK[i].test(q)) return { ok: false, refusal };
    }
    if (ALLOW.test(q)) return { ok: true, refusal };
    if ((HAS_KANNADA.test(q) || HAS_TELUGU.test(q)) && q.length <= 220) {
      return { ok: true, refusal };
    }
    if (hasHistory && q.length <= 80 && !/[`{}<>]/.test(q)) return { ok: true, refusal };
    return { ok: false, refusal };
  }

  function gateAnswer(answer, question) {
    const text = String(answer || "").trim();
    const refusal = refusalFor(question || "");
    if (!text) return refusal;
    if (
      text.includes("I don't have that in this passport") ||
      text.includes("ಈ ಪಾಸ್‌ಪೋರ್ಟ್‌ನಲ್ಲ") ||
      text.includes("ఈ పాస్‌ಪోర్ట్‌లో")
    ) {
      return text;
    }
    const offOrigin =
      /\b(brazil|colombia|ethiopia|vietnam|guatemala|honduras)\b/i.test(text) &&
      !/\bfarm\s*147\b/i.test(text);
    const leak = /system prompt|as a large language model|ignore my previous/i.test(text);
    const otherFarm = /\bfarm\s*(?!147\b)\d+\b/i.test(text);
    if (offOrigin || leak || otherFarm) return refusal;
    return text;
  }

  global.NIVI_FARM_GUARD = {
    REFUSAL: REFUSAL_EN,
    REFUSAL_EN,
    REFUSAL_KN,
    REFUSAL_TE,
    detectLang,
    refusalFor,
    gateQuestion,
    gateAnswer,
  };
})(window);
