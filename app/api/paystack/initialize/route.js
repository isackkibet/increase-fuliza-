import { NextResponse } from 'next/server'
import { initializePaystackCharge, generatePaystackReference, isPaystackTestMode } from '@/app/lib/paystack'
import { query } from '@/lib/db'

export async function POST(request) {
  try {
    const body = await request.json()
    const { amount, phone, name, idNumber, packageLimit } = body

    console.info('[Paystack Init] Request received', {
      testMode: isPaystackTestMode(),
      amount,
      packageLimit,
      phone: phone ? phone.replace(/\D/g, '').slice(-4) : null,
      name,
      idNumber: idNumber ? `${idNumber.slice(0, 2)}***` : null
    })

    if (!amount || !phone || !name || !packageLimit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Paystack requires a valid-looking email. Generate one from the phone number.
    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '254')
    const email = `user${cleanPhone}@gmail.com`

    const reference = generatePaystackReference()

    // Save pending payment record first
    try {
      await query(
        `INSERT INTO payments (reference, amount, currency, package_limit, phone, email, name, status, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [reference, amount, 'KES', packageLimit, phone, idNumber || email, name, 'pending', 'paystack']
      )
      console.info('[Paystack Init] Payment record created', { reference, testMode: isPaystackTestMode() })
    } catch (dbErr) {
      console.error('[Paystack Init] DB save failed (non-blocking):', dbErr.message)
    }

    // Initialize a real Paystack transaction using the official API
    const result = await initializePaystackCharge(phone, amount, email, reference, {
      packageLimit,
      name,
      idNumber
    })

    return NextResponse.json({
      success: true,
      reference,
      email,
      accessCode: result.accessCode,
      authorizationUrl: result.authorizationUrl,
      message: result.displayText || result.message,
      chargeStatus: result.chargeStatus
    })
  } catch (error) {
    console.error('[Paystack Init] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}
