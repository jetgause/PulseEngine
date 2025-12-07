"""
Options Greeks Calculator
Calculates Delta, Gamma, Vega, Theta, and Rho for options pricing
"""

import math
from scipy.stats import norm
from typing import Dict, Literal


class OptionsGreeks:
    """Calculate options Greeks using Black-Scholes model"""
    
    def __init__(self, spot_price: float, strike_price: float, 
                 time_to_expiry: float, volatility: float, 
                 risk_free_rate: float, dividend_yield: float = 0.0):
        """
        Initialize Greeks calculator
        
        Args:
            spot_price: Current price of underlying asset
            strike_price: Strike price of the option
            time_to_expiry: Time to expiration in years
            volatility: Implied volatility (annualized)
            risk_free_rate: Risk-free interest rate (annualized)
            dividend_yield: Continuous dividend yield (annualized)
        """
        self.S = spot_price
        self.K = strike_price
        self.T = time_to_expiry
        self.sigma = volatility
        self.r = risk_free_rate
        self.q = dividend_yield
        
    def _d1(self) -> float:
        """Calculate d1 parameter for Black-Scholes"""
        return (math.log(self.S / self.K) + (self.r - self.q + 0.5 * self.sigma ** 2) * self.T) / \
               (self.sigma * math.sqrt(self.T))
    
    def _d2(self) -> float:
        """Calculate d2 parameter for Black-Scholes"""
        return self._d1() - self.sigma * math.sqrt(self.T)
    
    def delta(self, option_type: Literal["call", "put"] = "call") -> float:
        """
        Calculate Delta - rate of change of option price with respect to underlying price
        
        Args:
            option_type: Type of option ("call" or "put")
            
        Returns:
            Delta value
        """
        d1 = self._d1()
        if option_type == "call":
            return math.exp(-self.q * self.T) * norm.cdf(d1)
        else:
            return math.exp(-self.q * self.T) * (norm.cdf(d1) - 1)
    
    def gamma(self) -> float:
        """
        Calculate Gamma - rate of change of Delta with respect to underlying price
        
        Returns:
            Gamma value (same for calls and puts)
        """
        d1 = self._d1()
        return (math.exp(-self.q * self.T) * norm.pdf(d1)) / \
               (self.S * self.sigma * math.sqrt(self.T))
    
    def vega(self) -> float:
        """
        Calculate Vega - sensitivity to volatility
        
        Returns:
            Vega value (same for calls and puts)
        """
        d1 = self._d1()
        return self.S * math.exp(-self.q * self.T) * norm.pdf(d1) * math.sqrt(self.T)
    
    def theta(self, option_type: Literal["call", "put"] = "call") -> float:
        """
        Calculate Theta - time decay of option
        
        Args:
            option_type: Type of option ("call" or "put")
            
        Returns:
            Theta value (per year, divide by 365 for daily)
        """
        d1 = self._d1()
        d2 = self._d2()
        
        term1 = -(self.S * math.exp(-self.q * self.T) * norm.pdf(d1) * self.sigma) / \
                (2 * math.sqrt(self.T))
        
        if option_type == "call":
            term2 = self.q * self.S * math.exp(-self.q * self.T) * norm.cdf(d1)
            term3 = -self.r * self.K * math.exp(-self.r * self.T) * norm.cdf(d2)
        else:
            term2 = -self.q * self.S * math.exp(-self.q * self.T) * norm.cdf(-d1)
            term3 = self.r * self.K * math.exp(-self.r * self.T) * norm.cdf(-d2)
        
        return term1 + term2 + term3
    
    def rho(self, option_type: Literal["call", "put"] = "call") -> float:
        """
        Calculate Rho - sensitivity to interest rate
        
        Args:
            option_type: Type of option ("call" or "put")
            
        Returns:
            Rho value
        """
        d2 = self._d2()
        
        if option_type == "call":
            return self.K * self.T * math.exp(-self.r * self.T) * norm.cdf(d2)
        else:
            return -self.K * self.T * math.exp(-self.r * self.T) * norm.cdf(-d2)
    
    def all_greeks(self, option_type: Literal["call", "put"] = "call") -> Dict[str, float]:
        """
        Calculate all Greeks at once
        
        Args:
            option_type: Type of option ("call" or "put")
            
        Returns:
            Dictionary containing all Greeks
        """
        return {
            "delta": self.delta(option_type),
            "gamma": self.gamma(),
            "vega": self.vega(),
            "theta": self.theta(option_type),
            "rho": self.rho(option_type)
        }
