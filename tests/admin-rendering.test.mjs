import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

test('owner inbox renders untrusted learner text without executing or creating markup',async () => {
  const original = {document:globalThis.document,fetch:globalThis.fetch};
  const dom = new JSDOM(fs.readFileSync(new URL('../applications-admin.html',import.meta.url),'utf8'),{url:'http://127.0.0.1:5173/applications-admin.html'});
  const attack = '<img src=x onerror="globalThis.compromised=1">';
  globalThis.document = dom.window.document;
  globalThis.fetch = async url => ({ok:true,status:200,json:async () => url.endsWith('session') ? {ok:true,csrf:'test-csrf'} : {
    ok:true,hasMore:false,records:[{reference:'ALM-test-reference',kind:'school',learner:attack,submittedAt:'2026-11-19T10:00:00Z',reviewed:false,emailStatus:'pending'}],
  }});
  try {
    await import(`../src/js/applications-admin.js?xss-check=${crypto.randomUUID()}`);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(document.querySelector('.application-record h3').textContent,attack);
    assert.equal(document.querySelector('#application-records img'),null);
    assert.equal(document.querySelector('#application-records script'),null);
  } finally {Object.assign(globalThis,original); dom.window.close();}
});
