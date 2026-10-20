/* নীলের ড্যাশবোর্ড — vanilla JS, no framework */
"use strict";

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bn = n => String(n).replace(/\d/g, d => BN_DIGITS[d]);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const WEEKDAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই",
  "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

function dhakaNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
}
function dayNumber() {
  const d = dhakaNow();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
}
function fmtDate(d) {
  return `${WEEKDAYS[d.getDay()]}, ${bn(d.getDate())} ${MONTHS[d.getMonth()]} ${bn(d.getFullYear())}`;
}
function greetingText() {
  const h = dhakaNow().getHours();
  if (h >= 5 && h < 12) return "শুভ সকাল";
  if (h >= 12 && h < 15) return "শুভ দুপুর";
  if (h >= 15 && h < 18) return "শুভ বিকেল";
  if (h >= 18 && h < 21) return "শুভ সন্ধ্যা";
  return "শুভ রাত";
}
function renderDayProgress() {
  const fill = $("#dayProgressFill"), label = $("#dayProgressLabel");
  if (!fill || !label) return;
  const d = dhakaNow();
  const mins = d.getHours() * 60 + d.getMinutes();
  const pct = Math.max(2, Math.min(100, Math.round((mins - 360) / (1380 - 360) * 100)));
  fill.style.width = pct + "%";
  label.textContent = bn(pct) + "% পার হয়েছে";
}
function fmtISODate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${bn(d)} ${MONTHS[m - 1]} ${bn(y)}`;
}
function daysLeft(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const today = dayNumber();
  const target = Math.floor(Date.UTC(y, m - 1, d) / 864e5);
  return target - today;
}
function relTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "এখনই";
  const min = Math.floor(diff / 6e4), hr = Math.floor(diff / 36e5), day = Math.floor(diff / 864e5);
  if (min < 60) return bn(Math.max(1, min)) + " মিনিট আগে";
  if (hr < 24) return bn(hr) + " ঘণ্টা আগে";
  return bn(day) + " দিন আগে";
}

/* ---------------- daily rotation ----------------
   Pure function of the Dhaka date: the pool is split into day-sized
   blocks inside a shuffled cycle — no repeats until the pool cycles. */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dailyPick(pool, n, seedExtra = "") {
  if (!pool || pool.length <= n) return (pool || []).slice();
  const day = dayNumber();
  const perCycle = Math.max(1, Math.floor(pool.length / n));
  const cycle = Math.floor(day / perCycle);
  const idx = day % perCycle;
  const seed = (hashStr(seedExtra) ^ Math.imul(cycle + 1, 2654435761)) >>> 0;
  return seededShuffle(pool, mulberry32(seed)).slice(idx * n, idx * n + n);
}

/* ---------------- storage ---------------- */
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}
let toastTimer = null;
function showToast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------------- pins ---------------- */
let pins = load("nill_pins", []);
const PIN_ITEMS = {}; // id -> pin item, filled while rendering
function pinId(type, title) { return type + ":" + hashStr(title).toString(36); }
function isPinned(id) { return pins.some(p => p.id === id); }
function togglePin(id) {
  const it = PIN_ITEMS[id];
  if (!it) return;
  const was = isPinned(id);
  if (was) pins = pins.filter(p => p.id !== id);
  else pins.push({ ...it, pinned_date: fmtDate(dhakaNow()) });
  save("nill_pins", pins);
  refreshPinsUI();
  showToast(was ? "পিন সরানো হয়েছে" : "পিন করা হয়েছে");
}
function pinBtn(item) {
  PIN_ITEMS[item.id] = item;
  return `<button class="pin-btn${isPinned(item.id) ? " pinned" : ""}" data-pin="${esc(item.id)}" title="পিন করো" aria-label="পিন করো"></button>`;
}
function refreshPinsUI() {
  $$("[data-pin]").forEach(b =>
    b.classList.toggle("pinned", isPinned(b.dataset.pin)));
  $$(".pinCount").forEach(el => { el.textContent = bn(pins.length); });
  const sp = $("#statPinCount");
  if (sp) sp.textContent = bn(pins.length) + "টি";
  renderPins();
}

/* ---------------- navigation ---------------- */
const SECTIONS = [
  ["home", "⌂", "ড্যাশবোর্ড"], ["jobs", "▣", "চাকরি"], ["learn", "✳", "শেখা"],
  ["quotes", "❝", "উক্তি"], ["news", "◷", "খবর"], ["facts", "✧", "আশ্চর্য তথ্য"],
  ["growth", "☑", "আজকের উন্নতি"], ["pins", "✦", "পিন করা"],
];
const PAGE_TITLES = {
  home: "ড্যাশবোর্ড", jobs: "চাকরি", learn: "শেখা",
  quotes: "উক্তি", news: "খবর", facts: "আশ্চর্য তথ্য",
  growth: "আজকের উন্নতি", pins: "পিন করা",
};
let currentPage = "home";
function buildNav() {
  const html = SECTIONS.map(([id, glyph, label]) => {
    let extra = "";
    if (id === "jobs" && DATA.jobs) extra = `<span class="nav-count jobCount">${bn(DATA.jobs.jobs.length)}</span>`;
    if (id === "news") extra = `<span class="live-dot"></span>`;
    if (id === "pins") extra = `<span class="nav-count pinCount">${bn(pins.length)}</span>`;
    return `<button class="nav-item${id === currentPage ? " active" : ""}" data-nav="${id}"><span class="nav-icon">${glyph}</span><span>${label}</span>${extra}</button>`;
  }).join("");
  const side = $("#sideNav"), mob = $("#mainNav");
  if (side) side.innerHTML = html;
  if (mob) mob.innerHTML = html;
}
function go(page) {
  currentPage = page;
  $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + page));
  const t = $("#pageTitle");
  if (t) t.textContent = PAGE_TITLES[page] || "";
  buildNav();
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(observeReveals);
}
document.addEventListener("click", e => {
  const nav = e.target.closest("[data-nav]");
  if (nav) { e.preventDefault(); go(nav.dataset.nav); return; }
  const pin = e.target.closest("[data-pin]");
  if (pin) { togglePin(pin.dataset.pin); }
});

/* ---------------- reveal on scroll ---------------- */
const io = ("IntersectionObserver" in window) ? new IntersectionObserver(es => {
  es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
}, { threshold: 0.08 }) : null;
function observeReveals() {
  $$(".reveal:not(.in)").forEach(el => { if (io) io.observe(el); else el.classList.add("in"); });
}

/* ---------------- data ---------------- */
let DATA = { jobs: null, quotes: null, quiz: null, facts: null, growth: null, news: null };
async function getJSON(url) {
  try { const r = await fetch(url); if (!r.ok) throw 0; return await r.json(); }
  catch { return null; }
}

/* ---------------- home ---------------- */
function renderHomeChips() {
  const el = $("#statChips");
  if (!el || !DATA.jobs) return;
  const total = DATA.jobs.jobs.length;
  const upcoming = DATA.jobs.jobs
    .filter(j => j.deadline && daysLeft(j.deadline) >= 0)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  let dlVal = "—", dlFoot = "সামনে কোনো ডেডলাইন নেই";
  if (upcoming.length) {
    const left = daysLeft(upcoming[0].deadline);
    dlVal = left === 0 ? "আজই" : "আর " + bn(left) + " দিন";
    dlFoot = upcoming[0].company + " · " + fmtISODate(upcoming[0].deadline);
  }
  const chCount = new Set(DATA.jobs.jobs.map(j => j.channel)).size;
  const taught = DATA.quiz ? DATA.quiz.topics.filter(t => t.taught).length : 0;
  const tot = DATA.quiz ? DATA.quiz.topics.length : 0;
  const pct = tot ? Math.round(taught / tot * 100) : 0;
  el.innerHTML = `
