import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink,
  signOut as firebaseSignOut,
} from 'firebase/auth';

// Firebase config is read from window.FIREBASE_CONFIG (set in docs/config.js)
// so it can be updated without a rebuild. Falls back to VITE_ env vars for local dev.
function getFirebaseConfig() {
  if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) {
    return window.FIREBASE_CONFIG;
  }
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

// Derive the /auth/callback URL for this deployment without hardcoding it.
// Works for GitHub Pages sub-paths, custom domains, and localhost.
function getCallbackUrl() {
  if (typeof window === 'undefined') return '';
  if (window.APP_CALLBACK_URL) return window.APP_CALLBACK_URL;
  const { origin, pathname } = window.location;
  const knownRoutes = new Set([
    'weekly', 'weekly-map', 'map', 'about', 'contact',
    'privacy', 'disclosures', 'signin', 'pricing', 'account', 'auth',
  ]);
  const baseParts = pathname.split('/').filter(p => p && !knownRoutes.has(p));
  const basePath = baseParts.length > 0 ? '/' + baseParts.join('/') : '';
  return `${origin}${basePath}/auth/callback`;
}

let firebaseApp = null;
let firebaseAuth = null;

function initFirebase() {
  if (firebaseApp) return { app: firebaseApp, auth: firebaseAuth };
  const config = getFirebaseConfig();
  if (!config?.apiKey) return null;
  firebaseApp = getApps().length ? getApps()[0] : initializeApp(config);
  firebaseAuth = getAuth(firebaseApp);
  return { app: firebaseApp, auth: firebaseAuth };
}

const AuthContext = createContext(null);

const SIGN_IN_EMAIL_KEY = 'gp_signin_email';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const firebase = initFirebase();
    if (!firebase) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(firebase.auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const sendSignInLink = useCallback(async (email) => {
    const firebase = initFirebase();
    if (!firebase) throw new Error('Firebase not configured');
    const actionCodeSettings = {
      url: getCallbackUrl(),
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(firebase.auth, email, actionCodeSettings);
    localStorage.setItem(SIGN_IN_EMAIL_KEY, email);
  }, []);

  const completeSignIn = useCallback(async (emailLink) => {
    const firebase = initFirebase();
    if (!firebase) throw new Error('Firebase not configured');
    if (!isSignInWithEmailLink(firebase.auth, emailLink)) {
      throw new Error('Invalid sign-in link');
    }
    let email = localStorage.getItem(SIGN_IN_EMAIL_KEY);
    if (!email) {
      email = window.prompt('Please enter your email to complete sign-in:');
    }
    if (!email) throw new Error('Email required to complete sign-in');
    const result = await signInWithEmailLink(firebase.auth, email, emailLink);
    localStorage.removeItem(SIGN_IN_EMAIL_KEY);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    const firebase = initFirebase();
    if (!firebase) return;
    await firebaseSignOut(firebase.auth);
    // Clear cached weekly archive so next sign-in fetches fresh data
    localStorage.removeItem('gp_weekly_archive_v1');
    localStorage.removeItem('gp_api_key');
  }, []);

  const getIdToken = useCallback(async () => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, authError, setAuthError, sendSignInLink, completeSignIn, signOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
