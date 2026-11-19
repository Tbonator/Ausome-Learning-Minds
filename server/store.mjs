import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const hash = value => createHash('sha256').update(value).digest('hex');

export function createStore(filename, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') fs.chmodSync(filename,0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, submitted_at TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL, payload TEXT NOT NULL,
      reviewed INTEGER NOT NULL DEFAULT 0, mail_status TEXT NOT NULL DEFAULT 'pending',
      mail_attempts INTEGER NOT NULL DEFAULT 0, next_mail_at INTEGER NOT NULL DEFAULT 0,
      mail_lease_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
  `);
  if (!db.prepare('PRAGMA table_info(sessions)').all().some(column => column.name === 'auth_version')) {
    db.exec("ALTER TABLE sessions ADD COLUMN auth_version TEXT NOT NULL DEFAULT ''");
  }
  const encrypt = object => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm',key,iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(object),'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
  };
  const decrypt = encoded => {
    const bytes = Buffer.from(encoded,'base64');
    const decipher = createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
  };
  const sample = db.prepare('SELECT payload FROM applications LIMIT 1').get();
  if (sample) {
    try {decrypt(sample.payload);}
    catch {db.close(); throw new Error('The existing database could not be unlocked. Restore the original DATA_ENCRYPTION_KEY before starting.');}
  }
  const decode = row => row ? {...row, document:decrypt(row.payload),payload:undefined} : null;
  return {
    db,
    findByKey(key) {return decode(db.prepare('SELECT * FROM applications WHERE idempotency_key=?').get(hash(key)));},
    get(id) {return decode(db.prepare('SELECT * FROM applications WHERE id=?').get(id));},
    insert(id,kind,idempotencyKey,document) {
      db.prepare('INSERT INTO applications(id,kind,submitted_at,idempotency_key,fingerprint,payload) VALUES(?,?,?,?,?,?)')
        .run(id,kind,document.createdAt,hash(idempotencyKey),document.fingerprint,encrypt(document));
    },
    list(offset = 0) {
      return db.prepare('SELECT * FROM applications ORDER BY submitted_at DESC,id DESC LIMIT 30 OFFSET ?').all(offset).map(decode);
    },
    reviewed(id,value) {db.prepare('UPDATE applications SET reviewed=? WHERE id=?').run(value ? 1 : 0,id);},
    claimMail(now = Date.now()) {
      const row = db.prepare(`UPDATE applications SET mail_status='sending',mail_lease_until=?,mail_attempts=mail_attempts+1
        WHERE id=(SELECT id FROM applications WHERE mail_attempts<5 AND
        ((mail_status IN ('pending','failed') AND next_mail_at<=?) OR (mail_status='sending' AND mail_lease_until<?))
        ORDER BY submitted_at LIMIT 1) RETURNING *`).get(now+300000,now,now);
      return decode(row);
    },
    finishMail(id,success) {
      db.prepare('UPDATE applications SET mail_status=?,next_mail_at=?,mail_lease_until=0 WHERE id=?')
        .run(success ? 'sent' : 'failed',Date.now()+300000,id);
    },
    retryMail(id) {
      return db.prepare("UPDATE applications SET mail_status='pending',mail_attempts=0,next_mail_at=0 WHERE id=? AND mail_status!='sending'").run(id).changes;
    },
    createSession(authVersion) {
      const token = randomBytes(32).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
      db.prepare('INSERT INTO sessions(token_hash,csrf,expires,auth_version) VALUES(?,?,?,?)').run(hash(token),csrf,Date.now()+8*60*60*1000,authVersion);
      return {token,csrf};
    },
    session(token) {return token ? db.prepare('SELECT csrf,expires,auth_version FROM sessions WHERE token_hash=? AND expires>?').get(hash(token),Date.now()) : null;},
    logout(token) {if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));},
    close() {db.close();},
  };
}
