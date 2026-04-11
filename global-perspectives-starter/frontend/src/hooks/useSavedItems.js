import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveItem, unsaveItem, fetchSavedItems } from '../services/restProxy';

// In-memory cache shared across hook instances
let _cache = null;
let _cacheUid = null;

export function useSavedItems() {
  const { user } = useAuth();
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setSavedItems([]);
      _cache = null;
      _cacheUid = null;
      fetchedRef.current = false;
      return;
    }

    // Use cache if same user
    if (_cache && _cacheUid === user.uid) {
      setSavedItems(_cache);
      return;
    }

    fetchedRef.current = false;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSavedItems()
      .then(res => {
        if (cancelled) return;
        const items = res?.data || [];
        _cache = items;
        _cacheUid = user.uid;
        setSavedItems(items);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user]);

  const save = useCallback(async (itemType, itemId, metadata = {}) => {
    if (!user) return;
    await saveItem(itemType, itemId, metadata);
    const newItem = { itemType, itemId, metadata, savedAt: new Date().toISOString() };
    setSavedItems(prev => {
      const next = [newItem, ...prev.filter(i => !(i.itemType === itemType && i.itemId === itemId))];
      _cache = next;
      return next;
    });
  }, [user]);

  const unsave = useCallback(async (itemType, itemId) => {
    if (!user) return;
    await unsaveItem(itemType, itemId);
    setSavedItems(prev => {
      const next = prev.filter(i => !(i.itemType === itemType && i.itemId === itemId));
      _cache = next;
      return next;
    });
  }, [user]);

  const isSaved = useCallback((itemType, itemId) => {
    return savedItems.some(i => i.itemType === itemType && i.itemId === itemId);
  }, [savedItems]);

  return { savedItems, loading, error, save, unsave, isSaved };
}
