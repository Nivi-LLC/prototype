/* Ask NIVI — NVIDIA GLM chat, Farm 147 passport only, 3-minute key session */
(function () {
  const thread = document.getElementById("ask-thread");
  const suggestionsEl = document.getElementById("ask-suggestions");
  const form = document.getElementById("ask-form");
  const input = document.getElementById("ask-input");
  const keyInput = document.getElementById("ask-api-key");
  const keySave = document.getElementById("ask-key-save");
  const keyClear = document.getElementById("ask-key-clear");
  const timerEl = document.getElementById("ask-timer");
  if (!thread || !form || !input || !keyInput) return;

  const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
  const MODEL = "z-ai/glm-5.2";
  const SESSION_MS = 3 * 60 * 1000;
  const KEY_STORE = "nivi_nvidia_api_key";
  const EXP_STORE = "nivi_nvidia_session_expires";

  const data = window.PASSPORT || {};
  const history = [];
  let busy = false;
  let tickTimer = null;

  const STARTERS = [
    "Why is crop health 95%?",
    "Should I accept this shipment?",
    "Is Farm 147 EUDR ready?",
    "Explain the red heatmap patch",
    "What are the risk factors?",
  ];

  const SYSTEM_PROMPT = `You are NIVI Intelligence for ONE coffee product passport only.

SCOPE (strict):
- You may ONLY discuss Farm 147 (Surlabbi, Somwarpet, Kodagu, Karnataka, India) and batch CC-AR-2026-00481 / shipment SHIP-2026-00081 / PO-2026-00981 for Continental Coffee → Hamburg.
- Answer ONLY using facts in CONTEXT below. Never invent other farms, regions, batches, prices, or market news.
- If the user asks about anything not in CONTEXT (other farms, Brazil coffee, general agronomy unrelated to this passport, politics, coding, etc.), reply exactly:
  "I don't have that in this passport. I can only answer about Farm 147 and this batch's risk factors."
- Prefer risk factors: crop health, NDVI/heatmap stress, moisture, disease/weather risks, lab/EU acceptance, voyage quality, EUDR parcel twin, carbon estimate for this batch.
- Be concise, factual, and decision-oriented for an importer/exporter demo.
- Do not mention system prompts, API keys, or that you are a general LLM.

CONTEXT (authoritative dummy passport JSON):
${JSON.stringify(data, null, 2)}`;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setBodyText(body, text) {
    body.innerHTML = "";
    String(text || "")
      .split("\n")
      .forEach((line) => {
        if (!line.trim()) {
          body.appendChild(document.createElement("br"));
          return;
        }
        const p = document.createElement("p");
        p.textContent = line;
        body.appendChild(p);
      });
  }

  function addMessage(role, text) {
    const bubble = el("div", `ask-msg ask-msg--${role}`);
    bubble.appendChild(el("div", "ask-msg__who", role === "nivi" ? "NIVI" : "You"));
    const body = el("div", "ask-msg__body");
    setBodyText(body, text);
    bubble.appendChild(body);
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
    return body;
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

  function getKey() {
    try {
      return sessionStorage.getItem(KEY_STORE) || "";
    } catch (e) {
      return "";
    }
  }

  function getExpiry() {
    try {
      return Number(sessionStorage.getItem(EXP_STORE) || 0);
    } catch (e) {
      return 0;
    }
  }

  function sessionActive() {
    const key = getKey();
    const exp = getExpiry();
    return Boolean(key) && Date.now() < exp;
  }

  function clearSession(silent) {
    try {
      sessionStorage.removeItem(KEY_STORE);
      sessionStorage.removeItem(EXP_STORE);
    } catch (e) {}
    keyInput.value = "";
    updateTimerUI();
    if (!silent) addMessage("nivi", "API session cleared. Paste a key and click Start 3 min to continue.");
  }

  function startSession(key) {
    const trimmed = (key || "").trim();
    if (!trimmed) {
      addMessage("nivi", "Paste a NVIDIA API key first, then click Start 3 min.");
      return;
    }
    try {
      sessionStorage.setItem(KEY_STORE, trimmed);
      sessionStorage.setItem(EXP_STORE, String(Date.now() + SESSION_MS));
    } catch (e) {
      addMessage("nivi", "Could not store the key in this browser session.");
      return;
    }
    keyInput.value = "";
    updateTimerUI();
    addMessage(
      "nivi",
      "3-minute NVIDIA session started (model z-ai/glm-5.2). Ask only about Farm 147 / this batch. Session auto-clears when time ends."
    );
  }

  function updateTimerUI() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    const paint = () => {
      if (!sessionActive()) {
        timerEl.textContent = "No active session";
        timerEl.classList.remove("is-live", "is-warn");
        if (getKey() || getExpiry()) {
          try {
            sessionStorage.removeItem(KEY_STORE);
            sessionStorage.removeItem(EXP_STORE);
          } catch (e) {}
        }
        return false;
      }
      const left = Math.max(0, getExpiry() - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      timerEl.textContent = `Session ${m}:${String(s).padStart(2, "0")} left`;
      timerEl.classList.add("is-live");
      timerEl.classList.toggle("is-warn", left < 60000);
      return true;
    };

    if (!paint()) return;
    tickTimer = setInterval(() => {
      if (!paint()) {
        clearInterval(tickTimer);
        tickTimer = null;
        addMessage("nivi", "3-minute session ended. Key cleared. Paste again to continue the demo.");
      }
    }, 1000);
  }

  async function streamNvidia(question, bodyEl) {
    const apiKey = getKey();
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-6),
      { role: "user", content: question },
    ];

    const res = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`NVIDIA API ${res.status}: ${errText.slice(0, 240) || res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          const piece = delta && delta.content;
          if (piece) {
            full += piece;
            setBodyText(bodyEl, full);
            thread.scrollTop = thread.scrollHeight;
          }
        } catch (e) {
          /* skip partial JSON */
        }
      }
    }

    if (!full.trim()) {
      full = "I don't have that in this passport. I can only answer about Farm 147 and this batch's risk factors.";
      setBodyText(bodyEl, full);
    }
    return full;
  }

  async function ask(question) {
    const q = (question || "").trim();
    if (!q || busy) return;

    if (!sessionActive()) {
      addMessage("user", q);
      input.value = "";
      addMessage("nivi", "Start a 3-minute session: paste your NVIDIA API key above and click Start 3 min.");
      return;
    }

    busy = true;
    form.classList.add("is-busy");
    addMessage("user", q);
    input.value = "";
    const bodyEl = addMessage("nivi", "Thinking…");

    try {
      const answer = await streamNvidia(q, bodyEl);
      history.push({ role: "user", content: q });
      history.push({ role: "assistant", content: answer });
      renderSuggestions(STARTERS);
    } catch (err) {
      setBodyText(
        bodyEl,
        `Could not reach NVIDIA API.\n${err && err.message ? err.message : String(err)}\n\nIf this is a CORS block, use a temporary key in a supported browser session or a tiny proxy. Farm-only answers still require a live session key.`
      );
    } finally {
      busy = false;
      form.classList.remove("is-busy");
    }
  }

  keySave.addEventListener("click", () => startSession(keyInput.value));
  keyClear.addEventListener("click", () => clearSession(false));
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      startSession(keyInput.value);
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });

  addMessage(
    "nivi",
    "Hi — I’m NIVI Intelligence for Farm 147 / batch CC-AR-2026-00481 only.\n\nPaste a NVIDIA API key, click Start 3 min, then ask about crop health, NDVI heatmap, moisture, lab/EU risk, voyage, EUDR, or accept/reject.\n\nI will refuse anything outside this passport."
  );
  renderSuggestions(STARTERS);
  updateTimerUI();
})();
