'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const { authenticateToken, optionalAuth, generateToken } = require('./middleware/auth');

const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new Database(DB_PATH);

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// ===== AUTH ROUTES =====

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, subscription_tier)
      VALUES (?, ?, 'free')
    `).run(email, passwordHash);

    const user = db.prepare('SELECT id, email, subscription_tier FROM users WHERE id = ?').get(result.lastInsertRowid);

    // Generate token
    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        subscription_tier: user.subscription_tier
      },
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        subscription_tier: user.subscription_tier
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, email, subscription_tier, created_at FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Get usage count for free tier
  let usageCount = 0;
  if (user.subscription_tier === 'free') {
    const usage = db.prepare(`
      SELECT COUNT(*) as count FROM api_usage
      WHERE user_id = ? AND endpoint = '/api/incidents'
    `).get(user.id);
    usageCount = usage.count;
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      subscription_tier: user.subscription_tier,
      created_at: user.created_at,
      usage_count: usageCount,
      usage_limit: user.subscription_tier === 'free' ? 1 : null
    }
  });
});

// ===== PAYMENT ROUTES =====

// Create Stripe checkout session
app.post('/api/payment/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service not configured. Please set STRIPE_SECRET_KEY in .env' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id.toString() }
      });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Pro Subscription',
              description: 'Unlimited postal code searches per month'
            },
            unit_amount: 500, // $5.00 in cents
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL || 'http://localhost:8080'}?payment=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:8080'}?payment=cancelled`,
      metadata: {
        userId: user.id.toString()
      }
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook handler
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).send('Payment service not configured');
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription;
          db.prepare(`
            UPDATE users
            SET subscription_tier = 'pro', stripe_subscription_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(subscriptionId, userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        db.prepare(`
          UPDATE users
          SET subscription_tier = 'free', stripe_subscription_id = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE stripe_subscription_id = ?
        `).run(subscription.id);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status;

        if (status === 'active') {
          db.prepare(`
            UPDATE users
            SET subscription_tier = 'pro', updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ?
          `).run(subscription.id);
        } else if (['canceled', 'unpaid', 'past_due'].includes(status)) {
          db.prepare(`
            UPDATE users
            SET subscription_tier = 'free', updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ?
          `).run(subscription.id);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Cancel subscription
app.post('/api/payment/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Payment service not configured' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user || !user.stripe_subscription_id) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    await stripe.subscriptions.cancel(user.stripe_subscription_id);

    db.prepare(`
      UPDATE users
      SET subscription_tier = 'free', stripe_subscription_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    return res.json({ message: 'Subscription cancelled successfully' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ===== API ROUTES =====

// Get incidents by postal code (with usage tracking)
app.get('/api/incidents', authenticateToken, (req, res) => {
  try {
    const postalCode = String(req.query.postal_code || '').trim();
    if (!postalCode) {
      return res.status(400).json({ error: 'postal_code is required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check usage limits for free tier
    if (user.subscription_tier === 'free') {
      const usage = db.prepare(`
        SELECT COUNT(*) as count FROM api_usage
        WHERE user_id = ? AND endpoint = '/api/incidents'
      `).get(user.id);

      if (usage.count >= 1) {
        return res.status(429).json({
          error: 'Free tier limit reached',
          message: 'You have reached your free tier limit of 1 search. Please upgrade to Pro for unlimited searches.',
          upgrade_url: '/pricing'
        });
      }
    }

    // Log API usage
    db.prepare(`
      INSERT INTO api_usage (user_id, endpoint, postal_code)
      VALUES (?, ?, ?)
    `).run(user.id, '/api/incidents', postalCode);

    // Get incidents
    const results = db.prepare(`
      SELECT * FROM incidents
      WHERE postal_code = ?
      ORDER BY date_reported DESC
    `).all(postalCode);

    // Get updated usage count
    const usage = db.prepare(`
      SELECT COUNT(*) as count FROM api_usage
      WHERE user_id = ? AND endpoint = '/api/incidents'
    `).get(user.id);

    return res.json({
      results: results,
      count: results.length,
      postal_code: postalCode,
      usage: {
        count: usage.count,
        limit: user.subscription_tier === 'free' ? 1 : null,
        tier: user.subscription_tier
      }
    });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