<div class="stat-cell"><span class="stat-ic blue">▣</span><div><div class="stat-num">${bn(total)}টি</div><div class="stat-name">মোট আবেদন</div><div class="stat-note">${bn(chCount)}টি চ্যানেলে আবেদন চলছে</div></div></div>
<div class="stat-cell"><span class="stat-ic">✳</span><div><div class="stat-num">${bn(pct)}%</div><div class="stat-name">Word অগ্রগতি</div><div class="stat-note">${bn(taught)}/${bn(tot)}টি টপিক শেখা হয়েছে</div></div></div>
<div class="stat-cell"><span class="stat-ic amber">◷</span><div><div class="stat-num">${dlVal}</div><div class="stat-name">কাছের ডেডলাইন</div><div class="stat-note">${esc(dlFoot)}</div></div></div>
<div class="stat-cell"><span class="stat-ic purple">✦</span><div><div class="stat-num" id="statPinCount">${bn(pins.length)}টি</div><div class="stat-name">পিন করা</div><div class="stat-note">উক্তি, খবর, তথ্য ও টিপস মিলিয়ে</div></div></div>`;
}
function renderRoutine(el, routine) {
  if (!el || !routine) return;
  const order = ["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা", "রাত"];
  el.innerHTML = order.filter(k => routine[k]).map(k => `
