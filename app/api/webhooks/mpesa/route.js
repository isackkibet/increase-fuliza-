import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Lipana webhook endpoint active' })
}

export async function POST(request) {
  try {
    const payload = await request.json()
    const signature = request.headers.get('x-lipana-signature')
    
    console.log('[Lipana Webhook] Received:', payload.event || 'unknown')

    const eventType = payload.event
    const data = payload.data

    switch (eventType) {
      case 'payment.success':
        console.log('[Lipana Webhook] Payment successful:', data.merchant_reference, data.amount)
        // Here you would typically update your database, send confirmation emails, etc.
        break
      case 'payment.failed':
        console.log('[Lipana Webhook] Payment failed:', data.merchant_reference)
        break
      default:
        console.log('[Lipana Webhook] Event:', eventType)
    }

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[Lipana Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
