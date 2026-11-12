import fs from 'node:fs/promises';
const [html,app,initial,server]=await Promise.all(['index.html','app.js','initial.js','server.mjs'].map(file=>fs.readFile(new URL(file,import.meta.url),'utf8')));
const records=JSON.parse(initial.slice(initial.indexOf('=')+1).trim().replace(/;$/,''));
const logo=await fs.readFile(new URL('logo.jpeg',import.meta.url));
await fs.mkdir('dist/server',{recursive:true});
await fs.writeFile('dist/server/index.js',`const LOGO=${JSON.stringify(logo.toString('base64'))};\nconst HTML=${JSON.stringify(html)};\nconst APP=${JSON.stringify(app)};\nconst INITIAL=${JSON.stringify(records)};\n`+server);
