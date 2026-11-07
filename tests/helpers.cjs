const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");
const scripts = [
  "lean-library.js",
  "v5.js",
  "experience.js",
  "workflows.js",
  "fieldwork.js",
  "documents-ui.js",
  "dashboards.js",
  "os-core.js",
  "os-views.js",
  "os-audits.js",
  "os-vsm.js",
  "os-app.js",
  "os-improvements.js",
  "actions-plan.js",
  "ux-shell.js",
  "journee.js",
  "indicateurs.js",
  "maturite.js",
  "hoshin.js",
  "modeles.js",
  "calepin.js",
  "etonnement.js",
  "cinqs.js",
  "audit50.js",
  "standards.js",
  "smed.js",
  "causes.js",
  "tpm.js",
  "polyvalence.js",
  "idees.js",
  "equilibrage.js",
  "sqcdp-jour.js",
  "vsm-flux.js",
  "pratiques.js",
  "bibliotheque.js",
  "signaux.js",
  "releve.js",
  "chantiers.js",
  "formation.js",
  "roadmap-revue.js",
  "avant-apres.js",
  "ecarts.js",
  "journal.js",
  "parametres.js",
  "connecteurs.js",
  "reunions.js",
  "cascade.js",
  "microarrets.js",
  "trs.js",
  "gains.js",
  "environnement.js",
  "nc.js",
  "echantillotheque.js",
  "tour.js",
  "ergonomie.js",
  "top5.js",
  "boot.js",
];
function app(t, stored, url = "https://bia.example/bia-production-system/") {
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e));
  const html = fs
    .readFileSync("index.html", "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<link[^>]*>/g, "");
  const dom = new JSDOM(html, {
    url,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.print = () => (w.printed = true);
  w.HTMLElement.prototype.scrollIntoView = () => {};
  if (stored) w.localStorage.setItem("biaProductionSystemV5", stored);
  for (const file of scripts) {
    const s = w.document.createElement("script");
    s.textContent = fs.readFileSync(file, "utf8");
    w.document.head.append(s);
  }
  const run = (s) => w.eval(s),
    q = (s) => w.document.querySelector(s),
    all = (s) => [...w.document.querySelectorAll(s)];
  const fill = (s, v) => {
    assert.ok(q(s), `Champ ${s}`);
    q(s).value = v;
    q(s).dispatchEvent(new w.Event("input", { bubbles: true }));
    q(s).dispatchEvent(new w.Event("change", { bubbles: true }));
  };
  const click = (s) => {
    assert.ok(q(s), `Bouton ${s}`);
    q(s).click();
  };
  const submit = (s) => {
    assert.ok(q(s), `Formulaire ${s}`);
    q(s).dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
  };
  t.after(() => {
    w.close();
    assert.deepEqual(
      errors.map((e) => e.message),
      [],
      "Erreurs JavaScript DOM",
    );
  });
  assert.ok(q("#appView").textContent.length > 100, "L’application démarre");
  return {
    w,
    run,
    q,
    all,
    fill,
    click,
    submit,
    stored: () => w.localStorage.getItem("biaProductionSystemV5"),
  };
}

module.exports = { app };
