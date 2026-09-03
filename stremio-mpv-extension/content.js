(function(global) {
  'use strict';

  const PLAYER_ROUTE = '#/player/';
  const EXTERNAL_PLAYER = /^(?:vlc|mpv|iina|outplayer):\/\/(.*)$/i;

  function extractPayload(route) {
    const markerIndex = route.indexOf(PLAYER_ROUTE);
    if (markerIndex === -1) return null;

    const encodedPayload = route.slice(markerIndex + PLAYER_ROUTE.length);
    if (!encodedPayload) return null;

    try {
      const decoded = decodeURIComponent(encodedPayload);
      const metadataIndex = decoded.search(/\/(?:https?|file):\/\//i);
      return metadataIndex === -1 ? decoded : decoded.slice(0, metadataIndex);
    } catch (error) {
      console.error('[Stremio mpv] Invalid player route', error);
      return null;
    }
  }

  async function decompress(bytes, format) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Response(stream).text();
  }

  async function decodePlayerRoute(route) {
    const payload = extractPayload(route);
    if (!payload) return null;

    try {
      const binary = atob(payload);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

      for (const format of ['deflate', 'gzip']) {
        try {
          const value = JSON.parse(await decompress(bytes, format));
          if (typeof value.url === 'string' && value.url) return value.url;
        } catch (error) {
          if (format === 'gzip') throw error;
        }
      }
    } catch (error) {
      console.error('[Stremio mpv] Could not decode stream URL', error);
    }

    return null;
  }

  function toProtocolUrl(streamUrl) {
    const bytes = new TextEncoder().encode(streamUrl);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);

    const payload = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `celluloid://${payload}`;
  }

  function createRouteTracker(initialHash) {
    let lastSafeHash = initialHash && !initialHash.includes(PLAYER_ROUTE) ? initialHash : '#/';

    return {
      inspect(hash) {
        if (hash && hash.includes(PLAYER_ROUTE)) {
          return { playerRoute: hash, restoreHash: lastSafeHash };
        }

        lastSafeHash = hash || '#/';
        return { playerRoute: null, restoreHash: lastSafeHash };
      }
    };
  }

  function externalStreamUrl(href) {
    const match = href.match(EXTERNAL_PLAYER);
    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      return match[1];
    }
  }

  const api = { createRouteTracker, decodePlayerRoute, externalStreamUrl, toProtocolUrl };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  const routeTracker = createRouteTracker(global.location.hash);

  function openInMpv(streamUrl) {
    if (!streamUrl) return;
    console.info('[Stremio mpv] Opening stream in mpv');
    global.location.href = toProtocolUrl(streamUrl);
  }

  async function openPlayerRoute(route) {
    const streamUrl = await decodePlayerRoute(route);
    if (streamUrl) openInMpv(streamUrl);
  }

  global.addEventListener('click', (event) => {
    const element = event.target instanceof Element ? event.target : event.target.parentElement;
    const anchor = element && element.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href') || anchor.href;
    const externalUrl = externalStreamUrl(href);
    if (externalUrl) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openInMpv(externalUrl);
      return;
    }

    if (href.includes(PLAYER_ROUTE)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void openPlayerRoute(href);
    }
  }, true);

  function handleHashChange() {
    const route = routeTracker.inspect(global.location.hash);
    if (!route.playerRoute) return;

    // Restore the non-player route immediately. Because this listener is loaded at
    // document_start, Stremio sees the restored route instead of starting its web player.
    global.location.replace(route.restoreHash);
    void openPlayerRoute(route.playerRoute);
  }

  global.addEventListener('hashchange', handleHashChange);
  handleHashChange();
})(globalThis);
