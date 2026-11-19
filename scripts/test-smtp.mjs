import nodemailer from 'nodemailer';
import {loadConfig} from '../server/config.mjs';

const config = loadConfig();
if (config.mailMode !== 'smtp') throw new Error('Run npm run smtp:setup first. SMTP is currently disabled.');
const transport = nodemailer.createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpPort === 465,
  requireTLS:config.smtpPort !== 465,auth:{user:config.smtpUser,pass:config.smtpPass},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});
try {
  await transport.sendMail({from:config.mailFrom,to:config.applicationEmail,subject:'TEST ONLY - Ausome Learning Minds email delivery',
    text:'This is a delivery test from your Node.js application. No learner information or application attachment is included. You can disregard this message.'});
  console.log('Test email accepted by the SMTP server. Check the receiving mailbox and Spam folder to confirm delivery.');
} catch {console.error('The test email could not be confirmed as sent. Check the SMTP settings.'); process.exitCode = 1;}
finally {transport.close();}
