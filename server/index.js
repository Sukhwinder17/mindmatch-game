const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const rooms = new Map();
const quickQueue = [];
const socketRoom = new Map();

// ─── PLAYER PROFILES (in-memory, keyed by googleId or nickname+session) ──────
// For real persistence you'd use a DB; here we store in memory per session
const playerProfiles = new Map(); // googleId -> { nickname, avatar, totalGames, totalScore, bestCompatibility, history[] }

const QUESTIONS = {
  favorites: [
    { q: "What's my favorite food?", opts: ["Pizza","Biryani","Sushi","Burger","Tacos","Pasta","Noodles","Salad"] },
    { q: "What's my favorite movie genre?", opts: ["Action","Comedy","Romance","Horror","Sci-Fi","Thriller","Animation","Documentary"] },
    { q: "What's my favorite color?", opts: ["Red","Blue","Green","Purple","Black","Pink","Yellow","Orange"] },
    { q: "What's my favorite season?", opts: ["Spring","Summer","Monsoon","Winter"] },
    { q: "What's my favorite drink?", opts: ["Tea","Coffee","Juice","Water","Soda","Energy Drink","Smoothie","Lassi"] },
    { q: "What's my favorite sport?", opts: ["Cricket","Football","Basketball","Tennis","Badminton","Volleyball","Swimming","No Sports"] },
    { q: "What's my favorite music genre?", opts: ["Bollywood","Pop","Hip-Hop","Classical","Rock","EDM","Indie","K-Pop"] },
    { q: "What's my favorite social media?", opts: ["Instagram","YouTube","WhatsApp","Twitter/X","Snapchat","TikTok","LinkedIn","None"] },
  ],
  situational: [
    { q: "If I won ₹1 Crore, what would I do first?", opts: ["Travel the world","Invest it","Buy a house","Quit my job","Give to family","Start a business","Buy gadgets","Donate"] },
    { q: "If I had a free week with no responsibilities, I'd…", opts: ["Travel","Sleep all day","Binge shows","Hang with friends","Learn something new","Read books","Game nonstop","Do nothing"] },
    { q: "If I could have any superpower, I'd pick…", opts: ["Fly","Teleport","Time travel","Invisibility","Mind reading","Super strength","Healing","See the future"] },
    { q: "If I became invisible for a day, I'd…", opts: ["Spy on people","Prank friends","Rob a bank (jk)","Just sleep","Explore forbidden places","Attend secret meetings","Nothing, I'm ethical","Stalk my crush"] },
    { q: "If I had to eat one food forever, it'd be…", opts: ["Rice & Dal","Pizza","Biryani","Noodles","Maggi","Paneer","Chicken","Pasta"] },
    { q: "If I could live anywhere, I'd choose…", opts: ["India","USA","Europe","Japan","Dubai","Canada","Australia","Anywhere warm"] },
  ],
  deep: [
    { q: "What's my biggest fear?", opts: ["Failure","Loneliness","Death","Losing loved ones","Public embarrassment","Darkness","Heights","Rejection"] },
    { q: "What motivates me most in life?", opts: ["Money","Family","Passion","Fame","Freedom","Love","Knowledge","Purpose"] },
    { q: "What's my biggest life goal?", opts: ["Financial freedom","Happy family","Travel the world","Own a business","Make a difference","Find true love","Achieve mastery","Be healthy"] },
    { q: "How do I handle stress?", opts: ["Talk to someone","Sleep it off","Exercise","Eat comfort food","Watch shows","Listen to music","Overthink alone","Pray/meditate"] },
    { q: "What do I value most in a friend?", opts: ["Loyalty","Honesty","Fun","Support","Respect","Understanding","Humor","Availability"] },
    { q: "What's my communication style?", opts: ["Direct & blunt","Soft & careful","Avoid conflict","Sarcastic","Funny","Overthink before speaking","Loud & expressive","Quiet observer"] },
  ],
  funny: [
    { q: "What would I do if I saw a cockroach?", opts: ["Scream & run","Bravely kill it","Call someone else","Ignore it","Trap & release","Cry","Record a video","Move out"] },
    { q: "What's my guilty pleasure?", opts: ["Eating junk at night","Binge watching","Shopping sprees","Stalking old posts","Singing badly","Napping too much","Mindless scrolling","Karaoke alone"] },
    { q: "If I were a dog, I'd be…", opts: ["Hyperactive puppy","Lazy bulldog","Loyal golden retriever","Dramatic poodle","Chaotic husky","Tiny chihuahua","Smart border collie","Chill labrador"] },
    { q: "Who sleeps the most between us?", opts: ["Definitely me","Definitely them","We both sleep too much","Neither of us sleeps","Me on weekends","Them on weekdays","It's a tie","Neither — insomnia gang"] },
    { q: "What's my most annoying habit?", opts: ["Late replies","Always late","Overthinking","Talking too much","Being too quiet","Forgetting things","Changing plans","Eating your food"] },
    { q: "If I was a meme, which one would I be?", opts: ["Distracted boyfriend","Hide the pain Harold","Doge","Crying cat","This is fine dog","Surprised Pikachu","Buff Doge","Grumpy cat"] },
  ],
  redflag: [
    { q: "Who starts arguments more often?", opts: ["I do","They do","Both equally","Neither — we're chill","Me when hungry","Them when tired","Random stuff sets us off","We don't argue"] },
    { q: "Who apologizes first after a fight?", opts: ["Always me","Always them","Whoever was wrong","Neither — we just move on","Depends on the fight","We apologize together","After days of silence","We never fight"] },
    { q: "What's my worst trait in a relationship?", opts: ["Too clingy","Too distant","Jealous","Stubborn","Forgetful","Overthinking","Moody","Workaholic"] },
    { q: "How do I behave when I'm angry?", opts: ["Go silent","Yell and express","Cry","Pretend everything is fine","Leave the room","Send long texts","Overthink for hours","Workout it out"] },
    { q: "What's a dealbreaker for me?", opts: ["Dishonesty","Disrespect","Laziness","Clinginess","Bad hygiene","No ambition","Different values","Poor communication"] },
  ]
};

