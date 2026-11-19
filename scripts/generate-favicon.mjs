import fs from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';

const source = await loadImage(fs.readFileSync(new URL('../src/images/favicon.svg',import.meta.url)));
const png = size => {
  const canvas = createCanvas(size,size);
  canvas.getContext('2d').drawImage(source,0,0,size,size);
  return canvas.toBuffer('image/png');
};
fs.writeFileSync(new URL('../src/images/favicon-32.png',import.meta.url),png(32));
fs.writeFileSync(new URL('../src/images/apple-touch-icon.png',import.meta.url),png(180));
const icons = [16,32,48,64].map(size => ({size,buffer:png(size)}));
const header = Buffer.alloc(6+icons.length*16);
header.writeUInt16LE(1,2); header.writeUInt16LE(icons.length,4);
let offset = header.length;
icons.forEach(({size,buffer},index) => {
  const start = 6+index*16;
  header[start] = size; header[start+1] = size;
  header.writeUInt16LE(1,start+4); header.writeUInt16LE(32,start+6);
  header.writeUInt32LE(buffer.length,start+8); header.writeUInt32LE(offset,start+12);
  offset += buffer.length;
});
fs.writeFileSync(new URL('../src/images/favicon.ico',import.meta.url),Buffer.concat([header,...icons.map(icon => icon.buffer)]));
console.log('Generated SVG, PNG, multi-size ICO and Apple touch icon assets.');
