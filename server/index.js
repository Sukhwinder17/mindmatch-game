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

const modeQueues = {
  quick:    [],
  standard: [],
  guess:    [],
  survival: [],
  ultimate: [],
  story:    [],
};

const socketRoom = new Map();

// ═══════════════════════════════════════════════════════════════════════════
//  QUESTION BANKS — 500+ questions, categorized by relationship type
// ═══════════════════════════════════════════════════════════════════════════

const QUESTION_BANKS = {

  // ── ❤️ COUPLES ──────────────────────────────────────────────────────────
  couple: [
    { q: "What is my dream honeymoon destination?", opts: ["Paris","Maldives","Japan","Bali","Switzerland","New York","Dubai","Santorini"] },
    { q: "What annoys me most in a relationship?", opts: ["Ignoring texts","Being late","Over-possessiveness","Bad communication","Dishonesty","Mood swings","Forgetting things","Interrupting"] },
    { q: "What would I choose for a perfect date night?", opts: ["Candlelit dinner","Movie at home","Beach walk","Cooking together","Rooftop picnic","Gaming night","Stargazing","Concert"] },
    { q: "What is my love language?", opts: ["Words of affirmation","Quality time","Physical touch","Acts of service","Gift giving","All of them","None strongly","I'm still figuring out"] },
    { q: "How would I describe our relationship?", opts: ["Best friends + partners","Passionate and intense","Calm and comfortable","Adventurous","Growing every day","Still figuring it out","Perfectly balanced","Chaotic but loving"] },
    { q: "What would I get jealous about most?", opts: ["Too much time with others","Old ex contact","Flirty messages","Work taking priority","Close friendships","Social media comments","Nothing really","Late nights out"] },
    { q: "Where do I see us in 5 years?", opts: ["Married","Living together","Travelling the world","Building a career together","Starting a family","Still dating happily","Who knows!","Settled in our own home"] },
    { q: "What's the one thing I'd change about our relationship?", opts: ["More quality time","Better communication","More spontaneity","Less overthinking","More affection","More shared goals","Nothing at all","More honesty"] },
    { q: "How do I show love most?", opts: ["Hugs and cuddles","Cooking for you","Surprise gifts","Long conversations","Acts of service","Memes and jokes","Just being there","Saying 'I love you' often"] },
    { q: "What is my biggest relationship fear?", opts: ["Being left","Growing apart","Losing trust","Not being enough","Conflicts going unresolved","Being cheated on","Falling out of love","Depending too much"] },
    { q: "What would our perfect Sunday together look like?", opts: ["Lazy morning in bed","Brunch then park walk","Movie marathon","Road trip somewhere","Cook a big meal","Visit family","Totally separate days","Adventure activity"] },
    { q: "How do I handle relationship fights?", opts: ["Need space first","Talk it out immediately","Go quiet and think","Apologize quickly","Write my feelings","Overthink for hours","Cry it out","Humor to defuse tension"] },
    { q: "What gift from me would make me happiest?", opts: ["Handwritten letter","Expensive jewelry","Travel trip","Experience/adventure","Something personal and meaningful","My favorite food","Tech gadget","Just your time"] },
    { q: "What's my biggest green flag in a partner?", opts: ["Emotional maturity","Ambition","Humor","Honesty","Loyalty","Kindness","Intelligence","Spontaneity"] },
    { q: "What's my biggest dealbreaker?", opts: ["Dishonesty","Disrespect","Lack of ambition","Clinginess","Different values","Bad communication","Jealousy issues","Laziness"] },
    { q: "How important is physical affection to me?", opts: ["Extremely important","Very important","Moderately important","Somewhat important","Not very important","Depends on mood","I need it daily","I prefer words"] },
    { q: "What would I do if we had a huge fight?", opts: ["Take a walk alone","Call a friend","Journal my feelings","Sleep on it","Try to resolve it right away","Overthink everything","Watch comfort show","Eat my feelings"] },
    { q: "What's my ideal relationship pace?", opts: ["Slow and steady","Move in together fast","Take it as it comes","Milestone-driven","Following our hearts","Serious after 6 months","Very gradual","Spontaneous decisions"] },
    { q: "What makes me feel most appreciated in a relationship?", opts: ["Being listened to","Surprise gestures","Public affection","Remembering small things","Acts of service","Verbal appreciation","Quality time","Consistent effort"] },
    { q: "What's something romantic I've always wanted to do?", opts: ["Slow dance in the rain","Propose somewhere scenic","Write love letters","Cook a fancy dinner together","Travel to Paris","Stargaze overnight","Sunrise walk together","Recreate our first date"] },
  ],

  // ── 🌍 LONG DISTANCE ────────────────────────────────────────────────────
  longdistance: [
    { q: "What would I do first when we finally meet?", opts: ["Hug for a very long time","Kiss immediately","Cry happy tears","Just stare at you","Take a photo together","Go to our favorite food spot","Not let go at all","Say nothing — just smile"] },
    { q: "What do I miss most about you?", opts: ["Your voice","Your hugs","Your laugh","Doing nothing together","Cooking together","Morning texts","Your smell","Just your presence"] },
    { q: "What would our perfect reunion look like?", opts: ["Quiet and private","Big surprise reveal","Airport meeting","Home-cooked meal","A trip away together","Simple coffee date","Big party with friends","Just us at home"] },
    { q: "What do I do when I miss you most?", opts: ["Reread old chats","Look at photos","Send you a message","Listen to 'our song'","Watch our favorite show","Keep busy","Cry a little","Video call immediately"] },
    { q: "What's hardest about long distance for me?", opts: ["Not being there physically","Time zone differences","Missing milestones together","Fear of drifting apart","Not being able to comfort you","Lonely nights","Trusting fully from far","Can't just show up"] },
    { q: "How often do I want to video call?", opts: ["Every day","Twice a day","Every other day","A few times a week","Once a week","Whenever possible","Depends on schedule","Spontaneously"] },
    { q: "What would I choose: 6 months apart or 6 months together with no job?", opts: ["6 months apart — practical","Together no matter what","Negotiate something different","Take the job but plan visits","Very hard choice","Together — always","Apart reluctantly","Never had to choose yet"] },
    { q: "How do I handle the loneliness?", opts: ["Throw myself into work","Friends and family","Hobbies and projects","Talking to you constantly","Exercise and routine","Watch comfort content","Journal my feelings","Cry and then feel better"] },
    { q: "What keeps me going during the distance?", opts: ["Our end goal","Your messages","Planning visits","Knowing it's temporary","Love is love wherever","Our calls and chats","Photos of us","Future we're building"] },
    { q: "What would I do if we lived in the same city tomorrow?", opts: ["Move in right away","Date normally first","Take things slow","Plan it carefully","Get a place nearby","Not rush anything","Follow wherever you are","Travel together first"] },
    { q: "What timezone trick do I use to feel closer?", opts: ["Sync our schedules","Good morning texts across timezones","Sleep-call together","Watch same show simultaneously","Leave voice notes","Share my day in detail","Send photos of what I see","Imagine what you're doing"] },
    { q: "How do I make long distance work emotionally?", opts: ["Constant communication","Trust without checking","Focus on the future","Weekly dates online","Honest about struggles","Emotional vulnerability","Shared playlists and shows","Letters and care packages"] },
  ],

  // ── 👫 BEST FRIENDS ─────────────────────────────────────────────────────
  bestfriends: [
    { q: "What is my most embarrassing memory?", opts: ["Tripped in public","Called teacher 'mom'","Autocorrect disaster","Embarrassing crush moment","Fell at a party","Said wrong thing at wrong time","Outfit malfunction","You already know it!"] },
    { q: "What food do I always order?", opts: ["Biryani","Pizza","Burger","Momos/Dumplings","Pasta","Noodles","Fries always","Whatever looks best"] },
    { q: "What would I do with one million dollars?", opts: ["Travel everywhere","Invest smartly","Buy a house","Give family","Start a business","Donate a chunk","Buy all the gadgets","Half save half spend"] },
    { q: "What's my go-to karaoke song?", opts: ["Something Bollywood","An English pop hit","Something emotional","A high-energy banger","Whatever I know lyrics to","I don't do karaoke","Latest trending song","Classic old song"] },
    { q: "What series/show am I always rewatching?", opts: ["Friends","HIMYM","Breaking Bad","Money Heist","Brooklyn Nine-Nine","Office (US or UK)","Game of Thrones","An anime"] },
    { q: "What's my most used text response?", opts: ["lol","haha","ok","okay fine","😭","💀","fr fr","on my way / omw"] },
    { q: "What's my toxic trait that I'm aware of?", opts: ["Overthinking everything","Chronic late replies","Cancel plans last minute","Too blunt","Avoid conflict","Overshare then regret","Competitive about small things","Never admits when wrong"] },
    { q: "How do I react when I'm embarrassed?", opts: ["Laugh it off","Go super quiet","Pretend it didn't happen","Leave the room","Make a self-deprecating joke","Overthink it for days","Blame someone else jokingly","Bring it up myself before others can"] },
    { q: "What would I do on a spontaneous road trip?", opts: ["Make a perfect playlist","Handle snacks and food","Navigate (no GPS)","Sleep the whole time","Take all the photos","Handle hotel booking","Suggest all the stops","Just vibe with no plan"] },
    { q: "What's my friendship love language?", opts: ["Always showing up","Savage but loyal roasting","Remembering small details","Surprise check-ins","Sharing memes non-stop","Paying for food sometimes","Honest brutal advice","Being there at 3am"] },
    { q: "What do I do when a friend is upset?", opts: ["Sit with them quietly","Go into fix-it mode","Distract with humor","Bring food immediately","Listen and validate","Ask how I can help","Give space but check in","Share my own struggles to relate"] },
    { q: "How would I describe our friendship?", opts: ["You know where the bodies are buried","Comfortable silence pros","Each other's therapist","Chaotic but loyal","Opposite personalities but works","New but feels old","Ride or die forever","Growing apart but still close"] },
    { q: "What would I do if you betrayed my trust?", opts: ["Cut off completely","Talk it out first","Forgive but never forget","Give one more chance","Gossip about it first honestly","Depends on what it was","Cry, then get petty","Ghost slowly"] },
    { q: "What's my role in our friend group?", opts: ["The mom/caretaker","The funny one","The planner","The wild card","The listener","The honest one","The peacemaker","The one who disappears and reappears"] },
    { q: "What's something only I know about you?", opts: ["A secret crush","A big dream you hide","A fear you don't share","Something from your past","A talent hidden from others","A habit you're embarrassed by","Something you did once","A worry you carry alone"] },
  ],

  // ── 👨‍👩‍👧 FAMILY ─────────────────────────────────────────────────────────
  family: [
    { q: "What was my favorite childhood activity?", opts: ["Playing outside all day","Video games","Drawing/Art","Reading","Cricket or football","Watching cartoons","Cooking with family","Riding a bike"] },
    { q: "Who am I closest to in the family?", opts: ["Mom","Dad","Sibling","Grandparent","Cousin","Aunt or Uncle","Everyone equally","Depends on the day"] },
    { q: "What childhood dish do I still crave?", opts: ["Mom's dal chawal","Dadi/nani's khichdi","Homemade biryani","Rajma rice","Poha on Sundays","Maggi made by sibling","Festival sweets","Sunday morning parathas"] },
    { q: "What was my biggest childhood dream?", opts: ["Become a cricketer","Become an astronaut","Be a doctor","Be a teacher","Become rich and travel","Be an artist","Be a chef","Something I've never told anyone"] },
    { q: "What family tradition means most to me?", opts: ["Festival celebrations","Sunday meals together","Annual family trip","Evening chai together","Watching cricket together","Birthday traditions","Morning prayer routine","Movie nights at home"] },
    { q: "What do I argue about most at home?", opts: ["Screen time","Coming home late","Cleaning and chores","Career choices","Money decisions","Food preferences","Who uses the bathroom longest","Nothing major really"] },
    { q: "What childhood memory makes me smile most?", opts: ["Festival celebrations","Summer vacations","School days","Playing with cousins","Family road trips","Special events","Rainy day games at home","A specific memory with a sibling"] },
    { q: "What family value was drilled into me growing up?", opts: ["Respect elders always","Work hard for everything","Education is everything","Family comes first","Be honest always","Never show weakness","Save money, don't waste","Be kind to everyone"] },
    { q: "Who in the family is most like me?", opts: ["Mom","Dad","An older sibling","A younger sibling","A grandparent","A cousin","Honestly nobody","A mix of everyone"] },
    { q: "What's something I wish my family understood about me better?", opts: ["My career choice","My personality","My need for space","My relationship","My mental health","My ambitions","My humor","My values have changed"] },
    { q: "How do I show love to family?", opts: ["Spending quality time","Helping around the house","Sharing food","Bringing home gifts","Checking in by call","Taking family photos","Planning family events","Just being present"] },
    { q: "What would I do differently raising my own kids?", opts: ["More open conversations","Less pressure on grades","Encourage creativity more","Travel together often","Be emotionally available","Give more independence","Not compare to others","Be their friend too"] },
  ],

  // ── 🎓 CLASSMATES ───────────────────────────────────────────────────────
  classmates: [
    { q: "What was my favorite subject?", opts: ["Maths","Science","English","History","Art/Drawing","Physical Education","Computer Science","I hated all of them"] },
    { q: "What type of student was I?", opts: ["Front row, very attentive","Back row, not paying attention","Middle row, average vibes","Tried hard but struggled","Naturally smart, didn't study","Social butterfly, talked too much","Chronic late submitter","Slept through some classes"] },
    { q: "What was my role in group projects?", opts: ["Leader who does most work","The ideas person","The one who disappears","Does their part reliably","Talks a lot but little output","Last-minute crammer","Quietly carries everyone","Depends on the group"] },
    { q: "How did I react when exams were near?", opts: ["All-night study sessions","Panic and procrastinate","Surprisingly calm","Rely on last-minute notes","Ask everyone for help","Make detailed plans","Accept my fate","Cry then study"] },
    { q: "What did I do during lunch break?", opts: ["Hang with the same friends","Explore the whole school","Eat as fast as possible","Visit the canteen daily","Skip food, stay in class","Play sports outside","Gossip session","Something different each day"] },
    { q: "What kind of notes did I take?", opts: ["Colour-coded perfection","Barely readable scribble","Borrowed from others mostly","Didn't take notes","Digital notes only","Voice-recorded lectures","Artistic and decorated","Bare minimum to pass"] },
    { q: "Who was I most known as in class?", opts: ["The smart one","The funny one","The quiet one","The sporty one","The artistic one","The class helper","The one who asked too many questions","Nobody really noticed me"] },
    { q: "How did I deal with strict teachers?", opts: ["Stayed under the radar","Tried to impress them","Argued back politely","Made fun behind their back","Genuinely feared them","Became their favorite","Avoided their class","Just survived"] },
    { q: "What's my biggest school memory?", opts: ["A school trip","Sports day win","A funny classroom incident","An embarrassing moment","Exam pressure","A great teacher","A friendship formed","End of school ceremony"] },
    { q: "What would I change about school?", opts: ["Less exams, more projects","More creative subjects","Better mental health support","Less homework","More free periods","Better food","Cooler teachers","Nothing — I loved it"] },
  ],

  // ── 💼 COWORKERS ────────────────────────────────────────────────────────
  coworkers: [
    { q: "What task do I hate the most at work?", opts: ["Pointless meetings","Emails that could be texts","Manual data entry","Unclear briefs","Last-minute changes","Following up repeatedly","Administrative tasks","Explaining things multiple times"] },
    { q: "What motivates me most at work?", opts: ["Recognition and praise","Financial incentive","Learning new skills","Helping the team succeed","Autonomy and freedom","Challenging projects","Growth opportunities","Good team culture"] },
    { q: "What kind of worker am I?", opts: ["Early bird, done by noon","Night owl, peak evening","Consistent 9-5 person","Deadline-driven crammer","Multitasker","Deep focus one task at a time","Collaborative team player","Independent loner"] },
    { q: "How do I handle work stress?", opts: ["Make a list and tackle it","Talk to a trusted colleague","Take a walk/break","Work even harder","Complain a little then move on","Internalize and overthink","Look for solutions immediately","Decompress after work hours"] },
    { q: "What's my unspoken work rule?", opts: ["No unnecessary meetings","Respect my focus time","Don't reply after hours","Give credit where it's due","Be direct, not political","No micromanagement","Document everything","Lunch is my sacred hour"] },
    { q: "What's my biggest workplace pet peeve?", opts: ["People who talk over you","Credit-takers","Late replies to urgent things","Over-meetings","Passive aggression","Messy shared spaces","Noisy open offices","Unclear expectations"] },
    { q: "How do I prefer to receive feedback?", opts: ["Direct and immediate","Privately, not publicly","Written so I can review","With context and examples","Only from people I respect","Monthly reviews","As and when it happens","Gently, with positivity first"] },
    { q: "What's my most productive time of day at work?", opts: ["First thing in the morning","Mid-morning after settling","Right after lunch","Late afternoon","Evening hours","Varies day to day","Under deadline pressure only","When everyone leaves me alone"] },
    { q: "How do I act in team meetings?", opts: ["Speak up frequently","Listen and observe mostly","Take notes quietly","Challenge ideas constructively","Doodle and think","Contribute when asked","Try to wrap it up fast","Vary based on topic"] },
    { q: "What would make my job 10x better?", opts: ["Work from home always","Better pay","Clearer expectations","Stronger team culture","Less bureaucracy","More interesting projects","Flexible hours","A competent manager"] },
    { q: "How do I bond with coworkers?", opts: ["Team lunches","Office banter and jokes","After-work drinks","Helping with their problems","Sharing snacks","Shared work wins","Just working side by side","Reluctantly at team events"] },
  ],

  // ── 🎮 GAMING FRIENDS ───────────────────────────────────────────────────
  gaming: [
    { q: "What game would I never uninstall?", opts: ["GTA V / GTA Online","FIFA / eFootball","BGMI / PUBG","Valorant","Minecraft","Free Fire","Call of Duty Mobile","A specific RPG I love"] },
    { q: "Which role would I choose in a team game?", opts: ["Aggressive fragger","Support/healer","Scout/flanker","Sniper/long-range","In-game leader","Flex — whatever's needed","Tank/initiator","I solo carry only"] },
    { q: "How do I react after losing a game?", opts: ["Blame my teammates","Analyze what went wrong","Rage quit","Play again immediately","Take a 10-min break","Laugh it off","Complain to anyone who listens","Silently seethe"] },
    { q: "What's my gaming setup priority?", opts: ["High refresh rate monitor","Mechanical keyboard","Gaming headset","Fast internet above all","Comfortable chair","Gaming mouse precision","RGB everything","Just a working controller"] },
    { q: "What's my gaming personality?", opts: ["Hyper-competitive tryhard","Casual, just for fun","Strategic planner","Clutch player under pressure","The team captain","The one who over-communicates","Silent but effective","Goes full chaos"] },
    { q: "What game genre is my comfort zone?", opts: ["Battle Royale","FPS / Tactical Shooter","Sports games","RPG / Open World","MOBA","Puzzle / Strategy","Indie / Story games","Retro and classic games"] },
    { q: "What do I do when a teammate is bad?", opts: ["Coach them patiently","Mute and move on","Carry them silently","Roast them (jokingly)","Leave the match","Get frustrated but stay","Switch my strategy","Depends on my mood"] },
    { q: "What's my gaming guilty pleasure?", opts: ["Spending on skins/cosmetics","Watching streams instead of playing","Replaying very old games","Playing on easy mode","Cheesing mechanics","Quitting when losing","Following meta blindly","Pretending I'm a pro"] },
    { q: "How many hours can I game in one session?", opts: ["1-2 hours max","3-4 hours comfortably","Until someone stops me","All day if no plans","Depends on the game","Short sessions, often","5-6 hours on weekends","What is sleep?"] },
    { q: "What gaming achievement am I most proud of?", opts: ["Hitting top rank","Completing a hard platinum","A clutch 1v4 moment","Finishing a long RPG","Beating a tough boss","Carrying a team to victory","Speedrunning something","Learning a hard mechanic"] },
    { q: "What's the first thing I do in a new game?", opts: ["Rush the main story","Explore every corner","Customize my character","Adjust all the settings","Watch a beginners guide","Jump in blind","Find all collectibles first","Read every item description"] },
    { q: "How do I feel about pay-to-win mechanics?", opts: ["I hate it passionately","I spend a little","I spend a lot honestly","It's just business","Ruins the game for me","Doesn't affect me","I complain but keep playing","I find workarounds"] },
  ],

  // ── 🎬 STORY MODE — narrative questions that build a movie together ─────
  story: [
    { q: "Our story takes place in…", opts: ["A futuristic city","A small mountain village","A tropical island","A haunted old mansion","Outer space","An enchanted forest","A bustling megacity","A post-apocalyptic wasteland"] },
    { q: "We meet for the first time at…", opts: ["A coffee shop","A music festival","A library","An airport","A rainy bus stop","A rooftop party","A hospital","A bookstore"] },
    { q: "The main conflict we face together is…", opts: ["A dangerous secret","A race against time","A forbidden love","A mysterious disappearance","A corporate conspiracy","A supernatural threat","A natural disaster","An impossible heist"] },
    { q: "Our biggest strength as a team is…", opts: ["We trust each other completely","We balance each other perfectly","We never give up","We're both highly skilled","We communicate without words","We're unpredictable","We inspire each other","We protect each other fiercely"] },
    { q: "The villain in our story is…", opts: ["A corrupt billionaire","A childhood friend turned enemy","An AI gone rogue","A jealous rival","A secret organization","A supernatural entity","Our own past mistakes","The system itself"] },
    { q: "When things get really dangerous, I…", opts: ["Step up and lead","Stay calm and strategize","Protect my partner at all costs","Use my unique skill","Run toward the danger","Try to negotiate","Look for a creative solution","Trust my gut instincts"] },
    { q: "The most emotional moment in our story is…", opts: ["Almost losing each other","A sudden betrayal","A sacrifice one of us makes","Discovering a hidden truth","A long-awaited reunion","An unexpected goodbye","Finally achieving our goal","Realizing what we mean to each other"] },
    { q: "Our story's setting feels most like…", opts: ["A Christopher Nolan film","A Studio Ghibli anime","A Marvel blockbuster","A Bollywood drama","A gritty thriller","A fairy tale","A sci-fi epic","A romantic comedy"] },
    { q: "The turning point where everything changes is…", opts: ["We discover the real enemy","One of us makes a huge mistake","We unlock a hidden power","A third person changes everything","We get separated and must find each other","The plan completely falls apart","We learn a devastating truth","Unexpected help arrives from nowhere"] },
    { q: "Our story ends with…", opts: ["A triumphant victory","A bittersweet sacrifice","A new beginning","A shocking twist","Peace and happiness","Leaving for a new adventure","Achieving the impossible","Love conquering everything"] },
    { q: "If our story became a movie, the soundtrack would be…", opts: ["Epic orchestral scores","Indie acoustic vibes","Intense electronic beats","Romantic Bollywood songs","Classic rock anthems","Emotional piano pieces","Hip-hop bangers","A mix of everything"] },
    { q: "The title card at the end would read…", opts: ["'And so the adventure continued...'","'Based on a true story'","'They lived happily ever after'","'The end is only the beginning'","'For everyone who never gave up'","'Some bonds are unbreakable'","'The legend lives on'","'To be continued...'"] },
  ],

  // ── GENERAL / MIXED ──────────────────────────────────────────────────────
  general: [
    { q: "What's my favorite food?", opts: ["Pizza","Biryani","Sushi","Burger","Tacos","Pasta","Noodles","Salad"] },
    { q: "What's my favorite movie genre?", opts: ["Action","Comedy","Romance","Horror","Sci-Fi","Thriller","Animation","Documentary"] },
    { q: "What's my favorite color?", opts: ["Red","Blue","Green","Purple","Black","Pink","Yellow","Orange"] },
    { q: "What's my favorite season?", opts: ["Spring","Summer","Monsoon","Winter"] },
    { q: "What's my favorite drink?", opts: ["Tea","Coffee","Juice","Water","Soda","Energy Drink","Smoothie","Lassi"] },
    { q: "What's my favorite sport?", opts: ["Cricket","Football","Basketball","Tennis","Badminton","Volleyball","Swimming","No Sports"] },
    { q: "What's my favorite music genre?", opts: ["Bollywood","Pop","Hip-Hop","Classical","Rock","EDM","Indie","K-Pop"] },
    { q: "What's my favorite social media?", opts: ["Instagram","YouTube","WhatsApp","Twitter/X","Snapchat","TikTok","LinkedIn","None"] },
    { q: "If I won ₹1 Crore, what would I do first?", opts: ["Travel the world","Invest it","Buy a house","Quit my job","Give to family","Start a business","Buy gadgets","Donate"] },
    { q: "If I had a free week with no responsibilities, I'd…", opts: ["Travel","Sleep all day","Binge shows","Hang with friends","Learn something new","Read books","Game nonstop","Do nothing"] },
    { q: "If I could have any superpower, I'd pick…", opts: ["Fly","Teleport","Time travel","Invisibility","Mind reading","Super strength","Healing","See the future"] },
    { q: "If I became invisible for a day, I'd…", opts: ["Spy on people","Prank friends","Rob a bank (jk)","Just sleep","Explore forbidden places","Attend secret meetings","Nothing, I'm ethical","Stalk my crush"] },
    { q: "If I had to eat one food forever, it'd be…", opts: ["Rice & Dal","Pizza","Biryani","Noodles","Maggi","Paneer","Chicken","Pasta"] },
    { q: "If I could live anywhere, I'd choose…", opts: ["India","USA","Europe","Japan","Dubai","Canada","Australia","Anywhere warm"] },
    { q: "What's my biggest fear?", opts: ["Failure","Loneliness","Death","Losing loved ones","Public embarrassment","Darkness","Heights","Rejection"] },
    { q: "What motivates me most in life?", opts: ["Money","Family","Passion","Fame","Freedom","Love","Knowledge","Purpose"] },
    { q: "What's my biggest life goal?", opts: ["Financial freedom","Happy family","Travel the world","Own a business","Make a difference","Find true love","Achieve mastery","Be healthy"] },
    { q: "How do I handle stress?", opts: ["Talk to someone","Sleep it off","Exercise","Eat comfort food","Watch shows","Listen to music","Overthink alone","Pray/meditate"] },
    { q: "What do I value most in a friend?", opts: ["Loyalty","Honesty","Fun","Support","Respect","Understanding","Humor","Availability"] },
    { q: "What's my communication style?", opts: ["Direct & blunt","Soft & careful","Avoid conflict","Sarcastic","Funny","Overthink before speaking","Loud & expressive","Quiet observer"] },
    { q: "What would I do if I saw a cockroach?", opts: ["Scream & run","Bravely kill it","Call someone else","Ignore it","Trap & release","Cry","Record a video","Move out"] },
    { q: "What's my guilty pleasure?", opts: ["Eating junk at night","Binge watching","Shopping sprees","Stalking old posts","Singing badly","Napping too much","Mindless scrolling","Karaoke alone"] },
    { q: "If I were a dog, I'd be…", opts: ["Hyperactive puppy","Lazy bulldog","Loyal golden retriever","Dramatic poodle","Chaotic husky","Tiny chihuahua","Smart border collie","Chill labrador"] },
    { q: "What's my most annoying habit?", opts: ["Late replies","Always late","Overthinking","Talking too much","Being too quiet","Forgetting things","Changing plans","Eating your food"] },
    { q: "If I was a meme, which one would I be?", opts: ["Distracted boyfriend","Hide the pain Harold","Doge","Crying cat","This is fine dog","Surprised Pikachu","Buff Doge","Grumpy cat"] },
    { q: "Who apologizes first after a fight?", opts: ["Always me","Always them","Whoever was wrong","Neither — we just move on","Depends on the fight","We apologize together","After days of silence","We never fight"] },
    { q: "How do I behave when I'm angry?", opts: ["Go silent","Yell and express","Cry","Pretend everything is fine","Leave the room","Send long texts","Overthink for hours","Work it out"] },
    { q: "What's my sleep schedule?", opts: ["Early bird (before 10pm)","Night owl (after 2am)","Normal (11pm-ish)","Depends on what I'm watching","I don't have a schedule","10pm-ish","Midnight exactly","Whenever I crash"] },
    { q: "What's my personality type?", opts: ["Introvert","Extrovert","Ambivert","Depends on the crowd","Introvert online, extrovert IRL","Extrovert online, introvert IRL","I genuinely don't know","Changes by the day"] },
    { q: "How would I spend a rainy day?", opts: ["Read a book","Watch movies all day","Cook something warm","Call friends to chat","Go outside and enjoy the rain","Sleep through it","Journal and think","Clean my room"] },
    { q: "What's my go-to comfort food?", opts: ["Maggi / instant noodles","Ice cream","Dal chawal","Pizza","Biryani","Chai and biscuits","Chocolate","Whatever's in the fridge"] },
    { q: "What's my phone screen time like?", opts: ["Under 3 hours — disciplined","3-5 hours — average","5-7 hours — honestly too much","7+ hours — my phone is my life","I'm scared to check","I have screen time limits set","Depends on the day","Mostly productive stuff"] },
    { q: "What app do I use most?", opts: ["Instagram","YouTube","WhatsApp","Twitter/X","Snapchat","TikTok","Spotify","A game"] },
    { q: "What's my productivity style?", opts: ["To-do lists and planning","Go with the flow","Sprint then crash","Steady all day","Only under pressure","Morning person all tasks","Evening/night focus","I'm still figuring it out"] },
    { q: "If I could master one skill instantly, it'd be…", opts: ["A musical instrument","A new language","Cooking gourmet food","Coding","Public speaking","Drawing/design","A sport","Speed reading"] },
    { q: "How do I make decisions?", opts: ["Logic and pros/cons list","Follow my gut","Ask everyone around me","Sleep on it","Make the decision fast","Overthink until forced","Research extensively","Flip a coin (sometimes)"] },
    { q: "What's my relationship with mornings?", opts: ["I love mornings","I hate mornings passionately","It depends on the day","I love them once I'm up","I need 30 min to become human","I'm fine with them","Mornings are okay I guess","I'm a morning person secretly"] },
    { q: "What would I do on a 3-day solo trip?", opts: ["Full itinerary and sightseeing","Absolute relaxation and nothing","Mix of explore and rest","Go wherever the day takes me","Find local food spots","Journal and reflect","Explore one area deeply","I'd bring someone anyway"] },
    { q: "What type of humor do I have?", opts: ["Dark and dry","Sarcastic","Silly and goofy","Witty and clever","Pun-based","Self-deprecating","Situational","I'm the one who doesn't get jokes"] },
    { q: "What's my attitude toward money?", opts: ["Saver — always investing","Spender — money is for enjoying","Balance of both","Shop therapy is real","Money-anxious always","Generous to a fault","Only spend on experiences","Working on being better with it"] },
    { q: "What's my definition of success?", opts: ["Financial independence","Happy healthy relationships","Making an impact","Freedom to do what I love","Career achievement","Work-life balance","Inner peace and contentment","All of the above, honestly"] },
    { q: "What do I do when I'm bored?", opts: ["Scroll social media","Watch YouTube","Call someone","Eat something","Start a new hobby","Clean/organize things","Overthink life","Look for something new to learn"] },
    { q: "What's my weekend morning routine?", opts: ["Sleep in as long as possible","Wake up same time as weekdays","Slowly wake up with tea/coffee","Gym or workout first","Cook a proper breakfast","Scroll phone in bed for an hour","Read or journal","Immediately check notifications"] },
    { q: "How do I feel about surprises?", opts: ["Love them completely","Hate them — I like to know","Mixed feelings depending on surprise","Only like good surprises","I like planning them for others","They make me anxious","I pretend I don't like them","I love the idea but get nervous"] },
    { q: "What would I bring to a desert island?", opts: ["My phone with unlimited battery","A book or kindle","A person I love","Music player","Notebook and pen","Survival tools","Comfort food stash","I'd figure it out"] },
    { q: "What kind of traveller am I?", opts: ["Plan every detail in advance","Fully spontaneous, figure it out","Mix of plan + flexibility","One destination, explore deeply","Hop between places fast","Luxury all the way","Budget backpacker","I don't travel much yet"] },
  ],

  // ── GUESS MODE — open ended, no options ─────────────────────────────────
  guess: [
    "What is my favorite food?",
    "What is my favorite movie?",
    "What is my favorite song or artist?",
    "What is my dream vacation destination?",
    "Who is my favorite celebrity?",
    "What is my biggest fear?",
    "What is my biggest goal in life?",
    "What is my favorite hobby?",
    "What is my favorite childhood memory?",
    "What is my favorite animal?",
    "What is my most used app?",
    "What is my favorite game?",
    "What is my dream job?",
    "What is my most annoying habit?",
    "What does my perfect weekend look like?",
    "What is my favorite season?",
    "What is my favorite drink?",
    "What was my favorite subject in school?",
    "What is my favorite childhood cartoon?",
    "What word describes me best?",
    "What would I do with one free day?",
    "What is my go-to comfort food?",
    "What sport or activity do I wish I was better at?",
    "What is my biggest accomplishment so far?",
    "What is something I want to learn in the next year?",
  ],
};

