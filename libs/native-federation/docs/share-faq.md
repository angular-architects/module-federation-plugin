# FAQ for Sharing Libraries

## Information for Nx Users

When using Nx, it's usual to subdivide an application into several libs. Libs that are only used by one application should not be shared via federation.

As by default, all packages found in your `package.json` but also all libs in your workspace are shared, you should add such libraries to your skip list:

```
skip: [
    '@my-scope/my-lib',
]
```

This speeds up your build and the initial page load. Also, it gives you automatic page reloads within your application when changing the source code.

## Using Multiple Framework Versions

After compiling an Angular application, the compilation is accessing Angular's private API. As private APIs do not align with semver, there is no guarantee that your compiled application works with a different version of Angular. Even having a different minor or patch version at runtime can lead to issues.

Hence, when using several versions or frameworks, you need to bootstrap each remote separately. Often, the individual Micro Frontends are abstracted, e.g., by using Web Components. Please find [more details about this here](https://www.angulararchitects.io/blog/micro-frontends-with-modern-angular-part-2-multi-version-and-multi-framework-solutions-with-angular-elements-and-web-components/).

## Sharing "Old-Style" Packages

To be useful in the long run, Native Federation fully leverages browser-native technologies like ESM and import maps. For this reason, old-style packages not following these standards can lead to challenges. In these cases, you might need to adjust your imports.

A good example of such a classical package is `lodash`. When we looked into it the last time, it was still `commonjs` and not ESM-based. As `commonjs` can not be converted to ESM in all cases, we needed to adjust the imports as follows:

```typescript
// Works:
import _ from 'lodash';

// Does not work:
// import * as _ from 'lodash';
```

Another solution is to find an ESM version of `lodash`.

The **good message** is: Angular's Package format implemented by ng build for libraries addresses ESM. Hence, Angular-based libraries really work well with Native Federation.

## ShareAll

The shareAll helper used by default in the federatio.config.js makes your life far easier as it shares all dependencies found in your `package.json`. To optimize your build times and initial page loads, you can opt-out of sharing specific libraries by adding them to the above-mentioned `skip` list.

While this is an option in most cases, you **need to** skip Node.js libraries as they cannot be compiled for usage within the browser. Examples of such libraries are `@angular/ssr` or `express`.

## Hint: Skip and RegExp

The skip list can contain a RegExp for excluding several entry points starting with the same name. This is especially interesting when using packages that come with several entry points, e.g. my-package/a and my-package/b. To skip all these entry points provided by my-package, you could use:

```typescript
skip: [
  'this-package', // string-based entry
  'that-package', // another string-based one
  /^my-package/, // RegExp
];
```

As an alternative, you can also provide a lambda expression:

```typescript
skip: [
  'this-package', // string-based entry
  'that-package', // another string-based one
  (p) => p.startsWith('my-package'), // RegExp
];
```

Please note, that a provided string is fully compared (not with startsWith semantic). Hence, in this example shown, `this-package` is excluded but not secondary entry points like `this-package/interop`.

## Manually Providing a Package's Entry Point

Usually, Native Federation automatically detects entry points into shared packages. If the packages neither align with the official standard nor with typical conventions beyond these standards, you can also directly provide the entry point:

```js
module.exports = withNativeFederation({
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
    'test-pkg': {
      packageInfo: {
        entryPoint: '/path/to/test-pkg/entry.mjs',
        version: '1.0.0',
        esm: true,
      },
    },
  },
});
```

As in such cases, we cannot expect to find a `package.json` nearby, you also have to specifiy the `version` and the `esm` flag by hand.
