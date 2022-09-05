const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const OptimizePlugin = require('module-nomodule-webpack-plugin').OptimizePlugin;
const ModuleNomodulePlugin =
  require('module-nomodule-webpack-plugin').HtmlWebpackEsmodulesPlugin;

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].[contenthash].js',
  },
  plugins: [
    new HtmlWebpackPlugin({ minify: false, inject: 'body' }),
    new OptimizePlugin({ modernize: false }),
    new ModuleNomodulePlugin('legacy'),
    new ModuleNomodulePlugin('modern'),
  ],
};
