import { NAME } from './constants';
import { makeLoadScript } from './utils';

export default class HtmlWebpackEsmodulesPlugin {
  constructor(webpack) {
    this.webpack = webpack;

    this._isWebpack5 = webpack.version[0] === '5';
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(NAME, (compilation) => {
      // Support newest and oldest version.
      if (this.HtmlWebpackPlugin.getHooks) {
        this.HtmlWebpackPlugin.getHooks(
          compilation
        ).alterAssetTagGroups.tapAsync(
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

    const assets = Object.keys(compilation.assets);

    const modernMainSrc = assets.find(
      (src) => src.includes('main') && src.includes('modern.js')
    );

    const polyfillSrc = assets.find((src) => src.includes('polyfills.legacy'));

    if (modernMainSrc) {
      head.push({
        tagName: 'script',
        voidTag: false,
        meta: { plugin: 'html-webpack-plugin' },
        attributes: {
          defer: true,
          type: 'module',
          src: modernMainSrc,
        },
      });
    } else {
      throw new Error('Modern script is unavailable');
    }

    if (polyfillSrc) {
      head.unshift({
        tagName: 'script',
        voidTag: false,
        meta: { plugin: 'html-webpack-plugin' },
        attributes: {
          defer: true,
          src: polyfillSrc,
        },
      });
    }

    this.downloadEfficient2(head);

    cb();
  }

  downloadEfficient(head) {
    const legacyScriptsSrc = head
      .filter(
        (tag) => tag.tagName === 'script' && tag.attributes.type !== 'module'
      )
      .map((script) => script.attributes.src);

    const modernScriptsSrc = head
      .filter(
        (tag) => tag.tagName === 'script' && tag.attributes.type === 'module'
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
