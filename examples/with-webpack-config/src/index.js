import './index.css';

async function F(page) {
  console.log('App');

  if (page === 'home') {
    import('./pages/home');
  }

  if (page === 'about') {
    import('./pages/about');
  }
}

F('home');

var H1 = document.createElement('h1');
H1.innerHTML = 'APP';

document.body.appendChild(H1);
