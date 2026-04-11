import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const COMMANDS = [
  { cmd: 'gp today', desc: 'Interactive topic browser grouped by category. Arrow keys to navigate, Enter to expand, Tab to cycle AI analysis.' },
  { cmd: 'gp countries', desc: 'Top 15 countries in today\'s news ranked by mention count with flag emojis.' },
  { cmd: 'gp country "Iran"', desc: 'Country intelligence briefing: bottom-line assessment, key developments timeline, risk level, trajectory.' },
  { cmd: 'gp thread <id>', desc: 'Story arc preview with thread title and entry timeline.' },
  { cmd: 'gp today --json', desc: 'Raw JSON output — pipe to jq, scripts, or AI agents.' },
];

const KEYS = [
  { key: '←→', action: 'Switch category tab' },
  { key: '↑↓ / j/k', action: 'Navigate topics' },
  { key: 'Enter', action: 'Expand / collapse topic' },
  { key: 'Tab', action: 'Cycle AI tabs (Summarize / Predict / Trace)' },
  { key: 'Esc', action: 'Collapse detail panel' },
  { key: '1-9', action: 'Jump to category by number' },
  { key: 'g / G', action: 'Jump to top / bottom' },
  { key: 'q', action: 'Quit' },
];

export default function CLIPage() {
  useEffect(() => { document.title = 'CLI — Global Perspectives'; }, []);

  return (
    <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 4 }}>Command Line Interface</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
        Global news intelligence from your terminal. Zero dependencies, works on Node.js 18+.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem' }}>Install</h2>
        <div style={{ background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.8, overflowX: 'auto' }}>
          <div><span style={{ color: '#9ca3af' }}># Try instantly (no install)</span></div>
          <div><span style={{ color: '#34d399' }}>$</span> npx global-perspectives today</div>
          <div style={{ marginTop: 12 }}><span style={{ color: '#9ca3af' }}># Or install globally</span></div>
          <div><span style={{ color: '#34d399' }}>$</span> npm install -g global-perspectives</div>
          <div><span style={{ color: '#34d399' }}>$</span> gp today</div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem' }}>Commands</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {COMMANDS.map(({ cmd, desc }) => (
            <div key={cmd} style={{ padding: '12px 14px', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8 }}>
              <code style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: '0.88rem' }}>{cmd}</code>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem' }}>Interactive Mode</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Running <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 3 }}>gp today</code> in a terminal launches a full-screen interactive browser:
        </p>
        <div style={{ background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.7, overflowX: 'auto', whiteSpace: 'pre' }}>
{` 📰 Global Perspectives  50 topics

  conflict (18)   politics (8)   economy (6)

 ▸ 🇮🇷 Iran fires ballistic missiles at Diego Garcia
     Iran, United Kingdom, United States
   🇮🇱 US-Israel attack hits Natanz nuclear facility
   🇷🇺 Russia drone strike blacks out Chernihiv region

 ──────────────────────────────────────────────
  [Summarize]  Predict   Trace Cause

   US-Israel coalition struck Iran's Natanz nuclear
   facility on March 21 as Iran retaliated with
   long-range missiles targeting Diego Garcia...

 ←→ category  ↑↓ navigate  Enter expand  Tab AI  q quit`}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem' }}>Keyboard Shortcuts</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <tbody>
            {KEYS.map(({ key, action }) => (
              <tr key={key} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap', width: 100 }}>
                  <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>{key}</code>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.15rem' }}>JSON Mode</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Add <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 3 }}>--json</code> to any command for raw JSON output. Perfect for piping to other tools or AI agents.
        </p>
        <div style={{ background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.7, overflowX: 'auto' }}>
          <div><span style={{ color: '#9ca3af' }}># Pipe to jq</span></div>
          <div><span style={{ color: '#34d399' }}>$</span> gp country Iran --json | jq '.riskLevel'</div>
          <div style={{ color: '#34d399' }}>"high"</div>
          <div style={{ marginTop: 12 }}><span style={{ color: '#9ca3af' }}># Feed to a script</span></div>
          <div><span style={{ color: '#34d399' }}>$</span> gp today --json | python3 analyze.py</div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Links</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="https://www.npmjs.com/package/global-perspectives" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>npm package →</a>
          <a href="https://github.com/BenBen05059997/globalPerspective-v1/tree/main/cli" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>Source code →</a>
        </div>
      </section>
    </div>
  );
}
