const path = require('path');
const CracoModuleNomodulePlugin = require('craco-module-nomodule-plugin');

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
        optimizeOptions: {
          polyfill: path.resolve(__dirname, 'src/polyfill.js')
        }
      }
    }
  ]
};
