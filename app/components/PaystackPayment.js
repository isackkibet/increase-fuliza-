'use client'

import { useState, useEffect, useRef } from 'react'

export default function PaystackPayment({ packageLimit, packageFee, onSuccess, onError, onClose }) {
  const [formData, setFormData] = useState({ name: '', idNumber: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState('form') // 'form' | 'pending' | 'success' | 'failed'
  const [reference, setReference] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [paystackReady, setPaystackReady] = useState(false)
  const pollRef = useRef(null)
  const pollCountRef = useRef(0)
  const MAX_POLLS = 20 // Poll for up to ~60 seconds (20 × 3s)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.PaystackPop) {
      setPaystackReady(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.async = true
    script.onload = () => setPaystackReady(true)
    script.onerror = () => setError('Could not load Paystack. Please refresh the page and try again.')
    document.body.appendChild(script)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^0-9+]/g, '')
    setFormData({ ...formData, phone: value })
  }

  const startPolling = (ref) => {
    pollCountRef.current = 0
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1

      try {
        console.info('[PaystackPayment] Polling verification', { reference: ref, poll: pollCountRef.current })
        const res = await fetch('/api/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: ref })
        })
        const data = await res.json()
        console.info('[PaystackPayment] Verification response', { reference: ref, status: data.status, response: data })

        if (data.status === 'success') {
          clearInterval(pollRef.current)
          setStage('success')
          setStatusMessage('Payment confirmed! Your Fuliza limit is being updated.')
          if (onSuccess) onSuccess({ reference: ref, ...data })
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          setStage('failed')
          setError('Payment was not completed. Please try again.')
          if (onError) onError('Payment failed')
        } else if (pollCountRef.current >= MAX_POLLS) {
          clearInterval(pollRef.current)
          setStage('pending')
          setStatusMessage('We are still processing your payment. Please wait a moment and check the status again.')
        }
      } catch (err) {
        console.error('[PaystackPayment] Poll error:', err)
      }
    }, 3000) // Check every 3 seconds
  }

  const initiatePayment = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name || formData.name.trim().length < 2) {
      setError('Please enter your full name')
      return
    }
    if (!formData.idNumber || formData.idNumber.trim().length < 5) {
      setError('Please enter a valid ID number')
      return
    }
    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 9) {
      setError('Please enter a valid M-PESA phone number (e.g. 0759008293)')
      return
    }

    if (!paystackReady) {
      setError('Paystack is still loading. Please wait a moment and try again.')
      return
    }

    setLoading(true)

    try {
      console.info('[PaystackPayment] Sending initialize request', {
        amount: packageFee,
        packageLimit,
        phone: formData.phone,
        name: formData.name
      })
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: packageFee,
          phone: formData.phone,
          name: formData.name,
          idNumber: formData.idNumber,
          packageLimit
        })
      })

      const data = await response.json()
      console.info('[PaystackPayment] Initialize response', { status: response.status, data })

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to initiate payment')
      }

      setReference(data.reference)
      setStage('pending')
      setStatusMessage('Secure Paystack checkout is opening. Complete the payment in the popup window.')

      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        email: data.email,
        amount: Math.round(packageFee * 100),
        currency: 'KES',
        ref: data.reference,
        metadata: {
          custom_fields: [
            { display_name: 'Package', variable_name: 'package', value: packageLimit },
            { display_name: 'Name', variable_name: 'name', value: formData.name },
            { display_name: 'Phone', variable_name: 'phone', value: formData.phone }
          ]
        },
        callback: (paystackResponse) => {
          console.info('[PaystackPayment] Checkout callback', paystackResponse)
          setStatusMessage('Payment completed. Verifying your transaction...')
          startPolling(paystackResponse.reference)
        },
        onClose: () => {
          setStage('form')
          setStatusMessage('')
          setError('Payment was cancelled before completion.')
        }
      })

      handler.openIframe()
    } catch (err) {
      setError(err.message)
      if (onError) onError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <h2 className="modal-title">
          Your Fuliza limit will be increased automatically within 5 minutes
        </h2>

        <div className="modal-summary">
          <div>
            <div className="modal-summary-label">Package</div>
            <div className="modal-summary-value">Fuliza {packageLimit}</div>
          </div>
          <div>
            <div className="modal-summary-label">Fee</div>
            <div className="modal-summary-value accent">KSh {packageFee}</div>
          </div>
        </div>

        {/* ── FORM STAGE ── */}
        {stage === 'form' && (
          <form className="modal-form" onSubmit={initiatePayment}>
            <label className="modal-label">Full Name</label>
            <input
              type="text"
              name="name"
              className="modal-input"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <label className="modal-label">ID Number</label>
            <input
              type="text"
              name="idNumber"
              className="modal-input"
              placeholder="Enter your national ID number"
              value={formData.idNumber}
              onChange={handleChange}
              required
            />

            <label className="modal-label">M-PESA Phone Number</label>
            <input
              type="tel"
              name="phone"
              className="modal-input"
              placeholder="07XXXXXXXX or 2547XXXXXXXX"
              value={formData.phone}
              onChange={handlePhoneChange}
              required
            />
            <div className="modal-hint">Your payment will open a secure Paystack checkout page.</div>

            <button type="submit" className="modal-button" disabled={loading || !paystackReady}>
              {loading ? 'Processing...' : paystackReady ? 'Pay with Paystack' : 'Loading Paystack...'}
            </button>

            {error && (
              <div className="modal-status error">
                {typeof error === 'string' ? error : error.message || 'An error occurred'}
              </div>
            )}
          </form>
        )}

        {/* ── PENDING STAGE ── */}
        {stage === 'pending' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱</div>
            <p style={{ fontWeight: 600, fontSize: '18px', marginBottom: '8px' }}>Check Your Phone!</p>
            <p style={{ color: '#444', marginBottom: '16px', lineHeight: 1.6 }}>
              {statusMessage}
            </p>
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#15803d'
            }}>
              ✅ Payment request sent successfully
            </div>
            <div className="modal-hint">
              Reference: <strong>{reference}</strong>
            </div>
            <div style={{ marginTop: '16px', color: '#888', fontSize: '13px' }}>
              ⏳ Waiting for confirmation… (up to 3 minutes)
            </div>
          </div>
        )}

        {/* ── SUCCESS STAGE ── */}
        {stage === 'success' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <p style={{ fontWeight: 600, color: '#16a34a', marginBottom: '8px' }}>Payment Successful!</p>
            <p style={{ color: '#666', marginBottom: '16px' }}>{statusMessage}</p>
            <button className="modal-button" onClick={onClose}>Done</button>
          </div>
        )}

        {/* ── FAILED STAGE ── */}
        {stage === 'failed' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>Payment Failed</p>
            <p style={{ color: '#666', marginBottom: '16px' }}>{error}</p>
            <button
              className="modal-button"
              onClick={() => { setStage('form'); setError('') }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
