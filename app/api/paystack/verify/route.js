import { NextResponse } from 'next/server'
import { verifyPaystackTransaction } from '@/app/lib/paystack'
import { query } from '@/lib/db'

export async function POST(request) {
  try {
    const body = await request.json()
    const { reference } = body

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    const result = await verifyPaystackTransaction(reference)

    // Update payment status in DB
    if (result.status === 'success') {
      try {
        await query(
          `UPDATE payments
           SET status = $1, paid_at = $2, raw_response = $3, updated_at = CURRENT_TIMESTAMP
           WHERE reference = $4`,
          [
            'completed',
            result.paidAt || new Date().toISOString(),
            JSON.stringify(result),
            reference
          ]
        )
        console.log('[Paystack Verify] Payment marked completed:', reference)
      } catch (dbErr) {
        console.error('[Paystack Verify] DB update failed (non-blocking):', dbErr.message)
      }
    }

    return NextResponse.json({
      success: true,
      status: result.status,        // 'success', 'pending', 'failed'
      amount: result.amount,
      currency: result.currency,
      reference: result.reference,
      paidAt: result.paidAt,
      gatewayResponse: result.gatewayResponse
    })
  } catch (error) {
    console.error('[Paystack Verify] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify payment' },
      { status: 500 }
    )
  }
}
