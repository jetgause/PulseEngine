import React, { useState, useEffect } from 'react';
import { submitPaperOrder, getPaperPortfolio, getPaperTradeHistory } from '../services/api';
import '../styles/PaperTrading.css';

function PaperTrading() {
  const [portfolio, setPortfolio] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [orderForm, setOrderForm] = useState({
    symbol: '',
    side: 'buy',
    orderType: 'market',
    quantity: '',
    price: ''
  });

  useEffect(() => {
    loadPortfolio();
    loadTradeHistory();
  }, []);

  const loadPortfolio = async () => {
    try {
      // Mock user ID - in production, get from auth
      const userId = 'demo-user';
      const data = await getPaperPortfolio(userId);
      setPortfolio(data);
    } catch (error) {
      console.error('Error loading portfolio:', error);
      // Set mock data for demo
      setPortfolio({
        account: {
          cash: 95000,
          portfolio_value: 105000,
          total_pnl: 5000,
          total_return: 0.05
        },
        positions: [
          { symbol: 'AAPL', quantity: 50, avg_price: 150, current_price: 160, unrealized_pnl: 500 },
          { symbol: 'GOOGL', quantity: 20, avg_price: 120, current_price: 125, unrealized_pnl: 100 }
        ]
      });
    }
  };

  const loadTradeHistory = async () => {
    try {
      const userId = 'demo-user';
      const data = await getPaperTradeHistory(userId);
      setTradeHistory(data?.trades || []);
    } catch (error) {
      console.error('Error loading trade history:', error);
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    
    try {
      const userId = 'demo-user';
      await submitPaperOrder(
        userId,
        orderForm.symbol.toUpperCase(),
        orderForm.side,
        orderForm.orderType,
        parseFloat(orderForm.quantity),
        orderForm.price ? parseFloat(orderForm.price) : null
      );
      
      alert('Order submitted successfully!');
      setOrderForm({ symbol: '', side: 'buy', orderType: 'market', quantity: '', price: '' });
      loadPortfolio();
      loadTradeHistory();
    } catch (error) {
      alert('Error submitting order: ' + error.message);
    }
  };

  return (
    <div className="paper-trading">
      <h1>Paper Trading</h1>
      
      <div className="trading-grid">
        <section className="portfolio-section">
          <h2>Portfolio Summary</h2>
          {portfolio && (
            <div className="portfolio-details">
              <div className="portfolio-stat">
                <span>Cash:</span>
                <span>${portfolio.account.cash?.toLocaleString()}</span>
              </div>
              <div className="portfolio-stat">
                <span>Portfolio Value:</span>
                <span>${portfolio.account.portfolio_value?.toLocaleString()}</span>
              </div>
              <div className="portfolio-stat">
                <span>Total P&L:</span>
                <span className={portfolio.account.total_pnl >= 0 ? 'positive' : 'negative'}>
                  ${portfolio.account.total_pnl?.toLocaleString()}
                </span>
              </div>
              <div className="portfolio-stat">
                <span>Total Return:</span>
                <span className={portfolio.account.total_return >= 0 ? 'positive' : 'negative'}>
                  {(portfolio.account.total_return * 100)?.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="order-form-section">
          <h2>Place Order</h2>
          <form onSubmit={handleSubmitOrder} className="order-form">
            <div className="form-group">
              <label>Symbol</label>
              <input
                type="text"
                value={orderForm.symbol}
                onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value })}
                placeholder="AAPL"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Side</label>
              <select
                value={orderForm.side}
                onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value })}
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Order Type</label>
              <select
                value={orderForm.orderType}
                onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value })}
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                value={orderForm.quantity}
                onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                placeholder="100"
                min="1"
                required
              />
            </div>
            
            {orderForm.orderType === 'limit' && (
              <div className="form-group">
                <label>Limit Price</label>
                <input
                  type="number"
                  value={orderForm.price}
                  onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
                  placeholder="150.00"
                  step="0.01"
                  required
                />
              </div>
            )}
            
            <button type="submit" className="submit-btn">Submit Order</button>
          </form>
        </section>
      </div>

      <section className="positions-section">
        <h2>Current Positions</h2>
        {portfolio && portfolio.positions && portfolio.positions.length > 0 ? (
          <table className="positions-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Avg Price</th>
                <th>Current Price</th>
                <th>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((position, index) => (
                <tr key={index}>
                  <td>{position.symbol}</td>
                  <td>{position.quantity}</td>
                  <td>${position.avg_price?.toFixed(2)}</td>
                  <td>${position.current_price?.toFixed(2)}</td>
                  <td className={position.unrealized_pnl >= 0 ? 'positive' : 'negative'}>
                    ${position.unrealized_pnl?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No open positions</p>
        )}
      </section>
    </div>
  );
}

export default PaperTrading;
