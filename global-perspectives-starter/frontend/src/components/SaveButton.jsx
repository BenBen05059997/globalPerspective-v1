import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSavedItems } from '../hooks/useSavedItems';

export function SaveButton({ itemType, itemId, metadata = {}, className = '' }) {
  const { user } = useAuth();
  const { isSaved, save, unsave } = useSavedItems();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const saved = isSaved(itemType, itemId);

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (saved) {
        await unsave(itemType, itemId);
      } else {
        await save(itemType, itemId, metadata);
      }
    } catch (err) {
      console.error('SaveButton error', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={saved ? 'Remove bookmark' : 'Save'}
      aria-label={saved ? 'Remove bookmark' : 'Save'}
      className={`save-button ${saved ? 'save-button--saved' : ''} ${busy ? 'save-button--busy' : ''} ${className}`}
      style={{
        background: 'none',
        border: 'none',
        cursor: busy ? 'default' : 'pointer',
        padding: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        color: saved ? '#f59e0b' : 'currentColor',
        opacity: busy ? 0.5 : 1,
        transition: 'color 0.15s, opacity 0.15s',
      }}
    >
      {saved ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/>
        </svg>
      )}
    </button>
  );
}
