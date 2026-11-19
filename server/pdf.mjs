import fs from 'node:fs';
import {createApplicationPdf} from '../src/js/application-pdf.js';

const fonts = {
  regular:fs.readFileSync(new URL('../src/fonts/Lato-Regular.ttf',import.meta.url)).toString('base64'),
  bold:fs.readFileSync(new URL('../src/fonts/Lato-Bold.ttf',import.meta.url)).toString('base64'),
};

export function pdfFor(document) {
  return Buffer.from(createApplicationPdf(document,fonts).output('arraybuffer'));
}
