-- Optional for an existing database. Safe on Supabase Free.
-- Deactivates missions that required paid X API reads.
update missions
set active = false
where code in ('like_pinned', 'repost_pinned');

update missions
set title = 'Sign in with X',
    description = 'X login saves your username and user id. No follow lookup is performed.',
    target_url = 'https://x.com/VeyroHood'
where code = 'follow_x';
