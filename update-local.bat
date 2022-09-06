call npm unpublish @softarc/native-federation@1.0.0 --registry http://localhost:4873
call npm unpublish @angular-architects/native-federation@1.0.0-beta.1 --registry http://localhost:4873
call nx build native-federation
call nx build native-federation-core
call npm publish dist\libs\native-federation-core --registry http://localhost:4873
call npm publish dist\libs\native-federation --registry http://localhost:4873
