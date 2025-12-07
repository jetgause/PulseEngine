# PulseEngine Quick Start Guide

Get up and running with PulseEngine in 5 minutes!

## What is PulseEngine?

PulseEngine is a complete trading bot platform that provides:
- **Paper Trading**: Practice trading without risking real money
- **Backtesting**: Test strategies on historical data
- **Optimization**: Find the best parameters for your strategies
- **Options Greeks**: Calculate risk metrics for options

## Quick Setup (Local Development)

### Step 1: Install Dependencies

```bash
# Clone the repository
git clone https://github.com/jetgause/PulseEngine.git
cd PulseEngine

# Install Python package with all dependencies
pip install -e ".[all]"

# Or install with only core dependencies
# pip install -e .

# Or install with specific optional dependencies:
# pip install -e ".[api]"      # API framework support
# pip install -e ".[data]"     # Live data fetching
# pip install -e ".[analytics]" # Visualization tools
# pip install -e ".[dev]"      # Development tools

# Install frontend dependencies
cd frontend
npm install
```

### Step 2: Configure Environment

```bash
# Create environment file
cd frontend
cp .env.example .env

# Edit .env and add your Supabase credentials
# For local development, you can use dummy values
```

### Step 3: Start the Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser!

## Using the Platform

### 1. Dashboard

The dashboard shows:
- Portfolio value
- Total returns
- Number of backtests run
- Optimization jobs

### 2. Paper Trading

**Submit an Order:**
1. Go to "Paper Trading" page
2. Enter symbol (e.g., AAPL)
3. Choose Buy/Sell
4. Select Market or Limit order
5. Enter quantity
6. Click "Submit Order"

**View Portfolio:**
- See current positions
- Track unrealized P&L
- Monitor cash balance

### 3. Backtesting

**Run a Backtest:**
1. Go to "Backtester" page
2. Select a strategy (e.g., Moving Average Crossover)
3. Choose date range
4. Set initial capital
5. Configure strategy parameters
6. Click "Run Backtest"
7. View results including:
   - Total return
   - Win rate
   - Profit factor
   - Maximum drawdown

### 4. Strategy Optimization

**Optimize Parameters:**
1. Go to "Optimizer" page
2. Select strategy
3. Choose optimization method:
   - **Grid Search**: Test all combinations
   - **Monte Carlo**: Random sampling
   - **Walk Forward**: Out-of-sample testing
4. Set parameter ranges
5. Choose date range
6. Click "Start Optimization"

### 5. Options Greeks

**Calculate Greeks:**
1. Go to "Greeks Calculator" page
2. Select Call or Put
3. Enter parameters:
   - Spot price
   - Strike price
   - Time to expiry (in years)
   - Volatility
   - Risk-free rate
   - Dividend yield
4. Click "Calculate Greeks"
5. View Delta, Gamma, Vega, Theta, and Rho

## Using the Core Library (Python)

### Backtesting Example

```python
from core import BacktestEngine
import pandas as pd
import numpy as np

# Create sample data
dates = pd.date_range('2023-01-01', '2023-12-31', freq='D')
data = pd.DataFrame({
    'open': 100 + np.random.randn(len(dates)).cumsum(),
    'high': 100 + np.random.randn(len(dates)).cumsum() + 1,
    'low': 100 + np.random.randn(len(dates)).cumsum() - 1,
    'close': 100 + np.random.randn(len(dates)).cumsum(),
    'volume': np.random.randint(1000000, 10000000, len(dates))
}, index=dates)

# Define a simple strategy
def moving_average_strategy(data, params):
    short_ma = data['close'].rolling(window=params['short_window']).mean()
    long_ma = data['close'].rolling(window=params['long_window']).mean()
    
    signals = pd.Series(0, index=data.index)
    signals[short_ma > long_ma] = 1
    signals[short_ma < long_ma] = -1
    
    return signals

# Run backtest
engine = BacktestEngine(initial_capital=100000, commission=0.001)
results = engine.run_backtest(
    data, 
    moving_average_strategy, 
    {'short_window': 20, 'long_window': 50}
)

print(f"Total Return: {results['total_return']:.2%}")
print(f"Total Trades: {results['total_trades']}")
print(f"Win Rate: {results['win_rate']:.2%}")
```

### Options Greeks Example

