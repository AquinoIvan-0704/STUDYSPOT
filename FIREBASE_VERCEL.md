# Firebase Realtime Database and Vercel setup

## 1. Create the Firebase services

1. Open the Firebase console and select project `study-spot-edba9`.
2. Enable **Authentication > Sign-in method > Email/Password**.
3. Enable **Authentication > Sign-in method > Google**.
4. Create a **Realtime Database** in the region closest to your users.
5. Keep the database rules closed to direct client access. The server uses the Firebase Admin SDK.
6. In **Project settings > Service accounts**, generate a private key. Do not commit the downloaded JSON file.

## 2. Configure local development

Copy `.env.example` to `.env` and fill in the service-account values. The private key must retain its `\n` line breaks:

```env
FIREBASE_PROJECT_ID=study-spot-edba9
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@study-spot-edba9.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ADMIN_EMAIL=aquinoivan0704@gmail.com
SESSION_SECRET=use-a-long-random-value
```

Alternatively, for local development only, point `GOOGLE_APPLICATION_CREDENTIALS` at the
service-account JSON file already in your project folder:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\absolute\path\to\your-service-account.json
FIREBASE_PROJECT_ID=study-spot-edba9
```

Do not commit that JSON file. Vercel should use the three `FIREBASE_*` credential
variables instead of a credential file.

`ADMIN_EMAIL` is server-only. It must not be put in browser JavaScript or a `NEXT_PUBLIC_*` variable.

The current Express session uses an in-memory session store. It is suitable for local development, but Vercel can move requests between function instances. Before relying on long-lived sessions in production, configure a persistent session store or change the protected API calls to use Firebase ID tokens on every request.

## 3. Migrate the existing JSON records once

After installing dependencies, run:

```powershell
npm install
npm run migrate:firebase
```

The command imports `data/*.json` into the following top-level Realtime Database paths:

```text
users/
spots/
pendingSpots/
reviews/
messages/
```

Do not run the migration command on every Vercel build or request.

## 4. Configure Vercel

Import the repository into Vercel and add the variables from `.env` under **Project Settings > Environment Variables** for Preview and Production. Add:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `ADMIN_EMAIL`
- `SESSION_SECRET`
- `NODE_ENV=production`

Deploy after saving the variables. `api/index.js` exports the Express app and `vercel.json` routes requests to it.

## Important

Firebase web configuration values such as `apiKey` identify the web app but do not replace the Admin SDK service-account variables. Never upload a service-account JSON file, private key, or `.env` file to GitHub or Vercel as a source file.
