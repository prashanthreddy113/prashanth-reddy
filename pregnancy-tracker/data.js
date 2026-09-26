/* Reference content for Bloom. General guidance only — always follow your own doctor's advice. */

// [week, size comparison, emoji, length, weight, baby this week, for mom this week]
const WEEKS = [
  [4, 'poppy seed', '🌱', '0.1 cm', '<1 g', 'The embryo is implanting and the placenta is starting to form.', 'Start folic acid if you have not already. A missed period is often the first sign.'],
  [5, 'sesame seed', '🌱', '0.2 cm', '<1 g', 'The heart begins to form and the neural tube is closing.', 'Tiredness and sore breasts are common. Rest when you can.'],
  [6, 'lentil', '🫘', '0.5 cm', '<1 g', 'A tiny heartbeat may be seen on ultrasound.', 'Nausea may begin. Small, frequent meals and dry crackers help.'],
  [7, 'blueberry', '🫐', '1 cm', '<1 g', 'Arm and leg buds are growing.', 'Book your first antenatal visit if it is not done yet.'],
  [8, 'raspberry', '🍓', '1.6 cm', '1 g', 'Fingers and toes are starting to form.', 'A dating scan around now confirms how far along you are.'],
  [9, 'cherry', '🍒', '2.3 cm', '2 g', 'All essential organs have begun to form.', 'Keep sipping water, especially if you are vomiting.'],
  [10, 'strawberry', '🍓', '3.1 cm', '4 g', 'Baby is now called a fetus. Tiny nails are forming.', 'First-trimester blood tests are usually done around now.'],
  [11, 'fig', '🟣', '4.1 cm', '7 g', 'Baby can open and close fists.', 'The NT scan window (11–14 weeks) opens this week.'],
  [12, 'lime', '🍋', '5.4 cm', '14 g', 'Reflexes develop. Baby may suck a thumb.', 'Nausea often starts to ease towards the end of this trimester.'],
  [13, 'lemon', '🍋', '7.4 cm', '23 g', 'Vocal cords are forming.', 'Last week of the first trimester. Energy usually returns soon.'],
  [14, 'peach', '🍑', '8.7 cm', '43 g', 'Baby can squint, frown and make faces.', 'Welcome to the second trimester, often the most comfortable one.'],
  [15, 'apple', '🍎', '10 cm', '70 g', 'Bones are hardening. Baby senses light.', 'Gentle exercise like walking and prenatal yoga is ideal now.'],
  [16, 'avocado', '🥑', '11.6 cm', '100 g', 'Baby’s eyes can move and the heart pumps about 25 litres of blood a day.', 'Some mothers feel the first flutters this week.'],
  [17, 'pomegranate', '🔴', '13 cm', '140 g', 'Fat stores start to form under the skin.', 'Your centre of gravity is shifting. Wear flat, supportive shoes.'],
  [18, 'bell pepper', '🫑', '14.2 cm', '190 g', 'Baby can hear sounds, including your voice.', 'The anomaly scan (18–22 weeks) is due. Talk and sing to baby.'],
  [19, 'mango', '🥭', '15.3 cm', '240 g', 'A protective coating (vernix) covers the skin.', 'Round-ligament pain is common. Change position slowly.'],
  [20, 'banana', '🍌', '25.6 cm (head to heel)', '300 g', 'Halfway there! Baby swallows and practises digestion.', 'Sleep on your side from now on, preferably the left.'],
  [21, 'carrot', '🥕', '26.7 cm', '360 g', 'Movements become stronger and more regular.', 'Keep iron-rich foods up: greens, dates, jaggery, lentils.'],
  [22, 'papaya', '🟠', '27.8 cm', '430 g', 'Eyebrows and eyelashes appear.', 'Swollen feet? Put them up and do ankle circles.'],
  [23, 'grapefruit', '🍊', '28.9 cm', '500 g', 'Baby can hear loud sounds outside the womb.', 'Stay hydrated to avoid headaches and dizziness.'],
  [24, 'corn cob', '🌽', '30 cm', '600 g', 'Lungs are developing branches and surfactant cells.', 'Glucose test (OGTT) window opens: 24–28 weeks.'],
  [25, 'cauliflower', '🥦', '34.6 cm', '660 g', 'Baby responds to your voice and touch.', 'Practise pelvic-floor (Kegel) exercises daily.'],
  [26, 'lettuce', '🥬', '35.6 cm', '760 g', 'Eyes begin to open.', 'Back ache? Try cat-cow and pelvic tilts.'],
  [27, 'cabbage', '🥬', '36.6 cm', '875 g', 'Sleep–wake cycles become regular.', 'Last week of trimester two. Ask about the Tdap vaccine.'],
  [28, 'brinjal', '🍆', '37.6 cm', '1 kg', 'Baby can blink and dream (REM sleep).', 'Start daily kick counting. Third trimester begins.'],
  [29, 'butternut squash', '🎃', '38.6 cm', '1.15 kg', 'Muscles and lungs keep maturing.', 'Heartburn is common. Eat smaller meals and stay upright after eating.'],
  [30, 'cucumber', '🥒', '39.9 cm', '1.3 kg', 'Baby’s brain is growing fast.', 'Start packing your hospital bag.'],
  [31, 'coconut', '🥥', '41.1 cm', '1.5 kg', 'All five senses are working.', 'Braxton Hicks (practice) contractions may start.'],
  [32, 'squash', '🎃', '42.4 cm', '1.7 kg', 'Toenails are fully formed. Baby practises breathing.', 'A growth scan is usually done around 28–32 weeks.'],
  [33, 'pineapple', '🍍', '43.7 cm', '1.9 kg', 'The skull stays soft to help with birth.', 'Rest often. Sleep with a pillow between your knees.'],
  [34, 'cantaloupe', '🍈', '45 cm', '2.1 kg', 'The central nervous system is maturing.', 'Discuss your birth plan with your doctor.'],
  [35, 'honeydew melon', '🍈', '46.2 cm', '2.4 kg', 'Kidneys are fully developed.', 'Visits usually become weekly from about now.'],
  [36, 'papaya (large)', '🟠', '47.4 cm', '2.6 kg', 'Baby is likely head-down.', 'Keep the hospital bag by the door.'],
  [37, 'winter melon', '🍈', '48.6 cm', '2.9 kg', 'Baby is considered early term.', 'Learn the signs of labour and when to call the hospital.'],
  [38, 'pumpkin', '🎃', '49.8 cm', '3.1 kg', 'Baby’s grasp is firm.', 'Rest, walk gently and keep counting kicks.'],
  [39, 'watermelon', '🍉', '50.7 cm', '3.3 kg', 'Baby is full term.', 'Any day now. Keep your phone charged.'],
  [40, 'jackfruit', '🍈', '51.2 cm', '3.4 kg', 'Due date week!', 'Only about 1 in 20 babies arrive exactly on the due date.'],
];

