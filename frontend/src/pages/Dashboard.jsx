import React, { useEffect, useState } from 'react';
import { getBacktests, getPaperPortfolio, getOptimizationJobs } from '../services/api';
import '../styles/Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState({
    portfolioValue: 100000,
    totalReturn: 0,
    backtestsRun: 0,
    optimizationsRun: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // In production, fetch real user data
      const backtests = await getBacktests().catch(() => []);
      const optimizations = await getOptimizationJobs().catch(() => []);
      
      setStats(prev => ({
        ...prev,
        backtestsRun: backtests?.length || 0,
        optimizationsRun: optimizations?.length || 0
      }));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Portfolio Value</h3>
          <p className="stat-value">${stats.portfolioValue.toLocaleString()}</p>
          <span className="stat-label">Paper Trading Account</span>
        </div>
        
        <div className="stat-card">
          <h3>Total Return</h3>
          <p className={`stat-value ${stats.totalReturn >= 0 ? 'positive' : 'negative'}`}>
            {stats.totalReturn >= 0 ? '+' : ''}{(stats.totalReturn * 100).toFixed(2)}%
          </p>
          <span className="stat-label">All Time</span>
        </div>
        
        <div className="stat-card">
          <h3>Backtests</h3>
          <p className="stat-value">{stats.backtestsRun}</p>
          <span className="stat-label">Total Simulations</span>
        </div>
        
        <div className="stat-card">
          <h3>Optimizations</h3>
          <p className="stat-value">{stats.optimizationsRun}</p>
          <span className="stat-label">Strategy Tests</span>
        </div>
      </div>

      <div className="dashboard-sections">
        <section className="dashboard-section">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button className="action-btn" onClick={() => window.location.href = '/paper-trading'}>
              Start Paper Trading
            </button>
            <button className="action-btn" onClick={() => window.location.href = '/backtester'}>
              Run Backtest
            </button>
            <button className="action-btn" onClick={() => window.location.href = '/optimizer'}>
              Optimize Strategy
            </button>
            <button className="action-btn" onClick={() => window.location.href = '/greeks'}>
              Calculate Greeks
            </button>
          </div>
        </section>

        <section className="dashboard-section">
          <h2>Platform Overview</h2>
          <div className="overview-content">
            <p>
              <strong>PulseEngine</strong> is a comprehensive 3-layered trading platform designed for:
            </p>
            <ul>
              <li><strong>Paper Trading:</strong> Practice trading strategies without risking real capital</li>
              <li><strong>Backtesting:</strong> Test strategies against historical data to evaluate performance</li>
              <li><strong>Strategy Optimization:</strong> Find optimal parameters using grid search and Monte Carlo methods</li>
              <li><strong>Options Analytics:</strong> Calculate Greeks (Delta, Gamma, Vega, Theta, Rho) for options pricing</li>
            </ul>
            <p>
              All data is stored securely in Supabase with real-time synchronization.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
