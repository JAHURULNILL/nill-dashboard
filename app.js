/* আমার দিন — নীলের ড্যাশবোর্ড · vanilla JS, no framework */
"use strict";

/* helpers */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bn = n => String(n).replace(/\d/g, d => BN_DIGITS[d]);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const WEEKDAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const WDS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];
const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই",
  "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const ico = n => `<svg class="ico" style="width:18px;height:18px"><use href="#i-${n}"/></svg>`;

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
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5) - dayNumber();
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

/* daily rotation: pure function of the Dhaka date — shuffled cycle blocks, no repeats until the pool cycles */
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

/* storage / toast */
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
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* pins */
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
  $$("[data-pinchip]").forEach(el => {
    el.style.display = isPinned(el.dataset.pinchip) ? "" : "none";
  });
  $$(".pinCount").forEach(el => { el.textContent = bn(pins.length); });
  const sp = $("#statPinCount");
  if (sp) sp.textContent = bn(pins.length) + "টি";
  renderPins();
}

/* navigation */
const SECTIONS = [
  ["home", "i-home", "আজ"], ["jobs", "i-job", "চাকরি"], ["learn", "i-learn", "শেখা"],
  ["quotes", "i-book", "বই"], ["news", "i-news", "খবর"], ["facts", "i-spark", "বিস্ময়"],
  ["growth", "i-up", "উন্নতি"], ["pins", "i-pin", "পিন করা"],
];
let currentPage = "home";
function buildNav() {
  const side = $("#sideNav");
  if (!side) return;
  side.innerHTML = SECTIONS.map(([id, icon, label]) => {
    let extra = "";
    if (id === "jobs" && DATA.jobs) extra = `<span class="nav-count">${bn(DATA.jobs.jobs.length)}</span>`;
    if (id === "news") extra = `<span class="live-dot"></span>`;
    if (id === "pins") extra = `<span class="nav-count pinCount">${bn(pins.length)}</span>`;
    return `<a href="#" data-nav="${id}"${id === currentPage ? ' class="on" aria-current="page"' : ""}><svg class="ico"><use href="#${icon}"/></svg>${label}${extra}</a>`;
  }).join("");
}
function go(page) {
  currentPage = page;
  $$(".page").forEach(p => p.classList.toggle("on", p.id === "page-" + page));
  buildNav();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* dialogs */
const srch = () => $("#srch");
const xbtn = () => `<button class="xbtn" data-close aria-label="বন্ধ করুন">✕</button>`;

/* global clicks */
document.addEventListener("click", e => {
  const nav = e.target.closest("[data-nav]");
  if (nav) { e.preventDefault(); go(nav.dataset.nav); return; }
  const sr = e.target.closest("[data-search]");
  if (sr) { openSearch(); return; }
  const pin = e.target.closest("[data-pin]");
  if (pin) { togglePin(pin.dataset.pin); return; }
  const un = e.target.closest("[data-unpin]");
  if (un) {
    pins = pins.filter(p => p.id !== un.dataset.unpin);
    save("nill_pins", pins);
    refreshPinsUI();
    if (DATA.quotes) renderQuotes();
    showToast("পিন সরানো হয়েছে");
    return;
  }
  const qm = e.target.closest("[data-qmode]");
  if (qm) { setQuizMode(qm.dataset.qmode); return; }
  if (e.target.closest("[data-close]")) { const s = srch(); if (s.open) s.close(); return; }
  /* backdrop click closes the search palette */
  if (e.target === srch()) { srch().close(); return; }
  if (e.target.id === "newsRefresh") { refreshNews(); return; }
  const si = e.target.closest("[data-si]");
  if (si) {
    const item = SEARCH_RES[Number(si.dataset.si)];
    const s = srch(); if (s.open) s.close();
    if (item) item.go();
  }
});
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault(); openSearch();
  }
});

/* search palette */
let SEARCH_INDEX = [], SEARCH_RES = [];
function buildSearchIndex() {
  const idx = [];
  todayQuotes.forEach(q => {
    idx.push({ l: bookShort(q.book), s: q.author + " · বই", go: () => go("quotes") });
  });
  if (DATA.quiz) DATA.quiz.topics.forEach(t =>
    idx.push({ l: t.name, s: "MS Word · পাঠ", go: () => go("learn") }));
  if (DATA.jobs) DATA.jobs.jobs.forEach(j =>
    idx.push({ l: j.title, s: j.company + " · চাকরি", go: () => go("jobs") }));
  if (DATA.news) ["bangladesh", "tech", "world"].forEach(k =>
    (DATA.news[k] || []).forEach(it =>
      idx.push({ l: it.title, s: it.source + " · খবর", go: () => go("news") })));
  todayFacts.forEach(f =>
    idx.push({ l: f.fact_bn, s: "বিষয়: " + f.topic + " · বিস্ময়", go: () => go("facts") }));
  todayTips.forEach(t =>
    idx.push({ l: t.title_bn, s: t.category + " · উন্নতি", go: () => go("growth") }));
  SEARCH_INDEX = idx;
}
function openSearch() {
  const s = srch();
  s.innerHTML = `<div class="dl">${xbtn()}<div class="s-in"><svg class="ico"><use href="#i-search"/></svg><input id="sq" type="text" placeholder="চাকরি, বই, পাঠ, খবর খুঁজুন…" aria-label="খুঁজুন"></div><div class="s-list" id="sResults"></div></div>`;
  if (!s.open) { try { s.showModal(); } catch { s.setAttribute("open", ""); } }
  drawSearch("");
  const inp = $("#sq");
  if (inp) {
    inp.addEventListener("input", () => drawSearch(inp.value));
    setTimeout(() => inp.focus(), 30);
  }
}
function drawSearch(q) {
  const box = $("#sResults");
  if (!box) return;
  const needle = q.trim().toLowerCase();
  SEARCH_RES = (needle
    ? SEARCH_INDEX.filter(x => (x.l + " " + x.s).toLowerCase().includes(needle))
    : SEARCH_INDEX.slice(0, 8)).slice(0, 8);
  box.innerHTML = SEARCH_RES.length
    ? SEARCH_RES.map((x, i) => `<button class="s-it" data-si="${i}"><span>${esc(x.l)}</span><small>${esc(x.s)}</small></button>`).join("")
    : `<div class="s-empty">কিছু পাওয়া যায়নি — অন্য শব্দে খুঁজে দেখুন।</div>`;
}

