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

## Supabase (database and sign-in) - one-time, about 15 minutes

Supabase stores the kids' profiles, word lists, and progress, and handles the parent sign-in. The Supabase project already exists (created 2026-10-28), so start at step 1. Open it at supabase.com and sign in.

### 1. Create the tables

1. In the left sidebar, click **SQL Editor**, then **New query**.
2. In this repository, open the file `supabase/migrations/0001_init.sql` and copy everything in it.
3. Paste it into the query box and click **Run**. You should see "Success. No rows returned."

Run it only once. Running it a second time shows "already exists" errors; that is harmless.

### 2. Turn off public sign-up

SpellKick is family-only, so nobody should be able to create their own account.

1. Click **Authentication** in the left sidebar, then **Sign In / Providers** (on some versions, **Providers** or **Settings**).
2. Turn **off** "Allow new users to sign up".
3. Click **Save**.

### 3. Invite yourself (the parent)

1. Click **Authentication**, then **Users**.
2. Click **Add user**, then **Invite user**.
3. Type the parent email address and click **Invite**.

Repeat for a second parent if you like. Each invited email can sign in; nobody else can.

### 4. Make the sign-in email show a 6-digit code

The app asks for a 6-digit code from your email, which works better on a phone or iPad than a link.

1. Click **Authentication**, then **Emails** (on some versions, **Email Templates**).
2. Open the **Magic Link** template.
3. Replace the message body with something like this, and click **Save**:

   ```html
   <h2>Your SpellKick sign-in code</h2>
   <p>Type this code into SpellKick:</p>
   <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">{{ .Token }}</p>
   <p>It expires soon. If you did not ask for it, you can ignore this email.</p>
   ```

   The important part is `{{ .Token }}`. That is where the code appears. Keep it exactly as written, including the braces and the dot.

### 5. Set the Site URL

1. Click **Authentication**, then **URL Configuration**.
2. Set **Site URL** to the app's Vercel production address, for example `https://spellkick.vercel.app` (use the address Vercel shows on your project page).
3. Click **Save**.

### 6. Copy the two keys into Vercel and your computer

1. Click **Project Settings** (the gear icon), then **Data API** (or **API**). Copy the **Project URL**.
2. Then open **API Keys** and copy the **anon** **public** key.
3. In Vercel, open the project, then **Settings**, then **Environment Variables**. Add (or update) these two, ticking both **Production** and **Preview**:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
4. Redeploy: in Vercel, open **Deployments**, click the three dots on the latest one, and choose **Redeploy**.
5. For running the app on your own computer, create a file named `.env.local` in the top folder of the repository containing:

   ```
   VITE_SUPABASE_URL=paste-the-project-url-here
   VITE_SUPABASE_ANON_KEY=paste-the-anon-key-here
   ```

   This file is ignored by git, so it never gets uploaded.

These two values are safe to be public; the database rules only let a signed-in parent see their own family's data. Never copy the **service_role** key anywhere; that one is a real secret.
