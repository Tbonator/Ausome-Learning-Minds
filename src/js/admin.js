import initialContent from '../content/workshops.json';
import {pageFields, validateContent, renderEvents, renderPhotos, upcomingEvents} from './workshop-content.js';
import {WorkshopRepository, REPOSITORY, BRANCH} from './workshop-github.js';

const assets = import.meta.glob('../images/workshops/*', {eager:true, query:'?url', import:'default'});
let data = structuredClone(initialContent);
let repository = null;
let dirty = false;
let busy = false;
const uploads = new Map();
const imageUrls = new Map();
const $ = selector => document.querySelector(selector);
const labels = {
  title:'Page title', intro:'Page introduction', galleryTitle:'Gallery heading', galleryIntro:'Gallery introduction',
  communityTitle:'Community heading', communityText:'Community message',
};

function status(message, error = false) {
  $('#admin-status').textContent = message;
  $('#admin-status').classList.toggle('is-error', error);
}

function markDirty() {
  dirty = true;
  $('#save-state').textContent = 'You have unpublished changes. Keep this tab open.';
}

function setBusy(value) {
  busy = value;
  $('#editor').inert = value;
  $('#connect-form').inert = value;
  $('#editor').setAttribute('aria-busy', String(value));
  $('#publish-button').disabled = value || !repository;
}

function photoUrl(path) {
  return imageUrls.get(path) || assets[path.replace('src/', '../')] ||
    `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/${path}`;
}

function button(text, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = text;
  node.addEventListener('click', action);
  return node;
}

function field(label, value, onChange, {type = 'text', required = false, choices, maxLength = 5000} = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const name = document.createElement('label');
  const id = `field-${crypto.randomUUID()}`;
  name.htmlFor = id;
  name.textContent = label;
  const input = document.createElement(choices ? 'select' : type === 'textarea' ? 'textarea' : 'input');
  if (choices) {
    for (const [key, title] of choices) input.add(new Option(title, key));
  } else if (type === 'textarea') input.rows = 3;
  else input.type = type;
  input.id = id;
  input.value = value;
  input.required = required;
  input.maxLength = maxLength;
  input.addEventListener('input', () => { onChange(input.value); markDirty(); });
  wrapper.append(name, input);
  return wrapper;
}

function renderFeatured() {
  const select = $('#featured-photo');
  select.replaceChildren(new Option('No featured photo', ''));
  for (const photo of data.photos) select.add(new Option(photo.caption || photo.alt, photo.id));
  select.value = data.featuredPhotoId || '';
}

function renderEditor() {
  $('#page-fields').replaceChildren(...pageFields.map(key => {
    const wrapper = field(labels[key], data[key], value => {data[key] = value;}, {
      type: key.toLowerCase().includes('intro') || key === 'communityText' ? 'textarea' : 'text', required:true,
    });
    if (key === 'communityText') wrapper.classList.add('field--full');
    return wrapper;
  }));
  renderFeatured();
  renderEventEditors();
  renderPhotoEditors();
}

function renderEventEditors() {
  $('#event-editors').replaceChildren(...data.events.map((event, index) => {
    const card = document.createElement('section');
    card.className = 'admin-event';
    const heading = document.createElement('h3');
    heading.textContent = `Event ${index + 1}`;
    const fields = document.createElement('div');
    fields.className = 'fields';
    for (const [key, label, options] of [
      ['title','Event title',{required:true, maxLength:200}],
      ['status','Visibility',{choices:[['draft','Draft — hidden from the page'], ['published','Published']]}],
      ['date','Event date',{type:'date', required:true}], ['time','Start time (South African time)',{type:'time'}],
      ['location','Venue or online meeting details',{}], ['link','Details / booking link (optional)',{type:'url'}],
      ['description','Event description',{type:'textarea'}],
    ]) {
      const wrapper = field(label, event[key], value => {event[key] = value;}, options);
      if (key === 'description') wrapper.classList.add('field--full');
      fields.append(wrapper);
    }
    const remove = button('Remove event', () => {
      if (!confirm(`Remove ${event.title || 'this event'}? This takes effect when you publish.`)) return;
      data.events.splice(index, 1);
      markDirty(); renderEventEditors();
    });
    remove.className = 'btn admin-secondary';
    card.append(heading, fields, remove);
    return card;
  }));
}

function renderPhotoEditors() {
  $('#photo-editors').replaceChildren(...data.photos.map((photo, index) => {
    const card = document.createElement('div');
    card.className = 'admin-photo';
    const image = document.createElement('img');
    image.src = photoUrl(photo.src);
    image.alt = photo.alt;
    image.loading = 'lazy';
    const caption = field('Caption', photo.caption, value => {photo.caption = value; renderFeatured();}, {maxLength:500});
    const alt = field('Image description', photo.alt, value => {photo.alt = value; image.alt = value;}, {required:true, maxLength:500});
    const actions = document.createElement('div');
    actions.className = 'admin-photo-actions';
    const up = button('Move earlier', () => movePhoto(index, -1));
    const down = button('Move later', () => movePhoto(index, 1));
    up.disabled = index === 0;
    down.disabled = index === data.photos.length - 1;
    const remove = button('Remove photo', () => {
      if (!confirm('Remove this photo from the gallery? This takes effect when you publish.')) return;
      data.photos.splice(index, 1);
      uploads.delete(photo.src);
      if (imageUrls.has(photo.src)) { URL.revokeObjectURL(imageUrls.get(photo.src)); imageUrls.delete(photo.src); }
      if (data.featuredPhotoId === photo.id) data.featuredPhotoId = data.photos[0]?.id || '';
      markDirty(); renderFeatured(); renderPhotoEditors();
    });
    actions.append(up, down, remove);
    card.append(image, caption, alt, actions);
    return card;
  }));
}

