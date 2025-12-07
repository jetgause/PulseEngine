# PulseEngine Deployment Guide

This guide covers deploying PulseEngine to production environments.

## Prerequisites

- GitHub account
- Netlify account
- Supabase account
- Domain name (optional)

## Backend Deployment (Supabase)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and API keys

### 2. Configure Local Environment

```bash
cd backend
supabase login
supabase link --project-ref your-project-ref
```

### 3. Deploy Database Migrations

```bash
supabase db push
```

This will apply all migrations from `backend/supabase/migrations/`.

### 4. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy gateway
supabase functions deploy tools/execute
supabase functions deploy tools/list

# Or deploy all at once
supabase functions deploy --project-ref your-project-ref
```

### 5. Set Environment Variables

In Supabase dashboard, go to Settings > Edge Functions and set:

```
JWT_SECRET=your-jwt-secret
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### 6. Configure Authentication

1. Go to Authentication > Settings
2. Configure allowed redirect URLs
3. Set up email templates
4. Enable social providers if needed

### 7. Configure Storage (if needed)

1. Go to Storage
2. Create buckets for file uploads
3. Configure RLS policies

## Frontend Deployment (Netlify)

### 1. Connect Repository

1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Choose your GitHub repository
4. Select the main branch

### 2. Configure Build Settings

- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `frontend/dist`
- **Node version**: 18

### 3. Set Environment Variables

In Netlify dashboard, go to Site settings > Environment variables:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=your-supabase-url
```

### 4. Configure Domain (optional)

1. Go to Domain management
2. Add custom domain
3. Configure DNS records
4. Enable HTTPS (automatic)

### 5. Deploy

Push to main branch to trigger automatic deployment.

## Post-Deployment

### 1. Verify Database

```bash
# Check tables
supabase db diff

# Verify RLS policies
SELECT * FROM pg_policies;
```

### 2. Test API Endpoints

```bash
# Health check
curl https://your-supabase-url/functions/v1/gateway/health

# List tools (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-supabase-url/functions/v1/gateway/api/v1/tools
```

### 3. Monitor Performance

- **Netlify**: Check build logs and analytics
- **Supabase**: Monitor database performance and function logs

### 4. Set Up Backups

Configure automatic database backups in Supabase dashboard.

## CI/CD Pipeline

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
      - run: supabase db push
      - run: supabase functions deploy

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm ci && npm run build
      # Netlify will auto-deploy
```

## Rollback Procedures

### Database Rollback

```bash
# Rollback last migration
supabase db reset

# Apply specific migration
supabase db push --migration-id 20250101000000
```

### Function Rollback

Redeploy previous version:

```bash
git checkout previous-commit
supabase functions deploy
```

### Frontend Rollback

In Netlify dashboard:
1. Go to Deploys
2. Find previous successful deploy
3. Click "Publish deploy"

## Monitoring and Alerts

### Set Up Monitoring

1. **Uptime Monitoring**: Use Pingdom or UptimeRobot
2. **Error Tracking**: Integrate Sentry
3. **Performance**: Enable Netlify Analytics
4. **Logs**: Configure Supabase logging

### Alert Configuration

Set up alerts for:
- API error rates > 5%
- Response times > 1000ms
- Database CPU > 80%
- Failed function executions

## Scaling Considerations

### Database Scaling

1. Upgrade Supabase plan for more resources
2. Add read replicas
3. Implement connection pooling
4. Optimize queries with indexes

### Function Scaling

Edge functions auto-scale, but monitor:
- Cold start times
- Memory usage
- Execution duration

### Frontend Scaling

Netlify handles scaling automatically, but:
- Enable CDN for assets
- Implement code splitting
- Optimize bundle size

## Security Checklist

- [ ] Environment variables configured
- [ ] RLS policies enabled
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] SSL/TLS enabled
- [ ] Security headers set
- [ ] Backup strategy implemented
- [ ] Monitoring and alerts configured

## Troubleshooting

### Common Issues

**Database connection errors**
- Check database status in Supabase dashboard
- Verify connection string
- Check for firewall issues

**Function deployment failures**
- Check function logs
- Verify Deno dependencies
- Check environment variables

**Frontend build failures**
- Check Node version
- Clear cache and rebuild
- Verify environment variables

## Support

For deployment issues:
- Supabase: [docs.supabase.com](https://docs.supabase.com)
- Netlify: [docs.netlify.com](https://docs.netlify.com)
- GitHub Issues: [Report an issue](https://github.com/jetgause/PulseEngine/issues)
