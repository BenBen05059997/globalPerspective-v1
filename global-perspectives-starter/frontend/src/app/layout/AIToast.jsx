import { useState, useEffect, useRef } from 'react';
import './LoadingIndicators.css';

export default function AIToast() {
  const [ops, setOps] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    const onStart = (e) => {
      const id = ++idRef.current;
      const message = e.detail?.message || 'Generating…';
      setOps(prev => [...prev, { id, message }]);
    };

    const onEnd = (e) => {
      const id = e.detail?.id;
      if (id != null) {
        setOps(prev => prev.filter(op => op.id !== id));
      } else {
        // No id provided — pop the oldest
        setOps(prev => prev.slice(1));
      }
    };

    window.addEventListener('gp-ai-start', onStart);
    window.addEventListener('gp-ai-end', onEnd);
    return () => {
      window.removeEventListener('gp-ai-start', onStart);
      window.removeEventListener('gp-ai-end', onEnd);
    };
  }, []);

  if (ops.length === 0) return null;

  const current = ops[ops.length - 1];

  return (
    <div className="ai-toast" key={current.id}>
      <div className="ai-toast-spinner" />
      <span className="ai-toast-message">{current.message}</span>
      {ops.length > 1 && (
        <span className="ai-toast-count">+{ops.length - 1}</span>
      )}
    </div>
  );
}
