/**
 * injectPrerenderIntoIndex.js
 *
 * Injects `data/repos.prerender.html` into `index.html` between markers:
 *   <!-- PROJECTS_PRERENDER_START -->
 *   <!-- PROJECTS_PRERENDER_END -->
 *
 * Usage: node scripts/injectPrerenderIntoIndex.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = path.join(ROOT, "index.html");
const PRERENDER_HTML = path.join(ROOT, "data", "repos.prerender.html");

const START = "<!-- PROJECTS_PRERENDER_START -->";
const END = "<!-- PROJECTS_PRERENDER_END -->";

function main() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`❌ Missing ${INDEX_HTML}`);
    process.exit(1);
  }

  if (!fs.existsSync(PRERENDER_HTML)) {
    console.error(`❌ Missing ${PRERENDER_HTML}. Generate it first.`);
    process.exit(1);
  }

  const index = fs.readFileSync(INDEX_HTML, "utf-8");
  const fragment = fs.readFileSync(PRERENDER_HTML, "utf-8").trim();

  const startIdx = index.indexOf(START);
  const endIdx = index.indexOf(END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error(`❌ Markers not found or invalid in index.html`);
    console.error(`   Required markers: ${START} and ${END}`);
    process.exit(1);
  }

  const before = index.slice(0, startIdx + START.length);
  const after = index.slice(endIdx);

  const injected = `${before}\n${fragment}\n${after}`;
  fs.writeFileSync(INDEX_HTML, injected, "utf-8");

  console.log("✅  Injected prerendered projects into index.html");
}

main();
