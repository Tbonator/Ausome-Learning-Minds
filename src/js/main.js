// Entry point for Ausome Learning Minds

// Enables the scroll-reveal styles. Set here (not inline) so that if this
// script can't load, content simply stays visible.
document.documentElement.classList.add('js');

// Footer year
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Mobile navigation toggle
const toggle = document.querySelector('.nav__toggle');
const links = document.getElementById('nav-links');

if (toggle && links) {
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('is-open')) {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

// Video placeholders: no video yet, so tell the visitor
document.querySelectorAll('.play-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const label = btn.closest('.video-card')?.querySelector('.video-card__bar span');
    if (label) label.textContent = 'Video coming soon';
  });
});

// Fade sections in as they scroll into view
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}
