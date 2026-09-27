"use strict";
const OS_VSM_TYPES = {
  process: "Processus",
  stock: "Stock",
  supermarket: "Supermarket",
  fifo: "FIFO",
  supplier: "Fournisseur",
  customer: "Client",
  information: "Information",
};
function osVsmMetrics(v) {
  const processes = (v.nodes || []).filter(
      (n) => !n.type || n.type === "process",
    ),
    stocks = (v.nodes || []).filter((n) =>
      ["stock", "supermarket", "fifo"].includes(n.type),
    );
  const sum = (rows, key) =>
    rows.length && rows.every((n) => osFinite(n[key]))
      ? rows.reduce((s, n) => s + n[key], 0)
      : null;
  const takt =
    osFinite(v.available_minutes) &&
    v.available_minutes > 0 &&
    v.demand_per_day > 0
      ? (v.available_minutes * 60) / v.demand_per_day
      : null;
  const ct = sum(processes, "ct"),
    va = sum(processes, "va"),
    wait = sum(processes.concat(stocks), "wait"),
    wip = sum(processes.concat(stocks), "wip");
  const lead = ct !== null && wait !== null ? ct + wait * 60 : null,
    nva = lead !== null && va !== null ? lead - va : null;
  const capacities = processes.map((p) => ({
    id: p.id,
    name: p.name,
    value:
      p.ct > 0 &&
      osFinite(p.uptime) &&
      p.uptime >= 0 &&
      p.uptime <= 100 &&
      v.available_minutes > 0
        ? Math.floor((v.available_minutes * 60 * p.uptime) / 100 / p.ct)
        : null,
    load: takt && p.ct >= 0 ? (p.ct / takt) * 100 : null,
  }));
  const capacity =
      capacities.length && capacities.every((c) => c.value !== null)
        ? Math.min(...capacities.map((c) => c.value))
        : null,
    bottleneck =
      capacity !== null ? capacities.find((c) => c.value === capacity) : null;
  return {
    takt,
    ct,
    va,
    wait,
    wip,
    lead,
    nva,
    ratio: lead > 0 && va !== null ? (va / lead) * 100 : null,
    capacity,
    bottleneck,
    capacities,
    balance:
      ct !== null && processes.length && processes.every((p) => p.ct > 0)
        ? (ct / (processes.length * Math.max(...processes.map((p) => p.ct)))) *
          100
        : null,
  };
}
function osVsmNormalize(doc) {
  doc.vsm ||= { current: { nodes: [] }, future: { nodes: [] } };
  for (const mode of ["current", "future"]) {
    const v = (doc.vsm[mode] ||= { nodes: [] });
    v.edges ||= [];
    v.nodes ||= [];
    v.nodes.forEach((n, i) => {
      n.id ||= uid("NODE");
      n.type ||= "process";
      n.x ??= 70 + (i % 4) * 330;
      n.y ??= 100 + Math.floor(i / 4) * 240;
    });
  }
  return doc;
}
function osVsmSVG(v, selected) {
  const focus = v.nodes.find((n) => n.id === selected),
    width = Math.max(720, ...v.nodes.map((n) => n.x + 310)),
    height = Math.max(380, ...v.nodes.map((n) => n.y + 230));
  const box =
    state.vsmZoom && focus
      ? `${Math.max(0, focus.x - 40)} ${Math.max(0, focus.y - 40)} 340 260`
      : `0 0 ${width} ${height}`;
  return `<svg id="osVsmCanvas" viewBox="${box}" tabindex="0" role="img" aria-label="Cartographie VSM : sélectionner un objet pour le modifier"><defs><marker id="vsmArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#40746f"/></marker></defs><rect width="6000" height="6000" fill="#f7faf9"/>${v.edges
    .map((e) => {
      const a = v.nodes.find((n) => n.id === e.from),
        b = v.nodes.find((n) => n.id === e.to);
      if (!a || !b) return "";
      return `<g><path d="M${a.x + 130},${a.y + 90} L${b.x + 130},${b.y + 90}" stroke="${e.kind === "information" ? "#836bb1" : "#40746f"}" stroke-width="3" ${e.kind === "information" ? 'stroke-dasharray="8 6"' : ""} marker-end="url(#vsmArrow)"/><text x="${(a.x + b.x) / 2 + 130}" y="${(a.y + b.y) / 2 + 75}" text-anchor="middle" font-size="15">${esc(e.label || e.mode || e.kind)}</text></g>`;
    })
    .join(
      "",
    )}${v.nodes.map((n) => `<g data-vsm-graphic="${n.id}" transform="translate(${n.x} ${n.y})" tabindex="0" role="button" aria-label="${esc(n.name || OS_VSM_TYPES[n.type])}" class="os-vsm-object ${selected === n.id ? "selected" : ""}"><rect width="260" height="180" rx="${n.type === "process" ? 8 : 28}" fill="white" stroke="${selected === n.id ? "#e59639" : "#32776e"}" stroke-width="${selected === n.id ? 5 : 2}"/><rect width="260" height="34" rx="8" fill="#e8f0ed"/><text x="16" y="23" font-size="15">${esc(OS_VSM_TYPES[n.type])}</text><text x="16" y="64" font-size="18" font-weight="bold">${esc((n.name || "À nommer").slice(0, 24))}</text>${n.type === "process" ? `<text x="16" y="94" font-size="15">CT ${osNum(n.ct)} s · VA ${osNum(n.va)} s</text><text x="16" y="120" font-size="15">Uptime ${osNum(n.uptime)} % · ${osNum(n.operators)} op.</text><text x="16" y="146" font-size="15">C/O ${osNum(n.changeover)} min</text>` : `<text x="16" y="98" font-size="15">WIP ${osNum(n.wip)} pièces</text><text x="16" y="126" font-size="15">Attente ${osNum(n.wait)} min</text>`}<text x="16" y="168" font-size="13">${esc((n.note || "").slice(0, 31))}</text></g>`).join("")}</svg>`;
}
function osVsmForm(saved, mode = "current", selected = null) {
  const d = osVsmNormalize(clone(saved)),
    v = d.vsm[mode],
    node = v.nodes.find((n) => n.id === selected) || v.nodes[0],
    writable = osWritable(d.site_id),
    metrics = osVsmMetrics(v);
  selected = node?.id;
  modal(
    `${d.id} · VSM graphique`,
    `<div class="os-vsm"><header><h3>${esc(d.title)}</h3><p>${esc(getSiteName(d.site_id))} · ${mode === "current" ? "État actuel observé" : "État futur : hypothèses à valider"}</p></header><div class="tabs">${["current", "future"].map((m) => osButton(m === "current" ? "État actuel" : "État futur", "vsmMode", { id: d.id, mode: m }, m !== mode)).join("")}</div><form id="osVsmMeta" class="form-grid">${[
      ["family", "Famille", "text"],
      ["source", "Date / source des observations", "text"],
      ["available_minutes", "Temps net disponible (min/jour)", "number"],
      ["demand_per_day", "Demande (pièces/jour)", "number"],
    ]
      .map((f) => osField(f, v))
      .join("")}</form><div class="os-vsm-toolbar">${
      writable
        ? Object.entries(OS_VSM_TYPES)
            .map(
              ([type, label]) =>
                `<button type="button" class="btn secondary" data-vsm-add="${type}">+ ${label}</button>`,
            )
            .join("")
        : ""
    }</div><div class="os-vsm-toolbar"><label>Objet à examiner<select id="osVsmSelect">${v.nodes.map((n) => `<option value="${n.id}" ${n.id === selected ? "selected" : ""}>${esc(n.name || OS_VSM_TYPES[n.type])}</option>`).join("")}</select></label><button type="button" class="btn secondary" id="osVsmZoom">${state.vsmZoom ? "Voir toute la carte" : "Agrandir l’objet"}</button></div><div class="os-vsm-layout"><div class="os-vsm-board">${osVsmSVG(v, selected)}<p class="hint">Déplacez les objets au doigt ou à la souris. Objet sélectionné : flèches du clavier pour déplacer. Les flux suivent les objets.</p></div><aside class="panel"><h3>${node ? "Objet sélectionné" : "Ajouter un objet"}</h3>${
      node
        ? `<form id="osVsmNode">${[
            ["name", "Nom", "text", true],
            ["ct", "Cycle par pièce (s)", "number"],
            ["va", "Part à valeur ajoutée (s)", "number"],
            ["changeover", "Changement de série (min)", "number"],
            ["uptime", "Disponibilité (%)", "number"],
            ["operators", "Opérateurs", "number"],
            ["wip", "Encours avant (pièces)", "number"],
            ["wait", "Attente avant (min)", "number"],
            ["note", "Perte / opportunité", "textarea"],
          ]
            .map((f) => osField(f, node))
            .join(
              "",
            )}<div class="form-actions"><button class="btn">Enregistrer l’objet</button><button type="button" class="btn ghost" id="osVsmRemove">Retirer</button></div></form>${writable ? osButton("Créer une suite pour cette opportunité", "vsmOpportunity", { id: d.id, nodeId: node.id, mode }) : ""}`
        : ""
    }</aside></div><section class="panel section"><h3>Flux matière et information</h3>${writable ? `<form id="osVsmEdge" class="os-edge-form"><label>De<select name="from">${v.nodes.map((n) => `<option value="${n.id}">${esc(n.name || OS_VSM_TYPES[n.type])}</option>`).join("")}</select></label><label>Vers<select name="to">${v.nodes.map((n) => `<option value="${n.id}">${esc(n.name || OS_VSM_TYPES[n.type])}</option>`).join("")}</select></label><label>Flux<select name="kind"><option value="material">Matière</option><option value="information">Information</option></select></label><label>Pilotage<select name="mode"><option>Push</option><option>Pull</option><option>FIFO</option><option>Kanban</option></select></label><label>Fréquence / quantité<input name="label"></label><button class="btn">Relier</button></form>` : ""}<div>${v.edges.map((e) => `<p>${esc(v.nodes.find((n) => n.id === e.from)?.name)} → ${esc(v.nodes.find((n) => n.id === e.to)?.name)} · ${esc(e.kind)} · ${esc(e.mode)} ${writable ? `<button type="button" class="btn ghost small" data-vsm-edge-remove="${e.id}">Retirer ce flux</button>` : ""}</p>`).join("")}</div></section><div class="os-metrics section">${[
      ["Takt (s/pièce)", metrics.takt],
      ["Lead time (min)", metrics.lead === null ? null : metrics.lead / 60],
      ["VA (s)", metrics.va],
      ["NVA (min)", metrics.nva === null ? null : metrics.nva / 60],
      ["Ratio VA (%)", metrics.ratio],
      ["WIP (pièces)", metrics.wip],
      ["Capacité (pièces/jour)", metrics.capacity],
      ["Équilibrage (%)", metrics.balance],
      [
        "Charge maximale (%)",
        metrics.capacities.length &&
        metrics.capacities.every((c) => c.load !== null)
          ? Math.max(...metrics.capacities.map((c) => c.load))
          : null,
      ],
    ]
      .map(([label, val]) => osMetric(label, osNum(val)))
      .join(
        "",
      )}</div><p class="hint">Capacité théorique = temps net × disponibilité / cycle par pièce ; le minimum des processus donne le goulot. Les changements de série, rebuts et calendriers détaillés ne sont pas soustraits. Le lead time suppose un flux séquentiel : cycles + attentes observées. « — » : données insuffisantes. Ne pas additionner deux fois un même stock.</p><p><b>Goulot théorique :</b> ${esc(metrics.bottleneck?.name || "Données insuffisantes")}</p><div class="row-actions">${writable && mode === "future" && !v.nodes.length ? '<button type="button" class="btn secondary" id="osVsmCopy">Partir de l’état actuel</button>' : ""}${d.vsm.removed?.length && writable ? '<button type="button" class="btn secondary" id="osVsmUndo">Annuler le dernier retrait</button>' : ""}${osButton("Relevés détaillés", "vsmTable", { id: d.id, mode })}<button type="button" class="btn secondary" id="osVsmPrint">Imprimer / PDF</button><button type="button" class="btn" id="osVsmSave">Enregistrer et quitter</button></div>${osContext(d.id)}</div>`,
  );
  if (!writable) {
    document
      .querySelectorAll(
        "#osVsmMeta input, #osVsmNode input, #osVsmNode textarea, #osVsmNode button",
      )
      .forEach((el) => (el.disabled = true));
    $("osVsmSave").textContent = "Fermer";
  }
  function capture() {
    for (const f of $("osVsmMeta").elements)
      if (f.name)
        v[f.name] = f.type === "number" ? osNumber(f.value) : f.value.trim();
    if (node && $("osVsmNode"))
      for (const f of $("osVsmNode").elements)
        if (f.name)
          node[f.name] =
            f.type === "number" ? osNumber(f.value) : f.value.trim();
  }
  function persist() {
    if (!writable) return true;
    capture();
    if (
      v.nodes.some(
        (n) =>
          Object.values(n).some(
            (x) => typeof x === "number" && (!Number.isFinite(x) || x < 0),
          ) ||
          n.uptime > 100 ||
          (osFinite(n.va) && osFinite(n.ct) && n.va > n.ct),
      )
    )
      return (
        toast("Mesures positives, disponibilité ≤ 100 %, VA ≤ cycle requis."),
        false
      );
    return commitData(() => {
      const found = data.documents.find((x) => x.id === d.id);
      found.vsm = clone(d.vsm);
      found.structured_data = { family: v.family || "" };
      found.updated_at = now();
    });
  }
  const redraw = (id) =>
    osVsmForm(
      data.documents.find((x) => x.id === d.id),
      mode,
      id || selected,
    );
  setModalSaver(() => (modalDirty ? persist() : true));
  $("osVsmMeta").onsubmit = (e) => e.preventDefault();
  $("osVsmNode")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (persist()) redraw();
  });
  document.querySelectorAll("[data-vsm-add]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!persist()) return;
        const newNode = {
          id: uid("NODE"),
          type: b.dataset.vsmAdd,
          name: OS_VSM_TYPES[b.dataset.vsmAdd],
          x: 50 + (v.nodes.length % 4) * 330,
          y: 60 + Math.floor(v.nodes.length / 4) * 240,
          ct: null,
          va: null,
          uptime: null,
          operators: null,
          changeover: null,
          wip: null,
          wait: null,
          note: "",
        };
        v.nodes.push(newNode);
        if (persist()) redraw(newNode.id);
      }),
  );
  $("osVsmRemove")?.addEventListener("click", () => {
    if (!persist()) return;
    d.vsm.removed ||= [];
    d.vsm.removed.push({
      mode,
      index: v.nodes.indexOf(node),
      node: clone(node),
      edges: v.edges.filter((e) => e.from === node.id || e.to === node.id),
    });
    v.nodes = v.nodes.filter((n) => n.id !== node.id);
    v.edges = v.edges.filter((e) => e.from !== node.id && e.to !== node.id);
    if (persist()) redraw();
  });
  $("osVsmEdge")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!persist()) return;
    const f = e.currentTarget;
    if (!f.elements.from.value || f.elements.from.value === f.elements.to.value)
      return toast("Choisissez deux objets distincts.");
    const edge = { id: uid("EDGE"), ...Object.fromEntries(new FormData(f)) };
    if (
      v.edges.some(
        (x) => x.from === edge.from && x.to === edge.to && x.kind === edge.kind,
      )
    )
      return toast("Ce flux existe déjà.");
    v.edges.push(edge);
    if (persist()) redraw();
  });
  document.querySelectorAll("[data-vsm-edge-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!persist()) return;
        v.edges = v.edges.filter((e) => e.id !== b.dataset.vsmEdgeRemove);
        if (persist()) redraw();
      }),
  );
  $("osVsmCopy")?.addEventListener("click", () => {
    if (!persist()) return;
    d.vsm.future = clone(d.vsm.current);
    d.vsm.future.source = "Hypothèses à valider";
    if (
      commitData(
        () => (data.documents.find((x) => x.id === d.id).vsm = clone(d.vsm)),
      )
    )
      redraw();
  });
  $("osVsmUndo")?.addEventListener("click", () => {
    if (!persist()) return;
    const last = d.vsm.removed.pop();
    d.vsm[last.mode].nodes.splice(last.index, 0, last.node);
    d.vsm[last.mode].edges.push(...(last.edges || []));
    if (persist()) redraw();
  });
  $("osVsmSave").onclick = () => {
    if (persist()) {
      closeModal();
      render();
    }
  };
  $("osVsmPrint").onclick = () => {
    if (persist()) window.print();
  };
  $("osVsmSelect").disabled = false;
  $("osVsmSelect").onchange = (e) => {
    if (persist()) redraw(e.target.value);
  };
  $("osVsmZoom").onclick = () => {
    if (persist()) {
      state.vsmZoom = !state.vsmZoom;
      redraw();
    }
  };
  const svg = $("osVsmCanvas");
  let drag = null;
  const coord = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  svg.onpointerdown = (e) => {
    const target = e.target.closest("[data-vsm-graphic]");
    if (!target) return;
    const n = v.nodes.find((n) => n.id === target.dataset.vsmGraphic);
    if (!n) return;
    const p = coord(e);
    drag = { n, target, dx: p.x - n.x, dy: p.y - n.y, moved: false };
    svg.setPointerCapture(e.pointerId);
  };
  svg.onpointermove = (e) => {
    if (!drag || !writable) return;
    const p = coord(e);
    drag.n.x = Math.max(0, Math.min(5000, p.x - drag.dx));
    drag.n.y = Math.max(0, Math.min(5000, p.y - drag.dy));
    drag.target.setAttribute("transform", `translate(${drag.n.x} ${drag.n.y})`);
    drag.moved = true;
  };
  svg.onpointerup = () => {
    if (!drag) return;
    const id = drag.n.id;
    drag = null;
    if (persist()) redraw(id);
  };
  svg.onkeydown = (e) => {
    const target = e.target.closest("[data-vsm-graphic]"),
      n = v.nodes.find((n) => n.id === target?.dataset.vsmGraphic);
    if (!n) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (persist()) redraw(n.id);
      return;
    }
    if (
      !writable ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    n.x = Math.max(
      0,
      Math.min(5000, n.x + ({ ArrowLeft: -10, ArrowRight: 10 }[e.key] || 0)),
    );
    n.y = Math.max(
      0,
      Math.min(5000, n.y + ({ ArrowUp: -10, ArrowDown: 10 }[e.key] || 0)),
    );
    if (persist()) redraw(n.id);
  };
}
