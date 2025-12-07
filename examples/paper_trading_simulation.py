"""
Example: Paper Trading Simulation
Demonstrates how to use the paper trading system
"""

from core import PaperTrader, OrderSide, OrderType
from datetime import datetime


def simulate_day_trading():
    """Simulate a day of paper trading"""
    
    print("="*60)
    print("PAPER TRADING SIMULATION")
    print("="*60)
    
    # Initialize paper trader with $100,000
    trader = PaperTrader(initial_capital=100000, commission=0.001)
    
    print(f"\nStarting Capital: ${trader.cash:,.2f}")
    print("\nStarting day trading simulation...\n")
    
    # Morning: Buy AAPL
    print("9:30 AM - Market Opens")
    print("-" * 40)
    print("Action: Buy 100 shares of AAPL at $150.00")
    
    buy_order = trader.submit_order(
        symbol='AAPL',
        side=OrderSide.BUY,
        order_type=OrderType.MARKET,
        quantity=100
    )
    
    trader.execute_order(buy_order, 150.00)
    print(f"✓ Order executed: {buy_order.order_id}")
    
    portfolio = trader.get_portfolio_summary()
    print(f"Cash remaining: ${portfolio['cash']:,.2f}")
    print(f"Portfolio value: ${portfolio['portfolio_value']:,.2f}")
    
    # Mid-day: Price goes up, buy more
    print("\n\n11:00 AM - Price Movement")
    print("-" * 40)
    print("AAPL price rises to $152.00")
    
    trader.update_market_data({'AAPL': 152.00})
    portfolio = trader.get_portfolio_summary()
    
    print(f"Unrealized P&L: ${portfolio['total_pnl']:,.2f}")
    print(f"Portfolio value: ${portfolio['portfolio_value']:,.2f}")
    
    print("\nAction: Buy 50 more shares at $152.00")
    buy_order2 = trader.submit_order(
        symbol='AAPL',
        side=OrderSide.BUY,
        order_type=OrderType.MARKET,
        quantity=50
    )
    
    trader.execute_order(buy_order2, 152.00)
    print(f"✓ Order executed: {buy_order2.order_id}")
    
    # Check position
    position = trader.positions['AAPL']
    print(f"\nPosition: {position.quantity} shares @ avg ${position.avg_price:.2f}")
    
    # Afternoon: Set a limit order to sell
    print("\n\n2:00 PM - Setting Limit Order")
    print("-" * 40)
    print("Action: Place limit order to sell 150 shares at $155.00")
    
    sell_order = trader.submit_order(
        symbol='AAPL',
        side=OrderSide.SELL,
        order_type=OrderType.LIMIT,
        quantity=150,
        price=155.00
    )
    
    print(f"✓ Limit order placed: {sell_order.order_id}")
    print("Waiting for price to reach $155.00...")
    
    # Price hits limit
    print("\n\n3:30 PM - Limit Order Triggered")
    print("-" * 40)
    print("AAPL reaches $155.50")
    
    trader.update_market_data({'AAPL': 155.50})
    
    # Process limit order
    trader.process_limit_order(sell_order, 155.50)
    
    if sell_order.status.value == 'filled':
        print(f"✓ Limit order executed at ${sell_order.filled_price:.2f}")
    
    # End of day summary
    print("\n\n4:00 PM - Market Close")
    print("-" * 40)
    
    final_portfolio = trader.get_portfolio_summary()
    
    print("\nEND OF DAY SUMMARY")
    print("="*60)
    print(f"Cash: ${final_portfolio['cash']:,.2f}")
    print(f"Portfolio Value: ${final_portfolio['portfolio_value']:,.2f}")
    print(f"Total P&L: ${final_portfolio['total_pnl']:,.2f}")
    print(f"Total Return: {final_portfolio['total_return']:.2%}")
    print(f"\nNumber of Trades: {final_portfolio['num_trades']}")
    print(f"Open Positions: {final_portfolio['num_positions']}")
    
    if final_portfolio['positions']:
        print("\nCurrent Positions:")
        for pos in final_portfolio['positions']:
            print(f"  {pos['symbol']}: {pos['quantity']} shares @ ${pos['avg_price']:.2f}")
            print(f"    Current Price: ${pos['current_price']:.2f}")
            print(f"    Unrealized P&L: ${pos['unrealized_pnl']:.2f}")


