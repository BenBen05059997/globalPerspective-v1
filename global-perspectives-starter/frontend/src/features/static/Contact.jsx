import { Link } from 'react-router-dom';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import StaticPage from '@/features/static/StaticPage.jsx';

const INBOXES = [
  { label: 'General Inquiries', href: 'mailto:globalperspectives.app@gmail.com', desc: 'Feedback, feature requests, bug reports, press inquiries' },
  { label: 'Account & Data', href: 'mailto:globalperspectives.app@gmail.com?subject=Account%20request', desc: 'Account deletion and data requests' },
  { label: 'Partnerships', href: 'mailto:globalperspectives.app@gmail.com?subject=Partnership%20inquiry', desc: 'API access, integrations, and partnerships' },
];

export default function Contact() {
  return (
    <StaticPage
      title="Contact Us"
      width="md"
      lede="We'd love to hear from you — feedback, questions, partnership ideas, or just to say hello."
    >
      <div className="sp-inboxes">
        {INBOXES.map(({ label, href, desc }) => (
          <Card key={label} level={2}>
            <SectionHeader as="h2" label={label} />
            <a href={href} className="sp-inbox__mail">globalperspectives.app@gmail.com</a>
            <p className="sp-inbox__desc">{desc}</p>
          </Card>
        ))}
      </div>

      <p className="sp-note">We aim to respond within 2 business days.</p>

      <div className="sp-links sp-links--rule">
        <Link to="/about">About Us →</Link>
        <Link to="/disclosures">Disclosures →</Link>
      </div>
    </StaticPage>
  );
}
