import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface OAuth2Config {
  broker: string
  client_id: string
  client_secret: string
  authorization_url: string
  token_url: string
  revoke_url?: string
  redirect_uri: string
  scopes: string[]
  token_expiry_buffer?: number
  requires_pkce?: boolean
  custom_headers?: Record<string, string>
}

export interface OAuth2Credentials {
  access_token: string
  refresh_token?: string
  expires_at: number
  scope?: string
  token_type?: string
}

/**
 * Universal OAuth2 Manager with enhanced features for production
 */
export class UniversalOAuth2Manager {
  private supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  private pkceVerifier: string | null = null

  constructor(private config: OAuth2Config) {
    this.config.token_expiry_buffer = config.token_expiry_buffer || 300 // 5 minutes default
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private async generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    const verifier = this.generateRandomString(128)
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    
    return { verifier, challenge }
  }

  /**
   * Generate authorization URL
   */
  async getAuthorizationUrl(userId: string, state?: string): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.client_id,
      redirect_uri: this.config.redirect_uri,
      scope: this.config.scopes.join(' '),
      state: state || this.generateState(userId),
    })

    // Add PKCE if required
    if (this.config.requires_pkce) {
      const { verifier, challenge } = await this.generatePKCE()
      this.pkceVerifier = verifier
      params.append('code_challenge', challenge)
      params.append('code_challenge_method', 'S256')
      
      // Store verifier in database temporarily
      await this.supabase.from('oauth_pkce_verifiers').insert({
        user_id: userId,
        broker: this.config.broker,
        verifier,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
    }

    return `${this.config.authorization_url}?${params.toString()}`
  }

  /**
   * Exchange code for tokens
   */
  async exchangeCodeForTokens(code: string, userId: string): Promise<OAuth2Credentials> {
    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirect_uri,
    }

    // Add PKCE verifier if required
    if (this.config.requires_pkce) {
      const { data: verifierData } = await this.supabase
        .from('oauth_pkce_verifiers')
        .select('verifier')
        .eq('user_id', userId)
        .eq('broker', this.config.broker)
        .single()
      
      if (verifierData?.verifier) {
        body.code_verifier = verifierData.verifier
        this.pkceVerifier = verifierData.verifier
        
        // Delete used verifier
        await this.supabase
          .from('oauth_pkce_verifiers')
          .delete()
          .eq('user_id', userId)
          .eq('broker', this.config.broker)
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${this.config.client_id}:${this.config.client_secret}`)}`,
      ...this.config.custom_headers,
    }

    const response = await fetch(this.config.token_url, {
      method: 'POST',
      headers,
      body: new URLSearchParams(body),
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
      token_type: data.token_type || 'Bearer',
    }

    // Store credentials
    await this.storeCredentials(userId, credentials)

    return credentials
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(userId: string): Promise<OAuth2Credentials> {
    const credentials = await this.getStoredCredentials(userId)
    
    if (!credentials?.refresh_token) {
      throw new Error('No refresh token available')
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${this.config.client_id}:${this.config.client_secret}`)}`,
      ...this.config.custom_headers,
    }

    const response = await fetch(this.config.token_url, {
      method: 'POST',
      headers,
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
      refresh_token: data.refresh_token || credentials.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
      token_type: data.token_type || 'Bearer',
    }

    await this.storeCredentials(userId, newCredentials)

    return newCredentials
  }

  /**
   * Get valid access token (auto-refresh if needed)
   */
  async getAccessToken(userId: string): Promise<string> {
    const credentials = await this.getStoredCredentials(userId)
    
    if (!credentials) {
      throw new Error(`No credentials found for broker ${this.config.broker}`)
    }

    const buffer = (this.config.token_expiry_buffer || 300) * 1000
    const needsRefresh = credentials.expires_at - Date.now() < buffer

    if (needsRefresh && credentials.refresh_token) {
      const refreshed = await this.refreshAccessToken(userId)
      return refreshed.access_token
    }

    return credentials.access_token
  }

  /**
   * Revoke access
   */
  async revokeAccess(userId: string): Promise<void> {
    const credentials = await this.getStoredCredentials(userId)
    
    if (credentials && this.config.revoke_url) {
      try {
        await fetch(this.config.revoke_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${this.config.client_id}:${this.config.client_secret}`)}`,
          },
          body: new URLSearchParams({
            token: credentials.access_token,
            token_type_hint: 'access_token',
          }),
        })
      } catch (error) {
        console.error('Failed to revoke at broker:', error)
      }
    }

    // Delete from database
    await this.supabase
      .from('user_broker_connections')
      .delete()
      .eq('user_id', userId)
      .eq('broker', this.config.broker)
  }

  private async storeCredentials(userId: string, credentials: OAuth2Credentials): Promise<void> {
    await this.supabase
      .from('user_broker_connections')
      .upsert({
        user_id: userId,
        broker: this.config.broker,
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expires_at: new Date(credentials.expires_at).toISOString(),
        token_type: credentials.token_type,
        is_active: true,
      })
  }

  private async getStoredCredentials(userId: string): Promise<OAuth2Credentials | null> {
    const { data } = await this.supabase
      .from('user_broker_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('broker', this.config.broker)
      .eq('is_active', true)
      .single()

    if (!data) return null

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(data.expires_at).getTime(),
      token_type: data.token_type,
    }
  }

  private generateState(userId: string): string {
    return btoa(JSON.stringify({
      userId,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    }))
  }

  private generateRandomString(length: number): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .substring(0, length)
  }
}

