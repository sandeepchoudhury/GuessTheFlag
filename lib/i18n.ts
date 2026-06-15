export type Locale = 'en' | 'hi' | 'bn' | 'pa';

export const LOCALES: Locale[] = ['en', 'hi', 'bn', 'pa'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  pa: 'ਪੰਜਾਬੀ',
};

export const LOCALE_COOKIE = 'gtf_lang';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value);
}

/** Read the locale from document.cookie (client components only). */
export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return isLocale(value) ? value : 'en';
}

export type MessageKey =
  | 'appTitle'
  | 'loginSubtitle'
  | 'username'
  | 'password'
  | 'confirmPassword'
  | 'usernamePlaceholder'
  | 'passwordPlaceholder'
  | 'signIn'
  | 'signingIn'
  | 'noAccount'
  | 'signUp'
  | 'signupTitle'
  | 'signupSubtitle'
  | 'signupUsernamePlaceholder'
  | 'signupPasswordPlaceholder'
  | 'confirmPasswordPlaceholder'
  | 'createAccount'
  | 'creatingAccount'
  | 'haveAccount'
  | 'signInLink'
  | 'passwordsNoMatch'
  | 'networkError'
  | 'loginFailed'
  | 'signupFailed'
  | 'welcome'
  | 'currentLevel'
  | 'difficultyLine'
  | 'allLevels'
  | 'level'
  | 'completedBadge'
  | 'unlockedBadge'
  | 'lockedBadge'
  | 'tierQuestions'
  | 'attempts'
  | 'playAgain'
  | 'startLevel'
  | 'completeToUnlock'
  | 'signOut'
  | 'tier1'
  | 'tier2'
  | 'tier3'
  | 'tier4'
  | 'tier5'
  | 'tierMix'
  | 'loadingLevel'
  | 'backToDashboard'
  | 'score'
  | 'levelUp'
  | 'unlockedMsg'
  | 'needPerfect'
  | 'playLevel'
  | 'retryLevel'
  | 'dashboard'
  | 'answerKey'
  | 'yourAnswer'
  | 'timedOut'
  | 'correctMsg'
  | 'guessFlag'
  | 'invalidLevel'
  | 'failedLoad'
  | 'failedSubmit'
  | 'language';

const en: Record<MessageKey, string> = {
  appTitle: 'Guess the Flag',
  loginSubtitle: 'Welcome back! Sign in to continue.',
  username: 'Username',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  usernamePlaceholder: 'Enter your username',
  passwordPlaceholder: 'Enter your password',
  signIn: 'Sign In',
  signingIn: 'Signing in...',
  noAccount: "Don't have an account?",
  signUp: 'Sign up',
  signupTitle: 'Create Account',
  signupSubtitle: 'Join and start guessing flags!',
  signupUsernamePlaceholder: 'Choose a username (3-30 chars)',
  signupPasswordPlaceholder: 'At least 6 characters',
  confirmPasswordPlaceholder: 'Repeat your password',
  createAccount: 'Create Account',
  creatingAccount: 'Creating account...',
  haveAccount: 'Already have an account?',
  signInLink: 'Sign in',
  passwordsNoMatch: 'Passwords do not match',
  networkError: 'Network error. Please try again.',
  loginFailed: 'Login failed',
  signupFailed: 'Signup failed',
  welcome: 'Welcome back, {name}!',
  currentLevel: 'Current Level: {n}',
  difficultyLine: 'Difficulty: {tier} — Score 15/15 to advance!',
  allLevels: 'All Levels',
  level: 'Level {n}',
  completedBadge: '✓ Completed',
  unlockedBadge: 'Unlocked',
  lockedBadge: '🔒 Locked',
  tierQuestions: '{tier} — 15 questions',
  attempts: 'Attempts: {n}',
  playAgain: 'Play Again',
  startLevel: 'Start Level',
  completeToUnlock: 'Complete Level {n} to unlock',
  signOut: 'Sign Out',
  tier1: 'Beginner',
  tier2: 'Easy',
  tier3: 'Medium',
  tier4: 'Hard',
  tier5: 'Expert',
  tierMix: 'Expert Mix',
  loadingLevel: 'Loading Level {n}...',
  backToDashboard: 'Back to Dashboard',
  score: 'Score',
  levelUp: 'Level Up!',
  unlockedMsg: 'Amazing! You unlocked Level {n}!',
  needPerfect: 'You need 15/15 to pass. Keep trying!',
  playLevel: 'Play Level {n} →',
  retryLevel: 'Retry Level {n}',
  dashboard: 'Dashboard',
  answerKey: 'Answer Key',
  yourAnswer: 'Your answer: {a}',
  timedOut: 'Timed out',
  correctMsg: 'Correct!',
  guessFlag: 'Guess this flag',
  invalidLevel: 'Invalid level',
  failedLoad: 'Failed to load game. Please try again.',
  failedSubmit: 'Failed to submit answers.',
  language: 'Language',
};

