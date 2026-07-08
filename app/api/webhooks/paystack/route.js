import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { query } from '@/lib/db'

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Paystack webhook endpoint active' })
}

export async function POST(request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')
    const secretKey = process.env.PAYSTACK_SECRET_KEY

    // Verify webhook signature to ensure it's from Paystack
    if (secretKey && signature) {
      const expectedSignature = crypto
        .createHmac('sha512', secretKey)
        .update(body)
        .digest('hex')

      if (signature !== expectedSignature) {
        console.warn('[Paystack Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(body)
    console.log('[Paystack Webhook] Event received:', payload.event)

    const event = payload.event
    const data = payload.data

    switch (event) {
      case 'charge.success': {
        const reference = data.reference
        const amount = data.amount / 100  // convert from kobo
        const paidAt = data.paid_at
        const channel = data.channel
        const gatewayResponse = data.gateway_response

        console.log('[Paystack Webhook] charge.success:', { reference, amount, channel })

        try {
          await query(
            `UPDATE payments
             SET status = $1, paid_at = $2, payment_method = $3, raw_response = $4, updated_at = CURRENT_TIMESTAMP
             WHERE reference = $5`,
            [
              'completed',
              paidAt || new Date().toISOString(),
              channel || 'paystack',
              JSON.stringify(data),
              reference
            ]
          )
          console.log('[Paystack Webhook] DB updated for reference:', reference)
        } catch (dbErr) {
          console.error('[Paystack Webhook] DB update failed:', dbErr.message)
        }
        break
      }

      case 'charge.failed': {
        const reference = data.reference
        console.log('[Paystack Webhook] charge.failed:', reference)
        try {
          await query(
            `UPDATE payments
             SET status = $1, raw_response = $2, updated_at = CURRENT_TIMESTAMP
             WHERE reference = $3`,
            ['failed', JSON.stringify(data), reference]
          )
        } catch (dbErr) {
          console.error('[Paystack Webhook] DB update failed:', dbErr.message)
        }
        break
      }

      default:
        console.log('[Paystack Webhook] Unhandled event:', event)
    }

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[Paystack Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
