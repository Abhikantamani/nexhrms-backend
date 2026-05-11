import { useState, useRef, useEffect } from 'react';

const BACKEND_URL  = 'https://nexhrms-backend.onrender.com';
const COMPANY_NAME = 'Future Invo Solutions';
const PRODUCT_NAME = 'NexHRMS';

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substring(2, 9);
}

// All 7 roles from the website
const ROLES = [
  { id: 'employee',   label: 'Employee',    emoji: '👤', color: 'bg-green-500',   chips: ['How do I apply for leave?', 'Where can I see my payslips?', 'How to update my profile?', 'How to raise a support ticket?'] },
  { id: 'manager',    label: 'Manager',     emoji: '👔', color: 'bg-orange-500',  chips: ['How to approve team leaves?', 'Where is team attendance?', 'How to give performance feedback?', 'How to manage my squad?'] },
  { id: 'hr',         label: 'HR',          emoji: '🧑‍💼', color: 'bg-blue-500',    chips: ['How to add a new employee?', 'How to manage onboarding?', 'Where is recruitment section?', 'How to manage leave requests?'] },
  { id: 'admin',      label: 'Admin',       emoji: '🛡️', color: 'bg-indigo-500',  chips: ['How to manage departments?', 'Where are audit logs?', 'How to configure payroll?', 'How to manage branches?'] },
  { id: 'superadmin', label: 'Super Admin', emoji: '⚙️', color: 'bg-purple-500',  chips: ['How to add a company?', 'Where is user management?', 'How to set up automation?', 'How to view system logs?'] },
  { id: 'accountant', label: 'Accountant',  emoji: '💰', color: 'bg-yellow-500',  chips: ['How to process payroll?', 'Where are financial reports?', 'How to manage expenses?', 'How to configure salary structure?'] },
  { id: 'newuser',    label: 'New User',    emoji: '🆕', color: 'bg-teal-500',    chips: ['How do I get started?', 'Where do I upload documents?', 'How to complete my profile?', 'Where can I read company policies?'] },
];

