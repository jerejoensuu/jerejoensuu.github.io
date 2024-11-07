// Store the last update timestamp globally
let lastUpdateTime = null;
let animationFrameId = null;

// Utility function to format time difference with more precise timing
function formatTimeDifference(startDate) {
    const now = new Date();
    const diff = Math.floor((now - startDate) / 1000); // difference in seconds

    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

// Update the "last updated" text using requestAnimationFrame
function updateTimer() {
    if (!lastUpdateTime) return;

    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement) {
        lastUpdatedElement.textContent = `Last updated: ${formatTimeDifference(lastUpdateTime)}`;
    }

    // Request the next frame
    animationFrameId = requestAnimationFrame(updateTimer);
}

// Show loading state
function showLoading() {
    const loadingElement = document.getElementById('projects-loading');
    if (loadingElement) loadingElement.style.display = 'block';
}

// Hide loading state
function hideLoading() {
    const loadingElement = document.getElementById('projects-loading');
    if (loadingElement) loadingElement.style.display = 'none';
}

function getEngineBadge(topics) {
    // Check project topics for engine/language
    if (topics.some(topic => topic.includes('unity'))) {
        return `<div class="engine-badge">
            <img src="images/logos/unity-logo.svg" alt="Unity Project">
        </div>`;
    } else if (topics.some(topic => topic.includes('unreal'))) {
        return `<div class="engine-badge">
            <img src="images/logos/unreal-logo.svg" alt="Unreal Engine Project">
        </div>`;
    } else if (topics.includes('python')) {
        return `<div class="engine-badge">
            <img src="images/logos/python-logo.svg" alt="Python Project">
        </div>`;
    }
    return ''; // Return empty string if no matching engine/language found
}

// Main function to fetch and display projects
async function fetchProjects() {
    showLoading();

    // wait for 1 second to simulate loading time
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        const response = await fetch('data/repos.json');
        const projects = await response.json();
        const projectsGrid = document.getElementById('projects-grid');

        // Clear existing content
        if (projectsGrid) {
            projectsGrid.innerHTML = '';
        }

        // Filter and sort projects
        const filteredProjects = projects
            .filter(project => !project.archived && !project.fork)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Generate HTML for each project
        filteredProjects.forEach(project => {
            const projectCard = document.createElement('div');
            projectCard.classList.add('project-item');

            const projectThumbnail = project.thumbnail || 'images/blank-thumbnail.png';
            const engineBadge = getEngineBadge(project.topics || []);
            const projectSummary = project.readme_summary
                ? project.readme_summary
                    .split("\n")
                    .map(item => `<li>${item.replace("- ", "").trim()}</li>`)
                    .join("")
                : "";

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
                    <p>${project.description || 'No description available'}</p>
                    <div class="project-summary">
                        <ul>
                            ${projectSummary}
                        </ul>
                    </div>
                </div>
                <div class="tag-group-2">
                    ${project.topics ? project.topics.map(topic =>
                `<span class="tag3">${topic}</span>`
            ).join('') : ''}
                </div>
            `;

            projectsGrid.appendChild(projectCard);
        });

        // Update the last update timestamp with current time
        lastUpdateTime = new Date();

        // Cancel any existing animation frame
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        // Start the timer update
        updateTimer();

    } catch (error) {
        console.error('Error fetching projects:', error);
        const projectsGrid = document.getElementById('projects-grid');
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

// Clean up function to cancel animation frame when needed
function cleanup() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchProjects();

    // Refresh projects every 5 minutes
    setInterval(fetchProjects, 300000);

    const stickyHeader = document.querySelector('.sticky-header');
    const mainHeader = document.querySelector('.main-header');
    const body = document.body;
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Show/hide sticky header based on scroll position and direction
        if (currentScroll > 200) { // Show after scrolling 200px
            stickyHeader.classList.add('visible');
            // body.classList.add('header-fixed');
        } else {
            stickyHeader.classList.remove('visible');
            // body.classList.remove('header-fixed');
        }

        lastScroll = currentScroll;
    });
});

// Clean up when page is hidden/closed
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        cleanup();
    } else {
        if (!animationFrameId) {
            updateTimer();
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);

// Optional: Add smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});