const ALL_QUESTIONS = Object.values(QUESTIONS).flat();

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRoomCode() {
  let code;
  do { code = Math.floor(100000 + Math.random() * 900000).toString(); }
  while (rooms.has(code));
  return code;
}

function getModeConfig(mode) {
  const configs = {
    quick:    { questionCount: 5,  timerSeconds: 0, label: 'Quick Match' },
    standard: { questionCount: 20, timerSeconds: 0, label: 'Standard' },
    ultimate: { questionCount: 50, timerSeconds: 0, label: 'Ultimate Match' },
    blitz:    { questionCount: 20, timerSeconds: 0, label: 'Blitz ⚡' },
    survival: { questionCount: 15, timerSeconds: 0, label: 'Survival Mode', survival: true },
  };
  return configs[mode] || configs.standard;
}

function calculateScores(room) {
  let p1Score = 0, p2Score = 0;
  let matchCount = 0;
  const results = [];

  room.answers.forEach((round, idx) => {
    const q = room.questions[idx];
    const p1Answer  = round.p1Answer;
    const p1Predict = round.p1Predict;
    const p2Answer  = round.p2Answer;
    const p2Predict = round.p2Predict;

    // BUG FIX: p1 scores points when their PREDICTION of p2's answer is correct
    const p1Correct = p1Predict === p2Answer;
    // p2 scores points when their PREDICTION of p1's answer is correct
    const p2Correct = p2Predict === p1Answer;

    if (p1Correct) { p1Score += 10; }
    if (p2Correct) { p2Score += 10; }
    if (p1Answer === p2Answer) matchCount++; // "match" = both gave same answer

    results.push({
      question: q.q,
      p1Answer, p2Answer,
      p1Predict, p2Predict,
      p1Correct, p2Correct,
      match: p1Answer === p2Answer
    });
  });

  const total = room.questions.length;
  const compatibility = Math.round((matchCount / total) * 100);
  const p1Understanding = Math.round(room.answers.filter(r => r.p1Predict === r.p2Answer).length / total * 100);
  const p2Understanding = Math.round(room.answers.filter(r => r.p2Predict === r.p1Answer).length / total * 100);

  const trust = Math.min(100, Math.round((p1Understanding + p2Understanding) / 2 + Math.random() * 10 - 5));
  const communication = Math.min(100, Math.round(compatibility * 0.9 + Math.random() * 15));
  const humor = Math.min(100, Math.round(Math.random() * 20 + 75));

  function getTitle(pct) {
    if (pct === 100) return "🧠 Mind Readers";
    if (pct >= 95)  return "✨ Soul Readers";
    if (pct >= 80)  return "🏆 Perfect Duo";
    if (pct >= 60)  return "💫 Good Connection";
    if (pct >= 40)  return "🌱 Getting There";
    if (pct >= 20)  return "🌀 Strangers With History";
    return "👀 Do You Even Know Them?";
  }

  return { p1Score, p2Score, compatibility, trust, communication, humor, matchCount, total, results, title: getTitle(compatibility), p1Understanding, p2Understanding };
}

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── PROFILE ──────────────────────────────────────────────────────────────
  socket.on('save_profile', ({ googleId, nickname, avatar, email }) => {
    if (!googleId) return;
    if (!playerProfiles.has(googleId)) {
      playerProfiles.set(googleId, {
        googleId, nickname, avatar, email,
        totalGames: 0, totalScore: 0,
        bestCompatibility: 0,
        totalMatches: 0,
        history: []
      });
    } else {
      // Update display info
      const p = playerProfiles.get(googleId);
      p.nickname = nickname;
      p.avatar = avatar;
    }
    socket.emit('profile_loaded', playerProfiles.get(googleId));
  });

  socket.on('get_profile', ({ googleId }) => {
    if (!googleId) return;
    const p = playerProfiles.get(googleId);
    if (p) socket.emit('profile_loaded', p);
  });

  // ── ROOM CREATE/JOIN ─────────────────────────────────────────────────────
  socket.on('create_room', ({ nickname, mode, relationship, googleId }) => {
    const code = generateRoomCode();
    const cfg  = getModeConfig(mode);
    const questions = shuffleArray(ALL_QUESTIONS).slice(0, cfg.questionCount);

    const room = {
      code, mode, relationship,
      config: cfg,
      questions,
      players: {
        p1: { id: socket.id, nickname, score: 0, ready: false, googleId: googleId || null },
        p2: null
      },
      state: 'waiting',
      currentQ: 0,
      answers: [],
      timer: null,
      roundTimer: null,
    };

    rooms.set(code, room);
    socketRoom.set(socket.id, code);
    socket.join(code);

    socket.emit('room_created', { code, nickname, mode, relationship, questionCount: cfg.questionCount });
    console.log(`[Room] Created: ${code} by ${nickname}`);
  });

  socket.on('join_room', ({ code, nickname, googleId }) => {
    const room = rooms.get(code);
    if (!room) { socket.emit('error', { msg: 'Room not found. Check the code!' }); return; }
    if (room.state !== 'waiting') { socket.emit('error', { msg: 'Game already started!' }); return; }
    if (room.players.p2) { socket.emit('error', { msg: 'Room is full!' }); return; }

    room.players.p2 = { id: socket.id, nickname, score: 0, ready: false, googleId: googleId || null };
    socketRoom.set(socket.id, code);
    socket.join(code);

    io.to(code).emit('partner_joined', {
      p1: room.players.p1.nickname,
      p2: room.players.p2.nickname,
      mode: room.mode,
      relationship: room.relationship,
      questionCount: room.config.questionCount,
    });

    setTimeout(() => startGame(code), 2000);
    console.log(`[Room] ${nickname} joined ${code}`);
  });

  socket.on('quick_match', ({ nickname, googleId }) => {
    for (let i = quickQueue.length - 1; i >= 0; i--) {
      if (!io.sockets.sockets.get(quickQueue[i].id)) quickQueue.splice(i, 1);
    }

    if (quickQueue.length > 0) {
      const partner = quickQueue.shift();
      const code = generateRoomCode();
      const cfg  = getModeConfig('standard');
      const questions = shuffleArray(ALL_QUESTIONS).slice(0, cfg.questionCount);

      const room = {
        code, mode: 'standard', relationship: '🌍 Strangers',
        config: cfg, questions,
        players: {
          p1: { id: partner.id, nickname: partner.nickname, score: 0, ready: false, googleId: partner.googleId || null },
          p2: { id: socket.id, nickname, score: 0, ready: false, googleId: googleId || null }
        },
        state: 'waiting', currentQ: 0, answers: [], timer: null, roundTimer: null,
      };

      rooms.set(code, room);
      socketRoom.set(partner.id, code);
      socketRoom.set(socket.id, code);

      const pSock = io.sockets.sockets.get(partner.id);
      if (pSock) pSock.join(code);
      socket.join(code);

      io.to(code).emit('partner_joined', {
        p1: partner.nickname, p2: nickname,
        mode: 'standard', relationship: '🌍 Strangers',
        questionCount: cfg.questionCount,
      });
      setTimeout(() => startGame(code), 2000);
    } else {
      quickQueue.push({ id: socket.id, nickname, googleId: googleId || null });
      socket.emit('quick_match_waiting', { msg: 'Searching for a match...' });
    }
  });

  socket.on('cancel_quick_match', () => {
    const idx = quickQueue.findIndex(p => p.id === socket.id);
    if (idx !== -1) quickQueue.splice(idx, 1);
  });

  socket.on('submit_answer', ({ answer, predict, time }) => {
    const code = socketRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'question') return;

    const qIdx = room.currentQ;
    if (!room.answers[qIdx]) room.answers[qIdx] = {};

    const isP1 = room.players.p1.id === socket.id;
    if (isP1) {
      room.answers[qIdx].p1Answer  = answer;
      room.answers[qIdx].p1Predict = predict;
      room.answers[qIdx].p1Time    = time || 0;
    } else {
      room.answers[qIdx].p2Answer  = answer;
      room.answers[qIdx].p2Predict = predict;
      room.answers[qIdx].p2Time    = time || 0;
    }

    // Notify the other player their partner has answered
    socket.to(code).emit('partner_answered');

    const ans = room.answers[qIdx];
    // BUG FIX: Only reveal when BOTH players have answered (no timer fallback)
    if (ans.p1Answer !== undefined && ans.p2Answer !== undefined) {
      revealAnswer(code);
    }
  });

  // ── LEAVE ROOM ───────────────────────────────────────────────────────────
  // BUG FIX: The original code emitted partner_left_permanently via io.to(code)
  // but hoisting issues in the frontend meant forceHome was undefined when the
  // handler fired. We also ensure the emit happens BEFORE any cleanup.
  socket.on('leave_room', () => {
    console.log('[leave_room] received from', socket.id);

    const code = socketRoom.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);

    if (room) {
      // Stop all timers first
      clearTimeout(room.timer);
      clearTimeout(room.roundTimer);
      room.state = 'done';

      // Find the OTHER player's socket id BEFORE any cleanup
      const otherId = room.players.p1.id === socket.id
        ? room.players.p2?.id
        : room.players.p1.id;

      console.log('[leave_room] notifying other player:', otherId);

      // Emit to the ROOM (both players currently in it) before anyone leaves
      // Use a targeted emit to the other socket directly for reliability
      if (otherId) {
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket) {
          otherSocket.emit('partner_left_permanently', { msg: 'Your partner left the game.' });
          console.log('[leave_room] emitted partner_left_permanently directly to', otherId);
        }
        // Also broadcast to room as fallback
        io.to(code).emit('partner_left_permanently', { msg: 'Your partner left the game.' });
      }

      // Clean up other player mapping AFTER emit
      if (otherId) socketRoom.delete(otherId);
    }

    // Clean up leaving player
    socketRoom.delete(socket.id);
    socket.leave(code);

    // Delete room
    rooms.delete(code);
    console.log('[leave_room] cleanup done for room', code);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const code = socketRoom.get(socket.id);
    if (code) {
      const room = rooms.get(code);
      if (room && room.state !== 'done') {
        clearTimeout(room.timer);
        clearTimeout(room.roundTimer);

        // Find other player and notify
        const otherId = room.players.p1.id === socket.id
          ? room.players.p2?.id
          : room.players.p1.id;

        if (otherId) {
          const otherSocket = io.sockets.sockets.get(otherId);
          if (otherSocket) {
            otherSocket.emit('partner_disconnected', { msg: 'Your partner disconnected. Game ended.' });
          }
        }

        io.to(code).emit('partner_disconnected', { msg: 'Your partner disconnected. Game ended.' });
        room.state = 'done';
        rooms.delete(code);
      }
      socketRoom.delete(socket.id);
    }
    const idx = quickQueue.findIndex(p => p.id === socket.id);
    if (idx !== -1) quickQueue.splice(idx, 1);
  });
});

