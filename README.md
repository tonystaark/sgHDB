# SG Postal Code Incident Lookup

A web application to search for incidents by Singapore postal code with user authentication and subscription-based pricing.

## Features

### Authentication
- User registration and login
- JWT-based authentication with secure cookie storage
- Password hashing with bcrypt

### Subscription Tiers

#### Free Tier
- 1 postal code search limit
- Basic incident data
- No credit card required

#### Pro Tier ($5/month)
- Unlimited postal code searches
- Full incident history
- Priority support
- Cancel anytime

### Payment Integration
- Stripe integration for secure payments
- Automatic subscription management
- Webhook support for real-time updates

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT, bcryptjs
- **Payment**: Stripe
- **Frontend**: Vanilla JavaScript, CSS

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm

### Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
PORT=8080
JWT_SECRET=your-secret-key-change-in-production
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
APP_URL=http://localhost:8080
```

3. Run database migration:
```bash
npm run migrate
```

4. Start the server:
```bash
npm start
```

The application will be available at `http://localhost:8080`

## Stripe Setup

### 1. Get Stripe API Keys
1. Sign up at [stripe.com](https://stripe.com)
2. Get your test API keys from the dashboard
3. Add them to your `.env` file

### 2. Set Up Webhooks (for production)
1. In Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/payment/webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Copy the webhook signing secret to your `.env` file

### 3. Test Stripe Integration
Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Use any future expiry date and any 3-digit CVC

## CSV Data Import

Place your CSV file as `hdb_incidents.csv` in the project root with these columns:
- postal_code
- block
- location
- date reported
- incident summary
- source url

Example CSV format:
```csv
postal_code,block,location,date reported,incident summary,source url
079903,10,"Anson Road, International Plaza, Singapore 079903",2024-07-12,"Fender-bender at carpark entrance",https://example.com/source
```

Then run:
```bash
npm run migrate  # This will parse hdb_incidents.csv and populate the database
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
  ```json
  { "email": "user@example.com", "password": "password123" }
  ```
- `POST /api/auth/login` - Login
  ```json
  { "email": "user@example.com", "password": "password123" }
  ```
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info (requires authentication)

### Incidents
- `GET /api/incidents?postal_code=<code>` - Search incidents (requires authentication)

### Payments
- `POST /api/payment/create-checkout-session` - Create Stripe checkout (requires authentication)
- `POST /api/payment/webhook` - Stripe webhook handler
- `POST /api/payment/cancel-subscription` - Cancel subscription (requires authentication)

## Database Schema

### users
- id (PRIMARY KEY)
- email (UNIQUE)
- password_hash
- subscription_tier (free/pro)
- stripe_customer_id
- stripe_subscription_id
- created_at
- updated_at

### incidents
- id (PRIMARY KEY)
- postal_code
- block
- location
- date_reported
- incident_summary
- source_url

### api_usage
- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- endpoint
- postal_code
- timestamp

### password_reset_tokens
- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- token (UNIQUE)
- expires_at
- used
- created_at

## Usage Limits

- **Free users**: 1 search per account lifetime
- **Pro users**: Unlimited searches

When a free user reaches their limit, they are prompted to upgrade to Pro.

## Development

### Scripts
- `npm start` - Start the server
- `npm run migrate` - Run database migrations
- `npm run minify` - Minify JavaScript
- `npm run obfuscate` - Obfuscate JavaScript

### Project Structure
```
sgHDB/
├── middleware/
│   └── auth.js           # Authentication middleware
├── scripts/
│   └── migrate.js        # Database migration
├── index.html            # Main HTML file
├── script.js             # Frontend JavaScript
├── styles.css            # Styles
├── server.js             # Express server
├── data.sqlite           # SQLite database
├── .env                  # Environment variables (not in git)
└── .env.example          # Example environment variables
```

## Security Considerations

1. **JWT Secret**: Change `JWT_SECRET` in production to a strong, random string
2. **HTTPS**: Always use HTTPS in production
3. **Environment Variables**: Never commit `.env` file to version control (already in .gitignore)
4. **Password Requirements**: Minimum 8 characters enforced
5. **Cookie Security**: Secure cookies enabled in production

## Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=8080
JWT_SECRET=<strong-random-secret>
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
APP_URL=https://your-domain.com
```

### Deployment Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secret
- [ ] Switch to Stripe live keys
- [ ] Set up Stripe webhooks for production URL
- [ ] Enable HTTPS
- [ ] Set secure cookie flags
- [ ] Regular database backups

## Testing Locally

### Test User Flow
1. Start the server: `npm start`
2. Open `http://localhost:8080`
3. Click "Sign Up" and create an account
4. Try searching for a postal code (you get 1 free search)
5. Try to search again - you'll be prompted to upgrade
6. Click "Upgrade" and use test card `4242 4242 4242 4242`
7. After payment, you'll have unlimited searches

## License

Private - All rights reserved

## Support

For issues or questions, please open an issue in the repository.
