/**
 * generateSkillsPrerender.js
 *
 * Reads `data/site.json` and injects prerendered skill tags into `index.html`
 * between marker comments.
 *
 * Usage: node scripts/generateSkillsPrerender.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_JSON = path.join(ROOT, "data", "site.json");
const INDEX_HTML = path.join(ROOT, "index.html");

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTags(tags) {
  return (tags || [])
    .map((tag) => {
      const priority = typeof tag.priority === "number" ? tag.priority : 1;
      const cls = priority === 2 ? "tag2" : priority === 3 ? "tag3" : "tag1";
      const label = tag.label ?? String(tag);
      return `<span class="${cls}">${escapeHtml(label)}</span>`;
    })
    .join("");
}

function injectBetween(html, startMarker, endMarker, content) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      `Missing or invalid markers: ${startMarker} ... ${endMarker}`,
    );
  }

  const before = html.slice(0, startIdx + startMarker.length);
  const after = html.slice(endIdx);

  return `${before}\n${content}\n${after}`;
}

function main() {
  if (!fs.existsSync(SITE_JSON)) {
    console.error(`❌ Missing ${SITE_JSON}`);
    process.exit(1);
  }
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`❌ Missing ${INDEX_HTML}`);
    process.exit(1);
  }

  const site = JSON.parse(fs.readFileSync(SITE_JSON, "utf-8"));
  const index = fs.readFileSync(INDEX_HTML, "utf-8");

  const coreHtml = renderTags(site.core);
  const systemsHtml = renderTags(site.systemsTools);
  const learningHtml = renderTags(site.learning);

  let updated = index;

  updated = injectBetween(
    updated,
    "<!-- SKILLS_CORE_START -->",
    "<!-- SKILLS_CORE_END -->",
    coreHtml,
  );

  updated = injectBetween(
    updated,
    "<!-- SKILLS_SYSTEMS_START -->",
    "<!-- SKILLS_SYSTEMS_END -->",
    systemsHtml,
  );

  updated = injectBetween(
    updated,
    "<!-- SKILLS_LEARNING_START -->",
    "<!-- SKILLS_LEARNING_END -->",
    learningHtml,
  );

  fs.writeFileSync(INDEX_HTML, updated, "utf-8");
  console.log("✅  Injected prerendered skill tags into index.html");
}

main();
