import path from 'node:path';
import {loadConfig} from './config.mjs';
import {createStore} from './store.mjs';
import {createApp} from './app.mjs';
import {makeMailer} from './mailer.mjs';

const config = loadConfig();
const store = createStore(path.join(config.dataDir,'applications.sqlite'),config.key);
const {app,pumpMail} = createApp({store,config,sendMail:makeMailer(config)});
const server = app.listen(config.port,config.host,() => {
  console.log(`Application backend listening on ${config.host}:${config.port}.`);
  if (!config.adminPasswordHash) console.log('Owner login is not configured. Run npm run admin:password to set it up.');
  if (config.mailMode === 'disabled') console.log('Local preview: email delivery is disabled; applications are still saved.');
});
// Bound slow/incomplete requests instead of holding connections for minutes.
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;
const timer = setInterval(() => pumpMail().catch(() => console.warn('Email queue will retry.')),60000);
timer.unref();
pumpMail().catch(() => console.warn('Email queue will retry.'));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => {
  clearInterval(timer); server.close(() => {store.close(); process.exit(0);});
});
