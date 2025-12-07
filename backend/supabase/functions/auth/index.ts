import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Validation schemas
const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  metadata: z.object({
    full_name: z.string().optional(),
    referral_code: z.string().optional(),
  }).optional(),
})

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const OAuthSchema = z.object({
  provider: z.enum(['google']),
  redirectTo: z.string().url().optional(),
})

const RefreshSchema = z.object({
  refresh_token: z.string(),
})

/**
 * Authentication Edge Function
 * 
 * Handles ONLY authentication operations:
 * - User registration with profile creation
 * - Login (email/password and OAuth)
 * - Token refresh
 * - Logout
 * - Token verification
 * 
 * All other operations go directly to Supabase via client with RLS.
 */

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use anon key, not service role
  )

  try {
    const { pathname } = new URL(req.url)
    
    // Email/Password Sign-Up
    if (pathname === '/signup') {
      const body = await req.json()
      const validated = SignUpSchema.parse(body)
      
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: validated.metadata,
          emailRedirectTo: `${Deno.env.get('FRONTEND_URL')}/auth/callback`,
        },
      })

      if (error) throw error

      // Create user profile with service role
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      await supabaseAdmin.from('profiles').insert({
        id: data.user?.id,
        email: validated.email,
        full_name: validated.metadata?.full_name,
        tier: 'free', // Default tier
        credits: 100, // Starter credits
      })

      return new Response(
        JSON.stringify({ 
          user: data.user, 
          session: data.session,
          message: 'Check your email to confirm' 
        }),
        { 
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // OAuth Sign-In
    if (pathname === '/oauth') {
      const body = await req.json()
      const validated = OAuthSchema.parse(body)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: validated.provider,
        options: {
          redirectTo: validated.redirectTo || `${Deno.env.get('FRONTEND_URL')}/auth/callback`,
          scopes: 'email profile',
        },
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ url: data.url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Email/Password Sign-In
    if (pathname === '/signin') {
      const body = await req.json()
      const validated = SignInSchema.parse(body)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      })

      if (error) throw error

      return new Response(
        JSON.stringify({ user: data.user, session: data.session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route authentication requests (legacy support)
    if (pathname === '/register') {
      return await handleRegister(req, supabase)
    }
    if (pathname === '/login') {
      return await handleLogin(req, supabase)
    }
    if (pathname === '/google') {
      return await handleGoogleOAuth(req, supabase)
    }
    if (pathname === '/refresh') {
      return await handleRefresh(req, supabase)
    }
    if (pathname === '/logout') {
      return await handleLogout(req, supabase)
    }
    if (pathname === '/verify') {
      return await handleVerify(req, supabase)
    }

    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Auth error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof z.ZodError 
          ? error.errors 
          : error.message || 'Authentication failed' 
      }),
      { 
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Handle user registration
 */
async function handleRegister(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { email, password, metadata = {} } = await req.json()

  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'Email and password are required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ error: 'Invalid email format' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Validate password strength
  if (password.length < 8) {
    return new Response(
      JSON.stringify({ error: 'Password must be at least 8 characters' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Register user with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(
    JSON.stringify({
      user: data.user,
      session: data.session,
      message: 'Registration successful. Please check your email to confirm.',
    }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Handle user login with email/password
 */
async function handleLogin(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { email, password } = await req.json()

  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'Email and password are required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(
    JSON.stringify({
      user: data.user,
      session: data.session,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Handle Google OAuth callback
 */
async function handleGoogleOAuth(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { token } = await req.json()

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Token is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Sign in with Google OAuth token
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(
    JSON.stringify({
      user: data.user,
      session: data.session,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Handle token refresh
 */
async function handleRefresh(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { refresh_token } = await req.json()

  if (!refresh_token) {
    return new Response(
      JSON.stringify({ error: 'Refresh token is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token,
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(
    JSON.stringify({
      session: data.session,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Handle user logout
 */
async function handleLogout(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const token = authHeader.replace('Bearer ', '')
  
  // Set the session for logout
  await supabase.auth.setSession({
    access_token: token,
    refresh_token: '', // Not needed for logout
  })

  const { error } = await supabase.auth.signOut()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(
    JSON.stringify({ message: 'Logout successful' }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Handle token verification
 */
async function handleVerify(req: Request, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(
    JSON.stringify({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}
