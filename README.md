# @angular-architects/module-federation

- [Readme for Module Federation](./libs/mf/README.md)
- [Readme for Native Federation](./libs/native-federation/README.md)

## Local Development

<details>
<summary>Playground App</summary>

You can test directly the libraries by using the playground application:

1. Start the `host` application:
   ```shell
   npx nx run playground:serve
   ```
2. Start the `remote` application:
   ```shell
   npx nx run mfe1:serve --port 3001
   ```

By using that approach you can test your modifications on the libraries.

</details>

<details>
<summary>Test Library on external repository</summary>

If you want to test the modifications directly on your application, you can follow the steps:

1. Start the local registry [Verdaccio](https://verdaccio.org/):
   ```shell
   npx nx run local-registry
   ```
2. Then you can publish the libraries by using:

- For Module federation:
  ```shell
  npm run publish-local:mf
  ```
- For Native federation:

  ```shell
  npm run publish-local:nf
  ```

  This will first `build` the libraries and `publish` them to [http://localhost:4873](http://localhost:4873)

3. Then just re-run the `install` on the other repo with you favorite package manager.

By default, the version from the `package.json` will be used. However, you can provide the version for a specific library by using:

```shell
npx nx run native-federation:publish-local -- --ver=17.0.8
```

</details>
<details>
<summary>Publish Libraries</summary>

Follow these steps to publish all libraries on `npm`:

- For Module federation:
  ```shell
  npm run publish:mf
  ```
- For Native federation:
  ```shell
  npm run publish:nf
  ```
  This will first `build` the libraries and `publish` them to `npm registry`.

By default, the version from the `package.json` will be used and the tag will be `next`. However, you can provide the version and the tag for a specific library by using:

```shell
npx nx run native-federation:publish -- --ver=17.0.8 --tag=latest
```

</details>
