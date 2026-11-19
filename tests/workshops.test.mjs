import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateContent, safeLink, upcomingEvents, southAfricanDate} from '../src/js/workshop-content.js';
import {WorkshopRepository} from '../src/js/workshop-github.js';

const seed = () => JSON.parse(fs.readFileSync(new URL('../src/content/workshops.json', import.meta.url), 'utf8'));
const event = (overrides = {}) => ({id:'test-event', title:'Family workshop', date:'2027-01-21', time:'09:00',
  location:'Centre', description:'Meet and learn together.', link:'', status:'published', ...overrides});

test('initial photos and content are valid and all photo files exist', () => {
  const content = validateContent(seed());
  assert.equal(content.photos.length, 8);
  for (const photo of content.photos) assert.ok(fs.existsSync(new URL(`../${photo.src}`, import.meta.url)));
});

test('South African midnight and upcoming date filtering hide past and draft events', () => {
  assert.equal(southAfricanDate(new Date('2026-11-19T22:30:00Z')), '2026-11-20');
  const events = [event({id:'late', date:'2027-02-01'}), event({id:'draft', status:'draft'}),
    event({id:'past', date:'2026-11-01'}), event({id:'today', date:'2026-11-20'})];
  assert.deepEqual(upcomingEvents(events, '2026-11-20').map(item => item.id), ['today', 'late']);
});

test('invalid dates, unsafe photo paths, duplicate photos and executable booking links are rejected', () => {
  for (const date of ['2027-02-30', 'not-a-date', '2027-13-01']) {
    const content = seed(); content.events = [event({date})];
    assert.throws(() => validateContent(content));
  }
  const content = seed(); content.photos[0].src = '../../secrets.png';
  assert.throws(() => validateContent(content));
  const duplicate = seed(); duplicate.photos.push(duplicate.photos[0]);
  assert.throws(() => validateContent(duplicate));
  const unsafe = seed(); unsafe.events = [event({link:'javascript:alert(1)'})];
  assert.throws(() => validateContent(unsafe));
  assert.equal(safeLink('data:text/html,hello'), '');
  assert.equal(safeLink('https://example.org/book'), 'https://example.org/book');
});

function mockRepository({conflict = false, failRef = false} = {}) {
  const calls = [];
  const request = async (url, options) => {
    const path = url.split('/Ausome-Learning-Minds/')[1];
    calls.push({path, method:options.method, body:options.body ? JSON.parse(options.body) : null});
    let payload;
    let code = 200;
    if (path === 'git/ref/heads/main') payload = {object:{sha:'head-1'}};
    else if (path.startsWith('contents/')) payload = {sha:conflict ? 'changed-file' : 'original-file',
      content:Buffer.from(JSON.stringify(seed())).toString('base64')};
    else if (path === 'git/commits/head-1') payload = {tree:{sha:'old-tree'}};
    else if (path === 'git/blobs') payload = {sha:calls.at(-1).body.encoding === 'base64' ? 'photo-blob' : 'content-blob'};
    else if (path === 'git/trees') payload = {sha:'new-tree'};
    else if (path === 'git/commits') payload = {sha:'new-commit'};
    else if (path === 'git/refs/heads/main') {payload = {}; if (failRef) code = 422;}
    else assert.fail(`Unexpected request: ${path}`);
    return {ok:code === 200, status:code, json:async () => payload};
  };
  const repo = new WorkshopRepository('test-token', request);
  return {repo, calls};
}

test('published content loads from a fixed commit and decodes Unicode', async () => {
  const {repo, calls} = mockRepository();
  assert.deepEqual(await repo.load(), seed());
  assert.ok(calls[1].path.endsWith('?ref=head-1'));
  assert.equal(repo.contentSha, 'original-file');
});

test('photos and content publish in one atomic commit without force-pushing', async () => {
  const {repo, calls} = mockRepository();
  repo.contentSha = 'original-file';
  const content = seed();
  content.photos.push({id:'new-photo', src:'src/images/workshops/new-photo.jpeg', alt:'Workshop gathering', caption:'New photo'});
  const uploads = new Map([[content.photos.at(-1).src, {base64:'dGVzdA=='}], ['unused.jpeg', {base64:'dGVzdA=='}]]);
  assert.equal(await repo.publish(content, uploads), 'new-commit');
  const tree = calls.find(call => call.path === 'git/trees').body;
  assert.equal(tree.base_tree, 'old-tree');
  assert.equal(tree.tree.length, 2);
  assert.equal(tree.tree[1].path, 'src/content/workshops.json');
  assert.deepEqual(calls.at(-1).body, {sha:'new-commit', force:false});
  assert.equal(repo.contentSha, 'content-blob');
});

test('concurrent content changes stop publishing before any uploads', async () => {
  const {repo, calls} = mockRepository({conflict:true}); repo.contentSha = 'original-file';
  await assert.rejects(repo.publish(seed(), new Map()), /Someone changed/);
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('a failed branch update never reports success or advances the saved revision', async () => {
  const {repo} = mockRepository({failRef:true}); repo.contentSha = 'original-file';
  await assert.rejects(repo.publish(seed(), new Map()), /not been confirmed/);
  assert.equal(repo.contentSha, 'original-file');
});

test('authentication failure exposes a useful error and disconnect clears credentials', async () => {
  const repo = new WorkshopRepository('test-token', async () => ({ok:false, status:401}));
  await assert.rejects(repo.load(), /could not verify/);
  repo.disconnect();
  assert.equal(repo.token, '');
  assert.equal(repo.contentSha, null);
});
