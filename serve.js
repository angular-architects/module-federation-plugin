const dist = 'dist/apps/playground';
const src = 'apps/playground';
const appName = 'playground';
const port = 3000;

const watch = require('node-watch');
const spawn = require('cross-spawn');

var browserSync = require('browser-sync');

function build(appName) {
  spawn.sync('npx', ['nx', 'build', appName], { stdio: 'inherit' });
}

build(appName);

const bsInstance = browserSync.create();
bsInstance.init({
  server: {
    baseDir: dist,
    index: 'index.html',
  },
  port: port,
  cors: true,
  browser: true,
});

watch(src, { recursive: true }, () => {
  build(appName);
  bsInstance.reload();
});
