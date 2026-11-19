import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {zipSync,unzipSync} from 'fflate';

for (const args of [['scripts/generate-form-definitions.mjs'],['node_modules/vite/bin/vite.js','build']]) {
  const result = spawnSync(process.execPath,args,{stdio:'inherit'});
  if (result.status !== 0) throw new Error('Build failed. No deployment package was created.');
}
const files = [
  'app.cjs','package.json','package-lock.json','.env.example',
  'server/app.mjs','server/auth.mjs','server/config.mjs','server/form-definitions.json','server/index.mjs',
  'server/mailer.mjs','server/pdf.mjs','server/store.mjs','server/validation.mjs','server/README.md',
  'src/js/application-pdf.js','src/fonts/Lato-Regular.ttf','src/fonts/Lato-Bold.ttf','src/fonts/OFL.txt',
  'scripts/set-admin-password.mjs','scripts/private-input.mjs','scripts/env-file.mjs','scripts/setup-smtp.mjs','scripts/setup-yahoo-smtp.mjs','scripts/test-smtp.mjs',
];
function collect(directory) {
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const file = path.join(directory,entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in deployment files.');
    if (entry.isDirectory()) collect(file);
    else files.push(file.replaceAll('\\','/'));
  }
}
collect('dist');
const archive = {};
const manifest = [];
for (const file of files) {
  if ((path.basename(file).startsWith('.env') && file !== '.env.example') || /\.sqlite|\.local-data|encryption\.key/.test(file)) throw new Error('Private data must not be packaged.');
  const data = fs.readFileSync(file);
  archive[file] = new Uint8Array(data);
  manifest.push({path:file,sha256:createHash('sha256').update(data).digest('hex')});
}
archive['DEPLOYMENT-MANIFEST.json'] = new TextEncoder().encode(JSON.stringify(manifest,null,2)+'\n');
const bytes = zipSync(archive,{level:6});
const unpacked = unzipSync(bytes);
if (Object.keys(unpacked).length !== files.length+1 || unpacked['.env']) throw new Error('Archive validation failed.');
fs.mkdirSync('output/deploy',{recursive:true});
const output = 'output/deploy/ausome-node-deployment.zip';
fs.writeFileSync(output,bytes);
console.log(`Created ${output}: ${files.length} verified files. Passwords, encryption keys, application records and local settings are excluded.`);
