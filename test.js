const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const {
  createRouteTracker,
  decodePlayerRoute,
  toProtocolUrl
} = require('./stremio-mpv-extension/content.js');

function playerRoute(streamUrl, compression = 'deflate') {
  const json = JSON.stringify({ url: streamUrl });
  const bytes = compression === 'gzip' ? zlib.gzipSync(json) : zlib.deflateSync(json);
  return `#/player/${encodeURIComponent(bytes.toString('base64'))}`;
}

async function run() {
  const streamUrl = 'https://example.com/video?q=two+plays&token=✓';

  const routeWithMetadata = `${playerRoute(streamUrl)}/https%3A%2F%2Fexample.com%2Fmeta`;
  assert.equal(await decodePlayerRoute(routeWithMetadata), streamUrl);
  assert.equal(await decodePlayerRoute(playerRoute(streamUrl, 'gzip')), streamUrl);
  console.log('PASS: real deflate/gzip routes decode without consuming appended metadata');

  const routes = createRouteTracker('#/detail/movie-one');
  assert.deepEqual(routes.inspect(playerRoute('https://example.com/one')), {
    playerRoute: playerRoute('https://example.com/one'),
    restoreHash: '#/detail/movie-one'
  });
  routes.inspect('#/detail/movie-two');
  assert.deepEqual(routes.inspect(playerRoute('https://example.com/two')), {
    playerRoute: playerRoute('https://example.com/two'),
    restoreHash: '#/detail/movie-two'
  });
  console.log('PASS: consecutive player routes restore the correct non-player page');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'stremio-mpv-test-'));
  const captureFile = path.join(temporaryDirectory, 'captured-url');
  const fakeMpv = path.join(temporaryDirectory, 'mpv');
  fs.writeFileSync(fakeMpv, '#!/bin/sh\n[ "$1" = "--force-window=immediate" ] || exit 9\n[ "$2" = "--" ] || exit 9\nprintf \'%s\' "$3" > "$CAPTURE_FILE"\n');
  fs.chmodSync(fakeMpv, 0o755);

  try {
    childProcess.execFileSync(path.join(__dirname, 'open-mpv.sh'), [toProtocolUrl(streamUrl)], {
      env: {
        ...process.env,
        CAPTURE_FILE: captureFile,
        PATH: `${temporaryDirectory}:/usr/bin:/bin`
      }
    });
    assert.equal(fs.readFileSync(captureFile, 'utf8'), streamUrl);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  console.log('PASS: browser protocol round-trip launches mpv with one exact URL argument');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
