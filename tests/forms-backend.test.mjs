import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {createApp} from '../server/app.mjs';
import {createStore} from '../server/store.mjs';

test('both actual website forms use Node, retain details after a lost response, and recover one saved receipt',async () => {
  const original = {window:globalThis.window,document:globalThis.document,FormData:globalThis.FormData,fetch:globalThis.fetch};
  const store = createStore(':memory:',randomBytes(32));
  const origin = 'http://127.0.0.1:5173';
  const {app} = createApp({store,config:{origin,production:false,adminPasswordHash:'',staticDir:null},logger:{warn() {}},rateLimits:false});
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let dom;
  async function settle(form) {
    for (let attempt = 0; attempt < 200 && form.querySelector('[type="submit"]').disabled; attempt++) await new Promise(resolve => setTimeout(resolve,10));
    assert.equal(form.querySelector('[type="submit"]').disabled,false,'Submission should finish');
  }
  try {
    for (const [index,file] of ['apply.html','aftercare.html'].entries()) {
      dom = new JSDOM(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),{url:origin+'/'+file});
      dom.window.HTMLElement.prototype.scrollIntoView = () => {};
      globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.FormData = dom.window.FormData;
      const form = document.querySelector('[data-online-form]');
      for (const input of form.querySelectorAll('input,textarea,select')) {
        if (!input.required || input.type === 'hidden') continue;
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = true;
        else if (input.tagName === 'SELECT') input.selectedIndex = 1;
        else input.value = input.type === 'email' ? 'test@example.com' : input.type === 'date' ? '2018-01-01' : input.pattern ? '0000000000000' : input.type === 'tel' ? '0000000000' : 'Fictional sample';
      }
      let firstResponse = true;
      const keys = [];
      globalThis.fetch = async (url,options) => {
        assert.match(url,/^api\/applications\/(school|aftercare)$/);
        const multipart = new original.FormData(); for (const [name,value] of options.body.entries()) multipart.set(name,value);
        keys.push(options.headers['Idempotency-Key']);
        const response = await original.fetch(base+'/'+url,{...options,body:multipart,headers:{...options.headers,origin}});
        if (firstResponse) {firstResponse = false; await response.text(); throw new Error('Simulated connection lost after server saved the application');}
        return response;
      };
      await import(`../src/js/main.js?backend-form=${file}`);
      form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
      await settle(form);
      assert.equal(form.hidden,false);
      assert.equal(store.list().length,index+1,'First request is safely stored despite a lost response');
      assert.match(form.querySelector('.form-status').textContent,/could not be sent/);
      form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
      await settle(form);
      assert.equal(keys.length,2); assert.equal(keys[0],keys[1]);
      assert.equal(store.list().length,index+1,'Retry must not create a second record');
      assert.equal(form.hidden,true);
      assert.match(document.querySelector('[data-application-reference]').textContent,/ALM-/);
      assert.equal(document.querySelector('[data-download-pdf]').hidden,false);
      dom.window.close(); dom = null;
    }
  } finally {
    dom?.window.close(); Object.assign(globalThis,original);
    await new Promise(resolve => server.close(resolve)); store.close();
  }
});
