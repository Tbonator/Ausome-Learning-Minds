import nodemailer from 'nodemailer';
import {pdfFor} from './pdf.mjs';

export function makeMailer(config) {
  if (config.mailMode !== 'smtp') return null;
  const transport = nodemailer.createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpPort === 465,
    requireTLS:config.smtpPort !== 465,auth:{user:config.smtpUser,pass:config.smtpPass},
    connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});
  return async record => {
    const reference = record.id;
    await transport.sendMail({from:config.mailFrom,to:config.applicationEmail,
      subject:`${record.kind === 'school' ? 'School' : 'Aftercare'} application received - ${reference}`,
      text:`A new application has been saved.\nReference: ${reference}\n\nSign in to review it: ${config.origin}/applications-admin.html\n\nThis email contains no learner details in its body.`,
      ...(config.attachPdf ? {attachments:[{filename:`Ausome-application-${reference}.pdf`,content:pdfFor(record.document),contentType:'application/pdf'}]} : {}),
    });
  };
}

export function createMailQueue(store, sendMail, logger = console) {
  let running = false;
  return async function deliverPending() {
    if (running || !sendMail) return;
    running = true;
    try {
      for (let count = 0; count < 10; count++) {
        const record = store.claimMail();
        if (!record) break;
        try {await sendMail(record); store.finishMail(record.id,true);}
        catch {store.finishMail(record.id,false); logger.warn(`Application email queued for retry: ${record.id}`);}
      }
    } finally {running = false;}
  };
}
