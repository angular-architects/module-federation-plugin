call npm unpublish @softarc/native-federation@2.0.5 --registry http://localhost:4873
call npm unpublish @softarc/native-federation-runtime@2.0.5 --registry http://localhost:4873
call npm unpublish @softarc/native-federation-esbuild@2.0.5 --registry http://localhost:4873
call npm unpublish @angular-architects/native-federation@17.0.3 --registry http://localhost:4873

call npx nx build native-federation
call npx nx build native-federation-core
call npx nx build native-federation-runtime
call npx nx build native-federation-esbuild

call node post-build.js

call npm publish dist\libs\native-federation-core --registry http://localhost:4873
call npm publish dist\libs\native-federation --registry http://localhost:4873
call npm publish dist\libs\native-federation-runtime --registry http://localhost:4873
call npm publish dist\libs\native-federation-esbuild --registry http://localhost:4873
