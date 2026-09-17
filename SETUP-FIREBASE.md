# StudySpot — Firebase + Vercel setup

Your project: **study-spot-edba9**

The web config you sent is already filled in for you in `.env.example`. There are
only three things left that I could not do from here, because they need your
Firebase account.

---

## 1. Turn on the two sign-in methods (2 minutes)

Firebase console → **Authentication** → **Sign-in method**:

- Enable **Email/Password**
- Enable **Google** (pick a support email when it asks)

Without this, sign-in fails with *"That sign-in method is switched off in the
Firebase console."*

---

## 2. Create the Firestore database (1 minute)

Firebase console → **Firestore Database** → **Create database** → **Production
mode** → pick a region near you (`asia-southeast1` is closest to the Philippines).

Production mode locks everything down, which is exactly right: the browser never
touches Firestore directly. All reads and writes go through the Express server
using the Admin SDK, which bypasses security rules. `firestore.rules` in this
project denies all direct client access on purpose.

> Your config also mentions a Realtime Database URL. This app uses **Firestore**,
> which is the newer of the two. You don't need to set up Realtime Database.

---

## 3. Get the service account key (2 minutes)

This is the one genuinely secret value, and the server needs it to verify logins.

Firebase console → ⚙ **Project settings** → **Service accounts** →
**Generate new private key** → a JSON file downloads.

Open that JSON and copy two fields:

| From the JSON | Into the variable |
|---|---|
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `private_key`  | `FIREBASE_PRIVATE_KEY` |

Keep the `\n` escapes in the private key exactly as they appear, wrapped in
double quotes.

**Never commit that JSON file.** `.gitignore` already blocks `.env` and
`serviceAccount*.json`.

---

## Running it locally

```
copy .env.example .env      (Windows)     # then paste in the two secret values
npm install
npm run dev
```

The terminal tells you which mode it came up in:

```
StudySpot v3.0.0 running at http://localhost:3001
Storage: Firestore + Firebase Auth (cloud, project study-spot-edba9)
```

If the Firebase variables are missing it falls back to the JSON files in `/data`
and says so — the app still runs, it just isn't using the cloud.

---

## Deploying to Vercel

1. Push the project to GitHub.
2. Vercel → **Add New Project** → import the repo.
3. **Settings → Environment Variables** → add every variable from `.env.example`
   (all six public ones plus the two secret ones). Apply them to Production,
   Preview and Development.
4. Deploy.
5. Firebase console → **Authentication → Settings → Authorised domains** → add
   your Vercel domain (e.g. `studyspot.vercel.app`). Google sign-in refuses to
   run on a domain that isn't listed.

`vercel.json` and `api/index.js` are already set up — Vercel imports the Express
app instead of running `node server.js`.

---

## First login matters

**The first account to sign in becomes the administrator.** Sign in yourself
before sharing the link. After that, everyone is a normal member and you promote
them from **Users** in the top bar.

If you miss that window, add your email to `ADMIN_EMAILS` and sign in again.

---

## Why sessions work on Vercel now

The old build used `express-session`, which keeps sessions in the server's
memory. Vercel runs each request in a short-lived serverless function, so that
memory disappears between requests and logins dropped at random.

Now the browser signs in with Firebase, sends the ID token to `/auth/session`,
and the server returns a **Firebase session cookie** — a signed token that
carries its own proof. Any instance can verify it without shared memory, which
is what makes it survive serverless.

---

## Quick check after deploying

1. Open the site → create an account with email → you land on the dashboard.
2. Top right shows your name → you are the admin (Users + Review Requests in nav).
3. Sign out, sign back in with **Continue with Google** → new member account.
4. Firebase console → Firestore → you should see `users`, `spots`, `reviews`.
5. Add a spot as admin, then reload the deployed site — it's still there. That's
   the thing that was broken before.

---

## What happened to the old accounts

The old `ivan` and `Rene Baterbonia` logins were username + bcrypt password in
`users.json`. Firebase Auth identifies people by email, and those two accounts
have no email address, so they cannot be carried over — they need to register
again. Their spots and reviews are untouched.
