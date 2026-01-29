/**
 * fetchRepos.js
 *
 * Fetches public GitHub repos for a user, filters to repos that contain a valid
 * `portfolio.json`, finds a thumbnail from the repo `images/` directory,
 * then writes enriched data to `data/repos.json`.
 *
 * Usage: node scripts/fetchRepos.js
 * Requires: process.env.ACTIONS_TOKEN set to a GitHub token with read access.
 */

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

// === Configuration ===
const OWNER = "jerejoensuu";
const DEFAULT_THUMBNAIL = "images/blank-thumbnail.jpg";
const GITHUB_API_BASE = "https://api.github.com";

// Topics require a special preview header historically; GitHub generally supports
// this via a vendor media type. Keeping it here improves reliability.
const headers = {
  Authorization: `token ${process.env.ACTIONS_TOKEN}`,
  Accept:
    "application/vnd.github+json, application/vnd.github.mercy-preview+json",
  "User-Agent": "portfolio-repo-fetcher",
};

async function githubFetch(url) {
  console.log(`→ Fetching: ${url}`);
  try {
    const response = await fetch(url, { headers });

    if (response.status === 404) {
      console.warn(`⚠️  404 Not Found: ${url}`);
      return null;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}${
          text ? ` | ${text.slice(0, 250)}` : ""
        }`,
      );
    }

    return response.json();
  } catch (error) {
    console.error(`❌ Fetch error for URL ${url}:`, error.message);
    throw error;
  }
}

async function fetchProjectThumbnail(owner, repo) {
  const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/images`;

  try {
    const files = await githubFetch(apiUrl);

    if (!files) {
      console.info(`ℹ️  ${repo}: no images directory → default thumbnail`);
      return DEFAULT_THUMBNAIL;
    }

    const priorityFiles = [
      "thumbnail.gif",
      "thumbnail.jpeg",
      "thumbnail.jpg",
      "thumbnail.png",
    ];

    for (const name of priorityFiles) {
      const match = files.find((f) => f.name.toLowerCase() === name);
      if (match && match.download_url) {
        console.info(`✅  ${repo}: found priority thumbnail ${match.name}`);
        return match.download_url;
      }
    }

    const gif = files.find((f) => f.name.toLowerCase().endsWith(".gif"));
    if (gif && gif.download_url) {
      console.info(`✅  ${repo}: found fallback GIF ${gif.name}`);
      return gif.download_url;
    }

    const img = files.find((f) => /\.(png|jpe?g)$/i.test(f.name));
    if (img && img.download_url) {
      console.info(`✅  ${repo}: found fallback image ${img.name}`);
      return img.download_url;
    }

    console.info(`ℹ️  ${repo}: no matching images → default thumbnail`);
    return DEFAULT_THUMBNAIL;
  } catch (err) {
    console.warn(
      `⚠️  ${repo}: error fetching thumbnails (${err.message}) → default thumbnail`,
    );
    return DEFAULT_THUMBNAIL;
  }
}

async function fetchPortfolioData(owner, repo) {
  const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/portfolio.json`;

  try {
    const file = await githubFetch(apiUrl);

    if (!file) {
      console.info(`ℹ️  ${repo}: portfolio.json missing → skipping`);
      return null;
    }

    if (file.type !== "file" || !file.content) {
      console.warn(`⚠️  ${repo}: invalid portfolio.json structure → skipping`);
      return null;
    }

    let json;
    try {
      const decoded = Buffer.from(file.content, "base64").toString("utf-8");
      json = JSON.parse(decoded);
    } catch (e) {
      console.warn(
        `⚠️  ${repo}: invalid JSON in portfolio.json (${e.message}) → skipping`,
      );
      return null;
    }

    const { Summary, Priority, Link } = json;

    if (!Array.isArray(Summary) || typeof Priority !== "number") {
      console.warn(
        `⚠️  ${repo}: missing/invalid fields in portfolio.json → skipping`,
      );
      return null;
    }

    console.info(
      `✅  ${repo}: loaded portfolio.json (Priority=${Priority}, Summary items=${Summary.length}${
        Link ? `, Link=${Link}` : ""
      })`,
    );

    return { Summary, Priority, Link: Link || null };
  } catch (err) {
    console.warn(
      `⚠️  ${repo}: error fetching portfolio.json (${err.message}) → skipping`,
    );
    return null;
  }
}

async function fetchRepos() {
  if (!process.env.ACTIONS_TOKEN) {
    console.error("❌  ACTIONS_TOKEN is not set. Exiting.");
    process.exit(1);
  }

  console.log(`→ Fetching all repos for user ${OWNER}`);

  // Use per_page to reduce pagination surprises.
  const allRepos = await githubFetch(
    `${GITHUB_API_BASE}/users/${OWNER}/repos?per_page=200&sort=updated`,
  );

  if (!Array.isArray(allRepos)) {
    console.error("❌  Unexpected response for repos list. Exiting.");
    process.exit(1);
  }

  console.log(`✅  Retrieved ${allRepos.length} repos`);

  const concurrencyLimit = 5;
  const finalList = [];

  for (let i = 0; i < allRepos.length; i += concurrencyLimit) {
    const batch = allRepos.slice(i, i + concurrencyLimit);
    console.log(`→ Processing batch ${i / concurrencyLimit + 1}`);

    const enriched = await Promise.all(
      batch.map(async (repo) => {
        const [thumb, portfolio] = await Promise.all([
          fetchProjectThumbnail(OWNER, repo.name),
          fetchPortfolioData(OWNER, repo.name),
        ]);

        if (!portfolio) return null;

        return {
          name: repo.name,
          html_url: repo.html_url,
          thumbnail: thumb,
          description: repo.description,
          summary: portfolio.Summary,
          priority: portfolio.Priority,
          link: portfolio.Link || null,
          topics: repo.topics || [],
          archived: !!repo.archived,
          fork: !!repo.fork,
        };
      }),
    );

    enriched
      .filter((item) => item !== null)
      .forEach((item) => {
        console.log(`→ Adding ${item.name} (Priority=${item.priority})`);
        finalList.push(item);
      });
  }

  finalList.sort((a, b) => a.priority - b.priority);

  const dataDir = path.resolve(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, "repos.json");
  console.log(`→ Writing ${finalList.length} repos to ${outputPath}`);

  fs.writeFileSync(outputPath, JSON.stringify(finalList, null, 2), "utf-8");
  console.log("✅  repos.json updated successfully");
}

fetchRepos().catch((err) => {
  console.error("❌  Unhandled error:", err);
  process.exit(1);
});
