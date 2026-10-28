"use strict";
/* Пороги переработки — статический сайт. Данные: Albion Online Data Project (AODP), запросы прямо из браузера. */

// ---------- справочники ----------
const SERVERS = {
  europe: "https://europe.albion-online-data.com",
  west: "https://west.albion-online-data.com",
  east: "https://east.albion-online-data.com",
};
const SERVER_RU = { europe: "Европа", west: "Америка", east: "Азия" };
const CITIES = ["Bridgewatch", "Martlock", "Thetford", "Fort Sterling", "Lymhurst", "Caerleon", "Brecilien"];
const CITY_COLOR = Object.fromEntries(CITIES.map((c, i) => [c, `var(--c${i + 1})`]));
const CITY_IMG = new Set(["Bridgewatch", "Martlock", "Thetford", "Fort Sterling", "Lymhurst"]);
const FAM = {
  stone: { tab: "Камень",  raw: "ROCK",  mat: "STONEBLOCK", rawRu: "Камень",  matRu: "Блок",   city: "Bridgewatch", stone: true },
  fiber: { tab: "Волокно", raw: "FIBER", mat: "CLOTH",      rawRu: "Волокно", matRu: "Ткань",  city: "Lymhurst" },
  ore:   { tab: "Руда",    raw: "ORE",   mat: "METALBAR",   rawRu: "Руда",    matRu: "Слиток", city: "Thetford" },
  wood:  { tab: "Дерево",  raw: "WOOD",  mat: "PLANKS",     rawRu: "Дерево",  matRu: "Доска",  city: "Fort Sterling" },
  hide:  { tab: "Шкуры",   raw: "HIDE",  mat: "LEATHER",    rawRu: "Шкура",   matRu: "Кожа",   city: "Martlock" },
};
const FAMS = Object.keys(FAM);
const FAM_ICON = {
  stone: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  fiber: "M12 21V9M12 13c-4 0-6-3-6-7 4 0 6 3 6 7zM12 11c4 0 6-3 6-7-4 0-6 3-6 7z",
  ore: "M5 15l3-8 6-2 5 5-2 8-8 1zM8 7l3 5 8-2M11 12l-6 3",
  wood: "M5 8h12a3 4 0 0 1 0 8H5a3 4 0 0 1 0-8zM17 8a3 4 0 0 0 0 8M8 12h5",
  hide: "M7 4c1.5 1 3.5 1.5 5 0 1.5 1.5 3.5 1 5 0l1.5 5-2 3 1 8H7.5l1-8-2-3z",
};
const N = { 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 };
// зачарования: .4 бывает у всех ресурсов, кроме камня (у камня — до .3)
const ENCHS = [0, 1, 2, 3, 4];
const REFINE_TIERS = [4, 5, 6, 7, 8];
const ALL_TIERS = [2, 3, 4, 5, 6, 7, 8];
const STACK = 999;
const MIN_VOL = 50;

function rawId(f, t, e = 0) { const b = FAM[f].raw; return e > 0 && t >= 4 ? `T${t}_${b}_LEVEL${e}@${e}` : `T${t}_${b}`; }
function matId(f, t, e = 0) {
  const b = FAM[f].mat;
  if (FAM[f].stone || t < 4 || !e) return `T${t}_${b}`;
  return `T${t}_${b}_LEVEL${e}@${e}`;
}
function itemLabel(id) {
  if (typeof RU_NAMES !== "undefined" && RU_NAMES[id]) return RU_NAMES[id];
  const m = /^T(\d)_([A-Z]+)(?:_LEVEL(\d)@\d)?$/.exec(id);
  if (!m) return id;
  const [, t, base, e] = m;
  for (const f of FAMS) {
    if (FAM[f].raw === base) return `${FAM[f].rawRu} T${t}${e ? "." + e : ""}`;
    if (FAM[f].mat === base) return `${FAM[f].matRu} T${t}${e ? "." + e : ""}`;
  }
  return id;
}
function parseId(id) {
  const m = /^T(\d)_([A-Z]+)(?:_LEVEL(\d)@\d)?$/.exec(id); if (!m) return null;
  const t = +m[1], base = m[2], e = +(m[3] || 0);
  for (const f of FAMS) {
    if (FAM[f].raw === base) return { t, e, f, kind: "raw", name: itemLabel(id) };
    if (FAM[f].mat === base) return { t, e, f, kind: "mat", name: itemLabel(id) };
  }
  return null;
}

// ---------- состояние ----------
const KEY = "alb-market-tool-v1", JKEY = "alb-market-tool-journal", TKEY = "alb-market-tool-theme";
const DEF = {
  server: "europe", mode: "safe", age: 24,
  // где покупаю и где продаю — отдельно; по умолчанию пять основных городов
  buyC: ["Bridgewatch", "Martlock", "Thetford", "Fort Sterling", "Lymhurst"], sellC: ["Bridgewatch", "Martlock", "Thetford", "Fort Sterling", "Lymhurst"],
  rrr: "0.367", rrrc: 36.7, fee: "0.065", food: 0, margin: 10, buffer: 5, order: true, m: [2, 4, 8],
  bonusFam: "", bonusPct: 10, relist: 0,
  tabs: { pot: false, fish: false, fav: false }, // дополнительные вкладки — по умолчанию скрыты
};
const S = {
  settings: { ...DEF, m: [...DEF.m] },
  view: "refine",
  pFams: ["stone", "fiber"], pTiers: [5, 6, 7, 8], pKind: "all", pEnchs: [0], pMode: "order", pMat: "resale", pItem: null,
  rFams: [...FAMS], rTiers: [5, 6, 7, 8], rEnchs: [0], rOnlyPlus: false, rSort: "margin", rTop: "margin", shopStacks: 1, limits: {},
  cFam: "stone", cTiers: [5, 6, 7, 8], calc: {}, budget: 5000000, bTier: null, fishWeed: "market", potWhere: "brec", potFocus: false, potPlus: false, potTiers: [2, 3, 4, 5, 6, 7, 8], potSort: "margin", potDir: -1, potTop: "margin",
  // избранное и цены, введённые вручную: manual["сервер|id"][город] = { s: [цена лота, время], b: [цена ордера, время] }
  fav: [], manual: {}, favInc: "ask", favKind: "all", favTiers: [2, 3, 4, 5, 6, 7, 8], favMan: false,
  jf: { type: "buy", cycle: "new", f: "stone", t: 6, e: 0, what: "raw", city: "Bridgewatch", order: true, fee: "0.065" },
};
for (const f of FAMS) S.calc[f] = emptyCalc();
function emptyCalc() { const o = {}; for (const t of REFINE_TIERS) o[t] = { raw: null, prev: null, sell: null, own: false, note: {} }; return o; }

const KEYS = ["fav", "manual", "favInc", "favKind", "favTiers", "favMan", "fishWeed", "potWhere", "potFocus", "potPlus", "potTiers", "potSort", "potDir", "potTop", "view", "pFams", "pTiers", "pKind", "pEnchs", "pMode", "pMat", "pItem", "rFams", "rTiers", "rEnchs", "rOnlyPlus", "rSort", "rTop", "shopStacks", "limits", "cFam", "cTiers", "budget", "bTier"];
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) {
    if (saved.settings) {
      S.settings = { ...S.settings, ...saved.settings };
      // раньше Карлеон и Брецилиэн включались одной галочкой — сразу на покупку и продажу
      if (!Array.isArray(saved.settings.buyC)) {
        const extra = [saved.settings.caerleon && "Caerleon", saved.settings.brecilien && "Brecilien"].filter(Boolean);
        S.settings.buyC = [...DEF.buyC, ...extra]; S.settings.sellC = [...DEF.sellC, ...extra];
      }
      delete S.settings.caerleon; delete S.settings.brecilien;
      delete S.settings.station; // раньше — серебро за 1 крафт на все тиры; теперь плата за 100 еды (food)
    }
    for (const k of KEYS) if (k in saved) S[k] = saved[k];
    if (saved.jf) S.jf = { ...S.jf, ...saved.jf };
    if (saved.pFam && !saved.pFams) S.pFams = [saved.pFam];
    if (typeof saved.pEnch === "number" && !saved.pEnchs) S.pEnchs = [saved.pEnch];
    if (typeof saved.rEnch === "number" && !saved.rEnchs) S.rEnchs = [saved.rEnch];
    if (saved.calc) for (const f of FAMS) for (const t of REFINE_TIERS) if (saved.calc[f] && saved.calc[f][t]) S.calc[f][t] = { ...S.calc[f][t], ...saved.calc[f][t] };
  }
} catch (e) { /* хранилище недоступно — работаем без него */ }
const clean = (arr, allowed, fallback) => { const a = Array.isArray(arr) ? arr.filter((x) => allowed.includes(x)) : []; return a.length ? a : fallback; };
S.pFams = clean(S.pFams, FAMS, ["stone"]);
S.rFams = clean(S.rFams, FAMS, [...FAMS]);
S.pTiers = clean(S.pTiers, ALL_TIERS, [5, 6, 7, 8]);
S.pEnchs = clean(S.pEnchs, ENCHS, [0]);
S.rEnchs = clean(S.rEnchs, ENCHS, [0]);
if (!["order", "now"].includes(S.pMode)) S.pMode = "order";
if (!["resale", "craft"].includes(S.pMat)) S.pMat = "resale";
S.settings.buyC = clean(S.settings.buyC, CITIES, [...DEF.buyC]);
S.settings.tabs = { ...DEF.tabs, ...(S.settings.tabs || {}) };
S.settings.sellC = clean(S.settings.sellC, CITIES, [...DEF.sellC]);
S.rTiers = clean(S.rTiers, REFINE_TIERS, [5, 6, 7, 8]);
S.potTiers = clean(S.potTiers, [2, 3, 4, 5, 6, 7, 8], [2, 3, 4, 5, 6, 7, 8]);
if (!["margin", "profit", "vol"].includes(S.potSort)) S.potSort = "margin";
if (S.potDir !== 1) S.potDir = -1;
if (!Array.isArray(S.fav)) S.fav = [];
S.fav = [...new Set(S.fav.filter((x) => typeof x === "string"))];
if (!S.manual || typeof S.manual !== "object" || Array.isArray(S.manual)) S.manual = {};
if (!["ask", "yes", "no"].includes(S.favInc)) S.favInc = "ask";
if (!["all", "raw", "mat", "pot", "ing", "fish"].includes(S.favKind)) S.favKind = "all";
S.favTiers = clean(S.favTiers, [2, 3, 4, 5, 6, 7, 8], [2, 3, 4, 5, 6, 7, 8]);
// ручные цены старше недели уже ни на что не влияют — чистим
for (const [k, cities] of Object.entries(S.manual)) {
  for (const [c, v] of Object.entries(cities || {})) {
    for (const side of ["s", "b"]) if (v && v[side] && !(Date.now() - v[side][1] < 7 * 864e5)) delete v[side];
    if (!v || (!v.s && !v.b)) delete cities[c];
  }
  if (!cities || !Object.keys(cities).length) delete S.manual[k];
}
S.cTiers = clean(S.cTiers, REFINE_TIERS, [5, 6, 7, 8]);
if (!FAM[S.cFam]) S.cFam = "stone";
if (!S.limits || typeof S.limits !== "object" || Array.isArray(S.limits)) S.limits = {};
if (!["margin", "stack", "tier"].includes(S.rSort)) S.rSort = "margin";
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 300);
}

// ---------- форматирование ----------
const $ = (id) => document.getElementById(id);
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const fmt = (x) => !isFinite(x) ? "—" : Math.abs(x) >= 100 ? nf0.format(Math.round(x)) : nf1.format(x);
const fmtSigned = (x) => !isFinite(x) ? "—" : (x > 0 ? "+" : x < 0 ? "−" : "") + fmt(Math.abs(x));
const fmtPct = (x, signed = false) => !isFinite(x) ? "—" : (signed ? (x > 0 ? "+" : x < 0 ? "−" : "") : (x < 0 ? "−" : "")) + nf1.format(Math.abs(x * 100)).replace(/,0$/, "") + "%";
function fmtBig(x, signed = true) {
  if (!isFinite(x)) return "—";
  const s = !signed ? (x < 0 ? "−" : "") : x < 0 ? "−" : x > 0 ? "+" : ""; const a = Math.abs(x);
  if (a >= 1e6) return s + nf2.format(a / 1e6) + " млн";
  if (a >= 1e3) return s + nf0.format(a / 1e3) + " тыс.";
  return s + nf0.format(a);
}
function fmtAge(h) {
  if (!isFinite(h)) return "";
  if (h < 1) return "<1 ч"; if (h < 48) return Math.round(h) + " ч"; return Math.round(h / 24) + " д";
}
const num = (v) => (v === "" || v === null || v === undefined || isNaN(+v)) ? NaN : +v;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lc1 = (s) => s ? s[0].toLowerCase() + s.slice(1) : s;
function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  return forms[a > 10 && a < 20 ? 2 : b > 1 && b < 5 ? 1 : b === 1 ? 0 : 2];
}
const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

// ---------- загрузка данных ----------
const base = () => SERVERS[S.settings.server] || SERVERS.europe;
const cur = {};   // `${server}|${id}` -> {at, cities: {city: {sell, sellT, buy, buyT}}}
const hist = {};  // `${server}|${id}` -> {at, cities: {city: [{t, p, c}]}}
const CUR_TTL = 5 * 60e3, HIST_TTL = 60 * 60e3;
let lastRequest = 0;
async function throttledFetch(url) {
  const wait = Math.max(0, lastRequest + 360 - Date.now()); // ~165 запросов в минуту максимум
  lastRequest = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url);
  if (res.status === 429) throw new Error("API просит подождать (слишком много запросов). Попробуй через минуту.");
  if (!res.ok) throw new Error(`API ответил ${res.status}`);
  return res.json();
}
function chunkIds(ids, prefix, suffix) {
  const out = []; let cur = [];
  for (const id of ids) {
    const next = [...cur, id];
    if ((prefix + next.join(",") + suffix).length > 3900 && cur.length) { out.push(cur); cur = [id]; } else cur = next;
  }
  if (cur.length) out.push(cur);
  return out;
}
const parseT = (s) => (!s || s.startsWith("0001")) ? null : Date.parse(s.endsWith("Z") ? s : s + "Z");
const locParam = () => CITIES.map(encodeURIComponent).join(",");
let pending = 0, done = 0;
function setStatus(long, short = "", state = "") {
  const el = $("status");
  el.className = "status" + (state ? " " + state : "");
  el.title = state === "err" ? long : "";
  el.innerHTML = `<span class="dot"></span><span class="st-long">${esc(long)}${short ? " " : ""}</span>${esc(short)}`;
}
function progress() { if (pending > 0) setStatus("Загружаю цены…", `${done}/${done + pending}`, "busy"); }

async function loadCurrent(ids, force = false) {
  const srv = S.settings.server;
  const need = [...new Set(ids)].filter((id) => force || !cur[`${srv}|${id}`] || Date.now() - cur[`${srv}|${id}`].at > CUR_TTL);
  if (!need.length) return;
  const prefix = `${base()}/api/v2/stats/prices/`, suffix = `.json?locations=${locParam()}&qualities=1`;
  const groups = chunkIds(need, prefix, suffix);
  pending += groups.length; progress();
  for (const g of groups) {
    try {
      const rows = await throttledFetch(prefix + g.map(encodeURIComponent).join(",") + suffix);
      const now = Date.now();
      for (const id of g) cur[`${srv}|${id}`] = { at: now, cities: {} };
      for (const r of rows) {
        const rec = cur[`${srv}|${r.item_id}`]; if (!rec) continue;
        rec.cities[r.city] = {
          sell: r.sell_price_min || null, sellT: parseT(r.sell_price_min_date),
          buy: r.buy_price_max || null, buyT: parseT(r.buy_price_max_date),
        };
      }
    } finally { pending--; done++; progress(); }
  }
}
function isoDay(d) { return d.toISOString().slice(0, 10); }
async function loadHistory(ids, force = false) {
  const srv = S.settings.server;
  const need = [...new Set(ids)].filter((id) => force || !hist[`${srv}|${id}`] || Date.now() - hist[`${srv}|${id}`].at > HIST_TTL);
  if (!need.length) return;
  const from = isoDay(new Date(Date.now() - 31 * 864e5));
  const prefix = `${base()}/api/v2/stats/history/`, suffix = `.json?date=${from}&locations=${locParam()}&qualities=1&time-scale=24`;
  const groups = chunkIds(need, prefix, suffix);
  pending += groups.length; progress();
  for (const g of groups) {
    try {
      const rows = await throttledFetch(prefix + g.map(encodeURIComponent).join(",") + suffix);
      const now = Date.now();
      for (const id of g) hist[`${srv}|${id}`] = { at: now, cities: {} };
      for (const r of rows) {
        const rec = hist[`${srv}|${r.item_id}`]; if (!rec) continue;
        const pts = (r.data || []).map((d) => ({ t: parseT(d.timestamp), p: d.avg_price, c: d.item_count })).filter((d) => d.t && d.p > 0);
        pts.sort((a, b) => a.t - b.t);
        rec.cities[r.location] = (rec.cities[r.location] || []).concat(pts);
      }
    } finally { pending--; done++; progress(); }
  }
}
async function ensure(ids, { history = true, force = false } = {}) {
  if (pending === 0) done = 0;
  try {
    await loadCurrent(ids, force);
    if (history) await loadHistory(ids, force);
    if (pending === 0) {
      const t = new Date();
      setStatus(`${SERVER_RU[S.settings.server]}, цены на`, t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    }
  } catch (e) {
    setStatus(`Не удалось получить цены: ${e.message}`, "нет данных", "err");
  }
}

// ---------- статистика и выбор цены ----------
function histPts(id, city, days = 8) {
  const rec = hist[`${S.settings.server}|${id}`]; const arr = rec && rec.cities[city];
  if (!arr || !arr.length) return [];
  const since = Date.now() - days * 864e5;
  return arr.filter((d) => d.t >= since);
}
function histStats(id, city) { return statsOf(histPts(id, city, 8)); }
function statsOf(pts) {
  if (pts.length < 2) return null;
  const full = pts.length > 3 ? pts.slice(0, -1) : pts; // последний день обычно неполный
  const vol = full.reduce((s, d) => s + d.c, 0) / full.length;
  const pct = (q) => { const s = [...pts].sort((a, b) => a.p - b.p); const tot = s.reduce((a, d) => a + d.c, 0); let acc = 0; for (const d of s) { acc += d.c; if (acc >= tot * q) return d.p; } return s[s.length - 1].p; };
  return { med: pct(0.5), p20: pct(0.2), p80: pct(0.8), vol };
}
// обычная цена предмета: сделки за неделю в этом городе, а если там их мало — во всех городах
function refStats(id, city) {
  const hs = histStats(id, city);
  if (hs && hs.vol >= MIN_VOL) return hs;
  return statsOf(activeCities().flatMap((c) => histPts(id, c, 8)).sort((a, b) => a.t - b.t));
}
// ордер на закупку сильно ниже обычной цены никто не исполнит, а лот сильно выше — никто не купит
const ORDER_MIN = 0.6, LOT_MAX = 1.3;
function oddPrice(id, city, side, p) {
  const ref = refStats(id, city); if (!ref) return null;
  // истории ордеров нет — есть только средние цены всех сделок за день (и с лотов, и в ордера).
  // Ордер сравниваем с нижней границей сделок (P20), а не с медианой: на рынке с большим разрывом
  // между лотами и ордерами честный ордер легко оказывается ниже 60% медианы
  if (side === "buy" && p < ref.p20 * ORDER_MIN) return ref;
  if (side === "sell" && p > ref.p80 * LOT_MAX) return ref;
  return null;
}
// цена с сервера (AODP) — без ручных
function apiOf(id, city, side) {
  const rec = cur[`${S.settings.server}|${id}`]; const r = rec && rec.cities[city];
  if (!r) return null;
  const p = side === "sell" ? r.sell : r.buy, t = side === "sell" ? r.sellT : r.buyT;
  if (!p || !t) return null;
  return { p, t };
}
// цена, введённая вручную в «Избранном»; manualOff — посчитать «как было по серверу»
let manualOff = false;
function manualOf(id, city, side) {
  if (manualOff) return null;
  const m = S.manual[`${S.settings.server}|${id}`], v = m && m[city] && m[city][side === "sell" ? "s" : "b"];
  return v ? { p: v[0], t: v[1] } : null;
}
// живая цена: своя или с сервера — что новее. Своя стареет так же, как серверная
function liveOf(id, city, side) {
  const a = apiOf(id, city, side), m = manualOf(id, city, side);
  if (m && (!a || m.t >= a.t)) return { p: m.p, age: Math.max(0, (Date.now() - m.t) / 36e5), manual: true };
  return a ? { p: a.p, age: Math.max(0, (Date.now() - a.t) / 36e5) } : null;
}
// города, где покупаю / продаю, и все, что хоть как-то отмечены (для таблицы цен и обычных цен по истории)
const buyCities = () => CITIES.filter((c) => S.settings.buyC.includes(c));
const sellCities = () => CITIES.filter((c) => S.settings.sellC.includes(c));
function activeCities() { return CITIES.filter((c) => S.settings.buyC.includes(c) || S.settings.sellC.includes(c)); }
const maxAge = () => num(S.settings.age) || 24;
// Сколько стоит купить 1 шт. в городе. Своим ордером — лучший ордер на закупку +1 и комиссия 2,5%;
// если ордеров нет — по самому дешёвому лоту, без комиссии
// каждое перевыставление ордера или лота — ещё 2,5% сбора за выставление
const SETUP = 0.025;
const relists = () => Math.max(0, num(S.settings.relist) || 0);
const orderFee = () => 1 + SETUP * (1 + relists());
function buyIn(id, city) {
  if (S.settings.order && S.settings.mode !== "hist") {
    const b = liveOf(id, city, "buy");
    if (b && b.age <= maxAge() && (b.manual || !oddPrice(id, city, "buy", b.p))) { const hs = histStats(id, city); return { price: b.p + 1, city, src: "order", age: b.age, vol: hs ? hs.vol : NaN, fee: orderFee(), manual: b.manual }; }
  }
  const o = lotIn(id, city);
  return o && { ...o, fee: 1 };
}
function lotIn(id, city) {
  const live = liveOf(id, city, "sell"), hs = histStats(id, city), mode = S.settings.mode;
  const fresh = live && live.age <= maxAge() ? live : null;
  if (mode === "live") return fresh ? { price: fresh.p, city, src: "live", age: fresh.age, manual: fresh.manual } : null;
  if (mode === "hist") return hs && hs.vol >= MIN_VOL ? { price: hs.med, city, src: "hist" } : null;
  // свою цену не проверяем: её видели глазами
  if (fresh && fresh.manual) return { price: fresh.p, city, src: "live", age: fresh.age, manual: true };
  // лот заметно дешевле обычного — скорее всего, по такой цене лежит лишь несколько штук; считаем по P20 за неделю
  if (fresh && hs && hs.vol >= MIN_VOL && fresh.p < hs.med * LOW_LOT) return { price: Math.max(fresh.p, hs.p20), city, src: "low", age: fresh.age, live: fresh.p, med: hs.med };
  if (fresh) return { price: fresh.p, city, src: "live", age: fresh.age };
  return hs && hs.vol >= MIN_VOL ? { price: hs.med, city, src: "hist" } : null;
}
const LOW_LOT = 0.7;
// За сколько можно продать 1 шт. своим лотом в городе
function sellIn(id, city) {
  const live = liveOf(id, city, "sell"), hs = histStats(id, city), mode = S.settings.mode;
  const fresh = live && live.age <= maxAge() ? live : null;
  const vol = hs ? hs.vol : NaN;
  if (mode === "live") return fresh ? { price: fresh.p, city, src: "live", age: fresh.age, vol, manual: fresh.manual } : null;
  if (mode === "hist") return hs && hs.vol >= MIN_VOL ? { price: hs.p80, city, src: "hist", vol } : null;
  // свою цену не ограничиваем P80 и берём даже там, где мало сделок
  if (fresh && fresh.manual) return { price: fresh.p, city, src: "live", age: fresh.age, vol, manual: true, noHist: !hs };
  if (hs && hs.vol < MIN_VOL) return null;
  if (fresh && hs) return fresh.p > hs.p80 ? { price: hs.p80, city, src: "cap", age: fresh.age, vol } : { price: fresh.p, city, src: "live", age: fresh.age, vol };
  if (fresh) {
    // в городе нет истории сделок — проверить лот не с чем, поэтому ограничиваем его P80 сделок по всем городам
    const ref = refStats(id, city);
    if (ref && fresh.p > ref.p80) return { price: ref.p80, city, src: "cap", age: fresh.age, vol, noHist: true };
    return { price: fresh.p, city, src: "live", age: fresh.age, vol, noHist: true };
  }
  return hs ? { price: hs.p80, city, src: "hist", vol } : null;
}
// сравниваем с учётом комиссии ордера; o.paid — сколько реально уходит серебра за 1 шт.
function pickBuy(id) {
  let best = null;
  for (const c of buyCities()) { const o = buyIn(id, c); if (o) o.paid = o.price * o.fee; if (o && (!best || o.paid < best.paid)) best = o; }
  return best;
}
// город, где по предмету нет ни одной сделки за неделю, берём только если больше негде
function pickSell(id) {
  let best = null, blind = null;
  for (const c of sellCities()) {
    const o = sellIn(id, c); if (!o) continue;
    if (o.noHist) { if (!blind || o.price > blind.price) blind = o; } else if (!best || o.price > best.price) best = o;
  }
  return best || blind;
}
// Сырьё для переработки: у камня сравниваем обычный и зачарованный по цене за «обычный» камень
function pickRaw(f, t, e) {
  const cs = calcSettings(f);
  if (!FAM[f].stone) { const o = pickBuy(rawId(f, t, e)); return o && { ...o, ench: e, unit: o.price }; }
  // у камня: обычный или зачарованный — что выйдет дешевле в пересчёте на обычный
  let best = null;
  for (let k = 0; k <= (t >= 4 ? 3 : 0); k++) {
    const o = pickBuy(rawId(f, t, k)); if (!o) continue;
    const m = k ? cs.mult[k - 1] : 1, eff = o.price / m;
    if (!best || o.paid / m < best.paid) best = { ...o, price: eff, paid: o.paid / m, unit: o.price, ench: k };
  }
  return best;
}
// ряд цен за 7 дней в городе с наибольшим объёмом (или в заданном)
function series7(id, city, days = 8) {
  const rec = hist[`${S.settings.server}|${id}`]; if (!rec) return null;
  let c = city;
  if (!c || !rec.cities[c]) {
    let bestV = -1;
    for (const k of activeCities()) { const v = histPts(id, k, days).reduce((a, d) => a + d.c, 0); if (v > bestV) { bestV = v; c = k; } }
  }
  const pts = histPts(id, c, days);
  if (pts.length < 2) return null;
  const first = pts[0].p, last = pts[pts.length - 1].p;
  return { city: c, vals: pts.map((d) => d.p), delta: (last - first) / first };
}
function spark(vals, w = 90, h = 28, color) {
  if (!vals || vals.length < 2) return `<svg width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${(i * (w - 4) / (vals.length - 1) + 2).toFixed(1)},${(h - 3 - (v - lo) / r * (h - 6)).toFixed(1)}`).join("");
  const col = color || (vals[vals.length - 1] >= vals[0] ? "var(--good)" : "var(--bad)");
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" stroke="${col}"/></svg>`;
}
function liquidity(vol) {
  if (!isFinite(vol) || vol <= 0) return { cls: "", txt: "нет данных о продажах" };
  const share = STACK / vol;
  return { cls: share <= 0.2 ? "l1" : share <= 0.6 ? "l2" : "l3", txt: `стак 999 — это ${fmtPct(share)} дневных продаж` };
}

// ---------- расчёт ----------
function calcSettings(f) {
  const st = S.settings;
  let r = st.rrr === "custom" ? num(st.rrrc) / 100 : +st.rrr;
  if (!isFinite(r) || r < 0 || r >= 1) r = 0;
  const bonus = !!(f && st.bonusFam === f);
  if (bonus) { const pb = 1 / (1 - r) - 1 + (num(st.bonusPct) || 0) / 100; r = 1 - 1 / (1 + pb); }
  return {
    // перевыставления дорожают только для своих лотов (налог 6,5% / 10,5%), продажа в чужой ордер их не требует
    k: 1 - r, r, bonus, fee: +st.fee + ([0.065, 0.105].includes(+st.fee) ? SETUP * relists() : 0), food: num(st.food) || 0, stone: !!(f && FAM[f].stone), m: (num(st.margin) || 0) / 100,
    buf: (num(st.buffer) || 0) / 100, bf: st.order ? orderFee() : 1, mult: st.m.map((x) => num(x) || 1),
  };
}
// плата станции за 1 шт. на выходе: еда = ценность предмета × 0,1125, платим за каждые 100 еды.
// Ценность материала удваивается с тиром и уровнем зачарования: T4 — 16, T5 — 32 … T8 — 256, .1/.2/.3 — ×2/×4/×8.
// Зачарованный камень даёт обычные блоки, поэтому у камня зачарование не считается
const NUTRITION = 0.1125;
function stationFee(t, e, c) { return c.food ? c.food / 100 * NUTRITION * 2 ** (t + (c.stone ? 0 : e || 0)) : 0; }
function economics(t, raw, prevEff, sell, c, e = 0) {
  const n = N[t], station = stationFee(t, e, c);
  const cost = (n * raw * c.bf + prevEff) * c.k + station;
  const effSell = sell * (1 - c.buf) * (1 - c.fee);
  const profit = effSell - cost;
  const need = (m) => effSell / (1 + m);
  return {
    cost, effSell, profit, margin: profit / cost, capital: (n * raw * c.bf + prevEff) * c.k * STACK,
    station,
    maxRaw: (m) => ((need(m) - station) / c.k - prevEff) / (n * c.bf),
    maxPrev: (m) => ((need(m) - station) / c.k - n * raw * c.bf) / c.bf,
    minSell: (m) => cost * (1 + m) / ((1 - c.buf) * (1 - c.fee)),
  };
}
const levelColor = (m, profit, target) => profit > 0 && m >= target ? "var(--good)" : profit >= 0 ? "var(--warn)" : "var(--bad)";
function statusPill(margin, profit, target) {
  if (!isFinite(margin)) return `<span class="pill none">нет данных</span>`;
  if (profit > 0 && margin >= target) return `<span class="pill good">в плюсе, ${nf0.format(margin * 100)}%</span>`;
  if (profit >= 0) return `<span class="pill warn">на грани, ${nf0.format(margin * 100)}%</span>`;
  return `<span class="pill bad">в минусе, ${nf0.format(margin * 100)}%</span>`;
}

