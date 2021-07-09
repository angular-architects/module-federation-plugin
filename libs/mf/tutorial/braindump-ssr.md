## Adding Angular Universal to an Module Federation Project

This brain dump shows how to add Angular Universal to our [example](https://github.com/manfredsteyer/module-federation-plugin-example).

```
npm i @angular-architects/module-federation@latest --registry http://localhost:4873


ng g @angular-architects/module-federation:boot-async false --project shell
ng add @nguniversal/common --project shell
ng g @angular-architects/module-federation:boot-async true --project shell
ng g @angular-architects/module-federation:nguniversal --project shell


ng g @angular-architects/module-federation:boot-async false --project mfe1
ng add @nguniversal/common --project mfe1
ng g @angular-architects/module-federation:boot-async true --project mfe1
ng g @angular-architects/module-federation:nguniversal --project mfe1


Adjust projects\shell\src\server.ts
const PORT = 5000;

Adjust projects\mfe1\src\server.ts
const PORT = 3000;


ng build mfe1 && ng run mfe1:server
node dist/mfe1/server/main.js

ng build shell && ng run shell:server
node dist/shell/server/main.js
```