const hi: Record<MessageKey, string> = {
  appTitle: 'झंडा पहचानो',
  loginSubtitle: 'वापसी पर स्वागत है! जारी रखने के लिए साइन इन करें।',
  username: 'उपयोगकर्ता नाम',
  password: 'पासवर्ड',
  confirmPassword: 'पासवर्ड की पुष्टि करें',
  usernamePlaceholder: 'अपना उपयोगकर्ता नाम दर्ज करें',
  passwordPlaceholder: 'अपना पासवर्ड दर्ज करें',
  signIn: 'साइन इन करें',
  signingIn: 'साइन इन हो रहा है...',
  noAccount: 'खाता नहीं है?',
  signUp: 'साइन अप करें',
  signupTitle: 'खाता बनाएँ',
  signupSubtitle: 'जुड़ें और झंडे पहचानना शुरू करें!',
  signupUsernamePlaceholder: 'उपयोगकर्ता नाम चुनें (3-30 अक्षर)',
  signupPasswordPlaceholder: 'कम से कम 6 अक्षर',
  confirmPasswordPlaceholder: 'अपना पासवर्ड दोबारा लिखें',
  createAccount: 'खाता बनाएँ',
  creatingAccount: 'खाता बन रहा है...',
  haveAccount: 'पहले से खाता है?',
  signInLink: 'साइन इन करें',
  passwordsNoMatch: 'पासवर्ड मेल नहीं खाते',
  networkError: 'नेटवर्क त्रुटि। कृपया फिर से प्रयास करें।',
  loginFailed: 'लॉगिन विफल',
  signupFailed: 'साइनअप विफल',
  welcome: 'वापसी पर स्वागत है, {name}!',
  currentLevel: 'वर्तमान स्तर: {n}',
  difficultyLine: 'कठिनाई: {tier} — आगे बढ़ने के लिए 15/15 स्कोर करें!',
  allLevels: 'सभी स्तर',
  level: 'स्तर {n}',
  completedBadge: '✓ पूर्ण',
  unlockedBadge: 'खुला',
  lockedBadge: '🔒 बंद',
  tierQuestions: '{tier} — 15 प्रश्न',
  attempts: 'प्रयास: {n}',
  playAgain: 'फिर से खेलें',
  startLevel: 'स्तर शुरू करें',
  completeToUnlock: 'खोलने के लिए स्तर {n} पूरा करें',
  signOut: 'साइन आउट',
  tier1: 'शुरुआती',
  tier2: 'आसान',
  tier3: 'मध्यम',
  tier4: 'कठिन',
  tier5: 'विशेषज्ञ',
  tierMix: 'विशेषज्ञ मिश्रण',
  loadingLevel: 'स्तर {n} लोड हो रहा है...',
  backToDashboard: 'डैशबोर्ड पर वापस जाएँ',
  score: 'स्कोर',
  levelUp: 'स्तर बढ़ा!',
  unlockedMsg: 'शानदार! आपने स्तर {n} खोल दिया!',
  needPerfect: 'पास होने के लिए 15/15 चाहिए। प्रयास जारी रखें!',
  playLevel: 'स्तर {n} खेलें →',
  retryLevel: 'स्तर {n} फिर से खेलें',
  dashboard: 'डैशबोर्ड',
  answerKey: 'उत्तर कुंजी',
  yourAnswer: 'आपका उत्तर: {a}',
  timedOut: 'समय समाप्त',
  correctMsg: 'सही!',
  guessFlag: 'यह झंडा पहचानें',
  invalidLevel: 'अमान्य स्तर',
  failedLoad: 'गेम लोड नहीं हो सका। कृपया फिर से प्रयास करें।',
  failedSubmit: 'उत्तर सबमिट नहीं हो सके।',
  language: 'भाषा',
};

