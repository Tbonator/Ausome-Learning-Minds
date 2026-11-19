import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {collectApplication, createApplicationPdf} from '../src/js/application-pdf.js';

const fonts = {
  regular:fs.readFileSync(new URL('../src/fonts/Lato-Regular.ttf', import.meta.url)).toString('base64'),
  bold:fs.readFileSync(new URL('../src/fonts/Lato-Bold.ttf', import.meta.url)).toString('base64'),
};

export function sampleApplication(file) {
  const dom = new JSDOM(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  const form = dom.window.document.querySelector('form[data-online-form]');
  for (const input of form.querySelectorAll('input, textarea, select')) {
    if (input.type === 'hidden' || input.name === '_gotcha') continue;
    if (input.type === 'checkbox') {input.checked = true; continue;}
    if (input.type === 'radio') {input.checked = ![...form.elements].some(item => item !== input && item.name === input.name && item.checked); continue;}
    if (input.tagName === 'SELECT') {input.selectedIndex = 1; continue;}
    input.value = input.type === 'date' ? '2026-11-19' : input.type === 'email' ? 'sample@example.com' : input.type === 'tel' ? '0000000000' : input.pattern ? '0000000000000' : 'Sample information';
  }
  if (file === 'apply.html') {
    form.elements.namedItem('Learner - Full names').value = 'Zoë';
    form.elements.namedItem('Learner - Surname').value = 'Example';
    form.elements.namedItem('Learner - Date of birth').value = '2018-03-12';
    form.elements.namedItem('Medical - Conditions').value = 'Fictional sample only. No real learner or medical information is included in this preview.';
  } else form.elements.namedItem('Child 1 - Full name').value = 'Zoë Example';
  const original = globalThis.FormData;
  globalThis.FormData = dom.window.FormData;
  try {return collectApplication(form, new Date('2026-11-19T10:00:00Z'));}
  finally {globalThis.FormData = original; dom.window.close();}
}

test('application capture keeps every section and agreement, without the honeypot or hidden routing fields', () => {
  const application = sampleApplication('apply.html');
  assert.equal(application.learner, 'Zoë Example');
  assert.equal(application.sections.length, 8);
  assert.equal(application.agreements.length, 6);
  const fields = application.sections.flatMap(section => section.fields);
  assert.equal(fields.find(field => field.label === 'Payment option').value, 'Monthly');
  assert.ok(!fields.some(field => /_subject|_gotcha/.test(field.label)));
  assert.ok(fields.some(field => field.value === 'Confirmed'));
});

test('aftercare capture includes its actual terms and selected childcare option', () => {
  const application = sampleApplication('aftercare.html');
  assert.equal(application.title, 'Aftercare application');
  assert.equal(application.sections.length, 5);
  assert.equal(application.agreements[0].paragraphs.length, 6);
  assert.ok(application.sections.flatMap(section => section.fields).some(field => field.value === 'Including homework'));
});

test('long answers paginate without producing an invalid PDF', () => {
  const application = sampleApplication('apply.html');
  application.sections[0].fields[0].value = 'A detailed answer with accented names like Zoë and André. '.repeat(160);
  const pdf = createApplicationPdf(application, fonts);
  assert.ok(pdf.getNumberOfPages() >= 5);
  assert.ok(pdf.output().startsWith('%PDF-'));
});
