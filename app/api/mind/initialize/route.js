import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

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

    try {
      await query(
        `INSERT INTO payments (reference, amount, currency, package_limit, phone, email, name, status, payment_method, paid_at, raw_response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          reference,
          amount,
          'KES',
          packageLimit,
          phone,
          email,
          name,
          'completed',
          'test',
          new Date().toISOString(),
          JSON.stringify({ checkoutRequestID, merchantRequestID: `MERCH-${Date.now()}` })
        ]
      )
      console.log('[Mind Initialize] Payment saved to database:', reference)
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