// Typical antenatal tests & scans. Timing varies — follow your doctor's schedule.
const REPORT_SCHEDULE = [
  { id: 'dating', name: 'Dating / viability scan', from: 6, to: 10, why: 'Confirms heartbeat and gives the most accurate due date.' },
  { id: 'bloods1', name: 'First-trimester blood tests', from: 8, to: 12, why: 'CBC, blood group, thyroid (TSH), sugar, HIV, HBsAg, VDRL, urine.' },
  { id: 'nt', name: 'NT scan + double marker', from: 11, to: 14, why: 'Screening for chromosomal conditions.' },
  { id: 'quad', name: 'Quadruple marker (if advised)', from: 15, to: 20, why: 'Screening test if the double marker was not done.' },
  { id: 'anomaly', name: 'Anomaly scan (TIFFA / Level II)', from: 18, to: 22, why: 'Detailed check of baby’s organs and growth.' },
  { id: 'ogtt', name: 'Glucose tolerance test (OGTT)', from: 24, to: 28, why: 'Checks for gestational diabetes. Hb is often repeated.' },
  { id: 'tdap', name: 'Tdap / TT vaccine record', from: 27, to: 36, why: 'Protects baby from whooping cough and tetanus.' },
  { id: 'growth', name: 'Growth scan + Doppler', from: 28, to: 34, why: 'Checks baby’s growth, fluid and blood flow.' },
  { id: 'bloods3', name: 'Third-trimester blood tests', from: 32, to: 37, why: 'CBC, urine and any repeat tests your doctor asks for.' },
  { id: 'nst', name: 'NST / term check', from: 37, to: 41, why: 'Monitors baby’s heart rate near term.' },
];

