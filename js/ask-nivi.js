/* Ask NIVI — Farm 147 passport only, 3-minute key session */
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

  /* Same-origin on Netlify; GitHub Pages uses the Netlify proxy (CORS). */
  const ASK_URL =
    window.NIVI_ASK_PROXY_URL ||
    (location.hostname.endsWith("netlify.app") ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
      ? "/api/ask"
      : "https://nivi-passports.netlify.app/api/ask");
  const SESSION_MS = 3 * 60 * 1000;
  const KEY_STORE = "nivi_nvidia_api_key";
  const EXP_STORE = "nivi_nvidia_session_expires";

  const history = [];
  let busy = false;
  let tickTimer = null;
  const guard = window.NIVI_FARM_GUARD || null;
  const REFUSAL =
    (guard && guard.REFUSAL) ||
    "I don't have that in this passport. I can only answer about Farm 147 and this batch's risk factors.";

  const STARTERS = [
    "Should I accept this shipment?",
    "What should I do next on Farm 147?",
    "Simulate delaying this decision 7 days",
    "What is the financial impact of accepting?",
    "How does this compare with peer Arabica lots?",
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function appendInline(parent, text) {
    const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((part) => {
      if (!part) return;
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        parent.appendChild(strong);
        return;
      }
      // Strip leftover single-asterisk emphasis so *text* does not show stars
      const cleaned = part.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, "$1$2");
      parent.appendChild(document.createTextNode(cleaned));
    });
  }

  function isTableSep(line) {
    return /^\s*\|?\s*:?-{3,}.*\|/.test(line);
  }

  function parseTableRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function setBodyText(body, text) {
    body.replaceChildren();
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    let i = 0;
    let listEl = null;

    const closeList = () => {
      listEl = null;
    };

    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trim();

      if (!line) {
        closeList();
        i += 1;
        continue;
      }

      // Markdown table block
      if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        closeList();
        const headers = parseTableRow(line);
        i += 2;
        const table = el("table", "ask-table");
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        headers.forEach((h) => {
          const th = document.createElement("th");
          appendInline(th, h);
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        while (i < lines.length && lines[i].includes("|") && !isTableSep(lines[i])) {
          if (!lines[i].trim()) break;
          const cells = parseTableRow(lines[i]);
          const tr = document.createElement("tr");
          cells.forEach((c) => {
            const td = document.createElement("td");
            appendInline(td, c);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
          i += 1;
        }
        table.appendChild(tbody);
        body.appendChild(table);
        continue;
      }

      // Bullet list
      const bullet = line.match(/^[-*•]\s+(.+)$/);
      if (bullet) {
        if (!listEl) {
          listEl = el("ul", "ask-list");
          body.appendChild(listEl);
        }
        const li = document.createElement("li");
        appendInline(li, bullet[1]);
        listEl.appendChild(li);
        i += 1;
        continue;
      }

      closeList();
      const p = document.createElement("p");
      // Strip markdown heading markers
      const plain = line.replace(/^#{1,6}\s+/, "");
      appendInline(p, plain);
      body.appendChild(p);
      i += 1;
    }
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
    if (!silent) addMessage("nivi", "Session cleared. Paste a key and click Start 3 min to continue.");
  }

  function startSession(key) {
    const trimmed = (key || "").trim();
    if (!trimmed) {
      addMessage("nivi", "Paste a session key first, then click Start 3 min.");
      return;
    }
    try {
      sessionStorage.setItem(KEY_STORE, trimmed);
      sessionStorage.setItem(EXP_STORE, String(Date.now() + SESSION_MS));
    } catch (e) {
      addMessage("nivi", "Could not start a session in this browser.");
      return;
    }
    keyInput.value = "";
    updateTimerUI();
    addMessage(
      "nivi",
      "3-minute session started. Ask only about Farm 147 / this batch. Session auto-clears when time ends."
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
        addMessage("nivi", "3-minute session ended. Paste a key again to continue.");
      }
    }, 1000);
  }

  async function streamNvidia(question, bodyEl) {
    const apiKey = getKey();
    // Client sends question + history only. Server locks system prompt + passport context.
    const res = await fetch(ASK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        question,
        history: history.slice(-6),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Request failed (${res.status}): ${errText.slice(0, 240) || res.statusText}`);
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

    if (!full.trim()) full = REFUSAL;
    if (guard && typeof guard.gateAnswer === "function") {
      full = guard.gateAnswer(full);
    }
    setBodyText(bodyEl, full);
    return full;
  }

  async function ask(question) {
    const q = (question || "").trim();
    if (!q || busy) return;

    if (!sessionActive()) {
      addMessage("user", q);
      input.value = "";
      addMessage("nivi", "Start a 3-minute session: paste your key above and click Start 3 min.");
      return;
    }

    busy = true;
    form.classList.add("is-busy");
    addMessage("user", q);
    input.value = "";

    // Client gate for instant refuse (server enforces the same rules)
    if (guard && typeof guard.gateQuestion === "function") {
      const local = guard.gateQuestion(q, history.length > 0);
      if (!local.ok) {
        addMessage("nivi", local.refusal || REFUSAL);
        busy = false;
        form.classList.remove("is-busy");
        return;
      }
    }

    const bodyEl = addMessage("nivi", "Thinking…");

    try {
      const answer = await streamNvidia(q, bodyEl);
      // Only keep in-scope turns so follow-ups stay scoped
      const refused = String(answer).includes("I don't have that in this passport");
      if (answer && !refused) {
        history.push({ role: "user", content: q });
        history.push({ role: "assistant", content: answer });
      }
      renderSuggestions(STARTERS);
    } catch (err) {
      setBodyText(
        bodyEl,
        `Could not get an answer.\n${err && err.message ? err.message : String(err)}`
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
    "Hi — I’m the NIVI PIOS copilot for Farm 147 / batch CC-AR-2026-00481 only.\n\nStart a 3-minute session, then ask what to do next. I answer with Recommendation, Why, Confidence, Business impact, and Actions.\n\nI refuse anything outside this product identity."
  );
  renderSuggestions(STARTERS);
  updateTimerUI();
})();
