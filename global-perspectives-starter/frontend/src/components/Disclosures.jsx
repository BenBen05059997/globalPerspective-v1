import React from 'react';

function Disclosures() {
  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Disclosures</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>AI-Generated Content</h2>
        <p>
          Summaries and forecasts are produced by large language models. They may include outdated, biased,
          or incomplete interpretations of source material. Always consult the referenced articles before acting
          on the information provided.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Data Sources</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>Topic detection and AI analysis: xAI Grok using globally syndicated publishers and Brave Search.</li>
          <li>Geocoding and map layers: Google Maps Platform.</li>
        </ul>
        <p>
          None of the data displayed should be treated as official government information or financial advice.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Accuracy &amp; Bias</h2>
        <p>
          AI systems can mirror the limitations of their training data. Regions with limited media coverage may appear
          underrepresented. Feedback helps calibrate prompts and data sourcing strategies.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Subscription Terms</h2>
        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Plans &amp; Pricing</h3>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li><strong>Free</strong> — access to today's global topics and the interactive map. No account required.</li>
          <li><strong>Member ($15/month)</strong> — 7-day narrative archive, story arc intelligence, thread analysis, country briefings with AI-powered risk signals, and the weekly map with date playback.</li>
          <li><strong>Enterprise ($45/month)</strong> — everything in Member plus 30-day archive depth and priority data access.</li>
        </ul>
        <p>All paid plans are billed monthly through Stripe. Prices are in USD and exclude applicable taxes.</p>

        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Free Trial</h3>
        <p>No free trial is currently offered. You can explore all free-tier features before subscribing.</p>

        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Cancellation</h3>
        <p>
          You may cancel your subscription at any time from your Account page via the Stripe Customer Portal.
          Cancellation takes effect at the end of your current billing period — you retain access until then.
          No partial refunds are issued for unused time within a billing cycle.
        </p>

        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Refund Policy</h3>
        <p>
          Refunds are considered on a case-by-case basis within 7 days of a charge. To request a refund,
          email <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a> with
          your account email and the reason for the request. We aim to respond within 2 business days.
        </p>

        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Payment Processing</h3>
        <p>
          Payments are processed securely by <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">Stripe</a>.
          We do not store your credit card details. All payment data is handled directly by Stripe in accordance with
          PCI DSS Level 1 compliance standards.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Contact</h2>
        <p>
          For billing questions, account issues, or general inquiries:<br />
          Email: <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a>
        </p>
        <p>
          Business name: Global Perspectives
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>Affiliate Links &amp; Sponsorships</h2>
        <p>
          The project does not participate in affiliate programs and receives no compensation from the organizations
          mentioned. If that changes, the disclosure will be updated here.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
          Last updated: 2026-03-19
        </p>
      </section>
    </div>
  );
}

export default Disclosures;
