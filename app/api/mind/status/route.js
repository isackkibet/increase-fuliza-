import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { checkoutRequestID } = body

    if (!checkoutRequestID) {
      return NextResponse.json({ error: 'Missing checkoutRequestID' }, { status: 400 })
    }

    console.log('[Mind Status] Test mode - simulating success for:', checkoutRequestID)

    return NextResponse.json({
      success: true,
      responseCode: '0',
      responseDescription: 'Success',
      merchantRequestID: `MERCH-${Date.now()}`,
      checkoutRequestID,
      resultCode: '0',
      resultDesc: 'The service request is processed successfully.',
      amount: null,
      mpesaReceiptNumber: null,
      transactionDate: null,
      phoneNumber: null
    })

  } catch (error) {
    console.error('[Mind Status] Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to check payment status',
      details: error.toString()
    }, { status: 500 })
  }
}
