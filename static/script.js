/* ============================================================
   AI Code Refine — Enhanced Script
   ============================================================ */

// ── State ────────────────────────────────────────────────────
let reviewHistory = JSON.parse(localStorage.getItem("reviewHistory") || "[]");
let currentResult = null;
let currentCode   = null;
let activeFilter  = "all";

// ── DOM Ready ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTextarea();
  initFileUpload();
  initDragDrop();
  initKeyboardShortcuts();
});

// ── THEME ────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle");
  btn.textContent = theme === "dark" ? "🌙" : "☀️";

  // Swap highlight.js stylesheet
  const hlLink = document.getElementById("hljs-theme");
  if (hlLink) {
    hlLink.href = theme === "dark"
      ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
      : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
  }
  localStorage.setItem("theme", theme);
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
});

// ── TEXTAREA ENHANCEMENTS ────────────────────────────────────
function initTextarea() {
  const ta = document.getElementById("code-input");
  const clearBtn = document.getElementById("clear-btn");

  ta.addEventListener("input", updateStats);

  // Tab key support
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + "    " + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 4;
      updateStats();
    }
  });

  // Clear button visibility
  ta.addEventListener("input", () => {
    clearBtn.classList.toggle("hidden", !ta.value.trim());
  });

  clearBtn.addEventListener("click", () => {
    ta.value = "";
    updateStats();
    clearBtn.classList.add("hidden");
    ta.focus();
  });
}

function updateStats() {
  const ta    = document.getElementById("code-input");
  const val   = ta.value;
  const lines = val ? val.split("\n").length : 0;
  const chars = val.length;

  const lc = document.getElementById("line-count");
  const cc = document.getElementById("char-count");

  if (val.trim()) {
    lc.textContent = `${lines} line${lines !== 1 ? "s" : ""}`;
    cc.textContent = `${chars.toLocaleString()} chars`;
    lc.style.display = "";
    cc.style.display = "";
  } else {
    lc.textContent = "";
    cc.textContent = "";
  }
}

// ── FILE UPLOAD ──────────────────────────────────────────────
function initFileUpload() {
  const input = document.getElementById("file-upload");
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) loadFile(file);
    input.value = ""; // reset so same file can be re-uploaded
  });
}

function loadFile(file) {
  if (file.size > 500_000) {
    showToast("File too large (max 500 KB)", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("code-input").value = e.target.result;
    updateStats();
    document.getElementById("clear-btn").classList.remove("hidden");
    // Auto-detect language from extension
    const ext = file.name.split(".").pop().toLowerCase();
    const langMap = {
      py: "Python", js: "JavaScript", ts: "TypeScript",
      java: "Java", c: "C", cpp: "C++", go: "Go",
      rs: "Rust", php: "PHP", rb: "Ruby", swift: "Swift",
      kt: "Kotlin", sql: "SQL", sh: "Bash"
    };
    if (langMap[ext]) {
      document.getElementById("language").value = langMap[ext];
    }
    showToast(`Loaded: ${file.name}`, "success");
  };
  reader.readAsText(file);
}

// ── DRAG & DROP ──────────────────────────────────────────────
function initDragDrop() {
  const card    = document.getElementById("input-card");
  const overlay = document.getElementById("drop-overlay");
  let dragCounter = 0;

  card.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    overlay.classList.remove("hidden");
  });

  card.addEventListener("dragleave", () => {
    dragCounter--;
    if (dragCounter === 0) overlay.classList.add("hidden");
  });

  card.addEventListener("dragover", (e) => e.preventDefault());

  card.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add("hidden");
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });
}

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      analyzeCode();
    }
    if (e.key === "Escape") {
      closeHistory();
    }
  });
}

// ── LOADER ANIMATION ─────────────────────────────────────────
let loaderInterval = null;

function startLoader() {
  const steps = ["step-1", "step-2", "step-3"];
  let idx = 0;
  steps.forEach(id => {
    document.getElementById(id).className = "step";
  });
  document.getElementById("step-1").classList.add("active");

  loaderInterval = setInterval(() => {
    document.getElementById(steps[idx]).className = "step done";
    idx++;
    if (idx < steps.length) {
      document.getElementById(steps[idx]).classList.add("active");
    } else {
      clearInterval(loaderInterval);
    }
  }, 1200);
}

