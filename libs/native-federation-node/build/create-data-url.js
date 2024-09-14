const fs = require('fs');
const path = require('path');

const loaderSource = '../src/lib/utils/import-map-loader.js';
const dataUrlFile = '../src/lib/utils/loader-as-data-url.js';

const filePath = path.resolve(__dirname, loaderSource);
const fileContent = fs.readFileSync(filePath, 'utf8');
const base64Content = Buffer.from(fileContent).toString('base64');

const dataUrl = `data:text/javascript;base64,${base64Content}`;

const outputPath = path.resolve(__dirname, dataUrlFile);
fs.writeFileSync(outputPath, `export const resolver = "${base64Content}";\n`);

console.log('Created data url for loader');