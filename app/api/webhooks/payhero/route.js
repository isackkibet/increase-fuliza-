import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'PayHero webhook endpoint active' })
}

export async function POST(request) {
  try {
    const payload = await request.json()
    
    console.log('[PayHero Webhook] Received:', payload)

    // PayHero webhook structure typically includes:
    // - MerchantRequestID
    // - CheckoutRequestID  
    // - ResultCode
    // - ResultDesc
    // - Amount
    // - MpesaReceiptNumber
    // - TransactionDate
    // - PhoneNumber

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
      // Payment successful
      console.log('[PayHero Webhook] Payment successful:', {
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
      // Payment failed
      console.log('[PayHero Webhook] Payment failed:', {
        merchantRequestID: MerchantRequestID,
        checkoutRequestID: CheckoutRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc
      })
    }

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[PayHero Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