function stopLoader() {
  clearInterval(loaderInterval);
}

// ── MAIN ANALYZE ─────────────────────────────────────────────
async function analyzeCode() {
  const code     = document.getElementById("code-input").value.trim();
  const language = document.getElementById("language").value;
  const mode     = document.getElementById("review-mode").value;

  if (!code) {
    showToast("Please paste some code first!", "error");
    return;
  }

  // UI: show loader
  document.getElementById("loader").classList.remove("hidden");
  document.getElementById("results").classList.add("hidden");
  document.getElementById("error-box").classList.add("hidden");
  document.getElementById("analyze-btn").disabled = true;
  startLoader();

  try {
    const response = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language, mode })
    });

    const data = await response.json();

    if (!data.success) throw new Error(data.error || "Something went wrong");

    currentResult = data.result;
    currentCode   = code;

    displayResults(data.result, code, language);
    saveToHistory(data.result, code, language);

  } catch (err) {
    const box = document.getElementById("error-box");
    box.textContent = "⚠ " + err.message;
    box.classList.remove("hidden");
  }

  stopLoader();
  document.getElementById("loader").classList.add("hidden");
  document.getElementById("analyze-btn").disabled = false;
}

// ── DISPLAY RESULTS ──────────────────────────────────────────
function displayResults(result, originalCode, language) {
  activeFilter = "all";

  renderScore(result);
  renderIssues(result.issues || []);
  renderCodeBlocks(originalCode, result.fixedCode, language);
  renderExplanation(result.explanation);
  renderSuggestions(result.suggestions || []);
  renderTestCases(result.testCases || []);

  const resultsEl = document.getElementById("results");
  resultsEl.classList.remove("hidden");
  resultsEl.querySelectorAll(".card, .code-compare").forEach((el, i) => {
    el.classList.remove("results-animate");
    el.style.animationDelay = `${i * 60}ms`;
    void el.offsetWidth; // reflow
    el.classList.add("results-animate");
  });

  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── SCORE ────────────────────────────────────────────────────
function renderScore(result) {
  const score = result.score || 0;
  const circumference = 2 * Math.PI * 50; // r=50 → 314.16

  // Animate gauge
  const fill = document.getElementById("gauge-fill");
  const offset = circumference - (score / 100) * circumference;
  fill.style.strokeDashoffset = circumference; // reset
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = offset;
    });
  });

  // Color by score
  let color, grade, gradeColor;
  if (score >= 81)      { color = "#3fb950"; grade = "Excellent 🏆"; gradeColor = "#3fb950"; }
  else if (score >= 61) { color = "#388bfd"; grade = "Good 👍";      gradeColor = "#388bfd"; }
  else if (score >= 41) { color = "#e3b341"; grade = "Fair ⚠";       gradeColor = "#e3b341"; }
  else                  { color = "#f78166"; grade = "Poor 🔴";       gradeColor = "#f78166"; }

  fill.style.stroke = color;

  // Animate number
  animateNumber("score-number", 0, score, 1000);

  document.getElementById("score-grade").textContent  = grade;
  document.getElementById("score-grade").style.color  = gradeColor;
  document.getElementById("score-summary").textContent = result.summary || "";

  // Issue counts
  const issues = result.issues || [];
  const counts = { critical: 0, warning: 0, info: 0 };
  issues.forEach(i => { if (counts[i.severity] !== undefined) counts[i.severity]++; });

  const countsEl = document.getElementById("issue-counts");
  countsEl.innerHTML = "";
  if (counts.critical) countsEl.innerHTML += `<span class="count-badge critical">⚠ ${counts.critical} Critical</span>`;
  if (counts.warning)  countsEl.innerHTML += `<span class="count-badge warning">⚡ ${counts.warning} Warning</span>`;
  if (counts.info)     countsEl.innerHTML += `<span class="count-badge info">ℹ ${counts.info} Info</span>`;
  if (!issues.length)  countsEl.innerHTML  = `<span class="count-badge info" style="border-color:var(--green);color:var(--green)">✓ No Issues</span>`;
}

