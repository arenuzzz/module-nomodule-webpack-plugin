const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizePlugin = require('../../');

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js'
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  bugfixes: true,
                  targets: {
                    esmodules: true
                  }
                }
              ]
            ]
          }
        }
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({ minify: false, publicPath: '/' }),
    new OptimizePlugin(
      {
        verbose: true,
        polyfillsPath: path.resolve(__dirname, 'src/polyfill.js'),
        polyfillsOutputPath: 'js'
      },
      undefined,
      HtmlWebpackPlugin
    ),
    new MiniCssExtractPlugin()
  ]
};
