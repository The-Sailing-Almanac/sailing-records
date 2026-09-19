'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    
    // Map frequency selection to string array for API
    let freqArray = ['daily'];
    if (frequency === 'weekly') {
      freqArray = ['weekly'];
    }

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, frequency: freqArray }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Thank you for subscribing! Please check your inbox for a confirmation email.');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setStatus('error');
      setMessage('Failed to connect to the server. Please check your network.');
    }
  };

  return (
    <div id="subscribe" style={{ scrollMarginTop: '100px', width: '100%' }}>
      {status === 'success' ? (
        <div 
          className="animate-fade-in"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center', 
            padding: '32px', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--success)', 
            borderRadius: 'var(--radius-md)' 
          }}
        >
          <CheckCircle2 style={{ color: 'var(--success)', width: '48px', height: '48px', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>Welcome Aboard!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="email"
                placeholder="Enter your email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
                className="form-input"
                style={{ 
                  flex: '2 1 250px',
                  padding: '12px 16px',
                  fontSize: '15px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                disabled={status === 'loading'}
                style={{
                  flex: '1 1 150px',
                  padding: '12px 16px',
                  fontSize: '15px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="daily">Daily Edition</option>
                <option value="weekly">Weekly Digest</option>
              </select>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn btn-primary"
                style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '140px', 
                  flex: '1 0 auto',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                    <span>Signing up...</span>
                  </>
                ) : (
                  <>
                    <Send style={{ width: '16px', height: '16px' }} />
                    <span>Join Dispatch</span>
                  </>
                )}
              </button>
            </div>
            
            {status === 'error' && (
              <div 
                className="animate-fade-in"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  color: 'var(--error)', 
                  fontSize: '14px', 
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                <span>{message}</span>
              </div>
            )}
          </div>
          
          <style jsx global>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </form>
      )}
    </div>
  );
}