const DEFAULT_HABITS = [
  { id: 'water', name: 'Water', unit: 'glasses', type: 'count', target: 10 },
  { id: 'fruit', name: 'Fruit & vegetable servings', unit: 'servings', type: 'count', target: 5 },
  { id: 'protein', name: 'Protein with each meal', unit: 'meals', type: 'count', target: 3 },
  { id: 'walk', name: 'Walk 20–30 minutes', type: 'check' },
  { id: 'stretch', name: 'Pregnancy stretches', type: 'check' },
  { id: 'kegel', name: 'Kegel sets', unit: 'sets', type: 'count', target: 3 },
  { id: 'mind', name: 'Breathing or a mind game', type: 'check' },
  { id: 'bond', name: 'Talk, read or sing to baby', type: 'check' },
  { id: 'side', name: 'Slept on my side', type: 'check' },
];

const DEFAULT_MEDS = [
  { id: 'm_iron', name: 'Iron + folic acid', dose: '1 tablet after breakfast', times: ['09:00'] },
  { id: 'm_calcium', name: 'Calcium + vitamin D', dose: '1 tablet after dinner', times: ['21:00'] },
];

// Pregnancy-friendly stretches. seconds = hold/duration per round.
const STRETCHES = [
  { id: 'catcow', name: 'Cat–cow', seconds: 60, area: 'Back', tri: [1, 2, 3],
    steps: ['Come onto hands and knees, wrists under shoulders, knees under hips.', 'Breathe in: let the belly drop gently and lift your gaze (cow).', 'Breathe out: round the back and tuck your chin (cat).', 'Move slowly with your breath.'],
    benefit: 'Eases lower-back ache and helps baby settle into a good position.' },
  { id: 'child', name: 'Wide-knee child’s pose', seconds: 45, area: 'Back & hips', tri: [1, 2, 3],
    steps: ['Kneel with knees wide apart to make room for the bump.', 'Sit back towards your heels and walk your hands forward.', 'Rest your head on a pillow or your hands.', 'Breathe deeply into your back.'],
    benefit: 'Relaxes the lower back, hips and shoulders.' },
  { id: 'butterfly', name: 'Butterfly (seated)', seconds: 45, area: 'Hips & inner thighs', tri: [1, 2, 3],
    steps: ['Sit tall on a cushion with the soles of your feet together.', 'Hold your ankles and let your knees drop gently.', 'Keep your spine long. Do not bounce.'],
    benefit: 'Opens the hips and improves flexibility for labour.' },
  { id: 'side', name: 'Seated side stretch', seconds: 40, area: 'Sides & ribs', tri: [1, 2, 3],
    steps: ['Sit cross-legged or on a chair.', 'Raise your right arm and lean gently to the left.', 'Hold, breathe, then switch sides.'],
    benefit: 'Creates space for breathing as the bump grows.' },
  { id: 'pelvictilt', name: 'Standing pelvic tilts', seconds: 60, area: 'Lower back & core', tri: [1, 2, 3],
    steps: ['Stand with your back against a wall, knees soft.', 'Breathe out and press your lower back towards the wall.', 'Breathe in and release. Repeat 10 times.'],
    benefit: 'Strengthens the core and relieves back pain.' },
  { id: 'neck', name: 'Neck & shoulder rolls', seconds: 40, area: 'Neck & shoulders', tri: [1, 2, 3],
    steps: ['Sit or stand tall.', 'Slowly drop your right ear towards your shoulder, then roll the chin down and across.', 'Roll your shoulders backwards 5 times, then forwards 5 times.'],
    benefit: 'Releases tension from sleeping and screen time.' },
  { id: 'chest', name: 'Doorway chest opener', seconds: 30, area: 'Chest & upper back', tri: [1, 2, 3],
    steps: ['Stand in a doorway with forearms on the frame at shoulder height.', 'Step one foot forward until you feel a gentle stretch across the chest.', 'Keep your belly soft and breathe.'],
    benefit: 'Counters rounded shoulders and helps posture.' },
  { id: 'calf', name: 'Wall calf stretch', seconds: 40, area: 'Calves', tri: [1, 2, 3],
    steps: ['Face a wall with hands on it.', 'Step one leg back, heel down, back knee straight.', 'Lean in gently. Hold, then switch legs.'],
    benefit: 'Helps prevent night-time leg cramps.' },
  { id: 'ankle', name: 'Ankle circles & foot pumps', seconds: 40, area: 'Feet & ankles', tri: [1, 2, 3],
    steps: ['Sit with feet up on a stool.', 'Circle each ankle 10 times each way.', 'Point and flex your feet 10 times.'],
    benefit: 'Reduces swelling and improves circulation.' },
  { id: 'squat', name: 'Supported squat', seconds: 30, area: 'Pelvis & legs', tri: [2, 3],
    steps: ['Hold the back of a sturdy chair, feet wider than hips.', 'Lower slowly as far as comfortable, heels down.', 'Hold and breathe, then rise slowly using the chair.'],
    benefit: 'Opens the pelvis and strengthens legs for labour.' },
  { id: 'hipflexor', name: 'Kneeling hip-flexor stretch', seconds: 40, area: 'Hips', tri: [1, 2, 3],
    steps: ['Kneel on a cushion and step your right foot forward.', 'Hold a chair for balance and shift your weight slightly forward.', 'Keep your back upright. Hold, then switch sides.'],
    benefit: 'Loosens tight hips from sitting.' },
  { id: 'kegel', name: 'Kegels (pelvic floor)', seconds: 60, area: 'Pelvic floor', tri: [1, 2, 3],
    steps: ['Sit or lie comfortably.', 'Squeeze the muscles you use to stop urine flow and hold for 5 seconds.', 'Relax for 5 seconds. Repeat 10 times. Keep breathing.'],
    benefit: 'Supports bladder control and recovery after birth.' },
];

