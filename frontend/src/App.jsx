import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ToolsPage from './pages/ToolsPage';
import Dashboard from './pages/Dashboard';
import Backtester from './pages/Backtester';
import PaperTrading from './pages/PaperTrading';
import Optimizer from './pages/Optimizer';
import GreeksCalculator from './pages/GreeksCalculator';
import Layout from './components/Layout';
import './styles/App.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/backtest" element={<Backtester />} />
          <Route path="/paper-trading" element={<PaperTrading />} />
          <Route path="/optimizer" element={<Optimizer />} />
          <Route path="/greeks" element={<GreeksCalculator />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