// ── RELATIONSHIP → QUESTION BANK MAPPING ────────────────────────────────────
function getRelationshipKey(relationship) {
  if (!relationship) return 'general';
  const r = relationship.toLowerCase();
  if (r.includes('couple') && !r.includes('long')) return 'couple';
  if (r.includes('long distance') || r.includes('long dist')) return 'longdistance';
  if (r.includes('best friend') || r.includes('bff')) return 'bestfriends';
  if (r.includes('family')) return 'family';
  if (r.includes('class') || r.includes('school')) return 'classmates';
  if (r.includes('work') || r.includes('cowork')) return 'coworkers';
  if (r.includes('gaming') || r.includes('game')) return 'gaming';
  return 'general';
}

// ── SMART QUESTION SELECTION ─────────────────────────────────────────────────
function selectQuestions(relationship, count, isStory) {
  if (isStory) {
    return shuffleArray(QUESTION_BANKS.story).slice(0, Math.min(count, QUESTION_BANKS.story.length));
  }

  const key = getRelationshipKey(relationship);
  const specificBank = QUESTION_BANKS[key] || [];
  const generalBank  = QUESTION_BANKS.general;

  const allStandardBanks = [
    ...QUESTION_BANKS.couple,
    ...QUESTION_BANKS.longdistance,
    ...QUESTION_BANKS.bestfriends,
    ...QUESTION_BANKS.family,
    ...QUESTION_BANKS.classmates,
    ...QUESTION_BANKS.coworkers,
    ...QUESTION_BANKS.gaming,
    ...QUESTION_BANKS.general,
  ];

  let specificCount = Math.ceil(count * 0.7);
  let generalCount  = count - specificCount;

  if (specificBank.length < specificCount) {
    specificCount = specificBank.length;
    generalCount  = count - specificCount;
  }

  const specificShuffled = shuffleArray(specificBank).slice(0, specificCount);
  const generalShuffled  = shuffleArray(generalBank).slice(0, generalCount);

  let combined = shuffleArray([...specificShuffled, ...generalShuffled]);
  if (combined.length < count) {
    const extra = shuffleArray(allStandardBanks)
      .filter(q => !combined.some(c => c.q === q.q))
      .slice(0, count - combined.length);
    combined = [...combined, ...extra];
  }

  return combined.slice(0, count);
}

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