// ---------- общие элементы ----------
function icon(id, size = 42, tier = true) {
  const p = parseId(id); if (!p) return "";
  // своя копия иконки из images/items; если её нет — официальный сервер иконок; если и его нет — нарисованная заглушка
  const local = `images/items/${id.replace("@", "_")}.webp`;
  const remote = `https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?size=128&amp;quality=1`;
  return `<span class="ic t${p.t}" style="--s:${size}px;--tc:var(--t${p.t})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${FAM_ICON[p.f]}"/></svg>`
    + `<img src="${local}" data-remote="${remote}" alt="" loading="lazy" decoding="async" onload="this.previousElementSibling&&this.previousElementSibling.tagName==='svg'&&this.previousElementSibling.remove()" onerror="if(this.dataset.remote){this.src=this.dataset.remote;this.dataset.remote=''}else this.remove()">`
    + (tier ? `<span class="tier">T${p.t}${p.e ? `<sup>.${p.e}</sup>` : ""}</span>` : "") + `</span>`;
}
// короткое обозначение города, как принято у игроков: BW, ML, TF, FS, LH, CL, BR
const CITY_CODE = { Bridgewatch: "BW", Martlock: "ML", Thetford: "TF", "Fort Sterling": "FS", Lymhurst: "LH", Caerleon: "CL", Brecilien: "BR" };
const cityBadge = (c) => `<span class="cb" style="--cc:${CITY_COLOR[c]}" title="${esc(c)}">${CITY_CODE[c] || esc(c.slice(0, 2))}</span>`;
const cityHtml = (c) => c ? `<span class="city" style="color:${CITY_COLOR[c]}">${esc(c)}</span>` : "";
// звёздочка — цена введена вручную в «Избранном»
const MSTAR = `<i class="mstar" title="Цена введена вручную">★</i>`;
function srcAge(o) {
  if (!o) return "";
  if (o.src === "hist") return "медиана 7 д";
  if (o.src === "cap") return "P80";
  const st = o.manual ? "★ " : "";
  if (o.src === "low") return `${fmtAge(o.age)} · дёшево?`;
  if (o.src === "order") return `${st}ордер · ${fmtAge(o.age)}`;
  return o.age !== undefined ? st + fmtAge(o.age) : "";
}
function chips(el, items, isOn, onClick, cls) {
  el.innerHTML = "";
  for (const [val, label] of items) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label;
    if (cls) b.className = cls(val);
    b.setAttribute("aria-pressed", String(isOn(val)));
    b.addEventListener("click", () => onClick(val));
    el.appendChild(b);
  }
}
// мультивыбор: клик переключает значение, пустым список не бывает
function toggleIn(arr, v, order) {
  const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  if (!next.length) return arr;
  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
const tierItems = (tiers) => tiers.map((t) => [t, `T${t}`]);
const tierCls = (t) => `tc t${t}`;
const ENCH_ITEMS = ENCHS.map((e) => [e, "." + e]);
const enchCls = (e) => (e ? `tc ec${e}` : "");
function famChips(el, list, set) {
  const all = list.length === FAMS.length;
  chips(el, [["all", "Все"], ...FAMS.map((f) => [f, FAM[f].tab])],
    (v) => (v === "all" ? all : list.includes(v) && !all),
    (v) => set(v === "all" ? [...FAMS] : all ? [v] : toggleIn(list, v, FAMS)));
}
function famsText(list) {
  if (list.length === FAMS.length) return "все ресурсы";
  if (list.length <= 2) return list.map((f) => FAM[f].tab).join(", ");
  return `${list.length} ${plural(list.length, ["ресурс", "ресурса", "ресурсов"])}`;
}
function tiersText(list) {
  const s = [...list].sort((a, b) => a - b);
  if (s.length === 1) return `T${s[0]}`;
  const contiguous = s.every((t, i) => !i || t === s[i - 1] + 1);
  return contiguous ? `T${s[0]}–T${s[s.length - 1]}` : s.map((t) => "T" + t).join(", ");
}
const tooltip = $("tooltip");
function showTip(html, x, y) {
  tooltip.innerHTML = html; tooltip.hidden = false;
  const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top + h > window.innerHeight - 8) top = y - h - 14;
  tooltip.style.left = Math.max(8, left) + "px"; tooltip.style.top = Math.max(8, top) + "px";
}
const hideTip = () => { tooltip.hidden = true; };
let toastTimer;
function toast(text) {
  const el = $("toast"); el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2200);
}
function rowNav(root, sel, go) {
  root.querySelectorAll(sel).forEach((tr) => {
    tr.addEventListener("click", () => go(tr));
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(tr); } });
  });
}

// ---------- шторка фильтров (телефон) ----------
let openSheetEl = null;
function openSheet(id) {
  const el = $(id); if (!el) return;
  openSheetEl = el; el.classList.add("open"); $("scrim").hidden = false; document.body.style.overflow = "hidden";
}
function closeSheet() {
  if (!openSheetEl) return;
  openSheetEl.classList.remove("open"); openSheetEl = null; $("scrim").hidden = true; document.body.style.overflow = "";
}

// ---------- тикер ----------
const TICKER_IDS = FAMS.flatMap((f) => [5, 6, 7].map((t) => matId(f, t)));
let tickerLoaded = false;
async function loadTicker() {
  await ensure(TICKER_IDS, { history: true });
  tickerLoaded = true; renderTicker();
}
function renderTicker() {
  if (!tickerLoaded) return;
  const items = [];
  for (const id of TICKER_IDS) {
    const s = pickSell(id); if (!s) continue;
    const ser = series7(id, s.city), p = parseId(id);
    const d = ser ? ser.delta : NaN;
    items.push(`<span><i class="t${p.t}"></i>${esc(p.name)} <b>${fmt(s.price)}</b>${isFinite(d) ? ` <span class="${d >= 0 ? "pos" : "neg"}">${fmtPct(d, true)}</span>` : ""}</span>`);
  }
  const box = $("ticker"), inn = $("ticker-in");
  if (!items.length) { box.hidden = true; return; }
  box.hidden = false;
  inn.innerHTML = items.join("") + items.join("");
  inn.classList.add("run");
}

// ---------- вкладка «Цены» ----------
function pricesGroups() {
  const groups = [];
  // порядок: тир → сырьё, потом материал → зачарования подряд (T6 .0, T6 .1, блок T6, T7 .0, T7 .1 …)
  for (const f of S.pFams) {
    const ids = [];
    for (const t of S.pTiers) {
      const es = S.pEnchs.filter((e) => !e || t >= 4);
      if (S.pKind !== "mat") for (const e of es) if (!(FAM[f].stone && e > 3)) ids.push(rawId(f, t, e));
      if (S.pKind !== "raw") for (const e of es) if (!(FAM[f].stone && e > 0)) ids.push(matId(f, t, e));
    }
    groups.push({ f, ids: [...new Set(ids)] });
  }
  return groups;
}
const pricesIds = () => pricesGroups().flatMap((g) => g.ids);
function renderPricesControls() {
  famChips($("p-fam"), S.pFams, (v) => { S.pFams = v; save(); openPrices(); });
  chips($("p-tiers"), tierItems(ALL_TIERS), (v) => S.pTiers.includes(v), (v) => { S.pTiers = toggleIn(S.pTiers, v, ALL_TIERS); save(); openPrices(); }, tierCls);
  chips($("p-ench"), ENCH_ITEMS, (v) => S.pEnchs.includes(v), (v) => { S.pEnchs = toggleIn(S.pEnchs, v, ENCHS); save(); openPrices(); }, enchCls);
  chips($("p-mode"), [["order", "Своим ордером"], ["now", "Сразу"]], (v) => v === S.pMode, (v) => { S.pMode = v; save(); renderPricesControls(); renderPricesTable(); renderPricesWidgets(); });
  $("p-legend").innerHTML = S.pMode === "order"
    ? `<span><span class="ptag s">продают</span>самый дешёвый лот. Обведён самый дорогой: там выгоднее выставить свой лот на продажу</span>
       <span><span class="ptag b">покупают</span>лучший ордер на закупку. Обведён самый дешёвый: там дешевле всего купить своим ордером</span>`
    : `<span><span class="ptag s">продают</span>самый дешёвый лот. Обведён самый дешёвый: там дешевле всего купить сразу</span>
       <span><span class="ptag b">покупают</span>лучший ордер на закупку. Обведён самый дорогой: там дороже всего продать сразу</span>`;
  $("p-legend").innerHTML += `<span class="lg-colors">Рядом с ценой — маржа, если купить по этой цене. <b>Сырьё</b> — с переработкой: материал тира ниже по обычной цене, продажа — средняя по городам «продаю» с учётом объёма, <b>материал</b> — ${S.pMat === "craft" ? "как материал для крафта тира выше (у T8 — перепродажа)" : "с перепродажей своим лотом в лучшем другом городе"}; вторая маржа — в подсказке. Цвет: <b class="g-ok">зелёный</b> — маржа ${nf0.format(calcSettings().m * 100)}% и больше, <b class="g-mid">жёлтый</b> — в плюсе, <b class="g-bad">красный</b> — в минусе. Если таблица не влезает по ширине, маржа — в подсказке</span>`;
  chips($("p-mat"), [["resale", "Перепродажа"], ["craft", "Крафт тира выше"]], (v) => v === S.pMat, (v) => { S.pMat = v; save(); renderPricesControls(); renderPricesTable(); });
  chips($("p-kind"), [["all", "Всё"], ["raw", "Сырьё"], ["mat", "Материал"]], (v) => v === S.pKind, (v) => { S.pKind = v; save(); openPrices(); });
  const parts = [famsText(S.pFams), tiersText(S.pTiers)];
  if (S.pEnchs.join() !== "0") parts.push(S.pEnchs.map((e) => "." + e).join(" "));
  if (S.pKind !== "all") parts.push(S.pKind === "raw" ? "сырьё" : "материал");
  $("p-fsum").textContent = parts.join(" · ");
  const cnt = (S.pFams.length !== FAMS.length) + (S.pTiers.length !== ALL_TIERS.length) + (S.pEnchs.join() !== "0") + (S.pKind !== "all");
  $("p-fcount").textContent = cnt || "";
  const n = pricesIds().length;
  $("p-show").textContent = `Показать ${n} ${plural(n, ["предмет", "предмета", "предметов"])}`;
}
function cityQuotes(id, cities) {
  let minSell = Infinity, maxSell = -Infinity, minBuy = Infinity, maxBuy = -Infinity;
  const q = {};
  for (const c of cities) {
    const s = liveOf(id, c, "sell"), b = liveOf(id, c, "buy");
    if (s && !s.manual) { const r = oddPrice(id, c, "sell", s.p); if (r) { s.odd = true; s.ref = r; } }
    if (b && !b.manual) { const r = oddPrice(id, c, "buy", b.p); if (r) { b.odd = true; b.ref = r; } }
    q[c] = { s, b };
    // лучшая цена для покупки — только среди городов «покупаю», для продажи — среди «продаю»
    const canB = S.settings.buyC.includes(c), canS = S.settings.sellC.includes(c);
    if (s && !s.odd && s.age <= maxAge()) { if (canB) minSell = Math.min(minSell, s.p); if (canS) maxSell = Math.max(maxSell, s.p); }
    if (b && !b.odd && b.age <= maxAge()) { if (canB) minBuy = Math.min(minBuy, b.p); if (canS) maxBuy = Math.max(maxBuy, b.p); }
  }
  // «сразу»: купить по самому дешёвому лоту, продать в самый дорогой ордер;
  // «своим ордером»: купить ордером там, где ордера дешевле всего, продать лотом там, где лоты дороже всего
  const order = S.pMode === "order";
  return { q, minSell, maxBuy, bestS: order ? maxSell : minSell, bestB: order ? minBuy : maxBuy };
}
// для зачарованного камня div = 2/4/8: при наведении видно цену в пересчёте на обычный
// M — что значит маржа у этой цены (marginModel), city — город ячейки
function pv(o, kind, best, div = 1, M = null, city = "") {
  if (!o) return `<span class="pv none">—</span>`;
  if (o.odd) {
    const r = o.ref, tip = kind === "b"
      ? `Ордер сильно ниже обычных сделок: за неделю 80% сделок прошли дороже ${fmt(r.p20)}, а этот ордер меньше 60% от этого. Скорее всего, устаревший или ловушка. В расчётах не учитывается`
      : `Лот сильно дороже обычных сделок: за неделю 80% сделок прошли не дороже ${fmt(r.p80)}, а этот лот выше этого больше чем на 30%. В расчётах не учитывается`;
    return `<span class="pv odd" title="${esc(tip)}">${fmt(o.p)}</span>`;
  }
  const r = M ? M.at(o, kind, city) : { m: NaN, g: "" }, mg = r.m, g = r.g || "";
  const pm = isFinite(mg) ? `${mg < 0 ? "−" : ""}${nf0.format(Math.abs(mg * 100))}%` : "";
  const tip = [div > 1 ? `как .0: ${fmt(o.p / div)}` : "", pm ? (r.why.includes("%") ? r.why : `${r.why} — маржа ${pm}`) : "", g ? LIM_TXT[g] : ""].filter(Boolean).join(" · ");
  return `<span class="pv${best ? ` best-${kind}` : ""}${g ? " g-" + g : ""}"${tip ? ` title="${esc(tip)}"` : ""}>${fmt(o.p)}${o.manual ? MSTAR : ""}${pm ? `<small class="pm">${pm}</small>` : ""}</span>`;
}
// Сырьё оцениваем как будущую переработку: маржа, если купить по этой цене и переработать (цвет — по порогу «бери до» или своему лимиту).
// Материал — как товар: маржа перепродажи, если купить по этой цене и продать своим лотом в лучшем другом городе из «продаю».
function marginModel(id, L) {
  const p = parseId(id); if (!p) return null;
  if (p.kind === "raw") return {
    at: (o) => ({ m: L && L.auto && L.auto.mAt ? L.auto.mAt(o.p) : NaN, g: limGrade(L, o.p), why: `переработка: купить по этой цене и переработать${L && L.auto ? ", " + L.auto.why : ""}` }),
  };
  const c = calcSettings(p.f), target = c.m, fee = listingFee(), stone = !!FAM[p.f].stone, e = stone ? 0 : p.e;
  // перепродажа — как в виджете перепродажи: не дороже обычных цен (P80 за неделю) и где покупают хотя бы ARB_MIN_VOL в день
  const sells = sellCities().map((cc) => { const o = sellIn(id, cc); return o && { c: cc, p: o.price, vol: o.vol }; })
    .filter((x) => x && !(isFinite(x.vol) && x.vol < ARB_MIN_VOL)).sort((a, b) => b.p - a.p);
  // крафт тира выше: этот материал — «тир ниже» в рецепте T+1, сырьё и продажа T+1 — по обычным ценам за неделю
  const t2 = p.t + 1, up = t2 <= 8 && N[t2] ? {
    raw: stone ? typicalRaw(p.f, t2, true) : typical(rawId(p.f, t2, e), "buy", true), sell: sellAvg(matId(p.f, t2, e)), name: itemLabel(matId(p.f, t2, e)),
  } : null;
  const grade = (m) => (!isFinite(m) ? "" : m >= target ? "ok" : m >= 0 ? "mid" : "bad");
  const pct = (m) => `${m < 0 ? "−" : "+"}${nf0.format(Math.abs(m * 100))}%`;
  return {
    at: (o, side, city) => {
      const paid = side === "b" ? (o.p + 1) * orderFee() : o.p, how = side === "b" ? "своим ордером" : "по этому лоту";
      const dest = sells.find((x) => x.c !== city);
      const mr = dest ? (dest.p * (1 - fee) - paid) / paid : NaN;
      const mc = up && up.raw && up.sell ? economics(t2, up.raw.med, paid, up.sell.med, c, e).margin : NaN;
      const craft = S.pMat === "craft" && up, m = craft ? mc : mr;
      const parts = [
        isFinite(mr) ? `перепродажа ${pct(mr)}: купить ${how}, продать своим лотом в ${dest.c} по ~${fmt(dest.p)}` : "",
        isFinite(mc) ? `для крафта ${lc1(up.name)} ${pct(mc)}: сырьё T${t2} по обычной цене, продажа ~${fmt(up.sell.med)} ${up.sell.where}` : "",
      ].filter(Boolean);
      if (craft) parts.reverse();
      return { m, g: grade(m), why: parts.join(" · ") };
    },
  };
}
// ---- выгодные цены: автоматический лимит по марже и обычным ценам рецепта, либо свой ----
// сырьё — «покупай до», материал — «продавай от». Две другие цены рецепта — обычные цены сделок за неделю.
const LIM_TXT = { ok: "даёт желаемую маржу", mid: "в плюсе, но маржа ниже желаемой", bad: "в минусе" };
function autoLimit(id) {
  const p = parseId(id); if (!p || p.t < 4) return null;
  const c = calcSettings(p.f), stone = !!FAM[p.f].stone, e = stone ? 0 : p.e;
  if (p.kind === "raw") {
    const sell = sellAvg(matId(p.f, p.t, e)), prev = typical(matId(p.f, p.t - 1, e), "buy", true);
    if (!sell || !prev) return null;
    const o = economics(p.t, 0, prev.med * c.bf, sell.med, c, e), d = stone && p.e ? c.mult[p.e - 1] : 1;
    // маржа при покупке по цене x (цена за штуку этого камня; переводим в обычный)
    const mAt = (x) => economics(p.t, x / d, prev.med * c.bf, sell.med, c, e).margin;
    return { side: "buy", lim: o.maxRaw(c.m) * d, be: o.maxRaw(0) * d, mAt, why: `при продаже ${lc1(itemLabel(matId(p.f, p.t, e)))} ~${fmt(sell.med)} ${sell.where} и ${lc1(itemLabel(matId(p.f, p.t - 1, e)))} ~${fmt(prev.med)}` };
  }
  const raw = stone ? typicalRaw(p.f, p.t, true) : typical(rawId(p.f, p.t, e), "buy", true), prev = typical(matId(p.f, p.t - 1, e), "buy", true);
  if (!raw || !prev) return null;
  const o = economics(p.t, raw.med, prev.med * c.bf, 1, c, e);
  const mAt = (x) => economics(p.t, raw.med, prev.med * c.bf, x, c, e).margin;
  return { side: "sell", lim: o.minSell(c.m), be: o.minSell(0), mAt, why: `при сырье ~${fmt(raw.med)} и ${lc1(itemLabel(matId(p.f, p.t - 1, e)))} ~${fmt(prev.med)}` };
}
function limitOf(id) {
  const a = autoLimit(id), own = num((S.limits || {})[id]), p = parseId(id);
  if (isFinite(own) && own > 0 && p && p.kind === "raw") return { side: p && p.kind === "raw" ? "buy" : "sell", lim: own, be: a ? a.be : NaN, auto: a, own: true };
  return a && isFinite(a.lim) ? { ...a, auto: a, own: false } : null;
}
function limGrade(L, p) {
  if (!L || !isFinite(p)) return "";
  const buy = L.side === "buy";
  if (buy ? p <= L.lim : p >= L.lim) return "ok";
  if (isFinite(L.be) && (buy ? p <= L.be : p >= L.be)) return "mid";
  return "bad";
}
// ids, история которых нужна для автоматических лимитов
function limitIds(ids) {
  const out = [];
  for (const id of ids) {
    const p = parseId(id); if (!p || p.t < 4) continue;
    const e = FAM[p.f].stone ? 0 : p.e;
    out.push(matId(p.f, p.t, e), matId(p.f, p.t - 1, e));
    if (p.kind === "mat") {
      if (FAM[p.f].stone) for (let k = 0; k <= 3; k++) out.push(rawId(p.f, p.t, k)); else out.push(rawId(p.f, p.t, e));
      // «Крафт тира выше»: этот материал идёт в рецепт T+1 — нужны сырьё и продажа T+1
      if (p.t < 8) { out.push(matId(p.f, p.t + 1, e)); if (FAM[p.f].stone) for (let k = 0; k <= 3; k++) out.push(rawId(p.f, p.t + 1, k)); else out.push(rawId(p.f, p.t + 1, e)); }
    }
  }
  return [...new Set(out)];
}
function limitLine(id) {
  const L = limitOf(id); if (!L) return "";
  const pre = L.side === "buy" ? "бери до" : "продавай от", mm = nf0.format(calcSettings(parseId(id).f).m * 100);
  const tip = L.own ? `Твой лимит. Расчёт сайта: ${L.auto ? fmt(L.auto.lim) + " для маржи " + mm + "%, " + L.auto.why : "нет данных"}` : `Для маржи ${mm}% ${L.why}. Нажми ✎, чтобы задать свой`;
  // свой лимит задаётся только для сырья: у материала цвет — по перепродаже, а «продавай от» — справка для продажи своих блоков
  const raw = L.side === "buy";
  return `<span class="lim-line" title="${esc(raw ? tip : `Для маржи ${mm}% ${L.auto ? L.auto.why : ""}: от какой цены продавать свои блоки после переработки`)}">${pre} <b>${fmt(L.lim)}</b>${L.own ? " (свой)" : ""}${isFinite(L.be) ? ` · безубыток ${fmt(L.be)}` : ""}${raw ? ` <button type="button" class="lim-edit" data-lim="${esc(id)}" aria-label="Задать свой лимит">✎</button>` : ""}</span>`;
}
const stoneDiv = (info) => (info && FAM[info.f].stone && info.kind === "raw" && info.e ? calcSettings(info.f).mult[info.e - 1] || 1 : 1);
const pa = (o) => o ? `<span class="pa${o.age > maxAge() ? " old" : ""}">${fmtAge(o.age)}</span>` : `<span class="pa"></span>`;
const cityRole = (c) => { const b = S.settings.buyC.includes(c), s = S.settings.sellC.includes(c); return b && !s ? "только покупка" : s && !b ? "только продажа" : ""; };
function renderPricesTable() {
  const groups = pricesGroups(), cities = activeCities(), tbl = $("p-table"), cards = $("p-cards");
  let h = `<thead><tr><th scope="col">Ресурс</th><th class="tagcol"></th>${cities.map((c) => `<th scope="col" class="cityh" style="color:${CITY_COLOR[c]}">${c}${cityRole(c) ? `<small>${cityRole(c)}</small>` : ""}</th>`).join("")}</tr></thead><tbody>`;
  let m = "", any = false;
  for (const g of groups) {
    if (!g.ids.length) continue;
    any = true;
    if (groups.length > 1) {
      h += `<tr class="group"><td colspan="${cities.length + 2}">${FAM[g.f].tab}<span>бонусный город: ${FAM[g.f].city}</span></td></tr>`;
      m += `<div class="k">${FAM[g.f].tab} · бонусный город ${FAM[g.f].city}</div>`;
    }
    let prevT = null; // новый тир внутри ресурса — линия-разделитель цвета тира
    for (const id of g.ids) {
      const info = parseId(id), rec = cur[`${S.settings.server}|${id}`];
      const tNew = info.t !== prevT, tStart = prevT !== null && tNew; prevT = info.t;
      if (tNew) m += `<div class="k tdiv" style="--tc:var(--t${info.t})">T${info.t}</div>`;
      const { q, bestS, bestB } = cityQuotes(id, cities);
      const sel = id === S.pItem ? " sel" : "";
      const ll = limitLine(id), L = limitOf(id), M = marginModel(id, L);
      const head = `<div class="item">${icon(id, 40)}<div class="iname"><b>${esc(info.name)}${favBtn(id, true)}</b><small>${info.kind === "raw" ? "сырьё" : "материал"}${stoneDiv(info) > 1 ? ` · 1 шт. = ${nf1.format(stoneDiv(info))} обычных` : ""}</small>${ll}</div></div>`;
      const dv = stoneDiv(info);
      h += `<tr tabindex="0" data-id="${esc(id)}" class="${sel}${tStart ? " tstart" : ""}"${tStart ? ` style="--tc:var(--t${info.t})"` : ""}><td>${head}</td><td class="tagcol"><div class="tags"><span class="ptag s">продают</span><span class="ptag b">покупают</span></div></td>`;
      m += `<section class="panel card${sel}" tabindex="0" data-id="${esc(id)}"><div class="card-h">${head.replace('<div class="item">', "").replace(/<\/div>$/, "")}</div>`
        + (rec ? `<div class="m-city m-headrow"><span></span><span class="ptag s">продают</span><span class="ptag b">покупают</span></div>` : "");
      for (const c of cities) {
        const { s, b } = q[c];
        if (!rec) { h += `<td><span class="empty">…</span></td>`; continue; }
        // лучшая цена подсвечивается только там, где эта сторона сделки разрешена в «Условиях»
        const ord = S.pMode === "order", inB = S.settings.buyC.includes(c), inS = S.settings.sellC.includes(c);
        const bs = s && s.p === bestS && s.age <= maxAge() && (ord ? inS : inB), bb = b && b.p === bestB && b.age <= maxAge() && (ord ? inB : inS);
        h += `<td><div class="cell">${pv(s, "s", bs, dv, M, c)}${pa(s)}${pv(b, "b", bb, dv, M, c)}${pa(b)}</div></td>`;
        if (s || b) m += `<div class="m-city">${cityHtml(c)}<span class="m-v">${pv(s, "s", bs, dv, M, c)}${pa(s)}</span><span class="m-v">${pv(b, "b", bb, dv, M, c)}${pa(b)}</span></div>`;
      }
      if (!rec) m += `<div class="m-line"><span class="k">Загружаю…</span></div>`;
      else if (cities.every((c) => !q[c].s && !q[c].b)) m += `<div class="m-line"><span class="k">Нет цен ни в одном городе</span></div>`;
      h += "</tr>"; m += "</section>";
    }
  }
  if (!any) {
    const msg = "Для такого фильтра предметов нет. Зачарованные ресурсы бывают только с T4, у камня нет зачарованных блоков.";
    h += `<tr><td class="msg" colspan="${cities.length + 2}">${msg}</td></tr>`;
    m = `<div class="panel card"><span class="k">${msg}</span></div>`;
  }
  tbl.innerHTML = h + "</tbody>";
  cards.innerHTML = m;
  const pick = (el) => {
    const again = S.pItem === el.dataset.id;
    S.pItem = again ? null : el.dataset.id; arbItem = S.pItem; save(); renderPricesTable(); openSelected();
    if (again) return;
    if (isMobile()) $("p-widgets").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  rowNav(tbl, "tbody tr[data-id]", pick);
  // свой лимит: ✎ у названия предмета
  [tbl, cards].forEach((root) => root.querySelectorAll("[data-lim]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = b.dataset.lim, p = parseId(id), L = limitOf(id), A = autoLimit(id);
    const what = p.kind === "raw" ? "покупаю не дороже" : "продаю не дешевле";
    const v = window.prompt(`${itemLabel(id)}: ${what} (пусто — считать автоматически${A ? `, сейчас расчёт ${fmt(A.lim)}` : ""})`, L && L.own ? String(L.lim) : "");
    if (v === null) return;
    S.limits = { ...(S.limits || {}) };
    const n = num(String(v).replace(/\s/g, "").replace(",", "."));
    if (isFinite(n) && n > 0) S.limits[id] = n; else delete S.limits[id];
    save(); renderPricesTable();
  })));
  rowNav(cards, ".card[data-id]", pick);
  fitMargins();
}
// маржа рядом с ценой — только если таблица влезает по ширине; иначе она остаётся в подсказке
function fitMargins() {
  const tbl = $("p-table"), box = tbl.parentElement;
  tbl.classList.remove("pm-off", "tight");
  if (!box.offsetParent) return;
  const over = () => box.scrollWidth > box.clientWidth + 1;
  if (over()) tbl.classList.add("tight");
  if (over()) tbl.classList.add("pm-off");
}
let fitTimer;
window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (S.view === "prices") fitMargins(); }, 150); });
function listingFee() { const f = +S.settings.fee; return (f === 0.04 ? 0.065 : f === 0.08 ? 0.105 : f) + SETUP * relists(); }
function renderPricesWidgets() {
  const box = $("p-widgets"), ids = pricesIds();
  const chosen = S.pItem && ids.includes(S.pItem) ? S.pItem : null;
  // ничего не выбрано — слева предмет из лучшей перепродажи, иначе первый предмет с ценами
  const id = chosen || (bestRoutes()[0] || {}).id || ids.find((x) => { const r = cur[`${S.settings.server}|${x}`]; return r && Object.keys(r.cities).length; });
  if (!id) { box.innerHTML = `<div class="panel widget span2"><p class="w-empty">${pending > 0 ? "Загружаю цены…" : "Для этого фильтра нет цен."}</p></div>`; return; }
  const info = parseId(id), cities = activeCities();
  const { q } = cityQuotes(id, cities);
  const order = S.pMode === "order";
  let lo = null, hi = null;
  for (const c of cities) {
    const s = q[c].s, b = q[c].b;
    const buySide = order ? b : s, sellSide = order ? s : b;
    if (S.settings.buyC.includes(c) && buySide && !buySide.odd && buySide.age <= maxAge() && (!lo || buySide.p < lo.p)) lo = { ...buySide, city: c };
    if (S.settings.sellC.includes(c) && sellSide && !sellSide.odd && sellSide.age <= maxAge() && (!hi || sellSide.p > hi.p)) hi = { ...sellSide, city: c };
  }
  const ser = series7(id);
  const dv = stoneDiv(info);
  const quote = (title, o, color, what) => `<div class="inset"><div class="k">${title}</div>`
    + (o ? `<div class="bigv" style="color:${color}">${fmt(o.p)}${dv > 1 ? ` <span class="eq" style="font-size:15px">(.0 — ${fmt(o.p / dv)})</span>` : ""}</div><div>${cityHtml(o.city)} <span class="k">${what}, ${fmtAge(o.age)} назад</span></div>` : `<div class="bigv empty">—</div><div class="k">нет свежих цен</div>`) + `</div>`;
  let w1 = `<div class="panel widget sel-w">
    <div class="item">${icon(id, 52)}<div class="iname" style="flex:1"><span class="k">${chosen ? "Выбрано в таблице" : "Из лучшей перепродажи · нажми на строку, чтобы выбрать"}</span><b style="font-size:20px">${esc(info.name)}</b></div>
      ${ser ? `<div class="tl-v">${spark(ser.vals, 120, 34)}<span class="k">${fmtPct(ser.delta, true)} за 7 дней</span></div>` : ""}</div>
    <div class="pair">${order ? quote("Купить своим ордером дешевле всего", lo, "var(--good)", "лучший ордер сейчас") + quote("Продать своим лотом дороже всего", hi, "var(--bad)", "самый дешёвый лот сейчас")
      : quote("Купить сразу дешевле всего", lo, "var(--bad)", "лот") + quote("Продать сразу дороже всего", hi, "var(--good)", "ордер")}</div></div>`;

  box.innerHTML = w1 + arbWidget();
  box.querySelectorAll("[data-arb]").forEach((el) => el.addEventListener("click", () => {
    const v = el.dataset.arb;
    if (v === "best") { arbItem = null; S.pItem = null; } else { arbItem = v; S.pItem = v; }
    save(); renderPricesTable(); openSelected();
  }));
}
// перепродажа: купить лот в одном городе, выставить свой лот в другом
let arbItem = null; // null — лучший маршрут среди показанных; иначе — для выбранного предмета
const ARB_MIN_VOL = 100;
function routesFor(id) {
  const cities = activeCities(), { q } = cityQuotes(id, cities), fee = listingFee(), out = [];
  for (const a of buyCities()) for (const b of sellCities()) {
    if (a === b) continue;
    const sa = q[a].s, sb = q[b].s;
    if (!sa || !sb || sa.odd || sb.odd || sa.age > maxAge() || sb.age > maxAge()) continue;
    const hs = histStats(id, b), ref = refStats(id, b);
    if (oddPrice(id, a, "buy", sa.p) && sa.p < (ref ? ref.med : 0) * 0.5) continue; // подозрительно дешёвый лот — скорее всего, пара штук
    const sell = ref ? Math.min(sb.p, ref.p80) : sb.p; // как в «Переработке»: продажа не дороже P80 за неделю
    const net = sell * (1 - fee) - sa.p;
    out.push({ id, a, b, buy: sa.p, sell, net, pct: net / sa.p, vol: hs ? hs.vol : NaN, capped: sell < sb.p });
  }
  return out.sort((x, y) => y.pct - x.pct);
}
// лучший маршрут по каждому предмету из таблицы; только где в городе продажи покупают хотя бы ARB_MIN_VOL в день
function bestRoutes() {
  const best = [];
  for (const id of pricesIds()) {
    const r = routesFor(id).find((x) => x.net > 0 && x.vol >= ARB_MIN_VOL);
    if (r) best.push(r);
  }
  return best.sort((x, y) => y.pct - x.pct);
}
function arbWidget() {
  const fee = listingFee();
  const sq = (c, label, price) => `<div class="sq${CITY_IMG.has(c) ? " bg-" + c.replace(/\s/g, "") : ""}" style="--cc:${CITY_COLOR[c]}"><small>${label}</small><b>${esc(c)}</b><span>${fmt(price)}</span></div>`;
  const big = (r) => `<div class="arb">${sq(r.a, "Купи в", r.buy)}<svg class="arrow" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 14h18M16 7l7 7-7 7"/></svg>${sq(r.b, "Выставь лот в", r.sell)}
      <div class="arb-info"><div class="arb-pct ${r.net > 0 ? "pos" : "neg"}">${fmtPct(r.pct, true)}</div>
      <div style="font-weight:600">${fmtSigned(r.net)} с 1 шт.</div><div class="k">${fmtBig(r.net * STACK)} за стак</div>
      ${isFinite(r.vol) ? `<div class="k">в ${esc(r.b)} ~${nf0.format(r.vol)} в день</div>` : ""}</div></div>`;
  const head = (title, extra = "") => `<div class="w-head"><span class="k">${title}</span><span class="k">${extra || `после налога ${fmtPct(fee)}, за 1 шт.`}</span></div>`;
  if (arbItem && pricesIds().includes(arbItem)) {
    const id = arbItem, routes = routesFor(id);
    let h = `<div class="panel widget">${head(`Перепродажа: ${esc(itemLabel(id))}`, `<button type="button" class="linkbtn" data-arb="best">✕ снять выбор</button>`)}`;
    if (!routes.length) return h + `<p class="w-empty">Нужны свежие лоты хотя бы в двух городах.</p></div>`;
    h += big(routes[0]);
    if (routes[0].net <= 0) h += `<p class="w-empty">Сейчас перепродажа этого предмета не окупается: показан наименее убыточный маршрут.</p>`;
    const more = routes.slice(1, 4).filter((x) => x.net > 0);
    if (more.length) h += `<div class="routes"><span>Ещё маршруты:</span>${more.map((x) => `<span>${cityHtml(x.a)} → ${cityHtml(x.b)} <b class="pos">${fmtPct(x.pct, true)}</b></span>`).join("")}</div>`;
    return h + `</div>`;
  }
  const best = bestRoutes();
  let h = `<div class="panel widget">${head("Лучшая перепродажа между городами", `среди показанных, налог ${fmtPct(fee)}`)}`;
  if (!best.length) return h + `<p class="w-empty">${pending > 0 ? "Считаю маршруты…" : "Среди показанных в таблице сейчас нет выгодных маршрутов с заметным объёмом продаж."}</p></div>`;
  const r = best[0];
  h += `<button type="button" class="arb-item" data-arb="${esc(r.id)}">${icon(r.id, 34)}<b>${esc(itemLabel(r.id))}</b><span class="k">подробнее →</span></button>` + big(r);
  if (best.length > 1) h += `<div class="routes routes-list">${best.slice(1, 4).map((x) => `<button type="button" class="route" data-arb="${esc(x.id)}">${icon(x.id, 26)}<span class="rn">${esc(itemLabel(x.id))}</span><span>${cityHtml(x.a)} → ${cityHtml(x.b)}</span><b class="pos">${fmtPct(x.pct, true)}</b></button>`).join("")}</div>`;
  return h + `</div>`;
}
async function openSelected() {
  renderPricesWidgets();
  if (S.pItem) { await ensure([S.pItem], { history: true }); if (S.view === "prices") renderPricesWidgets(); }
}
async function openPrices(force = false) {
  arbItem = S.pItem; // виджет перепродажи всегда про выбранную строку, а без выбора — про лучший маршрут
  renderPricesControls(); renderPricesTable(); renderPricesWidgets();
  await ensure(pricesIds(), { history: false, force });
  if (S.view !== "prices") return;
  const ids = pricesIds();
  if (S.pItem && !ids.includes(S.pItem)) S.pItem = null; // выбор сбрасывается, только если предмет пропал из фильтра
  if (arbItem && !ids.includes(arbItem)) arbItem = null;
  renderPricesControls(); renderPricesTable();
  await openSelected();
  await ensure([...ids, ...limitIds(ids)], { history: true });
  if (S.view === "prices") { renderPricesTable(); renderPricesWidgets(); } // с историей видно, какие цены нереальные
}

