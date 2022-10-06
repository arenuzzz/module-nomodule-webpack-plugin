import { loadScript } from './constants';

export const makeLoadScript = (modern, legacy) => `
  addEventListener('DOMContentLoaded', function() {
    ${loadScript}
    ${`$f(${JSON.stringify(modern)},${JSON.stringify(legacy)})`}
  })
`;
