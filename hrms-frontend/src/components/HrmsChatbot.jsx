import { useState, useRef, useEffect } from 'react';

const BACKEND_URL  = 'https://nexhrms-backend.onrender.com';
const COMPANY_NAME = 'Future Invo Solutions';
const PRODUCT_NAME = 'NexHRMS';

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substring(2, 9);
}

// ── Role config ────────────────────────────────────────────────────
const ROLES = [
  {
    id: 'employee',
    label: 'Employee',
    emoji: '👤',
    color: 'bg-green-500',
    lightColor: 'bg-green-50 border-green-200 text-green-700',
    desc: 'Apply leave, check balance, mark attendance',
    chips: ['Apply for leave', 'Check my leave balance', 'Mark my attendance', 'View my profile'],
  },
  {
    id: 'manager',
    label: 'Manager',
    emoji: '👔',
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50 border-orange-200 text-orange-700',
    desc: 'Approve leaves, view team attendance',
    chips: ['Show my team attendance', 'Approve leave request', 'View pending leaves', 'Show team report'],
  },
  {
    id: 'hr',
    label: 'HR',
    emoji: '🧑‍💼',
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 border-blue-200 text-blue-700',
    desc: 'Add employees, generate letters, manage policies',
    chips: ['Add a new employee', 'Generate offer letter', 'View all employees', 'Check leave policies'],
  },
  {
    id: 'admin',
    label: 'Admin',
    emoji: '⚙️',
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50 border-purple-200 text-purple-700',
    desc: 'Full system access and reports',
    chips: ['Show all employees', 'View admin report', 'Show all tickets', 'Generate salary report'],
  },
];

// ── Role-specific welcome messages ─────────────────────────────────
const ROLE_WELCOME = {
  employee: (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **Personal HR Assistant**.\n\nI can help you with:\n✅ Apply for leave\n📅 Check your leave balance\n🕐 Mark your attendance\n📄 View your profile\n\nWhat would you like to do today?`,
  manager:  (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **Team Manager Assistant**.\n\nI can help you with:\n✅ Approve or reject leave requests\n👥 View your team's attendance\n📊 See pending leave requests\n📋 View team reports\n\nWhat would you like to do?`,
  hr:       (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm the **HR Administration Assistant**.\n\nI can help you with:\n➕ Add new employees\n📄 Generate HR letters (Offer, Experience, Relieving)\n👥 View and manage all employees\n📋 Manage leave policies\n\nWhat would you like to do?`,
  admin:    (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm the **System Administrator**.\n\nI have full access to:\n👥 All employee data\n📊 Full reports and analytics\n🎫 All support tickets\n💰 Salary and payroll info\n\nWhat would you like to do?`,
};

const TRANSLATIONS = {
  en: { placeholder: 'Type your message...', listening: '🎙️ Listening... speak now', newChat: 'New Chat', online: 'Online · Powered by Groq AI' },
  hi: { placeholder: 'अपना संदेश टाइप करें...', listening: '🎙️ सुन रहा हूँ...', newChat: 'नई बातचीत', online: 'ऑनलाइन · Groq AI' },
  te: { placeholder: 'మీ సందేశం టైప్ చేయండి...', listening: '🎙️ వింటున్నాను...', newChat: 'కొత్త సంభాషణ', online: 'ఆన్‌లైన్ · Groq AI' },
  ta: { placeholder: 'உங்கள் செய்தியை தட்டச்சு செய்யுங்கள்...', listening: '🎙️ கேட்கிறேன்...', newChat: 'புதிய உரையாடல்', online: 'ஆன்லைன் · Groq AI' },
};

const LANG_LABELS = { en: 'EN', hi: 'HI', te: 'TE', ta: 'TA' };
const LANG_SPEECH  = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN' };

// ── Markdown renderer ──────────────────────────────────────────────
function renderMarkdown(text) {
  return text.split('\n').map((line, i, arr) => {
    const isLast = i === arr.length - 1;
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells   = line.split('|').filter(c => c.trim() !== '');
      const isSep   = cells.every(c => /^[-: ]+$/.test(c));
      const isEmpty = cells.every(c => c.trim() === '');
      if (isSep || isEmpty) return null;
      return (
        <div key={i} className="flex text-xs border-b border-slate-100 last:border-0 bg-slate-50 rounded">
          {cells.map((cell, j) => (
            <span key={j} className="flex-1 px-2 py-1.5 text-slate-700">{cell.trim()}</span>
          ))}
        </div>
      );
    }
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={j} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={j}>{part.slice(1, -1)}</em>;
      return <span key={j}>{part}</span>;
    });
    return <span key={i}>{rendered}{!isLast ? '\n' : ''}</span>;
  }).filter(Boolean);
}

