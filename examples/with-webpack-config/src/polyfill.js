import 'react-app-polyfill/ie9';

const H1 = document.createElement('h1');
H1.innerHTML = 'LEGACY';

document.body.appendChild(H1);