```python
from core import OptionsGreeks

# Initialize calculator
greeks = OptionsGreeks(
    spot_price=100,      # Current stock price
    strike_price=105,    # Option strike price
    time_to_expiry=0.25, # 3 months = 0.25 years
    volatility=0.20,     # 20% volatility
    risk_free_rate=0.05, # 5% risk-free rate
    dividend_yield=0.02  # 2% dividend yield
)

# Calculate all Greeks for a call option
call_greeks = greeks.all_greeks('call')
print(f"Delta: {call_greeks['delta']:.4f}")
print(f"Gamma: {call_greeks['gamma']:.4f}")
print(f"Vega: {call_greeks['vega']:.4f}")
print(f"Theta: {call_greeks['theta']:.4f}")
print(f"Rho: {call_greeks['rho']:.4f}")

# Calculate for a put option
put_greeks = greeks.all_greeks('put')
print(f"\nPut Delta: {put_greeks['delta']:.4f}")
```

### Paper Trading Example

```python
from core import PaperTrader, OrderSide, OrderType

# Initialize paper trader with $100,000
trader = PaperTrader(initial_capital=100000, commission=0.001)

# Submit a market order to buy 100 shares
order = trader.submit_order(
    symbol='AAPL',
    side=OrderSide.BUY,
    order_type=OrderType.MARKET,
    quantity=100
)

# Execute the order at current market price
trader.execute_order(order, 150.00)

# Check portfolio
portfolio = trader.get_portfolio_summary()
print(f"Cash: ${portfolio['cash']:.2f}")
print(f"Portfolio Value: ${portfolio['portfolio_value']:.2f}")
print(f"Positions: {portfolio['num_positions']}")

# Update market data
trader.update_market_data({'AAPL': 155.00})

# Submit a limit order to sell
sell_order = trader.submit_order(
    symbol='AAPL',
    side=OrderSide.SELL,
    order_type=OrderType.LIMIT,
    quantity=100,
    price=160.00
)

# Process limit order when price condition is met
trader.update_market_data({'AAPL': 160.50})

# Final portfolio
final_portfolio = trader.get_portfolio_summary()
print(f"\nFinal P&L: ${final_portfolio['total_pnl']:.2f}")
print(f"Total Return: {final_portfolio['total_return']:.2%}")
```

### Strategy Optimization Example

```python
from core import BacktestEngine, StrategyOptimizer
import pandas as pd
import numpy as np

# Create sample data (same as backtest example)
dates = pd.date_range('2023-01-01', '2023-12-31', freq='D')
data = pd.DataFrame({
    'open': 100 + np.random.randn(len(dates)).cumsum(),
    'high': 100 + np.random.randn(len(dates)).cumsum() + 1,
    'low': 100 + np.random.randn(len(dates)).cumsum() - 1,
    'close': 100 + np.random.randn(len(dates)).cumsum(),
    'volume': np.random.randint(1000000, 10000000, len(dates))
}, index=dates)

# Define strategy (same as before)
def moving_average_strategy(data, params):
    short_ma = data['close'].rolling(window=params['short_window']).mean()
    long_ma = data['close'].rolling(window=params['long_window']).mean()
    
    signals = pd.Series(0, index=data.index)
    signals[short_ma > long_ma] = 1
    signals[short_ma < long_ma] = -1
    
    return signals

# Initialize optimizer
engine = BacktestEngine(initial_capital=100000, commission=0.001)
optimizer = StrategyOptimizer(engine, data)

# Define parameter grid
param_grid = {
    'short_window': [10, 20, 30],
    'long_window': [40, 50, 60, 70]
}

# Run grid search
results = optimizer.grid_search(
    moving_average_strategy,
    param_grid,
    metric='total_return'
)

print(f"Best Parameters: {results['best_params']}")
print(f"Best Return: {results['best_metric']:.2%}")
print(f"Total Combinations Tested: {len(results['all_results'])}")
```

## Next Steps

### For Development
1. Set up Supabase project (see DEPLOYMENT.md)
2. Configure environment variables
3. Deploy Edge Functions
4. Deploy frontend to Netlify

### For Production Use
1. Add real market data integration
2. Implement user authentication
3. Add more strategies
4. Set up monitoring and alerts
5. Implement risk management rules

## Common Issues

### Frontend won't start
- Make sure you ran `npm install` in the frontend directory
- Check that Node.js version is 18+
- Try deleting `node_modules` and reinstalling

### Python imports not working
- Ensure you installed the package: `pip install -e ".[all]"`
- Check that you're in the correct directory
- Try creating a virtual environment and reinstalling

### Can't connect to Supabase
- Verify your `.env` file has correct credentials
- Check that Supabase project is running
- Test Edge Functions separately

## Getting Help

- **Documentation**: See README.md and DEPLOYMENT.md
- **Issues**: https://github.com/jetgause/PulseEngine/issues
- **Discussions**: https://github.com/jetgause/PulseEngine/discussions

## What's Next?

- Explore different strategies
- Try optimizing parameters
- Calculate Greeks for different scenarios
- Practice paper trading
- Read the full documentation

Happy trading! 🚀
