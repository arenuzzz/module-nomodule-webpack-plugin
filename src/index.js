/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
import path from 'path';
import util from 'util';
import { gzip } from 'zlib';
// import { promises as fs } from 'fs';
import * as defaultWebpack from 'webpack';
import { SourceMapSource, RawSource } from 'webpack-sources';
import { rollup } from 'rollup';
import commonjsPlugin from '@rollup/plugin-commonjs';
import nodeResolvePlugin from '@rollup/plugin-node-resolve';
// import rollupPluginTerserSimple from './lib/rollup-plugin-terser-simple';
// import rollupPluginStripComments from './lib/rollup-plugin-strip-comments';
import { getCorejsVersion, createPerformanceTimings } from './lib/util';
import { WorkerPool } from './lib/worker-pool';

import HtmlWebpackEsmodulesPlugin from './plugins/HtmlWebpackEsmodulesPlugin';

const NAME = 'OptimizePlugin';

const DEFAULT_OPTIONS = {
  /**
   * Number of Worker Threads to use for running Babel and Terser.
   * @default os.cpus().length // number of available CPUs
   */
  concurrency: undefined,

  /**
   * Produce Source Maps?
   * @default false
   */
  sourceMap: false,

  /**
   * Minify bundles using Terser?
   * @default false
   */
  minify: false,

  /**
   * Produce a set of bundles catering to older browsers alongside the default modern bundles.
   * @default true
   */
  downlevel: true,

  /**
   * Attempt to upgrade ES5 syntax to equivalent modern syntax.
   * @default false
   */
  modernize: false,

  /**
   * Show logs containing performance information and inlined polyfill.
   * @default false
   */
  verbose: false,

  /**
   * Path to your polyfills
   * @default undefined
   */
  polyfillsPath: undefined,

  /**
   * @default "/"
   */
  polyfillsOutputPath: '/',

  /**
   * RegExp patterns of assets to exclude
   * @default []
   */
  exclude: []
};

export default class OptimizePlugin {
  /**
   * @param {Partial<DEFAULT_OPTIONS>?} [options]
   */
  constructor(options, webpack = defaultWebpack, htmlWebpackPlugin) {
    this.webpack = webpack;
    this.htmlWebpackPlugin = htmlWebpackPlugin;
    this.options = Object.assign({}, options || {});
    for (const i in DEFAULT_OPTIONS) {
      if (this.options[i] == null) this.options[i] = DEFAULT_OPTIONS[i];
    }

    // const { concurrency } = options;
    // const workerPath = require.resolve('./worker');
    // if (concurrency === 0 || concurrency === false) {
    //   this.workerPool = new MockWorkerPool({ workerPath });
    // }
    // else {
    //   this.workerPool = new WorkerPool({ workerPath, concurrency });
    // }

    this.rollupCache = {
      modules: []
    };

    /** @type {Map<string, Promise<import('rollup').OutputChunk>>} */
    this.polyfillsCache = new Map();
  }

  isWebpack4() {
    return this.webpack.version[0] === '4';
  }

  isWebpack5() {
    return this.webpack.version[0] === '5';
  }

  serializeOptions() {
    return (
      this._serialized || (this._serialized = JSON.stringify(this.options))
    );
  }

