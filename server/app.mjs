import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import multer from 'multer';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {validateApplication,ValidationError} from './validation.mjs';
import {verifyPassword,sessionToken} from './auth.mjs';
import {pdfFor} from './pdf.mjs';
import {createMailQueue} from './mailer.mjs';

export function createApp({store,config,sendMail = null,logger = console,rateLimits = true}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy',config.trustProxy || false);
  const publicDirectives = {
    defaultSrc:["'self'"],scriptSrc:["'self'"],
    styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],
    fontSrc:["'self'",'data:','https://fonts.gstatic.com'],
    imgSrc:["'self'",'data:','blob:','https://raw.githubusercontent.com','https://*.tiktokcdn.com'],
    connectSrc:["'self'",'https://formspree.io','https://api.github.com'],
    frameSrc:['https://www.google.com','https://maps.google.com','https://www.tiktok.com','https://*.tiktok.com'],
    objectSrc:["'none'"],frameAncestors:["'none'"],
    upgradeInsecureRequests:config.production ? [] : null,
  };
  const publicSecurity = helmet({contentSecurityPolicy:{directives:publicDirectives},crossOriginEmbedderPolicy:false});
  const embedSecurity = helmet({contentSecurityPolicy:{directives:{...publicDirectives,
    scriptSrc:["'self'",'https://www.tiktok.com','https://*.tiktok.com','https://*.tiktokcdn.com'],
  }},crossOriginEmbedderPolicy:false});
  const ownerSecurity = helmet({referrerPolicy:{policy:'no-referrer'},contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],
    fontSrc:["'self'",'data:'],imgSrc:["'self'",'data:','blob:','https://raw.githubusercontent.com'],
    connectSrc:["'self'",'https://api.github.com'],frameSrc:["'none'"],
    baseUri:["'none'"],formAction:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],
    upgradeInsecureRequests:config.production ? [] : null,
  }},crossOriginEmbedderPolicy:false});
  app.use((req,res,next) => {
    let pathname;
    try {pathname = path.posix.normalize(decodeURIComponent(req.path)).toLowerCase();}
    catch {return res.status(400).end();}
    const protectedPage = ['/admin.html','/applications-admin.html'].includes(pathname);
    const api = pathname === '/api' || pathname.startsWith('/api/');
    if (protectedPage || api) res.set('Cache-Control','no-store');
    const security = protectedPage || api ? ownerSecurity : ['/', '/index.html'].includes(pathname) ? embedSecurity : publicSecurity;
    security(req,res,next);
  });
  app.use('/api',(_req,res,next) => {res.set('Cache-Control','no-store'); next();});
  app.use('/api',(req,res,next) => {
    if (['POST','PATCH','DELETE','PUT'].includes(req.method) && req.get('origin') !== config.origin) {
      return res.status(403).json({ok:false,error:'Please submit from the school website.'});
    }
    next();
  });
  app.use(express.json({limit:'128kb'}));
  app.use(express.urlencoded({extended:false,limit:'128kb',parameterLimit:100}));
  const parseForm = multer({limits:{fields:100,fieldSize:8192,files:0,parts:100}}).none();
  const limiter = (limit,windowMs) => rateLimits ? rateLimit({windowMs,limit,standardHeaders:'draft-8',legacyHeaders:false,
    message:{ok:false,error:'Too many requests. Please wait before trying again.'}}) : (_req,_res,next) => next();
  const pumpMail = createMailQueue(store,sendMail,logger);
  const cookieOptions = {httpOnly:true,secure:config.production,sameSite:'strict',path:'/api',maxAge:8*60*60*1000};
  const authVersion = createHash('sha256').update(config.adminPasswordHash || '').digest('hex');

  app.get('/api/health',(_req,res) => res.json({ok:true}));

  app.post('/api/applications/:kind',limiter(10,60*60*1000),parseForm,(req,res,next) => {
    try {
      if (!req.body || typeof req.body !== 'object') return res.status(400).json({ok:false,error:'Submit the application using the website form.'});
      if (req.body._gotcha) return res.status(202).json({ok:true});
      const key = req.get('Idempotency-Key');
      if (!/^[a-f0-9-]{36}$/i.test(key || '')) return res.status(400).json({ok:false,error:'Refresh the form and try again.'});
      if (Buffer.byteLength(JSON.stringify(req.body)) > 65536) return res.status(413).json({ok:false,error:'The application is too large.'});
      const document = validateApplication(req.params.kind,req.body);
      const existing = store.findByKey(key);
      if (existing) {
        if (existing.kind !== req.params.kind || existing.fingerprint !== document.fingerprint) return res.status(409).json({ok:false,error:'This submission reference was already used for different details. Please refresh the page.'});
        return res.json({ok:true,reference:existing.id});
      }
      const reference = `ALM-${randomUUID()}`;
      document.reference = reference;
      try {store.insert(reference,req.params.kind,key,document);}
      catch (error) {
        // Two simultaneous retries can race. The unique database constraint is authoritative.
        const duplicate = store.findByKey(key);
        if (!duplicate || duplicate.kind !== req.params.kind || duplicate.fingerprint !== document.fingerprint) throw error;
        return res.json({ok:true,reference:duplicate.id});
      }
      res.status(201).json({ok:true,reference});
      setImmediate(() => pumpMail().catch(() => logger.warn('Application email processing will retry.')));
    } catch (error) {next(error);}
  });

  app.post('/api/staff/login',limiter(5,15*60*1000),async (req,res,next) => {
    try {
      if (!config.adminPasswordHash) return res.status(503).json({ok:false,error:'Owner login has not been configured. Run the owner password setup on the server.'});
      const {username,password} = req.body || {};
      if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200 ||
          !(await verifyPassword(password,config.adminPasswordHash)) || username !== config.adminUsername) {
        return res.status(401).json({ok:false,error:'The username or password is incorrect.'});
      }
      store.logout(sessionToken(req));
      const session = store.createSession(authVersion);
      res.cookie('alm_session',session.token,cookieOptions);
      res.json({ok:true,csrf:session.csrf});
    } catch (error) {next(error);}
  });

  app.use('/api/staff',limiter(120,5*60*1000),(req,res,next) => {
    const token = sessionToken(req);
    const session = store.session(token);
    if (!session || session.auth_version !== authVersion) return res.status(401).json({ok:false,error:'Please sign in to the owner workspace.'});
    if (req.method !== 'GET' && req.get('X-CSRF-Token') !== session.csrf) return res.status(403).json({ok:false,error:'Your session could not be verified. Sign in again.'});
    req.ownerSession = session;
    next();
  });
  app.get('/api/staff/session',(req,res) => res.json({ok:true,csrf:req.ownerSession.csrf}));
  app.post('/api/staff/logout',(req,res) => {
    store.logout(sessionToken(req));
    res.clearCookie('alm_session',{...cookieOptions,maxAge:undefined}); res.json({ok:true});
  });
  app.get('/api/staff/applications',(req,res) => {
    const offset = Math.min(100000,Math.max(0,parseInt(req.query.offset,10) || 0));
    const records = store.list(offset).map(record => ({reference:record.id,kind:record.kind,learner:record.document.learner,
      submittedAt:record.submitted_at,reviewed:Boolean(record.reviewed),emailStatus:record.mail_status}));
    res.json({ok:true,records,offset,hasMore:records.length === 30});
  });
  app.get('/api/staff/applications/:id/pdf',(req,res) => {
    const record = store.get(req.params.id);
    if (!record) return res.status(404).json({ok:false,error:'Application not found.'});
    res.type('pdf').attachment(`${record.id}.pdf`).send(pdfFor(record.document));
  });
  app.post('/api/staff/applications/:id/reviewed',(req,res) => {
    if (!store.get(req.params.id)) return res.status(404).json({ok:false,error:'Application not found.'});
    if (typeof req.body?.reviewed !== 'boolean') return res.status(400).json({ok:false,error:'Invalid review state.'});
    store.reviewed(req.params.id,req.body.reviewed); res.json({ok:true});
  });
  app.post('/api/staff/applications/:id/retry-email',(req,res) => {
    if (!sendMail) return res.status(503).json({ok:false,error:'SMTP delivery has not been configured.'});
    if (!store.get(req.params.id)) return res.status(404).json({ok:false,error:'Application not found.'});
    if (!store.retryMail(req.params.id)) return res.status(409).json({ok:false,error:'An email is already being sent. Please wait.'});
    res.json({ok:true});
    setImmediate(() => pumpMail().catch(() => logger.warn('Application email processing will retry.')));
  });
  app.use('/api',(_req,res) => res.status(404).json({ok:false,error:'Endpoint not found.'}));
  // Serve only compiled public files. Database, environment files and sources are never exposed.
  if (config.staticDir) app.use(express.static(path.resolve(config.staticDir),{dotfiles:'deny',index:'index.html'}));
  app.use((error,_req,res,_next) => {
    if (error instanceof ValidationError) return res.status(422).json({ok:false,error:error.message,fields:error.fields});
    if (error instanceof multer.MulterError || error.status === 413) return res.status(413).json({ok:false,error:'The submitted application exceeds the allowed limits.'});
    if (error.status === 400) return res.status(400).json({ok:false,error:'The request could not be read. Please use the website form.'});
    if (error.status === 409) return res.status(409).json({ok:false,error:error.message});
    logger.warn('An application server request failed.');
    res.status(error.status === 404 ? 404 : 500).json({ok:false,error:error.status === 404 ? 'Application type not found.' : 'The request could not be completed. Please try again.'});
  });
  return {app,pumpMail};
}
