import { useState, useEffect, useRef } from 'react';
import './LoadingIndicators.css';

export default function LoadingBar() {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);
  const countRef = useRef(0);

  useEffect(() => {
    const onStart = () => {
      countRef.current += 1;
      setFading(false);
      setVisible(true);
      setWidth(0);
      clearTimeout(timerRef.current);
      // Small delay so the DOM registers 0% before transitioning
      timerRef.current = setTimeout(() => setWidth(85), 20);
    };

    const onEnd = () => {
      countRef.current = Math.max(0, countRef.current - 1);
      if (countRef.current > 0) return;
      setWidth(100);
      timerRef.current = setTimeout(() => {
        setFading(true);
        timerRef.current = setTimeout(() => {
          setVisible(false);
          setWidth(0);
          setFading(false);
        }, 300);
      }, 200);
    };

    window.addEventListener('gp-loading-start', onStart);
    window.addEventListener('gp-loading-end', onEnd);
    return () => {
      window.removeEventListener('gp-loading-start', onStart);
      window.removeEventListener('gp-loading-end', onEnd);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="loading-bar-track">
      <div
        className={`loading-bar-fill${fading ? ' fading' : ''}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