function animateNumber(id, from, to, duration) {
  const el = document.getElementById(id);
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── ISSUES ───────────────────────────────────────────────────
function renderIssues(issues) {
  const header    = document.getElementById("issues-header");
  const list      = document.getElementById("issues-list");
  const filterEl  = document.getElementById("filter-pills");
  const hasIssues = issues.length > 0;

  // Header
  if (hasIssues) {
    header.className = "card-header red";
    document.getElementById("issues-icon").textContent  = "⚠";
    document.getElementById("issues-title").textContent = `${issues.length} Issue${issues.length !== 1 ? "s" : ""} Found`;
  } else {
    header.className = "card-header green";
    document.getElementById("issues-icon").textContent  = "✓";
    document.getElementById("issues-title").textContent = "No Issues Found";
  }

  // Filter pills
  filterEl.innerHTML = "";
  if (hasIssues) {
    const severities = [...new Set(issues.map(i => i.severity).filter(Boolean))];
    const allPill = createFilterPill("all", "All", true);
    filterEl.appendChild(allPill);
    severities.forEach(sev => {
      filterEl.appendChild(createFilterPill(sev, capitalize(sev), false));
    });
  }

  renderIssueList(issues, "all");
}

function createFilterPill(value, label, active) {
  const btn = document.createElement("button");
  btn.className = "filter-pill" + (active ? " active" : "");
  btn.textContent = label;
  btn.dataset.filter = value;
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = value;
    renderIssueList(currentResult?.issues || [], value);
  });
  return btn;
}

function renderIssueList(issues, filter) {
  const list = document.getElementById("issues-list");

  if (!issues.length) {
    list.innerHTML = `<p class="no-issues">✓ Your code looks clean and well-written!</p>`;
    return;
  }

  const filtered = filter === "all" ? issues : issues.filter(i => i.severity === filter);

  if (!filtered.length) {
    list.innerHTML = `<p class="no-issues" style="color:var(--text-muted)">No ${filter} issues.</p>`;
    return;
  }

  list.innerHTML = filtered.map((issue, idx) => {
    const sev = issue.severity || "info";
    const cat = issue.category || "";
    const line = issue.line ? `Line ${issue.line}` : "";
    return `
      <div class="issue-item severity-${sev}" data-idx="${idx}">
        <div class="issue-header" onclick="toggleIssue(this.parentElement)">
          <span class="severity-badge badge-${sev}">${sev}</span>
          <span class="issue-title">${escapeHtml(issue.title)}</span>
          ${cat  ? `<span class="category-badge">${escapeHtml(cat)}</span>` : ""}
          ${line ? `<span class="line-badge">${line}</span>` : ""}
          <span class="issue-chevron">▶</span>
        </div>
        <div class="issue-body">
          <p class="issue-desc">${escapeHtml(issue.description)}</p>
        </div>
      </div>
    `;
  }).join("");
}

function toggleIssue(el) {
  el.classList.toggle("open");
}

// ── CODE BLOCKS ──────────────────────────────────────────────
function renderCodeBlocks(original, fixed, language) {
  const langMap = {
    Python: "python", JavaScript: "javascript", TypeScript: "typescript",
    Java: "java", C: "c", "C++": "cpp", Go: "go", Rust: "rust",
    PHP: "php", Ruby: "ruby", Swift: "swift", Kotlin: "kotlin",
    SQL: "sql", Bash: "bash"
  };
  const hlLang = langMap[language] || "plaintext";

  const origEl  = document.getElementById("original-code");
  const fixedEl = document.getElementById("fixed-code");

  origEl.textContent  = original;
  fixedEl.textContent = fixed;

  origEl.className  = `hljs language-${hlLang}`;
  fixedEl.className = `hljs language-${hlLang}`;

  if (window.hljs) {
    hljs.highlightElement(origEl);
    hljs.highlightElement(fixedEl);
  }
}

