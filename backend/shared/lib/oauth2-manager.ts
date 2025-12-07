import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface OAuth2Config {
  broker: string
  client_id: string
  client_secret: string
  authorization_url: string
  token_url: string
  redirect_uri: string
  scopes: string[]
  token_expiry_buffer?: number // Refresh before expiry (default 300s)
}

export interface OAuth2Credentials {
  access_token: string
  refresh_token: string
  expires_at: number
  scope?: string
  token_type?: string
}

export class OAuth2Manager {
  private supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  constructor(private config: OAuth2Config) {}

  /**
   * Step 1: Generate authorization URL for user to visit
   */
  getAuthorizationUrl(userId: string, state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      scope: this.config.scopes.join(' '),
      state: state || this.generateState(userId),
    })

    return `${this.config.authorization_url}?${params.toString()}`
  }

  /**
   * Step 2: Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, userId: string): Promise<OAuth2Credentials> {
    const response = await fetch(this.config.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.config.client_id}:${this.config.client_secret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirect_uri,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
    }

    const data = await response.json()
    
    const credentials: OAuth2Credentials = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
      token_type: data.token_type,
    }

    // Store credentials in database
    await this.storeCredentials(userId, credentials)

    return credentials
  }

  /**
   * Step 3: Refresh access token when expired
   */
  async refreshAccessToken(userId: string): Promise<OAuth2Credentials> {
    // Get existing credentials
    const { data: connection, error } = await this.supabase
      .from('user_broker_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('broker_name', this.config.broker)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      throw new Error('No active broker connection found')
    }

    const credentials = connection.credentials as OAuth2Credentials

    if (!credentials.refresh_token) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(this.config.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.config.client_id}:${this.config.client_secret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh_token,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
    }

    const data = await response.json()

    const newCredentials: OAuth2Credentials = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || credentials.refresh_token, // Keep old if not provided
      expires_at: Date.now() + (data.expires_in * 1000),
      scope: data.scope || credentials.scope,
      token_type: data.token_type || credentials.token_type,
    }

    // Update credentials in database
    await this.storeCredentials(userId, newCredentials)

    return newCredentials
  }

  /**
   * Get valid credentials, automatically refreshing if needed
   */
  async getValidCredentials(userId: string): Promise<OAuth2Credentials> {
    const { data: connection, error } = await this.supabase
      .from('user_broker_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('broker_name', this.config.broker)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      throw new Error('No active broker connection found')
    }

    const credentials = connection.credentials as OAuth2Credentials

    // Check if token needs refresh (with buffer)
    const buffer = this.config.token_expiry_buffer ?? 300000 // 5 minutes default
    const needsRefresh = Date.now() >= (credentials.expires_at - buffer)

    if (needsRefresh) {
      console.log(`Token expired or expiring soon for ${this.config.broker}, refreshing...`)
      return await this.refreshAccessToken(userId)
    }

    return credentials
  }

  /**
   * Revoke access (disconnect broker)
   */
  async revokeAccess(userId: string): Promise<void> {
    // Mark connection as inactive
    const { error } = await this.supabase
      .from('user_broker_connections')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('broker_name', this.config.broker)

    if (error) {
      throw new Error(`Failed to revoke access: ${error.message}`)
    }

    console.log(`Revoked ${this.config.broker} access for user ${userId}`)
  }

  /**
   * Store credentials securely in database
   */
  private async storeCredentials(userId: string, credentials: OAuth2Credentials): Promise<void> {
    // Check if connection exists
    const { data: existing } = await this.supabase
      .from('user_broker_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('broker_name', this.config.broker)
      .single()

    if (existing) {
      // Update existing connection
      const { error } = await this.supabase
        .from('user_broker_connections')
        .update({
          credentials,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        throw new Error(`Failed to update credentials: ${error.message}`)
      }
    } else {
      // Insert new connection
      const { error } = await this.supabase
        .from('user_broker_connections')
        .insert({
          user_id: userId,
          broker_name: this.config.broker,
          credentials,
          is_active: true,
        })

      if (error) {
        throw new Error(`Failed to store credentials: ${error.message}`)
      }
    }

    console.log(`Stored credentials for ${this.config.broker} and user ${userId}`)
  }

  /**
   * Generate secure state parameter for CSRF protection
   */
  private generateState(userId: string): string {
    const timestamp = Date.now().toString(36)
    const random = crypto.randomUUID()
    return btoa(`${userId}:${timestamp}:${random}`)
  }

  /**
   * Validate state parameter
   */
  validateState(state: string, expectedUserId: string): boolean {
    try {
      const decoded = atob(state)
      const [userId, timestamp] = decoded.split(':')
      
      // Check user ID matches
      if (userId !== expectedUserId) {
        return false
      }

      // Check state is not too old (15 minutes max)
      const stateTime = parseInt(timestamp, 36)
      const now = Date.now()
      const maxAge = 15 * 60 * 1000 // 15 minutes

      return (now - stateTime) < maxAge
    } catch {
      return false
    }
  }
}

/**
 * Factory function to create OAuth2 managers for specific brokers
 */
export function createOAuth2Manager(broker: string): OAuth2Manager {
  const configs: Record<string, OAuth2Config> = {
    alpaca: {
      broker: 'alpaca',
      client_id: Deno.env.get('ALPACA_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('ALPACA_CLIENT_SECRET') ?? '',
      authorization_url: 'https://app.alpaca.markets/oauth/authorize',
      token_url: 'https://api.alpaca.markets/oauth/token',
      redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
      scopes: ['account:write', 'trading'],
      token_expiry_buffer: 300000, // 5 minutes
    },
    tdameritrade: {
      broker: 'tdameritrade',
      client_id: Deno.env.get('TD_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('TD_CLIENT_SECRET') ?? '',
      authorization_url: 'https://auth.tdameritrade.com/auth',
      token_url: 'https://api.tdameritrade.com/v1/oauth2/token',
      redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
      scopes: ['PlaceTrades', 'AccountAccess', 'MoveMoney'],
      token_expiry_buffer: 300000,
    },
    schwab: {
      broker: 'schwab',
      client_id: Deno.env.get('SCHWAB_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('SCHWAB_CLIENT_SECRET') ?? '',
      authorization_url: 'https://api.schwabapi.com/v1/oauth/authorize',
      token_url: 'https://api.schwabapi.com/v1/oauth/token',
      redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
      scopes: ['api'],
      token_expiry_buffer: 300000,
    },
    etrade: {
      broker: 'etrade',
      client_id: Deno.env.get('ETRADE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('ETRADE_CLIENT_SECRET') ?? '',
      authorization_url: 'https://us.etrade.com/e/t/etws/authorize',
      token_url: 'https://api.etrade.com/oauth/access_token',
      redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
      scopes: [],
      token_expiry_buffer: 300000,
    },
    tradier: {
      broker: 'tradier',
      client_id: Deno.env.get('TRADIER_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('TRADIER_CLIENT_SECRET') ?? '',
      authorization_url: 'https://api.tradier.com/v1/oauth/authorize',
      token_url: 'https://api.tradier.com/v1/oauth/accesstoken',
      redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
      scopes: ['read', 'write', 'market', 'trade'],
      token_expiry_buffer: 300000,
    },
  }

  const config = configs[broker.toLowerCase()]
  if (!config) {
    throw new Error(`Unsupported broker: ${broker}`)
  }

  return new OAuth2Manager(config)
}