const bn: Record<MessageKey, string> = {
  appTitle: 'পতাকা চেনো',
  loginSubtitle: 'ফিরে আসায় স্বাগতম! চালিয়ে যেতে সাইন ইন করুন।',
  username: 'ব্যবহারকারীর নাম',
  password: 'পাসওয়ার্ড',
  confirmPassword: 'পাসওয়ার্ড নিশ্চিত করুন',
  usernamePlaceholder: 'আপনার ব্যবহারকারীর নাম লিখুন',
  passwordPlaceholder: 'আপনার পাসওয়ার্ড লিখুন',
  signIn: 'সাইন ইন',
  signingIn: 'সাইন ইন হচ্ছে...',
  noAccount: 'অ্যাকাউন্ট নেই?',
  signUp: 'সাইন আপ করুন',
  signupTitle: 'অ্যাকাউন্ট তৈরি করুন',
  signupSubtitle: 'যোগ দিন এবং পতাকা চেনা শুরু করুন!',
  signupUsernamePlaceholder: 'একটি ব্যবহারকারীর নাম বেছে নিন (3-30 অক্ষর)',
  signupPasswordPlaceholder: 'কমপক্ষে 6 অক্ষর',
  confirmPasswordPlaceholder: 'পাসওয়ার্ডটি আবার লিখুন',
  createAccount: 'অ্যাকাউন্ট তৈরি করুন',
  creatingAccount: 'অ্যাকাউন্ট তৈরি হচ্ছে...',
  haveAccount: 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
  signInLink: 'সাইন ইন করুন',
  passwordsNoMatch: 'পাসওয়ার্ড মিলছে না',
  networkError: 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।',
  loginFailed: 'লগইন ব্যর্থ',
  signupFailed: 'সাইনআপ ব্যর্থ',
  welcome: 'ফিরে আসায় স্বাগতম, {name}!',
  currentLevel: 'বর্তমান স্তর: {n}',
  difficultyLine: 'কঠিনতা: {tier} — এগিয়ে যেতে 15/15 স্কোর করুন!',
  allLevels: 'সব স্তর',
  level: 'স্তর {n}',
  completedBadge: '✓ সম্পন্ন',
  unlockedBadge: 'খোলা',
  lockedBadge: '🔒 বন্ধ',
  tierQuestions: '{tier} — 15টি প্রশ্ন',
  attempts: 'চেষ্টা: {n}',
  playAgain: 'আবার খেলুন',
  startLevel: 'স্তর শুরু করুন',
  completeToUnlock: 'খুলতে স্তর {n} সম্পূর্ণ করুন',
  signOut: 'সাইন আউট',
  tier1: 'শিক্ষানবিস',
  tier2: 'সহজ',
  tier3: 'মাঝারি',
  tier4: 'কঠিন',
  tier5: 'বিশেষজ্ঞ',
  tierMix: 'বিশেষজ্ঞ মিশ্রণ',
  loadingLevel: 'স্তর {n} লোড হচ্ছে...',
  backToDashboard: 'ড্যাশবোর্ডে ফিরে যান',
  score: 'স্কোর',
  levelUp: 'স্তর বৃদ্ধি!',
  unlockedMsg: 'অসাধারণ! আপনি স্তর {n} খুলেছেন!',
  needPerfect: 'পাস করতে 15/15 দরকার। চেষ্টা চালিয়ে যান!',
  playLevel: 'স্তর {n} খেলুন →',
  retryLevel: 'স্তর {n} আবার খেলুন',
  dashboard: 'ড্যাশবোর্ড',
  answerKey: 'উত্তরমালা',
  yourAnswer: 'আপনার উত্তর: {a}',
  timedOut: 'সময় শেষ',
  correctMsg: 'সঠিক!',
  guessFlag: 'এই পতাকাটি চিনুন',
  invalidLevel: 'অবৈধ স্তর',
  failedLoad: 'গেম লোড করা যায়নি। আবার চেষ্টা করুন।',
  failedSubmit: 'উত্তর জমা দেওয়া যায়নি।',
  language: 'ভাষা',
};

