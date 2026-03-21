import React from 'react';

function Disclosures() {
  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>Disclosures</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>AI-Generated Content</h2>
        <p style={{ marginBottom: '0.75rem' }}>
          All summaries, predictions, root-cause analyses, thread intelligence, and country briefings are generated
          by large language models. They are provided for informational and educational purposes only.
        </p>
        <p style={{ marginBottom: '0.75rem' }}>
          <strong>This content does not constitute financial, investment, legal, political, security, or professional
          advice of any kind.</strong> Forward-looking statements and forecasts reflect AI-generated analysis of
          available information and are not guarantees or predictions of future events. Actual outcomes may differ
          materially from anything described on this platform.
        </p>
        <p style={{ marginBottom: '0.75rem' }}>
          You should not rely solely on content from this platform when making business, investment, policy, or
          security decisions. Always verify information independently through primary sources and consult qualified
          professionals where appropriate.
        </p>
        <p>
          Global Perspectives assumes no liability for decisions made based on AI-generated content. Use of this
          platform constitutes acceptance of this disclaimer.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Limitation of Liability</h2>
        <p style={{ marginBottom: '0.75rem' }}>
          To the maximum extent permitted by applicable law, Global Perspectives and its operators shall not be
          liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use
          of this platform or reliance on any content it provides.
        </p>
        <p>
          The platform is provided "as is" without warranties of any kind, express or implied, including but not
          limited to accuracy, completeness, timeliness, or fitness for a particular purpose.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Data Sources</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>Topic detection and AI analysis: xAI Grok using globally syndicated publishers and Brave Search.</li>
          <li>Geocoding and map layers: Google Maps Platform.</li>
        </ul>
        <p style={{ marginTop: '0.75rem' }}>
          Source articles are linked for reference. Global Perspectives does not reproduce full article text and
          is not responsible for the accuracy or availability of third-party source content.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Accuracy &amp; Bias</h2>
        <p>
          AI systems can reflect the limitations and biases of their training data and source material. Regions
          with limited media coverage may appear underrepresented. AI-generated analysis may contain errors,
          omissions, or outdated information. Global Perspectives makes no representation that content is complete,
          current, or free from inaccuracy.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Subscription Terms</h2>
        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Plans &amp; Pricing</h3>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li><strong>Free</strong> — access to today's global topics and the interactive map. No account required.</li>
          <li><strong>Member ($15/month)</strong> — 7-day narrative archive, story arc intelligence, thread analysis, country briefings with AI-powered risk signals, and the weekly map with date playback.</li>
          <li><strong>Enterprise</strong> — everything in Member plus 30-day archive depth and priority data access. <a href="mailto:globalperspectives.app@gmail.com">Contact us</a> for pricing.</li>
        </ul>
        <p>All paid plans are billed monthly. Prices are in USD and exclude applicable taxes.</p>

        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Free Trial</h3>
        <p>New accounts receive a 14-day free trial of Member features automatically upon sign-up. No credit card is required to start the trial. After the trial period, continued access to paid features requires a subscription.</p>

        <h3 style={{ fontSize: '1.05rem', marginTop: '1rem' }}>Cancellation</h3>
        <p>
          You may cancel your subscription at any time from your Account page via the Customer Portal.
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
          Payments are processed securely by <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">Paddle</a>,
          which acts as the Merchant of Record. Paddle handles billing, VAT, and applicable taxes on your behalf.
          We do not store your credit card details. All payment data is handled directly by Paddle in accordance with
          PCI DSS compliance standards.
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
          Last updated: 2026-03-21
        </p>
      </section>
    </div>
  );
}

export default Disclosures;
