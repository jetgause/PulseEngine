# PulseEngine Frontend

React-based frontend for PulseEngine, deployed on Netlify.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:54321
```

## Deployment

Automatically deployed to Netlify on push to main branch.
