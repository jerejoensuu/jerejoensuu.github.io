const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const OWNER = 'jerejoensuu'; // Replace with your GitHub username
const DEFAULT_THUMBNAIL = 'images/blank-thumbnail.jpg';
const GITHUB_API_BASE = 'https://api.github.com';

// Reusable headers for GitHub API requests
const headers = {
    'Authorization': `token ${process.env.ACTIONS_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
};

// Helper function to perform fetch with error handling
async function githubFetch(url) {
    console.log(`→ Fetching: ${url}`);
    try {
        const response = await fetch(url, { headers });
        if (response.status === 404) {
            console.warn(`⚠️ 404 Not Found: ${url}`);
            return null; // Resource not found
        }
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error(`❌ Fetch error for URL ${url}:`, error.message);
        throw error;
    }
}

// Function to fetch the project thumbnail
async function fetchProjectThumbnail(owner, repo) {
    const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/images`;
    try {
        const files = await githubFetch(apiUrl);

        if (!files) {
            console.info(`ℹ️  No images directory in ${repo} → using default thumbnail`);
            return DEFAULT_THUMBNAIL;
        }

        const priorityFiles = ['thumbnail.gif', 'thumbnail.jpeg', 'thumbnail.jpg', 'thumbnail.png'];
        for (const fileName of priorityFiles) {
            const file = files.find(f => f.name.toLowerCase() === fileName.toLowerCase());
            if (file && file.download_url) {
                console.info(`✅  ${repo}: found priority thumbnail ${file.name}`);
                return file.download_url;
            }
        }

        // Fallback to any GIF
        const gifFile = files.find(f => f.name.toLowerCase().endsWith('.gif'));
        if (gifFile && gifFile.download_url) {
            console.info(`✅  ${repo}: found fallback GIF thumbnail ${gifFile.name}`);
            return gifFile.download_url;
        }

        // Fallback to any PNG or JPEG
        const imageFile = files.find(f => /\.(png|jpe?g)$/.test(f.name.toLowerCase()));
        if (imageFile && imageFile.download_url) {
            console.info(`✅  ${repo}: found fallback image ${imageFile.name}`);
            return imageFile.download_url;
        }

        console.info(`ℹ️  ${repo}: no matching images → using default thumbnail`);
        return DEFAULT_THUMBNAIL;
    } catch (error) {
        console.warn(`⚠️  ${repo}: error fetching thumbnails (${error.message}) → using default`);
        return DEFAULT_THUMBNAIL;
    }
}

// Function to fetch the portfolio.json data
async function fetchPortfolioData(owner, repo) {
    const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/portfolio.json`;
    try {
        const portfolioData = await githubFetch(apiUrl);

        if (!portfolioData) {
            console.info(`ℹ️  ${repo}: portfolio.json not found → default Summary=[] Priority=∞`);
            return { Summary: [], Priority: Number.MAX_SAFE_INTEGER };
        }
        if (portfolioData.type !== 'file' || !portfolioData.content) {
            console.warn(`⚠️  ${repo}: invalid portfolio.json structure → using defaults`);
            return { Summary: [], Priority: Number.MAX_SAFE_INTEGER };
        }

        // Decode Base64 content
        const decoded = Buffer.from(portfolioData.content, 'base64').toString('utf-8');
        let json;
        try {
            json = JSON.parse(decoded);
        } catch (e) {
            console.warn(`⚠️  ${repo}: JSON parse error in portfolio.json (${e.message}) → defaults`);
            return { Summary: [], Priority: Number.MAX_SAFE_INTEGER };
        }

        const { Summary, Priority } = json;
        if (!Array.isArray(Summary)) {
            console.warn(`⚠️  ${repo}: Summary is not array → defaulting Summary=[]`);
            return { Summary: [], Priority: typeof Priority === 'number' ? Priority : Number.MAX_SAFE_INTEGER };
        }
        if (typeof Priority !== 'number') {
            console.warn(`⚠️  ${repo}: Priority is not number → defaulting Priority=∞`);
            return { Summary, Priority: Number.MAX_SAFE_INTEGER };
        }

        console.info(`✅  ${repo}: loaded portfolio.json (Priority=${Priority}, Summary items=${Summary.length})`);
        return { Summary, Priority };
    } catch (error) {
        console.warn(`⚠️  ${repo}: error fetching portfolio.json (${error.message}) → defaults`);
        return { Summary: [], Priority: Number.MAX_SAFE_INTEGER };
    }
}

// Function to fetch all repositories
async function fetchRepos() {
    if (!process.env.ACTIONS_TOKEN) {
        console.error('❌  ACTIONS_TOKEN environment variable is not set.');
        process.exit(1);
    }

    try {
        console.log(`→ Fetching all repos for user ${OWNER}`);
        const apiUrl = `${GITHUB_API_BASE}/users/${OWNER}/repos`;
        const repos = await githubFetch(apiUrl);

        if (!Array.isArray(repos)) {
            throw new Error('Invalid repositories data received.');
        }
        console.log(`✅  Retrieved ${repos.length} repos`);

        const concurrencyLimit = 5;
        const reposWithDetails = [];
        let index = 0;

        while (index < repos.length) {
            const batch = repos.slice(index, index + concurrencyLimit);
            console.log(`→ Processing batch ${Math.floor(index / concurrencyLimit) + 1}: repos ${index + 1}-${Math.min(index + concurrencyLimit, repos.length)}`);

            const results = await Promise.all(batch.map(async (repo) => {
                try {
                    const [thumbnail, portfolio] = await Promise.all([
                        fetchProjectThumbnail(OWNER, repo.name),
                        fetchPortfolioData(OWNER, repo.name),
                    ]);
                    return {
                        repo: repo.name,
                        data: { ...repo, thumbnail, summary: portfolio.Summary, priority: portfolio.Priority },
                    };
                } catch (e) {
                    console.error(`❌  ${repo.name}: unexpected error (${e.message})`);
                    return {
                        repo: repo.name,
                        data: { ...repo, thumbnail: DEFAULT_THUMBNAIL, summary: [], priority: Number.MAX_SAFE_INTEGER },
                    };
                }
            }));

            results.forEach(({ repo, data }) => {
                console.log(`→ Adding ${repo} (Priority=${data.priority})`);
                reposWithDetails.push(data);
            });

            index += concurrencyLimit;
        }

        // Sort and write out
        reposWithDetails.sort((a, b) => a.priority - b.priority);
        const dataDir = path.resolve(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
        const outputPath = path.join(dataDir, 'repos.json');

        console.log(`→ Writing ${reposWithDetails.length} entries to ${outputPath}`);
        fs.writeFileSync(outputPath, JSON.stringify(reposWithDetails, null, 2), 'utf-8');
        console.log('✅  Successfully updated repos.json');
    } catch (error) {
        console.error('❌  Error fetching repos:', error.message);
        process.exit(1);
    }
}

fetchRepos();
