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

// ── CHANGE 1: Replace single quickQueue with per-mode queues ──────────────
// OLD: const quickQueue = [];
// NEW: separate queue per mode so players only match within same mode
const modeQueues = {
  quick:    [],
  standard: [],
  blitz:    [],
  survival: [],
  ultimate: [],
};

const socketRoom = new Map();

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

// ─── MODE CONFIG ─────────────────────────────────────────────────────────────
function getModeConfig(mode) {
  const configs = {
    quick: {
      questionCount:    5,
      revealDuration:   5000,
      lives:            null,
      pointsPerMatch:   0,
      pointsPerPredict: 10,
      label: '⚡ Quick Match',
    },
    standard: {
      questionCount:    20,
      revealDuration:   5000,
      lives:            null,
      pointsPerMatch:   0,
      pointsPerPredict: 10,
      label: '🎯 Standard',
    },
    // CHANGE 2: Blitz revealDuration confirmed 2000ms (was already set but
    // now also adds pointsPerMatch bonus to reward fast matching)
    blitz: {
      questionCount:    20,
      revealDuration:   2000,
      lives:            null,
      pointsPerMatch:   5,
      pointsPerPredict: 10,
      label: '🔥 Blitz Mode',
    },
    // CHANGE 3: Survival — lives:3, higher reward per correct predict
    survival: {
      questionCount:    15,
      revealDuration:   4000,
      lives:            3,
      pointsPerMatch:   0,
      pointsPerPredict: 15,
      label: '💀 Survival',
    },
    // CHANGE 4: Ultimate — 50 questions, show detailed end report (handled
    // in calculateScores and endGame via ultimateReport flag)
    ultimate: {
      questionCount:    50,
      revealDuration:   5000,
      lives:            null,
      pointsPerMatch:   5,
      pointsPerPredict: 10,
      label: '👑 Ultimate Match',
    },
  };
  return configs[mode] || configs.standard;
}

function calculateScores(room) {
  let p1Score = 0, p2Score = 0;
  let matchCount = 0;
  const results = [];
  const cfg = room.config;

  room.answers.forEach((round, idx) => {
    const q = room.questions[idx];
    const { p1Answer, p1Predict, p2Answer, p2Predict } = round;

    const p1Correct   = p1Predict === p2Answer;
    const p2Correct   = p2Predict === p1Answer;
    const answersMatch = p1Answer === p2Answer;

    if (p1Correct)    p1Score += cfg.pointsPerPredict;
    if (p2Correct)    p2Score += cfg.pointsPerPredict;
    if (answersMatch) {
      p1Score += cfg.pointsPerMatch;
      p2Score += cfg.pointsPerMatch;
      matchCount++;
    }

    results.push({ question: q.q, p1Answer, p2Answer, p1Predict, p2Predict, p1Correct, p2Correct, match: answersMatch });
  });

  const total          = room.answers.length;
  const compatibility  = total > 0 ? Math.round((matchCount / total) * 100) : 0;
  const p1Understanding = total > 0 ? Math.round(room.answers.filter(r => r.p1Predict === r.p2Answer).length / total * 100) : 0;
  const p2Understanding = total > 0 ? Math.round(room.answers.filter(r => r.p2Predict === r.p1Answer).length / total * 100) : 0;
  const trust         = Math.min(100, Math.round((p1Understanding + p2Understanding) / 2 + Math.random() * 10 - 5));
  const communication = Math.min(100, Math.round(compatibility * 0.9 + Math.random() * 15));
  const humor         = Math.min(100, Math.round(Math.random() * 20 + 75));

  function getTitle(pct) {
    if (pct === 100) return "🧠 Mind Readers";
    if (pct >= 95)   return "✨ Soul Readers";
    if (pct >= 80)   return "🏆 Perfect Duo";
    if (pct >= 60)   return "💫 Good Connection";
    if (pct >= 40)   return "🌱 Getting There";
    if (pct >= 20)   return "🌀 Strangers With History";
    return "👀 Do You Even Know Them?";
  }

  // CHANGE 5: Ultimate mode — compute strongest/weakest matches and
  // prediction accuracy per player for the detailed end report
  let ultimateExtras = null;
  if (room.mode === 'ultimate') {
    const strongMatches = results.filter(r => r.match).slice(0, 5);
    const weakMatches   = results.filter(r => !r.match).slice(0, 5);
    const p1Accuracy    = total > 0 ? Math.round(results.filter(r => r.p1Correct).length / total * 100) : 0;
    const p2Accuracy    = total > 0 ? Math.round(results.filter(r => r.p2Correct).length / total * 100) : 0;
    const relationshipScore = Math.min(100, Math.round((compatibility + p1Accuracy + p2Accuracy) / 3));
    ultimateExtras = { strongMatches, weakMatches, p1Accuracy, p2Accuracy, relationshipScore };
  }

  return {
    p1Score, p2Score, compatibility, trust, communication, humor,
    matchCount, total, results,
    title: getTitle(compatibility),
    p1Understanding, p2Understanding,
    ultimateExtras,
  };
}

