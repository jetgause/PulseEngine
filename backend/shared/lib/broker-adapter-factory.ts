import { UniversalOAuth2Manager, BROKER_OAUTH2_CONFIGS } from './universal-oauth2-manager.ts'
import { IBKRSessionAuth } from './ibkr-session-auth.ts'

/**
 * Factory pattern for creating appropriate broker authentication adapters
 */
export class BrokerAdapterFactory {
  /**
   * Get appropriate auth manager for broker
   */
  static getAuthManager(broker: string, userId: string): UniversalOAuth2Manager | IBKRSessionAuth {
    if (broker === 'ibkr') {
      // Check if OAuth2 is available, otherwise use session auth
      const hasOAuth2Creds = Deno.env.get('IBKR_CLIENT_ID')
      
      if (hasOAuth2Creds) {
        console.log('✅ Using IBKR OAuth2')
        return new UniversalOAuth2Manager(BROKER_OAUTH2_CONFIGS.ibkr)
      } else {
        console.warn('⚠️  IBKR OAuth2 not configured, using session auth')
        return new IBKRSessionAuth(userId)
      }
    }

    const config = BROKER_OAUTH2_CONFIGS[broker]
    if (!config) {
      throw new Error(`Unsupported broker: ${broker}. Supported brokers: ${Object.keys(BROKER_OAUTH2_CONFIGS).join(', ')}`)
    }

    return new UniversalOAuth2Manager(config)
  }

  /**
   * Initialize connection for user
   */
  static async initializeConnection(broker: string, userId: string): Promise<string> {
    const authManager = this.getAuthManager(broker, userId)

    if (authManager instanceof IBKRSessionAuth) {
      // IBKR session auth
      const sessionId = await authManager.getSession()
      return sessionId
    } else {
      // OAuth2
      const accessToken = await authManager.getAccessToken(userId)
      return accessToken
    }
  }

  /**
   * Check if broker supports OAuth2
   */
  static supportsOAuth2(broker: string): boolean {
    return broker in BROKER_OAUTH2_CONFIGS && !(broker === 'ibkr' && !Deno.env.get('IBKR_CLIENT_ID'))
  }

  /**
   * Check if broker requires session-based auth
   */
  static requiresSessionAuth(broker: string): boolean {
    return broker === 'ibkr' && !Deno.env.get('IBKR_CLIENT_ID')
  }

  /**
   * Get list of supported brokers
   */
  static getSupportedBrokers(): string[] {
    return Object.keys(BROKER_OAUTH2_CONFIGS)
  }

  /**
   * Get broker configuration
   */
  static getBrokerConfig(broker: string) {
    return BROKER_OAUTH2_CONFIGS[broker]
  }
}
