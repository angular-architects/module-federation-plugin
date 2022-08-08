@REM call npm uninstall angular-architects-native-federation-runtime-0.0.3.tgz
@REM call nx build native-federation-runtime
@REM call npm pack dist\libs\native-federation-runtime
@REM call npm i angular-architects-native-federation-runtime-0.0.3.tgz

call npm uninstall angular-architects-native-federation-0.0.3.tgz
call nx build native-federation
call npm pack dist\libs\native-federation
call npm i angular-architects-native-federation-0.0.3.tgz