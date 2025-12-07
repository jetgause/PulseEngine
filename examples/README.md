# PulseEngine Examples

This directory contains example scripts demonstrating how to use the PulseEngine core library.

## Available Examples

### 1. Moving Average Strategy (`moving_average_strategy.py`)

Demonstrates:
- Creating a simple trading strategy
- Running backtests
- Optimizing strategy parameters
- Analyzing results

**Usage:**
```bash
python examples/moving_average_strategy.py
```

**What You'll Learn:**
- How to define a strategy function
- How to use the BacktestEngine
- How to use the StrategyOptimizer
- How to interpret backtest results

### 2. Options Greeks Examples (`options_greeks_examples.py`)

Demonstrates:
- Calculating Greeks for call and put options
- Understanding ATM, ITM, and OTM options
- Put-call parity
- Impact of volatility on Greeks
- Time decay effects

**Usage:**
```bash
python examples/options_greeks_examples.py
```

**What You'll Learn:**
- How to use the OptionsGreeks calculator
- Understanding Delta, Gamma, Vega, Theta, and Rho
- How option Greeks change with different parameters
- Practical insights for options trading

### 3. Paper Trading Simulation (`paper_trading_simulation.py`)

Demonstrates:
- Submitting market and limit orders
- Managing positions
- Portfolio tracking
- Multi-stock portfolios
- Rebalancing strategies

**Usage:**
```bash
python examples/paper_trading_simulation.py
```

**What You'll Learn:**
- How to use the PaperTrader class
- Order types and execution
- Position and portfolio management
- Trading multiple stocks
- P&L tracking

## Running the Examples

### Prerequisites

Make sure you have installed all dependencies:
```bash
pip install -r requirements.txt
```

### Run All Examples

You can run each example individually:
```bash
# Strategy backtesting and optimization
python examples/moving_average_strategy.py

# Options Greeks calculations
python examples/options_greeks_examples.py

# Paper trading simulation
python examples/paper_trading_simulation.py
```

## Creating Your Own Strategies

Use these examples as templates to create your own strategies. The general pattern is:

```python
from core import BacktestEngine
import pandas as pd

def my_strategy(data: pd.DataFrame, params: dict) -> pd.Series:
    """
    Your strategy logic here
    
    Args:
        data: DataFrame with OHLCV columns
        params: Dictionary of strategy parameters
        
    Returns:
        Series with signals (1=buy, -1=sell, 0=hold)
    """
    # Your logic here
    signals = pd.Series(0, index=data.index)
    # ... calculate signals ...
    return signals

# Run backtest
engine = BacktestEngine(initial_capital=100000)
results = engine.run_backtest(data, my_strategy, params)
print(results)
```

## Example Strategies to Try

Here are some popular strategies you can implement:

1. **RSI Strategy**: Buy when RSI < 30, sell when RSI > 70
2. **Bollinger Bands**: Buy at lower band, sell at upper band
3. **MACD**: Trade on MACD crossovers
4. **Mean Reversion**: Trade when price deviates from moving average
5. **Momentum**: Follow strong price trends

## Tips for Strategy Development

1. **Start Simple**: Begin with simple strategies and add complexity gradually
2. **Backtest Thoroughly**: Test on different time periods and market conditions
3. **Optimize Carefully**: Avoid overfitting by using walk-forward optimization
4. **Manage Risk**: Always include position sizing and stop-loss rules
5. **Paper Trade First**: Test strategies in paper trading before going live

## Next Steps

- Modify the example strategies
- Create your own custom strategies
- Integrate real market data
- Deploy to production with Supabase and Netlify
- Share your strategies with the community

## Need Help?

- Check the main [README.md](../README.md) for documentation
- Read the [QUICKSTART.md](../QUICKSTART.md) guide
- See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design
- Open an issue on GitHub

Happy trading! 📈
