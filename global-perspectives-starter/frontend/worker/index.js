const PRODUCTION_HOSTS = new Set([
  'globalperspective.net',
  'www.globalperspective.net',
]);

const SHELL_PATH = '/index.html';
const LONG_CACHE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'public, max-age=0, must-revalidate';
const NO_STORE = 'no-store';
const HASHED_ASSET = /-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;
const ASSET_EXTENSION = /\.[A-Za-z0-9]{1,12}$/;

function isProductionHost(hostname) {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

function isHtmlNavigation(request) {
  return /(?:^|,)\s*text\/html(?:\s*;|\s*,|$)/i.test(
    request.headers.get('Accept') || '',
  );
}

function isReservedEndpoint(pathname) {
  return (
    pathname === '/rss' ||
    pathname === '/rss/' ||
    pathname === '/data' ||
    pathname.startsWith('/data/')
  );
}

function isMissingAssetPath(pathname) {
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return (
    pathname.startsWith('/assets/') ||
    pathname === '/favicon.ico' ||
    ASSET_EXTENSION.test(lastSegment)
  );
}

function rewrittenRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

function withSiteHeaders(response, request, pathname) {
  const headers = new Headers(response.headers);
  const production = isProductionHost(new URL(request.url).hostname);

  if (production) {
    headers.delete('X-Robots-Tag');
  } else {
    headers.set('X-Robots-Tag', 'noindex');
  }

  if (response.status >= 400) {
    headers.set('Cache-Control', NO_STORE);
  } else if (
    pathname === '/config.js' ||
    response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
  ) {
    headers.set('Cache-Control', REVALIDATE);
  } else if (
    (response.status < 300 || response.status === 304) &&
    pathname.startsWith('/assets/') &&
    HASHED_ASSET.test(pathname)
  ) {
    headers.set('Cache-Control', LONG_CACHE);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFound(request, pathname) {
  return withSiteHeaders(
    new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': NO_STORE,
      },
    }),
    request,
    pathname,
  );
}

function redirectTo(pathname, request) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return withSiteHeaders(
    new Response(null, {
      status: 308,
      headers: {
        Location: url.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    }),
    request,
    new URL(request.url).pathname,
  );
}

async function fetchAsset(request, env, pathname) {
  const assetRequest = pathname === new URL(request.url).pathname
    ? request
    : rewrittenRequest(request, pathname);
  try {
    const response = await env.ASSETS.fetch(assetRequest);
    return withSiteHeaders(response, request, pathname);
  } catch {
    return withSiteHeaders(
      new Response('Site asset unavailable', {
        status: 502,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': NO_STORE,
        },
      }),
      request,
      pathname,
    );
  }
}

function blogAssetPath(pathname) {
  if (pathname === '/blog/' || pathname === '/blog') {
    return '/blog/index.html';
  }
  if (pathname.startsWith('/blog/') && pathname.endsWith('/')) {
    return `${pathname}index.html`;
  }
  return pathname;
}

async function serve(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return withSiteHeaders(
      new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD', 'Cache-Control': NO_STORE },
      }),
      request,
      pathname,
    );
  }

  if (isReservedEndpoint(pathname)) {
    return notFound(request, pathname);
  }

  if (pathname === '/') {
    return fetchAsset(request, env, SHELL_PATH);
  }

  if (pathname === '/blog') {
    return redirectTo('/blog/', request);
  }

  if (pathname.startsWith('/blog/')) {
    const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
    if (!pathname.endsWith('/') && !ASSET_EXTENSION.test(lastSegment)) {
      return redirectTo(`${pathname}/`, request);
    }

    return fetchAsset(request, env, blogAssetPath(pathname));
  }

  if (pathname === SHELL_PATH) {
    // `html_handling: "none"` keeps this internal origin request at a direct 200.
    return fetchAsset(request, env, SHELL_PATH);
  }

  const asset = await fetchAsset(request, env, pathname);
  if (asset.status !== 404) {
    return asset;
  }

  if (
    !isMissingAssetPath(pathname) &&
    isHtmlNavigation(request)
  ) {
    return fetchAsset(request, env, SHELL_PATH);
  }

  return asset;
}

export default {
  fetch(request, env) {
    return serve(request, env);
  },
};
