import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,scryptSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

async function passwordPrompt(label) {
  process.stdout.write(label);
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise(resolve => {
    let value = '';
    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\u0003') {process.stdin.setRawMode(false); process.stdout.write('\nCancelled.\n'); process.exit(1);}
        if (char === '\r' || char === '\n') {
          process.stdin.off('data',onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); resolve(value); return;
        }
        if (char === '\u007f' || char === '\b') {if (value) {value = [...value].slice(0,-1).join(''); process.stdout.write('\b \b');}}
        else if (char >= ' ' && value.length < 200) {value += char; process.stdout.write('*');}
      }
    };
    process.stdin.on('data',onData);
  });
}
if (!process.stdin.isTTY) throw new Error('Run this command in your own terminal so your password can be entered privately.');
const password = await passwordPrompt('Choose an owner password (at least 12 characters): ');
if (password.length < 12) throw new Error('Use at least 12 characters.');
if (password !== await passwordPrompt('Confirm password: ')) throw new Error('Passwords do not match.');
const salt = randomBytes(16).toString('hex');
const passwordHash = `scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
let content = fs.existsSync('.env') ? fs.readFileSync('.env','utf8') : fs.readFileSync('.env.example','utf8');
function set(name,value) {
  const line = `${name}='${value}'`;
  const pattern = new RegExp(`^${name}=.*$`,'m');
  content = pattern.test(content) ? content.replace(pattern,() => line) : content+'\n'+line+'\n';
}
set('ADMIN_PASSWORD_HASH',passwordHash);
const existingKey = content.match(/^DATA_ENCRYPTION_KEY=['"]?([a-zA-Z0-9+/=]+)['"]?\s*$/m)?.[1];
if (!existingKey) {
  const localKey = path.join('.local-data','encryption.key');
  set('DATA_ENCRYPTION_KEY',fs.existsSync(localKey) ? fs.readFileSync(localKey,'utf8').trim() : randomBytes(32).toString('base64'));
}
fs.writeFileSync('.env',content,{mode:0o600});
fs.chmodSync('.env',0o600);
try {process.loadEnvFile();} catch {}
const databasePath = path.resolve(process.env.DATA_DIR || '.local-data','applications.sqlite');
if (fs.existsSync(databasePath)) {
  const database = new DatabaseSync(databasePath);
  database.exec('DELETE FROM sessions'); database.close();
}
console.log('Owner password saved privately to .env. Existing owner sessions were revoked. Restart the backend.');
