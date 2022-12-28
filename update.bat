REM call npm uninstall angular-architects-module-federation-runtime-14.3.10.tgz
REM call nx build mf-runtime
REM call npm pack dist\libs\mf-runtime
REM call npm i angular-architects-module-federation-runtime-14.3.10.tgz
REM 
REM call npm uninstall angular-architects-module-federation-14.3.10.tgz
REM call nx build mf
REM call npm pack dist\libs\mf
REM call npm i angular-architects-module-federation-14.3.10.tgz


REM call npm uninstall softarc-native-federation-core-1.1.0-beta.0.tgz --registry http://localhost:4873
call nx build native-federation-core
call npm pack dist\libs\native-federation-core
REM call npm i softarc-native-federation-1.1.0-beta.0.tgz --registry http://localhost:4873

REM call npm uninstall softarc-native-federation-runtime-1.1.0-beta.0.tgz --registry http://localhost:4873
call nx build native-federation-runtime
call npm pack dist\libs\native-federation-runtime
REM call npm i softarc-native-federation-runtime-1.1.0-beta.0.tgz --registry http://localhost:4873

REM call npm uninstall angular-architects-native-federation-esbuild-1.1.0-beta.0.tgz --registry http://localhost:4873
call nx build native-federation-esbuild
call npm pack dist\libs\native-federation-esbuild
REM call npm i angular-architects-native-federation-esbuild-1.1.0-beta.0.tgz --registry http://localhost:4873 -f