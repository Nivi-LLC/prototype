/* Ask NIVI — Farm 147 passport only, 10-minute chat + voice sessions */
(function () {
  const thread = document.getElementById("ask-thread");
  const suggestionsEl = document.getElementById("ask-suggestions");
  const form = document.getElementById("ask-form");
  const input = document.getElementById("ask-input");
  const keyInput = document.getElementById("ask-api-key");
  const keySave = document.getElementById("ask-key-save");
  const keyClear = document.getElementById("ask-key-clear");
  const keyClearLive = document.getElementById("ask-key-clear-live");
  const timerEl = document.getElementById("ask-timer");
  const voiceInput = document.getElementById("ask-voice-key");
  const voiceSave = document.getElementById("ask-voice-save");
  const voiceClear = document.getElementById("ask-voice-clear");
  const voiceClearLive = document.getElementById("ask-voice-clear-live");
  const voiceTimerEl = document.getElementById("ask-voice-timer");
  const chatBlock = document.getElementById("ask-chat-block");
  const voiceBlock = document.getElementById("ask-voice-block");
  const chatLabel = document.getElementById("ask-chat-label");
  const voiceLabel = document.getElementById("ask-voice-label");
  if (!thread || !form || !input || !keyInput) return;

  const onNetlifyHost =
    location.hostname.endsWith("netlify.app") ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";
  const PROXY_ORIGIN = onNetlifyHost ? "" : "https://nivi-passports.netlify.app";

  /* Same-origin on Netlify; GitHub Pages uses the Netlify proxy (CORS). */
  const ASK_URL = window.NIVI_ASK_PROXY_URL || (PROXY_ORIGIN ? `${PROXY_ORIGIN}/api/ask` : "/api/ask");
  const SPEAK_URL = window.NIVI_SPEAK_PROXY_URL || (PROXY_ORIGIN ? `${PROXY_ORIGIN}/api/speak` : "/api/speak");
  const SESSION_MS = 10 * 60 * 1000;
  const KEY_STORE = "nivi_nvidia_api_key";
  const EXP_STORE = "nivi_nvidia_session_expires";
  const VOICE_KEY_STORE = "nivi_voice_api_key";
  const VOICE_EXP_STORE = "nivi_voice_session_expires";

  const history = [];
  let busy = false;
  let tickTimer = null;
  let voiceTickTimer = null;
  let currentAudio = null;
  const guard = window.NIVI_FARM_GUARD || null;
  const REFUSAL =
    (guard && guard.REFUSAL) ||
    "I only have information for Farm 147 and this batch (CC-AR-2026-00481).";

  const STARTERS = [
    "Why is crop health 95%?",
    "Should I accept this shipment?",
    "Is Farm 147 EUDR ready?",
    "Explain the red heatmap patch",
    "What are the risk factors?",
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
    if (!silent) addMessage("nivi", "Chat session cleared. Paste a key and click Start 10 min to continue.");
  }

  function normalizeSessionKey(key) {
    let k = String(key || "").trim();
    if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, "").trim();
    k = k.replace(/^["']+|["']+$/g, "").trim();
    return k;
  }

  function startSession(key) {
    const trimmed = normalizeSessionKey(key);
    if (!trimmed) {
      addMessage("nivi", "Paste a chat session key first, then click Start 10 min.");
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
      "10-minute chat session started. Ask only about Farm 147 / this batch. Session auto-clears when time ends."
    );
  }

  function getVoiceKey() {
    try {
      return sessionStorage.getItem(VOICE_KEY_STORE) || "";
    } catch (e) {
      return "";
    }
  }

  function getVoiceExpiry() {
    try {
      return Number(sessionStorage.getItem(VOICE_EXP_STORE) || 0);
    } catch (e) {
      return 0;
    }
  }

  function voiceSessionActive() {
    const key = getVoiceKey();
    const exp = getVoiceExpiry();
    return Boolean(key) && Date.now() < exp;
  }

  function clearVoiceSession(silent) {
    try {
      sessionStorage.removeItem(VOICE_KEY_STORE);
      sessionStorage.removeItem(VOICE_EXP_STORE);
    } catch (e) {}
    if (voiceInput) voiceInput.value = "";
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    updateVoiceTimerUI();
    if (!silent) addMessage("nivi", "Voice session cleared. Paste a voice key and click Start voice 10 min to speak answers.");
  }

  function startVoiceSession(key) {
    const trimmed = normalizeSessionKey(key);
    if (!trimmed) {
      addMessage("nivi", "Paste a voice session key first, then click Start voice 10 min.");
      return;
    }
    try {
      sessionStorage.setItem(VOICE_KEY_STORE, trimmed);
      sessionStorage.setItem(VOICE_EXP_STORE, String(Date.now() + SESSION_MS));
    } catch (e) {
      addMessage("nivi", "Could not start a voice session in this browser.");
      return;
    }
    if (voiceInput) voiceInput.value = "";
    updateVoiceTimerUI();
    addMessage(
      "nivi",
      "10-minute voice session started. Use Speak on any NIVI answer to hear it aloud."
    );
  }

  function updateKeyPanelVisibility() {
    const chatOn = sessionActive();
    const voiceOn = voiceSessionActive();

    if (chatBlock) chatBlock.classList.toggle("is-active", chatOn);
    if (voiceBlock) voiceBlock.classList.toggle("is-active", voiceOn);

    if (chatLabel) chatLabel.textContent = chatOn ? "Chat" : "Chat session key";
    if (voiceLabel) voiceLabel.textContent = voiceOn ? "Voice" : "Voice session key";
  }

  function updateTimerUI() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    const paint = () => {
      if (!sessionActive()) {
        timerEl.textContent = "No chat session";
        timerEl.classList.remove("is-live", "is-warn");
        if (getKey() || getExpiry()) {
          try {
            sessionStorage.removeItem(KEY_STORE);
            sessionStorage.removeItem(EXP_STORE);
          } catch (e) {}
        }
        updateKeyPanelVisibility();
        return false;
      }
      const left = Math.max(0, getExpiry() - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      timerEl.textContent = `${m}:${String(s).padStart(2, "0")} left`;
      timerEl.classList.add("is-live");
      timerEl.classList.toggle("is-warn", left < 60000);
      updateKeyPanelVisibility();
      return true;
    };

    if (!paint()) {
      updateKeyPanelVisibility();
      return;
    }
    tickTimer = setInterval(() => {
      if (!paint()) {
        clearInterval(tickTimer);
        tickTimer = null;
        updateKeyPanelVisibility();
        addMessage("nivi", "10-minute chat session ended. Paste a key again to continue.");
      }
    }, 1000);
  }

  function updateVoiceTimerUI() {
    if (!voiceTimerEl) return;
    if (voiceTickTimer) {
      clearInterval(voiceTickTimer);
      voiceTickTimer = null;
    }
    const paint = () => {
      if (!voiceSessionActive()) {
        voiceTimerEl.textContent = "No voice session";
        voiceTimerEl.classList.remove("is-live", "is-warn");
        if (getVoiceKey() || getVoiceExpiry()) {
          try {
            sessionStorage.removeItem(VOICE_KEY_STORE);
            sessionStorage.removeItem(VOICE_EXP_STORE);
          } catch (e) {}
        }
        updateKeyPanelVisibility();
        return false;
      }
      const left = Math.max(0, getVoiceExpiry() - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      voiceTimerEl.textContent = `${m}:${String(s).padStart(2, "0")} left`;
      voiceTimerEl.classList.add("is-live");
      voiceTimerEl.classList.toggle("is-warn", left < 60000);
      updateKeyPanelVisibility();
      return true;
    };

    if (!paint()) {
      updateKeyPanelVisibility();
      return;
    }
    voiceTickTimer = setInterval(() => {
      if (!paint()) {
        clearInterval(voiceTickTimer);
        voiceTickTimer = null;
        updateKeyPanelVisibility();
        addMessage("nivi", "10-minute voice session ended. Paste a voice key again to speak.");
      }
    }, 1000);
  }

  /** Strip markdown so TTS does not say "asterisk". */
  function plainTextForSpeech(text) {
    return String(text || "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, "$1$2")
      .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*•]\s+/gm, "")
      .replace(/\|/g, " ")
      .replace(/\*/g, "")
      .replace(/[_#~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function plainTextFromBody(bodyEl) {
    return plainTextForSpeech(bodyEl?.innerText || bodyEl?.textContent || "");
  }

  function attachSpeakButton(bodyEl, text) {
    const bubble = bodyEl && bodyEl.parentElement;
    if (!bubble || bubble.querySelector(".ask-speak")) return;
    const actions = el("div", "ask-msg__actions");
    const btn = el("button", "ask-speak", "Speak");
    btn.type = "button";
    btn.title = "Speak this answer aloud";
    btn.addEventListener("click", () =>
      speakText(plainTextForSpeech(text || plainTextFromBody(bodyEl)), btn)
    );
    actions.appendChild(btn);
    bubble.appendChild(actions);
  }

  async function speakText(text, btn) {
    const clean = plainTextForSpeech(text);
    if (!clean) return;

    if (!voiceSessionActive()) {
      addMessage("nivi", "Start a voice session first: paste your voice key and click Start voice 10 min.");
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Speaking…";
    }

    try {
      const res = await fetch(SPEAK_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getVoiceKey()}`,
        },
        body: JSON.stringify({ text: clean }),
      });

      const contentType = res.headers.get("Content-Type") || "";
      if (!res.ok) {
        let detail = res.statusText;
        try {
          if (contentType.includes("application/json")) {
            const j = await res.json();
            detail = j.error || JSON.stringify(j).slice(0, 180);
          } else {
            detail = (await res.text()).slice(0, 180) || detail;
          }
        } catch (e) {}
        throw new Error(`Voice request failed (${res.status}): ${detail}`);
      }

      const bytes = await res.arrayBuffer();
      if (!bytes.byteLength) throw new Error("Empty audio from voice service");

      // LINEAR_PCM from Riva may arrive as raw PCM — wrap as WAV if no RIFF header
      let playBytes = bytes;
      const view = new Uint8Array(bytes);
      const isRiff =
        view.length >= 4 &&
        view[0] === 0x52 &&
        view[1] === 0x49 &&
        view[2] === 0x46 &&
        view[3] === 0x46;
      if (!isRiff) {
        playBytes = pcmToWav(view, 22050, 1, 16);
      }

      const blob = new Blob([playBytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Speak";
        }
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Speak";
        }
        addMessage("nivi", "Could not play the generated audio in this browser.");
      });
      await audio.play();
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Speak";
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Speak";
      }
      const msg = err && err.message ? err.message : String(err);
      addMessage(
        "nivi",
        `Could not speak this answer.\n${msg}\n\nCheck the voice session key and try Start voice 10 min again.`
      );
    }
  }

  function pcmToWav(pcm, sampleRate, channels, bitDepth) {
    const blockAlign = (channels * bitDepth) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm.byteLength;
    const buffer = new ArrayBuffer(44 + dataSize);
    const out = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i += 1) out.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    out.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true);
    out.setUint16(22, channels, true);
    out.setUint32(24, sampleRate, true);
    out.setUint32(28, byteRate, true);
    out.setUint16(32, blockAlign, true);
    out.setUint16(34, bitDepth, true);
    writeStr(36, "data");
    out.setUint32(40, dataSize, true);
    new Uint8Array(buffer, 44).set(pcm);
    return buffer;
  }

  function createSmoothReveal(bodyEl) {
    let target = "";
    let shown = "";
    let raf = 0;
    let lastTs = 0;
    let streamDone = false;
    let doneResolve = null;
    const BASE_CPS = 64; // characters per second — smooth reading pace

    function paint() {
      setBodyText(bodyEl, shown || "…");
      thread.scrollTop = thread.scrollHeight;
    }

    function step(ts) {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.048, (ts - lastTs) / 1000);
      lastTs = ts;

      const backlog = target.length - shown.length;
      if (backlog > 0) {
        // Catch up gently if the model is ahead; stay smooth when close
        const boost = backlog > 180 ? 2.4 : backlog > 80 ? 1.6 : backlog > 28 ? 1.2 : 1;
        let n = Math.max(1, Math.round(BASE_CPS * boost * dt));
        // Prefer ending on a word boundary for smoother feel
        let next = Math.min(target.length, shown.length + n);
        if (next < target.length) {
          const slice = target.slice(shown.length, next + 12);
          const space = slice.search(/[\s\n]/);
          if (space > 0 && space <= 10) next = shown.length + space + 1;
        }
        shown = target.slice(0, next);
        paint();
      }

      if (shown.length < target.length || !streamDone) {
        raf = requestAnimationFrame(step);
        return;
      }

      raf = 0;
      bodyEl.classList.remove("is-streaming");
      if (doneResolve) {
        doneResolve(shown);
        doneResolve = null;
      }
    }

    function ensureLoop() {
      if (!raf) {
        lastTs = 0;
        raf = requestAnimationFrame(step);
      }
    }

    return {
      push(chunk) {
        if (!chunk) return;
        target += chunk;
        ensureLoop();
      },
      replace(text) {
        target = String(text || "");
        if (shown.length > target.length) shown = target;
        ensureLoop();
      },
      finish() {
        streamDone = true;
        ensureLoop();
        return new Promise((resolve) => {
          if (!raf && shown.length >= target.length) {
            bodyEl.classList.remove("is-streaming");
            resolve(shown);
            return;
          }
          doneResolve = resolve;
        });
      },
      getTarget() {
        return target;
      },
    };
  }

  async function streamNvidia(question, bodyEl) {
    const apiKey = getKey();
    const reveal = createSmoothReveal(bodyEl);

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
      let detail = errText.slice(0, 280) || res.statusText;
      try {
        const j = JSON.parse(errText);
        detail = j.error || detail;
        if (typeof detail === "string" && detail.trim().startsWith("{")) {
          const inner = JSON.parse(detail);
          detail = inner.detail || inner.title || detail;
        }
      } catch (e) {}
      if (res.status === 403 || /Authorization failed|Forbidden/i.test(String(detail))) {
        clearSession(true);
        throw new Error(
          "Chat key was rejected (403). Paste a fresh chat session key from build.nvidia.com (Get API Key on the chat model), then Start 10 min again. Voice keys do not always work for chat."
        );
      }
      throw new Error(`Request failed (${res.status}): ${String(detail).slice(0, 240)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
          if (piece) reveal.push(piece);
        } catch (e) {
          /* skip partial JSON */
        }
      }
    }

    let full = reveal.getTarget();
    if (!full.trim()) full = REFUSAL;
    if (guard && typeof guard.gateAnswer === "function") {
      full = guard.gateAnswer(full);
    }
    reveal.replace(full);
    await reveal.finish();
    return full;
  }

  async function ask(question) {
    const q = (question || "").trim();
    if (!q || busy) return;

    if (!sessionActive()) {
      addMessage("user", q);
      input.value = "";
      addMessage("nivi", "Start a 10-minute chat session: paste your key above and click Start 10 min.");
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
        const refuseBody = addMessage("nivi", local.refusal || REFUSAL);
        attachSpeakButton(refuseBody, local.refusal || REFUSAL);
        busy = false;
        form.classList.remove("is-busy");
        return;
      }
    }

    const bodyEl = addMessage("nivi", "…");
    bodyEl.classList.add("is-streaming");

    try {
      const answer = await streamNvidia(q, bodyEl);
      attachSpeakButton(bodyEl, answer);
      // Only keep in-scope turns so follow-ups stay scoped
      const refused = String(answer).includes("I only have information for Farm 147");
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
      bodyEl.classList.remove("is-streaming");
    } finally {
      busy = false;
      form.classList.remove("is-busy");
    }
  }

  keySave.addEventListener("click", () => startSession(keyInput.value));
  keyClear.addEventListener("click", () => clearSession(false));
  if (keyClearLive) keyClearLive.addEventListener("click", () => clearSession(false));
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      startSession(keyInput.value);
    }
  });

  if (voiceSave) voiceSave.addEventListener("click", () => startVoiceSession(voiceInput && voiceInput.value));
  if (voiceClear) voiceClear.addEventListener("click", () => clearVoiceSession(false));
  if (voiceClearLive) voiceClearLive.addEventListener("click", () => clearVoiceSession(false));
  if (voiceInput) {
    voiceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        startVoiceSession(voiceInput.value);
      }
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });

  addMessage(
    "nivi",
    "Hi — I’m NIVI Intelligence. I can explain this Continental Coffee batch: Farm 147 crop health, harvest CC-AR-2026-00481, lab EU risk, voyage status, EUDR twin, carbon, and whether to accept the shipment.\n\nStart a 10-minute chat session to ask questions. Optionally start a voice session to Speak answers aloud."
  );
  renderSuggestions(STARTERS);
  updateTimerUI();
  updateVoiceTimerUI();
})();
