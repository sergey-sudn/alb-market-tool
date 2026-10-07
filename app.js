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
const CITY_RU = {
  Bridgewatch: "Бриджвотч", Martlock: "Мартлок", Thetford: "Тетфорд", "Fort Sterling": "Форт Стерлинг",
  Lymhurst: "Лимхерст", Caerleon: "Карлеон", Brecilien: "Брецилиен",
};
const CITY_COLOR = Object.fromEntries(CITIES.map((c, i) => [c, `var(--c${i + 1})`]));
const FAM = {
  stone: { tab: "Камень",  raw: "ROCK",  mat: "STONEBLOCK", rawRu: "Камень",  matRu: "Блок",   city: "Bridgewatch", stone: true },
  fiber: { tab: "Волокно", raw: "FIBER", mat: "CLOTH",      rawRu: "Волокно", matRu: "Ткань",  city: "Lymhurst" },
  ore:   { tab: "Руда",    raw: "ORE",   mat: "METALBAR",   rawRu: "Руда",    matRu: "Слиток", city: "Thetford" },
  wood:  { tab: "Дерево",  raw: "WOOD",  mat: "PLANKS",     rawRu: "Дерево",  matRu: "Доска",  city: "Fort Sterling" },
  hide:  { tab: "Шкуры",   raw: "HIDE",  mat: "LEATHER",    rawRu: "Шкура",   matRu: "Кожа",   city: "Martlock" },
};
const FAMS = Object.keys(FAM);
const N = { 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 };
const REFINE_TIERS = [4, 5, 6, 7, 8];
const ALL_TIERS = [2, 3, 4, 5, 6, 7, 8];
const STACK = 999;

function rawId(f, t, e = 0) { const b = FAM[f].raw; return e > 0 && t >= 4 ? `T${t}_${b}_LEVEL${e}@${e}` : `T${t}_${b}`; }
function matId(f, t, e = 0) {
  const b = FAM[f].mat;
  if (FAM[f].stone || t < 4 || !e) return `T${t}_${b}`;
  return `T${t}_${b}_LEVEL${e}@${e}`;
}
function itemLabel(id) {
  const m = /^T(\d)_([A-Z]+)(?:_LEVEL(\d)@\d)?$/.exec(id);
  if (!m) return id;
  const [, t, base, e] = m;
  for (const f of FAMS) {
    if (FAM[f].raw === base) return `${FAM[f].rawRu} T${t}${e ? "." + e : ""}`;
    if (FAM[f].mat === base) return `${FAM[f].matRu} T${t}${e ? "." + e : ""}`;
  }
  return id;
}

// ---------- состояние ----------
const KEY = "alb-market-tool-v1";
const DEF = {
  server: "europe", caerleon: false, brecilien: false, mode: "safe", age: 24,
  rrr: "0.367", rrrc: 36.7, fee: "0.065", station: 0, margin: 10, buffer: 5, order: true, m: [2, 4, 8],
};
const S = {
  settings: { ...DEF, m: [...DEF.m] },
  view: "refine",
  pFams: ["stone", "fiber"], pTiers: [5, 6, 7, 8], pKind: "all", pEnch: 0, pItem: null, pPeriod: 30, pHidden: [],
  rFams: [...FAMS], rTiers: [5, 6, 7, 8], rEnch: 0, rOnlyPlus: false, rSort: "margin",
  cFam: "stone", cTiers: [5, 6, 7, 8], calc: {},
};
for (const f of FAMS) S.calc[f] = emptyCalc();
function emptyCalc() { const o = {}; for (const t of REFINE_TIERS) o[t] = { raw: null, prev: null, sell: null, own: false, note: {} }; return o; }

