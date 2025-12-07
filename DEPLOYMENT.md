# PulseEngine Deployment Guide

This guide walks you through deploying PulseEngine to production using Netlify (frontend) and Supabase (backend).

## Prerequisites

Before deployment, ensure you have:
- GitHub account with the PulseEngine repository
- Netlify account (free tier works)
- Supabase account (free tier works)
- Node.js 18+ installed locally
- Supabase CLI installed: `npm install -g supabase`

## Part 1: Supabase Backend Deployment

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose an organization (or create one)
4. Fill in project details:
   - Name: `pulseengine`
   - Database Password: (generate a strong password)
   - Region: Choose closest to your users
5. Click "Create new project"
6. Wait for project to be ready (2-3 minutes)

### Step 2: Get Your Credentials

From your Supabase project dashboard:

1. Click "Settings" (gear icon) > "API"
2. Copy and save these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public key**: `eyJhbG...` (for frontend)
   - **Service Role key**: `eyJhbG...` (for backend - keep secret!)

### Step 3: Set Up Database Schema

From your local machine:

```bash
cd /path/to/PulseEngine

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Push the database schema
supabase db push backend/supabase/migrations/001_initial_schema.sql
```

Alternatively, you can run the migration directly in Supabase:

1. Go to your Supabase project dashboard
2. Click "SQL Editor"
3. Copy the contents of `backend/supabase/migrations/001_initial_schema.sql`
4. Paste and click "Run"

### Step 4: Deploy Edge Functions

Deploy each Edge Function to Supabase:

```bash
# Navigate to project root
cd /path/to/PulseEngine

# Deploy backtest function
supabase functions deploy backtest --project-ref YOUR_PROJECT_REF

# Deploy paper trading function
supabase functions deploy paper-trading --project-ref YOUR_PROJECT_REF

# Deploy greeks calculator function
supabase functions deploy greeks --project-ref YOUR_PROJECT_REF

# Deploy optimizer function
supabase functions deploy optimize --project-ref YOUR_PROJECT_REF
```

### Step 5: Configure Edge Function Secrets

Set environment variables for Edge Functions:

```bash
# Set Supabase URL
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co

# Set service role key (from Step 2)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Or set them in the Supabase dashboard:
1. Go to "Edge Functions" in sidebar
2. Click on a function
3. Go to "Settings" tab
4. Add secrets

### Step 6: Test Edge Functions

Test your deployed functions:

```bash
# Test backtest function
curl -X POST \
  https://xxxxx.supabase.co/functions/v1/backtest \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_name": "test",
    "params": {},
    "start_date": "2023-01-01",
    "end_date": "2023-12-31",
    "initial_capital": 100000
  }'
```

## Part 2: Netlify Frontend Deployment

### Option A: Deploy via Netlify Dashboard (Recommended)

#### Step 1: Connect GitHub Repository

1. Go to [netlify.com](https://netlify.com) and log in
2. Click "Add new site" > "Import an existing project"
3. Choose "GitHub"
4. Authorize Netlify to access your repositories
5. Select the `PulseEngine` repository
6. Select the branch to deploy (e.g., `main`)

#### Step 2: Configure Build Settings

Configure the following in Netlify:

- **Base directory**: (leave empty)
- **Build command**: `cd frontend && npm install && npm run build`
- **Publish directory**: `frontend/dist`
- **Node version**: 18 (set in Environment variables as `NODE_VERSION=18`)

#### Step 3: Add Environment Variables

In Netlify dashboard:

1. Go to "Site settings" > "Environment variables"
2. Click "Add a variable"
3. Add these variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL (from Part 1, Step 2)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key (from Part 1, Step 2)
   - `NODE_VERSION`: `18`

#### Step 4: Deploy

1. Click "Deploy site"
2. Wait for build to complete (2-5 minutes)
3. Your site will be live at `https://random-name-12345.netlify.app`

#### Step 5: Configure Custom Domain (Optional)

1. Go to "Domain settings"
2. Click "Add custom domain"
3. Follow instructions to:
   - Add your domain
   - Configure DNS records
   - Enable HTTPS

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Navigate to project root
cd /path/to/PulseEngine

# Initialize Netlify site
netlify init

# Follow prompts:
# - Create & configure a new site
# - Choose your team
# - Site name: pulseengine
# - Build command: cd frontend && npm install && npm run build
# - Publish directory: frontend/dist

# Set environment variables
netlify env:set VITE_SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key"