// ---------- вкладка «Переработка» ----------
// у камня зачарованных блоков нет: зачарованный камень сам подбирается в строке .0
const refineEnchs = (f) => (FAM[f].stone ? (S.rEnchs.includes(0) ? [0] : []) : S.rEnchs);
function refineIds() {
  const out = [];
  for (const f of S.rFams) for (const t of S.rTiers) for (const e of refineEnchs(f)) {
    if (FAM[f].stone) for (let k = 0; k <= 3; k++) out.push(rawId(f, t, k), rawId(f, t - 1, k));
    else out.push(rawId(f, t, e), rawId(f, t - 1, e));
    out.push(matId(f, t - 1, e), matId(f, t, e), matId(f, t - 2, e)); // тир ниже и два тира ниже — для «сделать самому»
  }
  return [...new Set(out)];
}
// себестоимость материала, если сделать его самому из рыночного сырья (для сравнения с покупкой)
function ownCost(f, t, e) {
  if (t < 3) return null;
  const c = calcSettings(f), raw = pickRaw(f, t, e), prev = pickBuy(matId(f, t - 1, e));
  if (!raw || !prev) return null;
  return { cost: economics(t, raw.paid, prev.paid, 1, { ...c, bf: 1 }, e).cost, raw, prev };
}
const OWN_BETTER = 0.03;
function refineAll() {
  const rows = [];
  for (const f of S.rFams) for (const t of S.rTiers) for (const e of refineEnchs(f)) {
    const c = calcSettings(f);
    const raw = pickRaw(f, t, e), prev = pickBuy(matId(f, t - 1, e)), sell = pickSell(matId(f, t, e));
    const row = { f, t, e, c, raw, prev, sell, ok: !!(raw && prev && sell), id: matId(f, t, e) };
    if (row.ok) {
      Object.assign(row, economics(t, raw.paid, prev.paid, sell.price, { ...c, bf: 1 }, e));
      const own = ownCost(f, t - 1, e);
      if (own && own.cost < prev.paid * (1 - OWN_BETTER)) {
        row.own = { ...own, save: 1 - own.cost / prev.paid, profit: economics(t, raw.paid, own.cost, sell.price, { ...c, bf: 1 }, e).profit };
      }
    }
    rows.push(row);
  }
  return rows;
}
function refineRows(all) {
  const key = { margin: (r) => r.margin, stack: (r) => r.profit, tier: null }[S.rSort];
  const rows = [...all].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (!key || !a.ok) return FAMS.indexOf(a.f) - FAMS.indexOf(b.f) || a.t - b.t || a.e - b.e;
    return key(b) - key(a);
  });
  return S.rOnlyPlus ? rows.filter((r) => r.ok && r.profit > 0) : rows;
}
const SORTS = [["margin", "Маржа"], ["stack", "За стак"], ["tier", "По тиру"]];
function renderRefineControls() {
  famChips($("r-fam"), S.rFams, (v) => { S.rFams = v; save(); openRefine(); });
  chips($("r-tiers"), tierItems(REFINE_TIERS), (v) => S.rTiers.includes(v), (v) => { S.rTiers = toggleIn(S.rTiers, v, REFINE_TIERS); save(); openRefine(); }, tierCls);
  chips($("r-ench"), ENCH_ITEMS, (v) => S.rEnchs.includes(v), (v) => { S.rEnchs = toggleIn(S.rEnchs, v, ENCHS); save(); openRefine(); }, enchCls);
  chips($("r-sort"), SORTS, (v) => v === S.rSort, (v) => { S.rSort = v; save(); renderRefineControls(); renderRefine(); });
  const sm = $("r-sort-m");
  if (!sm.options.length) SORTS.forEach(([v, l]) => sm.add(new Option(l, v)));
  sm.value = S.rSort;
  $("r-onlyplus").checked = S.rOnlyPlus;
  const parts = [famsText(S.rFams), tiersText(S.rTiers)];
  if (S.rEnchs.join() !== "0") parts.push(S.rEnchs.map((e) => "." + e).join(" "));
  if (S.rOnlyPlus) parts.push("в плюсе");
  $("r-fsum").textContent = parts.join(" · ");
  const cnt = (S.rFams.length !== FAMS.length) + (S.rTiers.length !== REFINE_TIERS.length) + (S.rEnchs.join() !== "0") + (S.rOnlyPlus ? 1 : 0);
  $("r-fcount").textContent = cnt || "";
}
// у зачарованного камня камня в рецепте столько же, а блоков тира ниже и блоков на выходе — в 2/4/8 раз больше
const stoneK = (r) => (r.raw && FAM[r.f].stone ? r.raw.ench || 0 : 0);
const stoneMult = (r) => { const k = stoneK(r); return k ? calcSettings(r.f).mult[k - 1] : 1; };
function recipeText(r) {
  const k = stoneK(r), m = stoneMult(r);
  if (!k) return `${itemLabel(rawId(r.f, r.t, r.e))} ×${N[r.t]} + ${itemLabel(matId(r.f, r.t - 1, r.e))}`;
  return `${itemLabel(rawId(r.f, r.t, k))} ×${N[r.t]} + ${itemLabel(matId(r.f, r.t - 1))} ×${nf1.format(m)} → ${nf1.format(m)} шт.`;
}
function rawUnitText(r) { return stoneK(r) ? `${lc1(itemLabel(rawId(r.f, r.t, stoneK(r))))}, на обычный ${fmt(r.raw.price)}` : ""; }
function lowNote(o, id) {
  return o && o.src === "low" ? `Лот ${lc1(itemLabel(id))} в ${o.city} (${fmt(o.live)}) заметно дешевле обычной цены там (${fmt(o.med)}). Возможно, по такой цене выставлено мало, поэтому в расчёте взято ${fmt(o.price)}.` : "";
}
function whereCell(o, extra = "", price, lowId) {
  if (!o) return `<td><span class="empty">нет цены</span></td>`;
  const tag = o.src === "hist" ? `<span class="tag" title="Свежего лота нет, взята медиана за 7 дней">история</span>` : o.src === "cap" ? `<span class="tag" title="Лот дороже обычного, взят P80 за 7 дней">P80</span>`
    : o.src === "low" ? `<span class="tag" title="${esc(lowNote(o, lowId || ""))}">дёшево?</span>`
    : o.src === "order" ? `<span class="tag ord" title="Цена своего ордера на закупку: лучший ордер в городе +1, плюс 2,5% комиссии. Ордер исполняется не сразу">ордер</span>` : "";
  if (o.src === "order" && !extra) extra = isFinite(o.vol) ? `продаётся ~${nf0.format(o.vol)} в день` : "объём продаж неизвестен";
  return `<td><span class="v">${fmt(price ?? o.price)}</span>${tag}<div class="where">${cityHtml(o.city)}<span class="age">${o.age !== undefined ? fmtAge(o.age) : ""}</span></div>${extra ? `<small>${extra}</small>` : ""}</td>`;
}
function liqHtml(vol) {
  const l = liquidity(vol);
  return `<span class="liq ${l.cls}" title="${esc(l.txt)}">${isFinite(vol) ? nf0.format(vol) + " в день" : "продажи неизвестны"}</span>`;
}
function marginBar(r, target) {
  const col = levelColor(r.margin, r.profit, target), w = Math.max(6, Math.min(100, Math.abs(r.margin) / 0.3 * 100));
  return `<div class="mcell"><span class="mbar"><i style="width:${w}%;background:linear-gradient(90deg,var(--accent),${col})"></i></span><span class="mval" style="color:${col}">${nf0.format(r.margin * 100)}%</span></div>`;
}
function renderRefineWidgets(all) {
  const plus = all.filter((r) => r.ok && r.profit > 0);
  const byMargin = [...plus].sort((a, b) => b.margin - a.margin), byStack = [...plus].sort((a, b) => b.profit - a.profit);
  const box = $("r-widgets");
  if (!plus.length) {
    const loading = all.length && all.every((r) => !r.ok) && pending > 0;
    box.innerHTML = `<div class="panel widget best span2"><div class="w-head"><span class="k">Лучшее прямо сейчас</span></div><p class="w-empty">${loading ? "Загружаю цены…" : "При этих условиях сейчас ничего не выходит в плюс. Попробуй другие тиры, ресурсы или фокус в условиях."}</p></div>`;
    return;
  }
  const b = byMargin[0], c = b.c, rawName = itemLabel(rawId(b.f, b.t, b.raw.ench && FAM[b.f].stone ? b.raw.ench : b.e));
  const line = (lbl, o, val, cls = "") => `<div class="b-line"><span class="b-lbl">${lbl}</span><span class="b-where">${o ? cityHtml(o.city) + `<span class="age">${srcAge(o)}</span>` : ""}</span><b class="b-val ${cls}">${val}</b></div>`;
  const liq = liquidity(b.sell.vol);
  let h = `<div class="panel widget best span2" style="--tc:var(--t${b.t})">
    <div class="w-head"><span class="k">Лучшее прямо сейчас</span><span class="k">по марже${c.bonus ? ", с бонусом дня" : ""}</span></div>
    <div class="b-head">${icon(b.id, 64)}<div class="b-txt"><div class="b-title">${esc(itemLabel(b.id))}</div><div class="b-recipe">${esc(recipeText(b))}</div></div><div class="b-pct">${nf0.format(b.margin * 100)}%</div></div>
    <div class="b-list inset">
      ${line(`${b.raw.src === "order" ? "Ордер на" : "Купи"} ${esc(lc1(rawName))}, ${N[b.t]} на крафт`, b.raw, fmt(b.raw.unit))}
      ${line(`${b.prev.src === "order" ? "Ордер на" : "Купи"} ${esc(lc1(itemLabel(matId(b.f, b.t - 1, b.e))))}, ${nf1.format(stoneMult(b))} на крафт`, b.prev, fmt(b.prev.price))}
      ${line(`Продай ${esc(lc1(itemLabel(b.id)))}`, b.sell, fmt(b.sell.price))}
      <div class="b-line"><span class="b-lbl">Прибыль за стак 999</span><span class="b-where"><span class="liq ${liq.cls}" title="${esc(liq.txt)}">${isFinite(b.sell.vol) ? "продаётся " + nf0.format(b.sell.vol) + " в день" : "объём продаж неизвестен"}</span></span><b class="b-val pos">${fmtBig(b.profit * STACK)}</b></div>
    </div>${[lowNote(b.raw, rawId(b.f, b.t, stoneK(b) || b.e)), lowNote(b.prev, matId(b.f, b.t - 1, b.e))].filter(Boolean).map((t) => `<p class="k" style="margin:0;color:var(--warn)">Осторожно: ${esc(t)}</p>`).join("")}</div>`;
  const tops = {
    margin: { rows: byMargin, val: (r) => nf0.format(r.margin * 100) + "%", sub: (r) => fmtBig(r.profit * STACK) + " за стак" },
    stack: { rows: byStack, val: (r) => fmtBig(r.profit * STACK), sub: (r) => "маржа " + nf0.format(r.margin * 100) + "%" },
    focus: { rows: all.map((r) => ({ r, f: focusInfo(r) })).filter((x) => x.f && x.f.profit > 0).sort((a, b) => b.f.perPoint - a.f.perPoint).map((x) => ({ ...x.r, fi: x.f })),
      val: (r) => `${fmt(r.fi.perPoint)} за очко`, sub: (r) => `${fmtBig(r.fi.profit * STACK)} за стак` },
  };
  const tp = tops[S.rTop] ? S.rTop : "margin", cur = tops[tp];
  const already = S.settings.rrr === "0.539" || S.settings.rrr === "0.435";
  h += `<div class="panel widget span2 tops"><div class="w-head"><div class="seg" role="group" aria-label="Список">${[["margin", "По марже"], ["stack", "За стак"], ["focus", "На фокус"]].map(([v, l]) => `<button type="button" data-top="${v}" aria-pressed="${v === tp}">${l}</button>`).join("")}</div>`
    + `<span class="k">${tp === "focus" ? "серебра на 1 очко фокуса, без учёта специализации" : ""}</span></div>`
    + (tp === "focus" && already ? `<p class="w-empty">В «Условиях» уже выбран возврат с фокусом. Чтобы сравнить, выбери возврат без фокуса: тогда видно, сколько добавляет фокус.</p>`
      : !cur.rows.length ? `<p class="w-empty">Пока нечего показать.</p>`
      : `<div class="tl">${cur.rows.slice(0, 5).map((r) => `<button type="button" class="tl-row" data-key="${rowKey(r)}">${icon(r.id, 38)}<span class="tl-name">${esc(itemLabel(r.id))}</span><span class="tl-v"><b class="pos">${cur.val(r)}</b><span class="age">${cur.sub(r)}</span></span></button>`).join("")}</div>`)
    + `</div>`;
  box.innerHTML = h;
  box.querySelectorAll("[data-top]").forEach((b) => b.addEventListener("click", () => { S.rTop = b.dataset.top; save(); renderRefineWidgets(all); }));
  box.querySelectorAll(".tl-row").forEach((el) => el.addEventListener("click", () => openRow(el.dataset.key)));
}
// раскрыть строку таблицы и прокрутить к ней
function openRow(key) {
  rOpen.add(key); renderRefine();
  const el = document.querySelector(`${isMobile() ? "#r-cards .card" : "#r-table tr.rrow"}[data-key="${key}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}
// фокус: сколько серебра даёт 1 очко. Фокус поднимает бонус производства на 59%;
// очки тратятся на каждый крафт, включая перекрафт возврата, поэтому на 1 шт. выхода уходит F / (шт. за крафт)
const FOCUS = { 3: 31, 4: 54, 5: 94, 6: 164, 7: 287, 8: 503, 9: 880, 10: 1539, 11: 2694, 12: 4714 };
function focusInfo(r) {
  if (!r.ok) return null;
  const c = r.c, pb = 1 / c.k - 1, kf = 1 / (1 + pb + 0.59);
  const inputs = N[r.t] * r.raw.paid + r.prev.paid, m = stoneMult(r);
  const F = FOCUS[FAM[r.f].stone ? r.t : r.t + r.e] || 0, perOut = F / m;
  const costF = inputs * kf + stationFee(r.t, r.e, c), gain = inputs * (c.k - kf);
  return { kf, rf: 1 - kf, costF, profit: r.effSell - costF, gain, perOut, perPoint: perOut ? gain / perOut : NaN, stackFocus: perOut * STACK };
}
function goCalc(f, t, key) {
  S.cFam = f; if (!S.cTiers.includes(t)) S.cTiers = toggleIn(S.cTiers, t, REFINE_TIERS);
  fillCalcFromMarket(f);
  // свой вариант из «Переработки» переносим как есть; «Пороги» считают только .0, кроме камня
  const base = key && rPick.has(key) ? refineAll().find((x) => rowKey(x) === key) : null;
  const r = base && applyPick(base);
  if (r && r.custom && (r.e === 0 || FAM[f].stone)) {
    const c = calcSettings(f), P = S.calc[f][t], tag = "выбрано в «Переработке»";
    const how = (o) => (o.src === "order" ? "свой ордер" : "лот") + (c.bf !== 1 && o.fee === 1 ? `, ${fmt(o.paid)} за шт.` : "");
    P.note = { ...(P.note || {}) };
    // в «Порогах» комиссия ордера берётся из условий, поэтому переносим цену так, чтобы итог с комиссией совпал
    if (r.raw) { P.raw = Math.round(r.raw.paid / c.bf); P.note.raw = `${tag}: ${r.raw.city}, ${how(r.raw)}${r.raw.ench ? `, камень .${r.raw.ench} по ${fmt(r.raw.unit)}` : ""}`; }
    if (r.prev) { P.own = false; P.prev = Math.round(r.prev.paid / c.bf); P.note.prev = r.prev.src === "own" ? `${tag}: свой крафт, себестоимость ${fmt(r.prev.paid)}` : `${tag}: ${r.prev.city}, ${how(r.prev)}`; }
    if (r.sell) { P.sell = Math.round(r.sell.price); P.note.sell = `${tag}: ${r.sell.city}`; }
  }
  save(); location.hash = "calc";
}
// раскрытые строки таблицы (живут, пока открыта страница)
const rOpen = new Set();
const rowKey = (r) => `${r.f}-${r.t}-${r.e}`;
function srcText(o) {
  if (!o) return "";
  const age = o.age !== undefined ? `, ${fmtAge(o.age)} назад` : "";
  if (o.src === "order") return `свой ордер: лучший ордер +1${age}`;
  if (o.src === "low") return `лот ${fmt(o.live)} подозрительно дешёвый, взята цена P20 за 7 дней`;
  if (o.src === "hist") return "свежего лота нет, медиана за 7 дней";
  if (o.src === "cap") return `лот дороже обычного, взята P80 за 7 дней${age}`;
  return `самый дешёвый лот${age}`;
}
// короткая ячейка цены: число + метка, под ним «город · возраст»
function priceCell(o, price, extra = "", tag2 = "") {
  if (!o) return `<td><span class="empty">нет цены</span></td>`;
  const tag = o.src === "order" ? `<span class="tag ord">ордер</span>` : o.src === "hist" ? `<span class="tag">история</span>` : o.src === "cap" ? `<span class="tag">P80</span>` : o.src === "low" ? `<span class="tag">дёшево?</span>` : "";
  return `<td>${tag2}<span class="v">${fmt(price ?? o.price)}</span>${tag}<div class="where">${extra}${cityHtml(o.city)}<span class="age">${o.age !== undefined ? (o.manual ? "★ " : "") + fmtAge(o.age) : srcAge(o)}</span></div></td>`;
}
const liqDot = (vol) => { const l = liquidity(vol); return `<span class="liq ${l.cls}" title="${esc(l.txt)}"></span>`; };
// короткая подпись источника цены: «Martlock · ордер · <1 ч · ~70 556 в день»
function metaLine(o, withVol = true) {
  if (!o) return "";
  const lbl = { order: "ордер", live: "лот", hist: "медиана 7 д", cap: "P80", low: "дёшево? взята P20" }[o.src] || "";
  const parts = [cityHtml(o.city), lbl, o.age !== undefined ? fmtAge(o.age) : ""];
  if (withVol && o.src === "order" && isFinite(o.vol)) parts.push(`~${nf0.format(o.vol)} в день`);
  return parts.filter(Boolean).join(" · ");
}
// ---------- свой вариант в деталях строки ----------
// город и способ закупки, вариант камня, город продажи. Живёт, пока открыта страница и не обновлены цены
const rPick = new Map();
const howOf = (o) => (o && o.src === "order" ? "order" : "lot");
// свой ордер в городе: лучший ордер +1 и комиссия. Подозрительно низкий ордер не прячем, а помечаем
function orderIn(id, city) {
  if (S.settings.mode === "hist") return null;
  const b = liveOf(id, city, "buy");
  if (!b || b.age > maxAge()) return null;
  const hs = histStats(id, city);
  return { price: b.p + 1, city, src: "order", age: b.age, vol: hs ? hs.vol : NaN, fee: orderFee(), odd: !b.manual && !!oddPrice(id, city, "buy", b.p), manual: b.manual };
}
function quoteBuy(id, city, how) {
  let o;
  if (how === "order") o = orderIn(id, city);
  else { const l = lotIn(id, city); o = l && { ...l, fee: 1 }; }
  if (o) o.paid = o.price * o.fee;
  return o;
}
// сырьё в городе; у камня цена приводится к обычному камню
function rawQuote(f, t, e, k, city, how) {
  const stone = FAM[f].stone, o = quoteBuy(rawId(f, t, stone ? k : e), city, how); if (!o) return null;
  const m = stone && k ? calcSettings(f).mult[k - 1] : 1;
  return { ...o, price: o.price / m, paid: o.paid / m, unit: o.price, ench: stone ? k : e };
}
function cheapest(fn) {
  let best = null;
  for (const c of buyCities()) { const o = fn(c); if (o && !o.odd && (!best || o.paid < best.paid)) best = o; }
  return best;
}
// строка с учётом выбора; без выбора — как есть
function applyPick(r) {
  const p = rPick.get(rowKey(r)); if (!p) return r;
  const { f, t, e } = r, c = r.c;
  let raw = r.raw, prev = r.prev, sell = r.sell;
  if (p.rawK !== undefined || p.rawHow || p.rawCity) {
    const k = p.rawK ?? stoneK(r), how = p.rawHow || howOf(r.raw);
    raw = (p.rawCity && rawQuote(f, t, e, k, p.rawCity, how)) || cheapest((cc) => rawQuote(f, t, e, k, cc, how));
  }
  let own = null;
  if (p.prevOwn) {
    own = ownCost(f, t - 1, e);
    prev = own && { src: "own", price: own.cost, paid: own.cost, fee: 1, city: "" };
  } else if (p.prevHow || p.prevCity) {
    const id = matId(f, t - 1, e), how = p.prevHow || howOf(r.prev);
    prev = (p.prevCity && quoteBuy(id, p.prevCity, how)) || cheapest((cc) => quoteBuy(id, cc, how));
  }
  if (p.sellCity) sell = sellIn(r.id, p.sellCity);
  const row = { ...r, raw, prev, sell, ok: !!(raw && prev && sell), custom: true, best: r, picked: p };
  if (row.ok) {
    Object.assign(row, economics(t, raw.paid, prev.paid, sell.price, { ...c, bf: 1 }, e));
    if (r.own && !p.prevOwn) row.own = { ...r.own, profit: economics(t, raw.paid, r.own.cost, sell.price, { ...c, bf: 1 }, e).profit };
    if (p.prevOwn) row.own = null;
  } else Object.assign(row, { profit: NaN, margin: NaN, cost: NaN });
  return row;
}
function setPick(key, patch) {
  const p = { ...(rPick.get(key) || {}), ...patch };
  for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
  if (Object.keys(p).length) rPick.set(key, p); else rPick.delete(key);
  renderRefine();
}
const pickBtn = (attrs, on, inner, cls = "var", title = "") => `<button type="button" class="${cls}${on ? " on" : ""}" ${attrs} aria-pressed="${on}"${title ? ` title="${esc(title)}"` : ""}>${inner}</button>`;
function howSeg(kind, how, withOwn = false, own = false) {
  const b = (v, l, on, title = "") => `<button type="button" data-pick="${kind}How" data-v="${v}" aria-pressed="${on}"${title ? ` title="${title}"` : ""}>${l}</button>`;
  return `<span class="seg pseg">${b("order", "ордер", !own && how === "order", "Свой ордер: лучший ордер +1, комиссия 2,5%. Исполняется не сразу")}${b("lot", "лот", !own && how === "lot", "Купить сразу по самому дешёвому лоту")}${withOwn ? b("own", "свой крафт", own, "Сделать самому из рыночного сырья тира ниже") : ""}</span>`;
}
// города для закупки: цена за штуку, выбранный подсвечен, самые дешёвые первыми
function cityPicks(kind, quotes, cur) {
  const list = quotes.filter((x) => x.o).sort((a, b) => a.o.paid - b.o.paid);
  if (!list.length) return `<p class="dn">Нет цен ни в одном городе.</p>`;
  return `<div class="vars cpick">${list.map(({ c, o }) => pickBtn(`data-pick="${kind}City" data-v="${esc(c)}"`, cur && cur.city === c,
    `${cityBadge(c)}<span class="${o.odd ? "odd" : ""}">${fmt(o.unit ?? o.price)}</span>`, "var cv",
    o.odd ? "Не похоже на реальную цену: ордер сильно ниже обычного. Можно выбрать, но расчёт будет неточным" : `${c}: ${o.src === "order" ? "свой ордер" : "лот"} ${fmt(o.unit ?? o.price)}${o.fee > 1 ? " + комиссия" : ""}`)).join("")}</div>`;
}
// варианты камня: цена за штуку и (в скобках) в пересчёте на обычный; клик — считать этим камнем
function stoneVariants(r) {
  const m = calcSettings(r.f).mult, k0 = stoneK(r), how = howOf(r.raw);
  return [0, 1, 2, 3].map((k) => {
    const o = cheapest((c) => rawQuote(r.f, r.t, 0, k, c, how));
    const txt = !o ? `.${k} —` : k ? `.${k} ${fmt(o.unit)} <span class="eq">(${fmt(o.unit / m[k - 1])})</span>` : `.0 ${fmt(o.unit)}`;
    return o ? pickBtn(`data-pick="rawK" data-v="${k}"`, k === k0 && !!r.raw, txt) : `<span class="var off">${txt}</span>`;
  }).join("");
}
function detHtml(r) {
  const c = r.c, kv = (k, v, cls = "") => `<div class="dl"><span>${k}</span><b class="${cls}">${v}</b></div>`;
  const k = stoneK(r), m = stoneMult(r), rawName = itemLabel(rawId(r.f, r.t, k || r.e)), prevName = itemLabel(matId(r.f, r.t - 1, r.e));
  const p = r.picked || {}, rawHow = p.rawHow || howOf(r.raw), prevOwn = !!p.prevOwn, prevHow = p.prevHow || howOf(r.prev);
  const rawK = p.rawK ?? k, prevId = matId(r.f, r.t - 1, r.e);
  const rawCities = buyCities().map((c) => ({ c, o: rawQuote(r.f, r.t, r.e, rawK, c, rawHow) }));
  const prevCities = buyCities().map((c) => ({ c, o: quoteBuy(prevId, c, prevHow) }));
  const oddWarn = (o) => (o && o.odd ? `<p class="dn warn-t">Цена ордера не похожа на реальную — расчёт может быть неточным.</p>` : "");
  let h = `<div class="det-grid" data-rk="${rowKey(r)}">`;
  if (r.custom) {
    const b = r.best;
    h += `<div class="pickbar"><span><b>Свой вариант.</b> ${b.ok ? `Лучший: маржа ${nf0.format(b.margin * 100)}%, ${fmtBig(b.profit * STACK)} за стак.` : ""}${r.ok && b.ok ? ` Разница <b class="${r.profit - b.profit >= 0 ? "pos" : "neg"}">${fmtBig((r.profit - b.profit) * STACK)}</b> за стак.` : ""}</span>`
      + `<button type="button" class="btn ghost" data-pick="reset">↺ К лучшему</button></div>`;
  }
  h += `<div class="det-b"><h4>Рецепт на 1 крафт</h4>`
    + kv(lnk(rawId(r.f, r.t, k || r.e), `${esc(rawName)} ×${N[r.t]}`), r.raw ? `${fmt(r.raw.unit)}${k ? ` <span class="eq">(.0 — ${fmt(r.raw.price)})</span>` : ""}` : "нет цены")
    + (r.raw ? `<p class="dn">${metaLine(r.raw)}</p>` : "") + oddWarn(r.raw)
    + (FAM[r.f].stone ? `<div class="vars" title="Цена за штуку, в скобках — в пересчёте на обычный камень: зачарованный даёт в 2/4/8 раз больше блоков. Нажми, чтобы считать этим камнем">${stoneVariants(r)}</div>` : "")
    + `<div class="pickrow">${howSeg("raw", rawHow)}</div>` + cityPicks("raw", rawCities, r.raw)
    + kv(lnk(prevId, `${esc(prevName)} ×${nf1.format(m)}`), r.prev ? fmt(r.prev.price) : "нет цены")
    + (r.prev ? `<p class="dn">${prevOwn ? `свой крафт по себестоимости` : metaLine(r.prev)}</p>` : "") + oddWarn(r.prev)
    + `<div class="pickrow">${howSeg("prev", prevHow, r.t > 3 && !!ownCost(r.f, r.t - 1, r.e), prevOwn)}</div>` + (prevOwn ? "" : cityPicks("prev", prevCities, r.prev))
    + (r.own ? `<div class="own-box"><div class="dl"><span>Сделать самому</span><b class="pos">${fmt(r.own.cost)} <span class="eq">(−${nf0.format(r.own.save * 100)}%)</span></b></div><p class="dn">${esc(itemLabel(rawId(r.f, r.t - 1, stoneK({ ...r, raw: r.own.raw }) || r.e)))} ×${N[r.t - 1]} по ${fmt(r.own.raw.unit)} + ${esc(itemLabel(matId(r.f, r.t - 2, r.e)))} ×${nf1.format(stoneMult({ ...r, raw: r.own.raw }))} по ${fmt(r.own.prev.price)}, с возвратом</p></div>` : "")
    + kv("На выходе", `${nf1.format(m)} шт.`) + `</div>`;
  if (r.ok) {
    const rawPart = N[r.t] * r.raw.paid, prevPart = r.prev.paid;
    const cls = r.profit >= 0 ? "pos" : "neg";
    h += whereSell(r) + shopList(r);
    h += `<div class="det-b"><h4>Деньги</h4>`
      + kv("Прибыль за 1 шт.", fmtSigned(r.profit), cls)
      + kv("Прибыль за стак 999", fmtBig(r.profit * STACK), cls)
      + kv("Маржа", nf0.format(r.margin * 100) + "%", cls)
      + kv("Себестоимость 1 шт.", fmt(r.cost))
      + `<p class="dn">(сырьё ${fmt(rawPart)} + тир ниже ${fmt(prevPart)}${r.raw.fee > 1 || r.prev.fee > 1 ? ", с комиссией ордера" : ""}) × (1 − возврат ${fmtPct(c.r)})${r.station ? ` + станция ${fmt(r.station)}` : ""}</p>`
      + kv("Вложить на стак", fmtBig(r.capital, false))
      + (r.own ? kv("Если тир ниже сделать самому", fmtBig(r.own.profit * STACK) + " за стак", "pos") : "")
      + focusKv(r)
      + `<button class="btn primary" type="button" data-calc="${r.f}" data-t="${r.t}" data-key="${rowKey(r)}">Открыть в «Порогах»</button></div>`;
  } else {
    h += `<div class="det-b"><h4>Не хватает цен</h4><p class="dn">Нет свежих цен на ${[!r.raw && "сырьё", !r.prev && "материал тира ниже", !r.sell && "продажу"].filter(Boolean).join(", ")}. Попробуй обновить цены или выбрать другие города в «Условиях».</p>`
      + `<button class="btn" type="button" data-calc="${r.f}" data-t="${r.t}">Открыть в «Порогах»</button></div>`;
  }
  return h + `</div>`;
}
const CHEV = `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;
function renderRefine() {
  const all = refineAll(), rows = refineRows(all).map(applyPick), c0 = calcSettings(), tbl = $("r-table"), cards = $("r-cards");
  renderRefineWidgets(all);
  $("r-show").textContent = `Показать ${rows.length} ${plural(rows.length, ["рецепт", "рецепта", "рецептов"])}`;
  let h = `<thead><tr><th scope="col">Что делаем</th><th scope="col">Сырьё</th><th scope="col">Тир ниже</th><th scope="col">Продажа</th><th scope="col" class="c-spark">7 дней</th><th scope="col">За 1 шт.</th><th scope="col">Маржа</th><th scope="col">За стак</th></tr></thead><tbody>`;
  let m = "";
  if (!rows.length) {
    const msg = S.rOnlyPlus ? "При этих условиях сейчас ничего не выходит в плюс." : !S.rEnchs.includes(0) && S.rFams.every((f) => FAM[f].stone) ? "У камня нет зачарованных блоков. Выбери другой ресурс или .0." : "Нет данных.";
    h += `<tr><td class="msg" colspan="8">${msg}</td></tr>`;
    m = `<div class="panel card"><span class="k">${msg}</span></div>`;
  }
  for (const r of rows) {
    const key = rowKey(r), open = rOpen.has(key);
    const name = esc(itemLabel(r.id)), recipe = esc(recipeText(r));
    const bonus = (r.c.bonus ? ` <span class="tag" title="Ежедневный бонус переработки">бонус</span>` : "") + (r.custom ? ` <span class="tag ord" title="Цены и города выбраны вручную в деталях. Сортировка — по лучшему варианту">свой вариант</span>` : "");
    h += `<tr tabindex="0" class="rrow${open ? " open" : ""}" data-key="${key}" aria-expanded="${open}"><td><div class="item">${CHEV}${icon(r.id, 40)}<div class="iname"><b>${name}${bonus}</b><small title="${recipe}">${recipe}</small></div>${favBtn(r.id)}</div></td>`;
    h += priceCell(r.raw, r.raw && r.raw.unit) + priceCell(r.prev, undefined, "", r.own ? `<span class="tag own" title="Сделать самому: ${fmt(r.own.cost)} вместо ${fmt(r.prev.paid)}">свой −${nf0.format(r.own.save * 100)}%</span>` : "") + priceCell(r.sell, undefined, r.sell ? liqDot(r.sell.vol) : "");
    const ser = r.sell ? series7(r.id, r.sell.city) : null;
    h += `<td class="c-spark">${ser ? spark(ser.vals) : `<span class="empty">—</span>`}</td>`;
    const cls = r.ok && r.profit >= 0 ? "pos" : "neg";
    h += r.ok ? `<td><b class="${cls}">${fmtSigned(r.profit)}</b></td><td>${marginBar(r, c0.m)}</td><td><b class="${cls}">${fmtBig(r.profit * STACK)}</b></td></tr>`
      : `<td colspan="3"><span class="empty">не хватает цен</span></td></tr>`;
    h += `<tr class="det"${open ? "" : " hidden"}><td colspan="8">${open ? detHtml(r) : ""}</td></tr>`;

    // карточка для телефона: коротко, детали — по нажатию
    const ln = (k, o, price, extra = "") => `<div class="m-line"><span class="k">${k}</span>${o ? `${extra}${cityHtml(o.city)}<span class="age">${srcAge(o)}</span><b>${fmt(price ?? o.price)}</b>` : `<b class="empty">нет цены</b>`}</div>`;
    m += `<section class="panel card${open ? " open" : ""}" tabindex="0" data-key="${key}" aria-expanded="${open}"><div class="card-h">${icon(r.id, 42)}<div class="iname"><b>${name}${bonus}</b><small>${recipe}</small></div>`
      + (r.ok ? `<b style="color:${levelColor(r.margin, r.profit, c0.m)};font-size:18px">${nf0.format(r.margin * 100)}%</b>` : "") + `${favBtn(r.id)}${CHEV}</div>`
      + ln("Сырьё", r.raw, r.raw && r.raw.unit) + ln("Тир ниже", r.prev) + ln("Продажа", r.sell, undefined, r.sell ? liqDot(r.sell.vol) : "")
      + (r.ok ? `<div class="m-line"><span class="k">За 1 шт. / за стак</span><b class="${cls}">${fmtSigned(r.profit)}</b><b class="${cls}" style="min-width:84px">${fmtBig(r.profit * STACK)}</b></div>` : "")
      + `<div class="card-det"${open ? "" : " hidden"}>${open ? detHtml(r) : ""}</div></section>`;
  }
  tbl.innerHTML = h + "</tbody>";
  cards.innerHTML = m;
  const byKey = Object.fromEntries(rows.map((r) => [rowKey(r), r]));
  const toggle = (el) => {
    const key = el.dataset.key, r = byKey[key]; if (!r) return;
    const open = !rOpen.has(key);
    if (open) rOpen.add(key); else rOpen.delete(key);
    el.classList.toggle("open", open); el.setAttribute("aria-expanded", String(open));
    const det = el.tagName === "TR" ? el.nextElementSibling : el.querySelector(".card-det");
    const box = el.tagName === "TR" ? det.firstElementChild : det;
    box.innerHTML = open ? detHtml(r) : ""; det.hidden = !open;
    bindCalcBtns(box);
  };
  rowNav(tbl, "tbody tr.rrow", toggle);
  cards.querySelectorAll(".card[data-key]").forEach((el) => {
    el.addEventListener("click", (e) => { if (!e.target.closest(".card-det")) toggle(el); });
    el.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); toggle(el); } });
  });
  bindCalcBtns(tbl); bindCalcBtns(cards);
}
// ссылка из деталей на вкладку «Цены» с этим предметом
const lnk = (id, text) => `<button type="button" class="lnk" data-goprice="${esc(id)}" title="Открыть в «Ценах»">${text}</button>`;
function goPrices(id) {
  const p = parseId(id); if (!p) return;
  S.pFams = [p.f]; if (!S.pTiers.includes(p.t)) S.pTiers = toggleIn(S.pTiers, p.t, ALL_TIERS);
  if (!S.pEnchs.includes(p.e)) S.pEnchs = toggleIn(S.pEnchs, p.e, ENCHS);
  S.pKind = "all"; S.pItem = id; arbItem = id; save(); location.hash = "prices";
}
// где продать: цена и объём во всех городах, прибыль с 1 шт. при такой цене
function whereSell(r) {
  if (!r.ok) return "";
  const rows = sellCities().map((c) => ({ c, o: sellIn(r.id, c) })).filter((x) => x.o).sort((a, b) => b.o.price - a.o.price);
  const net = (p) => p * (1 - r.c.buf) * (1 - r.c.fee) - r.cost;
  const liq = liquidity(r.sell.vol);
  return `<div class="det-b"><h4>Продажа</h4>${rows.map(({ c, o }) => `<button type="button" class="dl ws${c === r.sell.city ? " on" : ""}" data-pick="sellCity" data-v="${esc(c)}" aria-pressed="${c === r.sell.city}" title="Считать продажу в ${esc(c)}">${cityBadge(c)}<span class="ws-v">${isFinite(o.vol) ? `~${nf0.format(o.vol)} в день` : o.noHist ? "нет сделок — цена ограничена" : ""}</span><b>${fmt(o.price)}</b><b class="${net(o.price) >= 0 ? "pos" : "neg"}">${fmtSigned(net(o.price))}</b></button>`).join("")}
    <p class="dn">Город · продаётся в день · цена · прибыль с 1 шт. Нажми на город, чтобы считать продажу там. Цена за вычетом уценки ${fmtPct(r.c.buf)} и ${relists() ? "налога со сборами" : "налога"} ${fmtPct(r.c.fee)}</p>
    <p class="dn">${liqDot(r.sell.vol)} В ${esc(r.sell.city)} ${esc(liq.txt)}</p></div>`;
}
// закупочный лист на N стаков на выходе
function shopList(r) {
  if (!r.ok) return "";
  const n = Math.max(1, num(S.shopStacks) || 1), m = stoneMult(r), k = stoneK(r);
  const sets = (n * STACK * r.c.k) / m; // крафтов на закупленное (остальное — перекрафт возврата)
  const rawQ = Math.ceil(sets * N[r.t]), prevQ = Math.ceil(sets * m);
  const line = (id, q, o) => `${itemLabel(id)} — ${nf0.format(q)} шт., ${o.src === "own" ? `сделать самому, себестоимость ${fmt(o.price)}` : `${o.src === "order" ? "ордер" : "лот"} ${fmt(o.price)} в ${o.city}`}`;
  const rawIdK = rawId(r.f, r.t, k || r.e), total = rawQ * r.raw.unit * (r.raw.fee || 1) + prevQ * r.prev.price * (r.prev.fee || 1);
  const text = `${itemLabel(r.id)} ×${nf0.format(n * STACK)}:\n• ${line(rawIdK, rawQ, { ...r.raw, price: r.raw.unit })}\n• ${line(matId(r.f, r.t - 1, r.e), prevQ, r.prev)}\nИтого ~${fmtBig(total, false)} серебра`;
  return `<div class="det-b shop"><h4>Закупочный лист</h4>
    <label class="dl"><span>Стаков на выходе</span><input type="number" class="shop-n" min="1" step="1" inputmode="numeric" value="${n}"></label>
    <div class="dl"><span>${lnk(rawIdK, esc(itemLabel(rawIdK)))}</span><b>${nf0.format(rawQ)} шт.</b></div>
    <div class="dl"><span>${lnk(matId(r.f, r.t - 1, r.e), esc(itemLabel(matId(r.f, r.t - 1, r.e))))}${r.prev.src === "own" ? ` <span class="eq">сделать самому</span>` : ""}</span><b>${nf0.format(prevQ)} шт.</b></div>
    <div class="dl"><span>Нужно серебра</span><b>~${fmtBig(total, false)}</b></div>
    <p class="dn">С учётом перекрафта возврата: закупаешь меньше, чем ${nf0.format(n * STACK)} шт. на выходе</p>
    <button class="btn ghost" type="button" data-copy="${esc(text)}">Скопировать список</button></div>`;
}
function focusKv(r) {
  const f = focusInfo(r); if (!f) return "";
  if (S.settings.rrr === "0.539" || S.settings.rrr === "0.435") return "";
  return `<div class="dl"><span>С фокусом (возврат ${fmtPct(f.rf)})</span><b class="${f.profit >= 0 ? "pos" : "neg"}">${fmtBig(f.profit * STACK)} за стак</b></div>`
    + `<p class="dn">Фокуса на стак ~${nf0.format(f.stackFocus)} без специализации, ${fmt(f.perPoint)} серебра за очко</p>`;
}
// обработчики внутри раскрытых деталей
function bindDet(root) {
  root.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const key = b.closest("[data-rk]").dataset.rk, v = b.dataset.v, kind = b.dataset.pick;
    if (kind === "reset") { rPick.delete(key); renderRefine(); return; }
    if (kind === "rawK") setPick(key, { rawK: +v, rawCity: undefined });
    else if (kind === "rawHow") setPick(key, { rawHow: v });
    else if (kind === "prevHow") setPick(key, v === "own" ? { prevOwn: true } : { prevHow: v, prevOwn: undefined });
    else setPick(key, { [kind]: v });
  }));
  root.querySelectorAll("[data-goprice]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); goPrices(b.dataset.goprice); }));
  root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Список скопирован"); } catch (err) { window.prompt("Скопируй список:", b.dataset.copy); }
  }));
  root.querySelectorAll(".shop-n").forEach((inp) => {
    inp.addEventListener("click", (e) => e.stopPropagation());
    inp.addEventListener("keydown", (e) => e.stopPropagation());
    inp.addEventListener("change", () => { S.shopStacks = Math.max(1, num(inp.value) || 1); save(); renderRefine(); });
  });
}
function bindCalcBtns(root) {
  root.querySelectorAll("[data-calc]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); goCalc(b.dataset.calc, +b.dataset.t, b.dataset.key); }));
  bindDet(root);
}
async function openRefine(force = false) {
  if (force) rPick.clear(); // свежие цены — свой выбор сбрасываем к лучшему
  renderRefineControls(); renderRefine();
  await ensure(refineIds(), { history: true, force });
  if (S.view === "refine") renderRefine();
  renderTicker();
}

// ---------- вкладка «Пороги» ----------
function calcIds(f) {
  const out = [];
  for (const t of REFINE_TIERS) {
    if (FAM[f].stone) for (let k = 0; k <= 3; k++) out.push(rawId(f, t, k)); else out.push(rawId(f, t));
    out.push(matId(f, t - 1), matId(f, t));
  }
  return [...new Set(out)];
}
// обычные цены по истории сделок за 7 дней: город, где покупают/продают достаточно, и коридор цен
// now = true — «не лучше, чем сейчас»: история отстаёт от рынка на несколько дней, поэтому
// продажа — не дороже свежего лота, закупка — не дешевле свежего ордера +1
function typical(id, side, now = false) {
  const list = (side === "buy" ? buyCities() : sellCities()).map((c) => ({ c, h: histStats(id, c) })).filter((x) => x.h && x.h.vol >= MIN_VOL);
  if (!list.length) return null;
  const maxVol = Math.max(...list.map((x) => x.h.vol));
  const ok = list.filter((x) => x.h.vol >= maxVol * 0.25).map((x) => ({ ...x, v: x.h.med })); // не берём город, где почти не торгуют
  if (now) for (const x of ok) {
    const o = liveOf(id, x.c, side === "buy" ? "buy" : "sell");
    if (!o || o.age > maxAge() || (!o.manual && oddPrice(id, x.c, side === "buy" ? "buy" : "sell", o.p))) continue;
    x.v = side === "buy" ? Math.max(x.v, o.p + 1) : Math.min(x.v, o.p);
  }
  ok.sort((x, y) => (side === "buy" ? x.v - y.v : y.v - x.v));
  return { city: ok[0].c, ...ok[0].h, med: ok[0].v, histMed: ok[0].h.med };
}
// осторожная оценка продажи: средняя по городам «продаю», взвешенная по объёму продаж.
// В каждом городе — цена продажи своим лотом, как в «Переработке»: свежий лот, но не дороже P80 сделок за неделю.
// Нужна там, где сайт оценивает «выгодно ли вообще», а не называет конкретный город: весь объём в самом дорогом городе не продашь
function sellAvg(id) {
  const list = sellCities().map((c) => sellIn(id, c)).filter((o) => o && isFinite(o.vol) && o.vol >= MIN_VOL);
  if (!list.length) return null;
  let sum = 0, w = 0;
  for (const o of list) { sum += o.price * o.vol; w += o.vol; }
  return { med: sum / w, vol: w, n: list.length, where: list.length > 1 ? `в среднем по ${list.length} ${plural(list.length, ["городу", "городам", "городам"])}` : `в ${list[0].city}` };
}
// у камня — самый выгодный вариант в пересчёте на обычный
function typicalRaw(f, t, now = false) {
  if (!FAM[f].stone) { const x = typical(rawId(f, t), "buy", now); return x && { ...x, k: 0, unit: x.med }; }
  const mult = calcSettings(f).mult; let best = null;
  for (let k = 0; k <= 3; k++) {
    const x = typical(rawId(f, t, k), "buy", now); if (!x) continue;
    const d = k ? mult[k - 1] : 1;
    if (!best || x.med / d < best.med) best = { ...x, med: x.med / d, p20: x.p20 / d, p80: x.p80 / d, k, unit: x.med };
  }
  return best;
}
function typicalOf(f, t, kind) { return kind === "raw" ? typicalRaw(f, t) : kind === "prev" ? typical(matId(f, t - 1), "buy") : typical(matId(f, t), "sell"); }
function fillCalcFromMarket(f, mode = "live") {
  const P = S.calc[f];
  const note = (o, extra = "") => o ? `${o.city}${o.age !== undefined ? ", " + fmtAge(o.age) + " назад" : ""}${o.src === "hist" ? ", медиана за 7 дней" : o.src === "cap" ? ", P80 за 7 дней" : o.src === "order" ? ", свой ордер" : ""}${extra}` : "нет цены на рынке";
  const tnote = (x, extra = "") => `${x.city}, обычная цена сделок за 7 дней${extra}`;
  for (const t of REFINE_TIERS) {
    if (mode === "hist") {
      const raw = typicalRaw(f, t), prev = typical(matId(f, t - 1), "buy"), sell = typical(matId(f, t), "sell");
      // где сделок мало — берём текущую цену и честно это пишем
      const lraw = raw ? null : pickRaw(f, t, 0), lprev = prev ? null : pickBuy(matId(f, t - 1)), lsell = sell ? null : pickSell(matId(f, t));
      P[t].raw = raw ? Math.round(raw.med) : lraw ? Math.round(lraw.price) : null;
      P[t].prev = prev ? Math.round(prev.med) : lprev ? Math.round(lprev.price) : null;
      P[t].sell = sell ? Math.round(sell.med) : lsell ? Math.round(lsell.price) : null;
      P[t].note = {
        raw: raw ? tnote(raw, raw.k ? `; это камень .${raw.k} по ${fmt(raw.unit)}` : "") : lraw ? "мало сделок, текущая цена: " + note(lraw) : "нет цены",
        prev: prev ? tnote(prev) : lprev ? "мало сделок, текущая цена: " + note(lprev) : "нет цены",
        sell: sell ? tnote(sell) : lsell ? "мало сделок, текущая цена: " + note(lsell) : "нет цены",
      };
      continue;
    }
    const raw = pickRaw(f, t, 0), prev = pickBuy(matId(f, t - 1)), sell = pickSell(matId(f, t));
    P[t].raw = raw ? Math.round(raw.price) : null;
    P[t].prev = prev ? Math.round(prev.price) : null;
    P[t].sell = sell ? Math.round(sell.price) : null;
    P[t].note = { raw: note(raw, raw && raw.ench ? `, это T${t}.${raw.ench} по ${fmt(raw.unit)}` : ""), prev: note(prev), sell: note(sell) };
  }
  save();
}
const calcEmpty = (f) => REFINE_TIERS.every((t) => S.calc[f][t].raw == null && S.calc[f][t].sell == null);
async function marketFill(mode = "hist") {
  const btns = [$("c-fill"), $("c-fill-live")]; btns.forEach((b) => (b.disabled = true));
  await ensure(calcIds(S.cFam), { history: true });
  fillCalcFromMarket(S.cFam, mode); buildTiers(); updateCalc();
  btns.forEach((b) => (b.disabled = false));
}
// коридор обычных цен: полоса P20–P80, отметка медианы, твоя цена (точка) и порог (черта)
function renderBand(kind, t, cur, thr, be) {
  const el = $(`B-${kind}-${t}`); if (!el) return;
  const x = typicalOf(S.cFam, t, kind);
  if (!x) { el.innerHTML = `<span class="band-t">мало сделок за неделю — обычную цену не посчитать</span>`; return; }
  const vals = [x.p20, x.p80, x.med, cur, thr, be].filter((v) => isFinite(v) && v > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.12 || hi * 0.1; lo = Math.max(0, lo - pad); hi += pad;
  const pos = (v) => `${((v - lo) / (hi - lo) * 100).toFixed(1)}%`;
  const buy = kind !== "sell";
  // вывод: сравниваем обычные цены и с порогом желаемой маржи, и с безубытком
  const mm = `${nf0.format(calcSettings(S.cFam).m * 100)}%`;
  let verdict = "", vcls = "";
  if (isFinite(thr) && thr > 0) {
    if (buy) {
      if (thr >= x.p80) { verdict = `даже по дорогой обычной цене маржа ≥ ${mm} — бери спокойно`; vcls = "pos"; }
      else if (thr >= x.p20) { verdict = `бери не дороже порога — тогда маржа ≥ ${mm}`; vcls = "pos"; }
      else if (isFinite(be) && be >= x.med) { verdict = `по обычной цене в плюсе, но маржа ниже ${mm}`; vcls = "warn"; }
      else if (isFinite(be) && be >= x.p20) { verdict = `в плюсе только по дешёвой цене, маржа ниже ${mm}`; vcls = "warn"; }
      else { verdict = "по обычным ценам в минусе"; vcls = "neg"; }
    } else {
      if (thr <= x.p20) { verdict = `даже по дешёвой обычной цене маржа ≥ ${mm}`; vcls = "pos"; }
      else if (thr <= x.p80) { verdict = `продавай не дешевле порога — тогда маржа ≥ ${mm}`; vcls = "pos"; }
      else if (isFinite(be) && be <= x.med) { verdict = `по обычной цене в плюсе, но маржа ниже ${mm}`; vcls = "warn"; }
      else if (isFinite(be) && be <= x.p80) { verdict = `в плюсе только по дорогой цене, маржа ниже ${mm}`; vcls = "warn"; }
      else { verdict = "по обычным ценам в минусе"; vcls = "neg"; }
    }
  }
  el.innerHTML = `<div class="bandbar" title="Полоса — обычные цены сделок за 7 дней (20–80% сделок), черта — медиана, цветная метка — порог желаемой маржи, серая — безубыток, ● — твоя цена">
      <i class="bz" style="left:${pos(x.p20)};width:calc(${pos(x.p80)} - ${pos(x.p20)})"></i><i class="bm" style="left:${pos(x.med)}"></i>
      ${isFinite(be) && be > 0 ? `<i class="bb" style="left:${pos(be)}" title="безубыток ${fmt(be)}"></i>` : ""}${isFinite(thr) && thr > 0 ? `<i class="bt ${vcls}" style="left:${pos(thr)}" title="порог маржи ${mm}: ${fmt(thr)}"></i>` : ""}${isFinite(cur) && cur > 0 ? `<i class="bc" style="left:${pos(cur)}"></i>` : ""}</div>
    <span class="band-t">обычно ${fmt(x.p20)}–${fmt(x.p80)}, чаще ~${fmt(x.med)} · ${cityBadge(x.city)} ~${nf0.format(x.vol)} в день</span>
    ${verdict ? `<span class="band-v ${vcls}">${verdict}</span>` : ""}`;
}
function renderCalcControls() {
  chips($("c-fam"), FAMS.map((f) => [f, FAM[f].tab]), (v) => v === S.cFam, (v) => {
    S.cFam = v; save(); renderCalcControls(); buildTiers(); updateCalc();
    if (calcEmpty(v)) marketFill();
  });
  chips($("c-tiers"), tierItems(REFINE_TIERS), (v) => S.cTiers.includes(v), (v) => { S.cTiers = toggleIn(S.cTiers, v, REFINE_TIERS); save(); renderCalcControls(); buildTiers(); updateCalc(); }, tierCls);
  const L = FAM[S.cFam], c = calcSettings(S.cFam);
  $("c-city").textContent = `До какой цены покупать и от какой продавать, чтобы переработка шла в плюс. ${L.tab} перерабатывают в ${L.city}: только там действует возврат 36,7% и 53,9%.${c.bonus ? ` Сегодня бонус +${S.settings.bonusPct}%: возврат ${fmtPct(c.r)}.` : ""}`;
}
function buildTiers() {
  const f = S.cFam, L = FAM[f], P = S.calc[f], main = $("c-tiers-list"); main.innerHTML = "";
  for (const t of [...S.cTiers].sort((a, b) => b - a)) {
    const p = P[t], own = !!p.own && t > 4;
    const nm = { raw: itemLabel(rawId(f, t)), prev: itemLabel(matId(f, t - 1)), mat: itemLabel(matId(f, t)) };
    const card = document.createElement("section"); card.className = `panel tcard t${t}`; card.style.setProperty("--tc", `var(--t${t})`); card.setAttribute("aria-labelledby", `h-${t}`);
    card.innerHTML = `
      <div class="tcard-h">${icon(matId(f, t), 56)}<div class="tc-title"><span class="recipe" id="h-${t}">${esc(nm.raw)} ×${N[t]} + ${esc(nm.prev)} → ${esc(nm.mat)}</span></div><span id="pill-${t}"></span></div>
      <div class="trio">
        <div class="field"><div class="lblrow"><label class="lbl-ic" for="raw-${t}">${icon(rawId(f, t), 28, false)}${esc(nm.raw)}, покупка</label></div>
          <input type="number" id="raw-${t}" min="0" step="1" inputmode="numeric" value="${p.raw ?? ""}"><span class="srcnote" id="n-raw-${t}"></span><div class="band" id="B-raw-${t}"></div></div>
        <div class="field"><div class="lblrow"><label class="lbl-ic" for="prev-${t}">${icon(matId(f, t - 1), 28, false)}${esc(nm.prev)}</label>
            <span class="seg" role="group" aria-label="Откуда материал T${t - 1}">
              <button type="button" id="mk-${t}" aria-pressed="${!own}">рынок</button>
              <button type="button" id="ow-${t}" aria-pressed="${own}" ${t === 4 ? 'disabled title="T3 считается только по рынку"' : ""}>свой крафт</button>
            </span></div>
          <input type="number" id="prev-${t}" min="0" step="1" inputmode="numeric" value="${p.prev ?? ""}" ${own ? "hidden" : ""}>
          <div class="owncost" id="ownc-${t}" ${own ? "" : "hidden"}></div><span class="srcnote" id="n-prev-${t}"></span><div class="band" id="B-prev-${t}"></div></div>
        <div class="field"><div class="lblrow"><label class="lbl-ic" for="sell-${t}">${icon(matId(f, t), 28, false)}${esc(nm.mat)}, продажа</label></div>
          <input type="number" id="sell-${t}" min="0" step="1" inputmode="numeric" value="${p.sell ?? ""}"><span class="srcnote" id="n-sell-${t}"></span><div class="band" id="B-sell-${t}"></div></div>
      </div>
      <div class="trio">
        <div class="lim" id="L-raw-${t}"><span class="k">${esc(nm.raw)}: покупай до</span><span class="v"></span><span class="be"></span><span class="cmp"></span></div>
        <div class="lim" id="L-prev-${t}"><span class="k">${esc(nm.prev)}: до</span><span class="v"></span><span class="be"></span><span class="cmp"></span></div>
        <div class="lim" id="L-sell-${t}"><span class="k">${esc(nm.mat)}: продавай от</span><span class="v"></span><span class="be"></span><span class="cmp"></span></div>
      </div>
      ${L.stone ? `<div class="enchrow" id="E-${t}"></div>` : ""}
      <div class="stats" id="st-${t}"></div>`;
    main.appendChild(card);
    for (const k of ["raw", "prev", "sell"]) {
      $(`n-${k}-${t}`).textContent = (p.note && p.note[k]) || "";
      $(`${k}-${t}`).addEventListener("input", (e) => {
        P[t][k] = e.target.value === "" ? null : +e.target.value;
        P[t].note = { ...(P[t].note || {}), [k]: "своя цена" }; $(`n-${k}-${t}`).textContent = "своя цена";
        save(); updateCalc();
      });
    }
    const setOwn = (v) => {
      if (t === 4) return; P[t].own = v;
      $(`mk-${t}`).setAttribute("aria-pressed", String(!v)); $(`ow-${t}`).setAttribute("aria-pressed", String(v));
      $(`prev-${t}`).hidden = v; $(`ownc-${t}`).hidden = !v; save(); updateCalc();
    };
    $(`mk-${t}`).addEventListener("click", () => setOwn(false));
    $(`ow-${t}`).addEventListener("click", () => setOwn(true));
  }
  if (!S.cTiers.length) main.innerHTML = `<p class="k">Выбери хотя бы один тир.</p>`;
  buildBudget();
}
function setLim(id, val, be, have, kind) {
  const el = $(id); if (!el) return;
  const v = el.querySelector(".v"), b = el.querySelector(".be"), cmp = el.querySelector(".cmp");
  el.classList.remove("ok", "over", "mid");
  if (!isFinite(val)) { v.textContent = "—"; b.textContent = ""; cmp.textContent = ""; return; }
  if (kind !== "sell" && val <= 0) { v.textContent = "не выйдет"; b.textContent = "в минус даже бесплатно"; cmp.textContent = ""; el.classList.add("over"); return; }
  v.textContent = (kind === "sell" ? "≥ " : "≤ ") + fmt(val);
  b.textContent = `для маржи ${nf0.format(calcSettings(S.cFam).m * 100)}% · безубыток ${fmt(be)}`;
  if (isFinite(have)) {
    const good = kind === "sell" ? have >= val : have <= val;
    const plus = kind === "sell" ? have >= be : have <= be;
    el.classList.add(good ? "ok" : plus ? "mid" : "over");
    cmp.textContent = "сейчас " + fmt(have) + (good ? ", подходит" : plus ? ", в плюсе, но маржа ниже желаемой" : ", в минусе");
  } else cmp.textContent = "";
}
let calcState = {};
function updateCalc() {
  const f = S.cFam, c = calcSettings(f), L = FAM[f], P = S.calc[f], costs = {};
  calcState = {};
  for (const t of REFINE_TIERS) {
    const p = P[t], raw = num(p.raw), sell = num(p.sell), shown = !!$(`pill-${t}`);
    let prevEff, own = false;
    if (p.own && t > 4) { own = true; prevEff = isFinite(costs[t - 1]) ? costs[t - 1] : NaN; }
    else prevEff = num(p.prev) * c.bf;
    const ok = isFinite(raw) && isFinite(sell) && isFinite(prevEff) && raw >= 0 && sell > 0;
    const o = ok ? economics(t, raw, prevEff, sell, c) : null;
    costs[t] = o ? o.cost : NaN;
    calcState[t] = { o, raw, prevEff, own };
    if (!shown) continue;
    const ownEl = $(`ownc-${t}`);
    if (ownEl) ownEl.textContent = own ? (isFinite(prevEff) ? `себестоимость T${t - 1}: ${fmt(prevEff)}` : `заполни цены T${t - 1}`) : "";
    if (!o) {
      $(`pill-${t}`).innerHTML = `<span class="pill none">заполни цены</span>`;
      for (const k of ["raw", "prev", "sell"]) setLim(`L-${k}-${t}`, NaN);
      renderBand("raw", t, raw, NaN); renderBand("prev", t, num(p.prev), NaN); renderBand("sell", t, sell, NaN);
      $(`st-${t}`).innerHTML = ""; if (L.stone) $(`E-${t}`).innerHTML = ""; continue;
    }
    $(`pill-${t}`).innerHTML = statusPill(o.margin, o.profit, c.m);
    setLim(`L-raw-${t}`, o.maxRaw(c.m), o.maxRaw(0), raw, "buy");
    const pe = $(`L-prev-${t}`);
    if (own) { setLim(`L-prev-${t}`, NaN); pe.querySelector(".v").textContent = "свой крафт"; pe.querySelector(".be").textContent = `себестоимость ${fmt(prevEff)}`; }
    else setLim(`L-prev-${t}`, o.maxPrev(c.m), o.maxPrev(0), num(p.prev), "buy");
    setLim(`L-sell-${t}`, o.minSell(c.m), o.minSell(0), sell, "sell");
    renderBand("raw", t, raw, o.maxRaw(c.m), o.maxRaw(0));
    renderBand("prev", t, own ? NaN : num(p.prev), own ? NaN : o.maxPrev(c.m), own ? NaN : o.maxPrev(0));
    renderBand("sell", t, sell, o.minSell(c.m), o.minSell(0));
    if (L.stone) {
      const mx = o.maxRaw(c.m);
      $(`E-${t}`).innerHTML = mx > 0 ? `<span>Зачарованный камень, покупай до</span>${[1, 2, 3].map((e) => `<span class="gem ec${e}">T${t}.${e} <b>${fmt(mx * c.mult[e - 1])}</b></span>`).join("")}` : "";
    }
    const cls = o.profit >= 0 ? "pos" : "neg";
    $(`st-${t}`).innerHTML =
      `<span>Себестоимость <b>${fmt(o.cost)}</b></span>` +
      `<span>Выручка <b>${fmt(o.effSell)}</b></span>` +
      `<span>Прибыль за 1 <b class="${cls}">${fmtSigned(o.profit)}</b></span>` +
      `<span>За стак <b class="${cls}">${fmtBig(o.profit * STACK)}</b></span>` +
      `<span>Деньги на стак <b>${fmtBig(o.capital, false)}</b></span>`;
  }
  renderCheat(); renderBudgetOut();
}
let cheatText = "";
function renderCheat() {
  const f = S.cFam, c = calcSettings(f), rows = [];
  for (const t of [...S.cTiers].sort((a, b) => b - a)) {
    const st = calcState[t]; if (!st || !st.o) continue;
    const o = st.o, mr = o.maxRaw(c.m), mp = o.maxPrev(c.m);
    rows.push({ t, id: rawId(f, t), what: `${itemLabel(rawId(f, t))} до`, v: mr > 0 ? fmt(mr) : "не выйдет", k: "b" });
    if (!st.own) rows.push({ t, id: matId(f, t - 1), what: `${itemLabel(matId(f, t - 1))} до`, v: mp > 0 ? fmt(mp) : "не выйдет", k: "b" });
    rows.push({ t, id: matId(f, t), what: `${itemLabel(matId(f, t))} от`, v: fmt(o.minSell(c.m)), k: "s" });
  }
  const box = $("c-cheat");
  let h = `<div class="w-head"><span class="w-title">Шпаргалка на сегодня</span><span class="k">${FAM[f].tab.toLowerCase()}, маржа ${nf0.format(c.m * 100)}%</span></div>`;
  if (!rows.length) h += `<p class="w-empty">Заполни цены в карточках или подставь их с рынка.</p>`;
  else h += `<div>${rows.map((r) => `<div class="cheat-row">${icon(r.id, 30)}<span class="cw">${esc(r.what)}</span><b class="${r.k === "b" ? "neg" : "pos"}">${r.v}</b></div>`).join("")}</div>
    <button class="btn ghost" type="button" id="c-copy">Скопировать для чата</button>`;
  box.innerHTML = h;
  const d = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  cheatText = `${FAM[f].tab}, пороги на ${d} (маржа ${nf0.format(c.m * 100)}%):\n` + [...new Set(rows.map((r) => r.t))].map((t) =>
    `T${t}: ` + rows.filter((r) => r.t === t).map((r) => `${r.what} ${r.v}`).join(", ")).join("\n");
  const btn = $("c-copy");
  if (btn) btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(cheatText); toast("Скопировано"); }
    catch (e) { window.prompt("Скопируй текст:", cheatText); }
  });
}
function buildBudget() {
  const box = $("c-budget"), tiers = [...S.cTiers].sort((a, b) => b - a);
  if (!tiers.includes(S.bTier)) S.bTier = null;
  box.innerHTML = `<span class="w-title">Сколько брать на мои деньги</span>
    <div class="row2">
      <label class="field"><span class="k">Бюджет, серебро</span><input type="number" id="b-sum" min="0" step="100000" inputmode="numeric" value="${S.budget ?? ""}"></label>
      <label class="field"><span class="k">Тир</span><select id="b-tier"><option value="">лучший</option>${tiers.map((t) => `<option value="${t}" ${S.bTier === t ? "selected" : ""}>T${t}</option>`).join("")}</select></label>
    </div>
    <div class="kv inset" id="b-out"></div>`;
  $("b-sum").addEventListener("input", (e) => { S.budget = num(e.target.value); save(); renderBudgetOut(); });
  $("b-tier").addEventListener("change", (e) => { S.bTier = e.target.value ? +e.target.value : null; save(); renderBudgetOut(); });
}
function renderBudgetOut() {
  const out = $("b-out"); if (!out) return;
  const f = S.cFam, c = calcSettings(f), B = num(S.budget);
  let t = S.bTier;
  if (!t) { let bm = -Infinity; for (const k of S.cTiers) { const st = calcState[k]; if (st && st.o && st.o.margin > bm) { bm = st.o.margin; t = k; } } }
  const st = t && calcState[t];
  if (!st || !st.o || !(B > 0)) { out.innerHTML = `<div><span>${!(B > 0) ? "Укажи бюджет" : "Заполни цены для этого тира"}</span><b></b></div>`; if ($("b-hint")) $("b-hint").textContent = ""; return; }
  const set = N[t] * st.raw * c.bf + st.prevEff;
  const sets = B / (set + st.o.station / c.k), outputs = sets / c.k, profit = outputs * st.o.profit;
  const cls = profit >= 0 ? "pos" : "neg";
  out.innerHTML = `<div><span>${esc(itemLabel(rawId(f, t)))}</span><b>${nf0.format(sets * N[t])} шт.</b></div>`
    + `<div><span>${esc(itemLabel(matId(f, t - 1)))}${st.own ? " (свой)" : ""}</span><b>${nf0.format(sets)} шт.</b></div>`
    + `<div><span>На выходе, с возвратом</span><b>~${nf0.format(outputs)} шт.</b></div>`
    + `<div><span>Прибыль, T${t}</span><b class="${cls}">~${fmtBig(profit)}</b></div>`;
  const hint = $("b-hint") || (() => { const el = document.createElement("p"); el.id = "b-hint"; el.className = "k"; el.style.margin = "0"; out.after(el); return el; })();
  hint.textContent = `С перекрафтом возврата: из ${nf0.format(sets)} закупленных крафтов выйдет ~${nf0.format(outputs)} шт. (×${nf2.format(1 / c.k)}). Вернувшиеся ресурсы снова идут в переработку, с них снова приходит возврат, и так до конца.`;
}
async function openCalc() {
  renderCalcControls(); buildTiers(); updateCalc();
  if (calcEmpty(S.cFam)) await marketFill();
}

