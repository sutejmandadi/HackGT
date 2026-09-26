# Connect Story Bank to Supabase

## Architecture

- Next.js handles the editor and login UI.
- The official `@supabase/supabase-js` browser client handles sessions and calls Supabase's Data API.
- Supabase provides PostgreSQL and email/password authentication.
- PostgreSQL row-level security (RLS) restricts each story to its owner. The browser's owner filter is convenience, not the security boundary.
- FastAPI remains available for resume parsing and ML. No backend files are changed by this integration.
- Without environment configuration, the UI explicitly runs in local-only mode. With configuration, errors never silently fall back to browser storage.

This app currently reads user data only on the client. It does not need cookie-based SSR authentication. If protected server-rendered pages are added, implement `@supabase/ssr` and server-side token verification then.

## 1. Create ONE shared development project

Open https://supabase.com/dashboard and create a project for HackGT. Choose an appropriate region, create a strong database password, and keep the password in your password manager. The app does not need that password.

You and Sutej should configure the same Supabase project. Application user accounts are separate from Supabase dashboard team membership. Each application account sees its own stories, even when using the same database.

## 2. Create the table and its security policies

In Supabase's SQL Editor, paste and run the contents of:

`supabase/migrations/001_stories.sql`

Run this migration once against a new project. It intentionally fails rather than silently replacing an existing `stories` schema. If a table already exists, inspect it and create a separate migration rather than dropping it.

The SQL creates the table, owner index, server-maintained update timestamps, restricted table grants, and owner-only SELECT/INSERT/UPDATE/DELETE policies. Anonymous clients have no table access. Never disable RLS to fix an access error.

## 3. Configure authentication

In Authentication settings:

1. Enable Email/password sign-in.
2. Keep email confirmation enabled.
3. Set the Site URL to `http://localhost:3000` while developing.
4. Add `http://localhost:3000` to allowed redirect URLs. If you use another port, add its exact URL too.
5. Add your deployed HTTPS site URL before deploying. Do not use a broad production wildcard.

Sign-up sends a confirmation email. Confirm it, then sign in. If the project has restricted test email delivery or rate limits, use allowed developer addresses or configure a supported SMTP provider for wider testing. This initial UI does not yet include password reset; use test accounts until that flow is added.

## 4. Add public connection settings

In the project's Connect dialog, copy the Project URL and **publishable key**.

From a terminal at the repository root:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
```

Fill in `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

These are public client configuration, not database credentials. **Never put a secret key, service-role key, or database password into a NEXT_PUBLIC variable.** Publishable access depends on the SQL grants and RLS policies above.

Do not paste passwords into chat. `.env.local` remains gitignored. `.env.example` contains empty placeholders and can be committed.

## 5. Restart and use the app

Stop the dev server with Ctrl+C, then:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Create an account, confirm the email, and sign in. The connection banner will say **Cloud storage**. Save a story and check the Supabase Table Editor. Saving is reported successful only after the API returns the stored row. Failures keep your draft available for retry.

Each developer supplies their own `.env.local`; do not share application passwords. Use the same app account on another device only when it is your own account.

## Existing local stories

The old collection remains in `localStorage` under `hackgt.story-bank.v1` at the original browser origin (scheme + host + port).

After signing in, select **Import browser stories** and confirm. Import copies them to the current account, retains local copies, and does not overwrite cloud stories with matching IDs. Repeat imports do not create duplicates. Only import from your personal browser/profile. Invalid local data is preserved rather than silently deleted.

There is no automatic cloud-to-local backup. Signing out hides cloud stories; it does not delete them. Editing the same story simultaneously on two devices currently uses last successful write wins.

## Integration contract for Sutej

The UI's `Story` shape is in `frontend/app/story.ts`. Database mapping is in `story-repository.ts`:

| UI | PostgreSQL |
| --- | --- |
| `id` | `id` (UUID) |
| authenticated user ID | `owner_id` |

| `updatedAt` | `updated_at` (server timestamp) |
| other story fields | same names |

Use story ID and update timestamp to associate and invalidate scores. A scorer must not treat a requested owner ID as proof of identity. When adding FastAPI scoring, send the current user's access token over HTTPS, verify it on the server, and either use the user's token with Supabase's API (RLS applies) or perform explicit owner authorization before privileged database access. Never expose a service-role key in frontend code.

Resume parsing can return draft `Story` objects with `source: "resume"`. Keep resume files out of this table; use private object storage only if retaining uploads becomes necessary.

## Live verification checklist (requires your project)

1. With no env settings, verify local mode still reads existing stories.
2. With project settings, sign up and confirm email; sign in and save an incomplete story.
3. Refresh and edit the saved story. Verify the same row changes and `updated_at` advances.
4. Sign in on another browser with that account and check persistence.
5. Sign in as a second account and confirm the first account's stories are absent. Run the RLS test SQL below as well; UI filtering alone does not prove security.
6. Import local stories twice; verify the second import inserts zero rows and does not replace cloud edits.
7. Disconnect the network and attempt save/delete. Verify an error, preserved draft, and no false success. Reconnect and retry.
8. Delete a disposable story and refresh; confirm it stays deleted.

`supabase/tests/story_rls.sql` exercises the policies in a transaction and rolls everything back. Run it in the SQL Editor after the migration. It uses temporary test identities and should only be run in your development project.

The code can be linted/typechecked without credentials, but cloud authentication, database connectivity, and deployed RLS cannot be verified until the project is created and SQL applied.

## Existing projects: remove the review checkbox field

If you already ran 001_stories.sql before this change, run supabase/migrations/002_remove_story_confirmation.sql in the SQL Editor. Do not rerun 001. This removes only the retired user_confirmed column; stories and their other fields are preserved.

