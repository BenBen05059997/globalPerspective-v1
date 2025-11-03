import React from 'react';

export default function Contact() {
  return (
    <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Get in Touch</h1>
      <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>
        We welcome feedback, collaboration ideas, and press inquiries. The fastest way to reach the
        Global Perspectives team is by email.
      </p>
      <div
        style={{
          backgroundColor: 'var(--surface-subtle)',
          borderRadius: '10px',
          padding: '1.25rem',
          margin: '1.5rem 0',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Email</h2>
        <a
          href="mailto:globalperspectives.app@gmail.com"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          globalperspectives.app@gmail.com
        </a>
      </div>
      <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
        Please include any relevant context so we can respond quickly. We aim to reply within two
        business days.
      </p>
      <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
        Prefer other channels? You can also reach us via the links in the site footer.
      </p>
    </div>
  );
}