// ---------- журнал сделок ----------
let J = { cycles: [] };
try { const j = JSON.parse(localStorage.getItem(JKEY) || "null"); if (j && Array.isArray(j.cycles)) J = j; } catch (e) {}
function saveJ() { try { localStorage.setItem(JKEY, JSON.stringify(J)); } catch (e) { toast("Не удалось сохранить: хранилище браузера недоступно"); } }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cycleName = (cy) => itemLabel(matId(cy.f, cy.t, cy.e));
const dShort = (ts) => new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
function cycleStats(cy) {
  let rawEnch = false, spent = 0, rawQ = 0, prevQ = 0, rawSum = 0, prevSum = 0, made = 0, station = 0, sold = 0, revenue = 0, gross = 0;
  const sells = [];
  for (const e of cy.entries) {
    if (e.type === "buy") {
      const v = e.qty * e.price * (e.order ? 1.025 : 1); spent += v;
      if (e.what === "prev") { prevQ += e.qty; prevSum += e.qty * e.price; }
      else { const m = e.rawE ? (e.mult || calcSettings(cy.f).mult[e.rawE - 1] || 1) : 1; rawQ += e.qty * m; rawSum += e.qty * e.price; if (e.rawE) rawEnch = true; }
    } else if (e.type === "refine") { made += e.qty; station += e.station || 0; }
    else if (e.type === "sell") { sold += e.qty; gross += e.qty * e.price; revenue += e.qty * e.price * (1 - e.fee); sells.push(e); }
  }
  const unitCost = made > 0 ? (spent + station) / made : NaN;
  const profit = sold > 0 && made > 0 ? revenue - sold * unitCost : cy.closed ? revenue - spent - station : NaN;
  const ts = cy.entries.map((e) => e.ts);
  return {
    spent, rawQ, rawEnch, prevQ, avgRaw: rawQ ? rawSum / rawQ : NaN, avgPrev: prevQ ? prevSum / prevQ : NaN, made, station, sold, revenue,
    avgSell: sold ? gross / sold : NaN, unitCost, profit, sells, pct: made > 0 ? Math.min(1, sold / made) : 0,
    margin: sold > 0 && made > 0 ? (revenue / sold - unitCost) / unitCost : NaN,
    from: ts.length ? Math.min(...ts) : cy.created, to: ts.length ? Math.max(...ts) : cy.created,
  };
}
function cycleStatus(cy, s) {
  if (cy.closed) return isFinite(s.profit) && s.profit < 0 ? ["закрыт в минус", "bad"] : ["закрыт", "good"];
  if (s.sold > 0) return ["продаётся", "acc"];
  if (s.made > 0) return ["переработано", "acc"];
  return ["закупка", "none"];
}
function renderJournal() { renderJSummary(); renderCycles(); renderJForm(); }
function renderJSummary() {
  const week = Date.now() - 7 * 864e5;
  let p7 = 0, any7 = false, inGoods = 0, unsold = 0, closed = 0, cost = 0, gain = 0, fcM = [], dSell = [], dRaw = [];
  for (const cy of J.cycles) {
    const s = cycleStats(cy);
    if (cy.closed) closed++;
    if (isFinite(s.unitCost)) for (const e of s.sells) if (e.ts >= week) { p7 += e.qty * (e.price * (1 - e.fee) - s.unitCost); any7 = true; }
    if (!cy.closed) {
      if (s.made > 0) { const left = Math.max(0, s.made - s.sold); unsold += left; inGoods += left * s.unitCost; }
      else inGoods += s.spent;
    }
    if (s.sold > 0 && isFinite(s.unitCost)) {
      cost += s.sold * s.unitCost; gain += s.revenue - s.sold * s.unitCost;
      if (cy.fc && isFinite(cy.fc.margin)) fcM.push(cy.fc.margin);
    }
    if (cy.fc) {
      if (isFinite(s.avgSell) && cy.fc.sell) dSell.push((s.avgSell - cy.fc.sell) / cy.fc.sell);
      if (isFinite(s.avgRaw) && cy.fc.raw) dRaw.push((s.avgRaw - cy.fc.raw) / cy.fc.raw);
    }
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const fact = cost > 0 ? gain / cost : NaN, fcAvg = fcM.length ? avg(fcM) : NaN;
  const bar = (v, col) => `<div class="mbar"><i style="width:${Math.max(4, Math.min(100, Math.abs(v) / 0.4 * 100))}%;background:${col}"></i></div>`;
  let err = ["Пока мало данных", "Заверши хотя бы один цикл с продажами — тогда станет видно, где расчёт расходится с жизнью."];
  const ds = dSell.length ? avg(dSell) : NaN, dr = dRaw.length ? avg(dRaw) : NaN;
  if (isFinite(ds) && (!isFinite(dr) || Math.abs(ds) >= Math.abs(dr)) && Math.abs(ds) >= 0.01) {
    err = ["Цена продажи", ds < 0 ? `В среднем на ${fmtPct(-ds)} ниже прогноза: подними «Запас на уценку» до ${nf0.format((num(S.settings.buffer) || 0) + Math.round(-ds * 100))}%.` : `В среднем на ${fmtPct(ds)} выше прогноза: продаёшь удачнее расчёта.`];
  } else if (isFinite(dr) && Math.abs(dr) >= 0.01) {
    err = ["Цена сырья", dr > 0 ? `В среднем на ${fmtPct(dr)} дороже прогноза: ставь ордера ниже или бери в другом городе.` : `В среднем на ${fmtPct(-dr)} дешевле прогноза: закупаешься удачнее расчёта.`];
  } else if (isFinite(ds)) err = ["Прогноз точный", "Цены закупки и продажи почти совпадают с расчётом."];
  $("j-summary").innerHTML = `
    <div class="panel widget"><span class="k">Прибыль за 7 дней</span><div class="jbig ${p7 >= 0 ? "pos" : "neg"}">${any7 ? fmtBig(p7) : "—"}</div><span class="k">${closed} ${plural(closed, ["закрытый цикл", "закрытых цикла", "закрытых циклов"])}</span></div>
    <div class="panel widget"><span class="k">Маржа: факт и прогноз</span>
      <div style="display:flex;align-items:baseline;gap:12px"><span class="jbig">${isFinite(fact) ? nf0.format(fact * 100) + "%" : "—"}</span><span class="k">${isFinite(fcAvg) ? "прогноз " + nf0.format(fcAvg * 100) + "%" : "прогноза нет"}</span></div>
      <div class="mbar2">${isFinite(fact) ? bar(fact, "var(--good)") : ""}${isFinite(fcAvg) ? bar(fcAvg, "var(--accent)") : ""}</div></div>
    <div class="panel widget"><span class="k">Деньги в товаре</span><div class="jbig">${fmtBig(inGoods, false)}</div><span class="k">${unsold ? `${nf0.format(unsold)} шт. ещё не проданы` : "всё продано"}</span></div>
    <div class="panel widget"><span class="k">Где прогноз ошибается</span><div style="font-size:20px;font-weight:700">${err[0]}</div><span class="k">${esc(err[1])}</span></div>`;
}
const TYPE_RU = { buy: "купил", refine: "переработал", sell: "продал" };
function renderCycles() {
  const box = $("j-cycles");
  if (!J.cycles.length) { box.innerHTML = `<div class="panel j-empty">Журнал пуст. Запиши первую закупку справа${isMobile() ? " (выше)" : ""} — журнал заведёт цикл и сохранит прогноз прибыли по текущим ценам.</div>`; return; }
  const list = [...J.cycles].sort((a, b) => (!!a.closed - !!b.closed) || (cycleStats(b).to - cycleStats(a).to));
  box.innerHTML = list.map((cy) => {
    const s = cycleStats(cy), [stTxt, stCls] = cycleStatus(cy, s), id = matId(cy.f, cy.t, cy.e);
    const loss = isFinite(s.profit) && s.profit < 0;
    const fcProfit = cy.fc && isFinite(cy.fc.profit) && s.made > 0 ? cy.fc.profit * s.made : NaN;
    const dates = s.from === s.to ? dShort(s.from) : `${dShort(s.from)} – ${dShort(s.to)}`;
    const bought = [s.rawQ ? `${lc1(itemLabel(rawId(cy.f, cy.t, cy.e)))} ${nf0.format(s.rawQ)} × ${fmt(s.avgRaw)}${s.rawEnch ? " в пересчёте на обычный" : ""}` : "", s.prevQ ? `${lc1(itemLabel(matId(cy.f, cy.t - 1, cy.e)))} ${nf0.format(s.prevQ)} × ${fmt(s.avgPrev)}` : ""].filter(Boolean).join(", ");
    const entries = [...cy.entries].sort((a, b) => b.ts - a.ts).map((e) => {
      const what = e.type === "buy" ? itemLabel(e.what === "prev" ? matId(cy.f, cy.t - 1, cy.e) : rawId(cy.f, cy.t, e.rawE || cy.e)) : e.type === "refine" ? "получено" : itemLabel(id);
      const val = e.type === "refine" ? `${nf0.format(e.qty)} шт.${e.station ? `, станция ${fmt(e.station)}` : ""}` : `${nf0.format(e.qty)} × ${fmt(e.price)}${e.city ? ", " + e.city : ""}`;
      return `<li><span>${new Date(e.ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span><span class="e-what">${TYPE_RU[e.type]}: ${esc(lc1(what))}, ${val}</span><button type="button" data-del="${e.id}" aria-label="Удалить запись">✕</button></li>`;
    }).join("");
    return `<section class="panel cycle" data-cy="${cy.id}">
      <div class="cycle-h">${icon(id, 44)}<div class="iname"><b>${esc(cycleName(cy))}</b><span class="k">${dates}</span></div><span class="pill ${stCls}">${stTxt}</span></div>
      <div class="trio">
        <div class="st"><span class="k">Куплено</span><b>${s.spent ? fmtBig(s.spent, false) : "—"}</b><span class="k">${esc(bought) || "ещё ничего"}</span></div>
        <div class="st"><span class="k">Переработано</span><b>${s.made ? nf0.format(s.made) + " шт." : "—"}</b><span class="k">${s.station ? "станция " + fmtBig(s.station, false) : isFinite(s.unitCost) ? "" : "ещё нет"}${isFinite(s.unitCost) ? `${s.station ? ", " : ""}себест. ${fmt(s.unitCost)}` : ""}</span></div>
        <div class="st"><span class="k">Продано</span><b>${s.sold ? nf0.format(s.sold) + " шт." : "—"}</b><span class="k">${s.sold ? "в среднем по " + fmt(s.avgSell) : "ещё нет"}</span></div>
      </div>
      <div class="mbar2">
        <div class="cyc-foot"><span class="k">${s.made ? `Продано ${nf0.format(s.pct * 100)}% партии` : "Партия ещё не переработана"}</span>
          <span><span class="k">прибыль</span> <b class="${loss ? "neg" : "pos"}">${isFinite(s.profit) ? fmtBig(s.profit) : "—"}</b>${isFinite(fcProfit) ? ` <span class="k">прогноз ${fmtBig(fcProfit)}</span>` : ""}</span></div>
        <div class="progress"><i class="${loss ? "loss" : ""}" style="width:${Math.max(2, s.pct * 100)}%"></i></div>
      </div>
      <div class="cyc-foot">
        <details class="entries"><summary>${cy.entries.length} ${plural(cy.entries.length, ["запись", "записи", "записей"])}</summary><ul>${entries}</ul></details>
        <div class="cyc-acts"><button class="btn ghost" type="button" data-close="${cy.id}">${cy.closed ? "Открыть снова" : "Закрыть цикл"}</button><button class="btn ghost" type="button" data-remove="${cy.id}">Удалить</button></div>
      </div>
    </section>`;
  }).join("");
  box.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => {
    const cy = J.cycles.find((x) => x.id === b.dataset.close); if (!cy) return;
    cy.closed = cy.closed ? null : Date.now(); saveJ(); renderJournal();
  }));
  box.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => {
    const cy = J.cycles.find((x) => x.id === b.dataset.remove); if (!cy) return;
    if (!confirm(`Удалить цикл «${cycleName(cy)}» со всеми записями?`)) return;
    J.cycles = J.cycles.filter((x) => x !== cy); if (S.jf.cycle === cy.id) S.jf.cycle = "new";
    saveJ(); save(); renderJournal();
  }));
  box.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    for (const cy of J.cycles) cy.entries = cy.entries.filter((e) => e.id !== b.dataset.del);
    saveJ(); renderJournal();
  }));
}
function jfTarget() {
  const jf = S.jf;
  if (jf.cycle !== "new") { const cy = J.cycles.find((x) => x.id === jf.cycle && !x.closed); if (cy) return { f: cy.f, t: cy.t, e: cy.e, cy }; jf.cycle = "new"; }
  const f = FAM[jf.f] ? jf.f : "stone", t = REFINE_TIERS.includes(+jf.t) ? +jf.t : 6, e = FAM[f].stone ? 0 : Math.max(0, Math.min(3, +jf.e || 0));
  return { f, t, e, cy: null };
}
function renderJForm() {
  const jf = S.jf, box = $("j-form"), tg = jfTarget(), open = J.cycles.filter((c) => !c.closed);
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(l)}</option>`;
  const rawN = itemLabel(rawId(tg.f, tg.t, tg.e)), prevN = itemLabel(matId(tg.f, tg.t - 1, tg.e)), matN = itemLabel(matId(tg.f, tg.t, tg.e));
  let h = `<span class="w-title">Новая запись</span>
    <div class="seg" role="group" aria-label="Что сделал">${[["buy", "Купил"], ["refine", "Переработал"], ["sell", "Продал"]].map(([v, l]) => `<button type="button" data-type="${v}" aria-pressed="${jf.type === v}">${l}</button>`).join("")}</div>
    <label class="field"><span class="k">Цикл</span><select id="jf-cycle">${open.map((c) => opt(c.id, `${cycleName(c)}, с ${dShort(cycleStats(c).from)}`, jf.cycle === c.id)).join("")}${opt("new", "Новый цикл…", tg.cy === null)}</select></label>`;
  const stone = !!FAM[tg.f].stone;
  if (!tg.cy) h += `<div class="${stone ? "row2" : "row3"}">
      <label class="field"><span class="k">Ресурс</span><select id="jf-f">${FAMS.map((f) => opt(f, FAM[f].tab, f === tg.f)).join("")}</select></label>
      <label class="field"><span class="k">Тир</span><select id="jf-t">${REFINE_TIERS.map((t) => opt(t, "T" + t, t === tg.t)).join("")}</select></label>
      ${stone ? "" : `<label class="field"><span class="k">Зачар.</span><select id="jf-e">${ENCHS.map((e) => opt(e, "." + e, e === tg.e)).join("")}</select></label>`}
    </div><span class="k">Цикл — это ${esc(lc1(matN))}: закупка, переработка и продажа одной партии.${stone ? " Блоки бывают только без зачарования, а зачарованный камень выбирается в «Что купил»." : ""}</span>`;
  const rawK = stone && /^raw[123]$/.test(jf.what) ? +jf.what[3] : 0;
  if (jf.type === "buy") {
    const raws = stone ? [0, 1, 2, 3].map((k) => opt(k ? "raw" + k : "raw", itemLabel(rawId(tg.f, tg.t, k)) + (k ? ` (.${k}, ×${nf1.format(calcSettings(tg.f).mult[k - 1])} блоков)` : ""), k ? jf.what === "raw" + k : !rawK && jf.what !== "prev")).join("")
      : opt("raw", rawN, jf.what !== "prev");
    h += `<label class="field"><span class="k">Что купил</span><select id="jf-what">${raws}${opt("prev", prevN, jf.what === "prev")}</select></label>`;
  }
  if (jf.type !== "refine") {
    const mk = jf.type === "sell" ? pickSell(matId(tg.f, tg.t, tg.e)) : jf.what === "prev" ? pickBuy(matId(tg.f, tg.t - 1, tg.e)) : pickBuy(rawId(tg.f, tg.t, rawK || tg.e));
    h += `<div class="row2">
      <label class="field"><span class="k">Сколько, шт.</span><input type="number" id="jf-qty" min="1" step="1" inputmode="numeric"></label>
      <label class="field"><span class="k">Цена за 1</span><input type="number" id="jf-price" min="0" step="1" inputmode="numeric" placeholder="${mk ? "рынок ~" + Math.round(mk.price) : ""}"></label>
    </div>
    <label class="field"><span class="k">Город</span><select id="jf-city">${CITIES.map((c) => opt(c, c, c === jf.city)).join("")}</select></label>`;
    if (jf.type === "buy") h += `<label class="switch"><input type="checkbox" id="jf-order" ${jf.order ? "checked" : ""}><span class="sw" aria-hidden="true"></span><span>Через свой ордер, +2,5%</span></label>`;
    else h += `<label class="field"><span class="k">Налог</span><select id="jf-fee">${[["0.065", "Свой лот, премиум — 6,5%"], ["0.105", "Свой лот, без премиума — 10,5%"], ["0.04", "В чужой ордер, премиум — 4%"], ["0.08", "В чужой ордер, без премиума — 8%"]].map(([v, l]) => opt(v, l, v === jf.fee)).join("")}</select></label>`;
  } else {
    h += `<div class="row2">
      <label class="field"><span class="k">Получено, шт.</span><input type="number" id="jf-qty" min="1" step="1" inputmode="numeric"></label>
      <label class="field"><span class="k">Станция, всего</span><input type="number" id="jf-station" min="0" step="1" inputmode="numeric" placeholder="0"></label>
    </div><span class="k">Пиши, сколько ${esc(lc1(matN))} получил на выходе вместе с возвратом.</span>`;
  }
  h += `<div class="total"><span class="k" id="jf-total-k">Итого</span><b id="jf-total">—</b></div>
    <button class="btn primary block" type="button" id="jf-save">Записать</button>
    <span class="k">Хранится в этом браузере. Можно выгрузить в файл и загрузить на другом устройстве.</span>`;
  box.innerHTML = h;

  box.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { jf.type = b.dataset.type; save(); renderJForm(); }));
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  on("jf-cycle", "change", (e) => { jf.cycle = e.target.value; save(); renderJForm(); });
  on("jf-f", "change", (e) => { jf.f = e.target.value; if (FAM[jf.f].stone) jf.e = 0; save(); renderJForm(); });
  on("jf-t", "change", (e) => { jf.t = +e.target.value; save(); renderJForm(); });
  on("jf-e", "change", (e) => { jf.e = +e.target.value; save(); renderJForm(); });
  on("jf-what", "change", (e) => { jf.what = e.target.value; save(); renderJForm(); });
  on("jf-city", "change", (e) => { jf.city = e.target.value; save(); });
  on("jf-order", "change", (e) => { jf.order = e.target.checked; save(); total(); });
  on("jf-fee", "change", (e) => { jf.fee = e.target.value; save(); total(); });
  ["jf-qty", "jf-price", "jf-station"].forEach((id) => on(id, "input", total));
  function total() {
    const q = num($("jf-qty").value), p = $("jf-price") ? num($("jf-price").value) : NaN;
    let k = "Итого", v = NaN;
    if (jf.type === "buy") { k = jf.order ? "Итого с комиссией ордера" : "Итого"; v = q * p * (jf.order ? 1.025 : 1); }
    else if (jf.type === "sell") { k = "Выручка после налога"; v = q * p * (1 - +jf.fee); }
    else { k = "Станция за партию"; v = num($("jf-station").value) || 0; }
    $("jf-total-k").textContent = k; $("jf-total").textContent = isFinite(v) ? nf0.format(Math.round(v)) : "—";
  }
  total();
  on("jf-save", "click", () => addEntry(tg));
}
async function addEntry(tg) {
  const jf = S.jf, q = num($("jf-qty").value);
  if (!(q > 0)) { toast("Укажи количество"); $("jf-qty").focus(); return; }
  const e = { id: uid(), ts: Date.now(), type: jf.type, qty: q };
  if (jf.type === "refine") e.station = num($("jf-station").value) || 0;
  else {
    let p = num($("jf-price").value);
    if (!(p > 0)) { const ph = /(\d+)/.exec($("jf-price").placeholder || ""); if (ph) p = +ph[1]; }
    if (!(p > 0)) { toast("Укажи цену за 1"); $("jf-price").focus(); return; }
    e.price = p; e.city = $("jf-city").value;
    if (jf.type === "buy") {
      e.what = jf.what === "prev" ? "prev" : "raw"; e.order = !!jf.order;
      if (FAM[tg.f].stone && /^raw[123]$/.test(jf.what)) { e.rawE = +jf.what[3]; e.mult = calcSettings(tg.f).mult[e.rawE - 1]; }
    }
    else e.fee = +jf.fee;
  }
  let cy = tg.cy;
  if (!cy) {
    cy = { id: uid(), f: tg.f, t: tg.t, e: tg.e, created: Date.now(), closed: null, fc: null, entries: [] };
    J.cycles.push(cy); jf.cycle = cy.id;
    // прогноз по текущему рынку — то, что обещали «Пороги» в момент начала цикла
    const ids = [rawId(tg.f, tg.t, tg.e), matId(tg.f, tg.t - 1, tg.e), matId(tg.f, tg.t, tg.e)];
    if (FAM[tg.f].stone) for (let k = 1; k <= 3; k++) ids.push(rawId(tg.f, tg.t, k));
    await ensure(ids, { history: true });
    const c = calcSettings(tg.f), raw = pickRaw(tg.f, tg.t, tg.e), prev = pickBuy(matId(tg.f, tg.t - 1, tg.e)), sell = pickSell(matId(tg.f, tg.t, tg.e));
    if (raw && prev && sell) {
      const o = economics(tg.t, raw.paid, prev.paid, sell.price, { ...c, bf: 1 }, tg.e);
      cy.fc = { raw: raw.price, prev: prev.price, sell: sell.price, profit: o.profit, margin: o.margin };
    }
  }
  cy.entries.push(e);
  saveJ(); save(); renderJournal(); toast("Записано");
}
function exportJournal() {
  const blob = new Blob([JSON.stringify({ app: "alb-market-tool", v: 1, exported: new Date().toISOString(), ...J }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `albion-journal-${isoDay(new Date())}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importJournal(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.cycles)) throw new Error("bad");
    let added = 0;
    for (const cy of data.cycles) {
      if (!cy || !cy.id || !FAM[cy.f] || !REFINE_TIERS.includes(cy.t) || !Array.isArray(cy.entries)) continue;
      const i = J.cycles.findIndex((x) => x.id === cy.id);
      if (i >= 0) J.cycles[i] = cy; else { J.cycles.push(cy); added++; }
    }
    saveJ(); renderJournal(); toast(`Загружено: ${data.cycles.length} ${plural(data.cycles.length, ["цикл", "цикла", "циклов"])}${added !== data.cycles.length ? `, новых ${added}` : ""}`);
  } catch (e) { toast("Не получилось прочитать файл журнала"); }
}
function openJournal() { renderJournal(); }

