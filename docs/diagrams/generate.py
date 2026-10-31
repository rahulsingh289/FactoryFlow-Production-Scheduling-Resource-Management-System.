#!/usr/bin/env python3
"""
Generate the design diagrams for the Smart Factory Production Scheduler:
  - hld.svg  : High-Level Design (layered architecture)
  - lld.svg  : Low-Level Design (module / call structure)
  - er.svg   : Database schema / Entity-Relationship diagram

Run:  python3 docs/diagrams/generate.py
Output SVGs are written next to this script.
"""
import os
import html

OUT = os.path.dirname(os.path.abspath(__file__))

# ---- shared palette -------------------------------------------------------
INK   = "#0f172a"
MUTE  = "#64748b"
LINE  = "#94a3b8"
BG    = "#f1f5f9"
CARD  = "#ffffff"
FONT  = "font-family='Segoe UI, Roboto, Helvetica, Arial, sans-serif'"
MONO  = "font-family='SFMono-Regular, Consolas, Menlo, monospace'"

LAYER = {
    "web":    ("#2563eb", "#eff4ff"),   # blue
    "api":    ("#0891b2", "#e7f8fb"),   # cyan
    "engine": ("#d97706", "#fff5e6"),   # amber
    "data":   ("#7c3aed", "#f3edff"),   # violet
    "neutral":("#475569", "#f1f5f9"),
}


def esc(s):
    return html.escape(str(s), quote=True)


def svg_open(w, h, title):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{esc(title)}">
<defs>
  <filter id="sh" x="-10%" y="-10%" width="120%" height="130%">
    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.12"/>
  </filter>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse">
    <path d="M0,0 L8,3 L0,6 Z" fill="{LINE}"/>
  </marker>
  <marker id="dot" markerWidth="8" markerHeight="8" refX="3" refY="3" orient="auto" markerUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="2.6" fill="{LINE}"/>
  </marker>
