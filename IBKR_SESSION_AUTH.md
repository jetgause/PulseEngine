# IBKR Session-Based Authentication Guide

## Overview

Interactive Brokers (IBKR) currently requires session-based authentication via their Client Portal Gateway until their OAuth2 API becomes publicly available. This guide explains how to set up and use IBKR authentication with PulseEngine.

## Prerequisites

1. **IBKR Account**: Active Interactive Brokers trading account
2. **Client Portal Gateway**: Downloaded and configured
3. **2FA Authentication**: Set up on your IBKR account

## Setup

### 1. Download Client Portal Gateway

```bash
# Download from IBKR
# https://www.interactivebrokers.com/api/doc.html

# Extract the zip file
unzip clientportal.gw.zip

# Navigate to directory
cd clientportal.gw
```

### 2. Configure Gateway

Edit `root/conf.yaml`:

```yaml
proxyRemoteSsl: true
proxyRemoteHost: localhost
proxyRemotePort: 5000
listenSsl: true
listenPort: 5000
```

### 3. Start Gateway

```bash
# Start the gateway
./bin/run.sh root/conf.yaml

# Gateway will start on https://localhost:5000
```

### 4. Complete 2FA Authentication

Open browser to `https://localhost:5000` and complete the 2FA authentication process.

## Usage in PulseEngine

### Connecting IBKR Account

The IBKR session authentication is handled automatically when submitting orders. The system will:

1. Check if Client Portal Gateway is running
2. Verify authentication status
3. Auto-reauthenticate if session expired
4. Keep session alive during trading

### Submitting Orders

```typescript
// Same API as other brokers
const { data: order } = await fetch('/broker-order', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt_token}`,
    'Idempotency-Key': crypto.randomUUID(),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    broker: 'ibkr',
    action: 'buy',
    symbol: 'AAPL',
    qty: 100,
    order_type: 'market',
    time_in_force: 'day'
  })
}).then(r => r.json())
```

### Session Management

The `IBKRSessionAuth` class handles all session management:

```typescript
import { createIBKRSessionAuth } from './ibkr-session-auth.ts'

const ibkr = createIBKRSessionAuth(userId)

// Authenticate (checks if gateway is running and authenticated)
await ibkr.authenticate()

// Submit order (auto-authenticates if needed)
const result = await ibkr.submitOrder({
  symbol: 'TSLA',
  action: 'buy',
  quantity: 50,
  orderType: 'limit',
  price: 200.00,
  tif: 'day'
})

// Get account information
const summary = await ibkr.getAccountSummary()
const positions = await ibkr.getPositions()

// Keep session alive (call every 30 seconds)
await ibkr.keepAlive()

// Logout
await ibkr.logout()
```

## Session Lifecycle

### Authentication Flow

```
1. User submits order via /broker-order
2. System checks for active IBKR session
3. If no session:
   a. Check if Client Portal Gateway is running
   b. Verify 2FA authentication completed
   c. Create session ID and store in database
4. If session exists:
   a. Validate session is still active
   b. Refresh if expired (requires 2FA)
