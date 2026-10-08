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
  server: "europe", caerleon: false, brecilien: false, mode: "safe", age: 24,
  rrr: "0.367", rrrc: 36.7, fee: "0.065", station: 0, margin: 10, buffer: 5, order: true, m: [2, 4, 8],
  bonusFam: "", bonusPct: 10,
};
const S = {
  settings: { ...DEF, m: [...DEF.m] },
  view: "refine",
  pFams: ["stone", "fiber"], pTiers: [5, 6, 7, 8], pKind: "all", pEnch: 0, pItem: null,
  rFams: [...FAMS], rTiers: [5, 6, 7, 8], rEnch: 0, rOnlyPlus: false, rSort: "margin",
  cFam: "stone", cTiers: [5, 6, 7, 8], calc: {}, budget: 5000000, bTier: null,
  jf: { type: "buy", cycle: "new", f: "stone", t: 6, e: 0, what: "raw", city: "Bridgewatch", order: true, fee: "0.065" },
};
for (const f of FAMS) S.calc[f] = emptyCalc();
function emptyCalc() { const o = {}; for (const t of REFINE_TIERS) o[t] = { raw: null, prev: null, sell: null, own: false, note: {} }; return o; }

const KEYS = ["view", "pFams", "pTiers", "pKind", "pEnch", "pItem", "rFams", "rTiers", "rEnch", "rOnlyPlus", "rSort", "cFam", "cTiers", "budget", "bTier"];
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) {
    if (saved.settings) S.settings = { ...S.settings, ...saved.settings };
    for (const k of KEYS) if (k in saved) S[k] = saved[k];
    if (saved.jf) S.jf = { ...S.jf, ...saved.jf };
    if (saved.pFam && !saved.pFams) S.pFams = [saved.pFam];
    if (saved.calc) for (const f of FAMS) for (const t of REFINE_TIERS) if (saved.calc[f] && saved.calc[f][t]) S.calc[f][t] = { ...S.calc[f][t], ...saved.calc[f][t] };
  }
} catch (e) { /* хранилище недоступно — работаем без него */ }
const clean = (arr, allowed, fallback) => { const a = Array.isArray(arr) ? arr.filter((x) => allowed.includes(x)) : []; return a.length ? a : fallback; };
S.pFams = clean(S.pFams, FAMS, ["stone"]);
S.rFams = clean(S.rFams, FAMS, [...FAMS]);
S.pTiers = clean(S.pTiers, ALL_TIERS, [5, 6, 7, 8]);
S.rTiers = clean(S.rTiers, REFINE_TIERS, [5, 6, 7, 8]);
S.cTiers = clean(S.cTiers, REFINE_TIERS, [5, 6, 7, 8]);
if (!FAM[S.cFam]) S.cFam = "stone";
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
function histStats(id, city) {
  const pts = histPts(id, city, 8);
  if (pts.length < 2) return null;
  const full = pts.length > 3 ? pts.slice(0, -1) : pts; // последний день обычно неполный
  const vol = full.reduce((s, d) => s + d.c, 0) / full.length;
  const pct = (q) => { const s = [...pts].sort((a, b) => a.p - b.p); const tot = s.reduce((a, d) => a + d.c, 0); let acc = 0; for (const d of s) { acc += d.c; if (acc >= tot * q) return d.p; } return s[s.length - 1].p; };
  return { med: pct(0.5), p80: pct(0.8), vol };
}
function liveOf(id, city, side) {
  const rec = cur[`${S.settings.server}|${id}`]; const r = rec && rec.cities[city];
  if (!r) return null;
  const p = side === "sell" ? r.sell : r.buy, t = side === "sell" ? r.sellT : r.buyT;
  if (!p || !t) return null;
  return { p, age: Math.max(0, (Date.now() - t) / 36e5) };
}
function activeCities() { return CITIES.filter((c) => (c !== "Caerleon" || S.settings.caerleon) && (c !== "Brecilien" || S.settings.brecilien)); }
const maxAge = () => num(S.settings.age) || 24;
// Сколько стоит купить 1 шт. в городе
function buyIn(id, city) {
  const live = liveOf(id, city, "sell"), hs = histStats(id, city), mode = S.settings.mode;
  const fresh = live && live.age <= maxAge() ? live : null;
  if (mode === "live") return fresh ? { price: fresh.p, city, src: "live", age: fresh.age } : null;
  if (mode === "hist") return hs && hs.vol >= MIN_VOL ? { price: hs.med, city, src: "hist" } : null;
  if (fresh) return { price: fresh.p, city, src: "live", age: fresh.age };
  return hs && hs.vol >= MIN_VOL ? { price: hs.med, city, src: "hist" } : null;
}
// За сколько можно продать 1 шт. своим лотом в городе
function sellIn(id, city) {
  const live = liveOf(id, city, "sell"), hs = histStats(id, city), mode = S.settings.mode;
  const fresh = live && live.age <= maxAge() ? live : null;
  const vol = hs ? hs.vol : NaN;
  if (mode === "live") return fresh ? { price: fresh.p, city, src: "live", age: fresh.age, vol } : null;
  if (mode === "hist") return hs && hs.vol >= MIN_VOL ? { price: hs.p80, city, src: "hist", vol } : null;
  if (hs && hs.vol < MIN_VOL) return null;
  if (fresh && hs) return fresh.p > hs.p80 ? { price: hs.p80, city, src: "cap", age: fresh.age, vol } : { price: fresh.p, city, src: "live", age: fresh.age, vol };
  if (fresh) return { price: fresh.p, city, src: "live", age: fresh.age, vol };
  return hs ? { price: hs.p80, city, src: "hist", vol } : null;
}
function pickBuy(id) {
  let best = null;
  for (const c of activeCities()) { const o = buyIn(id, c); if (o && (!best || o.price < best.price)) best = o; }
  return best;
}
function pickSell(id) {
  let best = null;
  for (const c of activeCities()) { const o = sellIn(id, c); if (o && (!best || o.price > best.price)) best = o; }
  return best;
}
// Сырьё для переработки: у камня сравниваем обычный и зачарованный по цене за «обычный» камень
function pickRaw(f, t, e) {
  const cs = calcSettings(f);
  if (!FAM[f].stone) { const o = pickBuy(rawId(f, t, e)); return o && { ...o, ench: e, unit: o.price }; }
  let best = null;
  for (let k = 0; k <= (t >= 4 ? 3 : 0); k++) {
    const o = pickBuy(rawId(f, t, k)); if (!o) continue;
    const eff = o.price / (k ? cs.mult[k - 1] : 1);
    if (!best || eff < best.price) best = { ...o, price: eff, unit: o.price, ench: k };
  }
  return best;
}
// ряд цен за 7 дней в городе с наибольшим объёмом (или в заданном)
function series7(id, city) {
  const rec = hist[`${S.settings.server}|${id}`]; if (!rec) return null;
  let c = city;
  if (!c || !rec.cities[c]) {
    let bestV = -1;
    for (const k of activeCities()) { const v = histPts(id, k, 8).reduce((a, d) => a + d.c, 0); if (v > bestV) { bestV = v; c = k; } }
  }
  const pts = histPts(id, c, 8);
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
    k: 1 - r, r, bonus, fee: +st.fee, station: num(st.station) || 0, m: (num(st.margin) || 0) / 100,
    buf: (num(st.buffer) || 0) / 100, bf: st.order ? 1.025 : 1, mult: st.m.map((x) => num(x) || 1),
  };
}
function economics(t, raw, prevEff, sell, c) {
  const n = N[t];
  const cost = (n * raw * c.bf + prevEff) * c.k + c.station;
  const effSell = sell * (1 - c.buf) * (1 - c.fee);
  const profit = effSell - cost;
  const need = (m) => effSell / (1 + m);
  return {
    cost, effSell, profit, margin: profit / cost, capital: (n * raw * c.bf + prevEff) * c.k * STACK,
    maxRaw: (m) => ((need(m) - c.station) / c.k - prevEff) / (n * c.bf),
    maxPrev: (m) => ((need(m) - c.station) / c.k - n * raw * c.bf) / c.bf,
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
const cityHtml = (c) => c ? `<span class="city" style="color:${CITY_COLOR[c]}">${esc(c)}</span>` : "";
function srcAge(o) {
  if (!o) return "";
  if (o.src === "hist") return "медиана 7 д";
  if (o.src === "cap") return "P80";
  return o.age !== undefined ? fmtAge(o.age) : "";
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
const ENCH_ITEMS = [[0, ".0"], [1, ".1"], [2, ".2"], [3, ".3"]];
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
  const e = S.pEnch, groups = [];
  for (const f of S.pFams) {
    const ids = [];
    for (const t of S.pTiers) {
      if (e > 0 && t < 4) continue;
      if (S.pKind !== "mat") ids.push(rawId(f, t, e));
      if (S.pKind !== "raw" && !(FAM[f].stone && e > 0)) ids.push(matId(f, t, e));
    }
    groups.push({ f, ids: [...new Set(ids)] });
  }
  return groups;
}
const pricesIds = () => pricesGroups().flatMap((g) => g.ids);
function renderPricesControls() {
  famChips($("p-fam"), S.pFams, (v) => { S.pFams = v; save(); openPrices(); });
  chips($("p-tiers"), tierItems(ALL_TIERS), (v) => S.pTiers.includes(v), (v) => { S.pTiers = toggleIn(S.pTiers, v, ALL_TIERS); save(); openPrices(); }, tierCls);
  chips($("p-ench"), ENCH_ITEMS, (v) => v === S.pEnch, (v) => { S.pEnch = v; S.pItem = null; save(); openPrices(); }, enchCls);
  chips($("p-kind"), [["all", "Всё"], ["raw", "Сырьё"], ["mat", "Материал"]], (v) => v === S.pKind, (v) => { S.pKind = v; save(); openPrices(); });
  const parts = [famsText(S.pFams), tiersText(S.pTiers)];
  if (S.pEnch) parts.push("." + S.pEnch);
  if (S.pKind !== "all") parts.push(S.pKind === "raw" ? "сырьё" : "материал");
  $("p-fsum").textContent = parts.join(" · ");
  const cnt = (S.pFams.length !== FAMS.length) + (S.pTiers.length !== ALL_TIERS.length) + (S.pEnch !== 0) + (S.pKind !== "all");
  $("p-fcount").textContent = cnt || "";
  const n = pricesIds().length;
  $("p-show").textContent = `Показать ${n} ${plural(n, ["предмет", "предмета", "предметов"])}`;
}
function cityQuotes(id, cities) {
  let minSell = Infinity, maxBuy = -Infinity;
  const q = {};
  for (const c of cities) {
    const s = liveOf(id, c, "sell"), b = liveOf(id, c, "buy");
    q[c] = { s, b };
    if (s && s.age <= maxAge()) minSell = Math.min(minSell, s.p);
    if (b && b.age <= maxAge()) maxBuy = Math.max(maxBuy, b.p);
  }
  return { q, minSell, maxBuy };
}
function pv(o, kind, best) {
  if (!o) return `<span class="pv none">—</span>`;
  return `<span class="pv${best ? ` best-${kind}` : ""}">${fmt(o.p)}</span>`;
}
const pa = (o) => o ? `<span class="pa${o.age > maxAge() ? " old" : ""}">${fmtAge(o.age)}</span>` : `<span class="pa"></span>`;
function renderPricesTable() {
  const groups = pricesGroups(), cities = activeCities(), tbl = $("p-table"), cards = $("p-cards");
  let h = `<thead><tr><th scope="col">Ресурс</th>${cities.map((c) => `<th scope="col" class="cityh" style="color:${CITY_COLOR[c]}">${c}</th>`).join("")}</tr></thead><tbody>`;
  let m = "", any = false;
  for (const g of groups) {
    if (!g.ids.length) continue;
    any = true;
    if (groups.length > 1) {
      h += `<tr class="group"><td colspan="${cities.length + 1}">${FAM[g.f].tab}<span>бонусный город: ${FAM[g.f].city}</span></td></tr>`;
      m += `<div class="k">${FAM[g.f].tab} · бонусный город ${FAM[g.f].city}</div>`;
    }
    for (const id of g.ids) {
      const info = parseId(id), rec = cur[`${S.settings.server}|${id}`];
      const { q, minSell, maxBuy } = cityQuotes(id, cities);
      const sel = id === S.pItem ? " sel" : "";
      const head = `<div class="item">${icon(id, 40)}<div class="iname"><b>${esc(info.name)}</b><small>${info.kind === "raw" ? "сырьё" : "материал"}</small></div></div>`;
      h += `<tr tabindex="0" data-id="${esc(id)}" class="${sel}"><td>${head}</td>`;
      m += `<section class="panel card${sel}" tabindex="0" data-id="${esc(id)}"><div class="card-h">${head.replace('<div class="item">', "").replace(/<\/div>$/, "")}</div>`
        + (rec ? `<div class="m-city m-headrow"><span></span><span class="ptag s">продают</span><span class="ptag b">покупают</span></div>` : "");
      for (const c of cities) {
        const { s, b } = q[c];
        if (!rec) { h += `<td><span class="empty">…</span></td>`; continue; }
        const bs = s && s.p === minSell && s.age <= maxAge(), bb = b && b.p === maxBuy && b.age <= maxAge();
        h += `<td><div class="cell"><span class="ptag s">продают</span>${pv(s, "s", bs)}${pa(s)}<span class="ptag b">покупают</span>${pv(b, "b", bb)}${pa(b)}</div></td>`;
        if (s || b) m += `<div class="m-city">${cityHtml(c)}<span class="m-v">${pv(s, "s", bs)}${pa(s)}</span><span class="m-v">${pv(b, "b", bb)}${pa(b)}</span></div>`;
      }
      if (!rec) m += `<div class="m-line"><span class="k">Загружаю…</span></div>`;
      else if (cities.every((c) => !q[c].s && !q[c].b)) m += `<div class="m-line"><span class="k">Нет цен ни в одном городе</span></div>`;
      h += "</tr>"; m += "</section>";
    }
  }
  if (!any) {
    const msg = "Для такого фильтра предметов нет. Зачарованные ресурсы бывают только с T4, у камня нет зачарованных блоков.";
    h += `<tr><td class="msg" colspan="${cities.length + 1}">${msg}</td></tr>`;
    m = `<div class="panel card"><span class="k">${msg}</span></div>`;
  }
  tbl.innerHTML = h + "</tbody>";
  cards.innerHTML = m;
  const pick = (el) => {
    S.pItem = el.dataset.id; save(); renderPricesTable(); openSelected();
    if (isMobile()) $("p-widgets").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  rowNav(tbl, "tbody tr[data-id]", pick);
  rowNav(cards, ".card[data-id]", pick);
}
function listingFee() { const f = +S.settings.fee; return f === 0.04 ? 0.065 : f === 0.08 ? 0.105 : f; }
function renderPricesWidgets() {
  const box = $("p-widgets"), id = S.pItem;
  if (!id || !pricesIds().includes(id)) { box.innerHTML = `<div class="panel widget span2"><p class="w-empty">Выбери строку в таблице, чтобы увидеть лучшие цены и перепродажу между городами.</p></div>`; return; }
  const info = parseId(id), cities = activeCities();
  const { q } = cityQuotes(id, cities);
  let lo = null, hi = null;
  for (const c of cities) {
    const s = q[c].s, b = q[c].b;
    if (s && s.age <= maxAge() && (!lo || s.p < lo.p)) lo = { ...s, city: c };
    if (b && b.age <= maxAge() && (!hi || b.p > hi.p)) hi = { ...b, city: c };
  }
  const ser = series7(id);
  const quote = (title, o, color, what) => `<div class="inset"><div class="k">${title}</div>`
    + (o ? `<div class="bigv" style="color:${color}">${fmt(o.p)}</div><div>${cityHtml(o.city)} <span class="k">${what}, ${fmtAge(o.age)} назад</span></div>` : `<div class="bigv empty">—</div><div class="k">нет свежих цен</div>`) + `</div>`;
  let w1 = `<div class="panel widget sel-w">
    <div class="item">${icon(id, 52)}<div class="iname" style="flex:1"><span class="k">Выбрано в таблице</span><b style="font-size:20px">${esc(info.name)}</b></div>
      ${ser ? `<div class="tl-v">${spark(ser.vals, 120, 34)}<span class="k">${fmtPct(ser.delta, true)} за 7 дней</span></div>` : ""}</div>
    <div class="pair">${quote("Купить дешевле всего", lo, "var(--bad)", "лот")}${quote("Продать сразу дороже всего", hi, "var(--good)", "ордер")}</div></div>`;

  // перепродажа: купить лот в одном городе, выставить свой лот в другом
  const fee = listingFee(), routes = [];
  for (const a of cities) for (const b of cities) {
    if (a === b) continue;
    const sa = q[a].s, sb = q[b].s;
    if (!sa || !sb || sa.age > maxAge() || sb.age > maxAge()) continue;
    const net = sb.p * (1 - fee) - sa.p;
    routes.push({ a, b, buy: sa.p, sell: sb.p, net, pct: net / sa.p });
  }
  routes.sort((x, y) => y.pct - x.pct);
  let w2 = `<div class="panel widget"><div class="w-head"><span class="k">Перепродажа между городами</span><span class="k">после налога ${fmtPct(fee)}, за 1 шт.</span></div>`;
  if (!routes.length) w2 += `<p class="w-empty">Нужны свежие лоты хотя бы в двух городах.</p>`;
  else {
    const r = routes[0], hs = histStats(id, r.b), good = r.net > 0;
    const sq = (c, label, price) => `<div class="sq${CITY_IMG.has(c) ? " bg-" + c.replace(/\s/g, "") : ""}" style="--cc:${CITY_COLOR[c]}"><small>${label}</small><b>${esc(c)}</b><span>${fmt(price)}</span></div>`;
    w2 += `<div class="arb">${sq(r.a, "Купи в", r.buy)}<svg class="arrow" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 14h18M16 7l7 7-7 7"/></svg>${sq(r.b, "Выставь лот в", r.sell)}
      <div class="arb-info"><div class="arb-pct ${good ? "pos" : "neg"}">${fmtPct(r.pct, true)}</div>
      <div style="font-weight:600">${fmtSigned(r.net)} с 1 шт.</div><div class="k">${fmtBig(r.net * STACK)} за стак</div>
      ${hs ? `<div class="k">в ${esc(r.b)} ~${nf0.format(hs.vol)} в день</div>` : ""}</div></div>`;
    if (!good) w2 += `<p class="w-empty">Сейчас перепродажа этого предмета не окупается: показан наименее убыточный маршрут.</p>`;
    const more = routes.slice(1, 4).filter((x) => x.net > 0);
    if (more.length) w2 += `<div class="routes"><span>Ещё маршруты:</span>${more.map((x) => `<span>${cityHtml(x.a)} → ${cityHtml(x.b)} <b class="pos">${fmtPct(x.pct, true)}</b></span>`).join("")}</div>`;
  }
  w2 += `</div>`;
  box.innerHTML = w1 + w2;
}
async function openSelected() {
  renderPricesWidgets();
  if (S.pItem) { await ensure([S.pItem], { history: true }); if (S.view === "prices") renderPricesWidgets(); }
}
async function openPrices(force = false) {
  renderPricesControls(); renderPricesTable(); renderPricesWidgets();
  await ensure(pricesIds(), { history: false, force });
  if (S.view !== "prices") return;
  const ids = pricesIds();
  if (!S.pItem || !ids.includes(S.pItem)) {
    S.pItem = ids.find((id) => { const r = cur[`${S.settings.server}|${id}`]; return r && Object.keys(r.cities).length; }) || ids[0] || null;
  }
  renderPricesControls(); renderPricesTable();
  await openSelected();
}

// ---------- вкладка «Переработка» ----------
function refineIds() {
  const out = [], e = S.rEnch;
  for (const f of S.rFams) for (const t of S.rTiers) {
    if (FAM[f].stone) { if (e > 0) continue; for (let k = 0; k <= 3; k++) out.push(rawId(f, t, k)); }
    else out.push(rawId(f, t, e));
    out.push(matId(f, t - 1, e), matId(f, t, e));
  }
  return [...new Set(out)];
}
function refineAll() {
  const rows = [], e = S.rEnch;
  for (const f of S.rFams) for (const t of S.rTiers) {
    if (FAM[f].stone && e > 0) continue;
    const c = calcSettings(f);
    const raw = pickRaw(f, t, e), prev = pickBuy(matId(f, t - 1, e)), sell = pickSell(matId(f, t, e));
    const row = { f, t, e, c, raw, prev, sell, ok: !!(raw && prev && sell), id: matId(f, t, e) };
    if (row.ok) Object.assign(row, economics(t, raw.price, prev.price * c.bf, sell.price, c));
    rows.push(row);
  }
  return rows;
}
function refineRows(all) {
  const key = { margin: (r) => r.margin, stack: (r) => r.profit, tier: null }[S.rSort];
  const rows = [...all].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (!key || !a.ok) return FAMS.indexOf(a.f) - FAMS.indexOf(b.f) || a.t - b.t;
    return key(b) - key(a);
  });
  return S.rOnlyPlus ? rows.filter((r) => r.ok && r.profit > 0) : rows;
}
const SORTS = [["margin", "Маржа"], ["stack", "За стак"], ["tier", "По тиру"]];
function renderRefineControls() {
  famChips($("r-fam"), S.rFams, (v) => { S.rFams = v; save(); openRefine(); });
  chips($("r-tiers"), tierItems(REFINE_TIERS), (v) => S.rTiers.includes(v), (v) => { S.rTiers = toggleIn(S.rTiers, v, REFINE_TIERS); save(); openRefine(); }, tierCls);
  chips($("r-ench"), ENCH_ITEMS, (v) => v === S.rEnch, (v) => { S.rEnch = v; save(); openRefine(); }, enchCls);
  chips($("r-sort"), SORTS, (v) => v === S.rSort, (v) => { S.rSort = v; save(); renderRefineControls(); renderRefine(); });
  const sm = $("r-sort-m");
  if (!sm.options.length) SORTS.forEach(([v, l]) => sm.add(new Option(l, v)));
  sm.value = S.rSort;
  $("r-onlyplus").checked = S.rOnlyPlus;
  const parts = [famsText(S.rFams), tiersText(S.rTiers)];
  if (S.rEnch) parts.push("." + S.rEnch);
  if (S.rOnlyPlus) parts.push("в плюсе");
  $("r-fsum").textContent = parts.join(" · ");
  const cnt = (S.rFams.length !== FAMS.length) + (S.rTiers.length !== REFINE_TIERS.length) + (S.rEnch !== 0) + (S.rOnlyPlus ? 1 : 0);
  $("r-fcount").textContent = cnt || "";
}
const recipeText = (r) => `${itemLabel(rawId(r.f, r.t, r.e))} ×${N[r.t]} + ${itemLabel(matId(r.f, r.t - 1, r.e))}`;
function rawUnitText(r) { return r.raw && FAM[r.f].stone && r.raw.ench ? `бери T${r.t}.${r.raw.ench} по ${fmt(r.raw.unit)}` : ""; }
function whereCell(o, extra = "") {
  if (!o) return `<td><span class="empty">нет цены</span></td>`;
  const tag = o.src === "hist" ? `<span class="tag" title="Свежего лота нет, взята медиана за 7 дней">история</span>` : o.src === "cap" ? `<span class="tag" title="Лот дороже обычного, взят P80 за 7 дней">P80</span>` : "";
  return `<td><span class="v">${fmt(o.price)}</span>${tag}<div class="where">${cityHtml(o.city)}<span class="age">${o.age !== undefined ? fmtAge(o.age) : ""}</span></div>${extra ? `<small>${extra}</small>` : ""}</td>`;
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
      ${line(`Купи ${esc(lc1(rawName))}`, b.raw, fmt(b.raw.unit))}
      ${line(`Купи ${esc(lc1(itemLabel(matId(b.f, b.t - 1, b.e))))}`, b.prev, fmt(b.prev.price))}
      ${line(`Продай ${esc(lc1(itemLabel(b.id)))}`, b.sell, fmt(b.sell.price))}
      <div class="b-line"><span class="b-lbl">Прибыль за стак 999</span><span class="b-where"><span class="liq ${liq.cls}" title="${esc(liq.txt)}">${isFinite(b.sell.vol) ? "продаётся " + nf0.format(b.sell.vol) + " в день" : "объём продаж неизвестен"}</span></span><b class="b-val pos">${fmtBig(b.profit * STACK)}</b></div>
    </div></div>`;
  const list = (title, rows, val, sub) => `<div class="panel widget"><span class="k">${title}</span><div class="tl">${rows.slice(0, 3).map((r) =>
    `<button type="button" class="tl-row" data-f="${r.f}" data-t="${r.t}">${icon(r.id, 38)}<span class="tl-name">${esc(itemLabel(r.id))}</span><span class="tl-v"><b class="pos">${val(r)}</b><span class="age">${sub(r)}</span></span></button>`).join("")}</div></div>`;
  h += list("Лучшие по марже", byMargin, (r) => nf0.format(r.margin * 100) + "%", (r) => fmtBig(r.profit * STACK));
  h += list("Больше всего за стак", byStack, (r) => fmtBig(r.profit * STACK), (r) => "маржа " + nf0.format(r.margin * 100) + "%");
  box.innerHTML = h;
  box.querySelectorAll(".tl-row").forEach((el) => el.addEventListener("click", () => goCalc(el.dataset.f, +el.dataset.t)));
}
function goCalc(f, t) {
  S.cFam = f; if (!S.cTiers.includes(t)) S.cTiers = toggleIn(S.cTiers, t, REFINE_TIERS);
  fillCalcFromMarket(f); save(); location.hash = "calc";
}
function renderRefine() {
  const all = refineAll(), rows = refineRows(all), c0 = calcSettings(), tbl = $("r-table"), cards = $("r-cards");
  renderRefineWidgets(all);
  $("r-show").textContent = `Показать ${rows.length} ${plural(rows.length, ["рецепт", "рецепта", "рецептов"])}`;
  let h = `<thead><tr><th scope="col">Что делаем</th><th scope="col">Сырьё</th><th scope="col">Тир ниже</th><th scope="col">Продажа</th><th scope="col">7 дней</th><th scope="col">За 1 шт.</th><th scope="col">Маржа</th><th scope="col">За стак</th></tr></thead><tbody>`;
  let m = "";
  if (!rows.length) {
    const msg = S.rOnlyPlus ? "При этих условиях сейчас ничего не выходит в плюс." : S.rEnch > 0 && S.rFams.every((f) => FAM[f].stone) ? "У камня нет зачарованных блоков. Выбери другой ресурс или .0." : "Нет данных.";
    h += `<tr><td class="msg" colspan="8">${msg}</td></tr>`;
    m = `<div class="panel card"><span class="k">${msg}</span></div>`;
  }
  for (const r of rows) {
    const name = esc(itemLabel(r.id)), recipe = esc(recipeText(r));
    h += `<tr tabindex="0" data-f="${r.f}" data-t="${r.t}"><td><div class="item">${icon(r.id, 42)}<div class="iname"><b>${name}${r.c.bonus ? ` <span class="tag" title="Ежедневный бонус переработки">бонус</span>` : ""}</b><small>${recipe}</small></div></div></td>`;
    h += whereCell(r.raw, rawUnitText(r)) + whereCell(r.prev) + whereCell(r.sell, r.sell ? liqHtml(r.sell.vol) : "");
    const ser = r.sell ? series7(r.id, r.sell.city) : null;
    h += `<td>${ser ? spark(ser.vals) : `<span class="empty">—</span>`}</td>`;
    const ln = (k, o, extra = "") => `<div class="m-line"><span class="k">${k}</span>${o ? cityHtml(o.city) + `<span class="age">${srcAge(o)}</span><b>${fmt(o.price)}</b>` : `<b class="empty">нет цены</b>`}</div>${extra}`;
    m += `<section class="panel card" tabindex="0" data-f="${r.f}" data-t="${r.t}"><div class="card-h">${icon(r.id, 42)}<div class="iname"><b>${name}</b><small>${recipe}</small></div>`;
    if (!r.ok) {
      h += `<td colspan="4"><span class="empty">не хватает цен</span></td></tr>`;
      m += `</div>${ln("Сырьё", r.raw)}${ln("Тир ниже", r.prev)}${ln("Продажа", r.sell)}</section>`;
      continue;
    }
    const cls = r.profit >= 0 ? "pos" : "neg", col = levelColor(r.margin, r.profit, c0.m);
    h += `<td><b class="${cls}">${fmtSigned(r.profit)}</b><small>себест. ${fmt(r.cost)}</small></td>${`<td>${marginBar(r, c0.m)}</td>`}`
      + `<td><b class="${cls}">${fmtBig(r.profit * STACK)}</b><small>вложить ${fmtBig(r.capital, false)}</small></td></tr>`;
    m += `<b style="color:${col};font-size:18px">${nf0.format(r.margin * 100)}%</b></div>`
      + ln("Сырьё", r.raw, rawUnitText(r) ? `<div class="sm" style="text-align:right">${rawUnitText(r)}</div>` : "") + ln("Тир ниже", r.prev) + ln("Продажа", r.sell)
      + `<div class="m-line"><span class="k">Продажи</span>${liqHtml(r.sell.vol)}</div>`
      + `<div class="m-line"><span class="k">За 1 шт. / за стак</span><b class="${cls}">${fmtSigned(r.profit)}</b><b class="${cls}" style="min-width:84px">${fmtBig(r.profit * STACK)}</b></div></section>`;
  }
  tbl.innerHTML = h + "</tbody>";
  cards.innerHTML = m;
  const go = (el) => goCalc(el.dataset.f, +el.dataset.t);
  rowNav(tbl, "tbody tr[data-f]", go);
  rowNav(cards, ".card[data-f]", go);
}
async function openRefine(force = false) {
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
function fillCalcFromMarket(f) {
  const P = S.calc[f];
  const note = (o, extra = "") => o ? `${o.city}${o.age !== undefined ? ", " + fmtAge(o.age) + " назад" : ""}${o.src === "hist" ? ", медиана за 7 дней" : o.src === "cap" ? ", P80 за 7 дней" : ""}${extra}` : "нет цены на рынке";
  for (const t of REFINE_TIERS) {
    const raw = pickRaw(f, t, 0), prev = pickBuy(matId(f, t - 1)), sell = pickSell(matId(f, t));
    P[t].raw = raw ? Math.round(raw.price) : null;
    P[t].prev = prev ? Math.round(prev.price) : null;
    P[t].sell = sell ? Math.round(sell.price) : null;
    P[t].note = { raw: note(raw, raw && raw.ench ? `, это T${t}.${raw.ench} по ${fmt(raw.unit)}` : ""), prev: note(prev), sell: note(sell) };
  }
  save();
}
const calcEmpty = (f) => REFINE_TIERS.every((t) => S.calc[f][t].raw == null && S.calc[f][t].sell == null);
async function marketFill() {
  const btn = $("c-fill"); btn.disabled = true;
  await ensure(calcIds(S.cFam), { history: true });
  fillCalcFromMarket(S.cFam); buildTiers(); updateCalc();
  btn.disabled = false;
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
          <input type="number" id="raw-${t}" min="0" step="1" inputmode="numeric" value="${p.raw ?? ""}"><span class="srcnote" id="n-raw-${t}"></span></div>
        <div class="field"><div class="lblrow"><label class="lbl-ic" for="prev-${t}">${icon(matId(f, t - 1), 28, false)}${esc(nm.prev)}</label>
            <span class="seg" role="group" aria-label="Откуда материал T${t - 1}">
              <button type="button" id="mk-${t}" aria-pressed="${!own}">рынок</button>
              <button type="button" id="ow-${t}" aria-pressed="${own}" ${t === 4 ? 'disabled title="T3 считается только по рынку"' : ""}>свой крафт</button>
            </span></div>
          <input type="number" id="prev-${t}" min="0" step="1" inputmode="numeric" value="${p.prev ?? ""}" ${own ? "hidden" : ""}>
          <div class="owncost" id="ownc-${t}" ${own ? "" : "hidden"}></div><span class="srcnote" id="n-prev-${t}"></span></div>
        <div class="field"><div class="lblrow"><label class="lbl-ic" for="sell-${t}">${icon(matId(f, t), 28, false)}${esc(nm.mat)}, продажа</label></div>
          <input type="number" id="sell-${t}" min="0" step="1" inputmode="numeric" value="${p.sell ?? ""}"><span class="srcnote" id="n-sell-${t}"></span></div>
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
  el.classList.remove("ok", "over");
  if (!isFinite(val)) { v.textContent = "—"; b.textContent = ""; cmp.textContent = ""; return; }
  if (kind !== "sell" && val <= 0) { v.textContent = "не выйдет"; b.textContent = "в минус даже бесплатно"; cmp.textContent = ""; el.classList.add("over"); return; }
  v.textContent = (kind === "sell" ? "≥ " : "≤ ") + fmt(val);
  b.textContent = "безубыток " + fmt(be);
  if (isFinite(have)) {
    const good = kind === "sell" ? have >= val : have <= val;
    el.classList.add(good ? "ok" : "over");
    cmp.textContent = "сейчас " + fmt(have) + (good ? ", подходит" : kind === "sell" ? ", ниже порога" : ", дороже порога");
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
      $(`st-${t}`).innerHTML = ""; if (L.stone) $(`E-${t}`).innerHTML = ""; continue;
    }
    $(`pill-${t}`).innerHTML = statusPill(o.margin, o.profit, c.m);
    setLim(`L-raw-${t}`, o.maxRaw(c.m), o.maxRaw(0), raw, "buy");
    const pe = $(`L-prev-${t}`);
    if (own) { setLim(`L-prev-${t}`, NaN); pe.querySelector(".v").textContent = "свой крафт"; pe.querySelector(".be").textContent = `себестоимость ${fmt(prevEff)}`; }
    else setLim(`L-prev-${t}`, o.maxPrev(c.m), o.maxPrev(0), num(p.prev), "buy");
    setLim(`L-sell-${t}`, o.minSell(c.m), o.minSell(0), sell, "sell");
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
  const sets = B / (set + c.station / c.k), outputs = sets / c.k, profit = outputs * st.o.profit;
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
  let spent = 0, rawQ = 0, prevQ = 0, rawSum = 0, prevSum = 0, made = 0, station = 0, sold = 0, revenue = 0, gross = 0;
  const sells = [];
  for (const e of cy.entries) {
    if (e.type === "buy") {
      const v = e.qty * e.price * (e.order ? 1.025 : 1); spent += v;
      if (e.what === "prev") { prevQ += e.qty; prevSum += e.qty * e.price; } else { rawQ += e.qty; rawSum += e.qty * e.price; }
    } else if (e.type === "refine") { made += e.qty; station += e.station || 0; }
    else if (e.type === "sell") { sold += e.qty; gross += e.qty * e.price; revenue += e.qty * e.price * (1 - e.fee); sells.push(e); }
  }
  const unitCost = made > 0 ? (spent + station) / made : NaN;
  const profit = sold > 0 && made > 0 ? revenue - sold * unitCost : cy.closed ? revenue - spent - station : NaN;
  const ts = cy.entries.map((e) => e.ts);
  return {
    spent, rawQ, prevQ, avgRaw: rawQ ? rawSum / rawQ : NaN, avgPrev: prevQ ? prevSum / prevQ : NaN, made, station, sold, revenue,
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
    const bought = [s.rawQ ? `${lc1(itemLabel(rawId(cy.f, cy.t, cy.e)))} ${nf0.format(s.rawQ)} × ${fmt(s.avgRaw)}` : "", s.prevQ ? `${lc1(itemLabel(matId(cy.f, cy.t - 1, cy.e)))} ${nf0.format(s.prevQ)} × ${fmt(s.avgPrev)}` : ""].filter(Boolean).join(", ");
    const entries = [...cy.entries].sort((a, b) => b.ts - a.ts).map((e) => {
      const what = e.type === "buy" ? itemLabel(e.what === "prev" ? matId(cy.f, cy.t - 1, cy.e) : rawId(cy.f, cy.t, cy.e)) : e.type === "refine" ? "получено" : itemLabel(id);
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
  if (!tg.cy) h += `<div class="row3">
      <label class="field"><span class="k">Ресурс</span><select id="jf-f">${FAMS.map((f) => opt(f, FAM[f].tab, f === tg.f)).join("")}</select></label>
      <label class="field"><span class="k">Тир</span><select id="jf-t">${REFINE_TIERS.map((t) => opt(t, "T" + t, t === tg.t)).join("")}</select></label>
      <label class="field"><span class="k">Зачар.</span><select id="jf-e" ${FAM[tg.f].stone ? "disabled" : ""}>${[0, 1, 2, 3].map((e) => opt(e, "." + e, e === tg.e)).join("")}</select></label>
    </div><span class="k">Цикл — это ${esc(lc1(matN))}: закупка, переработка и продажа одной партии.</span>`;
  if (jf.type === "buy") {
    h += `<label class="field"><span class="k">Что купил</span><select id="jf-what">${opt("raw", rawN, jf.what !== "prev")}${opt("prev", prevN, jf.what === "prev")}</select></label>`;
  }
  if (jf.type !== "refine") {
    const mk = jf.type === "sell" ? pickSell(matId(tg.f, tg.t, tg.e)) : jf.what === "prev" ? pickBuy(matId(tg.f, tg.t - 1, tg.e)) : pickBuy(rawId(tg.f, tg.t, tg.e));
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
    if (jf.type === "buy") { e.what = jf.what === "prev" ? "prev" : "raw"; e.order = !!jf.order; }
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
      const o = economics(tg.t, raw.price, prev.price * c.bf, sell.price, c);
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
  $("sumhint").textContent = `Условия: возврат ${rp}%, маржа ${nf1.format(c.m * 100)}%${st.bonusFam ? `, бонус: ${FAM[st.bonusFam].tab.toLowerCase()} +${st.bonusPct}%` : ""}`;
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
  renderTicker();
}
function bindSettings() {
  const st = S.settings;
  $("s-server").value = st.server; $("s-caerleon").checked = !!st.caerleon; $("s-brecilien").checked = !!st.brecilien;
  $("s-mode").value = st.mode; $("s-age").value = st.age;
  $("s-rrr").value = st.rrr; $("s-rrrc").value = st.rrrc; $("s-fee").value = st.fee; $("s-station").value = st.station;
  $("s-margin").value = st.margin; $("s-buffer").value = st.buffer; $("s-order").checked = !!st.order;
  $("s-bfam").value = st.bonusFam || ""; $("s-bpct").value = String(st.bonusPct || 10);
  ["s-m1", "s-m2", "s-m3"].forEach((id, i) => ($(id).value = st.m[i]));
  const on = (id, fn, ev = "input") => $(id).addEventListener(ev, (e) => { fn(e.target); save(); rerenderAll(); });
  on("s-rrr", (el) => (st.rrr = el.value), "change"); on("s-rrrc", (el) => (st.rrrc = el.value));
  on("s-fee", (el) => (st.fee = el.value), "change"); on("s-station", (el) => (st.station = el.value));
  on("s-margin", (el) => (st.margin = el.value)); on("s-buffer", (el) => (st.buffer = el.value));
  on("s-order", (el) => (st.order = el.checked), "change"); on("s-age", (el) => (st.age = el.value));
  on("s-mode", (el) => (st.mode = el.value), "change");
  on("s-bfam", (el) => (st.bonusFam = el.value), "change"); on("s-bpct", (el) => (st.bonusPct = +el.value), "change");
  on("s-caerleon", (el) => (st.caerleon = el.checked), "change"); on("s-brecilien", (el) => (st.brecilien = el.checked), "change");
  ["s-m1", "s-m2", "s-m3"].forEach((id, i) => on(id, (el) => (st.m[i] = el.value)));
  $("s-server").addEventListener("change", (e) => { st.server = e.target.value; save(); sumHint(); tickerLoaded = false; route(); loadTicker(); });
  const dlg = $("settings");
  $("open-settings").addEventListener("click", () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  document.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeSet)));
  document.querySelectorAll("[data-reload]").forEach((b) => b.addEventListener("click", () => (b.dataset.reload === "prices" ? openPrices(true) : openRefine(true))));
  document.querySelectorAll("[data-open-sheet]").forEach((b) => b.addEventListener("click", () => openSheet(b.dataset.openSheet)));
  document.querySelectorAll("[data-close-sheet]").forEach((b) => b.addEventListener("click", closeSheet));
  $("scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  window.matchMedia("(max-width: 760px)").addEventListener("change", (e) => { if (!e.matches) closeSheet(); });
  $("p-freset").addEventListener("click", () => { S.pFams = [...FAMS]; S.pTiers = [...ALL_TIERS]; S.pEnch = 0; S.pKind = "all"; save(); openPrices(); });
  $("r-freset").addEventListener("click", () => { S.rFams = [...FAMS]; S.rTiers = [...REFINE_TIERS]; S.rEnch = 0; S.rOnlyPlus = false; S.rSort = "margin"; save(); openRefine(); });
  $("r-onlyplus").addEventListener("change", (e) => { S.rOnlyPlus = e.target.checked; save(); renderRefineControls(); renderRefine(); });
  $("r-sort-m").addEventListener("change", (e) => { S.rSort = e.target.value; save(); renderRefineControls(); renderRefine(); });
  $("c-fill").addEventListener("click", marketFill);
  $("c-reset").addEventListener("click", () => { S.calc[S.cFam] = emptyCalc(); save(); buildTiers(); updateCalc(); });
  $("j-export").addEventListener("click", exportJournal);
  $("j-import").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) importJournal(f); e.target.value = ""; });
}

// ---------- навигация ----------
const VIEWS = ["prices", "refine", "calc", "journal"];
function route() {
  const h = location.hash.replace("#", "");
  S.view = VIEWS.includes(h) ? h : (VIEWS.includes(S.view) ? S.view : "refine");
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
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.view; }));
window.addEventListener("hashchange", route);

setTheme(document.documentElement.dataset.theme === "aurora" ? "aurora" : "glass");
bindSettings(); sumHint();
if (!location.hash) history.replaceState(null, "", "#" + (VIEWS.includes(S.view) ? S.view : "refine"));
route();
setTimeout(loadTicker, 1200);
