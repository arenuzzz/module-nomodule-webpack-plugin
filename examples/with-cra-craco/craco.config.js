const path = require('path');
const CracoModuleNomodulePlugin = require('craco-module-nomodule-plugin');

module.exports = {
  plugins: [
    {
      plugin: CracoModuleNomodulePlugin,
      options: {
        enabled: true,
        optimizeOptions: {
          polyfill: path.resolve(__dirname, 'src/polyfill.js'),
        },
        esbuildOptions: {
          jsx: 'automatic',
        },
      },
    },
  ],
};
