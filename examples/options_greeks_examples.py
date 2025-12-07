"""
Example: Options Greeks Calculations
Demonstrates how to calculate options Greeks for different scenarios
"""

from core import OptionsGreeks


def calculate_call_greeks():
    """Calculate Greeks for a call option"""
    
    print("="*60)
    print("CALL OPTION GREEKS EXAMPLE")
    print("="*60)
    
    # At-the-money call option
    print("\n1. At-the-Money (ATM) Call Option")
    print("-" * 40)
    
    greeks_atm = OptionsGreeks(
        spot_price=100,
        strike_price=100,
        time_to_expiry=0.25,  # 3 months
        volatility=0.20,      # 20% implied volatility
        risk_free_rate=0.05,  # 5% risk-free rate
        dividend_yield=0.02   # 2% dividend yield
    )
    
    atm_greeks = greeks_atm.all_greeks('call')
    print(f"Spot Price: $100")
    print(f"Strike Price: $100")
    print(f"Time to Expiry: 3 months")
    print(f"\nGreeks:")
    print(f"  Delta:  {atm_greeks['delta']:.4f}  (Price sensitivity)")
    print(f"  Gamma:  {atm_greeks['gamma']:.4f}  (Delta sensitivity)")
    print(f"  Vega:   {atm_greeks['vega']:.4f}  (Volatility sensitivity)")
    print(f"  Theta:  {atm_greeks['theta']:.4f}  (Time decay per year)")
    print(f"  Rho:    {atm_greeks['rho']:.4f}  (Interest rate sensitivity)")
    
    # In-the-money call option
    print("\n\n2. In-the-Money (ITM) Call Option")
    print("-" * 40)
    
    greeks_itm = OptionsGreeks(
        spot_price=110,
        strike_price=100,
        time_to_expiry=0.25,
        volatility=0.20,
        risk_free_rate=0.05,
        dividend_yield=0.02
    )
    
    itm_greeks = greeks_itm.all_greeks('call')
    print(f"Spot Price: $110")
    print(f"Strike Price: $100")
    print(f"Time to Expiry: 3 months")
    print(f"\nGreeks:")
    print(f"  Delta:  {itm_greeks['delta']:.4f}  (Higher delta - more in-the-money)")
    print(f"  Gamma:  {itm_greeks['gamma']:.4f}  (Lower gamma than ATM)")
    print(f"  Vega:   {itm_greeks['vega']:.4f}")
    print(f"  Theta:  {itm_greeks['theta']:.4f}")
    print(f"  Rho:    {itm_greeks['rho']:.4f}")
    
    # Out-of-the-money call option
    print("\n\n3. Out-of-the-Money (OTM) Call Option")
    print("-" * 40)
    
    greeks_otm = OptionsGreeks(
        spot_price=90,
        strike_price=100,
        time_to_expiry=0.25,
        volatility=0.20,
        risk_free_rate=0.05,
        dividend_yield=0.02
    )
    
    otm_greeks = greeks_otm.all_greeks('call')
    print(f"Spot Price: $90")
    print(f"Strike Price: $100")
    print(f"Time to Expiry: 3 months")
    print(f"\nGreeks:")
    print(f"  Delta:  {otm_greeks['delta']:.4f}  (Lower delta - out-of-the-money)")
    print(f"  Gamma:  {otm_greeks['gamma']:.4f}")
    print(f"  Vega:   {otm_greeks['vega']:.4f}")
    print(f"  Theta:  {otm_greeks['theta']:.4f}")
    print(f"  Rho:    {otm_greeks['rho']:.4f}")


def compare_put_call_parity():
    """Compare call and put Greeks for the same strike"""
    
    print("\n\n" + "="*60)
    print("PUT-CALL PARITY EXAMPLE")
    print("="*60)
    
    greeks_calc = OptionsGreeks(
        spot_price=100,
        strike_price=100,
        time_to_expiry=0.25,
        volatility=0.20,
        risk_free_rate=0.05,
        dividend_yield=0.02
    )
    
    call_greeks = greeks_calc.all_greeks('call')
    put_greeks = greeks_calc.all_greeks('put')
    
    print("\nSame Parameters for Both:")
    print("  Spot: $100, Strike: $100, Time: 3 months")
    print("\n{:<15} {:<15} {:<15}".format("Greek", "Call", "Put"))
    print("-" * 45)
    print("{:<15} {:>14.4f} {:>14.4f}".format("Delta", call_greeks['delta'], put_greeks['delta']))
    print("{:<15} {:>14.4f} {:>14.4f}".format("Gamma", call_greeks['gamma'], put_greeks['gamma']))
    print("{:<15} {:>14.4f} {:>14.4f}".format("Vega", call_greeks['vega'], put_greeks['vega']))
    print("{:<15} {:>14.4f} {:>14.4f}".format("Theta", call_greeks['theta'], put_greeks['theta']))
    print("{:<15} {:>14.4f} {:>14.4f}".format("Rho", call_greeks['rho'], put_greeks['rho']))
    
    print("\nKey Observations:")
    print("  • Gamma and Vega are the same for calls and puts")
    print("  • Call delta is positive, put delta is negative")
    print("  • Put delta ≈ Call delta - 1")


