"use strict";
function osQuestionnaireForm(id = null) {
  if (!osIsAdmin()) return;
  const old = data.auditTemplates.find((q) => q.id === id);
  modal(
    `${id || "Créer"} · Questionnaire d’audit`,
    `<form id="osQuestionnaire"><div class="form-grid"><label>Nom<input name="name" required value="${esc(old?.name || "")}"></label><label>Type<select name="type">${["Lean", "5S", "Standard", "Sécurité", "Personnalisé"].map((t) => `<option ${old?.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><label class="wide">Questions : pilier | question | preuve obligatoire (oui/non)<textarea name="questions" rows="12" required>${esc((old?.questions || []).map((q) => `${q.pillar} | ${q.text} | ${q.proof_required ? "oui" : "non"}`).join("\n"))}</textarea></label></div><p class="hint">Les audits déjà commencés gardent leur questionnaire d’origine. Les changements s’appliquent aux prochains audits.</p><div class="form-actions"><button class="btn">Enregistrer le questionnaire</button></div></form>`,
  );
  $("osQuestionnaire").onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      questions = [];
    try {
      for (const line of f.elements.questions.value
        .split("\n")
        .filter((l) => l.trim())) {
        const [pillar, text, proof] = line.split("|").map((s) => s.trim());
        if (!pillar || !text || !["oui", "non"].includes(proof))
          throw Error(
            "Chaque ligne doit avoir : pilier | question | oui ou non.",
          );
        questions.push({
          id: uid("Q"),
          pillar,
          text,
          proof_required: proof === "oui",
        });
      }
      if (!questions.length || questions.length > 100)
        throw Error("Prévoyez entre 1 et 100 questions.");
      if (
        !commitData(() =>
          osUpsert("auditTemplates", {
            id: old?.id,
            name: f.elements.name.value.trim(),
            site_id: "group",
            type: f.elements.type.value,
            questions,
          }),
        )
      )
        return;
      closeModal();
      render();
    } catch (err) {
      toast(err.message);
    }
  };
}
function osAuditStart(preset = {}) {
  modal(
    "Démarrer un audit",
    `<form id="osAuditStart"><div class="form-grid"><label>Questionnaire<select name="template" required>${osActive(
      data.auditTemplates,
    )
      .map(
        (t) =>
          `<option value="${t.id}">${esc(t.name)} · ${t.questions.length} questions</option>`,
      )
      .join(
        "",
      )}</select></label><label>Site<select name="site">${siteOptions(preset.site_id || state.site)}</select></label><label>Périmètre<input name="scope" required value="${esc(preset.title || "")}"></label><label>Auditeur<input name="owner" required value="${esc(preset.owner || "")}"></label></div><div class="form-actions"><button class="btn">Commencer</button></div></form>`,
  );
  $("osAuditStart").onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      t = data.auditTemplates.find((t) => t.id === f.elements.template.value);
    if (!t || !f.reportValidity()) return;
    const a = {
      id: uid("AUD"),
      site_id: f.elements.site.value,
      scope: f.elements.scope.value.trim(),
      owner: f.elements.owner.value.trim(),
      source_id: preset.source_id || null,
      kpi_id: preset.kpi_id || null,
      template_id: t.id,
      type: t.type,
      status: "Brouillon",
      performed_at: today(),
      question_snapshot: clone(t.questions),
      audit_data: { criteria: [] },
      created_at: now(),
    };
    if (!commitData(() => data.audits.push(a))) return;
    closeModal();
    render();
    osAuditForm(a);
  };
}
function osAuditForm(saved) {
  const a = clone(saved),
    readonly = !osWritable(a.site_id) || a.status === "Terminé";
  const score = osFinite(a.score) ? `${a.score}/100` : "Brouillon";
  modal(
    `${a.id} · ${a.type} · ${score}`,
    `<form id="osAudit"><h3>${esc(a.scope)}</h3><p>${esc(a.owner)} · ${esc(getSiteName(a.site_id))}</p><label class="field">Date de l’audit<input name="date" type="date" required value="${a.performed_at}" ${readonly ? "disabled" : ""}></label><fieldset ${readonly ? "disabled" : ""}>${a.question_snapshot
      .map((q, i) => {
        const old = a.audit_data.criteria.find((c) => c.question_id === q.id);
        return `<section class="os-audit-question"><h3>${i + 1}. ${esc(q.text)}</h3><p class="hint">${esc(q.pillar)} · ${q.proof_required ? "Preuve obligatoire" : "Preuve facultative"}</p><label>Note<select name="score${i}"><option value="">À évaluer</option>${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${old?.score === n ? "selected" : ""}>${n}/5</option>`).join("")}</select></label><label>Fait observé / document consulté<textarea name="proof${i}" rows="2">${esc(old?.proof || "")}</textarea></label><label>Commentaire<textarea name="comment${i}" rows="2">${esc(old?.comment || "")}</textarea></label></section>`;
      })
      .join(
        "",
      )}</fieldset><label class="field">Photo de preuve commune<input type="file" id="osAuditPhoto" accept="image/jpeg,image/png,image/webp" ${readonly ? "disabled" : ""}></label><div id="osAuditPhotoPreview">${photoImage(a.photo)}</div><div class="form-actions">${readonly ? "" : `<button type="button" class="btn secondary" id="osAuditDraft">Enregistrer le brouillon</button><button class="btn">Valider l’audit</button>`}<button type="button" class="btn secondary" data-print>Imprimer / PDF</button></div></form>${relatedPanel(a.id)}${osContext(a.id)}`,
  );
  const photo = photoPicker("osAuditPhoto", "osAuditPhotoPreview", a.photo),
    form = $("osAudit");
  function persist(complete) {
    if (readonly) return false;
    if (photo.busy || photo.error)
      return (toast("Attendez la préparation de la photo."), false);
    a.performed_at = form.elements.date.value;
    a.photo = photo.value;
    a.audit_data.criteria = a.question_snapshot.map((q, i) => ({
      question_id: q.id,
      domain: q.pillar,
      criterion: q.text,
      score: osNumber(form.elements["score" + i].value),
      proof: form.elements["proof" + i].value.trim(),
      comment: form.elements["comment" + i].value.trim(),
    }));
    if (
      complete &&
      (!a.performed_at ||
        a.performed_at > today() ||
        a.audit_data.criteria.some(
          (c, i) =>
            c.score === null ||
            (a.question_snapshot[i].proof_required && !c.proof && !a.photo),
        ))
    )
      return (
        toast(
          "Chaque question doit être notée et accompagnée de la preuve demandée ; vérifiez la date.",
        ),
        false
      );
    a.status = complete ? "Terminé" : "Brouillon";
    a.score = complete
      ? Math.round(
          (a.audit_data.criteria.reduce((s, c) => s + c.score, 0) /
            (a.question_snapshot.length * 5)) *
            100,
        )
      : null;
    return commitData(() => {
      Object.assign(
        data.audits.find((x) => x.id === a.id),
        a,
      );
      if (complete)
        for (const c of a.audit_data.criteria.filter((c) => c.score < 3)) {
          if (
            data.actions.some(
              (x) => x.origin_id === a.id && x.question_id === c.question_id,
            )
          )
            continue;
          data.actions.push({
            id: uid("A"),
            site_id: a.site_id,
            title: `Écart audit · ${c.criterion}`,
            description: c.proof || c.comment || "Voir la photo de l’audit",
            owner: a.owner,
            due_date: osDateOffset(7),
            priority: c.score === 0 ? "Haute" : "Normale",
            status: "Ouverte",
            progress: 0,
            origin_id: a.id,
            origin_type: "Audit",
            question_id: c.question_id,
            kpi_id: a.kpi_id || null,
            created_at: now(),
          });
        }
    });
  }
  if (!readonly) {
    $("osAuditDraft").onclick = () => {
      if (persist(false)) {
        closeModal();
        render();
      }
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (persist(true)) {
        closeModal();
        render();
        osAuditForm(data.audits.find((x) => x.id === a.id));
      }
    };
  }
}
