/* BIA Lean OS 8.48 — Exemple de démonstration : les sept sites, toutes les rubriques, avec photos.
   Tout est fictif. L’histoire détaillée reste celle de Marzin (panneau.js : pnStory) ; ce module ajoute
   les six autres sites (panneau TOP 5, indicateurs, feuilles de poste, non-conformités, signaux, idées, gains)
   et remplit les rubriques transverses pour tous : 5S, TPM, audits, chantiers, SMED, équilibrage, standards,
   échantillothèque, polyvalence, environnement, maturité, roadmap, Hoshin, relève, lettres du jour, avant/après.
   Les photos sont des illustrations dessinées, livrées dans demo/ et chargées à l’ouverture. */

const EX_PHOTOS = ["bac-chutes", "deligneuse-copeaux", "echantillon-limite", "echantillon-nok", "echantillon-ok", "enrobeuse", "epi", "etiquette-rouge", "filtre-colmate", "filtre-propre", "ligne-montage", "marquage-jaune", "mic-butee", "nc-decollement", "nc-percage", "panneau-top5", "plaqueuse", "porte-outils", "standard-poste", "transpalettes-allee", "ventouse-neuve", "ventouse-usee", "zone-apres", "zone-avant"];
const exPh = (name) => `photo:DEMO-${name}`;

/* ---------- Les photos d’exemple : chargées depuis demo/ dans le cache des photos ---------- */

function exLoadPhotos() {
  if (typeof PH_CACHE === "undefined" || typeof fetch !== "function" || !data?.meta?.demo) return;
  for (const name of EX_PHOTOS) {
    const id = `DEMO-${name}`;
    if (PH_CACHE.has(id)) continue;
    fetch(`demo/${name}.jpg`).then((r) => (r.ok ? r.blob() : null)).then((blob) => {
      if (!blob) return;
      const fr = new FileReader();
      fr.onload = () => { const url = String(fr.result || "").replace(/^data:[^;]*;/, "data:image/jpeg;"); if (typeof phSafeBase === "function" && !phSafeBase(url)) return; PH_CACHE.set(id, url); if (typeof phFill === "function") phFill(); };
      fr.readAsDataURL(blob);
    }).catch(() => { /* hors ligne sans cache : l’exemple reste lisible sans photo */ });
  }
}

/* ---------- Les six autres sites (tout est fictif) ---------- */

const EX_SITES = {
  "ag-deco": { code: "AGD", line: "Imprimante décor 2", photo: "enrobeuse", slot: "Lundi 9 h", weekday: 0, teams: ["Journée"], rate: 70, trs: [0.75, 0.79], scrap: [3.4, 2.8], otd: 93, abs: 4.6, jsa: [0, 7, 14, 21, 28, 35], record: 160, ca: 236, lead: "Sandrine K. (cheffe d’équipe)", maint: "Hugo V. (maintenance)",
    losses: ["Teinte hors tolérance : 2 h", "Changement de rouleau décor : 1 h 30", "Attente encre : 50 min"],
    subjects: [["Teinte décor hors tolérance", "Qualité", 70, "cours", "Écart de teinte au démarrage des séries claires."], ["Stock tampon d’encre", "Logistique", 55, "qualifier", "Deux arrêts pour attente d’encre ce mois-ci."], ["Rouleau presseur", "Maintenance", 40, "resolu", "Rouleau rectifié, plus de marques."]],
    signals: [["Imprimante décor", "Qualité", "Teinte plus foncée sur les dix premiers panneaux de la série.", "Mineure"], ["Allée encres", "Sécurité", "Bidon d’encre ouvert au sol près du passage.", "Majeure"]],
    ideas: [["Gabarit de calage rouleau", "Le calage du rouleau prend du temps.", "Un gabarit avec repères de position."], ["Échantillon de teinte au poste", "On compare la teinte de mémoire.", "Un échantillon maître éclairé au poste."]],
    ncs: [["Teinte, finition", 9, "Interne"], ["Aspect, rayure", 4, "Interne"], ["Teinte, finition", 16, "Client"]],
    gains: [["Rebut de démarrage : teinte réglée sur échantillon", "fin", "reel", "€", 900, 300, 350, 12, "Validé"]] },
  europlacage: { code: "EUR", line: "Plaqueuse 1", photo: "plaqueuse", slot: "Mardi 8 h 30", weekday: 1, teams: ["Matin", "Après-midi"], rate: 85, trs: [0.84, 0.87], scrap: [2.6, 2.1], otd: 96, abs: 3.9, jsa: [98, 105, 112, 119, 126, 133], record: 133, ca: 318, lead: "Paul M. (chef d’équipe)", maint: "Éric D. (maintenance)",
    losses: ["Fentes de placage : 1 h 10", "Réglage presse : 50 min", "Attente feuilles : 40 min"],
    subjects: [["Fentes de placage", "Qualité", 60, "cours", "Fentes sur feuilles de chêne en sortie de presse."], ["Fuites d’air comprimé", "Maintenance", 30, "resolu", "Douze fuites réparées après une ronde au silence."], ["Temps de prise de la colle", "Méthodes", 80, "qualifier", "Essai d’une colle à prise rapide à cadrer."]],
    signals: [["Presse", "Qualité", "Fente sur le placage chêne, troisième panneau de la pile.", "Mineure"], ["Compresseur", "Maintenance", "Sifflement d’air derrière la presse.", "Mineure"]],
    ideas: [["Humidité des feuilles affichée", "On ne sait pas si les feuilles sont trop sèches.", "Un hygromètre au stock de feuilles."], ["Ronde au silence mensuelle", "Les fuites d’air reviennent.", "Une ronde le premier vendredi du mois."]],
    ncs: [["Placage", 6, "Interne"], ["Placage", 13, "Interne"], ["Collage, décollement", 21, "Client"]],
    gains: [["Air comprimé : fuites réparées", "env", "reel", "kWh", 14200, 11500, 12100, 12, "À valider", 0.19], ["Fentes de placage divisées par 2", "qual", "evite", "pièces", 40, 15, 22, 12, "Estimé"]] },
  "le-moine": { code: "LMO", line: "Ligne de montage portes", photo: "ligne-montage", slot: "Lundi 14 h", weekday: 0, teams: ["Journée"], rate: 24, trs: [0.69, 0.72], scrap: [4.2, 3.9], otd: 87, abs: 6.1, jsa: [0, 0, 0, 12, 19, 26], record: 140, ca: 152, lead: "Gilles F. (chef d’atelier)", maint: "Rémi S. (maintenance)", start: 3,
    losses: ["Attente quincaillerie : 2 h 20", "Retouches de montage : 1 h 40", "Recherche d’outils : 45 min"],
    subjects: [["Lancer le TOP 5 chaque jeudi", "Direction", 45, "cours", "Nouveau site du Groupe : premier panneau en place il y a trois semaines."], ["Gabarit de perçage des paumelles", "Méthodes", 75, "qualifier", "Perçages refaits à la main sur un tiers des portes."]],
    signals: [["Poste de montage 2", "Production", "Il manque des paumelles : la porte attend en bout de ligne.", "Mineure"], ["Allée de sortie", "Sécurité", "Portes stockées debout sans cale dans l’allée.", "Majeure"]],
    ideas: [["Kit quincaillerie par porte", "On cherche les pièces à chaque porte.", "Un bac préparé par commande."], ["Panneau d’ombres pour les outils", "Les visseuses se perdent.", "Un panneau d’outils au poste 2."]],
    ncs: [["Usinage", 5, "Interne"], ["Quantité, référence", 11, "Client"], ["Usinage", 18, "Interne"]],
    gains: [["Kit quincaillerie : recherches supprimées", "prod", "capacite", "min", 60, 15, null, 220, "Estimé", 0.8]] },
  "oraison-menuiserie": { code: "ORA", line: "Ligne de montage fenêtres", photo: "ligne-montage", slot: "Mardi 13 h 30", weekday: 1, teams: ["Journée"], rate: 18, trs: [0.76, 0.8], scrap: [3.6, 3.2], otd: 91, abs: 5.0, jsa: [55, 62, 69, 76, 83, 90], record: 190, ca: 274, lead: "Laura B. (cheffe d’équipe)", maint: "Marc T. (maintenance)",
    losses: ["Poste 3 surchargé : 1 h 50", "Quincaillerie manquante : 1 h 20", "Visseuse en panne : 40 min"],
    subjects: [["Équilibrer la ligne fenêtres", "Méthodes", 50, "cours", "Le poste 3 dépasse le takt : étude d’équilibrage en cours."], ["Quincaillerie manquante", "Logistique", 25, "bloque", "Rupture fournisseur sur les crémones : attente de livraison."], ["Visseuse du poste 3", "Maintenance", 20, "resolu", "Visseuse remplacée, plus d’arrêt."]],
    signals: [["Poste 3", "Production", "Je n’arrive pas à suivre le rythme au poste 3, les fenêtres s’accumulent.", "Mineure"], ["Stock quincaillerie", "Flux", "Plus de crémones taille 120.", "Majeure"]],
    ideas: [["Déplacer le vissage au poste 2", "Le poste 3 fait trop d’opérations.", "Passer le vissage des paumelles au poste 2."], ["Kanban quincaillerie", "On découvre la rupture trop tard.", "Deux bacs avec carte de réapprovisionnement."]],
    ncs: [["Dimension", 7, "Interne"], ["Quantité, référence", 14, "Client"], ["Aspect, rayure", 20, "Interne"]],
    gains: [["Ligne fenêtres : un poste de moins en surcharge", "prod", "capacite", "h", 6, 2, null, 46, "Estimé", 30]] },
  profiline: { code: "PRO", line: "Profileuse 2", photo: "enrobeuse", slot: "Lundi 10 h", weekday: 0, teams: ["Matin", "Après-midi"], rate: 110, trs: [0.84, 0.88], scrap: [2.5, 2.0], otd: 97, abs: 3.5, jsa: [210, 217, 224, 231, 238, 245], record: 245, ca: 362, lead: "Nora L. (opératrice référente)", maint: "Denis R. (maintenance)",
    losses: ["Changement de série : 1 h", "Réglage outils : 40 min", "Attente palettes : 25 min"],
    subjects: [["Chariot multi-commandes", "Logistique", 20, "resolu", "Préparation de 4 commandes d’un coup : 95 → 62 min."], ["Changement de série profileuse", "Méthodes", 65, "cours", "SMED : objectif 35 minutes."]],
    signals: [["Profileuse 2", "Production", "Le réglage des outils prend plus de temps sur la série 40.", "Mineure"], ["Expédition", "Flux", "Palettes vides manquantes en fin de poste.", "Mineure"]],
    ideas: [["Repères de réglage gravés", "Chaque régleur a sa méthode.", "Graver les positions sur les outils."], ["Palettes vides en bout de ligne", "On va les chercher au fond.", "Une zone de 10 palettes vides au poste."]],
    ncs: [["Dimension", 10, "Interne"], ["Emballage, transport", 19, "Client"]],
    gains: [["Préparation multi-commandes : 95 → 62 min", "delai", "capacite", "min", 95, 60, 62, 230, "Validé", 0.5], ["Réglage standard et première pièce", "prod", "capacite", "min", 24, 14, 14, 180, "Validé", 1.2]] },
  sodeplax: { code: "SOD", line: "Enrobeuse 1", photo: "enrobeuse", slot: "Mardi 9 h", weekday: 1, teams: ["Matin", "Après-midi"], rate: 95, trs: [0.78, 0.82], scrap: [3.3, 2.7], otd: 92, abs: 4.8, jsa: [30, 37, 44, 51, 58, 65], record: 300, ca: 298, lead: "Kevin A. (chef d’équipe)", maint: "Yves P. (maintenance)",
    losses: ["Nettoyage rouleaux : 1 h 30", "Changement de film : 1 h", "Saisie des arrêts incomplète"],
    subjects: [["Carter de l’enrobeuse 2", "Sécurité", 35, "cours", "Carter à reprendre pour le changement de film."], ["Rayures en sortie de ligne", "Qualité", 30, "resolu", "Tapis remplacé, rayures disparues."], ["Saisie des arrêts", "Méthodes", 60, "qualifier", "Codes d’arrêt à simplifier avec les équipes."], ["Pièce de rechange presseur", "Maintenance", 40, "bloque", "Délai fournisseur de 6 semaines."]],
    signals: [["Enrobeuse 2", "Sécurité", "Le carter se soulève quand on change le film.", "Critique"], ["Sortie de ligne", "Qualité", "Rayures sur les profilés blancs en fin de tapis.", "Majeure"]],
    ideas: [["Codes d’arrêt en 6 familles", "On ne sait pas quel code choisir.", "Six familles avec un pictogramme."], ["Brosse de nettoyage rouleau", "Le nettoyage prend 20 minutes.", "Une brosse au manche coudé."]],
    ncs: [["Aspect, rayure", 8, "Interne"], ["Collage, décollement", 15, "Client"], ["Aspect, rayure", 23, "Interne"]],
    gains: [["Rayures en sortie : tapis remplacé", "fin", "reel", "€", 1200, 200, 250, 12, "Validé"]] },
};
const EX_MESSAGES = [
  "Rangement fin de poste : 10 minutes", "Gants obligatoires au débit", "Allées dégagées, rien au sol", "Signaler tout presqu’accident", "Casque antibruit aux machines bruyantes", "Fiche verte sur tout produit bloqué",
  "Inventaire tournant mercredi", "Visite client jeudi : atelier rangé", "Contrôle du premier produit de chaque série", "Nouvel horaire du magasin", "Formation transpalette : inscriptions ouvertes", "Bravo à l’équipe : zéro rebut cette semaine",
];

