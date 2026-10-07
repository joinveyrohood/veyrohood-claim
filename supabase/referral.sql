-- Additive referral columns for the claim database. Do not run on the old wallet project.
alter table users add column if not exists referral_code text;
alter table users add column if not exists referred_by uuid references users(id);
create unique index if not exists users_referral_code_unique on users(referral_code) where referral_code is not null;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id) on delete cascade,
  referred_id uuid not null unique references users(id) on delete cascade,
  code text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'CREDITED')),
  reward_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  credited_at timestamptz
);
create unique index if not exists one_referral_bind on transactions(user_id) where type = 'REFERRAL_BIND';
create unique index if not exists one_referral_credit on transactions(reference_id) where type = 'REFERRAL_CREDIT';