const EXERCISE_SAFETY = [
  'Aim for about 150 minutes of moderate activity a week, if your doctor agrees.',
  'You should be able to talk while exercising.',
  'After 20 weeks, avoid lying flat on your back for long periods.',
  'Avoid contact sports, hot yoga, heavy lifting, and anything with a risk of falling.',
  'Stop and call your doctor if you have bleeding, dizziness, chest pain, fluid leakage, or painful contractions.',
];

const WARNING_SIGNS = [
  'Vaginal bleeding or leaking fluid',
  'Severe or constant tummy pain',
  'Severe headache, blurred vision, or sudden swelling of face and hands',
  'Baby moving less than usual (from about 28 weeks)',
  'Fever above 38 °C (100.4 °F)',
  'Painful urination or a burning feeling',
  'Regular contractions before 37 weeks',
  'Persistent vomiting where you cannot keep fluids down',
  'Thoughts of harming yourself, or feeling low for more than two weeks',
];

const BAG_ITEMS = {
  'For mom': ['Hospital file & all reports', 'ID and insurance card', 'Comfortable front-open nightwear (2–3)', 'Maternity pads', 'Nursing bras', 'Slippers & socks', 'Toiletries & lip balm', 'Phone charger', 'Snacks & water bottle', 'Hair ties & comb'],
  'For baby': ['Soft cotton clothes (3–4 sets)', 'Swaddle / wrap cloth', 'Cap, mittens & socks', 'Newborn diapers', 'Soft towel', 'Baby blanket', 'Going-home outfit'],
  'For partner': ['Change of clothes', 'Snacks', 'Cash / cards', 'Emergency contact list'],
};

const AFFIRMATIONS = [
  'My body knows how to grow and nurture this baby.',
  'I breathe in calm and breathe out tension.',
  'Every day my baby and I grow a little stronger.',
  'I trust myself and I ask for help when I need it.',
  'It is okay to rest. Resting is part of the work.',
  'I am surrounded by love and support.',
  'My baby feels my love with every heartbeat.',
  'I welcome each change in my body with kindness.',
  'I am becoming the mother my baby needs.',
  'Today I will do one gentle thing for myself.',
];

const MOODS = [
  { id: 'great', label: 'Great', emoji: '😊' },
  { id: 'good', label: 'Good', emoji: '🙂' },
  { id: 'okay', label: 'Okay', emoji: '😐' },
  { id: 'tired', label: 'Tired', emoji: '😴' },
  { id: 'low', label: 'Low', emoji: '😔' },
];

const SYMPTOMS = ['Nausea', 'Heartburn', 'Back pain', 'Headache', 'Swelling', 'Leg cramps', 'Constipation', 'Breathless', 'Can’t sleep', 'Baby kicks!'];