  async optimize(compiler, compilation, chunkFiles) {
    const cwd = compiler.context;
    const { timings, start, end } = createPerformanceTimings();

    const options = {
      corejsVersion: getCorejsVersion(),
      minify: this.options.minify,
      downlevel: this.options.downlevel,
      modernize: this.options.modernize,
      timings: this.options.verbose
    };

    const processing = new WeakMap();
    const chunkAssets = Array.from(compilation.additionalChunkAssets || []);

    const files = [...chunkFiles, ...chunkAssets].filter((asset) => {
      for (const pattern of this.options.exclude) {
        if (pattern.test(asset)) {
          return false;
        }
      }
      return true;
    });

    start('Optimize Assets');
    let transformed;
    try {
      transformed = await Promise.all(
        files.map(async (file) => {
          // ignore non-JS files
          if (!file.match(/\.m?[jt]sx?$/i)) return undefined;
          const asset = compilation.assets[file];
          let pending = processing.get(asset);
          if (pending) return pending;

          let source, map;
          if (this.options.sourceMap && asset.sourceAndMap) {
            ({ source, map } = asset.sourceAndMap());
          } else {
            source = asset.source();
          }

          const original = {
            file,
            source,
            map,
            options
          };

          // // @ts-ignore-next
          const result = this.workerPool.enqueue(original);
          pending = result
            .then(this.buildResultSources.bind(this, original))
            .catch(console.error);
          processing.set(asset, pending);

          const t = ` └ ${file}`;
          start(t);
          result.then((r) => {
            for (const entry of r.timings) {
              // entry.name = '    ' + entry.name;
              entry.depth = 2;
              timings.push(entry);
            }
            end(t);
          });

          return pending;
        })
      );
    } catch (e) {
      console.log('errored out during transformation ', e);
      throw e;
    }

    end('Optimize Assets');

    const allPolyfills = new Set();
    const polyfillReasons = new Map();

    transformed
      .filter(Boolean)
      .forEach(
        ({ file, modern, legacyFile, legacy, polyfills: coreJsPolyfills }) => {
          const polyfills = [
            ...coreJsPolyfills,
            this.options.polyfillsPath
          ].filter(Boolean);

          for (const p of polyfills) {
            allPolyfills.add(p);
            let reasons = polyfillReasons.get(p);
            if (!reasons) polyfillReasons.set(p, (reasons = []));
            reasons.push(legacyFile);
          }

          compilation.assets[file] = modern;

          if (legacy) {
            compilation.assets[legacyFile] = legacy;
          }
        }
      );

    const polyfills = Array.from(allPolyfills);

    let polyfillsAsset;

    if (polyfills.length) {
      start('Bundle Polyfills');
      const chunk = await this.generatePolyfillsChunkCached(
        polyfills,
        cwd,
        timings,
        this.options.polyfillsOutputPath
      );

      polyfillsAsset = chunk.asset;

      compilation.assets[chunk.fileName] = chunk.asset;
      end('Bundle Polyfills');
    }

    timings.sort((t1, t2) => t1.start - t2.start);
    if (this.options.verbose) {
      await this.showOutputSummary(
        timings,
        polyfills,
        polyfillReasons,
        polyfillsAsset
      );
    }
  }

  async generatePolyfillsChunkCached(polyfills, cwd, timings, publicPath) {
    const polyfillsKey = polyfills.join('\n');

    let generatePolyfills = this.polyfillsCache.get(polyfillsKey);
    if (!generatePolyfills) {
      generatePolyfills = this.generatePolyfillsChunk(polyfills, cwd, timings);
      this.polyfillsCache.set(polyfillsKey, generatePolyfills);
    }

    const output = await generatePolyfills;

    const fileName = path.join(publicPath, output.fileName);

    return {
      fileName,
      asset: new SourceMapSource(
        output.code,
        fileName,
        // @ts-ignore
        output.map
      )
    };
  }

