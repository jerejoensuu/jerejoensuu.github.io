/**
 * generateWorkPrerender.js
 *
 * Generates static HTML fragments for:
 * - Featured Project section (data/featured.prerender.html)
 * - Work Experience section (data/work.prerender.html)
 *
 * Source of truth is `data/site.json`.
 *
 * Usage: node scripts/generateWorkPrerender.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_JSON = path.join(ROOT, "data", "site.json");

const OUT_FEATURED_HTML = path.join(ROOT, "data", "featured.prerender.html");
const OUT_WORK_HTML = path.join(ROOT, "data", "work.prerender.html");

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Safe-ish, minimal sanitation for bullet items that may contain a link.
 * This preserves existing behavior in your work bullets, where you already
 * include raw HTML like [Label](https://...) but render via innerHTML.
 *
 * We intentionally support only Markdown links: [text](url)
 * Everything else is escaped.
 */
function renderBulletText(raw) {
  const s = String(raw ?? "");

  // Convert markdown links only, escape everything else.
  // Example: "See [RokadaChess](https://...)" -> "See <a ...>RokadaChess</a>"
  // This is a deliberate constraint to avoid arbitrary HTML injection.
  const parts = [];
  let i = 0;

  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;

  while ((match = re.exec(s)) !== null) {
    const before = s.slice(i, match.index);
    if (before) parts.push(escapeHtml(before));

    const text = escapeHtml(match[1]);
    const href = escapeHtml(match[2]);

    parts.push(
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`,
    );

    i = match.index + match[0].length;
  }

  const tail = s.slice(i);
  if (tail) parts.push(escapeHtml(tail));

  return parts.join("");
}

function renderBullets(bullets) {
  const list = Array.isArray(bullets) ? bullets : [];
  if (list.length === 0) return "<ul></ul>";
  return `<ul>${list.map((b) => `<li>${renderBulletText(b)}</li>`).join("")}</ul>`;
}

function renderFeaturedCard(item) {
  if (!item) return "";

  const title = `${item.company ?? ""}${item.role ? ` - ${item.role}` : ""}`;

  const logoHtml = item.logo
    ? `
      <div class="featured-logo-container">
        <img
          src="${escapeHtml(item.logo)}"
          alt="${escapeHtml(item.logoAlt || item.company + " Logo")}"
          class="featured-thumbnail"
          loading="lazy"
        >
      </div>
    `
    : "";

  const links = Array.isArray(item.links) ? item.links : [];
  const linksHtml =
    links.length > 0
      ? `
        <div class="featured-links">
          ${links
            .map((l) => {
              const label = escapeHtml(l?.label || "Link");
              const href = escapeHtml(l?.href || "#");
              return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
            })
            .join("")}
        </div>
      `
      : "";

  return `
    <article class="featured-item">
      ${logoHtml}

      <div class="featured-content">
        <div class="featured-header">
          <h3 class="featured-title">${escapeHtml(title)}</h3>

          <div class="featured-meta">
            <span class="featured-years">${escapeHtml(item.years || "")}</span>
            ${linksHtml}
          </div>
        </div>

        <div class="featured-body">
          ${renderBullets(item.bullets)}
        </div>
      </div>
    </article>
  `.trim();
}

function renderWorkCards(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return "";

  return list
    .map((item) => {
      const logoHtml = item.logo
        ? `
          <div class="logo-container">
            <img
              src="${escapeHtml(item.logo)}"
              alt="${escapeHtml(item.logoAlt || item.company + " Logo")}"
              class="work-thumbnail"
              loading="lazy"
            >
          </div>
        `
        : "";

      const title = `${item.company ?? ""}${item.role ? ` - ${item.role}` : ""}`;

      return `
        <div class="work-item">
          ${logoHtml}
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(item.years || "")}</p>
          ${renderBullets(item.bullets)}
        </div>
      `.trim();
    })
    .join("\n");
}

function main() {
  if (!fs.existsSync(SITE_JSON)) {
    console.error(`❌ Missing ${SITE_JSON}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(SITE_JSON, "utf-8"));

  const featuredHtml = renderFeaturedCard(config.featuredProject);
  fs.writeFileSync(
    OUT_FEATURED_HTML,
    (featuredHtml || "").trim() + "\n",
    "utf-8",
  );

  const workHtml = renderWorkCards(config.workExperience);
  fs.writeFileSync(OUT_WORK_HTML, (workHtml || "").trim() + "\n", "utf-8");

  console.log(`✅  Wrote featured fragment to ${OUT_FEATURED_HTML}`);
  console.log(`✅  Wrote work fragment to ${OUT_WORK_HTML}`);
}

main();
