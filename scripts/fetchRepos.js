const fs = require('fs');
const fetch = require('node-fetch');
const atob = require('atob');

const OWNER = 'jerejoensuu';
const DEFAULT_THUMBNAIL = 'images/blank-thumbnail.png';

async function fetchProjectThumbnail(owner, repo) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/images`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${process.env.ACTIONS_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (response.status === 404) {
            return DEFAULT_THUMBNAIL;
        }

        const files = await response.json();
        const priorityFiles = ['thumbnail.gif', 'thumbnail.jpeg', 'thumbnail.jpg', 'thumbnail.png'];

        for (const fileName of priorityFiles) {
            const file = files.find(f => f.name.toLowerCase() === fileName.toLowerCase());
            if (file) {
                return file.download_url;
            }
        }

        const gifFile = files.find(f => f.name.toLowerCase().endsWith('.gif'));
        if (gifFile) {
            return gifFile.download_url;
        }

        const imageFile = files.find(f => f.name.toLowerCase().match(/\.(png|jpe?g)$/));
        if (imageFile) {
            return imageFile.download_url;
        }

        return DEFAULT_THUMBNAIL;
    } catch (error) {
        console.error(`Error fetching thumbnail for ${repo}:`, error);
        return DEFAULT_THUMBNAIL;
    }
}

async function fetchReadmeSummary(owner, repo) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${process.env.ACTIONS_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            console.warn(`No README found for ${repo}`);
            return "";
        }

        const readmeData = await response.json();

        if (readmeData.encoding !== 'base64') {
            console.warn(`Unexpected encoding for README in ${repo}: ${readmeData.encoding}`);
            return "";
        }

        // Decode the Base64 content
        const readmeContent = atob(readmeData.content);

        // Extract content between <summary> and </details> tags
        const summaryMatch = readmeContent.match(/<summary>[\s\S]*?<\/summary>([\s\S]*?)<\/details>/i);
        if (summaryMatch && summaryMatch[1]) {
            return summaryMatch[1].trim().replace(/- /g, "");
        } else {
            return "";
        }
    } catch (error) {
        console.error(`Error fetching summary for ${repo}:`, error);
        return "";
    }
}

async function fetchRepos() {
    try {
        if (!process.env.ACTIONS_TOKEN) {
            console.error('Error: ACTIONS_TOKEN environment variable is not set.');
            process.exit(1);
        }

        const apiUrl = `https://api.github.com/users/${OWNER}/repos`;
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${process.env.ACTIONS_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}\n${errorText}`);
        }

        const repos = await response.json();

        const reposWithDetails = [];
        for (const repo of repos) {
            const thumbnail = await fetchProjectThumbnail(OWNER, repo.name);
            const readmeSummary = await fetchReadmeSummary(OWNER, repo.name);

            reposWithDetails.push({
                ...repo,
                thumbnail,
                readme_summary: readmeSummary,
            });
        }

        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }

        fs.writeFileSync(
            'data/repos.json',
            JSON.stringify(reposWithDetails, null, 2)
        );
        console.log('Successfully updated data/repos.json');

    } catch (error) {
        console.error('Error fetching repos:', error);
        process.exit(1);
    }
}

fetchRepos();
