# Architecture & Design Document

## System Overview

This backend serves dual purposes:

1. **API for Stripe App**: Provides authenticated endpoints for Stripe App functionality
2. **User Account Management**: Web interface for users to manage their accounts and app installations

## Technology Stack

### Core Framework

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling

### Authentication

- **Better Auth**: Modern authentication library
  - Email/password authentication
  - Session management
  - Extensible for OAuth providers
- **Supabase**: Backend infrastructure
  - PostgreSQL database hosting
  - Real-time capabilities (future use)

### Database

- **PostgreSQL**: Relational database (via Supabase)
- **supabase-js**: Query client used by the API routes (service-role key, server-side only)
- **setup.sql**: Single source of truth for the schema — one file creates every table
- **Better Auth** connects directly over `DATABASE_URL` (a plain `pg` Pool) to manage its own tables

### Payment Processing

- **Stripe**: Payment infrastructure
  - Customer management
  - Subscription handling
  - Webhook events
  - Stripe Apps platform

## Architecture Patterns

### 1. Authentication Architecture

```
Browser
   |
   |  HTTP Request + Cookie
   v
Middleware (proxy.ts)      checks session cookie
   |
   |  authenticated
   v
API Route                  verifies session with Better Auth
   |
   v
Database                   queries user data
```

**Flow:**

1. User authenticates via Better Auth
2. Session token stored in HTTP-only cookie
3. Middleware (proxy.ts) intercepts protected routes
4. API routes verify session with Better Auth
5. Database queries use authenticated user context

### 2. Database Schema Design

**User management (Better Auth):**

- `users`: Core user identity, plus app-owned columns: `settings` jsonb (preferences) and the user's Customer ids in the publisher's billing account (`stripe_customer_id_live` / `stripe_customer_id_test`). Better Auth ignores columns it doesn't know about
- `sessions`: Active authentication sessions
- `auth_accounts`: Sign-in methods (email/password credential or OAuth provider). This is Better Auth's "account" model - it is unrelated to Stripe accounts
- `verifications`: Email verification / password reset values

**Merchant side (connected Stripe accounts the app is installed into):**

- `stripe_accounts`: One row per Stripe account — the `acct_...` id is the primary key (Stripe ids are unique and immutable, so no surrogate uuid). Carries the account-wide `settings` jsonb (e.g. the company office address) and install state as two nullable columns: `live_installation_id` / `test_installation_id`, where NULL means "not installed in that mode". A general sandbox has its own `acct_...` id, so it is simply another row
- `memberships`: User <-> Stripe account many-to-many (users can belong to multiple Stripe accounts, and Stripe accounts have multiple users). Data about the relationship lives here: the user's `role` in that account (owner/admin/member; the first registrant becomes owner) and their per-account `settings` jsonb (e.g. which address is that user's local company address). Composite primary key (stripe_account_id, user_id)
- `stripe_app_sessions`: Which app user is logged in inside the Stripe Dashboard — one row per dashboard user (`usr_...`) per Stripe account, written by the Stripe App login handshake (`/api/stripe-app/verify`) and deleted on app logout. The short-lived handshake states themselves ride on `verifications` (identifier `stripe-app-login:<state>`), so they need no table of their own

**Publisher side (monetization):**

- `subscriptions`: Subscription state synced from the publisher account's webhooks. The `sub_...` id is the primary key; `livemode` stays as a column because live and test subscriptions are genuinely different Stripe objects

**Relationships:**

```
users (n) <-> (n) stripe_accounts    via memberships (role + settings on the edge)
users (1) -> (n) stripe_app_sessions (dashboard logins)
users (1) -> (n) subscriptions
users (1) -> (n) sessions
users (1) -> (n) auth_accounts
```

