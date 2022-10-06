// export const loadScript =
//   'function $l(e,d,c){c=document.createElement("script"),"noModule" in c?(e && (c.src=e,c.type="module",c.crossOrigin="anonymous")):d && (c.src=d,c.async=true),c.src && document.head.appendChild(c)}';
export const safariFixScript =
  "(function(){var d=document;var c=d.createElement('script');if(!('noModule' in c)&&'onbeforeload' in c){var s=!1;d.addEventListener('beforeload',function(e){if(e.target===c){s=!0}else if(!e.target.hasAttribute('nomodule')||!s){return}e.preventDefault()},!0);c.type='module';c.src='.';d.head.appendChild(c);c.remove()}}())";
export const ID = 'html-webpack-esmodules-plugin';
export const OUTPUT_MODES = {
  EFFICIENT: 'efficient',
  MINIMAL: 'minimal',
};

export const loadScript =
  'function $f(e,n,o,t,r,i){for(r=0,i=(s=(t=("noModule"in HTMLScriptElement.prototype))?e:n).length;r<i;r++)(o=document.createElement("script")).src=s[r],t?(o.type="module",o.crossOrigin="anonymous"):o.async=!1,document.head.appendChild(o)}';