<div class="routine-part"><div class="routine-head">${esc(k)}</div>
${routine[k].map(x => `<div class="routine-row"><span>${esc(x)}</span></div>`).join("")}</div>`).join("");
}

/* ---------------- jobs ---------------- */
const STATUSES = {
  applied: "আবেদন করা হয়েছে", shortlisted: "শর্টলিস্টেড", interview: "ইন্টারভিউ",
  rejected: "বাতিল", offer: "অফার",
};
let statusOv = load("nill_job_status", {});
let jobFilter = "সব";
let jobQuery = "";
const STATUS_PILL = { applied: "blue", shortlisted: "purple", interview: "amber", rejected: "rose", offer: "green" };
const jobKey = j => j.title + "|" + j.company + "|" + j.date;
const jobStatus = j => statusOv[jobKey(j)] || j.status || "applied";

function renderJobs() {
  const { jobs, shortlist, counters } = DATA.jobs;
  /* shortlist */
  $("#shortlistBox").innerHTML = `
<div class="shortlist-panel reveal">
<h3>শর্টলিস্ট — তোমার নিজের করা বাকি</h3>
<p class="panel-subtitle">এই আবেদনগুলো তোমাকে নিজে শেষ করতে হবে</p>
${shortlist.map(s => `
        <div class="shortlist-item"><b>${esc(s.title)}</b> — ${esc(s.company)}
          ${s.link ? ` • <a href="${esc(s.link)}" target="_blank" rel="noopener">লিংক ↗</a>` : ""}
          <div class="note">${esc(s.note)}</div></div>`).join("")}
</div>`;
  /* counters + one slim pipeline progress bar */
  const stCount = {};
  jobs.forEach(j => { const s = jobStatus(j); stCount[s] = (stCount[s] || 0) + 1; });
  const progressed = (stCount.shortlisted || 0) + (stCount.interview || 0) + (stCount.offer || 0);
  const pipePct = jobs.length ? Math.round(progressed / jobs.length * 100) : 0;
  $("#jobCounters").innerHTML = `
<div class="counter-row">
<div class="counter-item"><b>${bn(jobs.length)}টি</b><span>মোট আবেদন</span></div>
<div class="counter-item"><b>${bn(counters.nextjobz_oct)}টি</b><span>nextjobz (অক্টোবর)</span></div>
<div class="counter-item"><b>${bn(counters.shomvob_applied)}টি</b><span>Shomvob-এ মোট</span></div>
<div class="counter-item"><b>${bn(counters.bdjobs_quota)}</b><span>Bdjobs কোটা ব্যবহৃত</span></div>
</div>
<p class="pipeline-note">পাইপলাইন অগ্রগতি — শর্টলিস্ট/ইন্টারভিউ/অফারে পৌঁছেছে ${bn(progressed)}টি (${bn(pipePct)}%)</p>
<div class="progress-line"><div class="progress-fill" style="width:${pipePct}%"></div></div>`;
  /* channel bars */
  const byCh = {};
  jobs.forEach(j => byCh[j.channel] = (byCh[j.channel] || 0) + 1);
  const max = Math.max(...Object.values(byCh));
  const order = ["LinkedIn", "nextjobz", "Bdjobs", "Shomvob", "Facebook", "Email"];
  $("#channelBars").innerHTML = order.filter(c => byCh[c]).map(c => `
