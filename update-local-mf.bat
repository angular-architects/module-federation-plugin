@REM call npm unpublish @softarc/native-federation@2.0.3 --registry http://localhost:4873
@REM call npm unpublish @softarc/native-federation-runtime@2.0.3 --registry http://localhost:4873
@REM call npm unpublish @softarc/native-federation-esbuild@2.0.3 --registry http://localhost:4873
@REM call npm unpublish @angular-architects/native-federation@16.3.3 --registry http://localhost:4873
call npm unpublish @angular-architects/module-federation-tools@17.0.0 --registry http://localhost:4873
call npm unpublish @angular-architects/module-federation-runtime@17.0.0 --registry http://localhost:4873
call npm unpublish @angular-architects/module-federation@17.0.0 --registry http://localhost:4873

call npx nx build mf
call npx nx build mf-runtime
call npx nx build mf-tools

call node post-build.js

call npm publish dist\libs\mf --registry http://localhost:4873
call npm publish dist\libs\mf-runtime --registry http://localhost:4873
call npm publish dist\libs\mf-tools --registry http://localhost:4873
