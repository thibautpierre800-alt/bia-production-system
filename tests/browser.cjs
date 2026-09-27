"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  if (!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)
    throw Error(
      "Installez Playwright : npm install --no-save playwright puis npx playwright install chromium",
    );
  ({ chromium } = require(
    path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright"),
  ));
}
const root = path.resolve(__dirname, "../dist");
const output = path.resolve(process.env.BIA_QA_OUTPUT || "qa-results");
const prefix = "/bia-production-system/";
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

async function main() {
  assert.ok(
    fs.existsSync(path.join(root, "index.html")),
    "Exécuter npm run build avant le navigateur",
  );
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const file = path.resolve(
      root,
      pathname.slice(prefix.length) || "index.html",
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (error, bytes) => {
      if (error) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.end(bytes);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  const errors = [],
    badResponses = [],
    report = { routes: 0, viewports: [], errors, badResponses };
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.BIA_CHROMIUM_EXECUTABLE || undefined,
      args: process.env.BIA_CHROMIUM_EXECUTABLE
        ? [
            "--no-sandbox",
            "--disable-gpu",
            "--no-zygote",
            "--single-process",
            "--disable-dev-shm-usage",
          ]
        : [],
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Europe/Paris",
      hasTouch: true,
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        badResponses.push(`${response.status()} ${response.url()}`);
    });
    const url = `http://127.0.0.1:${server.address().port}${prefix}`;
    const start = Date.now();
    await page.goto(url);
    assert.equal(await page.title(), "BIA Lean Operating System");
    await page.evaluate(() => {
      data = osFreshData(true);
      osInit();
      save();
      state.role = "lean";
      state.site = "group";
      state.workshop = null;
      state.view = "pilotage";
      state.osTab = "tower";
      render();
    });
    assert.ok(
      (await page.locator(".control-analysis-table tbody tr").count()) >= 5,
      "La Control Tower doit afficher les priorités multisites",
    );
    assert.equal(await page.locator(".os-purpose-strip").count(), 1);
    assert.deepEqual(
      await page.locator("#roleSelect option").allTextContents(),
      ["DG", "Responsable Lean", "Directeur de site", "Chef d’équipe", "Opérateur"],
    );
    const quickDock = await page.locator(".quick-action-dock").boundingBox();
    assert.ok(quickDock.width <= 110 && quickDock.height <= 60, "Raccourcis terrain compacts");
    report.initialRenderMs = Date.now() - start;
    await page.screenshot({
      path: path.join(output, "control-tower-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });

    // Every allowed route for all five functional profiles must render.
    const roles = await page.evaluate(() => Object.keys(ROLES));
    for (const roleId of roles) {
      const routes = await page.evaluate((id) => {
        state.role = id;
        state.site = canGroup() ? "group" : "marzin";
        state.workshop = null;
        return visibleNav().map((n) => n.id);
      }, roleId);
      for (const view of routes) {
        const result = await page.evaluate((view) => {
          state.view = view;
          render();
          return document.querySelector("#appView").textContent.length;
        }, view);
        assert.ok(result > 80, `${roleId} / ${view}`);
        report.routes++;
      }
    }
    await page.evaluate(() => {
      state.role = "lean";
      state.site = "group";
      state.workshop = null;
      closeModal();
    });
    for (const [width, height] of [
      [390, 844],
      [820, 1180],
      [1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      for (const view of [
        "home",
        "pilotage",
        "daily",
        "hoshin",
        "maturity",
        "kaizen",
        "sqcdp",
        "training",
        "deployment",
        "analysis",
        "terrain",
        "actions",
        "audits",
        "settings",
      ]) {
        await page.evaluate((view) => {
          state.view = view;
          state.osTab = "tower";
          render();
        }, view);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(
          overflow,
          false,
          `Débordement horizontal : ${width} / ${view}`,
        );
      }
      await page.evaluate(() => {
        state.view = "pilotage";
        render();
      });
      await page.screenshot({
        path: path.join(output, `control-tower-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      if (width === 390) {
        await page.waitForFunction(
          () =>
            document.querySelector(".sidebar").getBoundingClientRect().right <=
            1,
        );
        assert.ok(await page.locator("#menuButton").isVisible());
      }
      report.viewports.push(width);
    }

    // The Group SQCDP has a dedicated portrait display for a workshop screen.
    await page.setViewportSize({ width: 1080, height: 1920 });
    await page.evaluate(() => {
      state.role = "lean";
      state.site = "group";
      state.workshop = null;
      state.view = "sqcdp";
      state.presentation = true;
      render();
    });
    assert.equal(
      await page.evaluate(() => document.body.classList.contains("group-presentation")),
      true,
    );
    assert.equal(await page.locator(".sqcdp-cell").count(), 30);
    assert.ok(await page.locator(".group-display-exit").isVisible());
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "Débordement horizontal du SQCDP Groupe vertical",
    );
    await page.screenshot({
      path: path.join(output, "sqcdp-group-vertical.png"),
      fullPage: true,
      animations: "disabled",
    });
    report.groupVertical = true;
    await page.evaluate(() => {
      state.presentation = false;
      render();
    });

    // A browser-created Gemba survives a reload; fixtures only prepare scope.
    await page.evaluate(() => {
      state.site = "marzin";
      state.view = "terrain";
      state.terrainTab = "gemba";
      render();
    });
    await page.locator("[data-new-gemba]").click();
    await page.locator("#gembaZone").fill("Finition — réception navigateur");
    await page
      .locator("#gembaObjective")
      .fill("Vérifier le flux et les stocks");
    await page.locator("#gembaAuthor").fill("Équipe réception");
    await page.locator("#gembaForm button:not([type])").click();
    const gembaId = await page.evaluate(() => data.gembas[0].id);
    await page.reload();
    assert.equal(
      await page.evaluate(
        (id) => data.gembas.some((g) => g.id === id),
        gembaId,
      ),
      true,
    );
    await page.goto(url + "#hoshin");
    await page.reload();
    assert.match(await page.locator("#appView").innerText(), /Hoshin/);

    // Pointer drag and field edits persist on the graphical VSM.
    await page.evaluate(() =>
      osVsmForm(data.documents.find((d) => d.id === "DOC-VSM-demo")),
    );
    const graphic = page.locator("[data-vsm-graphic]").first();
    await graphic.scrollIntoViewIfNeeded();
    const before = await page.evaluate(
      () =>
        data.documents.find((d) => d.id === "DOC-VSM-demo").vsm.current.nodes[0]
          .x,
    );
    const box = await graphic.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 35,
      box.y + box.height / 2 + 15,
      { steps: 5 },
    );
    await page.mouse.up();
    const after = await page.evaluate(
      () =>
        data.documents.find((d) => d.id === "DOC-VSM-demo").vsm.current.nodes[0]
          .x,
    );
    assert.ok(after > before, "Déplacement VSM enregistré");
    await page.locator("#osVsmNode [name=ct]").fill("65");
    await page.locator("#osVsmNode button:not([type])").click();
    assert.equal(
      await page.evaluate(
        () =>
          data.documents.find((d) => d.id === "DOC-VSM-demo").vsm.current
            .nodes[0].ct,
      ),
      65,
    );
    await page.locator(".modal").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({
      path: path.join(output, "vsm-desktop.png"),
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, "vsm-mobile.png"),
      animations: "disabled",
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    // Touch selection opens the same persisted object on a phone viewport.
    await page.locator("[data-vsm-graphic]").nth(1).tap();
    assert.equal(
      await page.locator("#osVsmNode [name=name]").inputValue(),
      "Finition",
    );
    await page.evaluate(() => {
      closeModal();
      state.role = "dg";
      editDocument("DOC-VSM-demo");
    });
    assert.equal(await page.locator("#osVsmNode [name=ct]").isDisabled(), true);
    assert.equal(await page.locator("[data-vsm-add]").count(), 0);
    await page.evaluate(() => {
      closeModal();
      state.role = "lean";
      render();
    });

    // Offline reload uses one installed release, under a non-root base URL.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );
    await page.context().setOffline(true);
    await page.reload();
    assert.equal(await page.title(), "BIA Lean Operating System");
    assert.equal(
      await page.evaluate(
        (id) => data.gembas.some((g) => g.id === id),
        gembaId,
      ),
      true,
    );
    await page.context().setOffline(false);
    report.offline = true;
    report.pointerAndTouch = true;
    report.persistedGemba = gembaId;
    assert.deepEqual(errors, [], "Erreurs JavaScript");
    assert.deepEqual(badResponses, [], "Ressources introuvables");
    fs.writeFileSync(
      path.join(output, "browser-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
