import React, { useState, useEffect } from 'react';
import { Search, LogOut, Package, ArrowUpRight, ArrowDownRight, User, Lock, RefreshCw, LayoutDashboard, Settings, X, Plus, Minus, AlertCircle, Barcode as BarcodeIcon, Camera } from 'lucide-react';
import Barcode from 'react-barcode';
import Scanner from './Scanner';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Mascot from './Mascot';

function cn(...inputs) { return twMerge(clsx(inputs)); }

// Import Data
// Static JSON imports removed – data will be fetched from the server API
// import productDataRaw from '../product_data.json';
// import dashboardDataRaw from '../dashboard_data.json';
// import adminDataRaw from '../admin_data.json';
// import buyDataRaw from '../buy_data.json';
// import outputDataRaw from '../output_data.json';

const safeArr = (d) => Array.isArray(d) ? d : [];
const API_URL = '';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user_session') || 'null'));
  const [view, setView] = useState(() => localStorage.getItem('current_view') || 'product');
  const [search, setSearch] = useState('');
  // State to hold all data fetched from the server
  const [dataMap, setDataMap] = useState({
    product: [],
    dashboard: [],
    admin: [],
    input: [],
    output: []
  });

  // Fetch data once on component mount (and when view changes if needed)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/data`);
        const json = await res.json();
        setDataMap({
          product: json.product || [],
          dashboard: json.dashboard || [],
          admin: json.admin || [],
          input: json.buy || [],
          output: json.output || []
        });
      } catch (e) {
        console.error('❌ Failed to fetch data from server:', e);
      }
    };
    fetchData();
  }, []);
  const [showLogin, setShowLogin] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [barcodeModal, setBarcodeModal] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const inventoryData = safeArr(dataMap.product);
  // Filter out corrupted rows (e.g. rows with only วันที่ as a quote character)
  const buyHistoryData = safeArr(dataMap.input).filter(r => Object.keys(r).length > 1 || (Object.keys(r).length === 1 && Object.keys(r)[0] !== 'วันที่'));
  const outputHistoryData = safeArr(dataMap.output).filter(r => Object.keys(r).length > 1 || (Object.keys(r).length === 1 && Object.keys(r)[0] !== 'วันที่'));
  const adminData = safeArr(dataMap.admin);
  const dashboardData = safeArr(dataMap.dashboard);

  

  // Removed redundant dataMap redefinition – we now use the state dataMap directly.

  useEffect(() => { localStorage.setItem('current_view', view); }, [view]);

  useEffect(() => {
    const restricted = ['admin', 'input', 'output'];
    if (!user && restricted.includes(view)) setView('product');
  }, [view, user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const u = { name: data.name || loginUser, role: 'admin' };
        setUser(u);
        localStorage.setItem('user_session', JSON.stringify(u));
        setShowLogin(false);
        setLoginUser('');
        setLoginPass('');
        setLoginError('');
      } else {
        setLoginError(data.error || 'Username หรือ Password ไม่ถูกต้อง');
      }
    } catch (err) {
      setLoginError('ไม่สามารถเชื่อมต่อ Server ได้');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user_session');
    setView('product');
  };

  const syncExcel = () => {
    if (confirm('Sync fresh data from Excel?')) window.location.reload();
  };

  const addTransaction = async (type, formData) => {
    try {
      setMsg({ type: 'info', text: 'กำลังบันทึก...' });
      const res = await fetch(`${API_URL}/api/update-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...formData })
      });
      const data = await res.json();
      if (res.ok) {
        const excelNote = data.excelSynced ? '✅ Excel synced' : '⚠️ Excel ล็อคอยู่ (JSON บันทึกแล้ว)';
        setMsg({ type: 'success', text: `บันทึกสำเร็จ! ยอดคงเหลือ: ${data.newBalance} — ${excelNote}` });
        // Refresh data from the server instead of reloading the whole page
        (async () => {
          try {
            const freshRes = await fetch(`${API_URL}/api/data`);
            const freshJson = await freshRes.json();
            setDataMap({
              product: freshJson.product || [],
              dashboard: freshJson.dashboard || [],
              admin: freshJson.admin || [],
              input: freshJson.buy || [],
              output: freshJson.output || []
            });
          } catch (e) {
            console.error('❌ Failed to refresh data after transaction:', e);
          }
        })();
      } else {
        setMsg({ type: 'error', text: data.error || 'Server Error' });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setMsg({ type: 'error', text: 'ไม่สามารถเชื่อมต่อ Server ได้ — ตรวจสอบว่ารัน npm run start-all อยู่' });
    }
  };

  const renderTable = (rows) => {
    if (!rows || rows.length === 0) return <div className="p-20 text-center text-slate-300 italic border border-slate-200 bg-white rounded-lg">No records found.</div>;
    
    // Collect ALL unique columns from every row (not just first row)
    const colSet = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => colSet.add(k)));
    const cols = [...colSet];
    const filtered = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())));

    return (
      <div className="bg-white border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-200/80 border-b border-slate-300">
                {cols.map(c => (
                  <th key={c} className="px-4 py-2.5 font-bold text-slate-700 border-r border-slate-300 last:border-0 text-xs">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((row, idx) => (
                <tr key={idx} className={cn("hover:bg-blue-50/50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                  {cols.map(col => (
                    <td key={col} className="px-4 py-2.5 text-slate-600 border-r border-slate-200 last:border-0 whitespace-nowrap">
                      {typeof row[col] === 'number' && (String(col).includes('ยอด') || String(col).includes('balance') || String(col).includes('จำนวน')) ? (
                        <span className={cn("inline-block px-2 py-0.5 rounded font-bold tabular-nums", row[col] <=5 ? "text-red-600 bg-red-50" : "text-blue-700 bg-blue-50")}>
                          {row[col].toLocaleString()}
                        </span>
                      ) : String(col) === 'รหัสพัสดุ' ? (
                        <span className="font-mono pt-0.5">{String(row[col] || '-')}</span>
                      ) : (String(col) === '' || cols.indexOf(col) === 6) && view === 'product' ? (
                        <button 
                          onClick={() => setBarcodeModal({ id: String(row['รหัสพัสดุ'] || row['รหัส']), name: String(row['ชื่อพัสดุ'] || '') })}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all border border-slate-200 font-bold text-[10px]"
                          title="สร้างบาร์โค้ด"
                        >
                          <BarcodeIcon size={14} /> BARCODE
                        </button>
                      ) : String(row[col] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  // ===== Dashboard Rendering =====
  const renderDashboard = () => {
    // === Dynamically compute ranked output items from output_data.json ===
    const outputAgg = {};
    outputHistoryData.forEach(row => {
      const qty = Number(row['จำนวนที่ออก'] || 0);
      const name = String(row['ชื่อพัสดุ'] || row['รหัสพัสดุ'] || 'ไม่ระบุ');
      if (qty > 0) {
        outputAgg[name] = (outputAgg[name] || 0) + qty;
      }
    });
    const rankedItems = Object.entries(outputAgg)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
    const maxOutput = rankedItems.length > 0 ? rankedItems[0].total : 1;
    const grandTotalOutput = rankedItems.reduce((sum, r) => sum + r.total, 0);

    // Total inventory value: sum of (ราคาซื้อ * ยอดคงเหลือ) for all products
    const totalInventoryValue = inventoryData.reduce((sum, p) => {
      const price = Number(p['ราคาซื้อ'] || 0);
      const balance = Number(p['ยอดคงเหลือ'] || 0);
      const total = p['รวม'] !== undefined ? Number(p['รวม']) : price * balance;
      return sum + total;
    }, 0);

    // Low stock products
    const lowStockProducts = inventoryData.filter(p => {
      const balance = Number(p['ยอดคงเหลือ'] || 0);
      const minQty = Number(p['จำนวนขั้นต่ำ'] || 0);
      return balance <= minQty;
    });

    // Stock balance chart data
    const maxBalance = Math.max(...inventoryData.map(p => Math.abs(Number(p['ยอดคงเหลือ'] || 0))), 1);

    // Color palette for bars
    const barColors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fc3b3bff', '#f97316', '#eab308'];

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Inventory Value */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">มูลค่าสินค้าคงเหลือ</span>
              <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Package size={16} className="text-blue-500" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              ฿{Number(totalInventoryValue).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">รวมมูลค่าจาก Product ทั้งหมด</div>
          </div>

          {/* Total Products */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">จำนวนพัสดุทั้งหมด</span>
              <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <LayoutDashboard size={16} className="text-emerald-500" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-800 tabular-nums">
              {inventoryData.length} <span className="text-sm font-normal text-slate-400">รายการ</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">เบิกออกทั้งหมด: {grandTotalOutput.toLocaleString()} ชิ้น</div>
          </div>

          {/* Low Stock Alert */}
          <div className={cn("rounded-xl border p-5 shadow-sm", lowStockProducts.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200")}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">สต๊อกต่ำ / หมด</span>
              <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center", lowStockProducts.length > 0 ? "bg-red-100" : "bg-slate-50")}>
                <AlertCircle size={16} className={lowStockProducts.length > 0 ? "text-red-500" : "text-slate-400"} />
              </span>
            </div>
            <div className={cn("text-2xl font-black tabular-nums", lowStockProducts.length > 0 ? "text-red-600" : "text-slate-800")}>
              {lowStockProducts.length} <span className="text-sm font-normal text-slate-400">รายการ</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {lowStockProducts.length > 0 ? lowStockProducts.map(p => String(p['ชื่อพัสดุ'])).join(', ') : 'All items in stock'}
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Output Items Bar Chart — computed live from output_data.json */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-xs uppercase text-slate-500 mb-5 flex items-center gap-2">
              <ArrowUpRight size={14} className="text-orange-500" />
              อันดับพัสดุที่เบิกมากที่สุด
              <span className="text-[8px] font-normal text-slate-300 ml-auto">คำนวณจาก Output Data</span>
            </h3>
            <div className="space-y-3">
              {rankedItems.map((item, idx) => {
                const pct = (item.total / maxOutput) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: barColors[idx % barColors.length] }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-slate-700 truncate">{item.name}</span>
                        <span className="text-xs font-black text-slate-800 tabular-nums ml-2">{item.total.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${barColors[idx % barColors.length]}, ${barColors[(idx + 1) % barColors.length]})`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {rankedItems.length === 0 && <div className="text-center text-slate-300 text-xs italic py-6">ยังไม่มีข้อมูลเบิกออก</div>}
          </div>

          {/* Stock Balance Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-xs uppercase text-slate-500 mb-5 flex items-center gap-2">
              <Package size={14} className="text-blue-500" />
              ยอดคงเหลือแต่ละรายการ
            </h3>
            <div className="space-y-3">
              {inventoryData.map((item, idx) => {
                const balance = Number(item['ยอดคงเหลือ'] || 0);
                const minQty = Number(item['จำนวนขั้นต่ำ'] || 0);
                const absBalance = Math.abs(balance);
                const pct = maxBalance > 0 ? Math.min((absBalance / maxBalance) * 100, 100) : 0;
                const isLow = balance >= 0 && balance <= minQty;
                const isNegative = balance < 0;
                const isZero = balance === 0;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-16 text-right">
                      <span className="text-[10px] font-bold text-slate-500 truncate">{String(item['ชื่อพัสดุ'])}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="w-full bg-slate-100 rounded-full h-5 overflow-hidden relative">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${isZero ? 0 : Math.max(pct, 3)}%`,
                            backgroundColor: isNegative ? '#ef4444' : isLow ? '#f97316' : '#3b82f6'
                          }}
                        />
                        <span className={cn(
                          "absolute inset-0 flex items-center text-[10px] font-black tabular-nums px-2",
                          pct > 40 && !isZero ? "text-white justify-center" : "text-slate-700 justify-end"
                        )}>
                          {balance.toLocaleString()} {item['หน่วยนับ'] || ''}
                        </span>
                      </div>
                    </div>
                    {isNegative && <span className="text-[8px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded">ติดลบ</span>}
                    {isLow && !isNegative && <span className="text-[8px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded uppercase">Low</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'product', label: '1. PRODUCT', icon: <Package size={14} /> },
    { id: 'dashboard', label: '2. DASHBOARD', icon: <LayoutDashboard size={14} /> },
    ...(user ? [
      { id: 'input', label: '3. INPUT', icon: <Plus size={14} /> },
      { id: 'output', label: '4. OUTPUT', icon: <Minus size={14} /> },
      { id: 'admin', label: '5. ADMIN', icon: <Settings size={14} /> }
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col font-sans">
      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
             <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
               <h3 className="font-bold text-lg flex items-center gap-2"><Lock size={18}/> Admin Login</h3>
               <button onClick={() => { setShowLogin(false); setLoginError(''); }} className="text-slate-300 hover:text-slate-900"><X /></button>
             </div>
             <form onSubmit={handleLogin} className="space-y-4">
               <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><User size={12}/> Username</label>
                 <input autoFocus type="text" placeholder="กรอก Username" className="w-full bg-slate-50 p-3.5 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                   value={loginUser} onChange={e => setLoginUser(e.target.value)} required />
               </div>
               <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Lock size={12}/> Password</label>
                 <input type="password" placeholder="กรอก Password" className="w-full bg-slate-50 p-3.5 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                   value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
               </div>
               {loginError && (
                 <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
                   <AlertCircle size={14}/> {loginError}
                 </div>
               )}
               <button disabled={loginLoading} className={cn("w-full bg-blue-600 text-white p-3.5 rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-blue-700 shadow-md transition-all", loginLoading && "opacity-60 cursor-not-allowed")}>
                 {loginLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
               </button>
             </form>
             <p className="text-[9px] text-slate-300 text-center mt-4">* เพิ่มแอดมินได้ผ่าน Excel เท่านั้น (sheet: admin)</p>
          </div>
        </div>
      )}

      {/* Corporate Header */}
      <header className="h-14 bg-[#2f3e4e] text-white flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Package size={20} className="text-blue-300"/>
          <span className="font-bold text-sm tracking-widest uppercase">stock</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <button onClick={syncExcel} className="p-1.5 rounded-md hover:bg-white/10 transition-all text-slate-300" title="Manual Sync"><RefreshCw size={16}/></button>
              <span className="text-[10px] font-bold py-1 px-2 bg-blue-500 rounded text-blue-50">{user.name}</span>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-white"><LogOut size={16}/></button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} className="bg-blue-600 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
              Admin Login
            </button>
          )}
        </div>
      </header>

      {/* Excel-style Tab Bar */}
      <div className="bg-[#e2e8f0] border-b border-slate-300 flex overflow-x-auto no-scrollbar">
        <div className="flex">
          {tabs.map(t => (
            <button key={t.id} onClick={() => {
              setView(t.id);
              setShowForm(false);
              setIsNewProduct(false);
            }} className={cn(
              "px-8 py-3 text-[10px] font-bold uppercase tracking-wider border-r border-slate-300 transition-all relative",
              view === t.id ? "bg-white text-blue-600 border-b-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-blue-600" : "text-slate-500 hover:bg-slate-200/50"
            )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-700 flex items-center gap-3 uppercase">
            {view}
            {user && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-black italic">table</span>}
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input type="text" placeholder="Search data..." className="w-full bg-white border border-slate-300 py-1.5 pl-9 pr-4 rounded-md text-xs outline-none focus:border-blue-500" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {msg && (
          <div className={cn("p-3 rounded-lg text-xs font-bold flex items-center gap-2", msg.type === 'success' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-red-100 text-red-800 border border-red-200")}>
            <AlertCircle size={14}/> {msg.text}
          </div>
        )}

        {(view === 'input' || view === 'output') && user && (
          <div className="mb-6">
            <div className="bg-white p-8 rounded-2xl border-2 border-slate-200 shadow-sm max-w-2xl mx-auto">
                <h3 className="font-bold text-sm mb-5 flex items-center gap-2 text-slate-700">
                  {view === 'input' ? <ArrowDownRight size={16} className="text-emerald-500"/> : <ArrowUpRight size={16} className="text-orange-500"/>}
                  {view === 'input' ? 'บันทึกนำเข้าสินค้า (INPUT)' : 'บันทึกเบิกออกสินค้า (OUTPUT)'}
                </h3>
                <form onSubmit={(e) => {
                   e.preventDefault();
                   const fd = new FormData(e.target);
                   const formObj = Object.fromEntries(fd);
                   if (formObj.date) {
                     const d = new Date(formObj.date);
                     const dd = String(d.getDate()).padStart(2, '0');
                     const mm = String(d.getMonth() + 1).padStart(2, '0');
                     const yyyy = d.getFullYear() + 543;
                     formObj.date = `${dd}/${mm}/${yyyy}`;
                   }
                   
                   let message = '';
                   if (isNewProduct) {
                     formObj.productId = formObj.newProductId;
                     formObj.productName = formObj.newProductName;
                     delete formObj.newProductId;
                     delete formObj.newProductName;
                     
                     // Check if ID already exists
                     const existingProduct = inventoryData.find(p => String(p['รหัสพัสดุ']) === String(formObj.productId));
                     if (existingProduct) {
                       message = `⚠️ รหัสพัสดุ ${formObj.productId} มีอยู่ในระบบแล้ว (ชื่อเดิม: ${existingProduct['ชื่อพัสดุ']})\n\nคุณต้องการบันทึกรายการเพิ่มเข้าสต๊อคของสินค้าเดิมแทน หรือไม่?`;
                     } else {
                       message = `คุณยืนยันที่จะเพิ่มสินค้าใหม่:\n"${formObj.productName}" (รหัส: ${formObj.productId})\n\nจำนวนซื้อเข้า: ${formObj.quantity} ชิ้น\nราคา: ${formObj.price} บาท ใช่หรือไม่?`;
                     }
                   } else {
                     const p = inventoryData.find(p => String(p['รหัสพัสดุ']) === String(formObj.productId));
                     const pName = p ? p['ชื่อพัสดุ'] : '';
                     if (view === 'input') {
                       message = `คุณยืนยันที่จะ นำเข้า สินค้า:\n"${pName}"\n\nจำนวน: ${formObj.quantity} ชิ้น\nราคา: ${formObj.price} บาท ใช่หรือไม่?`;
                     } else {
                       message = `คุณยืนยันที่จะ เบิกออก สินค้า:\n"${pName}"\n\nจำนวน: ${formObj.quantity} ชิ้น ใช่หรือไม่?`;
                     }
                   }

                   setConfirmModal({
                     type: view === 'input' ? 'purchase' : 'sales',
                     data: formObj,
                     message
                   });

                }} className="space-y-4 text-xs">
                   {/* Date */}
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">วันที่</label>
                     <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors" required />
                   </div>

                   {/* Product Selection Mode Toggle (Input only) */}
                   {view === 'input' && (
                     <div className="flex gap-2">
                       <button type="button" onClick={() => setIsNewProduct(false)}
                         className={cn("flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                           !isNewProduct ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
                         )}>
                         สแกนสินค้า / จากสต๊อค
                       </button>
                       <button type="button" onClick={() => setIsNewProduct(true)}
                         className={cn("flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                           isNewProduct ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
                         )}>
                         + เพิ่มสินค้าใหม่
                       </button>
                     </div>
                   )}

                   {/* Existing Product Datalist (Barcode Scanner Friendly) */}
                   {!isNewProduct && (
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center justify-between">
                          <span className="flex items-center gap-2"><BarcodeIcon size={16} /> สแกนบาร์โค้ด / พิมพ์รหัสพัสดุ</span>
                          <button 
                            type="button"
                            onClick={() => setShowScanner(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Camera size={14} /> เปิดกล้อง
                          </button>
                       </label>
                        <input 
                          id="productIdInput"
                          name="productId" 
                          list="product-list"
                          placeholder="ยิงเครื่องสแกนบาร์โค้ดลงช่องนี้ หรือพิมพ์ตัวเลข..." 
                          className="w-full bg-blue-50/50 p-4 rounded-xl border-2 border-blue-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-lg shadow-inner" 
                          required 
                          autoFocus
                        />
                        <datalist id="product-list">
                          {inventoryData.map((i, idx) => <option key={idx} value={i['รหัสพัสดุ']}>{i['ชื่อพัสดุ']}</option>)}
                        </datalist>
                     </div>
                   )}

                   {/* New Product Inputs */}
                   {isNewProduct && (
                     <div className="grid grid-cols-2 gap-4 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">รหัสพัสดุ</label>
                         <input type="text" name="newProductId" placeholder="ProductId" className="w-full bg-white p-2.5 rounded-lg border border-emerald-200 outline-none focus:border-emerald-400 transition-colors" required />
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ชื่อพัสดุ</label>
                         <input type="text" name="newProductName" placeholder="ProductName" className="w-full bg-white p-2.5 rounded-lg border border-emerald-200 outline-none focus:border-emerald-400 transition-colors" required />
                       </div>
                     </div>
                   )}
                   
                   <div className="grid grid-cols-2 gap-4">
                     {view === 'input' && (
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ราคา (บาท)</label>
                         <input type="number" name="price" min="0" step="any" placeholder="0.00" className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors" required />
                       </div>
                     )}
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จำนวน (ชิ้น)</label>
                       <input type="number" name="quantity" defaultValue={1} min="1" placeholder="1" className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 outline-none focus:border-blue-400 transition-colors font-bold" required />
                     </div>
                   </div>
                   
                   <button type="submit" className={cn(
                     "w-full py-4 mt-2 rounded-xl font-black text-white text-sm uppercase tracking-widest shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
                     view === 'input'
                       ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/30'
                       : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/30'
                   )}>
                     {view === 'input' ? '✅ บันทึกนำเข้า' : '📦 บันทึกเบิกออก (SCAN)'}
                   </button>
                </form>
              </div>
          </div>
        )}

        <div className="pb-10">
          {view === 'dashboard' ? renderDashboard() : renderTable(dataMap[view])}
        </div>
      </main>
      <Mascot />

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-500 rounded-full">
                <AlertCircle size={24} />
              </div>
              <h3 className="font-bold text-lg text-slate-800">ยืนยันการทำรายการ</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap leading-relaxed -mt-1 ml-11">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
              >
                ยกเลิก
              </button>
              <button 
                onClick={() => {
                  addTransaction(confirmModal.type, confirmModal.data);
                  setConfirmModal(null);
                  if (confirmModal.type === 'purchase') {
                    setIsNewProduct(false); 
                  }
                  setShowForm(false);
                }}
                className={cn(
                  "flex-1 py-2.5 rounded-lg font-bold text-white transition-colors text-sm shadow-md",
                  confirmModal.type === 'purchase' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200" : "bg-orange-500 hover:bg-orange-600 shadow-orange-200"
                )}
              >
                ยืนยันการบันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Modal */}
      {barcodeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 print-hide">
          <div className="barcode-modal-content bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center relative">
            <button 
              onClick={() => setBarcodeModal(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors print-hide"
            >
              <X size={20} />
            </button>
            
            <h3 className="font-bold text-lg text-slate-800 mb-1 leading-tight mt-2">{barcodeModal.name}</h3>
            <p className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest">รหัสสินค้า: {barcodeModal.id}</p>
            
            <div className="flex justify-center bg-white p-6 border-2 border-slate-100 rounded-xl mb-8">
              <Barcode value={barcodeModal.id} format="CODE128" width={2} height={70} displayValue={true} />
            </div>

            <div className="flex gap-3 print-hide">
              <button 
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all text-sm shadow-lg shadow-blue-900/20"
              >
                พิมพ์บาร์โค้ด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      {showScanner && (
        <Scanner 
          onScan={(code) => {
            // 🔉 1. Play a POS "BEEP" sound natively! 
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.type = 'sine';
              oscillator.frequency.value = 1200; // 1200Hz checkout tone
              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.1);
              
              // 📱 2. Optional: Vibrate phone if supported
              if (navigator.vibrate) navigator.vibrate(100);
            } catch(e) {}

            setShowScanner(false);
            
            // 3. Fill the code into the form
            const el = document.getElementById('productIdInput');
            if (el) {
              el.value = code;
              el.focus();
              
              // Flash background green to signify success
              el.style.transition = 'background-color 0s';
              el.style.backgroundColor = '#d1fae5'; // emerald-100
              setTimeout(() => { 
                el.style.transition = 'background-color 0.5s ease';
                el.style.backgroundColor = ''; 
              }, 600);
            }
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
