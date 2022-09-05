import { loadScript } from './constants';

export const makeLoadScript = (modern, legacy) => `
addEventListener('DOMContentLoaded', function() {
  ${loadScript}
  ${(modern.length > legacy.length ? modern : legacy)
    .reduce(
      (acc, _m, i) => `
${acc}$l(${modern[i] ? `"${modern[i].attributes.src}"` : undefined}, ${
        legacy[i] ? `"${legacy[i].attributes.src}"` : undefined
      })
  `,
      ''
    )
    .trim()}
})
`;
