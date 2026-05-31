import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, syncUserProfile } from '../lib/supabase';
import { MessageCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/chat-list', { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data?.user) {
          await syncUserProfile();
          if (data.session) {
            navigate('/chat-list');
          } else {
            setError('Account created! Please check your email for a confirmation link, then sign in.');
            setIsSignUp(false);
          }
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        if (data?.user) {
          await syncUserProfile();
          navigate('/chat-list');
        }
      }
    } catch (err) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('fetch')) {
        setError('Cannot connect. Please restart the dev server (Ctrl+C → npm run dev) to reload your .env credentials.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Please check your email inbox and click the confirmation link, then sign in.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Wrong email or password. Please try again.');
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Green top band */}
      <div className="login-top-band">
        <div className="login-logo-wrap">
          <MessageCircle size={38} fill="currentColor" strokeWidth={0} />
        </div>
        <span className="login-app-name">ChatApp</span>
      </div>

      {/* Form body */}
      <div className="login-body">
        <p className="login-tagline">
          {isSignUp
            ? 'Create your free account to start chatting'
            : <>Sign in to <span>ChatApp</span></>
          }
        </p>

        {error && <div className="wa-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="wa-input-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="wa-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="wa-input-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="wa-input"
              placeholder="Min. 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          <button type="submit" className="wa-btn-primary" disabled={loading} style={{ marginTop: 10 }}>
            {loading
              ? <div className="spinner" style={{ width: 20, height: 20 }}></div>
              : isSignUp ? 'CREATE ACCOUNT' : 'NEXT'
            }
          </button>
        </form>

        <div className="wa-toggle">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }} disabled={loading}>
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
