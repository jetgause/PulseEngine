# PulseEngine Backend

Supabase-powered backend with PostgreSQL and Edge Functions.

## Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Start local Supabase:
```bash
supabase start
```

3. Run migrations:
```bash
supabase db push
```

## Edge Functions

Deploy functions:
```bash
supabase functions deploy gateway
supabase functions deploy tools/execute
supabase functions deploy tools/list
```

## Environment Variables

Copy `.env.example` to `.env` and configure.

## Database

Migrations are in `supabase/migrations/`.

Run migrations:
```bash
supabase db push
```

Reset database (caution!):
```bash
supabase db reset
```
