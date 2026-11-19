import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../server/config.mjs';

test('misspelled production mode cannot silently enable development defaults',() => {
  assert.throws(() => loadConfig({NODE_ENV:'prod'}),/NODE_ENV/);
});

test('invalid proxy-hop settings fail before storage or SMTP setup',() => {
  for (const value of ['true','-1','1.5','NaN','6']) assert.throws(() => loadConfig({TRUST_PROXY:value}),/TRUST_PROXY/);
});
