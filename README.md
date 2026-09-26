# Digital Heroes

Subscription platform combining golf score tracking, a monthly prize draw and charity giving.

**Live site:** https://digital-heroes-zeta-orpin.vercel.app

## Test credentials
| Role | Email | Password |
|---|---|---|
| User (active subscription) | testuser@example.com | Test@12345 |
| Admin | admin@example.com | Admin@12345 |

Stripe test card: 4242 4242 4242 4242, any future expiry, any CVC.

## Stack
Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion, Supabase (Auth, Postgres, Storage), Stripe Checkout (test mode), Vercel.

## Features
- Signup/login with charity choice and contribution % (min 10%)
- Monthly and yearly subscriptions via Stripe
- Score entry: Stableford 1-45, one per date, latest 5 kept (DB trigger)
- Draw engine: random or algorithmic (weighted by score frequency), simulation before publish, jackpot rollover
- Prize pool split 40% / 35% / 25%, split equally between winners in a tier
- Winner proof upload, admin approve/reject, payout Pending to Paid
- Charity directory with search/filter, featured charity on homepage
- User dashboard and admin panel (users, scores, subscriptions, draws, charities, winners, reports)

## Assumptions
- Prices are not specified in the PRD: Rs 499/month, Rs 4,999/year.
- **Score entry is available to all registered users, regardless of subscription status.** Only active subscribers with 5 saved scores are eligible for monthly draw participation. This reflects the PRD's distinction between general platform access (§03, "Registered subscriber" capabilities like entering/editing scores) and the subscription/payment gate described separately (§04, "Non-subscribers receive restricted access to platform features"). Score tracking is treated as an engagement feature open to all signed-up users, while draw entry and prize eligibility remain gated behind an active subscription.
- 50% of each subscription fee (yearly divided by 12) feeds the monthly prize pool.
- Only active subscribers with all 5 scores enter a draw.
- Matches count distinct numbers (duplicate scores count once).
- One draw per month; a published draw cannot be re-run.
- Only the 5-match jackpot rolls over; 4-match and 3-match do not.
- Subscription status is confirmed after Stripe checkout via a server route; a Stripe webhook for renewals/cancellations is the next step for production. Admins can update subscription status manually in the meantime.
- Stripe onboarding for India is invite-only, so a Stripe test-mode account was created under another country. Only test keys are used; no real payments are processed.

## Security
- Row Level Security enabled on all tables
- Database triggers prevent users from self-promoting to admin or editing prize/payment fields
- Admin-only actions verified server-side
- Secrets stored only in environment variables, never in client code

## Deployment
Deployed on a new Vercel account, connected to a new GitHub repository, using a new Supabase project — as required by the assignment brief.

## Run locally
Copy `.env.local` with: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, NEXT_PUBLIC_SITE_URL
Then run `npm install` and `npm run dev`.