5. Submit order using session
```

### Session Expiry

- **Duration**: 24 hours
- **Auto-refresh**: System attempts to reauthenticate
- **2FA Required**: User must complete 2FA in browser if session expired
- **Keep-alive**: Gateway must be pinged every 30 seconds

## Error Handling

### Common Errors

**Gateway Not Running**:
```
Error: IBKR Client Portal Gateway not running
Solution: Start gateway with ./bin/run.sh root/conf.yaml
```

**Not Authenticated**:
```
Error: Not authenticated with IBKR
Solution: Open https://localhost:5000 and complete 2FA
```

**Session Expired**:
```
Error: Session expired
Solution: Complete 2FA authentication again in browser
```

## Security Considerations

### Local Gateway

- Gateway runs locally on user's machine
- HTTPS with self-signed certificate
- No credentials stored in database
- Session ID used for tracking only

### Production Deployment

For production, consider:

1. **Dedicated Server**: Run gateway on secure server
2. **VPN Access**: Restrict gateway access via VPN
3. **Session Monitoring**: Track session activity and expiry
4. **Automatic Reauthentication**: Implement retry logic for expired sessions

## Limitations

### Current Limitations

1. **No OAuth2**: Waiting for IBKR public OAuth2 API
2. **Local Gateway Required**: Must run gateway locally or on server
3. **2FA Required**: Manual 2FA authentication needed
4. **Session Management**: 24-hour sessions require monitoring

### Workarounds

1. **Keep-Alive Worker**: Background job to keep sessions active
2. **Session Alerts**: Notify users when sessions expire
3. **Multiple Accounts**: Support multiple IBKR accounts per user

## Future: OAuth2 Migration

When IBKR releases public OAuth2:

1. Update `oauth2-manager.ts` with IBKR config
2. Migrate users from session-based to OAuth2
3. Remove `ibkr-session-auth.ts` requirement
4. Update documentation

### Migration Plan

```typescript
// Future OAuth2 config
const IBKR_OAUTH2_CONFIG = {
  broker: 'ibkr',
  client_id: process.env.IBKR_CLIENT_ID,
  client_secret: process.env.IBKR_CLIENT_SECRET,
  authorization_url: 'https://oauth.ibkr.com/authorize',
  token_url: 'https://oauth.ibkr.com/token',
  redirect_uri: `${FRONTEND_URL}/oauth/callback`,
  scopes: ['trading', 'account_info', 'portfolio'],
}
```

## Monitoring

### Health Checks

```typescript
// Check if gateway is healthy
const health = await fetch('https://localhost:5000/v1/api/tickle', {
  method: 'POST'
})

if (!health.ok) {
  console.error('Gateway not responding')
}
```

### Session Status

```typescript
// Check authentication status
const status = await fetch('https://localhost:5000/v1/api/iserver/auth/status', {
  method: 'POST'
})

const { authenticated, competing, message } = await status.json()
```

## Support

### Resources

- [IBKR Client Portal API Documentation](https://www.interactivebrokers.com/api/doc.html)
- [IBKR Web API Reference](https://www.interactivebrokers.com/api/doc.html)
- [IBKR API Support](https://www.interactivebrokers.com/en/support/api.php)

### Troubleshooting

1. **Check Gateway Logs**: `clientportal.gw/logs/`
2. **Verify 2FA**: Ensure 2FA is completed in browser
3. **Test Connectivity**: Use `curl` to test gateway endpoints
4. **Review Permissions**: Ensure account has trading permissions

## Example: Complete Integration

```typescript
// Complete example of IBKR integration
import { createIBKRSessionAuth } from './ibkr-session-auth.ts'

async function tradingExample(userId: string) {
  const ibkr = createIBKRSessionAuth(userId)
  
  try {
    // Authenticate
    console.log('Authenticating...')
    await ibkr.authenticate()
    
    // Get account info
    const summary = await ibkr.getAccountSummary()
    console.log('Account Balance:', summary.totalcashvalue)
    
    // Get current positions
    const positions = await ibkr.getPositions()
    console.log('Current Positions:', positions.length)
    
    // Submit market order
    const order = await ibkr.submitOrder({
      symbol: 'AAPL',
      action: 'buy',
      quantity: 10,
      orderType: 'market',
      tif: 'day'
    })
    
    console.log('Order submitted:', order[0].order_id)
    
    // Keep session alive
    setInterval(() => {
      ibkr.keepAlive()
    }, 30000) // Every 30 seconds
    
  } catch (error) {
    console.error('Trading error:', error.message)
    
    if (error.message.includes('not running')) {
      console.log('Please start Client Portal Gateway')
    } else if (error.message.includes('Not authenticated')) {
      console.log('Please complete 2FA at https://localhost:5000')
    }
  }
}
```

## Conclusion

IBKR's session-based authentication is a temporary solution until OAuth2 is publicly available. The `IBKRSessionAuth` class provides a seamless interface that will be easy to migrate to OAuth2 when it becomes available.

For now, users must run the Client Portal Gateway locally or on a secure server and complete 2FA authentication. The system handles session management, validation, and automatic reauthentication transparently.
