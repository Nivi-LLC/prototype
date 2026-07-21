/* PIOS — render decision intelligence surfaces from PASSPORT data */
(function () {
  const data = window.PASSPORT;
  if (!data) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderDecision(mountId, decision) {
    const root = document.getElementById(mountId);
    if (!root || !decision) return;
    root.replaceChildren();

    const head = el("div", "decision-card__head");
    head.appendChild(el("p", "card__label", `${decision.domain || "Decision"} · AI recommendation`));
    if (decision.confidence != null) {
      head.appendChild(el("span", "confidence-pill", `${decision.confidence}% confidence`));
    }
    root.appendChild(head);

    root.appendChild(el("p", "decision-card__rec", decision.recommendation));

    if (decision.why && decision.why.length) {
      root.appendChild(el("p", "decision-card__section", "Why"));
      const ul = el("ul", "decision-card__list");
      decision.why.forEach((item) => ul.appendChild(el("li", null, item)));
      root.appendChild(ul);
    }

    if (decision.impact) {
      root.appendChild(el("p", "decision-card__section", "Business impact"));
      const grid = el("div", "impact-grid");
      Object.entries(decision.impact).forEach(([key, value]) => {
        const cell = el("div", "impact-cell");
        cell.appendChild(el("span", null, key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())));
        cell.appendChild(el("strong", null, String(value)));
        grid.appendChild(cell);
      });
      root.appendChild(grid);
    }

    if (decision.actions && decision.actions.length) {
      root.appendChild(el("p", "decision-card__section", "Recommended actions"));
      const actions = el("div", "chips");
      decision.actions.forEach((a) => actions.appendChild(el("span", "chip", a)));
      root.appendChild(actions);
    }

    if (decision.alternatives && decision.alternatives.length) {
      root.appendChild(el("p", "decision-card__section", "Alternative scenarios"));
      const alts = el("ul", "decision-card__list");
      decision.alternatives.forEach((alt) => {
        alts.appendChild(
          el("li", null, `${alt.name}: ${alt.outcome} · success ${alt.successProbability || "—"}`)
        );
      });
      root.appendChild(alts);
    }
  }

  function renderExecStrip() {
    const root = document.getElementById("exec-strip");
    const ex = data.executive;
    if (!root || !ex) return;
    const items = [
      ["Business health", ex.businessHealth],
      ["Revenue opportunity", ex.revenueOpportunityInr],
      ["Revenue at risk", ex.revenueAtRiskInr],
      ["Margin forecast", ex.marginForecast],
      ["Carbon premium", ex.carbonPremium],
      ["Compliance", ex.complianceExposure],
    ];
    root.replaceChildren();
    items.forEach(([label, value]) => {
      const card = el("div", "exec-chip");
      card.appendChild(el("span", null, label));
      card.appendChild(el("strong", null, value));
      root.appendChild(card);
    });
  }

  function renderPredictions() {
    const root = document.getElementById("predict-list");
    if (!root || !data.predictions) return;
    root.replaceChildren();
    data.predictions.forEach((p) => {
      const li = el("li", "predict-item");
      li.appendChild(el("strong", null, p.name));
      const meta = el("div", "predict-item__meta");
      meta.appendChild(el("span", null, p.value));
      meta.appendChild(el("span", "confidence-pill", `${p.confidence}%`));
      li.appendChild(meta);
      li.appendChild(el("em", null, p.action));
      root.appendChild(li);
    });
  }

  function renderBenchmarks() {
    const root = document.getElementById("benchmark-list");
    const b = data.primaryDecision && data.primaryDecision.benchmarks;
    if (!root || !b) return;
    root.replaceChildren();
    [
      ["Peer group", b.peerGroup],
      ["Moisture vs peers", b.moistureVsPeers],
      ["EU accept vs market", b.euAcceptVsMarket],
      ["Exporter rank", b.exporterRank],
    ].forEach(([k, v]) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${k}</span><strong></strong>`;
      li.querySelector("strong").textContent = v;
      root.appendChild(li);
    });
  }

  function renderActionQueue() {
    const root = document.getElementById("action-queue");
    const actions = (data.primaryDecision && data.primaryDecision.actions) || [];
    if (!root) return;
    root.replaceChildren();
    actions.forEach((a, i) => {
      const li = el("li", "task-item");
      const wrap = el("div");
      wrap.appendChild(el("strong", null, a));
      wrap.appendChild(el("span", null, i === 0 ? "Highest value now" : "Queued"));
      li.appendChild(wrap);
      li.appendChild(el("span", i === 0 ? "check is-done" : "check", i === 0 ? "→" : ""));
      root.appendChild(li);
    });
  }

  function renderSimulations() {
    const root = document.getElementById("sim-grid");
    if (!root || !data.simulations) return;
    root.replaceChildren();
    data.simulations.forEach((sim) => {
      const card = el("div", "card sim-card");
      card.appendChild(el("p", "card__label", "Scenario"));
      card.appendChild(el("p", "sim-card__q", sim.question));
      card.appendChild(el("p", "decision-card__rec", sim.recommendation));
      const facts = el("ul", "facts");
      [
        ["Revenue", sim.revenue],
        ["Margin", sim.margin],
        ["Quality", sim.quality],
        ["Risk", sim.risk],
        ["Success P", sim.successProbability],
        ["Carbon", sim.carbon],
      ].forEach(([k, v]) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${k}</span><strong></strong>`;
        li.querySelector("strong").textContent = v;
        facts.appendChild(li);
      });
      card.appendChild(facts);
      card.appendChild(el("p", "metric-note", sim.tradeoff));
      root.appendChild(card);
    });
  }

  function renderMemory() {
    const root = document.getElementById("memory-timeline");
    if (!root || !data.productMemory) return;
    root.replaceChildren();
    data.productMemory.forEach((m) => {
      const li = el("li", "memory-item");
      li.appendChild(el("span", "memory-item__when", m.when));
      const body = el("div", "memory-item__body");
      body.appendChild(el("strong", null, m.event));
      body.appendChild(el("span", null, `${m.domain} · ${m.valueLink}`));
      li.appendChild(body);
      root.appendChild(li);
    });
  }

  renderExecStrip();
  renderDecision("primary-decision", data.primaryDecision);
  renderDecision("grow-decision", data.growingDecision);
  renderDecision("harvest-decision", data.harvestDecision);
  renderDecision("chain-decision", data.chainDecision);
  renderDecision("buy-decision", data.primaryDecision);
  renderPredictions();
  renderBenchmarks();
  renderActionQueue();
  renderSimulations();
  renderMemory();
})();
