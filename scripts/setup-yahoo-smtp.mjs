import fs from 'node:fs';
import {createInterface} from 'node:readline/promises';
import nodemailer from 'nodemailer';
import {privateInput} from './private-input.mjs';
import {yahooSettings} from './env-file.mjs';

if (!process.stdin.isTTY) throw new Error('Run npm run smtp:setup in your own terminal. Do not send the app password in chat.');
if (!fs.existsSync('.env')) throw new Error('Set the owner password first with npm run admin:password.');
const prompt = createInterface({input:process.stdin,output:process.stdout});
console.log('Yahoo SMTP setup for local testing. Create a Yahoo app password named Ausome Learning Minds.');
const email = (await prompt.question('Your full Yahoo email address: ')).trim();
const attachPdf = /^y(es)?$/i.test((await prompt.question('Attach complete application PDFs to notification emails? (y/N): ')).trim());
prompt.close();
const password = (await privateInput('Yahoo app password (hidden): ')).replace(/\s+/g,'');
const content = fs.readFileSync('.env','utf8');
const updated = yahooSettings(content,email,password,attachPdf);
const transport = nodemailer.createTransport({host:'smtp.mail.yahoo.com',port:465,secure:true,
  auth:{user:email,pass:password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});
console.log('Verifying encrypted SMTP connection and authentication. No email is sent by this check.');
try {
  await transport.verify();
  fs.writeFileSync('.env',updated,{mode:0o600}); fs.chmodSync('.env',0o600);
  console.log('Yahoo SMTP verified and saved privately. Restart the backend to enable notifications.');
  console.log('Pending applications will be processed after restart. Use fictional submissions for this test mailbox.');
} catch {
  console.error('Yahoo SMTP verification failed. No settings were changed. Check the generated app password, your email address, and network access.');
  process.exitCode = 1;
} finally {transport.close();}