// ── Message bubble ─────────────────────────────────────────────────
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

// ── PIN config (used only when skipping login) ─────────────────────
const ROLE_PINS = {
  employee: null,
  manager:  '5678',
  hr:       '9012',
  admin:    '0000',
};

// ── LOGIN SCREEN ───────────────────────────────────────────────────
function LoginScreen({ onLogin, onSkip }) {
  const [empId,     setEmpId]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!empId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: empId.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data); // pass full user object
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[680px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-white font-bold text-2xl">H</span>
        </div>
        <h1 className="text-white font-bold text-xl">{PRODUCT_NAME}</h1>
        <p className="text-indigo-200 text-xs mt-1 font-medium">{COMPANY_NAME}</p>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex flex-col justify-center px-7 py-4">
        <h2 className="text-slate-800 font-bold text-lg mb-1">Welcome back 👋</h2>
        <p className="text-slate-400 text-xs mb-6">Sign in to access your HR dashboard</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Employee ID / Role field */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
              Employee ID or Role
            </label>
            <input
              type="text"
              value={empId}
              onChange={e => { setEmpId(e.target.value); setError(''); }}
              placeholder="e.g. EMP1001  or  hr  or  manager"
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition text-slate-800"
              autoCapitalize="none"
            />
            <p className="text-[10px] text-slate-400 mt-1 ml-1">
              Employees: use your Employee ID &nbsp;|&nbsp; HR/Manager/Admin: type your role
            </p>
          </div>

          {/* Password field */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition text-slate-800 pr-12"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-2.5 text-xs text-red-600 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Login button */}
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold py-3 rounded-2xl text-sm hover:opacity-90 transition disabled:opacity-50 shadow-md mt-1">
            {loading ? '⏳ Signing in...' : 'Sign In →'}
          </button>
        </form>

        {/* Hint box */}
        <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold text-indigo-700 mb-2">🔑 Default Credentials</p>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-indigo-600">
            <span>Employees:</span>     <span className="font-mono">emp_id / emp@1234</span>
            <span>Manager:</span>       <span className="font-mono">manager / mgr@1234</span>
            <span>HR:</span>            <span className="font-mono">hr / hr@1234</span>
            <span>Admin:</span>         <span className="font-mono">admin / admin@1234</span>
          </div>
        </div>

        {/* Skip login */}
        <button onClick={onSkip}
          className="mt-4 text-xs text-slate-400 hover:text-indigo-600 transition text-center font-medium">
          Continue without login →
        </button>
      </div>

      <div className="px-6 pb-4 text-center">
        <p className="text-[10px] text-slate-300">⚠️ AI in beta · responses may not always be accurate</p>
      </div>
    </div>
  );
}

