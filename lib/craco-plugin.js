const fs = require('fs');
const { loaderByName, getLoaders } = require('@craco/craco');
require.resolve('react/jsx-runtime');

const OptimizePlugin = require('../');

const babelPreset = (api, { runtime, env, typescript } = {}) => {
  const isEnvDevelopment = env === 'development';
  const isEnvProduction = env === 'production';
  const isEnvTest = env === 'test';

  return {
    presets: [
      [
        '@babel/preset-env',
        {
          bugfixes: true,
          targets: {
            esmodules: true
          }
        }
      ],
      [
        '@babel/preset-react',
        {
          development: isEnvDevelopment || isEnvTest,
          ...(runtime !== 'automatic' ? { useBuiltIns: true } : {}),
          runtime: runtime || 'classic'
        }
      ],
      typescript && ['@babel/preset-typescript']
    ].filter(Boolean),
    plugins: [
      'babel-plugin-macros',
      [
        '@babel/plugin-transform-runtime',
        {
          corejs: false,
          helpers: false,
          version: require('@babel/runtime/package.json').version,
          regenerator: true
        }
      ],
      isEnvProduction && [
        'babel-plugin-transform-react-remove-prop-types',
        {
          removeImport: true
        }
      ],
      typescript && ['@babel/plugin-proposal-decorators', { legacy: true }]
    ].filter(Boolean)
  };
};

const matchCRAPreset = (src) =>
  typeof src === 'string' && Boolean(src.match(/babel-preset-react-app/));

module.exports = {
  overrideWebpackConfig: ({
    webpackConfig,
    pluginOptions: { enable, optimizeOptions, htmlWebpackPlugin } = {},
    context: { env, paths }
  }) => {
    if (!enable) {
      return webpackConfig;
    }

    const useTypeScript = fs.existsSync(paths.appTsConfig);

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
      const { options } = loader;

      options.presets = [
        ...options.presets.filter(
          (preset) =>
            !matchCRAPreset(Array.isArray(preset) ? preset[0] : preset)
        ),
        [babelPreset, { env, runtime: 'automatic', typescript: useTypeScript }]
      ];
    });

    webpackConfig.plugins.push(
      new OptimizePlugin(optimizePluginOptions, undefined, htmlWebpackPlugin)
    );

    return webpackConfig;
  }
};
