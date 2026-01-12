// Store the last update timestamp globally
let lastUpdateTime = null;
let animationFrameId = null;

// -------- Project type count summary config --------

// Which high level buckets exist and how they behave in the header summary
const CATEGORY_CONFIG = {
  unity: {
    label: "Unity",
    icon: "images/logos/unity-logo.svg",
    // Higher wins on ties
    priorityWeight: 3,
  },
  unreal: {
    label: "Unreal",
    icon: "images/logos/unreal-logo.svg",
    priorityWeight: 2,
  },
  python: {
    label: "Python",
    icon: "images/logos/python-logo.svg",
    priorityWeight: 2,
  },
  mod: {
    label: "Mods",
    icon: "images/logos/mod-icon.svg",
    priorityWeight: 1,
  },
  js: {
    label: "JavaScript",
    icon: "images/logos/js-icon.svg",
    priorityWeight: 1,
  },
  other: {
    label: "Other",
    icon: "images/logos/other-icon.svg",
    priorityWeight: 0,
    isOtherBucket: true,
  },
};

// How the header summary should behave
const TYPE_COUNT_DISPLAY_CONFIG = {
  maxVisibleCategories: 3, // change to 2, 4, etc
  // These will be included if they exist, before filling with others
  alwaysInclude: ["unity", "unreal", "python"],
  // If true, any categories not visible will be collapsed into the "other" bucket
  collapseRemainderIntoOther: true,
};

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
 * Tag prioritys map to tag1, tag2, tag3 (fallback tag1)
 */
function renderTags(containerId, tags) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";

  (tags || []).forEach((tag) => {
    const priority = typeof tag.priority === "number" ? tag.priority : 1;
    const cls = priority === 2 ? "tag2" : priority === 3 ? "tag3" : "tag1";
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = tag.label ?? String(tag);
    el.appendChild(span);
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
            <h3>${item.company}${item.role ? ` - ${item.role}` : ""}</h3>
            <p>${item.years}</p>
            ${bulletsHtml}
        `;
    grid.appendChild(card);
  });
}

// -------- Project type count summary helpers --------

function getProjectCategory(project) {
  const topics = project.topics || [];

  if (topics.some((t) => t.includes("unity"))) return "unity";
  if (topics.some((t) => t.includes("unreal"))) return "unreal";
  if (topics.some((t) => t.includes("python"))) return "python";
  if (topics.some((t) => t.includes("minecraft") || t.includes("mod")))
    return "mod";
  if (topics.some((t) => t.includes("javascript") || t.includes("js")))
    return "js";

  return "other";
}

function computeCategorySummary(projects) {
  const counts = {};

  // Count all categories
  (projects || []).forEach((project) => {
    const cat = getProjectCategory(project);
    if (!counts[cat]) counts[cat] = 0;
    counts[cat] += 1;
  });

  const entries = Object.entries(counts);
  if (!entries.length) return { visible: [], otherCount: 0 };

  // Turn counts into an array with config
  const all = entries.map(([name, count]) => {
    const cfg = CATEGORY_CONFIG[name] || {};
    return {
      name,
      count,
      label: cfg.label || name,
      icon: cfg.icon || "",
      priorityWeight: cfg.priorityWeight || 0,
      isOtherBucket: !!cfg.isOtherBucket,
    };
  });

  // Separate special "other" bucket, if present
  let otherBucket = all.find((c) => c.isOtherBucket);
  let normalBuckets = all.filter((c) => !c.isOtherBucket);

  const cfg = TYPE_COUNT_DISPLAY_CONFIG;
  const visible = [];
  const remaining = [...normalBuckets];

  // Helper: take by name from remaining into visible
  function take(name) {
    const idx = remaining.findIndex((c) => c.name === name && c.count > 0);
    if (idx === -1) return;
    visible.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  // Always include forced categories, in the order defined
  (cfg.alwaysInclude || []).forEach((name) => {
    if (visible.length >= cfg.maxVisibleCategories) return;
    take(name);
  });

  // Sort remaining by count then priorityWeight then name
  remaining.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.priorityWeight !== a.priorityWeight) {
      return b.priorityWeight - a.priorityWeight;
    }
    return a.name.localeCompare(b.name);
  });

  // Fill remaining slots with best scoring categories
  while (visible.length < cfg.maxVisibleCategories && remaining.length) {
    visible.push(remaining.shift());
  }

  // Compute remainder count for "other"
  let otherCount = 0;

  if (cfg.collapseRemainderIntoOther) {
    const visibleNames = new Set(visible.map((v) => v.name));

    all.forEach((c) => {
      if (!visibleNames.has(c.name) && !c.isOtherBucket) {
        otherCount += c.count;
      }
    });

    if (otherBucket) {
      otherCount += otherBucket.count;
    }
  } else if (otherBucket) {
    otherCount = otherBucket.count;
  }

  return { visible, otherCount };
}

function renderTypeCountIcons(visibleCategories, otherCount) {
  const container = document.getElementById("project-count-icons");
  if (!container) return;

  const parts = (visibleCategories || []).map((cat) => {
    const iconHtml = cat.icon
      ? `<img src="${cat.icon}" alt="${cat.label}" class="project-count-icon" />`
      : "";
    return `
      <span class="project-count-item">
        ${iconHtml}
        <span class="project-count">${cat.count}</span>
      </span>
    `;
  });

  if (otherCount > 0) {
    const otherCfg = CATEGORY_CONFIG.other || { label: "Other" };
    const otherIcon = otherCfg.icon
      ? `<img src="${otherCfg.icon}" alt="${otherCfg.label}" class="project-count-icon" />`
      : `<span class="project-count-other-icon">+</span>`;

    parts.push(`
      <span class="project-count-item">
        ${otherIcon}
        <span class="project-count">${otherCount}</span>
      </span>
    `);
  }

  container.innerHTML = parts.join("");
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

    // Update header project type count summary
    const summary = computeCategorySummary(filteredProjects);
    renderTypeCountIcons(summary.visible, summary.otherCount);

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
    renderTags("core-tags", config.core);
    renderTags("systems-tags", config.systemsTools);
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
