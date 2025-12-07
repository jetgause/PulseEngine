import React, { useState } from 'react';
import { calculateGreeks } from '../services/api';
import '../styles/GreeksCalculator.css';

function GreeksCalculator() {
  const [greeksForm, setGreeksForm] = useState({
    spotPrice: 100,
    strikePrice: 100,
    timeToExpiry: 0.25,
    volatility: 0.20,
    riskFreeRate: 0.05,
    dividendYield: 0.0,
    optionType: 'call'
  });
  
  const [greeks, setGreeks] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = await calculateGreeks(
        greeksForm.spotPrice,
        greeksForm.strikePrice,
        greeksForm.timeToExpiry,
        greeksForm.volatility,
        greeksForm.riskFreeRate,
        greeksForm.dividendYield,
        greeksForm.optionType
      );
      
      setGreeks(data);
    } catch (error) {
      alert('Error calculating Greeks: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="greeks-calculator">
      <h1>Options Greeks Calculator</h1>
      
      <div className="greeks-grid">
        <section className="calculator-form-section">
          <h2>Input Parameters</h2>
          <form onSubmit={handleCalculate} className="greeks-form">
            <div className="form-group">
              <label>Option Type</label>
              <select
                value={greeksForm.optionType}
                onChange={(e) => setGreeksForm({ ...greeksForm, optionType: e.target.value })}
              >
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Spot Price ($)</label>
              <input
                type="number"
                value={greeksForm.spotPrice}
                onChange={(e) => setGreeksForm({ ...greeksForm, spotPrice: parseFloat(e.target.value) })}
                step="0.01"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Strike Price ($)</label>
              <input
                type="number"
                value={greeksForm.strikePrice}
                onChange={(e) => setGreeksForm({ ...greeksForm, strikePrice: parseFloat(e.target.value) })}
                step="0.01"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Time to Expiry (years)</label>
              <input
                type="number"
                value={greeksForm.timeToExpiry}
                onChange={(e) => setGreeksForm({ ...greeksForm, timeToExpiry: parseFloat(e.target.value) })}
                step="0.01"
                min="0.01"
                required
              />
              <span className="help-text">e.g., 0.25 for 3 months</span>
            </div>
            
            <div className="form-group">
              <label>Volatility (σ)</label>
              <input
                type="number"
                value={greeksForm.volatility}
                onChange={(e) => setGreeksForm({ ...greeksForm, volatility: parseFloat(e.target.value) })}
                step="0.01"
                min="0.01"
                required
              />
              <span className="help-text">e.g., 0.20 for 20%</span>
            </div>
            
            <div className="form-group">
              <label>Risk-Free Rate (r)</label>
              <input
                type="number"
                value={greeksForm.riskFreeRate}
                onChange={(e) => setGreeksForm({ ...greeksForm, riskFreeRate: parseFloat(e.target.value) })}
                step="0.001"
                required
              />
              <span className="help-text">e.g., 0.05 for 5%</span>
            </div>
            
            <div className="form-group">
              <label>Dividend Yield (q)</label>
              <input
                type="number"
                value={greeksForm.dividendYield}
                onChange={(e) => setGreeksForm({ ...greeksForm, dividendYield: parseFloat(e.target.value) })}
                step="0.001"
                required
              />
              <span className="help-text">e.g., 0.02 for 2%</span>
            </div>
            
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Calculating...' : 'Calculate Greeks'}
            </button>
          </form>
        </section>

        {greeks && (
          <section className="greeks-results-section">
            <h2>Greeks Results</h2>
            <div className="greeks-results">
              <div className="greek-card">
                <h3>Delta (Δ)</h3>
                <p className="greek-value">{greeks.delta?.toFixed(4)}</p>
                <p className="greek-description">
                  Rate of change of option price with respect to underlying price
                </p>
              </div>
              
              <div className="greek-card">
                <h3>Gamma (Γ)</h3>
                <p className="greek-value">{greeks.gamma?.toFixed(4)}</p>
                <p className="greek-description">
                  Rate of change of Delta with respect to underlying price
                </p>
              </div>
              
              <div className="greek-card">
                <h3>Vega (ν)</h3>
                <p className="greek-value">{greeks.vega?.toFixed(4)}</p>
                <p className="greek-description">
                  Sensitivity to volatility changes
                </p>
              </div>
              
              <div className="greek-card">
                <h3>Theta (Θ)</h3>
                <p className="greek-value">{greeks.theta?.toFixed(4)}</p>
                <p className="greek-description">
                  Time decay of option (per year)
                </p>
              </div>
              
              <div className="greek-card">
                <h3>Rho (ρ)</h3>
                <p className="greek-value">{greeks.rho?.toFixed(4)}</p>
                <p className="greek-description">
                  Sensitivity to interest rate changes
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      <section className="greeks-info">
        <h2>Understanding the Greeks</h2>
        <div className="info-grid">
          <div className="info-card">
            <h3>Delta</h3>
            <p>
              Measures the rate of change of the option value with respect to changes in the underlying asset's price.
              Call options have positive delta (0 to 1), put options have negative delta (-1 to 0).
            </p>
          </div>
          
          <div className="info-card">
            <h3>Gamma</h3>
            <p>
              Measures the rate of change in delta over a $1 change in the underlying price.
              High gamma means delta changes rapidly, indicating higher risk and reward potential.
            </p>
          </div>
          
          <div className="info-card">
            <h3>Vega</h3>
            <p>
              Measures sensitivity to volatility. Options with longer time to expiration and
              at-the-money options have higher vega values.
            </p>
          </div>
          
          <div className="info-card">
            <h3>Theta</h3>
            <p>
              Measures time decay. All options lose value as expiration approaches.
              Theta is typically negative for long positions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default GreeksCalculator;
