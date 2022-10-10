import DefaultHtmlWebpackPlugin from 'html-webpack-plugin';
import * as defaultWebpack from 'webpack';
import { NAME } from './constants';
import { makeLoadScript } from './utils';

export default class HtmlWebpackEsmodulesPlugin {
  constructor(
    legacy = true,
    webpack = defaultWebpack,
    htmlWebpackPlugin = DefaultHtmlWebpackPlugin
  ) {
    this.legacy = legacy;
    this.webpack = webpack;
    this.htmlWebpackPlugin = htmlWebpackPlugin;
    this._isWebpack5 = this.webpack.version[0] === '5';
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(NAME, (compilation) => {
      // Support newest and oldest version.
      if (this.htmlWebpackPlugin.getHooks) {
        this.htmlWebpackPlugin
          .getHooks(compilation)
          .alterAssetTagGroups.tapAsync(
            {
              name: NAME,
              stage: Infinity,
            },
            this.alterAssetTagGroups.bind(this, compilation)
          );
      } else {
        compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(
          { name: NAME, stage: Infinity },
          this.alterAssetTagGroups.bind(this, compilation)
        );
      }
    });
  }

  alterAssetTagGroups(
    compilation,
    { plugin, bodyTags: body, headTags: head, ...rest },
    cb
  ) {
    // Older webpack compat
    if (!body) body = rest.body;
    if (!head) head = rest.head;

    if (this.legacy) {
      const assets = Object.keys(compilation.assets);

      const legacyMainSrc = assets.find(
        (src) => src.includes('main') && src.includes('legacy.js')
      );

      // if (!legacyMainSrc) {
      //   throw new Error('Legacy script is unavailable');
      // }

      const polyfillSrc = assets.find((src) =>
        src.includes('polyfills.legacy')
      );

      if (polyfillSrc) {
        head.unshift({
          tagName: 'script',
          voidTag: false,
          meta: { plugin: 'html-webpack-plugin' },
          attributes: {
            type: 'nomodule',
            src: polyfillSrc,
          },
        });
      }

      head.push({
        tagName: 'script',
        voidTag: false,
        meta: { plugin: 'html-webpack-plugin' },
        attributes: {
          type: 'nomodule',
          src: legacyMainSrc,
        },
      });

      this.downloadEfficient(head);
    }

    cb();
  }

  downloadEfficient(head) {
    const legacyScriptsSrc = head
      .filter(
        (tag) => tag.tagName === 'script' && tag.attributes.type === 'nomodule'
      )
      .map((script) => script.attributes.src);

    const modernScriptsSrc = head
      .filter(
        (tag) => tag.tagName === 'script' && tag.attributes.type !== 'nomodule'
      )
      .map((script) => script.attributes.src);

    head
      .filter((tag) => tag.tagName === 'script')
      .forEach((s) => head.splice(head.indexOf(s), 1));

    modernScriptsSrc.forEach((href) =>
      head.push({
        tagName: 'link',
        attributes: { rel: 'modulepreload', href },
        voidTag: true,
      })
    );

    const loadScript = makeLoadScript(modernScriptsSrc, legacyScriptsSrc);

    head.push({ tagName: 'script', innerHTML: loadScript, voidTag: false });
  }
}
