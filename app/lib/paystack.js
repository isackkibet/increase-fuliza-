const PAYSTACK_BASE_URL = process.env.PAYSTACK_API_BASE_URL || 'https://api.paystack.co'

function isPaystackTestMode() {
  const flag = process.env.PAYSTACK_TEST_MODE
  const key = (process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY || '').toLowerCase()

  return (
    flag === 'true' ||
    flag === '1' ||
    flag === 'yes' ||
    key.startsWith('sk_test_') ||
    key.startsWith('pk_test_')
  )
}

function logPaystackEvent(event, details = {}) {
  console.info(`[Paystack][${event}]`, {
    timestamp: new Date().toISOString(),
    testMode: isPaystackTestMode(),
    ...details
  })
}

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY
  if (!key) {
    const error = new Error('PAYSTACK_SECRET_KEY is not defined. Set it before trying Paystack charges.')
    logPaystackEvent('config-missing', { error: error.message })
    throw error
  }

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

  logPaystackEvent('initialize:start', {
    reference,
    amount,
    amountInKobo,
    email,
    phone: phoneWithPlus
  })

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

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/charge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    let data
    try {
      data = await response.json()
    } catch (parseError) {
      data = { message: 'Unable to parse Paystack response' }
      logPaystackEvent('initialize:parse-error', { reference, error: parseError.message })
    }

    logPaystackEvent('initialize:response', {
      reference,
      status: response.status,
      ok: response.ok,
      data
    })

    if (!response.ok || !data.status) {
      const errorMessage = data.message || `Paystack error: ${response.status}`
      logPaystackEvent('initialize:error', { reference, error: errorMessage })
      throw new Error(errorMessage)
    }

    return {
      status: data.status,
      message: data.message,
      reference: data.data?.reference || reference,
      displayText: data.data?.display_text || data.message,
      chargeStatus: data.data?.status // 'pending', 'send_otp', 'send_pin', 'success', etc.
    }
  } catch (error) {
    logPaystackEvent('initialize:exception', { reference, error: error.message })
    throw error
  }
}

/**
 * Verify a Paystack transaction by reference.
 *
 * @param {string} reference - The transaction reference
 */
export async function verifyPaystackTransaction(reference) {
  const secretKey = getSecretKey()

  logPaystackEvent('verify:start', { reference })

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    })

    let data
    try {
      data = await response.json()
    } catch (parseError) {
      data = { message: 'Unable to parse Paystack verification response' }
      logPaystackEvent('verify:parse-error', { reference, error: parseError.message })
    }

    logPaystackEvent('verify:response', {
      reference,
      status: response.status,
      ok: response.ok,
      data
    })

    if (!response.ok || !data.status) {
      const errorMessage = data.message || `Paystack verify error: ${response.status}`
      logPaystackEvent('verify:error', { reference, error: errorMessage })
      throw new Error(errorMessage)
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
  } catch (error) {
    logPaystackEvent('verify:exception', { reference, error: error.message })
    throw error
  }
}

/**
 * Generate a unique payment reference.
 */
export function generatePaystackReference(prefix = 'FULIZA') {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10).toUpperCase()
  const reference = `${prefix}-${timestamp}-${random}`
  logPaystackEvent('reference:generated', { prefix, reference })
  return reference
}

export { isPaystackTestMode }
