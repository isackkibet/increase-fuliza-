import { NextResponse } from 'next/server'
import { initializeSTKPush } from '@/app/lib/payhero'

export async function POST(request) {
  try {
    console.log('[PayHero Initialize] Request received')
    
    const body = await request.json()
    console.log('[PayHero Initialize] Request body:', body)
    
    const { amount, email, phone, name, packageLimit } = body

    if (!amount || !email || !phone || !name || !packageLimit) {
      console.log('[PayHero Initialize] Missing fields:', { amount, email, phone, name, packageLimit })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if environment variables are set
    const username = process.env.PAYHERO_API_USERNAME
    const password = process.env.PAYHERO_API_PASSWORD
    const accountId = process.env.PAYHERO_ACCOUNT_ID
    const basicAuthToken = process.env.PAYHERO_BASIC_AUTH_TOKEN
    
    console.log('[PayHero Initialize] ENV check:', { 
      hasUsername: !!username, 
      hasPassword: !!password,
      hasAccountId: !!accountId,
      hasBasicAuthToken: !!basicAuthToken,
      usernamePrefix: username ? username.substring(0, 5) + '...' : 'none'
    })

    if (!username || !password || !accountId || !basicAuthToken) {
      return NextResponse.json({ error: 'PayHero API credentials not configured' }, { status: 500 })
    }

    const reference = `FULIZA-${Date.now()}`
    const description = `Fuliza Limit Increase - KES ${amount} for ${name}`

    console.log('[PayHero Initialize] Making STK Push request')

    const result = await initializeSTKPush(phone, amount, reference, description, name)

    console.log('[PayHero Initialize] STK Push successful:', result)

    return NextResponse.json({
      success: true,
      checkoutRequestID: result.checkoutRequestID,
      merchantRequestID: result.merchantRequestID,
      responseCode: result.responseCode,
      responseDescription: result.responseDescription,
      customerMessage: result.customerMessage,
      reference: reference
    })

  } catch (error) {
    console.error('[PayHero Initialize] Error:', error)
    console.error('[PayHero Initialize] Error stack:', error.stack)
    return NextResponse.json({ 
      error: error.message || 'Failed to initialize payment',
      details: error.toString(),
      stack: error.stack 
    }, { status: 500 })
  }
}
