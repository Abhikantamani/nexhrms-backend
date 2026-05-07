import { useState } from 'react';
import HrmsChatbot from './components/HrmsChatbot';
import EssMssDashboard from './components/EssMssDashboard';

export default function App() {
  const [page, setPage] = useState('chat');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100">
      {/* Top Nav */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <p className="font-bold text-indigo-700 text-lg">NexHRMS</p>
        <div className="flex gap-2 ml-4">
          <button onClick={() => setPage('chat')}
            className={`text-sm px-4 py-1.5 rounded-full font-medium transition ${
              page === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}>
            🤖 AI Assistant
          </button>
          <button onClick={() => setPage('ess')}
            className={`text-sm px-4 py-1.5 rounded-full font-medium transition ${
              page === 'ess' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}>
            👤 ESS / MSS
          </button>
        </div>
        <p className="ml-auto text-xs text-slate-400">Future Invo Solutions</p>
      </div>

      {/* Page Content */}
      <div className="flex items-start justify-center p-4 pt-6">
        {page === 'chat'
          ? <HrmsChatbot />
          : <EssMssDashboard />
        }
      </div>
    </div>
  );
}