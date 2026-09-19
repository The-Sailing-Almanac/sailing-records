"use client";

import React, { useState } from 'react';
import { Shield, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (res.ok) {
        router.push('/admin/routes');
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed. Invalid token.');
      }
    } catch (err) {
      setError('A connection error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '32px',
        boxShadow: 'var(--glass-shadow)',
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Shield style={{ color: 'var(--primary)', width: '48px', height: '48px' }} />
        </div>
        
        <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Command Bridge Auth
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
          Enter your admin secret key to authenticate your session
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
              Secret Key
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="••••••••••••••••"
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '15px'
                }}
              />
              <Key style={{ position: 'absolute', left: '12px', top: '14px', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '12px', fontWeight: 700, cursor: 'pointer', background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)' }}
          >
            {loading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </form>
      </div>
    </div>
  );
}
