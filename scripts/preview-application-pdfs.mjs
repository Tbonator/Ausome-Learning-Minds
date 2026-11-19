import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {collectApplication, createApplicationPdf} from '../src/js/application-pdf.js';

const fonts = Object.fromEntries(['regular','bold'].map(style => [style,fs.readFileSync(`src/fonts/Lato-${style === 'regular' ? 'Regular' : 'Bold'}.ttf`).toString('base64')]));
fs.mkdirSync('output/pdf',{recursive:true});
fs.mkdirSync('tmp/pdfs',{recursive:true});
for (const file of ['apply.html','aftercare.html']) {
  const dom = new JSDOM(fs.readFileSync(file,'utf8'));
  const form = dom.window.document.querySelector('form[data-online-form]');
  for (const input of form.querySelectorAll('input, textarea, select')) {
    if (input.type === 'hidden' || input.name === '_gotcha') continue;
    if (input.type === 'checkbox') {input.checked = true; continue;}
    if (input.type === 'radio') {if (![...form.elements].some(item => item !== input && item.name === input.name && item.checked)) input.checked = true; continue;}
    if (input.tagName === 'SELECT') {input.selectedIndex = 1; continue;}
    input.value = input.type === 'date' ? '2026-11-19' : input.type === 'email' ? 'sample@example.com' : input.type === 'tel' ? '0000000000' : input.pattern ? '0000000000000' : /names|name/i.test(input.name) ? 'Zoë Example (sample)' : /address/i.test(input.name) ? 'Fictional address - demonstration only' : 'Sample information';
  }
  if (file === 'apply.html') {
    form.elements.namedItem('Learner - Full names').value = 'Zoë';
    form.elements.namedItem('Learner - Preferred name').value = 'Zoë';
    form.elements.namedItem('Learner - Surname').value = 'Example';
    form.elements.namedItem('Learner - Date of birth').value = '2018-03-12';
    form.elements.namedItem('Learner - Home language').value = 'English';
  } else form.elements.namedItem('Child 1 - Full name').value = 'Zoë Example';
  const original = globalThis.FormData;
  globalThis.FormData = dom.window.FormData;
  const application = collectApplication(form,new Date('2026-11-19T10:00:00Z'));
  globalThis.FormData = original;
  application.title += ' - SAMPLE';
  const pdf = createApplicationPdf(application, fonts);
  const filename = file === 'apply.html' ? 'school-application-sample' : 'aftercare-application-sample';
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  fs.writeFileSync(`output/pdf/${filename}.pdf`, bytes);
  const loadingTask = getDocument({data:bytes, useSystemFonts:true, isEvalSupported:false});
  const rendered = await loadingTask.promise;
  let allText = '';
  for (let number = 1; number <= rendered.numPages; number++) {
    const page = await rendered.getPage(number);
    const viewport = page.getViewport({scale:1.4});
    const canvas = createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    await page.render({canvasContext:canvas.getContext('2d'), viewport}).promise;
    fs.writeFileSync(path.join('tmp/pdfs',`${filename}-${number}.png`),canvas.toBuffer('image/png'));
    const content = await page.getTextContent();
    allText += content.items.map(item => item.str).join(' ') + '\n';
    // Every visible text item must stay within the printable page.
    for (const item of content.items) {
      if (item.str.trim() && (item.transform[4] < 0 || item.transform[5] < 0 || item.transform[4] + item.width > page.view[2] + 1)) {
        throw new Error(`Text outside page bounds: ${filename} page ${number}: ${item.str}`);
      }
    }
  }
  if (!allText.includes('Zoë') || !allText.includes('Page 1 of')) throw new Error('PDF text or pagination missing.');
  console.log(`${filename}: ${rendered.numPages} pages rendered and text bounds checked.`);
  await loadingTask.destroy(); dom.window.close();
}
