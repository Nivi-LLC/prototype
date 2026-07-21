/* Documents tab — demo library + session upload */
(function () {
  const listEl = document.getElementById("docs-library");
  const countEl = document.getElementById("docs-count");
  const emptyEl = document.getElementById("docs-empty");
  const fileInput = document.getElementById("docs-file-input");
  if (!listEl || !fileInput) return;

  const STORE = "nivi_docs_uploads";
  const demoDocs = Array.isArray(window.PASSPORT && window.PASSPORT.documents)
    ? window.PASSPORT.documents.slice()
    : [];

  function loadUploads() {
    try {
      const raw = sessionStorage.getItem(STORE);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveUploads(docs) {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(docs));
    } catch (e) {
      /* ignore quota */
    }
  }

  function formatSize(bytes) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileType(name) {
    const ext = String(name || "").split(".").pop() || "FILE";
    return ext.toUpperCase().slice(0, 5);
  }

  function guessCategory(name) {
    const n = String(name || "").toLowerCase();
    if (n.includes("invoice") || n.includes("packing")) return "Trade";
    if (n.includes("bill") || n.includes("bl") || n.includes("container")) return "Shipping";
    if (n.includes("coa") || n.includes("lab")) return "Lab";
    if (n.includes("eudr") || n.includes("phyto") || n.includes("origin")) return "Compliance";
    if (n.includes("ndvi") || n.includes("farm") || n.includes("heatmap")) return "Farm";
    return "Upload";
  }

  function allDocs() {
    return demoDocs.concat(loadUploads());
  }

  function render() {
    const docs = allDocs();
    listEl.replaceChildren();
    if (countEl) countEl.textContent = `${docs.length} file${docs.length === 1 ? "" : "s"}`;
    if (emptyEl) emptyEl.hidden = docs.length > 0;

    docs.forEach((doc) => {
      const li = document.createElement("li");
      li.className = "docs-item";
      if (doc.source === "upload") li.classList.add("docs-item--upload");

      const icon = document.createElement("div");
      icon.className = "docs-item__icon";
      icon.textContent = doc.type || "DOC";

      const meta = document.createElement("div");
      meta.className = "docs-item__meta";
      const title = document.createElement("strong");
      title.textContent = doc.name;
      const sub = document.createElement("span");
      sub.textContent = `${doc.category || "Document"} · ${doc.size || "—"} · ${doc.uploadedAt || ""}`;
      meta.appendChild(title);
      meta.appendChild(sub);

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = doc.status || "Linked";

      li.appendChild(icon);
      li.appendChild(meta);
      li.appendChild(badge);

      if (doc.source === "upload") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "docs-item__remove";
        remove.setAttribute("aria-label", `Remove ${doc.name}`);
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          const next = loadUploads().filter((d) => d.id !== doc.id);
          saveUploads(next);
          render();
        });
        li.appendChild(remove);
      }

      listEl.appendChild(li);
    });
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;

    const uploads = loadUploads();
    uploads.unshift({
      id: `upload-${Date.now()}`,
      name: file.name,
      type: fileType(file.name),
      category: guessCategory(file.name),
      size: formatSize(file.size),
      uploadedAt: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "Uploaded",
      source: "upload",
    });
    saveUploads(uploads);
    render();
  });

  render();
})();
