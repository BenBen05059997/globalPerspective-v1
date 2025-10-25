// global-perspectives-starter/frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import Home from './components/Home';
import WorldMap from './components/WorldMap';
import PrivacyTerms from './components/PrivacyTerms';
import AboutContact from './components/AboutContact';
import Disclosures from './components/Disclosures';

export default function App() {
  const rawBase = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = rawBase.replace(/\/+$/, '').replace(/^\.+/, '');
  const basename = normalizedBase || undefined;

  return (
    <BrowserRouter basename={basename}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<WorldMap />} />
          <Route path="/privacy" element={<PrivacyTerms />} />
          <Route path="/about" element={<AboutContact />} />
          <Route path="/disclosures" element={<Disclosures />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
