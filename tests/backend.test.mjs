import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,scryptSync} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {createStore} from '../server/store.mjs';
import {definitions} from '../server/validation.mjs';
import {createMailQueue} from '../server/mailer.mjs';

const origin = 'http://127.0.0.1:5173';
const password = 'Only-for-isolated-automated-tests';
const salt = 'abcdef0123456789abcdef0123456789';
const config = {origin,production:false,adminUsername:'owner',adminPasswordHash:`scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`,staticDir:null};
const logger = {warn() {}};

function validFields(kind) {
  return {'Terms version':definitions[kind].version,...Object.fromEntries(definitions[kind].sections.flatMap(section => section.fields).map(field => {
    let value = field.options?.[0] || 'Fictional sample';
    if (field.type === 'checkbox') value = field.checkedValue;
    else if (field.type === 'email') value = 'sample@example.com';
    else if (field.type === 'date') value = field.name.includes('Date of birth') ? '2018-01-01' : '2026-11-19';
    else if (field.pattern) value = '0000000000000';
    else if (field.type === 'tel') value = '0000000000';
    return [field.name,value];
  }))};
}

async function setup(sendMail = null) {
  const store = createStore(':memory:',randomBytes(32));
  const {app,pumpMail} = createApp({store,config,sendMail,logger,rateLimits:false});
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url,options = {}) => fetch(base+url,{...options,headers:{origin,...options.headers}});
  const submit = (kind,fields = validFields(kind),key = randomUUID()) => {
    const form = new FormData(); for (const [name,value] of Object.entries(fields)) form.set(name,value);
    form.set('_gotcha','');
    return request(`/api/applications/${kind}`,{method:'POST',body:form,headers:{'Idempotency-Key':key}});
  };
  const login = async () => {
    const response = await request('/api/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password})});
    assert.equal(response.status,200);
    assert.match(response.headers.get('set-cookie'),/HttpOnly/i);
    assert.match(response.headers.get('set-cookie'),/SameSite=Strict/i);
    const body = await response.json();
    return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:body.csrf};
  };
  return {store,pumpMail,server,request,submit,login,async close() {await new Promise(resolve => server.close(resolve)); store.close();}};
}

test('school and aftercare submissions are saved and encrypted; clients receive no private payload',async () => {
  const context = await setup();
  try {
    for (const kind of ['school','aftercare']) {
      const response = await context.submit(kind); assert.equal(response.status,201);
      const body = await response.json(); assert.equal(body.ok,true); assert.match(body.reference,/^ALM-/);
      assert.equal(Object.keys(body).length,2);
      const stored = context.store.get(body.reference); assert.equal(stored.kind,kind);
      assert.equal(stored.document.sections.length,definitions[kind].sections.length);
      const raw = context.store.db.prepare('SELECT payload FROM applications WHERE id=?').get(body.reference).payload;
      assert.ok(!raw.includes('Fictional sample')); assert.ok(!raw.includes('sample@example.com'));
    }
  } finally {await context.close();}
});

test('missing required fields, invalid dates, forged declarations and invalid choices cannot be saved',async () => {
  const context = await setup();
  try {
    for (const changes of [
      {'Learner - Full names':''}, {'Learner - Date of birth':'2026-02-30'},
      {'Learner - Gender':'Unknown option'}, {'Agreed - Financials':'No'},
      {'Father/guardian - Email':'not-an-email'}, {'Father/guardian - ID number':'invalid'},
    ]) {
      const response = await context.submit('school',{...validFields('school'),...changes});
      assert.equal(response.status,422); assert.ok(Object.keys((await response.json()).fields).length > 0);
    }
    assert.equal(context.store.list().length,0);
  } finally {await context.close();}
});

test('idempotent retries return one reference; changing details under the same key is rejected',async () => {
  const context = await setup();
  try {
    const key = randomUUID(); const fields = validFields('school');
    const first = await (await context.submit('school',fields,key)).json();
    const retry = await context.submit('school',fields,key);
    assert.equal(retry.status,200); assert.equal((await retry.json()).reference,first.reference);
    assert.equal(context.store.list().length,1);
    const changed = await context.submit('school',{...fields,'Learner - Full names':'Different sample'},key);
    assert.equal(changed.status,409); assert.equal(context.store.list().length,1);
  } finally {await context.close();}
});

