(function () {
  const data = window.PASSPORT;
  if (!data) return;

  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function fillText() {
    $$("[data-bind]").forEach((el) => {
      const path = el.getAttribute("data-bind");
      const value = path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), data);
      if (value == null) return;
      el.textContent = String(value);
    });
  }

  function buildDocs() {
    const list = document.getElementById("customs-docs");
    if (!list) return;
    data.customs.documents.forEach((doc) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${doc.name}</span><span class="badge">${doc.status}</span>`;
      list.appendChild(li);
    });
  }

  function buildChips() {
    const wrap = document.getElementById("process-chips");
    if (!wrap) return;
    data.processing.steps.forEach((step) => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = step;
      wrap.appendChild(span);
    });
  }

  function setView(viewId) {
    const views = $$(".view");
    const buttons = $$(".nav-btn[data-view], .brand[data-view]");
    let active = null;

    views.forEach((view) => {
      const on = view.id === `view-${viewId}`;
      view.classList.toggle("is-active", on);
      if (on) active = view;
    });

    $$(".nav-btn[data-view]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === viewId);
    });

    const title = document.getElementById("view-title");
    if (title && active) {
      title.textContent = active.dataset.title || "NIVI Passports";
    }

    try {
      history.replaceState(null, "", `#${viewId}`);
    } catch (e) {}

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setupNav() {
    $$(".nav-btn[data-view], .brand[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    const hash = (location.hash || "").replace("#", "");
    const allowed = ["overview", "map", "grow", "harvest", "chain", "docs", "trust", "future", "ask"];
    setView(allowed.includes(hash) ? hash : "overview");
  }

  function setupSectorCards() {
    $$(".sector-card").forEach((card) => {
      card.addEventListener("click", () => {
        $$(".sector-card").forEach((c) => c.classList.remove("is-active"));
        card.classList.add("is-active");
      });
    });
  }

  function setupNavSwipe() {
    const nav = document.querySelector(".topnav");
    if (!nav) return;
    let startX = 0;
    nav.addEventListener(
      "touchstart",
      (e) => {
        startX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    nav.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) < 40) return;
        nav.scrollBy({ left: dx < 0 ? 140 : -140, behavior: "smooth" });
      },
      { passive: true }
    );
  }

  fillText();
  buildDocs();
  buildChips();
  setupNav();
  setupSectorCards();
  setupNavSwipe();
})();
