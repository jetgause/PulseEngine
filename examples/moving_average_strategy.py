"""
Example: Simple Moving Average Crossover Strategy
This strategy generates buy signals when the short-term moving average crosses above
the long-term moving average, and sell signals when it crosses below.
"""

import pandas as pd
import numpy as np
from core import BacktestEngine, StrategyOptimizer


def moving_average_crossover(data: pd.DataFrame, params: dict) -> pd.Series:
    """
    Moving Average Crossover Strategy
    
    Args:
        data: DataFrame with OHLCV data
        params: Dictionary with 'short_window' and 'long_window'
        
    Returns:
        Series with signals (1 = buy, -1 = sell, 0 = hold)
    """
    short_window = params.get('short_window', 20)
    long_window = params.get('long_window', 50)
    
    # Calculate moving averages
    short_ma = data['close'].rolling(window=short_window).mean()
    long_ma = data['close'].rolling(window=long_window).mean()
    
    # Generate signals
    signals = pd.Series(0, index=data.index)
    
    # Buy when short MA crosses above long MA
    signals[short_ma > long_ma] = 1
    
    # Sell when short MA crosses below long MA
    signals[short_ma < long_ma] = -1
    
    return signals


def run_example():
    """Run the moving average crossover strategy example"""
    
    # Generate sample data (replace with real data in production)
    print("Generating sample data...")
    dates = pd.date_range('2023-01-01', '2023-12-31', freq='D')
    
    # Simulate price data with trend and noise
    trend = np.linspace(100, 120, len(dates))
    noise = np.random.randn(len(dates)) * 2
    close_prices = trend + noise
    
    data = pd.DataFrame({
        'open': close_prices + np.random.randn(len(dates)) * 0.5,
        'high': close_prices + abs(np.random.randn(len(dates))) * 1,
        'low': close_prices - abs(np.random.randn(len(dates))) * 1,
        'close': close_prices,
        'volume': np.random.randint(1000000, 10000000, len(dates))
    }, index=dates)
    
    # Initialize backtest engine
    print("\nInitializing backtest engine...")
    engine = BacktestEngine(
        initial_capital=100000,
        commission=0.001  # 0.1% commission
    )
    
    # Run backtest with default parameters
    print("\nRunning backtest with default parameters...")
    params = {'short_window': 20, 'long_window': 50}
    results = engine.run_backtest(data, moving_average_crossover, params)
    
    # Print results
    print("\n" + "="*50)
    print("BACKTEST RESULTS")
    print("="*50)
    print(f"Strategy: Moving Average Crossover")
    print(f"Parameters: Short={params['short_window']}, Long={params['long_window']}")
    print(f"\nInitial Capital: ${engine.initial_capital:,.2f}")
    print(f"Final Capital: ${results['final_capital']:,.2f}")
    print(f"Total Return: {results['total_return']:.2%}")
    print(f"Total P&L: ${results['total_pnl']:,.2f}")
    print(f"\nTotal Trades: {results['total_trades']}")
    print(f"Winning Trades: {results['winning_trades']}")
    print(f"Losing Trades: {results['losing_trades']}")
    print(f"Win Rate: {results['win_rate']:.2%}")
    print(f"\nAverage Win: ${results['avg_win']:,.2f}")
    print(f"Average Loss: ${results['avg_loss']:,.2f}")
    print(f"Profit Factor: {results['profit_factor']:.2f}")
    print(f"Max Drawdown: {results['max_drawdown']:.2%}")
    print("="*50)
    
    # Now optimize the strategy
    print("\n\nOptimizing strategy parameters...")
    optimizer = StrategyOptimizer(engine, data)
    
    param_grid = {
        'short_window': [10, 15, 20, 25],
        'long_window': [40, 50, 60, 70]
    }
    
    optimization_results = optimizer.grid_search(
        moving_average_crossover,
        param_grid,
        metric='total_return'
    )
    
    print("\n" + "="*50)
    print("OPTIMIZATION RESULTS")
    print("="*50)
    print(f"Combinations Tested: {len(optimization_results['all_results'])}")
    print(f"\nBest Parameters: {optimization_results['best_params']}")
    print(f"Best Return: {optimization_results['best_metric']:.2%}")
    print("\nTop 5 Parameter Combinations:")
    
    # Sort results by total return
    sorted_results = sorted(
        optimization_results['all_results'],
        key=lambda x: x['total_return'],
        reverse=True
    )[:5]
    
    for i, result in enumerate(sorted_results, 1):
        print(f"\n{i}. Parameters: {result['params']}")
        print(f"   Return: {result['total_return']:.2%}")
        print(f"   Trades: {result['total_trades']}")
        print(f"   Win Rate: {result['win_rate']:.2%}")
    
    print("="*50)


if __name__ == '__main__':
    run_example()
