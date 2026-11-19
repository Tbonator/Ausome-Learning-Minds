const $ = selector => document.querySelector(selector);
let csrf = '';
let offset = 0;
let requestVersion = 0;

function status(message,error = false) {
  $('#owner-status').textContent = message;
  $('#owner-status').classList.toggle('is-error',error);
}
function signedOut() {
  requestVersion++;
  csrf = '';
  $('#owner-inbox').hidden = true;
  $('#owner-login-panel').hidden = false;
  $('#application-records').replaceChildren();
}
async function api(path,method = 'GET',body) {
  const response = await fetch(`api/staff/${path}`,{method,credentials:'same-origin',
    headers:{Accept:'application/json',...(body ? {'Content-Type':'application/json'} : {}),...(method !== 'GET' && csrf ? {'X-CSRF-Token':csrf} : {})},
    ...(body ? {body:JSON.stringify(body)} : {})});
  const result = await response.json().catch(() => ({error:'The application backend is unavailable. Check that the Node.js server is running.'}));
  if (response.status === 401) signedOut();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}
function button(text,action) {
  const node = document.createElement('button');
  node.type = 'button'; node.className = 'btn admin-secondary'; node.textContent = text;
  node.addEventListener('click',async () => {
    node.disabled = true;
    try {await action();} catch (error) {status(error.message,true);}
    finally {node.disabled = false;}
  });
  return node;
}
async function refresh() {
  const version = ++requestVersion;
  const result = await api(`applications?offset=${offset}`);
  if (version !== requestVersion || !csrf) return;
  $('#owner-login-panel').hidden = true; $('#owner-inbox').hidden = false;
  const cards = result.records.map(record => {
    const card = document.createElement('article'); card.className = 'admin-panel application-record';
    const title = document.createElement('h3'); title.textContent = record.learner;
    const details = document.createElement('p');
    details.textContent = `${record.kind === 'school' ? 'School' : 'Aftercare'} application · ${new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Johannesburg'}).format(new Date(record.submittedAt))} SAST`;
    const reference = document.createElement('p'); reference.className = 'application-reference'; reference.textContent = record.reference;
    const state = document.createElement('p'); state.textContent = `Review: ${record.reviewed ? 'Reviewed' : 'New'} · Email: ${record.emailStatus}`;
    const actions = document.createElement('div'); actions.className = 'admin-inline';
    const pdf = document.createElement('a'); pdf.className = 'btn btn--yellow';
    pdf.href = `api/staff/applications/${encodeURIComponent(record.reference)}/pdf`;
    pdf.textContent = 'Download PDF';
    actions.append(pdf,button(record.reviewed ? 'Mark as new' : 'Mark reviewed',async () => {
      await api(`applications/${encodeURIComponent(record.reference)}/reviewed`,'POST',{reviewed:!record.reviewed}); await refresh();
    }));
    if (record.emailStatus !== 'sending') actions.append(button('Send notification again',async () => {
      await api(`applications/${encodeURIComponent(record.reference)}/retry-email`,'POST',{});
      status('Notification queued. Refresh shortly to check its status.'); await refresh();
    }));
    card.append(title,details,reference,state,actions); return card;
  });
  if (!cards.length) {const empty = document.createElement('p'); empty.textContent = 'No applications on this page yet.'; cards.push(empty);}
  $('#application-records').replaceChildren(...cards);
  $('#previous-records').disabled = offset === 0;
  $('#next-records').disabled = !result.hasMore;
}

$('#owner-login').addEventListener('submit',async event => {
  event.preventDefault();
  const button = event.target.querySelector('button'); button.disabled = true;
  try {
    const result = await api('login','POST',{username:$('#owner-name').value,password:$('#owner-password').value});
    $('#owner-password').value = ''; csrf = result.csrf; offset = 0;
    await refresh(); status('Signed in. Applications are available below.');
  } catch (error) {$('#owner-password').value = ''; status(error.message,true);}
  finally {button.disabled = false;}
});
$('#owner-logout').addEventListener('click',async () => {
  try {await api('logout','POST',{}); signedOut(); status('Signed out.');}
  catch (error) {status('Sign out could not be confirmed. Please retry before leaving this shared device.',true);}
});
$('#refresh-applications').addEventListener('click',() => refresh().catch(error => status(error.message,true)));
$('#previous-records').addEventListener('click',() => {offset = Math.max(0,offset-30); refresh().catch(error => status(error.message,true));});
$('#next-records').addEventListener('click',() => {offset += 30; refresh().catch(error => status(error.message,true));});
api('session').then(async result => {csrf = result.csrf; await refresh(); status('Signed in.');}).catch(() => {});
document.addEventListener('visibilitychange',() => {
  if (document.visibilityState === 'visible' && csrf) api('session').then(() => refresh()).catch(error => status(error.message,true));
});
