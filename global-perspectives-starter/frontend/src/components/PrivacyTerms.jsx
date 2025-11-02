import React from 'react';

function PrivacyTerms() {
  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Privacy &amp; Terms</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Overview</h2>
        <p>
          Global Perspectives highlights international news topics sourced from Google Gemini, Google Maps
          geocoding, and publicly available reporting. This site is provided for informational purposes and
          does not require account creation or login.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Data Collection</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>
            The application stores a cached copy of the latest topics in your browser via <code>localStorage</code>.
          </li>
          <li>
            No personal identifiers are collected, sold, or shared. Aggregated server logs (error messages, request counts)
            may be retained briefly for reliability monitoring.
          </li>
          <li>
            Cloudflare Web Analytics records anonymized usage metrics (page views, timestamp, country/region, browser/device).
            IP addresses are not stored, and the data is used only to understand overall adoption.
          </li>
          <li>
            Third-party APIs (Google Gemini, Google Maps, OpenAI) receive only the minimum request data needed to fulfill
            summaries, predictions, or map lookups.
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
          We do not set tracking cookies. The site only uses client-side storage for topic caching and collapsed panel
          preferences. Clearing your browser cache removes this data.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Third-Party Services</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>Google Gemini &mdash; topic discovery and AI summaries</li>
          <li>Google Maps Platform &mdash; geocoding and visual map tiles</li>
          <li>OpenAI &mdash; optional predictive narratives</li>
          <li>AWS AppSync and Lambda &mdash; API gateway and caching</li>
          <li>Cloudflare Web Analytics &mdash; privacy-first usage metrics (page views, device type, browser locale)</li>
        </ul>
        <p>
          Usage of those services is subject to their respective terms. By interacting with the site you agree to
          their processing of requests made on your behalf.
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
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </section>
    </div>
  );
}

export default PrivacyTerms;
