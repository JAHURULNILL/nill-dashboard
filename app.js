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

/* ---------------- pins ---------------- */
let pins = load("nill_pins", []);
const PIN_ITEMS = {}; // id -> pin item, filled while rendering
function pinId(type, title) { return type + ":" + hashStr(title).toString(36); }
function isPinned(id) { return pins.some(p => p.id === id); }
function togglePin(id) {
  const it = PIN_ITEMS[id];
  if (!it) return;
  if (isPinned(id)) pins = pins.filter(p => p.id !== id);
  else pins.push({ ...it, pinned_date: fmtDate(dhakaNow()) });
  save("nill_pins", pins);
  refreshPinsUI();
}
function pinBtn(item) {
  PIN_ITEMS[item.id] = item;
  return `<button class="pin-btn${isPinned(item.id) ? " pinned" : ""}" data-pin="${esc(item.id)}" title="পিন করো" aria-label="পিন করো">📌</button>`;
}
function refreshPinsUI() {
  $$("[data-pin]").forEach(b =>
    b.classList.toggle("pinned", isPinned(b.dataset.pin)));
  $("#pinCount").textContent = bn(pins.length);
  renderPins();
  renderHomeChips();
}

/* ---------------- navigation ---------------- */
const SECTIONS = [
  ["home", "🏠", "হোম"], ["jobs", "💼", "চাকরি"], ["learn", "📚", "শেখা"],
  ["quotes", "💬", "উক্তি"], ["news", "📰", "খবর"], ["facts", "✨", "তথ্য"],
  ["growth", "🌱", "উন্নতি"], ["pins", "📌", "পিন"],
];
let currentPage = "home";
function buildNav() {
  const html = SECTIONS.map(([id, ic, label]) =>
    `<button class="nav-btn${id === currentPage ? " active" : ""}" data-nav="${id}"><span class="ic">${ic}</span> ${label}</button>`
  ).join("");
  $("#mainNav").innerHTML = html;
  $("#bottomNav").innerHTML = html;
}
function go(page) {
  currentPage = page;
  $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + page));
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
  const week = upcoming.filter(j => daysLeft(j.deadline) <= 7).length;
  let dlVal = "—", dlLabel = "সামনে কোনো ডেডলাইন নেই";
  if (upcoming.length) {
    const left = daysLeft(upcoming[0].deadline);
    dlVal = left === 0 ? "আজই!" : "আর " + bn(left) + " দিন";
    dlLabel = "কাছের ডেডলাইন: " + upcoming[0].company;
  }
  const taught = DATA.quiz ? DATA.quiz.topics.filter(t => t.taught).length : 0;
  const tot = DATA.quiz ? DATA.quiz.topics.length : 0;
  const pct = tot ? Math.round(taught / tot * 100) : 0;
  el.innerHTML = `
    <div class="chip"><b>${bn(total)}টি</b><span>মোট আবেদন করা চাকরি</span></div>
    <div class="chip"><b>${dlVal}</b><span>${esc(dlLabel)}</span></div>
    <div class="chip"><b>${bn(week)}টি</b><span>এই সপ্তাহে ডেডলাইন</span></div>
    <div class="chip"><b>${bn(pct)}%</b><span>শেখা অগ্রগতি (Word)</span></div>
    <div class="chip"><b>${bn(pins.length)}টি</b><span>পিন করা আইটেম</span></div>`;
}
function renderHomeDeadlines() {
  const el = $("#homeDeadlines");
  const upcoming = DATA.jobs.jobs
    .filter(j => j.deadline && daysLeft(j.deadline) >= 0)
    .sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
  if (!upcoming.length) { el.innerHTML = `<p class="muted">সামনে কোনো ডেডলাইন নেই। 🎉</p>`; renderHomeChips(); return; }
  el.innerHTML = upcoming.map(j => {
    const left = daysLeft(j.deadline);
    const when = left === 0 ? "আজই!" : left === 1 ? "আগামীকাল" : "আর " + bn(left) + " দিন";
    return `<div class="dl-row"><span>${esc(j.title)}<br><span class="muted small">${esc(j.company)} • ${esc(j.channel)}</span></span>
      <span class="dl-when${left <= 1 ? " urgent" : ""}">${when}<br><span class="small muted">${fmtISODate(j.deadline)}</span></span></div>`;
  }).join("");
  renderHomeChips();
}
function renderRoutine(el, routine) {
  if (!el || !routine) return;
  const order = ["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা", "রাত"];
  const icons = { "সকাল": "🌅", "দুপুর": "☀️", "বিকেল": "🌤️", "সন্ধ্যা": "🌆", "রাত": "🌙" };
  el.innerHTML = order.filter(k => routine[k]).map(k => `
    <div class="tl-item"><h4>${icons[k] || ""} ${esc(k)}</h4>
      <ul>${routine[k].map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("");
}

/* ---------------- jobs ---------------- */
const STATUSES = {
  applied: "আবেদন করা হয়েছে", shortlisted: "শর্টলিস্টেড", interview: "ইন্টারভিউ",
  rejected: "বাতিল", offer: "অফার 🎉",
};
let statusOv = load("nill_job_status", {});
let jobFilter = "সব";
const jobKey = j => j.title + "|" + j.company + "|" + j.date;
const jobStatus = j => statusOv[jobKey(j)] || j.status || "applied";

function renderJobs() {
  const { jobs, shortlist, counters } = DATA.jobs;
  /* shortlist */
  $("#shortlistBox").innerHTML = `
    <div class="warn-card reveal">
      <h3>⚠️ শর্টলিস্ট — তোমার নিজের করা বাকি</h3>
      ${shortlist.map(s => `
        <div class="warn-item"><b>${esc(s.title)}</b> — ${esc(s.company)}
          ${s.link ? ` • <a href="${esc(s.link)}" target="_blank" rel="noopener">লিংক ↗</a>` : ""}
          <div class="note">${esc(s.note)}</div></div>`).join("")}
    </div>`;
  /* counters */
  $("#jobCounters").innerHTML = `
    <div class="counter"><b>${bn(jobs.length)}টি</b><span>মোট আবেদন (এই ড্যাশবোর্ডে)</span></div>
    <div class="counter"><b>${bn(counters.nextjobz_oct)}টি</b><span>nextjobz-এ অক্টোবরের আবেদন</span></div>
    <div class="counter"><b>${bn(counters.shomvob_applied)}টি</b><span>Shomvob-এ মোট আবেদন</span></div>
    <div class="counter"><b>${bn(counters.bdjobs_quota)}</b><span>Bdjobs মাসিক কোটা ব্যবহৃত</span></div>`;
  /* channel bars */
  const byCh = {};
  jobs.forEach(j => byCh[j.channel] = (byCh[j.channel] || 0) + 1);
  const max = Math.max(...Object.values(byCh));
  const order = ["LinkedIn", "nextjobz", "Bdjobs", "Shomvob", "Facebook", "Email"];
  $("#channelBars").innerHTML = order.filter(c => byCh[c]).map(c => `
    <div class="bar-row"><span>${esc(c)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(byCh[c] / max * 100)}%"></div></div>
      <b>${bn(byCh[c])}টি</b></div>`).join("");
  /* filter chips */
  const chips = ["সব", ...order.filter(c => byCh[c])];
  $("#jobFilters").innerHTML = chips.map(c =>
    `<button class="fchip${jobFilter === c ? " active" : ""}" data-filter="${esc(c)}">${esc(c)}${c === "সব" ? "" : " (" + bn(byCh[c]) + ")"}</button>`
  ).join("");
  $("#jobFilters").onclick = e => {
    const b = e.target.closest("[data-filter]");
    if (b) { jobFilter = b.dataset.filter; renderJobs(); observeReveals(); }
  };
  /* list */
  const list = jobs.filter(j => jobFilter === "সব" || j.channel === jobFilter);
  $("#jobList").innerHTML = list.map(j => {
    const st = jobStatus(j);
    const left = daysLeft(j.deadline);
    const dl = j.deadline
      ? (left < 0 ? `<span class="job-dl over">ডেডলাইন শেষ (${fmtISODate(j.deadline)})</span>`
        : left === 0 ? `<span class="job-dl over">ডেডলাইন আজই! (${fmtISODate(j.deadline)})</span>`
        : `<span class="job-dl">ডেডলাইন: ${fmtISODate(j.deadline)} • আর ${bn(left)} দিন</span>`)
      : "";
    const opts = Object.entries(STATUSES).map(([k, v]) =>
      `<option value="${k}"${k === st ? " selected" : ""}>${v}</option>`).join("");
    return `<article class="job-card reveal">
      <h4>${esc(j.title)}</h4>
      <div class="job-meta"><span class="tag">${esc(j.channel)}</span>
        <span>🏢 ${esc(j.company)}</span><span>📅 ${fmtISODate(j.date)}</span></div>
      ${dl}
      <div class="job-foot">
        <select class="status-sel s-${st}" data-jobkey="${esc(jobKey(j))}" aria-label="স্ট্যাটাস">${opts}</select>
        ${j.link ? `<a class="job-link" href="${esc(j.link)}" target="_blank" rel="noopener">পোস্টিং ↗</a>` : ""}
      </div></article>`;
  }).join("") || `<div class="empty-state">এই চ্যানেলে কোনো আবেদন নেই।</div>`;
  $("#jobList").onchange = e => {
    const sel = e.target.closest("[data-jobkey]");
    if (!sel) return;
    statusOv[sel.dataset.jobkey] = sel.value;
    save("nill_job_status", statusOv);
    sel.className = "status-sel s-" + sel.value;
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
  $("#wordTopics").innerHTML =
    taught.map(t => `<div class="topic-item"><b>✅ ${esc(t.name)}</b>${esc(t.summary_bn)}</div>`).join("") +
    soon.map(t => `<div class="topic-item"><b>🔜 ${esc(t.name)} <span class="soon">আসন্ন পাঠ</span></b>${esc(t.summary_bn)}</div>`).join("");
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
    const msg = quiz.score >= 8 ? "দারুণ! তুমি প্রায় সব পারো 🏆" :
      quiz.score >= 5 ? "ভালো হয়েছে! আরেকটু অনুশীলনেই পাক্কা হবে 💪" :
      "শুরুটা হলো — পাঠগুলো আরেকবার দেখে আবার চেষ্টা করো 🌱";
    box.innerHTML = `<div class="quiz-score">স্কোর: ${bn(quiz.score)} / ${bn(quiz.qs.length)}<br>
      <span class="small muted">${msg}</span></div>
      <div class="center"><button class="btn ghost" id="quizAgain">🔁 আবার অনুশীলন</button></div>`;
    $("#quizAgain").addEventListener("click", startQuiz);
    return;
  }
  const item = quiz.qs[quiz.i];
  box.innerHTML = `
    <div class="small muted">প্রশ্ন ${bn(quiz.i + 1)} / ${bn(quiz.qs.length)} • বিষয়: ${esc(item.topic)} • স্কোর: ${bn(quiz.score)}</div>
    <div class="quiz-q">${esc(item.q_bn)}</div>
    <div class="quiz-opts">${item.options.map((o, idx) =>
      `<button class="opt-btn" data-opt="${idx}">${bn(idx + 1)}. ${esc(o)}</button>`).join("")}</div>
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
      <div class="quiz-explain">${pick === item.answer ? "✅ সঠিক!" : "❌ ভুল হয়েছে।"} ${esc(item.explain_bn)}</div>
      <div class="center" style="margin-top:12px"><button class="btn" id="quizNext">${
        quiz.i + 1 >= quiz.qs.length ? "ফলাফল দেখো" : "পরের প্রশ্ন ➡️"}</button></div>`;
    $("#quizNext").addEventListener("click", () => { quiz.i += 1; renderQuizQ(); });
  }));
}

/* mock Word example cards */
function mockBody(card) {
  const t = card.title_bn;
  const rule = (card.body_bn.split("নিয়ম:")[1] || "").trim();
  const ruleHtml = rule ? `<p class="rule">📌 নিয়ম: ${esc(rule)}</p>` : "";
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
      <p>ব্যাস! লেখাটা জমা হয়ে গেল — বিদ্যুৎ গেলেও আর ভয় নেই। ⚡</p>`;
  } else {
    body = `<p style="white-space:pre-wrap">${esc(card.body_bn)}</p>`;
  }
  return body + ruleHtml;
}
function renderExamples() {
  $("#exampleGrid").innerHTML = DATA.quiz.example_cards.map(c => `
    <div class="card reveal ex-card"><h4>${esc(c.title_bn)}</h4>
      <div class="mock-word">
        <div class="mock-titlebar"><span class="dot"></span><span class="dot"></span><span class="dot"></span> 📄 WordCraft — আমার ডকুমেন্ট</div>
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
    `<button class="fchip${quoteFilter === c ? " active" : ""}" data-qf="${esc(c)}">${esc(c)}</button>`).join("");
  $("#quoteFilters").onclick = e => {
    const b = e.target.closest("[data-qf]");
    if (b) { quoteFilter = b.dataset.qf; renderQuotes(); }
  };
  const list = todayQuotes.filter(q => quoteFilter === "সব" || q.category === quoteFilter);
  $("#quoteGrid").innerHTML = list.map(q => {
    const item = { id: pinId("উক্তি", q.quote_bn), type: "উক্তি", title: q.quote_bn, body: "", meta: q.book + " — " + q.author };
    return `<article class="qcard reveal">${pinBtn(item)}
      <span class="tag" style="align-self:flex-start">${esc(q.category)}</span>
      <p class="q-text">“${esc(q.quote_bn)}”</p>
      <p class="q-meta">📖 ${esc(q.book)}<br>✍️ ${esc(q.author)}</p></article>`;
  }).join("");
  observeReveals();
  /* hero = first quote of the day */
  const h = todayQuotes[0];
  if (h) {
    const item = { id: pinId("উক্তি", h.quote_bn), type: "উক্তি", title: h.quote_bn, body: "", meta: h.book + " — " + h.author };
    $("#quoteHero").innerHTML = `${pinBtn(item)}
      <p class="q-text">“${esc(h.quote_bn)}”</p>
      <p class="q-meta">📖 ${esc(h.book)} • ✍️ ${esc(h.author)}</p>`;
  }
}
function renderFacts() {
  const facts = dailyPick(DATA.facts, 10, "facts");
  $("#factGrid").innerHTML = facts.map((f, i) => {
    const item = { id: pinId("তথ্য", f.fact_bn), type: "তথ্য", title: f.fact_bn, body: "", meta: "বিষয়: " + f.topic };
    return `<article class="qcard reveal">${pinBtn(item)}
      <div class="fact-head"><span class="fact-num">${bn(i + 1)}</span>
      <div><span class="tag">${esc(f.topic)}</span>
      <p style="margin-top:8px">${esc(f.fact_bn)}</p></div></div></article>`;
  }).join("");
  observeReveals();
}
function renderGrowth() {
  const tips = dailyPick(DATA.growth.tips, 10, "tips");
  $("#tipGrid").innerHTML = tips.map(t => {
    const item = { id: pinId("টিপস", t.title_bn), type: "টিপস", title: t.title_bn, body: t.detail_bn, meta: "বিভাগ: " + t.category };
    return `<article class="qcard reveal tip-card">${pinBtn(item)}
      <span class="tag" style="align-self:flex-start">${esc(t.category)}</span>
      <p class="t-title">${esc(t.title_bn)}</p><p>${esc(t.detail_bn)}</p></article>`;
  }).join("");
  renderRoutine($("#routineGrowth"), DATA.growth.routine);
  observeReveals();
}

/* ---------------- news ---------------- */
function renderNews() {
  const n = DATA.news;
  if (!n) {
    $("#newsUpdated").textContent = "খবর লোড করা যায়নি — পরে আবার চেষ্টা করো।";
    $("#newsContent").innerHTML = `<div class="empty-state"><span class="big">📡</span>খবরের ফাইল পাওয়া যায়নি।</div>`;
    return;
  }
  $("#newsUpdated").textContent = "🕐 সর্বশেষ আপডেট: " + fmtDate(dhakaNow()) + " — " + relTime(n.updated);
  const groups = [["bangladesh", "🇧🇩 বাংলাদেশ"], ["tech", "🤖 প্রযুক্তি ও AI"], ["world", "🌍 বিশ্ব"]];
  $("#newsContent").innerHTML = groups.map(([key, label]) => `
    <div class="news-group"><h3>${label}</h3>
    ${(n[key] || []).map(it => {
      const item = { id: pinId("খবর", it.title), type: "খবর", title: it.title, body: it.summary, meta: it.source };
      return `<article class="news-item reveal">${pinBtn(item)}
        <h4><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a></h4>
        ${it.summary ? `<p>${esc(it.summary)}</p>` : ""}
        <div class="news-meta"><span>📰 ${esc(it.source)}</span><span>🕐 ${relTime(it.published)}</span>
        <a href="${esc(it.link)}" target="_blank" rel="noopener">মূল খবর ↗</a></div></article>`;
    }).join("") || `<div class="empty-state">এই বিভাগে এখনো খবর নেই।</div>`}
    </div>`).join("");
  observeReveals();
}

/* ---------------- pins page ---------------- */
const PIN_TYPE_ORDER = ["উক্তি", "খবর", "তথ্য", "টিপস"];
const PIN_TYPE_LABEL = { "উক্তি": "💬 উক্তি", "খবর": "📰 খবর", "তথ্য": "✨ তথ্য", "টিপস": "🌱 উন্নতি-টিপস" };
function renderPins() {
  const el = $("#pinGroups");
  if (!el) return;
  if (!pins.length) {
    el.innerHTML = `<div class="empty-state"><span class="big">📌</span>
      এখনো কিছু পিন করোনি।<br>উক্তি, খবর, তথ্য বা টিপসের পাশে 📌 চাপলেই তা এখানে থেকে যাবে — প্রতিদিনের সেট বদলে গেলেও।</div>`;
    return;
  }
  el.innerHTML = PIN_TYPE_ORDER.filter(t => pins.some(p => p.type === t)).map(t => `
    <div class="pin-group"><h3>${PIN_TYPE_LABEL[t]}</h3>
    <div class="grid-cards">${pins.filter(p => p.type === t).map(p => `
      <article class="qcard"><p class="${p.type === "উক্তি" ? "q-text" : "t-title"}">${p.type === "উক্তি" ? "“" + esc(p.title) + "”" : esc(p.title)}</p>
        ${p.body ? `<p>${esc(p.body)}</p>` : ""}
        <p class="q-meta">${esc(p.meta)}<br><span class="small">📌 পিন করা: ${esc(p.pinned_date)}</span></p>
        <button class="unpin-btn" data-unpin="${esc(p.id)}">✖ পিন সরাও</button></article>`).join("")}
    </div></div>`).join("");
}
document.addEventListener("click", e => {
  const u = e.target.closest("[data-unpin]");
  if (u) { pins = pins.filter(p => p.id !== u.dataset.unpin); save("nill_pins", pins); refreshPinsUI(); }
});

/* ---------------- boot ---------------- */
(async function boot() {
  buildNav();
  const d = dhakaNow();
  $("#todayLine").textContent = fmtDate(d);
  $("#heroDate").textContent = "আজ " + fmtDate(d) + " — আজকের সবকিছু নতুন করে সাজানো হয়েছে।";
  const [jobs, quotes, quiz, facts, growth, news] = await Promise.all([
    getJSON("data/jobs.json"), getJSON("data/quotes.json"), getJSON("data/quiz.json"),
    getJSON("data/facts.json"), getJSON("data/growth.json"), getJSON("data/news.json"),
  ]);
  DATA = { jobs, quotes, quiz, facts, growth, news };
  if (!jobs || !quotes || !quiz || !facts || !growth) {
    $("main").insertAdjacentHTML("afterbegin",
      `<div class="err-box">⚠️ কিছু তথ্য লোড হয়নি — ইন্টারনেট সংযোগ দেখে পেজটি রিফ্রেশ করো।</div>`);
  }
  if (jobs) { renderHomeDeadlines(); renderJobs(); }
  if (quiz) renderLearn();
  if (quotes) renderQuotes();
  if (facts) renderFacts();
  if (growth) { renderGrowth(); renderRoutine($("#routineHome"), growth.routine); }
  renderNews();
  refreshPinsUI();
  observeReveals();
})();