<div class="bar-row"><span>${esc(c)}</span>
<div class="progress-line"><div class="progress-fill" style="width:${Math.round(byCh[c] / max * 100)}%"></div></div>
<b>${bn(byCh[c])}টি</b></div>`).join("");
  /* filter chips */
  const chips = ["সব", ...order.filter(c => byCh[c])];
  $("#jobFilters").innerHTML = chips.map(c =>
    `<button class="filter-tab${jobFilter === c ? " active" : ""}" data-filter="${esc(c)}">${esc(c)}${c === "সব" ? "" : " (" + bn(byCh[c]) + ")"}</button>`
  ).join("");
  $("#jobFilters").onclick = e => {
    const b = e.target.closest("[data-filter]");
    if (b) { jobFilter = b.dataset.filter; renderJobs(); observeReveals(); }
  };
  /* list */
  const q = jobQuery.trim().toLowerCase();
  const list = jobs.filter(j => (jobFilter === "সব" || j.channel === jobFilter) &&
    (!q || (j.title + " " + j.company).toLowerCase().includes(q)));
  $("#jobList").innerHTML = list.map(j => {
    const st = jobStatus(j);
    const left = daysLeft(j.deadline);
    const dl = j.deadline
      ? (left < 0 ? `<div class="dl-line over">ডেডলাইন শেষ (${fmtISODate(j.deadline)})</div>`
        : left === 0 ? `<div class="dl-line over">ডেডলাইন আজই (${fmtISODate(j.deadline)})</div>`
        : `<div class="dl-line">ডেডলাইন: ${fmtISODate(j.deadline)} · আর ${bn(left)} দিন</div>`)
      : "";
    const opts = Object.entries(STATUSES).map(([k, v]) =>
      `<option value="${k}"${k === st ? " selected" : ""}>${v}</option>`).join("");
    const mark = esc((j.company || "?").trim().charAt(0) || "?");
    return `<article class="job-card">
<div class="job-card-head">
<span class="company-mark">${mark}</span>
<div class="job-card-title"><h3>${esc(j.title)}</h3><p>${esc(j.company)}</p></div>
<span class="pill ${STATUS_PILL[st]} status-pill">${STATUSES[st]}</span>
</div>
<div class="job-card-meta"><span class="chip">${esc(j.channel)}</span><span class="meta-txt">আবেদন: ${fmtISODate(j.date)}</span>${dl}</div>
<div class="job-card-bottom">
${j.link ? `<a class="job-link" href="${esc(j.link)}" target="_blank" rel="noopener">পোস্টিং দেখো ↗</a>` : `<span class="meta-txt" style="font-size:11px;color:#9aa59d">পোস্টিং লিংক নেই</span>`}
<select class="job-status-select" data-jobkey="${esc(jobKey(j))}" aria-label="স্ট্যাটাস বদলাও">${opts}</select>
</div></article>`;
  }).join("") || `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">▣</span><strong>কোনো আবেদন মেলেনি</strong><p>এই ফিল্টারে কোনো আবেদন নেই — অন্য চ্যানেল বেছে নাও বা খোঁজ বদলে দেখো।</p></div>`;
  $("#jobList").onchange = e => {
    const sel = e.target.closest("[data-jobkey]");
    if (!sel) return;
    statusOv[sel.dataset.jobkey] = sel.value;
    save("nill_job_status", statusOv);
    renderJobs();
  };
}

