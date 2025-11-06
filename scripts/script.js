// Store the last update timestamp globally
let lastUpdateTime = null;
let animationFrameId = null;

// -------- Config-driven content --------

/**
 * Load site config (skills, learning, work experience)
 * from /data/site.json.
 */
async function loadSiteConfig() {
  const res = await fetch("data/site.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load site.json: ${res.status}`);
  return res.json();
}

/**
 * Render tags into a container.
 * Tag levels map to your existing CSS classes:
 *   1 -> tag1, 2 -> tag2, 3 -> tag3 (fallback tag1)
 */
function renderTags(containerId, tags) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";

  (tags || []).forEach((tag) => {
    const level = typeof tag.level === "number" ? tag.level : 1;
    const cls = level === 2 ? "tag2" : level === 3 ? "tag3" : "tag1";
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = tag.label ?? String(tag);
    el.appendChild(span);
    // spacing is handled by your CSS; if needed add small gap:
    // el.appendChild(document.createTextNode(' '));
  });
}

/**
 * Render work experience cards into #work-grid.
 * Expects:
 * { company, role, years, logo, logoAlt, bullets[] }
 */
function renderWork(workItems) {
  const grid = document.getElementById("work-grid");
  if (!grid) return;
  grid.innerHTML = "";

  (workItems || []).forEach((item) => {
    const card = document.createElement("div");
    card.className = "work-item";

    const logoHtml = item.logo
      ? `
                <div class="logo-container">
                    <img src="${item.logo}" alt="${
          item.logoAlt || item.company + " Logo"
        }" class="work-thumbnail">
                </div>`
      : "";

    const bulletsHtml =
      Array.isArray(item.bullets) && item.bullets.length
        ? `<ul>${item.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
        : "<ul></ul>";

    card.innerHTML = `
            ${logoHtml}
            <h3>${item.company} - ${item.role}</h3>
            <p>${item.years}</p>
            ${bulletsHtml}
        `;
    grid.appendChild(card);
  });
}

// -------- Existing utilities / projects --------

function formatTimeDifference(startDate) {
  const now = new Date();
  const diff = Math.floor((now - startDate) / 1000);
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function updateTimer() {
  if (!lastUpdateTime) return;
  const lastUpdatedElement = document.getElementById("last-updated");
  if (lastUpdatedElement) {
    lastUpdatedElement.textContent = `Last updated: ${formatTimeDifference(
      lastUpdateTime
    )}`;
  }
  animationFrameId = requestAnimationFrame(updateTimer);
}

function showLoading() {
  const loadingElement = document.getElementById("projects-loading");
  if (loadingElement) loadingElement.style.display = "block";
}

function hideLoading() {
  const loadingElement = document.getElementById("projects-loading");
  if (loadingElement) loadingElement.style.display = "none";
}

function getEngineBadge(topics) {
  if ((topics || []).some((topic) => topic.includes("unity"))) {
    return `<div class="engine-badge">
            <img src="images/logos/unity-logo.svg" alt="Unity Project">
        </div>`;
  } else if ((topics || []).some((topic) => topic.includes("unreal"))) {
    return `<div class="engine-badge">
            <img src="images/logos/unreal-logo.svg" alt="Unreal Engine Project">
        </div>`;
  } else if ((topics || []).includes("python")) {
    return `<div class="engine-badge">
            <img src="images/logos/python-logo.svg" alt="Python Project">
        </div>`;
  }
  return "";
}

async function fetchProjects() {
  showLoading();
  // Small delay for nicer spinner; optional
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    const response = await fetch("data/repos.json");
    const projects = await response.json();
    const projectsGrid = document.getElementById("projects-grid");
    if (projectsGrid) projectsGrid.innerHTML = "";

    const filteredProjects = projects
      .filter((project) => !project.archived && !project.fork)
      .sort((a, b) => a.priority - b.priority);

    filteredProjects.forEach((project) => {
      const projectCard = document.createElement("div");
      projectCard.classList.add("project-item");

      const projectThumbnail =
        project.thumbnail || "images/blank-thumbnail.jpg";
      const engineBadge = getEngineBadge(project.topics || []);
      const projectSummaryHTML = generateSummaryHTML(project.summary);

      projectCard.innerHTML = `
                <a href="${project.html_url}" rel="noopener noreferrer">
                    <div class="project-thumbnail-container">
                        ${engineBadge}
                        <div class="thumbnail-spinner loading-spinner-card"></div>
                        <img 
                            src="${projectThumbnail}" 
                            alt="${project.name} Thumbnail" 
                            class="project-thumbnail"
                            loading="lazy"
                            onload="this.style.opacity='1'; this.previousElementSibling.style.display='none';"
                        >
                    </div>
                </a>
                <div class="project-details">
                    <a href="${project.html_url}"> <h3>${project.name}</h3> </a>
                    <p>${project.description || "No description available"}</p>
                    <div class="project-summary">
                        ${projectSummaryHTML}
                    </div>
                </div>
                <div class="tag-group-2">
                    ${(project.topics || [])
                      .map((topic) => `<span class="tag3">${topic}</span>`)
                      .join("")}
                </div>
            `;
      projectsGrid.appendChild(projectCard);
    });

    lastUpdateTime = new Date();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    updateTimer();
  } catch (error) {
    console.error("Error fetching projects:", error);
    const projectsGrid = document.getElementById("projects-grid");
    if (projectsGrid) {
      projectsGrid.innerHTML = `
                <div class="error-message">
                    Unable to load projects. Please try again later.
                </div>
            `;
    }
  } finally {
    hideLoading();
  }
}

function generateSummaryHTML(summary) {
  if (!Array.isArray(summary) || summary.length === 0) {
    return "<p>No summary available.</p>";
  }
  let html = "<ul>";
  summary.forEach((item) => {
    if (typeof item === "string") {
      html += `<li>${item}</li>`;
    } else if (typeof item === "object" && item !== null) {
      for (const [key, values] of Object.entries(item)) {
        html += `<li>${key}</li>`;
        if (Array.isArray(values)) {
          html += `<ul>`;
          values.forEach((subItem) => {
            html += `<li>${subItem}</li>`;
          });
          html += `</ul>`;
        }
      }
    }
  });
  html += "</ul>";
  return html;
}

function cleanup() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// -------- Init --------
document.addEventListener("DOMContentLoaded", async () => {
  // 1) Config-driven sections
  try {
    const config = await loadSiteConfig();
    renderTags("skills-tags", config.skills);
    renderTags("learning-tags", config.learning);
    renderWork(config.workExperience);
  } catch (e) {
    console.error(e);
    // Graceful fallback (leave containers empty)
  }

  // 2) Projects (GitHub)
  fetchProjects();
  setInterval(fetchProjects, 300000); // refresh every 5 min

  const stickyHeader = document.querySelector(".sticky-header");
  const mainHeader = document.querySelector(".main-header"); // retained for future use
  let lastScroll = 0;

  window.addEventListener("scroll", () => {
    const currentScroll = window.pageYOffset;
    if (stickyHeader) {
      if (currentScroll > 200) stickyHeader.classList.add("visible");
      else stickyHeader.classList.remove("visible");
    }
    lastScroll = currentScroll;
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cleanup();
  } else {
    if (!animationFrameId) {
      updateTimer();
    }
  }
});

window.addEventListener("beforeunload", cleanup);

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
});
