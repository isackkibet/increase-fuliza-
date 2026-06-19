'use client'

import { useState } from 'react'

export default function PayHeroPayment({ packageLimit, packageFee, onSuccess, onError, onClose }) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/[^0-9+]/g, '')
    setFormData({ ...formData, phone: value })
  }

  const initiatePayment = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!formData.name || formData.name.length < 2) {
      setError('Please enter your full name')
      setLoading(false)
      return
    }
    if (!formData.email || formData.email.length < 6) {
      setError('Please enter a valid ID number')
      setLoading(false)
      return
    }
    if (!formData.phone || formData.phone.length < 10) {
      setError('Please enter a valid phone number')
      setLoading(false)
      return
    }

    try {
      let formattedPhone = formData.phone.replace(/\s+/g, '').replace(/[^0-9]/g, '')
      if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1)
      else if (formattedPhone.startsWith('7')) formattedPhone = '254' + formattedPhone
      else if (formattedPhone.startsWith('+254')) formattedPhone = formattedPhone.substring(1)
      else if (formattedPhone.startsWith('254')) formattedPhone = formattedPhone

      const response = await fetch('/api/payhero/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: packageFee,
          email: formData.email,
          phone: formattedPhone,
          name: formData.name,
          packageLimit: packageLimit
        }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || data.details || 'Failed to initialize payment')
      }

      if (onSuccess) onSuccess(data)

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

        <form className="modal-form" onSubmit={initiatePayment}>
          <label className="modal-label">Full Name</label>
          <input type="text" name="name" className="modal-input" placeholder="Enter your full name" value={formData.name} onChange={handleChange} required />

          <label className="modal-label">ID Number</label>
          <input type="text" name="email" className="modal-input" placeholder="Enter your ID number" value={formData.email} onChange={handleChange} required />

          <label className="modal-label">M-PESA Phone Number</label>
          <input type="tel" name="phone" className="modal-input" placeholder="07XXXXXXXX or 2547XXXXXXXX" value={formData.phone} onChange={handlePhoneChange} required />
          
          <div className="modal-hint">Your Fuliza limit will be increased on this phone number</div>

          <button type="submit" className="modal-button" disabled={loading}>
            {loading ? 'Processing...' : 'Pay via M-PESA'}
          </button>
        </form>

        {error && <div className="modal-status error">{typeof error === 'string' ? error : error.message || 'An error occurred'}</div>}
      </div>
    </div>
  )
}
