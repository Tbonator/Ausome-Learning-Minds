let viewer;
let photos = [];
let current = 0;
let trigger;
let previousOverflow = '';

function control(label, text, action, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.textContent = text;
  button.addEventListener('click', action);
  return button;
}

function createViewer() {
  const dialog = document.createElement('dialog');
  dialog.className = 'gallery-viewer';
  dialog.setAttribute('aria-label', 'Workshop photo gallery');
  const panel = document.createElement('div');
  panel.className = 'gallery-viewer__panel';
  const header = document.createElement('div');
  header.className = 'gallery-viewer__header';
  const title = document.createElement('strong');
  title.textContent = 'Our community gallery';
  const close = control('Close photo gallery', 'Close ×', () => dialog.close(), 'gallery-viewer__close');
  header.append(title, close);
  const stage = document.createElement('div');
  stage.className = 'gallery-viewer__stage';
  const image = document.createElement('img');
  image.className = 'gallery-viewer__image';
  image.draggable = false;
  const previous = control('Previous photo', '‹', () => show(current - 1), 'gallery-viewer__previous');
  const next = control('Next photo', '›', () => show(current + 1), 'gallery-viewer__next');
  stage.append(previous, image, next);
  const caption = document.createElement('p');
  caption.className = 'gallery-viewer__caption';
  caption.setAttribute('aria-live', 'polite');
  caption.setAttribute('aria-atomic', 'true');
  const message = document.createElement('p');
  message.className = 'gallery-viewer__message';
  message.setAttribute('role', 'status');
  image.addEventListener('load', () => { message.textContent = ''; });
  image.addEventListener('error', () => { message.textContent = 'This photo could not load. Please try another photo.'; });
  const thumbnails = document.createElement('div');
  thumbnails.className = 'gallery-viewer__thumbnails';
  thumbnails.setAttribute('aria-label', 'Choose a photograph');
  const hint = document.createElement('p');
  hint.className = 'gallery-viewer__hint';
  hint.textContent = 'Use the arrow keys or swipe to browse. Press Escape to close.';
  panel.append(header, stage, caption, message, thumbnails, hint);
  dialog.append(panel);
  document.body.append(dialog);
  dialog.addEventListener('click', event => {if (event.target === dialog) dialog.close();});
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    image.removeAttribute('src');
    if (trigger?.isConnected) trigger.focus({preventScroll:true});
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {event.preventDefault(); show(current - 1);}
    if (event.key === 'ArrowRight') {event.preventDefault(); show(current + 1);}
    if (event.key === 'Home') {event.preventDefault(); show(0);}
    if (event.key === 'End') {event.preventDefault(); show(photos.length - 1);}
  });
  let swipeStart;
  image.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    swipeStart = {x:event.clientX, y:event.clientY};
    image.setPointerCapture(event.pointerId);
  });
  image.addEventListener('pointercancel', () => {swipeStart = null;});
  image.addEventListener('pointerup', event => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  });
  return {dialog, image, caption, thumbnails, message, close, previous, next};
}

function show(index) {
  current = (index + photos.length) % photos.length;
  const photo = photos[current];
  viewer.message.textContent = 'Loading photograph…';
  viewer.image.alt = photo.alt;
  viewer.image.src = photo.src;
  viewer.caption.textContent = `${current + 1} / ${photos.length}${photo.caption ? ` — ${photo.caption}` : ''}`;
  for (const [i, thumbnail] of [...viewer.thumbnails.children].entries()) {
    thumbnail.setAttribute('aria-pressed', String(i === current));
  }
  viewer.thumbnails.children[current]?.scrollIntoView({block:'nearest', inline:'nearest'});
}

export function openPhotoGallery(items, index, opener) {
  if (!items.length) return;
  viewer ||= createViewer();
  photos = items;
  trigger = opener;
  viewer.thumbnails.replaceChildren(...photos.map((photo, i) => {
    const button = control(`View photo ${i + 1}: ${photo.caption || photo.alt}`, '', () => show(i), 'gallery-viewer__thumbnail');
    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = '';
    image.loading = 'lazy';
    button.append(image);
    return button;
  }));
  viewer.previous.disabled = viewer.next.disabled = photos.length < 2;
  if (!viewer.dialog.open) {
    previousOverflow = document.body.style.overflow;
    viewer.dialog.showModal();
    document.body.style.overflow = 'hidden';
  }
  show(index);
  viewer.close.focus({preventScroll:true});
}