// ─── GAME LOGIC ──────────────────────────────────────────────────────────────
function startGame(code) {
  const room = rooms.get(code);
  if (!room) return;
  room.state = 'countdown';
  io.to(code).emit('game_countdown', { count: 3 });
  let count = 3;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(code).emit('game_countdown', { count });
    } else {
      clearInterval(interval);
      room.state = 'question';
      sendQuestion(code);
    }
  }, 1000);
}

function sendQuestion(code) {
  const room = rooms.get(code);
  if (!room) return;

  const qIdx = room.currentQ;
  if (qIdx >= room.questions.length) { endGame(code); return; }

  const q = room.questions[qIdx];
  const opts = shuffleArray(q.opts);
  room.answers[qIdx] = {};
  room.state = 'question';

  io.to(code).emit('question', {
    index: qIdx,
    total: room.questions.length,
    question: q.q,
    options: opts,
    timer: null, // NO TIMER — round ends only when both players answer
    p1Name: room.players.p1.nickname,
    p2Name: room.players.p2.nickname,
    p1Score: room.players.p1.score,
    p2Score: room.players.p2.score,
  });
}

function revealAnswer(code) {
  const room = rooms.get(code);
  if (!room) return;

  // Guard: only reveal once per question
  if (room.state === 'reveal') return;
  room.state = 'reveal';

  const qIdx = room.currentQ;
  const ans  = room.answers[qIdx];
  const q    = room.questions[qIdx];

  // BUG FIX: Correctly determine if predictions were right
  const p1PredictCorrect = ans.p1Predict === ans.p2Answer;
  const p2PredictCorrect = ans.p2Predict === ans.p1Answer;
  const isAnswerMatch    = ans.p1Answer === ans.p2Answer;

  // Update live scores
  if (p1PredictCorrect) room.players.p1.score += 10;
  if (p2PredictCorrect) room.players.p2.score += 10;

  io.to(code).emit('reveal', {
    index:    qIdx,
    question: q.q,
    p1Answer:  ans.p1Answer,
    p2Answer:  ans.p2Answer,
    p1Predict: ans.p1Predict,
    p2Predict: ans.p2Predict,
    p1PredictCorrect,
    p2PredictCorrect,
    p1Name: room.players.p1.nickname,
    p2Name: room.players.p2.nickname,
    p1Score: room.players.p1.score,
    p2Score: room.players.p2.score,
    match:   isAnswerMatch, // both gave the same answer
    nextIn:  5,  // FIX: 5 second reveal window matches the setTimeout below
  });

  // BUG FIX: 5000ms delay so the reveal stays visible for the full 5 seconds
  room.roundTimer = setTimeout(() => {
    room.currentQ++;
    if (room.currentQ >= room.questions.length) {
      endGame(code);
      return;
    }
    room.state = 'question';
    sendQuestion(code);
  }, 5000);
}

