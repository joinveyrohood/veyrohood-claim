# Scratch & Claim

Separate full-stack app from any older VeyroHood website. Users sign in with X, complete four missions, unlock one server-generated scratch reward, submit a manual KYC review, and request a withdrawal to a public EVM address.

This is not a live identity check and it does not send crypto automatically.

## Stack

- Next.js 14, React, Tailwind
- Supabase Postgres
- X OAuth 2.0 Authorization Code + PKCE
- Optional Discord OAuth + bot membership check
- Vercel

## Pages

- `/` landing
- `/login`
- `/dashboard`
- `/missions`
- `/scratch`
- `/wallet`
- `/kyc`
- `/withdraw`
- `/history`
- `/admin`

## 1. Supabase

Create a new Supabase project. In the SQL editor, run `supabase/schema.sql`.

Copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service role key → `SUPABASE_SERVICE_ROLE_KEY` (server only)

Row Level Security is enabled with no public policies. The app writes through the service role on the server.

## 2. X OAuth

In the X developer portal, create an app with OAuth 2.0 and these settings:

- Type: Web App / confidential client
- Callback URL: `https://YOUR-APP.vercel.app/api/auth/x/callback`
- Scopes used by the app: `tweet.read`, `users.read`, `follows.read`, `like.read`, `offline.access`

Set:

```
X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=https://YOUR-APP.vercel.app/api/auth/x/callback
NEXT_PUBLIC_APP_URL=https://YOUR-APP.vercel.app
```

Local callback: `http://localhost:3000/api/auth/x/callback`

Do not invent a pinned post. Leave this empty until you have the real URL:

```
X_PINNED_POST_URL=
X_OFFICIAL_USERNAME=VeyroHood
```

Like and repost both read `X_PINNED_POST_URL` at request time. After you set it in Vercel and redeploy, both missions use it. Opening a link never marks a mission complete.

Follow, like, and repost checks call the X API with the user’s token. If the API plan or scope denies the lookup, the mission stays `FAILED` and the admin can mark it complete after a manual review.

## 3. Discord

Invite link is `https://discord.gg/ZKWGaxafe`.

Live membership checks need:

```
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://YOUR-APP.vercel.app/api/auth/discord/callback
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
```

The bot must be in the server. Without those values, Discord verify fails on purpose.

## 4. Admin

Set `ADMIN_SECRET` to a random string of at least 16 characters. Optional `ADMIN_EMAIL` is documentation only. Open `/admin` and enter the secret. The cookie is httpOnly.

Admin can approve or reject manual KYC, review withdrawals, mark a payout as paid with a transaction hash, and override a mission when the X API cannot see it.

## 5. Local run

```bash
cp .env.example .env.local
npm install
npm run dev
```

## 6. Deploy

1. Push this folder to a new GitHub repo.
2. Import the repo in Vercel.
3. Framework preset: Next.js. Root directory: this project.
4. Add every variable from `.env.example`.
5. Deploy. Production URL will be a `*.vercel.app` domain unless you add a custom domain later.
6. Put that exact origin in `NEXT_PUBLIC_APP_URL`, `X_REDIRECT_URI`, and the X/Discord callback settings.

## Security notes

- Reward amounts are chosen on the server from `$20, $25, $30, $40, $50, $60, $75, $100` and saved once per user.
- The amount is not sent to the browser until reveal.
- Balance is reward minus pending, approved, and paid withdrawals.
- Withdrawals go through the `request_withdrawal` database function, which locks the user row and blocks a second open request.
- The app never asks for a private key, seed phrase, or recovery phrase.
- KYC here is a manual status queue. Sumsub, Persona, or Stripe Identity can be attached later through `kyc.provider` and `kyc.provider_reference`.
- Payouts are manual. An admin sends funds, then stores the transaction hash.
