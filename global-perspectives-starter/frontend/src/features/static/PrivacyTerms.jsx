import StaticPage, { StaticSection } from '@/features/static/StaticPage.jsx';

function PrivacyTerms() {
  return (
    <StaticPage title="Privacy & Terms">

      <StaticSection title="Overview">
        <p>
          Global Perspectives is an AI-powered global news intelligence platform. All content — today's topics, the
          interactive map, weekly narrative analysis, country and thread intelligence, and economic analysis — is
          free and accessible to read without an account. An optional account (email magic link or Google sign-in)
          is free and enables saving items and notification preferences. An optional membership does not paywall reading —
          every analysis stays free. It funds the project and adds depth for members: the full self-correction history,
          email change-alerts on the countries they follow, and running the Analysis Studio on our compute.
        </p>
      </StaticSection>

      <StaticSection title="Data Collection">
        <ul>
          <li>
            The application stores cached data (topics, archive, preferences) in your browser via <code>localStorage</code>.
          </li>
          <li>
            <strong>Account creation:</strong> If you sign in, we collect your email address via Firebase Authentication
            (passwordless magic link). Your email is used solely for authentication and account identification.
            We do not sell or share your email with third parties.
          </li>
          <li>
            <strong>Payment data:</strong> Not collected or stored by us. Reading is free; if you choose to buy a
            membership, payment is processed entirely by Polar (our Merchant of Record) — your card details never
            touch our servers.
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
            Third-party AI and search APIs (DeepSeek, Brave Search) receive only the minimum request data needed to generate
            topic analysis, summaries, and predictions. No user-identifiable data is sent to these services.
          </li>
        </ul>
      </StaticSection>

      <StaticSection title="Use of Information">
        <p>
          Content displayed is generated or summarized by AI services. You may browse, share links, or cite the material
          with attribution. Automated scraping or commercial redistribution without permission is prohibited.
        </p>
      </StaticSection>

      <StaticSection title="Cookies & Storage">
        <p>
          We do not set first-party tracking cookies. The site uses <code>localStorage</code> for topic caching,
          user preferences, and session data. Google Analytics may set cookies for analytics purposes.
          Firebase Authentication uses session storage for sign-in state. Clearing your browser data removes all locally stored information.
        </p>
      </StaticSection>

      <StaticSection title="Third-Party Services">
        <ul>
          <li>DeepSeek &mdash; topic detection, AI summaries, predictions, and narrative analysis</li>
          <li>Brave Search &mdash; supplementary news source discovery</li>
          <li>Google Maps Platform &mdash; geocoding and visual map tiles</li>
          <li>Firebase Authentication &mdash; passwordless email sign-in</li>
          <li>AWS Lambda and DynamoDB &mdash; API backend and data storage</li>
          <li>Google Analytics (GA4) &mdash; anonymized usage metrics</li>
        </ul>
        <p>
          Usage of those services is subject to their respective terms. By interacting with the site you agree to
          their processing of requests made on your behalf.
        </p>
      </StaticSection>

      <StaticSection title="Account Deletion">
        <p>
          To delete your account and all associated data, email{' '}
          <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a> from the
          email address associated with your account. We will remove your account data within 5 business days
          and confirm by email.
        </p>
      </StaticSection>

      <StaticSection title="Liability">
        <p>
          The material is provided &ldquo;as is&rdquo; without warranties of accuracy, completeness, or fitness for any purpose.
          Decisions should not be based solely on AI-generated content. We are not responsible for damages arising from
          reliance on the summaries, predictions, or map visualizations.
        </p>
      </StaticSection>

      <StaticSection title="Updates">
        <p>
          Policies may evolve as new features launch. The page will display the latest revision date and changelog notes.
          Significant updates will be announced on the About page.
        </p>
        <p className="sp-updated">
          Last updated: 2026-05-26
        </p>
      </StaticSection>
    </StaticPage>
  );
}

export default PrivacyTerms;
