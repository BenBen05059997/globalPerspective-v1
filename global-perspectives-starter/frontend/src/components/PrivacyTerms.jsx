import React from 'react';

function PrivacyTerms() {
  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Privacy &amp; Terms</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Overview</h2>
        <p>
          Global Perspectives is an AI-powered global news intelligence platform. Core content (today's topics and the
          interactive map) is freely accessible without an account. Premium features (weekly narrative analysis, country
          intelligence, thread tracking) require a signed-in account and a paid subscription.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Data Collection</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>
            The application stores cached data (topics, archive, preferences) in your browser via <code>localStorage</code>.
          </li>
          <li>
            <strong>Account creation:</strong> If you sign in, we collect your email address via Firebase Authentication
            (passwordless magic link). Your email is used solely for authentication and account identification.
            We do not sell or share your email with third parties.
          </li>
          <li>
            <strong>Payment data:</strong> If you subscribe to a paid plan, payment is processed securely by Stripe.
            We do not store your credit card details. All payment data is handled directly by Stripe in accordance with
            PCI DSS Level 1 compliance standards. See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.
          </li>
          <li>
            Aggregated server logs (error messages, request counts) may be retained briefly for reliability monitoring.
            No personal identifiers are included in logs.
          </li>
          <li>
            Google Analytics (GA4) records anonymized usage metrics (page views, sessions, device type, geographic region).
            IP anonymization is enabled. Data is used only to understand overall adoption and improve the product.
          </li>
          <li>
            Third-party AI APIs (xAI Grok, Brave Search) receive only the minimum request data needed to generate
            topic analysis, summaries, and predictions. No user-identifiable data is sent to these services.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Use of Information</h2>
        <p>
          Content displayed is generated or summarized by AI services. You may browse, share links, or cite the material
          with attribution. Automated scraping or commercial redistribution without permission is prohibited.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Cookies &amp; Storage</h2>
        <p>
          We do not set first-party tracking cookies. The site uses <code>localStorage</code> for topic caching,
          user preferences, and session data. Google Analytics may set cookies for analytics purposes.
          Firebase Authentication uses session storage for sign-in state. Clearing your browser data removes all locally stored information.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Third-Party Services</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>xAI Grok &mdash; topic detection, AI summaries, predictions, and narrative analysis</li>
          <li>Brave Search &mdash; supplementary news source discovery</li>
          <li>Google Maps Platform &mdash; geocoding and visual map tiles</li>
          <li>Firebase Authentication &mdash; passwordless email sign-in</li>
          <li>Stripe &mdash; subscription billing and payment processing</li>
          <li>AWS Lambda and DynamoDB &mdash; API backend and data storage</li>
          <li>Google Analytics (GA4) &mdash; anonymized usage metrics</li>
        </ul>
        <p>
          Usage of those services is subject to their respective terms. By interacting with the site you agree to
          their processing of requests made on your behalf.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Account Deletion</h2>
        <p>
          To delete your account and all associated data, email{' '}
          <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a> from the
          email address associated with your account. We will remove your account data within 5 business days
          and confirm by email. Active subscriptions will be cancelled as part of the deletion process.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Liability</h2>
        <p>
          The material is provided &ldquo;as is&rdquo; without warranties of accuracy, completeness, or fitness for any purpose.
          Decisions should not be based solely on AI-generated content. We are not responsible for damages arising from
          reliance on the summaries, predictions, or map visualizations.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>Updates</h2>
        <p>
          Policies may evolve as new features launch. The page will display the latest revision date and changelog notes.
          Significant updates will be announced on the About page.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Last updated: 2026-03-19
        </p>
      </section>
    </div>
  );
}

export default PrivacyTerms;