function endGame(code) {
  const room = rooms.get(code);
  if (!room) return;
  room.state = 'done';
  const scores = calculateScores(room);

  io.to(code).emit('game_over', {
    ...scores,
    p1Name: room.players.p1.nickname,
    p2Name: room.players.p2.nickname,
    p1GoogleId: room.players.p1.googleId,
    p2GoogleId: room.players.p2.googleId,
    mode: room.mode,
    relationship: room.relationship,
  });

  // Update profiles if players are signed in
  const updateProfile = (googleId, score, compat) => {
    if (!googleId) return;
    const p = playerProfiles.get(googleId);
    if (!p) return;
    p.totalGames++;
    p.totalScore += score;
    if (compat > p.bestCompatibility) p.bestCompatibility = compat;
    p.totalMatches += scores.matchCount;
    p.history.unshift({
      date: new Date().toISOString(),
      mode: room.mode,
      relationship: room.relationship,
      compatibility: scores.compatibility,
      score,
      title: scores.title,
    });
    if (p.history.length > 20) p.history = p.history.slice(0, 20);
  };

  updateProfile(room.players.p1.googleId, scores.p1Score, scores.compatibility);
  updateProfile(room.players.p2?.googleId, scores.p2Score, scores.compatibility);

  setTimeout(() => rooms.delete(code), 600000);
}

// ─── API ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({ activeRooms: rooms.size, queueLength: quickQueue.length, totalQuestions: ALL_QUESTIONS.length });
});

app.get('/api/profile/:googleId', (req, res) => {
  const p = playerProfiles.get(req.params.googleId);
  if (!p) return res.status(404).json({ error: 'Profile not found' });
  res.json(p);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── LISTEN ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🧠 MindMatch running → http://localhost:${PORT}\n`));
