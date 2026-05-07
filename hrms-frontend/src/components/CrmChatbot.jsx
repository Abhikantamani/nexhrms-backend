import { useState, useRef, useEffect } from 'react';

const BACKEND_URL  = 'https://nexhrms-backend.onrender.com';  // Update with your actual Render URL
const COMPANY_NAME = 'Future Invo Solutions';
const PRODUCT_NAME = 'NexHRMS';

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substring(2, 9);
}

const TRANSLATIONS = {
  en: {
    welcome: "👋 Hello! I'm your AI HR Assistant for NexHRMS by Future Invo Solutions.\n\nI can help you with employee management, leaves, attendance, payroll, assets, HR letters, and more.\n\nWhat would you like to do today?",
    placeholder: "Ask me anything about HR...",
    listening: "🎙️ Listening... speak now",
    newChat: "New Chat",
    online: "Online · Powered by Gemini AI",
    feedbackQ: "How was your experience? 😊",
    feedbackOptional: "Any comments? (optional)",
    submitFeedback: "Submit Feedback",
    thankYouFeedback: "Thank you for your feedback! 🙏",
    helpImprove: "It helps us improve NexHRMS.",
  },
  hi: {
    welcome: "👋 नमस्ते! मैं Future Invo Solutions के NexHRMS के लिए आपका AI HR असिस्टेंट हूँ।\n\nमैं कर्मचारी प्रबंधन, छुट्टी, उपस्थिति, वेतन, संपत्ति और HR पत्रों में मदद कर सकता हूँ।\n\nआज आप क्या करना चाहते हैं?",
    placeholder: "HR के बारे में कुछ भी पूछें...",
    listening: "🎙️ सुन रहा हूँ... अब बोलें",
    newChat: "नई बातचीत",
    online: "ऑनलाइन · Gemini AI द्वारा",
    feedbackQ: "आपका अनुभव कैसा रहा? 😊",
    feedbackOptional: "कोई टिप्पणी? (वैकल्पिक)",
    submitFeedback: "प्रतिक्रिया सबमिट करें",
    thankYouFeedback: "आपकी प्रतिक्रिया के लिए धन्यवाद! 🙏",
    helpImprove: "यह हमें NexHRMS में सुधार करने में मदद करता है।",
  },
  te: {
    welcome: "👋 నమస్కారం! నేను Future Invo Solutions కి చెందిన NexHRMS కోసం మీ AI HR సహాయకుడిని.\n\nనేను ఉద్యోగి నిర్వహణ, సెలవులు, హాజరు, జీతం, ఆస్తులు మరియు HR లేఖలలో సహాయం చేయగలను.\n\nమీరు ఏమి చేయాలనుకుంటున్నారు?",
    placeholder: "HR గురించి ఏదైనా అడగండి...",
    listening: "🎙️ వింటున్నాను... ఇప్పుడు మాట్లాడండి",
    newChat: "కొత్త సంభాషణ",
    online: "ఆన్‌లైన్ · Gemini AI ద్వారా",
    feedbackQ: "మీ అనుభవం ఎలా ఉంది? 😊",
    feedbackOptional: "ఏదైనా వ్యాఖ్యలు? (ఐచ్ఛికం)",
    submitFeedback: "ప్రతిక్రియ సమర్పించండి",
    thankYouFeedback: "మీ ప్రతిక్రియ కోసం ధన్యవాదాలు! 🙏",
    helpImprove: "ఇది NexHRMS లో సుధారించటానికి సహాయం చేస్తుంది.",
  },
  ta: {
    welcome: "👋 வணக்கம்! நான் Future Invo Solutions இன் NexHRMS க்கான உங்கள் AI HR உதவியாளர்.\n\nநான் பணியாளர் மேலாண்மை, விடுப்பு, வருகை, சம்பளம், சொத்துக்கள் மற்றும் HR கடிதங்களில் உதவ முடியும்.\n\nநீங்கள் இன்று என்ன செய்ய விரும்புகிறீர்கள்?",
    placeholder: "HR பற்றி எதுவும் கேளுங்கள்...",
    listening: "🎙️ கேட்டுக்கொண்டிருக்கிறேன்... இப்போது பேசுங்கள்",
    newChat: "புதிய உரையாடல்",
    online: "ஆன்லைன் · Gemini AI ஆல்",
    feedbackQ: "உங்கள் அனுபவம் எப்படி இருந்தது? 😊",
    feedbackOptional: "ஏதாவது கருத்துகள்? (விருப்பத்தேர்வு)",
    submitFeedback: "கருத்தை சமர்ப்பிக்கவும்",
    thankYouFeedback: "உங்கள் கருத்துக்கு நன்றி! 🙏",
    helpImprove: "இது NexHRMS ஐ மேம்படுத்த உதவுகிறது.",
  },
};

const LANG_LABELS = { en: 'EN', hi: 'HI', te: 'TE', ta: 'TA' };
const LANG_SPEECH  = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN' };

const CHIPS = [
  '👤 Add new employee',
  '🏖️ Apply for leave',
  '📊 Check my leave balance',
  '✅ Mark my attendance',
  '💻 Assign an asset',
  '📄 Generate HR letter',
];

