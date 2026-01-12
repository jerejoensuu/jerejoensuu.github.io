/**
 * fetchRepos.js
 *
 * This script fetches all public repos for the specified GitHub user,
 * filters to only those with a valid `portfolio.json`, grabs each repo’s
 * thumbnail image (if present), and writes the resulting data array to
 * `data/repos.json` at the repository root.
 *
 * Usage: `node fetchRepos.js`
 * Requires: process.env.ACTIONS_TOKEN to be set to a valid GitHub token.
 */

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

// === Configuration ===
const OWNER = "jerejoensuu"; // GitHub username to fetch repos for
const DEFAULT_THUMBNAIL = "images/blank-thumbnail.jpg"; // Fallback thumbnail path
const GITHUB_API_BASE = "https://api.github.com"; // Base URL for GitHub API

// Reusable headers for all GitHub API requests
const headers = {
  Authorization: `token ${process.env.ACTIONS_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

/**
 * Helper: perform a GitHub API fetch with error & 404 handling.
 * @param {string} url - Full GitHub API URL to fetch.
 * @returns {Object|null} - Parsed JSON response, or null if 404.
 * @throws on non-OK (non-404) responses.
 */
async function githubFetch(url) {
  console.log(`→ Fetching: ${url}`);
  try {
    const response = await fetch(url, { headers });
    if (response.status === 404) {
      console.warn(`⚠️ 404 Not Found: ${url}`);
      return null; // Resource not found
    }
    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }
    return response.json();
  } catch (error) {
    console.error(`❌ Fetch error for URL ${url}:`, error.message);
    throw error;
  }
}

/**
 * Fetch the best thumbnail URL for a repo.
 * Looks in the repo’s `images/` folder for priority filenames,
 * then falls back to any GIF, then any PNG/JPEG, then default.
 * @param {string} owner
 * @param {string} repo
 * @returns {string} - URL to thumbnail image (or DEFAULT_THUMBNAIL).
 */
async function fetchProjectThumbnail(owner, repo) {
  const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/images`;
  try {
    const files = await githubFetch(apiUrl);

    if (!files) {
      console.info(
        `ℹ️  ${repo}: no images directory → using default thumbnail`
      );
      return DEFAULT_THUMBNAIL;
    }

    // Priority list
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

    // Fallback: any .gif
    const gif = files.find((f) => f.name.toLowerCase().endsWith(".gif"));
    if (gif && gif.download_url) {
      console.info(`✅  ${repo}: found fallback GIF ${gif.name}`);
      return gif.download_url;
    }

    // Fallback: any .png/.jpg/.jpeg
    const img = files.find((f) => /\.(png|jpe?g)$/i.test(f.name));
    if (img && img.download_url) {
      console.info(`✅  ${repo}: found fallback image ${img.name}`);
      return img.download_url;
    }

    console.info(`ℹ️  ${repo}: no matching images → using default thumbnail`);
    return DEFAULT_THUMBNAIL;
  } catch (err) {
    console.warn(
      `⚠️  ${repo}: error fetching thumbnails (${err.message}) → default`
    );
    return DEFAULT_THUMBNAIL;
  }
}

/**
 * Fetch and parse a repo’s portfolio.json.
 * Returns null if the file is missing or invalid.
 * @param {string} owner
 * @param {string} repo
 * @returns {{ Summary: string[], Priority: number }|null}
 */
async function fetchPortfolioData(owner, repo) {
  const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/portfolio.json`;
  try {
    const file = await githubFetch(apiUrl);

    if (!file) {
      console.info(`ℹ️  ${repo}: portfolio.json not found → skipping repo`);
      return null;
    }
    if (file.type !== "file" || !file.content) {
      console.warn(
        `⚠️  ${repo}: invalid portfolio.json structure → skipping repo`
      );
      return null;
    }

    // Decode Base64 content
    let json;
    try {
      const decoded = Buffer.from(file.content, "base64").toString("utf-8");
      json = JSON.parse(decoded);
    } catch (e) {
      console.warn(
        `⚠️  ${repo}: error parsing portfolio.json (${e.message}) → skipping`
      );
      return null;
    }

    const { Summary, Priority } = json;
    if (!Array.isArray(Summary) || typeof Priority !== "number") {
      console.warn(
        `⚠️  ${repo}: missing/invalid fields in portfolio.json → skipping`
      );
      return null;
    }

    console.info(
      `✅  ${repo}: loaded portfolio.json (Priority=${Priority}, Summary items=${Summary.length})`
    );
    return { Summary, Priority };
  } catch (err) {
    console.warn(
      `⚠️  ${repo}: error fetching portfolio.json (${err.message}) → skipping`
    );
    return null;
  }
}

/**
 * Main: fetch all repos, filter & enrich, then write output.
 */
async function fetchRepos() {
  // Ensure we have a token
  if (!process.env.ACTIONS_TOKEN) {
    console.error("❌  ACTIONS_TOKEN is not set. Exiting.");
    process.exit(1);
  }

  console.log(`→ Fetching all repos for user ${OWNER}`);
  const allRepos = await githubFetch(`${GITHUB_API_BASE}/users/${OWNER}/repos`);
  if (!Array.isArray(allRepos)) {
    console.error("❌  Unexpected response for repos list. Exiting.");
    process.exit(1);
  }
  console.log(`✅  Retrieved ${allRepos.length} repos`);

  const concurrencyLimit = 5;
  const finalList = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < allRepos.length; i += concurrencyLimit) {
    const batch = allRepos.slice(i, i + concurrencyLimit);
    console.log(`→ Processing batch ${i / concurrencyLimit + 1}`);

    const enriched = await Promise.all(
      batch.map(async (repo) => {
        const [thumb, portfolio] = await Promise.all([
          fetchProjectThumbnail(OWNER, repo.name),
          fetchPortfolioData(OWNER, repo.name),
        ]);

        // If no valid portfolio.json, skip this repo entirely
        if (!portfolio) return null;

        return {
          name: repo.name,
          html_url: repo.html_url,
          thumbnail: thumb,
          description: repo.description,
          summary: portfolio.Summary,
          priority: portfolio.Priority,
          topics: repo.topics,
          archived: repo.archived,
          fork: repo.fork,
        };
      })
    );

    // Filter out skipped (null) entries and add to final list
    enriched
      .filter((item) => item !== null)
      .forEach((item) => {
        console.log(`→ Adding ${item.name} (Priority=${item.priority})`);
        finalList.push(item);
      });
  }

  // Sort by ascending priority
  finalList.sort((a, b) => a.priority - b.priority);

  // Ensure the root-level data directory exists
  const dataDir = path.resolve(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const outputPath = path.join(dataDir, "repos.json");
  console.log(`→ Writing ${finalList.length} repos to ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(finalList, null, 2), "utf-8");
  console.log("✅  repos.json updated successfully");
}

// Kick it off
fetchRepos().catch((err) => {
  console.error("❌  Unhandled error:", err);
  process.exit(1);
});
