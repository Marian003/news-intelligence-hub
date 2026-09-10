// Captures screenshots of the running deployment for docs/screenshots/.
//
// Drives the real UI through the real login form against whatever is serving
// BASE_URL (by default the kind deployment at http://localhost), so the images
// are evidence of a working stack rather than mockups.
//
// Playwright is NOT a dependency of this repo - it is a ~115MB browser download
// used only to produce documentation images, so it stays out of the workspace
// manifests. Run it with a one-off npx:
//
//   npx --yes playwright@latest install chromium
//   BASE_URL=http://localhost npx --yes --package=playwright@latest \
//     node scripts/screenshots.mjs
//
// Prerequisite: the demo data must be loaded (scripts/k8s-seed.sh), otherwise
// the feed and graph render empty.

import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost';
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@nih.local';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'demo12345';
// Defaults to docs/screenshots/ next to this script. OUT_DIR lets the script be
// executed from a directory where playwright happens to be installed (ESM
// resolves imports relative to the file, and ignores NODE_PATH), without having
// to add a ~115MB browser dependency to this workspace.
const OUT = process.env.OUT_DIR
  ? process.env.OUT_DIR.replace(/\/?$/, '/')
  : new URL('../docs/screenshots/', import.meta.url).pathname;

const shots = [];

async function main() {
  await mkdir(OUT, {recursive: true});
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {width: 1440, height: 900},
    deviceScaleFactor: 2, // Retina-quality PNGs for a README.
  });

  const capture = async (name, description) => {
    // networkidle would hang on the SPA's polling; settle on the load event
    // plus a short beat for React to paint.
    await page.waitForTimeout(600);
    const file = `${OUT}${name}.png`;
    await page.screenshot({path: file, fullPage: false});
    shots.push({name, description});
    console.log(`  captured ${name}.png  - ${description}`);
  };

  console.log(`Capturing ${BASE} ...`);

  // --- Sign in through the real form -------------------------------------
  await page.goto(`${BASE}/login`, {waitUntil: 'load'});
  await capture('01-login', 'Sign-in screen');

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // The app redirects to the feed once the token is stored.
  await page.waitForURL(url => !url.pathname.startsWith('/login'), {
    timeout: 15000,
  });

  // --- Main feed ----------------------------------------------------------
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await page.waitForSelector('article, [class*="card"], main', {timeout: 15000});
  await capture('02-feed', 'Main feed: processed articles with summary, importance and entity tags');

  // --- Enriched article detail (a modal opened from a card) ---------------
  const card = page.locator('main button').first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(800);
    await capture('03-article-detail', 'Article detail: LLM-extracted summary, entities, categories and axis values');
    await page.keyboard.press('Escape');
  } else {
    console.log('  ! no article card found - is the demo seed loaded?');
  }

  // --- Entity graph -------------------------------------------------------
  await page.goto(`${BASE}/graph`, {waitUntil: 'load'});
  // react-flow mounts asynchronously; wait for it to actually render nodes.
  await page.waitForSelector('.react-flow__node', {timeout: 20000}).catch(() => {
    console.log('  ! no graph nodes rendered - is the demo seed loaded?');
  });
  await page.waitForTimeout(1200);
  await capture('04-entity-graph', 'Entity graph: articles and canonical entities, derived on read from article_entities');

  // --- Entities list ------------------------------------------------------
  await page.goto(`${BASE}/entities`, {waitUntil: 'load'});
  await capture('05-entities', 'Canonical entities with their merged alias forms (ADR-2)');

  await browser.close();

  console.log(`\nWrote ${shots.length} screenshots to docs/screenshots/`);
}

main().catch(err => {
  console.error('Screenshot capture failed:', err.message);
  process.exitCode = 1;
});
