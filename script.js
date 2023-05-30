// Filter portfolio projects by category
const filterButtons = document.querySelectorAll('.project-category');

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const category = button.textContent.toLowerCase();
    const projects = document.querySelectorAll('.project');
    projects.forEach(project => {
      if (project.classList.contains(category)) {
        project.style.display = 'flex';
      } else {
        project.style.display = 'none';
      }
    });
  });
});

// Smooth scroll to anchor links
const scrollLinks = document.querySelectorAll('a[href^="#"]');

scrollLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const href = link.getAttribute('href');
    document.querySelector(href).scrollIntoView({
      behavior: 'smooth'
    });
  });
});
