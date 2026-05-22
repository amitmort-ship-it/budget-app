import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ── Supabase sync ────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function loadFromSupabase() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/budget_data?id=eq.main&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await res.json();
    if (rows && rows[0]?.data) return rows[0].data;
  } catch(e) { console.error('Supabase load error', e); }
  return null;
}

async function saveToSupabase(data) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/budget_data`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ id: 'main', data, updated_at: new Date().toISOString() }),
    });
  } catch(e) { console.error('Supabase save error', e); }
}

const STORAGE_KEY = "home-expense-tracker-v2";

const ICONS = {
  // משתנות (0-10)
  food: "🛒", transport: "🚗", kids: "👶", health: "💊",
  entertainment: "🎬", clothing: "👕", pets: "🐾", misc: "📦",
  maintenance: "🔧", unexpected: "🎲", online: "🛍️",
  // קבועות (11+)
  rent: "🏠", electricity: "💡", water: "💧", internet: "📡",
  insurance: "🛡️", subscriptions: "📱", loan: "🏦", other: "📌",
  digital: "🎵", kidsclass: "🎨", car: "🚙", mortgage: "💳", vacation: "✈️",
};

const PAYMENT_TYPE_ICONS = { card: "💳", bank: "🏦", cash: "💵" };

const SAVING_CHANNELS = [
  { id: "bank", label: "פיקדון בנקאי", icon: "🏦" },
  { id: "market", label: "שוק ההון", icon: "📈" },
  { id: "pension", label: "פנסיה / קרן השתלמות", icon: "🏛️" },
  { id: "realestate", label: "נדל\"ן", icon: "🏠" },
  { id: "crypto", label: "קריפטו", icon: "₿" },
  { id: "cash", label: "מזומן בצד", icon: "💵" },
  { id: "other", label: "אחר", icon: "📦" },
];

const DEFAULT_STATE = {
  monthlyIncome: null,
  fixedBuckets: [],
  variableBuckets: [],
  expenses: [],
  paymentMethods: [],
  savings: [],
  incomes: [],
  theme: "ocean",
  notes: [],
  savingsSnapshot: [],
};

const THEMES = {
  // Each theme: a/b = header gradient, acc = primary accent, light = accent bg tint,
  // nav = nav active color, btn = main button bg, savingsGrad = savings header,
  // fixedBg = fixed info banner bg/text, varBg = variable info banner bg/text
  ocean: {
    name:"אוקיינוס 🌊", a:"#1e3a5f", b:"#2563eb",
    acc:"#2563eb", light:"#eff6ff", navActive:"#2563eb",
    btn:"#2563eb", btnLight:"#dbeafe",
    savingsA:"#065f46", savingsB:"#10b981",
    fixedBg:"#fefce8", fixedText:"#854d0e", fixedSub:"#a16207",
    varBg:"#eff6ff", varText:"#1d4ed8", varSub:"#3b82f6",
    incomeColor:"#10b981", expColor:"#f59e0b", surplusColor:"#2563eb",
    exportGradA:"#166534", exportGradB:"#16a34a", exportAccent:"#16a34a",
    incomeAcc:"#10b981",
  },
  forest: {
    name:"יער 🌿", a:"#052e16", b:"#16a34a",
    acc:"#16a34a", light:"#f0fdf4", navActive:"#16a34a",
    btn:"#16a34a", btnLight:"#dcfce7",
    savingsA:"#1e3a5f", savingsB:"#2563eb",
    fixedBg:"#fefce8", fixedText:"#854d0e", fixedSub:"#a16207",
    varBg:"#f0fdf4", varText:"#166534", varSub:"#16a34a",
    incomeColor:"#16a34a", expColor:"#f59e0b", surplusColor:"#15803d",
    exportGradA:"#052e16", exportGradB:"#16a34a", exportAccent:"#16a34a",
    incomeAcc:"#16a34a",
  },
  sunset: {
    name:"שקיעה 🌅", a:"#7c2d12", b:"#ea580c",
    acc:"#ea580c", light:"#fff7ed", navActive:"#ea580c",
    btn:"#ea580c", btnLight:"#ffedd5",
    savingsA:"#7c2d12", savingsB:"#dc2626",
    fixedBg:"#fff7ed", fixedText:"#9a3412", fixedSub:"#c2410c",
    varBg:"#fff7ed", varText:"#9a3412", varSub:"#ea580c",
    incomeColor:"#ea580c", expColor:"#dc2626", surplusColor:"#c2410c",
    exportGradA:"#7c2d12", exportGradB:"#ea580c", exportAccent:"#ea580c",
    incomeAcc:"#ea580c",
  },
  rose: {
    name:"ורוד 🌸", a:"#881337", b:"#e11d48",
    acc:"#e11d48", light:"#fff1f2", navActive:"#e11d48",
    btn:"#e11d48", btnLight:"#ffe4e6",
    savingsA:"#881337", savingsB:"#e11d48",
    fixedBg:"#fff1f2", fixedText:"#9f1239", fixedSub:"#be123c",
    varBg:"#fff1f2", varText:"#9f1239", varSub:"#e11d48",
    incomeColor:"#e11d48", expColor:"#f59e0b", surplusColor:"#be123c",
    exportGradA:"#881337", exportGradB:"#e11d48", exportAccent:"#e11d48",
    incomeAcc:"#e11d48",
  },
  violet: {
    name:"סגול 🔮", a:"#3b0764", b:"#7c3aed",
    acc:"#7c3aed", light:"#f5f3ff", navActive:"#7c3aed",
    btn:"#7c3aed", btnLight:"#ede9fe",
    savingsA:"#3b0764", savingsB:"#7c3aed",
    fixedBg:"#f5f3ff", fixedText:"#4c1d95", fixedSub:"#6d28d9",
    varBg:"#f5f3ff", varText:"#4c1d95", varSub:"#7c3aed",
    incomeColor:"#7c3aed", expColor:"#f59e0b", surplusColor:"#6d28d9",
    exportGradA:"#3b0764", exportGradB:"#7c3aed", exportAccent:"#7c3aed",
    incomeAcc:"#7c3aed",
  },
  midnight: {
    name:"לילה 🌙", a:"#0f172a", b:"#1e293b",
    acc:"#38bdf8", light:"#f0f9ff", navActive:"#38bdf8",
    btn:"#0ea5e9", btnLight:"#e0f2fe",
    savingsA:"#0f172a", savingsB:"#334155",
    fixedBg:"#f0f9ff", fixedText:"#0c4a6e", fixedSub:"#0369a1",
    varBg:"#f0f9ff", varText:"#0c4a6e", varSub:"#0ea5e9",
    incomeColor:"#38bdf8", expColor:"#f59e0b", surplusColor:"#0ea5e9",
    exportGradA:"#0f172a", exportGradB:"#0ea5e9", exportAccent:"#0ea5e9",
    incomeAcc:"#38bdf8",
  },
};

function getWeekId(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}

function getWeekLabel(weekId) {
  const start = new Date(weekId);
  const end = new Date(weekId);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Billing cycle helpers (pure, no React deps) ───────────────────────────
function getCycleStart(ref = new Date()) {
  const d = new Date(ref); d.setHours(0,0,0,0);
  if (d.getDate() >= 10) { d.setDate(10); }
  else { d.setMonth(d.getMonth()-1); d.setDate(10); }
  return d;
}

function getElapsedCycles(createdDateStr) {
  if (!createdDateStr) return 0;
  const created = getCycleStart(new Date(createdDateStr));
  const now = getCycleStart();
  let el = 0, cur = new Date(created);
  while (cur < now) { cur.setMonth(cur.getMonth()+1); el++; }
  return el;
}

function getInstallmentsRemaining(b) {
  if (!b.isInstallment) return null;
  return Math.max(0, Number(b.installmentsLeft||0) - getElapsedCycles(b.createdAt));
}

function getMonthlyAmount(b) {
  if (!b.isInstallment) return Number(b.amount||0);
  return Number(b.totalAmount||0) / Number(b.installmentsLeft||1);
}

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const old = localStorage.getItem("home-expense-tracker-v1");
      if (!saved && old) return { ...DEFAULT_STATE, ...JSON.parse(old), paymentMethods: [], savings: [] };
      return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE;
    } catch { return DEFAULT_STATE; }
  });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Load from Supabase on mount
  useEffect(() => {
    loadFromSupabase().then(remote => {
      if (remote) {
        const merged = { ...DEFAULT_STATE, ...remote };
        setData(merged);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
        setLastSync(new Date());
      }
    });
  }, []);
  });

  const [view, setView] = useState("dashboard");
  const [newBucket, setNewBucket] = useState({ name: "", amount: "", icon: "misc", isInstallment: false, installmentsLeft: "", totalAmount: "" });
  const [editBucket, setEditBucket] = useState(null);
  const [newExpense, setNewExpense] = useState({ bucketId: "", amount: "", note: "", date: new Date().toISOString().slice(0,10), paymentMethodId: "" });
  const [newPM, setNewPM] = useState({ type: "card", name: "", digits: "" });
  const [newSaving, setNewSaving] = useState({ channel: "bank", amount: "", note: "", date: new Date().toISOString().slice(0,10) });
  const [toast, setToast] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(getWeekId());
  const [exportWeek, setExportWeek] = useState(getWeekId());
  const [exportType, setExportType] = useState("weekly");
  const [exportCycle, setExportCycle] = useState(() => getCycleStart().toISOString().slice(0,10));
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [resetDialog, setResetDialog] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [resetError, setResetError] = useState(false);
  const [newIncome, setNewIncome] = useState({ label: "", amount: "" });
  const [newNote, setNewNote] = useState({ title: "", body: "", color: "#fef9c3" });
  const [savingsTab, setSavingsTab] = useState("deposits"); // "deposits" | "snapshot"
  const [newSnapshotItem, setNewSnapshotItem] = useState({ channel: "bank", name: "", balance: "" });
  const [editSnapshotId, setEditSnapshotId] = useState(null);
  const [editSnapshotVal, setEditSnapshotVal] = useState("");
  const [editNote, setEditNote] = useState(null);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const save = useCallback((next) => {
    setData(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    // Sync to Supabase (debounced via setTimeout)
    clearTimeout(window._supabaseSaveTimer);
    window._supabaseSaveTimer = setTimeout(() => {
      setSyncing(true);
      saveToSupabase(next).then(() => {
        setSyncing(false);
        setLastSync(new Date());
      });
    }, 1500);
  }, []);

  const showToast = (msg, color = "#22c55e") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Billing cycle ─────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const cycleStart = getCycleStart(today);
  const cycleEnd = new Date(cycleStart); cycleEnd.setMonth(cycleEnd.getMonth()+1); cycleEnd.setDate(9);
  const cycleTotalDays = (cycleEnd - cycleStart) / 86400000 + 1;
  const daysLeft = Math.max(1, (cycleEnd - today) / 86400000 + 1);
  const weeksInMonth = cycleTotalDays / 7;
  const weeksRemaining = Math.max(1, daysLeft / 7);
  const inCurrentCycle = (dateStr) => { const d = new Date(dateStr); d.setHours(0,0,0,0); return d >= cycleStart && d <= cycleEnd; };
  const fmt2 = (d) => d.toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit" });
  const cycleLabel = `${fmt2(cycleStart)} – ${fmt2(cycleEnd)}`;

  // ── Calculations ──────────────────────────────────────────────────────────
  // ── Income sources ───────────────────────────────────────────────────────
  const totalMonthlyIncome = (data.incomes||[]).reduce((s,x)=>s+Number(x.amount||0),0) + Number(data.monthlyIncome||0);

  const activeFixed = (data.fixedBuckets||[]).filter(b => !b.isInstallment || getInstallmentsRemaining(b) > 0);
  const totalFixed = activeFixed.reduce((s,b) => s + getMonthlyAmount(b), 0);
  const totalVariableBudget = data.variableBuckets.filter(b=>!b.trackingOnly).reduce((s,b) => s + Number(b.amount||0), 0);
  const totalBudget = totalFixed + totalVariableBudget;
  const remaining = totalMonthlyIncome - totalBudget;

  const fixedOverflowThisMonth = activeFixed.reduce((total,b) => {
    const spent = data.expenses.filter(e => e.bucketId===b.id && inCurrentCycle(e.date)).reduce((s,e)=>s+Number(e.amount),0);
    return total + Math.max(0, spent - getMonthlyAmount(b));
  }, 0);
  const weeklyFixedOverflowPenalty = fixedOverflowThisMonth / weeksRemaining;
  const totalVariableOnBudget = data.variableBuckets.filter(b=>!b.trackingOnly).reduce((s,b)=>s+Number(b.amount||0),0);
  const baseWeeklyVariableBudget = totalVariableOnBudget / weeksInMonth;
  const weeklyVariableBudget = Math.max(0, baseWeeklyVariableBudget - weeklyFixedOverflowPenalty);

  const expensesThisWeek = data.expenses.filter(e => getWeekId(e.date) === selectedWeek);
  const variableBucketIds = new Set(data.variableBuckets.map(b => b.id));
  const trackingOnlyIds = new Set(data.variableBuckets.filter(b=>b.trackingOnly).map(b=>b.id));
  const spentThisWeek = expensesThisWeek.filter(e => variableBucketIds.has(e.bucketId) && !trackingOnlyIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount||0),0);
  const trackingSpentThisWeek = expensesThisWeek.filter(e => trackingOnlyIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount||0),0);
  const leftThisWeek = weeklyVariableBudget - spentThisWeek;
  const allWeeks = [...new Set(data.expenses.map(e => getWeekId(e.date)))].sort().reverse();
  const bucketSpendThisWeek = (id) => expensesThisWeek.filter(e=>e.bucketId===id).reduce((s,e)=>s+Number(e.amount),0);


  // ── Analytics ─────────────────────────────────────────────────────────────
  // Monthly history: group expenses by billing cycle
  const getCycleBudget = () => totalVariableBudget;
  const allCycleStarts = [...new Set(data.expenses.map(e => getCycleStart(new Date(e.date)).toISOString().slice(0,10)))].sort();
  const cycleHistory = allCycleStarts.map(csStr => {
    const cs = new Date(csStr); const ce = new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9);
    const cyExp = data.expenses.filter(e => { const d=new Date(e.date); d.setHours(0,0,0,0); return d>=cs&&d<=ce; });
    const varExp = cyExp.filter(e=>variableBucketIds.has(e.bucketId));
    const total = varExp.reduce((s,e)=>s+Number(e.amount),0);
    const byBucket = data.variableBuckets.map(b=>({ id:b.id, name:b.name, icon:b.icon, spent:varExp.filter(e=>e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0), budget:Number(b.amount) }));
    return { csStr, label: fmt2(cs)+"–"+fmt2(ce), total, budget: totalVariableBudget, byBucket };
  });

  // Projection: based on days elapsed in current cycle, extrapolate to full cycle
  const daysElapsed = Math.max(1, cycleTotalDays - daysLeft + 1);
  const spentThisCycle = data.expenses.filter(e=>inCurrentCycle(e.date)&&variableBucketIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount),0);
  const projectedTotal = (spentThisCycle / daysElapsed) * cycleTotalDays;
  const projectionDiff = totalVariableBudget - projectedTotal;

  // Smart alerts
  const alerts = [];
  data.variableBuckets.forEach(b => {
    const wB = Number(b.amount)/weeksInMonth;
    const spent = bucketSpendThisWeek(b.id);
    const pct80 = spent/wB;
    if (pct80 >= 0.8 && pct80 < 1) alerts.push({ type:"warn", msg:`${ICONS[b.icon]} ${b.name}: השתמשת ב-${Math.round(pct80*100)}% מהתקציב השבועי` });
    else if (pct80 >= 1) alerts.push({ type:"danger", msg:`${ICONS[b.icon]} ${b.name}: חרגת מהתקציב השבועי ב-₪${Math.round(spent-wB).toLocaleString("he-IL")}` });
  });
  if (fixedOverflowThisMonth > 0) alerts.push({ type:"warn", msg:`⚠️ חריגה בהוצאות קבועות: ₪${Math.round(fixedOverflowThisMonth).toLocaleString("he-IL")} מחולקת על ${weeksRemaining.toFixed(1)} שבועות` });
  if (projectedTotal > totalVariableBudget * 1.1) alerts.push({ type:"danger", msg:`📉 בקצב הנוכחי תחרוג ב-₪${Math.round(projectedTotal-totalVariableBudget).toLocaleString("he-IL")} החודש` });
  else if (projectedTotal < totalVariableBudget * 0.85) alerts.push({ type:"good", msg:`✓ בקצב מצוין — צפי לחיסכון ₪${Math.round(totalVariableBudget-projectedTotal).toLocaleString("he-IL")} החודש` });

  const getBucketName = (id) => { const b=[...data.fixedBuckets,...data.variableBuckets].find(b=>b.id===id); return b?`${ICONS[b.icon]||"📌"} ${b.name}`:"—"; };
  const getPMLabel = (id) => { if(!id) return "—"; const pm=(data.paymentMethods||[]).find(p=>p.id===id); if(!pm) return "—"; return pm.type==="card"?`💳 ${pm.name} ****${pm.digits}`:pm.type==="bank"?`🏦 ${pm.name}`:`💵 ${pm.name}`; };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const addBucket = (type) => {
    if (type === "fixed" && newBucket.isInstallment) {
      if (!newBucket.name || !newBucket.totalAmount || !newBucket.installmentsLeft)
        return showToast("נא למלא שם, סכום כולל ומספר תשלומים", "#ef4444");
      const bucket = { id: uid(), name: newBucket.name, icon: newBucket.icon, isInstallment: true,
        totalAmount: Number(newBucket.totalAmount), installmentsLeft: Number(newBucket.installmentsLeft),
        amount: Number(newBucket.totalAmount)/Number(newBucket.installmentsLeft),
        createdAt: cycleStart.toISOString().slice(0,10) };
      save({ ...data, fixedBuckets: [...data.fixedBuckets, bucket] });
      setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"" });
      return showToast("תשלומים נוספו ✓");
    }
    if (!newBucket.name || !newBucket.amount) return showToast("נא למלא שם וסכום", "#ef4444");
    const bucket = { id: uid(), name: newBucket.name, amount: Number(newBucket.amount), icon: newBucket.icon, ...(type==="variable"?{trackingOnly:!!newBucket.trackingOnly}:{}) };
    const key = type==="fixed"?"fixedBuckets":"variableBuckets";
    save({ ...data, [key]: [...data[key], bucket] });
    setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"" });
    showToast("באקט נוסף ✓");
  };

  const saveBucketEdit = () => {
    if (!editBucket.name || !editBucket.amount) return showToast("נא למלא שם וסכום", "#ef4444");
    const key = editBucket.type==="fixed"?"fixedBuckets":"variableBuckets";
    save({ ...data, [key]: data[key].map(b=>b.id===editBucket.id?{...b, name:editBucket.name, amount:Number(editBucket.amount), icon:editBucket.icon, ...(editBucket.type==="variable"?{trackingOnly:!!editBucket.trackingOnly}:{})}:b) });
    setEditBucket(null); showToast("באקט עודכן ✓");
  };

  const deleteBucket = (type, id) => { const key=type==="fixed"?"fixedBuckets":"variableBuckets"; save({...data,[key]:data[key].filter(b=>b.id!==id)}); };

  const reorderBuckets = (type) => {
    if (dragItem.current===null || dragOver.current===null || dragItem.current===dragOver.current) return;
    const key = type==="fixed"?"fixedBuckets":"variableBuckets";
    const arr = [...data[key]]; const [moved]=arr.splice(dragItem.current,1); arr.splice(dragOver.current,0,moved);
    dragItem.current=null; dragOver.current=null; save({...data,[key]:arr});
  };

  const addExpense = () => {
    if (!newExpense.bucketId || !newExpense.amount) return showToast("נא לבחור קטגוריה וסכום", "#ef4444");
    const expense = { id:uid(), ...newExpense, amount:Number(newExpense.amount), createdAt:Date.now() };
    save({ ...data, expenses:[...data.expenses, expense] });
    setNewExpense({ bucketId:"", amount:"", note:"", date:new Date().toISOString().slice(0,10), paymentMethodId:"" });
    showToast("הוצאה נרשמה ✓"); setView("dashboard");
  };

  const deleteExpense = (id) => save({ ...data, expenses:data.expenses.filter(e=>e.id!==id) });

  const addPaymentMethod = () => {
    if (!newPM.name) return showToast("נא להזין שם", "#ef4444");
    if (newPM.type==="card" && !/^\d{4}$/.test(newPM.digits)) return showToast("נא להזין 4 ספרות אחרונות", "#ef4444");
    const pm = { id:uid(), type:newPM.type, name:newPM.name, digits:newPM.digits };
    save({ ...data, paymentMethods:[...(data.paymentMethods||[]), pm] });
    setNewPM({ type:"card", name:"", digits:"" }); showToast("אמצעי תשלום נוסף ✓");
  };
  const deletePM = (id) => save({ ...data, paymentMethods:data.paymentMethods.filter(p=>p.id!==id) });

  const addIncome = () => {
    if (!newIncome.label || !newIncome.amount) return showToast("נא למלא שם וסכום", "#ef4444");
    const inc = { id: uid(), label: newIncome.label, amount: Number(newIncome.amount) };
    save({ ...data, incomes: [...(data.incomes||[]), inc] });
    setNewIncome({ label: "", amount: "" });
    showToast("מקור הכנסה נוסף ✓");
  };
  const deleteIncome = (id) => save({ ...data, incomes: (data.incomes||[]).filter(x=>x.id!==id) });

  const addSaving = () => {
    if (!newSaving.amount) return showToast("נא להזין סכום", "#ef4444");
    const s = { id:uid(), ...newSaving, amount:Number(newSaving.amount), createdAt:Date.now() };
    save({ ...data, savings:[...(data.savings||[]), s] });
    setNewSaving({ channel:"bank", amount:"", note:"", date:new Date().toISOString().slice(0,10) });
    showToast("חסכון נרשם ✓");
  };
  const deleteSaving = (id) => save({ ...data, savings:(data.savings||[]).filter(s=>s.id!==id) });
  const totalSavings = (data.savings||[]).reduce((s,x)=>s+Number(x.amount),0);

  const addSnapshotItem = () => {
    if (!newSnapshotItem.name || !newSnapshotItem.balance) return showToast("נא למלא שם ויתרה", "#ef4444");
    const item = { id:uid(), channel:newSnapshotItem.channel, name:newSnapshotItem.name, balance:Number(newSnapshotItem.balance), updatedAt:Date.now() };
    save({ ...data, savingsSnapshot:[...(data.savingsSnapshot||[]), item] });
    setNewSnapshotItem({ channel:"bank", name:"", balance:"" });
    showToast("מוצר נוסף ✓");
  };
  const updateSnapshotBalance = (id, val) => {
    save({ ...data, savingsSnapshot:(data.savingsSnapshot||[]).map(x=>x.id===id?{...x,balance:Number(val),updatedAt:Date.now()}:x) });
    setEditSnapshotId(null);
  };
  const deleteSnapshotItem = (id) => save({ ...data, savingsSnapshot:(data.savingsSnapshot||[]).filter(x=>x.id!==id) });
  const totalSnapshotBalance = (data.savingsSnapshot||[]).reduce((s,x)=>s+Number(x.balance||0),0);

  const addNote = () => {
    if (!newNote.body.trim()) return showToast("נא לכתוב משהו", "#f59e0b");
    const n = { id:uid(), title:newNote.title, body:newNote.body, color:newNote.color, createdAt:Date.now(), updatedAt:Date.now() };
    save({ ...data, notes:[n, ...(data.notes||[])] });
    setNewNote({ title:"", body:"", color:"#fef9c3" });
    showToast("רשומה נשמרה ✓");
  };
  const deleteNote = (id) => save({ ...data, notes:(data.notes||[]).filter(n=>n.id!==id) });
  const saveNoteEdit = () => {
    save({ ...data, notes:(data.notes||[]).map(n=>n.id===editNote.id?{...n,...editNote,updatedAt:Date.now()}:n) });
    setEditNote(null); showToast("רשומה עודכנה ✓");
  };
  const theme = THEMES[data.theme||"ocean"] || THEMES.ocean;

  // ── Export ────────────────────────────────────────────────────────────────
  // All billing cycles with expenses
  const allCycles = [...new Set(data.expenses.map(e => getCycleStart(new Date(e.date)).toISOString().slice(0,10)))].sort().reverse();
  const getCycleLabel = (isoStr) => { const cs=new Date(isoStr); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9); return `${fmt2(cs)} – ${fmt2(ce)}`; };

  const exportToExcel = () => {
    const isMonthly = exportType === "monthly";
    const periodExpenses = isMonthly
      ? data.expenses.filter(e => { const d=new Date(e.date); d.setHours(0,0,0,0); const cs=new Date(exportCycle); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9); return d>=cs&&d<=ce; })
      : data.expenses.filter(e => getWeekId(e.date)===exportWeek);
    if (periodExpenses.length===0) return showToast("אין הוצאות לתקופה זו", "#f59e0b");
    const wb = XLSX.utils.book_new();
    // Sheet 1: expenses
    const expRows = periodExpenses.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(e=>({
      "תאריך":e.date,
      "קטגוריה":getBucketName(e.bucketId).replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g,"").trim(),
      "סכום ₪":Number(e.amount),
      "אמצעי תשלום":getPMLabel(e.paymentMethodId).replace(/[^\u0590-\u05FFa-zA-Z0-9\s*]/g,"").trim(),
      "הערה":e.note||"",
    }));
    const wsExp=XLSX.utils.json_to_sheet(expRows,{header:["תאריך","קטגוריה","סכום ₪","אמצעי תשלום","הערה"]});
    wsExp["!cols"]=[{wch:12},{wch:18},{wch:10},{wch:22},{wch:20}];
    XLSX.utils.book_append_sheet(wb,wsExp,"הוצאות");
    // Sheet 2: bucket summary
    const totalSpent=periodExpenses.reduce((s,e)=>s+Number(e.amount),0);
    const budgetRef=isMonthly?totalVariableBudget:weeklyVariableBudget;
    const budgetCol=isMonthly?"תקציב חודשי ₪":"תקציב שבועי ₪";
    const bSum=data.variableBuckets.map(b=>{
      const spent=periodExpenses.filter(e=>e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
      const bud=isMonthly?Number(b.amount):Number(b.amount)/weeksInMonth;
      return {"קטגוריה":b.name,[budgetCol]:Math.round(bud),"הוצאה בפועל ₪":spent,"נשאר ₪":Math.round(bud-spent),"אחוז ניצול":bud>0?Math.round((spent/bud)*100)+"%":"—"};
    });
    bSum.push({"קטגוריה":"סה\"כ",[budgetCol]:Math.round(budgetRef),"הוצאה בפועל ₪":Math.round(totalSpent),"נשאר ₪":Math.round(budgetRef-totalSpent),"אחוז ניצול":budgetRef>0?Math.round((totalSpent/budgetRef)*100)+"%":"—"});
    const wsS=XLSX.utils.json_to_sheet(bSum,{header:["קטגוריה",budgetCol,"הוצאה בפועל ₪","נשאר ₪","אחוז ניצול"]});
    wsS["!cols"]=[{wch:18},{wch:16},{wch:16},{wch:12},{wch:14}];
    XLSX.utils.book_append_sheet(wb,wsS,"סיכום קטגוריות");
    // Sheet 3 (monthly): weekly breakdown
    if (isMonthly) {
      const cs=new Date(exportCycle); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9);
      const weeks=[]; let cur=new Date(cs);
      while(cur<=ce){const wid=getWeekId(cur);if(!weeks.includes(wid))weeks.push(wid);cur.setDate(cur.getDate()+7);}
      const wRows=weeks.map(wid=>{const wE=periodExpenses.filter(e=>getWeekId(e.date)===wid);return{"שבוע":getWeekLabel(wid),"הוצאות ₪":wE.reduce((s,e)=>s+Number(e.amount),0),"מספר עסקאות":wE.length};});
      const wsW=XLSX.utils.json_to_sheet(wRows,{header:["שבוע","הוצאות ₪","מספר עסקאות"]});wsW["!cols"]=[{wch:22},{wch:14},{wch:16}];
      XLSX.utils.book_append_sheet(wb,wsW,"פירוט שבועי");
    }
    // Sheet 4: by payment method
    const pmS=(data.paymentMethods||[]).map(pm=>{const pmE=periodExpenses.filter(e=>e.paymentMethodId===pm.id);return{"אמצעי תשלום":pm.type==="card"?`${pm.name} ****${pm.digits}`:pm.name,"מספר עסקאות":pmE.length,"סה\"כ ₪":pmE.reduce((s,e)=>s+Number(e.amount),0)};});
    const utag=periodExpenses.filter(e=>!e.paymentMethodId);
    if(utag.length>0)pmS.push({"אמצעי תשלום":"לא מוגדר","מספר עסקאות":utag.length,"סה\"כ ₪":utag.reduce((s,e)=>s+Number(e.amount),0)});
    if(pmS.length>0){const wsPM=XLSX.utils.json_to_sheet(pmS,{header:["אמצעי תשלום","מספר עסקאות","סה\"כ ₪"]});wsPM["!cols"]=[{wch:24},{wch:16},{wch:12}];XLSX.utils.book_append_sheet(wb,wsPM,"לפי אמצעי תשלום");}
    XLSX.writeFile(wb,isMonthly?`הוצאות_חודשי_${exportCycle}.xlsx`:`הוצאות_שבועי_${exportWeek}.xlsx`);
    showToast("קובץ אקסל הורד ✓");
  };

  const [isLocked, setIsLocked] = useState(() => {
    // Stay unlocked for 30 min after last unlock
    const t = sessionStorage.getItem("vault-unlocked");
    return !t || Date.now() - Number(t) > 30 * 60 * 1000;
  });
  const [vaultPin, setVaultPin] = useState("");
  const [vaultShake, setVaultShake] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false); // animation state

  const handleVaultDigit = (d) => {
    const next = vaultPin + d;
    setVaultPin(next);
    if (next.length === 4) {
      if (next === "1003") {
        setVaultOpen(true);
        setTimeout(() => {
          sessionStorage.setItem("vault-unlocked", Date.now());
          setIsLocked(false);
          setVaultPin("");
          setVaultOpen(false);
        }, 700);
      } else {
        setVaultShake(true);
        setTimeout(() => { setVaultShake(false); setVaultPin(""); }, 600);
      }
    }
  };

  if (isLocked) return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", direction:"rtl", background:"linear-gradient(160deg,#0f172a 0%,#1e3a5f 100%)", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes vaultSpin { from{transform:rotate(0deg)} to{transform:rotate(180deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .vault-shake { animation: shake 0.5s ease; }
        .vault-open { animation: vaultSpin 0.6s ease forwards; }
        .vault-fadein { animation: fadeIn 0.5s ease; }
      `}</style>

      {/* Vault door */}
      <div className="vault-fadein" style={{ marginBottom:32, position:"relative" }}>
        <svg width={140} height={140} viewBox="0 0 140 140" className={vaultOpen ? "vault-open" : ""} style={{ transformOrigin:"center" }}>
          {/* Outer ring */}
          <circle cx={70} cy={70} r={66} fill="none" stroke="#334155" strokeWidth={8}/>
          <circle cx={70} cy={70} r={66} fill="none" stroke="url(#vg)" strokeWidth={4} strokeDasharray="12 6"/>
          {/* Body */}
          <circle cx={70} cy={70} r={56} fill="#1e293b"/>
          <circle cx={70} cy={70} r={56} fill="none" stroke="#334155" strokeWidth={3}/>
          {/* Handle rim */}
          <circle cx={70} cy={70} r={32} fill="none" stroke="#475569" strokeWidth={6}/>
          <circle cx={70} cy={70} r={32} fill="none" stroke="#64748b" strokeWidth={2}/>
          {/* Spokes */}
          {[0,60,120,180,240,300].map(a=>{
            const rad=a*Math.PI/180;
            return <line key={a} x1={70+32*Math.cos(rad)} y1={70+32*Math.sin(rad)} x2={70+52*Math.cos(rad)} y2={70+52*Math.sin(rad)} stroke="#334155" strokeWidth={4} strokeLinecap="round"/>;
          })}
          {/* Center knob */}
          <circle cx={70} cy={70} r={10} fill="#334155"/>
          <circle cx={70} cy={70} r={6} fill={vaultOpen?"#10b981":"#1e40af"}/>
          <circle cx={70} cy={70} r={3} fill={vaultOpen?"#6ee7b7":"#60a5fa"}/>
          {/* Lock indicator dots */}
          {[0,90,180,270].map(a=>{
            const rad=a*Math.PI/180;
            return <circle key={a} cx={70+44*Math.cos(rad)} cy={70+44*Math.sin(rad)} r={4} fill={vaultOpen?"#10b981":"#334155"} stroke="#475569" strokeWidth={1.5}/>;
          })}
          <defs>
            <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#1e40af"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div style={{ color:"#fff", fontSize:22, fontWeight:800, marginBottom:6, letterSpacing:"-0.5px" }}>הכספת המשפחתית</div>
      <div style={{ color:"#94a3b8", fontSize:13, marginBottom:32 }}>הזן קוד כניסה</div>

      {/* PIN dots */}
      <div className={vaultShake?"vault-shake":""} style={{ display:"flex", gap:14, marginBottom:32 }}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{ width:18, height:18, borderRadius:"50%", background:i<vaultPin.length?"#3b82f6":"transparent", border:"2px solid", borderColor:i<vaultPin.length?"#3b82f6":"#475569", transition:"all .15s", boxShadow:i<vaultPin.length?"0 0 10px rgba(59,130,246,.5)":"none" }}/>
        ))}
      </div>

      {/* Keypad */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, width:220, direction:"ltr" }}>
        {[1,2,3,4,5,6,7,8,9].map(d=>(
          <button key={d} onClick={()=>handleVaultDigit(String(d))}
            style={{ background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", borderRadius:14, height:60, fontSize:22, fontWeight:700, color:"#fff", cursor:"pointer", backdropFilter:"blur(4px)", transition:"all .1s", boxShadow:"0 2px 8px rgba(0,0,0,.3)" }}
            onMouseDown={e=>e.currentTarget.style.background="rgba(59,130,246,.3)"}
            onMouseUp={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"}
            onTouchStart={e=>e.currentTarget.style.background="rgba(59,130,246,.3)"}
            onTouchEnd={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"}
          >{d}</button>
        ))}
        {/* Bottom row: empty, 0, backspace */}
        <div/>
        <button onClick={()=>handleVaultDigit("0")}
          style={{ background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.1)", borderRadius:14, height:60, fontSize:22, fontWeight:700, color:"#fff", cursor:"pointer", backdropFilter:"blur(4px)", boxShadow:"0 2px 8px rgba(0,0,0,.3)" }}
          onMouseDown={e=>e.currentTarget.style.background="rgba(59,130,246,.3)"}
          onMouseUp={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"}
          onTouchStart={e=>e.currentTarget.style.background="rgba(59,130,246,.3)"}
          onTouchEnd={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"}
        >0</button>
        <button onClick={()=>setVaultPin(p=>p.slice(0,-1))}
          style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", borderRadius:14, height:60, fontSize:20, color:"#94a3b8", cursor:"pointer", backdropFilter:"blur(4px)" }}>
          ⌫
        </button>
      </div>
    </div>
  );

  // ── UI helpers ────────────────────────────────────────────────────────────
  const pct = (val,max) => Math.min(100, max>0?(val/max)*100:0);
  const weekPct = pct(spentThisWeek, weeklyVariableBudget);
  const barColor = weekPct>90?"#ef4444":weekPct>70?"#f59e0b":"#10b981";
  const hasFixedOverflow = fixedOverflowThisMonth > 0;
  const inputStyle = { border:"1.5px solid #e2e8f0", borderRadius:10, padding:"10px 12px", fontSize:13, outline:"none", background:"#fff" };
  const cardStyle = { background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 6px rgba(0,0,0,.07)" };

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif", direction:"rtl", background:"#f8fafc", minHeight:"100vh", maxWidth:480, margin:"0 auto", paddingBottom:90 }}
      onClick={e=>{ if(showWeekPicker && !e.target.closest('[data-weekpicker]')) setShowWeekPicker(false); }}>

      {toast && <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background:toast.color, color:"#fff", padding:"10px 22px", borderRadius:50, fontWeight:700, zIndex:999, boxShadow:"0 4px 20px rgba(0,0,0,.15)", fontSize:14 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${theme.a} 0%,${theme.b} 100%)`, padding:"28px 20px 20px", color:"#fff" }}>
        <div style={{ fontSize:12, opacity:.7, marginBottom:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>ניהול הוצאות בית</span>
          <span style={{ fontSize:10, opacity:.8 }}>
            {syncing ? "⟳ מסנכרן..." : lastSync ? `✓ סונכרן ${lastSync.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}` : ""}
          </span>
        </div>
        <div style={{ fontSize:28, fontWeight:800 }}>
          {leftThisWeek>=0?`₪${leftThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})}`:`-₪${Math.abs(leftThisWeek).toLocaleString("he-IL",{maximumFractionDigits:0})}`}
        </div>
        <div style={{ fontSize:13, opacity:.8, marginBottom:12 }}>
          נשאר השבוע מהמשתנות{hasFixedOverflow&&<span style={{fontSize:11,opacity:.8}}> (כולל קיזוז חריגות)</span>}
        </div>
        <div style={{ background:"rgba(255,255,255,.2)", borderRadius:8, height:8, overflow:"hidden" }}>
          <div style={{ background:barColor, height:"100%", width:`${weekPct}%`, transition:"width .4s", borderRadius:8 }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:5, opacity:.75 }}>
          <span>₪{spentThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})} הוצאה{trackingSpentThisWeek>0?` + ₪${trackingSpentThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})} מעקב`:""}</span>
          <span>תקציב שבועי: ₪{weeklyVariableBudget.toLocaleString("he-IL",{maximumFractionDigits:0})}</span>
        </div>
        {hasFixedOverflow && (
          <div style={{ marginTop:10, background:"rgba(239,68,68,.2)", borderRadius:10, padding:"8px 12px", fontSize:11, display:"flex", alignItems:"center", gap:6 }}>
            <span>⚠️</span>
            <span>חריגה בקבועות: ₪{fixedOverflowThisMonth.toLocaleString("he-IL",{maximumFractionDigits:0})} | קנס שבועי: ₪{weeklyFixedOverflowPenalty.toLocaleString("he-IL",{maximumFractionDigits:0})} ({weeksRemaining.toFixed(1)} שבועות)</span>
          </div>
        )}
        {/* Week navigation */}
        <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
          {/* Prev week */}
          <button onClick={()=>{
            const d=new Date(selectedWeek); d.setDate(d.getDate()-7);
            setSelectedWeek(getWeekId(d));
          }} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", borderRadius:10, width:32, height:32, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>

          {/* Week label + calendar icon */}
          <div style={{ flex:1, position:"relative" }} data-weekpicker="true">
            <button onClick={()=>setShowWeekPicker(p=>!p)}
              style={{ width:"100%", background:"rgba(255,255,255,.2)", border:"none", color:"#fff", borderRadius:10, padding:"6px 10px", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <span>📅</span>
              <span>{selectedWeek===getWeekId()?"שבוע זה":getWeekLabel(selectedWeek)}</span>
            </button>

            {/* Dropdown picker */}
            {showWeekPicker && (
              <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, left:0, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", zIndex:200, padding:12, maxHeight:260, overflowY:"auto" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:8, textAlign:"center" }}>בחר שבוע</div>
                {/* Current week always first */}
                {[getWeekId(), ...[...new Set([...allWeeks].filter(w=>w!==getWeekId()))].sort().reverse()].map(w=>(
                  <button key={w} onClick={()=>{ setSelectedWeek(w); setShowWeekPicker(false); }}
                    style={{ width:"100%", background:selectedWeek===w?"#eff6ff":"transparent", color:selectedWeek===w?"#2563eb":"#1e293b", border:"none", borderRadius:8, padding:"8px 10px", fontSize:12, fontWeight:selectedWeek===w?700:400, cursor:"pointer", textAlign:"right", marginBottom:2 }}>
                    {w===getWeekId()?"שבוע זה — ":""}{getWeekLabel(w)}
                  </button>
                ))}
                <div style={{ borderTop:"1px solid #f1f5f9", marginTop:8, paddingTop:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:6, textAlign:"center" }}>או בחר תאריך</div>
                  <input type="date" onChange={e=>{ if(e.target.value){ setSelectedWeek(getWeekId(new Date(e.target.value))); setShowWeekPicker(false); }}}
                    style={{ width:"100%", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"8px", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
                </div>
              </div>
            )}
          </div>

          {/* Next week */}
          <button onClick={()=>{
            const d=new Date(selectedWeek); d.setDate(d.getDate()+7);
            const next=getWeekId(d);
            if(next<=getWeekId()) setSelectedWeek(next);
          }} style={{ background:"rgba(255,255,255,.2)", border:"none", color:new Date(selectedWeek)>=new Date(getWeekId())?"rgba(255,255,255,.3)":"#fff", borderRadius:10, width:32, height:32, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>›</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-around", padding:"10px 0" }}>
        {[["dashboard","📊","סיכום"],["variable","🔄","משתנות"],["fixed","📌","קבועות"],["savings","🐷","חסכון"],["analytics","📈","ניתוח"],["notes","📝","רשומות"],["settings","⚙️","הגדרות"]].map(([id,icon,label])=>(
          <button key={id} onClick={()=>setView(id)} style={{ background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:"pointer", color:view===id?theme.acc:"#94a3b8", fontSize:10, fontWeight:view===id?700:400, padding:"4px 10px" }}>
            <span style={{fontSize:18}}>{icon}</span>{label}
          </button>
        ))}
      </div>

      <div style={{ padding:"16px 16px 0" }}>

        {/* ── DASHBOARD ── */}
        {view==="dashboard" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
              {[{label:"הכנסה",val:totalMonthlyIncome,color:theme.incomeColor,bg:theme.light},{label:"הוצאות",val:totalBudget,color:"#f59e0b",bg:"#fffbeb"},{label:"עודף",val:remaining,color:remaining>=0?theme.acc:"#ef4444",bg:remaining>=0?theme.light:"#fef2f2"}].map(c=>(
                <div key={c.label} style={{ background:c.bg, borderRadius:14, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>{c.label}</div>
                  <div style={{fontSize:15,fontWeight:800,color:c.color}}>₪{Math.abs(c.val).toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
                </div>
              ))}
            </div>

            {/* ── Alerts ── */}
            {alerts.length>0&&(
              <div style={{marginBottom:12}}>
                {alerts.map((a,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,marginBottom:6,background:a.type==="danger"?"#fef2f2":a.type==="warn"?"#fffbeb":"#f0fdf4",border:`1px solid ${a.type==="danger"?"#fecaca":a.type==="warn"?"#fde68a":"#bbf7d0"}`}}>
                    <span style={{fontSize:12,color:a.type==="danger"?"#dc2626":a.type==="warn"?"#d97706":"#16a34a",fontWeight:600,lineHeight:1.4}}>{a.msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Test Tubes ── */}
            {(()=>{
              const todayD=new Date(); todayD.setHours(0,0,0,0);
              const dayOfWeek=todayD.getDay(); const daysPassed=dayOfWeek+1;
              const weekFillPct=daysPassed/7;
              const budgetFillPct=weeklyVariableBudget>0?Math.max(0,leftThisWeek/weeklyVariableBudget):0;
              const budgetOver=leftThisWeek<0;
              const DAY_LABELS=["א","ב","ג","ד","ה","ו","ש"];
              const TW=56,TH=220,tx=8,tw=40,topY=18,botY=192,rx=20;
              const tubePath=`M ${tx} ${topY} L ${tx} ${botY-rx} Q ${tx} ${botY} ${tx+rx} ${botY} L ${tx+tw-rx} ${botY} Q ${tx+tw} ${botY} ${tx+tw} ${botY-rx} L ${tx+tw} ${topY}`;
              const tubeClipPath=tubePath+` Z`;
              const Tube=({fillPct,gradA,gradB,label,title,sub,extra,showDots})=>{
                const clamp=Math.min(1,Math.max(0,fillPct));
                const fillableH=botY-topY; const liquidY=botY-clamp*fillableH;
                const gradId="tg-"+label; const clipId="tc-"+label; const shimId="ts-"+label;
                const ticks=[0.25,0.5,0.75];
                return (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#334155",letterSpacing:"-0.3px",textAlign:"center"}}>{title}</div>
                    <svg width={TW+24} height={TH} viewBox={`-12 0 ${TW+24} ${TH}`} style={{overflow:"visible"}}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={gradA} stopOpacity="0.95"/><stop offset="100%" stopColor={gradB} stopOpacity="1"/></linearGradient>
                        <linearGradient id={shimId} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(255,255,255,0.55)"/><stop offset="45%" stopColor="rgba(255,255,255,0.0)"/></linearGradient>
                        <clipPath id={clipId}><path d={tubeClipPath}/></clipPath>
                      </defs>
                      {ticks.map(t=>{const ty2=botY-t*fillableH;return(<g key={t}><line x1={tx+tw} y1={ty2} x2={tx+tw+8} y2={ty2} stroke="#cbd5e1" strokeWidth="1.2"/><text x={tx+tw+11} y={ty2+4} fontSize="8" fill="#94a3b8" fontWeight="600">{Math.round(t*100)}%</text></g>);})}
                      <path d={tubePath} fill="rgba(248,250,252,0.9)" stroke="rgba(148,163,184,0.4)" strokeWidth="1.5"/>
                      {clamp>0&&<rect x={tx} y={liquidY} width={tw} height={TH} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`}/>}
                      {clamp>0.02&&<path d={`M ${tx+1} ${liquidY} Q ${tx+tw*0.3} ${liquidY-3} ${tx+tw*0.5} ${liquidY} Q ${tx+tw*0.7} ${liquidY+3} ${tx+tw-1} ${liquidY}`} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" clipPath={`url(#${clipId})`}/>}
                      <rect x={tx+3} y={topY} width={7} height={(botY-topY)*0.7} rx={3} fill={`url(#${shimId})`} clipPath={`url(#${clipId})`}/>
                      <path d={tubePath} fill="none" stroke="rgba(100,116,139,0.5)" strokeWidth="1.5"/>
                      <rect x={tx-3} y={topY-8} width={tw+6} height={9} rx={3} fill="#e2e8f0" stroke="rgba(148,163,184,0.6)" strokeWidth="1"/>
                      <text x={tx+tw/2} y={topY+(botY-topY)*0.55} textAnchor="middle" fontSize="15" fontWeight="900" fill={clamp>0.4?"rgba(255,255,255,0.95)":"#64748b"} style={{fontFamily:"system-ui,sans-serif"}}>{Math.round(fillPct*100)}%</text>
                    </svg>
                    {showDots&&<div style={{display:"flex",gap:5}}>{DAY_LABELS.map((d,i)=>(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{width:9,height:9,borderRadius:"50%",background:i<daysPassed?gradB:"#e2e8f0",boxShadow:i===dayOfWeek?`0 0 0 2px #fff, 0 0 0 3.5px ${gradB}`:"none",transition:"all .2s"}}/><span style={{fontSize:8,color:i===dayOfWeek?gradB:"#94a3b8",fontWeight:i===dayOfWeek?800:400}}>{d}</span></div>))}</div>}
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:13,fontWeight:800,color:"#1e293b"}}>{sub}</div>
                      {extra&&<div style={{fontSize:11,fontWeight:700,color:"#ef4444",marginTop:2}}>{extra}</div>}
                    </div>
                  </div>
                );
              };
              const statusMsg=budgetOver?{text:`חרגת ₪${Math.abs(Math.round(leftThisWeek)).toLocaleString("he-IL")}`,color:"#ef4444",bg:"#fef2f2"}:weekFillPct>budgetFillPct+0.15?{text:"הימים רצים מהר מהתקציב",color:"#b45309",bg:"#fffbeb"}:{text:"אתה בקצב טוב ✓",color:"#065f46",bg:"#f0fdf4"};
              return (
                <div style={{...cardStyle,marginBottom:16,background:"#fafbff",border:"1px solid #e8edf5"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>מצב השבוע</span>
                    <span style={{fontSize:11,fontWeight:700,color:statusMsg.color,background:statusMsg.bg,padding:"3px 10px",borderRadius:20}}>{statusMsg.text}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-start"}}>
                    <Tube label="days" fillPct={weekFillPct} gradA="#a78bfa" gradB="#4f46e5" title="ימים שעברו" sub={`${daysPassed} / 7`} showDots/>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:90,gap:4,opacity:.3}}>
                      <div style={{width:1,height:36,background:"#94a3b8"}}/><span style={{fontSize:9,fontWeight:800,color:"#94a3b8",letterSpacing:1}}>VS</span><div style={{width:1,height:36,background:"#94a3b8"}}/>
                    </div>
                    <Tube label="budget" fillPct={budgetFillPct} gradA={budgetOver?"#fca5a5":budgetFillPct<0.25?"#fde68a":"#6ee7b7"} gradB={budgetOver?"#dc2626":budgetFillPct<0.25?"#d97706":"#059669"} title="תקציב שנשאר" sub={`₪${Math.abs(Math.round(leftThisWeek)).toLocaleString("he-IL")}`} extra={budgetOver?"חריגה!":null}/>
                  </div>
                </div>
              );
            })()}

            {/* Variable buckets summary */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#1e293b",marginBottom:10}}>משתנות – {getWeekLabel(selectedWeek)}</div>
              {data.variableBuckets.length===0?<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>אין באקטים משתנים עדיין</div>:
              data.variableBuckets.map(b=>{
                const wB=Number(b.amount)/weeksInMonth; const spent=bucketSpendThisWeek(b.id); const p=pct(spent,wB); const bc=p>90?"#ef4444":p>65?"#f59e0b":"#10b981";
                return (<div key={b.id} style={{...cardStyle,padding:"12px 14px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{ICONS[b.icon]}</span><span style={{fontSize:14,fontWeight:600}}>{b.name}</span></div>
                    <div style={{fontSize:12,color:"#64748b"}}><span style={{color:bc,fontWeight:700}}>₪{spent.toLocaleString("he-IL",{maximumFractionDigits:0})}</span>{" / "}₪{wB.toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
                  </div>
                  <div style={{background:"#f1f5f9",borderRadius:6,height:5,overflow:"hidden"}}><div style={{background:bc,height:"100%",width:`${p}%`,transition:"width .3s",borderRadius:6}}/></div>
                </div>);
              })}
            </div>

            {/* Recent expenses */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#1e293b",marginBottom:10}}>הוצאות אחרונות</div>
              {expensesThisWeek.length===0?<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>אין הוצאות השבוע</div>:
              [...expensesThisWeek].sort((a,b)=>b.createdAt-a.createdAt).slice(0,10).map(e=>(
                <div key={e.id} style={{background:"#fff",borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{getBucketName(e.bucketId)}</div>
                    {e.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{e.note}</div>}
                    <div style={{fontSize:11,color:"#cbd5e1",display:"flex",gap:6,marginTop:2}}>
                      <span>{new Date(e.date).toLocaleDateString("he-IL")}</span>
                      {e.paymentMethodId&&<span style={{color:"#a5b4fc"}}>{getPMLabel(e.paymentMethodId)}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontWeight:800,color:"#ef4444",fontSize:15}}>₪{Number(e.amount).toLocaleString("he-IL")}</span>
                    <button onClick={()=>deleteExpense(e.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── VARIABLE ── */}
        {view==="variable" && (
          <>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>הוצאות משתנות</div>
            <div style={{background:theme.varBg,borderRadius:12,padding:"12px 16px",marginBottom:16,fontSize:13}}>
              <div style={{color:theme.varText,fontWeight:700}}>סה"כ חודשי: ₪{totalVariableBudget.toLocaleString("he-IL")}</div>
              <div style={{color:theme.varSub,marginTop:2}}>תקציב שבועי: ₪{weeklyVariableBudget.toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
            </div>
            {data.variableBuckets.map(b=>{
              const wB=Number(b.amount)/weeksInMonth; const spent=bucketSpendThisWeek(b.id); const isEditing=editBucket?.id===b.id;
              return (
                <div key={b.id} draggable={!isEditing} onDragStart={()=>{dragItem.current=data.variableBuckets.indexOf(b);}} onDragEnter={()=>{dragOver.current=data.variableBuckets.indexOf(b);}} onDragEnd={()=>reorderBuckets("variable")} onDragOver={e=>e.preventDefault()}
                  style={{...cardStyle,border:isEditing?`2px solid ${theme.btn}`:"2px solid transparent",cursor:isEditing?"default":"grab",userSelect:"none"}}>
                  {isEditing?(
                    <>
                      <div style={{fontSize:12,fontWeight:700,color:theme.btn,marginBottom:10}}>✏️ עריכת באקט</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        <input value={editBucket.name} onChange={e=>setEditBucket(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="שם"/>
                        <input type="number" value={editBucket.amount} onChange={e=>setEditBucket(p=>({...p,amount:e.target.value}))} style={inputStyle} placeholder="סכום חודשי ₪"/>
                      </div>
                      <button onClick={()=>setEditBucket(p=>({...p,offBudget:!p.offBudget}))}
                        style={{width:"100%",background:editBucket.offBudget?"#fef9c3":theme.btnLight,border:`1.5px solid ${editBucket.offBudget?"#ca8a04":theme.btn}`,borderRadius:8,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:10,color:editBucket.offBudget?"#92400e":theme.btn}}>
                        {editBucket.offBudget?"📊 מעקב בלבד (לא מחושב בתקציב)":"💰 מחושב בתקציב השבועי"} — לחץ לשינוי
                      </button>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                        {Object.entries(ICONS).slice(0,11).map(([k,v])=>(<button key={k} onClick={()=>setEditBucket(p=>({...p,icon:k}))} style={{background:editBucket.icon===k?theme.btnLight:"#f1f5f9",border:editBucket.icon===k?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:7,padding:"5px 8px",fontSize:15,cursor:"pointer"}}>{v}</button>))}
                      </div>
                      <div onClick={()=>setEditBucket(p=>({...p,trackingOnly:!p.trackingOnly}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:editBucket.trackingOnly?"#fef9c3":"#f0fdf4",border:editBucket.trackingOnly?"1.5px solid #f59e0b":"1.5px solid #86efac",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
                        <span style={{fontSize:14}}>{editBucket.trackingOnly?"📊":"💰"}</span>
                        <span style={{fontSize:12,fontWeight:600,color:editBucket.trackingOnly?"#92400e":"#166534",flex:1}}>{editBucket.trackingOnly?"מעקב בלבד — לא משפיע על תקציב שבועי":"מחושב בתקציב השבועי"}</span>
                        <div style={{width:32,height:18,background:editBucket.trackingOnly?"#f59e0b":"#22c55e",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:editBucket.trackingOnly?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <button onClick={()=>setEditBucket(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>ביטול</button>
                        <button onClick={()=>deleteBucket("variable",b.id)} style={{background:"#fef2f2",color:"#ef4444",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>מחק</button>
                        <button onClick={saveBucketEdit} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>שמור</button>
                      </div>
                    </>
                  ):(
                    <>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:700}}>
                          <span style={{fontSize:13,color:"#cbd5e1",cursor:"grab",marginLeft:2}}>⠿</span>
                          <span>{ICONS[b.icon]}</span>
                          <div>
                            {b.name}
                            {b.offBudget&&<div style={{fontSize:9,fontWeight:600,color:"#ca8a04",background:"#fef9c3",borderRadius:4,padding:"1px 5px",display:"inline-block",marginRight:4}}>מעקב בלבד</div>}
                          </div>
                        </div>
                        <button onClick={()=>setEditBucket({...b,type:"variable"})} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>✏️ ערוך</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12}}>
                        {[{l:"חודשי",v:`₪${Number(b.amount).toLocaleString("he-IL")}`,c:"#1d4ed8"},{l:"שבועי",v:`₪${wB.toLocaleString("he-IL",{maximumFractionDigits:0})}`,c:"#7c3aed"},{l:"הוצאה השבוע",v:`₪${spent.toLocaleString("he-IL")}`,c:spent>wB?"#ef4444":"#10b981"}].map(x=>(
                          <div key={x.l} style={{background:"#f8fafc",borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                            <div style={{color:"#94a3b8",marginBottom:2}}>{x.l}</div>
                            <div style={{fontWeight:700,color:x.c}}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            <div style={cardStyle}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ הוסף באקט משתנה</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <input placeholder="שם" value={newBucket.name} onChange={e=>setNewBucket(p=>({...p,name:e.target.value}))} style={inputStyle}/>
                <input placeholder="סכום חודשי ₪" type="number" value={newBucket.amount} onChange={e=>setNewBucket(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                {Object.entries(ICONS).slice(0,11).map(([k,v])=>(<button key={k} onClick={()=>setNewBucket(p=>({...p,icon:k}))} style={{background:newBucket.icon===k?theme.btnLight:"#f1f5f9",border:newBucket.icon===k?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:8,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{v}</button>))}
              </div>
              <button onClick={()=>setNewBucket(p=>({...p,offBudget:!p.offBudget}))}
                style={{width:"100%",background:newBucket.offBudget?"#fef9c3":theme.btnLight,border:`1.5px solid ${newBucket.offBudget?"#ca8a04":theme.btn}`,borderRadius:8,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:10,color:newBucket.offBudget?"#92400e":theme.btn}}>
                {newBucket.offBudget?"📊 מעקב בלבד — לא יחושב בתקציב":"💰 מחושב בתקציב השבועי"} — לחץ לשינוי
              </button>
              <div onClick={()=>setNewBucket(p=>({...p,trackingOnly:!p.trackingOnly}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:newBucket.trackingOnly?"#fef9c3":"#f0fdf4",border:newBucket.trackingOnly?"1.5px solid #f59e0b":"1.5px solid #86efac",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
                <span style={{fontSize:14}}>{newBucket.trackingOnly?"📊":"💰"}</span>
                <span style={{fontSize:12,fontWeight:600,color:newBucket.trackingOnly?"#92400e":"#166534",flex:1}}>{newBucket.trackingOnly?"מעקב בלבד — לא משפיע על תקציב שבועי":"מחושב בתקציב השבועי"}</span>
                <div style={{width:32,height:18,background:newBucket.trackingOnly?"#f59e0b":"#22c55e",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:newBucket.trackingOnly?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
              </div>
              <button onClick={()=>addBucket("variable")} style={{width:"100%",background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>הוסף באקט</button>
            </div>
          </>
        )}

        {/* ── FIXED ── */}
        {view==="fixed" && (
          <>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>הוצאות קבועות</div>
            <div style={{background:theme.fixedBg,borderRadius:12,padding:"12px 16px",marginBottom:16,fontSize:13}}>
              <div style={{color:theme.fixedText,fontWeight:700}}>סה"כ חודשי: ₪{totalFixed.toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
              <div style={{color:theme.fixedSub,marginTop:3}}>מחזור נוכחי: {cycleLabel}</div>
            </div>
            {data.fixedBuckets.map(b=>{
              const instLeft = b.isInstallment ? getInstallmentsRemaining(b) : null;
              if (b.isInstallment && instLeft<=0) return null;
              const monthly = getMonthlyAmount(b);
              const spentB=data.expenses.filter(e=>e.bucketId===b.id&&inCurrentCycle(e.date)).reduce((s,e)=>s+Number(e.amount),0);
              const overflow=Math.max(0,spentB-monthly); const hasOver=overflow>0; const isEditing=editBucket?.id===b.id;
              return (
                <div key={b.id} draggable={!isEditing} onDragStart={()=>{dragItem.current=data.fixedBuckets.indexOf(b);}} onDragEnter={()=>{dragOver.current=data.fixedBuckets.indexOf(b);}} onDragEnd={()=>reorderBuckets("fixed")} onDragOver={e=>e.preventDefault()}
                  style={{...cardStyle,border:isEditing?"2px solid #ca8a04":hasOver?"1.5px solid #fca5a5":"1.5px solid transparent",cursor:isEditing?"default":"grab",userSelect:"none"}}>
                  {isEditing?(
                    <>
                      <div style={{fontSize:12,fontWeight:700,color:"#ca8a04",marginBottom:10}}>✏️ עריכת הוצאה קבועה</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                        <input value={editBucket.name} onChange={e=>setEditBucket(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="שם"/>
                        <input type="number" value={editBucket.amount} onChange={e=>setEditBucket(p=>({...p,amount:e.target.value}))} style={inputStyle} placeholder="סכום ₪"/>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
                        {Object.entries(ICONS).slice(11).map(([k,v])=>(<button key={k} onClick={()=>setEditBucket(p=>({...p,icon:k}))} style={{background:editBucket.icon===k?"#fef9c3":"#f1f5f9",border:editBucket.icon===k?"2px solid #ca8a04":"2px solid transparent",borderRadius:7,padding:"5px 8px",fontSize:15,cursor:"pointer"}}>{v}</button>))}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <button onClick={()=>setEditBucket(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>ביטול</button>
                        <button onClick={()=>deleteBucket("fixed",b.id)} style={{background:"#fef2f2",color:"#ef4444",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>מחק</button>
                        <button onClick={saveBucketEdit} style={{background:"#ca8a04",color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>שמור</button>
                      </div>
                    </>
                  ):(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:13,color:"#cbd5e1",cursor:"grab"}}>⠿</span>
                        <span style={{fontSize:22}}>{ICONS[b.icon]}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:700}}>{b.name}</div>
                          <div style={{fontSize:13,color:"#64748b"}}>
                            {b.isInstallment
                              ? <>💳 ₪{monthly.toLocaleString("he-IL",{maximumFractionDigits:0})}/חודש · {instLeft} תשלומים נותרו</>
                              : <>₪{Number(b.amount).toLocaleString("he-IL")} / חודש</>}
                          </div>
                          <div style={{fontSize:12,color:spentB>0?(hasOver?"#ef4444":"#10b981"):"#94a3b8",marginTop:1}}>
                            שולם החודש: ₪{spentB.toLocaleString("he-IL")}
                            {hasOver&&<span style={{fontWeight:700}}> | חריגה: ₪{overflow.toLocaleString("he-IL")} ← קנס ₪{(overflow/weeksRemaining).toLocaleString("he-IL",{maximumFractionDigits:0})}/שבוע</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={()=>setEditBucket({...b,type:"fixed"})} style={{background:"#fefce8",border:"none",color:"#ca8a04",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>✏️ ערוך</button>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={cardStyle}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ הוסף הוצאה קבועה</div>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[["רגילה",false],["תשלומים 💳",true]].map(([label,val])=>(
                  <button key={String(val)} onClick={()=>setNewBucket(p=>({...p,isInstallment:val}))}
                    style={{flex:1,background:newBucket.isInstallment===val?"#fef9c3":"#f1f5f9",border:newBucket.isInstallment===val?"2px solid #ca8a04":"2px solid transparent",borderRadius:8,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:newBucket.isInstallment?"1fr 1fr 1fr":"1fr 1fr",gap:8,marginBottom:10}}>
                <input placeholder="שם" value={newBucket.name} onChange={e=>setNewBucket(p=>({...p,name:e.target.value}))} style={inputStyle}/>
                {newBucket.isInstallment?(
                  <>
                    <input placeholder="סכום כולל ₪" type="number" value={newBucket.totalAmount} onChange={e=>setNewBucket(p=>({...p,totalAmount:e.target.value}))} style={inputStyle}/>
                    <input placeholder="מס׳ תשלומים" type="number" min="1" value={newBucket.installmentsLeft} onChange={e=>setNewBucket(p=>({...p,installmentsLeft:e.target.value}))} style={inputStyle}/>
                  </>
                ):(
                  <input placeholder="סכום ₪ / חודש" type="number" value={newBucket.amount} onChange={e=>setNewBucket(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
                )}
              </div>
              {newBucket.isInstallment&&newBucket.totalAmount&&newBucket.installmentsLeft&&(
                <div style={{background:"#fffbeb",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#92400e"}}>
                  💡 תשלום חודשי: ₪{(Number(newBucket.totalAmount)/Number(newBucket.installmentsLeft)).toLocaleString("he-IL",{maximumFractionDigits:0})}
                </div>
              )}
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                {Object.entries(ICONS).slice(11).map(([k,v])=>(<button key={k} onClick={()=>setNewBucket(p=>({...p,icon:k}))} style={{background:newBucket.icon===k?"#fef9c3":"#f1f5f9",border:newBucket.icon===k?"2px solid #ca8a04":"2px solid transparent",borderRadius:8,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{v}</button>))}
              </div>
              <button onClick={()=>addBucket("fixed")} style={{width:"100%",background:"#ca8a04",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>הוסף</button>
            </div>
          </>
        )}

        {/* ── SAVINGS ── */}
        {view==="savings" && (
          <>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>🐷 חסכונות</div>

            {/* Header card — shows both totals */}
            <div style={{background:`linear-gradient(135deg,${theme.savingsA},${theme.savingsB})`,borderRadius:16,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontSize:11,opacity:.75,marginBottom:3}}>סה"כ הפקדות</div>
                  <div style={{fontSize:22,fontWeight:900}}>₪{totalSavings.toLocaleString("he-IL")}</div>
                  <div style={{fontSize:10,opacity:.65,marginTop:2}}>{(data.savings||[]).length} רשומות</div>
                </div>
                <div style={{borderRight:"1px solid rgba(255,255,255,.25)",paddingRight:12}}>
                  <div style={{fontSize:11,opacity:.75,marginBottom:3}}>מצב נוכחי (snapshot)</div>
                  <div style={{fontSize:22,fontWeight:900}}>₪{totalSnapshotBalance.toLocaleString("he-IL")}</div>
                  <div style={{fontSize:10,opacity:.65,marginTop:2}}>{(data.savingsSnapshot||[]).length} מוצרים</div>
                </div>
              </div>
            </div>

            {/* Sub-tabs */}
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[["deposits","💰 הפקדות"],["snapshot","📸 מצב חסכונות"]].map(([t,label])=>(
                <button key={t} onClick={()=>setSavingsTab(t)}
                  style={{flex:1,background:savingsTab===t?theme.savingsB:"#f1f5f9",color:savingsTab===t?"#fff":"#64748b",border:"none",borderRadius:10,padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── Deposits tab ── */}
            {savingsTab==="deposits" && <>
              {SAVING_CHANNELS.filter(ch=>(data.savings||[]).some(s=>s.channel===ch.id)).length>0&&(
                <div style={cardStyle}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>לפי אפיק</div>
                  {SAVING_CHANNELS.filter(ch=>(data.savings||[]).some(s=>s.channel===ch.id)).map(ch=>{
                    const total=(data.savings||[]).filter(s=>s.channel===ch.id).reduce((s,x)=>s+Number(x.amount),0);
                    const p=totalSavings>0?(total/totalSavings)*100:0;
                    return (<div key={ch.id} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13}}>{ch.icon} {ch.label}</span><span style={{fontSize:13,fontWeight:700,color:theme.savingsA}}>₪{total.toLocaleString("he-IL")}</span></div>
                      <div style={{background:"#f1f5f9",borderRadius:6,height:6,overflow:"hidden"}}><div style={{background:theme.savingsB,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/></div>
                    </div>);
                  })}
                </div>
              )}
              {(data.savings||[]).length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>כל הרשומות</div>
                  {[...(data.savings||[])].sort((a,b)=>b.createdAt-a.createdAt).map(s=>{
                    const ch=SAVING_CHANNELS.find(c=>c.id===s.channel)||SAVING_CHANNELS[6];
                    return (<div key={s.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700}}>{ch.icon} {ch.label}</div>
                        {s.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{s.note}</div>}
                        <div style={{fontSize:11,color:"#cbd5e1",marginTop:2}}>{new Date(s.date).toLocaleDateString("he-IL")}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontWeight:800,color:theme.savingsB,fontSize:15}}>₪{Number(s.amount).toLocaleString("he-IL")}</span>
                        <button onClick={()=>deleteSaving(s.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
                      </div>
                    </div>);
                  })}
                </div>
              )}
              <div style={cardStyle}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ רשום הפקדה</div>
                <select value={newSaving.channel} onChange={e=>setNewSaving(p=>({...p,channel:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
                  {SAVING_CHANNELS.map(ch=><option key={ch.id} value={ch.id}>{ch.icon} {ch.label}</option>)}
                </select>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <input type="number" placeholder="סכום ₪" value={newSaving.amount} onChange={e=>setNewSaving(p=>({...p,amount:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
                  <input type="date" value={newSaving.date} onChange={e=>setNewSaving(p=>({...p,date:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
                </div>
                <input placeholder="הערה" value={newSaving.note} onChange={e=>setNewSaving(p=>({...p,note:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:12,fontSize:14,boxSizing:"border-box"}}/>
                <button onClick={addSaving} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>שמור הפקדה</button>
              </div>
            </>}

            {/* ── Snapshot tab ── */}
            {savingsTab==="snapshot" && <>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:12,textAlign:"center"}}>
                רשום את היתרה הנוכחית בכל מוצר חסכון — עדכן כל חודש לתמונה עדכנית
              </div>

              {/* Snapshot items */}
              {(data.savingsSnapshot||[]).length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>אין מוצרי חסכון עדיין</div>}
              {(data.savingsSnapshot||[]).map(item=>{
                const ch=SAVING_CHANNELS.find(c=>c.id===item.channel)||SAVING_CHANNELS[6];
                const pct=totalSnapshotBalance>0?(item.balance/totalSnapshotBalance)*100:0;
                return (
                  <div key={item.id} style={{...cardStyle,border:`1.5px solid ${theme.btnLight}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:20}}>{ch.icon}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:700}}>{item.name}</div>
                          <div style={{fontSize:11,color:"#94a3b8"}}>{ch.label}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {editSnapshotId===item.id ? (
                          <>
                            <input type="number" defaultValue={item.balance} autoFocus
                              style={{...inputStyle,width:110,fontSize:13,padding:"6px 8px"}}
                              onBlur={e=>updateSnapshotBalance(item.id, e.target.value)}
                              onKeyDown={e=>e.key==="Enter"&&updateSnapshotBalance(item.id,e.target.value)}/>
                          </>
                        ) : (
                          <>
                            <span style={{fontSize:15,fontWeight:800,color:theme.savingsB}} onClick={()=>setEditSnapshotId(item.id)}>
                              ₪{Number(item.balance).toLocaleString("he-IL")}
                            </span>
                            <button onClick={()=>setEditSnapshotId(item.id)} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                          </>
                        )}
                        <button onClick={()=>deleteSnapshotItem(item.id)} style={{background:"#fef2f2",border:"none",color:"#ef4444",borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✕</button>
                      </div>
                    </div>
                    {/* Share bar */}
                    <div style={{background:"#f1f5f9",borderRadius:6,height:5,overflow:"hidden"}}>
                      <div style={{background:theme.savingsB,height:"100%",width:`${pct}%`,borderRadius:6,transition:"width .4s"}}/>
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:4,display:"flex",justifyContent:"space-between"}}>
                      <span>{Math.round(pct)}% מהתיק</span>
                      <span>עודכן {new Date(item.updatedAt).toLocaleDateString("he-IL")}</span>
                    </div>
                  </div>
                );
              })}

              {/* Add snapshot item */}
              <div style={cardStyle}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ הוסף מוצר חסכון</div>
                <select value={newSnapshotItem.channel} onChange={e=>setNewSnapshotItem(p=>({...p,channel:e.target.value}))}
                  style={{...inputStyle,width:"100%",marginBottom:8,boxSizing:"border-box",fontSize:13}}>
                  {SAVING_CHANNELS.map(ch=><option key={ch.id} value={ch.id}>{ch.icon} {ch.label}</option>)}
                </select>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <input placeholder="שם (קרן השתלמות IBI...)" value={newSnapshotItem.name} onChange={e=>setNewSnapshotItem(p=>({...p,name:e.target.value}))} style={{...inputStyle,fontSize:13}}/>
                  <input type="number" placeholder="יתרה נוכחית ₪" value={newSnapshotItem.balance} onChange={e=>setNewSnapshotItem(p=>({...p,balance:e.target.value}))} style={{...inputStyle,fontSize:13}}/>
                </div>
                <button onClick={addSnapshotItem} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>הוסף מוצר</button>
              </div>
            </>}
          </>
        )}


        {/* ── ANALYTICS ── */}
        {view==="analytics" && (
          <>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>📈 ניתוח</div>

            {/* Projection card */}
            <div style={{background:`linear-gradient(135deg,${theme.a},${theme.b})`,borderRadius:16,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
              <div style={{fontSize:12,opacity:.8,marginBottom:4}}>תחזית לסוף החודש</div>
              <div style={{fontSize:28,fontWeight:900}}>₪{Math.round(projectedTotal).toLocaleString("he-IL")}</div>
              <div style={{fontSize:13,opacity:.8,marginTop:4}}>
                {projectionDiff>0?`✓ צפי לחיסכון ₪${Math.round(projectionDiff).toLocaleString("he-IL")}`:`⚠ צפי לחריגה ₪${Math.round(-projectionDiff).toLocaleString("he-IL")}`}
              </div>
              <div style={{marginTop:12,background:"rgba(255,255,255,.2)",borderRadius:8,height:8,overflow:"hidden"}}>
                <div style={{background:projectionDiff>=0?"rgba(255,255,255,.8)":"#ef4444",height:"100%",width:`${Math.min(100,(projectedTotal/totalVariableBudget)*100)}%`,borderRadius:8,transition:"width .4s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:5,opacity:.7}}>
                <span>₪{Math.round(spentThisCycle).toLocaleString("he-IL")} הוצא ({Math.round(daysElapsed)} ימים)</span>
                <span>תקציב: ₪{Math.round(totalVariableBudget).toLocaleString("he-IL")}</span>
              </div>
            </div>

            {/* Category breakdown this cycle */}
            <div style={{...cardStyle,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>פילוח קטגוריות — חודש נוכחי</div>
              {data.variableBuckets.length===0&&<div style={{color:"#94a3b8",fontSize:12,textAlign:"center"}}>אין קטגוריות</div>}
              {data.variableBuckets.map(b=>{
                const spent=data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
                const budget=Number(b.amount);
                const p=budget>0?Math.min(100,(spent/budget)*100):0;
                const col=p>100?"#ef4444":p>80?"#f59e0b":theme.btn;
                return (
                  <div key={b.id} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13}}>{ICONS[b.icon]} {b.name}</span>
                      <span style={{fontSize:12,fontWeight:700,color:col}}>₪{spent.toLocaleString("he-IL",{maximumFractionDigits:0})} / ₪{budget.toLocaleString("he-IL")}</span>
                    </div>
                    <div style={{background:"#f1f5f9",borderRadius:6,height:7,overflow:"hidden"}}>
                      <div style={{background:col,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monthly history chart */}
            {cycleHistory.length>1&&(
              <div style={{...cardStyle,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>היסטוריה חודשית — הוצאות משתנות</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,paddingBottom:4}}>
                  {cycleHistory.slice(-6).map((cy,i)=>{
                    const maxTotal=Math.max(...cycleHistory.slice(-6).map(c=>Math.max(c.total,c.budget)),1);
                    const barH=Math.max(4,(cy.total/maxTotal)*100);
                    const budH=Math.max(4,(cy.budget/maxTotal)*100);
                    const isOver=cy.total>cy.budget;
                    const isCurrent=cy.csStr===cycleStart.toISOString().slice(0,10);
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                        <div style={{fontSize:8,fontWeight:700,color:isOver?"#ef4444":theme.acc}}>
                          {cy.total>0?`₪${Math.round(cy.total/1000)}k`:""}
                        </div>
                        <div style={{width:"100%",position:"relative",display:"flex",alignItems:"flex-end",justifyContent:"center",height:90}}>
                          {/* budget line marker */}
                          <div style={{position:"absolute",bottom:`${budH}%`,left:0,right:0,borderTop:"1.5px dashed #cbd5e1"}}/>
                          <div style={{width:"70%",background:isCurrent?theme.btn:isOver?"#ef4444":"#94a3b8",borderRadius:"4px 4px 0 0",height:`${barH}%`,opacity:isCurrent?1:0.65,transition:"height .4s",boxShadow:isCurrent?`0 2px 8px ${theme.btn}44`:"none"}}/>
                        </div>
                        <div style={{fontSize:8,color:isCurrent?theme.btn:"#94a3b8",fontWeight:isCurrent?700:400,textAlign:"center",lineHeight:1.2}}>{cy.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:"#94a3b8"}}>
                  <span><span style={{display:"inline-block",width:8,height:8,background:theme.btn,borderRadius:2,marginLeft:3}}/>חודש נוכחי</span>
                  <span><span style={{display:"inline-block",width:8,height:8,background:"#94a3b8",borderRadius:2,marginLeft:3}}/>עבר</span>
                  <span><span style={{display:"inline-block",width:16,height:0,borderTop:"1.5px dashed #cbd5e1",verticalAlign:"middle",marginLeft:3}}/>תקציב</span>
                </div>
              </div>
            )}

            {/* Search expenses */}
            {(()=>{
              const filtered = searchQ.trim().length>1
                ? data.expenses.filter(e=>{
                    const bn=getBucketName(e.bucketId).toLowerCase();
                    const note=(e.note||"").toLowerCase();
                    const q=searchQ.toLowerCase();
                    return bn.includes(q)||note.includes(q)||String(e.amount).includes(q);
                  }).slice(0,20)
                : [];
              return (
                <div style={cardStyle}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>🔍 חיפוש הוצאות</div>
                  <input placeholder="חפש לפי קטגוריה, הערה, סכום..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                    style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:13}}/>
                  {searchQ.trim().length>1&&filtered.length===0&&<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:12}}>לא נמצאו תוצאות</div>}
                  {filtered.map(e=>(
                    <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600}}>{getBucketName(e.bucketId)}</div>
                        {e.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{e.note}</div>}
                        <div style={{fontSize:10,color:"#cbd5e1"}}>{new Date(e.date).toLocaleDateString("he-IL")}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontWeight:800,color:"#ef4444"}}>₪{Number(e.amount).toLocaleString("he-IL")}</span>
                        <button onClick={()=>deleteExpense(e.id)} style={{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:14}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ── NOTES ── */}
        {view==="notes" && (
          <>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>📝 רשומות</div>

            {/* New note form */}
            <div style={{...cardStyle,marginBottom:16,background:"#fffbeb",border:"1.5px solid #fde68a"}}>
              <input placeholder="כותרת (אופציונלי)" value={newNote.title} onChange={e=>setNewNote(p=>({...p,title:e.target.value}))}
                style={{...inputStyle,width:"100%",marginBottom:8,boxSizing:"border-box",fontSize:14,fontWeight:600,background:"transparent",border:"none",borderBottom:"1.5px solid #fde68a",borderRadius:0,padding:"4px 0"}}/>
              <textarea placeholder="כתוב רעיון, תזכורת, שאלה לדון עם בת הזוג..." value={newNote.body} onChange={e=>setNewNote(p=>({...p,body:e.target.value}))}
                style={{...inputStyle,width:"100%",minHeight:80,marginBottom:10,boxSizing:"border-box",fontSize:13,resize:"vertical",background:"transparent",border:"none",outline:"none",padding:"4px 0",fontFamily:"inherit"}}/>
              {/* Color picker */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:11,color:"#92400e"}}>צבע:</span>
                {["#fef9c3","#dcfce7","#dbeafe","#fce7f3","#ede9fe","#fee2e2"].map(c=>(
                  <button key={c} onClick={()=>setNewNote(p=>({...p,color:c}))}
                    style={{width:20,height:20,borderRadius:"50%",background:c,border:newNote.color===c?"3px solid #374151":"2px solid #d1d5db",cursor:"pointer",padding:0}}/>
                ))}
              </div>
              <button onClick={addNote} style={{width:"100%",background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ הוסף רשומה</button>
            </div>

            {/* Notes list */}
            {(data.notes||[]).length===0 && <div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:30}}>אין רשומות עדיין</div>}
            {(data.notes||[]).map(n=>(
              <div key={n.id} style={{background:n.color||"#fef9c3",borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 2px 8px rgba(0,0,0,.06)",border:"1px solid rgba(0,0,0,.06)"}}>
                {editNote?.id===n.id ? (
                  <>
                    <input value={editNote.title} onChange={e=>setEditNote(p=>({...p,title:e.target.value}))}
                      style={{width:"100%",border:"none",borderBottom:"1.5px solid rgba(0,0,0,.15)",background:"transparent",fontSize:14,fontWeight:700,marginBottom:8,outline:"none",boxSizing:"border-box",padding:"2px 0",fontFamily:"inherit"}}/>
                    <textarea value={editNote.body} onChange={e=>setEditNote(p=>({...p,body:e.target.value}))}
                      style={{width:"100%",border:"none",background:"transparent",fontSize:13,minHeight:70,resize:"vertical",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
                    <div style={{display:"flex",gap:8,marginTop:10}}>
                      {["#fef9c3","#dcfce7","#dbeafe","#fce7f3","#ede9fe","#fee2e2"].map(c=>(
                        <button key={c} onClick={()=>setEditNote(p=>({...p,color:c}))}
                          style={{width:18,height:18,borderRadius:"50%",background:c,border:editNote.color===c?"3px solid #374151":"2px solid #d1d5db",cursor:"pointer",padding:0}}/>
                      ))}
                      <div style={{flex:1}}/>
                      <button onClick={()=>setEditNote(null)} style={{background:"rgba(0,0,0,.1)",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>ביטול</button>
                      <button onClick={saveNoteEdit} style={{background:"rgba(0,0,0,.15)",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>שמור</button>
                    </div>
                  </>
                ) : (
                  <>
                    {n.title && <div style={{fontSize:14,fontWeight:700,marginBottom:4,color:"#1e293b"}}>{n.title}</div>}
                    <div style={{fontSize:13,color:"#374151",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.body}</div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                      <span style={{fontSize:10,color:"rgba(0,0,0,.35)"}}>{new Date(n.createdAt).toLocaleDateString("he-IL")} {new Date(n.createdAt).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setEditNote({...n})} style={{background:"rgba(0,0,0,.08)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                        <button onClick={()=>deleteNote(n.id)} style={{background:"rgba(239,68,68,.12)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:11,color:"#ef4444",cursor:"pointer"}}>✕</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── SETTINGS ── */}
        {view==="settings" && (
          <>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>הגדרות</div>
            <div style={{background:`linear-gradient(135deg,${theme.exportGradA},${theme.exportGradB})`,borderRadius:16,padding:"16px 18px",marginBottom:16}}>
              <div style={{color:"#fff",fontWeight:800,fontSize:14,marginBottom:10}}>📊 ייצוא לאקסל</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[["weekly","📅 שבועי"],["monthly","🗓️ חודשי"]].map(([t,label])=>(
                  <button key={t} onClick={()=>setExportType(t)} style={{flex:1,background:exportType===t?"#fff":"rgba(255,255,255,.2)",color:exportType===t?theme.exportGradA:"#fff",border:"none",borderRadius:8,padding:"8px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              {exportType==="weekly"?(
                <select value={exportWeek} onChange={e=>setExportWeek(e.target.value)} style={{width:"100%",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:600,background:"rgba(255,255,255,.2)",color:"#fff",outline:"none",cursor:"pointer",marginBottom:10,boxSizing:"border-box"}}>
                  <option value={getWeekId()} style={{color:"#1e293b"}}>שבוע זה – {getWeekLabel(getWeekId())}</option>
                  {allWeeks.filter(w=>w!==getWeekId()).map(w=>(<option key={w} value={w} style={{color:"#1e293b"}}>{getWeekLabel(w)}</option>))}
                </select>
              ):(
                <select value={exportCycle} onChange={e=>setExportCycle(e.target.value)} style={{width:"100%",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:600,background:"rgba(255,255,255,.2)",color:"#fff",outline:"none",cursor:"pointer",marginBottom:10,boxSizing:"border-box"}}>
                  <option value={getCycleStart().toISOString().slice(0,10)} style={{color:"#1e293b"}}>מחזור נוכחי – {cycleLabel}</option>
                  {allCycles.filter(c=>c!==getCycleStart().toISOString().slice(0,10)).map(c=>(<option key={c} value={c} style={{color:"#1e293b"}}>{getCycleLabel(c)}</option>))}
                </select>
              )}
              <button onClick={exportToExcel} style={{width:"100%",background:"#fff",color:"#166534",border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:800,cursor:"pointer"}}>
                ⬇️ הורד {exportType==="weekly"?"דוח שבועי":"דוח חודשי"}
              </button>
              {exportType==="monthly"&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",marginTop:6,textAlign:"center"}}>כולל: הוצאות · סיכום קטגוריות · פירוט שבועי · לפי אמצעי תשלום</div>}
            </div>
            <div style={cardStyle}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>💰 מקורות הכנסה</div>
              {(data.incomes||[]).length===0&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>טרם הוגדרו מקורות הכנסה</div>}
              {(data.incomes||[]).map(inc=>(
                <div key={inc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{inc.label}</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:13,fontWeight:800,color:"#10b981"}}>₪{Number(inc.amount).toLocaleString("he-IL")}</span>
                    <button onClick={()=>deleteIncome(inc.id)} style={{background:"#fef2f2",border:"none",color:"#ef4444",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>מחק</button>
                  </div>
                </div>
              ))}
              {(data.incomes||[]).length>0&&(
                <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <span style={{fontSize:12,color:"#64748b"}}>סה"כ</span>
                  <span style={{fontSize:13,fontWeight:800,color:"#10b981"}}>₪{totalMonthlyIncome.toLocaleString("he-IL")}</span>
                </div>
              )}
              <div style={{marginTop:14,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:"#475569"}}>+ הוסף מקור הכנסה</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <input placeholder="שם (משכורת א׳, שכירות...)" value={newIncome.label} onChange={e=>setNewIncome(p=>({...p,label:e.target.value}))} style={inputStyle}/>
                  <input type="number" placeholder="סכום ₪" value={newIncome.amount} onChange={e=>setNewIncome(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
                </div>
                <button onClick={addIncome} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>הוסף</button>
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>💳 אמצעי תשלום</div>
              {(data.paymentMethods||[]).length===0&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>טרם הוגדרו אמצעי תשלום</div>}
              {(data.paymentMethods||[]).map(pm=>(
                <div key={pm.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18}}>{PAYMENT_TYPE_ICONS[pm.type]}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{pm.name}</div>
                      {pm.type==="card"&&<div style={{fontSize:11,color:"#94a3b8"}}>****{pm.digits}</div>}
                      {pm.type==="bank"&&<div style={{fontSize:11,color:"#94a3b8"}}>העברה בנקאית</div>}
                      {pm.type==="cash"&&<div style={{fontSize:11,color:"#94a3b8"}}>מזומן</div>}
                    </div>
                  </div>
                  <button onClick={()=>deletePM(pm.id)} style={{background:"#fef2f2",border:"none",color:"#ef4444",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>מחק</button>
                </div>
              ))}
              <div style={{marginTop:14,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:10,color:"#475569"}}>+ הוסף אמצעי תשלום</div>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  {[["card","💳 כרטיס"],["bank","🏦 בנק"],["cash","💵 מזומן"]].map(([t,label])=>(
                    <button key={t} onClick={()=>setNewPM(p=>({...p,type:t,digits:""}))} style={{flex:1,background:newPM.type===t?theme.btnLight:"#f1f5f9",border:newPM.type===t?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:8,padding:"8px 4px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{label}</button>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:newPM.type==="card"?"1fr 1fr":"1fr",gap:10,marginBottom:10}}>
                  <input placeholder={newPM.type==="card"?"שם כרטיס":newPM.type==="bank"?"שם בנק":"שם"} value={newPM.name} onChange={e=>setNewPM(p=>({...p,name:e.target.value}))} style={inputStyle}/>
                  {newPM.type==="card"&&<input placeholder="4 ספרות אחרונות" maxLength={4} value={newPM.digits} onChange={e=>setNewPM(p=>({...p,digits:e.target.value.replace(/\D/g,"").slice(0,4)}))} style={inputStyle}/>}
                </div>
                <button onClick={addPaymentMethod} style={{width:"100%",background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>הוסף</button>
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>סיכום תקציב</div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>מחזור נוכחי: {cycleLabel} ({Math.round(daysLeft)} ימים נותרו)</div>
              {[{l:"הכנסה חודשית",v:totalMonthlyIncome,c:theme.incomeColor},{l:"הוצאות קבועות",v:totalFixed,c:"#f59e0b"},{l:"הוצאות משתנות",v:totalVariableBudget,c:"#2563eb"},{l:"נשאר לא מתוקצב",v:remaining,c:remaining>=0?theme.incomeColor:"#ef4444"}].map(x=>(
                <div key={x.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                  <span style={{fontSize:13,color:"#64748b"}}>{x.l}</span>
                  <span style={{fontSize:13,fontWeight:700,color:x.c}}>₪{Number(x.v||0).toLocaleString("he-IL")}</span>
                </div>
              ))}
            </div>
            {/* Theme picker */}
            <div style={cardStyle}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>🎨 פלטת צבעים</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {Object.entries(THEMES).map(([key,t])=>(
                  <button key={key} onClick={()=>save({...data,theme:key})}
                    style={{background:`linear-gradient(135deg,${t.a},${t.b})`,border:(data.theme||"ocean")===key?"3px solid #fff":"3px solid transparent",borderRadius:12,padding:"12px 10px",cursor:"pointer",boxShadow:(data.theme||"ocean")===key?"0 0 0 3px "+t.b+", 0 4px 12px rgba(0,0,0,.2)":"none",transition:"all .2s"}}>
                    <div style={{color:"#fff",fontSize:12,fontWeight:700}}>{t.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={()=>{ save({...data, monthlyIncome:null, incomes:[]}); showToast("הכנסות אופסו ✓", "#10b981"); }} style={{width:"100%",background:"#fefce8",color:"#ca8a04",border:"1.5px solid #fde68a",borderRadius:10,padding:12,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8}}>🔄 איפוס הכנסות בלבד</button>
            <button onClick={()=>{setResetPin("");setResetError(false);setResetDialog(true);}} style={{width:"100%",background:"#fef2f2",color:"#ef4444",border:"1.5px solid #fecaca",borderRadius:10,padding:12,fontSize:13,fontWeight:700,cursor:"pointer"}}>🗑️ איפוס כל הנתונים</button>
          </>
        )}
      </div>

      {/* FAB */}
      {view!=="add-expense"&&view!=="savings"&&view!=="notes"&&view!=="analytics"&&(
        <button onClick={()=>setView("add-expense")} style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${theme.btn},${theme.a})`,color:"#fff",border:"none",borderRadius:50,padding:"14px 30px",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 6px 24px ${theme.btn}55`,zIndex:50,whiteSpace:"nowrap"}}>
          + רשום הוצאה
        </button>
      )}

      {/* Reset PIN dialog */}
      {resetDialog&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:320,boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
            <div style={{fontSize:22,textAlign:"center",marginBottom:8}}>🔐</div>
            <div style={{fontSize:15,fontWeight:800,textAlign:"center",color:"#1e293b",marginBottom:4}}>איפוס נתונים</div>
            <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",marginBottom:20}}>פעולה זו תמחק את כל הנתונים ללא אפשרות שחזור</div>
            <input type="password" placeholder="הזן סיסמה לאישור" value={resetPin} onChange={e=>{setResetPin(e.target.value);setResetError(false);}}
              style={{width:"100%",border:resetError?"2px solid #ef4444":"1.5px solid #e2e8f0",borderRadius:10,padding:"12px",fontSize:16,textAlign:"center",outline:"none",boxSizing:"border-box",marginBottom:6,letterSpacing:4}} autoFocus/>
            {resetError&&<div style={{fontSize:11,color:"#ef4444",textAlign:"center",marginBottom:10}}>סיסמה שגויה, נסה שוב</div>}
            {!resetError&&<div style={{marginBottom:10}}/>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>setResetDialog(false)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>ביטול</button>
              <button onClick={()=>{if(resetPin==="1003"){localStorage.removeItem(STORAGE_KEY);setData(DEFAULT_STATE);setResetDialog(false);setResetPin("");showToast("הנתונים אופסו","#ef4444");}else{setResetError(true);setResetPin("");}}}
                style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>אפס נתונים</button>
            </div>
          </div>
        </div>
      )}

      {/* Add expense sheet */}
      {view==="add-expense"&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderRadius:"20px 20px 0 0",padding:24,boxShadow:"0 -8px 40px rgba(0,0,0,.12)",zIndex:100,maxWidth:480,margin:"0 auto"}}>
          <div style={{width:36,height:4,background:"#e2e8f0",borderRadius:2,margin:"0 auto 20px"}}/>
          <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>רישום הוצאה</div>
          <select value={newExpense.bucketId} onChange={e=>setNewExpense(p=>({...p,bucketId:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
            <option value="">בחר קטגוריה</option>
            {data.variableBuckets.length>0&&<optgroup label="משתנות">{data.variableBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
            {data.fixedBuckets.length>0&&<optgroup label="קבועות">{data.fixedBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
          </select>
          {(data.paymentMethods||[]).length>0&&(
            <select value={newExpense.paymentMethodId} onChange={e=>setNewExpense(p=>({...p,paymentMethodId:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
              <option value="">אמצעי תשלום (אופציונלי)</option>
              {data.paymentMethods.map(pm=>(<option key={pm.id} value={pm.id}>{pm.type==="card"?`💳 ${pm.name} ****${pm.digits}`:pm.type==="bank"?`🏦 ${pm.name}`:`💵 ${pm.name}`}</option>))}
            </select>
          )}
          {(data.paymentMethods||[]).length===0&&<div style={{fontSize:11,color:"#a5b4fc",marginBottom:10,textAlign:"center"}}>💡 הוסף אמצעי תשלום בהגדרות</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <input type="number" placeholder="סכום ₪" value={newExpense.amount} onChange={e=>setNewExpense(p=>({...p,amount:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
            <input type="date" value={newExpense.date} onChange={e=>setNewExpense(p=>({...p,date:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
          </div>
          <input placeholder="הערה (אופציונלי)" value={newExpense.note} onChange={e=>setNewExpense(p=>({...p,note:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:16,fontSize:14,boxSizing:"border-box"}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button onClick={()=>setView("dashboard")} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:600,cursor:"pointer"}}>ביטול</button>
            <button onClick={addExpense} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:"pointer"}}>שמור</button>
          </div>
        </div>
      )}
    </div>
  );
}