// ---------- условия расчёта и тема ----------
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(TKEY, t); } catch (e) {}
  document.querySelectorAll("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeSet === t)));
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = t === "aurora" ? "#f3f5fb" : "#0d1024";
}
function sumHint() {
  const c = calcSettings(), st = S.settings;
  const rp = nf1.format((st.rrr === "custom" ? num(st.rrrc) || 0 : +st.rrr * 100));
  // в шапке — коротко, полный текст — во всплывающей подсказке
  $("sumhint").textContent = [`возврат ${rp}%`, `маржа ${nf1.format(c.m * 100)}%`, st.bonusFam ? `бонус +${st.bonusPct}%` : ""].filter(Boolean).join(" · ");
  $("open-settings").title = `Условия: возврат ${rp}%, маржа ${nf1.format(c.m * 100)}%, закупка ${st.order ? "своим ордером" : "сразу"}${relists() ? `, перевыставлений ${nf1.format(relists())}` : ""}${st.bonusFam ? `, бонус дня: ${FAM[st.bonusFam].tab.toLowerCase()} +${st.bonusPct}%` : ""}`;
  $("s-rrrc").hidden = st.rrr !== "custom";
  const k = calcSettings().k;
  $("s-rrr-hint").textContent = k > 0 && k < 1 ? `С перекрафтом возврата из сырья на 1000 крафтов выйдет ~${nf0.format(1000 / k)} шт. (+${nf0.format((1 / k - 1) * 100)}%): вернувшиеся ресурсы снова идут в переработку, и так до конца.` : "";
}
function rerenderAll() {
  sumHint();
  if (S.view === "prices") { renderPricesTable(); renderPricesWidgets(); }
  if (S.view === "refine") renderRefine();
  if (S.view === "calc") { renderCalcControls(); updateCalc(); }
  if (S.view === "journal") renderJournal();
  if (S.view === "fish") renderFish();
  if (S.view === "pot") renderPot();
  if (S.view === "fav") renderFav();
  renderTicker();
}
// «Условия»: где покупаю и где продаю — по галочке на город. Хотя бы один город в каждом списке остаётся
function renderCityGrid() {
  const st = S.settings, box = $("s-cities");
  const cell = (c, side) => { const on = st[side].includes(c); return `<label class="cg-c"><input type="checkbox" data-side="${side}" data-city="${esc(c)}"${on ? " checked" : ""} aria-label="${side === "buyC" ? "Покупаю" : "Продаю"} в ${esc(c)}"></label>`; };
  box.innerHTML = `<span></span><span class="cg-h">покупаю</span><span class="cg-h">продаю</span>`
    + CITIES.map((c) => `<span class="cg-n">${cityBadge(c)}${esc(c)}${c === "Caerleon" ? ` <small>красная зона</small>` : ""}</span>${cell(c, "buyC")}${cell(c, "sellC")}`).join("");
  box.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => {
    const side = inp.dataset.side, c = inp.dataset.city;
    const next = inp.checked ? [...new Set([...st[side], c])] : st[side].filter((x) => x !== c);
    if (!next.length) { inp.checked = true; toast(side === "buyC" ? "Нужен хотя бы один город для покупки" : "Нужен хотя бы один город для продажи"); return; }
    st[side] = next; rPick.clear(); save(); rerenderAll();
  }));
}
// подсказка под платой станции: сколько это серебра за 1 шт. по тирам
function foodHint() {
  const f = num(S.settings.food) || 0, el = $("s-food-hint"); if (!el) return;
  el.textContent = f > 0 ? `За 1 материал .0: ${[4, 5, 6, 7, 8].map((t) => `T${t} — ${fmt(stationFee(t, 0, { food: f }))}`).join(", ")}. Зачарование .1/.2/.3 — ×2/×4/×8, у камня не меняется`
    : "Написана на станке. Сайт сам посчитает плату для каждого тира";
}
function bindSettings() {
  const st = S.settings;
  $("s-server").value = st.server; renderCityGrid();
  for (const v of OPT_VIEWS) {
    const el = $(`s-tab-${v}`); el.checked = viewOn(v);
    el.addEventListener("change", () => { st.tabs = { ...st.tabs, [v]: el.checked }; save(); applyTabs(); if (!el.checked && S.view === v) location.hash = "refine"; if (v === "fav") rerenderAll(); });
  }
  $("s-mode").value = st.mode; $("s-age").value = st.age;
  $("s-rrr").value = st.rrr; $("s-rrrc").value = st.rrrc; $("s-fee").value = st.fee; $("s-food").value = st.food ?? 0; foodHint();
  $("s-margin").value = st.margin; $("s-buffer").value = st.buffer; $("s-relist").value = st.relist ?? 0; $("s-buy").value = st.order ? "order" : "now";
  $("s-bfam").value = st.bonusFam || ""; $("s-bpct").value = String(st.bonusPct || 10);
  ["s-m1", "s-m2", "s-m3"].forEach((id, i) => ($(id).value = st.m[i]));
  const on = (id, fn, ev = "input") => $(id).addEventListener(ev, (e) => { fn(e.target); save(); rerenderAll(); });
  on("s-rrr", (el) => (st.rrr = el.value), "change"); on("s-rrrc", (el) => (st.rrrc = el.value));
  on("s-fee", (el) => (st.fee = el.value), "change"); on("s-food", (el) => { st.food = el.value; foodHint(); });
  on("s-margin", (el) => (st.margin = el.value)); on("s-buffer", (el) => (st.buffer = el.value)); on("s-relist", (el) => (st.relist = el.value));
  on("s-buy", (el) => (st.order = el.value === "order"), "change"); on("s-age", (el) => (st.age = el.value));
  on("s-mode", (el) => (st.mode = el.value), "change");
  on("s-bfam", (el) => (st.bonusFam = el.value), "change"); on("s-bpct", (el) => (st.bonusPct = +el.value), "change");
  ["s-m1", "s-m2", "s-m3"].forEach((id, i) => on(id, (el) => (st.m[i] = el.value)));
  $("s-server").addEventListener("change", (e) => { st.server = e.target.value; save(); sumHint(); tickerLoaded = false; route(); loadTicker(); });
  const dlg = $("settings");
  $("open-settings").addEventListener("click", () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  document.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));
  document.querySelectorAll("[data-reload]").forEach((b) => b.addEventListener("click", () => ({ prices: openPrices, fish: openFish, pot: openPot, fav: openFav }[b.dataset.reload] || openRefine)(true)));
  document.querySelectorAll("[data-open-sheet]").forEach((b) => b.addEventListener("click", () => openSheet(b.dataset.openSheet)));
  document.querySelectorAll("[data-close-sheet]").forEach((b) => b.addEventListener("click", closeSheet));
  $("scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  window.matchMedia("(max-width: 760px)").addEventListener("change", (e) => { if (!e.matches) closeSheet(); });
  $("p-freset").addEventListener("click", () => { S.pFams = [...FAMS]; S.pTiers = [...ALL_TIERS]; S.pEnchs = [0]; S.pKind = "all"; save(); openPrices(); });
  $("r-freset").addEventListener("click", () => { S.rFams = [...FAMS]; S.rTiers = [...REFINE_TIERS]; S.rEnchs = [0]; S.rOnlyPlus = false; S.rSort = "margin"; save(); openRefine(); });
  $("r-onlyplus").addEventListener("change", (e) => { S.rOnlyPlus = e.target.checked; save(); renderRefineControls(); renderRefine(); });
  $("r-sort-m").addEventListener("change", (e) => { S.rSort = e.target.value; save(); renderRefineControls(); renderRefine(); });
  $("c-fill").addEventListener("click", () => marketFill("hist"));
  $("c-fill-live").addEventListener("click", () => marketFill("live"));
  $("c-reset").addEventListener("click", () => { S.calc[S.cFam] = emptyCalc(); save(); buildTiers(); updateCalc(); });
  $("j-export").addEventListener("click", exportJournal);
  $("j-import").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) importJournal(f); e.target.value = ""; });
}

