(function () {
  const data = window.PASSPORT;
  if (!data) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function fillText() {
    $$("[data-bind]").forEach((el) => {
      const path = el.getAttribute("data-bind");
      const value = path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), data);
      if (value == null) return;
      el.textContent = String(value);
    });
  }

  function buildJourney() {
    const track = $("#journey-track");
    if (!track) return;

    data.journey.forEach((step, i) => {
      const a = document.createElement("a");
      a.href = `#${step.id}`;
      a.className = "journey-step";
      a.dataset.stage = step.id;
      a.innerHTML = `<span class="journey-step__dot" aria-hidden="true"></span><span>${step.label}</span>`;
      track.appendChild(a);

      if (i < data.journey.length - 1) {
        const line = document.createElement("span");
        line.className = "journey-step__line";
        line.setAttribute("aria-hidden", "true");
        line.dataset.after = step.id;
        track.appendChild(line);
      }
    });
  }

  function buildDocs() {
    const list = $("#customs-docs");
    if (!list) return;
    data.customs.documents.forEach((doc) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${doc.name}</span><span class="badge">${doc.status}</span>`;
      list.appendChild(li);
    });
  }

  function buildChips() {
    const wrap = $("#process-chips");
    if (!wrap) return;
    data.processing.steps.forEach((step) => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = step;
      wrap.appendChild(span);
    });
  }

  function buildForecast() {
    const body = $("#forecast-body");
    if (!body) return;
    data.weather.forecast.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.day}</td>
        <td>${row.max}° / ${row.min}°</td>
        <td>${row.precip}"</td>
        <td>${row.humidity}%</td>
        <td>${row.clouds}%</td>
        <td>${row.wind} mph</td>`;
      body.appendChild(tr);
    });
  }

  function setupScrollSpy() {
    const stages = data.journey.map((j) => j.id);
    const sections = stages
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const update = () => {
      const offset = 120;
      let active = stages[0];
      for (const section of sections) {
        const top = section.getBoundingClientRect().top;
        if (top - offset <= 0) active = section.id;
      }

      const activeIndex = stages.indexOf(active);
      $$(".journey-step").forEach((el) => {
        const idx = stages.indexOf(el.dataset.stage);
        el.classList.toggle("is-active", el.dataset.stage === active);
        el.classList.toggle("is-done", idx < activeIndex);
      });
      $$(".journey-step__line").forEach((line) => {
        const idx = stages.indexOf(line.dataset.after);
        line.classList.toggle("is-done", idx < activeIndex);
        if (idx < activeIndex) line.style.background = "var(--amber)";
        else line.style.background = "";
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function setupReveal() {
    const nodes = $$(".section, .panel--reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((n) => io.observe(n));
  }

  function setupMeters() {
    $$("[data-meter]").forEach((el) => {
      el.style.setProperty("--meter", `${el.getAttribute("data-meter")}%`);
    });
  }

  fillText();
  buildJourney();
  buildDocs();
  buildChips();
  buildForecast();
  setupMeters();
  setupScrollSpy();
  setupReveal();
})();
