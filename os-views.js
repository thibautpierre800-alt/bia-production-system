"use strict";

const OS_FORMS = {
  objectives: {
    title: "Objectif Hoshin",
    fields: [
      ["title", "Objectif mesurable", "text", true],
      ["site_id", "Périmètre", "site", true],
      ["workshop_id", "Atelier", "workshop"],
      ["level", "Niveau", "Axe stratégique|Groupe|Site|Atelier", true],
      ["parent_id", "Objectif parent", "objectives"],
      ["kpi_id", "KPI de résultat", "kpis"],
      ["target", "Cible chiffrée", "number"],
      ["owner", "Responsable", "text", true],
      ["year", "Année", "number", true],
      ["due_date", "Échéance", "date", true],
      ["description", "Enjeu et contribution attendue", "textarea"],
      ["result", "Résultat constaté", "textarea"],
      ["status", "État", "En cours|Atteint|À réviser", true],
    ],
  },
  kaizens: {
    title: "Idée / Kaizen",
    fields: [
      ["title", "Idée d’amélioration", "text", true],
      ["site_id", "Site", "site", true],
      ["workshop_id", "Atelier", "workshop"],
      ["zone_id", "Zone", "zones"],
      ["owner", "Pilote", "text", true],
      ["kpi_id", "KPI concerné", "kpis"],
      ["source_id", "Observation ou dossier d’origine", "record"],
      ["problem", "Problème observé", "textarea", true],
      ["solution", "Solution et essai", "textarea"],
      ["due_date", "Prochaine échéance", "date"],
      ["status", "Étape", "kaizenStates", true],
      ["result", "Résultat observé / mesure", "textarea"],
      ["validated_by", "Validé par", "text"],
      ["standard_id", "Standard appliqué", "standards"],
      ["before_after_id", "Fiche Avant / Après", "beforeafter"],
    ],
  },
  gains: {
    title: "Mesurer et valider le gain",
    fields: [
      ["title", "Résultat mesuré", "text", true],
      ["site_id", "Site", "site", true],
      ["source_id", "Action / projet / Kaizen", "record", true],
      ["kpi_id", "KPI", "kpis"],
      ["before", "Valeur avant", "number", true],
      ["after", "Valeur après", "number", true],
      [
        "direction",
        "Sens du progrès",
        "low:Moins est mieux|high:Plus est mieux",
        true,
      ],
      ["quantity", "Nombre de répétitions sur la période", "number", true],
      ["unit", "Unité du gain", "€|min|h|kg|pièces|points %", true],
      ["period", "Période couverte", "text", true],
      ["evidence", "Preuve et méthode de mesure", "textarea", true],
      ["validated_by", "Validateur", "text"],
      ["status", "Validation", "À valider|Validé|Refusé", true],
    ],
  },
  deployments: {
    title: "Déployer une bonne pratique",
    fields: [
      ["practice_id", "Bonne pratique", "practices", true],
      ["site_id", "Site destinataire", "site", true],
      ["workshop_id", "Atelier", "workshop"],
      ["owner", "Pilote local", "text", true],
      ["due_date", "Échéance", "date", true],
      ["status", "Étape", "deployStates", true],
      ["prerequisites", "Prérequis et adaptation locale", "textarea", true],
      ["result", "Résultat du test local", "textarea"],
      ["evidence", "Preuve locale / référence document", "textarea"],
      ["validated_by", "Validé par", "text"],
    ],
  },
  maturity: {
    title: "Évaluer la maturité",
    fields: [
      ["site_id", "Site", "site", true],
      ["workshop_id", "Atelier", "workshop"],
      ["pillar", "Pilier", "pillars", true],
      [
        "level",
        "Niveau constaté",
        "1:1 · Initial|2:2 · Défini|3:3 · Appliqué|4:4 · Maîtrisé|5:5 · Amélioré",
        true,
      ],
      ["target", "Niveau cible", "number", true],
      ["date", "Date de l’observation", "date", true],
      ["owner", "Évaluateur", "text", true],
      ["evidence", "Faits et preuves consultées", "textarea", true],
      ["next_step", "Amélioration à engager", "textarea"],
    ],
  },
  routines: {
    title: "Routine de management",
    fields: [
      ["title", "Nom de la routine", "text", true],
      ["site_id", "Périmètre", "site", true],
      ["workshop_id", "Atelier", "workshop"],
      [
        "level",
        "Niveau",
        "1:N1 · Équipe|2:N2 · Atelier|3:N3 · Site|4:N4 · Groupe",
        true,
      ],
      ["frequency", "Fréquence", "Quotidien|Hebdomadaire|Mensuel", true],
      ["owner", "Animateur", "text", true],
      ["date", "Date du point", "date", true],
      ["participants", "Participants", "textarea"],
      ["minutes", "Décisions et compte rendu", "textarea"],
      ["status", "État", "Prévu|Réalisé", true],
    ],
  },
  escalations: {
    title: "Escalade et arbitrage",
    fields: [
      ["title", "Décision attendue", "text", true],
      ["site_id", "Site concerné", "site", true],
      ["source_id", "Action / problème source", "record", true],
      [
        "level",
        "Niveau destinataire",
        "2:N2 · Atelier|3:N3 · Site|4:N4 · Groupe",
        true,
      ],
      ["owner", "Décideur", "text", true],
      ["due_date", "Date de réponse", "date", true],
      ["detail", "Faits et impact", "textarea", true],
      ["result", "Arbitrage rendu", "textarea"],
      ["status", "État", "Ouverte|En cours|Clos", true],
    ],
  },
  sites: {
    title: "Entité",
    fields: [
      ["name", "Nom officiel", "text", true],
      ["kind", "Type", "site:Site opérationnel|group:Holding / Groupe", true],
      ["owner", "Responsable", "text"],
    ],
  },
  workshops: {
    title: "Atelier / service",
    fields: [
      ["name", "Nom", "text", true],
      ["site_id", "Site", "site", true],
      ["owner", "Responsable", "text"],
    ],
  },
  zones: {
    title: "Zone / équipe",
    fields: [
      ["name", "Nom", "text", true],
      ["site_id", "Site", "site", true],
      ["workshop_id", "Atelier", "workshop", true],
      ["owner", "Responsable", "text"],
    ],
  },
  users: {
    title: "Utilisateur / responsable",
    fields: [
      ["name", "Nom", "text", true],
      ["site_id", "Périmètre", "site", true],
      ["role", "Profil local", "roles", true],
      ["email", "Courriel professionnel", "email"],
      ["active", "Statut", "true:Actif|false:Inactif", true],
    ],
  },
  kpis: {
    title: "Dictionnaire KPI",
    fields: [
      ["name", "Nom", "text", true],
      ["code", "Code stable", "text", true],
      ["axis", "Axe SQCDP", "S|Q|C|D|P", true],
      ["definition", "Définition / exclusions", "textarea", true],
      ["unit", "Unité", "text", true],
      ["direction", "Sens", "high:Plus est mieux|low:Moins est mieux", true],
      ["formula", "Formule documentée", "text", true],
      ["source", "Source prévue", "text", true],
      ["frequency", "Fréquence", "Quotidien|Hebdomadaire|Mensuel", true],
      ["owner", "Propriétaire", "text", true],
      ["level", "Niveau", "Équipe|Atelier|Site|Groupe", true],
      ["target", "Cible par défaut", "number", true],
      ["green", "Seuil vert", "number", true],
      ["orange", "Seuil orange", "number", true],
      ["red", "Borne rouge", "number", true],
    ],
  },
  connectors: {
    title: "Configuration d’un connecteur",
    fields: [
      ["name", "Nom du système", "text", true],
      ["kind", "Mode prévu", "CSV|Excel|API|SQL|ERP|MES|SEQUOIA", true],
      ["owner", "Responsable technique", "text", true],
      ["endpoint", "Adresse communiquée par l’éditeur (sans secret)", "text"],
      ["frequency", "Fréquence souhaitée", "text"],
      ["mapping", "Correspondance des champs / contrat", "textarea", true],
      ["status", "État vérifié", "À spécifier|Contrat reçu|Test local", true],
    ],
  },
};
function osButton(label, action, args = {}, secondary = true) {
  return `<button type="button" class="btn ${secondary ? "secondary" : ""}" data-os="${action}" data-args="${esc(JSON.stringify(args))}">${esc(label)}</button>`;
}
function osOptions(type, row = {}, key = "") {
  let options = [];
  if (type === "site")
    options = SITES.filter((s) => osWritable(s.id)).map((s) => [s.id, s.name]);
  else if (type === "workshop")
    options = data.workshops
      .filter((w) => w.site_id === row.site_id && !w.archived_at)
      .map((w) => [w.id, w.name]);
  else if (type === "record")
    options = [...osRecordIndex().values()]
      .filter(
        (x) =>
          ![
            "sites",
            "workshops",
            "zones",
            "users",
            "comments",
            "connectors",
            "auditTemplates",
            "measures",
          ].includes(x.key) &&
          !x.row.archived_at &&
          x.row.id !== row.id &&
          (x.row.site_id === row.site_id || x.row.site_id === "group"),
      )
      .map((x) => [x.row.id, `${x.row.id} · ${osTitle(x.row)}`]);
  else if (type === "standards" || type === "beforeafter")
    options = osActive(data.documents)
      .filter(
        (d) =>
          d.type === (type === "standards" ? "STANDARD" : "BEFORE_AFTER") &&
          d.site_id === row.site_id,
      )
      .map((x) => [x.id, osTitle(x)]);
  else if (type === "roles")
    options = Object.entries(ROLES).map(([id, r]) => [id, r.label]);
  else if (type === "pillars")
    options = data.settings.pillars.map((p) => [p, p]);
  else if (type === "kaizenStates")
    options = OS_KAIZEN_STATES.map((p) => [p, p]);
  else if (type === "deployStates")
    options = OS_DEPLOY_STATES.map((p) => [p, p]);
  else if (OS_COLLECTIONS[type])
    options = osActive(data[type])
      .filter((x) => x.id !== row.id)
      .map((x) => [x.id, osTitle(x)]);
  else
    options = type
      .split("|")
      .map((p) =>
        p.includes(":")
          ? [p.slice(0, p.indexOf(":")), p.slice(p.indexOf(":") + 1)]
          : [p, p],
      );
  return options
    .map(
      ([id, label]) =>
        `<option value="${esc(id)}" ${String(row[key] ?? "") === String(id) ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
}
function osField([key, label, type, required], row) {
  const req = required ? "required" : "",
    value = row[key] ?? "",
    wide = type === "textarea" || ["title", "definition", "name"].includes(key);
  let input;
  if (type === "textarea")
    input = `<textarea name="${key}" rows="3" ${req}>${esc(value)}</textarea>`;
  else if (["text", "number", "date", "email"].includes(type))
    input = `<input name="${key}" type="${type}" ${type === "number" ? 'step="any" min="0"' : ""} value="${esc(value)}" ${req}>`;
  else
    input = `<select name="${key}" ${req}>${!required || !value ? '<option value="">Choisir…</option>' : ""}${osOptions(type, row, key)}</select>`;
  return `<label class="${wide ? "wide" : ""}">${esc(label)}${input}</label>`;
}
function osForm(key, id = null, preset = {}) {
  const schema = OS_FORMS[key];
  if (!schema) return;
  const existing = data[key].find((r) => r.id === id),
    row = {
      site_id: state.site,
      year: new Date().getFullYear(),
      date: today(),
      status:
        key === "kaizens"
          ? "Idée"
          : key === "deployments"
            ? "Candidate"
            : undefined,
      quantity: 1,
      direction: "low",
      ...existing,
      ...preset,
    };
  if (
    row.site_id === "group" &&
    ![
      "objectives",
      "routines",
      "users",
      "kpis",
      "sites",
      "connectors",
    ].includes(key)
  )
    row.site_id = OPERATIONAL_SITES[0]?.id;
  if (!osWritable(row.site_id)) return osReadRecord(key, existing);
  if (
    ["sites", "workshops", "zones", "users", "kpis", "connectors"].includes(
      key,
    ) &&
    !osIsAdmin()
  )
    return toast("Configuration réservée à l’administration Groupe.");
  modal(
    `${id || "Créer"} · ${schema.title}`,
    `<form id="osForm" data-key="${key}">${key === "kaizens" ? '<div class="signal-form-intro"><b>Une idée courte suffit pour commencer.</b><span>Décrivez le problème observé. Le pilote, l’essai et la mesure permettront ensuite de décider si elle devient un standard.</span></div>' : ""}<div class="form-grid ${key === "kaizens" ? "section" : ""}">${schema.fields.map((f) => osField(f, row)).join("")}</div>${key === "gains" ? '<p class="hint">Gain = écart avant/après × répétitions. Les unités et périodes restent séparées ; seule une validation avec preuve entre dans le total.</p>' : ""}${key === "connectors" ? '<p class="hint">Cette configuration documente le raccordement. Aucun accès au système source n’est déclenché.</p>' : ""}<div class="form-actions"><button class="btn">${key === "kaizens" && !id ? "Envoyer l’idée" : "Enregistrer"}</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>${id ? osContext(id) : ""}`,
  );
  const form = $("osForm");
  form.elements.site_id?.addEventListener("change", () => {
    const siteId = form.elements.site_id.value;
    for (const f of schema.fields.filter((f) =>
      ["workshop", "zones", "standards", "beforeafter", "record"].includes(
        f[2],
      ),
    )) {
      form.elements[f[0]].innerHTML =
        '<option value="">Choisir…</option>' +
        osOptions(f[2], { ...row, site_id: siteId }, f[0]);
    }
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const next = { ...existing, ...preset };
    for (const [name, , type] of schema.fields) {
      const value = form.elements[name].value.trim();
      next[name] = type === "number" ? osNumber(value) : value || null;
    }
    next.site_id ||= ["sites", "kpis", "connectors"].includes(key)
      ? "group"
      : row.site_id;
    if (["maturity", "routines", "escalations"].includes(key))
      next.level = Number(next.level);
    if (key === "users") next.active = next.active === "true";
    if (key === "kpis") next.active = true;
    try {
      osCheckForm(key, next, existing);
      let saved;
      if (
        !commitData(() => {
          saved = osUpsert(key, { ...next, id: existing?.id });
        })
      )
        return;
      osInit();
      closeModal();
      state.view = OS_COLLECTIONS[key][1];
      receipt(
        saved.id,
        OS_COLLECTIONS[key][0],
        saved.site_id,
        key === "kaizens"
          ? `${saved.owner} · prochaine étape : ${saved.status}`
          : undefined,
      );
      render();
    } catch (error) {
      toast(error.message);
    }
  };
}
function osCheckForm(key, row, old) {
  if (!osWritable(row.site_id)) throw Error("Périmètre non autorisé.");
  if (
    row.workshop_id &&
    !data.workshops.some(
      (w) => w.id === row.workshop_id && w.site_id === row.site_id,
    )
  )
    throw Error("L’atelier doit appartenir au site.");
  if (key === "kpis") {
    if (
      !/^[a-z0-9_-]+$/i.test(row.code) ||
      data.kpis.some((k) => k.code === row.code && k.id !== old?.id)
    )
      throw Error("Code KPI invalide ou déjà utilisé.");
    if (
      old &&
      old.code !== row.code &&
      data.measures.some((m) => m.kpi_id === old.id)
    )
      throw Error("Conservez le code d’un KPI déjà mesuré.");
    if (
      row.direction === "high"
        ? !(row.red <= row.orange && row.orange <= row.green)
        : !(row.green <= row.orange && row.orange <= row.red)
    )
      throw Error("Les seuils doivent suivre le sens du KPI.");
  }
  if (
    key === "maturity" &&
    (row.level < 1 ||
      row.level > 5 ||
      row.target < 1 ||
      row.target > 5 ||
      !Number.isInteger(row.target) ||
      row.date > today())
  )
    throw Error("Niveaux de 1 à 5 et date passée ou du jour requis.");
  if (key === "objectives") {
    const p = data.objectives.find((o) => o.id === row.parent_id),
      ranks = { "Axe stratégique": 0, Groupe: 1, Site: 2, Atelier: 3 };
    if (p && ranks[p.level] >= ranks[row.level])
      throw Error("Le parent doit être d’un niveau stratégique supérieur.");
    if (
      ["Groupe", "Axe stratégique"].includes(row.level) &&
      row.site_id !== "group"
    )
      throw Error("Un axe / objectif Groupe appartient à BIA Holding.");
    if (["Site", "Atelier"].includes(row.level) && row.site_id === "group")
      throw Error("Choisissez le site concerné par cet objectif.");
    if (row.level === "Atelier" && !row.workshop_id)
      throw Error("Choisissez l’atelier concerné par cet objectif.");
    if (row.status === "Atteint" && !row.result)
      throw Error(
        "Renseignez le résultat avant de déclarer l’objectif atteint.",
      );
  }
  if (key === "gains") {
    if (row.quantity <= 0)
      throw Error("Le nombre de répétitions doit être positif.");
    if (
      row.status === "Validé" &&
      (!row.evidence || !row.validated_by || !osManager())
    )
      throw Error("Un manager doit valider le gain avec une preuve.");
    if (
      data.gains.some(
        (g) =>
          !g.archived_at &&
          g.id !== old?.id &&
          g.source_id === row.source_id &&
          g.unit === row.unit &&
          g.period === row.period,
      )
    )
      throw Error(
        "Un gain existe déjà pour cette source, unité et période : modifiez-le pour éviter un double comptage.",
      );
  }
  if (key === "kaizens") {
    const stage = OS_KAIZEN_STATES.indexOf(row.status);
    if (stage >= 2 && !row.solution)
      throw Error("Décrivez la solution avant validation.");
    if (stage >= 3 && !row.validated_by)
      throw Error("Indiquez qui a validé l’essai.");
    if (
      stage >= 5 &&
      (!row.result ||
        !data.gains.some(
          (g) => g.source_id === old?.id && g.status === "Validé",
        ))
    )
      throw Error("Mesurez le résultat puis faites valider un gain lié.");
    if (stage >= 6 && !row.standard_id)
      throw Error("Reliez le standard mis à jour.");
    if (
      stage >= 7 &&
      !data.practices.some(
        (p) => p.source_id === old?.id && p.status === "Publiée",
      )
    )
      throw Error("Une bonne pratique validée doit être reliée au Kaizen.");
    if (
      stage >= 8 &&
      !data.deployments.some(
        (d) =>
          data.practices.some(
            (p) => p.id === d.practice_id && p.source_id === old?.id,
          ) && d.status === "Déployée",
      )
    )
      throw Error("Terminez un déploiement sur un autre site.");
  }
  if (key === "deployments") {
    const p = data.practices.find((p) => p.id === row.practice_id);
    if (!p || !["Publiée", "Validée", "Déployée"].includes(p.status))
      throw Error("La bonne pratique doit être validée avant transfert.");
    if (p.site_id === row.site_id)
      throw Error("Choisissez un autre site que le site d’origine.");
    if (
      data.deployments.some(
        (d) =>
          !d.archived_at &&
          d.id !== old?.id &&
          d.practice_id === row.practice_id &&
          d.site_id === row.site_id,
      )
    )
      throw Error("Un déploiement existe déjà pour cette pratique et ce site.");
    if (
      ["Validée sur autre site", "Déployée"].includes(row.status) &&
      (!row.result || !row.evidence || !row.validated_by)
    )
      throw Error("Résultat du test, preuve et validateur sont requis.");
    if (
      row.status === "Déployée" &&
      old &&
      linkedActions(old.id).some(isOpenAction)
    )
      throw Error(
        "Vérifiez les actions locales avant de déclarer le déploiement terminé.",
      );
  }
  if (key === "escalations" && row.status === "Clos" && !row.result)
    throw Error("Renseignez l’arbitrage rendu.");
  if (
    key === "routines" &&
    row.status === "Réalisé" &&
    (!row.minutes || !row.participants)
  )
    throw Error("Renseignez les participants et les décisions prises.");
}
function osReadRecord(key, row) {
  if (!row) return;
  modal(
    `${row.id} · ${osTitle(row)}`,
    `<dl class="os-details">${(OS_FORMS[key]?.fields || []).map(([k, label]) => `<dt>${esc(label)}</dt><dd>${esc(row[k] ?? "—")}</dd>`).join("")}</dl>${osContext(row.id)}`,
  );
}
function osOpen(key, row) {
  if (key === "measures") return osMeasureForm(row.id);
  if (key === "auditTemplates") return osQuestionnaireForm(row.id);
  if (key === "comments") return osOpenTrace(row.source_id);
  osForm(key, row.id);
}
function osContext(id) {
  const info = osRecord(id);
  if (!info) return "";
  const links = osRelations(id).filter((x) =>
      allowedSite(x.row.site_id || "group"),
    ),
    comments = data.comments.filter((c) => c.source_id === id),
    editable = osWritable(info.row.site_id || "group");
  return `<section class="os-context section"><h3>Ce dossier dans le système</h3><div class="os-related">${links.map((r) => `<div><span>${esc(r.label)}</span>${recordLink(r.row.id, osTitle(r.row))}</div>`).join("") || '<p class="hint">Aucun autre dossier relié pour le moment.</p>'}</div><div class="row-actions section">${editable ? osButton("Relier un dossier", "link", { id }) + osButton("Créer une suite", "follow", { id }) : ""}${osButton("Voir la traçabilité", "trace", { id })}${editable ? osButton("Ajouter un commentaire", "comment", { id }) : ""}${editable && !info.row.archived_at ? osButton("Archiver", "archive", { id }) : info.row.archived_at ? osButton("Restaurer", "unarchive", { id }) : ""}</div>${comments.length ? `<details><summary>${comments.length} commentaire(s)</summary>${comments.map((c) => `<p><b>${esc(c.author)}</b> · ${shortDate(c.created_at)}<br>${esc(c.text)}</p>`).join("")}</details>` : ""}</section>`;
}
function osFollowForm(id) {
  if (!requestCloseModal()) return;
  const info = osRecord(id);
  if (!info || !osWritable(info.row.site_id)) return;
  modal(
    "Créer la suite de ce dossier",
    `<h3>${esc(osTitle(info.row))}</h3><p>La nouvelle fiche conservera le lien avec ${esc(id)}.</p><div class="os-launch-grid">${[
      ["action", "Action"],
      ["problem", "Problème / A3 / DMAIC"],
      ["kaizens", "Kaizen"],
      ["projects", "Projet"],
      ["gains", "Mesurer un gain"],
      ["practice", "Bonne pratique"],
      ["audit", "Audit"],
      ["beforeafter", "Avant / Après"],
      ["standard", "Standard"],
    ]
      .map(([kind, label]) => osButton(label, "createFrom", { id, kind }))
      .join("")}</div>`,
  );
}
function osCreateFrom(id, kind) {
  const info = osRecord(id);
  if (!info) return;
  const source = info.row,
    preset = {
      site_id: source.site_id,
      workshop_id: source.workshop_id || null,
      source_id: id,
      kpi_id: source.kpi_id || (info.key === "kpis" ? source.id : null),
      owner: source.owner || "",
      title: osTitle(source),
    };
  if (!requestCloseModal()) return;
  if (kind === "action")
    return actionForm(null, {
      ...preset,
      origin_id: id,
      origin_type: OS_COLLECTIONS[info.key][0],
      description: source.description || source.problem || source.finding || "",
    });
  if (kind === "problem")
    return genericProblemForm({
      ...preset,
      origin_id: id,
      description: source.description || source.problem || osTitle(source),
    });
  if (kind === "projects")
    return projectForm(null, { ...preset, origin_id: id });
  if (kind === "practice")
    return practiceForm(null, {
      ...preset,
      summary: source.solution || "",
      evidence: source.result || "",
    });
  if (kind === "audit") return osAuditStart({ ...preset });
  if (kind === "beforeafter")
    return beforeAfterForm(null, {
      ...preset,
      kaizen_id: info.key === "kaizens" ? id : null,
    });
  if (kind === "standard") {
    let doc;
    if (
      !commitData(() => {
        doc = {
          id: uid("DOC"),
          site_id: source.site_id,
          type: "STANDARD",
          title: `Standard · ${osTitle(source)}`,
          source_id: id,
          kpi_id: source.kpi_id || null,
          owner: source.owner || "",
          status: "Brouillon",
          structured_data: {},
          version: 1,
          created_at: now(),
        };
        data.documents.push(doc);
      })
    )
      return;
    return editDocument(doc.id);
  }
  if (kind === "gains") preset.title = `Gain · ${osTitle(source)}`;
  osForm(kind, null, preset);
}
function osLinkForm(id) {
  if (!requestCloseModal()) return;
  const info = osRecord(id);
  if (!info) return;
  modal(
    `Relier ${id}`,
    `<form id="osLinkForm"><label class="field">Dossier existant<select name="to" required><option value="">Choisir…</option>${osOptions("record", info.row)}</select></label><label class="field">Relation<select name="type"><option>Contribue à</option><option>Mesure</option><option>Traite</option><option>Standardise</option><option>Déploie</option></select></label><div class="form-actions"><button class="btn">Relier</button></div></form><p class="hint">Chaque fiche reste unique ; ce lien permet de circuler dans les deux sens.</p>`,
  );
  $("osLinkForm").onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      if (
        !commitData(() =>
          osLink(id, f.elements.to.value, f.elements.type.value),
        )
      )
        return;
      closeModal();
      render();
      openRecord(id);
    } catch (err) {
      toast(err.message);
    }
  };
}
function osOpenTrace(id) {
  if (!requestCloseModal()) return;
  const r = osRecord(id);
  if (!r) return;
  const seen = new Set([id]),
    levels = [[r]];
  for (let level = 0; level < 3; level++) {
    const next = [];
    for (const n of levels[level])
      for (const rel of osRelations(n.row.id)) {
        if (!seen.has(rel.row.id) && allowedSite(rel.row.site_id || "group")) {
          seen.add(rel.row.id);
          next.push(rel);
        }
      }
    if (!next.length) break;
    levels.push(next);
  }
  modal(
    `${id} · Traçabilité`,
    `<h3>${esc(osTitle(r.row))}</h3><p class="hint">Liens enregistrés dans les données. Une proximité ne prouve pas une cause.</p><div class="os-trace">${levels.map((nodes, i) => `<section><h4>${i ? `Liens de niveau ${i}` : "Dossier observé"}</h4>${nodes.map((n) => `<article class="panel">${pill(OS_COLLECTIONS[n.key][0])}<p>${esc(osTitle(n.row))}</p>${recordLink(n.row.id, "Ouvrir")}</article>`).join("")}</section>`).join("")}</div><h3 class="section">Journal du dossier</h3>${osActivityList(data.activity.filter((e) => e.record_id === id))}`,
  );
}
function osCommentForm(id) {
  if (!requestCloseModal()) return;
  modal(
    "Commenter le dossier",
    `<form id="osComment"><label class="field">Commentaire<textarea name="text" required rows="4"></textarea></label><div class="form-actions"><button class="btn">Enregistrer</button></div></form>`,
  );
  $("osComment").onsubmit = (e) => {
    e.preventDefault();
    const text = e.currentTarget.elements.text.value.trim();
    if (!text) return;
    if (
      !commitData(() =>
        osUpsert("comments", {
          source_id: id,
          site_id: osRecord(id).row.site_id,
          author: osActor(),
          text,
        }),
      )
    )
      return;
    closeModal();
    render();
    openRecord(id);
  };
}
function osCards(key, rows, extra = null) {
  return `<div class="os-cards">${rows.map((r) => `<article class="panel" data-search-row><div class="row-top">${pill(r.status || r.level || OS_COLLECTIONS[key][0])}<span class="hint">${esc(r.id)}</span></div><h3>${esc(osTitle(r))}</h3><p>${esc(r.problem || r.description || r.result || r.evidence || r.detail || "")}</p><p class="hint">${esc(getSiteName(r.site_id))} · ${esc(r.owner || "")} ${r.due_date ? `· ${shortDate(r.due_date)}` : ""}</p>${extra ? extra(r) : ""}<div class="row-actions">${recordLink(r.id, "Ouvrir")}${osButton("Parcours lié", "trace", { id: r.id })}</div></article>`).join("") || empty("Aucune fiche sur ce périmètre. Créez la première à partir d’un fait terrain.")}</div>`;
}
function osMetric(label, value, detail = "") {
  return `<article class="os-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
}
function osSpark(rows, k) {
  const values = rows.map((r) => r.value);
  if (values.length < 2)
    return '<span class="hint">Historique insuffisant</span>';
  const min = Math.min(...values),
    max = Math.max(...values),
    points = values
      .map(
        (v, i) =>
          `${4 + (i * 92) / (values.length - 1)},${29 - ((v - min) * 24) / (max - min || 1)}`,
      )
      .join(" ");
  return `<svg viewBox="0 0 100 34" class="os-spark" role="img" aria-label="${esc(k.name)} : ${esc(values.join(", "))}"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
function osTowerRows(sites,period){
  const order={gap:0,warn:1,qualify:2,missing:3,ok:4};
  return sites.flatMap(s=>osActive(data.kpis).map(k=>{const measure=osLatest(s.id,k.id,period,state.workshop),status=osStatus(measure,k),trend=osKpiTrend(s.id,k.id,state.workshop,period),linked=[...osRecordIndex().values()].filter(x=>x.row.site_id===s.id&&!x.row.archived_at&&x.row.kpi_id===k.id&&!["measures","kpis"].includes(x.key));return {site:s,k,measure,status,trend,linked,gap:osNormalizedGap(measure,k)}})).sort((a,b)=>order[a.status]-order[b.status]||Math.abs(b.gap||0)-Math.abs(a.gap||0));
}
function renderOSTower() {
  const sites = OPERATIONAL_SITES.filter(
      (s) => state.site === "group" || s.id === state.site,
    ),
    actions = osScope(data.actions),
    problems = osScope(data.problems),
    suggestions = osSuggestions(),
    period = state.osPeriod || today(),
    rows=osTowerRows(sites,period),
    priorities=rows.filter(r=>r.status!=="ok").slice(0,12);
  return `${pageHead("Pilotage · Control Tower", state.site === "group" ? "Analyser les écarts multisites" : `Analyser ${site().name}`, "Tendances, écarts normalisés et dossiers liés : ici on analyse ; le SQCDP reste l’écran de réaction quotidienne.", osWritable(state.site) ? osButton("Saisir un KPI", "measure", {}, false) : "")}<div class="os-purpose-strip"><div><b>Control Tower</b><span>Comprendre tendances, écarts et liens</span></div><div><b>SQCDP</b><span>Réagir, décider et escalader</span></div>${osButton("Ouvrir le SQCDP", "nav", {view:"sqcdp"}, false)}</div><div class="os-toolbar"><label>Analyser la situation au<input id="osPeriod" type="date" value="${esc(period)}"></label><span>${sites.length} site(s) opérationnel(s) · ${data.meta.demo ? "Démonstration fictive" : "Données saisies"}</span></div><div class="os-metrics">${osMetric("KPI hors cible", rows.filter(r=>r.status==="gap").length)}${osMetric("À surveiller", rows.filter(r=>r.status==="warn").length)}${osMetric("Actions en retard", actions.filter(isLate).length)}${osMetric("Problèmes ouverts", problems.filter((p) => p.status !== "Clos").length)}${osMetric("Alertes critiques", osScope(data.signals).filter((s) => s.severity === "Critique" && isOpenSignal(s)).length)}</div><section class="panel section"><div class="section-title"><div><h2>Écarts à analyser</h2><p class="hint">Classés par criticité et écart normalisé à la cible. Une proximité ne prouve pas une causalité.</p></div>${osButton("Benchmark et historique", "pilotDetail")}</div><div class="table-wrap"><table class="data-table control-analysis-table"><thead><tr><th>Site</th><th>Indicateur</th><th>Valeur / cible</th><th>État</th><th>Tendance</th><th>Dossiers liés</th><th></th></tr></thead><tbody>${priorities.map(r=>`<tr><td><b>${esc(r.site.name)}</b></td><td>${esc(r.k.axis)} · ${esc(r.k.name)}</td><td><b>${osNum(r.measure?.value)} ${esc(r.k.unit)}</b><br><small>cible ${osNum(r.measure?.target??r.k.target)} · ${r.measure?shortDate(r.measure.period):"aucun relevé"}</small></td><td>${pill(osStatusText(r.status),r.status==="gap"?"open":r.status==="warn"?"progress":"neutral")}${Number.isFinite(r.gap)?`<small class="normalized-gap">${osNum(Math.abs(r.gap))} % ${r.gap>=0?"favorable":"défavorable"}</small>`:""}</td><td>${osSpark(r.trend.rows.slice(-6),r.k)}</td><td>${r.linked.length}</td><td>${osButton("Analyser", "kpiDetail", {siteId:r.site.id,kpiId:r.k.id,period})}</td></tr>`).join("")||'<tr><td colspan="7">Tous les indicateurs qualifiés sont dans leur zone attendue à cette date.</td></tr>'}</tbody></table></div></section><section class="section"><div class="section-title"><h2>Rapprochements utiles</h2>${osButton("Analyser les liens", "nav", { view: "analysis" })}</div>${osSuggestionCards(suggestions.slice(0, 6))}</section><section class="panel section"><h2>Gains vérifiés</h2><div class="os-metrics">${
    Object.entries(osValidatedGains(osScope(data.gains)))
      .map(([unit, v]) => osMetric(unit, osNum(v)))
      .join("") || "<p>Aucun gain encore validé sur ce périmètre.</p>"
  }</div></section>`;
}
function osSuggestionCards(rows) {
  return `<div class="os-cards">${rows.map((s) => `<article class="panel"><span class="eyebrow">Suggestion à examiner</span><h3>${esc(s.title)}</h3><p>${esc(s.detail)}</p><div class="row-actions">${osButton("Comprendre l’écart", "kpiDetail", { siteId: s.site_id, kpiId: s.kpi_id })}</div>${s.practices.length ? `<h4>Résultat validé sur un autre site</h4>${s.practices.map((id) => recordLink(id, osTitle(osRecord(id)?.row))).join("")}` : '<p class="hint">Aucune bonne pratique validée reliée à ce KPI sur un autre site.</p>'}</article>`).join("") || empty("Pas de dérive démontrée par les relevés qualifiés disponibles.")}</div>`;
}
function osKpiDetail(siteId, kpiId, period = null) {
  const k = osKpi(kpiId),
    rows = osKpiMeasures(siteId, kpiId, state.workshop).filter(
      (m) => !period || m.period <= period,
    ),
    m = osLatest(siteId, kpiId, period, state.workshop),
    t = osKpiTrend(siteId, kpiId, state.workshop, period),
    related = [...osRecordIndex().values()].filter(
      (x) =>
        x.row.site_id === siteId &&
        (x.row.kpi_id === kpiId ||
          data.links.some((l) => l.from === x.row.id && l.to === kpiId)) &&
        x.key !== "measures" &&
        !x.row.archived_at,
    );
  if (!k) return;
  modal(
    `${k.name} · ${getSiteName(siteId)}`,
    `<div class="os-metrics">${osMetric(osStatusText(osStatus(m, k)), `${osNum(m?.value)} ${k.unit}`, m ? shortDate(m.period) : "Aucune mesure")}${osMetric("Cible", osNum(m?.target ?? k.target))}${osMetric("Écart normalisé (% cible)", osNum(osNormalizedGap(m, k)), "Positif = favorable ; cible non nulle.")}${osMetric("Relevés consécutifs hors cible", t.count, t.since ? `Depuis ${shortDate(t.since)}` : "")}</div><p>${esc(k.definition)}</p><p class="hint">${esc(k.formula)} · ${esc(k.owner)} · ${esc(k.frequency)}</p>${lineChart({ values: rows.map((x) => x.value), labels: rows.map((x) => x.period), target: m?.target ?? k.target }, k.name, k.unit)}<div class="row-actions">${osWritable(siteId) ? osButton("Corriger / saisir le relevé", "measure", { id: m?.id, siteId, kpiId }) + osButton("Ouvrir un problème", "kpiProblem", { siteId, kpiId, measureId: m?.id }) : ""}${osButton("Voir les liens du KPI", "trace", { id: k.id })}</div><h3 class="section">Dossiers liés sur ce site</h3>${related.map((x) => `<p>${pill(OS_COLLECTIONS[x.key][0])} ${recordLink(x.row.id, osTitle(x.row))}</p>`).join("") || empty("Aucun dossier relié à cet indicateur.")}<h3 class="section">Source des mesures</h3><div class="os-measure-list">${rows
      .slice(-12)
      .reverse()
      .map(
        (r) =>
          `<div><b>${shortDate(r.period)} · ${osNum(r.value)} ${esc(k.unit)}</b><span>${esc(r.entry_mode)} · ${esc(r.source)}</span>${osWritable(siteId) ? osButton("Modifier", "measure", { id: r.id }) : ""}</div>`,
      )
      .join("")}</div>`,
  );
}
function osMeasureForm(id = null, preset = {}) {
  const old = data.measures.find((m) => m.id === id),
    row = {
      site_id: state.site === "group" ? OPERATIONAL_SITES[0].id : state.site,
      period: today(),
      ...preset,
      ...old,
    };
  if (preset.siteId) row.site_id = preset.siteId;
  if (preset.kpiId) row.kpi_id = preset.kpiId;
  if (!osWritable(row.site_id)) return;
  modal(
    `${id || "Nouvelle mesure"} · KPI`,
    `<form id="osMeasure"><div class="form-grid">${[
      ["site_id", "Site", "site", true],
      ["workshop_id", "Atelier (vide = site)", "workshop"],
      ["kpi_id", "Indicateur", "kpis", true],
      ["period", "Date", "date", true],
      ["value", "Valeur", "number", true],
      ["target", "Cible locale (vide = dictionnaire)", "number"],
      ["definition", "Périmètre réellement mesuré", "textarea", true],
      ["source", "Source / preuve de la mesure", "text", true],
    ]
      .map((f) => osField(f, row))
      .join(
        "",
      )}</div><p class="hint">Une mesure unique par site, atelier, indicateur et date. Une correction conserve son historique.</p><div class="form-actions"><button class="btn">Enregistrer le relevé</button></div></form>`,
  );
  $("osMeasure").elements.site_id.onchange = (e) => {
    $("osMeasure").elements.workshop_id.innerHTML =
      '<option value="">Tout le site</option>' +
      osOptions("workshop", { site_id: e.target.value });
  };
  $("osMeasure").onsubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const checked = osValidateMeasurements([values], "manual");
    if (checked.errors.length) return toast(checked.errors[0].message);
    const m = checked.accepted[0];
    if (id && m.id !== id && data.measures.some((x) => x.id === m.id))
      return toast("Une mesure existe déjà à cette date et sur ce périmètre.");
    m.id = id || m.id;
    if (!commitData(() => osUpsert("measures", m))) return;
    closeModal();
    render();
    toast("Relevé enregistré et vues de pilotage actualisées.");
  };
}
function renderOSAnalysis() {
  const suggestions = osSuggestions(),
    missing = osIntegrity().filter((i) =>
      allowedSite(osRecord(i.record_id)?.row.site_id || "group"),
    ),
    late = osScope(data.actions).filter(isLate);
  return `${pageHead("Pilotage", "Comprendre les écarts", "Des rapprochements fondés sur les relevés et les liens saisis ; chaque proposition reste à valider.")}<div class="os-metrics">${osMetric("Dérives documentées", suggestions.length)}${osMetric("Actions en retard", late.length)}${osMetric("Liens historiques à qualifier", missing.length)}</div>${osSuggestionCards(suggestions)}<section class="section"><h2>Retards à examiner</h2>${osCards("actions", late.slice(0, 12))}</section>${missing.length ? `<details class="panel section"><summary>Relations héritées à qualifier</summary>${missing.map((x) => `<p>${esc(x.record_id)} · ${esc(x.message)} ${recordLink(x.record_id, "Corriger")}</p>`).join("")}</details>` : ""}`;
}
function osHandoverRows(){
  return osScope(data.handovers).slice().sort((a,b)=>String(b.period||b.created_at).localeCompare(String(a.period||a.created_at)));
}
function handoverStatusTone(status){return status==="Reprise"?"done":status==="Transmise"?"progress":"neutral"}
function handoverCard(handover){
  const linkLabels={signals:"Signal",actions:"Action",problems:"Problème"},links=(handover.linked_ids||[]).map(id=>recordLink(id,linkLabels[recordMeta(id)?.key]||"Dossier")).filter(Boolean).join(""),canEdit=osManager()&&osWritable(handover.site_id),canAcknowledge=canEdit&&handover.status==="Transmise";
  return `<article class="panel handover-card ${handover.status==="Transmise"?"waiting":""}"><div class="row-top"><div><p class="eyebrow">${esc(handover.id)} · ${esc(getSiteName(handover.site_id))}</p><h3>${esc(handover.shift_from)} → ${esc(handover.shift_to)}</h3></div>${pill(handover.status,handoverStatusTone(handover.status))}</div><p class="handover-summary">${esc(handover.situation||"Situation générale à compléter")}</p><div class="handover-facts"><div><span>Sécurité / qualité</span><b>${esc([handover.safety,handover.quality].filter(Boolean).join(" · ")||"Aucun point transmis")}</b></div><div><span>Priorités de l’équipe entrante</span><b>${esc(handover.priorities||"À préciser")}</b></div><div><span>Effectif / contraintes</span><b>${esc(handover.staffing||"Non renseigné")}</b></div></div><p class="hint">${shortDate(handover.period)} · transmis par ${esc(handover.author||"—")}${handover.acknowledged_by?` · repris par ${esc(handover.acknowledged_by)} le ${shortDate(handover.acknowledged_at)}`:""}</p>${links?`<div class="row-actions handover-links">${links}</div>`:""}<div class="row-actions">${canEdit?`<button class="btn secondary small" type="button" data-edit-handover="${esc(handover.id)}">Modifier</button>`:""}${canAcknowledge?`<button class="btn small" type="button" data-ack-handover="${esc(handover.id)}">Confirmer la reprise</button>`:""}</div></article>`;
}
function handoverForm(existing=null){
  if(!osManager())return toast("La relève est préparée par un responsable d’équipe ou de site.");
  const selectedSite=existing?.site_id||(state.site==="group"?OPERATIONAL_SITES[0].id:state.site),selectedWorkshop=existing?.workshop_id||state.workshop||"",shifts=data.settings.shifts||["Matin","Après-midi","Nuit"],selectedLinks=new Set(existing?.linked_ids||[]),localNow=()=>{const d=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return d.toISOString().slice(0,16)};
  modal(existing?`Modifier la relève · ${existing.id}`:"Préparer le passage d’équipe",`<form id="handoverForm"><div class="handover-form-intro"><b>Transmettre les faits utiles, pas refaire le SQCDP.</b><span>Les signaux et actions restent suivis dans leur dossier d’origine.</span></div><div class="form-grid section"><label>Site<select id="handoverSite" ${canGroup()?"":"disabled"}>${siteOptions(selectedSite)}</select></label><label>Atelier<select id="handoverWorkshop"></select></label><label>Équipe sortante<select id="handoverFrom">${shifts.map(name=>`<option ${name===(existing?.shift_from||shifts[0])?"selected":""}>${esc(name)}</option>`).join("")}</select></label><label>Équipe entrante<select id="handoverTo">${shifts.map((name,index)=>`<option ${name===(existing?.shift_to||shifts[Math.min(1,shifts.length-1)])?"selected":""}>${esc(name)}</option>`).join("")}</select></label><label>Date et heure<input id="handoverPeriod" type="datetime-local" required value="${esc((existing?.period||localNow()).slice(0,16))}"></label><label>Auteur<input id="handoverAuthor" required value="${esc(existing?.author||osActor())}"></label><label>Statut<select id="handoverStatus"><option ${existing?.status==="Brouillon"||!existing?"selected":""}>Brouillon</option><option ${existing?.status==="Transmise"?"selected":""}>Transmise</option>${existing?.status==="Reprise"?'<option selected>Reprise</option>':""}</select></label><label class="wide">Situation générale<textarea id="handoverSituation" rows="3" placeholder="Production, événements et état du poste">${esc(existing?.situation||"")}</textarea></label><label>Sécurité<textarea id="handoverSafety" rows="2" placeholder="Risque, consignation, vigilance…">${esc(existing?.safety||"")}</textarea></label><label>Qualité<textarea id="handoverQuality" rows="2" placeholder="Lots, contrôles, défauts…">${esc(existing?.quality||"")}</textarea></label><label>Effectif et contraintes<textarea id="handoverStaffing" rows="2">${esc(existing?.staffing||"")}</textarea></label><label>Production / maintenance<textarea id="handoverProduction" rows="2">${esc(existing?.production||"")}</textarea></label><label class="wide">Trois priorités maximum pour l’équipe entrante<textarea id="handoverPriorities" rows="3">${esc(existing?.priorities||"")}</textarea></label></div><fieldset class="verification-box section"><legend>Dossiers à transmettre</legend><p class="hint">Cochez uniquement les sujets qui demandent une continuité entre les équipes.</p><div id="handoverLinks" class="handover-link-options"></div></fieldset><div class="form-actions"><button class="btn">Enregistrer la relève</button><button type="button" class="btn secondary" data-close-modal>Annuler</button></div></form>`);
  const refreshWorkshops=()=>{const select=$("handoverWorkshop"),siteId=$("handoverSite").value,rows=data.workshops.filter(w=>w.site_id===siteId&&!w.archived_at);select.innerHTML='<option value="">Tous les ateliers</option>'+rows.map(w=>`<option value="${esc(w.id)}" ${w.id===selectedWorkshop?"selected":""}>${esc(w.name)}</option>`).join("");refreshLinks();};
  const refreshLinks=()=>{const siteId=$("handoverSite").value,workshopId=$("handoverWorkshop")?.value||"",items=[...data.signals.filter(s=>s.site_id===siteId&&isOpenSignal(s)&&(!workshopId||!s.workshop_id||s.workshop_id===workshopId)).map(s=>({id:s.id,label:`Signal · ${s.description}`,meta:`${s.severity} · ${s.state}`})),...data.actions.filter(a=>a.site_id===siteId&&isOpenAction(a)&&(!workshopId||!a.workshop_id||a.workshop_id===workshopId)).map(a=>({id:a.id,label:`Action · ${a.title}`,meta:`${a.owner} · ${a.status}`}))].slice(0,16);$("handoverLinks").innerHTML=items.map(item=>`<label class="handover-link-option"><input type="checkbox" value="${esc(item.id)}" ${selectedLinks.has(item.id)?"checked":""}><span><b>${esc(item.label)}</b><small>${esc(item.meta)}</small></span></label>`).join("")||'<p>Aucun signal ou action ouvert sur ce périmètre.</p>';};
  $("handoverSite").onchange=refreshWorkshops;$("handoverWorkshop").onchange=refreshLinks;refreshWorkshops();
  $("handoverForm").onsubmit=e=>{e.preventDefault();const status=$("handoverStatus").value,situation=$("handoverSituation").value.trim(),priorities=$("handoverPriorities").value.trim(),siteId=$("handoverSite").value,workshopId=$("handoverWorkshop").value||null;if($("handoverFrom").value===$("handoverTo").value)return toast("Choisissez deux équipes différentes.");if(status!=="Brouillon"&&(!situation||!priorities))return toast("Une relève transmise exige une situation et les priorités de l’équipe entrante.");const payload={...existing,id:existing?.id||nextId("REL",data.handovers),site_id:siteId,workshop_id:workshopId,title:`Relève ${$("handoverFrom").value} → ${$("handoverTo").value}`,shift_from:$("handoverFrom").value,shift_to:$("handoverTo").value,period:$("handoverPeriod").value,author:$("handoverAuthor").value.trim(),status,situation,safety:$("handoverSafety").value.trim(),quality:$("handoverQuality").value.trim(),staffing:$("handoverStaffing").value.trim(),production:$("handoverProduction").value.trim(),priorities,linked_ids:[...document.querySelectorAll('#handoverLinks input:checked')].map(input=>input.value),acknowledged_by:status==="Reprise"?existing?.acknowledged_by||osActor():null,acknowledged_at:status==="Reprise"?existing?.acknowledged_at||now():null,created_at:existing?.created_at||now(),updated_at:now()};if(!payload.author||!osWritable(siteId))return toast("Précisez l’auteur et un site autorisé.");if(!commitData(()=>{const row=osUpsert("handovers",payload);recordHistory(row,status,existing?"Relève mise à jour":"Relève créée");}))return;closeModal();state.site=siteId;state.workshop=workshopId||"";state.view="daily";receipt(payload.id,"Management quotidien → Relève",siteId,status);render();};
}
function acknowledgeHandover(id){
  const row=data.handovers.find(h=>h.id===id);if(!row||!osManager()||!osWritable(row.site_id))return;
  if(!commitData(()=>{row.status="Reprise";row.acknowledged_by=osActor();row.acknowledged_at=now();recordHistory(row,"Reprise",`Relève reprise par ${row.acknowledged_by}`);} ))return;
  render();toast("Relève confirmée par l’équipe entrante.");
}
function renderOSDaily() {
  const level = Number(state.dailyLevel),
    routines = osScope(data.routines).filter((r) => r.level === level),
    escalations = osScope(data.escalations).filter(
      (e) => e.level === level && e.status !== "Clos",
    ),
    signals = osScope(data.signals)
      .filter((s) => isOpenSignal(s) && s.state !== "Vérifié")
      .sort(
        (a, b) =>
          ({ Critique: 0, Haute: 1, Normale: 2 }[a.severity] ?? 3) -
          ({ Critique: 0, Haute: 1, Normale: 2 }[b.severity] ?? 3),
      ),
    candidates = osEscalationCandidates().filter(
      (c) => state.site === "group" || c.action.site_id === state.site,
    ),handovers=osHandoverRows();
  return `${pageHead("Management quotidien", "Routines N1 → N4", "Les mêmes écarts et actions alimentent chaque niveau ; les décisions restent tracées.", osWritable(state.site) ? osButton("Préparer une routine", "new", { key: "routines", preset: { level } }, false) : "")}
    <div class="tabs">${[1, 2, 3, 4].map((n) => osButton(`N${n} · ${["", "Équipe", "Atelier", "Site", "Groupe"][n]}`, "level", { level: n }, n !== level)).join("")}</div>
    <section class="panel daily-signal-board">
      <div class="section-title"><div><p class="eyebrow">Entrée prioritaire du rituel</p><h2>Signaux terrain à traiter</h2><p>Chaque remontée visible ici doit recevoir une prise en charge, une suite et une échéance.</p></div>${osWritable(state.site) ? '<button class="btn" data-new-signal>＋ SIGNAL TERRAIN</button>' : ""}</div>
      <div class="list">${signals.slice(0, 8).map((s) => `<article class="row signal-row ${s.severity === "Critique" ? "critical" : ""}"><div><b>${esc(s.severity)} · ${esc(getSiteName(s.site_id))}</b><p>${esc(s.description)}</p><span class="hint">${esc(s.owner || "Responsable à confirmer")} · réponse attendue ${shortDate(s.response_due || signalResponseDue(s.severity, s.created_at))}</span></div>${recordLink(s.id, "Prendre en charge")}</article>`).join("") || empty("Aucun signal ouvert sur ce périmètre.")}</div>
    </section>
    <div class="panel"><h2>Escalades</h2><p>${candidates.length} action(s) répondent à la règle : ${data.settings.escalationDays} jours après l’échéance, puis N+1 au même rythme.</p>${osManager() ? osButton("Appliquer les règles d’escalade", "escalate", {}, false) : ""}<p class="hint">L’application crée les escalades lors de ce contrôle explicite. Aucun traitement ne s’exécute quand elle est fermée.</p></div>
    <section class="section">${osCards("escalations", escalations)}</section>
    <section class="section handover-board"><div class="section-title"><div><p class="eyebrow">Continuité entre équipes</p><h2>Passages d’équipe</h2><p class="hint">Situation, priorités et dossiers à reprendre sans recopier les actions.</p></div>${osManager()?'<button class="btn" type="button" data-new-handover>＋ Préparer une relève</button>':""}</div><div class="handover-grid">${handovers.slice(0,6).map(handoverCard).join("")||empty("Aucune relève enregistrée sur ce périmètre.")}</div></section>
    <section class="section"><h2>Routines de ce niveau</h2>${osCards("routines", routines)}</section>
    <section class="section"><h2>Actions du périmètre</h2>${osCards("actions", osScope(data.actions).filter(isOpenAction).slice(0, 12))}</section>`;
}
function renderOSKaizen() {
  const rows = osScope(data.kaizens);
  return `${pageHead("Amélioration", "Idées, Kaizen et résultats", "De l’idée à la preuve, puis au standard partagé.", osWritable(state.site) ? osButton("Proposer une idée", "new", { key: "kaizens" }, false) : "")}
    ${osWritable(state.site) ? `<section class="kaizen-callout"><div><p class="eyebrow">Une difficulté répétée ou une amélioration simple ?</p><h2>Votre idée peut devenir le prochain standard du Groupe.</h2><p>Décrivez le problème en quelques mots. Le pilote, l'essai et la mesure seront complétés avec l'équipe.</p></div>${osButton("＋ PROPOSER UNE IDÉE", "new", { key: "kaizens" }, false)}</section>` : ""}
    <div class="os-phase-strip">${OS_KAIZEN_STATES.map((s) => `<span>${esc(s)} <b>${rows.filter((k) => k.status === s).length}</b></span>`).join("")}</div>${listSearch()}${osCards("kaizens", rows, (k) => `<div class="row-actions">${osButton("Avant / Après", "createFrom", { id: k.id, kind: "beforeafter" })}${osButton("Mesurer le gain", "createFrom", { id: k.id, kind: "gains" })}${osButton("Créer la suite", "follow", { id: k.id })}</div>`)}
    <section class="section"><div class="section-title"><h2>Registre des gains</h2>${osWritable(state.site) ? osButton("Ajouter une mesure de gain", "new", { key: "gains" }) : ""}</div>${osCards("gains", osScope(data.gains), (g) => `<p class="os-gain">${osNum(osGainValue(g))} ${esc(g.unit)} · ${esc(g.period)} · ${esc(g.status)}</p>`)}</section>`;
}
function renderOSDeployment() {
  const practices = osActive(data.practices),
    sites = OPERATIONAL_SITES;
  return `${pageHead("Capitalisation", "Déploiement multisite", "Une pratique, un résultat d’origine et une validation propre à chaque site.", osWritable(state.site) ? osButton("Préparer un transfert", "new", { key: "deployments" }, false) : "")}<section class="panel"><div class="os-deploy-matrix">${
    practices
      .map(
        (p) =>
          `<article><header><h3>${esc(p.title)}</h3><p>${esc(getSiteName(p.site_id))} · ${esc(p.status)}</p>${recordLink(p.id, "Pratique d’origine")}</header><div class="os-site-grid" style="--sites:${sites.length}">${sites
            .map((s) => {
              const d = data.deployments.find(
                (d) =>
                  d.practice_id === p.id &&
                  d.site_id === s.id &&
                  !d.archived_at,
              );
              return `<div class="os-deploy-cell"><b>${esc(s.name)}</b>${p.site_id === s.id ? '<span class="pill done">Origine</span>' : d ? `${pill(d.status, d.status === "Déployée" ? "done" : "progress")}${recordLink(d.id, "Suivre")}` : osWritable(s.id) ? osButton("Évaluer le transfert", "new", { key: "deployments", preset: { practice_id: p.id, site_id: s.id, prerequisites: p.transfer || "" } }) : "<span>Non engagé</span>"}</div>`;
            })
            .join("")}</div></article>`,
      )
      .join("") ||
    empty(
      "Publiez une première bonne pratique avec son résultat et ses prérequis.",
    )
  }</div></section>`;
}
function osMaturityDates(siteIds){
  const ids=new Set(siteIds),dates=new Set(osActive(data.maturity).filter(m=>ids.has(m.site_id)&&(!state.workshop||m.workshop_id===state.workshop)).map(m=>m.date).filter(Boolean));
  return [...dates].sort((a,b)=>b.localeCompare(a));
}
function osRadar(siteId,atDate,compareDate="") {
  const pillars = data.settings.pillars,
    levels = pillars.map(
      (p) => osMaturity(siteId, p, atDate, state.workshop)?.level ?? null,
    ),
    previous=compareDate?pillars.map(p=>osMaturity(siteId,p,compareDate,state.workshop)?.level??null):[],
    cx = 150,
    cy = 150,
    r = 110,
    point = (i, v) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / pillars.length;
      return `${cx + (Math.cos(a) * r * v) / 5},${cy + (Math.sin(a) * r * v) / 5}`;
    };
  return `<div class="maturity-radar-wrap"><svg class="os-radar" viewBox="0 0 300 320" role="img" aria-label="Maturité de ${esc(getSiteName(siteId))} au ${esc(atDate)}${compareDate?` comparée au ${esc(compareDate)}`:""}">${[1, 2, 3, 4, 5].map((v) => `<polygon points="${pillars.map((_, i) => point(i, v)).join(" ")}" fill="none" stroke="#cad5db"/>`).join("")}${pillars.map((p, i) => `<line x1="150" y1="150" x2="${point(i, 5).split(",")[0]}" y2="${point(i, 5).split(",")[1]}" stroke="#cad5db"/><text x="${point(i, 6).split(",")[0]}" y="${point(i, 6).split(",")[1]}" text-anchor="middle" font-size="12">${i + 1}</text>`).join("")}${previous.length&&previous.every(x=>x!==null)?`<polygon points="${previous.map((v,i)=>point(i,v)).join(" ")}" fill="#d7781314" stroke="#b0600d" stroke-width="2" stroke-dasharray="6 4"/>`:""}${levels.every((x) => x !== null) ? `<polygon points="${levels.map((v, i) => point(i, v)).join(" ")}" fill="#2a8d8530" stroke="#137b72" stroke-width="3"/>` : levels.map((v, i) => (v === null ? "" : `<circle cx="${point(i, v).split(",")[0]}" cy="${point(i, v).split(",")[1]}" r="5" fill="#137b72"/>`)).join("")}<text x="150" y="310" text-anchor="middle" font-size="12">${levels.filter((x) => x !== null).length}/${pillars.length} piliers évalués</text></svg>${compareDate?'<div class="radar-legend"><span class="current">Date analysée</span><span class="previous">Date comparée</span></div>':""}</div>`;
}
function renderOSMaturity() {
  const sites = OPERATIONAL_SITES.filter(
    (s) => state.site === "group" || s.id === state.site,
  ),dates=osMaturityDates(sites.map(s=>s.id));
  if(!dates.includes(state.maturityDate))state.maturityDate=dates[0]||today();
  if(state.maturityCompareDate&&(!dates.includes(state.maturityCompareDate)||state.maturityCompareDate===state.maturityDate))state.maturityCompareDate="";
  const at=state.maturityDate,compare=state.maturityCompareDate,currentRows=sites.flatMap(s=>data.settings.pillars.map(p=>osMaturity(s.id,p,at,state.workshop)).filter(Boolean)),previousRows=compare?sites.flatMap(s=>data.settings.pillars.map(p=>osMaturity(s.id,p,compare,state.workshop)).filter(Boolean)):[],average=rows=>rows.length?rows.reduce((sum,m)=>sum+m.level,0)/rows.length:null,currentAverage=average(currentRows),previousAverage=average(previousRows),delta=currentAverage!=null&&previousAverage!=null?currentAverage-previousAverage:null;
  return `${pageHead("Pilotage", "Maturité Lean", "Retrouver chaque campagne, comparer deux dates et ouvrir les preuves ou plans d’amélioration.", osWritable(state.site) ? osButton("Nouvelle évaluation", "new", { key: "maturity" }, false) : "")}<section class="panel maturity-controls"><div><label>Date analysée<select id="maturityDate">${dates.map(d=>`<option value="${d}" ${d===at?"selected":""}>${shortDate(d)}</option>`).join("")||`<option value="${today()}">${shortDate(today())}</option>`}</select></label><label>Comparer à<select id="maturityCompareDate"><option value="">Aucune comparaison</option>${dates.filter(d=>d!==at).map(d=>`<option value="${d}" ${d===compare?"selected":""}>${shortDate(d)}</option>`).join("")}</select></label></div><div class="maturity-summary"><span>Moyenne observée <b>${currentAverage==null?"—":currentAverage.toFixed(1)}/5</b></span>${compare?`<span>Évolution <b class="${delta>0?"good":delta<0?"bad":""}">${delta>0?"+":""}${delta?.toFixed(1)||"0.0"}</b></span>`:""}<span>Campagnes disponibles <b>${dates.length}</b></span></div></section><div class="os-site-grid maturity-site-grid" style="--sites:${sites.length}">${sites
    .map(
      (s) =>
        `<article class="panel"><h3>${esc(s.name)}</h3>${osRadar(s.id,at,compare)}${data.settings.pillars
          .map((p, i) => {
            const m = osMaturity(s.id, p, at, state.workshop),old=compare?osMaturity(s.id,p,compare,state.workshop):null,pillarDelta=m&&old?m.level-old.level:null;
            return `<button class="os-maturity-cell level-${m?.level || 0}" data-os="maturityCell" data-args="${esc(JSON.stringify({ siteId: s.id, pillar: p, target:m?.target||4 }))}"><span>${i + 1} · ${esc(p)}</span><b>${m?.level ?? "—"}/5</b>${compare?`<small class="maturity-delta ${pillarDelta>0?"good":pillarDelta<0?"bad":""}">${pillarDelta==null?"n.c.":`${pillarDelta>0?"+":""}${pillarDelta}`}</small>`:""}</button>`;
          })
          .join("")}</article>`,
    )
    .join(
      "",
    )}</div><section class="section"><h2>Évaluations et trajectoires</h2>${osCards(
    "maturity",
    osScope(data.maturity).sort((a, b) => b.date.localeCompare(a.date)),
    (m) =>
      `<p>Cible ${m.target}/5 · ${shortDate(m.date)}</p>${osButton("Plan d’amélioration", "createFrom", { id: m.id, kind: "action" })}`,
  )}</section>`;
}
function renderOSHoshin() {
  const all = osActive(data.objectives),
    rows = all.filter(
      (o) =>
        state.site === "group" ||
        o.site_id === state.site ||
        o.site_id === "group",
    ),
    roots = rows.filter(
      (o) => !o.parent_id || !rows.some((p) => p.id === o.parent_id),
    );
  const tree = (o, depth = 0) => {
    const p = osObjectiveProgress(o.id),
      m =
        o.kpi_id && o.site_id !== "group"
          ? osLatest(o.site_id, o.kpi_id)
          : null;
    return `<article class="os-objective depth-${Math.min(3, depth)}"><header><div>${pill(o.level)}<h3>${esc(o.title)}</h3><p>${esc(getSiteName(o.site_id))} · ${esc(o.owner)} · ${o.year} · ${shortDate(o.due_date)}</p></div>${recordLink(o.id, "Piloter")}</header><div class="os-objective-result"><span>${p.total ? `${p.closed}/${p.total} actions vérifiées (${p.pct} %)` : "Aucune action reliée"}</span><span>Résultat KPI : ${osNum(m?.value)} · cible ${osNum(o.target)}</span></div><p>${esc(o.result || "Résultat à vérifier")}</p><div class="row-actions">${osButton("Voir toute la chaîne", "trace", { id: o.id })}${osWritable(o.site_id) ? osButton("Décliner cet objectif", "new", { key: "objectives", preset: { parent_id: o.id, level: o.level === "Axe stratégique" ? "Groupe" : o.level === "Groupe" ? "Site" : "Atelier" } }) : ""}</div></article>${rows
      .filter((x) => x.parent_id === o.id)
      .map((x) => tree(x, depth + 1))
      .join("")}`;
  };
  return `${pageHead("Stratégie", "Hoshin Kanri", "Relier les axes, objectifs, KPI, projets et actions ; mesurer le résultat séparément de l’avancement.", osIsAdmin() ? osButton("Créer un objectif", "new", { key: "objectives" }, false) : "")}<section class="os-hoshin-tree">${roots.map((o) => tree(o)).join("") || empty("Définissez le premier axe stratégique du Groupe.")}</section><section class="panel section"><h2>X-Matrix · contributions</h2><p class="hint">Sélectionnez une case pour qualifier le lien : forte, faible ou aucun. Les mêmes relations alimentent les parcours dans les deux sens.</p>${osXMatrix(rows)}</section>`;
}
function osXMatrix(rows) {
  const axes = rows.filter((o) => o.level === "Axe stratégique"),
    annual = rows.filter((o) => o.level === "Groupe"),
    siteObjectives = rows.filter((o) => ["Site", "Atelier"].includes(o.level)),
    projects = osScope(data.projects),
    kpis = osActive(data.kpis);
  const matrix = (title, left, right) =>
    `<article><h3>${title}</h3>${
      left.length && right.length
        ? `<div class="os-matrix-wrap"><table class="os-matrix"><thead><tr><th>Contribution</th>${right.map((r) => `<th>${esc(osTitle(r))}</th>`).join("")}</tr></thead><tbody>${left
            .map(
              (a) =>
                `<tr><th>${esc(osTitle(a))}</th>${right
                  .map((b) => {
                    const l = data.links.find(
                        (l) => l.from === a.id && l.to === b.id,
                      ),
                      implicit =
                        a.parent_id === b.id ||
                        b.parent_id === a.id ||
                        a.kpi_id === b.id ||
                        a.objective_id === b.id;
                    return `<td>${osButton(l?.type === "Forte" || implicit ? "●" : l?.type === "Faible" ? "○" : "+", "matrix", { from: a.id, to: b.id, implicit })}</td>`;
                  })
                  .join("")}</tr>`,
            )
            .join("")}</tbody></table></div>`
        : empty(
            "Créez les objectifs et liez leurs KPI / projets pour renseigner ce quadrant.",
          )
    }</article>`;
  return `<div class="os-xmatrix">${matrix("1 · Vision → objectifs annuels", annual, axes)}${matrix("2 · Objectifs annuels → résultats KPI", annual, kpis)}${matrix("3 · Déclinaison sites / ateliers", siteObjectives, annual)}${matrix("4 · Projets → objectifs annuels", projects, annual)}</div>`;
}
function osActivityList(rows) {
  return `<ol class="os-activity">${
    rows
      .slice()
      .reverse()
      .slice(0, 100)
      .map(
        (e) =>
          `<li><span>${shortDate(e.at)} · ${esc(e.actor)}</span><b>${esc(e.event)} ${e.record_id ? recordLink(e.record_id, e.record_id) : ""}</b><small>${esc((e.fields || []).join(", "))}${e.from || e.to ? ` · ${esc(e.from || "Créé")} → ${esc(e.to || "")}` : ""}</small>${
            e.changes
              ? `<details><summary>Valeurs modifiées</summary>${Object.entries(
                  e.changes,
                )
                  .map(
                    ([key, val]) =>
                      `<p><b>${esc(key)}</b> : ${esc(val.before ?? "—")} → ${esc(val.after ?? "—")}</p>`,
                  )
                  .join("")}</details>`
              : ""
          }</li>`,
      )
      .join("") || "<li>Aucun événement enregistré sur ce périmètre.</li>"
  }</ol>`;
}
function renderOSActivity() {
  return `${pageHead("Traçabilité", "Journal d’activité", "Créations, modifications, validations et archivages conservés avec leur auteur local.")}<div class="panel">${osActivityList(data.activity.filter((e) => state.site === "group" || e.site_id === state.site))}</div>`;
}
function renderOSAdmin() {
  const tabs = [
      "sites",
      "workshops",
      "zones",
      "users",
      "kpis",
      "auditTemplates",
      "rules",
    ],
    key = state.adminTab;
  return `${pageHead("Administration", "Référentiels communs", "Les modifications s’appliquent à toutes les vues. Les profils locaux ne remplacent pas une authentification serveur.")}<div class="tabs">${tabs.map((k) => osButton(k === "rules" ? "Règles et maturité" : OS_COLLECTIONS[k][0], "adminTab", { key: k }, k !== key)).join("")}</div>${
    key === "rules"
      ? osRulesView()
      : `<section class="panel"><div class="section-title"><h2>${OS_COLLECTIONS[key][0]}</h2>${osButton("Ajouter", "new", { key }, false)}</div>${listSearch()}<div class="list">${
          osActive(data[key])
            .map(
              (r) =>
                `<article class="row" data-search-row><div><h3>${esc(osTitle(r))}</h3><p>${esc(r.definition || r.owner || r.role || getSiteName(r.site_id))}</p></div>${osButton("Modifier", "edit", { key, id: r.id })}</article>`,
            )
            .join("") || empty("Aucune entrée.")
        }</div></section>`
  }<section class="panel section"><h2>Données et sauvegardes</h2><div class="row-actions">${osButton("Exporter les données", "export")}${osButton("Explorer le scénario complet", "demo")}${osButton("Créer un espace de saisie vide", "emptyData")}${localStorage.getItem(STORAGE_KEY + "-before-lean-os") ? osButton("Sauvegarde avant migration", "backup") : ""}${localStorage.getItem(STORAGE_KEY + "-before-demo-refresh") ? osButton("Sauvegarde avant actualisation démo", "backupDemoRefresh") : ""}${localStorage.getItem(STORAGE_KEY + "-before-demo") ? osButton("Revenir à mes données", "restoreDemo") : ""}</div><p class="hint">Un changement d’espace conserve d’abord les données courantes dans une sauvegarde locale récupérable.</p></section>`;
}
function osRulesView() {
  return `<form id="osRules" class="panel"><h2>Règles de management</h2><div class="form-grid"><label>Délai avant escalade (jours)<input name="days" type="number" min="1" max="365" value="${data.settings.escalationDays}" required></label>${[2, 3, 4].map((n) => `<label>Décideur N${n}<input name="owner${n}" value="${esc(data.settings.escalationOwners[n])}" required></label>`).join("")}<label class="wide">Équipes / horaires de relève (un par ligne)<textarea name="shifts" rows="4" required>${esc((data.settings.shifts||[]).join("\n"))}</textarea></label><label class="wide">Catégories terrain (une par ligne)<textarea name="categories" rows="5" required>${esc(data.settings.categories.join("\n"))}</textarea></label></div><h3>Dix piliers et niveaux de maturité</h3><p class="hint">Les noms des piliers existants sont conservés pour préserver l’historique. Les définitions des niveaux peuvent être précisées.</p>${data.settings.levels.map((l, i) => `<label class="field">Niveau ${i + 1}<input name="level${i}" required value="${esc(l)}"></label>`).join("")}<div class="form-actions"><button class="btn">Enregistrer les règles</button></div></form>`;
}
function renderOSConnectors() {
  const pending=(data.syncQueue||[]).filter(item=>item.status==="pending");
  return `${pageHead("Administration", "Connecteurs et imports", "Importer des mesures validées et préparer les contrats avec les systèmes sources.", osIsAdmin() ? osButton("Configurer un système", "new", { key: "connectors" }, false) : "")}<section class="panel sync-readiness"><div><p class="eyebrow">Préparation serveur</p><h2>File de synchronisation exportable</h2><p>${pending.length} changement(s) local(aux) sont décrits par leur révision, événement et dossier. Aucun fichier n’est envoyé automatiquement.</p></div><button class="btn secondary" type="button" data-export-sync ${pending.length?"":"disabled"}>Exporter le paquet de synchronisation</button></section><section class="panel section"><h2>Importer des KPI · CSV</h2><p>Exportez Excel en CSV UTF-8. Les colonnes et chaque ligne sont contrôlées avant enregistrement.</p><div class="row-actions">${osButton("Télécharger le contrat CSV", "csvTemplate")}<label class="btn">Choisir le CSV<input type="file" id="osCSVFile" accept=".csv,text/csv" hidden></label></div><div id="osCSVResult"></div></section><section class="section">${osCards("connectors", osActive(data.connectors))}</section><section class="panel section"><h2>SEQUOIA, ERP, MES, SQL et API</h2><p>Les connexions automatiques demandent le contrat de l’éditeur, les droits de lecture, le schéma, les unités, le périmètre et la fréquence. Aucun endpoint ni mot de passe n’est présumé.</p><p>Les imports affichent « Import » ; les saisies affichent « Manuel ». Une configuration seule n’est jamais présentée comme un flux connecté.</p></section><section class="panel section"><h2>Journal des imports</h2>${
    (data.syncLog || [])
      .slice()
      .reverse()
      .map(
        (l) =>
          `<p>${shortDate(l.at)} · ${esc(l.source)} · ${l.accepted || 0} ligne(s) · ${esc(l.status)}</p>`,
      )
      .join("") || "<p>Aucun import effectué.</p>"
  }</section>`;
}
