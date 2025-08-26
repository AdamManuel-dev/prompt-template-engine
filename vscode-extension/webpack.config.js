/**
 * @fileoverview Webpack configuration for VS Code extension bundling
 * @lastmodified 2025-08-23T16:00:00Z
 * 
 * Features: Extension bundling with externals, source maps, optimizations
 * Main APIs: webpack configuration for VS Code extension
 * Constraints: Node target, VS Code externals, CommonJS2 output
 * Patterns: Production/development modes, tree shaking, minification
 */

const path = require('path');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },

  externals: {
    vscode: 'commonjs vscode',
    // Add other node modules that should not be bundled
    'node:fs': 'commonjs fs',
    'node:path': 'commonjs path',
    'node:crypto': 'commonjs crypto',
    'node:os': 'commonjs os',
    'node:util': 'commonjs util',
    'node:stream': 'commonjs stream'
  },

  resolve: {
    mainFields: ['browser', 'module', 'main'],
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@integrations': path.resolve(__dirname, '../src/integrations'),
      '@services': path.resolve(__dirname, '../src/services'),
      '@utils': path.resolve(__dirname, '../src/utils'),
      '@types': path.resolve(__dirname, '../src/types')
    },
    fallback: {
      assert: false,
      buffer: false,
      console: false,
      constants: false,
      crypto: false,
      domain: false,
      events: false,
      http: false,
      https: false,
      os: false,
      path: false,
      punycode: false,
      process: false,
      querystring: false,
      stream: false,
      string_decoder: false,
      sys: false,
      timers: false,
      tty: false,
      url: false,
      util: false,
      vm: false,
      zlib: false
    }
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'es6'
              }
            }
          }
        ]
      }
    ]
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/
    })
  ],

  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    moduleIds: 'deterministic',
    mangleExports: false
  },

  infrastructureLogging: {
    level: 'error'
  }
};

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    config.devtool = 'source-map';
    config.optimization.minimize = false;
  } else if (argv.mode === 'production') {
    config.devtool = 'hidden-source-map';
    config.optimization.minimize = true;
  }

  return config;
};