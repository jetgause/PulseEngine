/**
 * IBKR Client Portal Gateway Session Authentication
 * Use this until OAuth2 becomes publicly available
 * 
 * IMPORTANT: Requires IBKR Client Portal Gateway running locally
 * Download from: https://www.interactivebrokers.com/api/doc.html
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export class IBKRSessionAuth {
  private baseUrl = 'https://localhost:5000' // Local gateway
  private sessionId: string | null = null
  private supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  constructor(private userId: string) {}

  /**
   * Check if Client Portal Gateway is running
   */
  async startGateway(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/api/tickle`, {
        method: 'POST',
      })
      
      if (response.ok) {
        console.log('✅ IBKR Gateway is running')
        return
      }
    } catch (error) {
      throw new Error(
        'IBKR Client Portal Gateway not running. Please start it:\n' +
        '1. Download from: https://www.interactivebrokers.com/api/\n' +
        '2. Run: ./clientportal.gw/bin/run.sh root/conf.yaml\n' +
        '3. Complete 2FA authentication in browser at https://localhost:5000'
      )
    }
  }

  /**
   * Authenticate and get session
   */
  async authenticate(): Promise<string> {
    await this.startGateway()

    // Check authentication status
    const statusResponse = await fetch(`${this.baseUrl}/v1/api/iserver/auth/status`, {
      method: 'POST',
    })

    const status = await statusResponse.json()

    if (!status.authenticated) {
      throw new Error(
        'Not authenticated with IBKR.\n' +
        'Open https://localhost:5000 and complete 2FA authentication'
      )
    }

    // Get session token (IBKR uses cookies, so we generate a session ID for tracking)
    this.sessionId = status.session || crypto.randomUUID()

    // Save session to database
    await this.saveSession(this.sessionId)

    console.log('✅ IBKR session authenticated')
    return this.sessionId
  }

  /**
   * Get valid session (auto-reauthenticate if needed)
   */
  async getSession(): Promise<string> {
    if (!this.sessionId) {
      const saved = await this.loadSession()
      if (saved) {
        this.sessionId = saved
      }
    }

    // Validate session is still active
    if (this.sessionId) {
      const isValid = await this.validateSession()
      if (isValid) {
        return this.sessionId
      }
    }

    // Re-authenticate if session is invalid
    return await this.authenticate()
  }

  /**
   * Validate current session
   */
  private async validateSession(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/api/iserver/auth/status`, {
        method: 'POST',
      })

      const status = await response.json()
      return status.authenticated === true
    } catch (error) {
      return false
    }
  }

  /**
   * Save session to database
   */
  private async saveSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('user_broker_connections')
      .upsert({
        user_id: this.userId,
        broker: 'ibkr',
        access_token: sessionId,
        token_type: 'session',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        is_active: true,
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,broker'
      })
  }

  /**
   * Load session from database
   */
  private async loadSession(): Promise<string | null> {
    const { data } = await this.supabase
      .from('user_broker_connections')
      .select('access_token, expires_at')
      .eq('user_id', this.userId)
      .eq('broker', 'ibkr')
      .eq('is_active', true)
      .single()

    if (!data) return null

    // Check if session is expired
    const expiresAt = new Date(data.expires_at).getTime()
    if (Date.now() > expiresAt) {
      return null
    }

    return data.access_token
  }

  /**
   * Logout and invalidate session
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/v1/api/logout`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Failed to logout from IBKR:', error)
    }

    // Remove from database
    await this.supabase
      .from('user_broker_connections')
      .update({ is_active: false })
      .eq('user_id', this.userId)
      .eq('broker', 'ibkr')

    this.sessionId = null
    console.log('✅ IBKR session logged out')
  }

  /**
   * Submit order to IBKR
   */
  async submitOrder(order: {
    symbol: string
    action: 'buy' | 'sell'
    quantity: number
    orderType: 'market' | 'limit'
    price?: number
    tif?: 'day' | 'gtc' | 'ioc'
  }): Promise<any> {
    const session = await this.getSession()

    // Get contract ID for symbol
    const contractResponse = await fetch(
      `${this.baseUrl}/v1/api/iserver/secdef/search?symbol=${order.symbol}`,
      {
        method: 'GET',
      }
    )
    const contracts = await contractResponse.json()
    
    if (!contracts || contracts.length === 0) {
      throw new Error(`Symbol ${order.symbol} not found`)
    }

    const conid = contracts[0].conid

    // Submit order
    const orderPayload = {
      orders: [{
        conid,
        orderType: order.orderType.toUpperCase(),
        side: order.action.toUpperCase(),
        quantity: order.quantity,
        price: order.price,
        tif: order.tif?.toUpperCase() || 'DAY',
      }]
    }

    const response = await fetch(
      `${this.baseUrl}/v1/api/iserver/account/${await this.getAccountId()}/orders`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`IBKR order failed: ${error.error || 'Unknown error'}`)
    }

    return await response.json()
  }

  /**
   * Get account ID
   */
  private async getAccountId(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/api/portfolio/accounts`, {
      method: 'GET',
    })

    const accounts = await response.json()
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No IBKR accounts found')
    }

    return accounts[0].accountId
  }

  /**
   * Get account summary
   */
  async getAccountSummary(): Promise<any> {
    const session = await this.getSession()
    const accountId = await this.getAccountId()

    const response = await fetch(
      `${this.baseUrl}/v1/api/portfolio/${accountId}/summary`,
      {
        method: 'GET',
      }
    )

    return await response.json()
  }

  /**
   * Get positions
   */
  async getPositions(): Promise<any[]> {
    const session = await this.getSession()
    const accountId = await this.getAccountId()

    const response = await fetch(
      `${this.baseUrl}/v1/api/portfolio/${accountId}/positions/0`,
      {
        method: 'GET',
      }
    )

    return await response.json()
  }

  /**
   * Keep session alive (call every 30 seconds)
   */
  async keepAlive(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/v1/api/tickle`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Failed to keep IBKR session alive:', error)
    }
  }
}

/**
 * Helper function to create IBKR session auth instance
 */
export function createIBKRSessionAuth(userId: string): IBKRSessionAuth {
  return new IBKRSessionAuth(userId)
}
