"""
Strategy Optimizer
Optimizes trading strategy parameters using various methods
"""

from typing import Dict, List, Callable, Tuple, Any
import numpy as np
from itertools import product
import pandas as pd


class StrategyOptimizer:
    """Optimize trading strategy parameters"""
    
    def __init__(self, backtest_engine, data: pd.DataFrame):
        """
        Initialize optimizer
        
        Args:
            backtest_engine: BacktestEngine instance
            data: Historical data for optimization
        """
        self.backtest_engine = backtest_engine
        self.data = data
        self.results: List[Dict] = []
        
    def grid_search(self, strategy: Callable, param_grid: Dict[str, List[Any]],
                   metric: str = "total_return") -> Dict:
        """
        Perform grid search over parameter space
        
        Args:
            strategy: Strategy function
            param_grid: Dictionary mapping parameter names to lists of values
            metric: Metric to optimize (e.g., 'total_return', 'profit_factor')
            
        Returns:
            Dictionary with best parameters and results
        """
        self.results = []
        
        # Generate all parameter combinations
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        
        best_metric = float('-inf')
        best_params = None
        best_results = None
        
        for combination in product(*param_values):
            params = dict(zip(param_names, combination))
            
            # Run backtest with these parameters
            try:
                results = self.backtest_engine.run_backtest(self.data, strategy, params)
                results['params'] = params
                self.results.append(results)
                
                # Track best result
                if results[metric] > best_metric:
                    best_metric = results[metric]
                    best_params = params
                    best_results = results
            except Exception as e:
                print(f"Error with params {params}: {e}")
                continue
        
        return {
            "best_params": best_params,
            "best_metric": best_metric,
            "best_results": best_results,
            "all_results": self.results
        }
    
    def walk_forward_optimization(self, strategy: Callable, param_grid: Dict[str, List[Any]],
                                 train_period: int, test_period: int,
                                 metric: str = "total_return") -> Dict:
        """
        Perform walk-forward optimization
        
        Args:
            strategy: Strategy function
            param_grid: Dictionary mapping parameter names to lists of values
            train_period: Number of periods for training window
            test_period: Number of periods for testing window
            metric: Metric to optimize
            
        Returns:
            Dictionary with walk-forward results
        """
        results = []
        n_samples = len(self.data)
        
        start = 0
        while start + train_period + test_period <= n_samples:
            # Split data
            train_data = self.data.iloc[start:start + train_period]
            test_data = self.data.iloc[start + train_period:start + train_period + test_period]
            
            # Optimize on training data
            optimizer = StrategyOptimizer(self.backtest_engine, train_data)
            train_results = optimizer.grid_search(strategy, param_grid, metric)
            
            # Test on out-of-sample data
            best_params = train_results['best_params']
            test_results = self.backtest_engine.run_backtest(test_data, strategy, best_params)
            
            results.append({
                'train_period': (start, start + train_period),
                'test_period': (start + train_period, start + train_period + test_period),
                'best_params': best_params,
                'train_metric': train_results['best_metric'],
                'test_metric': test_results[metric],
                'test_results': test_results
            })
            
            start += test_period
        
        # Calculate aggregate metrics
        avg_test_metric = np.mean([r['test_metric'] for r in results])
        
        return {
            "walk_forward_results": results,
            "avg_test_metric": avg_test_metric,
            "consistency": np.std([r['test_metric'] for r in results])
        }
    
    def monte_carlo_simulation(self, strategy: Callable, param_ranges: Dict[str, Tuple[float, float]],
                              n_iterations: int = 100, metric: str = "total_return") -> Dict:
        """
        Perform Monte Carlo simulation for parameter optimization
        
        Args:
            strategy: Strategy function
            param_ranges: Dictionary mapping parameter names to (min, max) tuples
            n_iterations: Number of random samples
            metric: Metric to optimize
            
        Returns:
            Dictionary with Monte Carlo results
        """
        self.results = []
        
        best_metric = float('-inf')
        best_params = None
        best_results = None
        
        for _ in range(n_iterations):
            # Generate random parameters
            params = {}
            for param_name, (min_val, max_val) in param_ranges.items():
                if isinstance(min_val, int) and isinstance(max_val, int):
                    params[param_name] = np.random.randint(min_val, max_val + 1)
                else:
                    params[param_name] = np.random.uniform(min_val, max_val)
            
            # Run backtest
            try:
                results = self.backtest_engine.run_backtest(self.data, strategy, params)
                results['params'] = params
                self.results.append(results)
                
                if results[metric] > best_metric:
                    best_metric = results[metric]
                    best_params = params
                    best_results = results
            except Exception as e:
                continue
        
        return {
            "best_params": best_params,
            "best_metric": best_metric,
            "best_results": best_results,
            "all_results": self.results,
            "param_distribution": self._analyze_param_distribution(metric)
        }
    
    def _analyze_param_distribution(self, metric: str) -> Dict:
        """Analyze the distribution of parameters vs performance"""
        if not self.results:
            return {}
        
        # Extract parameter values and metrics
        param_names = list(self.results[0]['params'].keys())
        analysis = {}
        
        for param_name in param_names:
            values = [r['params'][param_name] for r in self.results]
            metrics = [r[metric] for r in self.results]
            
            # Calculate correlation
            correlation = np.corrcoef(values, metrics)[0, 1]
            
            analysis[param_name] = {
                'mean': np.mean(values),
                'std': np.std(values),
                'correlation_with_metric': correlation
            }
        
        return analysis