/* ---------------- learning / quiz ---------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let quiz = null;
function renderLearn() {
  const q = DATA.quiz;
  const taught = q.topics.filter(t => t.taught);
  const soon = q.topics.filter(t => !t.taught);
  const pct = Math.round(taught.length / q.topics.length * 100);
  $("#wordBar").style.width = pct + "%";
  $("#wordProgText").textContent =
    `${bn(taught.length)}/${bn(q.topics.length)}টি টপিক শেখা হয়েছে (${bn(pct)}%)`;
  $("#wordTopicsTaught").innerHTML =
    taught.map(t => `<div class="topic-row"><span class="check-chip">✓</span><span><span class="t-name">${esc(t.name)}</span><span class="t-sum">${esc(t.summary_bn)}</span></span></div>`).join("") ||
    `<p class="small muted">এখনো কোনো পাঠ শেষ হয়নি।</p>`;
  $("#wordTopicsSoon").innerHTML =
    soon.map(t => `<div class="topic-row"><span class="check-chip soon">○</span><span><span class="t-name">${esc(t.name)}</span><span class="t-sum">${esc(t.summary_bn)}</span></span></div>`).join("") ||
    `<p class="small muted">সব পাঠ শেষ — অভিনন্দন!</p>`;
  renderQuizStats();
  renderExamples();
  $("#quizStart").addEventListener("click", startQuiz);
}
function renderQuizStats() {
  const s = load("nill_quiz_stats", { best: 0, attempts: 0 });
  $("#quizStats").textContent = s.attempts
    ? `সেরা স্কোর: ${bn(s.best)}/১০ • মোট অনুশীলন: ${bn(s.attempts)} বার`
    : "এখনো অনুশীলন করোনি — আজই প্রথমটা শুরু করো!";
}
function startQuiz() {
  quiz = { qs: shuffle(DATA.quiz.questions).slice(0, 10), i: 0, score: 0, done: false };
  renderQuizQ();
  $("#quizBox").scrollIntoView({ behavior: "smooth", block: "center" });
}
function renderQuizQ() {
  const box = $("#quizBox");
  if (quiz.i >= quiz.qs.length) {
    const s = load("nill_quiz_stats", { best: 0, attempts: 0 });
    s.attempts += 1; s.best = Math.max(s.best, quiz.score);
    save("nill_quiz_stats", s);
    renderQuizStats();
    const msg = quiz.score >= 8 ? "দারুণ! তুমি প্রায় সব পারো।" :
      quiz.score >= 5 ? "ভালো হয়েছে! আরেকটু অনুশীলনেই পাক্কা হবে।" :
      "শুরুটা হলো — পাঠগুলো আরেকবার দেখে আবার চেষ্টা করো।";
    box.innerHTML = `<div class="quiz-score">স্কোর: ${bn(quiz.score)} / ${bn(quiz.qs.length)}<br>
<span class="small muted">${msg}</span></div>
<div class="center"><button class="secondary-button" id="quizAgain">আবার অনুশীলন</button></div>`;
    $("#quizAgain").addEventListener("click", startQuiz);
    return;
  }
  const item = quiz.qs[quiz.i];
  box.innerHTML = `
<div class="quiz-progress">প্রশ্ন ${bn(quiz.i + 1)} / ${bn(quiz.qs.length)} • বিষয়: ${esc(item.topic)} • স্কোর: ${bn(quiz.score)}</div>
<div class="quiz-q">${esc(item.q_bn)}</div>
<div class="quiz-options">${item.options.map((o, idx) =>
`<button class="quiz-option" data-opt="${idx}"><span class="option-letter">${"কখগঘ"[idx] || bn(idx + 1)}</span><span>${esc(o)}</span></button>`).join("")}</div>
<div id="quizExplain"></div>`;
  box.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => {
    const pick = Number(b.dataset.opt);
    box.querySelectorAll("[data-opt]").forEach(x => {
      x.disabled = true;
      if (Number(x.dataset.opt) === item.answer) x.classList.add("right");
      else if (x === b) x.classList.add("wrong");
    });
    if (pick === item.answer) quiz.score += 1;
    $("#quizExplain").innerHTML = `
<div class="quiz-explain ${pick === item.answer ? "ok" : "bad"}">${pick === item.answer ? "সঠিক উত্তর!" : "ভুল হয়েছে।"} ${esc(item.explain_bn)}</div>
<div class="center"><button class="primary-button" id="quizNext">${
quiz.i + 1 >= quiz.qs.length ? "ফলাফল দেখো" : "পরের প্রশ্ন"}</button></div>`;
    $("#quizNext").addEventListener("click", () => { quiz.i += 1; renderQuizQ(); });
  }));
}

/* mock Word example cards */
function mockBody(card) {
  const t = card.title_bn;
  const rule = (card.body_bn.split("নিয়ম:")[1] || "").trim();
  const ruleHtml = rule ? `<p class="rule">নিয়ম: ${esc(rule)}</p>` : "";
  let body = "";
  if (t.includes("টেবিল")) {
    body = `<p>টেবিল মানে সারি আর কলামের ছক — যেমন নাম আর নম্বরের তালিকা:</p>
<table class="mock-table"><tr><th>নাম</th><th>মোবাইল</th></tr>
<tr><td>মোঃ জাহুরুল হক</td><td>০১৭৯৯-২৯…</td></tr>
<tr><td>করিম উদ্দিন</td><td>০১৮১২-৩৪…</td></tr></table>`;
  } else if (t.includes("নাম্বারিং")) {
    body = `<p>পরপর ধাপ লিখতে নাম্বারিং লাগে — যেমন চাকরির আবেদনের ধাপ:</p>
<ol class="mock-ol"><li>প্রথমে বিজ্ঞপ্তিটা ভালো করে পড়ো</li><li>সিভিটা আপডেট করো</li>
<li>আবেদনপত্রটা লিখে ফেলো</li><li>পাঠানোর আগে Ctrl+S দিয়ে সেভ করো</li></ol>`;
  } else if (t.includes("বুলেট")) {
    body = `<p>ক্রম জরুরি না হলে বুলেট — যেমন ইন্টারভিউতে যা যা নেবে:</p>
<ul class="mock-ul"><li>সিভির প্রিন্ট কপি</li><li>এনআইডি কার্ডের ফটোকপি</li>
<li>পাসপোর্ট সাইজের ছবি</li><li>একটা কলম</li></ul>`;
  } else if (t.includes("শিরোনাম")) {
    body = `<p class="mock-h-demo">আবেদনপত্র</p>
<p style="text-align:center" class="small muted">(মাঝখানে, Bold, ফন্ট সাইজ ১৬)</p>
<p style="margin-top:10px">বরাবর,<br>ব্যবস্থাপক<br>…</p>`;
  } else if (t.includes("Underline")) {
    body = `<p><u>বিষয়: চাকরির জন্য আবেদন</u> &nbsp;← বিষয় লাইনে Underline দিলে চোখে পড়ে</p>
<p style="margin-top:8px">বইয়ের নাম লিখতে <i>Italic</i> মানায় — যেমন <i>হুকুশ পাকুশ</i>।</p>`;
  } else if (t.includes("সেভ")) {
    body = `<p>লেখা বাঁচানোর সোনালি ধাপগুলো পরপর:</p>
<ol class="mock-ol"><li>লেখা শেষ করো বা মাঝপথে থামো</li><li>বাম হাতে Ctrl চেপে ধরো</li>
<li>ডান হাতে S চাপো</li><li>প্রথমবার হলে ফাইলের একটা নাম দাও</li></ol>
<p>ব্যাস! লেখাটা জমা হয়ে গেল — বিদ্যুৎ গেলেও আর ভয় নেই।</p>`;
  } else {
    body = `<p style="white-space:pre-wrap">${esc(card.body_bn)}</p>`;
  }
  return body + ruleHtml;
}
function renderExamples() {
  $("#exampleGrid").innerHTML = DATA.quiz.example_cards.map(c => `
<div class="panel reveal ex-card"><h4>${esc(c.title_bn)}</h4>
<div class="mock-word">
<div class="mock-titlebar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="mock-title">WordCraft — আমার ডকুমেন্ট</span></div>
<div class="mock-ribbon"><span class="tab on">Home</span><span class="tab">Insert</span><span class="tab">Layout</span>
<span class="tools"><b>B</b> <i>I</i> <u>U</u> · তালিকা · টেবিল</span></div>
<div class="mock-body">${mockBody(c)}</div>
</div></div>`).join("");
}

