import content from '../content/workshops.json';
import {validateContent, renderPhotos, renderEvents, upcomingEvents} from './workshop-content.js';

const assets = import.meta.glob('../images/workshops/*', {eager:true, query:'?url', import:'default'});
const photoUrl = path => assets[path.replace('src/', '../')];

try {
  validateContent(content);
  const fields = {
    title: '.hero__title', intro: '.hero__lead', galleryTitle: '#gallery-title',
    galleryIntro: '#gallery-title + p', communityTitle: '#community-title', communityText: '#community-title + p',
  };
  for (const [key, selector] of Object.entries(fields)) document.querySelector(selector).textContent = content[key];
  const featured = content.photos.find(photo => photo.id === content.featuredPhotoId);
  const hero = document.querySelector('.hero__visual');
  if (featured && photoUrl(featured.src)) hero.querySelector('.hero-photo').src = photoUrl(featured.src);
  else hero.hidden = true;
  renderPhotos(document.querySelector('.workshop-gallery'), content.photos, photoUrl);
  renderEvents(document.querySelector('#upcoming-events'), upcomingEvents(content.events));
  document.title = `${content.title} | Ausome Learning Minds`;
} catch (error) {
  console.error('Workshop content could not be loaded:', error.message);
}
