rem call npm uninstall angular-architects-native-federation-runtime-0.0.1.tgz
rem call nx build native-federation-runtime
rem call npm pack dist\libs\native-federation-runtime
rem call npm i angular-architects-native-federation-runtime-0.0.1.tgz

call npm uninstall angular-architects-native-federation-0.0.1.tgz
call nx build native-federation
call npm pack dist\libs\native-federation
call npm i angular-architects-native-federation-0.0.1.tgz