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
          <li>Topic detection: Google Gemini using globally syndicated publishers.</li>
          <li>Geocoding and map layers: Google Maps Platform.</li>
          <li>Supplementary analysis: OpenAI GPT models.</li>
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

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>Affiliate Links &amp; Sponsorships</h2>
        <p>
          The project does not participate in affiliate programs and receives no compensation from the organizations
          mentioned. If that changes, the disclosure will be updated here prior to launch.
        </p>
      </section>
    </div>
  );
}

export default Disclosures;
