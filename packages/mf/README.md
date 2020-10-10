# @angular-architects/module-federation

Seamlessly using Webpack Module Federation with the Angular CLI.

## Thanks

Big thanks to the following people who helped to make this possible:

- [Tobias Koppers](https://twitter.com/wSokra), Founder of Webpack
- [Dmitriy Shekhovtsov](https://twitter.com/valorkin), Angular GDE 

## Prequisites

- Angular CLI 11 (currently BETA)

## Usage

1. ``ng add @angular-architects/module-federation``
2. Adjust the generated ``webpack.config.js`` file
3. Repeat this for further projects in your workspace (if needed)

## Notes for CLI 11 BETA (next.XY)

- You need to use **yarn** b/c it allows to override dependencies
    - Existing Projects: ``ng config -g cli.packageManager yarn``
    - New Projects: ``ng new workspace-name --packageManager yarn``

- Add this to your ``package.json`` (e. g. before the ``dependencies`` section ) to force the CLI into webpack 5:

    ```json
    "resolutions": {
        "webpack": "5.0.0-rc.6"
    },
    ```

- Run **yarn** to install all packages

## Example

See https://github.com/manfredsteyer/module-federation-plugin-example

## More Details

Have a look at this [article series about Module Federation](https://www.angulararchitects.io/aktuelles/the-microfrontend-revolution-part-2-module-federation-with-angular/)
