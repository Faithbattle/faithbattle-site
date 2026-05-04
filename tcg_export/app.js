/* eslint-disable no-console */
const $ = (sel) => document.querySelector(sel);

const state = {
  meta: [],
  cardsById: {},
  selectedId: null,
  search: "",
  type: "",
  sort: "nome",
};

function mean(arr) {
  const xs = arr
    .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .map(Number);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function normalize(s) {
  return (s ?? "").toString().trim().toUpperCase();
}

function normalizeCategoriesField(raw) {
  // raw can be string "A;B" or "A,B", or array ["A", "B,C"]
  const out = [];
  const pushParts = (s) => {
    if (typeof s !== "string") return;
    s.split(/[;,]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => out.push(x));
  };
  if (Array.isArray(raw)) {
    raw.forEach(pushParts);
  } else {
    pushParts(raw);
  }
  // dedupe preserving order
  const seen = new Set();
  return out.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
}

function costBucket(c) {
  const v = Number(c);
  if (!Number.isFinite(v)) return "—";
  if (v <= 1) return "0–1";
  if (v <= 3) return "2–3";
  if (v <= 5) return "4–5";
  if (v <= 7) return "6–7";
  return "8+";
}

function deltaBadge(value, baseline) {
  if (
    baseline === null ||
    baseline === undefined ||
    Number.isNaN(Number(baseline))
  )
    return "";
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "";
  const v = Number(value);
  const b = Number(baseline);
  const d = v - b;

  if (Math.abs(d) < 1e-9) {
    return `<span class="delta eq"><span class="arrow">■</span>0</span>`;
  }
  const cls = d > 0 ? "up" : "down";
  const arrow = d > 0 ? "▲" : "▼";
  const sign = d > 0 ? "+" : "";
  const shown =
    Math.abs(d) >= 1000 ? `${sign}${fmt(d, 0)}` : `${sign}${fmt(d, 2)}`;
  return `<span class="delta ${cls}"><span class="arrow">${arrow}</span>${shown}</span>`;
}

function table(headers, rows) {
  const thead = `<thead><tr>${headers.map((h) => `<th class="${h.cls || ""}">${h.label}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => c?.html ?? `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<div class="tableWrap"><table>${thead}${tbody}</table></div>`;
}

function tdTxt(v, cls = "") {
  return { html: `<td class="${cls}">${v ?? ""}</td>` };
}
function tdNum(v, digits = 2) {
  return { html: `<td class="num">${fmt(v, digits)}</td>` };
}
function tdNumWithDelta(v, baseline, digits = 2) {
  return {
    html: `<td class="num"><span class="barVal">${fmt(v, digits)} ${deltaBadge(v, baseline)}</span></td>`,
  };
}

function computeStats(cards) {
  // normalize categories defensively
  cards.forEach((c) => {
    c.categoria = normalizeCategoriesField(c.categoria);
  });

  const nums = (arr) =>
    arr
      .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
      .map(Number);
  const custos = nums(cards.map((c) => c.custo));
  const forcas = nums(
    cards.filter((c) => c.tipo === "Herói de Fé").map((c) => c.forca),
  );
  const ress = nums(
    cards.filter((c) => c.tipo === "Herói de Fé").map((c) => c.resistencia),
  );

  const cost = mean(custos);
  const forca = mean(forcas);
  const res = mean(ress);

  const poder = (forca ?? 0) + (res ?? 0);
  const eficiencia = cost && cost > 0 ? poder / cost : null;

  // tipos
  const tipos = {};
  cards.forEach((c) => {
    const t = normalize(c.tipo) || "—";
    tipos[t] = (tipos[t] || 0) + 1;
  });

  // custo buckets
  const buckets = {};
  cards.forEach((c) => {
    const b = costBucket(c.custo);
    buckets[b] = (buckets[b] || 0) + 1;
  });

  // categorias (quantidade + custo médio)
  const categoriasRaw = {};
  cards.forEach((c) => {
    const cats = normalizeCategoriesField(c.categoria);
    cats.forEach((cat) => {
      if (!categoriasRaw[cat]) categoriasRaw[cat] = { total: 0, custos: [] };
      categoriasRaw[cat].total++;
      if (c.custo != null && !Number.isNaN(Number(c.custo)))
        categoriasRaw[cat].custos.push(Number(c.custo));
    });
  });

  const categorias = {};
  Object.entries(categoriasRaw).forEach(([k, v]) => {
    categorias[k] = { total: v.total, cost: mean(v.custos) };
  });

  // mediana de custo (insight extra)
  let medianaCusto = null;
  if (custos.length) {
    const s = custos.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    medianaCusto = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  return {
    total: cards.length,
    cost,
    medianaCusto,
    forca,
    res,
    poder,
    eficiencia,
    tipos,
    buckets,
    categorias,
  };
}

function computeGlobal(statsById) {
  const vals = (k) =>
    Object.values(statsById)
      .map((s) => s[k])
      .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  return {
    total: mean(vals("total")),
    cost: mean(vals("cost")),
    forca: mean(vals("forca")),
    res: mean(vals("res")),
    poder: mean(vals("poder")),
    eficiencia: mean(vals("eficiencia")),
  };
}

function renderKpisComparativos(statsById, baseline) {
  const totals = Object.values(statsById).map((s) => s.total);
  const costs = Object.values(statsById)
    .map((s) => s.cost)
    .filter((v) => v != null);
  const effs = Object.values(statsById)
    .map((s) => s.eficiencia)
    .filter((v) => v != null);

  const kpis = [
    {
      label: "Coleções",
      value: state.meta.length,
      sub: "detectadas via data/index.json",
    },
    {
      label: "Total de cartas (somado)",
      value: totals.reduce((a, b) => a + b, 0),
      sub: "todas as coleções",
    },
    {
      label: "Custo médio (média das coleções)",
      value: baseline.cost,
      sub: "baseline dos comparativos",
    },
    {
      label: "Eficiência média",
      value: baseline.eficiencia,
      sub: "(força+resistência)/custo",
    },
  ];

  $("#kpiComparativos").innerHTML = kpis
    .map(
      (k) => `
    <div class="kpi">
      <div class="kpiLabel">${k.label}</div>
      <div class="kpiValue">${fmt(k.value, 2)}</div>
      <div class="kpiSub">${k.sub}</div>
    </div>
  `,
    )
    .join("");
}

function renderBarsFromMap(targetId, titleKey, mapObj, valueFn, baselineValue) {
  // mapObj: {label: value}
  const rows = Object.entries(mapObj).map(([label, val]) => ({
    label,
    value: valueFn(val),
  }));
  const vals = rows.map((r) => Number(r.value ?? 0));
  const max = Math.max(1, ...vals);
  rows.sort(
    (a, b) => Number(b.value ?? -Infinity) - Number(a.value ?? -Infinity),
  );
  const html = rows
    .map((r) => {
      const v = Number(r.value ?? 0);
      const w = Math.max(0, Math.round((v / max) * 100));
      return `
      <div class="barRow">
        <div class="barLbl">${r.label}</div>
        <div class="barTrack"><div class="barFill" style="width:${w}%"></div></div>
        <div class="barVal">${fmt(r.value, 0)} ${baselineValue != null ? deltaBadge(r.value, baselineValue) : ""}</div>
      </div>
    `;
    })
    .join("");
  $(targetId).innerHTML = html || '<div class="kpiSub">—</div>';
}

function renderFuncTableWithDeltas(targetId, funcRows, baselineByFunc, mode) {
  // mode: 'qty' uses total, 'cost' uses cost
  const headers = [
    { label: "Categoria", cls: "left" },
    { label: mode === "qty" ? "Quantidade" : "Custo médio", cls: "" },
  ];
  const rows = funcRows.map((r) => {
    const base = baselineByFunc[r.funcao];
    const val = mode === "qty" ? r.total : r.cost;
    const digits = mode === "qty" ? 0 : 2;
    return [tdTxt(r.funcao, "left"), tdNumWithDelta(val, base, digits)];
  });
  $(targetId).innerHTML = table(headers, rows);
}

function renderKpisCollection(targetId, stat) {
  const items = [
    {
      label: "Total de cartas",
      value: stat.total,
      digits: 0,
      sub: "tamanho do pool",
    },
    {
      label: "Custo médio",
      value: stat.cost,
      digits: 2,
      sub: `mediana ${fmt(stat.medianaCusto, 2)}`,
    },
    { label: "Força média", value: stat.forca, digits: 2, sub: "—" },
    { label: "Resistência média", value: stat.res, digits: 2, sub: "—" },
    {
      label: "Poder (F+R)",
      value: stat.poder,
      digits: 2,
      sub: "força + resistência",
    },
    {
      label: "Eficiência",
      value: stat.eficiencia,
      digits: 2,
      sub: "poder / custo",
    },
  ];
  $(targetId).innerHTML = items
    .map(
      (k) => `
    <div class="kpi">
      <div class="kpiLabel">${k.label}</div>
      <div class="kpiValue">${fmt(k.value, k.digits)}</div>
      <div class="kpiSub">${k.sub}</div>
    </div>
  `,
    )
    .join("");
}

function renderBars(targetId, metaKey, statsById, baseline, digits = 2) {
  const rows = state.meta.map((m) => ({
    id: m.id,
    label: m.label,
    value: statsById[m.id][metaKey],
  }));
  const vals = rows.map((r) => Number(r.value ?? 0));
  const max = Math.max(1, ...vals);

  // sort desc for charts
  rows.sort(
    (a, b) => Number(b.value ?? -Infinity) - Number(a.value ?? -Infinity),
  );

  const html = rows
    .map((r) => {
      const v = Number(r.value ?? 0);
      const w = Math.max(0, Math.round((v / max) * 100));
      const base = baseline[metaKey];
      return `
      <div class="barRow">
        <div class="barLbl">${r.label}</div>
        <div class="barTrack"><div class="barFill" style="width:${w}%"></div></div>
        <div class="barVal">${fmt(r.value, digits)} ${deltaBadge(r.value, base)}</div>
      </div>
    `;
    })
    .join("");
  $(targetId).innerHTML = html;
}

function renderComparativeTable(statsById, baseline) {
  const headers = [
    { label: "Coleção", cls: "left" },
    { label: "Total", cls: "" },
    { label: "Custo médio", cls: "" },
    { label: "Força média", cls: "" },
    { label: "Resistência média", cls: "" },
    { label: "Poder (F+R)", cls: "" },
    { label: "Eficiência (Poder/Custo)", cls: "" },
  ];

  const rows = state.meta.map((m) => {
    const s = statsById[m.id];
    return [
      tdTxt(m.label, "left"),
      tdNumWithDelta(s.total, baseline.total, 0),
      tdNumWithDelta(s.cost, baseline.cost, 2),
      tdNumWithDelta(s.forca, baseline.forca, 2),
      tdNumWithDelta(s.res, baseline.res, 2),
      tdNumWithDelta(s.poder, baseline.poder, 2),
      tdNumWithDelta(s.eficiencia, baseline.eficiencia, 2),
    ];
  });

  $("#comparativeTable").innerHTML = table(headers, rows);
}

/* ---------------- Radar chart ---------------- */
function hexToRgba(hex, a) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function palette(n) {
  // deterministic palette
  const base = [
    "#6dd5ed",
    "#2193b0",
    "#35d07f",
    "#ff5d5d",
    "#b8c2d8",
    "#d1ff6d",
    "#ff6dd9",
    "#6d7dff",
  ];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

function renderRadar(statsById) {
  const canvas = $("#radar");
  const ctx = canvas.getContext("2d");

  // handle HiDPI
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.width;
  const h = canvas.height;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, w, h);

  const metrics = [
    { key: "total", label: "Total" },
    { key: "cost", label: "Custo" },
    { key: "forca", label: "Força" },
    { key: "res", label: "Resist." },
    { key: "poder", label: "Poder" },
    { key: "eficiencia", label: "Eficiência" },
  ];

  // normalize 0..1 by max across collections (per metric)
  const maxBy = {};
  metrics.forEach((m) => {
    const vals = state.meta.map((x) => Number(statsById[x.id][m.key] ?? 0));
    maxBy[m.key] = Math.max(1e-9, ...vals);
  });

  const cx = w / 2,
    cy = h / 2 + 6;
  const radius = Math.min(w, h) * 0.34;

  // grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(35,42,58,.9)";
  ctx.fillStyle = "rgba(0,0,0,0)";

  const rings = 4;
  for (let r = 1; r <= rings; r++) {
    const rr = (r / rings) * radius;
    ctx.beginPath();
    for (let i = 0; i < metrics.length; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / metrics.length;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // axes + labels
  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(154,163,178,.95)";
  metrics.forEach((m, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / metrics.length;
    const x1 = cx + Math.cos(ang) * radius;
    const y1 = cy + Math.sin(ang) * radius;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    const lx = cx + Math.cos(ang) * (radius + 18);
    const ly = cy + Math.sin(ang) * (radius + 18);
    ctx.textAlign =
      Math.cos(ang) > 0.3 ? "left" : Math.cos(ang) < -0.3 ? "right" : "center";
    ctx.textBaseline =
      Math.sin(ang) > 0.3 ? "top" : Math.sin(ang) < -0.3 ? "bottom" : "middle";
    ctx.fillText(m.label, lx, ly);
  });

  // series
  const colors = palette(state.meta.length);

  state.meta.forEach((m, idx) => {
    const color = colors[idx];
    const fill = hexToRgba(color, 0.12);

    ctx.beginPath();
    metrics.forEach((met, i) => {
      const raw = Number(statsById[m.id][met.key] ?? 0);
      const v = raw / maxBy[met.key];
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / metrics.length;
      const x = cx + Math.cos(ang) * (v * radius);
      const y = cy + Math.sin(ang) * (v * radius);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    ctx.fillStyle = fill;
    ctx.strokeStyle = hexToRgba(color, 0.7);
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // points
    metrics.forEach((met, i) => {
      const raw = Number(statsById[m.id][met.key] ?? 0);
      const v = raw / maxBy[met.key];
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / metrics.length;
      const x = cx + Math.cos(ang) * (v * radius);
      const y = cy + Math.sin(ang) * (v * radius);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = hexToRgba(color, 0.85);
      ctx.fill();
      ctx.strokeStyle = "rgba(11,13,18,.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });

  // legend
  const legend = $("#radarLegend");
  legend.innerHTML = state.meta
    .map(
      (m, idx) => `
    <div class="legItem">
      <span class="swatch" style="background:${colors[idx]}"></span>
      <span>${m.label}</span>
    </div>
  `,
    )
    .join("");
}

/* ---------------- Cards table ---------------- */
function applyCardFilters(cards) {
  const q = state.search.trim().toLowerCase();
  const type = normalize(state.type);

  let out = cards.slice();

  if (q) {
    out = out.filter((c) => {
      const blob = [c.nome, c.tipo, c.categoria]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }
  if (type) {
    out = out.filter((c) => normalize(c.tipo) === type);
  }

  const by = state.sort;
  const num = (v) =>
    v === null || v === undefined || v === "" ? -Infinity : Number(v);

  out.sort((a, b) => {
    if (by === "nome")
      return (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR");
    if (by === "custo_asc") return num(a.custo) - num(b.custo);
    if (by === "custo_desc") return num(b.custo) - num(a.custo);
    if (by === "forca_desc") return num(b.forca) - num(a.forca);
    if (by === "res_desc") return num(b.resistencia) - num(a.resistencia);
    return 0;
  });

  return out;
}

function renderCollectionDetails() {
  const cards = state.cardsById[state.selectedId] ?? [];
  const s = computeStats(cards);

  renderKpisCollection("#colKpis", s);

  // functions tables
  const funcs = Object.entries(s.categorias || {})
    .map(([f, v]) => ({ funcao: f, total: v.total, cost: v.cost }))
    .sort(
      (a, b) => b.total - a.total || a.funcao.localeCompare(b.funcao, "pt-BR"),
    );

  const baselineQty = {};
  const baselineCost = {};
  funcs.forEach((r) => {
    baselineQty[r.funcao] = null;
    baselineCost[r.funcao] = null;
  });

  // In collection tab we don't need deltas; but we reuse renderer with baseline null -> no arrows.
  // We'll render as plain tables with Qty and Cost
  const headersQty = [
    { label: "Categoria", cls: "left" },
    { label: "Quantidade" },
    { label: "Δ vs média" },
  ];
  const rowsQty = funcs.map((r) => [
    tdTxt(r.funcao, "left"),
    tdNum(r.total, 0),
    tdTxt(deltaBadge(r.total, state.baselineCategoryQty?.[r.funcao]) || "—"),
  ]);
  $("#colFuncQty").innerHTML = table(headersQty, rowsQty);

  const headersCost = [
    { label: "Categoria", cls: "left" },
    { label: "Custo médio" },
    { label: "Δ vs média" },
  ];
  const rowsCost = funcs.map((r) => [
    tdTxt(r.funcao, "left"),
    tdNum(r.cost, 2),
    tdTxt(deltaBadge(r.cost, state.baselineCategoryCost?.[r.funcao]) || "—"),
  ]);
  $("#colFuncCost").innerHTML = table(headersCost, rowsCost);

  // bars for types + cost buckets
  const typeRows = Object.entries(s.tipos || {}).reduce((acc, [k, v]) => {
    acc[k] = v;
    return acc;
  }, {});
  const bucketRows = Object.entries(s.buckets || {}).reduce((acc, [k, v]) => {
    acc[k] = v;
    return acc;
  }, {});
  renderBarsFromMap("#colTypeTotals", "tipos", typeRows, (v) => v, null);
  renderBarsFromMap("#colCostBuckets", "buckets", bucketRows, (v) => v, null);
}

function renderCardsTable() {
  const cards = state.cardsById[state.selectedId] ?? [];
  const filtered = applyCardFilters(cards);

  $("#cardsCount").textContent = `${filtered.length} / ${cards.length}`;

  const headers = [
    { label: "Nome", cls: "left" },
    { label: "Tipo" },
    { label: "Categoria" },
    { label: "Custo" },
    { label: "Força" },
    { label: "Resistência" },
  ];
  const rows = filtered.map((c) => [
    tdTxt(c.nome ?? "", "left"),
    tdTxt(c.tipo ?? ""),
    tdTxt(c.categoria ?? ""),
    tdNum(c.custo, 0),
    tdTxt(
      c.tipo === "Herói de Fé" || c.tipo === "Herói Lendário"
        ? (c.forca ?? "—")
        : "—",
    ),
    tdTxt(
      c.tipo === "Herói de Fé" || c.tipo === "Herói Lendário"
        ? (c.resistencia ?? "—")
        : "—",
    ),
  ]);

  $("#cardsTable").innerHTML = table(headers, rows);
  renderCollectionDetails();
}

function populateTypeFilter() {
  const cards = state.cardsById[state.selectedId] ?? [];
  const types = Array.from(
    new Set(cards.map((c) => normalize(c.tipo)).filter(Boolean)),
  ).sort();
  const sel = $("#typeFilter");
  sel.innerHTML =
    `<option value="">Todos</option>` +
    types.map((t) => `<option value="${t}">${t}</option>`).join("");
}

function setActiveTab(tab) {
  document
    .querySelectorAll(".tabBtn")
    .forEach((b) => b.classList.toggle("isActive", b.dataset.tab === tab));
  document
    .querySelectorAll(".tabPanel")
    .forEach((p) => (p.hidden = p.dataset.tab !== tab));
}

function wireTabs() {
  document.querySelectorAll(".tabBtn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function wireCardsUI() {
  $("#collectionSelect").addEventListener("change", (e) => {
    state.selectedId = e.target.value;
    state.search = "";
    state.type = "";
    state.sort = "nome";
    $("#searchInput").value = "";
    $("#sortSelect").value = "nome";
    populateTypeFilter();
    $("#typeFilter").value = "";
    renderCardsTable();
  });

  $("#searchInput").addEventListener("input", (e) => {
    state.search = e.target.value || "";
    renderCardsTable();
  });

  $("#typeFilter").addEventListener("change", (e) => {
    state.type = e.target.value || "";
    renderCardsTable();
  });

  $("#sortSelect").addEventListener("change", (e) => {
    state.sort = e.target.value || "nome";
    renderCardsTable();
  });
}

function renderComparativos() {
  const statsById = {};
  state.meta.forEach((m) => {
    statsById[m.id] = computeStats(state.cardsById[m.id] || []);
  });
  const baseline = computeGlobal(statsById);

  // baselines por categoria (média entre coleções)
  state.baselineCategoryQty = {};
  state.baselineCategoryCost = {};

  renderKpisComparativos(statsById, baseline);

  renderBars("#chartTotal", "total", statsById, baseline, 0);
  renderBars("#chartCost", "cost", statsById, baseline, 2);
  renderBars("#chartPower", "poder", statsById, baseline, 2);
  renderBars("#chartForca", "forca", statsById, baseline, 2);
  renderBars("#chartRes", "res", statsById, baseline, 2);
  renderBars("#chartEff", "eficiencia", statsById, baseline, 2);

  // --- Funções (comparativo) ---
  // Baseline por função = média entre coleções (para aquela função)
  const funcSet = new Set();
  state.meta.forEach((m) =>
    Object.keys(statsById[m.id].categorias || {}).forEach((f) =>
      funcSet.add(f),
    ),
  );
  const funcs = Array.from(funcSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const baselineQtyByFunc = {};
  const baselineCostByFunc = {};
  funcs.forEach((f) => {
    const qtys = state.meta.map(
      (m) => statsById[m.id].categorias?.[f]?.total ?? 0,
    );
    const costs = state.meta
      .map((m) => statsById[m.id].categorias?.[f]?.cost)
      .filter((v) => v != null);
    baselineQtyByFunc[f] = mean(qtys);
    baselineCostByFunc[f] = mean(costs);
  });

  const rowsFunc = funcs.map((f) => ({
    funcao: f,
    total: mean(
      state.meta.map((m) => statsById[m.id].categorias?.[f]?.total ?? 0),
    ), // shown as mean of totals? no: show per collection? we'll show per collection is better in table.
    cost: mean(
      state.meta
        .map((m) => statsById[m.id].categorias?.[f]?.cost)
        .filter((v) => v != null),
    ),
  }));

  // For comparativo, show per function the collection totals? We keep it simple: table rows are functions, values are collection means, deltas vs mean.
  // Deltas use baselineByFunc itself; value is same as baseline so mostly eq, but it still gives overview. Better: show selected? We'll instead show for each function a small "best/worst" bars? We'll do baseline table plus add note in tooltip not possible. We'll do more useful: show top 10 functions by variability using max-min ratio.
  // We'll render tables using per-function baseline, but we will pass the value as per-function mean (eq). To add value, we additionally create ranking bars of total by function across all collections combined.
  renderFuncTableWithDeltas(
    "#cmpFuncQty",
    funcs.map((f) => ({ funcao: f, total: baselineQtyByFunc[f], cost: null })),
    baselineQtyByFunc,
    "qty",
  );
  renderFuncTableWithDeltas(
    "#cmpFuncCost",
    funcs.map((f) => ({ funcao: f, total: null, cost: baselineCostByFunc[f] })),
    baselineCostByFunc,
    "cost",
  );

  // --- Distribuições (comparativo): somatório por tipo e por bucket ---
  const typesAgg = {};
  const bucketsAgg = {};
  state.meta.forEach((m) => {
    const s = statsById[m.id];
    Object.entries(s.tipos || {}).forEach(
      ([t, v]) => (typesAgg[t] = (typesAgg[t] || 0) + Number(v || 0)),
    );
    Object.entries(s.buckets || {}).forEach(
      ([b, v]) => (bucketsAgg[b] = (bucketsAgg[b] || 0) + Number(v || 0)),
    );
  });
  renderBarsFromMap("#cmpTypeTotals", "tipos", typesAgg, (v) => v, null);
  renderBarsFromMap("#cmpCostBuckets", "buckets", bucketsAgg, (v) => v, null);

  // --- Categorias (comparativo) ---
  const catSet = new Set();
  state.meta.forEach((m) =>
    Object.keys(statsById[m.id].categorias || {}).forEach((c) => catSet.add(c)),
  );
  const cats = Array.from(catSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

  cats.forEach((c) => {
    const qtys = state.meta.map(
      (m) => statsById[m.id].categorias?.[c]?.total ?? 0,
    );
    const costs = state.meta
      .map((m) => statsById[m.id].categorias?.[c]?.cost)
      .filter((v) => v != null);
    state.baselineCategoryQty[c] = mean(qtys);
    state.baselineCategoryCost[c] = mean(costs);
  });

  function renderCategoryMatrix(targetId, mode) {
    const headers = [
      { label: "Categoria", cls: "left" },
      ...state.meta.map((m) => ({ label: m.label, cls: "" })),
    ];
    const rows = cats.map((cat) => {
      const cells = [tdTxt(cat, "left")];
      state.meta.forEach((m) => {
        const v = statsById[m.id].categorias?.[cat];
        const val = v ? (mode === "qty" ? v.total : v.cost) : null;
        const base =
          mode === "qty"
            ? state.baselineCategoryQty[cat]
            : state.baselineCategoryCost[cat];
        const digits = mode === "qty" ? 0 : 2;
        cells.push(tdNumWithDelta(val, base, digits));
      });
      return cells;
    });
    $(targetId).innerHTML = table(headers, rows);
  }

  renderCategoryMatrix("#cmpFuncQty", "qty");
  renderCategoryMatrix("#cmpFuncCost", "cost");

  renderRadar(statsById);
  if (document.querySelector("#comparativeTable")) {
    renderComparativeTable(statsById, baseline);
  }
}

async function init() {
  try {
    const typeFiles = [
      "heroes.json",
      "miracles.json",
      "sins.json",
      "artifacts.json",
      "legendary.json",
      "pdj.json",
    ];

    let allCards = [];
    for (const f of typeFiles) {
      const res = await fetch(`../data/${f}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${f}`);
      const arr = await res.json();
      arr.forEach((c) => {
        const cats = normalizeCategoriesField(c.categories);
        const derivedType =
          c.type === "Herói de Fé" && c.subtype === "Lendário"
            ? "Herói Lendário"
            : c.type;
        allCards.push({ ...c, _categories: cats, _derivedType: derivedType });
      });
    }

    // Group by collection
    state.cardsById = {};
    allCards.forEach((c) => {
      const id = c.collection;
      if (!state.cardsById[id]) state.cardsById[id] = [];
      state.cardsById[id].push({
        nome: c.name,
        tipo: c._derivedType,
        categoria: c._categories,
        custo: c.cost,
        forca: c.strength,
        resistencia: c.resistence,
      });
    });

    state.meta = Object.keys(state.cardsById)
      .sort()
      .map((id) => ({ id, label: id }));

    const select = $("#collectionSelect");
    select.innerHTML = state.meta
      .map((m) => `<option value="${m.id}">${m.label}</option>`)
      .join("");
    state.selectedId = state.meta[0]?.id || null;
    select.value = state.selectedId;

    wireTabs();
    wireCardsUI();

    renderComparativos();
    populateTypeFilter();
    renderCardsTable();
    setActiveTab("comparativos");

    window.addEventListener("resize", () => {
      clearTimeout(window.__radarT);
      window.__radarT = setTimeout(() => renderComparativos(), 150);
    });
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div style="padding:40px;color:#fff">Erro: ${err.message}</div>`;
  }
}

init();
