const path = require('path');
const { addAfterLoader, removeLoaders, loaderByName } = require('@craco/craco');

const OptimizePlugin = require('module-nomodule-webpack-plugin').OptimizePlugin;

module.exports = {
  webpack: {
    configure: (config, { paths }) => {
      const esbuildLoader = {
        test: /\.(js|mjs|jsx|ts|tsx)$/,
        loader: require.resolve('esbuild-loader'),
        options: {
          target: 'esnext',
          loader: 'jsx',
        },
      };

      addAfterLoader(config, loaderByName('babel-loader'), esbuildLoader);
      removeLoaders(config, loaderByName('babel-loader'));

      config.plugins.push(
        new OptimizePlugin({
          modernize: false,
          polyfill: path.resolve(__dirname, 'src/polyfill.js'),
        })
      );

      return config;
    },
  },
};
