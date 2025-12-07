import React, { useState } from 'react';
import { startOptimization } from '../services/api';
import '../styles/Optimizer.css';

function Optimizer() {
  const [optimizeForm, setOptimizeForm] = useState({
    strategyName: 'moving_average_crossover',
    method: 'grid_search',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    paramGrid: {
      short_window: [10, 20, 30],
      long_window: [40, 50, 60]
    }
  });
  
  const [jobId, setJobId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleStartOptimization = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = await startOptimization(
        optimizeForm.strategyName,
        optimizeForm.method,
        optimizeForm.paramGrid,
        optimizeForm.startDate,
        optimizeForm.endDate
      );
      
      setJobId(data.job_id);
      alert('Optimization job started! Job ID: ' + data.job_id);
    } catch (error) {
      alert('Error starting optimization: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="optimizer">
      <h1>Strategy Optimizer</h1>
      
      <div className="optimizer-content">
        <section className="optimize-form-section">
          <h2>Configure Optimization</h2>
          <form onSubmit={handleStartOptimization} className="optimize-form">
            <div className="form-group">
              <label>Strategy</label>
              <select
                value={optimizeForm.strategyName}
                onChange={(e) => setOptimizeForm({ ...optimizeForm, strategyName: e.target.value })}
              >
                <option value="moving_average_crossover">Moving Average Crossover</option>
                <option value="rsi">RSI Strategy</option>
                <option value="bollinger_bands">Bollinger Bands</option>
                <option value="macd">MACD Strategy</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Optimization Method</label>
              <select
                value={optimizeForm.method}
                onChange={(e) => setOptimizeForm({ ...optimizeForm, method: e.target.value })}
              >
                <option value="grid_search">Grid Search</option>
                <option value="monte_carlo">Monte Carlo</option>
                <option value="walk_forward">Walk Forward</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={optimizeForm.startDate}
                onChange={(e) => setOptimizeForm({ ...optimizeForm, startDate: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={optimizeForm.endDate}
                onChange={(e) => setOptimizeForm({ ...optimizeForm, endDate: e.target.value })}
                required
              />
            </div>
            
            <div className="param-grid-section">
              <h3>Parameter Grid</h3>
              <p className="help-text">
                Define the parameter ranges to test. The optimizer will test all combinations.
              </p>
              <div className="param-grid-display">
                <pre>{JSON.stringify(optimizeForm.paramGrid, null, 2)}</pre>
              </div>
            </div>
            
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Starting...' : 'Start Optimization'}
            </button>
          </form>
        </section>

        <section className="info-section">
          <h2>Optimization Methods</h2>
          
          <div className="method-info">
            <h3>Grid Search</h3>
            <p>
              Exhaustively tests all parameter combinations. Best for finding optimal parameters
              when you have a small search space.
            </p>
          </div>
          
          <div className="method-info">
            <h3>Monte Carlo</h3>
            <p>
              Randomly samples parameter combinations. More efficient for large search spaces
              and can provide statistical insights.
            </p>
          </div>
          
          <div className="method-info">
            <h3>Walk Forward</h3>
            <p>
              Optimizes on a training period and tests on an out-of-sample period. Helps
              prevent overfitting and provides more realistic performance estimates.
            </p>
          </div>

          {jobId && (
            <div className="job-status">
              <h3>Optimization Started</h3>
              <p>Job ID: {jobId}</p>
              <p>Status: Running</p>
              <p className="help-text">
                Check back later to see the results. You can view all optimization jobs
                in your dashboard.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Optimizer;
