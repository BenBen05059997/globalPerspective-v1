import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './components/Home';
import WorldMap from './components/WorldMap';
import './App.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<WorldMap />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
