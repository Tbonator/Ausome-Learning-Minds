const form = document.querySelector('[data-contact-form]');

if (form) {
  const status = form.querySelector('[data-contact-status]');
  const button = form.querySelector('[type="submit"]');
  let sending = false;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const values = new FormData(form);
    const endpoint = form.dataset.endpoint;

    if (!endpoint) {
      const name = `${values.get('First name')} ${values.get('Last name')}`.trim();
      const body = `Name: ${name}\nEmail: ${values.get('email')}\n\n${values.get('Message') || ''}`;
      window.location.href = `mailto:info@ausomelearningminds.co.za?subject=${encodeURIComponent('Website enquiry - Ausome Learning Minds')}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Your email app should open. Review and send your message there. You can also email info@ausomelearningminds.co.za directly.';
      return;
    }

    sending = true;
    button.disabled = true;
    form.inert = true;
    button.textContent = 'Sending...';
    status.classList.remove('is-error');
    status.textContent = 'Sending your enquiry...';
    try {
      const response = await fetch(endpoint, {method:'POST', body:values, headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error('Submission was not accepted.');
      form.reset();
      status.textContent = 'Thank you! Your enquiry has been sent. We look forward to speaking with you.';
    } catch {
      status.classList.add('is-error');
      status.textContent = 'Your enquiry could not be sent. Please try again, call 064 909 7710, or email info@ausomelearningminds.co.za. Your message is still here.';
    } finally {
      sending = false;
      form.inert = false;
      button.disabled = false;
      button.textContent = 'Send enquiry';
    }
  });
}
