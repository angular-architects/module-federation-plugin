const fs = require('fs');
const path = require('path');

const source = '../../native-federation-node/src/lib/utils/fstart.mjs';
const dataUrlFile = '../src/tools/fstart-as-data-url.ts';

const filePath = path.resolve(__dirname, source);
const fileContent = fs.readFileSync(filePath, 'utf8');
const base64Content = Buffer.from(fileContent).toString('base64');

// const dataUrl = `data:text/javascript;base64,${base64Content}`;

const outputPath = path.resolve(__dirname, dataUrlFile);
fs.writeFileSync(outputPath, `export const fstart = "${base64Content}";\n`);

console.log('Created data url for fstart');
