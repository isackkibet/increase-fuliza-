const PAYSTACK_BASE_URL = 'https://api.paystack.co'

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not defined')
  return key
}

/**
 * Initiate a Paystack mobile money (M-PESA) charge via STK push.
 *
 * @param {string} phone   - Phone number in 254XXXXXXXXX format
 * @param {number} amount  - Amount in KES (will be converted to kobo/cents * 100)
 * @param {string} email   - Customer email (or generated placeholder)
 * @param {string} reference - Unique transaction reference
 */
export async function initializePaystackCharge(phone, amount, email, reference) {
  const secretKey = getSecretKey()

  // Paystack amounts are in the smallest currency unit (kobo/cents).
  // For KES, 1 KES = 100 kobo, so multiply by 100.
  const amountInKobo = Math.round(amount * 100)

  // Normalize phone — strip spaces
  let formattedPhone = phone.trim().replace(/\s+/g, '').replace(/\D/g, '')

  // Convert any local format to 12-digit international (no + yet)
  if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
    // 0759008293 → 254759008293
    formattedPhone = '254' + formattedPhone.substring(1)
  } else if (formattedPhone.length === 9) {
    // 759008293 → 254759008293
    formattedPhone = '254' + formattedPhone
  } else if (formattedPhone.startsWith('254') && formattedPhone.length === 12) {
    // already correct
  }

  // Paystack requires the + prefix: +254XXXXXXXXX
  const phoneWithPlus = '+' + formattedPhone

  console.log('[Paystack] Phone normalized:', phone, '→', phoneWithPlus)

  const payload = {
    email,
    amount: amountInKobo,
    currency: 'KES',
    reference,
    mobile_money: {
      phone: phoneWithPlus,
      provider: 'mpesa'
    }
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/charge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await response.json()
  console.log('[Paystack] Charge response:', data)

  if (!response.ok || !data.status) {
    throw new Error(data.message || `Paystack error: ${response.status}`)
  }

  return {
    status: data.status,
    message: data.message,
    reference: data.data?.reference || reference,
    displayText: data.data?.display_text || data.message,
    chargeStatus: data.data?.status // 'pending', 'send_otp', 'send_pin', 'success', etc.
  }
}

/**
 * Verify a Paystack transaction by reference.
 *
 * @param {string} reference - The transaction reference
 */
export async function verifyPaystackTransaction(reference) {
  const secretKey = getSecretKey()

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  })

  const data = await response.json()
  console.log('[Paystack] Verify response:', data)

  if (!response.ok || !data.status) {
    throw new Error(data.message || `Paystack verify error: ${response.status}`)
  }

  const tx = data.data
  return {
    status: tx.status,          // 'success', 'failed', 'pending', etc.
    amount: tx.amount / 100,    // convert back from kobo
    currency: tx.currency,
    reference: tx.reference,
    paidAt: tx.paid_at,
    channel: tx.channel,
    gatewayResponse: tx.gateway_response,
    customerEmail: tx.customer?.email,
    customerPhone: tx.metadata?.phone
  }
}

/**
 * Generate a unique payment reference.
 */
export function generatePaystackReference(prefix = 'FULIZA') {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}
