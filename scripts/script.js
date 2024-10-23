// Fetch projects from local JSON file
async function fetchProjects() {
    try {
        const response = await fetch('data/repos.json');
        const projects = await response.json();
        const projectsGrid = document.getElementById('projects-grid');

        // Filter out archived or forked repos
        const filteredProjects = projects.filter(
            project => !project.archived && !project.fork
        );

        // Sort projects by creation date
        filteredProjects.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        // Generate HTML for each project
        for (const project of filteredProjects) {
            const projectCard = document.createElement('div');
            projectCard.classList.add('project-item');

            const projectThumbnail =
                project.thumbnail || 'images/blank-thumbnail.png';

            // Create clickable elements (thumbnail and title linking to the repo)
            projectCard.innerHTML = `
                <a href="${project.html_url}" target="_blank">
                    <img src="${projectThumbnail}" alt="${project.name} Thumbnail" class="project-thumbnail">
                    <h3>${project.name}</h3>
                </a>
                <p>${project.description || 'No description available'}</p>
            `;

            projectsGrid.appendChild(projectCard);
        }
    } catch (error) {
        console.error('Error fetching projects from local JSON:', error);
    }
}

// Call fetchProjects when the page loads
document.addEventListener('DOMContentLoaded', fetchProjects);
