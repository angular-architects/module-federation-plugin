# @angular-architects/module-federation

> [!NOTE]
> **v22.0.0-next.1 (Angular 22) is out and we are looking for feedback.**
>
> Please try it on a real project and tell us what breaks, what feels off, and what you would
> like to see improved before `22.0.0` goes stable:
> [call for feedback, bug reports and improvements (#1124)](https://github.com/angular-architects/module-federation-plugin/issues/1124).

> [!IMPORTANT]
> **Native Federation has moved to its own organization: [github.com/native-federation](https://github.com/native-federation).**
>
> This repository now only hosts the Module Federation packages. If you are looking for Native
> Federation, or want to upgrade from v3 to v4, head to
> [native-federation/angular-adapter](https://github.com/native-federation/angular-adapter).
>
> The deprecated Native Federation v3 sources for Angular 21 remain available on the
> [`21.x.x`](https://github.com/angular-architects/module-federation-plugin/tree/21.x.x) backport
> branch.

- [Readme for Module Federation](./libs/mf/README.md)
- [Migration guides](./migration-guide.md)
- [Webpack Module Federation demo](./apps/README.md) — a host and two remotes
  running against the sources in `libs/`

## Local Development

<details>
<summary>Test Library on external repository</summary>

If you want to test the modifications directly on your application, you can follow the steps:

1. Start the local registry [Verdaccio](https://verdaccio.org/):
   ```shell
   npx nx run local-registry
   ```
2. Then you can publish the libraries by using:

   ```shell
   npm run publish-local
   ```

   This will first `build` the libraries and `publish` them to [http://localhost:4873](http://localhost:4873)

3. Then just re-run the `install` on the other repo with you favorite package manager.

By default, the version from the `package.json` will be used. However, you can provide the version for a specific library by using:

```shell
npx nx run mf:publish-local -- --ver=22.0.1
```

</details>
<details>
<summary>Publish Libraries</summary>

Follow these steps to publish all libraries on `npm`:

```shell
npm run publish
```

This will first `build` the libraries and `publish` them to `npm registry`.

By default, the version from the `package.json` will be used and the tag will be `latest`. However, you can provide the version and the tag for a specific library by using:

```shell
npx nx run mf:publish -- --ver=22.0.1 --tag=latest
```

</details>