/* ---------------- quotes / facts / tips (daily) ---------------- */
const QUOTE_CATS = ["আত্মোন্নয়ন", "ব্যবসা", "প্রেম", "দর্শন", "জীবন"];
let todayQuotes = [], quoteFilter = "সব";
function renderQuotes() {
  todayQuotes = QUOTE_CATS.flatMap(cat =>
    dailyPick(DATA.quotes.filter(q => q.category === cat), 2, "quote:" + cat));
  $("#quoteFilters").innerHTML = ["সব", ...QUOTE_CATS].map(c =>
    `<button class="filter-tab${quoteFilter === c ? " active" : ""}" data-qf="${esc(c)}">${esc(c)}</button>`).join("");
  $("#quoteFilters").onclick = e => {
    const b = e.target.closest("[data-qf]");
    if (b) { quoteFilter = b.dataset.qf; renderQuotes(); }
  };
  const list = todayQuotes.filter(q => quoteFilter === "সব" || q.category === quoteFilter);
  $("#quoteList").innerHTML = list.map(q => {
    const item = { id: pinId("উক্তি", q.quote_bn), type: "উক্তি", title: q.quote_bn, body: "", meta: q.book + " — " + q.author };
    return `<article class="quote-row">
<span class="quote-mark">❝</span>
<div class="row-top"><span class="chip">${esc(q.category)}</span>${pinBtn(item)}</div>
<p class="q-text">“${esc(q.quote_bn)}”</p>
<p class="q-meta"><strong>${esc(q.book)}</strong> — ${esc(q.author)}</p></article>`;
  }).join("");
  /* hero = first quote of the day */
  const h = todayQuotes[0];
  if (h) {
    const item = { id: pinId("উক্তি", h.quote_bn), type: "উক্তি", title: h.quote_bn, body: "", meta: h.book + " — " + h.author };
    $("#quoteHero").innerHTML = `
<div class="quote-feature reveal in">
<div class="quote-category">আজকের উক্তি · ${esc(h.category)}</div>
<blockquote>“${esc(h.quote_bn)}”</blockquote>
<p class="quote-meta"><strong>${esc(h.book)}</strong> — ${esc(h.author)}</p>
${pinBtn(item)}
</div>`;
  }
}
function renderFacts() {
  const facts = dailyPick(DATA.facts, 10, "facts");
  $("#factList").innerHTML = facts.map((f, i) => {
    const item = { id: pinId("তথ্য", f.fact_bn), type: "তথ্য", title: f.fact_bn, body: "", meta: "বিষয়: " + f.topic };
    return `<article class="fact-row"><span class="fact-number">${bn(i + 1)}</span>
<p>${esc(f.fact_bn)}</p>
<span class="fact-side"><span class="chip">${esc(f.topic)}</span>${pinBtn(item)}</span></article>`;
  }).join("");
}
function renderGrowth() {
  const tips = dailyPick(DATA.growth.tips, 10, "tips");
  $("#tipList").innerHTML = tips.map(t => {
    const item = { id: pinId("টিপস", t.title_bn), type: "টিপস", title: t.title_bn, body: t.detail_bn, meta: "বিভাগ: " + t.category };
    return `<article class="tip-row">
<div class="row-top"><p class="t-title">${esc(t.title_bn)}</p>${pinBtn(item)}</div>
<p>${esc(t.detail_bn)}</p>
<p style="margin-top:8px"><span class="chip">${esc(t.category)}</span></p></article>`;
  }).join("");
  renderRoutine($("#routineGrowth"), DATA.growth.routine);
}

