/**
 * injectPrerenderIntoIndex.js
 *
 * Injects prerendered HTML fragments into `index.html` between markers.
 *
 * Injected fragments:
 * - data/featured.prerender.html:
 *     <!-- FEATURED_PRERENDER_START -->
 *     <!-- FEATURED_PRERENDER_END -->
 *
 * - data/work.prerender.html:
 *     <!-- WORK_PRERENDER_START -->
 *     <!-- WORK_PRERENDER_END -->
 *
 * - data/repos.prerender.html:
 *     <!-- PROJECTS_PRERENDER_START -->
 *     <!-- PROJECTS_PRERENDER_END -->
 *
 * Usage: node scripts/injectPrerenderIntoIndex.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INDEX_HTML = path.join(ROOT, "index.html");

const FEATURED_HTML = path.join(ROOT, "data", "featured.prerender.html");
const WORK_HTML = path.join(ROOT, "data", "work.prerender.html");
const PROJECTS_HTML = path.join(ROOT, "data", "repos.prerender.html");

const MARKERS = {
  featured: {
    start: "<!-- FEATURED_PRERENDER_START -->",
    end: "<!-- FEATURED_PRERENDER_END -->",
    file: FEATURED_HTML,
    label: "Featured",
  },
  work: {
    start: "<!-- WORK_PRERENDER_START -->",
    end: "<!-- WORK_PRERENDER_END -->",
    file: WORK_HTML,
    label: "Work",
  },
  projects: {
    start: "<!-- PROJECTS_PRERENDER_START -->",
    end: "<!-- PROJECTS_PRERENDER_END -->",
    file: PROJECTS_HTML,
    label: "Projects",
  },
};

function readFragmentOrFail(filepath, label) {
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Missing ${filepath}. Generate it first (${label}).`);
    process.exit(1);
  }
  return fs.readFileSync(filepath, "utf-8").trim();
}

function injectBetweenMarkers(source, startMarker, endMarker, fragment, label) {
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error(`❌ Markers not found or invalid for ${label} in index.html`);
    console.error(`   Required markers: ${startMarker} and ${endMarker}`);
    process.exit(1);
  }

  const before = source.slice(0, startIdx + startMarker.length);
  const after = source.slice(endIdx);

  return `${before}\n${fragment}\n${after}`;
}

function main() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`❌ Missing ${INDEX_HTML}`);
    process.exit(1);
  }

  let index = fs.readFileSync(INDEX_HTML, "utf-8");

  const featuredFragment = readFragmentOrFail(
    MARKERS.featured.file,
    MARKERS.featured.label,
  );
  index = injectBetweenMarkers(
    index,
    MARKERS.featured.start,
    MARKERS.featured.end,
    featuredFragment,
    MARKERS.featured.label,
  );

  const workFragment = readFragmentOrFail(
    MARKERS.work.file,
    MARKERS.work.label,
  );
  index = injectBetweenMarkers(
    index,
    MARKERS.work.start,
    MARKERS.work.end,
    workFragment,
    MARKERS.work.label,
  );

  const projectsFragment = readFragmentOrFail(
    MARKERS.projects.file,
    MARKERS.projects.label,
  );
  index = injectBetweenMarkers(
    index,
    MARKERS.projects.start,
    MARKERS.projects.end,
    projectsFragment,
    MARKERS.projects.label,
  );

  fs.writeFileSync(INDEX_HTML, index, "utf-8");
  console.log("✅  Injected featured + work + projects into index.html");
}

main();