// ── EXPLANATION ──────────────────────────────────────────────
function renderExplanation(text) {
  document.getElementById("explanation").textContent = text || "No explanation provided.";
}

// ── SUGGESTIONS ──────────────────────────────────────────────
function renderSuggestions(suggestions) {
  const card = document.getElementById("suggestions-card");
  const body = document.getElementById("suggestions-body");

  if (!suggestions.length) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  body.innerHTML = suggestions.map(s =>
    `<div class="suggestion-item">${escapeHtml(s)}</div>`
  ).join("");
}

// ── TEST CASES ───────────────────────────────────────────────
function renderTestCases(tests) {
  const card = document.getElementById("test-cases-card");
  const body = document.getElementById("test-cases-body");

  if (!tests.length) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  body.innerHTML = tests.map(t =>
    `<div class="test-item">${escapeHtml(t)}</div>`
  ).join("");
}

// ── COPY CODE ────────────────────────────────────────────────
function copyCode(elementId) {
  const el   = document.getElementById(elementId);
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    // Find the copy button in the same code-block
    const block = el.closest(".code-block");
    const btn   = block?.querySelector(".copy-btn");
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = "✓ Copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove("copied");
      }, 2000);
    }
    showToast("Copied to clipboard!", "success");
  }).catch(() => showToast("Copy failed", "error"));
}