/* ---------------- news ---------------- */
function renderNews() {
  const n = DATA.news;
  if (!n) {
    $("#newsUpdated").textContent = "খবর লোড করা যায়নি — পরে আবার চেষ্টা করো।";
    const hn = $("#homeNews");
    if (hn) hn.innerHTML = `<p class="muted small">খবর লোড করা যায়নি।</p>`;
    $("#newsContent").innerHTML = `<div class="empty-state"><span class="empty-icon">◷</span><strong>খবরের ফাইল পাওয়া যায়নি</strong><p>পরে আবার চেষ্টা করো — খবর এলেই এখানে দেখা যাবে।</p></div>`;
    return;
  }
  $("#newsUpdated").textContent = "সর্বশেষ আপডেট: " + (n.updated_label || "—");
  const groups = [["bangladesh", "বাংলাদেশ", "#2c8062"], ["tech", "প্রযুক্তি ও AI", "#5279ae"], ["world", "বিশ্ব", "#7f70a8"]];
  $("#newsContent").innerHTML = groups.map(([key, label, color]) => `
<div class="panel list-panel news-panel reveal">
<div class="news-panel-head"><span class="dot" style="background:${color}"></span><h3 class="panel-title">${label}</h3><span class="pill">${bn((n[key] || []).length)}টি খবর</span></div>
${(n[key] || []).map(it => {
const item = { id: "news-" + it.id, type: "খবর", title: it.title, body: it.summary || "",
meta: it.source + " · " + relTime(it.published), link: it.link };
return `<article class="news-row">
        <div class="news-main">
          <h4><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a></h4>
          ${it.summary ? `<p class="summary">${esc(it.summary)}</p>` : ""}
          <div class="meta-line"><span>${esc(it.source)}</span><span>·</span><span>${relTime(it.published)}</span><span>·</span><a href="${esc(it.link)}" target="_blank" rel="noopener">মূল খবর ↗</a></div>
        </div>${pinBtn(item)}</article>`;
}).join("") || `<p class="muted" style="padding:14px 0 4px">এই বিভাগে এখনো খবর নেই।</p>`}
</div>`).join("");
  renderHomeNews();
}
function renderHomeNews() {
  const el = $("#homeNews");
  if (!el || !DATA.news) return;
  const groups = [["bangladesh", "বাংলাদেশ"], ["tech", "প্রযুক্তি ও AI"], ["world", "বিশ্ব"]];
  const items = groups.flatMap(([key, label]) =>
    (DATA.news[key] || []).slice(0, 2).map(it => ({ ...it, _cat: label })));
  el.innerHTML = items.map(it => `
<div class="mini-news-item">
<div class="news-topline"><span class="chip">${esc(it._cat)}</span><span class="news-source">${esc(it.source)}</span><span class="news-time">${relTime(it.published)}</span></div>
<a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a>
${it.summary ? `<p>${esc(it.summary)}</p>` : ""}
</div>`).join("") || `<p class="muted small">খবর এখনো আসেনি।</p>`;
}

