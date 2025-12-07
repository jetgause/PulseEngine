# PulseEngine - Advanced Trading Bot Platform

A comprehensive 3-layered trading bot platform with backtesting, strategy optimization, paper trading, and options Greeks calculation capabilities.

## Architecture

PulseEngine is built with a modern 3-layer architecture:

### 1. Frontend Layer (Netlify)
- **Technology**: React + Vite
- **Features**: 
  - Interactive dashboard
  - Paper trading interface
  - Backtesting configuration
  - Strategy optimization
  - Options Greeks calculator
  - Real-time data visualization

### 2. Backend Layer (Supabase)
- **Technology**: Supabase (PostgreSQL + Edge Functions)
- **Features**:
  - RESTful API endpoints
  - Real-time data synchronization
  - User authentication
  - Secure data storage
  - Edge Functions for serverless compute

### 3. Core Trading Logic Layer
- **Technology**: Python
- **Modules**:
  - **Backtester**: Historical strategy testing
  - **Optimizer**: Parameter optimization (Grid Search, Monte Carlo, Walk Forward)
  - **Greeks Calculator**: Options pricing and risk metrics
  - **Paper Trader**: Simulated trading environment

## Features

### Paper Trading
- Practice trading without risking real capital
- Automatic trade tracking and execution
- Portfolio management
- Real-time position updates
- Order management (Market, Limit orders)

### Backtesting Engine
- Test strategies against historical data
- Comprehensive performance metrics:
  - Total return and P&L
  - Win rate and profit factor
  - Maximum drawdown
  - Trade statistics
- Support for multiple strategies

### Strategy Optimizer
- **Grid Search**: Exhaustive parameter testing
- **Monte Carlo**: Random sampling for large parameter spaces
- **Walk Forward**: Out-of-sample testing to prevent overfitting
- Parameter sensitivity analysis
- Optimization job tracking

### Options Greeks Calculator
Calculate all major Greeks using Black-Scholes model:
- **Delta**: Price sensitivity
- **Gamma**: Delta sensitivity
- **Vega**: Volatility sensitivity
- **Theta**: Time decay
- **Rho**: Interest rate sensitivity

## Project Structure

```
PulseEngine/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   ├── styles/          # CSS stylesheets
│   │   ├── App.jsx          # Main app component
│   │   └── main.jsx         # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── backend/                  # Supabase backend
│   └── supabase/
│       ├── functions/       # Edge Functions
│       │   ├── backtest/    # Backtesting API
│       │   ├── paper-trading/ # Paper trading API
│       │   ├── greeks/      # Options Greeks API
│       │   └── optimize/    # Optimization API
│       ├── migrations/      # Database migrations
│       └── config.toml      # Supabase configuration
│
├── core/                     # Core trading logic
│   ├── backtester/          # Backtesting engine
│   │   ├── __init__.py
│   │   └── engine.py
│   ├── optimizer/           # Strategy optimizer
│   │   ├── __init__.py
│   │   └── strategy_optimizer.py
│   ├── greeks/              # Options Greeks calculator
│   │   ├── __init__.py
│   │   └── options_greeks.py
│   └── paper_trader/        # Paper trading system
│       ├── __init__.py
│       └── paper_trader.py
│
├── requirements.txt         # Python dependencies
├── package.json            # Root package.json
├── netlify.toml            # Netlify deployment config
└── README.md               # This file
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- Supabase account
- Netlify account (for deployment)

### Local Development

#### 1. Clone the repository
```bash
git clone https://github.com/jetgause/PulseEngine.git
cd PulseEngine
```

#### 2. Install Python dependencies
```bash
pip install -r requirements.txt
```

#### 3. Set up Supabase
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase (if not already done)
cd backend/supabase
supabase init

# Start local Supabase
supabase start

# Run migrations
supabase db push
```

#### 4. Configure environment variables
```bash
# Frontend
cd frontend
cp .env.example .env
# Edit .env with your Supabase URL and API keys
```

#### 5. Install frontend dependencies
```bash
cd frontend
npm install
```

#### 6. Start development server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Deployment

### Deploy to Netlify (Frontend)

#### Option 1: Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