// ── EXPORT JSON ──────────────────────────────────────────────
function exportJSON() {
  if (!currentResult) return;
  const payload = {
    timestamp: new Date().toISOString(),
    language: document.getElementById("language").value,
    mode: document.getElementById("review-mode").value,
    result: currentResult
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `code-review-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported as JSON!", "success");
}

// ── SHARE ────────────────────────────────────────────────────
function copyShareLink() {
  if (!currentResult) return;
  const summary = [
    `AI Code Review — Score: ${currentResult.score}/100`,
    `Language: ${document.getElementById("language").value}`,
    `Issues: ${(currentResult.issues || []).length}`,
    `Summary: ${currentResult.summary || ""}`,
    `\nReviewed with AI Code Refine`
  ].join("\n");
  navigator.clipboard.writeText(summary).then(() => {
    showToast("Summary copied to clipboard!", "success");
  }).catch(() => showToast("Copy failed", "error"));
}

// ── HISTORY ──────────────────────────────────────────────────
function saveToHistory(result, code, language) {
  const entry = {
    id:        Date.now(),
    timestamp: new Date().toISOString(),
    language,
    score:     result.score,
    summary:   result.summary,
    issueCount: (result.issues || []).length,
    preview:   code.substring(0, 80).replace(/\n/g, " "),
    result,
    code
  };
  reviewHistory.unshift(entry);
  if (reviewHistory.length > 20) reviewHistory = reviewHistory.slice(0, 20);
  localStorage.setItem("reviewHistory", JSON.stringify(reviewHistory));
}

function showHistory() {
  const panel = document.getElementById("history-panel");
  const list  = document.getElementById("history-list");
  panel.classList.remove("hidden");

  if (!reviewHistory.length) {
    list.innerHTML = `<div class="history-empty">No reviews yet.<br>Analyze some code to get started!</div>`;
    return;
  }

  list.innerHTML = reviewHistory.map(entry => {
    const date  = new Date(entry.timestamp);
    const time  = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const day   = date.toLocaleDateString([], { month: "short", day: "numeric" });
    const color = entry.score >= 81 ? "var(--green)" : entry.score >= 61 ? "var(--blue)" : entry.score >= 41 ? "#e3b341" : "var(--accent)";
    return `
      <div class="history-item" onclick="loadHistoryEntry(${entry.id})">
        <div class="history-item-top">
          <span class="history-lang">${entry.language}</span>
          <span class="history-score" style="color:${color}">${entry.score}/100</span>
          <span class="history-time">${day} ${time}</span>
        </div>
        <div class="history-preview">${escapeHtml(entry.preview)}…</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${entry.issueCount} issue${entry.issueCount !== 1 ? "s" : ""}</div>
      </div>
    `;
  }).join("");
}

function loadHistoryEntry(id) {
  const entry = reviewHistory.find(e => e.id === id);
  if (!entry) return;
  closeHistory();
  document.getElementById("code-input").value = entry.code;
  document.getElementById("language").value   = entry.language;
  updateStats();
  document.getElementById("clear-btn").classList.remove("hidden");
  currentResult = entry.result;
  currentCode   = entry.code;
  displayResults(entry.result, entry.code, entry.language);
  showToast("Loaded from history", "success");
}

function closeHistory() {
  document.getElementById("history-panel").classList.add("hidden");
}

// ── TOAST ────────────────────────────────────────────────────
let toastTimer = null;

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className   = `toast${type ? " " + type : ""}`;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
}

// ── HELPERS ──────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

/* ============================================================
   EFFECTS — Custom Cursor + Animated Background Canvas
   ============================================================ */

// ── CUSTOM CURSOR ────────────────────────────────────────────
(function initCursor() {
  const dot  = document.getElementById("cursor-dot");
  const ring = document.getElementById("cursor-ring");
  if (!dot || !ring) return;

  let mouseX = -100, mouseY = -100;
  let ringX  = -100, ringY  = -100;
  let rafId;

  // Move dot instantly, ring follows with lerp
  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left    = mouseX + "px";
    dot.style.top     = mouseY + "px";
    // Make visible on first move
    dot.style.opacity  = "1";
    ring.style.opacity = "1";
  });

  // Smooth ring follow
  function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + "px";
    ring.style.top  = ringY + "px";
    rafId = requestAnimationFrame(animateRing);
  }
  animateRing();

  // Hover state on interactive elements
  const hoverTargets = "a, button, select, label, .filter-pill, .action-btn, .copy-btn, .history-item, .issue-header, .upload-btn, .theme-toggle";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(hoverTargets)) {
      document.body.classList.add("cursor-hover");
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(hoverTargets)) {
      document.body.classList.remove("cursor-hover");
    }
  });

  // Click state
  document.addEventListener("mousedown", () => document.body.classList.add("cursor-click"));
  document.addEventListener("mouseup",   () => document.body.classList.remove("cursor-click"));

  // Hide when leaving window
  document.addEventListener("mouseleave", () => {
    dot.style.opacity  = "0";
    ring.style.opacity = "0";
  });
  document.addEventListener("mouseenter", () => {
    dot.style.opacity  = "1";
    ring.style.opacity = "1";
  });
})();

// ── ANIMATED BACKGROUND CANVAS ───────────────────────────────
(function initBgCanvas() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, particles;

  const PARTICLE_COUNT = 55;
  const ACCENT = { r: 200, g: 255, b: 0 };

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function randomParticle() {
    return {
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    Math.random() * 1.6 + 0.4,
      vx:   (Math.random() - 0.5) * 0.35,
      vy:   (Math.random() - 0.5) * 0.35,
      // mix between accent and neutral grey
      hue:  Math.random() > 0.35 ? "accent" : "grey",
      alpha: Math.random() * 0.5 + 0.15,
    };
  }

  function initParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, randomParticle);
  }

  function drawParticle(p) {
    let color;
    if (p.hue === "accent") {
      color = `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${p.alpha})`;
    } else {
      const v = 80 + Math.floor(Math.random() * 40);
      color = `rgba(${v},${v},${v},${p.alpha * 0.6})`;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawConnections() {
    const MAX_DIST = 130;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.12;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(200,255,0,${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);

    // Subtle radial glow at center
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
    grad.addColorStop(0,   "rgba(200,255,0,0.03)");
    grad.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawConnections();
    particles.forEach(p => {
      drawParticle(p);
      p.x += p.vx;
      p.y += p.vy;
      // Wrap around edges
      if (p.x < -5)  p.x = W + 5;
      if (p.x > W+5) p.x = -5;
      if (p.y < -5)  p.y = H + 5;
      if (p.y > H+5) p.y = -5;
    });

    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", () => { resize(); });
  resize();
  initParticles();
  tick();
})();
