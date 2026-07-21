/* Ask NIVI Intelligence — offline demo chat for the coffee passport */
(function () {
  const thread = document.getElementById("ask-thread");
  const suggestionsEl = document.getElementById("ask-suggestions");
  const form = document.getElementById("ask-form");
  const input = document.getElementById("ask-input");
  if (!thread || !form || !input) return;

  const data = window.PASSPORT || {};

  const WELCOME =
    "Hi — I’m NIVI Intelligence. I can explain this Continental Coffee passport: Farm 147 crop health, harvest batch CC-AR-2026-00481, lab EU risk, voyage status, EUDR twin, carbon, and whether to accept the shipment.";

  const STARTERS = [
    "Why is crop health 95%?",
    "Should I accept this shipment?",
    "Is Farm 147 EUDR ready?",
    "What’s the carbon footprint?",
    "Explain the red heatmap patch",
  ];

  const REPLIES = [
    {
      match: /health|95|crop|ndvi|heatmap|red|stress|why/i,
      text:
        "Farm 147 crop health is 95% Good.\n\n• Dense vegetation covers 97.37% of the verified GPS boundary.\n• The small yellow/red heatmap edge is localized moisture stress (<2% of plot), not canopy failure.\n• Recommendation: targeted drip on Block A north edge within 36 hours — expected +2.1% yield probability vs waiting.",
      suggestions: ["Should I accept this shipment?", "Show harvest evidence", "What’s the carbon footprint?"],
    },
    {
      match: /accept|shipment|buy|recommend|risk|reject|hamburg|roaster/i,
      text:
        "AI recommendation: Accept Shipment.\n\n• Quality 98% · Moisture 11.2% · Plantation AA\n• Lab EU acceptance probability 99% · rejection 0.8%\n• Certificates valid · container IoT stable · quality risk None\n• Destination Hamburg · Continental track record 99.2% EU acceptance across 142 shipments.",
      suggestions: ["Is Farm 147 EUDR ready?", "Explain Line 3 processing", "What’s the carbon footprint?"],
    },
    {
      match: /eudr|deforestation|twin|parcel|legal|regulation/i,
      text:
        "EUDR-ready path for this batch:\n\n• Batch CC-AR-2026-00481 is linked to Farm 147 Block A GPS polygon (18 vertices, officer-confirmed).\n• Satellite boundary + historical canopy evidence support parcel-level origin.\n• This is the batch-to-land digital twin importers will need for EU market access—not a PDF folder.",
      suggestions: ["Why is crop health 95%?", "Should I accept this shipment?", "First-mile integrity?"],
    },
    {
      match: /carbon|co2|sustainab|footprint|esg|climate/i,
      text:
        "Carbon & sustainability (estimate for demo):\n\n• Batch CO₂e ≈ 1.84 t from farm gate → Hamburg\n• Growing-season sensors + voyage IoT feed an auto sustainability draft\n• Buyers can ask “carbon per mile,” not only origin—premium path for Continental Coffee.",
      suggestions: ["Should I accept this shipment?", "Is Farm 147 EUDR ready?", "Explain the red heatmap patch"],
    },
    {
      match: /harvest|batch|moisture|weight|farmer|ramesh/i,
      text:
        "Harvest evidence for CC-AR-2026-00481:\n\n• Farmer Ramesh Gowda · Block A North Slope · 12 Jan 2026 07:42 IST\n• Weight 1840 kg · moisture 11.2% (meter auto-upload)\n• GPS verified · photos + video captured\n• AI grade: Premium Export · specialty grade High",
      suggestions: ["Explain Line 3 processing", "Should I accept this shipment?", "Why is crop health 95%?"],
    },
    {
      match: /line 3|process|lab|defect|plant|continental/i,
      text:
        "Continental Coffee processing & lab:\n\n• Machine Line 3 · Operator Anita M. · defect 0.8% · high uniformity\n• Lab: ochratoxin / pesticides / heavy metals Pass · screen AA 17/18\n• AI: Approve shipment · shelf life 14 months\n• Line 3 is preferred for European premium buyers.",
      suggestions: ["Should I accept this shipment?", "What’s the carbon footprint?", "Ocean status?"],
    },
    {
      match: /ocean|voyage|container|ship|eta|arabian/i,
      text:
        "Live voyage intelligence:\n\n• Container MSCU8842191 · seal INSEAL-992184\n• Position Arabian Sea · ETA 11 days to Hamburg\n• IoT every 30 min: 18.4°C / 55% RH · shock 0 · door 0\n• Port congestion Low · quality risk None · maintain current route",
      suggestions: ["Should I accept this shipment?", "Customs matched?", "What’s the carbon footprint?"],
    },
    {
      match: /blockchain|first.?mile|fraud|immutable|integrity|hash/i,
      text:
        "First-mile integrity (roadmap + demo posture):\n\n• Harvest GPS, scale weight, and moisture are captured as the batch birth event.\n• Certificate-chain anchoring at farm registration / harvest prevents rewriting organic or origin claims later.\n• Importers see evidence that can’t be silently edited mid-chain.",
      suggestions: ["Is Farm 147 EUDR ready?", "Show harvest evidence", "Should I accept this shipment?"],
    },
    {
      match: /hello|hi\b|hey|help|what can/i,
      text: WELCOME,
      suggestions: STARTERS,
    },
  ];

  function pickReply(q) {
    for (const r of REPLIES) {
      if (r.match.test(q)) return r;
    }
    return {
      text:
        "I can help with this passport’s crop health, harvest batch, Continental processing, lab EU risk, voyage, EUDR twin, carbon, or accept/reject guidance. Try one of the suggestions below.",
      suggestions: STARTERS,
    };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function addMessage(role, text) {
    const bubble = el("div", `ask-msg ask-msg--${role}`);
    const who = el("div", "ask-msg__who", role === "nivi" ? "NIVI" : "You");
    const body = el("div", "ask-msg__body");
    body.innerHTML = text
      .split("\n")
      .map((line) => {
        const t = line.trim();
        if (!t) return "<br />";
        return `<p>${t.replace(/</g, "&lt;")}</p>`;
      })
      .join("");
    bubble.appendChild(who);
    bubble.appendChild(body);
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
  }

  function renderSuggestions(list) {
    suggestionsEl.innerHTML = "";
    (list || STARTERS).forEach((label) => {
      const btn = el("button", "ask-chip", label);
      btn.type = "button";
      btn.addEventListener("click", () => ask(label));
      suggestionsEl.appendChild(btn);
    });
  }

  function ask(question) {
    const q = (question || "").trim();
    if (!q) return;
    addMessage("user", q);
    input.value = "";
    const reply = pickReply(q);
    window.setTimeout(() => {
      addMessage("nivi", reply.text);
      renderSuggestions(reply.suggestions);
    }, 280);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });

  addMessage("nivi", WELCOME + (data.batch ? `\n\nActive batch: ${data.batch} · ${data.farmId || "Farm 147"}.` : ""));
  renderSuggestions(STARTERS);
})();
