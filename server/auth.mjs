import {scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(scryptCallback);

export async function verifyPassword(password, encoded) {
  const [algorithm,salt,stored] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(stored || '')) return false;
  const actual = await scrypt(password,salt,64);
  return timingSafeEqual(actual,Buffer.from(stored,'hex'));
}

export function sessionToken(req) {
  const raw = String(req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('alm_session='));
  const token = raw?.slice('alm_session='.length);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}
