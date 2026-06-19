import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabase'

export async function POST(request) {
  try {
    console.log('[Mind Initialize] Test mode - simulating success')

    const body = await request.json()
    console.log('[Mind Initialize] Request body:', body)

    const { amount, email, phone, name, packageLimit } = body

    if (!amount || !email || !phone || !name || !packageLimit) {
      console.log('[Mind Initialize] Missing fields:', { amount, email, phone, name, packageLimit })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const reference = `FULIZA-${Date.now()}`
    const checkoutRequestID = `ws_CO_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`

    // Save to Supabase - errors won't block the test payment
    try {
      const { error: dbError } = await supabase.from('payments').insert({
        reference,
        amount,
        currency: 'KES',
        package_limit: packageLimit,
        phone,
        email,
        name,
        status: 'completed',
        payment_method: 'test',
        paid_at: new Date().toISOString(),
        raw_response: { checkoutRequestID, merchantRequestID: `MERCH-${Date.now()}` }
      })
      if (dbError) {
        console.error('[Mind Initialize] Database error:', dbError)
      } else {
        console.log('[Mind Initialize] Payment saved to database:', reference)
      }
    } catch (dbErr) {
      console.error('[Mind Initialize] Database save failed (non-blocking):', dbErr.message)
    }

    console.log('[Mind Initialize] Test payment successful:', { reference, checkoutRequestID })

    return NextResponse.json({
      success: true,
      checkoutRequestID,
      merchantRequestID: `MERCH-${Date.now()}`,
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Payment initiated successfully.',
      reference
    })

  } catch (error) {
    console.error('[Mind Initialize] Error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to initialize payment',
      details: error.toString()
    }, { status: 500 })
  }
}
