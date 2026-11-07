"use strict";
/*
 * BIA Lean OS 8.32 · Connecteurs : d'où viennent les chiffres, et comment les faire arriver sans ressaisie.
 *  - « D'où viennent les relevés » : pour chaque site et chaque indicateur, le dernier relevé, son origine (saisi,
 *    importé, calculé, à vérifier) et son âge ; en orange s'il est plus ancien que la fréquence de l'indicateur.
 *  - « Importer un fichier » en trois temps : modèle pré-rempli (sites × indicateurs, séparateur « ; »), fichier,
 *    vérification ligne à ligne puis confirmation. Les lignes sans valeur sont ignorées ; tout ou rien pour le reste ;
 *    les lignes en erreur se téléchargent avec leur motif.
 *  - « Systèmes sources » (SEQUOIA, ERP…) : chemin Cadrer → Contrat → Essai sur fichier → Import régulier →
 *    Automatique, et la « fiche de raccordement » à remettre à l'informatique : contrat d'entrée, indicateurs,
 *    codes des sites et ateliers, contrôles, sécurité, étapes.
 *  - Journal des imports et file de synchronisation (préparation serveur) en bas de page.
 * Données : connectors[] (statuts « Import régulier » et « Automatique » ajoutés), syncLog[] (+ ignored).
 */

const CN_STEPS = [["À spécifier", "Cadrer"], ["Contrat reçu", "Contrat"], ["Test local", "Essai sur fichier"], ["Import régulier", "Import régulier"], ["Automatique", "Automatique"]];
const CN_MODE = { manual: ["Saisi", "man"], import: ["Import", "imp"], calculated: ["Calculé", "calc"], "legacy-unverified": ["À vérifier", "chk"], demo: ["Exemple", "demo"] };
const CN_COLS = [
  ["site_id", "oui", "code du site (liste ci-dessous)", "marzin"],
  ["workshop_id", "non", "code de l’atelier, vide = site entier", ""],
  ["code", "oui", "code de l’indicateur (liste ci-dessous)", "trs"],
  ["period", "oui", "date AAAA-MM-JJ, pas dans le futur", "2026-11-06"],
  ["value", "oui", "nombre ≥ 0, virgule ou point ; ≤ 100 si %", "82,5"],
  ["target", "non", "cible locale, même unité", "85"],
  ["definition", "oui", "périmètre et conventions de calcul du site", "Temps utile / temps requis, site entier"],
  ["source", "oui", "système et extraction", "Export SEQUOIA du 06/11"],
];

// Les étapes « Import régulier » et « Automatique » complètent le formulaire du référentiel.
(function () { const f = OS_FORMS.connectors?.fields?.find((x) => x[0] === "status"); if (f) f[2] = CN_STEPS.map((s) => s[0]).join("|"); const o = OS_FORMS.connectors?.fields?.find((x) => x[0] === "owner"); if (o) o[1] = "Contact technique (informatique, éditeur)"; })();