  /**
   * @todo Write cached polyfills chunk to disk
   */
  async generatePolyfillsChunk(polyfills, cwd, timings) {
    // const ENTRY = '\0entry';

    // const entryContent = polyfills.reduce(
    //   (str, p) => `${str}\nimport "${p.replace('.js', '')}";`,
    //   ''
    // );

    // const COREJS = require
    //   .resolve('core-js/package.json')
    //   .replace('package.json', '');
    // const isCoreJsPath = /(?:^|\/)core-js\/(.+)$/;
    // const nonCoreJsPolyfills = polyfills.filter(
    //   (p) => !/(core-js|regenerator-runtime)/.test(p)
    // );

    // if (timings && nonCoreJsPolyfills.length) {
    //   console.log(
    //     `  Bundling ${nonCoreJsPolyfills.length} unrecognized polyfills.`
    //   );
    // }

    const polyfillsBundle = await rollup({
      // cache: this.rollupCache,
      context: 'window',

      // perf: !!timings,
      input: polyfills,
      treeshake: {
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        unknownGlobalSideEffects: false
      },
      plugins: [
        // {
        //   name: 'entry',
        //   resolveId: (id) => (id === ENTRY ? id : null),
        //   load: (id) => (id === ENTRY ? entryContent : null),
        // },
        // {
        //   name: 'core-js',
        //   resolveId(id) {
        //     if (/^regenerator-runtime(\/|$)/.test(id)) {
        //       return require.resolve('regenerator-runtime/runtime');
        //     }
        //     const m = id.match(isCoreJsPath);
        //     if (m && !/\.js$/.test(id)) {
        //       return COREJS + m[1] + '.js';
        //     }
        //     return null;
        //   },
        // load(id) {
        //   const m = id.match(isCoreJsPath);
        //   if (m && id.indexOf('?') === -1) {
        //     return fs.readFile(COREJS + m[1], 'utf-8');
        //   }
        //   return null;
        // },
        // },
        // coreJsPlugin(),
        commonjsPlugin({
          // ignoreGlobal: true,
          sourceMap: false
        }),
        // nonCoreJsPolyfills.length &&
        nodeResolvePlugin({
          browser: true
          // dedupe: nonCoreJsPolyfills,
          // only: nonCoreJsPolyfills,
          // preferBuiltins: false,
        }),
        {
          name: 'babel',
          renderChunk(source) {
            return require('@babel/core').transformAsync(source, {
              sourceMaps: true,
              // minified: true,
              shouldPrintComment: () => false,
              presets: [
                [
                  require('@babel/preset-env'),
                  {
                    corejs: getCorejsVersion(),
                    useBuiltIns: 'entry',
                    exclude: ['transform-typeof-symbol']
                  }
                ]
              ]
            });
          }
        }
        // this.options.minify
        //   ? rollupPluginTerserSimple()
        //   : rollupPluginStripComments(),
      ].filter(Boolean)
    });
    // this.setRollupCache(polyfillsBundle.cache);

    const result = await polyfillsBundle.generate({
      entryFileNames: 'polyfills.[hash].js',
      exports: 'none',
      externalLiveBindings: false,
      freeze: false,
      compact: true,
      format: 'iife',
      sourcemap: false,
      strict: false
    });

    const output = result.output[0];

    // If verbose logging is enabled, bubble up some useful Rollup time information
    // if (timings) {
    //   const times = polyfillsBundle.getTimings();
    //   const add = (name, timing) => {
    //     const t = times[timing];
    //     if (t) timings.push({ depth: 2, name, duration: t[0] });
    //   };
    //   add('parse', '## parse modules');
    //   add('node-resolve', '- plugin 2 (node-resolve) - resolveId (async)');
    //   add('generate', '# GENERATE');
    // }

    return output;
  }

  // yes I did this to fix TS inference
  setRollupCache(cache) {
    this.rollupCache = cache;
  }

