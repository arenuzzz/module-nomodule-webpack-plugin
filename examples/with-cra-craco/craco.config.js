const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CracoModuleNomodulePlugin = require('../../lib/craco-plugin');

module.exports = {
  webpack: {
    configure: (config, { paths }) => {
      // config.optimization.minimize = false;

      return config;
    }
  },
  plugins: [
    {
      plugin: CracoModuleNomodulePlugin,
      options: {
        enable: true,
        htmlWebpackPlugin: HtmlWebpackPlugin,
        optimizeOptions: {
          polyfillsOutputPath: 'static/js',
          polyfillsPath: path.resolve(__dirname, 'src/polyfill.js')
        }
      }
    }
  ]
};