</defs>
<rect x="0" y="0" width="{w}" height="{h}" fill="{BG}"/>"""


def rrect(x, y, w, h, fill=CARD, stroke=LINE, sw=1.2, rx=10, shadow=False, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    f = ' filter="url(#sh)"' if shadow else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}{f}/>'


def txt(x, y, s, size=14, color=INK, anchor="start", weight="400", mono=False, spacing=None):
    ls = f' letter-spacing="{spacing}"' if spacing else ""
    fam = MONO if mono else FONT
    return f'<text x="{x}" y="{y}" {fam} font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}"{ls}>{esc(s)}</text>'


def line(x1, y1, x2, y2, color=LINE, w=1.6, dash=None, marker="arrow"):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    m = f' marker-end="url(#{marker})"' if marker else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{w}"{d}{m}/>'


def elbow(x1, y1, x2, y2, color=LINE, w=1.6, marker="arrow"):
    midx = (x1 + x2) / 2
    m = f' marker-end="url(#{marker})"' if marker else ""
    return f'<path d="M{x1},{y1} H{midx} V{y2} H{x2}" fill="none" stroke="{color}" stroke-width="{w}"{m}/>'


def titleblock(w, title, subtitle):
    return (txt(40, 46, title, 24, INK, weight="700") +
            txt(40, 70, subtitle, 13.5, MUTE) +
            txt(w - 40, 46, "Smart Factory Production Scheduler", 13, MUTE, anchor="end", weight="600") +
            txt(w - 40, 66, "OS + DBMS Project — Team amanrwt.091", 11.5, MUTE, anchor="end"))


# ===========================================================================
# 1. HIGH-LEVEL DESIGN
# ===========================================================================
def hld():
    W, H = 1040, 720
    s = [svg_open(W, H, "High-Level Design")]
    s.append(titleblock(W, "High-Level Design (HLD)", "Layered architecture — browser to database"))

    bands = [
        ("web", "PRESENTATION LAYER", "React + Vite  ·  JavaScript / HTML / CSS",
         ["Login / Auth", "Dashboard", "Orders", "Scheduler + Gantt", "Resources", "Banker's / Deadlock"]),
        ("api", "APPLICATION LAYER  —  REST API", "Node.js + Express  ·  JWT  ·  JSON over HTTP",
         ["Auth & JWT", "Order / Resource\nControllers", "Scheduling\nController", "Reports", "MySQL Access\n(mysql2, transactions)"]),
        ("engine", "OPERATING-SYSTEM ENGINE", "C++17  ·  invoked as a child process (stdin/stdout JSON)",
         ["FCFS · SJF · SRTF", "Priority (P / NP)", "Round Robin", "Banker's Algorithm", "Deadlock Detection"]),
        ("data", "DATA LAYER", "MySQL 8  ·  database: smart_factory",
         ["orders · machines", "workers · inventory", "resource_pools\n+ claims", "schedule_runs\n+ entries", "audit_log · views\nprocedures · triggers"]),
    ]

    x0, bw = 40, W - 80
    y = 100
    bh = 128
    gap = 36
    band_mid_x = []
    band_y = []
    for key, title_, sub, chips in bands:
        color, tint = LAYER[key]
        s.append(rrect(x0, y, bw, bh, fill=tint, stroke=color, sw=1.4, rx=14, shadow=True))
        s.append(f'<rect x="{x0}" y="{y}" width="6" height="{bh}" rx="3" fill="{color}"/>')
        s.append(txt(x0 + 22, y + 28, title_, 15, color, weight="700", spacing="0.4"))
        s.append(txt(x0 + 22, y + 48, sub, 12, MUTE))
        # chips
        n = len(chips)
        cw = (bw - 44 - (n - 1) * 14) / n
        cx = x0 + 22
        cy = y + 62
        ch = bh - 78
        for c in chips:
            s.append(rrect(cx, cy, cw, ch, fill=CARD, stroke=color, sw=1, rx=8))
            lines = c.split("\n")
            ty = cy + ch / 2 - (len(lines) - 1) * 7 + 4
            for ln in lines:
                s.append(txt(cx + cw / 2, ty, ln, 11.5, INK, anchor="middle", weight="600"))
                ty += 14
            cx += cw + 14
        band_mid_x.append(x0 + bw / 2)
        band_y.append((y, y + bh))
        y += bh + gap

    # arrows between bands with labels
    labels = ["REST / JSON", "spawn + JSON", "SQL queries\n& transactions"]
    for i in range(3):
        ax = W / 2
        y1 = band_y[i][1]
        y2 = band_y[i + 1][0]
        s.append(line(ax, y1, ax, y2 - 2, color=MUTE, w=2))
        s.append(line(ax, y2 - 2, ax, y1, color=MUTE, w=2, marker="arrow"))  # up arrow
        # label box
        lab = labels[i]
        lines = lab.split("\n")
        boxw, boxh = 150, 20 + (len(lines) - 1) * 14
        s.append(rrect(ax + 24, (y1 + y2) / 2 - boxh / 2, boxw, boxh, fill=CARD, stroke=LINE, sw=1, rx=6))
        ty = (y1 + y2) / 2 - (len(lines) - 1) * 7 + 4
        for ln in lines:
            s.append(txt(ax + 24 + boxw / 2, ty, ln, 11, MUTE, anchor="middle"))
            ty += 14

    s.append("</svg>")
    return "".join(s)


# ===========================================================================
# 2. LOW-LEVEL DESIGN
# ===========================================================================
def lld():
    W = 1120
    s = [svg_open(W, 10, "")]  # height patched after layout
    body = []
    body.append(titleblock(W, "Low-Level Design (LLD)", "Modules, files and the call path of a scheduling request"))

    cols = [
        ("web", "Frontend  (frontend/src)", 40, [
            ("main.jsx", "React entry"),
            ("App.jsx", "layout, nav, auth gate"),
            ("api.js", "fetch wrapper + JWT"),
            ("pages/*.jsx", "Dashboard, Orders,\nScheduler, Resources, Bankers"),
            ("components/ui.jsx", "Card, Metric, Gantt,\nStatusBadge, Icons"),
        ]),
        ("api", "Backend  (backend/src)", 410, [
            ("server.js", "Express app + routes"),
            ("routes/", "auth · catalog · os · reports"),
            ("services/auth.js", "signToken / requireAuth"),
            ("services/engine.js", "spawn C++ engine"),
            ("db/index.js", "pool + bootstrap + mode"),
            ("db/repo.js", "data access (MySQL /\nmemory) + transactions"),
        ]),
        ("engine", "C++ Engine  (engine)", 780, [
            ("main.cpp", "CLI dispatcher\n(schedule|bankers|deadlock)"),
            ("scheduling.cpp", "6 CPU-scheduling policies"),
            ("bankers.cpp", "safety + request + deadlock"),
            ("include/*.h", "Process, Gantt, Matrix types"),
        ]),
    ]
    colw = 300
    top = 100

    # work out the tallest column so all three share one height
    def col_bottom(mods):
        y = top + 50
        for _, desc in mods:
            h = 44 + (len(desc.split("\n")) - 1) * 13
            y += h + 16
        return y
    colh = max(col_bottom(m) for _, _, _, m in cols) - top + 8

    for key, title_, x, mods in cols:
        color, tint = LAYER[key]
        body.append(rrect(x, top, colw, colh, fill=tint, stroke=color, sw=1.3, rx=14))
        body.append(txt(x + 18, top + 28, title_, 14.5, color, weight="700"))
        y = top + 50
        for name, desc in mods:
            lines = desc.split("\n")
            h = 44 + (len(lines) - 1) * 13
            body.append(rrect(x + 16, y, colw - 32, h, fill=CARD, stroke=color, sw=1, rx=9, shadow=True))
            body.append(txt(x + 30, y + 20, name, 12.5, INK, weight="700", mono=True))
            ty = y + 36
            for ln in lines:
                body.append(txt(x + 30, ty, ln, 10.8, MUTE))
                ty += 13
            y += h + 16

    # arrows between columns
    ay = top + 150
    body.append(line(340, ay, 410, ay, color=MUTE, w=2))
    body.append(line(710, ay, 780, ay, color=MUTE, w=2))
    body.append(txt(375, ay - 8, "HTTP", 10, MUTE, anchor="middle"))
    body.append(txt(745, ay - 8, "spawn", 10, MUTE, anchor="middle"))

    # call-path callout below the columns
    fy = top + colh + 40
    body.append(rrect(40, fy - 24, W - 80, 40, fill=CARD, stroke=LINE, sw=1, rx=9))
    body.append(txt(58, fy, "Request flow", 12.5, INK, weight="700"))
    flow = "UI action  →  api.js  →  Express route  →  services/engine.js  →  factory_engine (C++)  →  JSON  →  repo.js persists run  →  Gantt rendered"
    body.append(txt(170, fy, flow, 11, MUTE, mono=True))

    H = fy + 40
    s = [svg_open(W, H, "Low-Level Design")] + body + ["</svg>"]
    return "".join(s)


# ===========================================================================
# 3. ENTITY-RELATIONSHIP / SCHEMA DIAGRAM
# ===========================================================================
def er():
    W, H = 1280, 940
    s = [svg_open(W, H, "Database Schema (ER Diagram)")]
    s.append(titleblock(W, "Database Schema  (ER Diagram)", "MySQL 8 — database smart_factory · 13 tables · PK = key, FK = reference"))

    # table definition: name -> (x, y, color-key, [(col, tag)])
    T = {
        "machines": (40, 110, "neutral", [
            ("machine_id", "PK"), ("machine_name", ""), ("machine_type", ""),
            ("capacity", ""), ("status", "")]),
        "workers": (40, 300, "neutral", [
            ("worker_id", "PK"), ("full_name", ""), ("skill", ""), ("status", "")]),
        "inventory": (40, 440, "neutral", [
            ("material_id", "PK"), ("material_name", ""), ("quantity_available", ""),
            ("reorder_level", ""), ("unit", ""), ("below_reorder", "GEN")]),
        "inventory_transactions": (370, 610, "neutral", [
            ("txn_id", "PK"), ("material_id", "FK"), ("delta", ""),
            ("balance_after", ""), ("reason", "")]),
        "users": (40, 700, "neutral", [
            ("user_id", "PK"), ("username", "UQ"), ("password_hash", ""),
            ("full_name", ""), ("role", "")]),

        "resource_pools": (370, 110, "data", [
            ("pool_id", "PK"), ("pool_name", "UQ"), ("total_units", ""),
            ("available_units", "")]),
        "production_orders": (370, 320, "web", [
            ("order_id", "PK"), ("product_name", ""), ("quantity", ""),
            ("arrival_time", ""), ("execution_time", ""), ("priority", ""),
            ("deadline", ""), ("required_machine_type", ""), ("status", "")]),

        "order_resource_claims": (710, 110, "data", [
            ("order_id", "PK·FK"), ("pool_id", "PK·FK"),
            ("allocated_units", ""), ("max_units", "")]),
        "resource_allocations": (710, 330, "api", [
            ("allocation_id", "PK"), ("order_id", "FK"), ("machine_id", "FK"),
            ("worker_id", "FK"), ("status", ""), ("allocated_at", "")]),
        "maintenance_records": (710, 580, "neutral", [
            ("maintenance_id", "PK"), ("machine_id", "FK"),
            ("description", ""), ("maintenance_date", ""), ("completed", "")]),

        "schedule_runs": (1030, 110, "engine", [
            ("run_id", "PK"), ("algorithm", ""), ("quantum", ""),
            ("avg_waiting", ""), ("avg_turnaround", ""), ("throughput", ""),
            ("makespan", "")]),
        "schedule_entries": (1030, 400, "engine", [
            ("entry_id", "PK"), ("run_id", "FK"), ("order_id", "FK"),
            ("start_time", ""), ("completion_time", ""), ("waiting_time", ""),
            ("missed_deadline", "")]),
        "audit_log": (1030, 680, "neutral", [
            ("log_id", "PK"), ("entity", ""), ("entity_id", ""),
            ("action", ""), ("details", "")]),
    }

    TW = 228
    HEAD = 30
    ROW = 22

    def geom(name):
        x, y, key, cols = T[name]
        h = HEAD + len(cols) * ROW + 8
        return x, y, TW, h

    # ---- relationships (child.fk -> parent.pk), drawn behind the tables ----
    rels = [
        ("order_resource_claims", "production_orders", "order_id"),
        ("order_resource_claims", "resource_pools", "pool_id"),
        ("resource_allocations", "production_orders", "order_id"),
        ("resource_allocations", "machines", "machine_id"),
        ("resource_allocations", "workers", "worker_id"),
        ("schedule_entries", "schedule_runs", "run_id"),
        ("schedule_entries", "production_orders", "order_id"),
        ("maintenance_records", "machines", "machine_id"),
        ("inventory_transactions", "inventory", "material_id"),
    ]

    def anchor_pts(a, b):
        ax, ay, aw, ah = geom(a)
        bx, by, bw, bh = geom(b)
        # connect from the nearest horizontal side
        if bx + bw <= ax:          # parent is to the left
            x1, y1 = ax, ay + ah / 2
            x2, y2 = bx + bw, by + bh / 2
        elif bx >= ax + aw:        # parent to the right
            x1, y1 = ax + aw, ay + ah / 2
            x2, y2 = bx, by + bh / 2
        else:                      # same column-ish, go vertical
            x1, y1 = ax + aw / 2, ay
            x2, y2 = bx + bw / 2, by + bh
        return x1, y1, x2, y2

    for child, parent, fk in rels:
        x1, y1, x2, y2 = anchor_pts(child, parent)
        midx = (x1 + x2) / 2
        s.append(f'<path d="M{x1},{y1} H{midx} V{y2} H{x2}" fill="none" stroke="{LINE}" stroke-width="1.6" marker-end="url(#arrow)" marker-start="url(#dot)"/>')
        s.append(txt(midx, (y1 + y2) / 2 - 4, fk, 9.5, MUTE, anchor="middle", mono=True))

    # ---- tables drawn on top (opaque) --------------------------------------
    for name, (x, y, key, cols) in T.items():
        color, tint = LAYER[key]
        x, y, w, h = geom(name)
        s.append(rrect(x, y, w, h, fill=CARD, stroke=color, sw=1.4, rx=10, shadow=True))
        s.append(f'<path d="M{x},{y+HEAD} V{y+10} Q{x},{y} {x+10},{y} H{x+w-10} Q{x+w},{y} {x+w},{y+10} V{y+HEAD} Z" fill="{color}"/>')
        s.append(txt(x + 12, y + 20, name, 12.5, "#ffffff", weight="700", mono=True))
        ry = y + HEAD + 16
        for col, tag in cols:
            weight = "700" if "PK" in tag else "400"
            s.append(txt(x + 14, ry, col, 11, INK, weight=weight, mono=True))
            if tag:
                tc = color if "FK" in tag else MUTE
                s.append(txt(x + w - 12, ry, tag, 9, tc, anchor="end", weight="700", mono=True))
            ry += ROW
        # zebra separators
        for i in range(1, len(cols)):
            ly = y + HEAD + i * ROW + 4
            s.append(f'<line x1="{x+8}" y1="{ly}" x2="{x+w-8}" y2="{ly}" stroke="#eef2f7" stroke-width="1"/>')

    # legend
    lx, ly = 40, H - 36
    s.append(txt(lx, ly, "PK", 11, INK, weight="700", mono=True)); s.append(txt(lx + 24, ly, "primary key", 11, MUTE))
    s.append(txt(lx + 130, ly, "FK", 11, LAYER["api"][0], weight="700", mono=True)); s.append(txt(lx + 154, ly, "foreign key", 11, MUTE))
    s.append(txt(lx + 250, ly, "UQ", 11, INK, weight="700", mono=True)); s.append(txt(lx + 278, ly, "unique", 11, MUTE))
    s.append(txt(lx + 350, ly, "GEN", 11, INK, weight="700", mono=True)); s.append(txt(lx + 384, ly, "generated column", 11, MUTE))
    s.append(txt(lx + 540, ly, "●──▶", 11, LINE, mono=True)); s.append(txt(lx + 580, ly, "references (child → parent)", 11, MUTE))

    s.append("</svg>")
    return "".join(s)


if __name__ == "__main__":
    for name, fn in [("hld", hld), ("lld", lld), ("er", er)]:
        path = os.path.join(OUT, f"{name}.svg")
        with open(path, "w") as f:
            f.write(fn())
        print("wrote", path)
