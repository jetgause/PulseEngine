"""
Backtesting Engine
Simulates trading strategies on historical data
"""

from datetime import datetime
from typing import List, Dict, Callable, Optional
import pandas as pd


class Trade:
    """Represents a single trade"""
    
    def __init__(self, symbol: str, entry_time: datetime, entry_price: float,
                 quantity: int, side: str, exit_time: Optional[datetime] = None,
                 exit_price: Optional[float] = None):
        self.symbol = symbol
        self.entry_time = entry_time
        self.entry_price = entry_price
        self.quantity = quantity
        self.side = side  # "long" or "short"
        self.exit_time = exit_time
        self.exit_price = exit_price
        
    @property
    def pnl(self) -> Optional[float]:
        """Calculate P&L if trade is closed"""
        if self.exit_price is None:
            return None
        
        if self.side == "long":
            return (self.exit_price - self.entry_price) * self.quantity
        else:
            return (self.entry_price - self.exit_price) * self.quantity
    
    def to_dict(self) -> Dict:
        """Convert trade to dictionary"""
        return {
            "symbol": self.symbol,
            "entry_time": self.entry_time.isoformat() if self.entry_time else None,
            "entry_price": self.entry_price,
            "quantity": self.quantity,
            "side": self.side,
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
            "exit_price": self.exit_price,
            "pnl": self.pnl
        }


class BacktestEngine:
    """Backtesting engine for trading strategies"""
    
    def __init__(self, initial_capital: float = 100000.0, commission: float = 0.001):
        """
        Initialize backtest engine
        
        Args:
            initial_capital: Starting capital
            commission: Commission rate per trade (default 0.1%)
        """
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.commission = commission
        self.trades: List[Trade] = []
        self.equity_curve: List[Dict] = []
        
    def run_backtest(self, data: pd.DataFrame, strategy: Callable,
                     params: Optional[Dict] = None) -> Dict:
        """
        Run backtest on historical data
        
        Args:
            data: DataFrame with OHLCV data (columns: open, high, low, close, volume)
            strategy: Strategy function that takes (data, params) and returns signals
            params: Strategy parameters
            
        Returns:
            Dictionary with backtest results
        """
        self.capital = self.initial_capital
        self.trades = []
        self.equity_curve = []
        
        if params is None:
            params = {}
        
        # Generate signals from strategy
        signals = strategy(data, params)
        
        # Track positions
        position = None
        
        for i, (idx, row) in enumerate(data.iterrows()):
            signal = signals.iloc[i] if i < len(signals) else 0
            
            # Record equity
            current_value = self.capital
            if position:
                current_value += (row['close'] - position.entry_price) * position.quantity
            
            self.equity_curve.append({
                'timestamp': idx,
                'equity': current_value,
                'capital': self.capital
            })
            
            # Execute trades based on signals
            if signal > 0 and position is None:
                # Enter long position
                quantity = int(self.capital * 0.95 / row['close'])
                cost = quantity * row['close'] * (1 + self.commission)
                
                if cost <= self.capital:
                    position = Trade(
                        symbol="SYMBOL",
                        entry_time=idx,
                        entry_price=row['close'],
                        quantity=quantity,
                        side="long"
                    )
                    self.capital -= cost
                    
            elif signal < 0 and position is not None:
                # Exit position
                proceeds = position.quantity * row['close'] * (1 - self.commission)
                position.exit_time = idx
                position.exit_price = row['close']
                self.capital += proceeds
                self.trades.append(position)
                position = None
        
        # Close any open position at the end
        if position is not None:
            last_price = data.iloc[-1]['close']
            proceeds = position.quantity * last_price * (1 - self.commission)
            position.exit_time = data.index[-1]
            position.exit_price = last_price
            self.capital += proceeds
            self.trades.append(position)
        
        return self._calculate_metrics()
    
    def _calculate_metrics(self) -> Dict:
        """Calculate backtest performance metrics"""
        if not self.trades:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "total_pnl": 0.0,
                "total_return": 0.0,
                "win_rate": 0.0,
                "avg_win": 0.0,
                "avg_loss": 0.0,
                "profit_factor": 0.0,
                "final_capital": self.capital
            }
        
        winning_trades = [t for t in self.trades if t.pnl and t.pnl > 0]
        losing_trades = [t for t in self.trades if t.pnl and t.pnl < 0]
        
        total_pnl = sum(t.pnl for t in self.trades if t.pnl)
        total_return = (self.capital - self.initial_capital) / self.initial_capital
        
        avg_win = sum(t.pnl for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = abs(sum(t.pnl for t in losing_trades) / len(losing_trades)) if losing_trades else 0
        
        gross_profit = sum(t.pnl for t in winning_trades)
        gross_loss = abs(sum(t.pnl for t in losing_trades))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
        
        return {
            "total_trades": len(self.trades),
            "winning_trades": len(winning_trades),
            "losing_trades": len(losing_trades),
            "total_pnl": total_pnl,
            "total_return": total_return,
            "win_rate": len(winning_trades) / len(self.trades),
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "profit_factor": profit_factor,
            "final_capital": self.capital,
            "max_drawdown": self._calculate_max_drawdown()
        }
    
    def _calculate_max_drawdown(self) -> float:
        """Calculate maximum drawdown from equity curve"""
        if not self.equity_curve:
            return 0.0
        
        equity_values = [point['equity'] for point in self.equity_curve]
        peak = equity_values[0]
        max_dd = 0.0
        
        for value in equity_values:
            if value > peak:
                peak = value
            dd = (peak - value) / peak
            if dd > max_dd:
                max_dd = dd
        
        return max_dd