// How long / how many, and what to watch out for, per stretch.
const STRETCH_TIPS = {
  catcow: { reps: '8–10 slow rounds', avoid: 'Keep the belly movement gentle. Pad your knees with a folded towel.' },
  child: { reps: 'Hold 30–60 seconds, 2 times', avoid: 'Keep knees wide so the bump is not squashed. Use a pillow under your chest.' },
  butterfly: { reps: 'Hold 30–45 seconds, 2–3 times', avoid: 'Never push your knees down or bounce. Sit on a cushion if your back rounds.' },
  side: { reps: '3 times each side', avoid: 'Lengthen upwards before leaning. Do not twist deeply.' },
  pelvictilt: { reps: '10–15 tilts, 2 sets', avoid: 'Keep your knees soft and move only the pelvis.' },
  neck: { reps: '5 slow rolls each way', avoid: 'Do not roll the head backwards. Move within a comfortable range.' },
  chest: { reps: 'Hold 20–30 seconds, 2 times', avoid: 'Stop if you feel tingling in the arms. Keep your belly soft.' },
  calf: { reps: 'Hold 30 seconds each leg, 2 times', avoid: 'Keep the back heel on the floor and knee straight but not locked.' },
  ankle: { reps: '10 circles each way, 10 point–flex', avoid: 'Great any time your feet feel swollen. Keep feet raised.' },
  squat: { reps: 'Hold 20–30 seconds, 3 times', avoid: 'Skip deep squats if you have pelvic pain or your doctor says baby is low or breech.' },
  hipflexor: { reps: 'Hold 30 seconds each side', avoid: 'Hold a chair for balance. Do not arch your lower back.' },
  kegel: { reps: '10 squeezes, 3 times a day', avoid: 'Do not hold your breath or squeeze your tummy, thighs or bottom.' },
};

// [word, clue]. Word length decides the level (Beginner = short words … Master = long words).
const SCRAMBLE_WORDS = [
  ['BIB', 'Catches spills'], ['HUG', 'Arms around someone'], ['NAP', 'A short sleep'], ['COT', 'A baby bed'], ['TOY', 'Something to play with'], ['CRY', 'Baby’s first sound'],
  ['BUMP', 'Growing every week'], ['MILK', 'Baby’s first food'], ['BABY', 'Coming soon!'], ['CRIB', 'A bed with rails'], ['KISS', 'A sweet peck'], ['SOCK', 'Keeps tiny feet warm'], ['MOON', 'Shines at bedtime'], ['BATH', 'Splash time'], ['STAR', 'Twinkle, twinkle…'],
  ['TEDDY', 'A soft bear'], ['KICKS', 'You feel them inside'], ['SLEEP', 'What new parents miss'], ['SMILE', 'Baby’s first one melts hearts'], ['TWINS', 'Two at once'], ['CRAWL', 'Before walking'], ['SWING', 'Goes back and forth'], ['TUMMY', 'Where baby is now'], ['BLOCK', 'Stack it up'], ['CHEEK', 'Chubby and kissable'],
  ['CRADLE', 'Rocks baby to sleep'], ['RATTLE', 'A noisy toy'], ['DIAPER', 'Changed many times a day'], ['CUDDLE', 'A warm hug'], ['GIGGLE', 'A tiny laugh'], ['MOTHER', 'That’s you!'], ['FATHER', 'Your partner'], ['BOTTLE', 'Milk goes in it'], ['BONNET', 'A baby hat'], ['MOBILE', 'Hangs above the crib'], ['SLEEPY', 'Time for a nap'], ['INFANT', 'A baby under one'],
  ['LULLABY', 'A bedtime song'], ['BLANKET', 'Keeps baby warm'], ['NURSERY', 'Baby’s room'], ['SWADDLE', 'Wrap baby snugly'], ['MIDWIFE', 'Helps at birth'], ['NEWBORN', 'Just arrived'], ['TWINKLE', 'Little star'], ['PLAYPEN', 'A safe play space'], ['BOOTIES', 'Knitted baby shoes'], ['TODDLER', 'Baby who has started walking'],
  ['STROLLER', 'Baby rides in it'], ['PACIFIER', 'A soother'], ['BIRTHDAY', 'The big day'], ['DELIVERY', 'How baby arrives'], ['FOOTPRINT', 'Tiny ink souvenir'], ['MATERNITY', 'Leave, clothes, or ward'], ['TRIMESTER', 'One third of pregnancy'], ['HIGHCHAIR', 'Seat for mealtimes'],
  ['PREGNANCY', 'Nine months of this'], ['ULTRASOUND', 'First peek at baby'], ['BABYSITTER', 'Helps on date night'], ['NIGHTLIGHT', 'Glows in the nursery'], ['GRANDPARENT', 'Baby’s nana or dada'], ['HEARTBEAT', 'Heard on the Doppler'], ['BREASTFEED', 'Nursing baby'], ['CONTRACTION', 'Labour tightening'],
];

const MEMORY_EMOJI = ['👶', '🍼', '🧸', '🎀', '🦆', '🌙', '⭐', '🧦', '🍓', '🎈', '🐣', '🌸', '🧁', '🦋', '🐘'];
