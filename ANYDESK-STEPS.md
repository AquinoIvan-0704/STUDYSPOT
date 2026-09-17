# StudySpot upgrade — AnyDesk runbook

Target machine: your friend's PC
Project folder: `C:\Users\aquin\OneDrive\Desktop\JAVACoding\STUDYSPOT ILS`

---

## 1. Stop the running server

On his PC, open **Command Prompt** and run:

```
taskkill /F /IM node.exe
```

Expect `SUCCESS: The process "node.exe" ... has been terminated.`
If it says *not found*, nothing was running — fine, carry on.

Check the port is free:

```
netstat -ano | findstr :3001
```

Must print **nothing**. If a line appears, the last number is the PID:
`taskkill /PID <that number> /F`

---

## 2. Back up his folder (30 seconds, do not skip)

Right-click `STUDYSPOT ILS` → Copy → Paste in the same place.
Windows makes `STUDYSPOT ILS - Copy`. That is the undo button.

---

## 3. Copy the files across

Send `STUDYSPOT-UPGRADE.zip` over AnyDesk (the file-transfer button in the
AnyDesk toolbar, or just drag the file onto his desktop window).

On his PC:

1. Right-click the zip → **Extract All**
2. Open the extracted `STUDYSPOT-UPGRADE` folder
3. Select **everything inside it** (Ctrl+A) — `server.js`, `package.json`,
   `models`, `public`
4. Copy, then paste into `C:\Users\aquin\OneDrive\Desktop\JAVACoding\STUDYSPOT ILS`
5. Windows asks about duplicates → choose **Replace the files in the destination**

The zip has **no data files**, so his spots, accounts and pending requests
are never overwritten.

---

## 4. Start it

```
cd /d "C:\Users\aquin\OneDrive\Desktop\JAVACoding\STUDYSPOT ILS"
npm run dev
```

First boot prints the migration, once:

```
Created data/ folder.
Moved spots.json into data/ (the original is still in the project root as a backup).
Moved users.json into data/ ...
Moved pending_spots.json into data/ ...
Created data/reviews.json.
Created data/messages.json.
Server is running at http://localhost:3001
```

`npm run dev` restarts the server automatically whenever a file is saved,
so this whole problem cannot happen again. Use `npm start` for a plain run.

If npm complains that `dev` is missing, `package.json` didn't get replaced —
redo step 3.

---

## 5. Check it worked

Open `http://localhost:3001` and hard-refresh with **Ctrl+Shift+R**.

- Terminal logs read `GET /api/spots` — **no 📥 emoji**. Emoji means the old
  server is somehow still running; go back to step 1.
- Log in with his existing account — the old accounts still work, same passwords.
- Click the logout icon (top right) → returns to the login screen, **not**
  "Cannot GET /logout".
- Submit a spot request as a normal member → green **"Request submitted"** card,
  not a line of plain text.
- Contact page → fill it in → green confirmation. Log in as admin →
  **Review Requests** → the message is listed at the bottom with a Reply button.

---

## If something breaks

Restore from the backup copy made in step 2 and tell me what the terminal printed.
