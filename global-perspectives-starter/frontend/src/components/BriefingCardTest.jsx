import BriefingCard from './BriefingCard';

const MOCK_THREAD = {
  threadId: 'thread-israel-lebanon-2026',
  latestTitle: 'Israel Escalates Invasion of Southern Lebanon Against Hezbollah',
  articleCount: 22,
  trend: 'rising',
};

const MOCK_THREAD_ANALYSIS = {
  threadTitle: 'Israel Escalates Invasion of Southern Lebanon Against Hezbollah',
  storyArc: 'The conflict ignited on March 12, 2026, when Israel launched airstrikes on central Beirut targeting Hezbollah, killing nearly 700 in Lebanon and marking a sharp escalation from prior border skirmishes. By March 16, Israel announced limited ground operations in southern Lebanon, followed swiftly by expanded strikes on March 17 that displaced one million people.',
  trajectory: "Israel's IDF will push deeper toward the Litani River in coming days, targeting remaining Hezbollah positions, while Hezbollah intensifies rocket barrages from north of the river, prompting evacuations in northern Israel.",
  watchQuestions: [
    'Will Netanyahu announce Litani River occupation by April 5?',
    'Will Iran resupply Hezbollah via Syria within two weeks?',
  ],
  entryCount: 22,
};

const MOCK_COUNTRY_INTEL = {
  countryName: 'Turkey',
  headline: 'Erdogan signals early elections amid currency crisis',
  riskLevel: 'elevated',
  bluf: 'Lira hit record low as central bank reversed rate hikes under political pressure. Opposition coalition gaining in polls for the first time since 2023. Military leadership reshuffle signals consolidation of executive power ahead of potential snap elections.',
  keyDevelopments: [
    { date: '2026-03-28', text: 'Central bank cuts rates despite 45% inflation' },
    { date: '2026-03-30', text: 'Opposition leader calls for snap elections' },
    { date: '2026-03-31', text: 'Military chief replaced in surprise reshuffle' },
  ],
  riskSignals: [
    'Lira below 40/USD could trigger capital controls',
    'Military leadership reshuffle signals power consolidation',
    'Opposition alliance may fracture over Kurdish policy disagreements',
  ],
};

export default function BriefingCardTest() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ marginBottom: 8 }}>Briefing Card Generator</h1>
      <p style={{ color: '#666', marginBottom: 32, fontSize: '0.9rem' }}>
        Powered by <a href="https://github.com/chenglou/pretext" target="_blank" rel="noreferrer">Pretext</a> — DOM-free text measurement and layout.
        Canvas-rendered intelligence briefing cards for sharing and download.
      </p>

      <h2 style={{ marginBottom: 16 }}>Thread Briefing</h2>
      <BriefingCard type="thread" thread={MOCK_THREAD} analysis={MOCK_THREAD_ANALYSIS} />

      <div style={{ height: 48 }} />

      <h2 style={{ marginBottom: 16 }}>Country Briefing</h2>
      <BriefingCard type="country" countryName="Turkey" intel={MOCK_COUNTRY_INTEL} />
    </div>
  );
}
