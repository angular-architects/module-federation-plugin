# @angular-architects/module-federation

无缝地使用Webpack模块联邦与Angular CLI。

## Thanks

衷心感谢以下帮助实现这一目标的人:

- [Tobias Koppers](https://twitter.com/wSokra), Founder of Webpack
- [Dmitriy Shekhovtsov](https://twitter.com/valorkin), Angular GDE 

## Prequisites

- Angular CLI 12 

## Motivation 💥

模块联盟允许加载单独编译和部署的代码（如微前端或插件）到一个应用程序中。这个插件使模块联邦与Angular和其CLI一起工作。

## Features 🔥

✅ 生成一个模块联邦配置的骨架。

✅ 安装一个自定义的构建器来启用模块联邦。

✅ 指定一个新的端口，同时为几个项目提供服务(``ng service``)。 

模块联盟配置是一个 **部分的** webpack配置。它只包含控制模块联合的东西。其余的是由CLI生成的。

从1.2版开始，我们还提供了一些高级功能，如:

✅ 支持动态模块联盟

✅ 从monorepo共享一个lib

## What's new in Version 12.0.0-beta.x?

✅ 与带来webpack 5的CLI 12.0.0-rc.1一起工作，开箱即用

✅ 解决了在单仓库中共享库的问题（在多个仓库中一起工作）

## Upgrade from Version 1.x

在更新libs之后，你需要对``webpack.conf.js``进行一些调整:


```diff
module.exports = {
  output: {
    uniqueName: "delme3",
+    publicPath: "auto"
  },
  optimization: {
    runtimeChunk: false
  },   
+  resolve: {
+    alias: {
+      ...sharedMappings.getAliases(),
+    }
+  },
  [...]
}
```

## Usage 🛠️

1. ``ng add @angular-architects/module-federation@next``
2. 调整生成的 ``webpack.config.js`` 文件
3. 对你工作区的其他项目重复这一步骤（如果需要）

## Getting Started 🧪

请在这里找到一个显示如何使用这个插件的[教程](https://github.com/angular-architects/module-federation-plugin/blob/12.0.0/libs/mf/tutorial/tutorial.md)。

![Microfrontend Loaded into Shell](https://github.com/angular-architects/module-federation-plugin/raw/main/libs/mf/tutorial/result.png)

[>> Start Tutorial](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/mf/tutorial/tutorial.md)

## Documentation 📰

请看这个 [关于模块联盟的系列文章](https://www.angulararchitects.io/aktuelles/the-microfrontend-revolution-part-2-module-federation-with-angular/).

## Example 📽️

[这个例子](https://github.com/manfredsteyer/module-federation-plugin-example)
将一个微前端加载到一个外壳中:

![Microfrontend Loaded into Shell](https://github.com/angular-architects/module-federation-plugin/raw/main/packages/mf/tutorial/result.png)

请看一下这个例子的**readme**。它指出了使用模块联盟的重要方面。


## Advanced Features

虽然上述教程和博客文章指导你使用模块联盟，但本节将提请你注意这个插件和模块联盟的一些高级方面。

### Dynamic Module Federation

从1.2版本开始，我们提供辅助函数，使动态模块联合变得非常容易。只需使用我们的``loadRemoteModule``函数来代替动态的``include``，例如，与路由懒加载一起使用:

```typescript
import { loadRemoteModule } from '@angular-architects/module-federation';

[...]
const routes: Routes = [
    [...]
    {
        path: 'flights',
        loadChildren: () =>
            loadRemoteModule({
                remoteEntry: 'http://localhost:3000/remoteEntry.js',
                remoteName: 'mfe1',
                exposedModule: './Module'
            })
            .then(m => m.FlightsModule)
    },
    [...]
]
```


如果有可能的话，提前加载`remoteEntry'。这允许模块联盟在协调共享库的版本时考虑到远程的元数据。

为此，你可以在启动Angular之前调用``loadRemoteEntry``:

```typescript
// main.ts
import { loadRemoteEntry } from '@angular-architects/module-federation';

Promise.all([
    loadRemoteEntry('http://localhost:3000/remoteEntry.js', 'mfe1')
])
.catch(err => console.error('Error loading remote entries', err))
.then(() => import('./bootstrap'))
.catch(err => console.error(err));
```

``bootstrap.ts``文件包含了通常在``main.ts``中进行加载，因此，它调用了``platform.bootstrapModule(AppModule)``。你真的需要这种前期文件调用loadRemoteEntry和动态导入加载另一个引导Angular的文件的组合，因为Angular本身已经是一个共享库，在版本协调中受到尊重。

然后，在加载远程模块时，只要跳过``remoteEntry``属性即可:

```typescript
import { loadRemoteModule } from '@angular-architects/module-federation';

[...]
const routes: Routes = [
    [...]
    {
        path: 'flights',
        loadChildren: () =>
            loadRemoteModule({
                // Skipped - already loaded upfront:
                // remoteEntry: 'http://localhost:3000/remoteEntry.js',
                remoteName: 'mfe1',
                exposedModule: './Module'
            })
            .then(m => m.FlightsModule)
    },
    [...]
]
```

### 在Monorepo中共享Lib

让我们假设，你有一个Angular CLI Monorepo或Nx Monorepo，在``tsconfig.json``中使用路径映射来提供库:

```json
"shared-lib": [
  "projects/shared-lib/src/public-api.ts",
],
```

你现在可以在你的mono repo中的所有微前端程序（应用程序）中共享这样一个库。这意味着，这个库将只被加载一次。

要做到这一点，只需在你的webpack配置中的``SharedMappings``实例中注册这个lib名称即可:

```javascript
const mf = require("@angular-architects/module-federation/webpack");
const path = require("path");

[...]

const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  path.join(__dirname, '../../tsconfig.json'),
  ['auth-lib']  
);
```

从1.2版本开始，使用``SharedMappings``的模板已经为你生成。你只需要在这里添加你的lib的名字。

这个生成的代码包括为``ModuleFederationPlugin``提供这些库的元数据，并添加一个插件，确保即使是Angular编译器生成的源代码也使用共享版本的库。

```javascript
plugins: [
    new ModuleFederationPlugin({
        [...]
        shared: {
            [...]
            ...sharedMappings.getDescriptors()
        }
    }),
    sharedMappings.getPlugin(),
],
```

### Share Helper

帮助函数share为共享的依赖关系增加了一些额外的选项:

```json
shared: share({
    "@angular/common": { 
        singleton: true, 
        strictVersion: true,
        requiredVersion: 'auto',
        includeSecondaries: true
    },
    [...]
})
```

增加的选项是 ``requireVersion: 'auto'`` 和 ``includeSecondaries``.

#### requireVersion: 'auto'

如果你把 ``requireVersion`` 设置为 ``auto``，帮助器会采用你的 ``package.json`` 中定义的版本。

这有助于解决没有(完全)满足对等依赖和次要入口点的问题(见下面的陷阱部分)。

默认情况下，它采用离调用者最近的``package.json``（通常是``webpack.config.js``）。然而，你可以使用第二个可选参数传递到其他``package.json``的路径。另外，你需要在你的``package.json`中的node依赖项中定义共享库。

你也可以跳过这个选项，在 自动之前调用 ``setInferVersion(true)``，而不是一次又一次地将requireVersion设置为自动:

```typescript
setInferVersion(true);
```

#### includeSecondaries

如果设置为``true``，所有的二级入口点也会被添加。在``@angular/common``的情况下，这也是``@angular/common/http``、``@angular/common/http/testing``、``@angular/common/testing``、``@angular/common/http/upgrade``和``@angular/common/locales``。这个详尽的列表表明，为``@angular/common``使用这个选项不是最好的主意，因为通常情况下，你不需要其中的大多数模块。

然而，这个选项在快速实验中可以派上用场，或者如果你想快速分享一个像``@angular/material``这样的包，其中有无数的二级入口。

即使你共享了太多，模块联盟也会在运行时只加载需要的那些。然而，请记住，共享的包不能被摇树优化。

要跳过一些二级入口点，你可以指定一个配置选项，而不是``true``:

```typescript
shared: share({
    "@angular/common": { 
        singleton: true, 
        strictVersion: true,
        requiredVersion: 'auto',
        includeSecondaries: {
            skip: ['@angular/http/testing']
        }
    },
    [...]
})
```

#### shareAll

``shareAll``帮助器分享所有定义在``package.json``中的依赖关系。``package.json``的查找方法如上所述:

```json
shared: {
  ...shareAll({ 
      singleton: true, 
      strictVersion: true, 
      requiredVersion: 'auto' 
  }),
  ...sharedMappings.getDescriptors()
}
```

传递给shareAll的选项将应用于在你的``package.json``中发现的所有依赖项。

这可能会在mono repo的情况下和做一些实验/故障排除时派上用场。

### Angular Universal (Server Side Rendering)

从这个插件的12.4.0版本开始，我们支持新的基于_jsdom_的Angular Universal API的服务器端渲染（SSR）。请注意，SSR*只在特定的情况*下才有意义，例如，需要SEO的面向客户的应用程序。  

为了使用SSR，你应该为**所有**的联盟项目（如shell和微前端）启用SSR。

#### 在添加模块联盟之前先添加Angular Universal

如果你从一个新项目开始，你应该在添加模块联盟之前添加Angular Universal:

```
ng add @nguniversal/common --project yourProject
ng add @angular-architects/module-federation --project yourProject
```

然后，调整生成中的端口 ``server.ts``:

```typescript
const PORT = 5000;
```

在这之后，你可以编译和运行你的应用程序:

```
ng build yourProject && ng run yourProject:server
node dist/yourProject/server/main.js
```

#### 将Angular Universal添加到现有的模块联盟项目中

如果你已经使用``@angular-architects/module-federation``，你可以这样添加Angular Universal:

1. 升级 ``@angular-architects/module-federation`` 到最新版本 (>= 12.4).

    ```
    npm i @angular-architects/module-federation@latest 
    ```

2. 现在，我们需要暂时禁用异步引导。虽然模块联盟需要它，但Angular Universal提供的Schematics假定Angular是以传统（同步）方式引导的。在使用这些Schematics后，我们必须再次启用异步引导功能:

    ```
    ng g @angular-architects/module-federation:boot-async false --project yourProject

    ng add @nguniversal/common --project yourProject
    
    ng g @angular-architects/module-federation:boot-async true --project yourProject
    ```

3. 现在我们已经有了模块联盟和Angular Universal，我们可以将它们相互整合起来:

    ```
    ng g @angular-architects/module-federation:nguniversal --project yourProject
    ```

4. 在生成的``server.ts``文件中调整使用的端口:

    ```typescript
    const PORT = 5000;
    ```

5. 现在，你可以编译和运行你的应用程序了:

    ```
    ng build yourProject && ng run yourProject:server
    node dist/yourProject/server/main.js
    ```

#### Example

请在分支 ``ssr`` 中招待这个[例子](https://github.com/manfredsteyer/module-federation-plugin-example/tree/ssr
) 。

#### Trying it out

要试用它，你可以查看我们的[example](https://github.com/manfredsteyer/module-federation-plugin-example)的``main``分支。在安装完依赖项（`npm i``）后，你可以重复上述将Angular Universal添加到现有模块联盟项目的步骤两次：一次是_project shell和端口5000_，另一次是_project mfe1和端口3000_。

### 共享Monorepo库时的陷阱

#### Warning: 没有指定所需的版本

如果你得到警告_No required version specified and unable to automatically determine one_，那么模块联盟需要一些帮助来找出要使用的共享库的版本。原因是不符合对等的依赖关系或使用次级入口点，如``@angular/common/http``。

为了避免这个警告，你可以用手指定使用的版本:

```json
shared: { 
    "@angular/common": { 
        singleton: true, 
        strictVersion: true, 
        requireVersion: '12.0.0  
    },
    [...]
},
```

你也可以使用我们的 ``share`` helper，在将 ``requireVersion`` 设置为 ``"auto"`` 时，从你的 ``package.json`` 推断出版本号:

```json
shared: share({
    "@angular/common": { 
        singleton: true, 
        strictVersion: true,
        requireVersion: 'auto'  
    },
    [...]
})
```



#### 没有出口的组件

如果你使用一个共享组件而没有通过你的库的桶（``index.ts``或``public-api.ts``）导出它，你会在运行时得到以下错误:

```
core.js:4610 ERROR Error: Uncaught (in promise): TypeError: Cannot read property 'ɵcmp' of undefined
TypeError: Cannot read property 'ɵcmp' of undefined
    at getComponentDef (core.js:1821)
```


## Angular Trainings, Workshops, and Consulting 👨‍🏫

- [Angular Trainings and Workshops](https://www.angulararchitects.io/en/angular-workshops/)
- [Angular Consulting](https://www.angulararchitects.io/en/consulting/)
