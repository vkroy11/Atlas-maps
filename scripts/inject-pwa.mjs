/**
 * Post-build PWA injector.
 *
 * Expo Web's `web.output: "single"` mode generates dist/index.html from a
 * fixed template — there's no supported hook for adding meta tags, the
 * manifest link, or a service-worker registration script. This runs after
 * `expo export --platform web` and rewrites that one file in place.
 *
 * Idempotent: detects the marker comment and skips if already injected.
 *
 * Run:  node scripts/inject-pwa.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(here, '..', 'dist', 'index.html');

const MARKER = '<!-- atlas-pwa-injected -->';

const HEAD_INSERT = `${MARKER}
    <meta name="theme-color" content="#0a0f0d" />
    <meta name="description" content="Offline-first tactical mapping for Delhi NCR." />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Atlas" />
    <style>html,body,#root{background-color:#0a0f0d;}</style>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').then(function (reg) {
            if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
            reg.addEventListener('updatefound', function () {
              var sw = reg.installing;
              if (!sw) return;
              sw.addEventListener('statechange', function () {
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                  sw.postMessage('SKIP_WAITING');
                }
              });
            });
          }).catch(function (err) { console.warn('SW registration failed:', err); });
        });
      }
    </script>`;

async function main() {
  const html = await readFile(indexPath, 'utf-8');

  if (html.includes(MARKER)) {
    console.log('✓ PWA already injected — skipping');
    return;
  }

  const out = html.replace('</head>', `    ${HEAD_INSERT}\n  </head>`);

  if (out === html) {
    throw new Error('Could not find </head> in dist/index.html — refusing to overwrite');
  }

  await writeFile(indexPath, out, 'utf-8');
  console.log('✓ PWA snippets injected into dist/index.html');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