/**
 * Pre-configured broker OAuth2 configurations
 */
export const BROKER_OAUTH2_CONFIGS: Record<string, OAuth2Config> = {
  alpaca: {
    broker: 'alpaca',
    client_id: Deno.env.get('ALPACA_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('ALPACA_CLIENT_SECRET') ?? '',
    authorization_url: 'https://app.alpaca.markets/oauth/authorize',
    token_url: 'https://api.alpaca.markets/oauth/token',
    revoke_url: 'https://api.alpaca.markets/oauth/revoke',
    redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
    scopes: ['account:write', 'trading'],
  },
  td_ameritrade: {
    broker: 'td_ameritrade',
    client_id: Deno.env.get('TD_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('TD_CLIENT_SECRET') ?? '',
    authorization_url: 'https://auth.tdameritrade.com/auth',
    token_url: 'https://api.tdameritrade.com/v1/oauth2/token',
    redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
    scopes: ['PlaceTrades', 'AccountAccess', 'MoveMoney'],
  },
  schwab: {
    broker: 'schwab',
    client_id: Deno.env.get('SCHWAB_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('SCHWAB_CLIENT_SECRET') ?? '',
    authorization_url: 'https://api.schwabapi.com/v1/oauth/authorize',
    token_url: 'https://api.schwabapi.com/v1/oauth/token',
    redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
    scopes: ['api'],
  },
  etrade: {
    broker: 'etrade',
    client_id: Deno.env.get('ETRADE_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('ETRADE_CLIENT_SECRET') ?? '',
    authorization_url: 'https://us.etrade.com/e/t/etws/authorize',
    token_url: 'https://api.etrade.com/oauth/access_token',
    redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
    scopes: ['accounts', 'orders'],
  },
  tradier: {
    broker: 'tradier',
    client_id: Deno.env.get('TRADIER_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('TRADIER_CLIENT_SECRET') ?? '',
    authorization_url: 'https://api.tradier.com/v1/oauth/authorize',
    token_url: 'https://api.tradier.com/v1/oauth/accesstoken',
    redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
    scopes: ['read', 'write', 'market', 'trade'],
  },
  tastytrade: {
    broker: 'tastytrade',
    client_id: Deno.env.get('TASTYTRADE_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('TASTYTRADE_CLIENT_SECRET') ?? '',
    authorization_url: 'https://api.tastyworks.com/oauth/authorize',
    token_url: 'https://api.tastyworks.com/oauth/token',
    redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
    scopes: ['trading', 'accounts'],
    requires_pkce: true,
  },
  ibkr: {
    broker: 'ibkr',
    client_id: Deno.env.get('IBKR_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('IBKR_CLIENT_SECRET') ?? '',
    authorization_url: 'https://oauth.ibkr.com/authorize',
    token_url: 'https://oauth.ibkr.com/token',
    redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
    scopes: ['trading', 'accounts'],
    // Note: IBKR OAuth2 not yet publicly available
  },
}
