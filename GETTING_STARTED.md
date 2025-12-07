# Getting Started with PulseEngine

This guide will help you get PulseEngine up and running on your local machine in under 10 minutes.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** installed ([download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Git** for version control
- A code editor (VS Code recommended)

## Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/jetgause/PulseEngine.git
cd PulseEngine
```

### Step 2: Set Up the Backend

#### Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Using Homebrew (macOS)
brew install supabase/tap/supabase
```

#### Start Supabase Locally

```bash
cd backend
supabase start
```

This will start local Supabase services. Note the output - you'll need the API URL and keys.

**Example output:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbGc...
service_role key: eyJhbGc...
```

#### Apply Database Migrations

```bash
supabase db push
```

This creates the `tools` and `tool_executions` tables.

### Step 3: Set Up the Frontend

#### Install Dependencies

```bash
cd ../frontend
npm install
```

#### Configure Environment

Create a `.env` file in the `frontend/` directory:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key-from-supabase-start
VITE_API_BASE_URL=http://localhost:54321
```

#### Start the Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Step 4: Verify Everything Works

1. **Open your browser** to `http://localhost:3000`
2. **You should see** the PulseEngine homepage
3. **Navigate to Tools** page (should show "No tools available yet")

## Testing the API

### Open Supabase Studio

Visit `http://localhost:54323` to access Supabase Studio.

### View Sample Tools

In the SQL Editor, run:

```sql
SELECT * FROM tools;
```

You should see 3 sample tools: Data Processor, API Caller, and Calculator.

### Test an API Endpoint

```bash
# Health check (no auth required)
curl http://localhost:54321/functions/v1/gateway/health

# List tools (requires auth - skip for now)
curl http://localhost:54321/functions/v1/gateway/api/v1/tools
```

## Common Issues and Solutions

### Issue: Supabase CLI not found

**Solution**: Make sure you've installed the Supabase CLI and it's in your PATH.

```bash
# Verify installation
supabase --version
```

### Issue: Port already in use

**Solution**: Stop other services using the same ports:

```bash
# Check what's using port 54321
lsof -ti:54321 | xargs kill -9

# Or change ports in backend/supabase/config.toml
```

### Issue: Database migration failed

**Solution**: Reset the database and try again:

```bash
cd backend
supabase db reset
```

### Issue: Frontend can't connect to backend

**Solution**: Check that:
1. Supabase is running (`supabase status`)
2. Environment variables are correct
3. URLs don't have trailing slashes

## Project Structure at a Glance

```
PulseEngine/
├── frontend/           # React app
│   ├── src/           # Source code
│   └── package.json   # Dependencies
│
└── backend/           # Supabase backend
    ├── supabase/
    │   ├── functions/ # Edge Functions
    │   └── migrations/ # Database schema
    └── shared/        # Shared code
```

## Next Steps

Now that you have PulseEngine running:

1. **Explore the Code**: Look at `frontend/src/services/` for API examples
2. **Read the Docs**: Check out `ARCHITECTURE.md` for system design
3. **Add a Tool**: See `TOOLS.md` for how to create custom tools
4. **Deploy**: Follow `DEPLOYMENT.md` when ready to go live

## Development Commands

### Frontend

```bash
cd frontend

# Start dev server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm test
```

### Backend

```bash
cd backend

# Start Supabase
supabase start

# Stop Supabase
supabase stop

# View logs
supabase functions logs

# Deploy functions
supabase functions deploy

# Reset database
supabase db reset
```

## Useful Resources

- **Supabase Documentation**: https://supabase.com/docs
- **React Documentation**: https://react.dev
- **Vite Documentation**: https://vitejs.dev
- **Tailwind CSS**: https://tailwindcss.com

## Need Help?

- Check the [main README](./README.md) for detailed information
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See [TOOLS.md](./TOOLS.md) for tool development
- Open an issue on GitHub

## What's Next?

- [ ] Create a user account (implement auth UI)
- [ ] Execute a sample tool
- [ ] View execution history
- [ ] Create your own custom tool
- [ ] Deploy to production

Congratulations! You now have PulseEngine running locally. Happy coding! 🚀