  /** @todo move to helper file */
  async showOutputSummary(timings, polyfills, polyfillReasons, polyfillsAsset) {
    let totalTime = 0;
    let timingsStr = '';
    for (const entry of timings) {
      totalTime += entry.duration;
      // timingsStr += `\n  ${('      ' + (entry.duration || '- ')).substr(-6)}ms: ${entry.name}`;
      timingsStr += `\n  ${new Array(entry.depth || 1).join('      ')}${String(
        entry.duration | 0 || '- '
      ).padStart(6, ' ')}ms: ${entry.name}`;
    }

    polyfills = polyfills.map((polyfill) => {
      const reasons = polyfillReasons.get(polyfill);
      return { polyfill, reasons, reasonsKey: reasons.join('\n') };
    });
    polyfills.sort((p1, p2) => p1.reasonsKey.localeCompare(p2.reasonsKey));

    const serializeReasons = (reasons) => {
      if (reasons.length === 1) return reasons[0];
      if (reasons.length > 3) {
        return `${reasons[0]}, ${reasons[1]} and ${reasons.length - 2} others`;
      }
      reasons = reasons.slice();
      const last = reasons.pop();
      return reasons.join(', ') + ' and ' + last;
    };

    let lastReasonsKey;
    let polyfillsStr = polyfills.reduce(
      (str, { polyfill, reasons, reasonsKey }) => {
        if (reasonsKey !== lastReasonsKey) {
          str = str.replace(/├.*?$/, '└');
          str += `\n└ Used by ${serializeReasons(reasons)}:`;
          lastReasonsKey = reasonsKey;
        }
        str += `\n  ├ ${polyfill}`;
        return str;
      },
      ''
    );
    polyfillsStr = polyfillsStr.replace(/├(.*?)$/, '└$1');

    const preamble = `[${NAME}] Completed in ${
      totalTime | 0
    }ms.${timingsStr}\n`;

    if (!polyfillsAsset) {
      console.log(preamble + 'No polyfills bundle was created.');
      return;
    }

    const polyfillsSize = polyfillsAsset
      ? (await util.promisify(gzip)(polyfillsAsset.source())).byteLength
      : 0;
    const polyfillsSizeStr = (polyfillsSize / 1000).toPrecision(3) + 'kB';

    console.log(
      preamble +
        `${polyfillsAsset._name} is ${polyfillsSizeStr} and bundles ${polyfills.length} polyfills:${polyfillsStr}`
    );
  }

  toFilename(file, variant) {
    let out = file.replace(/(\.m?[jt]sx?)$/g, `.${variant}$1`);

    if (out === file) {
      out += `.${variant}.js`;
    }

    return out;
  }

  buildResultSources(original, result) {
    const file = original.file;
    const modernFile = file;
    const modern = this.buildFile(original, result.modern, modernFile);
    let legacy, legacyFile;
    if (result.legacy) {
      legacyFile = this.toFilename(file, 'legacy');
      legacy = this.buildFile(original, result.legacy, legacyFile);
    }

    return {
      original,
      file,
      legacyFile,
      modern,
      legacy,
      polyfills: result.polyfills
    };
  }

  buildFile(original, result, name) {
    if (result.map) {
      return new SourceMapSource(
        result.source,
        name || original.file,
        result.map,
        original.source,
        original.map
      );
    }
    // @todo use LineToLineMappedSource as the fallback?
    return new RawSource(result.source);
  }

  // modify chunkHash (webpack 4 & 5)
  updateChunkHash(compilation) {
    const updateWithHash = (chunk, hash) => {
      hash.update(NAME);
      hash.update(this.serializeOptions());
    };

    if (this.isWebpack4()) {
      compilation.mainTemplate.hooks.hashForChunk.tap(
        NAME,
        updateWithHash.bind(null, null)
      );
      compilation.chunkTemplate.hooks.hashForChunk.tap(
        NAME,
        updateWithHash.bind(null, null)
      );
    } else {
      // @ts-ignore
      this.webpack.javascript.JavascriptModulesPlugin.getCompilationHooks(
        compilation
      ).chunkHash.tap(NAME, updateWithHash);
    }
  }

  apply(compiler) {
    this.workerPool = new WorkerPool({
      workerPath: require.resolve('./worker'),
      concurrency: this.options.concurrency
    });

    compiler.hooks.compilation.tap(NAME, (compilation) => {
      if (this.isWebpack5()) {
        compilation.hooks.processAssets.tapPromise(
          {
            name: NAME,
            stage: this.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE
          },
          (assets) => {
            const chunkFiles = Object.keys(assets);
            return this.optimize(compiler, compilation, chunkFiles);
          }
        );
      } else {
        compilation.hooks.optimizeChunkAssets.tapPromise(NAME, (chunks) => {
          const chunkFiles = Array.from(chunks).reduce(
            (acc, chunk) => acc.concat(Array.from(chunk.files || [])),
            []
          );
          return this.optimize(compiler, compilation, chunkFiles);
        });
      }
    });

    new HtmlWebpackEsmodulesPlugin(
      this.options.downlevel,
      this.webpack,
      this.htmlWebpackPlugin
    ).apply(compiler);
  }
}