/* ---------------- pins page ---------------- */
const PIN_TYPE_ORDER = ["উক্তি", "খবর", "তথ্য", "টিপস"];
const PIN_TYPE_LABEL = { "উক্তি": "উক্তি", "খবর": "খবর", "তথ্য": "তথ্য", "টিপস": "উন্নতি-টিপস" };
function renderPins() {
  const el = $("#pinGroups");
  if (!el) return;
  if (!pins.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">✦</span><strong>এখনো কিছু পিন করোনি</strong><p>উক্তি, খবর, তথ্য বা টিপসের পাশের পিন বোতামে চাপ দিলেই তা এখানে থেকে যাবে — প্রতিদিনের সেট বদলে গেলেও।</p></div>`;
    return;
  }
  el.innerHTML = PIN_TYPE_ORDER.filter(t => pins.some(p => p.type === t)).map(t => `
<div class="panel list-panel pin-group">
<div class="panel-title-row"><div><h3 class="panel-title">${PIN_TYPE_LABEL[t]}</h3></div><span class="pill green">${bn(pins.filter(p => p.type === t).length)}টি</span></div>
${pins.filter(p => p.type === t).map(p => `
      <article class="prow"><p class="p-title${p.type === "উক্তি" ? " serif" : ""}">${p.type === "উক্তি" ? "“" + esc(p.title) + "”" : esc(p.title)}</p>
        ${p.body ? `<p>${esc(p.body)}</p>` : ""}
        <p class="q-meta">${esc(p.meta)} · পিন করা: ${esc(p.pinned_date)}</p>
        <button class="unpin-btn" data-unpin="${esc(p.id)}">পিন সরাও</button></article>`).join("")}
</div>`).join("");
}
document.addEventListener("click", e => {
  const u = e.target.closest("[data-unpin]");
  if (u) { pins = pins.filter(p => p.id !== u.dataset.unpin); save("nill_pins", pins); refreshPinsUI(); showToast("পিন সরানো হয়েছে"); }
});

/* ---------------- boot ---------------- */
(async function boot() {
  buildNav();
  const d = dhakaNow();
  $("#todayLine").textContent = fmtDate(d);
  $("#heroDate").textContent = fmtDate(d);
  $("#heroGreeting").textContent = greetingText() + ", নীল";
  const sp = $("#jobSearch");
  if (sp) sp.addEventListener("input", () => { jobQuery = sp.value; if (DATA.jobs) renderJobs(); });
  renderDayProgress();
  const [jobs, quotes, quiz, facts, growth, news] = await Promise.all([
    getJSON("data/jobs.json"), getJSON("data/quotes.json"), getJSON("data/quiz.json"),
    getJSON("data/facts.json"), getJSON("data/growth.json"), getJSON("data/news.json"),
  ]);
  DATA = { jobs, quotes, quiz, facts, growth, news };
  if (!jobs || !quotes || !quiz || !facts || !growth) {
    $("main").insertAdjacentHTML("afterbegin",
      `<div class="err-box">কিছু তথ্য লোড হয়নি — ইন্টারনেট সংযোগ দেখে পেজটি রিফ্রেশ করো।</div>`);
  }
  if (jobs) { renderJobs(); renderHomeChips(); }
  if (quiz) renderLearn();
  if (quotes) renderQuotes();
  if (facts) renderFacts();
  if (growth) { renderGrowth(); renderRoutine($("#routineHome"), growth.routine); }
  renderNews();
  buildNav();
  refreshPinsUI();
  observeReveals();
})();
