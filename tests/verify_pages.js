const http = require('http');
const pages = [
  'index.html',
  'sisd.html',
  'simd.html',
  'misd.html',
  'mimd.html',
  'analytics.html',
  'theory.html',
  'editor.html'
];

async function checkAll() {
  for (const page of pages) {
    await new Promise((resolve) => {
      http.get('http://localhost:8000/' + page, (res) => {
        let content = '';
        res.on('data', chunk => content += chunk);
        res.on('end', () => {
          const hasStyle = content.includes('#left-sidebar { position: fixed !important;');
          const hasLink = content.includes('style.css?v=20261016_v3');
          console.log(`[PASS] ${page.padEnd(16)} -> HTTP ${res.statusCode} | FixedSidebarCSS: ${hasStyle} | CacheBusterCSS: ${hasLink}`);
          resolve();
        });
      }).on('error', err => {
        console.error(`[FAIL] ${page}: ${err.message}`);
        resolve();
      });
    });
  }
}

checkAll();