const ROLE_COLORS = {
  admin:    'bg-purple-100 text-purple-700',
  hr:       'bg-blue-100 text-blue-700',
  manager:  'bg-orange-100 text-orange-700',
  employee: 'bg-green-100 text-green-700',
};

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

export default function HrmsChatbot() {
  const sessionId      = useRef(generateSessionId());
  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef  = useRef('');

  const [language,        setLanguage]        = useState('en');
  const t = TRANSLATIONS[language];

  const [role,            setRole]            = useState('employee');
  const [messages,        setMessages]        = useState([{ sender: 'bot', text: TRANSLATIONS.en.welcome }]);
  const [input,           setInput]           = useState('');
  const [isLoading,       setIsLoading]       = useState(false);
  const [convState,       setConvState]       = useState('IDLE');
  const [convData,        setConvData]        = useState({});
  const [convHistory,     setConvHistory]     = useState([]);
  const [isListening,     setIsListening]     = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError,     setSpeechError]     = useState('');
  const [showFeedback,    setShowFeedback]    = useState(false);
  const [fbRating,        setFbRating]        = useState(0);
  const [fbComment,       setFbComment]       = useState('');
  const [fbSubmitted,     setFbSubmitted]     = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].sender === 'bot') {
        return [{ sender: 'bot', text: TRANSLATIONS[language].welcome }];
      }
      return prev;
    });
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANG_SPEECH[language] || 'en-IN';
    }
  }, [language]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechSupported(false); return; }
    const recognition          = new SR();
    recognition.lang           = LANG_SPEECH[language] || 'en-IN';
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

  const toggleVoice = () => {
    if (!recognitionRef.current || isLoading) return;
    if (isListening) { recognitionRef.current.stop(); return; }
    transcriptRef.current = '';
    setInput('');
    setSpeechError('');
    recognitionRef.current.start();
  };

  const send = async (text) => {
    const trimmed = text.trim();
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
      const closeWords = ['thank you', 'thanks', 'goodbye', 'bye', 'ok bye', 'no thank', 'thats all', "that's all", 'done', 'see you'];
      if (closeWords.some(w => trimmed.toLowerCase().includes(w)) && messages.length >= 4) {
        setTimeout(() => setShowFeedback(true), 1200);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'bot', text: "I'm having trouble connecting. Please check the backend is running and try again." }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); send(input); };

  const handleReset = () => {
    sessionId.current = generateSessionId();
    setConvState('IDLE');
    setConvData({});
    setConvHistory([]);
    setInput('');
    setSpeechError('');
    setIsListening(false);
    setShowFeedback(false);
    setFbRating(0);
    setFbComment('');
    setFbSubmitted(false);
    recognitionRef.current?.stop();
    setMessages([{ sender: 'bot', text: TRANSLATIONS[language].welcome }]);
  };

  const submitFeedback = async () => {
    if (!fbRating) return;
    try {
      await fetch(`${BACKEND_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: sessionId.current, rating: fbRating, comment: fbComment }),
      });
    } catch (e) { console.error(e); }
    setFbSubmitted(true);
  };

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
            {/* Role Selector */}
            <select value={role} onChange={e => setRole(e.target.value)}
              className="text-[10px] font-bold bg-white/15 text-white border border-white/20 rounded-full px-2 py-0.5 cursor-pointer focus:outline-none">
              <option value="employee" className="text-slate-800">Employee</option>
              <option value="manager"  className="text-slate-800">Manager</option>
              <option value="hr"       className="text-slate-800">HR</option>
              <option value="admin"    className="text-slate-800">Admin</option>
            </select>
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
            <button onClick={handleReset}
              className="text-xs text-indigo-200 hover:text-white transition px-2 py-1 rounded-full hover:bg-white/10 font-medium">
              {t.newChat}
            </button>
          </div>
        </div>
        {/* Bot identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">{PRODUCT_NAME} HR Assistant</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]} bg-opacity-90`}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
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

        {showChips && (
          <div className="flex flex-wrap gap-2 mb-3 ml-10">
            {CHIPS.map(chip => (
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
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feedback */}
        {showFeedback && (
          <div className="mx-2 mb-4 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
            {!fbSubmitted ? (
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">{t.feedbackQ}</p>
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => setFbRating(star)}
                      className={`text-lg transition ${fbRating >= star ? 'text-yellow-400' : 'text-slate-200 hover:text-yellow-300'}`}>
                      ★
                    </button>
                  ))}
                </div>
                <textarea value={fbComment} onChange={e => setFbComment(e.target.value)}
                  placeholder={t.feedbackOptional} rows={2}
                  className="w-full text-xs px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none text-slate-700 placeholder-slate-300 mb-2" />
                <button onClick={submitFeedback} disabled={!fbRating}
                  className="w-full bg-indigo-600 text-white text-xs font-semibold py-1.5 rounded-xl hover:bg-indigo-700 transition disabled:opacity-40">
                  {t.submitFeedback}
                </button>
              </div>
            ) : (
              <div className="px-4 py-3 text-center">
                <p className="text-sm font-semibold text-indigo-600">{t.thankYouFeedback}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.helpImprove}</p>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <form onSubmit={handleSubmit} className="px-4 py-3 bg-white border-t border-slate-100">
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
              : <span>Powered by Gemini AI · {COMPANY_NAME}</span>
          }
        </div>
      </form>
    </div>
  );
}