// ─── HELPER: destroy room and notify other player ────────────────────────────
function destroyRoom(code, leavingSocketId, eventName, msg) {
  const room = rooms.get(code);
  if (!room) return;

  clearTimeout(room.timer);
  clearTimeout(room.roundTimer);
  room.state = 'done';

  const otherId = room.players.p1.id === leavingSocketId
    ? room.players.p2?.id
    : room.players.p1.id;

  if (otherId) {
    const otherSocket = io.sockets.sockets.get(otherId);
    if (otherSocket) otherSocket.emit(eventName, { msg });
    socketRoom.delete(otherId);
  }

  socketRoom.delete(leavingSocketId);
  rooms.delete(code);
}

// ─── SOCKET.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── CREATE ROOM ───────────────────────────────────────────────────────────
  socket.on('create_room', ({ nickname, mode, relationship }) => {
    const code = generateRoomCode();
    const cfg  = getModeConfig(mode);
    const questions = shuffleArray(ALL_QUESTIONS).slice(0, cfg.questionCount);

    const room = {
      code, mode, relationship,
      config: cfg,
      questions,
      players: {
        p1: { id: socket.id, nickname, score: 0, lives: cfg.lives },
        p2: null,
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

    socket.emit('room_created', { code, nickname, mode, relationship, questionCount: cfg.questionCount, modeLabel: cfg.label });
    console.log(`[Room] Created: ${code} by ${nickname} mode=${mode}`);
  });

  // ── JOIN ROOM ─────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, nickname }) => {
    const room = rooms.get(code);
    if (!room)              { socket.emit('error', { msg: 'Room not found. Check the code!' }); return; }
    if (room.state !== 'waiting') { socket.emit('error', { msg: 'Game already started!' });    return; }
    if (room.players.p2)   { socket.emit('error', { msg: 'Room is full!' });                   return; }

    room.players.p2 = { id: socket.id, nickname, score: 0, lives: room.config.lives };
    socketRoom.set(socket.id, code);
    socket.join(code);

    io.to(code).emit('partner_joined', {
      p1: room.players.p1.nickname,
      p2: room.players.p2.nickname,
      mode: room.mode,
      modeLabel: room.config.label,
      relationship: room.relationship,
      questionCount: room.config.questionCount,
      lives: room.config.lives,
    });

    setTimeout(() => startGame(code), 2000);
    console.log(`[Room] ${nickname} joined ${code}`);
  });

  // ── QUICK MATCH (now mode-aware) ──────────────────────────────────────────
  // CHANGE 6: Accept `mode` from client; use modeQueues[mode] instead of
  // the old single quickQueue so players only match within the same mode.
  socket.on('quick_match', ({ nickname, mode }) => {
    // Sanitise: fall back to 'standard' if unknown mode sent
    const safeMode = modeQueues[mode] ? mode : 'standard';
    const queue    = modeQueues[safeMode];
    const cfg      = getModeConfig(safeMode);

    // Prune disconnected sockets from this mode's queue
    for (let i = queue.length - 1; i >= 0; i--) {
      if (!io.sockets.sockets.get(queue[i].id)) queue.splice(i, 1);
    }

    if (queue.length > 0) {
      const partner   = queue.shift();
      const code      = generateRoomCode();
      const questions = shuffleArray(ALL_QUESTIONS).slice(0, cfg.questionCount);

      const room = {
        code, mode: safeMode, relationship: '🌍 Strangers',
        config: cfg, questions,
        players: {
          p1: { id: partner.id, nickname: partner.nickname, score: 0, lives: cfg.lives },
          p2: { id: socket.id,  nickname,                   score: 0, lives: cfg.lives },
        },
        state: 'waiting', currentQ: 0, answers: [], timer: null, roundTimer: null,
      };

      rooms.set(code, room);
      socketRoom.set(partner.id, code);
      socketRoom.set(socket.id,  code);

      const pSock = io.sockets.sockets.get(partner.id);
      if (pSock) pSock.join(code);
      socket.join(code);

      io.to(code).emit('partner_joined', {
        p1: partner.nickname, p2: nickname,
        mode: safeMode, modeLabel: cfg.label, relationship: '🌍 Strangers',
        questionCount: cfg.questionCount, lives: cfg.lives,
      });
      setTimeout(() => startGame(code), 2000);
    } else {
      queue.push({ id: socket.id, nickname, mode: safeMode });
      // CHANGE 7: Tell client which mode they're queued for so the waiting
      // screen can display it.
      socket.emit('quick_match_waiting', {
        msg:       'Searching for a ' + cfg.label + ' match...',
        mode:      safeMode,
        modeLabel: cfg.label,
      });
    }
  });

  // CHANGE 8: cancel_quick_match must search ALL mode queues, not just one
  socket.on('cancel_quick_match', () => {
    for (const q of Object.values(modeQueues)) {
      const idx = q.findIndex(p => p.id === socket.id);
      if (idx !== -1) { q.splice(idx, 1); break; }
    }
  });

  // ── SUBMIT ANSWER ─────────────────────────────────────────────────────────
  socket.on('submit_answer', ({ answer, predict }) => {
    const code = socketRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'question') return;

    const qIdx = room.currentQ;
    if (!room.answers[qIdx]) room.answers[qIdx] = {};

    const isP1 = room.players.p1.id === socket.id;

    if (isP1  && room.answers[qIdx].p1Answer !== undefined) return;
    if (!isP1 && room.answers[qIdx].p2Answer !== undefined) return;

    if (isP1) {
      room.answers[qIdx].p1Answer  = answer;
      room.answers[qIdx].p1Predict = predict;
    } else {
      room.answers[qIdx].p2Answer  = answer;
      room.answers[qIdx].p2Predict = predict;
    }

    socket.to(code).emit('partner_answered');

    const ans = room.answers[qIdx];
    if (ans.p1Answer !== undefined && ans.p2Answer !== undefined) {
      revealAnswer(code);
    }
  });

  // ── LEAVE MATCH ───────────────────────────────────────────────────────────
  socket.on('leave_match', () => {
    console.log('[leave_match] received from', socket.id);
    const code = socketRoom.get(socket.id);
    if (!code) return;
    destroyRoom(code, socket.id, 'match_left', 'Your partner left the match.');
    socket.leave(code);
  });

  socket.on('leave_room', () => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room && room.state !== 'waiting' && room.state !== 'done') {
      destroyRoom(code, socket.id, 'match_left', 'Your partner left the match.');
    } else if (room) {
      clearTimeout(room.timer);
      clearTimeout(room.roundTimer);
      socketRoom.delete(socket.id);
      rooms.delete(code);
    }
    socket.leave(code);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const code = socketRoom.get(socket.id);
    if (code) {
      const room = rooms.get(code);
      if (room && room.state !== 'done') {
        destroyRoom(code, socket.id, 'match_left', 'Your partner disconnected. Match ended.');
      } else {
        socketRoom.delete(socket.id);
      }
    }
    // CHANGE 9: Remove disconnected socket from whichever mode queue it's in
    for (const q of Object.values(modeQueues)) {
      const idx = q.findIndex(p => p.id === socket.id);
      if (idx !== -1) { q.splice(idx, 1); break; }
    }
  });
});

