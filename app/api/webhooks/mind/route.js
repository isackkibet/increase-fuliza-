import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Mind webhook endpoint active' })
}

export async function POST(request) {
  try {
    const payload = await request.json()
    
    console.log('[Mind Webhook] Received:', payload)

    const { 
      MerchantRequestID, 
      CheckoutRequestID, 
      ResultCode, 
      ResultDesc, 
      Amount, 
      MpesaReceiptNumber,
      TransactionDate,
      PhoneNumber 
    } = payload

    if (ResultCode === '0') {
      console.log('[Mind Webhook] Payment successful:', {
        merchantRequestID: MerchantRequestID,
        checkoutRequestID: CheckoutRequestID,
        amount: Amount,
        receipt: MpesaReceiptNumber,
        phone: PhoneNumber
      })
      
      // Here you would typically:
      // 1. Update your database to mark payment as complete
      // 2. Update user's Fuliza limit
      // 3. Send confirmation SMS/email
      // 4. Log the transaction
      
    } else {
      console.log('[Mind Webhook] Payment failed:', {
        merchantRequestID: MerchantRequestID,
        checkoutRequestID: CheckoutRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc
      })
    }

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[Mind Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
