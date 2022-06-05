# 14.3.0

## Update

This library supports ``ng update``:

```
ng update @angular-architects/module-federation
```

If you update by hand (e. g. via ``npm install``), make sure you also install a respective version of ngx-build-plus (version 14 for Angular 14, version 13 for Angular 13, etc.)

## Breaking Changes

- ``shareAll`` now uses the ``DEFAULT_SKIP_LIST`` by default.

## Features

* add withModuleFederationPlugin to simplify the generated ([ca26aeb](https://github.com/angular-architects/module-federation-plugin/commit/ca26aeb38afc9304ac2c0231219e76e140b9bdc1))
* **mf-runtime:** load remotes in parallel ([5615917](https://github.com/angular-architects/module-federation-plugin/commit/561591707ee126bb13c12c3d9397ba2c94e50328))
* **mf-runtime:** supporting mf manifests ([64ec2dc](https://github.com/angular-architects/module-federation-plugin/commit/64ec2dc73a9429a04ce5c8ebadf9cb72d7ddaba2))
* **mf:** add support for eager and pinned ([623837c](https://github.com/angular-architects/module-federation-plugin/commit/623837c29052d441cde6ee5940ac54d7e868dce2))
* **mf:** add type option to ng-add ([c57d87f](https://github.com/angular-architects/module-federation-plugin/commit/c57d87f608e470045b2d3229715e8d1aa27ce43f))
* **mf:** dev-server (run:all) accepts project names via command line args ([b765515](https://github.com/angular-architects/module-federation-plugin/commit/b765515be5b663e7f6e8b6d828dbe36c872b2dd6))
* **mf:** respect APF v14 for discovering secondaries ([00344c2](https://github.com/angular-architects/module-federation-plugin/commit/00344c25ebf5c4282c8451658817742a74081249))



