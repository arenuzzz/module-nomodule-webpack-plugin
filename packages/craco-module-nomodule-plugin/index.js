const fs = require('fs');
const { loaderByName, removeLoaders, addAfterLoader } = require('@craco/craco');
const OptimizePlugin = require('module-nomodule-webpack-plugin');

module.exports = {
  overrideWebpackConfig: ({
    webpackConfig,
    pluginOptions: {
      enabled,
      include,
      esbuildOptions,
      optimizeOptions,
      htmlWebpackPlugin,
    } = {},
    context: { paths },
  }) => {
    if (!enabled) {
      return webpackConfig;
    }

    const useTypeScript = fs.existsSync(paths.appTsConfig);

    const loaderOptions = {
      loader: useTypeScript ? 'tsx' : 'jsx',
      target: 'esnext',
      sourcemap: 'both',
      ...(esbuildOptions || {}),
    };

    const optimizePluginOptions = {
      ...(optimizeOptions || {}),
    };

    addAfterLoader(webpackConfig, loaderByName('babel-loader'), {
      test: /\.(js|mjs|jsx|ts|tsx)$/,
      include: [paths.appSrc, ...(include || [])],
      loader: require.resolve('esbuild-loader'),
      options: loaderOptions,
    });

    removeLoaders(webpackConfig, loaderByName('babel-loader'));

    webpackConfig.plugins.push(
      new OptimizePlugin(optimizePluginOptions, undefined, htmlWebpackPlugin)
    );

    return webpackConfig;
  },
};
