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

// Find us page: build the map and directions link from the address
const locationEl = document.querySelector('[data-location]');
const address = locationEl?.dataset.address.trim();

if (locationEl && address) {
  const q = encodeURIComponent(address);
  const frame = locationEl.querySelector('.map-card__frame');
  const empty = locationEl.querySelector('.map-card__empty');
  const directions = locationEl.querySelector('[data-directions]');
  const addressText = locationEl.querySelector('[data-address-text]');

  frame.src = `https://www.google.com/maps?q=${q}&output=embed`;
  frame.hidden = false;
  empty.hidden = true;
  directions.href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  directions.hidden = false;
  addressText.textContent = address;
}

// Online forms (apply.html, aftercare.html).
// Each form posts to the URL in its data-endpoint attribute; empty = not switched on yet.
const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

document.querySelectorAll('form[data-online-form]').forEach((form) => {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('[type="submit"]');
  const success = form.nextElementSibling?.matches('.form-success') ? form.nextElementSibling : null;

  form.querySelectorAll('input[data-today]').forEach((input) => {
    input.value = today();
  });

  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    form.classList.add('was-validated');

    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector('input:invalid, select:invalid, textarea:invalid');
      firstInvalid?.focus();
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showStatus('Please complete the fields highlighted in red.', true);
      return;
    }

    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      showStatus('Online submissions are not switched on yet. Please call us on 064 909 7710.', true);
      return;
    }

    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending…';
    showStatus('');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.reset();
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.focus();
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {
      showStatus('Sorry, your form could not be sent. Please try again or call us on 064 909 7710.', true);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
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
