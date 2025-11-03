// global-perspectives-starter/frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import Home from './components/Home';
import WorldMap from './components/WorldMap';
import PrivacyTerms from './components/PrivacyTerms';
import AboutContact from './components/AboutContact';
import Disclosures from './components/Disclosures';
import Contact from './components/Contact';

function resolveBasename() {
  const rawBase = import.meta.env.BASE_URL ?? '/';

  if (rawBase && rawBase !== '/' && rawBase !== './') {
    return rawBase.replace(/\/+$/, '');
  }

  if (!import.meta.env.DEV && typeof window !== 'undefined') {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return `/${segments[0]}`;
    }
  }

  return undefined;
}

export default function App() {
  const basename = resolveBasename();

  return (
    <BrowserRouter basename={basename}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<WorldMap />} />
          <Route path="/privacy" element={<PrivacyTerms />} />
          <Route path="/about" element={<AboutContact />} />
          <Route path="/disclosures" element={<Disclosures />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
