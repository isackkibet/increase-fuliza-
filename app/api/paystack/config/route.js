import { NextResponse } from 'next/server'
import { getPaystackPublicKey, isPaystackTestMode } from '@/app/lib/paystack'

export async function GET() {
  return NextResponse.json({
    mode: isPaystackTestMode() ? 'sandbox' : 'live',
    publicKey: getPaystackPublicKey()
  })
}
