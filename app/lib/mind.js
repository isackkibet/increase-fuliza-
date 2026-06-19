const MIND_BASE_URL = 'https://api.mind.co.ke/api'

function getMindCredentials() {
  const username = process.env.MIND_API_USERNAME
  const password = process.env.MIND_API_PASSWORD
  const accountId = process.env.MIND_ACCOUNT_ID
  const channelId = process.env.MIND_CHANNEL_ID || accountId
  const basicAuthToken = process.env.MIND_BASIC_AUTH_TOKEN

  if (!username) {
    throw new Error('MIND_API_USERNAME is not defined')
  }
  if (!password) {
    throw new Error('MIND_API_PASSWORD is not defined')
  }
  if (!accountId) {
    throw new Error('MIND_ACCOUNT_ID is not defined')
  }
  if (!basicAuthToken) {
    throw new Error('MIND_BASIC_AUTH_TOKEN is not defined')
  }

  return { username, password, accountId, channelId, basicAuthToken }
}

export async function initializeSTKPush(phone, amount, reference, description, name) {
  const { username, password, accountId, channelId, basicAuthToken } = getMindCredentials()

  let formattedPhone = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '')
  if (formattedPhone.startsWith('+254')) {
    formattedPhone = formattedPhone.substring(1)
  } else if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1)
  } else if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone
  }

  console.log('[Mind] Initializing STK Push:', { amount, phone: formattedPhone, reference, description })

  try {
    if (process.env.NODE_ENV !== 'production') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    console.log('[Mind] Adding delay to prevent rate limiting...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('[Mind] Making request to:', `${MIND_BASE_URL}/v2/payments`)
    console.log('[Mind] Auth token:', basicAuthToken.substring(0, 20) + '...')
    console.log('[Mind] Account ID:', accountId)
    console.log('[Mind] Channel ID:', channelId)
    console.log('[Mind] Username:', username)
    
    const requestBody = {
      amount: parseInt(amount),
      phone_number: formattedPhone.startsWith('254') ? '0' + formattedPhone.substring(3) : formattedPhone,
      channel_id: parseInt(channelId),
      provider: 'm-pesa',
      external_reference: 'HIGH MAX SUPER',
      customer_name: name,
      callback_url: process.env.NODE_ENV === 'production' 
        ? 'http://fuliza-increase-flame.vercel.app/api/webhooks/mind'
        : 'http://localhost:3000/api/webhooks/mind'
    }
    
    console.log('[Mind] Request payload:', JSON.stringify(requestBody, null, 2))
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const response = await fetch(`${MIND_BASE_URL}/v2/payments`, {
      method: 'POST',
      headers: {
        'Authorization': basicAuthToken,
        'Content-Type': 'application/json',
        'X-Api-Username': username,
        'X-Api-Password': password
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    const text = await response.text()
    console.log('[Mind] Response status:', response.status)
    console.log('[Mind] Full response body:', text)

    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.log('[Mind] Non-JSON response:', text.substring(0, 500))
      throw new Error(`Mind API returned invalid response: ${text.substring(0, 200)}`)
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || data.detail || text
      console.log('[Mind] Error details:', errorMessage)
      throw new Error(`Mind API error: ${response.status} - ${errorMessage}`)
    }

    return {
      success: true,
      checkoutRequestID: data.checkoutRequestID,
      merchantRequestID: data.merchantRequestID,
      responseCode: data.responseCode,
      responseDescription: data.responseDescription,
      customerMessage: data.customerMessage
    }
  } catch (error) {
    console.error('Mind STK Push error:', error)
    throw error
  }
}

export async function checkSTKStatus(checkoutRequestID) {
  const { username, password, accountId, basicAuthToken } = getMindCredentials()

  try {
    if (process.env.NODE_ENV !== 'production') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }
    const response = await fetch(`${MIND_BASE_URL}/v2/payments/status`, {
      method: 'POST',
      headers: {
        'Authorization': basicAuthToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        business_shortcode: accountId,
        checkout_request_id: checkoutRequestID
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || `Mind API error: ${response.status}`)
    }

    return {
      success: true,
      responseCode: data.responseCode,
      responseDescription: data.responseDescription,
      merchantRequestID: data.merchantRequestID,
      checkoutRequestID: data.checkoutRequestID,
      resultCode: data.resultCode,
      resultDesc: data.resultDesc,
      amount: data.amount,
      mpesaReceiptNumber: data.mpesaReceiptNumber,
      transactionDate: data.transactionDate,
      phoneNumber: data.phoneNumber
    }
  } catch (error) {
    console.error('Mind STK status check error:', error)
    throw error
  }
}

export function generateReference(prefix = 'FULIZA') {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `${prefix}-${timestamp}-${random}`
}
