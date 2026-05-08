import { useState, useRef, useEffect } from 'react';

const BACKEND_URL  = 'https://nexhrms-backend.onrender.com';
const COMPANY_NAME = 'Future Invo Solutions';
const PRODUCT_NAME = 'NexHRMS';

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substring(2, 9);
}

const ROLES = [
  { id: 'employee', label: 'Employee', emoji: '👤', color: 'bg-green-500', chips: ['Apply for leave', 'Check my leave balance', 'Mark my attendance', 'View my profile'] },
  { id: 'manager',  label: 'Manager',  emoji: '👔', color: 'bg-orange-500', chips: ['Show my team attendance', 'Approve leave request', 'View pending leaves', 'Show team report'] },
  { id: 'hr',       label: 'HR',       emoji: '🧑‍💼', color: 'bg-blue-500', chips: ['Add a new employee', 'Generate offer letter', 'View all employees', 'Check leave policies'] },
  { id: 'admin',    label: 'Admin',    emoji: '⚙️', color: 'bg-purple-500', chips: ['Show all employees', 'View admin report', 'Show all tickets', 'Generate salary report'] },
];

const ROLE_WELCOME = {
  employee: (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **Personal HR Assistant**.\n\nI can help you with:\n✅ Apply for leave\n📅 Check your leave balance\n🕐 Mark your attendance\n📄 View your profile\n\nWhat would you like to do today?`,
  manager:  (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **Team Manager Assistant**.\n\nI can help you with:\n✅ Approve or reject leave requests\n👥 View your team's attendance\n📊 See pending leave requests\n\nWhat would you like to do?`,
  hr:       (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm the **HR Administration Assistant**.\n\nI can help you with:\n➕ Add new employees\n📄 Generate HR letters\n👥 View and manage all employees\n\nWhat would you like to do?`,
  admin:    (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm the **System Administrator**.\n\nI have full access to:\n👥 All employee data\n📊 Full reports and analytics\n🎫 All support tickets\n\nWhat would you like to do?`,
};

// ── TUTORIAL STEPS (guest walkthrough) ─────────────────────────────
const TUTORIAL_STEPS = [
  {
    id: 0,
    from: 'bot',
    text: `👋 Welcome to **${PRODUCT_NAME}** by ${COMPANY_NAME}!\n\nThis is a quick tour of what our HR bot can do. I'll show you the key features step by step.\n\nTap **Next →** to begin.`,
    action: 'next',
  },
  {
    id: 1,
    from: 'bot',
    text: `👤 **Employee Features**\n\nOnce logged in as an Employee, you can:\n✅ Apply for Casual, Sick or Earned leave\n📅 Check your remaining leave balance\n🕐 Mark your daily attendance\n📄 View your own HR profile\n\nThe bot guides you step by step — just type naturally!`,
    action: 'next',
  },
  {
    id: 2,
    from: 'bot',
    text: `👔 **Manager Features**\n\nManagers get additional powers:\n✅ Approve or reject team leave requests\n👥 View full team attendance at a glance\n📊 See all pending requests\n📋 Generate team reports\n\nSeparate login keeps manager actions secure.`,
    action: 'next',
  },
  {
    id: 3,
    from: 'bot',
    text: `🧑‍💼 **HR Features**\n\nHR staff can:\n➕ Add new employees to the system\n📄 Generate offer letters, experience letters, relieving letters\n📋 Manage leave policies\n👥 View all employee records\n\nAll in a simple conversation — no forms needed!`,
    action: 'next',
  },
  {
    id: 4,
    from: 'bot',
    text: `🌐 **Multi-Language Support**\n\nThe bot speaks:\n🇮🇳 English · हिंदी · తెలుగు · தமிழ்\n\nSwitch language anytime using the buttons in the top-right corner. The bot will respond in your chosen language automatically.`,
    action: 'next',
  },
  {
    id: 5,
    from: 'bot',
    text: `🔐 **Ready to get started?**\n\nThis was just a preview. To use any of these features for real:\n\n1. Ask your HR team for your **Employee ID**\n2. Use the default password: **emp@1234**\n3. Click **Login Now** below\n\nHR / Manager / Admin have their own login credentials.`,
    action: 'login',
  },
];

const TRANSLATIONS = {
  en: { placeholder: 'Type your message...', listening: '🎙️ Listening... speak now', online: 'Online · Powered by Groq AI' },
  hi: { placeholder: 'अपना संदेश टाइप करें...', listening: '🎙️ सुन रहा हूँ...', online: 'ऑनलाइन · Groq AI' },
  te: { placeholder: 'మీ సందేశం టైప్ చేయండి...', listening: '🎙️ వింటున్నాను...', online: 'ఆన్‌లైన్ · Groq AI' },
  ta: { placeholder: 'உங்கள் செய்தியை தட்டச்சு செய்யுங்கள்...', listening: '🎙️ கேட்கிறேன்...', online: 'ஆன்லைன் · Groq AI' },
};

const LANG_LABELS = { en: 'EN', hi: 'HI', te: 'TE', ta: 'TA' };
const LANG_SPEECH  = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN' };

function renderMarkdown(text) {
  return text.split('\n').map((line, i, arr) => {
    const isLast = i === arr.length - 1;
    const parts  = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={j} className="bg-indigo-50 text-indigo-700 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      return <span key={j}>{part}</span>;
    });
    return <span key={i}>{rendered}{!isLast ? '\n' : ''}</span>;
  });
}

