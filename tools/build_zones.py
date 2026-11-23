# Собирает zones.js для вкладки «Дороги» из дампов игры (github.com/ao-data/ao-bin-dumps):
#   cluster/world.json — зоны, их типы и переходы; tunnelsystem.json — правила порталов Авалона.
# Запуск: python3 tools/build_zones.py world.json tunnelsystem.json > zones.js
import json, re, sys, collections as C

world = json.load(open(sys.argv[1]))["world"]["clusters"]["cluster"]
tunnel = json.load(open(sys.argv[2]))["tunnelsystem"]
L = lambda x: x if isinstance(x, list) else ([] if x is None else [x])
by = {c["@id"]: c for c in world}

def code(t):
    if t.startswith("TUNNEL_"): return t[7:]                 # ROYAL, ROYAL_RED, BLACK_LOW, LOW, DEEP…
    if t == "SAFEAREA": return "BLUE"
    if t == "OPENPVP_YELLOW": return "YELLOW"
    if t == "OPENPVP_RED": return "RED"
    m = re.match(r"OPENPVP_BLACK_(\d)", t)
    if m: return "BLACK" + m[1]
    if t.startswith("PASSAGE_"): return "PSG_" + t[8:]
    if t in ("PLAYERCITY_SAFEAREA_01", "PLAYERCITY_SAFEAREA_02"): return "CITY"
    if t == "PLAYERCITY_BLACK_ROYAL": return "CAERLEON"
    if t == "PLAYERCITY_BLACK": return "BRECILIEN"
    if t == "PLAYERCITY_BLACK_PORTALCITY_NOFURNITURE": return "PORTAL"
    if t == "PLAYERCITY_BLACK_REST": return "REST"
    return None

keep = {i: code(c["@type"]) for i, c in by.items() if code(c["@type"])}
# рынки и банки городов — часть города: их переходы отдаём самому городу
cities = {c["@displayname"]: i for i, c in by.items() if keep.get(i) in ("CITY", "CAERLEON", "BRECILIEN")}
alias = {}
for i, c in by.items():
    if i in keep: continue
    if "NOFURNITURE" in c["@type"] and "PORTALCITY" not in c["@type"]:
        for n, ci in cities.items():
            if n in c["@displayname"]: alias[i] = ci
node = lambda i: alias.get(i, i if i in keep else None)

adj = C.defaultdict(set)
for c in world:
    a = node(c["@id"])
    if not a: continue
    for e in L((c.get("exits") or {}).get("exit")):
        b = node(e["@targetid"].split("@")[-1])
        if b and b != a: adj[a].add(b); adj[b].add(a)

ids = sorted(keep, key=lambda i: by[i]["@displayname"])
idx = {i: k for k, i in enumerate(ids)}
rows = []
for i in ids:
    c = by[i]; m = re.search(r"_T(\d)_", c["@file"]); t = int(m[1]) if m else 0
    row = [c["@displayname"], keep[i], t, sorted(idx[x] for x in adj[i])]
    if keep[i] in ("ROYAL", "ROYAL_RED", "BLACK_LOW", "BLACK_MEDIUM", "BLACK_HIGH", "LOW", "MEDIUM", "HIGH", "DEEP", "DEEP_RAID", "HIDEOUT", "HIDEOUT_DEEP"):
        mk = C.Counter(x["@type"] for x in L((c.get("minimapmarkers") or {}).get("marker")))
        res = "".join(k[0] for k in ("Ore", "Wood", "Fiber", "Hide", "Stone") if mk[k])
        row.append([mk["dungeon_solo"], mk["dungeon_group"], mk["dungeon_elite"], res])
    rows.append(row)

# куда ведут исходящие порталы дороги: доли среди исходящих (без слотов «под вход»)
ep = {p["@name"]: p for p in tunnel["tunnelexitpresets"]["tunnelexitpreset"]}
kw = {p["@incomingConnectionKeyword"]: code("TUNNEL_" + p["@name"]) if not p["@name"].startswith(("SAFEZONE", "YELLOW", "OPENPVP")) else p["@name"] for p in tunnel["tunnelpresets"]["tunnelpreset"]}
grp = {"SAFEZONE": "blue", "YELLOW": "yellow", "OPENPVP_RED": "red", "OPENPVP_BLACK_LOW": "black1", "OPENPVP_BLACK_MEDIUM": "black2", "OPENPVP_BLACK_HIGH": "black3"}
rules = {}
for p in tunnel["tunnelpresets"]["tunnelpreset"]:
    if not p["@name"].startswith("TUNNEL_"): continue
    ex = L(p["exits"]["exit"]); W = sum(float(e["@weight"]) for e in ex)
    dist = C.Counter(); inc = 0.0
    for e in ex:
        pe = float(e["@weight"]) / W; pr = ep[e["@tunnelexitpreset"]]
        if pr["@name"] == "INCOMING": inc += pe; continue
        ch = float(pr["@outgoingConnectionChance"]); ws = L(pr.get("outgoingConnectionWeighting")); ww = sum(float(w["@weight"]) for w in ws)
        for w in ws:
            k = kw[w["@outgoingConnectionKeyword"]]; dist[grp.get(k, "road")] += pe * ch * float(w["@weight"]) / ww
        dist["none"] += pe * (1 - ch)
    out = 1 - inc
    rules[p["@name"][7:]] = {"n": int(p["@maxExits"]), "inc": round(inc, 3), "out": {k: round(v / out, 3) for k, v in dist.items() if v > 0} if out else {},
                             "size": p["incomingConnectionWeightings"]["type"]["@name"]}

s = tunnel["tunnelexitsettings"]
meta = {"life": [int(s["@lifetimemin"]), int(s["@lifetimemax"])], "kinds": {t["@name"]: [int(t["@maxcharges"]), int(t["@timeperchargeupmin"])] for t in tunnel["tunnelexittypes"]["tunnelexittype"]}}
print("// Зоны и переходы из дампов игры (ao-bin-dumps), собрано tools/build_zones.py")
print("// ZONES: [название, тип, тир, [соседи — индексы], у дорог: [данжи соло, групповые, элитные, ресурсы O/W/F/H/S]]")
print("const ZONES = " + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";")
print("const ROAD_RULES = " + json.dumps(rules, separators=(",", ":")) + ";")
print("const ROAD_META = " + json.dumps(meta, separators=(",", ":")) + ";")
