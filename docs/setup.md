# Setup guide

Plain-language steps for getting SpellKick online. You do not need to write any code.

## Vercel (hosting) - one-time, about 2 minutes

Vercel is the free service that puts the app on the internet. After this, every change merged to `main` goes live automatically.

1. Go to vercel.com and sign in with your GitHub account.
2. Click **Add New**, then **Project**, then **Import** next to the `spellkick` repository.
3. Under **Framework Preset**, choose **Vite** (it is usually picked for you).
4. Open **Environment Variables** and add these two, ticking both **Production** and **Preview** for each:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   The values come from Supabase (see below). If you do not have them yet, you can add them later under Project Settings, then Environment Variables, and redeploy.
5. Click **Deploy**.

These two values are safe to be public. They are not passwords.

## Supabase

Filled in by Task 9.