function MessageBubble({ msg }) {
  const isBot = msg.sender === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mr-2.5 mt-1 flex-shrink-0 shadow-md">
          <span className="text-white text-xs font-bold">H</span>
        </div>
      )}
      <div className="max-w-[82%]">
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
            : 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-md'
        }`}>
          {isBot ? renderMarkdown(msg.text) : msg.text}
        </div>
        <p className={`text-[10px] mt-1 text-slate-400 ${isBot ? 'ml-1' : 'text-right'}`}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

const MicIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a3 3 0 013 3v6a3 3 0 11-6 0V6a3 3 0 013-3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3M8 21h8" />
  </svg>
);

// ── GUEST TUTORIAL SCREEN ──────────────────────────────────────────
function GuestTutorial({ onLoginClick }) {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: TUTORIAL_STEPS[0].text }
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNext = () => {
    const nextStep = step + 1;
    if (nextStep >= TUTORIAL_STEPS.length) return;
    setStep(nextStep);
    setMessages(prev => [...prev, { sender: 'bot', text: TUTORIAL_STEPS[nextStep].text }]);
  };

  const isLastStep = step === TUTORIAL_STEPS.length - 1;
  const progress   = Math.round(((step + 1) / TUTORIAL_STEPS.length) * 100);

  return (
    <div className="flex flex-col h-[680px] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-indigo-100 tracking-widest uppercase">
            🌐 {COMPANY_NAME}
          </span>
          <button onClick={onLoginClick}
            className="text-xs bg-white/20 text-white hover:bg-white/30 transition px-3 py-1 rounded-full font-semibold border border-white/30">
            🔐 Login
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0 text-lg">
            🙋
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">{PRODUCT_NAME} HR Assistant</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                Tour
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              <p className="text-xs text-indigo-100 font-medium">Guided Tour · Step {step + 1} of {TUTORIAL_STEPS.length}</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 bg-white/20 rounded-full h-1.5">
          <div className="bg-white rounded-full h-1.5 transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Tutorial banner */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-amber-700 font-medium">👀 You're viewing a guided tour</p>
        <button onClick={onLoginClick}
          className="text-xs text-indigo-600 font-bold hover:underline">
          Login for full access →
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Tutorial controls */}
      <div className="px-4 py-4 bg-white border-t border-slate-100 flex-shrink-0">
        {!isLastStep ? (
          <div className="flex gap-3">
            <button onClick={onLoginClick}
              className="flex-1 border-2 border-indigo-200 text-indigo-600 font-semibold py-3 rounded-2xl text-sm hover:bg-indigo-50 transition">
              🔐 Login Now
            </button>
            <button onClick={handleNext}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition shadow-md">
              Next → ({step + 1}/{TUTORIAL_STEPS.length})
            </button>
          </div>
        ) : (
          <button onClick={onLoginClick}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition shadow-md">
            🔐 Login to Get Started
          </button>
        )}
        <p className="text-[10px] text-slate-300 text-center mt-2">
          ⚠️ AI in beta · responses may not always be accurate
        </p>
      </div>
    </div>
  );
}

// ── LOGIN SCREEN ───────────────────────────────────────────────────
function LoginScreen({ onLogin, onGuest }) {
  const [empId,    setEmpId]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!empId.trim() || !password.trim()) { setError('Please fill in both fields.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${BACKEND_URL}/api/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emp_id: empId.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.success) { onLogin(data); }
      else { setError(data.message || 'Login failed. Please check your credentials.'); }
    } catch { setError('Cannot connect to server. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-[680px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">

      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-5 text-center flex-shrink-0">
        <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-white font-bold text-2xl">H</span>
        </div>
        <h1 className="text-white font-bold text-xl">{PRODUCT_NAME}</h1>
        <p className="text-indigo-200 text-xs mt-0.5">{COMPANY_NAME}</p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-7 py-2 overflow-y-auto">
        <h2 className="text-slate-800 font-bold text-lg mb-0.5">Welcome 👋</h2>
        <p className="text-slate-400 text-xs mb-5">Sign in for full access or take a quick tour first</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Employee ID / Role
            </label>
            <input type="text" value={empId}
              onChange={e => { setEmpId(e.target.value); setError(''); }}
              placeholder="e.g. EMP1001  ·  hr  ·  manager  ·  admin"
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition text-slate-800 placeholder-slate-400"
              autoCapitalize="none" autoCorrect="off" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition text-slate-800 pr-16" />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-semibold transition">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-2.5 text-xs text-red-600 font-medium">
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition disabled:opacity-50 shadow-md">
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-300 font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* Tour button */}
        <button onClick={onGuest}
          className="w-full bg-slate-50 border-2 border-slate-200 text-slate-600 font-semibold py-3 rounded-2xl text-sm hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition">
          👀 Take a Guided Tour
          <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
            See what the bot can do · No login needed
          </span>
        </button>

        {/* Credentials hint */}
        <div className="mt-4">
          <button onClick={() => setShowHelp(h => !h)}
            className="w-full text-xs text-indigo-400 hover:text-indigo-600 font-medium transition text-center">
            {showHelp ? '▲ Hide credentials' : '▼ View default credentials'}
          </button>
          {showHelp && (
            <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
              <p className="text-xs font-bold text-indigo-700 mb-2">🔑 Default Credentials</p>
              <div className="space-y-1.5 text-[11px]">
                {[
                  ['Employees', 'EMP1001 · emp@1234'],
                  ['Manager',   'manager · mgr@1234'],
                  ['HR',        'hr · hr@1234'],
                  ['Admin',     'admin · admin@1234'],
                ].map(([label, cred]) => (
                  <div key={label} className="flex justify-between items-center bg-white rounded-xl px-3 py-2 border border-indigo-100">
                    <span className="font-semibold text-slate-600">{label}</span>
                    <span className="font-mono text-indigo-700">{cred}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-4 text-center flex-shrink-0">
        <p className="text-[10px] text-slate-300">⚠️ AI in beta · responses may not always be accurate</p>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────
export default function HrmsChatbot() {
  const sessionId      = useRef(generateSessionId());
  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef  = useRef('');

  // screens: 'login' | 'tour' | 'chat'
  const [screen,          setScreen]          = useState('login');
  const [loggedInUser,    setLoggedInUser]     = useState(null);
  const [role,            setRole]            = useState(null);
  const [userName,        setUserName]        = useState('');
  const [language,        setLanguage]        = useState('en');
  const [messages,        setMessages]        = useState([]);
  const [input,           setInput]           = useState('');
  const [isLoading,       setIsLoading]       = useState(false);
  const [convState,       setConvState]       = useState('IDLE');
  const [convData,        setConvData]        = useState({});
  const [convHistory,     setConvHistory]     = useState([]);
  const [isListening,     setIsListening]     = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError,     setSpeechError]     = useState('');

  const t        = TRANSLATIONS[language];
  const roleInfo = ROLES.find(r => r.id === role);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechSupported(false); return; }
    const rec          = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.onstart  = () => { transcriptRef.current = ''; setSpeechError(''); setIsListening(true); };
    rec.onresult = (e) => {
      const tr = Array.from(e.results).map(r => r[0]?.transcript || '').join(' ').trim();
      transcriptRef.current = tr; setInput(tr);
    };
    rec.onerror = (e) => {
      const msgs = { 'not-allowed': 'Microphone blocked.', 'no-speech': 'No speech detected.' };
      setSpeechError(msgs[e.error] || 'Voice failed.'); setIsListening(false);
    };
    rec.onend = () => { setIsListening(false); if (transcriptRef.current) inputRef.current?.focus(); };
    recognitionRef.current = rec;
    setSpeechSupported(true);
    return () => rec.stop();
  }, []);

  useEffect(() => {
    if (recognitionRef.current) recognitionRef.current.lang = LANG_SPEECH[language] || 'en-IN';
  }, [language]);

  const handleLogin = (userData) => {
    setLoggedInUser(userData);
    setRole(userData.role);
    setUserName(userData.name || userData.role.toUpperCase());
    setConvData(userData.emp_id ? { name: userData.name, emp_id: userData.emp_id } : {});
    const welcome = ROLE_WELCOME[userData.role];
    setMessages([{ sender: 'bot', text: typeof welcome === 'function' ? welcome(userData.name) : welcome }]);
    setScreen('chat');
  };

  const handleLogout = () => {
    sessionId.current = generateSessionId();
    setScreen('login'); setLoggedInUser(null); setRole(null); setUserName('');
    setConvState('IDLE'); setConvData({}); setConvHistory([]);
    setInput(''); setSpeechError(''); setIsListening(false); setMessages([]);
    recognitionRef.current?.stop();
  };

  const toggleVoice = () => {
    if (!recognitionRef.current || isLoading) return;
    if (isListening) { recognitionRef.current.stop(); return; }
    transcriptRef.current = ''; setInput(''); setSpeechError('');
    recognitionRef.current.start();
  };

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isLoading) return;
    setMessages(prev => [...prev, { sender: 'user', text: trimmed }]);
    setInput(''); setSpeechError(''); setIsLoading(true);
    const hist = [...convHistory, { role: 'user', content: trimmed }];
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed, user_id: sessionId.current,
          role, state: convState, data: convData, history: hist, language,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const reply  = result.response || 'I am having trouble responding. Please try again.';
      setConvState(result.state || 'IDLE');
      setConvData(result.data || {});
      setConvHistory([...hist, { role: 'assistant', content: reply }]);
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'bot', text: "I'm having trouble connecting. Please try again." }]);
    } finally {
      setIsLoading(false); inputRef.current?.focus();
    }
  };

  // ── Screen routing ──
  if (screen === 'login') return <LoginScreen onLogin={handleLogin} onGuest={() => setScreen('tour')} />;
  if (screen === 'tour')  return <GuestTutorial onLoginClick={handleLogout} />;

  const showChips = messages.length <= 2 && !isLoading;

  return (
    <div className="flex flex-col h-[680px] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-5 py-3 shadow-md flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <a href="https://futureinvo.com" target="_blank" rel="noreferrer"
            className="text-xs font-semibold text-indigo-100 tracking-widest uppercase hover:text-white transition">
            🌐 {COMPANY_NAME}
          </a>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-white/15 rounded-full p-0.5">
              {['en','hi','te','ta'].map(lang => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
                    language === lang ? 'bg-white text-indigo-700' : 'text-indigo-100 hover:text-white'
                  }`}>
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>
            <button onClick={handleLogout}
              className="text-xs text-indigo-200 hover:text-white transition px-2 py-1 rounded-full hover:bg-white/10 font-medium">
              Logout
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0 text-lg">
            {roleInfo?.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">{userName}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                {roleInfo?.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/30 text-green-200 border border-green-300/30">
                ✓ Logged in
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              <p className="text-xs text-indigo-100 font-medium">{t.online}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {showChips && roleInfo && (
          <div className="flex flex-wrap gap-2 mb-3 ml-10">
            {roleInfo.chips.map(chip => (
              <button key={chip} onClick={() => send(chip)}
                className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:border-indigo-400 transition font-medium shadow-sm">
                {chip}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mr-2.5 mt-1 flex-shrink-0">
              <span className="text-white text-xs font-bold">H</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0,150,300].map(d => (
                  <span key={d} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); send(); }}
        className="px-4 py-3 bg-white border-t border-slate-100 flex-shrink-0">
        <div className="flex gap-2 items-center">
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isListening ? t.listening : t.placeholder}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 transition disabled:opacity-50 text-slate-800 placeholder-slate-400 ${
              isListening ? 'bg-red-50 border border-red-200' : 'bg-slate-100 focus:bg-white'
            }`}
          />
          {speechSupported && (
            <button type="button" onClick={toggleVoice} disabled={isLoading}
              className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition border ${
                isListening
                  ? 'bg-red-500 border-red-500 text-white animate-pulse'
                  : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'
              } disabled:opacity-40`}>
              <MicIcon />
            </button>
          )}
          <button type="submit" disabled={isLoading || !input.trim()}
            className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-full flex items-center justify-center hover:opacity-90 transition disabled:opacity-40 shadow-md flex-shrink-0">
            <svg className="w-4 h-4 text-white translate-x-0.5" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <div className="mt-1.5 min-h-[14px] text-center text-[10px] text-slate-400">
          {speechError
            ? <span className="text-red-500">{speechError}</span>
            : isListening
              ? <span className="text-red-500 font-medium">🔴 Listening — speak now</span>
              : <span>⚠️ AI in beta · responses may not always be accurate · {COMPANY_NAME}</span>
          }
        </div>
      </form>
    </div>
  );
}