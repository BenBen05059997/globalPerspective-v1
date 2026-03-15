import { useState } from 'react';

export default function ApiKeyGate({ onSubmit, error, title, description }) {
  const [input, setInput] = useState('');
  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) onSubmit(input.trim());
  }
  return (
    <div className="weekly-gate">
      {title ? <h2>{title}</h2> : (
        <>
          <div className="weekly-gate-icon">🔑</div>
          <h2>Member & Enterprise Access</h2>
        </>
      )}
      {description && <p>{description}</p>}
      <form className="weekly-gate-form" onSubmit={handleSubmit}>
        <input
          className="weekly-gate-input"
          type="text" placeholder="Enter your API key" value={input}
          onChange={e => setInput(e.target.value)} autoFocus
        />
        <button className="weekly-gate-submit" type="submit">Access</button>
      </form>
      {error && <div className="weekly-gate-error">{error}</div>}
    </div>
  );
}
