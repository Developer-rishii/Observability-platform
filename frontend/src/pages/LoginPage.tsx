import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/v1/auth/login', {
        email,
        password
      });

      // Assuming the API returns the token in response.data.token
      // Adjust if the API payload structure is different (e.g. access_token)
      const token = response.data.token || response.data.access_token;
      
      if (token) {
        login(token);
        navigate('/dashboard');
      } else {
        setError('Login successful but no token received.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', maxWidth: '300px', margin: '0 auto' }}>
        {error && <div style={{ color: 'red', marginBottom: 'var(--spacing-2)' }}>{error}</div>}
        <input 
          type="email" 
          placeholder="Email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 'var(--spacing-2)' }} 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 'var(--spacing-2)' }} 
        />
        <button 
          type="submit" 
          disabled={isLoading}
          style={{ 
            padding: 'var(--spacing-2)', 
            background: isLoading ? 'var(--color-text-muted)' : 'var(--color-primary)', 
            color: 'white', 
            border: 'none', 
            cursor: isLoading ? 'not-allowed' : 'pointer' 
          }}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