function cnCell(v) { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function cnCsv(rows) { return "﻿" + rows.map((r) => r.map(cnCell).join(";")).join("\r\n") + "\r\n"; }
function cnDownload(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cnFresh(k) { return (typeof PM_FRESH === "object" && PM_FRESH[k.frequency]) || 14; }
function cnAge(period) { return typeof pmAge === "function" ? pmAge(period) : Math.floor((Date.now() - Date.parse(period + "T12:00:00Z")) / 86400000); }

/* ---------- D'où viennent les relevés ---------- */

function cnOrigins() {
  const kpis = osActive(data.kpis).slice().sort((a, b) => "SQCDP".indexOf(a.axis) - "SQCDP".indexOf(b.axis)), cells = [];
  for (const s of OPERATIONAL_SITES) for (const k of kpis) {
    const m = osLatest(s.id, k.id), age = m ? cnAge(m.period) : Infinity, mode = m ? CN_MODE[m.entry_mode] || CN_MODE.manual : null;
    cells.push({ s, k, m, age, mode, stale: age > cnFresh(k) });
  }
  return { kpis, cells };
}
function cnOriginBlock() {
  const { kpis, cells } = cnOrigins(), short = (k) => (typeof inShort === "function" ? inShort(k) : k.name);
  const n = (f) => cells.filter(f).length, total = cells.length;
  const parts = [[n((c) => c.m && c.mode[1] === "man"), "saisis à la main"], [n((c) => c.m && c.mode[1] === "imp"), "importés"], [n((c) => c.m && c.mode[1] === "calc"), "calculés"], [n((c) => c.m && c.mode[1] === "chk"), "à vérifier"], [n((c) => c.m && c.mode[1] === "demo"), "exemples"]].filter(([x]) => x);
  const late = n((c) => c.stale);
  const cell = (c) => c.m ? `<td class="cn-c ${c.mode[1]} ${c.stale ? "stale" : ""}" title="${esc(`${c.s.name} · ${c.k.name} : ${osNum(c.m.value)} le ${shortDate(c.m.period)} · ${c.mode[0]} · ${c.m.source || ""}`)}"><b>${esc(c.mode[0])}</b><span>${c.age === 0 ? "aujourd’hui" : `${c.age} j`}</span></td>` : `<td class="cn-c none stale"><b>—</b><span>aucun</span></td>`;
  return `<section class="panel cn-origin"><div class="section-title"><div><h2>D’où viennent les relevés</h2><p class="hint">Dernier relevé de chaque indicateur, par site : son origine et son âge. En orange : plus ancien que la fréquence de l’indicateur.</p></div></div>
    <p class="cn-sum"><b>${jnPlural(total, "relevé attendu", "relevés attendus")}</b>${parts.map(([x, l]) => ` · ${x} ${l}`).join("")} · <b class="${late ? "bad" : "good"}">${late ? `${late} manquant${late > 1 ? "s" : ""} ou ancien${late > 1 ? "s" : ""}` : "tous à jour"}</b></p>
    <div class="cn-scroll"><table class="cn-table"><thead><tr><th scope="col">Site</th>${kpis.map((k) => `<th scope="col" title="${esc(k.name)}">${esc(short(k))}<small>${esc(k.frequency || "")}</small></th>`).join("")}</tr></thead><tbody>${OPERATIONAL_SITES.map((s) => `<tr><th scope="row">${esc(s.name)}</th>${cells.filter((c) => c.s.id === s.id).map(cell).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

/* ---------- Importer un fichier ---------- */

function cnTemplate() {
  const kpis = osActive(data.kpis), rows = [CN_COLS.map((c) => c[0])];
  for (const s of OPERATIONAL_SITES) for (const k of kpis) rows.push([s.id, "", k.code, today(), "", osFinite(k.target) ? String(k.target).replace(".", ",") : "", k.definition || "", ""]);
  return cnCsv(rows);
}
function cnImportBlock() {
  return `<section class="panel section cn-import"><h2>Importer un fichier de relevés</h2>
    <ol class="cn-steps">
      <li><div><b>Le modèle</b><span>Une ligne par site et par indicateur, à la date du jour : il reste à remplir la valeur et la source. Les lignes laissées sans valeur sont ignorées.</span></div><button type="button" class="btn secondary" data-cn-template>Télécharger le modèle</button></li>
      <li><div><b>Le fichier</b><span>Depuis Excel : « Enregistrer sous » CSV UTF-8. Séparateur « ; » ou « , ».</span></div><label class="btn">Choisir le fichier<input type="file" id="cnFile" accept=".csv,text/csv" hidden></label></li>
      <li><div><b>Vérifier, puis confirmer</b><span>Chaque ligne est contrôlée. Rien n’est enregistré tant qu’une ligne est en erreur.</span></div></li>
    </ol><div id="cnResult" aria-live="polite"></div></section>`;
}
function cnCheck(text) {
  const rows = osParseCSV(text), filled = [], lines = [], blank = [];
  rows.forEach((r, i) => { if (String(r.value ?? "").trim()) { filled.push(r); lines.push(i + 2); } else blank.push(i + 2); });
  if (!filled.length) throw Error("Aucune ligne avec une valeur : remplissez la colonne value.");
  const check = osValidateMeasurements(filled);
  return { rows, filled, blank, accepted: check.accepted, errors: check.errors.map((e) => ({ ...e, line: lines[e.line - 2] ?? e.line, row: filled[e.line - 2] })) };
}
function cnShowCheck(res, name) {
  const box = $("cnResult");
  if (!box) return;
  const head = `<p class="cn-res-head"><b>${esc(name)}</b> · ${jnPlural(res.accepted.length, "ligne valide", "lignes valides")} · <span class="${res.errors.length ? "bad" : "good"}">${jnPlural(res.errors.length, "erreur", "erreurs")}</span>${res.blank.length ? ` · ${jnPlural(res.blank.length, "ligne sans valeur ignorée", "lignes sans valeur ignorées")}` : ""}</p>`;
  const errs = res.errors.length ? `<ul class="cn-errs">${res.errors.slice(0, 30).map((e) => `<li><b>Ligne ${e.line}</b> · ${esc(e.message)}${e.row ? ` <small>${esc([e.row.site_id, e.row.code, e.row.period, e.row.value].filter(Boolean).join(" · "))}</small>` : ""}</li>`).join("")}${res.errors.length > 30 ? `<li>… et ${res.errors.length - 30} autres</li>` : ""}</ul><div class="row-actions"><button type="button" class="btn secondary" data-cn-errors>Télécharger les lignes en erreur</button></div><p class="hint">Corrigez le fichier puis choisissez-le à nouveau : aucune ligne n’a été importée.</p>` : "";
  const preview = !res.errors.length ? `<div class="cn-scroll"><table class="cn-prev"><thead><tr><th>Site</th><th>Indicateur</th><th>Date</th><th>Valeur</th><th>État</th></tr></thead><tbody>${res.accepted.slice(0, 40).map((m) => { const k = osKpi(m.kpi_id), st = osStatus(m, k); return `<tr><td>${esc(getSiteName(m.site_id))}${m.workshop_id ? ` · ${esc(m.workshop_id)}` : ""}</td><td>${esc(k?.name || m.code)}</td><td>${shortDate(m.period)}</td><td>${osNum(m.value)}${k?.unit && k.unit !== "nombre" ? ` ${esc(k.unit)}` : ""}</td><td>${pill(osStatusText(st), osStatusTone(st))}</td></tr>`; }).join("")}</tbody></table></div>${res.accepted.length > 40 ? `<p class="hint">… et ${res.accepted.length - 40} autres lignes.</p>` : ""}<div class="form-actions"><button type="button" class="btn jn-big" data-cn-confirm>Confirmer l’import de ${jnPlural(res.accepted.length, "relevé", "relevés")}</button><button type="button" class="btn ghost" data-cn-cancel>Annuler</button></div>` : "";
  box.innerHTML = head + errs + preview;
  box.querySelector("[data-cn-errors]")?.addEventListener("click", () => {
    const cols = Object.keys(res.filled[0] || {});
    cnDownload(cnCsv([[...cols, "erreur"], ...res.errors.map((e) => [...cols.map((c) => e.row?.[c] ?? ""), `Ligne ${e.line} : ${e.message}`])]), `lignes-en-erreur-${today()}.csv`);
  });
  box.querySelector("[data-cn-cancel]")?.addEventListener("click", () => { box.innerHTML = ""; });
  box.querySelector("[data-cn-confirm]")?.addEventListener("click", () => {
    const fresh = osValidateMeasurements(res.filled);
    if (fresh.errors.length) return toast("Les données ont changé depuis la vérification : choisissez le fichier à nouveau.");
    if (!commitData(() => {
      data.measures.push(...fresh.accepted);
      (data.syncLog ||= []).push({ id: uid("SYNC"), at: now(), source: name, accepted: fresh.accepted.length, ignored: res.blank.length, status: "Import validé" });
    })) return;
    render(); toast(`${jnPlural(fresh.accepted.length, "relevé importé", "relevés importés")}.`);
  });
}

/* ---------- Systèmes sources ---------- */

function cnStepIndex(c) { const i = CN_STEPS.findIndex((s) => s[0] === c.status); return i < 0 ? 0 : i; }
function cnCard(c) {
  const i = cnStepIndex(c);
  return `<article class="cn-card" data-search-row><header><div><small>${esc(c.kind && c.kind !== c.name ? c.kind : "Système source")}</small><h3>${esc(c.name)}</h3></div>${osIsAdmin() ? osButton("Modifier", "edit", { key: "connectors", id: c.id }) : ""}</header>
    <ol class="cn-track" aria-label="Étape : ${esc(CN_STEPS[i][1])}">${CN_STEPS.map(([, l], n) => `<li class="${n < i ? "done" : n === i ? "now" : ""}"><span>${esc(l)}</span></li>`).join("")}</ol>
    <dl class="pm-dl"><div><dt>Contact</dt><dd class="${c.owner ? "" : "pm-miss"}">${esc(c.owner || "À nommer")}</dd></div><div><dt>Fréquence</dt><dd>${esc(c.frequency || "—")}</dd></div>${c.endpoint ? `<div><dt>Adresse</dt><dd>${esc(c.endpoint)}</dd></div>` : ""}</dl>
    ${c.mapping ? `<details class="cn-map"><summary>Correspondance des champs</summary><p>${esc(c.mapping)}</p></details>` : ""}
    <div class="row-actions"><button type="button" class="btn secondary" data-cn-sheet="${esc(c.id)}">Fiche de raccordement</button></div></article>`;
}
function cnSystems() {
  const rows = osActive(data.connectors), admin = osIsAdmin();
  const add = admin ? `<div class="row-actions">${rows.some((c) => /sequoia/i.test(c.name)) ? "" : osButton("+ SEQUOIA", "new", { key: "connectors", preset: { name: "SEQUOIA", kind: "SEQUOIA", status: "À spécifier", frequency: "Quotidienne", mapping: "À préciser avec l’informatique : extraction, champs disponibles, périmètre par site." } }, false)}${osButton("+ Autre système", "new", { key: "connectors", preset: { status: "À spécifier" } })}</div>` : "";
  return `<section class="section cn-systems"><div class="section-title"><div><h2>Systèmes sources</h2><p class="hint">Chemin conseillé : fiabiliser la donnée, l’importer par fichier, puis automatiser. Aucune adresse ni mot de passe n’est présumé.</p></div></div>${add}
    ${rows.length ? `<div class="pm-grid">${rows.map(cnCard).join("")}</div>` : empty("Aucun système déclaré. Ajoutez SEQUOIA pour préparer le raccordement avec l’informatique.")}</section>`;
}
function cnSheet(c) {
  const kpis = osActive(data.kpis), ws = osActive(data.workshops), i = cnStepIndex(c);
  const tr = (cells) => `<tr>${cells.map((x) => `<td>${esc(x ?? "")}</td>`).join("")}</tr>`;
  return `<article class="id-sheet cn-sheet"><header><div><small>FICHE DE RACCORDEMENT · CONTRAT D’ENTRÉE V1</small><h3>${esc(c.name)} → BIA Lean OS</h3><p>${esc(c.kind || "")} · étape : ${esc(CN_STEPS[i][1])} · ${shortDate(today())}</p></div></header>
    <h4>Objet</h4><p>Recevoir les relevés des indicateurs de chaque site sans ressaisie. Une ligne par site, indicateur, atelier éventuel et date. L’application contrôle chaque fichier avant de l’enregistrer.</p>
    <dl class="pm-dl"><div><dt>Contact technique</dt><dd>${esc(c.owner || "À nommer")}</dd></div><div><dt>Fréquence</dt><dd>${esc(c.frequency || "À définir")}</dd></div>${c.endpoint ? `<div><dt>Adresse</dt><dd>${esc(c.endpoint)}</dd></div>` : ""}</dl>
    <h4>Colonnes du fichier</h4><table class="cn-t"><thead><tr><th>Colonne</th><th>Obligatoire</th><th>Format</th><th>Exemple fictif</th></tr></thead><tbody>${CN_COLS.map(tr).join("")}</tbody></table>
    <p class="hint">CSV UTF-8, séparateur « ; » ou « , », une ligne d’en-tête avec ces noms de colonnes.</p>
    <h4>Indicateurs attendus</h4><table class="cn-t"><thead><tr><th>code</th><th>Indicateur</th><th>Unité</th><th>Sens</th><th>Fréquence</th><th>Définition et formule</th></tr></thead><tbody>${kpis.map((k) => tr([k.code, k.name, k.unit, k.direction === "high" ? "plus est mieux" : "moins est mieux", k.frequency, [k.definition, k.formula].filter(Boolean).join(" · ")])).join("")}</tbody></table>
    <h4>Codes des sites et ateliers</h4><table class="cn-t"><thead><tr><th>site_id</th><th>Site</th><th>workshop_id</th></tr></thead><tbody>${OPERATIONAL_SITES.map((s) => tr([s.id, s.name, ws.filter((w) => w.site_id === s.id).map((w) => `${w.id} (${w.name})`).join(", ") || "—"])).join("")}</tbody></table>
    <h4>Contrôles à l’import</h4><ul><li>Date au format AAAA-MM-JJ, réelle et pas dans le futur.</li><li>Valeur numérique positive, au plus 100 pour un pourcentage ; cible dans la même unité.</li><li>Site, indicateur et atelier connus ; atelier rattaché au site.</li><li>Pas de doublon site · indicateur · atelier · date, dans le fichier ni avec un relevé existant : rien n’est écrasé.</li><li>Définition du périmètre obligatoire sur chaque ligne.</li><li>Tout ou rien : une seule ligne en erreur et rien n’est enregistré.</li></ul>
    <h4>Sécurité</h4><ul><li>Lecture seule côté ${esc(c.name)} : l’application ne modifie jamais la source.</li><li>Aucun mot de passe ni clé dans l’application ni dans ce document.</li><li>Échange par dépôt de fichier ou HTTPS sur le serveur du Groupe.</li></ul>
    <h4>Étapes</h4><ol>${CN_STEPS.map(([, l], n) => `<li${n === i ? ' class="now"' : ""}>${esc(l)}${["", " : ce document validé par les deux parties", " : un export d’une semaine, importé et vérifié dans l’application", " : dépôt du fichier à la fréquence convenue", " : adaptateur serveur read({ from, to }) au même contrat"][n]}</li>`).join("")}</ol>
    ${c.mapping ? `<h4>Correspondance des champs</h4><p>${esc(c.mapping)}</p>` : ""}
    <footer>${esc(c.id || "")} · contrat d’entrée v1 (connectors/measure.schema.json)</footer></article>`;
}
function cnOpenSheet(id) {
  const c = osActive(data.connectors).find((x) => x.id === id);
  if (!c) return;
  modal("Fiche de raccordement", `${cnSheet(c)}<style media="print">@page{size:A4;margin:12mm}</style><div class="form-actions"><button type="button" class="btn" data-cn-print>Imprimer</button><button type="button" class="btn ghost" data-close-modal>Fermer</button></div>`);
  $("modalContent").querySelector("[data-cn-print]").onclick = () => window.print();
}

/* ---------- Page ---------- */

function cnPage() {
  const pending = (data.syncQueue || []).filter((x) => x.status === "pending"), log = (data.syncLog || []).slice().reverse();
  const logBlock = `<section class="panel section cn-log"><h2>Journal des imports</h2>${log.length ? `<ul class="pm-rows pm-solo-in">${log.slice(0, 20).map((l) => `<li><div class="pm-row-main"><b>${esc(l.source || "Fichier")}</b><span>${shortDate(l.at)} · ${jnPlural(l.accepted || 0, "relevé", "relevés")}${l.ignored ? ` · ${l.ignored} ignorée${l.ignored > 1 ? "s" : ""}` : ""} · ${esc(l.status || "")}</span></div></li>`).join("")}</ul>` : '<p class="hint">Aucun import effectué.</p>'}</section>`;
  const sync = `<details class="panel section cn-sync"><summary>Préparation serveur · file de synchronisation · ${pending.length}</summary><p>${jnPlural(pending.length, "changement local est décrit", "changements locaux sont décrits")} par sa révision, son événement et son dossier. Aucun fichier n’est envoyé automatiquement.</p><button class="btn secondary" type="button" data-export-sync ${pending.length ? "" : "disabled"}>Exporter le paquet de synchronisation</button></details>`;
  return `${pageHead("Administration", "Connecteurs", "D’où viennent les chiffres, et comment les faire arriver sans ressaisie.")}${cnOriginBlock()}${cnImportBlock()}${cnSystems()}${logBlock}${sync}`;
}

/* ---------- Branchements ---------- */

renderOSConnectors = function () { return cnPage(); };

function cnBind(root = document) {
  root.querySelectorAll("[data-cn-template]").forEach((b) => (b.onclick = () => { cnDownload(cnTemplate(), `modele-releves-bia-${today()}.csv`); toast("Modèle téléchargé : remplissez value et source."); }));
  root.querySelectorAll("[data-cn-sheet]").forEach((b) => (b.onclick = () => cnOpenSheet(b.dataset.cnSheet)));
  const file = root.querySelector("#cnFile");
  if (file) file.onchange = async () => {
    const f = file.files?.[0]; file.value = "";
    if (!f) return;
    try {
      if (f.size > 3 * 1024 * 1024) throw Error("Fichier limité à 3 Mo.");
      cnShowCheck(cnCheck(await f.text()), f.name);
    } catch (err) { $("cnResult").innerHTML = `<p class="bad">${esc(err.message)}</p>`; }
  };
}
const cnOsBindBase = osBind;
osBind = function () { const out = cnOsBindBase.apply(this, arguments); cnBind(document); return out; };