// ---------- навигация ----------
// ---------- вкладка «Рыба» ----------
// Выход разделанной рыбы — из игровых данных (рецепт «Разделанной рыбы» у мясника):
// обычная рыба T1–T8 даёт 1/2/3/4/6/8/10/14 шт., редкая T3/T5/T7 — 10/20/30, акула — 200
const CHOPS = "T1_FISHCHOPS", WEED = "T1_SEAWEED";
const FISH_COMMON_YIELD = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 8, 7: 10, 8: 14 }, FISH_RARE_YIELD = { 3: 10, 5: 20, 7: 30 };
const FISH_RARE = ["FRESHWATER_FOREST", "FRESHWATER_MOUNTAIN", "FRESHWATER_HIGHLANDS", "FRESHWATER_STEPPE", "FRESHWATER_SWAMP", "FRESHWATER_AVALON", "FRESHWATER_DRAGON_AREA", "SALTWATER_ALL"];
// соус: сколько разделанной рыбы и водорослей
const SAUCES = [["T1_FISHSAUCE_LEVEL1", 15, 1], ["T1_FISHSAUCE_LEVEL2", 45, 3], ["T1_FISHSAUCE_LEVEL3", 135, 9]];
function fishGroups() {
  const tiers = Object.keys(FISH_COMMON_YIELD).map(Number);
  const rare = [];
  for (const t of Object.keys(FISH_RARE_YIELD).map(Number)) for (const r of FISH_RARE) rare.push({ id: `T${t}_FISH_${r}_RARE`, y: FISH_RARE_YIELD[t] });
  rare.push({ id: "T8_FISH_SALTWATER_ALL_BOSS_SHARK", y: 200 });
  return [
    { name: "Обычная пресноводная", rows: tiers.map((t) => ({ id: `T${t}_FISH_FRESHWATER_ALL_COMMON`, y: FISH_COMMON_YIELD[t] })) },
    { name: "Обычная морская", rows: tiers.map((t) => ({ id: `T${t}_FISH_SALTWATER_ALL_COMMON`, y: FISH_COMMON_YIELD[t] })) },
    { name: "Редкая", rows: rare },
  ];
}
const fishIds = () => [...fishGroups().flatMap((g) => g.rows.map((r) => r.id)), CHOPS, WEED, ...SAUCES.map((x) => x[0])];
function fishIcon(id, size = 40) {
  const t = /^T(\d)/.exec(id)[1];
  const local = `images/items/${id}.webp`, remote = `https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?size=128&amp;quality=1`;
  return `<span class="ic t${t}" style="--s:${size}px;--tc:var(--t${t})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12c3-4 7-6 11-6 3 0 5 2 7 6-2 4-4 6-7 6-4 0-8-2-11-6z"/></svg>`
    + `<img src="${local}" data-remote="${remote}" alt="" loading="lazy" decoding="async" onload="this.previousElementSibling&&this.previousElementSibling.tagName==='svg'&&this.previousElementSibling.remove()" onerror="if(this.dataset.remote){this.src=this.dataset.remote;this.dataset.remote=''}else this.remove()">`
    + `<span class="tier">T${t}</span></span>`;
}
// цена продажи своим лотом в лучшем городе из «продаю» — как в «Переработке»
const fishSell = (id) => pickSell(id);
function fishCell(o) {
  if (!o) return `<td><span class="empty">нет цены</span></td>`;
  return `<td><span class="v">${fmt(o.price)}</span><div class="where">${cityHtml(o.city)}<span class="age">${srcAge(o)}</span></div>${isFinite(o.vol) ? `<small>${liqDot(o.vol)}~${nf0.format(o.vol)} в день</small>` : ""}</td>`;
}
function fishVerdict(sell, chopsTotal) {
  if (!sell && !isFinite(chopsTotal)) return { html: `<span class="pill none">нет цен</span>`, txt: "нет цен" };
  if (!sell) return { html: `<span class="pill none">нет цены рыбы</span>`, txt: "нет цены рыбы" };
  if (!isFinite(chopsTotal)) return { html: `<span class="pill none">нет цены разделки</span>`, txt: "нет цены разделки" };
  const d = chopsTotal - sell.price, pct = d / sell.price;
  return d > 0
    ? { html: `<span class="pill good">разделай ${fmtSigned(d)} (${fmtPct(pct, true)})</span>`, txt: `разделай ${fmtSigned(d)}` }
    : { html: `<span class="pill warn">продай целиком ${fmtSigned(-d)}</span>`, txt: `продай ${fmtSigned(-d)}` };
}
function renderFish() {
  const chops = fishSell(CHOPS), weed = fishSell(WEED), cp = chops ? chops.price : NaN;
  // виджеты: цена разделанной рыбы и соусы
  const own = S.fishWeed === "own", wp = own ? 0 : weed ? weed.price : NaN;
  const sauceRows = SAUCES.map(([id, n, w]) => {
    const o = fishSell(id), inp = n * cp + w * wp, d = o ? o.price - inp : NaN;
    return `<div class="b-line"><span class="b-lbl">${fishIcon(id, 34)} ${esc(itemLabel(id))}<small class="age"> ${n} рыбы + ${w} водор.</small></span>`
      + `<span class="b-where">${o ? cityHtml(o.city) + `<span class="age">${fmt(o.price)}</span>` : `<span class="empty">нет цены</span>`}</span>`
      + `<b class="b-val ${isFinite(d) ? (d > 0 ? "pos" : "neg") : ""}">${isFinite(d) ? fmtSigned(d) : "—"}</b></div>`;
  }).join("");
  $("f-widgets").innerHTML = `<div class="panel widget"><div class="w-head"><span class="k">Разделанная рыба</span></div>
      <div class="b-list inset"><div class="b-line"><span class="b-lbl">${fishIcon(CHOPS, 34)} ${esc(itemLabel(CHOPS))}</span><span class="b-where">${chops ? cityHtml(chops.city) + `<span class="age">${srcAge(chops)}</span>` : ""}</span><b class="b-val">${chops ? fmt(chops.price) : "нет цены"}</b></div>
      <div class="b-line"><span class="b-lbl">${fishIcon(WEED, 34)} ${esc(itemLabel(WEED))}</span><span class="b-where">${weed ? cityHtml(weed.city) + `<span class="age">${srcAge(weed)}</span>` : ""}</span><b class="b-val">${weed ? fmt(weed.price) : "нет цены"}</b></div></div>
      <p class="k" style="margin:0">Разделывают у мясника. Плату станции и возврат ресурсов не учитываем — для рыбы они небольшие.</p></div>
    <div class="panel widget"><div class="w-head"><span class="k">Соус или продать разделанную рыбу</span>
      <div class="seg" role="group" aria-label="Водоросли"><button type="button" data-weed="market" aria-pressed="${!own}" title="Водоросли по рыночной цене">водоросли по рынку</button><button type="button" data-weed="own" aria-pressed="${own}" title="Свои водоросли, не считать">свои</button></div></div>
      <div class="b-list inset">${sauceRows}</div>
      <p class="k" style="margin:0">Сколько серебра даёт 1 соус сверх продажи рыбы и водорослей, которые на него уходят. Без возврата ресурсов при готовке: с ним соус выгоднее.</p></div>`;
  $("f-widgets").querySelectorAll("[data-weed]").forEach((b) => b.addEventListener("click", () => { S.fishWeed = b.dataset.weed; save(); renderFish(); }));
  // таблица
  let h = `<thead><tr><th scope="col">Рыба</th><th scope="col">Продать рыбу</th><th scope="col">Если разделать</th><th scope="col">Выгоднее</th></tr></thead><tbody>`, m = "";
  for (const g of fishGroups()) {
    h += `<tr class="group"><td colspan="4">${g.name}</td></tr>`;
    m += `<div class="k tdiv" style="--tc:var(--muted)">${g.name}</div>`;
    for (const r of g.rows) {
      const sell = fishSell(r.id), tot = r.y * cp, v = fishVerdict(sell, tot);
      const name = `<div class="item">${fishIcon(r.id)}<div class="iname"><b>${esc(itemLabel(r.id))}</b><small>разделка: ${r.y} шт.</small></div>${favBtn(r.id)}</div>`;
      h += `<tr><td>${name}</td>${fishCell(sell)}<td>${isFinite(tot) ? `<span class="v">${fmt(tot)}</span><div class="where"><span class="age">${r.y} × ${fmt(cp)}</span></div>` : `<span class="empty">нет цены</span>`}</td><td>${v.html}</td></tr>`;
      m += `<section class="panel card"><div class="card-h">${fishIcon(r.id, 42)}<div class="iname"><b>${esc(itemLabel(r.id))}</b><small>разделка: ${r.y} шт.</small></div>${favBtn(r.id)}</div>`
        + `<div class="m-line"><span class="k">Продать</span>${sell ? `${cityHtml(sell.city)}<span class="age">${srcAge(sell)}</span><b>${fmt(sell.price)}</b>` : `<b class="empty">нет цены</b>`}</div>`
        + `<div class="m-line"><span class="k">Разделать</span><span class="age">${r.y} × ${fmt(cp)}</span><b>${isFinite(tot) ? fmt(tot) : "—"}</b></div>`
        + `<div class="m-line">${v.html}</div></section>`;
    }
  }
  $("f-table").innerHTML = h + "</tbody>";
  $("f-cards").innerHTML = m;
}
async function openFish(force = false) {
  renderFish();
  await ensure(fishIds(), { history: true, force });
  if (S.view === "fish") renderFish();
}

