import { Link } from 'react-router-dom';

export default function Contact() {
  return (
    <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Contact Us</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
        We'd love to hear from you — feedback, questions, partnership ideas, or just to say hello.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
        <div style={{ padding: '16px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>General Inquiries</div>
          <a href="mailto:globalperspectives.app@gmail.com" style={{ fontSize: '1rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
            globalperspectives.app@gmail.com
          </a>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Feedback, feature requests, bug reports, press inquiries
          </p>
        </div>

        <div style={{ padding: '16px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Account & Data</div>
          <a href="mailto:globalperspectives.app@gmail.com?subject=Account%20request" style={{ fontSize: '1rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
            globalperspectives.app@gmail.com
          </a>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Account deletion and data requests
          </p>
        </div>

        <div style={{ padding: '16px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>Partnerships</div>
          <a href="mailto:globalperspectives.app@gmail.com?subject=Partnership%20inquiry" style={{ fontSize: '1rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
            globalperspectives.app@gmail.com
          </a>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            API access, integrations, and partnerships
          </p>
        </div>
      </div>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        We aim to respond within 2 business days.
      </p>

      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #e5e7eb)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <Link to="/about" style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>About Us →</Link>
<Link to="/disclosures" style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Disclosures →</Link>
      </div>
    </div>
  );
}
