import StaticPage, { StaticSection } from '@/features/static/StaticPage.jsx';
import { Link } from 'react-router';
import { ROUTE } from '@/shared/lib/links.js';

function Disclosures() {
  return (
    <StaticPage title="Disclosures">

      <StaticSection title="AI-Generated Content">
        <p>
          All summaries, predictions, root-cause analyses, thread intelligence, and country briefings are generated
          by large language models. They are provided for informational and educational purposes only.
        </p>
        <p>
          <strong>This content does not constitute financial, investment, legal, political, security, or professional
          advice of any kind.</strong> Forward-looking statements and forecasts reflect AI-generated analysis of
          available information and are not guarantees or predictions of future events. Actual outcomes may differ
          materially from anything described on this platform.
        </p>
        <p>
          You should not rely solely on content from this platform when making business, investment, policy, or
          security decisions. Always verify information independently through primary sources and consult qualified
          professionals where appropriate.
        </p>
        <p>
          Global Perspectives assumes no liability for decisions made based on AI-generated content. Use of this
          platform constitutes acceptance of this disclaimer.
        </p>
      </StaticSection>

      <StaticSection title="Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, Global Perspectives and its operators shall not be
          liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use
          of this platform or reliance on any content it provides.
        </p>
        <p>
          The platform is provided "as is" without warranties of any kind, express or implied, including but not
          limited to accuracy, completeness, timeliness, or fitness for a particular purpose.
        </p>
      </StaticSection>

      <StaticSection title="Data Sources">
        <ul>
          <li>Topic detection and AI analysis: DeepSeek V4, using globally syndicated publishers and Brave Search.</li>
          <li>Geocoding and map layers: Google Maps Platform.</li>
        </ul>
        <p>
          Source articles are linked for reference. Global Perspectives does not reproduce full article text and
          is not responsible for the accuracy or availability of third-party source content.
        </p>
      </StaticSection>

      <StaticSection title="Accuracy & Bias">
        <p>
          AI systems can reflect the limitations and biases of their training data and source material. Regions
          with limited media coverage may appear underrepresented. AI-generated analysis may contain errors,
          omissions, or outdated information. Global Perspectives makes no representation that content is complete,
          current, or free from inaccuracy.
        </p>
      </StaticSection>

      <StaticSection title="Access & Pricing">
        <p>
          All published intelligence is <strong>free and public to read</strong> — every feature (today's topics,
          the interactive map, narrative archive, thread and country intelligence, daily and
          weekly briefs, and the forecast track record) is fully open with no account or payment required to read.
          An optional account (email magic link or Google sign-in) is free and enables saving items and notification
          preferences.
        </p>
        <p>
          An optional <strong>membership</strong> doesn&apos;t paywall reading — every analysis stays free. It adds
          <strong> depth</strong>: the full history of how each country and thread read has changed (non-members see the
          latest correction on each), the complete corrections ledger on the track record, and following countries to see what changed since your last visit. See{' '}
          <Link to="/membership">Membership</Link> for current availability and pricing; payments, when active, are
          processed by Polar as Merchant of Record.
        </p>
      </StaticSection>

      <StaticSection title="Contact">
        <p>
          For account issues or general inquiries:<br />
          Email: <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a>
        </p>
        <p>
          Business name: Global Perspectives
        </p>
      </StaticSection>

      <StaticSection title="Affiliate Links & Sponsorships">
        <p>
          The project does not participate in affiliate programs and receives no compensation from the organizations
          mentioned. If that changes, the disclosure will be updated here.
        </p>
        <p className="sp-updated">
          Last updated: 2026-05-26
        </p>
      </StaticSection>
    </StaticPage>
  );
}

export default Disclosures;
