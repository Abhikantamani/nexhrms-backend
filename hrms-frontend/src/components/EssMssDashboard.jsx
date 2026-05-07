import { useState, useEffect, useRef } from 'react';

const BACKEND_URL = 'https://nexhrms-backend.onrender.com';

// ── Helpers ───────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
    <div className="flex items-center justify-between mb-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <span className="text-xl">{icon}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
  </div>
);

const Badge = ({ text, color = 'blue' }) => {
  const map = {
    green:  'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue:   'bg-blue-100 text-blue-700',
    red:    'bg-red-100 text-red-700',
    teal:   'bg-teal-100 text-teal-700',
    gray:   'bg-slate-100 text-slate-600',
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[color] || map.blue}`}>{text}</span>;
};

const LeaveBar = ({ leave_type, total, used, remaining }) => {
  const pct   = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = remaining <= 2 ? 'bg-red-400' : remaining <= 5 ? 'bg-yellow-400' : 'bg-teal-500';
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-slate-700">{leave_type}</span>
        <span className="text-xs text-slate-500">{remaining} / {total} left</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Spinner = ({ color = 'indigo' }) => (
  <div className="flex justify-center py-10">
    <div className={`animate-spin w-8 h-8 border-4 border-${color}-400 border-t-transparent rounded-full`} />
  </div>
);

// ── Employee Search Box ───────────────────────────────────────────
function EmployeeSearch({ onSelect, placeholder = "Search by name or ID..." }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const debounce = useRef(null);

  const search = (q) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${BACKEND_URL}/api/ess/search/${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  };

  const select = (emp) => {
    setQuery(emp.name);
    setOpen(false);
    onSelect(emp);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 text-sm bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
      />
      {loading && (
        <div className="absolute right-3 top-3">
          <div className="animate-spin w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full" />
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
          {results.map((emp, i) => (
            <button key={i} onClick={() => select(emp)}
              className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition border-b border-slate-50 last:border-0">
              <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
              <p className="text-xs text-slate-400">{emp.emp_id} · {emp.department} · {emp.designation}</p>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-20 w-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-lg px-4 py-3 text-xs text-slate-400">
          No employees found for "{query}"
        </div>
      )}
    </div>
  );
}

// ── ESS Dashboard ─────────────────────────────────────────────────
function EssDashboard() {
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [tab,         setTab]         = useState('overview');
  const [checkoutMsg, setCheckoutMsg] = useState('');

  const loadEss = async (emp) => {
    setSelectedEmp(emp);
    setLoading(true);
    setData(null);
    setTab('overview');
    setCheckoutMsg('');
    try {
      const res  = await fetch(`${BACKEND_URL}/api/ess/${emp.emp_id}`);
      const json = await res.json();
      setData(json);
    } catch { setData({ error: 'Failed to load data' }); }
    setLoading(false);
  };

  const handleCheckout = async () => {
    if (!selectedEmp) return;
    try {
      const res  = await fetch(`${BACKEND_URL}/api/ess/checkout/${selectedEmp.emp_id}`, { method: 'POST' });
      const json = await res.json();
      setCheckoutMsg(json.success ? `✅ Checked out at ${json.check_out}` : `❌ ${json.error}`);
    } catch { setCheckoutMsg('❌ Failed to mark checkout'); }
  };

  const TABS = [
    { id: 'overview',    label: '📊 Overview' },
    { id: 'leaves',      label: '🏖️ Leaves' },
    { id: 'attendance',  label: '📅 Attendance' },
    { id: 'assets',      label: '💻 Assets' },
    { id: 'letters',     label: '📄 Letters' },
  ];

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2 font-medium">Search employee by name or ID:</p>
        <EmployeeSearch onSelect={loadEss} placeholder="Type name e.g. Rahul or EMP1001..." />
      </div>

      {/* State: empty */}
      {!selectedEmp && (
        <div className="text-center py-10 text-slate-400">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">Search for an employee above to view their dashboard</p>
        </div>
      )}

      {/* State: loading */}
      {selectedEmp && loading && <Spinner />}

      {/* State: error */}
      {selectedEmp && !loading && data?.error && (
        <div className="text-center py-8 text-red-500 text-sm">{data.error}</div>
      )}

      {/* State: loaded */}
      {selectedEmp && !loading && data && !data.error && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">{data.profile?.name?.[0] || '?'}</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-base">{data.profile?.name}</p>
                <p className="text-indigo-100 text-xs">{data.profile?.designation} · {data.profile?.department}</p>
                <p className="text-indigo-200 text-xs">{data.profile?.emp_id}</p>
              </div>
              <div className="text-right">
                <button onClick={handleCheckout}
                  className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition">
                  🕐 Checkout
                </button>
                {checkoutMsg && <p className="text-xs text-white mt-1">{checkoutMsg}</p>}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 min-w-[70px] px-2 py-2.5 text-xs font-medium whitespace-nowrap transition ${
                  tab === t.id ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatCard label="Present Days"    value={data.attendance_stats?.present_days} color="text-teal-600"   icon="✅" />
                  <StatCard label="Leave Requests"  value={data.leave_history?.length}          color="text-indigo-600" icon="📋" />
                  <StatCard label="Assets"          value={data.assets?.length}                 color="text-blue-600"   icon="💻" />
                  <StatCard label="HR Letters"      value={data.hr_letters?.length}             color="text-purple-600" icon="📄" />
                </div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Leave Balance</h3>
                {(data.leave_balance || []).map((lb, i) => <LeaveBar key={i} {...lb} />)}
              </div>
            )}

            {/* LEAVES */}
            {tab === 'leaves' && (
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Leave Balance</h3>
                {(data.leave_balance || []).map((lb, i) => <LeaveBar key={i} {...lb} />)}
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-3">Leave History</h3>
                {(data.leave_history || []).length === 0
                  ? <p className="text-slate-400 text-xs text-center py-4">No leave history yet</p>
                  : (data.leave_history || []).map((l, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{l.leave_type}</p>
                        <p className="text-xs text-slate-400">{l.from_date} → {l.to_date} · {l.days} day(s)</p>
                      </div>
                      <Badge text={l.status} color={l.status==='Approved'?'green':l.status==='Rejected'?'red':'yellow'} />
                    </div>
                  ))}
              </div>
            )}

            {/* ATTENDANCE */}
            {tab === 'attendance' && (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatCard label="Present Days"  value={data.attendance_stats?.present_days}  color="text-teal-600"  icon="✅" />
                  <StatCard label="Total Records" value={data.attendance_stats?.total_records} color="text-slate-600" icon="📅" />
                </div>
                {(data.attendance || []).length === 0
                  ? <p className="text-slate-400 text-xs text-center py-4">No attendance records yet</p>
                  : (data.attendance || []).map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{a.date}</p>
                        <p className="text-xs text-slate-400">In: {a.check_in || '—'} · Out: {a.check_out || '—'}</p>
                      </div>
                      <Badge text={a.status || 'Present'} color={a.status==='Present'?'green':'red'} />
                    </div>
                  ))}
              </div>
            )}

            {/* ASSETS */}
            {tab === 'assets' && (
              <div>
                {(data.assets || []).length === 0
                  ? <p className="text-slate-400 text-xs text-center py-4">No assets assigned yet</p>
                  : (data.assets || []).map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{a.asset_name}</p>
                        <p className="text-xs text-slate-400">{a.asset_id}</p>
                      </div>
                      <Badge text={a.status || 'Assigned'} color="teal" />
                    </div>
                  ))}
              </div>
            )}

            {/* LETTERS */}
            {tab === 'letters' && (
              <div>
                {(data.hr_letters || []).length === 0
                  ? <p className="text-slate-400 text-xs text-center py-4">No HR letters yet</p>
                  : (data.hr_letters || []).map((l, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{l.letter_type}</p>
                        <p className="text-xs text-slate-400">{l.letter_id} · {l.generated_on}</p>
                      </div>
                      <Badge text="Generated" color="green" />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MSS Dashboard ─────────────────────────────────────────────────
function MssDashboard() {
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [deptFilter,  setDeptFilter]  = useState('');
  const [error,       setError]       = useState('');

  const loadMss = async (emp, dept = '') => {
    if (!emp) return;
    setSelectedEmp(emp);
    setLoading(true);
    setData(null);
    setError('');
    try {
      const url = `${BACKEND_URL}/api/mss/${emp.emp_id}${dept ? `?department=${encodeURIComponent(dept)}` : ''}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.error) { setError(json.error); }
      else { setData(json); }
    } catch { setError('Failed to load MSS data. Check your connection.'); }
    setLoading(false);
  };

  const applyFilter = () => { if (selectedEmp) loadMss(selectedEmp, deptFilter); };

  return (
    <div>
      {/* Manager Search */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2 font-medium">Search your employee profile (manager):
        </p>
        <EmployeeSearch onSelect={(emp) => loadMss(emp)} placeholder="Type your name e.g. Rahul..." />
      </div>

      {/* State: empty */}
      {!selectedEmp && (
        <div className="text-center py-10 text-slate-400">
          <p className="text-3xl mb-2">👔</p>
          <p className="text-sm">Search for your employee profile to load your team dashboard</p>
        </div>
      )}

      {loading && <Spinner color="orange" />}

      {error && (
        <div className="text-center py-6 text-red-500 text-sm bg-red-50 rounded-2xl px-4">{error}</div>
      )}

      {selectedEmp && !loading && data && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Manager Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-4">
            <p className="text-white font-bold text-base">👔 {selectedEmp.name}'s Team Dashboard</p>
            <p className="text-orange-100 text-sm">Department: {data.department} · {data.team_count} team members</p>
          </div>

          <div className="p-4">
            {/* Department Filter */}
            <div className="flex gap-2 mb-4">
              <input value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                placeholder="Filter by department (e.g. IT)..."
                className="flex-1 px-3 py-2 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <button onClick={applyFilter}
                className="bg-orange-500 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-orange-600 transition">
                Filter
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Team Size"      value={data.team_count}    color="text-orange-600" icon="👥" />
              <StatCard label="Pending Leaves" value={data.pending_count} color="text-yellow-600" icon="⏳" />
              <StatCard label="Present Today"  value={data.present_today} color="text-teal-600"   icon="✅" />
              <StatCard label="Absent Today"   value={data.absent_count}  color="text-red-500"    icon="❌" />
            </div>

            {/* Pending Leaves */}
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pending Leave Requests</h3>
            {(data.pending_leaves || []).length === 0
              ? <p className="text-slate-400 text-xs text-center py-3 bg-slate-50 rounded-xl mb-4">No pending leaves 🎉</p>
              : (data.pending_leaves || []).map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{l.emp_name}</p>
                    <p className="text-xs text-slate-400">{l.leave_type} · {l.days} day(s) · {l.from_date || 'TBD'}</p>
                  </div>
                  <Badge text="Pending" color="yellow" />
                </div>
              ))}

            {/* Absent Today */}
            {(data.absent_today || []).length > 0 && (
              <>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2">Absent Today</h3>
                {data.absent_today.map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{e.name}</p>
                      <p className="text-xs text-slate-400">{e.emp_id} · {e.designation}</p>
                    </div>
                    <Badge text="Absent" color="red" />
                  </div>
                ))}
              </>
            )}

            {/* Team Members */}
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-2">Team Attendance Status</h3>
            {(data.team || []).map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{e.name}</p>
                  <p className="text-xs text-slate-400">{e.emp_id} · {e.designation} · {e.department}</p>
                </div>
                <Badge
                  text={e.attendance_status || 'Not marked'}
                  color={e.attendance_status === 'Present' ? 'green' : 'red'}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function EssMssDashboard() {
  const [mode, setMode] = useState('ess');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-800">
            {mode === 'ess' ? '👤 My Dashboard (ESS)' : '👔 Team Dashboard (MSS)'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">NexHRMS · Future Invo Solutions</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-5 bg-white rounded-2xl p-1 border border-slate-200 shadow-sm">
          <button onClick={() => setMode('ess')}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${
              mode === 'ess' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
            }`}>
            👤 My Dashboard
          </button>
          <button onClick={() => setMode('mss')}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition ${
              mode === 'mss' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-700'
            }`}>
            👔 Team Dashboard
          </button>
        </div>

        {mode === 'ess' ? <EssDashboard /> : <MssDashboard />}
      </div>
    </div>
  );
}
