// Trimmed from a real, read-only `country_history` response for Iran (proxy,
// 2026-09-26, anonymous request — hence driftNotesGated: true / only 1 of 18 notes
// returned). Dates, scores, headlines and the driftNote's text are all real; only the
// snapshot list is trimmed to the window around the one note kept (2026-08-15 .. 2026-08-20).
// Used to render-test the Desk against realistic data instead of invented fixtures
// (CLAUDE.md: never invent facts/dates).
export const IRAN_COUNTRY_HISTORY = {
  success: true,
  countryName: 'Iran',
  driftNotesTotal: 18,
  driftNotesGated: true,
  snapshots: [
    {
      riskScore: 95, riskLevel: 'high', trajectory: 'escalating', dateKey: '2026-08-15',
      headline: "Iran's New Supreme Leader Faces Internal Revolt and External Siege",
      dimensions: {
        political: { score: 85, why: 'Open factional infighting over war direction amid Supreme Leader Mojtaba Khamenei\'s absence from public view.' },
        economic: { score: 80, why: 'US sanctions on shipping firms, Strait of Hormuz disruption, and oil price volatility above $100.' },
        conflict: { score: 95, why: 'Active Iran-Israel war, US naval blockade, proxy attacks on tankers, and Saudi expectation of imminent strikes from Iran\'s allies.' },
        humanitarian: { score: 90, why: 'UN-documented surge in executions (56 on national security charges since March) and civilian harm from ongoing conflict.' },
      },
      countryName: 'Iran', generatedAt: '2026-08-15T07:00:46.457Z', lead: 'conflict',
    },
    {
      riskScore: 95, riskLevel: 'high', trajectory: 'escalating', dateKey: '2026-08-17',
      headline: "Iran's fragile ceasefires strain under proxy attacks and Hormuz brinkmanship",
      dimensions: {
        political: { score: 75, why: 'The succession of Mojtaba Khamenei and open factional fighting over war direction, combined with 56 executions on national security charges, signal severe institutional strain.' },
        economic: { score: 80, why: 'US sanctions on Chinese and Hong Kong shipping firms, the unresolved Hormuz closure, and oil price volatility are disrupting Iranian trade and energy revenue.' },
        conflict: { score: 95, why: 'Active Iran-Israel war, US naval blockade, proxy attacks in Lebanon and Iraq, and the UAE\'s accusation of an Iranian attack on an ADNOC tanker keep armed violence at severe levels.' },
        humanitarian: { score: 90, why: 'The UN rights chief\'s alarm over executions, civilian casualties from Israeli strikes in Lebanon, and the environmental disaster from the Oman oil spill indicate a severe humanitarian toll.' },
      },
      countryName: 'Iran', generatedAt: '2026-08-17T07:00:54.192Z', lead: 'conflict',
    },
    {
      riskScore: 95, riskLevel: 'high', trajectory: 'escalating', dateKey: '2026-08-18',
      headline: "Iran's fragile ceasefires strain under Israeli strikes and Gulf escalation",
      dimensions: {
        political: { score: 85, why: 'Internal factional disputes over war direction amid Supreme Leader Mojtaba Khamenei\'s consolidation of power following the succession crisis.' },
        economic: { score: 80, why: 'US naval blockade on Iranian oil ports, sanctions on shipping firms, and Strait of Hormuz disruptions driving oil price volatility.' },
        conflict: { score: 95, why: 'Active Iran-Israel war with Israeli strikes on Lebanon killing 11, UAE reporting Iranian attacks on tankers, and Saudi Arabia expecting imminent attacks from Iran\'s allies.' },
        humanitarian: { score: 90, why: 'UN rights chief alarmed by rise in executions since March with 56 executed on national security charges, plus civilian casualties from proxy conflicts.' },
      },
      countryName: 'Iran', generatedAt: '2026-08-18T07:00:54.527Z', lead: 'conflict',
    },
    {
      riskScore: 95, riskLevel: 'high', trajectory: 'escalating', dateKey: '2026-08-19',
      headline: 'Iran faces Gulf isolation and US pressure as Hormuz crisis deepens',
      dimensions: {
        political: { score: 85, why: 'Internal factional fighting over war direction under Mojtaba Khamenei is weakening institutional coherence as external pressure mounts.' },
        economic: { score: 90, why: 'The indefinite UAE trade embargo, US naval blockade on oil ports, and Hormuz oil spill are strangling Iran\'s export revenue and disrupting regional shipping.' },
        conflict: { score: 95, why: 'Direct Iran-UAE missile exchanges, the collapsed US peace-deal deadline, Israeli strikes on Lebanon, and threats to bomb Oman over Hormuz mark a severe multi-front escalation.' },
        humanitarian: { score: 70, why: 'The expanding Hormuz oil spill threatens an environmental disaster, while Israeli strikes in Lebanon and the UN rights chief\'s alarm over rising executions signal civilian harm.' },
      },
      countryName: 'Iran', generatedAt: '2026-08-19T07:00:52.535Z', lead: 'conflict',
    },
    {
      riskScore: 95, riskLevel: 'high', trajectory: 'escalating', dateKey: '2026-08-20',
      headline: 'Iran Faces Regional Isolation as US Peace Deadline Expires',
      dimensions: {
        political: { score: 85, why: 'Factions in Iran are openly fighting over the war\'s direction under Mojtaba Khamenei\'s untested leadership, while the expired peace deal removes the last diplomatic buffer.' },
        economic: { score: 90, why: 'The UAE\'s indefinite trade embargo, US naval blockade on oil ports, and sanctions on Chinese shipping firms are strangling Iran\'s economy.' },
        conflict: { score: 95, why: 'Active Iran-Israel war, US-Iran strikes in the Gulf, proxy attacks in Iraq and Yemen, and the expired peace deadline with threats to bomb Oman all indicate severe armed conflict intensity.' },
        humanitarian: { score: 75, why: 'The UN rights chief reports a rise in executions since March with 56 executed on national security charges, while trade disruption and oil spills worsen civilian conditions.' },
      },
      countryName: 'Iran', generatedAt: '2026-08-20T07:01:01.654Z', lead: 'conflict',
    },
  ],
  driftNotes: [
    {
      currentHeadline: 'Iran faces Gulf isolation and US pressure as Hormuz crisis deepens',
      changeScore: { delta: 0, from: 95, to: 95 },
      since: '2026-08-18',
      currentRiskScore: 95,
      whyChanged: "The UAE's indefinite trade embargo on Iran directly escalates economic isolation, driving the economic score up from 80 to 90. This action also shifts the humanitarian score down as trade disruption worsens civilian conditions, while the prior missile attack (event 6) is the immediate cause but the embargo is the structural change.",
      countryName: 'Iran',
      generatedAt: '2026-08-19T07:20:07.439Z',
      currentLead: 'conflict',
      asOf: '2026-08-19',
      priorHeadline: "Iran's fragile ceasefires strain under Israeli strikes and Gulf escalation",
      noSingleDriver: false,
      changeDimensions: {
        economic: { delta: 10, from: 80, to: 90 },
        humanitarian: { delta: -20, from: 90, to: 70 },
      },
      currentRiskLevel: 'high',
      triggerEvent: {
        title: 'UAE imposes indefinite trade embargo on Iran over alleged missile attacks',
        date: '2026-08-19',
        topicId: 'UAE imposes indefinite trade embargo on Iran over alleged missile attacks-5',
      },
    },
  ],
};
