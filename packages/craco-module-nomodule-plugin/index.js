const { loaderByName, getLoaders } = require('@craco/craco');
const createBabelPresetReactApp = require('babel-preset-react-app/create');
const OptimizePlugin = require('module-nomodule-webpack-plugin');

require.resolve('react/jsx-runtime');

const babelPreset = (api, opts) => {
  const preset = createBabelPresetReactApp(
    api,
    Object.assign({ helpers: false }, opts),
    opts.env
  );

  preset.presets.splice(0, 1);

  return preset;
};

module.exports = {
  overrideWebpackConfig: ({
    webpackConfig,
    pluginOptions: { enable, optimizeOptions, htmlWebpackPlugin } = {},
    context: { env }
  }) => {
    if (!enable) {
      return webpackConfig;
    }

    const loaderOptions = {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              esmodules: true
            }
          }
        ],
        [babelPreset, { env, runtime: 'automatic' }]
      ].filter(Boolean)
    };

    const optimizePluginOptions = {
      ...(optimizeOptions || {})
    };

    const { hasFoundAny, matches } = getLoaders(
      webpackConfig,
      loaderByName('babel-loader')
    );

    if (!hasFoundAny) {
      throw new Error('Babel-loader is not found!');
    }

    matches.forEach(({ loader }) => {
      Object.assign(loader.options, loaderOptions);
    });

    webpackConfig.plugins.push(
      new OptimizePlugin(optimizePluginOptions, undefined, htmlWebpackPlugin)
    );

    return webpackConfig;
  }
};
