# Tutorial: Getting Started with Webpack Module Federation and Angular

This tutorial shows how to use Webpack Module Federation together with the Angular CLI and the ``@angular-architects/module-federation`` plugin. The goal is to make a shell capable of **loading a separately compiled and deployed microfrontend**:

![Microfrontend Loaded into Shell](https://github.com/angular-architects/module-federation-plugin/raw/main/packages/mf/tutorial/result.png)


## Part 1: Clone and Inspect the Starterkit

In this part you will clone the starterkit and inspect its projects.

1. Clone the starterkit for this tutorial:

    ```
    git clone https://github.com/manfredsteyer/module-federation-plugin-example.git --branch starter
    ```

2. Have a look to the ``package.json``. You should find this section:

    ```json
    "resolutions": {
        "webpack": "5.0.0"
    },
    ```

    This section makes yarn to install webpack 5 for the CLI (and for all the other libraries depending on webpack).

3. Move into the project directory and install the dependencies with **yarn**:

    ```
    cd module-federation-plugin-example
    yarn
    ```

    You really **need to install the dependencies with yarn** because providing resolutions as shown above is a **yarn** feature.

4. Start the shell (``ng serve shell -o``) and inspect it a bit:
   1. Click on the ``flights`` link. It leads to a dummy route. This route will later be used for loading the separately compiled microfrontend.

        Please **ignore depreaction warnings**. They are a temporal issue in the current CLI beta when using webpack 5.
   
   2. Have a look to the shell's source code. 

        > Please note that the current CLI **beta** lacks some features when using it with webpack 5, e. g. **reloading an application in debug mode** (when using ng serve). Hence, you have to restart ng serve after changing a source file. This is just a temporal limitation and will be solved with one of the upcoming versions.
   
   3. Stop the CLI (``CTRL+C``).

5. Do the same for the microfrontend. In this project, it's called ``mfe1`` (Microfrontend 1) You can start it with ``ng serve mfe1 -o``.

## Part 2: Activate and Configure Module Federation

Now, let's activate and configure module federation:

1. Install ``@angular-architects/module-federation`` into the shell and into the micro frontend:

    ```
    ng add @angular-architects/module-federation --project shell --port 5000

    ng add @angular-architects/module-federation --project mfe1 --port 3000
    ```

    This activates module federation, assigns a port for ng serve, and generates the skeleton of a module federation configuration.

2. Switch into the project ``mfe1`` and open the generated configuration file ``projects\mfe1\webpack.config.js``. It contains the module federation configuration for ``mfe1``. Adjust it as follows:

    ```javascript
    const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

    module.exports = {
        output: {
            uniqueName: "mfe1"
        },
        optimization: {
            // Only needed to bypass a temporary bug
            runtimeChunk: false
        },
        plugins: [
            new ModuleFederationPlugin({

                // For remotes (please adjust)
                name: "mfe1",
                filename: "remoteEntry.js",
                
                exposes: {
                    './Module': './projects/mfe1/src/app/flights/flights.module.ts',
                },        
                shared: {
                    "@angular/core": { singleton: true, strictVersion: true }, 
                    "@angular/common": { singleton: true, strictVersion: true }, 
                    "@angular/router": { singleton: true, strictVersion: true }
                }
            })
        ],
    };
    ```

    This exposes the ``FlightsModule`` under the Name ``./Module.``. Hence, the shell can use this path to load it. 

3. Switch into the ``shell`` project and open the file ``projects\shell\webpack.config.js``. Adjust it as follows:

    ```javascript
    const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

    module.exports = {
        output: {
            uniqueName: "shell"
        },
        optimization: {
            // Only needed to bypass a temporary bug
            runtimeChunk: false
        },
        plugins: [
            new ModuleFederationPlugin({
                remotes: {
                    'mfe1': "mfe1@http://localhost:3000/remoteEntry.js" 
                },
                shared: {
                    "@angular/core": { singleton: true, strictVersion: true }, 
                    "@angular/common": { singleton: true, strictVersion: true }, 
                    "@angular/router": { singleton: true, strictVersion: true }
                }
            })
        ],
    };
    ```

    This references the separately compiled and deployed ``mfe1`` project. There are some alternatives to configure its URL (see links at the end).

4. Open the ``shell``'s router config (``projects\shell\src\app\app.routes.ts``) and add a route loading the microfrontend:

    ```javascript
    {
        path: 'flights',
        loadChildren: () => import('mfe1/Module').then(m => m.FlightsModule)
    },
    ```

    Please note that the imported URL consists of the names defined in the configuration files above.

5. As the Url ``mfe1/Module`` does not exist at compile time, ease the TypeScript compiler by adding the following line to the file ``projects\shell\src\decl.d.ts``:

    ```javascript
    declare module 'mfe1/Module';
    ```

## Part 3: Try it out

Now, let's try it out!

1. Start the ``shell`` and ``mfe1`` side by side:

    ```
    ng serve shell -o
    ng serve mfe1 -o
    ```

    **Hint:** You might use two terminals for this.

2. After a browser window with the shell opened (``http://localhost:5000``), click on ``Flights``. This should load the microfrontend into the shell:

    ![Shell](https://github.com/angular-architects/module-federation-plugin/raw/main/packages/mf/tutorial/shell.png)

3. Also, ensure yourself that the microfrontend also runs in standalone mode at http://localhost:3000:

    ![Microfrontend](https://github.com/angular-architects/module-federation-plugin/raw/main/packages/mf/tutorial/mfe1.png)
   

Congratulations! You've implemented your first Module Federation project with Angular!

## More Details on Module Federation

Have a look at this [article series about Module Federation](https://www.angulararchitects.io/aktuelles/the-microfrontend-revolution-part-2-module-federation-with-angular/)

## Angular Trainings, Workshops, and Consulting

- [Angular Trainings and Workshops](https://www.angulararchitects.io/en/angular-workshops/)
- [Angular Consulting](https://www.angulararchitects.io/en/consulting/)