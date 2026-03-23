import { useState } from 'react';

const IconLink = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconShare = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const IconLinkedIn = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

function buildPreviewParams(p) {
  if (!p) return '';
  const sp = new URLSearchParams();
  if (p.t) sp.set('t', p.t.slice(0, 80));
  if (p.h) sp.set('h', p.h.slice(0, 100));
  if (p.n) sp.set('n', String(p.n));
  if (p.d) sp.set('d', String(p.d));
  if (p.r?.length) sp.set('r', p.r.slice(0, 3).join(','));
  if (p.c) sp.set('c', p.c);
  return sp.toString();
}

const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

export default function ShareButtons({ path, title, threadId, preview }) {
  const [copied, setCopied] = useState(false);
  const linkPath = path || (threadId ? `/weekly/thread/${threadId}` : '/');
  const baseUrl = `${window.location.origin}${linkPath}`;
  const previewQs = buildPreviewParams(preview);
  const url = previewQs ? `${baseUrl}?${previewQs}` : baseUrl;
  const shareTitle = title || 'Global Perspectives';

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: shareTitle,
        text: `${shareTitle} — Global Perspectives`,
        url,
      });
    } catch {
      // User cancelled or share failed — ignore
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareTitle + ' — Global Perspectives')}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="share-buttons">
      <span className="share-buttons-label">Share</span>
      <button className={`share-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy link">
        {copied ? <IconCheck /> : <IconLink />}
      </button>
      {canNativeShare && (
        <button className="share-btn share" onClick={handleNativeShare} title="Share">
          <IconShare />
        </button>
      )}
      <a className="share-btn x" href={twitterUrl} target="_blank" rel="noopener noreferrer" title="Share on X / Twitter">
        <IconX />
      </a>
      <a className="share-btn linkedin" href={linkedInUrl} target="_blank" rel="noopener noreferrer" title="Share on LinkedIn">
        <IconLinkedIn />
      </a>
    </div>
  );
}
