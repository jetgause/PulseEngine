# Deployment Setup Guide

Quick reference for setting up auto-deployment to Netlify and Supabase.

## Prerequisites

- [ ] GitHub repository connected
- [ ] Netlify account
- [ ] Supabase account and project created
- [ ] Supabase CLI installed: `npm install -g supabase`

---

## 1. Netlify Setup (Frontend)

### Step 1: Connect Repository
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose your GitHub repository
4. Select the branch: `main`

### Step 2: Configure Build Settings
```
Build command: cd frontend && npm install && npm run build
Publish directory: frontend/dist
Node version: 18
```

### Step 3: Set Environment Variables
Go to Site settings → Environment variables, add:
```
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
VITE_API_BASE_URL=https://[your-project].supabase.co
```

### Step 4: Deploy
Click "Deploy site" - Netlify will auto-deploy on every push to main.

**Your frontend URL**: `https://[your-site].netlify.app`

---

## 2. Supabase Setup (Backend)

### Step 1: Get Project Details
1. Go to https://app.supabase.com
2. Open your project
3. Go to Settings → API
4. Copy:
   - Project URL
   - Project API keys (anon key, service role key)
   - Project ref (from URL or settings)

### Step 2: Set Up Supabase Secrets
Go to Project Settings → Edge Functions → Secrets, add:
```
STRIPE_SECRET_KEY=[your-stripe-key]
STRIPE_WEBHOOK_SECRET=[your-webhook-secret]
FRONTEND_URL=https://[your-netlify-site].netlify.app
```

Add broker API keys if needed:
```
ALPACA_API_KEY=[optional]
ALPACA_SECRET_KEY=[optional]
```

### Step 3: Update Configuration
Edit `backend/supabase/config.toml`:
```toml
project_id = "[your-project-ref]"

[auth]
site_url = "https://[your-netlify-site].netlify.app"
additional_redirect_urls = ["https://[your-netlify-site].netlify.app"]
```

### Step 4: Local Testing (Optional but Recommended)
```bash
cd backend/supabase
supabase start
supabase db reset
supabase functions serve
```

### Step 5: Link Project
```bash
cd backend/supabase
supabase link --project-ref [your-project-ref]
```

When prompted, enter your Supabase access token (get from https://app.supabase.com/account/tokens)

### Step 6: Deploy Database
```bash
cd backend/supabase
supabase db push
```

This applies all migrations in the `migrations/` folder.

### Step 7: Deploy Edge Functions
```bash
cd backend/supabase

# Deploy all TypeScript functions
supabase functions deploy auth
supabase functions deploy oauth-initiate
supabase functions deploy oauth-callback
supabase functions deploy oauth-status
supabase functions deploy oauth-disconnect
supabase functions deploy broker-order
supabase functions deploy market-data
supabase functions deploy discord-alert
supabase functions deploy payment-webhook
supabase functions deploy payment

# Or deploy all at once:
for func in functions/*/; do
  func_name=$(basename "$func")
  if [ -f "$func/index.ts" ]; then
    supabase functions deploy "$func_name" --no-verify-jwt
  fi
done
```

**Note**: Python functions (backtest, greeks, optimize, paper-trading) need verification - Supabase edge functions primarily support Deno/TypeScript.

---

## 3. GitHub Actions Auto-Deploy Setup

### Step 1: Create Supabase Access Token
1. Go to https://app.supabase.com/account/tokens
2. Click "Generate new token"
3. Give it a name: "GitHub Actions"
4. Copy the token

### Step 2: Add GitHub Secrets
Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:
```
SUPABASE_ACCESS_TOKEN=[token from step 1]
SUPABASE_PROJECT_REF=[your-project-ref]
```

### Step 3: Enable Workflow
The workflow file is already created at `.github/workflows/deploy-supabase.yml`

It will automatically deploy to Supabase when you push changes to:
- `backend/supabase/**`

You can also trigger it manually from the Actions tab.

---

## 4. Verification Checklist

### Frontend (Netlify)
- [ ] Site builds successfully
- [ ] Frontend loads at your Netlify URL
- [ ] No console errors
- [ ] Environment variables are set

### Backend (Supabase)
- [ ] Database migrations applied
- [ ] Tables visible in Supabase dashboard
- [ ] Edge functions deployed
- [ ] Edge functions show in Supabase dashboard

### Integration
- [ ] Frontend can connect to Supabase
- [ ] Auth works (signup/login)
- [ ] API calls work
- [ ] CORS configured correctly

### Test Commands
```bash
# Test frontend locally
cd frontend
npm install
npm run dev

# Test backend locally
cd backend/supabase
supabase start
supabase functions serve

# Test edge function
curl http://localhost:54321/functions/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'
```

---

## 5. Troubleshooting

### Netlify Build Fails
- Check build logs in Netlify dashboard
- Verify Node version is 18
- Ensure `frontend/dist` is created
- Check environment variables are set

### Supabase Functions Fail
- Check function logs in Supabase dashboard
- Verify secrets are set
- Check CORS headers
- Ensure imports use Deno URLs (https://deno.land/...)

### Python Functions Don't Deploy
- Supabase edge functions primarily support Deno
- Consider converting to TypeScript OR
- Deploy as separate microservices

### CORS Errors
Update CORS headers in edge functions:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Database Connection Issues
- Verify connection string
- Check RLS policies
- Ensure migrations ran successfully

---

## 6. Production Best Practices

### Security
- [ ] Use HTTPS everywhere
- [ ] Set proper CORS origins (not *)
- [ ] Enable RLS on all tables
- [ ] Rotate secrets regularly
- [ ] Use service role key only in edge functions
- [ ] Use anon key in frontend

### Monitoring
- [ ] Set up Supabase alerts
- [ ] Monitor edge function logs
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Monitor Netlify deploy status

### Performance
- [ ] Enable caching headers
- [ ] Optimize bundle size
- [ ] Use lazy loading
- [ ] Monitor edge function cold starts

---

## 7. Quick Commands Reference

```bash
# Supabase
supabase start              # Start local Supabase
supabase stop               # Stop local Supabase
supabase status             # Check status
supabase db reset           # Reset database
supabase db push            # Push migrations
supabase functions serve    # Serve functions locally
supabase functions deploy   # Deploy a function

# Netlify
netlify init               # Initialize site
netlify deploy             # Deploy preview
netlify deploy --prod      # Deploy to production
netlify dev                # Run dev server with functions

# Frontend
cd frontend
npm install                # Install dependencies
npm run dev                # Development server
npm run build              # Production build
npm run preview            # Preview production build
npm run lint               # Lint code

# Git
git status                 # Check status
git add .                  # Stage changes
git commit -m "message"    # Commit
git push                   # Push to GitHub (triggers auto-deploy)
```

---

## 8. Support Resources

- **Netlify Docs**: https://docs.netlify.com
- **Supabase Docs**: https://supabase.com/docs
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **GitHub Actions**: https://docs.github.com/en/actions

---

## Next Steps After Deployment

1. Test all functionality in production
2. Set up custom domain (optional)
3. Configure SSL (automatic on Netlify)
4. Set up monitoring and alerts
5. Create backup strategy
6. Document API endpoints
7. Set up staging environment

---

**Need Help?** Check `NETLIFY_SUPABASE_AUDIT.md` for detailed compatibility information.
