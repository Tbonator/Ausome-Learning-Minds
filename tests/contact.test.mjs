import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

async function setup(response) {
  const dom = new JSDOM(fs.readFileSync(new URL('../contact.html', import.meta.url), 'utf8'), {url:'http://localhost/contact.html'});
  const previous = {document:globalThis.document, window:globalThis.window, FormData:globalThis.FormData, fetch:globalThis.fetch};
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.FormData = dom.window.FormData;
  const calls = [];
  globalThis.fetch = async (url, options) => {calls.push({url, options}); return response;};
  await import(`../src/js/contact.js?case=${crypto.randomUUID()}`);
  const form = dom.window.document.querySelector('[data-contact-form]');
  form.elements.namedItem('First name').value = 'Sample';
  form.elements.namedItem('Last name').value = 'Enquiry';
  form.elements.namedItem('email').value = 'sample@example.com';
  form.elements.namedItem('Message').value = 'A fictional message for an offline test.';
  return {dom, form, calls, cleanup() {Object.assign(globalThis, previous); dom.window.close();}};
}

test('contact form uses its separate endpoint and resets only after acceptance', async () => {
  const context = await setup({ok:true});
  try {
    context.form.dispatchEvent(new context.dom.window.Event('submit', {cancelable:true}));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(context.calls.length, 1);
    assert.equal(context.calls[0].url, 'https://formspree.io/f/xyewpbnl');
    assert.equal(context.calls[0].options.body.get('_gotcha'), '');
    assert.equal(context.calls[0].options.body.get('email'), 'sample@example.com');
    assert.equal(context.form.elements.namedItem('Message').value, '');
    assert.match(context.form.querySelector('[data-contact-status]').textContent, /has been sent/);
    assert.equal(context.form.querySelector('button').disabled, false);
  } finally {context.cleanup();}
});

test('rejected contact submissions preserve the message and provide direct contact details', async () => {
  const context = await setup({ok:false});
  try {
    context.form.dispatchEvent(new context.dom.window.Event('submit', {cancelable:true}));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(context.form.elements.namedItem('Message').value, 'A fictional message for an offline test.');
    assert.match(context.form.querySelector('[data-contact-status]').textContent, /info@ausomelearningminds.co.za/);
    assert.equal(context.form.querySelector('button').disabled, false);
  } finally {context.cleanup();}
});
