export const loadScript =
  'function $f(e,n,o,t,r,i){for(r=0,i=(s=(t=("noModule"in HTMLScriptElement.prototype))?e:n).length;r<i;r++)(o=document.createElement("script")).src=s[r],t?(o.type="module",o.crossOrigin="anonymous"):o.async=!1,document.head.appendChild(o)}';

export const makeLoadScript = (modernScripts, legacyScripts) => `
  addEventListener('DOMContentLoaded', function() {
    ${loadScript}
    ${`$f(${JSON.stringify(modernScripts)},${JSON.stringify(legacyScripts)})`}
  })
`;
