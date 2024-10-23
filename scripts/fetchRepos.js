const fs = require('fs');
const fetch = require('node-fetch');

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
            // No 'images' folder exists, return default thumbnail
            return DEFAULT_THUMBNAIL;
        }

        const files = await response.json();
        const priorityFiles = [
            'thumbnail.gif',
            'thumbnail.jpeg',
            'thumbnail.jpg',
            'thumbnail.png',
        ];

        // 1. Check for priority files in order
        for (const fileName of priorityFiles) {
            const file = files.find(
                f => f.name.toLowerCase() === fileName.toLowerCase()
            );
            if (file) {
                return file.download_url;
            }
        }

        // 2. Check for any .gif files
        const gifFile = files.find(f =>
            f.name.toLowerCase().endsWith('.gif')
        );
        if (gifFile) {
            return gifFile.download_url;
        }

        // 3. Check for any .png or .jpeg/.jpg files
        const imageFile = files.find(f =>
            f.name.toLowerCase().match(/\.(png|jpe?g)$/)
        );
        if (imageFile) {
            return imageFile.download_url;
        }

        // 4. If no images are found, return the default thumbnail
        return DEFAULT_THUMBNAIL;

    } catch (error) {
        console.error(`Error fetching thumbnail for ${repo}:`, error);
        return DEFAULT_THUMBNAIL;
    }
}

async function fetchRepos() {
    try {
        console.log('ACTIONS_TOKEN is set:', !!process.env.ACTIONS_TOKEN);
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
        console.log('API Response:', repos);

        // Fetch thumbnails for each repo
        const reposWithThumbnails = [];
        for (const repo of repos) {
            const thumbnail = await fetchProjectThumbnail(OWNER, repo.name);
            reposWithThumbnails.push({
                ...repo,
                thumbnail,
            });
        }

        // Write the data to repos.json
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }

        fs.writeFileSync(
            'data/repos.json',
            JSON.stringify(reposWithThumbnails, null, 2)
        );
        console.log('Successfully updated data/repos.json');

    } catch (error) {
        console.error('Error fetching repos:', error);
        process.exit(1);
    }
}

fetchRepos();