# Deploy to production
netlify deploy --prod
```

## Part 3: Post-Deployment Configuration

### Enable Supabase Authentication (Optional)

If you want user authentication:

1. Go to Supabase dashboard > "Authentication" > "Providers"
2. Enable Email provider
3. Configure email templates
4. Update frontend to include auth flows

### Set Up CORS (if needed)

In Supabase dashboard:

1. Go to "Settings" > "API"
2. Add your Netlify domain to allowed origins
3. Click "Save"

### Enable Real-Time Subscriptions (Optional)

For real-time updates:

1. Go to Supabase dashboard > "Database" > "Replication"
2. Enable replication for tables you want to subscribe to
3. Update frontend code to subscribe to changes

## Part 4: Verification

### Test Your Deployment

1. Visit your Netlify URL
2. Navigate through the application:
   - Dashboard should load
   - Paper Trading interface should work
   - Try calculating Greeks
   - Submit a backtest configuration
   - Start an optimization job

### Check Database

1. Go to Supabase dashboard > "Table Editor"
2. Verify tables were created correctly
3. Check that data is being written (after testing)

### Monitor Logs

#### Netlify Logs
1. Go to Netlify dashboard > "Deploys"
2. Click on a deploy to see build logs
3. Go to "Functions" to see function logs (if using Netlify functions)

#### Supabase Logs
1. Go to Supabase dashboard > "Logs"
2. Select "API" to see API request logs
3. Select "Functions" to see Edge Function logs

## Part 5: Ongoing Maintenance

### Update Deployment

#### Frontend Updates
```bash
# Push to GitHub
git add .
git commit -m "Update frontend"
git push origin main

# Netlify will automatically rebuild and deploy
```

#### Backend Updates
```bash
# Update database schema
supabase db push new_migration.sql

# Redeploy Edge Functions
supabase functions deploy backtest
supabase functions deploy paper-trading
supabase functions deploy greeks
supabase functions deploy optimize
```

### Monitoring

- **Netlify Analytics**: Enable in Netlify dashboard
- **Supabase Logs**: Monitor in Supabase dashboard
- **Error Tracking**: Consider adding Sentry or similar

### Backups

Supabase automatically backs up your database. To create manual backups:

```bash
# Export database
supabase db dump -f backup.sql

# Import database (if needed)
supabase db reset
psql -h YOUR_DB_HOST -U postgres -d postgres -f backup.sql
```

## Troubleshooting

### Build Fails on Netlify

**Issue**: Build fails with module errors
**Solution**: 
- Check that all dependencies are in `package.json`
- Verify Node version is set to 18
- Check build logs for specific errors

**Issue**: Environment variables not found
**Solution**:
- Verify variables are set in Netlify dashboard
- Check variable names match exactly (including `VITE_` prefix)
- Redeploy after adding variables

### Edge Functions Not Working

**Issue**: Functions return 500 errors
**Solution**:
- Check function logs in Supabase dashboard
- Verify secrets are set correctly
- Test functions locally with `supabase functions serve`

**Issue**: CORS errors
**Solution**:
- Add Netlify domain to Supabase allowed origins
- Verify API keys are correct

### Database Issues

**Issue**: Cannot connect to database
**Solution**:
- Verify database is running in Supabase dashboard
- Check connection strings
- Verify RLS policies allow your operations

**Issue**: Migrations fail
**Solution**:
- Check SQL syntax
- Verify table names and columns
- Run migrations one at a time

## Security Checklist

- [ ] Never commit `.env` files to Git
- [ ] Keep Service Role key secret (never expose in frontend)
- [ ] Enable Row Level Security on all tables
- [ ] Use HTTPS for all endpoints
- [ ] Regularly update dependencies
- [ ] Monitor for suspicious activity in logs
- [ ] Set up rate limiting (Supabase provides this)
- [ ] Enable database backups

## Performance Optimization

### Frontend
- Enable Netlify's asset optimization
- Use lazy loading for routes
- Implement caching strategies
- Consider CDN for static assets

### Backend
- Index frequently queried columns
- Use connection pooling
- Optimize SQL queries
- Consider caching frequently accessed data

## Cost Estimation

### Free Tier Limits

**Supabase Free Tier**:
- 500 MB database space
- 2 GB bandwidth
- 50 MB file storage
- Unlimited API requests

**Netlify Free Tier**:
- 100 GB bandwidth
- 300 build minutes
- Unlimited sites

### When to Upgrade

Consider upgrading when:
- Database exceeds 500 MB
- Need more than 2 GB/month bandwidth
- Require priority support
- Need advanced features (SAML SSO, etc.)

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **PulseEngine Issues**: https://github.com/jetgause/PulseEngine/issues
- **Community Support**: GitHub Discussions

---

**Congratulations!** Your PulseEngine trading platform is now deployed and ready for use. Remember to monitor your usage and upgrade plans as needed.