// ─── GAME LOGIC ──────────────────────────────────────────────────────────────
function startGame(code) {
  const room = rooms.get(code);
  if (!room) return;
  room.state = 'countdown';

  io.to(code).emit('game_start_config', {
    mode:          room.mode,
    modeLabel:     room.config.label,
    lives:         room.config.lives,
    questionCount: room.config.questionCount,
  });

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

  const q    = room.questions[qIdx];
  const opts = shuffleArray(q.opts);
  room.answers[qIdx] = {};
  room.state = 'question';

  io.to(code).emit('question', {
    index:    qIdx,
    total:    room.questions.length,
    question: q.q,
    options:  opts,
    mode:     room.mode,
    modeLabel: room.config.label,
    p1Name:   room.players.p1.nickname,
    p2Name:   room.players.p2.nickname,
    p1Score:  room.players.p1.score,
    p2Score:  room.players.p2.score,
    p1Lives:  room.players.p1.lives,
    p2Lives:  room.players.p2.lives,
  });
}

function revealAnswer(code) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.state === 'reveal' || room.state === 'done') return;
  room.state = 'reveal';

  const qIdx = room.currentQ;
  const ans  = room.answers[qIdx];
  const q    = room.questions[qIdx];
  const cfg  = room.config;

  const p1PredictCorrect = ans.p1Predict === ans.p2Answer;
  const p2PredictCorrect = ans.p2Predict === ans.p1Answer;
  const isAnswerMatch    = ans.p1Answer  === ans.p2Answer;

  // Scoring
  if (p1PredictCorrect) room.players.p1.score += cfg.pointsPerPredict;
  if (p2PredictCorrect) room.players.p2.score += cfg.pointsPerPredict;
  if (isAnswerMatch) {
    room.players.p1.score += cfg.pointsPerMatch;
    room.players.p2.score += cfg.pointsPerMatch;
  }

  // Survival: lose a life on wrong prediction
  let p1Eliminated = false;
  let p2Eliminated = false;

  if (cfg.lives !== null) {
    if (!p1PredictCorrect) room.players.p1.lives = Math.max(0, room.players.p1.lives - 1);
    if (!p2PredictCorrect) room.players.p2.lives = Math.max(0, room.players.p2.lives - 1);
    p1Eliminated = room.players.p1.lives <= 0;
    p2Eliminated = room.players.p2.lives <= 0;
  }

  io.to(code).emit('reveal', {
    index:    qIdx,
    question: q.q,
    p1Answer:  ans.p1Answer,
    p2Answer:  ans.p2Answer,
    p1Predict: ans.p1Predict,
    p2Predict: ans.p2Predict,
    p1PredictCorrect,
    p2PredictCorrect,
    p1Name:  room.players.p1.nickname,
    p2Name:  room.players.p2.nickname,
    p1Score: room.players.p1.score,
    p2Score: room.players.p2.score,
    p1Lives: room.players.p1.lives,
    p2Lives: room.players.p2.lives,
    match:   isAnswerMatch,
    mode:    room.mode,
    revealDuration: cfg.revealDuration,
  });

  // CHANGE 10: Survival elimination — end game when any player hits 0 lives
  if (p1Eliminated || p2Eliminated) {
    room.roundTimer = setTimeout(() => {
      if (!rooms.get(code)) return;
      endGame(code);
    }, cfg.revealDuration);
    return;
  }

  room.roundTimer = setTimeout(() => {
    if (!rooms.get(code)) return;
    room.currentQ++;
    if (room.currentQ >= room.questions.length) {
      endGame(code);
      return;
    }
    room.state = 'question';
    sendQuestion(code);
  }, cfg.revealDuration);
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
    mode:   room.mode,
    modeLabel: room.config.label,
    relationship: room.relationship,
    // CHANGE 11: Pass ultimateExtras to frontend for the detailed Ultimate report
    ultimateExtras: scores.ultimateExtras,
  });

  setTimeout(() => rooms.delete(code), 600000);
}

// ─── API ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  // CHANGE 12: Report total queue length across ALL mode queues
  const totalQueue = Object.values(modeQueues).reduce((sum, q) => sum + q.length, 0);
  res.json({
    activeRooms:    rooms.size,
    queueLength:    totalQueue,
    totalQuestions: ALL_QUESTIONS.length,
    // Bonus: per-mode queue sizes for debugging
    queues: Object.fromEntries(Object.entries(modeQueues).map(([k, v]) => [k, v.length])),
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🧠 MindMatch running → http://localhost:${PORT}\n`));