test('foreign origins, unauthenticated application lists, and private PDFs are denied',async () => {
  const context = await setup();
  try {
    const result = await (await context.submit('school')).json();
    assert.equal((await context.request('/api/staff/applications')).status,401);
    assert.equal((await context.request(`/api/staff/applications/${result.reference}/pdf`)).status,401);
    const foreign = await context.request('/api/staff/login',{method:'POST',headers:{origin:'https://example.org','Content-Type':'application/json'},body:'{}'});
    assert.equal(foreign.status,403);
  } finally {await context.close();}
});

test('owner login uses HttpOnly cookies; authenticated PDFs work; logout and CSRF checks protect changes',async () => {
  const context = await setup();
  try {
    const result = await (await context.submit('aftercare')).json();
    const session = await context.login();
    const headers = {cookie:session.cookie};
    const listing = await context.request('/api/staff/applications',{headers});
    assert.equal(listing.headers.get('cache-control'),'no-store');
    assert.equal((await listing.json()).records.length,1);
    const pdf = await context.request(`/api/staff/applications/${result.reference}/pdf`,{headers});
    assert.equal(pdf.status,200); assert.match(pdf.headers.get('content-type'),/application\/pdf/);
    assert.ok((await pdf.text()).startsWith('%PDF-'));
    const denied = await context.request(`/api/staff/applications/${result.reference}/reviewed`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{"reviewed":true}'});
    assert.equal(denied.status,403);
    const allowed = await context.request(`/api/staff/applications/${result.reference}/reviewed`,{method:'POST',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:'{"reviewed":true}'});
    assert.equal(allowed.status,200); assert.equal(context.store.get(result.reference).reviewed,1);
    await context.request('/api/staff/logout',{method:'POST',headers:{...headers,'X-CSRF-Token':session.csrf}});
    assert.equal((await context.request('/api/staff/applications',{headers})).status,401);
  } finally {await context.close();}
});

test('SMTP failure retains the saved application and can be retried without a duplicate record',async () => {
  const context = await setup();
  try {
    const result = await (await context.submit('school')).json();
    const fail = createMailQueue(context.store,async () => {throw new Error('Simulated email failure');},logger);
    await fail(); assert.equal(context.store.get(result.reference).mail_status,'failed');
    context.store.retryMail(result.reference);
    let delivered = 0;
    const succeed = createMailQueue(context.store,async record => {delivered++; assert.equal(record.id,result.reference);},logger);
    await succeed(); await succeed();
    assert.equal(delivered,1); assert.equal(context.store.get(result.reference).mail_status,'sent');
    assert.equal(context.store.list().length,1);
  } finally {await context.close();}
});

test('invalid passwords and oversized multipart values are rejected',async () => {
  const context = await setup();
  try {
    const login = await context.request('/api/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'incorrect'})});
    assert.equal(login.status,401);
    const response = await context.submit('school',{...validFields('school'),'Learner - Full names':'x'.repeat(9000)});
    assert.equal(response.status,413); assert.equal(context.store.list().length,0);
  } finally {await context.close();}
});

test('stale terms versions cannot be recorded against new terms',async () => {
  const context = await setup();
  try {
    const response = await context.submit('school',{...validFields('school'),'Terms version':'outdated'});
    assert.equal(response.status,409);
    assert.match((await response.json()).error,/review the current terms/);
    assert.equal(context.store.list().length,0);
  } finally {await context.close();}
});

test('expired owner sessions cannot read applications',async () => {
  const context = await setup();
  try {
    const session = await context.login();
    context.store.db.prepare('UPDATE sessions SET expires=?').run(Date.now()-1);
    assert.equal((await context.request('/api/staff/applications',{headers:{cookie:session.cookie}})).status,401);
  } finally {await context.close();}
});
