# Webpack Module Federation demo

A dynamic host and two remotes, built against the sources in `libs/`. Useful as a
manual smoke test for `@angular-architects/module-federation` and as a worked
example of the config the `init-webpack` schematic generates.

| Project | Port | Role         | Exposes                              |
| ------- | ---- | ------------ | ------------------------------------ |
| `shell` | 4200 | Dynamic host | —                                    |
| `mfe1`  | 4201 | Remote       | `./routes` → `FLIGHT_ROUTES`         |
| `mfe2`  | 4202 | Remote       | `./Component` → `DashboardComponent` |

`libs/playground-lib` is shared by all three as a singleton, via `sharedMappings`.

## Run it

```shell
npx nx serve shell
```

`shell:serve` depends on both remotes' `serve` targets, so one command starts all
three. Then open <http://localhost:4200>, type a name into the login box, and
open _Flights_ and _Dashboard_: both are separate builds served from other ports,
and both read the name back out of the same `AuthService` instance.

Each app also runs on its own — <http://localhost:4201> and
<http://localhost:4202> are complete Angular apps.

To build instead:

```shell
npx nx run-many -t build -p shell mfe1 mfe2
```

## What each piece demonstrates

**Dynamic host.** `shell/webpack.config.js` declares no `remotes`. The shell
learns about mfe1 and mfe2 at runtime from `shell/public/mf.manifest.json`, which
`initFederation()` in `shell/src/main.ts` fetches before Angular boots. Remotes
can move or be added without rebuilding the shell — edit the manifest in
`dist/apps/shell/` and reload.

**Async boundary.** Every app's `main.ts` only does `import('./bootstrap')`.
Nothing may touch a shared library before the share scope is initialized, so all
real work sits behind a dynamic import.

**Two granularities of exposure.** mfe1 exposes routes and owns everything under
`/flights`; mfe2 exposes a single component that the shell routes to itself. See
`shell/src/app/app.routes.ts` for both call shapes of `loadRemoteModule`.

**Sharing.** `shareAll({ singleton: true, strictVersion: true, requiredVersion:
'auto' })` shares every runtime dependency in the root `package.json`.
`requiredVersion: 'auto'` reads the version from that same `package.json`, so all
three builds agree. In the network tab, `remoteEntry.js` comes from `:4201` and
`:4202`, but `@angular/core` is downloaded once — from whichever build asks
first.

**Monorepo libraries.** `libs/playground-lib` has no version of its own, so
`shareAll` cannot see it. `sharedMappings: ['@angular-architects/playground-lib']`
resolves it through `tsconfig.base.json` `paths` and shares it with
`requiredVersion: false`. That is what makes `AuthService` a true singleton across
build boundaries.

## Deviations from a normal app

These exist only because the demo lives inside the plugin's own repository:

- The `webpack.config.js` files require `../../dist/libs/mf/webpack` instead of
  `@angular-architects/module-federation/webpack`, because the package is never
  installed here. Both the `build` and `serve` targets `dependsOn` `mf:build` so
  the output exists before webpack loads the config.
- `shell/webpack.config.js` adds two `resolve.alias` entries for
  `@angular-architects/module-federation` and `-runtime`. Angular's webpack build
  ignores tsconfig `paths`, so the aliases mirror the two entries the shell
  relies on. They point at `libs/*/src`, **not** `dist/` — building `mf` also
  rebuilds `mf-runtime`, and ng-packagr recreates `dist/libs/mf-runtime`, which
  would yank the module out from under a dev-server already watching it. Using
  sources also means editing a library live-reloads the demo.

Everything else is what `ng g @angular-architects/module-federation:init-webpack`
generates for an Nx workspace: the `@nx/angular:webpack-browser` and
`@nx/angular:dev-server` builders, `commonChunk: false`,
`extractLicenses: false`, and a CORS header on each remote's dev-server.

## Known cosmetic error (dev builds only)

Under `nx serve`, every page load logs `SyntaxError: Cannot use 'import.meta'
outside a module`. `withModuleFederationPlugin` sets `experiments.outputModule`,
so webpack emits ESM for _all_ entry points, but Angular's index-html generator
injects the `styles` entry with `defer` rather than `type="module"`. The failing
chunk holds only webpack's runtime boilerplate — global CSS is applied through
the separate `<link rel="stylesheet" href="styles.css">`, and nothing else is
affected. Production builds don't emit a `styles` script at all, so they are
clean.
