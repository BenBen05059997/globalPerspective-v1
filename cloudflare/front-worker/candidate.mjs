import baseline from './baseline/worker2.mjs';

const CANDIDATE_HOST = 'next.globalperspective.net';
const NOINDEX = 'noindex';

function withNoindex(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', NOINDEX);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isBlogPath(pathname) {
  return pathname === '/blog' || pathname.startsWith('/blog/');
}

function candidateError() {
  return new Response('Candidate Worker error', {
    status: 502,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': NOINDEX,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Preserve the deployed Worker exactly for every non-candidate hostname.
    if (url.hostname !== CANDIDATE_HOST) {
      return baseline.fetch(request, env, ctx);
    }

    try {
      // The current front Worker sends extensionless paths to the SPA shell.
      // On this one candidate host, let the existing origin serve the static blog.
      if (isBlogPath(url.pathname) && (request.method === 'GET' || request.method === 'HEAD')) {
        return withNoindex(await fetch(request));
      }

      // Apply noindex at the outermost layer, including directly generated bot HTML,
      // data errors, shell responses, and any other response from the baseline.
      return withNoindex(await baseline.fetch(request, env, ctx));
    } catch (_error) {
      return candidateError();
    }
  },
};
