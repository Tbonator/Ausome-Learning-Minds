import {openPhotoGallery} from './photo-gallery.js';

export const PHOTO_PATH = /^src\/images\/workshops\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/;
export const pageFields = ['title', 'intro', 'galleryTitle', 'galleryIntro', 'communityTitle', 'communityText'];

export function safeLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function validateContent(data) {
  if (!data || data.version !== 1) throw new Error('Unsupported content format.');
  for (const key of pageFields) {
    if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > 5000) {
      throw new Error('Complete all page text fields (maximum 5,000 characters each).');
    }
  }
  if (!Array.isArray(data.photos) || !Array.isArray(data.events)) throw new Error('Invalid photo or event list.');
  if (data.photos.length > 100 || data.events.length > 100) throw new Error('Keep each list to 100 items or fewer.');
  const ids = new Set();
  for (const photo of data.photos) {
    if (typeof photo.id !== 'string' || ids.has(photo.id) || !PHOTO_PATH.test(photo.src) ||
        typeof photo.alt !== 'string' || !photo.alt.trim() || photo.alt.length > 500 ||
        typeof photo.caption !== 'string' || photo.caption.length > 500) {
      throw new Error('Each photo needs a unique ID, a supported image, and an image description.');
    }
    ids.add(photo.id);
  }
  if (data.featuredPhotoId && !ids.has(data.featuredPhotoId)) throw new Error('Choose an existing featured photo.');
  const eventIds = new Set();
  for (const event of data.events) {
    const parsedDate = new Date(`${event.date}T12:00:00Z`);
    if (typeof event.id !== 'string' || eventIds.has(event.id) || typeof event.title !== 'string' ||
        !event.title.trim() || event.title.length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
        !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== event.date ||
        !['draft', 'published'].includes(event.status)) throw new Error('Each event needs a title, valid date, and status.');
    for (const key of ['time', 'location', 'description', 'link']) {
      if (typeof event[key] !== 'string' || event[key].length > 5000) throw new Error('Invalid event details.');
    }
    if (event.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) throw new Error('Enter a valid event time.');
    if (event.link && !safeLink(event.link)) throw new Error('Event links must start with https:// or http://.');
    eventIds.add(event.id);
  }
  return data;
}

export function southAfricanDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Africa/Johannesburg', year:'numeric', month:'2-digit', day:'2-digit',
  }).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function upcomingEvents(events, today = southAfricanDate()) {
  return events.filter(event => event.status === 'published' && event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function renderEvents(container, events) {
  container.replaceChildren();
  if (!events.length) {
    const empty = el('p', 'Please contact the centre for upcoming workshop and event dates.', 'event-empty');
    container.append(empty);
    return;
  }
  for (const event of events) {
    const card = el('article', undefined, 'event-card');
    const date = el('time', new Intl.DateTimeFormat('en-ZA', {day:'numeric', month:'long', year:'numeric', timeZone:'Africa/Johannesburg'})
      .format(new Date(`${event.date}T12:00:00Z`)), 'event-date');
    date.dateTime = event.date;
    card.append(date, el('h3', event.title));
    if (event.time) card.append(el('p', `${event.time} SAST`, 'event-meta'));
    if (event.location) card.append(el('p', event.location, 'event-meta'));
    if (event.description) card.append(el('p', event.description, 'event-description'));
    if (safeLink(event.link)) {
      const link = el('a', 'Event details / booking', 'tile__link');
      link.href = safeLink(event.link);
      card.append(link);
    }
    container.append(card);
  }
}

export function renderPhotos(container, photos, resolvePhoto) {
  container.replaceChildren();
  const items = photos.map(photo => ({...photo, src:resolvePhoto(photo.src)})).filter(photo => photo.src);
  for (const [index, photo] of items.entries()) {
    const src = photo.src;
    const figure = el('figure', undefined, 'workshop-photo');
    const link = el('button', undefined, 'workshop-photo__open');
    link.type = 'button';
    link.setAttribute('aria-label', `Open gallery: ${photo.alt}`);
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', () => openPhotoGallery(items, index, link));
    const image = el('img');
    image.src = src;
    image.alt = photo.alt;
    image.loading = 'lazy';
    link.append(image);
    figure.append(link);
    if (photo.caption) figure.append(el('figcaption', photo.caption));
    container.append(figure);
  }
}