#### Option 2: GitHub Integration
1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/dist`
3. Add environment variables in Netlify dashboard
4. Deploy

### Deploy to Supabase (Backend)

#### 1. Create Supabase Project
```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Push database schema
supabase db push

# Deploy Edge Functions
supabase functions deploy backtest
supabase functions deploy paper-trading
supabase functions deploy greeks
supabase functions deploy optimize
```

#### 2. Set Environment Variables
In Supabase dashboard, configure:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Database Schema

The platform uses the following main tables:

- **market_data**: Historical price data
- **backtests**: Backtest results and configurations
- **paper_accounts**: Paper trading account information
- **paper_positions**: Current trading positions
- **paper_orders**: Order history
- **paper_trades**: Executed trades
- **optimization_jobs**: Strategy optimization jobs
- **strategies**: User-defined trading strategies

All tables include Row Level Security (RLS) policies for data protection.

## API Endpoints

### Edge Functions

#### Backtest API
```
POST /backtest
Body: {
  strategy_name, params, start_date, end_date, initial_capital
}
```

#### Paper Trading API
```
POST /paper-trading
Body: {
  action: "submit_order" | "get_portfolio" | "get_trade_history",
  user_id, symbol, side, order_type, quantity, price
}
```

#### Greeks Calculator API
```
POST /greeks
Body: {
  spot_price, strike_price, time_to_expiry, volatility,
  risk_free_rate, dividend_yield, option_type
}
```

#### Optimizer API
```
POST /optimize
Body: {
  strategy_name, method, param_grid, start_date, end_date
}
```

## Usage Examples

### Backtesting a Strategy
```python
from core import BacktestEngine
import pandas as pd

# Load historical data
data = pd.read_csv('historical_data.csv')

# Initialize backtest engine
engine = BacktestEngine(initial_capital=100000, commission=0.001)

# Define strategy
def moving_average_strategy(data, params):
    # Strategy logic here
    pass

# Run backtest
results = engine.run_backtest(data, moving_average_strategy, 
                             {'short_window': 20, 'long_window': 50})
print(results)
```

### Calculating Options Greeks
```python
from core import OptionsGreeks

# Initialize calculator
greeks = OptionsGreeks(
    spot_price=100,
    strike_price=105,
    time_to_expiry=0.25,  # 3 months
    volatility=0.20,
    risk_free_rate=0.05
)

# Calculate all Greeks
all_greeks = greeks.all_greeks('call')
print(f"Delta: {all_greeks['delta']}")
print(f"Gamma: {all_greeks['gamma']}")
print(f"Vega: {all_greeks['vega']}")
```

### Paper Trading
```python
from core import PaperTrader, OrderSide, OrderType

# Initialize paper trader
trader = PaperTrader(initial_capital=100000)

# Submit order
order = trader.submit_order(
    symbol='AAPL',
    side=OrderSide.BUY,
    order_type=OrderType.MARKET,
    quantity=100
)

# Execute at market price
trader.execute_order(order, 150.00)

# Get portfolio summary
summary = trader.get_portfolio_summary()
print(summary)
```

## Testing

```bash
# Run Python tests
pytest

# Run frontend tests
cd frontend
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Documentation

- **[README.md](README.md)**: This file - overview and getting started
- **[QUICKSTART.md](QUICKSTART.md)**: 5-minute quick start guide with examples
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Detailed system architecture and design
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Step-by-step deployment guide
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)**: Complete implementation overview
- **[examples/](examples/)**: Working code examples for all features

## Support

For issues and questions:
- GitHub Issues: https://github.com/jetgause/PulseEngine/issues
- Documentation: See files listed above

## Roadmap

- [ ] Real-time market data integration
- [ ] Advanced charting and visualization
- [ ] Machine learning strategy generation
- [ ] Social trading features
- [ ] Mobile app
- [ ] Advanced risk management tools
- [ ] Multi-asset support (crypto, forex, futures)
- [ ] Strategy marketplace

## Acknowledgments

Built with:
- React & Vite
- Supabase
- Python (pandas, numpy, scipy)
- Recharts for visualization

---

**Note**: This is a paper trading platform for educational and testing purposes. Always conduct thorough testing before using any strategy with real capital.