const pa: Record<MessageKey, string> = {
  appTitle: 'ਝੰਡਾ ਪਛਾਣੋ',
  loginSubtitle: 'ਵਾਪਸੀ ਤੇ ਜੀ ਆਇਆਂ ਨੂੰ! ਜਾਰੀ ਰੱਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।',
  username: 'ਵਰਤੋਂਕਾਰ ਨਾਮ',
  password: 'ਪਾਸਵਰਡ',
  confirmPassword: 'ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
  usernamePlaceholder: 'ਆਪਣਾ ਵਰਤੋਂਕਾਰ ਨਾਮ ਦਰਜ ਕਰੋ',
  passwordPlaceholder: 'ਆਪਣਾ ਪਾਸਵਰਡ ਦਰਜ ਕਰੋ',
  signIn: 'ਸਾਈਨ ਇਨ ਕਰੋ',
  signingIn: 'ਸਾਈਨ ਇਨ ਹੋ ਰਿਹਾ ਹੈ...',
  noAccount: 'ਖਾਤਾ ਨਹੀਂ ਹੈ?',
  signUp: 'ਸਾਈਨ ਅੱਪ ਕਰੋ',
  signupTitle: 'ਖਾਤਾ ਬਣਾਓ',
  signupSubtitle: 'ਜੁੜੋ ਅਤੇ ਝੰਡੇ ਪਛਾਣਨਾ ਸ਼ੁਰੂ ਕਰੋ!',
  signupUsernamePlaceholder: 'ਇੱਕ ਵਰਤੋਂਕਾਰ ਨਾਮ ਚੁਣੋ (3-30 ਅੱਖਰ)',
  signupPasswordPlaceholder: 'ਘੱਟੋ-ਘੱਟ 6 ਅੱਖਰ',
  confirmPasswordPlaceholder: 'ਆਪਣਾ ਪਾਸਵਰਡ ਦੁਬਾਰਾ ਲਿਖੋ',
  createAccount: 'ਖਾਤਾ ਬਣਾਓ',
  creatingAccount: 'ਖਾਤਾ ਬਣ ਰਿਹਾ ਹੈ...',
  haveAccount: 'ਪਹਿਲਾਂ ਤੋਂ ਖਾਤਾ ਹੈ?',
  signInLink: 'ਸਾਈਨ ਇਨ ਕਰੋ',
  passwordsNoMatch: 'ਪਾਸਵਰਡ ਮੇਲ ਨਹੀਂ ਖਾਂਦੇ',
  networkError: 'ਨੈੱਟਵਰਕ ਗਲਤੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  loginFailed: 'ਲੌਗਇਨ ਅਸਫਲ',
  signupFailed: 'ਸਾਈਨਅੱਪ ਅਸਫਲ',
  welcome: 'ਵਾਪਸੀ ਤੇ ਜੀ ਆਇਆਂ ਨੂੰ, {name}!',
  currentLevel: 'ਮੌਜੂਦਾ ਪੱਧਰ: {n}',
  difficultyLine: 'ਮੁਸ਼ਕਲ: {tier} — ਅੱਗੇ ਵਧਣ ਲਈ 15/15 ਸਕੋਰ ਕਰੋ!',
  allLevels: 'ਸਾਰੇ ਪੱਧਰ',
  level: 'ਪੱਧਰ {n}',
  completedBadge: '✓ ਪੂਰਾ',
  unlockedBadge: 'ਖੁੱਲ੍ਹਾ',
  lockedBadge: '🔒 ਬੰਦ',
  tierQuestions: '{tier} — 15 ਸਵਾਲ',
  attempts: 'ਕੋਸ਼ਿਸ਼ਾਂ: {n}',
  playAgain: 'ਦੁਬਾਰਾ ਖੇਡੋ',
  startLevel: 'ਪੱਧਰ ਸ਼ੁਰੂ ਕਰੋ',
  completeToUnlock: 'ਖੋਲ੍ਹਣ ਲਈ ਪੱਧਰ {n} ਪੂਰਾ ਕਰੋ',
  signOut: 'ਸਾਈਨ ਆਊਟ',
  tier1: 'ਸ਼ੁਰੂਆਤੀ',
  tier2: 'ਆਸਾਨ',
  tier3: 'ਦਰਮਿਆਨਾ',
  tier4: 'ਔਖਾ',
  tier5: 'ਮਾਹਰ',
  tierMix: 'ਮਾਹਰ ਮਿਸ਼ਰਣ',
  loadingLevel: 'ਪੱਧਰ {n} ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
  backToDashboard: 'ਡੈਸ਼ਬੋਰਡ ਤੇ ਵਾਪਸ ਜਾਓ',
  score: 'ਸਕੋਰ',
  levelUp: 'ਪੱਧਰ ਵਧਿਆ!',
  unlockedMsg: 'ਕਮਾਲ! ਤੁਸੀਂ ਪੱਧਰ {n} ਖੋਲ੍ਹ ਦਿੱਤਾ!',
  needPerfect: 'ਪਾਸ ਹੋਣ ਲਈ 15/15 ਚਾਹੀਦਾ ਹੈ। ਕੋਸ਼ਿਸ਼ ਜਾਰੀ ਰੱਖੋ!',
  playLevel: 'ਪੱਧਰ {n} ਖੇਡੋ →',
  retryLevel: 'ਪੱਧਰ {n} ਦੁਬਾਰਾ ਖੇਡੋ',
  dashboard: 'ਡੈਸ਼ਬੋਰਡ',
  answerKey: 'ਉੱਤਰ ਕੁੰਜੀ',
  yourAnswer: 'ਤੁਹਾਡਾ ਉੱਤਰ: {a}',
  timedOut: 'ਸਮਾਂ ਖਤਮ',
  correctMsg: 'ਸਹੀ!',
  guessFlag: 'ਇਹ ਝੰਡਾ ਪਛਾਣੋ',
  invalidLevel: 'ਅਵੈਧ ਪੱਧਰ',
  failedLoad: 'ਗੇਮ ਲੋਡ ਨਹੀਂ ਹੋਈ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  failedSubmit: 'ਉੱਤਰ ਜਮ੍ਹਾਂ ਨਹੀਂ ਹੋਏ।',
  language: 'ਭਾਸ਼ਾ',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, hi, bn, pa };

/** Translate a message key, substituting {placeholders} from vars. */
export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let msg = MESSAGES[locale]?.[key] ?? MESSAGES.en[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replaceAll(`{${k}}`, String(v));
    }
  }
  return msg;
}