const ROLE_WELCOME = {
  employee:   (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **NexHRMS Guide Bot**.\n\nI'll help you navigate the NexHRMS website as an **Employee**.\n\nI can guide you to:\n📋 Apply for leave → **/my-leaves**\n📅 View attendance → **/my-attendance**\n💰 Download payslips → **/my-payslips**\n📄 Manage documents → **/my-documents**\n🎫 Raise support tickets → **/helpdesk**\n\nWhat would you like to find?`,
  manager:    (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **NexHRMS Guide Bot**.\n\nI'll help you navigate the website as a **Manager**.\n\nI can guide you to:\n✅ Approve leaves → **/leave-approvals**\n👥 View team attendance → **/team-attendance**\n📊 Performance reviews → **/performance**\n🎯 Team goals → **/goals**\n📋 Team reports → **/team-reports**\n\nWhat would you like to find?`,
  hr:         (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **NexHRMS Guide Bot**.\n\nI'll help you navigate the website as **HR**.\n\nI can guide you to:\n➕ Add employees → **/add-member**\n📬 Invite employees → **/invite-member**\n🚀 Onboarding → **/onboarding**\n📋 Recruitment → **/recruitment**\n📄 Leave management → **/leave-management**\n\nWhat would you like to find?`,
  admin:      (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **NexHRMS Guide Bot**.\n\nI'll help you navigate the website as **Admin**.\n\nI can guide you to:\n🏢 Departments → **/departments**\n🌿 Branches → **/branches**\n📊 Reports → **/reports**\n📋 Audit logs → **/admin/audit-logs**\n💰 Payroll management → **/payroll-management**\n\nWhat would you like to find?`,
  superadmin: (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **NexHRMS Guide Bot**.\n\nI'll help you navigate as **Super Admin**.\n\nI can guide you to:\n🏭 Companies → **/companies**\n👥 User management → **/users**\n📋 Audit logs → **/super-admin/audit-logs**\n🤖 Automation → **/automation-center**\n💹 Financial reports → **/financial-reports**\n\nWhat would you like to find?`,
  accountant: (name) => `👋 Hello${name ? `, **${name}**` : ''}! I'm your **NexHRMS Guide Bot**.\n\nI'll help you navigate as **Accountant**.\n\nI can guide you to:\n💰 Payroll processing → **/payroll-processing**\n📊 Financial reports → **/financial-reports**\n🧾 Invoices → **/invoices**\n💸 Expenses → **/expenses**\n📋 Tax deductions → **/tax-deductions**\n\nWhat would you like to find?`,
  newuser:    (name) => `👋 Hello${name ? `, **${name}**` : ''}! Welcome to **NexHRMS**!\n\nI'll guide you through getting started as a **New User**.\n\nYour onboarding steps:\n1️⃣ Complete your profile → **/complete-profile**\n2️⃣ Upload documents → **/upload-documents**\n3️⃣ Read policies → **/policies**\n4️⃣ Explore knowledge base → **/knowledge-base**\n\nWhat would you like help with?`,
  guest:      ()     => `👋 Welcome to **${PRODUCT_NAME}** by ${COMPANY_NAME}!\n\nI'm the NexHRMS Guide Bot. I can show you how to use any feature of the website.\n\nNexHRMS helps you manage:\n👥 Employees & Onboarding\n📅 Leaves & Attendance\n💰 Payroll & Finance\n📋 Performance & Training\n\n🔐 **Login** to get role-specific guidance!\n\nWhat would you like to know?`,
};

const TRANSLATIONS = {
  en: { placeholder: 'Ask me how to use any feature...', online: 'Online · NexHRMS Guide Bot' },
  hi: { placeholder: 'कोई भी सुविधा के बारे में पूछें...', online: 'ऑनलाइन · NexHRMS गाइड बॉट' },
  te: { placeholder: 'ఏదైనా ఫీచర్ గురించి అడగండి...', online: 'ఆన్‌లైన్ · NexHRMS గైడ్ బాట్' },
  ta: { placeholder: 'எந்த அம்சத்தையும் பற்றி கேளுங்கள்...', online: 'ஆன்லைன் · NexHRMS கையேடு' },
};

const LANG_LABELS = { en: 'EN', hi: 'HI', te: 'TE', ta: 'TA' };
const LANG_SPEECH  = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN' };

// Tutorial steps for guest users
const TUTORIAL_STEPS = [
  { text: `👋 Welcome to **NexHRMS** by ${COMPANY_NAME}!\n\nThis is a quick tour of what the NexHRMS website can do. I'll walk you through each role and feature.\n\nTap **Next →** to begin!` },
  { text: `👤 **Employee Features**\n\nAs an Employee you can:\n✅ Apply and track leaves → **/my-leaves**\n📅 View your attendance → **/my-attendance**\n💰 Download payslips → **/my-payslips**\n📄 Upload/view documents → **/my-documents**\n🎫 Raise support tickets → **/helpdesk**\n\nAll from a clean, simple dashboard.` },
  { text: `👔 **Manager Features**\n\nManagers have extra controls:\n✅ Approve or reject team leave requests\n👥 View real-time team attendance\n📊 Give performance feedback\n🎯 Set and track team goals\n📋 Generate team reports\n\nAll accessible from **/manager-dashboard**.` },
  { text: `🧑‍💼 **HR Features**\n\nHR staff can:\n➕ Add new employees → **/add-member**\n📬 Invite members by email → **/invite-member**\n🚀 Manage onboarding checklists → **/onboarding**\n📋 Handle recruitment pipeline → **/recruitment**\n📚 Manage training programs → **/training**` },
  { text: `💰 **Finance & Payroll**\n\nAccountants can:\n💳 Process monthly payroll → **/payroll-processing**\n🧾 Generate invoices → **/invoices**\n💸 Approve expense claims → **/expenses**\n📊 View financial reports → **/financial-reports**\n\nFull payroll suite in one place.` },
  { text: `🌐 **Multi-Language Support**\n\nThe bot speaks:\n🇮🇳 English · हिंदी · తెలుగు · தமிழ்\n\nSwitch language anytime using the **EN / HI / TE / TA** buttons in the top-right corner.\n\nThe bot responds in your chosen language automatically.` },
  { text: `🔐 **Ready to get started?**\n\nThis was just a preview!\n\nTo get role-specific guidance:\n1. Click **Login** above\n2. Enter your role (e.g. **employee**, **manager**, **hr**)\n3. Enter your password\n4. Get personalised navigation help!\n\nDefault passwords are shown on the login screen.` },
];

function renderMarkdown(text) {
  return text.split('\n').map((line, i, arr) => {
    const isLast = i === arr.length - 1;
    const parts  = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={j} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mr-2.5 mt-1 flex-shrink-0 shadow-md">
          <span className="text-white text-xs font-bold">N</span>
        </div>
      )}
      <div className="max-w-[82%]">
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
            : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none shadow-md'
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

// ── GUEST TUTORIAL ─────────────────────────────────────────────────
function GuestTutorial({ onLoginClick }) {
  const [step, setStep]       = useState(0);
  const [messages, setMessages] = useState([{ sender: 'bot', text: TUTORIAL_STEPS[0].text }]);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleNext = () => {
    const next = step + 1;
    if (next >= TUTORIAL_STEPS.length) return;
    setStep(next);
    setMessages(prev => [...prev, { sender: 'bot', text: TUTORIAL_STEPS[next].text }]);
  };

  const isLast   = step === TUTORIAL_STEPS.length - 1;
  const progress = Math.round(((step + 1) / TUTORIAL_STEPS.length) * 100);

  return (
    <div className="flex flex-col h-[680px] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-blue-100 tracking-widest uppercase">🌐 {COMPANY_NAME}</span>
          <button onClick={onLoginClick}
            className="text-xs bg-white/20 text-white hover:bg-white/30 px-3 py-1 rounded-full font-semibold border border-white/30 transition">
            🔐 Login
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-lg flex-shrink-0">🙋</div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">{PRODUCT_NAME} Guide Bot</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 font-bold">Tour</span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">Step {step + 1} of {TUTORIAL_STEPS.length}</p>
          </div>
        </div>
        <div className="mt-3 bg-white/20 rounded-full h-1.5">
          <div className="bg-white rounded-full h-1.5 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-amber-700 font-medium">👀 Guided Tour — Login for personalised help</p>
        <button onClick={onLoginClick} className="text-xs text-blue-600 font-bold hover:underline">Login →</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-4 bg-white border-t border-slate-100 flex-shrink-0">
        {!isLast ? (
          <div className="flex gap-3">
            <button onClick={onLoginClick}
              className="flex-1 border-2 border-blue-200 text-blue-600 font-semibold py-3 rounded-2xl text-sm hover:bg-blue-50 transition">
              🔐 Login Now
            </button>
            <button onClick={handleNext}
              className="flex-1 bg-gradient-to-r from-blue-700 to-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition shadow-md">
              Next → ({step + 1}/{TUTORIAL_STEPS.length})
            </button>
          </div>
        ) : (
          <button onClick={onLoginClick}
            className="w-full bg-gradient-to-r from-blue-700 to-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition shadow-md">
            🔐 Login to Get Personalised Help
          </button>
        )}
        <p className="text-[10px] text-slate-300 text-center mt-2">⚠️ AI in beta · responses may not always be accurate</p>
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: empId.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (data.success) { onLogin(data); }
      else { setError(data.message || 'Login failed. Please try again.'); }
    } catch { setError('Cannot connect to server. Please try again.'); }
    finally { setLoading(false); }
  };

  const CREDENTIALS = [
    ['Employee',   'employee · emp@1234'],
    ['Manager',    'manager · mgr@1234'],
    ['HR',         'hr · hr@1234'],
    ['Admin',      'admin · admin@1234'],
    ['Super Admin','superadmin · super@1234'],
    ['Accountant', 'accountant · acc@1234'],
    ['New User',   'newuser · new@1234'],
  ];

  return (
    <div className="flex flex-col h-[680px] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-5 text-center flex-shrink-0">
        <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-bold text-2xl">N</span>
        </div>
        <h1 className="text-white font-bold text-xl">{PRODUCT_NAME}</h1>
        <p className="text-blue-200 text-xs mt-0.5">{COMPANY_NAME} · Guide Bot</p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-7 py-2 overflow-y-auto">
        <h2 className="text-slate-800 font-bold text-lg mb-0.5">Welcome 👋</h2>
        <p className="text-slate-400 text-xs mb-5">Login for role-specific guidance or take a quick tour</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wider">Your Role</label>
            <input type="text" value={empId} onChange={e => { setEmpId(e.target.value); setError(''); }}
              placeholder="employee · manager · hr · admin · accountant..."
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition text-slate-800 placeholder-slate-400"
              autoCapitalize="none" autoCorrect="off" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wider">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition text-slate-800 pr-16" />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-semibold">
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
            className="w-full bg-gradient-to-r from-blue-700 to-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition disabled:opacity-50 shadow-md">
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-xs text-slate-300">OR</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <button onClick={onGuest}
          className="w-full bg-slate-50 border-2 border-slate-200 text-slate-600 font-semibold py-2.5 rounded-2xl text-sm hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition">
          👀 Take a Guided Tour
          <span className="block text-[10px] font-normal text-slate-400 mt-0.5">See all features · No login needed</span>
        </button>

        <div className="mt-3">
          <button onClick={() => setShowHelp(h => !h)}
            className="w-full text-xs text-blue-400 hover:text-blue-600 font-medium transition text-center">
            {showHelp ? '▲ Hide credentials' : '▼ View default credentials'}
          </button>
          {showHelp && (
            <div className="mt-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <p className="text-xs font-bold text-blue-700 mb-2">🔑 Default Credentials</p>
              <div className="space-y-1 text-[11px]">
                {CREDENTIALS.map(([label, cred]) => (
                  <div key={label} className="flex justify-between items-center bg-white rounded-xl px-3 py-1.5 border border-blue-100">
                    <span className="font-semibold text-slate-600">{label}</span>
                    <span className="font-mono text-blue-700">{cred}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-3 text-center flex-shrink-0">
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

  const [screen,       setScreen]       = useState('login');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [role,         setRole]         = useState(null);
  const [userName,     setUserName]     = useState('');
  const [language,     setLanguage]     = useState('en');
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [convHistory,  setConvHistory]  = useState([]);
  const [isListening,  setIsListening]  = useState(false);
  const [speechOk,     setSpeechOk]     = useState(false);
  const [speechError,  setSpeechError]  = useState('');

  const t        = TRANSLATIONS[language];
  const roleInfo = ROLES.find(r => r.id === role);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true;
    rec.onstart  = () => { transcriptRef.current = ''; setSpeechError(''); setIsListening(true); };
    rec.onresult = (e) => { const tr = Array.from(e.results).map(r => r[0]?.transcript || '').join(' ').trim(); transcriptRef.current = tr; setInput(tr); };
    rec.onerror  = (e) => { setSpeechError({ 'not-allowed': 'Microphone blocked.', 'no-speech': 'No speech.' }[e.error] || 'Voice failed.'); setIsListening(false); };
    rec.onend    = () => { setIsListening(false); if (transcriptRef.current) inputRef.current?.focus(); };
    recognitionRef.current = rec;
    setSpeechOk(true);
    return () => rec.stop();
  }, []);

  useEffect(() => { if (recognitionRef.current) recognitionRef.current.lang = LANG_SPEECH[language] || 'en-IN'; }, [language]);

  const handleLogin = (userData) => {
    setLoggedInUser(userData);
    setRole(userData.role);
    setUserName(userData.name || userData.role.toUpperCase());
    const welcome = ROLE_WELCOME[userData.role];
    setMessages([{ sender: 'bot', text: typeof welcome === 'function' ? welcome(userData.name) : welcome }]);
    setScreen('chat');
  };

  const handleLogout = () => {
    sessionId.current = generateSessionId();
    setScreen('login'); setLoggedInUser(null); setRole(null); setUserName('');
    setConvHistory([]); setInput(''); setSpeechError(''); setIsListening(false); setMessages([]);
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, user_id: sessionId.current, role, history: hist, language }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const reply  = result.response || 'I am having trouble responding. Please try again.';
      setConvHistory([...hist, { role: 'assistant', content: reply }]);
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'bot', text: "I'm having trouble connecting. Please try again." }]);
    } finally {
      setIsLoading(false); inputRef.current?.focus();
    }
  };

  if (screen === 'login') return <LoginScreen onLogin={handleLogin} onGuest={() => setScreen('tour')} />;
  if (screen === 'tour')  return <GuestTutorial onLoginClick={handleLogout} />;

  const showChips = messages.length <= 2 && !isLoading;

  return (
    <div className="flex flex-col h-[680px] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <a href="https://futureinvo.com" target="_blank" rel="noreferrer"
            className="text-xs font-semibold text-blue-100 tracking-widest uppercase hover:text-white transition">
            🌐 {COMPANY_NAME}
          </a>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-white/15 rounded-full p-0.5">
              {['en','hi','te','ta'].map(lang => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${language === lang ? 'bg-white text-blue-700' : 'text-blue-100 hover:text-white'}`}>
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>
            <button onClick={handleLogout}
              className="text-xs text-blue-200 hover:text-white transition px-2 py-1 rounded-full hover:bg-white/10 font-medium">
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
              <p className="text-xs text-blue-100 font-medium">{t.online}</p>
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
                className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-50 hover:border-blue-400 transition font-medium shadow-sm">
                {chip}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mr-2.5 mt-1 flex-shrink-0">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0,150,300].map(d => <span key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="px-4 py-3 bg-white border-t border-slate-100 flex-shrink-0">
        <div className="flex gap-2 items-center">
          <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder={isListening ? '🎙️ Listening...' : t.placeholder}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-50 text-slate-800 placeholder-slate-400 ${
              isListening ? 'bg-red-50 border border-red-200' : 'bg-slate-100 focus:bg-white'
            }`} />
          {speechOk && (
            <button type="button" onClick={toggleVoice} disabled={isLoading}
              className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition border ${
                isListening ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
              } disabled:opacity-40`}>
              <MicIcon />
            </button>
          )}
          <button type="submit" disabled={isLoading || !input.trim()}
            className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center hover:opacity-90 transition disabled:opacity-40 shadow-md flex-shrink-0">
            <svg className="w-4 h-4 text-white translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <div className="mt-1.5 text-center text-[10px] text-slate-400">
          {speechError
            ? <span className="text-red-500">{speechError}</span>
            : isListening
              ? <span className="text-red-500 font-medium">🔴 Listening — speak now</span>
              : <span>⚠️ Guide bot only · does not perform HR operations · {COMPANY_NAME}</span>
          }
        </div>
      </form>
    </div>
  );
}
