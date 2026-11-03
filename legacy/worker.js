import transfer from '../web/src/storage-transfer.js';

const destination = 'https://tiny.leisiyu.dev/p/uoft';
const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/planner' && url.searchParams.get('export') === '1') {
      const script = transfer.replaceAll('</script', '<\\/script');
      return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Moving your planner</title></head><body><p id="status">Moving your planner…</p><script type="module">${script}
try { await redirectWithTransfer(localStorage, window.location); }
catch { document.getElementById('status').textContent = 'Unable to move your planner. Please try again.'; }
</script></body></html>`, {
        headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new Response(null, {
      status: 301,
      headers: { ...headers, Location: `${destination}${url.pathname === '/' ? '/' : url.pathname}${url.search}` },
    });
  },
};