// ═══════════════════════════════════════════════════════════════════════════
//  SMART MATCHING (Guess Mode)
// ═══════════════════════════════════════════════════════════════════════════
function normalizeAnswer(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function answersMatch(a, b) {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (na === nb) return true;
  if (na.length > 3 && nb.includes(na)) return true;
  if (nb.length > 3 && na.includes(nb)) return true;
  const synonyms = [
    ['burger','hamburger'],
    ['biryani','biriyani'],
    ['soda','cold drink','cold drinks','soft drink'],
    ['tv','television'],
    ['films','movies','film','movie'],
    ['songs','music','song'],
    ['dogs','dog'],
    ['cats','cat'],
    ['football','soccer'],
    ['cricket','cricket game'],
    ['mom','mother','mum','mama'],
    ['dad','father','papa','dada'],
  ];
  for (const group of synonyms) {
    if (group.includes(na) && group.includes(nb)) return true;
  }
  return false;
}

function answersCloseMatch(a, b) {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (na === nb) return false;
  if (na.length > 2 && nb.includes(na)) return true;
  if (nb.length > 2 && na.includes(nb)) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODE CONFIG — PREDICTION IS PRIMARY SCORING
// ═══════════════════════════════════════════════════════════════════════════
function getModeConfig(mode) {
  // SCORING PHILOSOPHY:
  //   Prediction accuracy = PRIMARY (+10 correct, +5 very close)
  //   Matching answers    = BONUS ONLY (+2)
  const configs = {
    quick: {
      questionCount:    5,
      revealDuration:   5000,
      lives:            null,
      pointsPerPredict: 10,
      pointsClosePredict: 5,
      pointsPerMatch:   2,   // Bonus only
      pointsForBeingGuessed: 0,
      label: '⚡ Quick Match',
      isGuess: false,
      isStory: false,
    },
    standard: {
      questionCount:    20,
      revealDuration:   5000,
      lives:            null,
      pointsPerPredict: 10,
      pointsClosePredict: 5,
      pointsPerMatch:   2,
      pointsForBeingGuessed: 0,
      label: '🎯 Standard',
      isGuess: false,
      isStory: false,
    },
    guess: {
      questionCount:    15,
      revealDuration:   5000,
      lives:            null,
      pointsPerPredict: 10,
      pointsClosePredict: 5,
      pointsPerMatch:   2,
      pointsForBeingGuessed: 3,
      label: '📝 Guess Mode',
      isGuess: true,
      isStory: false,
    },
    survival: {
      questionCount:    15,
      revealDuration:   4000,
      lives:            3,
      pointsPerPredict: 15,
      pointsClosePredict: 7,
      pointsPerMatch:   2,
      pointsForBeingGuessed: 0,
      label: '💀 Survival',
      isGuess: false,
      isStory: false,
    },
    ultimate: {
      questionCount:    50,
      revealDuration:   5000,
      lives:            null,
      pointsPerPredict: 10,
      pointsClosePredict: 5,
      pointsPerMatch:   2,
      pointsForBeingGuessed: 0,
      label: '👑 Ultimate Match',
      isGuess: false,
      isStory: false,
    },
    story: {
      questionCount:    12,
      revealDuration:   5000,
      lives:            null,
      pointsPerPredict: 10,
      pointsClosePredict: 5,
      pointsPerMatch:   2,
      pointsForBeingGuessed: 0,
      label: '🎬 Story Mode',
      isGuess: false,
      isStory: true,
    },
  };
  return configs[mode] || configs.standard;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCORE CALCULATION — Prediction-FIRST, matching is bonus only
// ═══════════════════════════════════════════════════════════════════════════
function calculateScores(room) {
  let p1Score = 0, p2Score = 0;
  let matchCount = 0;
  let p1PredictCorrectCount = 0;
  let p2PredictCorrectCount = 0;
  let p1PredictCloseCount = 0;
  let p2PredictCloseCount = 0;
  let p1Streak = 0, p2Streak = 0;
  let p1BestStreak = 0, p2BestStreak = 0;
  const results = [];
  const cfg = room.config;
  const isGuess = cfg.isGuess;

  room.answers.forEach((round, idx) => {
    const q = room.questions[idx];
    const { p1Answer, p1Predict, p2Answer, p2Predict } = round;

    const p1Correct = isGuess
      ? answersMatch(p1Predict, p2Answer)
      : (p1Predict === p2Answer);
    const p2Correct = isGuess
      ? answersMatch(p2Predict, p1Answer)
      : (p2Predict === p1Answer);

    const p1Close = !p1Correct && !isGuess && answersCloseMatch(p1Predict, p2Answer);
    const p2Close = !p2Correct && !isGuess && answersCloseMatch(p2Predict, p1Answer);

    const ansMatch = isGuess
      ? answersMatch(p1Answer, p2Answer)
      : (p1Answer === p2Answer);

    // PRIMARY: Prediction scoring
    if (p1Correct) {
      p1Score += cfg.pointsPerPredict;
      p1PredictCorrectCount++;
      p1Streak++;
      if (p1Streak > p1BestStreak) p1BestStreak = p1Streak;
    } else if (p1Close) {
      p1Score += cfg.pointsClosePredict;
      p1PredictCloseCount++;
      p1Streak = 0;
    } else {
      p1Streak = 0;
    }

    if (p2Correct) {
      p2Score += cfg.pointsPerPredict;
      p2PredictCorrectCount++;
      p2Streak++;
      if (p2Streak > p2BestStreak) p2BestStreak = p2Streak;
    } else if (p2Close) {
      p2Score += cfg.pointsClosePredict;
      p2PredictCloseCount++;
      p2Streak = 0;
    } else {
      p2Streak = 0;
    }

    // BONUS ONLY: Matching answers (+2 each)
    if (ansMatch) {
      p1Score += cfg.pointsPerMatch;
      p2Score += cfg.pointsPerMatch;
      matchCount++;
    }

    // Guess Mode: bonus for being guessed
    if (isGuess && cfg.pointsForBeingGuessed) {
      if (p1Correct) p2Score += cfg.pointsForBeingGuessed;
      if (p2Correct) p1Score += cfg.pointsForBeingGuessed;
    }

    const qText = isGuess ? q : q.q;
    results.push({
      question: qText,
      p1Answer, p2Answer,
      p1Predict, p2Predict,
      p1Correct, p2Correct,
      p1Close, p2Close,
      match: ansMatch,
    });
  });

  const total = room.answers.length;

  // Compatibility = % matching answers (secondary, bonus only)
  const compatibility = total > 0 ? Math.round((matchCount / total) * 100) : 0;

  // PREDICTION ACCURACY = PRIMARY metric
  const p1Understanding = total > 0 ? Math.round(p1PredictCorrectCount / total * 100) : 0;
  const p2Understanding = total > 0 ? Math.round(p2PredictCorrectCount / total * 100) : 0;

  const trust         = Math.min(100, Math.round((p1Understanding + p2Understanding) / 2 + Math.random() * 8 - 4));
  const communication = Math.min(100, Math.round(compatibility * 0.7 + (p1Understanding + p2Understanding) / 2 * 0.3 + Math.random() * 10));
  const humor         = Math.min(100, Math.round(Math.random() * 20 + 75));

  // Mind reading score = average prediction accuracy
  const mindReadingScore = Math.round((p1Understanding + p2Understanding) / 2);
  const bestPredictStreak = Math.max(p1BestStreak, p2BestStreak);

  function getTitle(accuracy) {
    if (accuracy >= 100) return "🧠 Telepathic!";
    if (accuracy >= 90)  return "🔮 Mind Readers";
    if (accuracy >= 75)  return "✨ Soul Readers";
    if (accuracy >= 60)  return "🏆 Perfect Duo";
    if (accuracy >= 45)  return "💫 Good Connection";
    if (accuracy >= 30)  return "🌱 Getting There";
    if (accuracy >= 15)  return "🌀 Strangers With History";
    return "👀 Do You Even Know Them?";
  }

  const avgAccuracy = Math.round((p1Understanding + p2Understanding) / 2);

  // ── Story Mode movie generation data ────────────────────────────────────
  let storyExtras = null;
  if (room.config.isStory) {
    storyExtras = buildStoryData(room, results, p1Understanding, p2Understanding);
  }

  // Guess extras
  let guessExtras = null;
  if (isGuess) {
    const bestMatches  = results.filter(r => r.match).slice(0, 5);
    const diffAnswers  = results.filter(r => !r.match).slice(0, 5);
    const correctPreds = results.filter(r => r.p1Correct || r.p2Correct).length;
    guessExtras = {
      p1Accuracy: p1Understanding,
      p2Accuracy: p2Understanding,
      correctPredictions: correctPreds,
      bestMatches,
      diffAnswers,
    };
  }

  // Ultimate extras
  let ultimateExtras = null;
  if (room.mode === 'ultimate') {
    const strongMatches = results.filter(r => r.match).slice(0, 5);
    const weakMatches   = results.filter(r => !r.match).slice(0, 5);
    const relationshipScore = Math.min(100, Math.round((compatibility * 0.4 + p1Understanding * 0.3 + p2Understanding * 0.3)));
    ultimateExtras = {
      strongMatches,
      weakMatches,
      p1Accuracy: p1Understanding,
      p2Accuracy: p2Understanding,
      relationshipScore,
    };
  }

  return {
    p1Score, p2Score,
    compatibility,
    trust, communication, humor,
    matchCount, total,
    results,
    title: getTitle(avgAccuracy),
    p1Understanding, p2Understanding,
    mindReadingScore,
    bestPredictStreak,
    p1BestStreak, p2BestStreak,
    p1PredictCorrectCount, p2PredictCorrectCount,
    p1PredictCloseCount, p2PredictCloseCount,
    ultimateExtras, guessExtras, storyExtras,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  STORY MODE: Build movie data from answers
// ═══════════════════════════════════════════════════════════════════════════
function buildStoryData(room, results, p1Acc, p2Acc) {
  const p1Name = room.players.p1.nickname;
  const p2Name = room.players.p2.nickname;

  // Extract answers to key story questions
  const answers = {};
  results.forEach((r, i) => {
    const q = room.questions[i];
    if (q && q.q) {
      answers[q.q] = { p1: r.p1Answer, p2: r.p2Answer };
    }
  });

  // Derive movie elements from answers
  const settingQ    = Object.entries(answers).find(([k]) => k.includes('takes place'));
  const conflictQ   = Object.entries(answers).find(([k]) => k.includes('conflict'));
  const endingQ     = Object.entries(answers).find(([k]) => k.includes('ends with'));
  const styleQ      = Object.entries(answers).find(([k]) => k.includes('feels most like'));
  const strengthQ   = Object.entries(answers).find(([k]) => k.includes('strength'));
  const villainQ    = Object.entries(answers).find(([k]) => k.includes('villain'));
  const emotionalQ  = Object.entries(answers).find(([k]) => k.includes('emotional moment'));
  const soundtrackQ = Object.entries(answers).find(([k]) => k.includes('soundtrack'));

  const setting    = settingQ    ? (settingQ[1].p1 || settingQ[1].p2)       : 'A mysterious world';
  const conflict   = conflictQ   ? (conflictQ[1].p1 || conflictQ[1].p2)     : 'An unknown threat';
  const ending     = endingQ     ? (endingQ[1].p1 || endingQ[1].p2)         : 'A new beginning';
  const style      = styleQ      ? (styleQ[1].p1 || styleQ[1].p2)           : 'A cinematic epic';
  const strength   = strengthQ   ? (strengthQ[1].p1 || strengthQ[1].p2)     : 'Unbreakable trust';
  const villain    = villainQ    ? (villainQ[1].p1 || villainQ[1].p2)       : 'A hidden enemy';
  const emotional  = emotionalQ  ? (emotionalQ[1].p1 || emotionalQ[1].p2)   : 'An unexpected sacrifice';
  const soundtrack = soundtrackQ ? (soundtrackQ[1].p1 || soundtrackQ[1].p2) : 'A powerful score';

  // Generate movie title from names + conflict
  const titleTemplates = [
    `${p1Name.toUpperCase()} & ${p2Name.toUpperCase()}`,
    `THE LAST ${conflict.split(' ').pop().toUpperCase()}`,
    `${setting.split(' ').slice(-1)[0].toUpperCase()} OF NO RETURN`,
    `BEYOND ${setting.split(' ').slice(-1)[0].toUpperCase()}`,
    `THE ${p1Name.toUpperCase()} PROTOCOL`,
    `UNBREAKABLE`,
    `TOGETHER FOREVER`,
    `THROUGH THE ${setting.split(' ').slice(-1)[0].toUpperCase()}`,
  ];
  const movieTitle = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];

  // Determine genre from style
  let genre = 'Action/Adventure';
  if (style.includes('Ghibli') || style.includes('Anime'))       genre = 'Animated Fantasy';
  else if (style.includes('Marvel'))                              genre = 'Superhero Action';
  else if (style.includes('Bollywood'))                          genre = 'Romantic Drama';
  else if (style.includes('Nolan'))                              genre = 'Psychological Thriller';
  else if (style.includes('Pixar'))                              genre = 'Animated Adventure';
  else if (style.includes('romantic comedy'))                    genre = 'Romantic Comedy';
  else if (style.includes('thriller') || style.includes('gritty')) genre = 'Action Thriller';
  else if (style.includes('sci-fi') || style.includes('epic'))   genre = 'Sci-Fi Epic';
  else if (style.includes('fairy tale'))                         genre = 'Fantasy Romance';

  // Build story narrative
  const story = `${p1Name} and ${p2Name}'s story unfolds ${setting.toLowerCase()}. ` +
    `United by ${strength.toLowerCase()}, they face ${conflict.toLowerCase()}. ` +
    `Their greatest enemy: ${villain.toLowerCase()}. ` +
    `The most unforgettable moment comes when ${emotional.toLowerCase()}. ` +
    `With a soundtrack of ${soundtrack.toLowerCase()}, their journey ends with ${ending.toLowerCase()}.`;

  // Character analysis
  const p1Trait = p1Acc >= 75 ? 'the intuitive one — deeply perceptive' : p1Acc >= 50 ? 'the steady one — reliable under pressure' : 'the wildcard — full of surprises';
  const p2Trait = p2Acc >= 75 ? 'the intuitive one — deeply perceptive' : p2Acc >= 50 ? 'the steady one — reliable under pressure' : 'the wildcard — full of surprises';

  const characterAnalysis = `${p1Name} is ${p1Trait}. ${p2Name} is ${p2Trait}. Together they form a ${genre.toLowerCase()} duo whose chemistry is felt in every scene.`;

  // Movie ending detail
  const endingDetail = ending.includes('triumphant') ? `${p1Name} and ${p2Name} emerge victorious, their bond stronger than ever.`
    : ending.includes('bittersweet') ? `One sacrifice changes everything. The cost of victory is something neither expected.`
    : ending.includes('new beginning') ? `The credits roll on one chapter, but a new adventure is just beginning.`
    : ending.includes('twist') ? `Nothing is as it seemed. The final revelation changes the meaning of everything that came before.`
    : ending.includes('love') ? `In the end, love was the only weapon that mattered.`
    : `Their story doesn't end — it evolves into something neither could have imagined alone.`;

  // Build poster prompt (7 style variants)
  const posterPrompts = buildPosterPrompts(movieTitle, genre, p1Name, p2Name, setting, conflict, style, ending);

  return {
    movieTitle,
    genre,
    story,
    characterAnalysis,
    endingDetail,
    setting,
    conflict,
    ending,
    style,
    strength,
    villain,
    emotional,
    soundtrack,
    posterPrompts,
    p1Accuracy: p1Acc,
    p2Accuracy: p2Acc,
  };
}

function buildPosterPrompts(title, genre, p1Name, p2Name, setting, conflict, style, ending) {
  const base = `Two protagonists named ${p1Name} and ${p2Name}, movie poster for "${title}", ${genre} film`;
  const settingDesc = setting.toLowerCase().replace('a ', '').replace('an ', '');
  const endingMood = ending.toLowerCase().includes('triumph') || ending.toLowerCase().includes('love') ? 'hopeful warm golden light' : 'dramatic tense atmosphere';

  return {
    hollywood: `Cinematic Hollywood movie poster, ${base}, ${settingDesc} backdrop, dramatic lighting, ${endingMood}, ultra-realistic, photorealistic, 8K resolution, professional movie poster design, two heroic figures standing back to back, title "${title}" in bold metallic letters, tagline "Some bonds are unbreakable", anamorphic lens flare, epic composition, Oscar-worthy cinematography`,

    anime: `Anime-style movie poster, ${base}, ${settingDesc} background, vibrant saturated colors, dynamic action poses, Studio Ghibli inspired aesthetics, cel-shaded illustration, flowing hair, expressive eyes, dramatic sky with clouds, title "${title}" in stylized Japanese-English font, cherry blossoms or dramatic weather effects, deeply emotional atmosphere`,

    marvel: `Marvel Cinematic Universe style movie poster, ${base}, superhero aesthetic, dynamic power poses, ${settingDesc} destroyed background, electric visual effects, bold primary colors, heroic lighting from below, title "${title}" in MCU font style, action-packed composition, glowing energy effects, dramatic storm clouds, Avengers-level epic scale`,

    pixar: `Pixar animation style movie poster, ${base}, adorable stylized characters with big expressive eyes, colorful whimsical ${settingDesc} environment, warm soft lighting, charming and heartwarming atmosphere, title "${title}" in playful rounded font, magical sparkles and glowing elements, family-friendly adventure feel, beautifully rendered 3D animation aesthetic`,

    bollywood: `Bollywood movie poster style, ${base}, vibrant rich colors, ornate decorative borders, ${settingDesc} dramatic background, romantic dramatic lighting, both characters in stylish outfits, title "${title}" in colorful Devanagari-inspired decorative font, rose petals and dramatic fabric, emotional intense expressions, classic Indian cinema grandeur`,

    cyberpunk: `Cyberpunk neon-noir movie poster, ${base}, futuristic dystopian ${settingDesc} cityscape, neon pink and cyan lighting, rain-soaked reflective surfaces, holographic billboards, dark atmospheric shadows, title "${title}" in glowing neon letters, retrofuturistic aesthetic, blade runner vibes, high contrast dramatic shadows, 4K hyperdetailed render`,

    fantasy: `Epic fantasy movie poster, ${base}, magical ${settingDesc} landscape, dragons or mystical creatures in background, glowing runes and magical effects, enchanted golden hour lighting, characters in fantasy armor or robes, title "${title}" in ancient stone-carved font with glowing details, misty mountains and magical forests, Lord of the Rings level epic grandeur, painterly illustration style`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HELPER: destroy room
// ═══════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════
//  SOCKET.IO
// ═══════════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── CREATE ROOM ──────────────────────────────────────────────────────────
  socket.on('create_room', ({ nickname, mode, relationship }) => {
    const code = generateRoomCode();
    const cfg  = getModeConfig(mode);

    let questions;
    if (cfg.isGuess) {
      questions = shuffleArray(QUESTION_BANKS.guess).slice(0, cfg.questionCount);
    } else if (cfg.isStory) {
      questions = selectQuestions(relationship, cfg.questionCount, true);
    } else {
      questions = selectQuestions(relationship, cfg.questionCount, false);
    }

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
    socket.emit('room_created', {
      code, nickname, mode, relationship,
      questionCount: cfg.questionCount,
      modeLabel: cfg.label,
    });
    console.log(`[Room] Created: ${code} by ${nickname} mode=${mode} rel=${relationship}`);
  });

  // ── JOIN ROOM ────────────────────────────────────────────────────────────
  socket.on('join_room', ({ code, nickname }) => {
    const room = rooms.get(code);
    if (!room)                    { socket.emit('error', { msg: 'Room not found. Check the code!' }); return; }
    if (room.state !== 'waiting') { socket.emit('error', { msg: 'Game already started!' });           return; }
    if (room.players.p2)          { socket.emit('error', { msg: 'Room is full!' });                   return; }

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

  // ── QUICK MATCH ──────────────────────────────────────────────────────────
  socket.on('quick_match', ({ nickname, mode }) => {
    const safeMode = modeQueues[mode] ? mode : 'standard';
    const queue    = modeQueues[safeMode];
    const cfg      = getModeConfig(safeMode);

    for (let i = queue.length - 1; i >= 0; i--) {
      if (!io.sockets.sockets.get(queue[i].id)) queue.splice(i, 1);
    }

    if (queue.length > 0) {
      const partner   = queue.shift();
      const code      = generateRoomCode();
      const questions = cfg.isGuess
        ? shuffleArray(QUESTION_BANKS.guess).slice(0, cfg.questionCount)
        : cfg.isStory
          ? selectQuestions('story', cfg.questionCount, true)
          : selectQuestions('🌍 Strangers', cfg.questionCount, false);

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
      socketRoom.set(socket.id, code);

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
      socket.emit('quick_match_waiting', {
        msg:       'Searching for a ' + cfg.label + ' match...',
        mode:      safeMode,
        modeLabel: cfg.label,
      });
    }
  });

  socket.on('cancel_quick_match', () => {
    for (const q of Object.values(modeQueues)) {
      const idx = q.findIndex(p => p.id === socket.id);
      if (idx !== -1) { q.splice(idx, 1); break; }
    }
  });

  // ── SUBMIT ANSWER (standard modes) ──────────────────────────────────────
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

  // ── GUESS MODE: Phase 1 ──────────────────────────────────────────────────
  socket.on('guess_submit_answer', ({ answer }) => {
    const code = socketRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || !room.config.isGuess) return;
    if (room.state !== 'guess_answer') return;

    const qIdx = room.currentQ;
    if (!room.answers[qIdx]) room.answers[qIdx] = {};

    const isP1 = room.players.p1.id === socket.id;
    const cleanAnswer = (answer || '').trim().slice(0, 100);

    if (isP1) {
      if (room.answers[qIdx].p1Answer !== undefined) return;
      room.answers[qIdx].p1Answer = cleanAnswer;
    } else {
      if (room.answers[qIdx].p2Answer !== undefined) return;
      room.answers[qIdx].p2Answer = cleanAnswer;
    }

    socket.to(code).emit('guess_partner_answered');

    const ans = room.answers[qIdx];
    if (ans.p1Answer !== undefined && ans.p2Answer !== undefined) {
      room.state = 'guess_predict';
      io.to(code).emit('guess_predict_phase', {
        index:    qIdx,
        total:    room.questions.length,
        question: room.questions[qIdx],
        p1Name:   room.players.p1.nickname,
        p2Name:   room.players.p2.nickname,
        p1Score:  room.players.p1.score,
        p2Score:  room.players.p2.score,
      });
    }
  });

  // ── GUESS MODE: Phase 2 ──────────────────────────────────────────────────
  socket.on('guess_submit_predict', ({ predict }) => {
    const code = socketRoom.get(socket.id);
    const room = rooms.get(code);
    if (!room || !room.config.isGuess) return;
    if (room.state !== 'guess_predict') return;

    const qIdx = room.currentQ;
    const isP1 = room.players.p1.id === socket.id;
    const cleanPredict = (predict || '').trim().slice(0, 100);

    if (isP1) {
      if (room.answers[qIdx].p1Predict !== undefined) return;
      room.answers[qIdx].p1Predict = cleanPredict;
    } else {
      if (room.answers[qIdx].p2Predict !== undefined) return;
      room.answers[qIdx].p2Predict = cleanPredict;
    }

    socket.to(code).emit('guess_partner_predicted');

    const ans = room.answers[qIdx];
    if (ans.p1Predict !== undefined && ans.p2Predict !== undefined) {
      revealAnswer(code);
    }
  });

  // ── LEAVE MATCH ──────────────────────────────────────────────────────────
  socket.on('leave_match', () => {
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
    for (const q of Object.values(modeQueues)) {
      const idx = q.findIndex(p => p.id === socket.id);
      if (idx !== -1) { q.splice(idx, 1); break; }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════════════════════════════════════════════════
function startGame(code) {
  const room = rooms.get(code);
  if (!room) return;
  room.state = 'countdown';

  io.to(code).emit('game_start_config', {
    mode:          room.mode,
    modeLabel:     room.config.label,
    lives:         room.config.lives,
    questionCount: room.config.questionCount,
    isGuess:       room.config.isGuess || false,
    isStory:       room.config.isStory || false,
  });

  io.to(code).emit('game_countdown', { count: 3 });
  let count = 3;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(code).emit('game_countdown', { count });
    } else {
      clearInterval(interval);
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
  room.answers[qIdx] = {};

  if (room.config.isGuess) {
    room.state = 'guess_answer';
    io.to(code).emit('guess_question', {
      index:     qIdx,
      total:     room.questions.length,
      question:  q,
      mode:      room.mode,
      modeLabel: room.config.label,
      p1Name:    room.players.p1.nickname,
      p2Name:    room.players.p2.nickname,
      p1Score:   room.players.p1.score,
      p2Score:   room.players.p2.score,
    });
  } else {
    const opts = shuffleArray(q.opts);
    room.state = 'question';
    io.to(code).emit('question', {
      index:     qIdx,
      total:     room.questions.length,
      question:  q.q,
      options:   opts,
      mode:      room.mode,
      modeLabel: room.config.label,
      p1Name:    room.players.p1.nickname,
      p2Name:    room.players.p2.nickname,
      p1Score:   room.players.p1.score,
      p2Score:   room.players.p2.score,
      p1Lives:   room.players.p1.lives,
      p2Lives:   room.players.p2.lives,
    });
  }
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

  const p1PredictCorrect = cfg.isGuess
    ? answersMatch(ans.p1Predict, ans.p2Answer)
    : (ans.p1Predict === ans.p2Answer);
  const p2PredictCorrect = cfg.isGuess
    ? answersMatch(ans.p2Predict, ans.p1Answer)
    : (ans.p2Predict === ans.p1Answer);
  const p1Close = !p1PredictCorrect && !cfg.isGuess && answersCloseMatch(ans.p1Predict, ans.p2Answer);
  const p2Close = !p2PredictCorrect && !cfg.isGuess && answersCloseMatch(ans.p2Predict, ans.p1Answer);
  const isAnswerMatch = cfg.isGuess
    ? answersMatch(ans.p1Answer, ans.p2Answer)
    : (ans.p1Answer === ans.p2Answer);

  // Apply scores in real-time — PREDICTION PRIMARY
  if (p1PredictCorrect)  room.players.p1.score += cfg.pointsPerPredict;
  else if (p1Close)      room.players.p1.score += cfg.pointsClosePredict;
  if (p2PredictCorrect)  room.players.p2.score += cfg.pointsPerPredict;
  else if (p2Close)      room.players.p2.score += cfg.pointsClosePredict;

  // Matching bonus only (+2)
  if (isAnswerMatch) {
    room.players.p1.score += cfg.pointsPerMatch;
    room.players.p2.score += cfg.pointsPerMatch;
  }
  if (cfg.isGuess && cfg.pointsForBeingGuessed) {
    if (p1PredictCorrect) room.players.p2.score += cfg.pointsForBeingGuessed;
    if (p2PredictCorrect) room.players.p1.score += cfg.pointsForBeingGuessed;
  }

  // Survival lives
  let p1Eliminated = false;
  let p2Eliminated = false;
  if (cfg.lives !== null) {
    if (!p1PredictCorrect && !p1Close) room.players.p1.lives = Math.max(0, room.players.p1.lives - 1);
    if (!p2PredictCorrect && !p2Close) room.players.p2.lives = Math.max(0, room.players.p2.lives - 1);
    p1Eliminated = room.players.p1.lives <= 0;
    p2Eliminated = room.players.p2.lives <= 0;
  }

  const qText = cfg.isGuess ? q : q.q;
  const ppLabel = cfg.lives !== null ? '+15' : '+10';

  io.to(code).emit('reveal', {
    index:    qIdx,
    question: qText,
    p1Answer:  ans.p1Answer,
    p2Answer:  ans.p2Answer,
    p1Predict: ans.p1Predict,
    p2Predict: ans.p2Predict,
    p1PredictCorrect,
    p2PredictCorrect,
    p1Close, p2Close,
    p1Name:  room.players.p1.nickname,
    p2Name:  room.players.p2.nickname,
    p1Score: room.players.p1.score,
    p2Score: room.players.p2.score,
    p1Lives: room.players.p1.lives,
    p2Lives: room.players.p2.lives,
    match:   isAnswerMatch,
    mode:    room.mode,
    revealDuration: cfg.revealDuration,
    isGuess: cfg.isGuess || false,
    ppLabel,
    // PATCH: explicitly flag what is primary vs bonus
    predictionIsPrimary: true,
    matchIsBonus: true,
  });

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
    p1Name:    room.players.p1.nickname,
    p2Name:    room.players.p2.nickname,
    mode:      room.mode,
    modeLabel: room.config.label,
    relationship: room.relationship,
    isStory:   room.config.isStory || false,
  });

  setTimeout(() => rooms.delete(code), 600000);
}

// ═══════════════════════════════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════════════════════════════
const totalQCount = Object.entries(QUESTION_BANKS)
  .filter(([k]) => k !== 'guess')
  .reduce((s, [, v]) => s + v.length, 0);

app.get('/api/stats', (req, res) => {
  const totalQueue = Object.values(modeQueues).reduce((sum, q) => sum + q.length, 0);
  res.json({
    activeRooms:    rooms.size,
    queueLength:    totalQueue,
    totalQuestions: totalQCount,
    queues: Object.fromEntries(Object.entries(modeQueues).map(([k, v]) => [k, v.length])),
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Server] MindMatch running on port ${PORT}`);
  console.log(`[Server] Total questions loaded: ${totalQCount}`);
});
