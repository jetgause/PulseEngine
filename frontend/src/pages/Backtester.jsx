import React, { useState } from 'react';
import { runBacktest } from '../services/api';
import '../styles/Backtester.css';

function Backtester() {
  const [backtestForm, setBacktestForm] = useState({
    strategyName: 'moving_average_crossover',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialCapital: 100000,
    params: {
      short_window: 20,
      long_window: 50
    }
  });
  
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRunBacktest = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = await runBacktest(
        backtestForm.strategyName,
        backtestForm.params,
        backtestForm.startDate,
        backtestForm.endDate,
        backtestForm.initialCapital
      );
      
      setResults(data);
    } catch (error) {
      alert('Error running backtest: ' + error.message);
      // Set mock results for demo
      setResults({
        results: {
          total_return: 0.15,
          total_trades: 25,
          winning_trades: 15,
          losing_trades: 10,
          win_rate: 0.60,
          profit_factor: 1.5,
          max_drawdown: 0.12,
          total_pnl: 15000
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="backtester">
      <h1>Backtesting Engine</h1>
      
      <div className="backtest-grid">
        <section className="backtest-form-section">
          <h2>Configure Backtest</h2>
          <form onSubmit={handleRunBacktest} className="backtest-form">
            <div className="form-group">
              <label>Strategy</label>
              <select
                value={backtestForm.strategyName}
                onChange={(e) => setBacktestForm({ ...backtestForm, strategyName: e.target.value })}
              >
                <option value="moving_average_crossover">Moving Average Crossover</option>
                <option value="rsi">RSI Strategy</option>
                <option value="bollinger_bands">Bollinger Bands</option>
                <option value="macd">MACD Strategy</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={backtestForm.startDate}
                onChange={(e) => setBacktestForm({ ...backtestForm, startDate: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={backtestForm.endDate}
                onChange={(e) => setBacktestForm({ ...backtestForm, endDate: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Initial Capital</label>
              <input
                type="number"
                value={backtestForm.initialCapital}
                onChange={(e) => setBacktestForm({ ...backtestForm, initialCapital: parseFloat(e.target.value) })}
                min="1000"
                step="1000"
                required
              />
            </div>
            
            <div className="params-section">
              <h3>Strategy Parameters</h3>
              <div className="form-group">
                <label>Short Window</label>
                <input
                  type="number"
                  value={backtestForm.params.short_window}
                  onChange={(e) => setBacktestForm({
                    ...backtestForm,
                    params: { ...backtestForm.params, short_window: parseInt(e.target.value) }
                  })}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Long Window</label>
                <input
                  type="number"
                  value={backtestForm.params.long_window}
                  onChange={(e) => setBacktestForm({
                    ...backtestForm,
                    params: { ...backtestForm.params, long_window: parseInt(e.target.value) }
                  })}
                  min="1"
                />
              </div>
            </div>
            
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Running...' : 'Run Backtest'}
            </button>
          </form>
        </section>

        {results && (
          <section className="results-section">
            <h2>Backtest Results</h2>
            <div className="results-grid">
              <div className="result-card">
                <h3>Total Return</h3>
                <p className={`result-value ${results.results.total_return >= 0 ? 'positive' : 'negative'}`}>
                  {(results.results.total_return * 100).toFixed(2)}%
                </p>
              </div>
              
              <div className="result-card">
                <h3>Total P&L</h3>
                <p className={`result-value ${results.results.total_pnl >= 0 ? 'positive' : 'negative'}`}>
                  ${results.results.total_pnl?.toLocaleString()}
                </p>
              </div>
              
              <div className="result-card">
                <h3>Total Trades</h3>
                <p className="result-value">{results.results.total_trades}</p>
              </div>
              
              <div className="result-card">
                <h3>Win Rate</h3>
                <p className="result-value">{(results.results.win_rate * 100).toFixed(2)}%</p>
              </div>
              
              <div className="result-card">
                <h3>Profit Factor</h3>
                <p className="result-value">{results.results.profit_factor?.toFixed(2)}</p>
              </div>
              
              <div className="result-card">
                <h3>Max Drawdown</h3>
                <p className="result-value negative">
                  {(results.results.max_drawdown * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            
            <div className="trade-details">
              <h3>Trade Statistics</h3>
              <p>Winning Trades: {results.results.winning_trades}</p>
              <p>Losing Trades: {results.results.losing_trades}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Backtester;
