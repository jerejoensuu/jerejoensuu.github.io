/**
 * generateRepoPrerender.js
 *
 * Generates a static HTML fragment for the projects grid from `data/repos.json`.
 * The fragment is written to `data/repos.prerender.html`.
 *
 * Usage: node scripts/generateRepoPrerender.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPOS_JSON = path.join(ROOT, "data", "repos.json");
const OUT_HTML = path.join(ROOT, "data", "repos.prerender.html");

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRepoName(name) {
  if (!name) return "";
  return name
    .split("-")
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function generateSummaryHTML(summary) {
  if (!Array.isArray(summary) || summary.length === 0) {
    return "<p>No summary available.</p>";
  }

  let html = "<ul>";

  for (const item of summary) {
    if (typeof item === "string") {
      html += `<li>${escapeHtml(item)}</li>`;
      continue;
    }

    if (item && typeof item === "object") {
      for (const [key, values] of Object.entries(item)) {
        html += `<li>${escapeHtml(key)}</li>`;
        if (Array.isArray(values)) {
          html += "<ul>";
          for (const subItem of values) {
            html += `<li>${escapeHtml(subItem)}</li>`;
          }
          html += "</ul>";
        }
      }
    }
  }

  html += "</ul>";
  return html;
}

function getEngineBadge(topics) {
  const t = Array.isArray(topics) ? topics : [];

  if (t.some((topic) => String(topic).includes("unity"))) {
    return `<div class="engine-badge">
      <img src="images/logos/unity-logo.svg" alt="Unity Project">
    </div>`;
  }

  if (t.some((topic) => String(topic).includes("unreal"))) {
    return `<div class="engine-badge">
      <img src="images/logos/unreal-logo.svg" alt="Unreal Engine Project">
    </div>`;
  }

  if (t.includes("python")) {
    return `<div class="engine-badge">
      <img src="images/logos/python-logo.svg" alt="Python Project">
    </div>`;
  }

  if (t.includes("minecraft")) {
    return `<div class="engine-badge">
      <img src="images/logos/minecraft-logo.svg" alt="Minecraft Project">
    </div>`;
  }

  return "";
}

function getWebsiteInfo(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^www\./, "");

    let label = hostname;
    if (hostname.endsWith("itch.io")) label = "itch.io";
    else if (hostname.endsWith("github.io")) label = "GitHub Pages";

    const favicon = `${u.origin}/favicon.ico`;

    return { href: url, label, favicon };
  } catch {
    return { href: url, label: url, favicon: null };
  }
}

function buildLinkFlagHtml(url) {
  const info = getWebsiteInfo(url);

  const iconHtml = info.favicon
    ? `<img src="${escapeHtml(info.favicon)}" alt="${escapeHtml(
        info.label,
      )} icon" class="link-flag-favicon" loading="lazy">`
    : `<span class="link-flag-default-icon">↗</span>`;

  return `
    <a
      class="link-flag"
      href="${escapeHtml(info.href)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open ${escapeHtml(info.label)}"
      title="${escapeHtml(info.label)}"
    >
      ${iconHtml}
      <span class="link-flag-text">${escapeHtml(info.label)}</span>
    </a>
  `;
}

function renderCard(project) {
  const projectThumbnail = project.thumbnail || "images/blank-thumbnail.jpg";
  const engineBadge = getEngineBadge(project.topics || []);
  const projectSummaryHTML = generateSummaryHTML(project.summary);
  const websiteFlagHtml = project.link ? buildLinkFlagHtml(project.link) : "";
  const displayName = formatRepoName(project.name);

  const topics = Array.isArray(project.topics) ? project.topics : [];

  return `
    <div class="project-item" data-repo="${escapeHtml(project.name)}">
      <div class="project-thumbnail-container">
        <a
          href="${escapeHtml(project.html_url)}"
          rel="noopener noreferrer"
          target="_blank"
          class="project-thumbnail-link"
        >
          ${engineBadge}
          <div class="thumbnail-spinner loading-spinner-card"></div>
          <img
            src="${escapeHtml(projectThumbnail)}"
            alt="${escapeHtml(project.name)} Thumbnail"
            class="project-thumbnail"
            loading="lazy"
            onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';"
          >
        </a>
        ${websiteFlagHtml}
      </div>

      <div class="project-details">
        <a href="${escapeHtml(project.html_url)}" target="_blank" rel="noopener noreferrer">
          <h3>${escapeHtml(displayName)}</h3>
        </a>
        <p>${escapeHtml(project.description || "No description available")}</p>
        <div class="project-summary">
          ${projectSummaryHTML}
        </div>
      </div>

      <div class="tag-group-2">
        ${topics.map((topic) => `<span class="tag3">${escapeHtml(topic)}</span>`).join("")}
      </div>
    </div>
  `;
}

function main() {
  if (!fs.existsSync(REPOS_JSON)) {
    console.error(`❌ Missing ${REPOS_JSON}. Run fetchRepos.js first.`);
    process.exit(1);
  }

  const repos = JSON.parse(fs.readFileSync(REPOS_JSON, "utf-8"));

  const filtered = (repos || [])
    .filter((project) => !project.archived && !project.fork)
    .sort((a, b) => a.priority - b.priority);

  const html = filtered.map(renderCard).join("\n");

  fs.writeFileSync(OUT_HTML, html.trim() + "\n", "utf-8");
  console.log(`✅  Wrote ${filtered.length} cards to ${OUT_HTML}`);
}

main();