function exSiteInto(base, siteId, X) {
  const d = (k) => pnDate(today(), -k), at = (k, h = "09:00") => new Date(`${d(k)}T${h}:00`).toISOString();
  const C = X.code, kpi = (c) => (base.kpis || []).find((k) => k.code === c);
  const ws = (base.workshops || []).find((w) => w.site_id === siteId);
  if (ws) ws.name = `Atelier ${X.line.split(" ")[0].toLowerCase() === "ligne" ? "de montage" : "principal"}`;
  const wsId = ws?.id || null;
  let seed = C.charCodeAt(0) * 7 + C.charCodeAt(1); const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  /* Panneau TOP 5 du site */
  const board = { id: `PN-${C}`, site_id: siteId, workshop_id: null, name: `TOP 5 ${typeof getSiteName === "function" ? getSiteName(siteId) : siteId}`, slot: X.slot, weekday: X.weekday, messages: 3, rows: PN_ROWS_MARZIN.map((r) => ({ ...r })), created_at: at(60) };
  base.boards.push(board);
  const cur = pnCurrentWeek(board), weeks = [5, 4, 3, 2, 1, 0].map((k) => pnDate(cur, -7 * k));
  const lerp = (a, b, k) => a + ((b - a) * k) / 5;
  weeks.forEach((w, k) => {
    if (X.start && k < 6 - X.start) return;
    const v = {
      jsa: X.jsa[k], record: X.record, ncpole: [Math.round(2 + rnd() * 4), Math.round(1 + rnd() * 3), Math.round(rnd() * 2)], sav: [Math.round(1 + rnd() * 4), Math.round(400 + rnd() * 2200)], erreurs: Math.round(4 + rnd() * 6),
      top1: X.losses[0], top2: X.losses[(k + 1) % 3 === 0 ? 2 : 1], top3: X.losses[(k + 1) % 3 === 0 ? 1 : 2], ca: Math.round(X.ca * (0.93 + rnd() * 0.12)),
      otd: Math.round(lerp(X.otd - 4, X.otd, k) + (k === 2 ? -3 : 0)), retard: Math.round(lerp(14, 6, k) + rnd() * 3), abs: +(lerp(X.abs + 0.8, X.abs, k) + (k === 2 ? 0.6 : 0)).toFixed(1),
    };
    const msgs = [0, 1, 2].map((i) => EX_MESSAGES[(k * 3 + i + C.charCodeAt(2)) % EX_MESSAGES.length]);
    const atW = new Date(`${pnMeetingDay(board, w)}T${String(9 + (X.weekday % 3)).padStart(2, "0")}:4${k % 10}:00`).toISOString();
    base.boardWeeks.push({ id: `PNW-${C}-${w}`, board_id: board.id, site_id: siteId, workshop_id: null, week: w, values: v, messages: msgs, a3: k >= 3 ? `A3 en cours : ${X.subjects[0][0].toLowerCase()}` : "", by: X.lead, at: atW });
    const prev = base.boardWeeks.find((x) => x.board_id === board.id && x.week === weeks[k - 1]);
    const { letters, notes } = pnSummary(board, v, prev?.values);
    notes.free = `Messages : ${msgs.join(" / ")}`;
    base.meetings.push({ id: `PNM-${board.id}-${w}`, kind: "top5", source: "panneau", board_id: board.id, site_id: siteId, workshop_id: null, date: pnMeetingDay(board, w), letters, notes, infos: [], answers: [], questions: [], present: [], ended_at: atW, by: X.lead });
    pnMeasuresFor(base, board, w, v);
    const safety = kpi("safety_signal");
    if (safety) base.measures.push({ id: uid("MES"), site_id: siteId, kpi_id: safety.id, code: safety.code, axis: safety.axis, unit: safety.unit, period: w, value: X.jsa[k] < 7 && k > 0 && X.jsa[k] <= X.jsa[k - 1] ? 1 : 0, target: safety.target, definition: safety.definition, source: `${board.name} · jours sans accident`, entry_mode: "panneau", board_id: board.id, synced_at: now() });
  });
  X.subjects.forEach(([title, owner, due, st, desc], i) => base.actions.push({ id: `A-${C}${i + 1}`, site_id: siteId, workshop_id: null, title, owner, pilot: i === 0 ? X.lead.split(" (")[0] : "", priority: st === "bloque" ? "Haute" : "Normale", due_date: d(-due), status: PN_STATUS.find((s) => s.key === st).action, board_status: st, origin_type: "TOP 5", board_id: board.id, description: desc, effectiveness: st === "resolu" ? "Vérifié au panneau" : null, progress: { qualifier: 0, cours: 50, resolu: 100, bloque: 25 }[st], contributors: [], created_at: at(20 + i * 6), ...(st === "resolu" ? { board_closed_week: cur, closed_at: at(3) } : {}) }));
  base.actions.push({ id: `A-${C}9`, site_id: siteId, workshop_id: null, title: `Point d’avancement : ${X.subjects[0][0].toLowerCase()}`, owner: X.lead, priority: "Normale", status: "En cours", due_date: d(-2), origin_type: "TOP 5", parent_id: `A-${C}1`, description: "Retour attendu au prochain panneau.", effectiveness: null, progress: 40, contributors: [], created_at: at(8) });
  /* Signaux, idées, non-conformités, gains */
  X.signals.forEach(([zone, type, text, sev], i) => base.signals.push({ id: `S-${C}${i + 1}`, site_id: siteId, workshop_id: wsId, zone, type, description: text, severity: sev, state: i ? "Pris en compte" : "Action en cours", immediate_action: i ? "Zone balisée." : "Prévenir le chef d’équipe.", author: `Opérateur ${zone.toLowerCase()}`, owner: X.lead, response_due: d(-1), created_at: at(3 + i * 5, "08:30"), updated_at: at(2 + i * 5), action_id: i ? null : `A-${C}1`, problem_id: null, kpi_id: kpi(type === "Sécurité" ? "safety_signal" : type === "Qualité" ? "scrap" : "trs")?.id, photo: type === "Sécurité" ? exPh(siteId === "sodeplax" ? "enrobeuse" : "transpalettes-allee") : "", history: [{ status: "Nouveau", note: "Remonté depuis le poste.", at: at(3 + i * 5, "08:30") }] }));
  X.ideas.forEach(([title, problem, solution], i) => base.kaizens.push({ id: `KAI-${C}${i + 1}`, site_id: siteId, workshop_id: wsId, zone_id: null, title, problem, solution, status: ["Idée", "Mise en œuvre", "Gain validé"][(i + C.length + C.charCodeAt(0)) % 3], owner: i ? X.lead : "", proposer: `Opérateur ${X.line.toLowerCase()}`, self: false, before_photo: "", due_date: d(-10 - i * 5), created_at: at(6 + i * 9), updated_at: at(4 + i * 9), kudos: [] }));
  X.ncs.forEach(([defect, ago, origin], i) => base.ncs.push({ id: `NC-${C}${i + 1}`, site_id: siteId, date: d(ago), order_no: origin === "Client" ? `CDE-${48000 + ago * 7}` : "", client: origin === "Client" ? `Client ${String.fromCharCode(66 + i)} (fictif)` : "", article: `${C}-${100 + i * 20} (fictif)`, designation: X.line.includes("montage") ? "Menuiserie assemblée" : "Panneau ou profilé", lot: `L${4400 + ago}`, line: X.line, prod_date: d(ago + 1), origin, defect, qty: 3 + Math.round(rnd() * 12), severity: origin === "Client" ? "Majeure" : "Mineure", text: `${defect} constaté en ${origin === "Client" ? "réception client" : "contrôle"}.`, containment: "Stock trié", decision: origin === "Client" ? "Remplacement" : "Retouche", problem_id: null, action_id: null, status: ago > 12 ? "Close" : "Ouverte", by: X.lead, created_at: at(ago), ...(origin === "Client" ? { ack_at: at(ago - 1) } : {}) }));
  X.gains.forEach(([title, family, nature, unit, before, target, after, per_year, status, rate], i) => base.gains.push({ id: `GAIN-${C}${i + 1}`, site_id: siteId, title, family, nature, unit, direction: "low", before, target, after, per_year, ...(rate ? { euro_rate: rate } : {}), cost: 300 + i * 900, status, evidence: status === "Estimé" ? "Estimation avant essai" : "Mesure avant / après sur 4 semaines", start_date: d(30 + i * 10), ...(status === "Validé" ? { validated_at: at(5 + i), validated_by: X.lead } : {}), by: X.lead, recurring: true, created_at: at(25 + i * 10) }));
  /* Feuilles de poste et micro-arrêts de la ligne du site */
  const lid = `ML-${C}`;
  base.mlLines.push({ id: lid, site_id: siteId, workshop_id: null, name: X.line, machine_id: null, threshold_min: 5, typical_min: 2, opening_min: X.teams.length > 1 ? 920 : 460, target_min: 20, rate_ph: X.rate, shift_min: 480, causes: [X.losses[0].split(" :")[0], X.losses[1].split(" :")[0], "Attente matière", "Réglage", "Autre"] });
  for (let k = 41; k >= 1; k--) {
    const day = d(k), wd = new Date(day + "T12:00:00").getDay();
    if (wd === 0 || wd === 6 || (X.start && k > X.start * 7)) continue;
    for (const team of X.teams) {
      const trs = lerp(X.trs[0], X.trs[1], (41 - k) / 8.2) + (rnd() - 0.5) * 0.04, good = Math.round((trs * X.rate * 460) / 60), scrap = Math.round(good * (X.scrap[k > 20 ? 0 : 1] / 100) * (0.8 + rnd() * 0.4));
      base.trsShifts.push({ id: `FP-${C}${k}${team[0]}`, line_id: lid, site_id: siteId, workshop_id: null, date: day, team, shift_min: 480, planned_min: 20, stops: [{ kind: "Changement de série", min: 20 + Math.round(rnd() * 20), note: "" }, { kind: "Panne", min: Math.round(rnd() * 25), note: X.losses[0].split(" :")[0] }], micro_n: 4 + Math.round(rnd() * 8), micro_min: 6 + Math.round(rnd() * 14), good, scrap, rate_ph: X.rate, by: X.lead, created_at: at(k, "17:00"), updated_at: at(k, "17:00") });
    }
    if (k <= 10) for (let i = 0; i < 4; i++) base.microStops.push({ id: `MS-${C}${k}-${i}`, line_id: lid, site_id: siteId, at: new Date(`${day}T${String(8 + i * 2).padStart(2, "0")}:${String(10 + Math.round(rnd() * 40)).padStart(2, "0")}:00`).toISOString(), cause: base.mlLines.at(-1).causes[i % 4], dur_s: 60 + Math.round(rnd() * 200), timed: true, by: X.lead });
  }
  const t = kpi("trs"), sc = kpi("scrap");
  for (const w of weeks) {
    const day = pnMeetingDay(board, w), from = pnDate(day, -7), sh = base.trsShifts.filter((s) => s.line_id === lid && s.date > from && s.date <= day);
    if (!sh.length) continue;
    const req = sh.reduce((s, x) => s + (x.rate_ph * (x.shift_min - x.planned_min)) / 60, 0);
    if (t) base.measures.push({ id: uid("MES"), site_id: siteId, kpi_id: t.id, code: t.code, axis: t.axis, unit: t.unit, period: w, value: +((100 * sh.reduce((s, x) => s + x.good, 0)) / req).toFixed(1), target: t.target, definition: t.definition, source: `Feuilles de poste ${X.line}`, entry_mode: "panneau", board_id: board.id, synced_at: now() });
    if (sc) base.measures.push({ id: uid("MES"), site_id: siteId, kpi_id: sc.id, code: sc.code, axis: sc.axis, unit: sc.unit, period: w, value: +((100 * sh.reduce((s, x) => s + x.scrap, 0)) / sh.reduce((s, x) => s + x.good + x.scrap, 0)).toFixed(1), target: sc.target, definition: sc.definition, source: `Feuilles de poste ${X.line}`, entry_mode: "panneau", board_id: board.id, synced_at: now() });
  }
  return board;
}