// ---------- вкладка «Зелья» ----------
// Рецепты — из игровых данных: [id, фокус за крафт, зелий за крафт, [[ингредиент, кол-во]…]]
const POTS = [["T2_POTION_HEAL",56,5,[["T2_AGARIC",8]]],["T2_POTION_ENERGY",56,5,[["T2_AGARIC",8]]],["T3_POTION_REVIVE",56,5,[["T3_COMFREY",8]]],["T3_POTION_STONESKIN",56,5,[["T3_COMFREY",8]]],["T3_POTION_SLOWFIELD",56,5,[["T3_COMFREY",8]]],["T3_POTION_ACID",56,10,[["T3_ALCHEMY_RARE_DIREBEAR",1],["T3_COMFREY",16]]],["T3_POTION_MOB_RESET",56,10,[["T3_ALCHEMY_RARE_PANTHER",1],["T3_COMFREY",16]]],["T5_POTION_MOB_RESET",294,10,[["T5_ALCHEMY_RARE_PANTHER",1],["T5_TEASEL",48],["T4_BURDOCK",24],["T2_AGARIC",12]]],["T7_POTION_MOB_RESET",1272,10,[["T7_ALCHEMY_RARE_PANTHER",1],["T7_MULLEIN",144],["T6_FOXGLOVE",72],["T3_COMFREY",72],["T2_AGARIC",36],["T7_ALCOHOL",36]]],["T3_POTION_CLEANSE2",56,10,[["T3_ALCHEMY_RARE_ENT",1],["T3_COMFREY",16]]],["T5_POTION_CLEANSE2",298,10,[["T5_ALCHEMY_RARE_ENT",1],["T5_TEASEL",48],["T3_COMFREY",24],["T4_BUTTER",12]]],["T7_POTION_CLEANSE2",1283,10,[["T7_ALCHEMY_RARE_ENT",1],["T7_MULLEIN",144],["T4_BURDOCK",72],["T3_COMFREY",72],["T6_BUTTER",36],["T7_ALCOHOL",36]]],["T5_POTION_ACID",294,10,[["T5_ALCHEMY_RARE_DIREBEAR",1],["T5_TEASEL",48],["T4_BURDOCK",24],["T4_MILK",12]]],["T7_POTION_ACID",1296,10,[["T7_ALCHEMY_RARE_DIREBEAR",1],["T7_MULLEIN",144],["T6_FOXGLOVE",72],["T6_ALCOHOL",72],["T6_MILK",36],["T7_ALCOHOL",36]]],["T4_POTION_BERSERK",56,10,[["T3_ALCHEMY_RARE_WEREWOLF",1],["T4_BURDOCK",16]]],["T6_POTION_BERSERK",298,10,[["T5_ALCHEMY_RARE_WEREWOLF",1],["T6_FOXGLOVE",48],["T2_AGARIC",24],["T6_ALCOHOL",12]]],["T8_POTION_BERSERK",1307,10,[["T7_ALCHEMY_RARE_WEREWOLF",1],["T8_YARROW",144],["T3_COMFREY",72],["T6_ALCOHOL",72],["T7_ALCOHOL",36],["T8_ALCOHOL",36]]],["T8_POTION_CLEANSE",1272,5,[["T8_YARROW",72],["T7_MULLEIN",36],["T5_TEASEL",36],["T8_MILK",18],["T8_ALCOHOL",18]]],["T4_POTION_COOLDOWN",84,5,[["T4_BURDOCK",8],["T3_COMFREY",4]]],["T6_POTION_COOLDOWN",378,5,[["T6_FOXGLOVE",24],["T5_TEASEL",12],["T3_COMFREY",12],["T6_MILK",6]]],["T8_POTION_COOLDOWN",1272,5,[["T8_YARROW",72],["T7_MULLEIN",36],["T5_TEASEL",36],["T8_MILK",18],["T8_ALCOHOL",18]]],["T4_POTION_ENERGY",210,5,[["T4_BURDOCK",24],["T4_MILK",6]]],["T6_POTION_ENERGY",768,5,[["T6_FOXGLOVE",72],["T6_MILK",18],["T6_ALCOHOL",18]]],["T4_POTION_GATHER",61,10,[["T3_ALCHEMY_RARE_ELEMENTAL",1],["T4_BUTTER",16]]],["T6_POTION_GATHER",310,10,[["T5_ALCHEMY_RARE_ELEMENTAL",1],["T6_BUTTER",48],["T6_FOXGLOVE",24],["T5_TEASEL",12]]],["T8_POTION_GATHER",1319,10,[["T7_ALCHEMY_RARE_ELEMENTAL",1],["T8_BUTTER",144],["T8_YARROW",72],["T7_MULLEIN",72],["T6_FOXGLOVE",36],["T8_ALCOHOL",36]]],["T4_POTION_HEAL",210,5,[["T4_BURDOCK",24],["T3_EGG",6]]],["T6_POTION_HEAL",768,5,[["T6_FOXGLOVE",72],["T5_EGG",18],["T6_ALCOHOL",18]]],["T4_POTION_LAVA",56,10,[["T3_ALCHEMY_RARE_IMP",1],["T4_MILK",16]]],["T6_POTION_LAVA",294,10,[["T5_ALCHEMY_RARE_IMP",1],["T6_MILK",48],["T6_FOXGLOVE",24],["T3_EGG",12]]],["T8_POTION_LAVA",1272,10,[["T7_ALCHEMY_RARE_IMP",1],["T8_MILK",144],["T8_YARROW",72],["T7_MULLEIN",72],["T5_EGG",36],["T8_ALCOHOL",36]]],["T4_POTION_LIFEWARD",56,10,[["T4_ALCHEMY_RARE_DRAGONAREA",1],["T4_BURDOCK",16]]],["T6_POTION_LIFEWARD",294,10,[["T6_ALCHEMY_RARE_DRAGONAREA",1],["T6_FOXGLOVE",48],["T5_TEASEL",24],["T2_AGARIC",12]]],["T8_POTION_LIFEWARD",1296,10,[["T8_ALCHEMY_RARE_DRAGONAREA",1],["T8_YARROW",144],["T7_MULLEIN",72],["T5_TEASEL",72],["T2_AGARIC",36],["T8_ALCOHOL",36]]],["T5_POTION_REVIVE",294,5,[["T5_TEASEL",24],["T4_BURDOCK",12],["T5_EGG",6]]],["T7_POTION_REVIVE",1020,5,[["T7_MULLEIN",72],["T6_FOXGLOVE",36],["T5_EGG",18],["T7_ALCOHOL",18]]],["T5_POTION_SLOWFIELD",294,5,[["T5_TEASEL",24],["T4_BURDOCK",12],["T5_EGG",6]]],["T7_POTION_SLOWFIELD",1272,5,[["T7_MULLEIN",72],["T6_FOXGLOVE",36],["T4_BURDOCK",36],["T5_EGG",18],["T7_ALCOHOL",18]]],["T5_POTION_STONESKIN",294,5,[["T5_TEASEL",24],["T4_BURDOCK",12],["T4_MILK",6]]],["T7_POTION_STONESKIN",1272,5,[["T7_MULLEIN",72],["T6_FOXGLOVE",36],["T4_BURDOCK",36],["T6_MILK",18],["T7_ALCOHOL",18]]],["T4_POTION_TORNADO",56,10,[["T3_ALCHEMY_RARE_EAGLE",1],["T4_BURDOCK",16]]],["T6_POTION_TORNADO",294,10,[["T5_ALCHEMY_RARE_EAGLE",1],["T6_FOXGLOVE",48],["T5_TEASEL",24],["T3_EGG",12]]],["T8_POTION_TORNADO",1296,10,[["T7_ALCHEMY_RARE_EAGLE",1],["T8_YARROW",144],["T7_MULLEIN",72],["T7_ALCOHOL",72],["T5_EGG",36],["T8_ALCOHOL",36]]]];
// возврат при алхимии: Брецилиэн даёт +15% к крафту зелий (бонус производства 0,18 + 0,15), фокус — ещё +0,59
const POT_RRR = { brec: [0.248, 0.479], city: [0.152, 0.435] };
// редкие алхимические ингредиенты (с монстров) в возврат не считаем — не уверены, что они возвращаются
const isRareAlch = (id) => id.includes("_ALCHEMY_RARE_");
const potTier = (id) => +id[1];
const POT_TIERS = [2, 3, 4, 5, 6, 7, 8];
// сортировка таблицы зелий: по марже, прибыли с 1 шт. или объёму продаж в день
const POT_SORT = { margin: (r) => r.margin, profit: (r) => r.profit, vol: (r) => (isFinite(r.sell.vol) ? r.sell.vol : -1) };
const potIds = () => [...new Set(POTS.flatMap(([id, , , ing]) => [id, ...ing.map((x) => x[0])]))];
function potRows() {
  const c = calcSettings(), [r0, rf] = POT_RRR[S.potWhere] || POT_RRR.brec, r = S.potFocus ? rf : r0;
  return POTS.map(([id, F, out, ing]) => {
    const parts = ing.map(([i, n]) => ({ id: i, n, o: pickBuy(i) }));
    const sell = pickSell(id);
    if (parts.some((x) => !x.o) || !sell) return { id, ing: parts, sell, ok: false };
    const keep = (x, rr) => (isRareAlch(x.id) ? 1 : 1 - rr);
    const cost = parts.reduce((a, x) => a + x.n * x.o.paid * keep(x, r), 0) / out;
    const net = sell.price * (1 - c.buf) * (1 - c.fee), profit = net - cost;
    // сколько серебра даёт 1 очко фокуса: экономия ингредиентов от фокуса / фокус на 1 зелье
    const gain = parts.reduce((a, x) => a + (isRareAlch(x.id) ? 0 : x.n * x.o.paid * (rf - r0)), 0) / out;
    const costF = parts.reduce((a, x) => a + x.n * x.o.paid * keep(x, rf), 0) / out;
    const inputs = parts.reduce((a, x) => a + x.n * x.o.paid, 0);
    return { id, ing: parts, sell, ok: true, cost, net, profit, margin: profit / cost, perPoint: F ? gain / (F / out) : NaN, out, F, r, rf, inputs, profitF: net - costF };
  });
}
// обычная цена ингредиента: сделки за неделю во всех отмеченных городах (купить можно где угодно).
// В истории AODP — средние цены всех сделок за день, и с лотов, и в ордера, так что это ориентир, а не точная граница
function weekRef(id) { return statsOf(activeCities().flatMap((c) => histPts(id, c, 8)).sort((a, b) => a.t - b.t)); }
// дёшево — не дороже нижней пятой сделок (P20), дорого — дороже верхней пятой (P80)
function priceLevel(p, ref) {
  if (!ref) return "";
  if (p <= ref.p20) return "cheap";
  if (p > ref.p80) return "dear";
  return "";
}
// раскрытые строки «Зелий» (живут, пока открыта страница)
const potOpen = new Set();
function potDet(r) {
  const c = calcSettings(), kv = (k, v, cls = "") => `<div class="dl"><span>${k}</span><b class="${cls}">${v}</b></div>`;
  if (!r.ok) return `<div class="det-grid"><div class="det-b"><h4>Не хватает цен</h4><p class="dn">Нет свежих цен: ${esc([...r.ing.filter((x) => !x.o).map((x) => itemLabel(x.id)), r.sell ? "" : "продажа зелья"].filter(Boolean).join(", "))}. Попробуй обновить цены или проверь города в «Условиях».</p></div></div>`;
  let h = `<div class="det-grid pdet">`;
  const hint = (t) => `<span class="phint" tabindex="0" title="${esc(t)}">?</span>`;
  // ингредиенты: строки — ингредиенты, столбцы — города «покупаю»; самый дешёвый город подсвечен
  const cities = buyCities();
  const head = `<tr><th scope="col"></th>${cities.map((cc) => `<th scope="col">${cityBadge(cc)}</th>`).join("")}<th scope="col">за крафт</th></tr>`;
  const body = r.ing.map((x) => {
    const how = howOf(x.o), ref = weekRef(x.id);
    const cells = cities.map((cc) => {
      const q = quoteBuy(x.id, cc, how);
      if (!q) return `<td class="na">—</td>`;
      const best = cc === x.o.city, lv = q.odd ? "" : priceLevel(q.price, ref);
      const tip = `${cc}: ${q.src === "order" ? "свой ордер" : "лот"} ${fmt(q.price)}${q.age !== undefined ? `, ${fmtAge(q.age)} назад` : ""}${isFinite(q.vol) ? `, ~${nf0.format(q.vol)} в день` : ""}${q.odd ? ". Не похоже на реальную цену" : ""}${ref ? `. Обычно за неделю: ${fmt(ref.p20)}–${fmt(ref.p80)}, медиана ${fmt(ref.med)}` : ""}`;
      return `<td class="${best ? "best" : ""}${q.odd ? " odd" : ""}" title="${esc(tip)}"><span class="qc"><span class="qp ${lv}">${fmt(q.price)}${q.manual ? MSTAR : ""}</span><small class="qa${q.age > 24 ? " old" : ""}">${q.age !== undefined ? fmtAge(q.age) : ""}</small></span></td>`;
    }).join("");
    return `<tr><th scope="row"><span class="ingn">${fishIcon(x.id, 26)}<span><b>${esc(itemLabel(x.id))}</b><small>×${x.n}${isRareAlch(x.id) ? " · без возврата" : ""}</small></span>${favBtn(x.id, true)}</span></th>${cells}<td class="sum">${fmt(x.n * x.o.paid)}</td></tr>`;
  }).join("");
  const how0 = r.ing.some((x) => x.o.src === "order") ? `свой ордер (лучший ордер +1), если ордеров нет — лот. «За крафт» — сколько уйдёт на ингредиент за один крафт: цена × количество, для ордера ещё +${fmtPct(orderFee() - 1)} сбора за выставление${relists() ? " с учётом перевыставлений" : ""}` : "самый дешёвый лот. «За крафт» — цена × количество на один крафт";
  const legend = `Цена — ${how0.replace(/<[^>]+>/g, "")}. Рамка — самый дешёвый город. Цвет цены — сравнение со сделками за неделю по всем городам: зелёная — дешевле обычного (в нижних 20%), красная — дороже обычного (в верхних 20%). Рядом — возраст цены, старше суток — жёлтым. При наведении на цену — обычный диапазон и объём продаж.`;
  h += `<div class="det-b ing"><h4>Ингредиенты на 1 крафт → ${r.out} шт. ${hint(legend)}</h4>
    <div class="imx-wrap"><table class="imx"><thead>${head}</thead><tbody>${body}</tbody>
      <tfoot><tr><th scope="row">Всего за крафт</th><td colspan="${cities.length}"></td><td class="sum">${fmt(r.inputs)}</td></tr></tfoot></table></div></div><div class="pstack">`;
  // продажа по городам
  const sells = sellCities().map((cc) => ({ c: cc, o: sellIn(r.id, cc) })).filter((x) => x.o).sort((a, b) => b.o.price - a.o.price);
  const net = (p) => p * (1 - c.buf) * (1 - c.fee) - r.cost, liq = liquidity(r.sell.vol);
  const totVol = sells.reduce((a, x) => a + (isFinite(x.o.vol) ? x.o.vol : 0), 0);
  h += `<div class="det-b"><h4>Продажа ${hint(`Город · продаётся в день · цена · прибыль с 1 шт. Всего по городам ~${nf0.format(totVol)} в день. Цена за вычетом уценки ${fmtPct(c.buf)} и налога ${fmtPct(c.fee)}.`)}</h4>${sells.map(({ c: cc, o }) => `<div class="dl ws${cc === r.sell.city ? " on" : ""}">${cityBadge(cc)}<span class="ws-v">${isFinite(o.vol) ? `~${nf0.format(o.vol)} в день` : o.noHist ? "нет сделок — цена ограничена" : ""}</span><b>${fmt(o.price)}</b><b class="${net(o.price) >= 0 ? "pos" : "neg"}">${fmtSigned(net(o.price))}</b></div>`).join("")}
    <p class="dn">${liqDot(r.sell.vol)} В ${esc(r.sell.city)} ${esc(liq.txt)}</p></div>`;
  // деньги
  const cls = r.profit >= 0 ? "pos" : "neg", rare = r.ing.some((x) => isRareAlch(x.id));
  h += `<div class="det-b"><h4>Деньги</h4>`
    + kv("Себестоимость 1 шт.", fmt(r.cost))
    + `<p class="dn">(ингредиенты ${fmt(r.inputs)} за крафт${r.ing.some((x) => x.o.fee > 1) ? ", с комиссией ордера" : ""}) × (1 − возврат ${fmtPct(r.r)})${rare ? ", редкий ингредиент без возврата" : ""} / ${r.out} шт.</p>`
    + kv("Вложить на стак", fmtBig(r.cost * STACK, false))
    + (isFinite(r.perPoint) ? kv("Серебро за очко фокуса", fmt(r.perPoint)) : "")
    + (S.potFocus ? "" : kv(`С фокусом (возврат ${fmtPct(r.rf)})`, fmtBig(r.profitF * STACK) + " за стак", r.profitF >= 0 ? "pos" : "neg"))
    + (r.F ? `<p class="dn">Фокуса на стак ~${nf0.format(r.F / r.out * STACK)} без специализации</p>` : "")
    + `</div>`;
  return h + `</div></div>`;
}
const bindPotDet = (root) => bindDet(root);
// график цены сделок за 14 дней в городе продажи
function potSpark(r) {
  const ser = r.sell ? series7(r.id, r.sell.city, 15) : null;
  return ser ? `<div class="psp">${spark(ser.vals, 110, 30)}<small class="${ser.delta >= 0 ? "pos" : "neg"}">${fmtPct(ser.delta, true)}</small></div>` : `<span class="empty">мало сделок</span>`;
}
// виджеты над таблицей: лучшее зелье по марже (из тех, что продаются хотя бы 50 шт. в день) и следующие 4
const potFold = { open: false };
function renderPotWidgets(all) {
  const box = $("pot-widgets"); if (!box) return;
  const liquid = all.filter((r) => r.ok && r.profit > 0 && isFinite(r.sell.vol) && r.sell.vol >= MIN_VOL);
  const plus = [...liquid].sort((a, b) => b.margin - a.margin);
  const title = `<div class="w-head"><span class="k">Лучшее прямо сейчас</span><span class="k">по марже, из тех, что продаются от ${MIN_VOL} шт. в день</span></div>`;
  if (!plus.length) {
    const loading = pending > 0 && !all.some((r) => r.ok);
    box.innerHTML = `<div class="panel widget best span2">${title}<p class="w-empty">${loading ? "Загружаю цены…" : "При этих условиях ни одно зелье не выходит в плюс. Попробуй другие тиры или фокус."}</p></div>`;
    return;
  }
  const b = plus[0];
  const line = (lbl, o, val) => `<div class="b-line"><span class="b-lbl">${lbl}</span><span class="b-where">${o ? cityHtml(o.city) + `<span class="age">${srcAge(o)}</span>` : ""}</span><b class="b-val">${val}</b></div>`;
  const tile = (k, v, sub, cls = "") => `<div class="ptile"><span class="k">${k}</span><b class="${cls}">${v}</b><small>${sub}</small></div>`;
  let h = `<div class="panel widget best span2 pbest" style="--tc:var(--t${potTier(b.id)})">${title}
    <div class="b-head">${fishIcon(b.id, 64)}<div class="b-txt"><div class="b-title">${esc(itemLabel(b.id))}</div><div class="b-recipe">T${potTier(b.id)} · ${b.out} шт. за крафт</div></div><div class="b-pct">${nf0.format(b.margin * 100)}%</div></div>
    <div class="ptiles">${tile("Себестоимость", fmt(b.cost), "за 1 шт.")}${tile("Продажа", fmt(b.sell.price), cityHtml(b.sell.city))}${tile("Прибыль за стак", fmtBig(b.profit * STACK), `${fmtSigned(b.profit)} за шт.`, "pos")}${tile("Продаётся", nf0.format(b.sell.vol), `${liqDot(b.sell.vol)}в день`)}</div>
    <button type="button" class="pfold${potFold.open ? " on" : ""}" aria-expanded="${potFold.open}">${CHEV}<span>Где брать ингредиенты</span><span class="k">${b.ing.length} шт. · ${fmt(b.inputs)} за крафт</span></button>
    ${potFold.open ? `<div class="b-list inset">${b.ing.map((x) => line(`${x.o.src === "order" ? "Ордер на" : "Купи"} ${esc(lc1(itemLabel(x.id)))} ×${x.n}`, x.o, fmt(x.o.price))).join("")}</div>` : ""}</div>`;
  // справа — следующие 5: по марже (без лучшего), за стак или на фокус
  const tops = {
    margin: { rows: plus.slice(1), col: "Маржа", v: (r) => `<b style="color:${levelColor(r.margin, r.profit, calcSettings().m)}">${nf0.format(r.margin * 100)}%</b>` },
    stack: { rows: [...liquid].sort((x, y) => y.profit - x.profit), col: "За стак", v: (r) => `<b class="pos">${fmtBig(r.profit * STACK)}</b>` },
    focus: { rows: liquid.filter((r) => isFinite(r.perPoint) && r.profitF > 0).sort((x, y) => y.perPoint - x.perPoint), col: "За очко", v: (r) => `<b>${fmt(r.perPoint)}</b>` },
  };
  const tp = tops[S.potTop] ? S.potTop : "margin", cur = tops[tp], rows = cur.rows.slice(0, 4);
  h += `<div class="panel widget span2 tops ptops"><div class="w-head"><div class="seg" role="group" aria-label="Список">${[["margin", "По марже"], ["stack", "За стак"], ["focus", "На фокус"]].map(([v, l]) => `<button type="button" data-ptop="${v}" aria-pressed="${v === tp}">${l}</button>`).join("")}</div>`
    + `<span class="k">${tp === "margin" ? "следом за лучшим" : tp === "focus" ? "серебра на 1 очко фокуса" : "прибыль за стак 999"}</span></div>`
    + (rows.length ? `<table class="pmini"><thead><tr><th scope="col">Зелье</th><th scope="col">Продажа</th><th scope="col">За 1 шт.</th><th scope="col">${cur.col}</th><th scope="col">В день</th></tr></thead><tbody>`
      + rows.map((r) => `<tr data-key="${r.id}" tabindex="0"><th scope="row"><span class="pm-nm">${fishIcon(r.id, 30)}<span>${esc(itemLabel(r.id))}</span></span></th><td><b>${fmt(r.sell.price)}</b><small>${cityHtml(r.sell.city)}</small></td><td><b class="pos">${fmtSigned(r.profit)}</b></td><td>${cur.v(r)}</td><td>${liqDot(r.sell.vol)}${nf0.format(r.sell.vol)}</td></tr>`).join("")
      + `</tbody></table>` : `<p class="w-empty">${tp === "margin" ? "Других зелий в плюсе нет." : "Пока нечего показать."}</p>`)
    + `</div>`;
  box.innerHTML = h;
  box.querySelector(".pfold").addEventListener("click", () => { potFold.open = !potFold.open; renderPotWidgets(all); });
  box.querySelectorAll("[data-ptop]").forEach((el) => el.addEventListener("click", () => { S.potTop = el.dataset.ptop; save(); renderPotWidgets(all); }));
  box.querySelectorAll(".pmini tr[data-key]").forEach((el) => {
    el.addEventListener("click", () => openPotRow(el.dataset.key));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPotRow(el.dataset.key); } });
  });
}
function openPotRow(id) {
  potOpen.add(id);
  if (!S.potTiers.includes(potTier(id))) S.potTiers = toggleIn(S.potTiers, potTier(id), POT_TIERS);
  renderPot();
  const el = document.querySelector(`${isMobile() ? "#pot-cards .card" : "#pot-table tr.rrow"}[data-key="${id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}
function renderPot() {
  const key = POT_SORT[S.potSort], dir = S.potDir;
  const all = potRows().filter((r) => S.potTiers.includes(potTier(r.id)));
  const rows = all.sort((a, b) => (a.ok !== b.ok ? (a.ok ? -1 : 1) : !a.ok ? 0 : dir * (key(a) - key(b)) || b.margin - a.margin));
  const shown = S.potPlus ? rows.filter((r) => r.ok && r.profit > 0) : rows, c0 = calcSettings();
  renderPotWidgets(all);
  const seg = (key, items) => `<span class="seg">${items.map(([v, l]) => `<button type="button" data-pk="${key}" data-v="${v}" aria-pressed="${String(S[key]) === String(v)}">${l}</button>`).join("")}</span>`;
  const [r0, rf] = POT_RRR[S.potWhere] || POT_RRR.brec;
  const allT = S.potTiers.length === POT_TIERS.length;
  $("pot-ctrl").innerHTML = `<span class="fsum">Тир</span><span class="chips tier-chips" id="pot-tiers"></span>`
    + `<span class="fsum">Где варишь</span>${seg("potWhere", [["brec", "Брецилиэн +15%"], ["city", "другой город"]])}`
    + `<span class="fsum">Фокус</span>${seg("potFocus", [["false", "без фокуса"], ["true", "с фокусом"]])}`
    + `<label class="switch"><input type="checkbox" id="pot-plus"${S.potPlus ? " checked" : ""}><span class="sw" aria-hidden="true"></span><span>Только в плюсе</span></label>`
    + `<span class="k">возврат ${fmtPct(S.potFocus ? rf : r0)}</span>`
    + `<span class="mob pot-sortm"><span class="fsum">Сортировка</span>${seg("potSort", [["margin", "маржа"], ["profit", "за 1 шт."], ["vol", "продажи"]])}</span>`;
  chips($("pot-tiers"), [["all", "Все"], ...tierItems(POT_TIERS)], (v) => (v === "all" ? allT : S.potTiers.includes(v) && !allT),
    (v) => { S.potTiers = v === "all" ? [...POT_TIERS] : allT ? [v] : toggleIn(S.potTiers, v, POT_TIERS); save(); renderPot(); }, (v) => (v === "all" ? "" : tierCls(v)));
  $("pot-ctrl").querySelectorAll("[data-pk]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.pk; S[k] = k === "potFocus" ? b.dataset.v === "true" : b.dataset.v; if (k === "potSort") S.potDir = -1; save(); renderPot(); }));
  $("pot-plus").addEventListener("change", (e) => { S.potPlus = e.target.checked; save(); renderPot(); });
  const ingTip = (r) => r.ing.map((x) => `${itemLabel(x.id)} ×${x.n}: ${x.o ? `${fmt(x.o.price)} в ${x.o.city}${x.o.src === "order" ? " (свой ордер)" : ""}` : "нет цены"}`).join("\n") + (r.ok ? `\nНа выходе ${r.out} шт. за крафт` : "");
  const sh = (k, label, tip) => { const on = S.potSort === k; return `<th scope="col" aria-sort="${on ? (dir < 0 ? "descending" : "ascending") : "none"}"><button type="button" class="sorth${on ? " on" : ""}" data-sort="${k}" title="${tip}">${label}<span class="arr" aria-hidden="true">${on ? (dir < 0 ? "↓" : "↑") : "↕"}</span></button></th>`; };
  let h = `<thead><tr><th scope="col">Зелье</th><th scope="col">Продажа</th><th scope="col">Город</th>${sh("vol", "В день", "Сортировать по объёму продаж в день")}${sh("profit", "За 1 шт.", "Сортировать по прибыли с 1 зелья")}${sh("margin", "Маржа", "Сортировать по марже")}<th scope="col" class="c-stack">За стак</th><th scope="col" class="c-spark" title="Средняя цена сделок по дням в городе продажи">14 дней</th></tr></thead><tbody>`, m = "";
  if (!shown.length) { h += `<tr><td class="msg" colspan="8">${pending > 0 ? "Загружаю цены…" : "Нет зелий в плюсе при этих условиях."}</td></tr>`; m = `<div class="panel card"><span class="k">${pending > 0 ? "Загружаю цены…" : "Нет зелий в плюсе."}</span></div>`; }
  for (const r of shown) {
    const name = `<div class="item">${fishIcon(r.id, 36)}<div class="iname"><b>${esc(itemLabel(r.id))}</b></div>${favBtn(r.id)}</div>`;
    const cls = r.ok && r.profit >= 0 ? "pos" : "neg";
    const open = potOpen.has(r.id);
    h += `<tr tabindex="0" class="rrow${open ? " open" : ""}" data-key="${r.id}" aria-expanded="${open}"><td title="${esc(ingTip(r))}">${name.replace('<div class="item">', `<div class="item">${CHEV}`)}</td>`
      + (r.ok ? `<td><b>${fmt(r.sell.price)}</b></td><td><span class="pcity">${cityHtml(r.sell.city)}<span class="age">${srcAge(r.sell)}</span></span></td><td>${isFinite(r.sell.vol) ? `${liqDot(r.sell.vol)}${nf0.format(r.sell.vol)}` : `<span class="empty">—</span>`}</td><td><b class="${cls}">${fmtSigned(r.profit)}</b></td><td><b style="color:${levelColor(r.margin, r.profit, c0.m)}">${nf0.format(r.margin * 100)}%</b></td><td class="c-stack"><b class="${cls}">${fmtBig(r.profit * STACK)}</b></td><td class="c-spark">${potSpark(r)}</td>`
        : `<td colspan="7"><span class="empty">нет цен: ${esc([...r.ing.filter((x) => !x.o).map((x) => itemLabel(x.id)), r.sell ? "" : "продажа"].filter(Boolean).join(", "))}</span></td>`) + `</tr>`
      + `<tr class="det"${open ? "" : " hidden"}><td colspan="8">${open ? potDet(r) : ""}</td></tr>`;
    m += `<section class="panel card${open ? " open" : ""}" tabindex="0" data-key="${r.id}" aria-expanded="${open}"><div class="card-h">${fishIcon(r.id, 42)}<div class="iname"><b>${esc(itemLabel(r.id))}</b><small>T${potTier(r.id)} · ${r.out} шт. за крафт</small></div>${favBtn(r.id)}${r.ok ? `<b style="color:${levelColor(r.margin, r.profit, c0.m)};font-size:18px">${nf0.format(r.margin * 100)}%</b>` : ""}</div>`
      + (r.ok ? `<div class="m-line"><span class="k">Продажа</span>${cityHtml(r.sell.city)}<span class="age">${srcAge(r.sell)}</span><b>${fmt(r.sell.price)}</b></div><div class="m-line"><span class="k">За 1 шт.</span><b class="${cls}">${fmtSigned(r.profit)}</b></div><div class="m-line"><span class="k">14 дней</span>${potSpark(r)}</div>`
        : `<div class="m-line"><span class="k">не хватает цен</span></div>`) + `<div class="card-det"${open ? "" : " hidden"}>${open ? potDet(r) : ""}</div></section>`;
  }
  const tbl = $("pot-table"), cards = $("pot-cards");
  tbl.innerHTML = h + "</tbody>";
  cards.innerHTML = m;
  tbl.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.sort; S.potDir = S.potSort === k ? -S.potDir : -1; S.potSort = k; save(); renderPot();
  }));
  const byKey = Object.fromEntries(shown.map((r) => [r.id, r]));
  const toggle = (el) => {
    const key = el.dataset.key, r = byKey[key]; if (!r) return;
    const open = !potOpen.has(key);
    if (open) potOpen.add(key); else potOpen.delete(key);
    el.classList.toggle("open", open); el.setAttribute("aria-expanded", String(open));
    const det = el.tagName === "TR" ? el.nextElementSibling : el.querySelector(".card-det");
    const box = el.tagName === "TR" ? det.firstElementChild : det;
    box.innerHTML = open ? potDet(r) : ""; det.hidden = !open;
    bindPotDet(box);
  };
  rowNav(tbl, "tbody tr.rrow", toggle);
  cards.querySelectorAll(".card[data-key]").forEach((el) => {
    el.addEventListener("click", (e) => { if (!e.target.closest(".card-det")) toggle(el); });
    el.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); toggle(el); } });
  });
  bindPotDet(tbl); bindPotDet(cards);
}
async function openPot(force = false) {
  renderPot();
  await ensure(potIds(), { history: true, force });
  if (S.view === "pot") renderPot();
}

// ---------- «Избранное»: свой список ресурсов и цены, введённые вручную ----------
const FAV_KINDS = [["raw", "Сырьё"], ["mat", "Материалы"], ["pot", "Зелья"], ["ing", "Ингредиенты зелий"], ["fish", "Рыба"]];
const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>`;
const potIngSet = () => new Set(POTS.flatMap((p) => p[3].map((x) => x[0])));
function favKind(id) {
  const p = parseId(id); if (p) return p.kind;
  if (id.includes("_POTION_")) return "pot";
  if (potIngSet().has(id)) return "ing";
  return "fish";
}
const favTier = (id) => +(/^T(\d)/.exec(id) || [0, 0])[1];
const potRecipe = (id) => POTS.find((p) => p[0] === id);
// звезда «в избранное»: показываем, только если вкладка включена в «Условиях»
function favBtn(id, sm = false) {
  if (!viewOn("fav")) return "";
  const on = S.fav.includes(id);
  return `<button type="button" class="fav-star${on ? " on" : ""}${sm ? " sm" : ""}" data-fav="${esc(id)}" aria-pressed="${on}" title="${on ? "Убрать из избранного" : "В избранное"}">${STAR_SVG}</button>`;
}
function favSync(ids) {
  for (const id of ids) document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => {
    const on = S.fav.includes(id); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.title = on ? "Убрать из избранного" : "В избранное";
  });
}
function favAdd(ids) {
  const add = ids.filter((x) => !S.fav.includes(x));
  if (!add.length) return;
  S.fav = [...S.fav, ...add]; save(); favSync(add);
  if (S.view === "fav") openFav();
}
function favToggle(id, btn) {
  if (S.fav.includes(id)) { S.fav = S.fav.filter((x) => x !== id); save(); favSync([id]); if (S.view === "fav") renderFav(); return; }
  favAdd([id]);
  const rec = potRecipe(id); if (!rec) return;
  const ings = rec[3].map((x) => x[0]).filter((x) => !S.fav.includes(x));
  if (!ings.length) return;
  if (S.favInc === "yes") favAdd(ings);
  else if (S.favInc === "ask") favPop(btn, id, ings);
}
// подсказка после добавления зелья: добавить ли ингредиенты и запомнить ли выбор
let favPopEl = null;
function favPopClose(apply) {
  if (!favPopEl) return;
  const el = favPopEl; favPopEl = null;
  if (apply) {
    const inc = el.querySelector("#fp-inc").checked, keep = el.querySelector("#fp-keep").checked;
    if (inc) favAdd(JSON.parse(el.dataset.ings));
    if (keep) { S.favInc = inc ? "yes" : "no"; save(); if (S.view === "fav") renderFav(); }
  }
  el.remove();
}
function favPop(btn, id, ings) {
  favPopClose(false);
  const el = document.createElement("div");
  el.className = "fav-pop"; el.dataset.ings = JSON.stringify(ings); el.dataset.y = String(window.scrollY);
  el.innerHTML = `<div class="fav-pop-h">${STAR_SVG}<b>Добавлено в избранное</b></div>
    <label class="fav-ck"><input type="checkbox" id="fp-inc" checked><span>и ингредиенты (${ings.length}): ${esc(ings.map((x) => lc1(itemLabel(x))).join(", "))}</span></label>
    <label class="fav-ck"><input type="checkbox" id="fp-keep"><span>Запомнить и больше не спрашивать</span></label>
    <div class="fav-pop-a"><button class="btn" type="button" data-fp="ok">Готово</button><button class="btn ghost" type="button" data-fp="go">Открыть избранное</button></div>`;
  document.body.appendChild(el); favPopEl = el;
  const r = btn.getBoundingClientRect(), w = el.offsetWidth;
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + "px";
  el.style.top = Math.min(window.innerHeight - el.offsetHeight - 8, r.bottom + 6) + "px";
  el.querySelector('[data-fp="ok"]').addEventListener("click", () => favPopClose(true));
  el.querySelector('[data-fp="go"]').addEventListener("click", () => { favPopClose(true); location.hash = "fav"; });
}
document.addEventListener("click", (e) => {
  if (favPopEl && !favPopEl.contains(e.target) && !e.target.closest("[data-fav]")) favPopClose(true);
  const b = e.target.closest("[data-fav]"); if (!b) return;
  e.stopPropagation(); e.preventDefault(); favToggle(b.dataset.fav, b);
}, true);
// Enter/пробел на звезде не должны раскрывать строку под ней
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && favPopEl) favPopClose(false);
  if ((e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-fav]")) e.stopPropagation();
}, true);
window.addEventListener("scroll", () => { if (favPopEl && Math.abs(window.scrollY - +favPopEl.dataset.y) > 80) favPopClose(true); }, { passive: true });

