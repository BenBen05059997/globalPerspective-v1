import React from 'react';

function AboutContact() {
  return (
    <div className="card" style={{ maxWidth: '880px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>About &amp; Contact</h1>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Mission</h2>
        <p>
          Global Perspectives™ experiments with AI-assisted journalism. The dashboard surfaces emerging international
          topics, summarizes regional coverage, and gives readers a map-first view of shifting attention. The project
          was built as a learning tool to explore serverless data pipelines, AI APIs, and accessible storytelling.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>How It Works</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>Google Gemini identifies trending themes from curated, reputable news sources.</li>
          <li>AWS AppSync and Lambda cache responses so visitors receive fresh content with minimal latency.</li>
          <li>OpenAI models produce optional forward-looking analysis to spark discussion.</li>
          <li>Google Maps visualizes geographic context, highlighting regions driving the conversation.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Who Is Behind It</h2>
        <p>
          The application is maintained by a small independent developer team. We welcome feedback, bug reports,
          feature suggestions, and collaboration ideas.
        </p>
      </section>

      <section style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.25rem' }}>Contact</h2>
        <p>
          Email: <a href="mailto:globalperspectives.app@gmail.com">globalperspectives.app@gmail.com</a>
        </p>
        <p>
          GitHub Issues: <a href="https://github.com/BenBen05059997/GlobalPerspective/issues" target="_blank" rel="noreferrer noopener">
            project tracker
          </a>
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>Media &amp; Attribution</h2>
        <p>
          Screenshots or quotes may be used with credit to &ldquo;Global Perspectives™&rdquo; and a link back to the site.
          For press inquiries please reach out via email with your publication name and deadline.
        </p>
      </section>
    </div>
  );
}

export default AboutContact;
