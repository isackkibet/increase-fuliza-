const PAYSTACK_BASE_URL = process.env.PAYSTACK_API_BASE_URL || 'https://api.paystack.co'

function getPaystackMode() {
  const mode = (process.env.PAYSTACK_MODE || '').trim().toLowerCase()
  if (mode === 'sandbox' || mode === 'test' || mode === 'development') return 'sandbox'
  if (mode === 'live' || mode === 'production') return 'live'

  const key = (process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SANDBOX_SECRET_KEY || process.env.PAYSTACK_LIVE_SECRET_KEY || '').toLowerCase()
  return key.startsWith('sk_test_') || key.startsWith('pk_test_') ? 'sandbox' : 'live'
}

function isPaystackTestMode() {
  return getPaystackMode() === 'sandbox'
}

function logPaystackEvent(event, details = {}) {
  console.info(`[Paystack][${event}]`, {
    timestamp: new Date().toISOString(),
    mode: getPaystackMode(),
    testMode: isPaystackTestMode(),
    ...details
  })
}

function getSecretKey() {
  const mode = getPaystackMode()
  const key = mode === 'sandbox'
    ? process.env.PAYSTACK_SANDBOX_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY
    : process.env.PAYSTACK_LIVE_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY

  if (!key) {
    const error = new Error('Paystack secret key is not defined for the selected mode.')
    logPaystackEvent('config-missing', { error: error.message, mode })
    throw error
  }

  return key
}

export function getPaystackPublicKey() {
  const mode = getPaystackMode()
  return mode === 'sandbox'
    ? process.env.NEXT_PUBLIC_PAYSTACK_SANDBOX_PUBLIC_KEY || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    : process.env.NEXT_PUBLIC_PAYSTACK_LIVE_PUBLIC_KEY || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
}

/**
 * Initialize a Paystack transaction using the official transaction/initialize API.
 * This opens a standard Paystack checkout flow that works with test cards and real transactions.
 */
export async function initializePaystackCharge(phone, amount, email, reference, metadata = {}) {
  const secretKey = getSecretKey()
  const amountInKobo = Math.round(amount * 100)

  let formattedPhone = phone.trim().replace(/\s+/g, '').replace(/\D/g, '')
  if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
    formattedPhone = '254' + formattedPhone.substring(1)
  } else if (formattedPhone.length === 9) {
    formattedPhone = '254' + formattedPhone
  }

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
    channels: ['card', 'bank', 'mobile_money'],
    metadata: {
      originalPhone: phoneWithPlus,
      ...metadata
    }
  }

  if (process.env.PAYSTACK_CALLBACK_URL) {
    payload.callback_url = process.env.PAYSTACK_CALLBACK_URL
  }

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
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
      data = { message: 'Unable to parse Paystack initialization response' }
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
      accessCode: data.data?.access_code,
      authorizationUrl: data.data?.authorization_url,
      chargeStatus: data.data?.status
    }
  } catch (error) {
    logPaystackEvent('initialize:exception', { reference, error: error.message })
    throw error
  }
}

/**
 * Verify a Paystack transaction by reference.
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
      status: tx.status,
      amount: tx.amount / 100,
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