/* ---------- Rubriques transverses, pour les sept sites ---------- */

function exAllSites(base) {
  const d = (k) => pnDate(today(), -k), at = (k, h = "09:00") => new Date(`${d(k)}T${h}:00`).toISOString();
  const SITES = ["marzin", ...Object.keys(EX_SITES)], code = (s) => (s === "marzin" ? "MAR" : EX_SITES[s].code);
  const line = (s) => (s === "marzin" ? "Déligneuse" : EX_SITES[s].line), lead = (s) => (s === "marzin" ? PN_PEOPLE.lead : EX_SITES[s].lead), maint = (s) => (s === "marzin" ? PN_PEOPLE.maint : EX_SITES[s].maint);
  const wsOf = (s) => (base.workshops || []).find((w) => w.site_id === s)?.id || null;
  let seed = 11; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  /* Environnement : douze mois par site */
  const scale = { marzin: 1, "ag-deco": 0.8, europlacage: 1.2, "le-moine": 0.5, "oraison-menuiserie": 0.9, profiline: 1.3, sodeplax: 1.1 };
  base.envMonths = [];
  for (const s of SITES) for (let i = 12; i >= 1; i--) {
    const dt = new Date(today() + "T12:00:00"); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
    const mo = dt.toISOString().slice(0, 7), k = (12 - i) / 11, f = scale[s];
    base.envMonths.push({ id: `ENV-${code(s)}-${mo}`, site_id: s, month: mo, prod_qty: Math.round(f * (41000 + 3000 * Math.sin(i))), elec_kwh: Math.round(f * (158000 - 14000 * k)), gas_kwh: Math.round(f * (62000 - 8000 * k + (dt.getMonth() < 3 || dt.getMonth() > 9 ? 14000 : 0))), water_m3: Math.round(f * (820 - 110 * k)), waste_t: +(f * (46 - 6 * k)).toFixed(1), waste_valo_t: +(f * (31 + 2 * k)).toFixed(1), haz_t: +(f * (1.8 - 0.4 * k)).toFixed(2), note: "", by: lead(s) });
  }

  /* 5S : une zone par site (deux à Marzin), deux audits, étiquettes rouges */
  base.zones = []; base.redTags = [];
  const zonesDef = SITES.flatMap((s) => (s === "marzin" ? [[s, "Z-MAR1", "Déligneuse"], [s, "Z-MAR2", "Préparation et expédition"]] : [[s, `Z-${code(s)}1`, line(s)]]));
  for (const [s, zid, name] of zonesDef) {
    base.zones.push({ id: zid, name, site_id: s, workshop_id: wsOf(s), owner: lead(s), five_s: { frequency_days: 14, target: 80, ref_photos: [exPh(zid === "Z-MAR2" ? "marquage-jaune" : "zone-apres")] }, created_at: at(50), updated_at: at(14) });
    const lvl = s === "profiline" ? [1.6, 1.9] : s === "le-moine" ? [0.7, 1.0] : [1.0, 1.4 + rnd() * 0.3];
    [[30, lvl[0]], [9, lvl[1]]].forEach(([ago, m], n) => {
      const answers = Object.fromEntries(CS_CRITERIA.map(([, cid], j) => [cid, { v: Math.max(0, Math.min(2, Math.round(m + (rnd() - 0.5) * 1.2 - (j % 5 === 4 ? 0.4 : 0)))), note: "" }]));
      const scores = csScores(answers), total = csTotal(scores);
      base.audits.push({ id: `AUD-5S-${zid}-${n + 1}`, site_id: s, workshop_id: wsOf(s), zone_id: zid, scope: name, owner: lead(s), type: "5S", status: "Terminé", performed_at: d(ago), five_s: { answers, s_scores: scores, target: 80 }, audit_data: { criteria: [] }, score: total, created_at: at(ago), updated_at: at(ago) });
    });
  }
  base.redTags.push(
    { id: "RT-MAR1", site_id: "marzin", zone_id: "Z-MAR1", what: "Ancien carter de la déligneuse", qty: "1", reason: "Inutile", decision: "Jeter", owner: PN_PEOPLE.maint, due_date: d(-5), photo: exPh("etiquette-rouge"), status: "Ouverte", author: PN_PEOPLE.lead, created_at: at(9), updated_at: at(9) },
    { id: "RT-MAR2", site_id: "marzin", zone_id: "Z-MAR2", what: "Palettes cassées en bout d’allée", qty: "6", reason: "Défectueux", decision: "Jeter", owner: PN_PEOPLE.lead, due_date: d(2), photo: "", status: "Ouverte", author: PN_PEOPLE.op4, created_at: at(12), updated_at: at(12) },
    { id: "RT-SOD1", site_id: "sodeplax", zone_id: "Z-SOD1", what: "Bobines de film entamées sans étiquette", qty: "4", reason: "Inconnu", decision: "À décider", owner: EX_SITES.sodeplax.lead, due_date: d(-3), photo: exPh("etiquette-rouge"), status: "Ouverte", author: EX_SITES.sodeplax.lead, created_at: at(8), updated_at: at(8) },
  );

  /* TPM : une machine critique par site, standard CIL, tournées, étiquettes, pannes */
  base.machines = []; base.cilRuns = []; base.tpmTags = []; base.breakdowns = [];
  SITES.forEach((s, i) => {
    const mid = `MA-${code(s)}1`, pts = [["nettoyer", "Bac à copeaux et carters", "Aspirer, pas de soufflette", "jour", 5], ["inspecter", "Courroies et protections", "Tension, fissures, fixation", "semaine", 5], ["lubrifier", "Glissières", "Graisse G2, deux coups de pompe", "semaine", 3], ["serrer", "Fixations moteur", "Clé de 17, contrôle visuel des repères", "mois", 5]].map(([kind, what, how, freq, minutes], j) => ({ id: `CP-${code(s)}${j}`, kind, what, how, freq, minutes }));
    base.machines.push({ id: mid, name: s === "marzin" ? "Déligneuse" : line(s), site_id: s, zone_id: zonesDef.find((z) => z[0] === s)[1], criticality: "A", owner: maint(s), cil: pts, created_at: at(45), updated_at: at(20) });
    if (s === "marzin") base.machines.push({ id: "MA-MAR2", name: "Centre d’usinage Masterwood", site_id: s, zone_id: "Z-MAR1", criticality: "A", owner: PN_PEOPLE.maint, cil: [{ id: "CP-MAR2a", kind: "inspecter", what: "Joints des ventouses", how: "Joint fendu ou écrasé : prévenir la maintenance", freq: "semaine", minutes: 3 }, { id: "CP-MAR2b", kind: "nettoyer", what: "Table et ventouses", how: "Aspirer les copeaux", freq: "jour", minutes: 4 }], created_at: at(45), updated_at: at(15) },
      { id: "MA-MAR3", name: "Machine MIC", site_id: s, zone_id: "Z-MAR1", criticality: "B", owner: PN_PEOPLE.meth, cil: [{ id: "CP-MAR3a", kind: "inspecter", what: "Vis de butée", how: "Jeu visible : signaler", freq: "semaine", minutes: 2 }], created_at: at(45), updated_at: at(15) });
    [21, 14, 7].forEach((ago, n) => base.cilRuns.push({ id: `CIL-${code(s)}${n}`, site_id: s, machine_id: mid, date: d(ago), started_at: at(ago, "07:50"), ended_at: at(ago, "08:08"), by: lead(s), results: Object.fromEntries(pts.map((p, j) => [p.id, n === 1 && j === 1 ? "ano" : "ok"])), tag_ids: n === 1 ? [`TT-${code(s)}1`] : [], created_at: at(ago, "08:08") }));
    base.tpmTags.push({ id: `TT-${code(s)}1`, site_id: s, machine_id: mid, kind: i % 2 ? "usure" : "salete", color: i % 3 ? "bleue" : "rouge", what: i % 2 ? "Courroie fissurée sur le côté moteur" : "Copeaux accumulés derrière le carter", photo: s === "marzin" ? exPh("filtre-colmate") : "", status: i % 2 ? "ouverte" : "traitee", due_date: d(-7 + i), cil_point: `CP-${code(s)}1`, created_by: lead(s), created_at: at(14), updated_at: at(10) });
    base.breakdowns.push({ id: `PA-${code(s)}1`, machine_id: mid, site_id: s, start: at(18 + i, "10:15"), end: at(18 + i, `${11 + (i % 3)}:40`), cause: s === "marzin" ? "Aspiration en défaut : filtre colmaté" : "Courroie cassée", fix: s === "marzin" ? "Filtre nettoyé en urgence" : "Courroie remplacée", by: maint(s), created_at: at(18 + i), updated_at: at(18 + i) });
  });
  base.tpmTags.push({ id: "TT-MAR2", site_id: "marzin", machine_id: "MA-MAR2", kind: "usure", color: "rouge", what: "Joint de la ventouse 3 fendu", photo: exPh("ventouse-usee"), status: "traitee", due_date: d(26), cil_point: "CP-MAR2a", created_by: PN_PEOPLE.op2, created_at: at(33), updated_at: at(24) });
  base.tpmTags.push({ id: "TT-MAR3", site_id: "marzin", machine_id: "MA-MAR3", kind: "desserrage", color: "rouge", what: "Vis de butée : jeu visible, réglages à tâtons", photo: exPh("mic-butee"), status: "ouverte", due_date: d(-4), cil_point: "CP-MAR3a", created_by: PN_PEOPLE.op3, created_at: at(21), updated_at: at(9) });
  base.breakdowns.push({ id: "PA-MAR2", machine_id: "MA-MAR2", site_id: "marzin", start: at(33, "14:00"), end: at(33, "16:30"), cause: "Ventouse 3 ne tient plus le vide", fix: "Usinage sur 3 ventouses en attendant la pièce", by: PN_PEOPLE.maint, created_at: at(33), updated_at: at(33) });

  /* Audits terrain BIA (50 critères) : trois sites */
  [["marzin", 26, 2.4], ["sodeplax", 19, 2.1], ["profiline", 12, 3.4]].forEach(([s, ago, m], n) => {
    const criteria = Object.entries(AUDIT_CRITERIA).flatMap(([domain, list], di) => list.map((criterion, ci) => { const score = Math.max(0, Math.min(5, Math.round(m + (rnd() - 0.5) * 2.4 + (di % 3 === 0 ? 0.4 : 0) - (ci === 4 ? 0.5 : 0)))); return { domain, criterion, score, proof: score >= 3 ? "Vu au poste et confirmé par l’équipe" : "Écart constaté pendant le tour" }; }));
    const row = { id: `AUD-T-${code(s)}`, site_id: s, type: "Audit Terrain BIA", scope: `${line(s)} et abords`, owner: lead(s), performed_at: d(ago), status: "Terminé", audit_data: { criteria, auditor: PN_PEOPLE.lean, summary: n === 2 ? "Site le plus avancé : standards tenus, réglages repérés." : "Bases présentes ; standards et maintenance de premier niveau à écrire." }, current_domain: 0, created_at: at(ago), updated_at: at(ago) };
    row.score = Math.round((criteria.reduce((sum, c) => sum + c.score, 0) / 250) * 100);
    try { row.audit_data.domain_scores = Object.fromEntries(auDomains().map(([dd]) => [dd, auDomainScore(row, dd)])); } catch { /* calcul refait à l’ouverture */ }
    row.audit_data.proof_count = criteria.length;
    base.audits.push(row);
  });

  /* Chantiers, SMED, équilibrage */
  const proj = (id, s, title, method, status, progress, ago, o) => ({ id, site_id: s, title, method, status, owner: o.owner, progress, target_date: d(-o.due), baseline: o.base, target: o.target, result: o.result, problem_id: o.problem || null, action_ids: o.actions || [], objective_id: null, kpi_id: (base.kpis || []).find((k) => k.code === (o.kpi || "trs"))?.id, created_at: at(ago),
    charter: { problem: o.problem_text, scope: o.scope, team: o.team, sponsor: o.sponsor }, kpi: { label: o.kpiLabel, unit: o.unit, base: o.b, target: o.t }, steps_done: Object.fromEntries(CD_KEYS.slice(0, o.steps).map((k, i) => [k, d(ago - 6 * (i + 1))])), weather: [{ at: at(ago - 7), s: "ok", note: "Équipe constituée", by: o.owner }, { at: at(3), s: o.weather, note: o.wnote, by: o.owner }], measures: o.measures.map(([k, v]) => ({ date: d(k), value: v, by: o.owner })) });
  base.projects = [
    proj("CH-MAR1", "marzin", "Réglages machine MIC en moins de 20 minutes", "SMED", "Mesure", 35, 20, { owner: PN_PEOPLE.meth, due: 60, base: "45 min par changement", target: "20 min", result: "Cinq changements filmés ; pièce attendue", problem_text: "Réglages longs, vis de butée usée", scope: "Machine MIC, tous les changements", team: "Sophie M., Lucas F., Karim B.", sponsor: PN_PEOPLE.dir, kpiLabel: "Temps de changement", unit: "min", b: 45, t: 20, steps: 2, weather: "block", wnote: "Pièce fournisseur en retard : escaladé au TOP 15", measures: [[18, 47], [15, 44]], actions: ["A-PN41", "A-PN42"] }),
    proj("CH-SOD1", "sodeplax", "TRS de l’enrobeuse 1 à 85 %", "TPM", "Analyse", 50, 35, { owner: EX_SITES.sodeplax.maint, due: 45, base: "TRS 78 %", target: "85 %", result: "Pertes classées en 6 familles", problem_text: "Arrêts de nettoyage et changements de film", scope: "Enrobeuse 1, deux équipes", team: "Kevin A., Yves P., deux opérateurs", sponsor: "Directeur de site Sodeplax", kpiLabel: "TRS", unit: "%", b: 78, t: 85, steps: 3, weather: "ok", wnote: "Nettoyage des rouleaux standardisé", measures: [[30, 78], [20, 80], [8, 82]], kpi: "trs" }),
    proj("CH-PRO1", "profiline", "Changement de série profileuse en 35 minutes", "SMED", "Essai", 70, 50, { owner: EX_SITES.profiline.lead, due: 20, base: "52 min", target: "35 min", result: "38 min sur les 10 derniers changements", problem_text: "Changements longs, réglages à tâtons", scope: "Profileuse 2", team: "Nora L., Denis R.", sponsor: "Directeur de site Profiline", kpiLabel: "Temps de changement", unit: "min", b: 52, t: 35, steps: 4, weather: "ok", wnote: "Repères gravés sur les outils", measures: [[40, 52], [25, 44], [10, 38]] }),
    proj("CH-ORA1", "oraison-menuiserie", "Équilibrer la ligne de montage fenêtres", "Kaizen", "Mesure", 30, 15, { owner: EX_SITES["oraison-menuiserie"].lead, due: 40, base: "Poste 3 à 118 % du takt", target: "Tous les postes sous le takt", result: "Chronométrage des 4 postes fait", problem_text: "Poste 3 surchargé, fenêtres en attente", scope: "Ligne fenêtres", team: "Laura B., méthodes", sponsor: "Directeur de site Oraison", kpiLabel: "Charge du poste 3", unit: "% du takt", b: 118, t: 95, steps: 2, weather: "risk", wnote: "Quincaillerie en rupture : essais décalés", measures: [[12, 118]] }),
  ];
  base.smed = [
    { id: "SMED-MAR1", site_id: "marzin", project_id: "CH-MAR1", title: "Changement de série machine MIC", owner: PN_PEOPLE.meth, target_min: 20, per_week: 12, chrono: null, ops: [["Chercher les clés de réglage", 240, "interne", "externe"], ["Démonter le gabarit", 420, "interne", "reduite"], ["Régler la butée à tâtons", 1500, "interne", "reduite"], ["Monter le nouveau gabarit", 360, "interne", "inchangee"], ["Pièce d’essai et contrôle", 300, "interne", "inchangee"]].map(([label, dur_s, type, after], i) => ({ id: `OP-MAR${i}`, label, dur_s, type, after, ...(after !== "inchangee" ? { action: after === "externe" ? "Porte-outils au poste (idée de Lucas F.)" : "Vis de butée neuve et repères gradués", who: PN_PEOPLE.meth, when: d(-12) } : {}) })), measures: [{ date: d(18), min: 47, by: PN_PEOPLE.meth }, { date: d(15), min: 44, by: PN_PEOPLE.meth }], standard_id: null, created_at: at(20), updated_at: at(15) },
    { id: "SMED-PRO1", site_id: "profiline", project_id: "CH-PRO1", title: "Changement de série profileuse 2", owner: EX_SITES.profiline.lead, target_min: 35, per_week: 18, chrono: null, ops: [["Préparer les outils suivants", 600, "externe", "externe"], ["Démonter les outils", 540, "interne", "reduite"], ["Monter et régler sur repères", 900, "interne", "reduite"], ["Première pièce", 240, "interne", "inchangee"]].map(([label, dur_s, type, after], i) => ({ id: `OP-PRO${i}`, label, dur_s, type, after })), measures: [{ date: d(40), min: 52, by: "Nora L." }, { date: d(25), min: 44, by: "Nora L." }, { date: d(10), min: 38, by: "Nora L." }], standard_id: null, created_at: at(50), updated_at: at(10) },
  ];
  const st = ["Préparation cadre", "Assemblage", "Vissage et quincaillerie", "Vitrage et contrôle"].map((name, i) => ({ id: `ST-ORA${i}`, name, operators: 1 }));
  const els = [[0, "Prendre les profilés", 45, "nva"], [0, "Coupe d’angle", 120, "va"], [0, "Ébavurer", 40, "va"], [1, "Assembler le cadre", 160, "va"], [1, "Attendre le cadre précédent", 35, "muda"], [2, "Visser les paumelles", 110, "va"], [2, "Poser la crémone", 95, "va"], [2, "Chercher la quincaillerie", 70, "muda"], [2, "Contrôler le jeu", 40, "nva"], [3, "Poser le vitrage", 150, "va"], [3, "Contrôle final", 45, "nva"]];
  base.balances = [{ id: "EQ-ORA1", site_id: "oraison-menuiserie", project_id: "CH-ORA1", title: "Ligne de montage fenêtres", owner: EX_SITES["oraison-menuiserie"].lead, demand_per_day: 140, available_min: 440, stations: st, elements: els.map(([si, label, sec, kind], i) => ({ id: `EL-ORA${i}`, station_id: st[si].id, label, sec, kind, ...(kind === "muda" ? { who: EX_SITES["oraison-menuiserie"].lead, when: d(-10) } : {}) })), chrono: null, baseline: null, created_at: at(15), updated_at: at(8) }];

  /* Standards au poste */
  const stdDoc = (id, s, title, status, steps, ppe, ago) => ({ id, site_id: s, type: "STANDARD", title, owner: lead(s), status, problem_id: null, structured_data: { st: { zone_id: zonesDef.find((z) => z[0] === s)[1], ppe, steps: steps.map(([t, pts, why, photo, sec], i) => ({ id: `${id}-E${i}`, title: t, points: pts.map(([kind, text]) => ({ kind, text })), reason: why, photo: photo ? exPh(photo) : "", time_s: sec })), reaction: typeof ST_REACTION !== "undefined" ? ST_REACTION : "Arrêter, prévenir le chef d’équipe, isoler les pièces.", approved_by: status === "Validé" ? PN_PEOPLE.dir : "", approved_at: status === "Validé" ? at(ago - 2) : null, effective_date: status === "Validé" ? d(ago - 3) : null, trained: status === "Validé" ? [{ name: "Mathis P.", date: d(ago - 4), by: PN_PEOPLE.lead, version: 1 }, { name: "Lucas F.", date: d(ago - 4), by: PN_PEOPLE.lead, version: 1 }] : [] } }, version: 1, created_at: at(ago), updated_at: at(ago - 2) });
  base.documents.push(
    stdDoc("DOC-ST-MAR1", "marzin", "Démarrage de la déligneuse", "Validé", [["Vérifier l’aspiration", [["securite", "Clapet ouvert, voyant vert"], ["geste", "Tirer la trappe du bac à copeaux"]], "Sans aspiration, poussière et arrêts.", "filtre-propre", 60], ["Régler le guide", [["qualite", "Largeur au réglet, ± 0,5 mm"], ["geste", "Bloquer la manette avant de lancer"]], "Une largeur fausse fait tout le lot.", "deligneuse-copeaux", 90], ["Premier panneau contrôlé", [["qualite", "Mesurer la largeur aux deux bouts"]], "Le premier panneau valide la série.", "standard-poste", 45]], ["Lunettes", "Protection auditive", "Chaussures de sécurité"], 16),
    stdDoc("DOC-ST-SOD1", "sodeplax", "Changement de film de l’enrobeuse", "En révision", [["Consigner la machine", [["securite", "Arrêt d’urgence enclenché, cadenas posé"]], "Le carter peut se soulever.", "enrobeuse", 60], ["Monter la bobine", [["geste", "Sens de déroulement vers l’opérateur"], ["qualite", "Référence de film contrôlée"]], "Un mauvais film fait un lot à refaire.", "", 180]], ["Gants anti-coupure", "Chaussures de sécurité"], 22),
    { id: "DOC-BA-MAR1", site_id: "marzin", type: "BEFORE_AFTER", title: "Poste de débit : bac à chutes", owner: PN_PEOPLE.lead, status: "Validé", kaizen_id: "KAI-PN1", structured_data: { problem: "Chutes au sol au poste de débit : on marche dessus.", gain: "Irritant supprimé, poste propre en fin de journée.", before_photo: exPh("zone-avant"), after_photo: exPh("zone-apres"), description: "Un bac sur roulettes sous la table de débit, vidé chaque soir." }, content: "Un bac sur roulettes sous la table de débit, vidé chaque soir.", version: 1, created_at: at(12), updated_at: at(6) },
    { id: "DOC-BA-MAR2", site_id: "marzin", type: "BEFORE_AFTER", title: "Filtre d’aspiration de la déligneuse", owner: PN_PEOPLE.maint, status: "Validé", kaizen_id: null, structured_data: { problem: "Filtre colmaté : 3 h d’arrêt par semaine.", gain: "Arrêts de 40 à 7 min par jour.", before_photo: exPh("filtre-colmate"), after_photo: exPh("filtre-propre"), description: "Filtre et gaine changés, nettoyage chaque vendredi (OPL-PN1)." }, content: "Filtre et gaine changés, nettoyage chaque vendredi (OPL-PN1).", version: 1, created_at: at(11), updated_at: at(10) },
  );

  /* Échantillothèque */
  const sample = (id, scope, site_id, client, articles, defect, zone, criterion, tol_max, tol_unit, over, status, ago) => ({ id, scope, site_id, client, articles, defect, zone, criterion, tol_max, tol_unit, over, distance_m: 1, lux: 800, seconds: 5, location: "Tableau qualité de l’atelier", photos: { ok: exPh("echantillon-ok"), limit: exPh("echantillon-limite"), nok: exPh("echantillon-nok") }, status, validated_by: status === "Validée" ? PN_PEOPLE.qual : "", validated_at: status === "Validée" ? at(ago) : null, review_months: 12, version: status === "Validée" ? 1 : 0, created_at: at(ago + 3), updated_at: at(ago) });
  base.samples = [
    sample("ECH-G1", "group", "group", "Tous clients", "Panneaux décor, face vue", "Aspect, rayure", "A · face vue", "Rayure visible à 1 m en 5 secondes : refusée", 0, "mm", "Refusé", "Validée", 30),
    sample("ECH-MAR1", "marzin", "marzin", "Client A (fictif)", "Façades usinées FAC-450 et FAC-600", "Usinage", "B · chant, face peu visible", "Décalage de perçage", 0.5, "mm", "Refusé", "Validée", 20),
    sample("ECH-SOD1", "sodeplax", "sodeplax", "Tous clients", "Profilés plaxés blancs", "Collage, décollement", "A · face vue", "Bulle ou décollement en bout de profilé", 2, "mm²", "À retoucher", "Validée", 14),
    sample("ECH-EUR1", "europlacage", "europlacage", "Client B (fictif)", "Panneaux plaqués chêne", "Placage", "C · face cachée", "Fente du placage", 20, "mm", "Déclassé", "Brouillon", 4),
  ];

  /* Polyvalence */
  const lvl = (rows) => Object.fromEntries(rows.flatMap(([pid, levels], i) => levels.map((v, j) => [`${pid}|ST${j}`, { lvl: v, date: d(30 - i * 3 - j), by: PN_PEOPLE.lead, hist: [] }])));
  base.skillsMatrix = [
    { id: "PV-MAR1", site_id: "marzin", name: "Atelier de Marzin", zone_id: "Z-MAR1", stations: ["Déligneuse", "Masterwood", "Machine MIC", "Préparation", "Débit"].map((name, i) => ({ id: `ST${i}`, name, standard_id: i === 0 ? "DOC-ST-MAR1" : null, target: 3 })), people: ["Mathis P.", "Inès D.", "Lucas F.", "Camille T.", "Karim B.", "Nora L."].map((name, i) => ({ id: `PP${i}`, name, person_id: `PER-PN${[3, 4, 5, 6, 1, 2][i]}` })), levels: lvl([["PP0", [4, 1, 0, 2, 3]], ["PP1", [2, 4, 1, 0, 3]], ["PP2", [1, 2, 4, 0, 2]], ["PP3", [0, 0, 0, 4, 2]], ["PP4", [3, 3, 3, 3, 4]], ["PP5", [3, 2, 2, 3, 3]]]), created_at: at(40), updated_at: at(6) },
    { id: "PV-SOD1", site_id: "sodeplax", name: "Enrobage", zone_id: "Z-SOD1", stations: ["Enrobeuse 1", "Enrobeuse 2", "Préparation colle", "Contrôle"].map((name, i) => ({ id: `ST${i}`, name, standard_id: i === 0 ? "DOC-ST-SOD1" : null, target: 3 })), people: ["Kevin A.", "Opérateur 1", "Opérateur 2", "Opérateur 3", "Opératrice 4"].map((name, i) => ({ id: `PP${i}`, name, person_id: null })), levels: lvl([["PP0", [4, 4, 3, 3]], ["PP1", [3, 1, 0, 2]], ["PP2", [2, 3, 1, 0]], ["PP3", [0, 2, 3, 1]], ["PP4", [1, 0, 0, 4]]]), created_at: at(40), updated_at: at(9) },
  ];

  /* Relève, lettres du jour, informations Groupe */
  base.handovers = [
    { id: "REL-SOD1", site_id: "sodeplax", workshop_id: wsOf("sodeplax"), title: "Relève Matin → Après-midi", shift_from: "Matin", shift_to: "Après-midi", period: `${d(0)}T13:00`, author: EX_SITES.sodeplax.lead, status: "Transmise", checks: { securite: { s: "watch", note: "Carter de l’enrobeuse 2 : ne pas changer le film sans la maintenance" }, qualite: { s: "ok", note: "" }, machines: { s: "ok", note: "" }, production: { s: "ok", note: "OF 3312 terminé, OF 3313 lancé" }, matiere: { s: "watch", note: "Film blanc : 2 bobines restantes" }, effectif: { s: "ok", note: "Équipe complète" } }, priority_list: ["Finir l’OF 3313 avant 18 h", "Appeler la maintenance pour le carter"], situation: "Production normale, une vigilance sécurité.", safety: "Carter enrobeuse 2 : ne pas changer le film sans la maintenance.", quality: "RAS", staffing: "Équipe complète", production: "OF 3313 en cours", priorities: "1. Finir l’OF 3313. 2. Carter enrobeuse 2.", created_at: at(0, "13:00") },
    { id: "REL-EUR1", site_id: "europlacage", workshop_id: wsOf("europlacage"), title: "Relève Matin → Après-midi", shift_from: "Matin", shift_to: "Après-midi", period: `${d(1)}T13:00`, author: EX_SITES.europlacage.lead, status: "Lue", checks: { securite: { s: "ok", note: "" }, qualite: { s: "watch", note: "Fentes sur le chêne : trier la pile 4" }, machines: { s: "ok", note: "" }, production: { s: "ok", note: "" }, matiere: { s: "ok", note: "" }, effectif: { s: "watch", note: "Un absent, remplacé par l’intérim" } }, priority_list: ["Trier la pile 4"], situation: "Production normale.", safety: "RAS", quality: "Fentes sur le chêne : trier la pile 4.", staffing: "Un absent remplacé.", production: "Programme tenu", priorities: "1. Trier la pile 4.", created_at: at(1, "13:00") },
  ];
  base.sqcdpDays = [];
  SITES.forEach((s, i) => ["S", "Q", "C", "D", "P"].forEach((axis, j) => base.sqcdpDays.push({ id: `SJ-${code(s)}-${axis}`, site_id: s, workshop_id: wsOf(s), date: today(), axis, status: (i + j) % 6 === 1 ? "ko" : "ok", note: (i + j) % 6 === 1 ? `${AXES[axis].label} : écart signalé au point du jour` : "", topic_id: null, by: lead(s) })));
  base.infos.push({ id: "INF-G1", site_id: "group", workshop_id: null, title: "Gilet haute visibilité obligatoire en zone de chargement", why: "Dans tous les sites dès lundi : pas de gilet, pas d’accès aux quais. Gilets au magasin.", from: "Direction industrielle", start: d(4), end: d(-10), urgent: false, photo: exPh("epi"), relayed: SITES.filter((s, i) => i % 3 !== 2).map((s) => ({ site_id: s, workshop_id: null, at: at(2, "10:40"), by: lead(s) })), questions: [], created_at: at(4) });

  /* Bonnes pratiques et déploiement entre sites */
  base.practices.push({ id: "BP-PRO1", site_id: "profiline", title: "Réglage standard et contrôle de la première pièce", category: "Production", summary: "Repères gravés sur les outils et validation de la première pièce avant le lot.", evidence: "Changement de série : 52 → 38 min ; rebut de démarrage divisé par 2.", transfer: "Vérifier la famille de produits, créer un échantillon maître local, faire valider par les opérateurs.", status: "Publiée", validated_by: "Directeur de site Profiline", owner: EX_SITES.profiline.lead, kpi_id: (base.kpis || []).find((k) => k.code === "trs")?.id, source_id: "CH-PRO1", published_at: at(15) },
    { id: "BP-PRO2", site_id: "profiline", title: "Chariot multi-commandes", category: "Flux", summary: "Un chariot à 4 cases pour préparer 4 commandes d’un coup.", evidence: "Préparation : 95 → 62 min par série de commandes.", transfer: "Regrouper les commandes par zone de stock ; adapter le nombre de cases.", status: "Publiée", validated_by: "Directeur de site Profiline", owner: EX_SITES.profiline.lead, kpi_id: null, source_id: null, published_at: at(20) });
  base.deployments = [
    { id: "DEP-1", site_id: "sodeplax", practice_id: "BP-PN1", owner: EX_SITES.sodeplax.maint, due_date: d(-20), status: "Test", prerequisites: "Même type de filtre sur l’aspiration des rouleaux.", result: "Essai sur 3 vendredis en cours.", evidence: "Feuilles de poste de l’enrobeuse 1.", interest_at: at(4), tested_at: at(2) },
    { id: "DEP-2", site_id: "marzin", practice_id: "BP-PRO2", owner: PN_PEOPLE.lead, due_date: d(-15), status: "Test", prerequisites: "Préparation de commandes regroupée par zone.", result: "Idée KAI-PN4 de Camille T. : essai prévu.", evidence: "", interest_at: at(3) },
    { id: "DEP-3", site_id: "le-moine", practice_id: "BP-PRO1", owner: EX_SITES["le-moine"].lead, due_date: d(-30), status: "Candidate", prerequisites: "Gabarit de perçage d’abord.", result: "", evidence: "", interest_at: at(5) },
    { id: "DEP-4", site_id: "europlacage", practice_id: "BP-PRO1", owner: EX_SITES.europlacage.lead, due_date: d(10), status: "Déployée", prerequisites: "", result: "Réglage presse : 50 → 32 min.", evidence: "Dix changements chronométrés.", interest_at: at(40), tested_at: at(30), proven_at: at(20), deployed_at: at(12) },
  ];

  /* Gains : objectif Groupe et par site */
  base.gainTargets = [{ scope: "group", euros: 120000 }, { scope: "marzin", euros: 20000 }, ...Object.keys(EX_SITES).map((s) => ({ scope: s, euros: s === "le-moine" ? 8000 : 15000 }))];

  /* Photos dans l’histoire de Marzin */
  const set = (coll, id, patch) => { const r = (base[coll] || []).find((x) => x.id === id); if (r) Object.assign(r, patch); };
  set("signals", "S-PN1", { photo: exPh("deligneuse-copeaux") }); set("signals", "S-PN2", { photo: exPh("ventouse-usee") }); set("signals", "S-PN3", { photo: exPh("mic-butee") }); set("signals", "S-PN4", { photo: exPh("transpalettes-allee") });
  set("kaizens", "KAI-PN1", { before_photo: exPh("zone-avant"), after_photo: exPh("bac-chutes") }); set("kaizens", "KAI-PN2", { before_photo: exPh("porte-outils") }); set("kaizens", "KAI-PN5", { before_photo: exPh("transpalettes-allee"), after_photo: exPh("marquage-jaune") });
  set("opls", "OPL-PN1", { photo_a: exPh("filtre-propre"), photo_b: exPh("filtre-colmate") }); set("opls", "OPL-PN2", { photo_a: exPh("marquage-jaune"), photo_b: exPh("transpalettes-allee") }); set("opls", "OPL-PN3", { photo_a: exPh("ventouse-usee"), photo_b: exPh("ventouse-neuve") });
  for (const g of base.gembas || []) for (const o of g.observations || []) {
    const p = /transpalette/i.test(o.fact) ? "transpalettes-allee" : /copeaux|poste propre/i.test(o.fact) ? (/propre/.test(o.fact) ? "filtre-propre" : "deligneuse-copeaux") : /ventouse/i.test(o.fact) ? "ventouse-usee" : /EPI/.test(o.fact) ? "epi" : /panneau TOP 5/.test(o.fact) ? "panneau-top5" : "";
    if (p) { o.photo = exPh(p); o.photos = [exPh(p)]; }
  }
  const lastW = (base.boardWeeks || []).filter((w) => w.board_id === "PN-MARZIN").sort((a, b) => String(a.week).localeCompare(String(b.week))).at(-1);
  if (lastW) lastW.photo = exPh("panneau-top5");
  set("infos", "INF-PN2", { photo: exPh("filtre-propre") });
  set("practices", "BP-PN1", { before_photo: exPh("filtre-colmate"), after_photo: exPh("filtre-propre") });

  /* Résoudre : un 8D, un QRQC, un Ishikawa et un PDCA sur d’autres sites (créés comme dans l’application) */
  const keep = data;
  try {
    data = base;
    const mk = (args, fill, status, extra = {}) => { const { problem, document } = createProblemRecord(args); Object.assign(document.structured_data, fill); problem.status = status; Object.assign(problem, extra); document.status = status === "Clos" ? "Validé" : "En cours"; return problem; };
    const p8 = mk({ title: "Réclamation Client B · décollement du film sur profilé", site_id: "sodeplax", method: "8D", owner: EX_SITES.sodeplax.lead, context: "Douze profilés décollés en bout chez le client." },
      { d1: "Kevin A., qualité, maintenance enrobeuse", d3: "Stock client et atelier trié : 0 autre pièce ; contrôle à 100 % en sortie pendant 2 semaines", d4_occurrence: "Température de colle trop basse au démarrage de l’équipe d’après-midi", d4_escape: "Pas de test d’arrachement au premier profilé", d5: "Préchauffage de 20 min et test d’arrachement au démarrage", d6: "Fait depuis 9 jours : 0 décollement", d7: "Standard de démarrage mis à jour", d8: "" }, "Mesure", { nc_id: "NC-SOD2" });
    const nc = base.ncs.find((x) => x.id === "NC-SOD2"); if (nc) { nc.problem_id = p8.id; nc.decision = "8D"; nc.status = "En analyse"; }
    mk({ title: "Teinte décor hors tolérance au démarrage", site_id: "ag-deco", method: "QRQC", owner: EX_SITES["ag-deco"].lead, context: "Dix premiers panneaux plus foncés sur les séries claires." },
      { facts: "Écart de teinte ΔE 2,5 sur les 10 premiers panneaux ; uniquement sur les teintes claires", containment: "Panneaux isolés, série relancée après purge", cause: "Encre restée dans le circuit de la série précédente", escape: "Contrôle de teinte fait au 50e panneau seulement", corrective: "Purge de 2 minutes et contrôle au premier panneau", verification: "Trois séries claires sans écart", escalation: "" }, "Essai");
    const pk = mk({ title: "Fentes sur le placage chêne", site_id: "europlacage", method: "ISHIKAWA", owner: EX_SITES.europlacage.lead, context: "Fentes en sortie de presse sur feuilles de chêne." }, {}, "Analyse");
    const dk = base.documents.find((x) => x.problem_id === pk.id);
    if (dk) dk.structured_data.ik = { causes: [["material", "Feuilles trop sèches (humidité < 8 %)", "confirmee", "Mesure à l’hygromètre", "6 % mesurés sur la pile 4"], ["machine", "Pression de presse trop forte", "ecartee", "Essai à pression réduite", "Fentes identiques"], ["environment", "Stock de feuilles près du chauffage", "verifier", "Déplacer la pile une semaine", ""], ["method", "Pas de contrôle d’humidité à réception", "confirmee", "Lecture des fiches de réception", "Aucune mesure notée"]].map(([fam, text, status, test, proof], i) => ({ id: `IK-EUR${i}`, fam, text, status, test, proof, photo: "", why_id: null, action_id: null })) };
    mk({ title: "Poste 3 de la ligne fenêtres au-dessus du takt", site_id: "oraison-menuiserie", method: "PDCA", owner: EX_SITES["oraison-menuiserie"].lead, context: "Fenêtres en attente devant le poste 3." },
      { do: "Vissage des paumelles déplacé au poste 2 pendant une semaine", check: "Poste 3 à 96 % du takt, plus d’attente", act: "Nouvelle répartition écrite dans le standard de ligne" }, "Essai");
  } catch (e) { console.warn("Fiches de résolution non créées", e); } finally { data = keep; }

  /* Routines et relève à Marzin */
  base.routines = (base.routines || []).concat(SITES.flatMap((s) => [
    { id: `RIT-${code(s)}1`, site_id: s, workshop_id: wsOf(s), title: `TOP 5 · panneau de la semaine`, level: 1, frequency: "Hebdomadaire", owner: lead(s), date: pnDate(today(), 7 - ((new Date(today() + "T12:00:00").getDay() + 6) % 7) + (s === "marzin" ? 1 : EX_SITES[s].weekday)), status: "Prévu" },
    { id: `RIT-${code(s)}2`, site_id: s, workshop_id: null, title: "TOP 15 du site", level: 3, frequency: "Quotidien", owner: s === "marzin" ? PN_PEOPLE.dir : `Directeur de site ${typeof getSiteName === "function" ? getSiteName(s) : s}`, date: today(), status: "Prévu" },
  ]));
  base.handovers.push({ id: "REL-MAR1", site_id: "marzin", workshop_id: wsOf("marzin"), title: "Consignes du soir pour le lendemain", shift_from: "Journée", shift_to: "Journée", period: `${d(1)}T16:50`, author: PN_PEOPLE.lead, status: "Lue", checks: { securite: { s: "watch", note: "Transpalettes : vérifier les zones jaunes à 8 h" }, qualite: { s: "ok", note: "Premier panneau de chaque série contrôlé" }, machines: { s: "watch", note: "MIC : réglages avec le repère au feutre" }, production: { s: "ok", note: "Programme tenu" }, matiere: { s: "ok", note: "" }, effectif: { s: "ok", note: "Équipe complète" } }, priority_list: ["Contrôle des zones transpalettes à 8 h", "Nettoyage du filtre vendredi 16 h 30"], situation: "Journée normale.", safety: "Transpalettes : vérifier les zones jaunes.", quality: "RAS", staffing: "Équipe complète", production: "Programme tenu", priorities: "1. Zones transpalettes. 2. Filtre vendredi.", created_at: at(1, "16:50") });

  /* Chaque site a aussi : Gemba, rapport d’étonnement, OPL, standard, chantier, audit, polyvalence, SMED, roadmap, objectif, escalade, A3 */
  const others = Object.keys(EX_SITES);
  others.forEach((s, i) => {
    const X = EX_SITES[s], C = X.code;
    base.gembas.push({ id: `G-${C}1`, site_id: s, workshop_id: wsOf(s), zone: X.line, objective: "Tour de l’atelier avec le chef d’équipe", visited_at: at(10 + i * 3, "09:30"), created_at: at(10 + i * 3, "09:00"), author: PN_PEOPLE.lean, status: i % 2 ? "À vérifier" : "Actions en cours", observations: [
      { id: `G-${C}1-01`, fact: X.signals[1][2], category: X.signals[1][1] === "Sécurité" ? "Sécurité" : "Flux", kind: "risque", decision: "Action", standard: "", gap: "", operator: "", photo: exPh(X.signals[1][1] === "Sécurité" ? "transpalettes-allee" : "zone-avant"), photos: [exPh(X.signals[1][1] === "Sécurité" ? "transpalettes-allee" : "zone-avant")] },
      { id: `G-${C}1-02`, fact: `${X.losses[0].split(" :")[0]} : première perte citée par l’équipe.`, category: "Maintenance", kind: "fait", decision: "Sujet au TOP 5", standard: "", gap: "", operator: "", photo: exPh(X.photo), photos: [exPh(X.photo)] },
      { id: `G-${C}1-03`, fact: X.ideas[0][1], category: "Standard", kind: "piste", decision: "Idée", standard: "", gap: "", operator: "" },
      { id: `G-${C}1-04`, fact: "Le panneau TOP 5 est à jour et l’équipe sait dire ses trois messages.", category: "Management visuel", kind: "fait", decision: "Rien à faire", standard: "", gap: "", operator: "" },
    ] });
    base.etonnement[s] = { message: `${typeof getSiteName === "function" ? getSiteName(s) : s} : ${X.losses[0].split(" :")[0].toLowerCase()} en tête des pertes ; l’équipe a déjà des idées pour y répondre.`, from: d(40), to: today(), updated_at: at(5), themes: {
      "Maintenance": { analysis: `${X.losses[0]} par semaine selon le panneau.`, stake: "Temps perdu et qualité.", reco: "Maintenance de premier niveau écrite et suivie.", action: "Standard CIL de la machine critique, 2027." },
      "Sécurité": { analysis: X.signals[1][1] === "Sécurité" ? X.signals[1][2] : "Pas de risque immédiat vu pendant le tour.", stake: "Accident.", reco: "Traiter au TOP 5 de la semaine.", action: "5S sécurité des allées, premier trimestre 2027." } } };
    base.opls.push({ id: `OPL-${C}1`, site_id: s, workshop_id: null, kind: ["base", "securite", "probleme", "amelioration"][i % 4], title: X.subjects[0][0], station: X.line, author: X.maint, version: 1, status: i % 3 === 2 ? "brouillon" : "validee", photo_a: exPh(i % 2 ? "echantillon-ok" : "zone-apres"), photo_b: exPh(i % 2 ? "echantillon-nok" : "zone-avant"), points: [X.subjects[0][4], "Prévenir le chef d’équipe en cas de doute"], why: X.losses[0], minutes: 5, practice_id: null, validated_by: i % 3 === 2 ? "" : X.lead, validated_at: i % 3 === 2 ? null : at(6), trained: i % 3 === 2 ? [] : [{ name: "Opérateur 1", date: d(5), by: X.lead, version: 1 }], created_at: at(9), updated_at: at(6) });
    if (!base.documents.some((x) => x.type === "STANDARD" && x.site_id === s)) base.documents.push(stdDoc(`DOC-ST-${C}1`, s, `Démarrage · ${X.line}`, i % 2 ? "Brouillon" : "Validé", [["Contrôles de sécurité", [["securite", "Protections en place, arrêt d’urgence testé"]], "Démarrer en sécurité.", X.photo, 60], ["Premier produit", [["qualite", "Contrôle du premier produit avant la série"]], "Le premier produit valide la série.", "echantillon-ok", 90]], ["Chaussures de sécurité", "Lunettes"], 18 + i));
    if (!base.projects.some((x) => x.site_id === s)) base.projects.push(proj(`CH-${C}1`, s, X.subjects[0][0], ["DMAIC", "Kaizen", "PDCA", "VSM"][i % 4], ["Cadrage", "Mesure", "Analyse", "Essai"][i % 4], 15 + i * 12, 25, { owner: X.lead, due: 40 + i * 5, base: X.losses[0], target: "Divisé par 2", result: "Mesures en cours", problem_text: X.subjects[0][4], scope: X.line, team: `${X.lead.split(" (")[0]}, ${X.maint.split(" (")[0]}`, sponsor: `Directeur de site ${typeof getSiteName === "function" ? getSiteName(s) : s}`, kpiLabel: "Pertes par semaine", unit: "min", b: 120, t: 60, steps: 1 + (i % 4), weather: ["ok", "risk", "ok", "block"][i % 4], wnote: "Point fait au TOP 5", measures: [[20, 120], [8, 100 - i * 4]] }));
    if (!base.audits.some((x) => x.type === "Audit Terrain BIA" && x.site_id === s)) {
      const m = 1.8 + (i % 4) * 0.4, criteria = Object.entries(AUDIT_CRITERIA).flatMap(([domain, list], di) => list.map((criterion, ci) => { const score = Math.max(0, Math.min(5, Math.round(m + (rnd() - 0.5) * 2.4 - (ci === 4 ? 0.5 : 0)))); return { domain, criterion, score, proof: score >= 3 ? "Vu au poste" : "Écart constaté" }; }));
      const row = { id: `AUD-T-${C}`, site_id: s, type: "Audit Terrain BIA", scope: `${X.line} et abords`, owner: X.lead, performed_at: d(15 + i * 4), status: "Terminé", audit_data: { criteria, auditor: PN_PEOPLE.lean, summary: "Premier audit de référence du site." }, current_domain: 0, created_at: at(15 + i * 4), updated_at: at(15 + i * 4) };
      row.score = Math.round((criteria.reduce((sum, c) => sum + c.score, 0) / 250) * 100);
      try { row.audit_data.domain_scores = Object.fromEntries(auDomains().map(([dd]) => [dd, auDomainScore(row, dd)])); } catch { /* */ }
      row.audit_data.proof_count = criteria.length; base.audits.push(row);
    }
    if (!base.skillsMatrix.some((x) => x.site_id === s)) base.skillsMatrix.push({ id: `PV-${C}1`, site_id: s, name: X.line, zone_id: `Z-${C}1`, stations: [X.line, "Préparation", "Contrôle"].map((name, j) => ({ id: `ST${j}`, name, standard_id: j === 0 ? `DOC-ST-${C}1` : null, target: 2 })), people: [X.lead.split(" (")[0], "Opérateur 1", "Opérateur 2", "Opératrice 3"].map((name, j) => ({ id: `PP${j}`, name, person_id: null })), levels: lvl([["PP0", [4, 3, 3]], ["PP1", [3, 1, 0]], ["PP2", [1, 3, 2]], ["PP3", [0, 2, 4]]]), created_at: at(30), updated_at: at(10) });
    if (!base.smed.some((x) => x.site_id === s)) base.smed.push({ id: `SMED-${C}1`, site_id: s, project_id: null, title: `Changement de série · ${X.line}`, owner: X.lead, target_min: 30, per_week: 8 + i, chrono: null, ops: [["Chercher les outils", 300, "interne", "externe"], ["Démonter", 480, "interne", "reduite"], ["Régler", 900, "interne", "reduite"], ["Premier produit", 240, "interne", "inchangee"]].map(([label, dur_s, type, after], j) => ({ id: `OP-${C}${j}`, label, dur_s, type, after })), measures: [{ date: d(20), min: 34 + i * 2, by: X.lead }, { date: d(6), min: 31 + i * 2, by: X.lead }], standard_id: null, created_at: at(25), updated_at: at(6) });
    base.roadmap.push({ id: `RM-${C}1`, site_id: s, horizon: "0-30 jours", title: `TOP 5 tenu chaque semaine à ${typeof getSiteName === "function" ? getSiteName(s) : s}`, outcome: "Panneau reporté dans l’application après chaque réunion", owner: X.lead, status: "En cours", progress: 60 + i * 5, kpi: "Panneaux reportés / semaines", target_date: d(-20) },
      { id: `RM-${C}2`, site_id: s, horizon: "31-60 jours", title: X.subjects[0][0], outcome: "Perte divisée par 2", owner: X.maint, status: i % 2 ? "À lancer" : "En cours", progress: i % 2 ? 0 : 30, kpi: "Pertes par semaine (panneau)", target_date: d(-50) });
    base.objectives.push({ id: `OBJ-${C}`, site_id: s, parent_id: (base.objectives.find((o) => o.id === "OBJ-group") ? "OBJ-group" : null), title: `${X.subjects[0][0]} : perte divisée par 2`, level: "Site", kpi_id: (base.kpis || []).find((k) => k.code === "trs")?.id, target: 85, owner: `Directeur de site ${typeof getSiteName === "function" ? getSiteName(s) : s}`, year: new Date().getFullYear(), due_date: d(-90), status: "En cours" });
    base.escalations.push({ id: `ESC-${C}1`, site_id: s, source_id: `A-${C}1`, title: `${X.subjects[0][0]} : décision attendue`, level: 1 + (i % 3), owner: i % 3 === 2 ? "Directeur des opérations Groupe" : `Directeur de site ${typeof getSiteName === "function" ? getSiteName(s) : s}`, due_date: d(-3 - i), detail: X.subjects[0][4], result: "", status: "Ouverte", created_at: at(4) });
  });
  // Une ligne de roadmap par horizon et par site, des routines et des escalades à chaque niveau (écran « Aujourd’hui »)
  SITES.forEach((s, i) => {
    const nm = typeof getSiteName === "function" ? getSiteName(s) : s;
    base.roadmap.push({ id: `RM-${code(s)}3`, site_id: s, horizon: "61-90 jours", title: "Standards au poste sur les machines critiques", outcome: "Un standard validé par machine A", owner: lead(s), status: "À lancer", progress: 0, kpi: "Standards validés", target_date: d(-80) }, { id: `RM-${code(s)}4`, site_id: s, horizon: "3-12 mois", title: "Bonne pratique reprise d’un autre site", outcome: "Une pratique du catalogue déployée", owner: lead(s), status: "À lancer", progress: 0, kpi: "Pratiques déployées", target_date: d(-200) });
    base.routines.push({ id: `RIT-${code(s)}3`, site_id: s, workshop_id: wsOf(s), title: "Point atelier du matin", level: 2, frequency: "Quotidien", owner: lead(s), date: today(), status: "Prévu" });
    base.routines.push({ id: `RIT-${code(s)}4`, site_id: s, workshop_id: null, title: `Revue mensuelle : passage de ${nm}`, level: 4, frequency: "Mensuel", owner: "Directeur des opérations Groupe", date: d(-7), status: "Prévu" });
    if (!base.handovers.some((h) => h.site_id === s)) base.handovers.push({ id: `REL-${code(s)}1`, site_id: s, workshop_id: wsOf(s), title: "Consignes de fin de journée", shift_from: "Journée", shift_to: "Journée", period: `${d(1)}T16:45`, author: lead(s), status: "Lue", checks: { securite: { s: "ok", note: "" }, qualite: { s: i % 2 ? "watch" : "ok", note: i % 2 ? "Contrôle renforcé du premier produit" : "" }, machines: { s: "ok", note: "" }, production: { s: "ok", note: "Programme tenu" }, matiere: { s: i % 3 ? "ok" : "watch", note: i % 3 ? "" : "Stock bas sur une référence" }, effectif: { s: "ok", note: "" } }, priority_list: ["Premier produit contrôlé avant la série"], situation: "Journée normale.", safety: "RAS", quality: i % 2 ? "Contrôle renforcé du premier produit." : "RAS", staffing: "Équipe complète", production: "Programme tenu", priorities: "1. Premier produit contrôlé.", created_at: at(1, "16:45") });
    if (i === 0) base.routines.push({ id: "RIT-GRP4", site_id: "group", workshop_id: null, title: "Revue mensuelle des sites", level: 4, frequency: "Mensuel", owner: "Directeur des opérations Groupe", date: d(-7), status: "Prévu" });
    [1, 2, 3, 4].forEach((lv) => { if (!base.escalations.some((e) => e.site_id === s && e.level === lv)) base.escalations.push({ id: `ESC-${code(s)}L${lv}`, site_id: s, source_id: null, title: ["", "Outil manquant au poste", "Pièce de rechange à commander", "Investissement à arbitrer", "Arbitrage Groupe : budget maintenance"][lv], level: lv, owner: ["", lead(s), maint(s), `Directeur de site ${nm}`, "Directeur des opérations Groupe"][lv], due_date: d(-2 - lv), detail: "Remonté au TOP 5, décision attendue au niveau supérieur.", result: "", status: "Ouverte", created_at: at(3 + lv) }); });
  });
  base.roadmap.push({ id: "RM-MAR1", site_id: "marzin", horizon: "0-30 jours", title: "Panneau TOP 5 reporté chaque mardi", outcome: "Six semaines reportées", owner: PN_PEOPLE.lead, status: "Terminé", progress: 100, kpi: "Panneaux reportés / semaines", target_date: d(5) }, { id: "RM-MAR2", site_id: "marzin", horizon: "31-60 jours", title: "Maintenance de premier niveau sur les 3 machines critiques", outcome: "Standards CIL écrits et tenus", owner: PN_PEOPLE.maint, status: "En cours", progress: 45, kpi: "Tournées faites / prévues", target_date: d(-40) });
  base.objectives.push({ id: "OBJ-MAR", site_id: "marzin", parent_id: (base.objectives.find((o) => o.id === "OBJ-group") ? "OBJ-group" : null), title: "Déligneuse : arrêts d’aspiration sous 10 min par jour", level: "Site", kpi_id: (base.kpis || []).find((k) => k.code === "trs")?.id, target: 85, owner: PN_PEOPLE.dir, year: new Date().getFullYear(), due_date: d(-60), status: "En cours" });
  base.balances.push({ id: "EQ-MAR1", site_id: "marzin", project_id: null, title: "Préparation de commandes", owner: PN_PEOPLE.lead, demand_per_day: 48, available_min: 440, stations: ["Prélèvement", "Contrôle et emballage", "Expédition"].map((name, i) => ({ id: `ST-MAR${i}`, name, operators: 1 })), elements: [[0, "Lire la commande", 40, "nva"], [0, "Aller au stock et revenir", 260, "muda"], [0, "Prélever les panneaux", 180, "va"], [1, "Contrôler les références", 90, "nva"], [1, "Emballer", 210, "va"], [2, "Étiqueter et charger", 150, "va"], [2, "Chercher un transpalette", 70, "muda"]].map(([si, label, sec, kind], i) => ({ id: `EL-MAR${i}`, station_id: `ST-MAR${si}`, label, sec, kind, ...(kind === "muda" ? { who: PN_PEOPLE.lead, when: d(-14) } : {}) })), chrono: null, baseline: null, created_at: at(10), updated_at: at(5) });
  base.balances.push({ id: "EQ-LMO1", site_id: "le-moine", project_id: null, title: "Ligne de montage portes", owner: EX_SITES["le-moine"].lead, demand_per_day: 60, available_min: 440, stations: ["Préparation", "Montage", "Quincaillerie"].map((name, i) => ({ id: `ST-LMO${i}`, name, operators: 1 })), elements: [[0, "Prendre le vantail", 40, "nva"], [0, "Usiner les paumelles", 210, "va"], [1, "Monter le vantail", 260, "va"], [1, "Chercher la visseuse", 60, "muda"], [2, "Poser la quincaillerie", 240, "va"], [2, "Attendre les paumelles", 90, "muda"]].map(([si, label, sec, kind], i) => ({ id: `EL-LMO${i}`, station_id: `ST-LMO${si}`, label, sec, kind })), chrono: null, baseline: null, created_at: at(12), updated_at: at(7) });
  try {
    data = base;
    for (const [s, title, ctx] of [["le-moine", "Perçages des paumelles refaits à la main", "Un tiers des portes reprises au poste 2."], ["profiline", "Réglages de la profileuse différents d’un régleur à l’autre", "Rebut de démarrage variable selon l’équipe."]]) {
      const { problem, document } = createProblemRecord({ title, site_id: s, method: "A3", owner: EX_SITES[s].lead, context: ctx });
      Object.assign(document.structured_data, { background: ctx, current: "Mesure faite sur deux semaines", target: "Divisé par deux", analysis: "Observation au poste et 5 pourquoi", root_cause: s === "profiline" ? "Pas de repère de réglage sur les outils" : "Pas de gabarit de perçage", countermeasures: s === "profiline" ? "Repères gravés, première pièce validée" : "Gabarit en essai" });
      problem.status = s === "profiline" ? "Clos" : "Analyse"; document.status = s === "profiline" ? "Validé" : "En cours";
    }
  } catch (e) { console.warn("A3 des sites non créés", e); } finally { data = keep; }

  /* Plan d’actions : l’historique de chaque action (points, reports, statuts) et les revues passées */
  const POINTS = {
    "A-PN1": [[30, "Cinq idées des opérateurs remontées au TOP 5"], [14, "Bac à chutes en place au débit"], [3, "Deux idées restent à qualifier : éclairage et chariot"]],
    "A-PN2": [[34, "Sujet remonté au TOP 5 : 3 h d’arrêt par semaine"], [28, "A3 ouvert, pilote maintenance"], [22, "Débit mesuré à 40 % de la normale"], [12, "Filtre et gaine changés : arrêts divisés par 4"], [5, "OPL validée, 2 opérateurs formés sur 4"]],
    "A-PN3": [[33, "Ventouse 3 commandée, usinage sur 3 ventouses"], [24, "Ventouse changée, essai sur 20 panneaux conforme"], [8, "Contrôle des ventouses ajouté chaque lundi"], [1, "Trois semaines sans rebut : résolu"]],
    "A-PN4": [[22, "Réglages chronométrés : 45 min par changement"], [15, "Vis de butée commandée"], [9, "Délai fournisseur dépassé : escaladé au TOP 15"], [6, "Second fournisseur décidé, livraison sous 10 jours"]],
    "A-PN41": [[20, "Commande passée chez le fournisseur habituel"], [10, "Le fournisseur annonce deux semaines de retard"], [6, "Second fournisseur retenu au TOP 15, commande passée"]],
    "A-PN11": [[14, "Peinture de marquage commandée"], [6, "Marquage jaune fait au bout des allées"], [2, "Faite : à vérifier une semaine"]],
    "A-PN22": [[21, "Filtre et gaine commandés"], [16, "Intervention planifiée vendredi après-midi"], [12, "Fait : arrêts divisés par 4 dès la semaine suivante"]],
    "A-PN23": [[11, "Brouillon d’OPL écrit avec Mathis P."], [7, "OPL validée par le directeur"], [5, "Mathis P. et Lucas F. formés"]],
    "A-PN24": [[10, "Suivi lancé sur les feuilles de poste"], [3, "Deux semaines : 7 min d’arrêt par jour en moyenne"]],
  };
  const sinceDays = (iso) => Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 864e5));
  for (const a of base.actions) {
    if (a.updates?.length) continue;
    const age = sinceDays(a.created_at), who = a.owner || "Pilote";
    let pts = POINTS[a.id];
    if (!pts) {
      const mid = Math.max(1, Math.round(age / 2)), late = Math.max(1, Math.round(age / 5));
      pts = { Ouverte: [[Math.max(1, age - 1), "Action lancée, pilote prévenu"]], "En cours": [[Math.max(1, age - 2), "Démarrée"], [late, "Avancement : la moitié est faite"]], "À vérifier": [[Math.max(1, age - 2), "Démarrée"], [mid, "Avancement : presque terminée"], [late, "Faite, preuve à apporter"]], Clôturée: [[Math.max(1, age - 2), "Démarrée"], [mid, "Faite, preuve à apporter"], [late, `Clôturée : ${a.effectiveness || "efficacité vérifiée"}`]], Standby: [[Math.max(1, age - 2), "Démarrée"], [late, `Bloquée : ${a.description || "en attente"}`]] }[a.status] || [[late, "Point fait"]];
    }
    a.updates = pts.filter(([k]) => k < age + 1).map(([k, text]) => ({ at: at(k, "11:05"), text, by: who }));
    const steps = { Ouverte: ["Ouverte"], "En cours": ["Ouverte", "En cours"], "À vérifier": ["Ouverte", "En cours", "À vérifier"], Clôturée: ["Ouverte", "En cours", "À vérifier", "Clôturée"], Standby: ["Ouverte", "En cours", "Standby"] }[a.status] || [a.status];
    a.history = steps.map((st, i) => ({ status: st, note: i === 0 ? "Action créée" : "", at: at(Math.max(0, Math.round(age - (age * i) / steps.length)), "11:00") }));
  }
  const pn41 = base.actions.find((x) => x.id === "A-PN41");
  if (pn41) pn41.reschedules = [{ from: d(17), to: pn41.due_date, reason: "Retard du fournisseur", at: at(10, "11:10"), by: PN_PEOPLE.meth }];
  // Une revue du plan d’actions après chaque TOP 5 : Marzin sur cinq semaines, les autres sites sur deux
  base.actionReviews = [];
  for (const s of SITES) {
    const b = base.boards.find((x) => x.site_id === s);
    const nWeeks = s === "marzin" ? 5 : 2;
    for (let k = nWeeks - 1; k >= 0; k--) {
      const day = pnMeetingDay(b, pnDate(pnCurrentWeek(b), -7 * k)), end = new Date(`${day}T11:30:00`).getTime(), start = end - 7 * 864e5;
      const log = [];
      for (const a of base.actions.filter((x) => x.site_id === s)) for (const u of a.updates || []) {
        const t = new Date(u.at).getTime();
        if (t <= start || t > end) continue;
        const kind = /^Clôturée|résolu/i.test(u.text) ? "closed" : /^Faite|^Fait/.test(u.text) ? "done" : /^Bloquée|retard/i.test(u.text) ? "hold" : "note";
        log.push({ kind, id: a.id, title: a.title, owner: a.owner || "À désigner", text: kind === "closed" ? `clôturée, ${u.text}` : kind === "done" ? `faite, ${u.text}` : `point noté, ${u.text}` });
      }
      if (!log.length) continue;
      const nm = typeof getSiteName === "function" ? getSiteName(s) : s;
      const report = [`Revue du plan d’actions du ${new Date(day + "T12:00:00").toLocaleDateString("fr-FR")} · ${nm}`, `${log.length} action(s) passée(s) en revue.`, "", ...log.map((l) => `- ${l.id} ${l.title} (${l.owner}) : ${l.text}`)].join("\n");
      base.actionReviews.push({ id: `REV-${code(s)}-${k}`, site_id: s, at: new Date(`${day}T11:30:00`).toISOString(), started: new Date(`${day}T11:10:00`).toISOString(), by: lead(s), partial: false, log, report });
    }
  }

  /* Hoshin : la matrice de priorité des sites */
  const crit = [["c1", "Enjeu sécurité", 3], ["c2", "Pertes de production", 3], ["c3", "Qualité et réclamations", 2], ["c4", "Maturité Lean", 1], ["c5", "Envie de l’équipe de direction", 2]];
  const scores = { marzin: [3, 4, 3, 2, 5], sodeplax: [4, 4, 3, 2, 4], "ag-deco": [2, 3, 4, 2, 3], europlacage: [2, 2, 3, 3, 3], "le-moine": [4, 3, 3, 1, 4], "oraison-menuiserie": [3, 4, 2, 2, 3], profiline: [1, 2, 2, 4, 4] };
  base.hoshinPlan = { source: { file: "Exemple fictif", imported_at: at(30), by: PN_PEOPLE.lean }, phases: [], milestones: [], governance: [], risks: [], macroSteps: [], tracks: {}, macroTasks: [], topics: [], waves: {}, sequoia: {},
    matrix: { criteria: crit.map(([id, name, weight]) => ({ id, name, weight })), scores: Object.fromEntries(Object.entries(scores).map(([s, v]) => [s, Object.fromEntries(crit.map(([id], i) => [id, v[i]]))])), top: [{ site_id: "marzin" }, { site_id: "sodeplax" }, { site_id: "le-moine" }], fileTotals: {} } };
  return base;
}

