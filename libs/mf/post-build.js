const fs = require('fs');
const path = require('path');

const index = fs.readFileSync(path.join(__dirname, 'src/index.ts'), {
  encoding: 'utf-8',
});
fs.writeFileSync(
  path.join(__dirname, '../../dist/libs/mf/src/index.js'),
  index
);

const nguniversal = fs.readFileSync(
  path.join(__dirname, 'src/nguniversal.ts'),
  {
    encoding: 'utf-8',
  }
);
fs.writeFileSync(
  path.join(__dirname, '../../dist/libs/mf/src/nguniversal.js'),
  nguniversal
);
