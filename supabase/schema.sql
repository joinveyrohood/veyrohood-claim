-- Scratch & Claim schema. Run in the Supabase SQL editor on a NEW project.
-- Do not run this against the old VeyroHood database.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  x_user_id text unique not null,
  x_username text not null,
  display_name text,
  avatar_url text,
  x_access_token text,
  x_refresh_token text,
  x_token_expires_at timestamptz,
  discord_user_id text,
  discord_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text not null,
  type text not null,
  target_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  mission_id uuid not null references missions(id) on delete cascade,
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'IN_PROGRESS', 'VERIFYING', 'COMPLETED', 'FAILED')),
  last_error text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id)
);

create table if not exists scratch_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  amount numeric(10,2) not null check (amount in (20, 25, 30, 40, 50, 60, 75, 100)),
  revealed boolean not null default false,
  revealed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  network text not null check (network in ('Ethereum', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon')),
  address text not null,
  is_primary boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists wallets_one_primary
  on wallets(user_id) where is_primary;

create table if not exists kyc (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED')),
  provider text,
  provider_reference text,
  self_reported_name text,
  country text,
  note text,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  network text not null,
  wallet_address text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  tx_hash text,
  admin_note text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists one_open_withdrawal
  on withdrawals(user_id) where status in ('PENDING', 'APPROVED');

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  amount numeric(10,2) not null,
  status text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_missions_user on user_missions(user_id);
create index if not exists idx_withdrawals_user on withdrawals(user_id);
create index if not exists idx_withdrawals_status on withdrawals(status);
create index if not exists idx_transactions_user on transactions(user_id);
create index if not exists idx_kyc_status on kyc(status);
create index if not exists idx_users_username on users(x_username);

insert into missions (code, title, description, type, target_url, sort_order)
values
  ('follow_x', 'Follow VeyroHood on X', 'Follow the official X account, then verify.', 'x_follow', 'https://x.com/VeyroHood', 1),
  ('join_discord', 'Join VeyroHood Discord', 'Join the official Discord, then verify membership.', 'discord_join', 'https://discord.gg/ZKWGaxafe', 2),
  ('like_pinned', 'Like the pinned post', 'Like the official pinned post, then verify.', 'x_like', null, 3),
  ('repost_pinned', 'Repost the pinned post', 'Repost the official pinned post, then verify.', 'x_repost', null, 4)
on conflict (code) do nothing;

create unique index if not exists one_reward_credit
  on transactions(user_id) where type = 'REWARD_CREDIT';

create or replace function request_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_network text,
  p_wallet text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_reward numeric;
  v_revealed boolean;
  v_kyc text;
  v_missions int;
  v_locked numeric;
  v_available numeric;
  v_id uuid;
begin
  perform 1 from users where id = p_user_id for update;

  select amount, revealed into v_reward, v_revealed
  from scratch_rewards where user_id = p_user_id;

  if v_reward is null or v_revealed is not true then
    return jsonb_build_object('ok', false, 'error', 'Scratch reward is not revealed.');
  end if;

  select count(*) into v_missions
  from user_missions um
  join missions m on m.id = um.mission_id
  where um.user_id = p_user_id and um.status = 'COMPLETED' and m.active = true;

  if v_missions < 4 then
    return jsonb_build_object('ok', false, 'error', 'All 4 missions must be verified first.');
  end if;

  select status into v_kyc from kyc where user_id = p_user_id;
  if v_kyc is distinct from 'APPROVED' then
    return jsonb_build_object('ok', false, 'error', 'KYC must be approved before withdrawal.');
  end if;

  if p_wallet !~ '^0x[0-9a-fA-F]{40}$' then
    return jsonb_build_object('ok', false, 'error', 'Wallet address is not a valid EVM address.');
  end if;

  if p_network not in ('Ethereum', 'Base', 'Arbitrum', 'BNB Chain', 'Polygon') then
    return jsonb_build_object('ok', false, 'error', 'Unsupported network.');
  end if;

  select coalesce(sum(amount), 0) into v_locked
  from withdrawals
  where user_id = p_user_id and status in ('PENDING', 'APPROVED', 'PAID');

  v_available := v_reward - v_locked;
  if p_amount <= 0 or p_amount > v_available then
    return jsonb_build_object('ok', false, 'error', 'Amount exceeds available balance.', 'available', v_available);
  end if;

  insert into withdrawals (user_id, amount, network, wallet_address, status)
  values (p_user_id, p_amount, p_network, p_wallet, 'PENDING')
  returning id into v_id;

  insert into transactions (user_id, type, amount, status, reference_id)
  values (p_user_id, 'WITHDRAWAL_HOLD', p_amount, 'PENDING', v_id);

  return jsonb_build_object('ok', true, 'id', v_id, 'available', v_available - p_amount);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'An open withdrawal already exists.');
end;
$$;

revoke all on function request_withdrawal(uuid, numeric, text, text) from public;
grant execute on function request_withdrawal(uuid, numeric, text, text) to service_role;

alter table users enable row level security;
alter table missions enable row level security;
alter table user_missions enable row level security;
alter table scratch_rewards enable row level security;
alter table wallets enable row level security;
alter table kyc enable row level security;
alter table withdrawals enable row level security;
alter table transactions enable row level security;

-- No anon/authenticated policies. The Next.js server uses the service role.
-- This keeps tokens, balances, and admin fields off the public API.
