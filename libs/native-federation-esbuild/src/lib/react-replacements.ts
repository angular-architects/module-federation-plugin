export const reactReplacements = {
    dev: {
        'node_modules/react/index.js': 'node_modules/react/cjs/react.development.js',
        'node_modules/react/jsx-dev-runtime.js' : 'node_modules/react/cjs/react-jsx-dev-runtime.development.js',
        'node_modules/react/jsx-runtime.js': 'node_modules/react/cjs/react-jsx-runtime.development.js'
    },
    prod: {
        'node_modules/react/index.js': 'node_modules/react/cjs/react.production.min.js',
        'node_modules/react/jsx-dev-runtime.js' : 'node_modules/react/cjs/react-jsx-dev-runtime.production.min.js',
        'node_modules/react/jsx-runtime.js': 'node_modules/react/cjs/react-jsx-runtime.production.min.js'
    }
}