/* ---------- Assemblage : l’exemple complet ---------- */

const exCleanBase = pnCleanDemo;
pnCleanDemo = function () {
  const base = exCleanBase.apply(this, arguments);
  base.meta.demo_revision = 9;
  base.meta.demo_story = "Exemple fictif : les sept sites du Groupe sur six semaines, toutes les rubriques renseignées. Marzin raconte l’histoire en détail, autour du plan d’action de son panneau TOP 5.";
  // Les rubriques stratégiques reprennent le scénario de formation (maturité, roadmap, objectifs)
  try {
    const legacy = pnFreshBase(true);
    for (const key of ["maturity", "roadmap", "objectives", "routines"]) base[key] = (legacy[key] || []).filter((r) => !/marzin-pilot/.test(r.workshop_id || ""));
    const lm = (legacy.maturity || []).filter((r) => r.site_id === "marzin");
    if (!base.maturity.some((r) => r.site_id === "le-moine")) base.maturity.push(...lm.map((r) => ({ ...r, id: r.id.replace("marzin", "le-moine"), site_id: "le-moine", level: Math.max(0, (r.level || 1) - 1) })));
  } catch (e) { console.warn("Rubriques stratégiques non reprises", e); }
  base.settings.shifts = ["Journée", "Matin", "Après-midi"];
  for (const [s, X] of Object.entries(EX_SITES)) exSiteInto(base, s, X);
  exAllSites(base);
  return base;
};

const exInitBase = osInit;
osInit = function () { const out = exInitBase.apply(this, arguments); try { exLoadPhotos(); } catch { /* */ } return out; };