// что нужно загрузить, чтобы посчитать маржу избранного
function favNeedIds() {
  const ids = new Set(S.fav), ref = [];
  for (const id of S.fav) {
    const k = favKind(id);
    if (k === "raw" || k === "mat") ref.push(id);
    if (k === "pot") potRecipe(id)[3].forEach((x) => ids.add(x[0]));
    if (k === "ing") for (const p of POTS) if (p[3].some((x) => x[0] === id)) { ids.add(p[0]); p[3].forEach((x) => ids.add(x[0])); }
  }
  return [...ids, ...limitIds(ref)];
}
// строка избранного: где купить, где продать и маржа по смыслу ресурса
function favCalc(id, pots) {
  const k = favKind(id), buy = pickBuy(id), sell = pickSell(id), out = { id, k, buy, sell, m: NaN, p: NaN, note: "", used: [] };
  if (k === "raw" || k === "mat") {
    const M = marginModel(id, limitOf(id));
    if (M && buy) {
      const side = buy.src === "order" ? "b" : "s", r = M.at({ p: side === "b" ? buy.price - 1 : buy.price }, side, buy.city);
      out.m = r.m; out.p = r.m;
    }
    out.note = k === "raw" ? "переработка" : S.pMat === "craft" ? "крафт тира выше" : "перепродажа";
  } else if (k === "pot") {
    const r = pots.find((x) => x.id === id);
    if (r && r.ok) { out.m = r.margin; out.p = r.profit; }
    out.note = "крафт";
  } else if (k === "ing") {
    out.used = POTS.filter((p) => p[3].some((x) => x[0] === id)).map((p) => pots.find((x) => x.id === p[0])).filter(Boolean);
  }
  return out;
}
const favOpen = new Set();
function favQuote(o, kind) {
  if (!o) return `<td><span class="empty">—</span></td>`;
  return `<td><b>${fmt(o.price)}${o.manual ? MSTAR : ""}</b><div class="where">${cityHtml(o.city)}<span class="age">${kind ? kind + " · " : ""}${srcAge(o)}</span></div></td>`;
}
function favManInfo(id) {
  const m = S.manual[`${S.settings.server}|${id}`]; if (!m) return null;
  let n = 0, last = 0;
  for (const c of Object.keys(m)) for (const sd of ["s", "b"]) {
    if (!m[c][sd]) continue;
    const live = liveOf(id, c, sd === "s" ? "sell" : "buy");
    if (live && live.manual && live.age <= maxAge()) { n++; last = Math.max(last, m[c][sd][1]); }
  }
  return n ? { n, age: (Date.now() - last) / 36e5 } : null;
}
function favMarginCell(r) {
  if (r.k === "ing") {
    return `<td class="fav-used">${r.used.length ? `<span class="k">используется в</span>${r.used.map((u) => `<a class="fav-chip" href="#pot" data-pot="${u.id}">${fishIcon(u.id, 20)}<span>${esc(itemLabel(u.id))}</span>${u.ok ? `<b style="color:${levelColor(u.margin, u.profit, calcSettings().m)}">${nf0.format(u.margin * 100)}%</b>` : ""}</a>`).join("")}` : `<span class="empty">—</span>`}</td>`;
  }
  if (!isFinite(r.m)) return `<td><span class="empty">—</span>${r.note ? `<small class="age" style="display:block">${r.note}</small>` : ""}</td>`;
  return `<td><b style="color:${levelColor(r.m, r.p, calcSettings().m)}">${r.m < 0 ? "−" : ""}${nf0.format(Math.abs(r.m * 100))}%</b><small class="age" style="display:block">${r.note}</small></td>`;
}
// поля ввода цен в «Избранном»
const FRESH_H = 4;
// поле ввода цены: своя цена (жёлтая рамка) или серым — цена с сервера
// свежая — показанный возраст не больше FRESH_H часов («4 ч» ещё свежая)
const isFreshH = (h) => isFinite(h) && Math.round(h) <= FRESH_H;
// лучшие цены строки — как на «Ценах»: в «продают» и «покупают» по городам из «Условий»
function favBest(id, cities) {
  const { q, bestS, bestB } = cityQuotes(id, cities), out = { s: null, b: null };
  for (const c of cities) {
    const x = q[c]; if (!x) continue;
    if (x.s && !x.s.odd && x.s.age <= maxAge() && x.s.p === bestS && !out.s) out.s = c;
    if (x.b && !x.b.odd && x.b.age <= maxAge() && x.b.p === bestB && !out.b) out.b = c;
  }
  return out;
}
function favInput(id, c, side, ord, compact = false, best = false) {
  const sd = side === "sell" ? "s" : "b", man = S.manual[`${S.settings.server}|${id}`] || {}, m = man[c] && man[c][sd], a = apiOf(id, c, side);
  const mine = m && (!a || m[1] >= a.t) && (Date.now() - m[1]) / 36e5 <= maxAge();
  const aAge = a ? (Date.now() - a.t) / 36e5 : NaN;
  const ph = a && aAge <= maxAge() ? fmt(a.p) : "—";
  // в узкой ячейке рядом с возрастом — код города, чтобы не путать столбцы, когда шапка уехала
  const code = compact ? `<b class="fav-cc" style="color:${CITY_COLOR[c]}">${CITY_CODE[c] || ""}</b>` : "";
  const fresh = !mine && a && isFreshH(aAge);
  const src = mine ? `<small class="fav-src man">${code}${compact ? "" : "ты · "}${fmtAge((Date.now() - m[1]) / 36e5)}${compact ? "" : " назад"}</small>`
    : a ? `<small class="fav-src${fresh ? " fresh" : ""}">${code}${compact ? "" : "сервер · "}${fmtAge(aAge)}${compact ? "" : " назад"}${aAge > maxAge() ? (compact ? " ✕" : " (устарела)") : ""}</small>` : `<small class="fav-src">${code}${compact ? "" : "нет цены"}</small>`;
  const bc = best ? ` best-${sd}` : "";
  return `<label class="fav-in${mine ? " on" : ""}${fresh ? " fresh" : ""}${compact ? " sm" : ""}${bc}"${best ? ` title="Лучшая цена — как на «Ценах»"` : ""}><input type="text" inputmode="numeric" autocomplete="off" data-i="${esc(id)}" data-c="${esc(c)}" data-s="${sd}" data-ord="${ord}" value="${mine ? fmt(m[0]) : ""}" placeholder="${ph}" aria-label="${esc(itemLabel(id))}, ${esc(c)}: ${side === "sell" ? "продают (заказы на продажу)" : "покупают (заказы на покупку)"}"><i aria-hidden="true">★</i></label>${src}`;
}
// редактор: по каждому городу — самый дешёвый лот и лучший ордер на закупку.
// У зелья сразу и его ингредиенты: обходишь город — вписываешь всё, что нужно для крафта
function favEditor(id, pots, mob = false) {
  const cities = activeCities(), rec = potRecipe(id);
  const items = rec ? [[id, 0], ...rec[3]] : [[id, 0]];
  const { side, hasMan } = favSide(id, pots, items);
  const tip = `«Продают» — самая низкая цена во вкладке «Заказы на продажу» (за столько можно купить сразу). «Покупают» — самая высокая цена во вкладке «Заказы на покупку» (за столько можно продать сразу). Вписывай то, что видишь на рынке в игре. Пустое поле — берём цену с сервера (серым). Твоя цена живёт столько же, сколько остальные (${maxAge()} ч, «Условия» → свежесть), и уступает место цене с сервера, если та новее.${rec ? " Enter переходит по городам: сначала все поля одного города, потом следующего." : ""}`;
  const act = `<div class="fav-act"><button class="btn" type="button" data-fsave>Сохранить</button><button class="btn ghost" type="button" data-freset${hasMan ? "" : " disabled"}>Сбросить мои цены</button><span class="k fav-hint">Enter — сохранить и к следующему полю</span></div>`;
  const itemName = ([i, n], k) => `<span class="fav-iname">${fishIcon(i, 24)}<span><b>${esc(itemLabel(i))}</b>${k ? `<small>×${n}${isRareAlch(i) ? " · редкий" : ""}</small>` : `<small>зелье</small>`}</span>${k ? favBtn(i, true) : ""}</span>`;
  let grid;
  if (!rec) {
    grid = `<table class="fav-t"><thead><tr><th scope="col"></th><th scope="col"><span class="ptag s">продают</span><small>самая низкая цена в заказах на продажу</small></th><th scope="col"><span class="ptag b">покупают</span><small>самая высокая цена в заказах на покупку</small></th></tr></thead>
      <tbody>${cities.map((c, ci) => `<tr><th scope="row">${cityBadge(c)}<span class="fav-cn">${esc(c)}</span></th><td>${favInput(id, c, "sell", ci * 2)}</td><td>${favInput(id, c, "buy", ci * 2 + 1)}</td></tr>`).join("")}</tbody></table>`;
  } else if (mob) {
    // телефон: по блоку на город, внутри — зелье и ингредиенты
    grid = cities.map((c, ci) => `<div class="fav-cityb"><div class="fav-cityh">${cityBadge(c)}<span>${esc(c)}</span><span class="fav-tags"><span class="ptag s">продают</span><span class="ptag b">покупают</span></span></div>`
      + items.map((it, k) => `<div class="fav-irow">${itemName(it, k)}<div class="fav-pair"><div>${favInput(it[0], c, "sell", ci * 1000 + k * 2, true)}</div><div>${favInput(it[0], c, "buy", ci * 1000 + k * 2 + 1, true)}</div></div></div>`).join("") + `</div>`).join("");
  } else {
    // ноутбук: строки — зелье и ингредиенты, столбцы — города (лот и ордер)
    grid = `<div class="fav-mxw"><table class="fav-mx"><thead><tr><th scope="col" rowspan="2"></th>${cities.map((c) => `<th scope="colgroup" colspan="2">${cityBadge(c)}</th>`).join("")}</tr>
      <tr>${cities.map(() => `<th scope="col"><span class="ptag s">продают</span></th><th scope="col"><span class="ptag b">покупают</span></th>`).join("")}</tr></thead>
      <tbody>${items.map((it, k) => { const bst = favBest(it[0], cities); return `<tr${k ? "" : ' class="fav-pot"'}><th scope="row">${itemName(it, k)}</th>${cities.map((c, ci) => `<td>${favInput(it[0], c, "sell", ci * 1000 + k * 2, true, bst.s === c)}</td><td>${favInput(it[0], c, "buy", ci * 1000 + k * 2 + 1, true, bst.b === c)}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>`;
  }
  return `<div class="fav-ed${rec ? " pot" : ""}" data-items="${esc(JSON.stringify(items.map((x) => x[0])))}"><div class="det-b fav-grid"><h4>${rec ? "Цены зелья и ингредиентов" : "Цены по городам"} <span class="phint" tabindex="0" title="${esc(tip)}">?</span></h4>${grid}${act}</div><div class="fav-side">${side}</div></div>`;
}
// блок «Сейчас / С твоими ценами»: что изменят свои цены — считаем ещё раз без них
function favSide(id, pots, items = [[id, 0]]) {
  manualOff = true; const base = favCalc(id, potRows()); manualOff = false;
  const now = favCalc(id, pots);
  const fmtM = (r) => isFinite(r.m) ? `${r.m < 0 ? "−" : ""}${nf0.format(Math.abs(r.m * 100))}%` : "—";
  const q = (o) => o ? `${fmt(o.price)} в ${o.city}` : "нет цены";
  const kv = (k, v, cls = "") => `<div class="dl"><span>${k}</span><b class="${cls}">${v}</b></div>`;
  const hasMan = items.some(([i]) => favManInfo(i));
  const side = `<div class="det-b"><h4>${hasMan ? "С твоими ценами" : "Сейчас"}</h4>`
    + kv("Купить", now.buy ? `${fmt(now.buy.price)}${now.buy.manual ? MSTAR : ""} <span class="age">${esc(now.buy.city)}</span>` : "—")
    + kv("Продать", now.sell ? `${fmt(now.sell.price)}${now.sell.manual ? MSTAR : ""} <span class="age">${esc(now.sell.city)}</span>` : "—")
    + (now.k === "pot" && isFinite(now.p) ? kv("Прибыль за 1 шт.", fmtSigned(now.p), now.p >= 0 ? "pos" : "neg") : "")
    + (now.k !== "ing" && now.k !== "fish" ? kv(`Маржа${now.note ? ` (${now.note})` : ""}`, fmtM(now), isFinite(now.m) ? (now.m >= 0 ? "pos" : "neg") : "") : "")
    + (hasMan ? `<p class="dn">По ценам с сервера: ${now.k === "pot" ? "" : `купить ${q(base.buy)}, `}продать ${q(base.sell)}${now.k === "pot" && isFinite(base.p) ? `, прибыль ${fmtSigned(base.p)}` : ""}${now.k !== "ing" && now.k !== "fish" ? `, маржа ${fmtM(base)}` : ""}</p>` : `<p class="dn">Впиши цены, которые видишь в игре, — здесь будет видно, что изменится</p>`)
    + `</div>`;
  return { side, hasMan };
}
const favInputs = (box) => [...box.querySelectorAll("input[data-c]")].sort((a, b) => a.dataset.ord - b.dataset.ord);
function favSave(id, box, focusNext = null) {
  const srv = S.settings.server, next = {};
  for (const inp of box.querySelectorAll("input[data-c]")) {
    const iid = inp.dataset.i, key = `${srv}|${iid}`;
    if (!next[key]) next[key] = JSON.parse(JSON.stringify(S.manual[key] || {}));
    const man = next[key], c = inp.dataset.c, sd = inp.dataset.s, raw = inp.value.replace(/[^\d]/g, ""), v = raw ? +raw : 0;
    const old = man[c] && man[c][sd], wasMine = inp.closest(".fav-in").classList.contains("on");
    if (!v) { if (wasMine && man[c]) delete man[c][sd]; continue; }
    if (wasMine && old && old[0] === v) continue; // не меняли — время ввода сохраняем
    man[c] = { ...(man[c] || {}), [sd]: [v, Date.now()] };
  }
  for (const [key, man] of Object.entries(next)) {
    for (const c of Object.keys(man)) if (!man[c].s && !man[c].b) delete man[c];
    if (Object.keys(man).length) S.manual[key] = man; else delete S.manual[key];
  }
  save(); renderFav();
  if (focusNext !== null) {
    const nb = document.querySelector(`${isMobile() ? "#fav-cards" : "#fav-table"} [data-fedit="${id}"]`);
    const el = nb ? favInputs(nb)[focusNext] : null; if (el) { el.focus(); el.select(); }
  }
}
function bindFavEditor(root) {
  root.querySelectorAll("[data-fedit]").forEach((box) => {
    const id = box.dataset.fedit, inputs = favInputs(box);
    inputs.forEach((inp, i) => inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); favSave(id, box, i + 1 < inputs.length ? i + 1 : null); } }));
    const sv = box.querySelector("[data-fsave]"); if (sv) sv.addEventListener("click", () => favSave(id, box));
    const rs = box.querySelector("[data-freset]"), ed = box.querySelector(".fav-ed");
    if (rs && ed) rs.addEventListener("click", () => { for (const i of JSON.parse(ed.dataset.items)) delete S.manual[`${S.settings.server}|${i}`]; save(); renderFav(); });
  });
  root.querySelectorAll("[data-pot]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const pid = a.dataset.pot; potOpen.add(pid);
    if (!S.potTiers.includes(potTier(pid))) S.potTiers = toggleIn(S.potTiers, potTier(pid), POT_TIERS);
    save(); location.hash = "pot";
  }));
}
function renderFav() {
  const allT = S.favTiers.length === ALL_TIERS.length;
  const seg = (items, cur, attr) => `<span class="seg">${items.map(([v, l]) => `<button type="button" ${attr}="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</span>`;
  $("fav-ctrl").innerHTML = `<span class="fsum">Вид</span><span class="chips" id="fav-kinds"></span><span class="fsum">Тир</span><span class="chips tier-chips" id="fav-tiers"></span>`
    + `<label class="switch"><input type="checkbox" id="fav-man"${S.favMan ? " checked" : ""}><span class="sw" aria-hidden="true"></span><span>Только с ручными ценами</span></label>`
    + `<span class="fav-inc"><span class="fsum">Ингредиенты с зельем</span>${seg([["ask", "спрашивать"], ["yes", "добавлять"], ["no", "не добавлять"]], S.favInc, "data-finc")}</span>`;
  chips($("fav-kinds"), [["all", "Все"], ...FAV_KINDS.map(([k, l]) => [k, k === "ing" ? "Ингредиенты" : l])], (v) => v === S.favKind, (v) => { S.favKind = v; save(); renderFav(); });
  chips($("fav-tiers"), [["all", "Все"], ...tierItems(ALL_TIERS)], (v) => (v === "all" ? allT : S.favTiers.includes(v) && !allT),
    (v) => { S.favTiers = v === "all" ? [...ALL_TIERS] : allT ? [v] : toggleIn(S.favTiers, v, ALL_TIERS); save(); renderFav(); }, (v) => (v === "all" ? "" : tierCls(v)));
  $("fav-man").addEventListener("change", (e) => { S.favMan = e.target.checked; save(); renderFav(); });
  $("fav-ctrl").querySelectorAll("[data-finc]").forEach((b) => b.addEventListener("click", () => { S.favInc = b.dataset.finc; save(); renderFav(); }));

  const tbl = $("fav-table"), cards = $("fav-cards"), cities = activeCities(), NC = cities.length * 2 + 2;
  // в строке — сразу поля цен по городам: проходишь список и вписываешь; маржа и «используется в» — в деталях
  const head = `<thead><tr><th scope="col" rowspan="2">Ресурс</th>${cities.map((c) => `<th scope="colgroup" colspan="2" class="fav-ch fav-cityname">${cityHtml(c)}</th>`).join("")}<th scope="col" rowspan="2">Маржа</th></tr>`
    + `<tr class="fav-sub">${cities.map(() => `<th scope="col" class="fav-ch"><span class="ptag s">продают</span></th><th scope="col"><span class="ptag b">покупают</span></th>`).join("")}</tr></thead>`;
  if (!S.fav.length) {
    const msg = `Пока пусто. Нажми звёздочку у ресурса на страницах «Цены», «Переработка», «Зелья» или «Рыба» — он появится здесь.`;
    tbl.innerHTML = head + `<tbody><tr><td class="msg" colspan="${NC}">${msg}</td></tr></tbody>`; cards.innerHTML = `<div class="panel card"><span class="k">${msg}</span></div>`;
    return;
  }
  const pots = potRows();
  const rows = S.fav.filter((id) => (S.favKind === "all" || favKind(id) === S.favKind) && S.favTiers.includes(favTier(id)) && (!S.favMan || favManInfo(id)))
    .map((id) => favCalc(id, pots));
  let h = head + "<tbody>", m = "", rowN = 0;
  if (!rows.length) { h += `<tr><td class="msg" colspan="${NC}">Под фильтр ничего не попало.</td></tr>`; m = `<div class="panel card"><span class="k">Под фильтр ничего не попало.</span></div>`; }
  for (const [k, label] of FAV_KINDS) {
    const g = rows.filter((r) => r.k === k).sort((a, b) => favTier(a.id) - favTier(b.id) || itemLabel(a.id).localeCompare(itemLabel(b.id), "ru"));
    if (!g.length) continue;
    h += `<tr class="group"><td colspan="${NC}">${label}<span>${g.length}</span></td></tr>`;
    m += `<div class="k tdiv" style="--tc:var(--muted)">${label}</div>`;
    for (const r of g) {
      const open = favOpen.has(r.id), mi = favManInfo(r.id);
      const ic = parseId(r.id) ? icon(r.id, 36) : fishIcon(r.id, 36);
      const mg = r.k === "ing" ? `<span class="empty" title="Своей маржи нет — смотри зелья в деталях">—</span>` : isFinite(r.m) ? `<b style="color:${levelColor(r.m, r.p, calcSettings().m)}">${r.m < 0 ? "−" : ""}${nf0.format(Math.abs(r.m * 100))}%</b>` : `<span class="empty">—</span>`;
      h += `<tr class="rrow fav-row${open ? " open" : ""}" data-key="${esc(r.id)}" aria-expanded="${open}"><td><div class="item"><button type="button" class="fav-tg" aria-label="Подробнее" aria-expanded="${open}">${CHEV}</button>${ic}<div class="iname"><button type="button" class="fav-copy" data-copy="${esc(itemLabel(r.id))}" title="Скопировать название — чтобы вставить в поиск на рынке">${esc(itemLabel(r.id))}<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg></button></div>${favBtn(r.id)}</div></td>`
        + ((bst) => cities.map((c, ci) => `<td class="fav-c" style="--cc:${CITY_COLOR[c]}">${favInput(r.id, c, "sell", ci * 100000 + rowN * 2, true, bst.s === c)}</td><td class="fav-c2">${favInput(r.id, c, "buy", ci * 100000 + rowN * 2 + 1, true, bst.b === c)}</td>`).join(""))(favBest(r.id, cities))
        + `<td>${mg}</td></tr>`
        + `<tr class="det"${open ? "" : " hidden"}><td colspan="${NC}"><div data-fdet="${esc(r.id)}">${open ? favDetail(r, pots) : ""}</div></td></tr>`;
      rowN++;
      const mm = r.k === "ing" ? "" : isFinite(r.m) ? `<b style="color:${levelColor(r.m, r.p, calcSettings().m)};font-size:18px">${r.m < 0 ? "−" : ""}${nf0.format(Math.abs(r.m * 100))}%</b>` : "";
      m += `<section class="panel card${open ? " open" : ""}" tabindex="0" data-key="${esc(r.id)}" aria-expanded="${open}"><div class="card-h">${parseId(r.id) ? icon(r.id, 42) : fishIcon(r.id, 42)}<div class="iname"><b>${esc(itemLabel(r.id))}</b><small>${mi ? `★ ${mi.n} ${plural(mi.n, ["цена", "цены", "цен"])} вручную · ${fmtAge(mi.age)} назад` : "цены с сервера"}</small></div>${mm}${favBtn(r.id)}</div>`
        + `<div class="m-line"><span class="k">Купить</span>${r.buy ? `${cityHtml(r.buy.city)}<span class="age">${srcAge(r.buy)}</span><b>${fmt(r.buy.price)}${r.buy.manual ? MSTAR : ""}</b>` : `<b class="empty">нет цены</b>`}</div>`
        + `<div class="m-line"><span class="k">Продать</span>${r.sell ? `${cityHtml(r.sell.city)}<span class="age">${srcAge(r.sell)}</span><b>${fmt(r.sell.price)}${r.sell.manual ? MSTAR : ""}</b>` : `<b class="empty">нет цены</b>`}</div>`
        + `<div class="card-det"${open ? "" : " hidden"}><div data-fedit="${esc(r.id)}">${open ? favEditor(r.id, pots, true) : ""}</div></div></section>`;
    }
  }
  tbl.innerHTML = h + "</tbody>"; cards.innerHTML = m;
  favFit();
  const toggle = (el) => {
    const key = el.dataset.key, open = !favOpen.has(key);
    if (open) favOpen.add(key); else favOpen.delete(key);
    renderFav();
  };
  // строка раскрывается по стрелке, имени или пустому месту — не по полям ввода
  tbl.querySelectorAll("tbody tr.rrow").forEach((tr) => tr.addEventListener("click", (e) => { if (!e.target.closest(".fav-in") && !e.target.closest(".fav-copy")) toggle(tr); }));
  // клик по названию — скопировать его (для поиска на рынке в игре), детали не раскрываются
  tbl.querySelectorAll(".fav-copy").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation();
    const t = b.dataset.copy;
    try { await navigator.clipboard.writeText(t); }
    catch (err) { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e2) { /* нет доступа к буферу */ } ta.remove(); }
    toast(`Скопировано: ${t}`);
  }));
  // поле в строке: Enter — сохранить и к следующему полю (дальше по строке, потом следующая строка);
  // ушёл из поля, поменяв цену, — тоже сохраняем
  const rowInputs = () => [...$("fav-table").querySelectorAll("tbody tr.rrow input[data-ord]")].sort((a, b) => a.dataset.ord - b.dataset.ord);
  let saving = false;
  const saveRow = (inp, focusOrd) => {
    if (saving) return; saving = true;
    const tr = inp.closest("tr"); favSave(tr.dataset.key, tr);
    saving = false;
    if (focusOrd !== null) { const el = rowInputs().find((x) => +x.dataset.ord === focusOrd); if (el) { el.focus(); el.select(); } }
  };
  tbl.querySelectorAll("tbody tr.rrow input[data-ord]").forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault(); e.stopPropagation();
      const nx = rowInputs().find((x) => +x.dataset.ord > +inp.dataset.ord);
      saveRow(inp, nx ? +nx.dataset.ord : +inp.dataset.ord);
    });
    inp.addEventListener("change", () => {
      setTimeout(() => { const a = document.activeElement; saveRow(inp, a && a.dataset && a.dataset.ord !== undefined ? +a.dataset.ord : null); }, 0);
    });
  });
  cards.querySelectorAll(".card[data-key]").forEach((el) => {
    el.addEventListener("click", (e) => { if (!e.target.closest(".card-det")) toggle(el); });
    el.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); toggle(el); } });
  });
  bindFavEditor(tbl); bindFavEditor(cards); bindFavDet(tbl);
}
// шапка с городами прилипает к верху экрана — но только если таблица влезает по ширине:
// у прокручиваемого вбок блока «прилипание» работает лишь внутри него самого
function favFit() {
  const t = $("fav-table"), box = t && t.closest(".tablebox"); if (!box) return;
  box.classList.remove("fav-fit");
  if (t.scrollWidth <= box.clientWidth + 1) box.classList.add("fav-fit");
}
window.addEventListener("resize", () => { if (S.view === "fav") favFit(); });
// детали строки на ноутбуке: у зелья — цены ингредиентов и итог, у остального — «используется в» и итог
function favDetail(r, pots) {
  if (potRecipe(r.id)) return `<div data-fedit="${esc(r.id)}">${favEditor(r.id, pots)}</div>`;
  const { side, hasMan } = favSide(r.id, pots);
  const used = r.k === "ing" ? `<div class="det-b"><h4>Используется в</h4>${r.used.length ? `<div class="fav-usedl">${r.used.map((u) => `<a class="fav-chip" href="#pot" data-pot="${u.id}">${fishIcon(u.id, 20)}<span>${esc(itemLabel(u.id))}</span>${u.ok ? `<b style="color:${levelColor(u.margin, u.profit, calcSettings().m)}">${nf0.format(u.margin * 100)}%</b>` : ""}</a>`).join("")}</div>` : `<p class="dn">Ни в одном зелье из каталога</p>`}<p class="dn">Маржа зелья — с учётом всех твоих цен. Клик — открыть зелье</p></div>` : "";
  return `<div class="fav-det">${used}${side}<div class="fav-act"><button class="btn ghost" type="button" data-freset1="${esc(r.id)}"${hasMan ? "" : " disabled"}>Сбросить мои цены</button></div></div>`;
}
function bindFavDet(root) {
  root.querySelectorAll("[data-freset1]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); delete S.manual[`${S.settings.server}|${b.dataset.freset1}`]; save(); renderFav(); }));
}
async function openFav(force = false) {
  renderFav();
  if (!S.fav.length) return;
  await ensure(favNeedIds(), { history: true, force });
  if (S.view === "fav") renderFav();
}

// дополнительные вкладки включаются в «Условиях»
const OPT_VIEWS = ["pot", "fish", "fav"];
const viewOn = (v) => !OPT_VIEWS.includes(v) || !!(S.settings.tabs || {})[v];
function applyTabs() {
  for (const v of OPT_VIEWS) {
    const on = viewOn(v);
    $(`tab-${v}`).hidden = !on;
    const a = document.querySelector(`.tabbar a[data-view="${v}"]`); if (a) a.hidden = !on;
  }
  const n = document.querySelectorAll(".tabbar a:not([hidden])").length;
  const tb = document.querySelector(".tabbar"); tb.style.setProperty("--tabs", n); tb.classList.toggle("many", n >= 6);
}

const VIEWS = ["prices", "refine", "calc", "pot", "fish", "fav", "journal"];
function route() {
  const h = location.hash.replace("#", "");
  const ok = (v) => VIEWS.includes(v) && viewOn(v);
  S.view = ok(h) ? h : (ok(S.view) ? S.view : "refine");
  if (h && h !== S.view) history.replaceState(null, "", "#" + S.view);
  save(); closeSheet(); hideTip();
  for (const v of VIEWS) {
    $(`view-${v}`).hidden = v !== S.view;
    $(`tab-${v}`).setAttribute("aria-selected", String(v === S.view));
  }
  document.querySelectorAll(".tabbar a").forEach((a) => { if (a.dataset.view === S.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  window.scrollTo(0, 0);
  if (S.view === "prices") openPrices();
  if (S.view === "refine") openRefine();
  if (S.view === "calc") openCalc();
  if (S.view === "journal") openJournal();
  if (S.view === "fish") openFish();
  if (S.view === "pot") openPot();
  if (S.view === "fav") openFav();
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.view; }));
window.addEventListener("hashchange", route);

setTheme(document.documentElement.dataset.theme === "aurora" ? "aurora" : "glass");
bindSettings(); sumHint(); applyTabs();
if (!location.hash) history.replaceState(null, "", "#" + (VIEWS.includes(S.view) ? S.view : "refine"));
route();
setTimeout(loadTicker, 1200);