const KEYS = ["view", "pFams", "pTiers", "pKind", "pEnch", "pItem", "pPeriod", "pHidden", "rFams", "rTiers", "rEnch", "rOnlyPlus", "rSort", "cFam", "cTiers"];
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) {
    if (saved.settings) S.settings = { ...S.settings, ...saved.settings };
    for (const k of KEYS) if (k in saved) S[k] = saved[k];
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
function fmtBig(x, signed = true) {
  if (!isFinite(x)) return "—";
  const s = !signed ? "" : x < 0 ? "−" : x > 0 ? "+" : ""; const a = Math.abs(x);
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
function setStatus(text, err = false) { const el = $("status"); el.textContent = text; el.classList.toggle("err", err); }
function progress() { if (pending > 0) setStatus(`Загружаю цены… ${done}/${done + pending}`); }

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
  done = 0;
  try {
    await loadCurrent(ids, force);
    if (history) await loadHistory(ids, force);
    const t = new Date();
    setStatus(`${SERVER_RU[S.settings.server]}, цены на ${t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`);
  } catch (e) {
    setStatus(`Не удалось получить цены: ${e.message}`, true);
  }
}

// ---------- статистика и выбор цены ----------
function histStats(id, city) {
  const rec = hist[`${S.settings.server}|${id}`]; const arr = rec && rec.cities[city];
  if (!arr || !arr.length) return null;
  const since = Date.now() - 8 * 864e5;
  const pts = arr.filter((d) => d.t >= since);
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
  return { p, age: (Date.now() - t) / 36e5 };
}
function activeCities() { return CITIES.filter((c) => (c !== "Caerleon" || S.settings.caerleon) && (c !== "Brecilien" || S.settings.brecilien)); }
const MIN_VOL = 50;
// Сколько стоит купить 1 шт. в городе
function buyIn(id, city) {
  const live = liveOf(id, city, "sell"), hs = histStats(id, city), mode = S.settings.mode, maxAge = num(S.settings.age) || 24;
  const fresh = live && live.age <= maxAge ? live : null;
  if (mode === "live") return fresh ? { price: fresh.p, city, src: "live", age: fresh.age } : null;
  if (mode === "hist") return hs && hs.vol >= MIN_VOL ? { price: hs.med, city, src: "hist" } : null;
  if (fresh) return { price: fresh.p, city, src: "live", age: fresh.age };
  return hs && hs.vol >= MIN_VOL ? { price: hs.med, city, src: "hist" } : null;
}
// За сколько можно продать 1 шт. своим лотом в городе
function sellIn(id, city) {
  const live = liveOf(id, city, "sell"), hs = histStats(id, city), mode = S.settings.mode, maxAge = num(S.settings.age) || 24;
  const fresh = live && live.age <= maxAge ? live : null;
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
  const cs = calcSettings();
  if (!FAM[f].stone) { const o = pickBuy(rawId(f, t, e)); return o && { ...o, ench: e, unit: o.price }; }
  let best = null;
  for (let k = 0; k <= (t >= 4 ? 3 : 0); k++) {
    const o = pickBuy(rawId(f, t, k)); if (!o) continue;
    const eff = o.price / (k ? cs.mult[k - 1] : 1);
    if (!best || eff < best.price) best = { ...o, price: eff, unit: o.price, ench: k };
  }
  return best;
}

// ---------- расчёт ----------
function calcSettings() {
  const st = S.settings;
  const r = st.rrr === "custom" ? num(st.rrrc) / 100 : +st.rrr;
  return {
    k: 1 - (isFinite(r) ? r : 0), r, fee: +st.fee, station: num(st.station) || 0, m: (num(st.margin) || 0) / 100,
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
function statusPill(margin, profit, target) {
  if (!isFinite(margin)) return `<span class="pill none">нет данных</span>`;
  if (profit > 0 && margin >= target) return `<span class="pill good">в плюсе, ${nf0.format(margin * 100)}%</span>`;
  if (profit >= 0) return `<span class="pill warn">на грани, ${nf0.format(margin * 100)}%</span>`;
  return `<span class="pill bad">в минусе, ${nf0.format(margin * 100)}%</span>`;
}


// ---------- общие элементы ----------
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
const tierChipItems = (tiers) => tiers.map((t) => [t, `T${t}`]);
const tierCls = (t) => `t${t}`;
const ENCH_ITEMS = [[0, ".0"], [1, ".1"], [2, ".2"], [3, ".3"]];
const enchCls = (e) => (e ? `e-chip-${e}` : "");
function tierBadge(t, e = 0) { return `<span class="tier t${t} ench-${e}">T${t}${e ? `<sup>.${e}</sup>` : ""}</span>`; }
function parseId(id) {
  const m = /^T(\d)_([A-Z]+)(?:_LEVEL(\d)@\d)?$/.exec(id); if (!m) return null;
  const t = +m[1], base = m[2], e = +(m[3] || 0);
  for (const f of FAMS) {
    if (FAM[f].raw === base) return { t, e, f, kind: "raw", name: FAM[f].rawRu };
    if (FAM[f].mat === base) return { t, e, f, kind: "mat", name: FAM[f].matRu };
  }
  return null;
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
function rowNav(tbl, sel, go) {
  tbl.querySelectorAll(sel).forEach((tr) => {
    tr.addEventListener("click", () => go(tr));
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(tr); } });
  });
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
  chips($("p-fam"), FAMS.map((f) => [f, FAM[f].tab]), (v) => S.pFams.includes(v), (v) => { S.pFams = toggleIn(S.pFams, v, FAMS); save(); openPrices(); });
  chips($("p-tiers"), tierChipItems(ALL_TIERS), (v) => S.pTiers.includes(v), (v) => { S.pTiers = toggleIn(S.pTiers, v, ALL_TIERS); save(); openPrices(); }, tierCls);
  $("p-ench").classList.add("tiers-chips");
  chips($("p-ench"), ENCH_ITEMS, (v) => v === S.pEnch, (v) => { S.pEnch = v; S.pItem = null; save(); openPrices(); }, enchCls);
  chips($("p-kind"), [["all", "Всё"], ["raw", "Сырьё"], ["mat", "Материал"]], (v) => v === S.pKind, (v) => { S.pKind = v; save(); openPrices(); });
}
function priceRow(id, cities, maxAge) {
  const rec = cur[`${S.settings.server}|${id}`], info = parseId(id);
  let minSell = Infinity, maxBuy = -Infinity;
  for (const c of cities) {
    const s = liveOf(id, c, "sell"), b = liveOf(id, c, "buy");
    if (s && s.age <= maxAge) minSell = Math.min(minSell, s.p);
    if (b && b.age <= maxAge) maxBuy = Math.max(maxBuy, b.p);
  }
  let h = `<tr tabindex="0" data-id="${esc(id)}" class="${id === S.pItem ? "sel" : ""}"><td><div class="item">${tierBadge(info.t, info.e)}<div class="iname"><b>${info.name}</b><small>${info.kind === "raw" ? "сырьё" : "материал"}</small></div></div></td>`;
  for (const c of cities) {
    if (!rec) { h += `<td><span class="empty">…</span></td>`; continue; }
    const s = liveOf(id, c, "sell"), b = liveOf(id, c, "buy");
    if (!s && !b) { h += `<td><span class="empty">нет</span></td>`; continue; }
    const age = Math.min(s ? s.age : Infinity, b ? b.age : Infinity);
    const ageCls = age < 1 ? "fresh" : age > maxAge ? "old" : "";
    h += `<td><div class="cell">`
      + (s ? `<span class="s${s.p === minSell && s.age <= maxAge ? " best" : ""}" title="Самый дешёвый лот">${fmt(s.p)}</span>` : `<span class="empty">—</span>`)
      + (b ? `<span class="b${b.p === maxBuy && b.age <= maxAge ? " best" : ""}" title="Лучший ордер на закупку">${fmt(b.p)}</span>` : `<span class="empty">—</span>`)
      + `<span class="a ${ageCls}">${fmtAge(age)}</span></div></td>`;
  }
  return h + "</tr>";
}
function renderPricesTable() {
  const groups = pricesGroups(), cities = activeCities(), maxAge = num(S.settings.age) || 24, tbl = $("p-table");
  let h = `<thead><tr><th scope="col">Ресурс</th>${cities.map((c) => `<th scope="col">${CITY_RU[c]}</th>`).join("")}</tr></thead><tbody>`;
  let any = false;
  for (const g of groups) {
    if (!g.ids.length) continue;
    any = true;
    if (groups.length > 1) h += `<tr class="group"><td colspan="${cities.length + 1}">${FAM[g.f].tab} <span>бонусный город: ${CITY_RU[FAM[g.f].city]}</span></td></tr>`;
    for (const id of g.ids) h += priceRow(id, cities, maxAge);
  }
  if (!any) h += `<tr><td class="msg" colspan="${cities.length + 1}">Для такого фильтра предметов нет. Зачарованные ресурсы бывают только с T4.</td></tr>`;
  tbl.innerHTML = h + "</tbody>";
  rowNav(tbl, "tbody tr[data-id]", (tr) => { S.pItem = tr.dataset.id; save(); renderPricesTable(); openChart(); });
}
async function openPrices(force = false) {
  renderPricesControls(); renderPricesTable();
  await ensure(pricesIds(), { history: false, force });
  renderPricesTable();
  if (S.pItem && pricesIds().includes(S.pItem)) openChart(); else $("p-chartcard").hidden = true;
}
async function openChart() {
  const id = S.pItem; if (!id) return;
  const info = parseId(id);
  $("p-chartcard").hidden = false;
  $("p-chart-title").innerHTML = `${info.name} ${tierBadge(info.t, info.e)}`;
  chips($("p-period"), [[7, "7 дней"], [30, "30 дней"]], (v) => v === S.pPeriod, (v) => { S.pPeriod = v; save(); openChart(); });
  if (!hist[`${S.settings.server}|${id}`]) $("p-chart").innerHTML = `<p class="note">Загружаю историю…</p>`;
  await ensure([id], { history: true });
  drawChart();
}
function drawChart() {
  const id = S.pItem, box = $("p-chart"), rec = hist[`${S.settings.server}|${id}`];
  const since = Date.now() - S.pPeriod * 864e5;
  const cities = activeCities().filter((c) => rec && rec.cities[c] && rec.cities[c].some((d) => d.t >= since));
  const lg = $("p-legend"); lg.innerHTML = "";
  for (const c of cities) {
    const b = document.createElement("button"); b.type = "button";
    b.setAttribute("aria-pressed", String(!S.pHidden.includes(c)));
    b.innerHTML = `<i style="background:${CITY_COLOR[c]}"></i>${CITY_RU[c]}`;
    b.addEventListener("click", () => { S.pHidden = S.pHidden.includes(c) ? S.pHidden.filter((x) => x !== c) : [...S.pHidden, c]; save(); drawChart(); });
    lg.appendChild(b);
  }
  const series = cities.filter((c) => !S.pHidden.includes(c)).map((c) => ({ c, pts: rec.cities[c].filter((d) => d.t >= since) }));
  const all = series.flatMap((s) => s.pts);
  if (!all.length) { box.innerHTML = `<p class="note">За этот период продаж не было или данных нет.</p>`; $("p-chart-note").textContent = ""; return; }
  const W = Math.max(320, box.clientWidth || 700), H = 280, ml = 60, mr = 16, mt = 10, mb = 28;
  const t0 = Math.min(...all.map((d) => d.t)), t1 = Math.max(...all.map((d) => d.t));
  let y0 = Math.min(...all.map((d) => d.p)), y1 = Math.max(...all.map((d) => d.p));
  const pad = (y1 - y0) * 0.08 || y1 * 0.05; y0 = Math.max(0, y0 - pad); y1 += pad;
  const step = niceStep((y1 - y0) / 4); y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
  const X = (t) => ml + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - ml - mr);
  const Y = (p) => mt + (1 - (p - y0) / (y1 - y0)) * (H - mt - mb);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Средняя цена по дням: ${esc(itemLabel(id))}"><g class="axis">`;
  for (let v = y0; v <= y1 + step / 2; v += step) svg += `<line class="gridline" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${ml - 10}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  const days = Math.max(1, Math.round((t1 - t0) / 864e5)), every = Math.max(1, Math.ceil(days / 6));
  for (let i = 0; i <= days; i += every) {
    const t = t0 + i * 864e5;
    svg += `<text x="${X(t)}" y="${H - 6}" text-anchor="middle">${new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" })}</text>`;
  }
  svg += `</g>`;
  for (const s of series) {
    const d = s.pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.p).toFixed(1)}`).join("");
    svg += `<path class="series" d="${d}" style="stroke:${CITY_COLOR[s.c]}"/>`;
    const last = s.pts[s.pts.length - 1];
    svg += `<circle cx="${X(last.t)}" cy="${Y(last.p)}" r="4" style="fill:${CITY_COLOR[s.c]};stroke:var(--panel);stroke-width:2"/>`;
  }
  svg += `<line class="cross" id="xhair" y1="${mt}" y2="${H - mb}" x1="0" x2="0" visibility="hidden"/>`;
  svg += `<rect x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}" fill="transparent" id="hit"/></svg>`;
  box.innerHTML = svg;
  const svgEl = box.querySelector("svg"), hit = box.querySelector("#hit"), xh = box.querySelector("#xhair");
  const daysList = [...new Set(all.map((d) => d.t))].sort((a, b) => a - b);
  const onMove = (ev) => {
    const r = svgEl.getBoundingClientRect(); const x = (ev.clientX - r.left) * (W / r.width);
    let best = daysList[0];
    for (const t of daysList) if (Math.abs(X(t) - x) < Math.abs(X(best) - x)) best = t;
    xh.setAttribute("x1", X(best)); xh.setAttribute("x2", X(best)); xh.setAttribute("visibility", "visible");
    let html = `<div class="tt-h">${new Date(best).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" })}</div>`;
    for (const s of series) {
      const p = s.pts.find((d) => d.t === best); if (!p) continue;
      html += `<div class="tt-r"><span><i style="background:${CITY_COLOR[s.c]}"></i>${CITY_RU[s.c]}</span><span>${fmt(p.p)}, ${nf0.format(p.c)} шт.</span></div>`;
    }
    showTip(html, ev.clientX, ev.clientY);
  };
  hit.addEventListener("pointermove", onMove);
  hit.addEventListener("pointerdown", onMove);
  hit.addEventListener("pointerleave", () => { hideTip(); xh.setAttribute("visibility", "hidden"); });
  const vol = series.reduce((a, s) => a + s.pts.reduce((x, d) => x + d.c, 0), 0);
  $("p-chart-note").textContent = `Средняя цена продаж за день. Продано за период в показанных городах: ${nf0.format(vol)} шт.`;
}
function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
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
function refineRows() {
  const c = calcSettings(), rows = [], e = S.rEnch;
  for (const f of S.rFams) for (const t of S.rTiers) {
    if (FAM[f].stone && e > 0) continue;
    const raw = pickRaw(f, t, e), prev = pickBuy(matId(f, t - 1, e)), sell = pickSell(matId(f, t, e));
    const row = { f, t, e, raw, prev, sell, ok: !!(raw && prev && sell) };
    if (row.ok) Object.assign(row, economics(t, raw.price, prev.price * c.bf, sell.price, c));
    rows.push(row);
  }
  const key = { margin: (r) => r.margin, stack: (r) => r.profit, tier: null }[S.rSort];
  rows.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (!key || !a.ok) return FAMS.indexOf(a.f) - FAMS.indexOf(b.f) || a.t - b.t;
    return key(b) - key(a);
  });
  return S.rOnlyPlus ? rows.filter((r) => r.ok && r.profit > 0) : rows;
}
function srcTag(o) {
  if (!o) return "";
  if (o.src === "hist") return `<span class="tag hist" title="Свежего лота нет, взята медиана или P80 за 7 дней">история</span>`;
  if (o.src === "cap") return `<span class="tag hist" title="Лот дороже обычного, взят P80 за 7 дней">P80</span>`;
  return "";
}
function whereCell(o, extra = "") {
  if (!o) return `<td><span class="empty">нет цены</span></td>`;
  const age = o.age !== undefined ? `, ${fmtAge(o.age)}` : "";
  return `<td><span class="v">${fmt(o.price)}</span>${srcTag(o)}<small>${CITY_RU[o.city]}${age}${extra}</small></td>`;
}
function marginCell(r, target) {
  const m = r.margin, col = r.profit > 0 && m >= target ? "var(--good)" : r.profit >= 0 ? "var(--warn)" : "var(--bad)";
  const w = Math.max(4, Math.min(100, Math.abs(m) / 0.6 * 100));
  return `<td><span class="margin"><span class="mbar"><i style="width:${w}%;background:${col}"></i></span><b style="color:${col}">${nf0.format(m * 100)}%</b></span></td>`;
}
function renderRefineControls() {
  chips($("r-fam"), FAMS.map((f) => [f, FAM[f].tab]), (v) => S.rFams.includes(v), (v) => { S.rFams = toggleIn(S.rFams, v, FAMS); save(); openRefine(); });
  chips($("r-tiers"), tierChipItems(REFINE_TIERS), (v) => S.rTiers.includes(v), (v) => { S.rTiers = toggleIn(S.rTiers, v, REFINE_TIERS); save(); openRefine(); }, tierCls);
  $("r-ench").classList.add("tiers-chips");
  chips($("r-ench"), ENCH_ITEMS, (v) => v === S.rEnch, (v) => { S.rEnch = v; save(); openRefine(); }, enchCls);
  $("r-onlyplus").checked = S.rOnlyPlus; $("r-sort").value = S.rSort;
}
function renderRefineTable() {
  const c = calcSettings(), rows = refineRows(), tbl = $("r-table");
  let h = `<thead><tr><th scope="col">Что делаем</th><th scope="col">Сырьё, за 1</th><th scope="col">Материал тира ниже</th><th scope="col">Продажа</th>`
    + `<th scope="col">Себестоимость</th><th scope="col">Прибыль за 1</th><th scope="col">Маржа</th><th scope="col">За стак 999</th><th scope="col">Деньги на стак</th><th scope="col">Продаж в день</th></tr></thead><tbody>`;
  if (!rows.length) h += `<tr><td class="msg" colspan="10">${S.rOnlyPlus ? "При этих условиях сейчас ничего не выходит в плюс." : S.rEnch > 0 && S.rFams.every((f) => FAM[f].stone) ? "У камня нет зачарованных блоков. Выбери другой ресурс или .0." : "Нет данных."}</td></tr>`;
  for (const r of rows) {
    const L = FAM[r.f];
    const rawExtra = r.raw && L.stone && r.raw.ench ? `, бери T${r.t}.${r.raw.ench} по ${fmt(r.raw.unit)}` : "";
    h += `<tr tabindex="0" data-f="${r.f}" data-t="${r.t}"><td><div class="item">${tierBadge(r.t, r.e)}<div class="iname"><b>${L.matRu}</b><small>${L.rawRu} ×${N[r.t]} + ${L.matRu} T${r.t - 1}</small></div></div></td>`;
    h += whereCell(r.raw, rawExtra) + whereCell(r.prev) + whereCell(r.sell);
    if (!r.ok) { h += `<td colspan="6"><span class="empty">не хватает цен</span></td></tr>`; continue; }
    const cls = r.profit >= 0 ? "pos" : "neg";
    h += `<td>${fmt(r.cost)}</td><td class="${cls}"><b>${fmtSigned(r.profit)}</b></td>${marginCell(r, c.m)}`
      + `<td class="${cls}"><b>${fmtBig(r.profit * STACK)}</b></td><td>${fmtBig(r.capital, false)}</td>`
      + `<td>${isFinite(r.sell.vol) ? nf0.format(r.sell.vol) : "—"}</td></tr>`;
  }
  tbl.innerHTML = h + "</tbody>";
  rowNav(tbl, "tbody tr[data-f]", (tr) => {
    const f = tr.dataset.f, t = +tr.dataset.t;
    S.cFam = f; if (!S.cTiers.includes(t)) S.cTiers = toggleIn(S.cTiers, t, REFINE_TIERS);
    fillCalcFromMarket(f); location.hash = "calc";
  });
}
async function openRefine(force = false) {
  renderRefineControls(); renderRefineTable();
  await ensure(refineIds(), { history: true, force });
  renderRefineTable();
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
  const note = (o, extra = "") => o ? `${CITY_RU[o.city]}${o.age !== undefined ? ", " + fmtAge(o.age) : ""}${o.src === "hist" ? ", медиана за 7 дней" : o.src === "cap" ? ", P80 за 7 дней" : ""}${extra}` : "нет цены на рынке";
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
  chips($("c-tiers"), tierChipItems(REFINE_TIERS), (v) => S.cTiers.includes(v), (v) => { S.cTiers = toggleIn(S.cTiers, v, REFINE_TIERS); save(); renderCalcControls(); buildTiers(); updateCalc(); }, tierCls);
  const L = FAM[S.cFam];
  $("c-city").textContent = `До какой цены покупать и от какой продавать, чтобы переработка шла в плюс. ${L.tab}: бонусный город — ${CITY_RU[L.city]}, только там действует возврат 36,7% и 53,9%.`;
}
function buildTiers() {
  const f = S.cFam, L = FAM[f], P = S.calc[f], main = $("c-tiers-list"); main.innerHTML = "";
  for (const t of [...S.cTiers].sort((a, b) => b - a)) {
    const p = P[t], own = !!p.own && t > 4;
    const card = document.createElement("section"); card.className = `tcard t${t}`; card.setAttribute("aria-labelledby", `h-${t}`);
    card.innerHTML = `
      <div class="tcard-h">
        <div class="ttl"><span class="big" id="h-${t}">T${t}</span><span class="recipe">${L.rawRu} T${t} ×${N[t]} + ${L.matRu} T${t - 1} → ${L.matRu} T${t}</span></div>
        <span id="pill-${t}"></span>
      </div>
      <div class="inputs">
        <div class="field"><div class="lblrow"><label for="raw-${t}">${L.rawRu} T${t}, покупка</label></div>
          <input type="number" id="raw-${t}" min="0" step="1" value="${p.raw ?? ""}"><span class="srcnote" id="n-raw-${t}"></span></div>
        <div class="field"><div class="lblrow"><label for="prev-${t}">${L.matRu} T${t - 1}</label>
            <span class="seg" role="group" aria-label="Откуда материал T${t - 1}">
              <button type="button" id="mk-${t}" aria-pressed="${!own}">рынок</button>
              <button type="button" id="ow-${t}" aria-pressed="${own}" ${t === 4 ? 'disabled title="T3 считается только по рынку"' : ""}>свой крафт</button>
            </span></div>
          <input type="number" id="prev-${t}" min="0" step="1" value="${p.prev ?? ""}" ${own ? "hidden" : ""}>
          <div class="owncost" id="ownc-${t}" ${own ? "" : "hidden"}></div><span class="srcnote" id="n-prev-${t}"></span></div>
        <div class="field"><div class="lblrow"><label for="sell-${t}">${L.matRu} T${t}, продажа</label></div>
          <input type="number" id="sell-${t}" min="0" step="1" value="${p.sell ?? ""}"><span class="srcnote" id="n-sell-${t}"></span></div>
      </div>
      <div class="limits">
        <div class="lim" id="L-raw-${t}"><span class="k">${L.rawRu} T${t}: покупай до</span><span class="v"></span><span class="be"></span><span class="cmp"></span></div>
        <div class="lim" id="L-prev-${t}"><span class="k">${L.matRu} T${t - 1}: покупай до</span><span class="v"></span><span class="be"></span><span class="cmp"></span></div>
        <div class="lim" id="L-sell-${t}"><span class="k">${L.matRu} T${t}: продавай от</span><span class="v"></span><span class="be"></span><span class="cmp"></span></div>
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
  if (!S.cTiers.length) main.innerHTML = `<p class="note">Выбери хотя бы один тир.</p>`;
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
function updateCalc() {
  const c = calcSettings(), f = S.cFam, L = FAM[f], P = S.calc[f], costs = {};
  for (const t of REFINE_TIERS) {
    const p = P[t], raw = num(p.raw), sell = num(p.sell), shown = !!$(`pill-${t}`);
    let prevEff, own = false;
    if (p.own && t > 4) { own = true; prevEff = isFinite(costs[t - 1]) ? costs[t - 1] : NaN; }
    else prevEff = num(p.prev) * c.bf;
    const ok = isFinite(raw) && isFinite(sell) && isFinite(prevEff) && raw >= 0 && sell > 0;
    const o = ok ? economics(t, raw, prevEff, sell, c) : null;
    costs[t] = o ? o.cost : NaN;
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
      $(`E-${t}`).innerHTML = mx > 0 ? `Зачарованный камень, покупай до: <span><span class="e1">T${t}.1</span> <b>${fmt(mx * c.mult[0])}</b></span><span><span class="e2">T${t}.2</span> <b>${fmt(mx * c.mult[1])}</b></span><span><span class="e3">T${t}.3</span> <b>${fmt(mx * c.mult[2])}</b></span>` : "";
    }
    const cls = o.profit >= 0 ? "pos" : "neg";
    $(`st-${t}`).innerHTML =
      `<span>Себестоимость 1 шт. <b>${fmt(o.cost)}</b></span>` +
      `<span>Выручка 1 шт. <b>${fmt(o.effSell)}</b></span>` +
      `<span>Прибыль 1 шт. <b class="${cls}">${fmtSigned(o.profit)}</b></span>` +
      `<span>За стак 999 <b class="${cls}">${fmtBig(o.profit * STACK)}</b></span>` +
      `<span>Деньги на стак <b>${fmtBig(o.capital, false)}</b></span>`;
  }
}
async function openCalc() {
  renderCalcControls(); buildTiers(); updateCalc();
  if (calcEmpty(S.cFam)) await marketFill();
}

// ---------- условия расчёта ----------
function sumHint() {
  const c = calcSettings(), st = S.settings;
  const rp = st.rrr === "custom" ? nf1.format(num(st.rrrc) || 0) : nf1.format(+st.rrr * 100);
  $("sumhint").textContent = `${SERVER_RU[st.server]}, возврат ${rp}%, маржа ${nf1.format(c.m * 100)}%`;
  $("s-rrrc").hidden = st.rrr !== "custom";
}
function rerenderAll() {
  sumHint();
  if (S.view === "prices") renderPricesTable();
  if (S.view === "refine") renderRefineTable();
  if (S.view === "calc") updateCalc();
}
function bindSettings() {
  const st = S.settings;
  $("s-server").value = st.server; $("s-caerleon").checked = !!st.caerleon; $("s-brecilien").checked = !!st.brecilien;
  $("s-mode").value = st.mode; $("s-age").value = st.age;
  $("s-rrr").value = st.rrr; $("s-rrrc").value = st.rrrc; $("s-fee").value = st.fee; $("s-station").value = st.station;
  $("s-margin").value = st.margin; $("s-buffer").value = st.buffer; $("s-order").checked = !!st.order;
  ["s-m1", "s-m2", "s-m3"].forEach((id, i) => ($(id).value = st.m[i]));
  const on = (id, fn, ev = "input") => $(id).addEventListener(ev, (e) => { fn(e.target); save(); rerenderAll(); });
  on("s-rrr", (el) => (st.rrr = el.value), "change"); on("s-rrrc", (el) => (st.rrrc = el.value));
  on("s-fee", (el) => (st.fee = el.value), "change"); on("s-station", (el) => (st.station = el.value));
  on("s-margin", (el) => (st.margin = el.value)); on("s-buffer", (el) => (st.buffer = el.value));
  on("s-order", (el) => (st.order = el.checked), "change"); on("s-age", (el) => (st.age = el.value));
  on("s-mode", (el) => (st.mode = el.value), "change");
  on("s-caerleon", (el) => (st.caerleon = el.checked), "change"); on("s-brecilien", (el) => (st.brecilien = el.checked), "change");
  ["s-m1", "s-m2", "s-m3"].forEach((id, i) => on(id, (el) => (st.m[i] = el.value)));
  $("s-server").addEventListener("change", (e) => { st.server = e.target.value; save(); sumHint(); route(); });
  const dlg = $("settings");
  $("open-settings").addEventListener("click", () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  $("p-reload").addEventListener("click", () => openPrices(true));
  $("r-reload").addEventListener("click", () => openRefine(true));
  $("r-onlyplus").addEventListener("change", (e) => { S.rOnlyPlus = e.target.checked; save(); renderRefineTable(); });
  $("r-sort").addEventListener("change", (e) => { S.rSort = e.target.value; save(); renderRefineTable(); });
  $("c-fill").addEventListener("click", marketFill);
  $("c-reset").addEventListener("click", () => { S.calc[S.cFam] = emptyCalc(); save(); buildTiers(); updateCalc(); });
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (S.view === "prices" && S.pItem && !$("p-chartcard").hidden) drawChart(); }, 150); });
}

// ---------- навигация ----------
const VIEWS = ["prices", "refine", "calc"];
function route() {
  const h = location.hash.replace("#", "");
  S.view = VIEWS.includes(h) ? h : (VIEWS.includes(S.view) ? S.view : "refine");
  save();
  for (const v of VIEWS) {
    $(`view-${v}`).hidden = v !== S.view;
    $(`tab-${v}`).setAttribute("aria-selected", String(v === S.view));
  }
  hideTip();
  if (S.view === "prices") openPrices();
  if (S.view === "refine") openRefine();
  if (S.view === "calc") openCalc();
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.view; }));
window.addEventListener("hashchange", route);

bindSettings(); sumHint();
if (!location.hash) history.replaceState(null, "", "#" + (VIEWS.includes(S.view) ? S.view : "refine"));
route();
