# 🧠❤️ MindMatch — Full-Stack Multiplayer Game

> Real-time multiplayer relationship quiz. Create a room, share the code, play with friends!

---

## 🚀 How to Run Locally (Test with Friends on Same Network)

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

Friends on your **same WiFi** can visit `http://YOUR_LOCAL_IP:3000`  
Find your IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

---

## 🌍 Deploy Online (Free) — Friends Anywhere Can Play

### Option A: Railway (Recommended — easiest)

1. Push code to GitHub (see below)
2. Go to [railway.app](https://railway.app) → Sign in with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repo → Railway auto-detects Node.js
5. Set **Environment Variable**: `PORT=3000` (optional, Railway sets this)
6. Click **Deploy** → you get a URL like `mindmatch.up.railway.app`
7. Share that URL with friends ✅

### Option B: Render (Also Free)

1. Go to [render.com](https://render.com) → Sign up
2. Click **"New Web Service"** → Connect GitHub repo
3. Build command: `npm install`
4. Start command: `node server/index.js`
5. Deploy → get free URL

### Option C: Fly.io

```bash
npm install -g flyctl
fly auth login
fly launch        # follow prompts
fly deploy
```

---

## 📦 Push to GitHub

```bash
# In the mindmatch folder:
git init
git add .
git commit -m "MindMatch initial commit"
git branch -M main

# Create repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/mindmatch.git
git push -u origin main
```

---

## 🎮 How Friends Play

1. You open the website → click **"Create New Room"**
2. You get a **6-digit code** like `482731`
3. Send that code to your friend via WhatsApp/text
4. Friend opens same website → clicks **"Join a Room"** → enters code
5. Game starts automatically!

Or use **⚡ Quick Match** to be paired with a random stranger online.

---

## 📁 Project Structure

```
mindmatch/
├── server/
│   └── index.js          ← Node.js + Socket.io backend (ALL game logic)
├── public/
│   ├── index.html        ← Full frontend (one file, mobile-first)
│   └── manifest.json     ← PWA manifest (installable as app)
├── package.json
└── README.md
```

---

## ✨ Features

- ✅ Real-time multiplayer via WebSockets (Socket.io)
- ✅ 6-digit room codes
- ✅ Quick Match (auto-pair with strangers)
- ✅ 5 game modes: Quick, Standard, Blitz, Survival, Ultimate
- ✅ Animated countdown timer with color changes
- ✅ Predict your partner's answers
- ✅ Live score tracking
- ✅ Beautiful reveal animations + confetti
- ✅ Compatibility %, Trust, Communication, Humor scores
- ✅ AI-generated compatibility report
- ✅ Share results to WhatsApp / Twitter
- ✅ Reaction Recap at game end
- ✅ Mobile-first, PWA installable
- ✅ Partner disconnect detection
- ✅ AFK auto-submit after timer ends

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Real-time | Socket.io (WebSockets) |
| Frontend | Vanilla HTML/CSS/JS (no framework needed) |
| Hosting | Railway / Render / Fly.io |

No database needed — all game state is in-memory on the server.

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port (auto-set by hosting platforms) |

---

## 🆓 Free Tier Limits

- **Railway**: 500 hours/month free (plenty for personal use)
- **Render**: Always-on free tier (spins down after 15min inactivity)
- Both support WebSockets ✅