**Where `livemode` lives (and doesn't):** it is kept only where Stripe itself
splits data by mode — billing customer ids (two columns on `users`),
installation ids (two columns on `stripe_accounts`), and `subscriptions.livemode`.
App-owned data (roles, settings) is mode-independent; if an account ever needs
mode-split settings, nest them inside the jsonb (`{"live": ..., "test": ...}`)
rather than forking tables per mode.

### 3. API Route Structure

**Public Routes:**

- `/api/auth/*`: Authentication endpoints (Better Auth managed)
- `/api/stripe/webhook`: Stripe event receiver (signature verified)

**Protected Routes:**

- `/api/protected/*`: Requires valid session
- Middleware enforces authentication
- Session validated on each request

### 4. Webhook Processing

```
Stripe -> Webhook Endpoint -> Signature Verification
                                       |
                                       v
                                  Event Router
                                       |
         +-----------------------------+-----------------------------+
         v                             v                             v
  Customer Events            Subscription Events               Other Events
         |                             |                             |
         v                             v                             v
    Log/Process                    Update DB                    Log/Process
```

Each webhook endpoint is configured with query string params (e.g.
`/api/stripe/webhook?mode=live&type=connected`) so the handler can pick the
right Stripe client and signing secret per environment. Subscription events
are upserted into `subscriptions` (publisher-side billing); the
customer event handler is currently a logging stub.

## Security Considerations

### 1. Authentication Security

- **Session Tokens**: HTTP-only cookies prevent XSS
- **CSRF Protection**: Built into Better Auth
- **Password Hashing**: Automatic via Better Auth
- **Session Expiry**: 7-day sessions with 1-day refresh

### 2. API Security

- **Middleware Protection**: Routes checked before execution
- **Session Verification**: Every protected route validates session
- **Database Queries**: Parameterized to prevent SQL injection
- **Webhook Signatures**: Stripe events verified before processing

### 3. Data Security

- **Environment Variables**: Secrets never committed
- **Database Encryption**: Supabase provides encryption at rest
- **TLS/HTTPS**: All production traffic encrypted
- **Row Level Security**: Can be enabled in Supabase

## Data Flow Examples

### User Registration Flow

```
1. User submits registration form
2. POST /api/auth/sign-up
3. Better Auth creates user + session
4. Session cookie set in response
5. User redirected to /account
6. Middleware validates session
7. Account page loads with user data
```

### Stripe Webhook Flow

```
1. Event occurs in Stripe (e.g., subscription created)
2. Stripe sends webhook to /api/stripe/webhook
3. Signature verified
4. Event type routed to handler
5. Database updated with new subscription data (subscriptions)
6. Response sent to Stripe (200 OK)
```

### Stripe App Installation Flow

```
1. User installs app in Stripe Dashboard
2. Stripe redirects to your app with installation details
3. User authenticates (if not already)
4. POST /api/protected/stripe-app
5. Stripe account (with the mode's installation id) and the user's
   membership upserted (stripe_accounts, memberships)
6. User sees installation in account page
```

### Stripe App Login Flow (inside the dashboard)

```
1. User presses "Log in" in the Stripe App; the app mints a random state
   key and opens /stripe?state=... in a browser tab
2. The proxy bounces new visitors through /login (or /register) and back;
   the /stripe page posts the state to /api/stripe-app/session (cookie auth)
3. The app polls /api/stripe-app/verify?state=... with signed requests;
   the backend claims the state and writes stripe_app_sessions (+ membership)
4. The app fetches /api/stripe-app/userinfo (signed) to show who is
   logged in; "Log out" deletes the link and opens /stripe-logout
```

See AUTHENTICATION.md ("The Stripe App user login flow") for details.

## Scalability Considerations

### Current Architecture

- **Stateless API**: Each request independent
- **Database Connection Pooling**: Via Supabase
- **Session Storage**: Database-backed (scalable)

### Future Enhancements

- **Caching Layer**: Redis for session/data caching
- **Queue System**: Background job processing for webhooks
- **CDN**: Static asset delivery
- **Load Balancing**: Multiple server instances
- **Database Replicas**: Read replicas for scaling

## Monitoring & Observability

### Recommended Additions

1. **Error Tracking**: Sentry or similar
2. **Logging**: Structured logging with context
3. **Metrics**: API response times, error rates
4. **Alerts**: Critical error notifications
5. **Webhook Monitoring**: Track delivery success rates

## Extension Points

### Adding OAuth Providers

```typescript
// In src/lib/auth.ts
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  },
}
```

### Adding Custom User Fields

1. Add the column to the `users` table in `setup.sql` (for fresh installs)
2. Run the matching `ALTER TABLE users ADD COLUMN ...` against your existing database (Supabase SQL editor)
3. If Better Auth should manage the field, declare it under `user.additionalFields` in `src/lib/auth.ts`

### Adding New API Endpoints

1. Create route file in `src/app/api/`
2. Add authentication check if needed
3. Implement business logic
4. Return JSON response

## Performance Optimization

### Database Queries

- Select only the columns you need (`.select('col_a, col_b')`)
- Add indexes on frequently queried columns
- Embed related rows in one request (`.select('*, other_table(*)')`) instead of extra round trips

### API Routes

- Implement response caching where appropriate
- Use streaming for large responses
- Minimize database round trips

### Frontend

- Use React Server Components for initial render
- Implement optimistic updates
- Cache API responses client-side

## Testing Strategy

### Recommended Tests

1. **Unit Tests**: Business logic functions
2. **Integration Tests**: API endpoints
3. **E2E Tests**: Critical user flows
4. **Webhook Tests**: Stripe event handling

### Test Tools

- Jest: Unit testing
- Playwright: E2E testing
- Stripe CLI: Webhook testing

## Deployment Architecture

### Production Setup

```
Vercel (Next.js hosting)
   |
   +-> Supabase (Database)
   +-> Stripe (Payments)
   +-> Better Auth (Sessions)
```

### Environment Separation

- **Development**: Local database, test Stripe keys
- **Staging**: Separate Supabase project, test Stripe keys
- **Production**: Production Supabase, live Stripe keys

## Maintenance & Operations

### Regular Tasks

- Monitor webhook delivery rates
- Review error logs
- Update dependencies monthly
- Backup database regularly (Supabase handles this)
- Rotate secrets periodically

### Incident Response

1. Check error tracking dashboard
2. Review recent deployments
3. Check external service status (Stripe, Supabase)
4. Review logs for patterns
5. Implement fix and deploy
6. Post-mortem documentation

## Future Roadmap

### Phase 1 (Current)

- Basic authentication
- Database schema
- Stripe webhook handling
- Account management UI

### Phase 2 (Next)

- [ ] Email verification
- [ ] OAuth providers
- [ ] Subscription management UI
- [ ] Admin dashboard

### Phase 3 (Future)

- [ ] Multi-tenancy support
- [ ] Advanced analytics
- [ ] API rate limiting
- [ ] Webhook retry logic
- [ ] Audit logging

## Conclusion

This architecture provides a solid foundation for a Stripe App with user management. It's designed to be:

- **Secure**: Multiple layers of authentication and validation
- **Scalable**: Stateless design allows horizontal scaling
- **Maintainable**: Clear separation of concerns
- **Extensible**: Easy to add new features and integrations
