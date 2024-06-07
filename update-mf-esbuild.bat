call nx build mf-esbuild 
call npm unpublish @angular-architects/module-federation-esbuild@0.0.1 -f --registry http://localhost:4873
call npm publish dist\libs\mf-esbuild --registry http://localhost:4873