def volatility_impact():
    """Show how volatility affects Greeks"""
    
    print("\n\n" + "="*60)
    print("VOLATILITY IMPACT ON GREEKS")
    print("="*60)
    
    volatilities = [0.10, 0.20, 0.30, 0.40]
    
    print("\nATM Call Option with Different Volatilities:")
    print("\n{:<12} {:<12} {:<12} {:<12} {:<12}".format(
        "Volatility", "Delta", "Gamma", "Vega", "Theta"
    ))
    print("-" * 60)
    
    for vol in volatilities:
        greeks = OptionsGreeks(
            spot_price=100,
            strike_price=100,
            time_to_expiry=0.25,
            volatility=vol,
            risk_free_rate=0.05,
            dividend_yield=0.02
        )
        
        call_greeks = greeks.all_greeks('call')
        
        print("{:<12.0%} {:>11.4f} {:>11.4f} {:>11.4f} {:>11.4f}".format(
            vol,
            call_greeks['delta'],
            call_greeks['gamma'],
            call_greeks['vega'],
            call_greeks['theta']
        ))
    
    print("\nKey Observations:")
    print("  • Higher volatility → Higher Vega (more volatility sensitivity)")
    print("  • Higher volatility → More negative Theta (faster time decay)")
    print("  • Volatility has less impact on Delta for ATM options")


def time_decay_example():
    """Show how time affects Greeks"""
    
    print("\n\n" + "="*60)
    print("TIME DECAY (THETA) EXAMPLE")
    print("="*60)
    
    time_periods = [1.0, 0.5, 0.25, 0.083, 0.027]  # 1 year to 1 week
    time_labels = ["1 year", "6 months", "3 months", "1 month", "1 week"]
    
    print("\nATM Call Option at Different Times to Expiry:")
    print("\n{:<12} {:<12} {:<12} {:<12} {:<12}".format(
        "Time Left", "Delta", "Gamma", "Vega", "Theta/Day"
    ))
    print("-" * 60)
    
    for time, label in zip(time_periods, time_labels):
        greeks = OptionsGreeks(
            spot_price=100,
            strike_price=100,
            time_to_expiry=time,
            volatility=0.20,
            risk_free_rate=0.05,
            dividend_yield=0.02
        )
        
        call_greeks = greeks.all_greeks('call')
        theta_per_day = call_greeks['theta'] / 365  # Convert annual to daily
        
        print("{:<12} {:>11.4f} {:>11.4f} {:>11.4f} {:>11.4f}".format(
            label,
            call_greeks['delta'],
            call_greeks['gamma'],
            call_greeks['vega'],
            theta_per_day
        ))
    
    print("\nKey Observations:")
    print("  • Gamma increases as expiry approaches (delta becomes more sensitive)")
    print("  • Vega decreases closer to expiry (less time for volatility to matter)")
    print("  • Theta becomes more negative near expiry (accelerating time decay)")


def run_all_examples():
    """Run all Greeks examples"""
    calculate_call_greeks()
    compare_put_call_parity()
    volatility_impact()
    time_decay_example()
    
    print("\n\n" + "="*60)
    print("EXAMPLES COMPLETE")
    print("="*60)
    print("\nThese examples demonstrate:")
    print("  1. How Greeks change with spot price (ITM, ATM, OTM)")
    print("  2. Put-call parity relationships")
    print("  3. Impact of volatility on Greeks")
    print("  4. Time decay and its acceleration near expiry")
    print("\nUse these insights to:")
    print("  • Understand option risk profiles")
    print("  • Choose appropriate strikes and expirations")
    print("  • Manage portfolio Greeks")
    print("  • Develop options trading strategies")


if __name__ == '__main__':
    run_all_examples()