def simulate_multi_stock_portfolio():
    """Simulate trading multiple stocks"""
    
    print("\n\n" + "="*60)
    print("MULTI-STOCK PORTFOLIO SIMULATION")
    print("="*60)
    
    trader = PaperTrader(initial_capital=100000, commission=0.001)
    
    print(f"\nStarting Capital: ${trader.cash:,.2f}")
    print("\nBuilding diversified portfolio...\n")
    
    # Buy multiple stocks
    stocks = [
        ('AAPL', 100, 150.00),
        ('GOOGL', 50, 125.00),
        ('MSFT', 75, 330.00),
        ('AMZN', 30, 145.00),
    ]
    
    for symbol, quantity, price in stocks:
        print(f"Buying {quantity} shares of {symbol} @ ${price:.2f}")
        order = trader.submit_order(
            symbol=symbol,
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            quantity=quantity
        )
        trader.execute_order(order, price)
    
    print("\nInitial Portfolio:")
    print("-" * 40)
    portfolio = trader.get_portfolio_summary()
    for pos in portfolio['positions']:
        value = pos['quantity'] * pos['current_price']
        print(f"{pos['symbol']}: {pos['quantity']} shares, Value: ${value:,.2f}")
    
    print(f"\nTotal Invested: ${portfolio['positions_value']:,.2f}")
    print(f"Cash Remaining: ${portfolio['cash']:,.2f}")
    
    # Simulate market movement
    print("\n\nAfter 1 Week - Market Movement")
    print("-" * 40)
    
    new_prices = {
        'AAPL': 155.00,   # +3.3%
        'GOOGL': 128.00,  # +2.4%
        'MSFT': 325.00,   # -1.5%
        'AMZN': 150.00,   # +3.4%
    }
    
    trader.update_market_data(new_prices)
    
    portfolio = trader.get_portfolio_summary()
    print("\nUpdated Portfolio:")
    for pos in portfolio['positions']:
        pnl = pos['unrealized_pnl']
        pnl_pct = pos['unrealized_pnl_pct']
        sign = "+" if pnl >= 0 else ""
        print(f"{pos['symbol']}: ${pos['current_price']:.2f} ({sign}{pnl_pct:.2%}) | P&L: {sign}${pnl:.2f}")
    
    print(f"\nTotal Portfolio Value: ${portfolio['portfolio_value']:,.2f}")
    print(f"Total P&L: ${portfolio['total_pnl']:,.2f} ({portfolio['total_return']:.2%})")
    
    # Rebalance: Sell losers, keep winners
    print("\n\nRebalancing Portfolio")
    print("-" * 40)
    print("Selling MSFT (down 1.5%) and adding to AAPL (up 3.3%)")
    
    # Sell MSFT
    sell_order = trader.submit_order(
        symbol='MSFT',
        side=OrderSide.SELL,
        order_type=OrderType.MARKET,
        quantity=75
    )
    trader.execute_order(sell_order, new_prices['MSFT'])
    
    # Buy more AAPL
    buy_order = trader.submit_order(
        symbol='AAPL',
        side=OrderSide.BUY,
        order_type=OrderType.MARKET,
        quantity=50
    )
    trader.execute_order(buy_order, new_prices['AAPL'])
    
    print("\nFinal Portfolio:")
    print("-" * 40)
    final = trader.get_portfolio_summary()
    for pos in final['positions']:
        value = pos['quantity'] * pos['current_price']
        print(f"{pos['symbol']}: {pos['quantity']} shares @ ${pos['current_price']:.2f} = ${value:,.2f}")
    
    print(f"\nCash: ${final['cash']:,.2f}")
    print(f"Portfolio Value: ${final['portfolio_value']:,.2f}")
    print(f"Total Return: {final['total_return']:.2%}")


def run_all_examples():
    """Run all paper trading examples"""
    simulate_day_trading()
    simulate_multi_stock_portfolio()
    
    print("\n\n" + "="*60)
    print("PAPER TRADING EXAMPLES COMPLETE")
    print("="*60)
    print("\nKey Features Demonstrated:")
    print("  ✓ Market orders (immediate execution)")
    print("  ✓ Limit orders (conditional execution)")
    print("  ✓ Position tracking")
    print("  ✓ Portfolio valuation")
    print("  ✓ P&L calculation")
    print("  ✓ Multi-stock portfolios")
    print("  ✓ Portfolio rebalancing")
    print("\nNext Steps:")
    print("  • Connect to real market data")
    print("  • Implement automated strategies")
    print("  • Add risk management rules")
    print("  • Track performance over time")


if __name__ == '__main__':
    run_all_examples()