// ── Role Selection + PIN Screen (used when skipping login) ─────────
function RoleSelect({ onSelect }) {
  const [step,        setStep]        = useState('pick');
  const [selected,    setSelected]    = useState(null);
  const [pin,         setPin]         = useState('');
  const [error,       setError]       = useState('');
  const [shake,       setShake]       = useState(false);
  const pinRef = useRef(null);

  const handleRolePick = (role) => {
    if (ROLE_PINS[role] === null) {
      onSelect(role, null); // no name when skipping login
      return;
    }
    setSelected(role);
    setPin('');
    setError('');
    setStep('pin');
    setTimeout(() => pinRef.current?.focus(), 100);
  };

  const handlePinDigit = (digit) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');
    if (newPin.length === 4) setTimeout(() => checkPin(newPin), 150);
  };

  const handleDelete = () => { setPin(p => p.slice(0, -1)); setError(''); };

  const checkPin = (enteredPin) => {
    if (enteredPin === ROLE_PINS[selected]) {
      onSelect(selected, null);
    } else {
      setShake(true);
      setError('Incorrect PIN. Please try again.');
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const roleInfo = ROLES.find(r => r.id === selected);

  if (step === 'pick') {
    return (
      <div className="flex flex-col h-[680px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <h1 className="text-white font-bold text-lg">{PRODUCT_NAME} Assistant</h1>
          <p className="text-indigo-200 text-xs mt-1">{COMPANY_NAME}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <p className="text-center text-sm font-semibold text-slate-600 mb-1">Who are you?</p>
          <p className="text-center text-xs text-slate-400 mb-5">Select your role to get started</p>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(r => (
              <button key={r.id} onClick={() => handleRolePick(r.id)}
                className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:shadow-md transition group text-center">
                <div className={`w-12 h-12 rounded-xl ${r.color} flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition`}>
                  {r.emoji}
                </div>
                <p className="font-bold text-slate-800 text-sm">{r.label}</p>
                <p className="text-[11px] text-slate-400 leading-tight">{r.desc}</p>
                {ROLE_PINS[r.id] !== null && (
                  <span className="text-[10px] text-slate-300 flex items-center gap-1">🔒 PIN required</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5 text-center">
          <p className="text-[10px] text-slate-300">⚠️ AI in beta · responses may not always be accurate</p>
        </div>
      </div>
    );
  }

  const KEYPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];
  return (
    <div className="flex flex-col h-[680px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-6 py-5 text-center">
        <div className={`w-12 h-12 rounded-xl ${roleInfo?.color} flex items-center justify-center text-2xl mx-auto mb-3 shadow-md`}>
          {roleInfo?.emoji}
        </div>
        <h1 className="text-white font-bold text-lg">{roleInfo?.label} Login</h1>
        <p className="text-indigo-200 text-xs mt-1">Enter your {roleInfo?.label} PIN to continue</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-4">
        <div className="flex gap-4 mb-2" style={shake ? { animation: 'shake 0.4s ease-in-out' } : {}}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < pin.length ? 'bg-indigo-600 border-indigo-600 scale-110' : 'bg-transparent border-slate-300'
            }`} />
          ))}
        </div>
        <p className={`text-xs mb-5 h-4 font-medium transition-all ${error ? 'text-red-500' : 'text-transparent'}`}>
          {error || '.'}
        </p>
        <div className="grid grid-cols-3 gap-3 w-full max-w-[220px]">
          {KEYPAD.flat().map((key, i) => {
            if (key === '') return <div key={i} />;
            return (
              <button key={i} onClick={() => key === '⌫' ? handleDelete() : handlePinDigit(key)}
                className={`h-14 rounded-2xl text-lg font-semibold transition active:scale-95 ${
                  key === '⌫' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              : 'bg-slate-50 text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 shadow-sm'
                }`}>
                {key}
              </button>
            );
          })}
        </div>
        <button onClick={() => { setStep('pick'); setPin(''); setError(''); }}
          className="mt-6 text-xs text-slate-400 hover:text-slate-600 transition flex items-center gap-1">
          ← Back to role selection
        </button>
      </div>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// ── Main Chat Component ────────────────────────────────────────────
export default function HrmsChatbot() {
  const sessionId      = useRef(generateSessionId());
  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef  = useRef('');

  // Role is set ONCE at start — locked until New Chat
  const [role,            setRole]            = useState(null); // null = show role picker
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

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Speech recognition setup
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechSupported(false); return; }
    const recognition          = new SR();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.onstart  = () => { transcriptRef.current = ''; setSpeechError(''); setIsListening(true); };
    recognition.onresult = (e) => {
      const tr = Array.from(e.results).map(r => r[0]?.transcript || '').join(' ').trim();
      transcriptRef.current = tr;
      setInput(tr);
    };
    recognition.onerror = (e) => {
      const errs = { 'not-allowed': 'Microphone access blocked.', 'no-speech': 'No speech detected.' };
      setSpeechError(errs[e.error] || 'Voice input failed.');
      setIsListening(false);
    };
    recognition.onend = () => { setIsListening(false); if (transcriptRef.current) inputRef.current?.focus(); };
    recognitionRef.current = recognition;
    setSpeechSupported(true);
    return () => recognition.stop();
  }, []);

  // Update speech recognition language
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANG_SPEECH[language] || 'en-IN';
    }
  }, [language]);

  // When role is selected — set welcome message
  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setMessages([{ sender: 'bot', text: ROLE_WELCOME[selectedRole] }]);
  };

  // New Chat — go back to role picker
  const handleReset = () => {
    sessionId.current = generateSessionId();
    setRole(null);
    setConvState('IDLE');
    setConvData({});
    setConvHistory([]);
    setInput('');
    setSpeechError('');
    setIsListening(false);
    setMessages([]);
    recognitionRef.current?.stop();
  };

  const toggleVoice = () => {
    if (!recognitionRef.current || isLoading) return;
    if (isListening) { recognitionRef.current.stop(); return; }
    transcriptRef.current = '';
    setInput('');
    setSpeechError('');
    recognitionRef.current.start();
  };

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isLoading) return;
    setMessages(prev => [...prev, { sender: 'user', text: trimmed }]);
    setInput('');
    setSpeechError('');
    setIsLoading(true);
    const updatedHistory = [...convHistory, { role: 'user', content: trimmed }];
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:  trimmed,
          user_id:  sessionId.current,
          role:     role,
          state:    convState,
          data:     convData,
          history:  updatedHistory,
          language: language,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result   = await res.json();
      const botReply = result.response || 'I am having trouble responding. Please try again.';
      setConvState(result.state || 'IDLE');
      setConvData(result.data   || {});
      setConvHistory([...updatedHistory, { role: 'assistant', content: botReply }]);
      setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'bot', text: "I'm having trouble connecting. Please try again." }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Show role picker if no role selected
  if (!role) return <RoleSelect onSelect={handleRoleSelect} />;

  const showChips = messages.length <= 2 && !isLoading;

  return (
    <div className="flex flex-col h-[680px] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-500 px-5 py-3 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <a href="https://futureinvo.com" target="_blank" rel="noreferrer"
            className="text-xs font-semibold text-indigo-100 tracking-widest uppercase hover:text-white transition">
            🌐 {COMPANY_NAME}
          </a>
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex gap-0.5 bg-white/15 rounded-full p-0.5">
              {['en', 'hi', 'te', 'ta'].map(lang => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
                    language === lang ? 'bg-white text-indigo-700' : 'text-indigo-100 hover:text-white'
                  }`}>
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>
            {/* New Chat — goes back to role picker */}
            <button onClick={handleReset}
              className="text-xs text-indigo-200 hover:text-white transition px-2 py-1 rounded-full hover:bg-white/10 font-medium">
              {t.newChat}
            </button>
          </div>
        </div>

        {/* Bot identity — shows LOCKED role */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0 text-lg">
            {roleInfo?.emoji}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">{PRODUCT_NAME} HR Assistant</p>
              {/* Role badge — static, not a dropdown */}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                {roleInfo?.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              <p className="text-xs text-indigo-100 font-medium">{t.online}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {/* Quick chips — only shown at start */}
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

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mr-2.5 mt-1 flex-shrink-0">
              <span className="text-white text-xs font-bold">H</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="px-4 py-3 bg-white border-t border-slate-100">
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
            <svg className="w-4 h-4 text-white translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
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