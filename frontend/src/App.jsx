<<<<<<< HEAD
import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ToolsPage from './pages/ToolsPage'
import Layout from './components/Layout'
=======
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Backtester from './pages/Backtester';
import PaperTrading from './pages/PaperTrading';
import Optimizer from './pages/Optimizer';
import GreeksCalculator from './pages/GreeksCalculator';
import './styles/App.css';
>>>>>>> main

function App() {
  return (
    <Router>
<<<<<<< HEAD
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tools" element={<ToolsPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
=======
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <h1>PulseEngine</h1>
            <p className="tagline">Advanced Trading Platform</p>
          </div>
          <ul className="nav-links">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/paper-trading">Paper Trading</Link></li>
            <li><Link to="/backtester">Backtester</Link></li>
            <li><Link to="/optimizer">Optimizer</Link></li>
            <li><Link to="/greeks">Greeks Calculator</Link></li>
          </ul>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/paper-trading" element={<PaperTrading />} />
            <Route path="/backtester" element={<Backtester />} />
            <Route path="/optimizer" element={<Optimizer />} />
            <Route path="/greeks" element={<GreeksCalculator />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>&copy; 2024 PulseEngine. All rights reserved.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
>>>>>>> main
