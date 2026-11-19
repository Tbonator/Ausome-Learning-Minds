import test from 'node:test';
import assert from 'node:assert/strict';
import {yahooSettings,setEnvValue,smtpSettings} from '../scripts/env-file.mjs';

test('Yahoo setup preserves owner credentials and encryption settings while configuring TLS SMTP',() => {
  const existing="ADMIN_PASSWORD_HASH='scrypt$sample$unchanged'\nDATA_ENCRYPTION_KEY='unchanged-key'\nMAIL_MODE=disabled\nSMTP_PASS=\n";
  const configured = yahooSettings(existing,'sample@yahoo.ca','abcdefghijklmnop',true);
  assert.ok(configured.includes("ADMIN_PASSWORD_HASH='scrypt$sample$unchanged'"));
  assert.ok(configured.includes("DATA_ENCRYPTION_KEY='unchanged-key'"));
  assert.ok(configured.includes("MAIL_MODE='smtp'"));
  assert.ok(configured.includes("SMTP_HOST='smtp.mail.yahoo.com'"));
  assert.ok(configured.includes("SMTP_PORT='465'"));
  assert.ok(configured.includes("EMAIL_ATTACH_PDF='true'"));
  assert.equal((configured.match(/^SMTP_PASS=/gm) || []).length,1);
});

test('Gmail can send notifications to a separate Yahoo recipient without changing owner settings',() => {
  const existing="ADMIN_PASSWORD_HASH='keep-this-hash'\nDATA_ENCRYPTION_KEY='keep-this-key'\nMAIL_MODE=disabled\n";
  const configured = smtpSettings(existing,'gmail','sample@gmail.com','abcdefghijklmnop','receiver@yahoo.ca',true);
  assert.ok(configured.includes("SMTP_HOST='smtp.gmail.com'"));
  assert.ok(configured.includes("SMTP_USER='sample@gmail.com'"));
  assert.ok(configured.includes("MAIL_FROM='sample@gmail.com'"));
  assert.ok(configured.includes("APPLICATION_EMAIL='receiver@yahoo.ca'"));
  assert.ok(configured.includes("ADMIN_PASSWORD_HASH='keep-this-hash'"));
  assert.ok(configured.includes("DATA_ENCRYPTION_KEY='keep-this-key'"));
  assert.throws(() => smtpSettings('','gmail','sample@gmail.com','too-short','receiver@yahoo.ca'));
  assert.throws(() => smtpSettings('','unknown','sample@gmail.com','abcdefghijklmnop','receiver@yahoo.ca'));
});

test('SMTP setup rejects injected environment lines and non-Yahoo account destinations',() => {
  assert.throws(() => setEnvValue('','SMTP_PASS',"secret'\nADMIN_USERNAME=intruder"));
  assert.throws(() => yahooSettings('','sample@example.org','abcdefghijklmnop'));
  assert.throws(() => yahooSettings('','sample@yahoo.ca',"not'an'app'password"));
});