function movePhoto(index, direction) {
  const next = index + direction;
  [data.photos[index], data.photos[next]] = [data.photos[next], data.photos[index]];
  markDirty(); renderPhotoEditors();
  $('#photo-editors').children[next].querySelector('button:not(:disabled)')?.focus();
}

function clearUploads() {
  for (const url of imageUrls.values()) URL.revokeObjectURL(url);
  uploads.clear(); imageUrls.clear();
}

$('#featured-photo').addEventListener('change', event => {data.featuredPhotoId = event.target.value; markDirty();});
$('#add-event').addEventListener('click', () => {
  if (data.events.length >= 100) { status('You can have up to 100 events.', true); return; }
  data.events.push({id:crypto.randomUUID(), title:'', status:'draft', date:'', time:'', location:'', description:'', link:''});
  markDirty(); renderEventEditors();
  $('#event-editors').lastElementChild.querySelector('input').focus();
});

$('#photo-upload').addEventListener('change', async event => {
  const files = [...event.target.files];
  setBusy(true);
  try {
    if (data.photos.length + files.length > 100) throw new Error('You can have up to 100 photos.');
    let totalBytes = [...uploads.values()].reduce((sum, item) => sum + item.size, 0);
    for (const file of files) {
      const extension = {'image/jpeg':'jpeg', 'image/png':'png', 'image/webp':'webp'}[file.type];
      if (!extension || file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: choose a JPEG, PNG or WebP image under 8 MB.`);
      if (totalBytes + file.size > 30 * 1024 * 1024) throw new Error('Upload up to 30 MB at a time. Publish these photos first, then add more.');
      const bitmap = await createImageBitmap(file).catch(() => {throw new Error(`${file.name} could not be read as a photograph.`);});
      bitmap.close();
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
      });
      const id = crypto.randomUUID();
      const path = `src/images/workshops/photo-${id}.${extension}`;
      const caption = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').slice(0, 500);
      uploads.set(path, {base64:encoded, size:file.size});
      imageUrls.set(path, URL.createObjectURL(file));
      data.photos.push({id, src:path, caption, alt:caption || 'Workshop photograph'});
      totalBytes += file.size;
      if (!data.featuredPhotoId) data.featuredPhotoId = id;
      markDirty();
    }
    status('Photos added to your draft. Review the captions and image descriptions before publishing.');
  } catch (error) {status(error.message, true);}
  finally {event.target.value = ''; renderPhotoEditors(); renderFeatured(); setBusy(false);}
});

$('#preview-button').addEventListener('click', () => {
  try {
    validateContent(data);
    if (!$('#editor').reportValidity()) return;
    $('#preview-title').textContent = data.title;
    $('#preview-intro').textContent = data.intro;
    $('#preview-gallery-title').textContent = data.galleryTitle;
    $('#preview-gallery-intro').textContent = data.galleryIntro;
    $('#preview-community-title').textContent = data.communityTitle;
    $('#preview-community-text').textContent = data.communityText;
    renderEvents($('#preview-events'), upcomingEvents(data.events));
    renderPhotos($('#preview-gallery'), data.photos, photoUrl);
    $('#preview').hidden = false;
    $('#preview').scrollIntoView({behavior:'smooth'});
    status('Preview updated. Draft and past events are hidden, just as on the public page.');
  } catch (error) {status(error.message, true);}
});

$('#connect-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (dirty && !confirm('Load the saved page from GitHub? This replaces your unpublished edits in this tab.')) return;
  const nextRepository = new WorkshopRepository($('#access-token').value.trim());
  $('#access-token').value = '';
  setBusy(true);
  try {
    const saved = validateContent(await nextRepository.load());
    repository?.disconnect();
    repository = nextRepository;
    clearUploads(); data = saved; dirty = false;
    $('#preview').hidden = true;
    renderEditor();
    $('#disconnect').hidden = false;
    $('#connection-state').textContent = `Connected to ${REPOSITORY}. Ready to publish.`;
    $('#save-state').textContent = 'Latest saved content loaded.';
    status('Connected. You can now edit and publish.');
  } catch (error) {nextRepository.disconnect(); status(error.message, true);}
  finally {setBusy(false);}
});

$('#disconnect').addEventListener('click', () => {
  repository?.disconnect(); repository = null;
  $('#disconnect').hidden = true;
  $('#publish-button').disabled = true;
  $('#connection-state').textContent = 'Disconnected. Edits remain in this tab; publishing is disabled.';
  status('Disconnected. Your access token has been cleared from the editor.');
});

$('#editor').addEventListener('submit', async event => {
  event.preventDefault();
  if (!repository || busy) return;
  try {validateContent(data);} catch (error) {status(error.message, true); return;}
  setBusy(true);
  try {
    const commit = await repository.publish(data, uploads, message => status(message));
    uploads.clear(); dirty = false;
    $('#save-state').textContent = 'Saved to GitHub. Website deployment is pending.';
    status(`Changes saved (${commit.slice(0, 7)}). GitHub Pages will update the public site after deployment finishes. Draft events remain hidden.`);
  } catch (error) {status(error.message, true);}
  finally {setBusy(false);}
});

window.addEventListener('beforeunload', event => {
  if (dirty || busy) {event.preventDefault(); event.returnValue = '';}
});

renderEditor();
