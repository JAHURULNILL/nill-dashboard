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
function dayProgressPct() {
  const d = dhakaNow();
  const mins = d.getHours() * 60 + d.getMinutes();
  return Math.max(2, Math.min(100, Math.round((mins - 360) / (1380 - 360) * 100)));
}
function renderDayProgress() {
  const pct = dayProgressPct();
  const fill = $("#dayProgressFill"), label = $("#dayProgressLabel");
  if (fill) fill.style.width = pct + "%";
  if (label) label.textContent = bn(pct) + "% পার হয়েছে";
  const ring = $("#ringFg"), rp = $("#ringPct");
  if (ring) ring.style.strokeDashoffset = (389.6 * (1 - pct / 100)).toFixed(1);
  if (rp) rp.textContent = bn(pct) + "%";
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
  ["home", "i-home", "আজ"], ["jobs", "i-job", "চাকরি"], ["learn", "i-learn", "শেখা"],
  ["quotes", "i-book", "বই"], ["news", "i-news", "খবর"], ["facts", "i-spark", "বিস্ময়"],
  ["growth", "i-up", "উন্নতি"], ["pins", "i-pin", "পিন করা"],
];
const PAGE_TITLES = {
  home: "আজ", jobs: "চাকরি", learn: "শেখা",
  quotes: "বই", news: "খবর", facts: "বিস্ময়",
  growth: "উন্নতি", pins: "পিন করা",
};
let currentPage = "home";
function buildNav() {
  const html = SECTIONS.map(([id, icon, label]) => {
    let extra = "";
    if (id === "jobs" && DATA.jobs) extra = `<span class="nav-count jobCount">${bn(DATA.jobs.jobs.length)}</span>`;
    if (id === "news") extra = `<span class="live-dot"></span>`;
    if (id === "pins") extra = `<span class="nav-count pinCount">${bn(pins.length)}</span>`;
    return `<button class="nav-item${id === currentPage ? " active" : ""}" data-nav="${id}"><svg class="ico"><use href="#${icon}"/></svg><span>${label}</span>${extra}</button>`;
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
function splitRoutineItem(x) {
  const i = x.indexOf(" — ");
  if (i < 0) return { time: "", text: x };
  return { time: x.slice(0, i).trim(), text: x.slice(i + 3).trim() };
}
function renderHomeChips() {
  if (!DATA.jobs) return;
  const jobs = DATA.jobs.jobs;
  const stCount = {};
  jobs.forEach(j => { const s = jobStatus(j); stCount[s] = (stCount[s] || 0) + 1; });
  const progressed = (stCount.shortlisted || 0) + (stCount.interview || 0) + (stCount.offer || 0);
  const pct = jobs.length ? Math.round(progressed / jobs.length * 100) : 0;
  const ms = $("#jobMiniStats");
  if (ms) ms.innerHTML = `<div><b>${bn(jobs.length)}</b><span>আবেদন</span></div><div><b>${bn(stCount.interview || 0)}</b><span>ইন্টারভিউ</span></div>`;
  const bar = $("#jobMiniBar");
  if (bar) bar.style.width = Math.max(4, pct) + "%";
  const note = $("#jobMiniNote");
  if (note) note.textContent = `শর্টলিস্ট/ইন্টারভিউ/অফারে পৌঁছেছে ${bn(progressed)}টি (${bn(pct)}%)`;
  if (DATA.quiz) {
    const taught = DATA.quiz.topics.filter(t => t.taught);
    const next = DATA.quiz.topics.find(t => !t.taught);
    const lp = Math.round(taught.length / DATA.quiz.topics.length * 100);
    const ln = $("#learnNext");
    if (ln) ln.textContent = next ? "পরের পাঠ: " + next.name : "সব পাঠ শেষ — অভিনন্দন!";
    const lb = $("#learnBar");
    if (lb) lb.style.width = lp + "%";
    const lpt = $("#learnPct");
    if (lpt) lpt.textContent = bn(lp) + "% শেষ · " + bn(taught.length) + "/" + bn(DATA.quiz.topics.length) + "টি টপিক";
  }
}
function renderStreak() {
  const el = $("#streakCard");
  if (!el || !DATA.jobs) return;
  const counts = new Array(7).fill(0);
  const today = dayNumber();
  DATA.jobs.jobs.forEach(j => {
    if (!j.date) return;
    const [y, m, d] = j.date.split("-").map(Number);
    const diff = today - Math.floor(Date.UTC(y, m - 1, d) / 864e5);
    if (diff >= 0 && diff < 7) counts[6 - diff] += 1;
  });
  const total = counts.reduce((a, b) => a + b, 0);
  const short = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
  const dow = dhakaNow().getDay();
  const week = counts.map((c, i) => {
    const label = i === 6 ? "আজ" : short[(dow - (6 - i) + 7) % 7];
    return `<div class="${c > 0 ? "on" : ""}${i === 6 ? " today" : ""}"><i></i>${label}</div>`;
  }).join("");
  el.innerHTML = `<div class="streak">
<div class="h2" style="margin:0">এই সপ্তাহের গতি</div>
<div class="big"><svg class="ico"><use href="#i-flame"/></svg><b>${bn(total)}টি</b></div>
<p class="muted" style="font-size:14.5px;color:#7d3347">গত ৭ দিনে করা আবেদন — সব মিলিয়ে মোট ${bn(DATA.jobs.jobs.length)}টি আবেদন জমা পড়েছে।</p>
<div class="week">${week}</div></div>`;
}
const HERO_CHECK = `<span class="box"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5"/></svg></span>`;
function updateArc() {
  const boxes = $$("#heroTasks input");
  if (!boxes.length) return;
  const n = boxes.filter(b => b.checked).length;
  const fg = $("#arcFg");
  if (fg) fg.style.strokeDashoffset = (248.2 * (1 - n / boxes.length)).toFixed(1);
  const an = $("#arcN");
  if (an) an.textContent = bn(n) + "/" + bn(boxes.length);
}
function renderHeroTasks() {
  const el = $("#heroTasks");
  if (!el || !DATA.growth) return;
  const r = DATA.growth.routine;
  const picks = [];
  ["সকাল", "দুপুর", "রাত"].forEach(k => {
    if (r[k] && r[k].length) {
      const { time, text } = splitRoutineItem(r[k][0]);
      picks.push({ time: time.replace(k, "").trim() || time, text });
    }
  });
  el.innerHTML = picks.map(p => `
<label class="check"><input type="checkbox">${HERO_CHECK}<span class="txt">${esc(p.text)}<small>${esc(p.time)}</small></span></label>`).join("");
  el.querySelectorAll("input").forEach(i => i.addEventListener("change", updateArc));
  updateArc();
}
function renderRoutine(el, routine) {
  if (!el || !routine) return;
  const order = ["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা", "রাত"];
  el.innerHTML = order.filter(k => routine[k]).map(k => `
<div class="routine-part"><div class="routine-head">${esc(k)}</div>
${routine[k].map(x => { const { time, text } = splitRoutineItem(x); return `<div class="routine-row">${time ? `<span class="rt">${esc(time)}</span>` : ""}${esc(text)}</div>`; }).join("")}</div>`).join("");
}
function renderRoutineSlots(el, routine) {
  if (!el || !routine) return;
  const order = ["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা", "রাত"];
  el.innerHTML = order.filter(k => routine[k]).map(k => `
<div class="slot"><div class="slot-h">${esc(k)}</div><div class="card">
${routine[k].map(x => { const { time, text } = splitRoutineItem(x); return `<div class="slot-row">${time ? `<span class="tm">${esc(time.replace(k, "").trim() || time)}</span>` : ""}<p>${esc(text)}</p></div>`; }).join("")}
</div></div>`).join("");
}
function renderRoutineMini(el, routine) {
  if (!el || !routine) return;
  const order = ["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা", "রাত"];
  el.innerHTML = order.filter(k => routine[k]).map(k =>
    `<div class="mini-routine-row"><b>${esc(k)}</b><span>${bn(routine[k].length)}টি কাজ</span></div>`).join("");
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

const AV_COLORS = ["#4357E8", "#1BA383", "#F2A413", "#E2536F", "#2C97D3", "#7B4FD2", "#2B3566", "#F08A5D"];
function renderJobs() {
  const { jobs, shortlist, counters } = DATA.jobs;
  /* shortlist — gold tint card */
  $("#shortlistBox").innerHTML = `
<div class="card tint t-gold shortlist-card reveal">
<div class="h2">শর্টলিস্ট — তোমার নিজের করা বাকি</div>
<p style="font-size:14.5px;color:#6B4A06;margin-bottom:8px">এই আবেদনগুলো তোমাকে নিজে শেষ করতে হবে — মোট ${bn(shortlist.length)}টি।</p>
${shortlist.map(s => `
<div class="shortlist-item"><b>${esc(s.title)}</b> — ${esc(s.company)}${s.link ? ` · <a href="${esc(s.link)}" target="_blank" rel="noopener">লিংক ↗</a>` : ""}
<div class="note">${esc(s.note)}</div></div>`).join("")}
</div>`;
  /* counters + pipeline */
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
<div class="bar"><i style="width:${pipePct}%"></i></div>`;
  /* channel bars */
  const byCh = {};
  jobs.forEach(j => byCh[j.channel] = (byCh[j.channel] || 0) + 1);
  const max = Math.max(...Object.values(byCh));
  const order = ["LinkedIn", "nextjobz", "Bdjobs", "Shomvob", "Facebook", "Email"];
  const chColors = { LinkedIn: "#4357E8", nextjobz: "#2C97D3", Bdjobs: "#1BA383", Shomvob: "#F2A413", Facebook: "#7B4FD2", Email: "#E2536F" };
  $("#channelBars").innerHTML = order.filter(c => byCh[c]).map(c => `
<div class="bar-row"><span>${esc(c)}</span>
<div class="bar"><i style="width:${Math.round(byCh[c] / max * 100)}%;background:${chColors[c] || "var(--indigo)"}"></i></div>
<b>${bn(byCh[c])}টি</b></div>`).join("");
  /* funnel — real counts by effective status */
  const fnStages = [
    ["মোট আবেদন", jobs.length, "t-gold"], ["আবেদন করা", stCount.applied || 0, "t-indigo"],
    ["শর্টলিস্ট", stCount.shortlisted || 0, "t-sky"], ["ইন্টারভিউ", stCount.interview || 0, "t-plum"],
    ["অফার", stCount.offer || 0, "t-mint"],
  ];
  $("#jobFunnel").innerHTML = fnStages.map(([label, n, tint]) =>
    `<div class="fn tint ${tint}"><b>${bn(n)}</b><span>${label}</span></div>`).join("");
  /* filter tabs */
  const chips = ["সব", ...order.filter(c => byCh[c])];
  $("#jobFilters").innerHTML = chips.map(c =>
    `<button class="tab${jobFilter === c ? " on" : ""}" data-filter="${esc(c)}">${esc(c)}${c === "সব" ? "" : " (" + bn(byCh[c]) + ")"}</button>`
  ).join("");
  $("#jobFilters").onclick = e => {
    const b = e.target.closest("[data-filter]");
    if (b) { jobFilter = b.dataset.filter; renderJobs(); observeReveals(); }
  };
  /* kanban board */
  const q = jobQuery.trim().toLowerCase();
  const list = jobs.filter(j => (jobFilter === "সব" || j.channel === jobFilter) &&
    (!q || (j.title + " " + j.company).toLowerCase().includes(q)));
  const COLS = [["applied", "আবেদন করা"], ["shortlisted", "শর্টলিস্ট"], ["interview", "ইন্টারভিউ"], ["rejected", "রিজেক্ট"], ["offer", "অফার"], ["other", "অন্যান্য"]];
  const colJobs = {};
  COLS.forEach(([k]) => colJobs[k] = []);
  list.forEach(j => {
    const s = jobStatus(j);
    colJobs[STATUSES[s] ? s : "other"].push(j);
  });
  const searching = q.length > 0;
  $("#jobList").innerHTML = COLS.filter(([k]) => k !== "other" || colJobs.other.length)
    .filter(([k]) => !searching || colJobs[k].length)
    .map(([k, label]) => `
<div class="col"><div class="col-h">${label} <em>${bn(colJobs[k].length)}</em></div>
${colJobs[k].map(j => {
  const st = jobStatus(j);
  const left = daysLeft(j.deadline);
  const dlChip = j.deadline
    ? (left < 0 ? `<span class="chip rose">ডেডলাইন শেষ</span>`
      : left === 0 ? `<span class="chip rose">ডেডলাইন আজই</span>`
      : left <= 7 ? `<span class="chip rose">ডেডলাইন ${fmtISODate(j.deadline)}</span>`
      : `<span class="chip">ডেডলাইন ${fmtISODate(j.deadline)}</span>`)
    : "";
  const opts = Object.entries(STATUSES).map(([ok, v]) =>
    `<option value="${ok}"${ok === st ? " selected" : ""}>${v}</option>`).join("");
  const mark = esc((j.company || "?").trim().charAt(0) || "?");
  const avBg = AV_COLORS[hashStr(j.company || "") % AV_COLORS.length];
  return `<article class="job">
<div class="who"><span class="av" style="background:${avBg}">${mark}</span><div><b>${esc(j.title)}</b><small>${esc(j.company)}</small></div></div>
<div class="tags"><span class="chip indigo">${esc(j.channel)}</span><span class="chip">আবেদন ${fmtISODate(j.date)}</span>${dlChip}</div>
<div class="job-foot">
${j.link ? `<a class="job-link" href="${esc(j.link)}" target="_blank" rel="noopener">পোস্টিং দেখো ↗</a>` : `<span class="no-link">লিংক নেই</span>`}
<select class="job-status-select" data-jobkey="${esc(jobKey(j))}" aria-label="স্ট্যাটাস বদলাও">${opts}</select>
</div></article>`;
}).join("") || `<p class="muted" style="font-size:14px;padding:2px 8px 6px">এই ধাপে কিছু নেই</p>`}
</div>`).join("") || `<div class="empty-state" style="min-width:260px"><span class="empty-icon">▣</span><strong>কোনো আবেদন মেলেনি</strong><p>এই খোঁজে কোনো আবেদন নেই — অন্য নামে খুঁজে দেখো।</p></div>`;
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
  const twb = $("#topicWordBar");
  if (twb) twb.style.width = pct + "%";
  const twp = $("#topicWordPct");
  if (twp) twp.textContent = bn(pct) + "% শেষ · " + bn(taught.length) + "/" + bn(q.topics.length) + "টি টপিক";
  $("#wordProgText").textContent =
    `${bn(taught.length)}/${bn(q.topics.length)}টি শেখা হয়েছে`;
  const total = q.topics.length;
  $("#wordTopicsTaught").innerHTML =
    taught.map((t, i) => `<div class="node done${soon.length === 0 && i === taught.length - 1 ? " last" : ""}"><span class="pin-n">✓</span><div><b>${esc(t.name)}</b><small>${esc(t.summary_bn)}</small></div></div>`).join("") ||
    `<p class="small muted">এখনো কোনো পাঠ শেষ হয়নি।</p>`;
  $("#wordTopicsSoon").innerHTML =
    soon.map((t, i) => {
      const num = taught.length + i + 1;
      const last = i === soon.length - 1 ? " last" : "";
      if (i === 0) return `<div class="node now${last}"><span class="pin-n">${bn(num)}</span><div><b>${esc(t.name)}</b><small>${esc(t.summary_bn)}</small><small style="color:var(--indigo-d);font-weight:600">এখন শেখার পালা · মোট ${bn(total)}টির মধ্যে ${bn(num)} নম্বর</small></div></div>`;
      return `<div class="node lock${last}"><span class="pin-n">${bn(num)}</span><div><b>${esc(t.name)}</b><small>${esc(t.summary_bn)}</small></div></div>`;
    }).join("") ||
    `<p class="small muted">সব পাঠ শেষ — অভিনন্দন!</p>`;
  renderQuizStats();
  renderExamples();
  $("#quizStart").addEventListener("click", startQuiz);
}
function renderQuizStats() {
  const s = load("nill_quiz_stats", { best: 0, attempts: 0 });
  $("#quizStats").textContent = s.attempts
    ? `সেরা স্কোর ${bn(s.best)}/১০ · মোট অনুশীলন ${bn(s.attempts)} বার`
    : "এখনো অনুশীলন করোনি";
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
<div class="center" style="margin-top:12px"><button class="btn indigo" id="quizAgain">আবার অনুশীলন</button></div>`;
    $("#quizAgain").addEventListener("click", startQuiz);
    return;
  }
  const item = quiz.qs[quiz.i];
  box.innerHTML = `
<div class="q-chips"><span class="chip indigo">প্রশ্ন ${bn(quiz.i + 1)} / ${bn(quiz.qs.length)}</span><span class="chip mint">স্কোর ${bn(quiz.score)}</span><span class="chip sky">বিষয়: ${esc(item.topic)}</span></div>
<p class="q-t">${esc(item.q_bn)}</p>
<div class="opts">${item.options.map((o, idx) =>
`<button class="opt" data-opt="${idx}"><span class="l">${"কখগঘ"[idx] || bn(idx + 1)}</span><span>${esc(o)}</span></button>`).join("")}</div>
<div id="quizExplain"></div>`;
  box.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => {
    const pick = Number(b.dataset.opt);
    box.querySelectorAll("[data-opt]").forEach(x => {
      x.disabled = true;
      if (Number(x.dataset.opt) === item.answer) x.classList.add("ok");
      else if (x === b) x.classList.add("no");
    });
    if (pick === item.answer) quiz.score += 1;
    $("#quizExplain").innerHTML = `
<div class="explain show"><b>${pick === item.answer ? "সঠিক উত্তর!" : "আরেকটু হলেই হতো"}</b><span>${esc(item.explain_bn)}</span></div>
<div class="quiz-foot"><span class="muted" style="font-size:14px">${bn(quiz.i + 1)}টি প্রশ্নের উত্তর দেওয়া হলো</span><button class="btn indigo" id="quizNext">${
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
<div class="card reveal"><h4>${esc(c.title_bn)}</h4>
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
const bookShort = b => String(b || "").replace(/\s*\([^)]*\)\s*$/, "").trim() || b;
const coverClass = b => "c" + (hashStr(String(b || "")) % 8 + 1);
function renderQuotes() {
  todayQuotes = QUOTE_CATS.flatMap(cat =>
    dailyPick(DATA.quotes.filter(q => q.category === cat), 2, "quote:" + cat));
  $("#quoteFilters").innerHTML = ["সব", ...QUOTE_CATS].map(c =>
    `<button class="tab${quoteFilter === c ? " on" : ""}" data-qf="${esc(c)}">${esc(c)}</button>`).join("");
  $("#quoteFilters").onclick = e => {
    const b = e.target.closest("[data-qf]");
    if (b) { quoteFilter = b.dataset.qf; renderQuotes(); }
  };
  const cats = QUOTE_CATS.filter(c => quoteFilter === "সব" || c === quoteFilter);
  $("#quoteList").innerHTML = cats.map(cat => {
    const list = todayQuotes.filter(q => q.category === cat);
    if (!list.length) return "";
    return `<div class="shelf">
<div class="shelf-h"><h2>${esc(cat)}</h2><p>আজকের ${bn(list.length)}টি উক্তি</p></div>
<div class="books">${list.map(q => {
  const item = { id: pinId("উক্তি", q.quote_bn), type: "উক্তি", title: q.quote_bn, body: "", meta: q.book + " — " + q.author };
  return `<div class="bk">
<div class="cover ${coverClass(q.book)}"><i>${esc(q.category)}</i><strong>${esc(bookShort(q.book))}</strong><span class="cov-author">${esc(q.author)}</span></div>
<div class="bk-row"><p class="bk-q">“${esc(q.quote_bn)}”</p></div>
<div class="bk-row"><p class="bk-a">${esc(q.author)}</p>${pinBtn(item)}</div>
</div>`;
}).join("")}</div></div>`;
  }).join("");
  /* home book-of-the-day = first quote of the day */
  const h = todayQuotes[0];
  if (h) {
    const item = { id: pinId("উক্তি", h.quote_bn), type: "উক্তি", title: h.quote_bn, body: "", meta: h.book + " — " + h.author };
    $("#quoteHero").innerHTML = `
<div class="h2">আজকের বই</div>
<div class="mini-book">
<div class="cover ${coverClass(h.book)}" style="padding:12px 10px 10px 16px"><i>${esc(h.category)}</i><strong style="font-size:14px">${esc(bookShort(h.book))}</strong></div>
<div style="min-width:0"><b>${esc(bookShort(h.book))}</b><p class="muted" style="font-size:14px">${esc(h.author)}</p><p style="font-size:14px;margin-top:6px;color:#4a3185">“${esc(h.quote_bn)}”</p></div>
</div>
<div class="row" style="margin-top:14px"><button class="btn soft small" data-nav="quotes">আজকের সব উক্তি</button>${pinBtn(item)}</div>`;
  }
}
const FACT_TINTS = ["t-sky", "t-indigo", "t-gold", "t-mint", "t-rose", "t-plum"];
function renderFacts() {
  const facts = dailyPick(DATA.facts, 10, "facts");
  $("#factList").innerHTML = facts.map((f, i) => {
    const item = { id: pinId("তথ্য", f.fact_bn), type: "তথ্য", title: f.fact_bn, body: "", meta: "বিষয়: " + f.topic };
    return `<article class="fact tint ${FACT_TINTS[i % FACT_TINTS.length]}"><span class="fn-n">${bn(i + 1)}</span>
<div style="min-width:0"><p>${esc(f.fact_bn)}</p>
<div class="fact-row"><span class="chip">${esc(f.topic)}</span>${pinBtn(item)}</div></div></article>`;
  }).join("");
  const hf = $("#homeFact");
  if (hf && facts.length) {
    const f = facts[0];
    const item = { id: pinId("তথ্য", f.fact_bn), type: "তথ্য", title: f.fact_bn, body: "", meta: "বিষয়: " + f.topic };
    hf.innerHTML = `<div class="h2">আজকের একটি বিস্ময়</div>
<p class="fact-big">${esc(f.fact_bn)}</p>
<div class="row" style="margin-top:12px"><button class="btn soft small" data-nav="facts">আরও ৯টি তথ্য</button>${pinBtn(item)}</div>`;
  }
}
function renderGrowth() {
  const tips = dailyPick(DATA.growth.tips, 10, "tips");
  $("#tipList").innerHTML = tips.map(t => {
    const item = { id: pinId("টিপস", t.title_bn), type: "টিপস", title: t.title_bn, body: t.detail_bn, meta: "বিভাগ: " + t.category };
    return `<article class="tip-card">
<span class="tip-check">✓</span>
<div style="flex:1;min-width:0"><h3>${esc(t.title_bn)}</h3><p>${esc(t.detail_bn)}</p>
<div class="row" style="margin-top:9px"><span class="chip mint">${esc(t.category)}</span></div></div>
${pinBtn(item)}</article>`;
  }).join("");
  renderRoutineSlots($("#routineGrowth"), DATA.growth.routine);
  renderRoutineMini($("#routineMini"), DATA.growth.routine);
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
  $("#newsUpdated").textContent = "প্রধান খবরের শিরোনাম আর সংক্ষিপ্ত সারকথা। সর্বশেষ আপডেট: " + (n.updated_label || relTime(n.updated) || "—");
  const groups = [["bangladesh", "বাংলাদেশ", "t-indigo", "indigo", "var(--indigo)"], ["tech", "প্রযুক্তি ও AI", "t-mint", "mint", "var(--mint)"], ["world", "বিশ্ব", "t-sky", "sky", "var(--sky)"]];
  $("#newsContent").innerHTML = `<div class="news-g">` + groups.map(([key, label, tint, chipCls]) => `
<div class="ncol tint ${tint}">
<h2>${label}<span class="chip ${chipCls} cnt">${bn((n[key] || []).length)}টি</span></h2>
${(n[key] || []).map(it => {
const item = { id: "news-" + it.id, type: "খবর", title: it.title, body: it.summary || "",
meta: it.source + " · " + relTime(it.published), link: it.link };
return `<article class="item">
<p><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a></p>
${it.summary ? `<span class="sm">${esc(it.summary)}</span>` : ""}
<div class="item-meta"><span class="chip ${chipCls}">${esc(it.source)}</span><span class="tm">${relTime(it.published)}</span>${pinBtn(item)}</div>
</article>`;
}).join("") || `<div class="item"><p>এই বিভাগে এখনো খবর নেই।</p></div>`}
</div>`).join("") + `</div>`;
  renderHomeNews();
}
const NEWS_DOTS = { bangladesh: "var(--indigo)", tech: "var(--mint)", world: "var(--sky)" };
function renderHomeNews() {
  const el = $("#homeNews");
  if (!el || !DATA.news) return;
  const groups = [["bangladesh", "বাংলাদেশ"], ["tech", "প্রযুক্তি ও AI"], ["world", "বিশ্ব"]];
  const items = groups.flatMap(([key, label]) =>
    (DATA.news[key] || []).slice(0, 2).map(it => ({ ...it, _cat: label, _key: key })));
  el.innerHTML = items.map(it => `
<div class="news-li"><span class="dot" style="background:${NEWS_DOTS[it._key]}"></span><div><p><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a></p><small>${esc(it._cat)} · ${esc(it.source)} · ${relTime(it.published)}</small></div></div>`).join("") || `<p class="muted small">খবর এখনো আসেনি।</p>`;
}

/* ---------------- pins page ---------------- */
const PIN_TYPE_ORDER = ["উক্তি", "খবর", "তথ্য", "টিপস"];
const PIN_TYPE_LABEL = { "উক্তি": "উক্তি", "খবর": "খবর", "তথ্য": "তথ্য", "টিপস": "উন্নতি-টিপস" };
const PIN_TYPE_TINT = { "উক্তি": "t-plum", "খবর": "t-sky", "তথ্য": "t-gold", "টিপস": "t-mint" };
const PIN_TYPE_CHIP = { "উক্তি": "plum", "খবর": "sky", "তথ্য": "gold", "টিপস": "mint" };
function renderPins() {
  const el = $("#pinGroups");
  if (!el) return;
  if (!pins.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">✦</span><strong>এখনো কিছু পিন করোনি</strong><p>উক্তি, খবর, তথ্য বা টিপসের পাশের পিন বোতামে চাপ দিলেই তা এখানে থেকে যাবে — প্রতিদিনের সেট বদলে গেলেও।</p></div>`;
    return;
  }
  el.innerHTML = PIN_TYPE_ORDER.filter(t => pins.some(p => p.type === t)).map(t => `
<div class="card tint ${PIN_TYPE_TINT[t]} pin-group">
<div class="row between" style="margin-bottom:6px"><div class="h2" style="margin:0">${PIN_TYPE_LABEL[t]}</div><span class="chip ${PIN_TYPE_CHIP[t]}">${bn(pins.filter(p => p.type === t).length)}টি</span></div>
${pins.filter(p => p.type === t).map(p => `
<article class="prow"><p class="p-title${p.type === "উক্তি" ? " serif" : ""}">${p.type === "উক্তি" ? "“" + esc(p.title) + "”" : esc(p.title)}</p>
${p.body ? `<p class="p-body">${esc(p.body)}</p>` : ""}
<div class="p-foot"><p class="p-meta">${esc(p.meta)} · পিন করা: ${esc(p.pinned_date)}${p.link ? ` · <a class="job-link" href="${esc(p.link)}" target="_blank" rel="noopener">মূল লিংক ↗</a>` : ""}</p>
<button class="btn soft small" data-unpin="${esc(p.id)}">পিন সরাও</button></div></article>`).join("")}
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
  if (jobs) { renderJobs(); renderHomeChips(); renderStreak(); }
  if (quiz) renderLearn();
  if (quotes) renderQuotes();
  if (facts) renderFacts();
  if (growth) { renderGrowth(); renderRoutine($("#routineHome"), growth.routine); renderHeroTasks(); }
  renderNews();
  buildNav();
  refreshPinsUI();
  observeReveals();
})();
