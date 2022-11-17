call npm uninstall angular-architects-module-federation-runtime-14.3.10.tgz
call nx build mf-runtime
call npm pack dist\libs\mf-runtime
call npm i angular-architects-module-federation-runtime-14.3.10.tgz

call npm uninstall angular-architects-module-federation-14.3.10.tgz
call nx build mf
call npm pack dist\libs\mf
call npm i angular-architects-module-federation-14.3.10.tgz


call npm uninstall softarc-native-federation-core-0.9.1.tgz
call nx build native-federation-core
call npm pack dist\libs\native-federation-core
call npm i softarc-native-federation-0.9.2-beta.3.tgz

call npm uninstall softarc-native-federation-runtime-0.9.1.tgz
call nx build native-federation-runtime
call npm pack dist\libs\native-federation-runtime
call npm i softarc-native-federation-runtime-0.9.2-beta.3.tgz

call npm uninstall angular-architects-native-federation-0.9.1.tgz
call nx build native-federation
call npm pack dist\libs\native-federation
call npm i angular-architects-native-federation-0.9.1.tgz -f