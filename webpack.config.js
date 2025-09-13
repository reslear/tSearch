require('./builder/defaultBuildEnv');
const {DefinePlugin, IgnorePlugin} = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

const outputPath = BUILD_ENV.outputPath;
const mode = BUILD_ENV.mode;
const devtool = BUILD_ENV.devtool;
const babelEnvOptions = BUILD_ENV.babelEnvOptions;

const uiConfig = {
  entry: {
    sandbox: './src/sandbox',
    popup: './src/Popup',
    index: './src/App',
    tabFetch: './src/tabFetch',
    /*options: './src/Options',
    history: './src/js/history',
    editor: './src/js/editor',
    magic: './src/js/magic',*/
  },
  output: {
    path: path.join(outputPath, 'dist'),
    filename: '[name].js',
    chunkFilename: 'chunk-[name].js',
  },
  mode: mode,
  devtool: devtool,
  optimization: {
    minimize: false,
    splitChunks: false,
    runtimeChunk: false,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              ['@babel/plugin-proposal-decorators', {'legacy': true}],
              '@babel/plugin-syntax-dynamic-import',
              '@babel/plugin-proposal-class-properties'
            ],
            presets: [
              '@babel/preset-react',
              ['@babel/preset-env', babelEnvOptions]
            ]
          }
        }
      },
      {
        test: /\.(css|less)$/,
        use: [{
          loader: MiniCssExtractPlugin.loader
        }, {
          loader: "css-loader"
        }, {
          loader: "less-loader"
        }]
      },
      {
        test: /\.(png|svg)$/,
        use: [{
          loader: 'url-loader',
          options: {
            limit: 8192
          }
        }]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
      cleanOnceBeforeBuildPatterns: [outputPath]
    }),
    new CopyWebpackPlugin([
      {from: './src/manifest.json',},
      {from: './src/assets/img', to: './assets/img'},
      {from: './src/assets/icons', to: './assets/icons'},
      {from: './src/_locales', to: './_locales'},
      {from: './src/trackers', to: './trackers'},
      {from: './src/explorerModules', to: './explorerModules'},
    ]),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: "chunk-[id].css"
    }),
    new HtmlWebpackPlugin({
      filename: 'sandbox.html',
      template: './src/templates/sandbox.html',
      chunks: ['sandbox']
    }),
    new HtmlWebpackPlugin({
      filename: 'popup.html',
      template: './src/templates/popup.html',
      chunks: ['popup']
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: './src/templates/index.html',
      chunks: ['index']
    }),
    /*new HtmlWebpackPlugin({
      filename: 'history.html',
      template: './src/history.html',
      chunks: ['commons', 'history']
    }),
    new HtmlWebpackPlugin({
      filename: 'editor.html',
      template: './src/editor.html',
      chunks: ['commons', 'editor']
    }),
    new HtmlWebpackPlugin({
      filename: 'magic.html',
      template: './src/magic.html',
      chunks: ['commons', 'magic']
    }),*/
    new DefinePlugin({
      'BUILD_ENV': Object.entries(BUILD_ENV).reduce((obj, [key, value]) => {
        obj[key] = JSON.stringify(value);
        return obj;
      }, {}),
    })
  ]
};

if (mode === 'production') {
  Object.keys(uiConfig.entry).forEach(entryName => {
    let value = uiConfig.entry[entryName];
    if (!Array.isArray(value)) value = [value];
    value.unshift('whatwg-fetch');
    uiConfig.entry[entryName] = value;
  });
}

// Separate config for service worker (no window, no JSONP)
const bgConfig = {
  entry: {
    bg: './src/background',
  },
  target: 'webworker',
  output: {
    path: path.join(outputPath, 'dist'),
    filename: '[name].js',
    chunkFilename: 'chunk-[name].js',
  },
  mode: mode,
  devtool: devtool,
  optimization: {
    minimize: false,
    splitChunks: false,
    runtimeChunk: false,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              ['@babel/plugin-proposal-decorators', {'legacy': true}],
              '@babel/plugin-syntax-dynamic-import',
              '@babel/plugin-proposal-class-properties'
            ],
            presets: [
              '@babel/preset-react',
              ['@babel/preset-env', babelEnvOptions]
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new DefinePlugin({
      'BUILD_ENV': Object.entries(BUILD_ENV).reduce((obj, [key, value]) => {
        obj[key] = JSON.stringify(value);
        return obj;
      }, {}),
    }),
    // Strip UI-only worker helpers from the service worker bundle
    new IgnorePlugin({ resourceRegExp: /tools\/(frameWorker|moduleWorker|trackerWorker|explorerModuleWorker|transport)\.js$/ })
  ]
};

module.exports = [uiConfig, bgConfig];
