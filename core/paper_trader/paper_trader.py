"""
Paper Trading System
Simulates live trading without real money
"""

from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import json


class OrderStatus(Enum):
    """Order status types"""
    PENDING = "pending"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class OrderType(Enum):
    """Order types"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderSide(Enum):
    """Order side"""
    BUY = "buy"
    SELL = "sell"


@dataclass
class Order:
    """Represents a trading order"""
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: Optional[float] = None
    stop_price: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    filled_price: Optional[float] = None
    created_at: datetime = None
    filled_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
    
    def to_dict(self) -> Dict:
        """Convert order to dictionary"""
        data = asdict(self)
        data['side'] = self.side.value
        data['order_type'] = self.order_type.value
        data['status'] = self.status.value
        data['created_at'] = self.created_at.isoformat() if self.created_at else None
        data['filled_at'] = self.filled_at.isoformat() if self.filled_at else None
        return data


@dataclass
class Position:
    """Represents a trading position"""
    symbol: str
    quantity: float
    avg_price: float
    current_price: float
    
    @property
    def market_value(self) -> float:
        """Current market value of position"""
        return self.quantity * self.current_price
    
    @property
    def unrealized_pnl(self) -> float:
        """Unrealized profit/loss"""
        return (self.current_price - self.avg_price) * self.quantity
    
    @property
    def unrealized_pnl_pct(self) -> float:
        """Unrealized profit/loss percentage"""
        return (self.current_price - self.avg_price) / self.avg_price
    
    def to_dict(self) -> Dict:
        """Convert position to dictionary"""
        return {
            "symbol": self.symbol,
            "quantity": self.quantity,
            "avg_price": self.avg_price,
            "current_price": self.current_price,
            "market_value": self.market_value,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": self.unrealized_pnl_pct
        }


class PaperTrader:
    """Paper trading engine"""
    
    def __init__(self, initial_capital: float = 100000.0, commission: float = 0.001):
        """
        Initialize paper trader
        
        Args:
            initial_capital: Starting capital
            commission: Commission rate per trade
        """
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.commission = commission
        self.positions: Dict[str, Position] = {}
        self.orders: List[Order] = []
        self.trade_history: List[Dict] = []
        self.order_counter = 0
        
    def submit_order(self, symbol: str, side: OrderSide, order_type: OrderType,
                    quantity: float, price: Optional[float] = None,
                    stop_price: Optional[float] = None) -> Order:
        """
        Submit a new order
        
        Args:
            symbol: Trading symbol
            side: Buy or sell
            order_type: Type of order
            quantity: Number of shares
            price: Limit price (for limit orders)
            stop_price: Stop price (for stop orders)
            
        Returns:
            Order object
        """
        self.order_counter += 1
        order_id = f"ORDER_{self.order_counter}_{datetime.now().timestamp()}"
        
        order = Order(
            order_id=order_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price,
            stop_price=stop_price
        )
        
        self.orders.append(order)
        return order
    
    def execute_order(self, order: Order, execution_price: float) -> bool:
        """
        Execute an order at the given price
        
        Args:
            order: Order to execute
            execution_price: Price at which to execute
            
        Returns:
            True if execution successful
        """
        if order.status != OrderStatus.PENDING:
            return False
        
        # Calculate cost/proceeds including commission
        trade_value = order.quantity * execution_price
        commission_cost = trade_value * self.commission
        
        if order.side == OrderSide.BUY:
            total_cost = trade_value + commission_cost
            
            # Check if sufficient cash
            if total_cost > self.cash:
                order.status = OrderStatus.REJECTED
                return False
            
            # Execute buy
            self.cash -= total_cost
            self._add_to_position(order.symbol, order.quantity, execution_price)
            
        else:  # SELL
            # Check if position exists
            if order.symbol not in self.positions:
                order.status = OrderStatus.REJECTED
                return False
            
            position = self.positions[order.symbol]
            
            # Check if sufficient shares
            if order.quantity > position.quantity:
                order.status = OrderStatus.REJECTED
                return False
            
            # Execute sell
            proceeds = trade_value - commission_cost
            self.cash += proceeds
            self._remove_from_position(order.symbol, order.quantity)
        
        # Update order status
        order.status = OrderStatus.FILLED
        order.filled_quantity = order.quantity
        order.filled_price = execution_price
        order.filled_at = datetime.now()
        
        # Record trade
        self.trade_history.append({
            "timestamp": datetime.now().isoformat(),
            "order_id": order.order_id,
            "symbol": order.symbol,
            "side": order.side.value,
            "quantity": order.quantity,
            "price": execution_price,
            "commission": commission_cost
        })
        
        return True
    
    def process_market_order(self, order: Order, current_price: float) -> bool:
        """Process a market order immediately"""
        return self.execute_order(order, current_price)
    
    def process_limit_order(self, order: Order, current_price: float) -> bool:
        """Process a limit order if price conditions are met"""
        if order.price is None:
            return False
        
        if order.side == OrderSide.BUY and current_price <= order.price:
            return self.execute_order(order, order.price)
        elif order.side == OrderSide.SELL and current_price >= order.price:
            return self.execute_order(order, order.price)
        
        return False
    
    def update_market_data(self, prices: Dict[str, float]):
        """
        Update market data and process pending orders
        
        Args:
            prices: Dictionary mapping symbols to current prices
        """
        # Update position prices
        for symbol, position in self.positions.items():
            if symbol in prices:
                position.current_price = prices[symbol]
        
        # Process pending orders
        for order in self.orders:
            if order.status != OrderStatus.PENDING:
                continue
            
            if order.symbol not in prices:
                continue
            
            current_price = prices[order.symbol]
            
            if order.order_type == OrderType.MARKET:
                self.process_market_order(order, current_price)
            elif order.order_type == OrderType.LIMIT:
                self.process_limit_order(order, current_price)
    
    def _add_to_position(self, symbol: str, quantity: float, price: float):
        """Add shares to a position"""
        if symbol in self.positions:
            position = self.positions[symbol]
            total_cost = position.avg_price * position.quantity + price * quantity
            position.quantity += quantity
            position.avg_price = total_cost / position.quantity
        else:
            self.positions[symbol] = Position(
                symbol=symbol,
                quantity=quantity,
                avg_price=price,
                current_price=price
            )
    
    def _remove_from_position(self, symbol: str, quantity: float):
        """Remove shares from a position"""
        if symbol not in self.positions:
            return
        
        position = self.positions[symbol]
        position.quantity -= quantity
        
        if position.quantity <= 0:
            del self.positions[symbol]
    
    def get_portfolio_value(self) -> float:
        """Calculate total portfolio value"""
        positions_value = sum(pos.market_value for pos in self.positions.values())
        return self.cash + positions_value
    
    def get_portfolio_summary(self) -> Dict:
        """Get portfolio summary"""
        portfolio_value = self.get_portfolio_value()
        total_pnl = portfolio_value - self.initial_capital
        total_return = total_pnl / self.initial_capital
        
        return {
            "cash": self.cash,
            "positions_value": sum(pos.market_value for pos in self.positions.values()),
            "portfolio_value": portfolio_value,
            "total_pnl": total_pnl,
            "total_return": total_return,
            "positions": [pos.to_dict() for pos in self.positions.values()],
            "num_positions": len(self.positions),
            "num_orders": len(self.orders),
            "num_trades": len(self.trade_history)
        }
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel a pending order"""
        for order in self.orders:
            if order.order_id == order_id and order.status == OrderStatus.PENDING:
                order.status = OrderStatus.CANCELLED
                return True
        return False
