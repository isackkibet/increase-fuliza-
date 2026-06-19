import { NextResponse } from 'next/server'
import { checkSTKStatus } from '@/app/lib/payhero'

export async function POST(request) {
  try {
    console.log('[PayHero Status] Request received')
    
    const body = await request.json()
    console.log('[PayHero Status] Request body:', body)
    
    const { checkoutRequestID } = body

    if (!checkoutRequestID) {
      console.log('[PayHero Status] Missing checkoutRequestID')
      return NextResponse.json({ error: 'Missing checkoutRequestID' }, { status: 400 })
    }

    console.log('[PayHero Status] Checking STK status for:', checkoutRequestID)

    const result = await checkSTKStatus(checkoutRequestID)

    console.log('[PayHero Status] Status check result:', result)

    return NextResponse.json({
      success: true,
      responseCode: result.responseCode,
      responseDescription: result.responseDescription,
      merchantRequestID: result.merchantRequestID,
      checkoutRequestID: result.checkoutRequestID,
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
      amount: result.amount,
      mpesaReceiptNumber: result.mpesaReceiptNumber,
      transactionDate: result.transactionDate,
      phoneNumber: result.phoneNumber
    })

  } catch (error) {
    console.error('[PayHero Status] Error:', error)
    console.error('[PayHero Status] Error stack:', error.stack)
    return NextResponse.json({ 
      error: error.message || 'Failed to check payment status',
      details: error.toString(),
      stack: error.stack 
    }, { status: 500 })
  }
}
