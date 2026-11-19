import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {collectApplication} from '../src/js/application-pdf.js';

const definitions = {};
for (const [kind, file] of [['school','apply.html'], ['aftercare','aftercare.html']]) {
  const dom = new JSDOM(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  const form = dom.window.document.querySelector('[data-online-form]');
  const old = globalThis.FormData;
  globalThis.FormData = dom.window.FormData;
  const blank = collectApplication(form,new Date('2026-11-19T00:00:00Z'));
  globalThis.FormData = old;
  const sections = [...form.querySelectorAll(':scope > fieldset')].map((section,index) => {
    const seen = new Set();
    const fields = [...section.querySelectorAll('input,textarea,select')].flatMap(input => {
      if (!input.name || input.name.startsWith('_') || input.type === 'hidden' || seen.has(input.name)) return [];
      seen.add(input.name);
      const siblings = [...section.querySelectorAll('input,textarea,select')].filter(other => other.name === input.name);
      const definition = blank.sections[index].fields[seen.size - 1];
      const options = input.tagName === 'SELECT' ? [...input.options].map(option => option.value).filter(Boolean) : input.type === 'radio' ? siblings.map(other => other.value) : null;
      return [{name:input.name,label:definition.label,group:definition.group,type:input.type || 'text',
        required:siblings.some(other => other.required),pattern:input.pattern || '',
        maxLength:input.tagName === 'TEXTAREA' ? 8000 : 500, ...(options ? {options} : {}),
        ...(input.type === 'checkbox' ? {checkedValue:input.value} : {})}];
    });
    return {title:blank.sections[index].title, fields};
  });
  const definition = {title:blank.title,sections,agreements:blank.agreements};
  definition.version = createHash('sha256').update(JSON.stringify(definition)).digest('hex').slice(0,16);
  definitions[kind] = definition;
  const sourcePath = new URL(`../${file}`,import.meta.url);
  let source = fs.readFileSync(sourcePath,'utf8');
  const versionInput = `<input type="hidden" name="Terms version" value="${definition.version}" />`;
  if (/\<input[^>]*name="Terms version"[^>]*>/.test(source)) source = source.replace(/\<input[^>]*name="Terms version"[^>]*>/,versionInput);
  else source = source.replace(/(<input type="hidden" name="Form"[^>]*>)/,`$1\n        ${versionInput}`);
  fs.writeFileSync(sourcePath,source);
  dom.window.close();
}
fs.mkdirSync(new URL('../server/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../server/form-definitions.json',import.meta.url),JSON.stringify(definitions,null,2)+'\n');
console.log('Generated server validation and PDF definitions from the actual application forms.');
