import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

try {process.loadEnvFile();} catch (error) {if (error.code !== 'ENOENT') throw error;}

export function loadConfig(env = process.env) {
  if (env.NODE_ENV && !['development','production','test'].includes(env.NODE_ENV)) throw new Error('NODE_ENV must be development, production or test.');
  const production = env.NODE_ENV === 'production';
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5) throw new Error('TRUST_PROXY must be the confirmed number of trusted proxy hops (0-5).');
  const origin = env.PUBLIC_ORIGIN || 'http://127.0.0.1:5173';
  const url = new URL(origin);
  if (url.origin !== origin || (production && url.protocol !== 'https:')) throw new Error('PUBLIC_ORIGIN must be an origin without a trailing slash, using HTTPS in production.');
  const dataDir = path.resolve(env.DATA_DIR || '.local-data');
  if (production && (!env.DATA_DIR || !path.isAbsolute(env.DATA_DIR))) throw new Error('Set DATA_DIR to an absolute private directory outside the website public root.');
  const staticDir = path.resolve('dist');
  if (dataDir === staticDir || dataDir.startsWith(staticDir+path.sep)) throw new Error('DATA_DIR must not be inside dist.');
  if (production && dataDir.split(/[\\/]/).some(part => ['public_html','htdocs','www'].includes(part.toLowerCase()))) throw new Error('Keep DATA_DIR outside the public web root.');
  fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
  let encodedKey = env.DATA_ENCRYPTION_KEY;
  if (!encodedKey && !production) {
    const keyFile = path.join(dataDir,'encryption.key');
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile,randomBytes(32).toString('base64'),{mode:0o600,flag:'wx'});
    encodedKey = fs.readFileSync(keyFile,'utf8').trim();
  }
  const key = Buffer.from(encodedKey || '','base64');
  if (key.length !== 32) throw new Error('Set DATA_ENCRYPTION_KEY to a base64-encoded 32-byte random key.');
  if (production && !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(env.ADMIN_PASSWORD_HASH || '')) throw new Error('Configure the owner password with npm run admin:password.');
  const mailMode = env.MAIL_MODE || (production ? 'smtp' : 'disabled');
  if (!['smtp','disabled'].includes(mailMode) || (production && mailMode !== 'smtp')) throw new Error('Use MAIL_MODE=smtp for production.');
  if (mailMode === 'smtp') {
    for (const name of ['SMTP_HOST','SMTP_USER','SMTP_PASS','MAIL_FROM','APPLICATION_EMAIL']) if (!env[name]) throw new Error(`${name} is required for SMTP delivery.`);
    for (const name of ['MAIL_FROM','APPLICATION_EMAIL']) if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env[name])) throw new Error(`${name} must be one valid email address.`);
  }
  const smtpPort = Number(env.SMTP_PORT || 465);
  if (![465,587].includes(smtpPort)) throw new Error('SMTP_PORT must be 465 (TLS) or 587 (STARTTLS).');
  return {production,origin,key,dataDir,staticDir,port:Number(env.PORT || 3001),host:env.HOST || '127.0.0.1',
    adminUsername:env.ADMIN_USERNAME || 'owner',adminPasswordHash:env.ADMIN_PASSWORD_HASH || '',
    trustProxy,mailMode,smtpHost:env.SMTP_HOST,smtpPort,
    smtpUser:env.SMTP_USER,smtpPass:env.SMTP_PASS,mailFrom:env.MAIL_FROM,applicationEmail:env.APPLICATION_EMAIL,
    attachPdf:env.EMAIL_ATTACH_PDF === 'true'};
}
