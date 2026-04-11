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
      title={saved ? 'Unfavorite' : 'Favorite'}
      aria-label={saved ? 'Unfavorite' : 'Favorite'}
      className={`save-button ${saved ? 'save-button--saved' : ''} ${busy ? 'save-button--busy' : ''} ${className}`}
      style={{
        background: 'none',
        border: 'none',
        cursor: busy ? 'default' : 'pointer',
        padding: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        color: saved ? '#ef4444' : 'currentColor',
        opacity: busy ? 0.5 : 1,
        transition: 'color 0.15s, opacity 0.15s, transform 0.15s',
        transform: saved ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      {saved ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      )}
    </button>
  );
}
