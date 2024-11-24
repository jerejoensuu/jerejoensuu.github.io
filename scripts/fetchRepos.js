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
    try {
        const response = await fetch(url, { headers });
        if (response.status === 404) {
            return null; // Resource not found
        }
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText} for URL: ${url}`);
        }
        return response.json();
    } catch (error) {
        console.error(`Fetch error for URL ${url}:`, error);
        throw error;
    }
}

// Function to fetch the project thumbnail
async function fetchProjectThumbnail(owner, repo) {
    const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/images`;

    try {
        const files = await githubFetch(apiUrl);

        if (!files) {
            // images directory not found
            return DEFAULT_THUMBNAIL;
        }

        const priorityFiles = ['thumbnail.gif', 'thumbnail.jpeg', 'thumbnail.jpg', 'thumbnail.png'];

        for (const fileName of priorityFiles) {
            const file = files.find(f => f.name.toLowerCase() === fileName.toLowerCase());
            if (file && file.download_url) {
                return file.download_url;
            }
        }

        // Fallback to any GIF
        const gifFile = files.find(f => f.name.toLowerCase().endsWith('.gif'));
        if (gifFile && gifFile.download_url) {
            return gifFile.download_url;
        }

        // Fallback to any PNG or JPEG
        const imageFile = files.find(f => /\.(png|jpe?g)$/.test(f.name.toLowerCase()));
        if (imageFile && imageFile.download_url) {
            return imageFile.download_url;
        }

        return DEFAULT_THUMBNAIL;
    } catch (error) {
        console.warn(`Using default thumbnail for ${repo} due to error.`);
        return DEFAULT_THUMBNAIL;
    }
}

// Function to fetch the portfolio.json data
async function fetchPortfolioData(owner, repo) {
    const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/portfolio.json`;

    try {
        const portfolioData = await githubFetch(apiUrl);

        if (!portfolioData) {
            console.warn(`portfolio.json not found for ${repo}. Using defaults.`);
            return {
                Summary: [],
                Priority: Number.MAX_SAFE_INTEGER, // Assign lowest priority
            };
        }

        if (portfolioData.type !== 'file' || !portfolioData.content) {
            console.warn(`Invalid portfolio.json structure for ${repo}. Using defaults.`);
            return {
                Summary: [],
                Priority: Number.MAX_SAFE_INTEGER,
            };
        }

        // Decode Base64 content
        const decodedContent = Buffer.from(portfolioData.content, 'base64').toString('utf-8');

        let portfolioJson;
        try {
            portfolioJson = JSON.parse(decodedContent);
        } catch (parseError) {
            console.warn(`Error parsing portfolio.json for ${repo}:`, parseError.message);
            return {
                Summary: [],
                Priority: Number.MAX_SAFE_INTEGER,
            };
        }

        // Validate required fields
        const { Summary, Priority } = portfolioJson;
        if (!Array.isArray(Summary)) {
            console.warn(`Summary should be an array in portfolio.json for ${repo}. Using defaults.`);
            return {
                Summary: [],
                Priority: typeof Priority === 'number' ? Priority : Number.MAX_SAFE_INTEGER,
            };
        }

        if (typeof Priority !== 'number') {
            console.warn(`Invalid Priority in portfolio.json for ${repo}. Using defaults.`);
            return {
                Summary,
                Priority: Number.MAX_SAFE_INTEGER,
            };
        }

        return { Summary, Priority };
    } catch (error) {
        console.warn(`Error fetching portfolio.json for ${repo}:`, error.message);
        return {
            Summary: [],
            Priority: Number.MAX_SAFE_INTEGER,
        };
    }
}


// Function to fetch all repositories
async function fetchRepos() {
    try {
        if (!process.env.ACTIONS_TOKEN) {
            console.error('Error: ACTIONS_TOKEN environment variable is not set.');
            process.exit(1);
        }

        const apiUrl = `${GITHUB_API_BASE}/users/${OWNER}/repos`;
        const repos = await githubFetch(apiUrl);

        if (!repos || !Array.isArray(repos)) {
            throw new Error('Invalid repositories data received.');
        }

        // Use Promise.all with concurrency control to avoid hitting rate limits
        const concurrencyLimit = 5; // Adjust based on your rate limits
        const reposWithDetails = [];
        let index = 0;

        async function processBatch() {
            while (index < repos.length) {
                const batch = repos.slice(index, index + concurrencyLimit);
                const batchPromises = batch.map(async (repo) => {
                    const [thumbnail, portfolio] = await Promise.all([
                        fetchProjectThumbnail(OWNER, repo.name),
                        fetchPortfolioData(OWNER, repo.name),
                    ]);

                    return {
                        ...repo,
                        thumbnail,
                        summary: portfolio.Summary,
                        priority: portfolio.Priority,
                    };
                });

                const batchResults = await Promise.all(batchPromises);
                reposWithDetails.push(...batchResults);
                index += concurrencyLimit;
            }
        }

        await processBatch();

        // Sort repositories based on priority (ascending)
        reposWithDetails.sort((a, b) => a.priority - b.priority);

        // Ensure the 'data' directory exists
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }

        // Write the data to a JSON file
        const outputPath = path.join(dataDir, 'repos.json');
        console.log('Writing data to', outputPath);
        fs.writeFileSync(
            outputPath,
            JSON.stringify(reposWithDetails, null, 2),
            'utf-8'
        );
        console.log(`Successfully updated ${outputPath}`);

    } catch (error) {
        console.error('Error fetching repos:', error);
        process.exit(1);
    }
}

fetchRepos();
