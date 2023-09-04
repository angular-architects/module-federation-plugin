call npm unpublish @softarc/native-federation@2.0.0 --registry http://localhost:4873
call npm unpublish @softarc/native-federation-runtime@2.0.0 --registry http://localhost:4873
call npm unpublish @softarc/native-federation-esbuild@2.0.0 --registry http://localhost:4873
call npm unpublish @angular-architects/native-federation@16.3.0 --registry http://localhost:4873

call nx build native-federation
call nx build native-federation-core
call nx build native-federation-runtime
call nx build native-federation-esbuild

call node post-build.js

call npm publish dist\libs\native-federation-core --registry http://localhost:4873
call npm publish dist\libs\native-federation --registry http://localhost:4873
call npm publish dist\libs\native-federation-runtime --registry http://localhost:4873
call npm publish dist\libs\native-federation-esbuild --registry http://localhost:4873