/* data */
let DATA = { jobs: null, quotes: null, quiz: null, facts: null, growth: null, news: null, inspiration: null };
let todayQuotes = [], todayFacts = [], todayTips = [];
async function getJSON(url) {
  try { const r = await fetch(url); if (!r.ok) throw 0; return await r.json(); }
  catch { return null; }
}

/* home */
function splitRoutineItem(x) {
  const i = x.indexOf(" — ");
  if (i < 0) return { time: "", text: x };
  return { time: x.slice(0, i).trim(), text: x.slice(i + 3).trim() };
}
/* hero inspiration — প্রতিবার লোডে নতুন আয়াত / প্রেরণার লাইন */
const INSPO_FALLBACK = [
  { type: "ayat", ar: "إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا", bn: "নিশ্চয় কষ্টের সাথে স্বস্তি রয়েছে।", ref: "সূরা আশ-শারহ · ৯৪:৬" },
  { type: "line", bn: "তুমি যতবার পড়ে গেছ, তার চেয়ে একবার বেশি উঠে দাঁড়িয়েছ — এই হিসাবটাই তোমার আসল পরিচয়।" },
  { type: "line", bn: "মানুষ হারে তখনই, যখন সে চেষ্টা করা ছেড়ে দেয়। তুমি এখনো মাঠে আছ — মানে তুমি হারোনি।" },
];
let inspoIdx = -1;
function inspoPool() {
  const pool = [];
  if (DATA.inspiration) {
    (DATA.inspiration.ayat || []).forEach(a => pool.push({ type: "ayat", ar: a.ar, bn: a.bn, ref: a.ref }));
    (DATA.inspiration.lines || []).forEach(t => pool.push({ type: "line", bn: t }));
  }
  return pool.length ? pool : INSPO_FALLBACK;
}
function showInspo(animate) {
  const el = $("#heroInspo");
  if (!el) return;
  const pool = inspoPool();
  let last = -1;
  try { const v = parseInt(localStorage.getItem("nill_inspo_last"), 10); if (!isNaN(v)) last = v; } catch {}
  const banned = new Set([last, inspoIdx]);
  let cand = pool.map((_, i) => i).filter(i => !banned.has(i));
  if (!cand.length) cand = pool.map((_, i) => i);
  inspoIdx = cand[Math.floor(Math.random() * cand.length)];
  try { localStorage.setItem("nill_inspo_last", String(inspoIdx)); } catch {}
  const it = pool[inspoIdx];
  el.innerHTML = (it.type === "ayat" ? `
<span class="inspo-chip">কুরআনের আয়াত</span>
<p class="inspo-ar" dir="rtl" lang="ar">${esc(it.ar)}</p>
<p class="inspo-bn">${esc(it.bn)}</p>
<p class="inspo-ref">${esc(it.ref)}</p>` : `
<span class="inspo-chip">আজকের প্রেরণা</span>
<p class="inspo-bn big">${esc(it.bn)}</p>`) + `
<div class="inspo-foot"><button class="inspo-btn" id="inspoNext" type="button">আরেকটি দেখাও ↻</button></div>`;
  const btn = $("#inspoNext");
  if (btn) btn.addEventListener("click", () => showInspo(true));
  if (animate) { el.classList.remove("fade"); void el.offsetWidth; el.classList.add("fade"); }
}
function last7Counts() {
  const counts = new Array(7).fill(0);
  const today = dayNumber();
  (DATA.jobs ? DATA.jobs.jobs : []).forEach(j => {
    if (!j.date) return;
    const [y, m, d] = j.date.split("-").map(Number);
    const diff = today - Math.floor(Date.UTC(y, m - 1, d) / 864e5);
    if (diff >= 0 && diff < 7) counts[6 - diff] += 1;
  });
  return counts;
}
function renderStreak() {
  const el = $("#streakCard");
  if (!el || !DATA.jobs) return;
  const counts = last7Counts();
  const total = counts.reduce((a, b) => a + b, 0);
  const dow = dhakaNow().getDay();
  let week = "";
  for (let i = 6; i >= 0; i--) {
    const on = counts[6 - i] > 0;
    const label = i === 0 ? "আজ" : WDS[(dow - i + 7) % 7];
    week += `<div class="${on ? "on" : "off"}"><i></i>${label}</div>`;
  }
  el.innerHTML = `<div class="streak">
<div class="h2" style="margin:0">এই সপ্তাহের গতি</div>
<div class="big"><svg class="ico"><use href="#i-flame"/></svg><b>${bn(total)}টি</b></div>
<p style="font-size:14.5px;color:#7d3347">গত ৭ দিনে করা আবেদন — সব মিলিয়ে মোট ${bn(DATA.jobs.jobs.length)}টি আবেদন জমা পড়েছে।</p>
<div class="week">${week}</div></div>`;
}
function renderHomeChips() {
  if (!DATA.jobs) return;
  const jobs = DATA.jobs.jobs;
  const stCount = {};
  jobs.forEach(j => { const s = jobStatus(j); stCount[s] = (stCount[s] || 0) + 1; });
  const progressed = (stCount.shortlisted || 0) + (stCount.interview || 0) + (stCount.interview_done || 0) + (stCount.offer || 0);
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
function renderRoutine(el, routine) {
  if (!el || !routine) return;
  const order = ["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা", "রাত"];
  el.innerHTML = order.filter(k => routine[k]).map(k => `
<div class="routine-part"><div class="routine-head">${esc(k)}</div>
${routine[k].map(x => { const { time, text } = splitRoutineItem(x); return `<div class="routine-row">${time ? `<span class="rt">${esc(time.replace(k, "").trim() || time)}</span>` : ""}<span>${esc(text)}</span></div>`; }).join("")}</div>`).join("");
}

/* jobs */
const STATUSES = {
  applied: "আবেদন করা হয়েছে", shortlisted: "শর্টলিস্টেড", interview: "ইন্টারভিউ",
  interview_done: "ইন্টারভিউ দেওয়া হয়েছে", rejected: "বাতিল", offer: "অফার",
};
let statusOv = load("nill_job_status", {});
let selScope = "all";
let selChannel = null;
const jobKey = j => j.title + "|" + j.company + "|" + j.date;
const jobStatus = j => statusOv[jobKey(j)] || j.status || "applied";
const AV_COLORS = ["#0E9F8A", "#1BA383", "#D68A06", "#E2536F", "#2C97D3", "#7B4FD2"];
function renderJobs() {
  const { jobs, shortlist, counters } = DATA.jobs;
  const stCount = {};
  jobs.forEach(j => { const s = jobStatus(j); stCount[s] = (stCount[s] || 0) + 1; });
  const progressed = (stCount.shortlisted || 0) + (stCount.interview || 0) + (stCount.interview_done || 0) + (stCount.offer || 0);
  const pipePct = jobs.length ? Math.round(progressed / jobs.length * 100) : 0;
  /* goal card — reference .goal */
  $("#goalBox").innerHTML = `
<div><span class="muted" style="font-size:14px">পাইপলাইন অগ্রগতি</span><br><b>${bn(progressed)} / ${bn(jobs.length)}</b> <span class="muted">আবেদন ধাপে এগিয়েছে</span></div>
<div class="bar"><i style="width:${pipePct}%"></i></div>
<span class="chip indigo">মোট ${bn(jobs.length)}টি আবেদন</span>`;
  /* shortlist — gold tint card */
  $("#shortlistBox").innerHTML = `
<div class="card tint t-gold">
<div class="sl-head"><h3>এই আবেদনগুলো তোমার নিজের করতে হবে</h3><span class="chip gold">${bn(shortlist.length)}টি বাকি</span></div>
${shortlist.map(s => `
<div class="shortlist-item"><div class="sl-row"><div><div class="sl-role">${esc(s.title)}</div><div class="sl-co">${esc(s.company)}</div></div>
<div class="sl-side">${s.salary ? `<span class="sl-salary">বেতন: ${esc(s.salary)}</span>` : ""}${s.link ? `<a class="sl-link" href="${esc(s.link)}" target="_blank" rel="noopener">আবেদন লিংক ↗</a>` : ""}</div></div></div>`).join("")}
</div>`;
  /* portal counters — small note at the bottom of the হিসাব card */
  $("#jobPortalNote").textContent = `পোর্টালের হিসাব: nextjobz-এ অক্টোবরে ${bn(counters.nextjobz_oct)}টি · Shomvob-এ মোট ${bn(counters.shomvob_applied)}টি · Bdjobs কোটা ${bn(counters.bdjobs_quota)}`;
  /* summary boxes — click one to filter the board below */
  const dn = dhakaNow();
  const todayISO = `${dn.getFullYear()}-${String(dn.getMonth() + 1).padStart(2, "0")}-${String(dn.getDate()).padStart(2, "0")}`;
  const todayCount = jobs.filter(j => j.date === todayISO).length;
  const sumBoxes = [
    ["all", "মোট আবেদন", jobs.length, "t-gold"],
    ["today", "আজকের আবেদন", todayCount, "t-indigo"],
    ["interview_done", "ইন্টারভিউ দেওয়া হয়েছে", stCount.interview_done || 0, "t-mint"],
    ["interview", "সামনে ইন্টারভিউ", stCount.interview || 0, "t-plum"],
  ];
  $("#jobFunnel").innerHTML = sumBoxes.map(([k, label, n, tint]) =>
    `<button class="fn ${tint}${selScope === k ? " on" : ""}" data-sum="${k}"><b>${bn(n)}</b><span>${label}</span></button>`).join("");
  $("#jobFunnel").onclick = e => {
    const b = e.target.closest("[data-sum]");
    if (b) { selScope = b.dataset.sum; selChannel = null; renderJobs(); }
  };
  /* channel breakdown — appears once a summary box is picked */
  const CHANNEL_ORDER = ["LinkedIn", "nextjobz", "Bdjobs", "Shomvob", "Facebook", "Email"];
  const scoped = selScope === null ? [] : selScope === "all" ? jobs
    : selScope === "today" ? jobs.filter(j => j.date === todayISO)
    : jobs.filter(j => jobStatus(j) === selScope);
  const chCounts = {};
  scoped.forEach(j => chCounts[j.channel] = (chCounts[j.channel] || 0) + 1);
  const chEl = $("#jobChannels");
  if (selScope === null) {
    chEl.innerHTML = `<p class="muted" style="font-size:14.5px">উপরের যেকোনো বাক্সে চাপ দাও — মাধ্যম অনুযায়ী কত আবেদন হয়েছে, এখানে দেখাবে।</p>`;
  } else {
    const chs = CHANNEL_ORDER.filter(c => chCounts[c]);
    chEl.innerHTML = chs.length
      ? `<div class="ch-grid">${chs.map(c => `<button class="ch-tile${selChannel === c ? " on" : ""}" data-ch="${esc(c)}"><b>${bn(chCounts[c])}টি</b><span>${esc(c)}</span></button>`).join("")}</div>`
      : `<p class="muted" style="font-size:14.5px">এই হিসাবে কোনো আবেদন নেই।</p>`;
  }
  chEl.onclick = e => {
    const b = e.target.closest("[data-ch]");
    if (b) { selChannel = b.dataset.ch; renderJobs(); }
  };
  /* job results — only after a channel is picked */
  const resEl = $("#jobResults");
  if (selScope === null) {
    resEl.innerHTML = "";
  } else if (!selChannel) {
    resEl.innerHTML = `<p class="muted" style="font-size:14.5px;margin-top:14px">একটি মাধ্যম বেছে নাও — সেই মাধ্যমের চাকরিগুলো এখানে দেখাবে।</p>`;
  } else {
    const list = scoped.filter(j => j.channel === selChannel);
    const GROUPS = [["applied", "আবেদন করা"], ["shortlisted", "শর্টলিস্ট"], ["interview", "ইন্টারভিউ"], ["interview_done", "ইন্টারভিউ দেওয়া হয়েছে"], ["rejected", "রিজেক্ট"], ["offer", "অফার"], ["other", "অন্যান্য"]];
    const jobCard = j => {
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
<div class="tags"><span class="chip">আবেদন ${fmtISODate(j.date)}</span>${dlChip}</div>
<div class="job-foot">
${j.link ? `<a class="job-link" href="${esc(j.link)}" target="_blank" rel="noopener">পোস্টিং দেখো ↗</a>` : `<span class="no-link">লিংক নেই</span>`}
<select class="job-status-select" data-jobkey="${esc(jobKey(j))}" aria-label="স্ট্যাটাস বদলাও">${opts}</select>
</div></article>`;
    };
    const groups = GROUPS.map(([k, label]) => [label, list.filter(j => (STATUSES[jobStatus(j)] ? jobStatus(j) : "other") === k)]).filter(([, arr]) => arr.length);
    resEl.innerHTML = `<div class="divider" style="margin:18px 0 4px"></div>` + (groups.map(([label, arr]) => `
<div class="res-h">${label} <em>${bn(arr.length)}</em></div>
<div class="res-list">${arr.map(jobCard).join("")}</div>`).join("") || `<p class="muted" style="font-size:14.5px">এই মাধ্যমে কোনো চাকরি নেই।</p>`);
  }
  resEl.onchange = e => {
    const sel = e.target.closest("[data-jobkey]");
    if (!sel) return;
    statusOv[sel.dataset.jobkey] = sel.value;
    save("nill_job_status", statusOv);
    renderJobs();
    renderHomeChips();
  };
}

/* learning / quiz */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let quiz = null;
let quizMode = "random";
function quizPool() {
  const qs = DATA.quiz.questions;
  if (quizMode === "current") {
    const taught = DATA.quiz.topics.filter(t => t.taught);
    const last = taught[taught.length - 1];
    const f = last ? qs.filter(x => x.topic === last.name) : [];
    return f.length ? f : qs;
  }
  return qs;
}
function setQuizMode(m) {
  quizMode = m;
  $$("[data-qmode]").forEach(b => b.classList.toggle("on", b.dataset.qmode === m));
  if (quiz) startQuiz();
}
function renderLearn() {
  const q = DATA.quiz;
  const taught = q.topics.filter(t => t.taught);
  const soon = q.topics.filter(t => !t.taught);
  const total = q.topics.length;
  const pct = Math.round(taught.length / total * 100);
  $("#wordBar").style.width = pct + "%";
  const twb = $("#topicWordBar");
  if (twb) twb.style.width = pct + "%";
  const twp = $("#topicWordPct");
  if (twp) twp.textContent = bn(pct) + "% শেষ · " + bn(taught.length) + "/" + bn(total) + "টি টপিক";
  $("#wordProgText").textContent = `${bn(taught.length)}/${bn(total)}টি শেখা হয়েছে`;
  /* path — reference .node states: done / now / lock */
  $("#wordTopics").innerHTML = q.topics.map((t, i) => {
    const cl = t.taught ? "done" : (soon.length && t === soon[0] ? "now" : "lock");
    const showSmall = cl !== "lock";
    return `<div class="node ${cl}"><span class="pin">${cl === "done" ? "✓" : bn(i + 1)}</span><div><b>${esc(t.name)}</b>${showSmall ? `<small>${esc(t.summary_bn)}${cl === "now" ? ' · <span style="color:var(--indigo-d);font-weight:600">এখন চলছে</span>' : ""}</small>` : ""}</div></div>`;
  }).join("");
  /* tip — reference .tip: current lesson */
  const cur = soon[0] || q.topics[total - 1];
  const tip = $("#quizTip");
  if (tip) tip.innerHTML = `<b>${esc(cur.name)}:</b> ${esc(cur.summary_bn)}`;
  renderQuizStats();
  renderExamples();
  const st = $("#quizStart");
  if (st) st.addEventListener("click", startQuiz);
}
function renderQuizStats() {
  const s = load("nill_quiz_stats", { best: 0, attempts: 0 });
  const el = $("#quizStats");
  if (!el) return;
  el.innerHTML = s.attempts
    ? `<span class="chip mint">সেরা ${bn(s.best)}/১০</span><span class="chip">${bn(s.attempts)} বার অনুশীলন</span>`
    : `<span class="chip">এখনো অনুশীলন করোনি</span>`;
}
function startQuiz() {
  quiz = { qs: shuffle(quizPool()).slice(0, 10), i: 0, score: 0, done: false, counted: false };
  renderQuizQ();
  $("#quizBox").scrollIntoView({ behavior: "smooth", block: "center" });
}
function renderQuizQ() {
  const box = $("#quizBox");
  if (quiz.i >= quiz.qs.length) {
    if (!quiz.counted) {
      quiz.counted = true;
      const s = load("nill_quiz_stats", { best: 0, attempts: 0 });
      s.attempts += 1; s.best = Math.max(s.best, quiz.score);
      save("nill_quiz_stats", s);
      renderQuizStats();
    }
    quiz.done = true;
    const msg = quiz.score >= 8 ? "দারুণ! তুমি প্রায় সব পারো।" :
      quiz.score >= 5 ? "ভালো হয়েছে! আরেকটু অনুশীলনেই পাক্কা হবে।" :
      "শুরুটা হলো — পাঠগুলো আরেকবার দেখে আবার চেষ্টা করো।";
    box.innerHTML = `<div class="quiz-score">স্কোর: ${bn(quiz.score)} / ${bn(quiz.qs.length)}<br>
<span class="small muted" style="font-family:var(--sans);font-weight:500">${msg}</span></div>
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
<div class="explain" id="quizExplain"></div>
<div id="quizFoot"></div>`;
  box.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => {
    const pick = Number(b.dataset.opt);
    box.querySelectorAll("[data-opt]").forEach(x => {
      x.disabled = true;
      if (Number(x.dataset.opt) === item.answer) x.classList.add("ok");
      else if (x === b) x.classList.add("no");
    });
    if (pick === item.answer) quiz.score += 1;
    const ex = $("#quizExplain");
    ex.innerHTML = `<b>${pick === item.answer ? "সঠিক উত্তর!" : "আরেকটু হলেই হতো"}</b><span>${esc(item.explain_bn)}</span>`;
    ex.classList.add("show");
    $("#quizFoot").innerHTML = `
<div class="quiz-foot"><span class="muted" style="font-size:14px">${bn(quiz.i + 1)}টি প্রশ্নের উত্তর দেওয়া হলো</span><button class="btn indigo" id="quizNext">${quiz.i + 1 >= quiz.qs.length ? "ফলাফল দেখো" : "পরের প্রশ্ন"}${ico("arrow")}</button></div>`;
    $("#quizNext").addEventListener("click", () => { quiz.i += 1; renderQuizQ(); });
  }));
}

/* mock Word example cards — content identical, framed as reference cards */
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
<div class="card"><h3>${esc(c.title_bn)}</h3>
<div class="mock-word">
<div class="mock-titlebar"><span class="mdot"></span><span class="mdot"></span><span class="mdot"></span><span class="mock-title">WordCraft — আমার ডকুমেন্ট</span></div>
<div class="mock-ribbon"><span class="rtab on">Home</span><span class="rtab">Insert</span><span class="rtab">Layout</span>
<span class="tools"><b>B</b> <i>I</i> <u>U</u> · তালিকা · টেবিল</span></div>
<div class="mock-body">${mockBody(c)}</div>
</div></div>`).join("");
}

/* ---------------- books (উক্তি) + modal ---------------- */
const QUOTE_CATS = ["আত্মোন্নয়ন", "ব্যবসা", "প্রেম", "দর্শন", "জীবন"];
let quoteFilter = "সব";
const bookShort = b => String(b || "").replace(/\s*\([^)]*\)\s*$/, "").trim() || b;
function quoteItem(q) {
  const shown = q.text_bn || q.text || "";
  const title = shown.length > 140 ? shown.slice(0, 140).trim() + "…" : shown;
  return { id: pinId("উক্তি", q.text), type: "উক্তি", title, body: "", meta: q.author + " · " + bookShort(q.book) };
}
function renderQuotes() {
  todayQuotes = QUOTE_CATS.flatMap(cat =>
    dailyPick(DATA.quotes.filter(q => q.category === cat), 2, "quote:" + cat));
  todayQuotes.forEach(q => { const it = quoteItem(q); PIN_ITEMS[it.id] = it; });
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
<div class="quotes-list">${list.map(q => {
  const it = quoteItem(q);
  return `<article class="lq">
<p class="lq-text">${esc(q.text)}</p>
${q.text_bn ? `<p class="lq-tr">${esc(q.text_bn)}</p>` : ""}
<div class="lq-foot"><span class="lq-meta">${esc(q.author)} · ${esc(bookShort(q.book))}</span>${pinBtn(it)}</div>
</article>`;
}).join("")}</div></div>`;
  }).join("");
}

/* facts */
const FACT_TINTS = ["t-sky", "t-indigo", "t-gold", "t-mint", "t-rose", "t-plum"];
function renderFacts() {
  todayFacts = dailyPick(DATA.facts, 10, "facts");
  $("#factList").innerHTML = todayFacts.map((f, i) => {
    const item = { id: pinId("তথ্য", f.fact_bn), type: "তথ্য", title: f.fact_bn, body: "", meta: "বিষয়: " + f.topic };
    return `<article class="fact tint ${FACT_TINTS[i % FACT_TINTS.length]}"><span class="fn-n">${bn(i + 1)}</span>
<div style="min-width:0"><h3>${esc(f.fact_bn)}</h3>
<div class="fact-row"><span class="chip">${esc(f.topic)}</span>${pinBtn(item)}</div></div></article>`;
  }).join("");
  const hf = $("#homeFact");
  if (hf && todayFacts.length) {
    const f = todayFacts[0];
    const item = { id: pinId("তথ্য", f.fact_bn), type: "তথ্য", title: f.fact_bn, body: "", meta: "বিষয়: " + f.topic };
    hf.innerHTML = `<div class="h2">আজকের একটি বিস্ময়</div>
<p class="fact-big">${esc(f.fact_bn)}</p>
<div class="row" style="margin-top:12px"><button class="btn soft sm" data-nav="facts">আরও ৯টি তথ্য</button>${pinBtn(item)}</div>`;
  }
}

/* ---------------- growth + focus timer ---------------- */
function renderRoutineSlots(el, routine) {
  if (!el || !routine) return;
  const order = ["সকাল", "দুপুর", "বিকেল", "সন্ধ্যা", "রাত"];
  el.innerHTML = order.filter(k => routine[k]).map(k => `
<div class="slot"><div class="slot-h">${esc(k)}</div><div class="card">
${routine[k].map(x => { const { time, text } = splitRoutineItem(x); return `<div class="slot-row">${time ? `<span class="tm">${esc(time.replace(k, "").trim() || time)}</span>` : ""}<p>${esc(text)}</p></div>`; }).join("")}
</div></div>`).join("");
}
function renderWeekBars() {
  const el = $("#weekBars");
  if (!el || !DATA.jobs) return;
  const counts = last7Counts();
  const max = Math.max(1, ...counts);
  const dow = dhakaNow().getDay();
  el.innerHTML = counts.map((c, i) => {
    const label = i === 6 ? "আজ" : WDS[(dow - (6 - i) + 7) % 7];
    return `<div><i style="height:${Math.max(8, Math.round(c / max * 100))}%"></i>${label}</div>`;
  }).join("");
}
function renderGrowth() {
  todayTips = dailyPick(DATA.growth.tips, 10, "tips");
  $("#tipList").innerHTML = todayTips.map(t => {
    const item = { id: pinId("টিপস", t.title_bn), type: "টিপস", title: t.title_bn, body: t.detail_bn, meta: "বিভাগ: " + t.category };
    return `<article class="tip-card">
<span class="tip-check">✓</span>
<div style="flex:1;min-width:0"><h3>${esc(t.title_bn)}</h3><p>${esc(t.detail_bn)}</p>
<div class="row" style="margin-top:9px"><span class="chip mint">${esc(t.category)}</span></div></div>
${pinBtn(item)}</article>`;
  }).join("");
  renderRoutineSlots($("#routineGrowth"), DATA.growth.routine);
  renderWeekBars();
}
/* focus timer — reference .timer/.modes/.tm, working */
const T = { mode: "focus", left: 1500, run: false, id: null };
const fmtT = s => bn(pad(Math.floor(s / 60)) + ":" + pad(s % 60));
function focusStore() {
  const f = load("nill_focus", { day: -1, count: 0 });
  if (f.day !== dayNumber()) return { day: dayNumber(), count: 0 };
  return f;
}
function renderFocusNote() {
  const el = $("#focusNote");
  if (el) el.textContent = `আজ ${bn(focusStore().count)}টি ফোকাস সেশন শেষ`;
}
function tmShow() { const el = $("#tm"); if (el) el.textContent = fmtT(T.left); }
function tmStop() { if (T.id) clearInterval(T.id); T.id = null; T.run = false; const b = $("#tmToggle"); if (b) b.textContent = "শুরু করুন"; }
function tmSetMode(m) {
  tmStop();
  T.mode = m;
  T.left = m === "focus" ? 1500 : 300;
  $$("[data-tmode]").forEach(b => b.classList.toggle("on", b.dataset.tmode === m));
  tmShow();
}
function tmTick() {
  T.left -= 1;
  tmShow();
  if (T.left > 0) return;
  const wasFocus = T.mode === "focus";
  tmSetMode(wasFocus ? "break" : "focus");
  if (wasFocus) {
    const f = focusStore();
    f.count += 1;
    save("nill_focus", f);
    renderFocusNote();
    showToast("ফোকাস সেশন শেষ! এবার ৫ মিনিট বিরতি নিন।");
  } else {
    showToast("বিরতি শেষ। আবার ফোকাস শুরু করুন!");
  }
}
function wireTimer() {
  $$("[data-tmode]").forEach(b => b.addEventListener("click", () => tmSetMode(b.dataset.tmode)));
  const tg = $("#tmToggle"), rs = $("#tmReset");
  if (tg) tg.addEventListener("click", () => {
    if (T.run) { tmStop(); return; }
    T.run = true;
    tg.textContent = "থামান";
    T.id = setInterval(tmTick, 1000);
  });
  if (rs) rs.addEventListener("click", () => tmSetMode(T.mode));
  tmShow();
  renderFocusNote();
}

/* news */
let NTAB = "all";
const NEWS_TONES = { bangladesh: "indigo", world: "sky", tech: "mint" };
const NEWS_LABELS = { bangladesh: "বাংলাদেশ", world: "বিশ্ব", tech: "প্রযুক্তি ও AI" };
function newsItem(it, flat) {
  const item = { id: pinId("খবর", it.title), type: "খবর", title: it.title, body: it.summary || "",
    meta: it.source + " · " + relTime(it.published), link: it.link };
  return `<div class="item"${flat ? ' style="margin-top:0"' : ""}><p>${esc(it.title)}</p>
${it.summary ? `<span class="sm">${esc(it.summary)}</span>` : ""}
<div class="item-meta"><span class="chip">${esc(it.source)}</span><span class="tm">${relTime(it.published)}</span><a class="lk" href="${esc(it.link)}" target="_blank" rel="noopener">সূত্রে পড়ুন</a>${pinBtn(item)}</div>
</div>`;
}
function renderNews() {
  const n = DATA.news;
  const upd = $("#newsUpdated"), src = $("#newsSrc"), tabs = $("#newsTabs"), content = $("#newsContent");
  if (!n) {
    if (upd) upd.textContent = "খবর লোড করা যায়নি — পরে আবার চেষ্টা করো।";
    if (src) src.innerHTML = "";
    if (tabs) tabs.innerHTML = "";
    if (content) content.innerHTML = `<div class="card"><div class="empty"><strong style="display:block;color:var(--ink);font-family:var(--serif);font-size:18px;margin-bottom:6px">খবরের ফাইল পাওয়া যায়নি</strong>পরে আবার চেষ্টা করো — খবর এলেই এখানে দেখা যাবে।</div></div>`;
    const hn = $("#homeNews");
    if (hn) hn.innerHTML = `<p class="muted small">খবর লোড করা যায়নি।</p>`;
    return;
  }
  if (upd) upd.textContent = "প্রধান খবরের শিরোনাম আর সংক্ষিপ্ত সারকথা। সর্বশেষ আপডেট: " + (n.updated_label || relTime(n.updated) || "—");
  const sources = [...new Set(["bangladesh", "tech", "world"].flatMap(k => (n[k] || []).map(x => x.source)))];
  if (src) src.innerHTML = `<span class="muted" style="font-size:14px">সূত্র</span>` +
    sources.map(s => `<span class="chip indigo">${esc(s)}</span>`).join("") +
    `<button class="btn soft sm" id="newsRefresh">${ico("refresh")}হালনাগাদ করুন</button>`;
  const tabDefs = [["all", "সব"], ["bangladesh", "বাংলাদেশ"], ["world", "বিশ্ব"], ["tech", NEWS_LABELS.tech]];
  if (tabs) {
    tabs.innerHTML = tabDefs.map(([k, l]) =>
      `<button class="tab${NTAB === k ? " on" : ""}" data-ntab="${k}">${l}</button>`).join("");
    tabs.onclick = e => {
      const b = e.target.closest("[data-ntab]");
      if (b) { NTAB = b.dataset.ntab; renderNews(); }
    };
  }
  if (content) {
    if (NTAB === "all") {
      content.innerHTML = `<div class="news-g">` + ["bangladesh", "world", "tech"].map(k => `
<div class="ncol t-${NEWS_TONES[k]}">
<h2><svg class="ico"><use href="#i-${k === "tech" ? "spark" : "news"}"/></svg>${NEWS_LABELS[k]}<span class="chip cnt">${bn((n[k] || []).length)}টি</span></h2>
${(n[k] || []).slice(0, 3).map(it => newsItem(it)).join("") || `<div class="item"><p>এই বিভাগে এখনো খবর নেই।</p></div>`}
</div>`).join("") + `</div>`;
    } else {
      const k = NTAB;
      content.innerHTML = `<div class="news-g one">` +
        (n[k] || []).map(it => `<div class="ncol t-${NEWS_TONES[k]}" style="padding:14px">${newsItem(it, true)}</div>`).join("") +
        `</div>`;
    }
  }
  renderHomeNews();
}
async function refreshNews() {
  const fresh = await getJSON("data/news.json?v=" + Date.now());
  if (fresh) {
    DATA.news = fresh;
    renderNews();
    showToast("খবর হালনাগাদ হয়েছে");
  } else {
    showToast("হালনাগাদ করা যায়নি — আবার চেষ্টা করো");
  }
}
const NEWS_DOTS = { bangladesh: "var(--indigo)", world: "var(--sky)", tech: "var(--mint)" };
const AI_RE = /(\bAI\b|artificial intelligence|ChatGPT|OpenAI|Anthropic|Gemini|Copilot|machine learning|\bLLM\b|এআই|কৃত্রিম বুদ্ধিমত্তা)/i;
function renderHomeNews() {
  const el = $("#homeNews");
  if (!el || !DATA.news) return;
  const tech = DATA.news.tech || [];
  const aiPick = tech.find(it => AI_RE.test(it.title + " " + (it.summary || ""))) || tech[0];
  const slots = [
    { k: "bangladesh", label: "দেশের বড় খবর", it: (DATA.news.bangladesh || [])[0] },
    { k: "world", label: "বিশ্বের বড় খবর", it: (DATA.news.world || [])[0] },
    { k: "tech", label: "AI-এর বড় খবর", it: aiPick },
  ];
  const rows = slots.map(s => {
    if (!s.it) return "";
    const title = s.it.title_bn || s.it.title;
    return `<div class="news-li"><span class="dot" style="background:${NEWS_DOTS[s.k]}"></span><div><p><a href="${esc(s.it.link)}" target="_blank" rel="noopener">${esc(title)}</a></p><small>${s.label} · ${esc(s.it.source)} · ${relTime(s.it.published)}</small></div></div>`;
  }).join("");
  el.innerHTML = rows || `<p class="muted small">খবর এখনো আসেনি।</p>`;
}

/* pins page */
const PIN_TYPE_ORDER = ["উক্তি", "খবর", "তথ্য", "টিপস"];
const PIN_TYPE_LABEL = { "উক্তি": "উক্তি", "খবর": "খবর", "তথ্য": "তথ্য", "টিপস": "উন্নতি-টিপস" };
const PIN_TYPE_TINT = { "উক্তি": "t-plum", "খবর": "t-sky", "তথ্য": "t-gold", "টিপস": "t-mint" };
const PIN_TYPE_CHIP = { "উক্তি": "plum", "খবর": "sky", "তথ্য": "gold", "টিপস": "mint" };
function renderPins() {
  const el = $("#pinGroups");
  if (!el) return;
  if (!pins.length) {
    el.innerHTML = `<div class="card"><div class="empty"><strong style="display:block;color:var(--ink);font-family:var(--serif);font-size:19px;margin-bottom:6px">এখনো কিছু পিন করোনি</strong>উক্তি, খবর, তথ্য বা টিপসের পাশের পিন বোতামে চাপ দিলেই তা এখানে থেকে যাবে — প্রতিদিনের সেট বদলে গেলেও।</div></div>`;
    return;
  }
  el.innerHTML = PIN_TYPE_ORDER.filter(t => pins.some(p => p.type === t)).map(t => `
<div class="card tint ${PIN_TYPE_TINT[t]} pin-group">
<div class="row between" style="margin-bottom:6px"><div class="h2" style="margin:0">${PIN_TYPE_LABEL[t]}</div><span class="chip ${PIN_TYPE_CHIP[t]}">${bn(pins.filter(p => p.type === t).length)}টি</span></div>
${pins.filter(p => p.type === t).map(p => `
<article class="prow"><p class="p-title${p.type === "উক্তি" ? " serif" : ""}">${p.type === "উক্তি" ? "“" + esc(p.title) + "”" : esc(p.title)}</p>
${p.body ? `<p class="p-body">${esc(p.body)}</p>` : ""}
<div class="p-foot"><p class="p-meta">${esc(p.meta)} · পিন করা: ${esc(p.pinned_date)}${p.link ? ` · <a href="${esc(p.link)}" target="_blank" rel="noopener">মূল লিংক ↗</a>` : ""}</p>
<button class="btn soft sm" data-unpin="${esc(p.id)}">পিন সরাও</button></div></article>`).join("")}
</div>`).join("");
}

/* boot */
(async function boot() {
  buildNav();
  const d = dhakaNow();
  $("#heroDate").textContent = fmtDate(d);
  $("#heroGreeting").textContent = greetingText() + ", নীল";
  wireTimer();
  renderDayProgress();
  setInterval(renderDayProgress, 60000);
  const [jobs, quotes, quiz, facts, growth, news, inspiration] = await Promise.all([
    getJSON("data/jobs.json"), getJSON("data/quotes.json"), getJSON("data/quiz.json"),
    getJSON("data/facts.json"), getJSON("data/growth.json"), getJSON("data/news.json"),
    getJSON("data/inspiration.json"),
  ]);
  DATA = { jobs, quotes, quiz, facts, growth, news, inspiration };
  showInspo(false);
  if (!jobs || !quotes || !quiz || !facts || !growth) {
    $("main").insertAdjacentHTML("afterbegin",
      `<div class="err-box">কিছু তথ্য লোড হয়নি — ইন্টারনেট সংযোগ দেখে পেজটি রিফ্রেশ করো।</div>`);
  }
  if (jobs) { renderJobs(); renderHomeChips(); renderStreak(); }
  if (quiz) renderLearn();
  if (quotes) renderQuotes();
  if (facts) renderFacts();
  if (growth) { renderGrowth(); renderRoutine($("#routineHome"), growth.routine); }
  renderNews();
  buildNav();
  buildSearchIndex();
  refreshPinsUI();
})();
