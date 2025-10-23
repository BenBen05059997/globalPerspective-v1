// global-perspectives-starter/frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './components/Home';
import WorldMap from './components/WorldMap';
import './App.css';

export default function App() {
  return (
    <BrowserRouter basename="/globalPerspective-v1">
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<WorldMap />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
