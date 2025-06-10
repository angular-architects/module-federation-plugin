

npx esbuild --platform=node --bundle libs/native-federation-node/src/lib/utils/fstart.ts --format=esm --outfile=libs/native-federation-node/src/lib/utils/fstart.mjs

node libs/native-federation/build/create-data-url.js
node libs/native-federation-node/build/create-data-url.js
npm run publish-local:nf
