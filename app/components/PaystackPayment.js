'use client'

import { useState, useEffect, useRef } from 'react'

export default function PaystackPayment({ packageLimit, packageFee, onSuccess, onError, onClose }) {
  const [formData, setFormData] = useState({ name: '', idNumber: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState('form') // 'form' | 'pending' | 'success' | 'failed'
  const [reference, setReference] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const pollRef = useRef(null)
  const pollCountRef = useRef(0)
  const MAX_POLLS = 20 // Poll for up to ~60 seconds (20 × 3s)

  // Clean up polling on unmount
  useEffect(() => {
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
          // Timed out — still show a "pending" message rather than hard failure
          clearInterval(pollRef.current)
          setStage('pending')
          setStatusMessage(
            'We are still processing your payment. Check your M-PESA messages and try again if needed.'
          )
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
      setStatusMessage('M-PESA prompt sent! Check your phone and enter your PIN to complete the payment.')
      startPolling(data.reference)
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
            <div className="modal-hint">Your Fuliza limit will be increased on this number</div>

            <button type="submit" className="modal-button" disabled={loading}>
              {loading ? 'Processing...' : 'Pay via M-PESA'}
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
