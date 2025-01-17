/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// import * as terser from 'terser';
import babel from '@babel/core';
// import transformWebpackUrls from './lib/transform-change-webpack-urls';
// import extractPolyfills from './lib/transform-extract-polyfills';
// import { toBabelMap, toTerserMap, createPerformanceTimings } from './lib/util';
import { createPerformanceTimings } from './lib/util';
// import createBabelPresetReactApp from 'babel-preset-react-app';

// import swc from '@swc/core';
const NAME = 'OptimizePlugin';

// const TERSER_CACHE = {};

const noopTimings = { timings: [], start: (n) => {}, end: (n) => {} };

/**
 * @param {object} $0
 * @param {string} $0.file
 * @param {string} $0.source
 * @param {string|object} $0.map
 * @param {object} [$0.options]
 * @param {boolean} [$0.options.timings = false]
 * @param {boolean} [$0.options.minify = false]
 * @param {boolean} [$0.options.downlevel = false]
 * @param {boolean} [$0.options.modernize = false]
 * @param {number} [$0.options.corejsVersion]
 */
export async function process({ file, source, map, options = {} }) {
  const { timings, start, end } = options.timings
    ? createPerformanceTimings()
    : noopTimings;
  const {
    minify,
    downlevel
    // modernize
  } = options;

  // const polyfills = new Set();
  let legacy;
  // let modern;

  const outputOptions = {
    compact: minify,
    minified: minify,
    // envName: minify ? 'production' : 'development',
    comments: minify ? false : undefined,
    generatorOpts: {
      concise: true
    }
  };

  // start('modern');

  // modern = await babel.transformAsync(source, {
  //   configFile: false,
  //   babelrc: false,
  //   filename: file,
  //   inputSourceMap: map,
  //   sourceMaps: true,
  //   sourceFileName: file,
  //   sourceType: 'module',
  //   envName: 'modern',
  //   ast: true,
  //   presets: [
  //     // '@babel/preset-modules',
  //     // modernize && [
  //     //   'babel-preset-modernize',
  //     //   {
  //     //     loose: true,
  //     //     webpack: true,
  //     //   },
  //     // ],
  //   ].filter(Boolean),
  //   plugins: [],
  //   ...outputOptions,
  //   caller: {
  //     supportsStaticESM: true,
  //     name: NAME + '-modern',
  //   },
  // });
  // end('modern');

  // if (minify) {
  //   start('modern-minify');
  //   const minified = await terser.minify(modern.code, {
  //     // Enables shorthand properties in objects and object patterns:
  //     ecma: 2017,
  //     module: false,
  //     nameCache: TERSER_CACHE,
  //     // sourceMap: true,
  //     sourceMap: {
  //       content: toTerserMap(modern.map),
  //     },
  //     compress: {
  //       global_defs: {
  //         MODERN_MODE: true,
  //         'process.env.NODE_ENV': global.process.env.NODE_ENV || 'production',
  //       },
  //     },
  //     // Fix Safari 10 issues
  //     // ({a}) --> ({a:a})
  //     // !await a --> !(await a)
  //     safari10: true,
  //     mangle: {
  //       toplevel: true,
  //       // safari10: true
  //       // properties: {
  //       //   regex: /./
  //       // }
  //     },
  //   });

  //   modern.code = minified.code;
  //   modern.map = toBabelMap(minified.map);

  //   // @todo this means modern.ast is now out-of-sync with modern.code
  //   // can this work? or do we need to run Terser separately for modern/legacy?
  //   end('modern-minify');
  // }

  if (downlevel) {
    start('legacy');

    // simple and dangerous transformWebpackUrls
    const replacedSource = source.replace(
      /".chunk.js";/gm,
      '".chunk.legacy.js";'
    );

    legacy = await babel.transformAsync(replacedSource, {
      configFile: false,
      babelrc: false,
      filename: file,
      inputSourceMap: map,
      sourceMaps: true,
      sourceFileName: file,
      sourceType: 'module',
      envName: 'production',
      presets: [
        [
          '@babel/preset-env',
          {
            corejs: options.corejsVersion,
            useBuiltIns: 'entry',
            exclude: ['transform-typeof-symbol']
          }
        ]
      ],
      ...outputOptions,
      caller: {
        supportsStaticESM: false,
        name: NAME + '-legacy'
      }
    });
    end('legacy');
  }

  return {
    modern: { source, map },
    // modern: sanitizeResult(modern),
    // legacy: legacy && { source, map },
    legacy: legacy && sanitizeResult(legacy),
    polyfills: [],
    // polyfills: Array.from(polyfills),
    timings
  };
}

function sanitizeResult(result) {
  return { source: result.code, map: result.map };
}
