import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ââ Supabase sync ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
const TG_BOT_TOKEN = "8952474670:AAFvcadraSFVD_k3lsq7iYJugdtN_9z7tsg";
const TG_CHAT_ID = "-5182091532";
const sendToTelegram = async (expense, getBucketName) => {
  const icon = ICONS[expense.bucketId] || "";
  const bucket = getBucketName ? getBucketName(expense.bucketId) : expense.bucketId;
  const date = expense.date ? new Date(expense.date).toLocaleDateString("he-IL") : "";
  const note = expense.note ? "\n××¢×¨×: " + expense.note : "";
  const msg = "ð¸ ×××¦×× × ×¨×©××\n" + icon + " " + bucket + "\nð° âª" + Number(expense.amount).toLocaleString("he-IL") + "\nð " + date + note;
  try {
    await fetch("https://api.telegram.org/bot" + TG_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg })
    });
  } catch(err) { console.error("Telegram error", err); }
};
const sendNoteToTelegram = async (note) => {
  const title = note.title ? note.title + "\n" : "";
  const date = note.createdAt ? new Date(note.createdAt).toLocaleDateString("he-IL") : "";
  const msg = "ð " + title + note.body + "\n\nð " + date;
  try {
    await fetch("https://api.telegram.org/bot" + TG_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg })
    });
  } catch(err) { console.error("Telegram note error", err); }
};
const sendWeeklyReport = async (expenses, varBuckets, weeklyBudget, toast) => {
  const now = new Date();
  const dayNames = ['×××','×©× ×','×©×××©×','×¨×××¢×','××××©×','×©××©×','×©××ª'];
  const todayDay = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate()-todayDay);
  weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate()+6);
  weekEnd.setHours(23,59,59,999);
  const weekExp = expenses.filter(e=>{
    const ed=new Date(e.date||e.createdAt);
    return ed>=weekStart && ed<=weekEnd && varBuckets.find(b=>b.id===e.bucketId);
  });
  const budgetExp = weekExp.filter(e=>!varBuckets.find(b=>b.id===e.bucketId)?.trackingOnly);
  const trackingSpent = weekExp.filter(e=>varBuckets.find(b=>b.id===e.bucketId)?.trackingOnly).reduce((s,e)=>s+Number(e.amount||0),0);
  const weekSpent = budgetExp.reduce((s,e)=>s+Number(e.amount||0),0);
  const weekLeft = weeklyBudget - weekSpent;
  const byBucket = {};
  for(const e of weekExp){
    const bucket=varBuckets.find(b=>b.id===e.bucketId);
    const name=bucket?bucket.name:'×××¨';
    byBucket[name]=(byBucket[name]||0)+Number(e.amount||0);
  }
  const sorted = Object.entries(byBucket).sort((a,b)=>b[1]-a[1]);
  const weekStartStr = weekStart.toLocaleDateString('he-IL');
  const weekEndStr = weekEnd.toLocaleDateString('he-IL');
  const lines = [
    'ð ××× ×©×××¢× | ××× '+dayNames[now.getDay()]+' '+now.toLocaleDateString('he-IL'),
    weekStartStr+' - '+weekEndStr,
    '',
    'ð° ×ª×§×¦×× ×©×××¢×: âª'+weeklyBudget.toLocaleString('he-IL'),
    'ð¸ ×××¦×××ª ×©×××¢ ××: âª'+weekSpent.toLocaleString('he-IL'),
    ...(trackingSpent>0?[`ð ××¢×§× ×××× (×× ×××× ××ª×§×¦××): âª${trackingSpent.toLocaleString('he-IL')}`]:[]),
    weekLeft>=0?'â × ××ª×¨ ××©×××¢: âª'+weekLeft.toLocaleString('he-IL'):'â ï¸ ××¨××ª ×××ª×§×¦×× ×: âª'+Math.abs(weekLeft).toLocaleString('he-IL'),
    '',
  ];
  if(sorted.length>0){
    lines.push('ð ×××¦×××ª ××¤× ×§××××¨××:');
    for(const [name,amount] of sorted){
      const pct=weekSpent>0?Math.round((amount/weekSpent)*100):0;
      lines.push('  â¢ '+name+': âª'+amount.toLocaleString('he-IL')+' ('+pct+'%)');
    }
  } else {
    lines.push('ð ××× ×××¦×××ª ××©×××¢ ×¢× ×××!');
  }
  try {
    await fetch('https://api.telegram.org/bot'+TG_BOT_TOKEN+'/sendMessage',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:TG_CHAT_ID,text:lines.join('\n')})
    });
    toast ? toast('××× × ×©×× ×××××¨× â') : null;
  } catch(err){
    toast ? toast('×©×××× ××©××××', '#e07070') : null;
  }
};


const ICONS = {
// ××©×ª× ××ª (0-10)
food: "ð", transport: "ð", kids: "ð¶", health: "ð",
entertainment: "ð¬", clothing: "ð", pets: "ð¾", misc: "ð¦",
maintenance: "ð§", unexpected: "ð²", online: "ðï¸",
// ×§×××¢××ª (11+)
rent: "ð ", electricity: "ð¡", water: "ð§", internet: "ð¡",
insurance: "ð¡ï¸", subscriptions: "ð±", loan: "ð¦", other: "ð",
digital: "ðµ", kidsclass: "ð¨", car: "ð", mortgage: "ð³", vacation: "âï¸",
};

const PAYMENT_TYPE_ICONS = { card: "ð³", bank: "ð¦", cash: "ðµ" };

const SAVING_CHANNELS = [
{ id: "bank", label: "×¤××§××× ×× ×§××", icon: "ð¦" },
{ id: "market", label: "×©××§ ××××", icon: "ð" },
{ id: "pension", label: "×¤× ×¡×× / ×§×¨× ××©×ª××××ª", icon: "ðï¸" },
{ id: "realestate", label: "× ××\"×", icon: "ð " },
{ id: "crypto", label: "×§×¨××¤××", icon: "â¿" },
{ id: "cash", label: "××××× ××¦×", icon: "ðµ" },
{ id: "other", label: "×××¨", icon: "ð¦" },
];

const DEFAULT_STATE = {
monthlyIncome: null,
fixedBuckets: [],
variableBuckets: [],
expenses: [],
paymentMethods: [],
savings: [],
incomes: [],
weekBudgetMap: {},
theme: "pastel",
notes: [],
savingsSnapshot: [],
};

// ââ PASTEL THEMES ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const THEMES = {
pastel: {
name:"×¤×¡×× ð¸", a:"#A8C5D8", b:"#7BA7BC",
acc:"#7BA7BC", light:"#EEF4F8", navActive:"#7BA7BC",
btn:"#7BA7BC", btnLight:"#D6E8F2",
savingsA:"#A8CABC", savingsB:"#82B89A",
fixedBg:"#F7F3EE", fixedText:"#9A7A55", fixedSub:"#B8956A",
varBg:"#EEF4F8", varText:"#5A8AA0", varSub:"#7BA7BC",
incomeColor:"#82B89A", expColor:"#C9A96E", surplusColor:"#7BA7BC",
exportGradA:"#82B89A", exportGradB:"#5FA085", exportAccent:"#5FA085",
incomeAcc:"#82B89A",
},
lavender: {
name:"××× ××¨ ð", a:"#C5B8E0", b:"#A090CC",
acc:"#8B78C0", light:"#F2EEFA", navActive:"#8B78C0",
btn:"#8B78C0", btnLight:"#E2D8F5",
savingsA:"#A8CABC", savingsB:"#82B89A",
fixedBg:"#F5F0F8", fixedText:"#7A5598", fixedSub:"#9872B0",
varBg:"#F2EEFA", varText:"#5A3A88", varSub:"#8B78C0",
incomeColor:"#82B89A", expColor:"#C9A96E", surplusColor:"#7A65B5",
exportGradA:"#7A65B5", exportGradB:"#A090CC", exportAccent:"#8B78C0",
incomeAcc:"#82B89A",
},
mint: {
name:"×× ×× ð¿", a:"#A8CABC", b:"#82B89A",
acc:"#5FA085", light:"#EDF6F2", navActive:"#5FA085",
btn:"#5FA085", btnLight:"#C5E0D5",
savingsA:"#82B89A", savingsB:"#4A8870",
fixedBg:"#F7F4EE", fixedText:"#7A6A35", fixedSub:"#9A8845",
varBg:"#EDF6F2", varText:"#2D6A50", varSub:"#5FA085",
incomeColor:"#5FA085", expColor:"#C9A96E", surplusColor:"#4A8870",
exportGradA:"#4A8870", exportGradB:"#82B89A", exportAccent:"#5FA085",
incomeAcc:"#5FA085",
},
peach: {
name:"××¤×¨×¡×§ ð", a:"#f0c4a8", b:"#e89c72",
acc:"#d9784a", light:"#fdf3ec", navActive:"#d9784a",
btn:"#d9784a", btnLight:"#fad9c8",
savingsA:"#e89c72", savingsB:"#c86840",
fixedBg:"#fdf3ec", fixedText:"#9a4a1e", fixedSub:"#c05a30",
varBg:"#fdf3ec", varText:"#8a3a18", varSub:"#d9784a",
incomeColor:"#d9784a", expColor:"#e07070", surplusColor:"#c86840",
exportGradA:"#c86840", exportGradB:"#e89c72", exportAccent:"#d9784a",
incomeAcc:"#d9784a",
},
sky: {
name:"×©××× âï¸", a:"#aed4f0", b:"#78b8e8",
acc:"#4a9cd4", light:"#eaf4fc", navActive:"#4a9cd4",
btn:"#4a9cd4", btnLight:"#c8e4f7",
savingsA:"#7ab89a", savingsB:"#4aab72",
fixedBg:"#fef9e4", fixedText:"#7a6a10", fixedSub:"#9a8a20",
varBg:"#eaf4fc", varText:"#1a6a9c", varSub:"#4a9cd4",
incomeColor:"#4aab72", expColor:"#e8b87c", surplusColor:"#4a9cd4",
exportGradA:"#1a6a9c", exportGradB:"#4a9cd4", exportAccent:"#4a9cd4",
incomeAcc:"#4aab72",
},
rose: {
name:"××¨×× ð·", a:"#f0b5c4", b:"#e88aa0",
acc:"#d4607a", light:"#fdf0f3", navActive:"#d4607a",
btn:"#d4607a", btnLight:"#f7d0da",
savingsA:"#e88aa0", savingsB:"#c05070",
fixedBg:"#fdf0f3", fixedText:"#8a2a40", fixedSub:"#b03a55",
varBg:"#fdf0f3", varText:"#7a1a30", varSub:"#d4607a",
incomeColor:"#d4607a", expColor:"#e8b87c", surplusColor:"#c05070",
exportGradA:"#c05070", exportGradB:"#e88aa0", exportAccent:"#d4607a",
incomeAcc:"#d4607a",
},
};
function getWeekId(date = new Date()) {
const d = new Date(date);
d.setHours(0, 0, 0, 0);
d.setDate(d.getDate() - d.getDay());
return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getWeekLabel(weekId) {
const start = new Date(weekId);
const end = new Date(weekId);
end.setDate(end.getDate() + 6);
const fmt = (d) => d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
return `${fmt(start)} â ${fmt(end)}`;
}

function fmt(d) { return d.toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit" }); }
function uid() { return Math.random().toString(36).slice(2, 10); }

// ââ Billing cycle helpers ââââââââââââââââââââââââââââââââââââââââââââââââ
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

// ââ Recurring expense helper: should it auto-add this cycle? âââââââââââââ
function shouldAddRecurringThisCycle(expense, cycleStartStr) {
if (!expense.recurring) return false;
const expCycleStr = getCycleStart(new Date(expense.date)).toISOString().slice(0,10);
return expCycleStr <= cycleStartStr;
}

// ââ Stable Weekly Budget Mechanism âââââââââââââââââââââââââââââââââââââââ
// computeWeekBudgetMap: calculates budget allocation for each week in the cycle
// Called on Sundays, first load, or when a change exceeds 10% of current week's budget
function computeWeekBudgetMap(expensesArr, variableBucketsArr, cycleS, cycleE) {
  const _getWeekId = (d) => {
    const dt = d ? new Date(d) : new Date();
    const sun = new Date(dt); sun.setDate(dt.getDate() - dt.getDay()); sun.setHours(0,0,0,0);
    return sun.getFullYear() + '-' + String(sun.getMonth()+1).padStart(2,'0') + '-' + String(sun.getDate()).padStart(2,'0');
  };
  const _trackingIds = new Set(variableBucketsArr.filter(b=>b.trackingOnly).map(b=>b.id));
  const _varIds = new Set(variableBucketsArr.map(b=>b.id));
  const totalVarOnBudget = variableBucketsArr.filter(b=>!b.trackingOnly).reduce((s,b)=>s+Number(b.amount||0),0);
  // All non-tracking variable expenses spent in this cycle
  const cycleSpent = expensesArr.filter(e => {
    const d = new Date(e.date); d.setHours(0,0,0,0);
    return d >= cycleS && d <= cycleE && _varIds.has(e.bucketId) && !_trackingIds.has(e.bucketId);
  }).reduce((s,e)=>s+Number(e.amount||0),0);
  const remaining = Math.max(0, totalVarOnBudget - cycleSpent);
  // Anchor = start of current week (Sunday). This is the start of our distribution window.
  const todayMs = (() => { const t = new Date(); t.setHours(0,0,0,0); return t; })();
  const currentWeekSun = new Date(todayMs); currentWeekSun.setDate(todayMs.getDate() - todayMs.getDay()); currentWeekSun.setHours(0,0,0,0);
  // Distribution window: from start of current week to cycle end (or cycleS if later)
  const distStart = currentWeekSun < cycleS ? cycleS : currentWeekSun;
  const daysTotal = Math.max(1, Math.round((cycleE - distStart) / 86400000) + 1);
  const dailyRate = remaining / daysTotal;
  // Build map: weekId -> budget = dailyRate x days of that week within [distStart, cycleE]
  const map = {};
  const weeks = [];
  let cur = new Date(cycleS);
  while (cur <= cycleE) { weeks.push(_getWeekId(cur)); cur.setDate(cur.getDate()+7); }
  const uniqueWeeks = [...new Set(weeks)];
  for (const wid of uniqueWeeks) {
    const wSun = new Date(wid); wSun.setHours(0,0,0,0);
    const wSat = new Date(wSun); wSat.setDate(wSun.getDate()+6); wSat.setHours(23,59,59,999);
    const overlapStart = wSun < distStart ? distStart : wSun;
    const overlapEnd = wSat > cycleE ? cycleE : wSat;
    if (overlapStart > overlapEnd) { map[wid] = 0; continue; }
    const days = Math.max(0, Math.round((overlapEnd - overlapStart) / 86400000) + 1);
    map[wid] = Math.round(dailyRate * days);
  }
  return map;
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
// Auto-add recurring expenses for current billing cycle
const currentCycleStart = getCycleStart().toISOString().slice(0,10);
const currentCycleEnd = (() => { const ce = getCycleStart(); ce.setMonth(ce.getMonth()+1); ce.setDate(9); return ce.toISOString().slice(0,10); })();
const recurringBase = (merged.expenses||[]).filter(e => e.recurring && !e.isRecurringCopy);
const toAutoAdd = [];
recurringBase.forEach(base => {
// Check if this recurring expense already has a copy in current cycle
const alreadyHasCopy = (merged.expenses||[]).some(e => e.recurringBaseId === base.id && e.date >= currentCycleStart && e.date <= currentCycleEnd);
if (!alreadyHasCopy && base.date < currentCycleStart) {
toAutoAdd.push({ id: Math.random().toString(36).slice(2,10), bucketId: base.bucketId, amount: base.amount, note: base.note||"", date: currentCycleStart, paymentMethodId: base.paymentMethodId||"", createdAt: Date.now(), isRecurringCopy: true, recurringBaseId: base.id });
}
});
const finalData = toAutoAdd.length > 0 ? { ...merged, expenses: [...merged.expenses, ...toAutoAdd] } : merged;
setData(finalData);
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(finalData)); } catch {}
if (toAutoAdd.length > 0) saveToSupabase(finalData);
setLastSync(new Date());
}
});
}, []);

const [view, setView] = useState("dashboard");
const [newBucket, setNewBucket] = useState({ name: "", amount: "", icon: "misc", isInstallment: false, installmentsLeft: "", totalAmount: "", isRecurring: false });
const [editBucket, setEditBucket] = useState(null);
const [newExpense, setNewExpense] = useState({ bucketId: "", amount: "", note: "", date: new Date().toISOString().slice(0,10), paymentMethodId: "" });
const [editExpense, setEditExpense] = useState(null);
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
const [newNote, setNewNote] = useState({ title: "", body: "", color: "#e8f4e8" });
const [savingsTab, setSavingsTab] = useState("deposits");
const [newSnapshotItem, setNewSnapshotItem] = useState({ channel: "bank", name: "", balance: "" });
const [editSnapshotId, setEditSnapshotId] = useState(null);
const [editSnapshotVal, setEditSnapshotVal] = useState("");
const [editNote, setEditNote] = useState(null);
const [expenseFilter, setExpenseFilter] = useState("all"); // "all" | "variable" | "fixed"
const [ocrImage, setOcrImage] = useState(null);
const [ocrResults, setOcrResults] = useState([]);
const [ocrLoading, setOcrLoading] = useState(false);
const [showOcrModal, setShowOcrModal] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
const dragItem = useRef(null);
const dragOver = useRef(null);
const ocrFileRef = useRef(null);
const [selectedDay, setSelectedDay] = useState(null);
const [expandedCategory, setExpandedCategory] = useState(null); // bucket id
const save = useCallback((next) => {
// Rebalance weekBudgetMap on Sunday OR if expense/income change > 10% of current week budget
const _today = new Date(); _today.setHours(0,0,0,0);
const _isSunday = _today.getDay() === 0;
const _prevMap = (data.weekBudgetMap) || {};
const _getCycleStart = (d) => { const t = new Date(d); if(t.getDate()>=10){t.setDate(10);}else{t.setMonth(t.getMonth()-1);t.setDate(10);} t.setHours(0,0,0,0); return t; };
const _getCycleEnd = (cs) => { const e = new Date(cs); e.setMonth(e.getMonth()+1); e.setDate(9); e.setHours(23,59,59,999); return e; };
const _getWeekId2 = (d) => { const dt = d ? new Date(d) : new Date(); const s = new Date(dt); s.setDate(dt.getDate()-dt.getDay()); s.setHours(0,0,0,0); return s.getFullYear()+'-'+String(s.getMonth()+1).padStart(2,'0')+'-'+String(s.getDate()).padStart(2,'0'); };
const _cs = _getCycleStart(_today);
const _ce = _getCycleEnd(_cs);
const _wid = _getWeekId2();
const _prevBudget = _prevMap[_wid] || 0;
// Check if expenses or incomes changed significantly
const _prevExpenseTotal = (data.expenses||[]).filter(e=>{const d=new Date(e.date);d.setHours(0,0,0,0);return d>=_cs&&d<=_ce;}).reduce((s,e)=>s+Number(e.amount||0),0);
const _nextExpenseTotal = (next.expenses||[]).filter(e=>{const d=new Date(e.date);d.setHours(0,0,0,0);return d>=_cs&&d<=_ce;}).reduce((s,e)=>s+Number(e.amount||0),0);
const _delta = Math.abs(_nextExpenseTotal - _prevExpenseTotal);
const _threshold = Math.max(50, (_prevBudget||100) * 0.10);
const _currentMapBudget = _prevMap[_wid];
const _mapIsStale = _currentMapBudget === undefined || _currentMapBudget === 0;
const _needsRebalance = _isSunday || _mapIsStale || _delta >= _threshold;
let finalNext = next;
if (_needsRebalance) {
  const _newMap = computeWeekBudgetMap(next.expenses||[], next.variableBuckets||[], _cs, _ce);
  finalNext = { ...next, weekBudgetMap: _newMap };
} else {
  finalNext = { ...next, weekBudgetMap: _prevMap };
}
setData(finalNext);
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(finalNext)); } catch {}
clearTimeout(window._supabaseSaveTimer);
window._supabaseSaveTimer = setTimeout(() => {
setSyncing(true);
saveToSupabase(finalNext).then(() => {
setSyncing(false);
setLastSync(new Date());
});
}, 1500);
}, []);

const showToast = (msg, color = "#5aa67d") => {
setToast({ msg, color });
setTimeout(() => setToast(null), 2500);
};

// ââ Billing cycle âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const today = new Date(); today.setHours(0,0,0,0);
const cycleStart = getCycleStart(today);
const cycleEnd = new Date(cycleStart); cycleEnd.setMonth(cycleEnd.getMonth()+1); cycleEnd.setDate(9);
const cycleTotalDays = (cycleEnd - cycleStart) / 86400000 + 1;
const daysLeft = Math.max(1, (cycleEnd - today) / 86400000 + 1);
const weeksInMonth = cycleTotalDays / 7;
const weeksRemaining = Math.max(1, daysLeft / 7);
const inCurrentCycle = (dateStr) => { const d = new Date(dateStr); d.setHours(0,0,0,0); return d >= cycleStart && d <= cycleEnd; };
const fmt2 = (d) => d.toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit" });
const cycleLabel = `${fmt2(cycleStart)} â ${fmt2(cycleEnd)}`;

// ââ Income ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const totalMonthlyIncome = (data.incomes||[]).reduce((s,x)=>s+Number(x.amount||0),0) + Number(data.monthlyIncome||0);

const activeFixed = (data.fixedBuckets||[]).filter(b => !b.isInstallment || getInstallmentsRemaining(b) > 0);
const totalFixed = activeFixed.reduce((s,b) => s + getMonthlyAmount(b), 0);
const totalVariableBudget = data.variableBuckets.filter(b=>!b.trackingOnly).reduce((s,b) => s + Number(b.amount||0), 0);
const totalBudget = totalFixed + totalVariableBudget;
const remaining = totalMonthlyIncome - totalBudget;

// ââ trackingOnly buckets include food & unexpected âââââââââââââââââââââ
const trackingOnlyIds = new Set(data.variableBuckets.filter(b=>b.trackingOnly).map(b=>b.id));
const variableBucketIds = new Set(data.variableBuckets.map(b => b.id));
const fixedBucketIds = new Set(data.fixedBuckets.map(b=>b.id));
const fixedSavingsBudget = activeFixed.filter(b=>b.isSavings).reduce((s,b)=>s+getMonthlyAmount(b),0);

// Total monthly budget INCLUDING tracking-only (for analytics projection)
const totalVariableBudgetIncl = data.variableBuckets.reduce((s,b) => s + Number(b.amount||0), 0);
const totalBudgetIncl = totalFixed + totalVariableBudgetIncl;

const fixedOverflowThisMonth = activeFixed.reduce((total,b) => {
const spent = data.expenses.filter(e => e.bucketId===b.id && inCurrentCycle(e.date)).reduce((s,e)=>s+Number(e.amount),0);
return total + Math.max(0, spent - getMonthlyAmount(b));
}, 0);
const totalVariableOnBudget = data.variableBuckets.filter(b=>!b.trackingOnly).reduce((s,b)=>s+Number(b.amount||0),0);
    const trackingOverflowThisMonth = data.variableBuckets.filter(b => b.trackingOnly).reduce((total, b) => {
          const spent = data.expenses.filter(e => e.bucketId === b.id && inCurrentCycle(e.date)).reduce((s,e) => s + Number(e.amount||0), 0);
          return total + Math.max(0, spent - b.amount);
    }, 0);

const currentWeekId = getWeekId();
const allCycleWeekIds = (() => {
  const weeks = []; let cur = new Date(cycleStart);
  while (cur <= cycleEnd) { weeks.push(getWeekId(cur)); cur.setDate(cur.getDate()+7); }
  return [...new Set(weeks)];
})();
// Read from stored map (stable), or compute on-the-fly if not available
const storedMap = data.weekBudgetMap || {};
const isSunday = today.getDay() === 0;
const mapHasCurrentWeek = storedMap[currentWeekId] !== undefined;
// Use stored map if available and not Sunday (stable), else use computed
// Always compute fresh budget map (stored map used for stability only after saving)
const activeBudgetMap = computeWeekBudgetMap(data.expenses, data.variableBuckets, cycleStart, cycleEnd);
// Helper: get cycle bounds for any weekId (supports cross-cycle navigation)
const getWeekCycle = (weekId) => {
  const wSun = new Date(weekId); wSun.setHours(0,0,0,0);
  const cs = getCycleStart(wSun);
  const ce = new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9); ce.setHours(23,59,59,999);
  return { cs, ce };
};
const dynamicWeeklyBudget = activeBudgetMap[currentWeekId] || 0;
const weeksRemainingInCycle = allCycleWeekIds.filter(w => w >= currentWeekId).length;
const weeklyFixedOverflowPenalty = fixedOverflowThisMonth / Math.max(1, weeksRemainingInCycle);
// Budget per week = always uses the correct cycle for that week
const getWeekBudget = (weekId) => {
  const { cs: wcs, ce: wce } = getWeekCycle(weekId);
  const isCurrentCycle = wcs.getTime() === cycleStart.getTime();
  const budgetMap = isCurrentCycle ? activeBudgetMap : computeWeekBudgetMap(data.expenses, data.variableBuckets, wcs, wce);
  return budgetMap[weekId] !== undefined ? budgetMap[weekId] : 0;
};
const weeklyVariableBudget = getWeekBudget(selectedWeek);

const expensesThisWeek = data.expenses.filter(e => getWeekId(e.date) === selectedWeek);
const spentThisWeek = expensesThisWeek.filter(e => variableBucketIds.has(e.bucketId) && !trackingOnlyIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount||0),0);
const trackingSpentThisWeek = expensesThisWeek.filter(e => trackingOnlyIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount||0),0);
const leftThisWeek = weeklyVariableBudget - spentThisWeek;
const allWeeks = [...new Set(data.expenses.map(e => getWeekId(e.date)))].sort().reverse();
const bucketSpendThisWeek = (id) => expensesThisWeek.filter(e=>e.bucketId===id).reduce((s,e)=>s+Number(e.amount),0);

// isCurrentWeek for week nav button styling
const isCurrentWeek = selectedWeek === currentWeekId;

// ââ Analytics âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const getCycleBudget = () => totalVariableBudget;
const allCycleStarts = [...new Set(data.expenses.map(e => getCycleStart(new Date(e.date)).toISOString().slice(0,10)))].sort();

// Projection includes ALL variable buckets (including tracking-only) for accurate forecast
const spentThisCycle = data.expenses.filter(e=>inCurrentCycle(e.date)&&variableBucketIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount),0);
const daysElapsed = Math.max(1, cycleTotalDays - daysLeft + 1);
const projectedTotal = (spentThisCycle / daysElapsed) * cycleTotalDays;
// Use total budget including tracking-only for accurate projection comparison
// Expected savings = income - fixed expenses - projected variable spending
const projectedVariableSpend = projectedTotal;
const expectedSurplus = totalMonthlyIncome - totalBudgetIncl;
const projectedUnspentVariable = totalVariableBudgetIncl - projectedVariableSpend;
const projectedSavings = expectedSurplus + projectedUnspentVariable + fixedSavingsBudget;
const projectionDiff = projectedSavings;

const cycleHistory = allCycleStarts.map(csStr => {
const cs = new Date(csStr); const ce = new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9);
const cyExp = data.expenses.filter(e => { const d=new Date(e.date); d.setHours(0,0,0,0); return d>=cs&&d<=ce; });
const varExp = cyExp.filter(e=>variableBucketIds.has(e.bucketId));
const total = varExp.reduce((s,e)=>s+Number(e.amount),0);
const byBucket = data.variableBuckets.map(b=>({ id:b.id, name:b.name, icon:b.icon, spent:varExp.filter(e=>e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0), budget:Number(b.amount) }));
return { csStr, label: fmt2(cs)+"â"+fmt2(ce), total, budget: totalVariableBudgetIncl, byBucket };
});

const alerts = [];
data.variableBuckets.filter(b=>!b.trackingOnly).forEach(b => {
const monthlyBudgetB = Number(b.amount);
const monthlySpentB = data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const elapsedFraction = daysElapsed / cycleTotalDays;
const expectedByNow = monthlyBudgetB * elapsedFraction;
const pctOfMonth = monthlyBudgetB > 0 ? monthlySpentB / monthlyBudgetB : 0;
const pctOfExpected = expectedByNow > 0 ? monthlySpentB / expectedByNow : 0;
if (pctOfMonth >= 1) alerts.push({ type:"danger", msg:`${ICONS[b.icon]} ${b.name}: ××¨××ª ×××ª×§×¦×× ×××××©× ×-âª${Math.round(monthlySpentB-monthlyBudgetB).toLocaleString("he-IL")}` });
else if (pctOfExpected >= 1.4 && pctOfMonth >= 0.6) alerts.push({ type:"warn", msg:`${ICONS[b.icon]} ${b.name}: ×§×¦× ××××¨ â ${Math.round(pctOfMonth*100)}% ×××ª×§×¦×× ×××××©× × ××¦×` });
else if (pctOfMonth >= 0.8) alerts.push({ type:"warn", msg:`${ICONS[b.icon]} ${b.name}: ××©×ª××©×ª ×-${Math.round(pctOfMonth*100)}% ×××ª×§×¦×× ×××××©×` });
});
if (fixedOverflowThisMonth > 0) alerts.push({ type:"warn", msg:`â ï¸ ××¨××× ××××¦×××ª ×§×××¢××ª: âª${Math.round(fixedOverflowThisMonth).toLocaleString("he-IL")} ×××××©` });
if (projectedSavings < 0) alerts.push({ type:"danger", msg:`ð ××§×¦× ×× ×××× ×××¨×¢×× ×¦×¤×× ×©× âª${Math.round(Math.abs(projectedSavings)).toLocaleString("he-IL")} ×××××©` });
else if (projectedSavings > totalMonthlyIncome * 0.1) alerts.push({ type:"good", msg:`â ×××¡××× ×¦×¤×× âª${Math.round(projectedSavings).toLocaleString("he-IL")} ×××××© (×¢×××£ + ××©×ª× ××ª ×× ×× ××¦×××ª)` });

const getBucketName = (id) => { const b=[...data.fixedBuckets,...data.variableBuckets].find(b=>b.id===id); return b?`${ICONS[b.icon]||"ð"} ${b.name}`:"â"; };
const getBucketType = (id) => { if (fixedBucketIds.has(id)) return "×§×××¢×"; if (variableBucketIds.has(id)) return "××©×ª× ×"; return "â"; };
const getPMLabel = (id) => { if(!id) return "â"; const pm=(data.paymentMethods||[]).find(p=>p.id===id); if(!pm) return "â"; return pm.type==="card"?`ð³ ${pm.name} ****${pm.digits}`:pm.type==="bank"?`ð¦ ${pm.name}`:`ðµ ${pm.name}`; };
// ââ Handlers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const addBucket = (type) => {
if (type === "fixed" && newBucket.isInstallment) {
if (!newBucket.name || !newBucket.totalAmount || !newBucket.installmentsLeft)
return showToast("× × ×××× ×©×, ×¡××× ×××× ×××¡×¤×¨ ×ª×©×××××", "#e07070");
const bucket = { id: uid(), name: newBucket.name, icon: newBucket.icon, isInstallment: true,
totalAmount: Number(newBucket.totalAmount), installmentsLeft: Number(newBucket.installmentsLeft),
amount: Number(newBucket.totalAmount)/Number(newBucket.installmentsLeft),
createdAt: cycleStart.toISOString().slice(0,10) };
save({ ...data, fixedBuckets: [...data.fixedBuckets, bucket] });
setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"", isRecurring:false });
return showToast("×ª×©××××× × ××¡×¤× â");
}
// Check for recurring fixed expense
if (type === "fixed" && newBucket.isRecurring) {
if (!newBucket.name || !newBucket.amount) return showToast("× × ×××× ×©× ××¡×××", "#e07070");
const bucket = { id: uid(), name: newBucket.name, amount: Number(newBucket.amount), icon: newBucket.icon, isRecurring: true };
save({ ...data, fixedBuckets: [...data.fixedBuckets, bucket] });
setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"", isRecurring:false });
return showToast("×××¦×× ×§×××¢× ×××××¨××ª × ××¡×¤× â");
}
if (!newBucket.name || !newBucket.amount) return showToast("× × ×××× ×©× ××¡×××", "#e07070");
const bucket = { id: uid(), name: newBucket.name, amount: Number(newBucket.amount), icon: newBucket.icon, ...(type==="variable"?{trackingOnly:!!newBucket.trackingOnly}:{}) };
const key = type==="fixed"?"fixedBuckets":"variableBuckets";
save({ ...data, [key]: [...data[key], bucket] });
setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"", isRecurring:false });
showToast("×××§× × ××¡×£ â");
};

const saveBucketEdit = () => {
if (!editBucket.name || !editBucket.amount) return showToast("× × ×××× ×©× ××¡×××", "#e07070");
const key = editBucket.type==="fixed"?"fixedBuckets":"variableBuckets";
save({ ...data, [key]: data[key].map(b=>b.id===editBucket.id?{...b, name:editBucket.name, amount:Number(editBucket.amount), icon:editBucket.icon, ...(editBucket.type==="variable"?{trackingOnly:!!editBucket.trackingOnly}:{}), ...(editBucket.type==="fixed"?{isRecurring:!!editBucket.isRecurring, isSavings:!!editBucket.isSavings}:{})}:b) });
setEditBucket(null); showToast("×××§× ×¢×××× â");
};

const deleteBucket = (type, id) => { const key=type==="fixed"?"fixedBuckets":"variableBuckets"; save({...data,[key]:data[key].filter(b=>b.id!==id)}); };

const reorderBuckets = (type) => {
if (dragItem.current===null || dragOver.current===null || dragItem.current===dragOver.current) return;
const key = type==="fixed"?"fixedBuckets":"variableBuckets";
const arr = [...data[key]]; const [moved]=arr.splice(dragItem.current,1); arr.splice(dragOver.current,0,moved);
dragItem.current=null; dragOver.current=null; save({...data,[key]:arr});
};

const addExpense = () => {
if (!newExpense.bucketId || !newExpense.amount) return showToast("× × ×××××¨ ×§××××¨×× ××¡×××", "#e07070");
const expense = { id:uid(), ...newExpense, amount:Number(newExpense.amount), createdAt:Date.now() };
save({ ...data, expenses:[...data.expenses, expense] });
setNewExpense({ bucketId:"", amount:"", note:"", date:new Date().toISOString().slice(0,10), paymentMethodId:"" });
showToast("×××¦×× × ×¨×©×× â"); setView("dashboard");
};

const saveExpenseEdit = () => {
if (!editExpense.bucketId || !editExpense.amount) return showToast("× × ×××××¨ ×§××××¨×× ××¡×××", "#e07070");
save({ ...data, expenses: data.expenses.map(e => e.id===editExpense.id ? {...e, ...editExpense, amount:Number(editExpense.amount)} : e) });
setEditExpense(null); showToast("×××¦×× ×¢×××× × â");
};

const deleteExpense = (id) => save({ ...data, expenses:data.expenses.filter(e=>e.id!==id) });

const addPaymentMethod = () => {
if (!newPM.name) return showToast("× × ××××× ×©×", "#e07070");
if (newPM.type==="card" && !/^\d{4}$/.test(newPM.digits)) return showToast("× × ××××× 4 ×¡×¤×¨××ª ×××¨×× ××ª", "#e07070");
const pm = { id:uid(), type:newPM.type, name:newPM.name, digits:newPM.digits };
save({ ...data, paymentMethods:[...(data.paymentMethods||[]), pm] });
setNewPM({ type:"card", name:"", digits:"" }); showToast("×××¦×¢× ×ª×©××× × ××¡×£ â");
};
const deletePM = (id) => save({ ...data, paymentMethods:data.paymentMethods.filter(p=>p.id!==id) });

const addIncome = () => {
if (!newIncome.label || !newIncome.amount) return showToast("× × ×××× ×©× ××¡×××", "#e07070");
const inc = { id: uid(), label: newIncome.label, amount: Number(newIncome.amount) };
save({ ...data, incomes: [...(data.incomes||[]), inc] });
setNewIncome({ label: "", amount: "" });
showToast("××§××¨ ××× ×¡× × ××¡×£ â");
};
const deleteIncome = (id) => save({ ...data, incomes: (data.incomes||[]).filter(x=>x.id!==id) });

const addSaving = () => {
if (!newSaving.amount) return showToast("× × ××××× ×¡×××", "#e07070");
const s = { id:uid(), ...newSaving, amount:Number(newSaving.amount), createdAt:Date.now() };
save({ ...data, savings:[...(data.savings||[]), s] });
setNewSaving({ channel:"bank", amount:"", note:"", date:new Date().toISOString().slice(0,10) });
showToast("××¡××× × ×¨×©× â");
};
const deleteSaving = (id) => save({ ...data, savings:(data.savings||[]).filter(s=>s.id!==id) });
const totalSavings = (data.savings||[]).reduce((s,x)=>s+Number(x.amount),0);

const addSnapshotItem = () => {
if (!newSnapshotItem.name || !newSnapshotItem.balance) return showToast("× × ×××× ×©× ×××ª×¨×", "#e07070");
const item = { id:uid(), channel:newSnapshotItem.channel, name:newSnapshotItem.name, balance:Number(newSnapshotItem.balance), updatedAt:Date.now() };
save({ ...data, savingsSnapshot:[...(data.savingsSnapshot||[]), item] });
setNewSnapshotItem({ channel:"bank", name:"", balance:"" });
showToast("×××¦×¨ × ××¡×£ â");
};
const updateSnapshotBalance = (id, val) => {
save({ ...data, savingsSnapshot:(data.savingsSnapshot||[]).map(x=>x.id===id?{...x,balance:Number(val),updatedAt:Date.now()}:x) });
setEditSnapshotId(null);
};
const deleteSnapshotItem = (id) => save({ ...data, savingsSnapshot:(data.savingsSnapshot||[]).filter(x=>x.id!==id) });
const totalSnapshotBalance = (data.savingsSnapshot||[]).reduce((s,x)=>s+Number(x.balance||0),0);

const addNote = () => {
if (!newNote.body.trim()) return showToast("× × ×××ª×× ××©××", "#e8b87c");
const n = { id:uid(), title:newNote.title, body:newNote.body, color:newNote.color, createdAt:Date.now(), updatedAt:Date.now() };
save({ ...data, notes:[n, ...(data.notes||[])] });
setNewNote({ title:"", body:"", color:"#e8f4e8" });
showToast("×¨×©××× × ×©××¨× â");
};
const deleteNote = (id) => save({ ...data, notes:(data.notes||[]).filter(n=>n.id!==id) });
const saveNoteEdit = () => {
save({ ...data, notes:(data.notes||[]).map(n=>n.id===editNote.id?{...n,...editNote,updatedAt:Date.now()}:n) });
setEditNote(null); showToast("×¨×©××× ×¢×××× × â");
};

// ââ Weekly redistribution is now fully automatic via dynamic budget ââ

const theme = THEMES[data.theme||"pastel"] || THEMES.pastel;

// ââ OCR handling ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const handleOcrUpload = async (file) => {
  if (!file) return;
  setOcrLoading(true);
  setShowOcrModal(true);
  const reader = new FileReader();
  reader.onload = async (e) => {
    const imgSrc = e.target.result;
    setOcrImage(imgSrc);
    const apiKey = geminiApiKey || localStorage.getItem("gemini_api_key") || "";
    if (!apiKey) {
      showToast("×× × ××××¨ ××¤×ª× Gemini ×××××¨××ª", "#e07070");
      setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]);
      setOcrLoading(false);
      return;
    }
    try {
      showToast("××¢×× ×ª××× ×...", "#6a9bc3");
      const base64 = imgSrc.split(",")[1];
      const mimeType = file.type || "image/jpeg";
      const prompt = "Image of credit card statement or receipt. Extract all expense transactions. Return ONLY valid JSON array, no markdown. Format: [{note: string, amount: positive number, date: YYYY-MM-DD}]. Use today if no date.";
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({contents:[{parts:[{text:prompt},{inlineData:{mimeType,data:base64}}]}]})
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error?.message || "API error");
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const clean = text.replace(/```json/g,"").replace(/```/g,"").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        showToast("×× ×××× ×××¦×××ª ××ª××× ×", "#e07070");
        setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]);
      } else {
        setOcrResults(parsed.map(r => ({amount:String(r.amount||""),date:r.date||new Date().toISOString().slice(0,10),note:r.note||r.merchant||"",bucketId:"",confirmed:true})));
      }
    } catch(err) {
      showToast("×©××××ª API", "#e07070");
      setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]);
    }
    setOcrLoading(false);
  };
  reader.readAsDataURL(file);
};

const confirmOcrExpenses = () => {
const toAdd = ocrResults.filter(r => r.confirmed && r.amount && r.bucketId);
if (toAdd.length === 0) return showToast("×× ×¡××× × ×××¦×××ª ××××©××¨", "#e8b87c");
const newExpenses = toAdd.map(r => ({ id:uid(), bucketId:r.bucketId, amount:Number(r.amount), note:r.note||"", date:r.date, paymentMethodId:"", createdAt:Date.now() }));
save({ ...data, expenses: [...data.expenses, ...newExpenses] });
setShowOcrModal(false);
setOcrImage(null);
setOcrResults([]);
showToast(`${newExpenses.length} ×××¦×××ª × ××¡×¤× â`);
};

// ââ Export ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const allCycles = [...new Set(data.expenses.map(e => getCycleStart(new Date(e.date)).toISOString().slice(0,10)))].sort().reverse();
const getCycleLabel = (isoStr) => { const cs=new Date(isoStr); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9); return `${fmt2(cs)} â ${fmt2(ce)}`; };

const exportToExcel = () => {
const isMonthly = exportType === "monthly";
const periodExpenses = isMonthly
? data.expenses.filter(e => { const d=new Date(e.date); d.setHours(0,0,0,0); const cs=new Date(exportCycle); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9); return d>=cs&&d<=ce; })
: data.expenses.filter(e => getWeekId(e.date)===exportWeek);
if (periodExpenses.length===0) return showToast("××× ×××¦×××ª ××ª×§××¤× ××", "#e8b87c");
const wb = XLSX.utils.book_new();
// Sheet 1: expenses with fixed/variable column
const expRows = periodExpenses.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(e=>({
"×ª××¨××":e.date,
"×§××××¨××":getBucketName(e.bucketId).replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g,"").trim(),
"×¡×× ×××¦××":getBucketType(e.bucketId),
"×¡××× âª":Number(e.amount),
"×××¦×¢× ×ª×©×××":getPMLabel(e.paymentMethodId).replace(/[^\u0590-\u05FFa-zA-Z0-9\s*]/g,"").trim(),
"××¢×¨×":e.note||"",
}));
const wsExp=XLSX.utils.json_to_sheet(expRows,{header:["×ª××¨××","×§××××¨××","×¡×× ×××¦××","×¡××× âª","×××¦×¢× ×ª×©×××","××¢×¨×"]});
wsExp["!cols"]=[{wch:12},{wch:18},{wch:12},{wch:10},{wch:22},{wch:20}];
XLSX.utils.book_append_sheet(wb,wsExp,"×××¦×××ª");
// Sheet 2: bucket summary
const totalSpent=periodExpenses.reduce((s,e)=>s+Number(e.amount),0);
const budgetRef=isMonthly?totalVariableBudgetIncl:weeklyVariableBudget;
const budgetCol=isMonthly?"×ª×§×¦×× ××××©× âª":"×ª×§×¦×× ×©×××¢× âª";
const bSum=data.variableBuckets.map(b=>{
const spent=periodExpenses.filter(e=>e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const bud=isMonthly?Number(b.amount):Number(b.amount)/weeksInMonth;
return {"×§××××¨××":b.name,"×¡××":"××©×ª× ×",[budgetCol]:Math.round(bud),"×××¦×× ××¤××¢× âª":spent,"× ×©××¨ âª":Math.round(bud-spent),"×××× × ××¦××":bud>0?Math.round((spent/bud)*100)+"%":"â"};
});
// Add fixed buckets to summary
activeFixed.forEach(b=>{
const spent=periodExpenses.filter(e=>e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const bud=isMonthly?getMonthlyAmount(b):getMonthlyAmount(b)/weeksInMonth;
bSum.push({"×§××××¨××":b.name,"×¡××":"×§×××¢×",[budgetCol]:Math.round(bud),"×××¦×× ××¤××¢× âª":spent,"× ×©××¨ âª":Math.round(bud-spent),"×××× × ××¦××":bud>0?Math.round((spent/bud)*100)+"%":"â"});
});
bSum.push({"×§××××¨××":"×¡×\"×","×¡××":"",[budgetCol]:Math.round(budgetRef+totalFixed),"×××¦×× ××¤××¢× âª":Math.round(totalSpent),"× ×©××¨ âª":Math.round(budgetRef+totalFixed-totalSpent),"×××× × ××¦××":(budgetRef+totalFixed)>0?Math.round((totalSpent/(budgetRef+totalFixed))*100)+"%":"â"});
const wsS=XLSX.utils.json_to_sheet(bSum,{header:["×§××××¨××","×¡××",budgetCol,"×××¦×× ××¤××¢× âª","× ×©××¨ âª","×××× × ××¦××"]});
wsS["!cols"]=[{wch:18},{wch:10},{wch:16},{wch:16},{wch:12},{wch:14}];
XLSX.utils.book_append_sheet(wb,wsS,"×¡×××× ×§××××¨×××ª");
if (isMonthly) {
const cs=new Date(exportCycle); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9);
const weeks=[]; let cur=new Date(cs);
while(cur<=ce){const wid=getWeekId(cur);if(!weeks.includes(wid))weeks.push(wid);cur.setDate(cur.getDate()+7);}
const wRows=weeks.map(wid=>{const wE=periodExpenses.filter(e=>getWeekId(e.date)===wid);return{"×©×××¢":getWeekLabel(wid),"×××¦×××ª âª":wE.reduce((s,e)=>s+Number(e.amount),0),"××¡×¤×¨ ×¢×¡×§×××ª":wE.length};});
const wsW=XLSX.utils.json_to_sheet(wRows,{header:["×©×××¢","×××¦×××ª âª","××¡×¤×¨ ×¢×¡×§×××ª"]});wsW["!cols"]=[{wch:22},{wch:14},{wch:16}];
XLSX.utils.book_append_sheet(wb,wsW,"×¤××¨×× ×©×××¢×");
}
const pmS=(data.paymentMethods||[]).map(pm=>{const pmE=periodExpenses.filter(e=>e.paymentMethodId===pm.id);return{"×××¦×¢× ×ª×©×××":pm.type==="card"?`${pm.name} ****${pm.digits}`:pm.name,"××¡×¤×¨ ×¢×¡×§×××ª":pmE.length,"×¡×\"× âª":pmE.reduce((s,e)=>s+Number(e.amount),0)};});
const utag=periodExpenses.filter(e=>!e.paymentMethodId);
if(utag.length>0)pmS.push({"×××¦×¢× ×ª×©×××":"×× ×××××¨","××¡×¤×¨ ×¢×¡×§×××ª":utag.length,"×¡×\"× âª":utag.reduce((s,e)=>s+Number(e.amount),0)});
if(pmS.length>0){const wsPM=XLSX.utils.json_to_sheet(pmS,{header:["×××¦×¢× ×ª×©×××","××¡×¤×¨ ×¢×¡×§×××ª","×¡×\"× âª"]});wsPM["!cols"]=[{wch:24},{wch:16},{wch:12}];XLSX.utils.book_append_sheet(wb,wsPM,"××¤× ×××¦×¢× ×ª×©×××");}
XLSX.writeFile(wb,isMonthly?`×××¦×××ª_××××©×_${exportCycle}.xlsx`:`×××¦×××ª_×©×××¢×_${exportWeek}.xlsx`);
showToast("×§×××¥ ××§×¡× ×××¨× â");
};
const [isLocked, setIsLocked] = useState(() => {
const t = sessionStorage.getItem("vault-unlocked");
return !t || Date.now() - Number(t) > 30 * 60 * 1000;
});
const [vaultPin, setVaultPin] = useState("");
const [vaultShake, setVaultShake] = useState(false);
const [vaultOpen, setVaultOpen] = useState(false);

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
<div style={{ fontFamily:"'Segoe UI',sans-serif", direction:"rtl", background:"linear-gradient(160deg,#2d3748 0%,#4a6fa5 100%)", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
<style>{`
@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
@keyframes vaultSpin { from{transform:rotate(0deg)} to{transform:rotate(180deg)} }
@keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.vault-shake { animation: shake 0.5s ease; }
.vault-open { animation: vaultSpin 0.6s ease forwards; }
.vault-fadein { animation: fadeIn 0.5s ease; }
`}</style>
<div className="vault-fadein" style={{ marginBottom:32, position:"relative" }}>
<svg width={140} height={140} viewBox="0 0 140 140" className={vaultOpen ? "vault-open" : ""} style={{ transformOrigin:"center" }}>
<circle cx={70} cy={70} r={66} fill="none" stroke="#9bb5cc" strokeWidth={8}/>
<circle cx={70} cy={70} r={66} fill="none" stroke="url(#vg)" strokeWidth={4} strokeDasharray="12 6"/>
<circle cx={70} cy={70} r={56} fill="#4a5568"/>
<circle cx={70} cy={70} r={56} fill="none" stroke="#718096" strokeWidth={3}/>
<circle cx={70} cy={70} r={32} fill="none" stroke="#9bb5cc" strokeWidth={6}/>
<circle cx={70} cy={70} r={32} fill="none" stroke="#bee3f8" strokeWidth={2}/>
{[0,60,120,180,240,300].map(a=>{
const rad=a*Math.PI/180;
return <line key={a} x1={70+32*Math.cos(rad)} y1={70+32*Math.sin(rad)} x2={70+52*Math.cos(rad)} y2={70+52*Math.sin(rad)} stroke="#718096" strokeWidth={4} strokeLinecap="round"/>;
})}
<circle cx={70} cy={70} r={10} fill="#718096"/>
<circle cx={70} cy={70} r={6} fill={vaultOpen?"#6bbf8e":"#6a9bc3"}/>
<circle cx={70} cy={70} r={3} fill={vaultOpen?"#a8d5ba":"#aed4f0"}/>
{[0,90,180,270].map(a=>{
const rad=a*Math.PI/180;
return <circle key={a} cx={70+44*Math.cos(rad)} cy={70+44*Math.sin(rad)} r={4} fill={vaultOpen?"#6bbf8e":"#718096"} stroke="#9bb5cc" strokeWidth={1.5}/>;
})}
<defs>
<linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stopColor="#6a9bc3"/><stop offset="100%" stopColor="#4a7fa5"/>
</linearGradient>
</defs>
</svg>
</div>
<div style={{ color:"#fff", fontSize:22, fontWeight:800, marginBottom:6 }}>×××¡×¤×ª ×××©×¤××ª××ª</div>
<div style={{ color:"#bee3f8", fontSize:13, marginBottom:32 }}>××× ×§×× ×× ××¡×</div>
<div className={vaultShake?"vault-shake":""} style={{ display:"flex", gap:14, marginBottom:32 }}>
{[0,1,2,3].map(i=>(
<div key={i} style={{ width:18, height:18, borderRadius:"50%", background:i<vaultPin.length?"#6a9bc3":"transparent", border:"2px solid", borderColor:i<vaultPin.length?"#6a9bc3":"#9bb5cc", transition:"all .15s", boxShadow:i<vaultPin.length?"0 0 10px rgba(106,155,195,.5)":"none" }}/>
))}
</div>
<div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, width:220, direction:"ltr" }}>
{[1,2,3,4,5,6,7,8,9].map(d=>(
<button key={d} onClick={()=>handleVaultDigit(String(d))}
style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.2)", borderRadius:14, height:60, fontSize:22, fontWeight:700, color:"#fff", cursor:"pointer", backdropFilter:"blur(4px)", transition:"all .1s" }}
onMouseDown={e=>e.currentTarget.style.background="rgba(106,155,195,.4)"}
onMouseUp={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
onTouchStart={e=>e.currentTarget.style.background="rgba(106,155,195,.4)"}
onTouchEnd={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
>{d}</button>
))}
<div/>
<button onClick={()=>handleVaultDigit("0")}
style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.2)", borderRadius:14, height:60, fontSize:22, fontWeight:700, color:"#fff", cursor:"pointer" }}
onMouseDown={e=>e.currentTarget.style.background="rgba(106,155,195,.4)"}
onMouseUp={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
onTouchStart={e=>e.currentTarget.style.background="rgba(106,155,195,.4)"}
onTouchEnd={e=>e.currentTarget.style.background="rgba(255,255,255,.15)"}
>0</button>
<button onClick={()=>setVaultPin(p=>p.slice(0,-1))}
style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.15)", borderRadius:14, height:60, fontSize:20, color:"#bee3f8", cursor:"pointer" }}>
â«
</button>
</div>
</div>
);

const pct = (val,max) => Math.min(100, max>0?(val/max)*100:0);
const weekPct = pct(spentThisWeek, weeklyVariableBudget);
const barColor = weekPct>90?"#D07878":weekPct>70?"#C9A96E":"#82B89A";
const hasFixedOverflow = fixedOverflowThisMonth > 0;
const inputStyle = { border:"1.5px solid #dde4ed", borderRadius:10, padding:"10px 12px", fontSize:13, outline:"none", background:"#fff" };
const cardStyle = { background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 6px rgba(0,0,0,.06)" };
return (
<div style={{ fontFamily:"'Segoe UI',sans-serif", direction:"rtl", background:"#F5F6F8", minHeight:"100vh", maxWidth:480, margin:"0 auto", paddingBottom:90 }}
onClick={e=>{ if(showWeekPicker && !e.target.closest('[data-weekpicker]')) setShowWeekPicker(false); }}>

{toast && <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background:toast.color, color:"#fff", padding:"10px 22px", borderRadius:50, fontWeight:700, zIndex:999, boxShadow:"0 4px 20px rgba(0,0,0,.15)", fontSize:14 }}>{toast.msg}</div>}

{/* Header */}
<div style={{ background:`linear-gradient(135deg,${theme.a} 0%,${theme.b} 100%)`, padding:"28px 20px 20px", color:"#fff" }}>
<div style={{ fontSize:12, opacity:.8, marginBottom:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<span>×××¡×¤×ª ×××©×¤××ª××ª</span>
<span style={{ fontSize:10, opacity:.8 }}>
{syncing ? "â³ ××¡× ××¨×..." : lastSync ? `×¡×× ××¨× ${lastSync.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}` : ""}
</span>
</div>
<div style={{ fontSize:28, fontWeight:800 }}>
{leftThisWeek>=0?`âª${leftThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})}`:`-âª${Math.abs(leftThisWeek).toLocaleString("he-IL",{maximumFractionDigits:0})}`}
</div>
<div style={{ fontSize:13, opacity:.85, marginBottom:12 }}>
× ×©××¨ ××©×××¢{hasFixedOverflow&&<span style={{fontSize:11,opacity:.8}}> (×××× ×§×××× ××¨××××ª)</span>}
</div>
<div style={{ background:"rgba(255,255,255,.25)", borderRadius:8, height:8, overflow:"hidden" }}>
<div style={{ background:"rgba(255,255,255,.9)", height:"100%", width:`${weekPct}%`, transition:"width .4s", borderRadius:8 }} />
</div>
<div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:5, opacity:.8 }}>
<span>âª{spentThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})} ×××¦××{trackingSpentThisWeek>0?` + âª${trackingSpentThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})} ××¢×§×`:""}</span>
<span>×ª×§×¦×× ×©×××¢: âª{weeklyVariableBudget.toLocaleString("he-IL",{maximumFractionDigits:0})}{selectedWeek>=currentWeekId&&weeksRemainingInCycle>1?<span style={{fontSize:9,opacity:.7}}> ({weeksRemainingInCycle} ×©×××¢××ª)</span>:null}{selectedWeek>currentWeekId?<span style={{fontSize:9,background:"rgba(234,179,8,.2)",borderRadius:4,padding:"1px 5px",marginRight:4,color:"#b45309"}}>ð ×¦×¤××</span>:null}</span>
</div>
{hasFixedOverflow && (
<div style={{ marginTop:10, background:"rgba(224,112,112,.25)", borderRadius:10, padding:"8px 12px", fontSize:11, display:"flex", alignItems:"center", gap:6 }}>
<span>â ï¸</span>
<span>××¨××× ××§×××¢××ª: âª{fixedOverflowThisMonth.toLocaleString("he-IL",{maximumFractionDigits:0})} | ×§× ×¡: âª{weeklyFixedOverflowPenalty.toLocaleString("he-IL",{maximumFractionDigits:0})}/×©×××¢</span>
</div>
)}
{/* Week navigation */}
<div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
<button onClick={()=>{ const d=new Date(selectedWeek); d.setDate(d.getDate()-7); setSelectedWeek(getWeekId(d)); }}
style={{ background:"rgba(255,255,255,.25)", border:"none", color:"#fff", borderRadius:10, width:32, height:32, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>â¹</button>
<div style={{ flex:1, position:"relative" }} data-weekpicker="true">
<button onClick={()=>setShowWeekPicker(p=>!p)}
style={{ width:"100%", background:"rgba(255,255,255,.25)", border:"none", color:"#fff", borderRadius:10, padding:"6px 10px", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
<span>ð</span>
<span>{selectedWeek===getWeekId()?"×©×××¢ ××":getWeekLabel(selectedWeek)}</span>
</button>
{showWeekPicker && (
<div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, left:0, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", zIndex:200, padding:12, maxHeight:260, overflowY:"auto" }}>
<div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:8, textAlign:"center" }}>×××¨ ×©×××¢</div>
{[getWeekId(), ...[...new Set([...allWeeks].filter(w=>w!==getWeekId()))].sort().reverse()].map(w=>(
<button key={w} onClick={()=>{ setSelectedWeek(w); setShowWeekPicker(false); }}
style={{ width:"100%", background:selectedWeek===w?theme.light:"transparent", color:selectedWeek===w?theme.acc:"#1e293b", border:"none", borderRadius:8, padding:"8px 10px", fontSize:12, fontWeight:selectedWeek===w?700:400, cursor:"pointer", textAlign:"right", marginBottom:2 }}>
{w===getWeekId()?"×©×××¢ ×× â ":""}{getWeekLabel(w)}
</button>
))}
<div style={{ borderTop:"1px solid #f1f5f9", marginTop:8, paddingTop:8 }}>
<input type="date" onChange={e=>{ if(e.target.value){ setSelectedWeek(getWeekId(new Date(e.target.value))); setShowWeekPicker(false); }}}
style={{ width:"100%", border:"1.5px solid #dde4ed", borderRadius:8, padding:"8px", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
</div>
</div>
)}
</div>
<button onClick={()=>{ const d=new Date(selectedWeek); d.setDate(d.getDate()+7); const next=getWeekId(d); setSelectedWeek(next); }}
style={{ background:"rgba(255,255,255,.25)", border:"none", color:"#fff", borderRadius:10, width:32, height:32, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>âº</button>
</div>
</div>

{/* Nav */}
<div style={{ background:"#fff", borderBottom:"1px solid #e8eef5", display:"flex", justifyContent:"space-around", padding:"10px 0" }}>
{[["dashboard","ð","×¡××××"],["variable","ð","××©×ª× ××ª"],["fixed","ð","×§×××¢××ª"],["savings","ð·","××¡×××"],["analytics","ð","× ××ª××"],["notes","ð","×¨×©××××ª"],["settings","âï¸","××××¨××ª"]].map(([id,icon,label])=>(
<button key={id} onClick={()=>setView(id)} style={{ background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:"pointer", color:view===id?theme.acc:"#64748b", fontSize:10, fontWeight:view===id?700:400, padding:"4px 8px" }}>
<span style={{fontSize:18}}>{icon}</span>{label}
</button>
))}
</div>

<div style={{ padding:"16px 16px 0" }}>
{/* ââ DASHBOARD ââ */}
{view==="dashboard" && (
<>
<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
{[{label:"××× ×¡×",val:totalMonthlyIncome,color:theme.incomeColor,bg:theme.light},{label:"×ª×§×¦××",val:totalBudgetIncl,color:"#e8b87c",bg:"#fdf6e8"},{label:"×¢×××£",val:totalMonthlyIncome-totalBudgetIncl,color:(totalMonthlyIncome-totalBudgetIncl)>=0?theme.acc:"#D07878",bg:(totalMonthlyIncome-totalBudgetIncl)>=0?theme.light:"#FAF0F0"}].map(c=>(
<div key={c.label} style={{ background:c.bg, borderRadius:14, padding:"12px 10px", textAlign:"center" }}>
<div style={{fontSize:11,color:"#6b7a8d",marginBottom:4}}>{c.label}</div>
<div style={{fontSize:15,fontWeight:800,color:c.color}}>âª{Math.abs(c.val).toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
</div>
))}
</div>

{/* Alerts */}
{alerts.length>0&&(
<div style={{marginBottom:12}}>
{alerts.map((a,i)=>(
<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,marginBottom:6,background:a.type==="danger"?"#FAF0F0":a.type==="warn"?"#fdf8ec":"#edf7f1",border:`1px solid ${a.type==="danger"?"#f5c6c6":a.type==="warn"?"#f0dfa8":"#b8e8cc"}`}}>
<span style={{fontSize:12,color:a.type==="danger"?"#B05858":a.type==="warn"?"#9A7840":"#5FA085",fontWeight:600,lineHeight:1.4}}>{a.msg}</span>
</div>
))}
</div>
)}

{/* Test Tubes */}
{(()=>{
const todayD=new Date(); todayD.setHours(0,0,0,0);
const dayOfWeek=todayD.getDay(); const daysPassed=dayOfWeek+1;
const weekFillPct=(7-daysPassed)/7;
const budgetFillPct=weeklyVariableBudget>0?Math.max(0,leftThisWeek/weeklyVariableBudget):0;
const budgetOver=leftThisWeek<0;
const DAY_LABELS=["×","×","×","×","×","×","×©"];
const TW=56,TH=220,tx=8,tw=40,topY=18,botY=192,rx=20;
const tubePath=`M ${tx} ${topY} L ${tx} ${botY-rx} Q ${tx} ${botY} ${tx+rx} ${botY} L ${tx+tw-rx} ${botY} Q ${tx+tw} ${botY} ${tx+tw} ${botY-rx} L ${tx+tw} ${topY}`;
const tubeClipPath=tubePath+` Z`;
const Tube=({fillPct,gradA,gradB,label,title,sub,extra,showDots})=>{
const clamp=Math.min(1,Math.max(0,fillPct));
const fillableH=botY-topY; const liquidY=botY-clamp*fillableH;
const gradId="tg-"+label; const clipId="tc-"+label; const shimId="ts-"+label;
const ticks=[0.25,0.5,0.75];
const waveAmp=6;
const bubblePositions=[{cx:tx+tw*0.28,delay:0,dur:2.4},{cx:tx+tw*0.55,delay:1.0,dur:3.1},{cx:tx+tw*0.75,delay:0.5,dur:1.9}];
return (
<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
<style>{`
@keyframes wave-${label} {
  0%,100% { transform: translateX(0px); }
  50%      { transform: translateX(-${TW*0.6}px); }
}
@keyframes fillRise-${label} {
  from { transform: translateY(${fillableH}px); opacity:0.3; }
  to   { transform: translateY(0px); opacity:1; }
}
@keyframes bubbleUp-${label}-0 {
  0%   { transform: translateY(0px); opacity:0.7; }
  80%  { opacity:0.3; }
  100% { transform: translateY(-${clamp*fillableH*0.8}px); opacity:0; }
}
@keyframes bubbleUp-${label}-1 {
  0%   { transform: translateY(0px); opacity:0.6; }
  80%  { opacity:0.25; }
  100% { transform: translateY(-${clamp*fillableH*0.75}px); opacity:0; }
}
@keyframes bubbleUp-${label}-2 {
  0%   { transform: translateY(0px); opacity:0.5; }
  80%  { opacity:0.2; }
  100% { transform: translateY(-${clamp*fillableH*0.7}px); opacity:0; }
}
.fillGroup-${label} {
  animation: fillRise-${label} 1.3s cubic-bezier(0.22,1,0.36,1) both;
}
.waveRect-${label} {
  animation: wave-${label} 3s ease-in-out infinite;
}
`}</style>
<div style={{fontSize:12,fontWeight:700,color:"#334155",letterSpacing:"-0.3px",textAlign:"center"}}>{title}</div>
<svg width={TW+24} height={TH} viewBox={`-12 0 ${TW+24} ${TH}`} style={{overflow:"visible"}}>
<defs>
<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={gradA} stopOpacity="0.9"/><stop offset="100%" stopColor={gradB} stopOpacity="1"/></linearGradient>
<linearGradient id={shimId} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(255,255,255,0.5)"/><stop offset="45%" stopColor="rgba(255,255,255,0.0)"/></linearGradient>
<clipPath id={clipId}><path d={tubeClipPath}/></clipPath>
</defs>
{ticks.map(t=>{const ty2=botY-t*fillableH;return(<g key={t}><line x1={tx+tw} y1={ty2} x2={tx+tw+8} y2={ty2} stroke="#c8d4e0" strokeWidth="1.2"/><text x={tx+tw+11} y={ty2+4} fontSize="8" fill="#94a3b8" fontWeight="600">{Math.round(t*100)}%</text></g>);})}
<path d={tubePath} fill="rgba(248,250,252,0.95)" stroke="rgba(148,163,184,0.3)" strokeWidth="1.5"/>
{clamp>0&&(
<g className={`fillGroup-${label}`} clipPath={`url(#${clipId})`}>
<rect x={tx} y={liquidY+waveAmp} width={tw} height={botY-liquidY} fill={`url(#${gradId})`}/>
<svg x={tx} y={liquidY-waveAmp} width={tw*2} height={waveAmp*3} style={{overflow:"hidden"}}>
<rect className={`waveRect-${label}`} x="0" y="0" width={tw*2} height={waveAmp*3}
fill={`url(#${gradId})`}
style={{clipPath:`path("M 0 ${waveAmp} Q ${tw*0.25} 0 ${tw*0.5} ${waveAmp} Q ${tw*0.75} ${waveAmp*2} ${tw} ${waveAmp} Q ${tw*1.25} 0 ${tw*1.5} ${waveAmp} Q ${tw*1.75} ${waveAmp*2} ${tw*2} ${waveAmp} L ${tw*2} ${waveAmp*3} L 0 ${waveAmp*3} Z")`}}
/>
</svg>
{clamp>0.1&&bubblePositions.map((b,i)=>(
<circle key={i} cx={b.cx} cy={botY-8} r={2+i*0.5} fill="rgba(255,255,255,0.5)"
style={{animation:`bubbleUp-${label}-${i} ${b.dur}s ease-in ${b.delay}s infinite`}}/>
))}
</g>
)}
<rect x={tx+3} y={topY} width={7} height={(botY-topY)*0.7} rx={3} fill={`url(#${shimId})`} clipPath={`url(#${clipId})`}/>
<path d={tubePath} fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1.5"/>
<rect x={tx-3} y={topY-8} width={tw+6} height={9} rx={3} fill="#e8eef5" stroke="rgba(148,163,184,0.5)" strokeWidth="1"/>
<text x={tx+tw/2} y={liquidY+(botY-liquidY)*0.5} textAnchor="middle" fontSize="15" fontWeight="900" fill={clamp>0.20?"rgba(255,255,255,0.95)":"#1e293b"} style={{fontFamily:"system-ui,sans-serif"}}>{Math.round(fillPct*100)}%</text>
</svg>
{showDots&&<div style={{display:"flex",gap:5}}>{DAY_LABELS.map((d,i)=>(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{width:9,height:9,borderRadius:"50%",background:i<daysPassed?gradB:"#dde4ed",boxShadow:i===dayOfWeek?`0 0 0 2px #fff, 0 0 0 3.5px ${gradB}`:"none",transition:"all .2s"}}/><span style={{fontSize:8,color:i===dayOfWeek?gradB:"#94a3b8",fontWeight:i===dayOfWeek?800:400}}>{d}</span></div>))}</div>}
<div style={{textAlign:"center"}}>
<div style={{fontSize:13,fontWeight:800,color:"#334155"}}>{sub}</div>
{extra&&<div style={{fontSize:11,fontWeight:700,color:"#e07070",marginTop:2}}>{extra}</div>}
</div>
</div>
);
};
const statusMsg=budgetOver?{text:`××¨××ª âª${Math.abs(Math.round(leftThisWeek)).toLocaleString("he-IL")}`,color:"#B05858",bg:"#FAF0F0"}:weekFillPct>budgetFillPct+0.15?{text:"××××× ×¨×¦×× ×××ª×§×¦××",color:"#9a7020",bg:"#fdf8ec"}:{text:"××ª× ××§×¦× ××× â",color:"#3d7a55",bg:"#edf7f1"};
return (
<div style={{...cardStyle,marginBottom:16,background:"#f8fbff",border:"1px solid #e0e8f0"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
<span style={{fontSize:13,fontWeight:700,color:"#334155"}}>××¦× ××©×××¢</span>
<span style={{fontSize:11,fontWeight:700,color:statusMsg.color,background:statusMsg.bg,padding:"3px 10px",borderRadius:20}}>{statusMsg.text}</span>
</div>
<div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-start"}}>
<Tube label="days" fillPct={weekFillPct} gradA="#c4b5e8" gradB="#8b6fc7" title="×××× ×©× ××ª×¨×" sub={`× ××ª×¨× ${7-daysPassed} ××××`} showDots/>
<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:90,gap:4,opacity:.25}}>
<div style={{width:1,height:36,background:"#94a3b8"}}/><span style={{fontSize:9,fontWeight:800,color:"#94a3b8",letterSpacing:1}}>VS</span><div style={{width:1,height:36,background:"#94a3b8"}}/>
</div>
<Tube label="budget" fillPct={budgetFillPct} gradA={budgetOver?"#f5c6c6":budgetFillPct<0.25?"#fce8b0":"#a8d5ba"} gradB={budgetOver?"#e07070":budgetFillPct<0.25?"#d4a040":"#6bbf8e"} title="×ª×§×¦×× ×©× ×©××¨" sub={`âª${Math.abs(Math.round(leftThisWeek)).toLocaleString("he-IL")}`} extra={budgetOver?"××¨×××!":null}/>
</div>
{/* Redistribution is automatic â no manual button needed */}
</div>
);
})()}

{/* Daily spending chart */}
{(()=>{
const dayMs=86400000;
const days=[];
let d=new Date(cycleStart);
while(d<=cycleEnd&&d<=today){
const ds=d.toISOString().slice(0,10);
const daySpend=data.expenses.filter(e=>e.date===ds&&variableBucketIds.has(e.bucketId)&&!trackingOnlyIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount),0);
days.push({ds,daySpend,isToday:ds===today.toISOString().slice(0,10)});
d=new Date(d.getTime()+dayMs);
}
if(days.length===0)return null;
const maxSpend=Math.max(...days.map(x=>x.daySpend),1);
const avgSpend=days.reduce((s,x)=>s+x.daySpend,0)/days.length;
const dailyBudget=totalVariableOnBudget/cycleTotalDays;
return(
<div style={{marginBottom:16}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<span style={{fontSize:13,fontWeight:700,color:"#334155"}}>×××¦×××ª ××××××ª â ×××××©</span>
<span style={{fontSize:11,color:"#94a3b8"}}>××××¦×¢ âª{Math.round(avgSpend).toLocaleString("he-IL")}/×××</span><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:"#94a3b8"}}><span style={{width:8,height:8,borderRadius:2,background:"#e07070",display:"inline-block"}}/>××¢× ×ª×§×¦××</span><span style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:"#94a3b8"}}><span style={{width:8,height:8,borderRadius:2,background:"#f0b87a",display:"inline-block"}}/>×¨×××</span><span style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:"#94a3b8"}}><span style={{width:8,height:8,borderRadius:2,background:"#7ec8a0",display:"inline-block"}}/>××ª××ª ×ª×§×¦××</span></div>
</div>
<div style={{background:"#fff",borderRadius:14,padding:"14px 12px 10px",boxShadow:"0 1px 6px rgba(0,0,0,.06)",overflowX:"auto"}}>
<div style={{display:"flex",alignItems:"flex-end",gap:3,minWidth:Math.max(320,days.length*18),height:80,position:"relative"}}>
<div style={{position:"absolute",bottom:Math.min(72,dailyBudget/maxSpend*72),left:0,right:0,borderTop:"1.5px dashed #c8d4e0",zIndex:1,pointerEvents:"none"}}/>
{days.map((day,i)=>{
const barH=day.daySpend>0?Math.max(3,(day.daySpend/maxSpend)*72):2;
const over=day.daySpend>dailyBudget;
const hot=day.daySpend>dailyBudget*1.8;
const barColor=hot?"#e07070":over?"#e8b87c":day.daySpend>0?theme.btn:"#eef2f7";
const dd=new Date(day.ds).getDate();
return(
<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,position:"relative",zIndex:2}}>
<div title={day.ds+": âª"+day.daySpend}
onClick={()=>setSelectedDay({ds:day.ds,daySpend:day.daySpend,expenses:data.expenses.filter(e=>e.date===day.ds)})}
style={{width:"100%",background:barColor,borderRadius:"3px 3px 0 0",height:barH,
outline:day.isToday?"2px solid "+theme.acc:"none",
outlineOffset:1,cursor:day.daySpend>0?"pointer":"default",minHeight:2,transition:"height .3s",
boxShadow:day.daySpend>0?"0 1px 4px rgba(0,0,0,.1)":"none"}}/>
{(dd===1||dd===5||dd===10||dd===15||dd===20||dd===25||day.isToday)&&
<span style={{fontSize:8,color:day.isToday?theme.acc:"#94a3b8",fontWeight:day.isToday?800:400}}>{dd}</span>}
</div>
);
})}
</div>
<div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"#94a3b8"}}>
<span>10/{new Date(cycleStart).getMonth()+1}</span>
<span>â ×ª×§×¦×× ×××× âª{Math.round(dailyBudget).toLocaleString("he-IL")}</span>
<span>10/{new Date(cycleStart).getMonth()+1}</span>
</div>
</div>
</div>
);
})()}

{/* Variable buckets summary */}
<div style={{marginBottom:16}}>
<div style={{fontSize:13,fontWeight:700,color:"#334155",marginBottom:10}}>××©×ª× ××ª â {getWeekLabel(selectedWeek)}</div>
{data.variableBuckets.length===0?<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>××× ×××§××× ××©×ª× ×× ×¢××××</div>:
data.variableBuckets.map(b=>{
const monthlyBudget=Number(b.amount); const monthlySpent=data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0); const p=pct(monthlySpent,monthlyBudget); const bc=p>90?"#D07878":p>65?"#C9A96E":"#82B89A";
return (<div key={b.id} style={{...cardStyle,padding:"12px 14px",marginBottom:8}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{ICONS[b.icon]}</span><span style={{fontSize:14,fontWeight:600}}>{b.name}</span>{b.trackingOnly&&<span style={{fontSize:9,background:"#fdf6e8",color:"#b07020",padding:"2px 5px",borderRadius:4,fontWeight:700}}>××¢×§×</span>}</div>
<div style={{fontSize:12,color:"#6b7a8d",display:"flex",alignItems:"baseline",gap:4}}><span style={{color:bc,fontWeight:700}}>âª{monthlySpent.toLocaleString("he-IL",{maximumFractionDigits:0})}</span><span>{" / "}âª{monthlyBudget.toLocaleString("he-IL",{maximumFractionDigits:0})}</span><span style={{fontSize:10,color:p>90?"#A04848":p>65?"#9A7840":"#5a8a7a",fontWeight:500,opacity:0.85}}>({Math.round(p)}%)</span></div>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:5,overflow:"hidden"}}><div style={{background:bc,height:"100%",width:`${p}%`,transition:"width .3s",borderRadius:6}}/></div>
</div>);
})}
</div>

{/* Recent expenses with filter + scroll */}
<div style={{marginBottom:16}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<div style={{fontSize:13,fontWeight:700,color:"#334155"}}>×××¦×××ª ×××¨×× ××ª</div>
<div style={{display:"flex",gap:6}}>
{[["all","×××"],["variable","××©×ª× ××ª"],["fixed","×§×××¢××ª"]].map(([f,label])=>(
<button key={f} onClick={()=>setExpenseFilter(f)}
style={{background:expenseFilter===f?theme.btn:"#eef2f7",color:expenseFilter===f?"#fff":"#6b7a8d",border:"none",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:expenseFilter===f?700:400,cursor:"pointer"}}>
{label}
</button>
))}
</div>
</div>
{(()=>{
const allExpenses = [...data.expenses].sort((a,b)=>b.createdAt-a.createdAt);
const filtered = allExpenses.filter(e => {
if (expenseFilter === "all") return true;
if (expenseFilter === "variable") return variableBucketIds.has(e.bucketId);
if (expenseFilter === "fixed") return fixedBucketIds.has(e.bucketId);
return true;
});
if (filtered.length===0) return <div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>××× ×××¦×××ª</div>;
return (
<div style={{maxHeight:expenseFilter==="all"?340:500,overflowY:"auto",paddingLeft:2}}>
{filtered.map(e=>(
<div key={e.id} style={{background:"#fff",borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
<div>
<div style={{fontSize:13,fontWeight:600}}>{getBucketName(e.bucketId)}</div>
{e.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{e.note}</div>}
<div style={{fontSize:11,color:"#c0cad8",display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
<span>{new Date(e.date).toLocaleDateString("he-IL")}</span>
<span style={{background:fixedBucketIds.has(e.bucketId)?"#fdf6e8":"#eef4fb",color:fixedBucketIds.has(e.bucketId)?"#b07020":"#4a7fa5",padding:"0 4px",borderRadius:3,fontSize:10}}>{fixedBucketIds.has(e.bucketId)?"×§×××¢×":"××©×ª× ×"}</span>
{e.recurring&&<span style={{background:"#edf7f1",color:"#3d7a55",padding:"0 4px",borderRadius:3,fontSize:10,fontWeight:700}}>ð ×××××¨×</span>}
{e.paymentMethodId&&<span style={{color:theme.acc}}>{getPMLabel(e.paymentMethodId)}</span>}
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:15}}>âª{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>setEditExpense({...e})} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"3px 7px",cursor:"pointer",fontSize:11}}>âï¸</button>
<button onClick={()=>sendToTelegram(e, getBucketName)} title="×©×× ×××××¨×" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:0}}>ð¤</button>
<button onClick={()=>deleteExpense(e.id)} style={{background:"none",border:"none",color:"#c0cad8",cursor:"pointer",fontSize:16,padding:0}}>â</button>
</div>
</div>
))}
</div>
);
})()}
</div>
</>
)}
{/* ââ VARIABLE ââ */}
{view==="variable" && (
<>
<div style={{fontSize:15,fontWeight:700,marginBottom:14}}>×××¦×××ª ××©×ª× ××ª</div>
<div style={{background:theme.varBg,borderRadius:12,padding:"12px 16px",marginBottom:16,fontSize:13}}>
<div style={{color:theme.varText,fontWeight:700}}>×¡×"× ××××©×: âª{totalVariableBudget.toLocaleString("he-IL")}</div>
<div style={{color:theme.varSub,marginTop:2}}>×ª×§×¦×× ×©×××¢×: âª{weeklyVariableBudget.toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
</div>
{data.variableBuckets.map(b=>{
const wB=Number(b.amount)/weeksInMonth; const spent=bucketSpendThisWeek(b.id); const isEditing=editBucket?.id===b.id;
return (
<div key={b.id} draggable={!isEditing} onDragStart={()=>{dragItem.current=data.variableBuckets.indexOf(b);}} onDragEnter={()=>{dragOver.current=data.variableBuckets.indexOf(b);}} onDragEnd={()=>reorderBuckets("variable")} onDragOver={e=>e.preventDefault()}
style={{...cardStyle,border:isEditing?`2px solid ${theme.btn}`:"2px solid transparent",cursor:isEditing?"default":"grab",userSelect:"none"}}>
{isEditing?(
<>
<div style={{fontSize:12,fontWeight:700,color:theme.btn,marginBottom:10}}>âï¸ ×¢×¨×××ª ×××§×</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<input value={editBucket.name} onChange={e=>setEditBucket(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="×©×"/>
<input type="number" value={editBucket.amount} onChange={e=>setEditBucket(p=>({...p,amount:e.target.value}))} style={inputStyle} placeholder="×¡××× ××××©× âª"/>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
{Object.entries(ICONS).slice(0,11).map(([k,v])=>(<button key={k} onClick={()=>setEditBucket(p=>({...p,icon:k}))} style={{background:editBucket.icon===k?theme.btnLight:"#f1f5f9",border:editBucket.icon===k?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:7,padding:"5px 8px",fontSize:15,cursor:"pointer"}}>{v}</button>))}
</div>
<div onClick={()=>setEditBucket(p=>({...p,trackingOnly:!p.trackingOnly}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:editBucket.trackingOnly?"#fdf6e8":"#edf7f1",border:editBucket.trackingOnly?"1.5px solid #e8b87c":"1.5px solid #a8d5ba",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>{editBucket.trackingOnly?"ð":"ð°"}</span>
<span style={{fontSize:12,fontWeight:600,color:editBucket.trackingOnly?"#9a7020":"#3d7a55",flex:1}}>{editBucket.trackingOnly?"××¢×§× ×××× â ×× ××©×¤××¢ ×¢× ×ª×§×¦×× ×©×××¢×":"××××©× ××ª×§×¦×× ××©×××¢×"}</span>
<div style={{width:32,height:18,background:editBucket.trackingOnly?"#e8b87c":"#6bbf8e",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:editBucket.trackingOnly?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<button onClick={()=>setEditBucket(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>×××××</button>
<button onClick={()=>deleteBucket("variable",b.id)} style={{background:"#FAF0F0",color:"#e07070",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>×××§</button>
<button onClick={saveBucketEdit} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>×©×××¨</button>
</div>
</>
):(
<>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
<div style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:700}}>
<span style={{fontSize:13,color:"#c0cad8",cursor:"grab",marginLeft:2}}>â ¿</span>
<span>{ICONS[b.icon]}</span>
<div>{b.name}{b.trackingOnly&&<span style={{fontSize:9,background:"#fdf6e8",color:"#b07020",padding:"1px 5px",borderRadius:4,fontWeight:700,marginRight:4}}>××¢×§×</span>}</div>
</div>
<button onClick={()=>setEditBucket({...b,type:"variable"})} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>âï¸ ×¢×¨××</button>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12}}>
{[{l:"××××©×",v:`âª${Number(b.amount).toLocaleString("he-IL")}`,c:theme.acc},{l:"×©×××¢×",v:`âª${wB.toLocaleString("he-IL",{maximumFractionDigits:0})}`,c:"#8b6fc7"},{l:"×××¦××",v:`âª${spent.toLocaleString("he-IL")}`,c:spent>wB?"#e07070":"#6bbf8e"}].map(x=>(
<div key={x.l} style={{background:"#f4f7fb",borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
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
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ ×××¡×£ ×××§× ××©×ª× ×</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
<input placeholder="×©×" value={newBucket.name} onChange={e=>setNewBucket(p=>({...p,name:e.target.value}))} style={inputStyle}/>
<input placeholder="×¡××× ××××©× âª" type="number" value={newBucket.amount} onChange={e=>setNewBucket(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
{Object.entries(ICONS).slice(0,11).map(([k,v])=>(<button key={k} onClick={()=>setNewBucket(p=>({...p,icon:k}))} style={{background:newBucket.icon===k?theme.btnLight:"#f1f5f9",border:newBucket.icon===k?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:8,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{v}</button>))}
</div>
<div onClick={()=>setNewBucket(p=>({...p,trackingOnly:!p.trackingOnly}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:newBucket.trackingOnly?"#fdf6e8":"#edf7f1",border:newBucket.trackingOnly?"1.5px solid #e8b87c":"1.5px solid #a8d5ba",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>{newBucket.trackingOnly?"ð":"ð°"}</span>
<span style={{fontSize:12,fontWeight:600,color:newBucket.trackingOnly?"#9a7020":"#3d7a55",flex:1}}>{newBucket.trackingOnly?"××¢×§× ×××× â ×× ××©×¤××¢ ×¢× ×ª×§×¦×× ×©×××¢×":"××××©× ××ª×§×¦×× ××©×××¢×"}</span>
<div style={{width:32,height:18,background:newBucket.trackingOnly?"#e8b87c":"#6bbf8e",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:newBucket.trackingOnly?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<button onClick={()=>addBucket("variable")} style={{width:"100%",background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>×××¡×£ ×××§×</button>
</div>
</>
)}
{/* ââ FIXED ââ */}
{view==="fixed" && (
<>
<div style={{fontSize:15,fontWeight:700,marginBottom:14}}>×××¦×××ª ×§×××¢××ª</div>
<div style={{background:theme.fixedBg,borderRadius:12,padding:"12px 16px",marginBottom:16,fontSize:13}}>
<div style={{color:theme.fixedText,fontWeight:700}}>×¡×"× ××××©×: âª{totalFixed.toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
<div style={{color:theme.fixedSub,marginTop:3}}>×××××¨ × ××××: {cycleLabel}</div>
</div>
{data.fixedBuckets.map(b=>{
const instLeft = b.isInstallment ? getInstallmentsRemaining(b) : null;
if (b.isInstallment && instLeft<=0) return null;
const monthly = getMonthlyAmount(b);
const spentB=data.expenses.filter(e=>e.bucketId===b.id&&inCurrentCycle(e.date)).reduce((s,e)=>s+Number(e.amount),0);
const overflow=Math.max(0,spentB-monthly); const hasOver=overflow>0; const isEditing=editBucket?.id===b.id;
return (
<div key={b.id} draggable={!isEditing} onDragStart={()=>{dragItem.current=data.fixedBuckets.indexOf(b);}} onDragEnter={()=>{dragOver.current=data.fixedBuckets.indexOf(b);}} onDragEnd={()=>reorderBuckets("fixed")} onDragOver={e=>e.preventDefault()}
style={{...cardStyle,border:isEditing?"2px solid "+theme.fixedText:hasOver?"1.5px solid #f5c6c6":"1.5px solid transparent",cursor:isEditing?"default":"grab",userSelect:"none"}}>
{isEditing?(
<>
<div style={{fontSize:12,fontWeight:700,color:theme.fixedText,marginBottom:10}}>âï¸ ×¢×¨×××ª ×××¦×× ×§×××¢×</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<input value={editBucket.name} onChange={e=>setEditBucket(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="×©×"/>
<input type="number" value={editBucket.amount} onChange={e=>setEditBucket(p=>({...p,amount:e.target.value}))} style={inputStyle} placeholder="×¡××× âª"/>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
{Object.entries(ICONS).slice(11).map(([k,v])=>(<button key={k} onClick={()=>setEditBucket(p=>({...p,icon:k}))} style={{background:editBucket.icon===k?theme.fixedBg:"#f1f5f9",border:editBucket.icon===k?"2px solid "+theme.fixedText:"2px solid transparent",borderRadius:7,padding:"5px 8px",fontSize:15,cursor:"pointer"}}>{v}</button>))}
</div>
<div onClick={()=>setEditBucket(p=>({...p,isRecurring:!p.isRecurring}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:8,background:editBucket.isRecurring?"#edf7f1":"#f4f7fb",border:editBucket.isRecurring?"1.5px solid #a8d5ba":"1.5px solid #dde4ed",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>ð</span>
<span style={{fontSize:12,fontWeight:600,color:editBucket.isRecurring?"#3d7a55":"#6b7a8d",flex:1}}>×××× ×××××¨× ×××××××</span>
<div style={{width:32,height:18,background:editBucket.isRecurring?"#6bbf8e":"#dde4ed",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:editBucket.isRecurring?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div onClick={()=>setEditBucket(p=>({...p,isSavings:!p.isSavings}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:editBucket.isSavings?"#edf4fb":"#f4f7fb",border:editBucket.isSavings?"1.5px solid #aed4f0":"1.5px solid #dde4ed",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>ð·</span>
<span style={{fontSize:12,fontWeight:600,color:editBucket.isSavings?"#4a7fa5":"#6b7a8d",flex:1}}>×××¦×× ×× ×××××ª ×××¡××× â × ×¡×¤×¨×ª ××××¡×××</span>
<div style={{width:32,height:18,background:editBucket.isSavings?"#6a9bc3":"#dde4ed",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:editBucket.isSavings?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<button onClick={()=>setEditBucket(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>×××××</button>
<button onClick={()=>deleteBucket("fixed",b.id)} style={{background:"#FAF0F0",color:"#e07070",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>×××§</button>
<button onClick={saveBucketEdit} style={{background:theme.fixedText,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>×©×××¨</button>
</div>
</>
):(
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:13,color:"#c0cad8",cursor:"grab"}}>â ¿</span>
<span style={{fontSize:22}}>{ICONS[b.icon]}</span>
<div>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:14,fontWeight:700}}>{b.name}</span>
{b.isRecurring&&<span style={{fontSize:9,background:"#edf7f1",color:"#3d7a55",padding:"1px 5px",borderRadius:4,fontWeight:700}}>ð ×××××¨×</span>}
{b.isSavings&&<span style={{fontSize:9,background:"#edf4fb",color:"#4a7fa5",padding:"1px 5px",borderRadius:4,fontWeight:700}}>ð· ××¡×××</span>}
</div>
<div style={{fontSize:13,color:"#6b7a8d"}}>
{b.isInstallment
? <>ð³ âª{monthly.toLocaleString("he-IL",{maximumFractionDigits:0})}/××××© Â· {instLeft} ×ª×©××××× × ××ª×¨×</>
: <>âª{Number(b.amount).toLocaleString("he-IL")} / ××××©</>}
</div>
<div style={{fontSize:12,color:spentB>0?(hasOver?"#e07070":"#6bbf8e"):"#94a3b8",marginTop:1}}>
×©××× ×××××©: âª{spentB.toLocaleString("he-IL")}
{hasOver&&<span style={{fontWeight:700}}> | ××¨×××: âª{overflow.toLocaleString("he-IL")}</span>}
</div>
</div>
</div>
<button onClick={()=>setEditBucket({...b,type:"fixed"})} style={{background:theme.fixedBg,border:"none",color:theme.fixedText,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>âï¸ ×¢×¨××</button>
</div>
)}
</div>
);
})}
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ ×××¡×£ ×××¦×× ×§×××¢×</div>
<div style={{display:"flex",gap:8,marginBottom:12}}>
{[["×¨××××",false,false],["×××××¨× ð",false,true],["×ª×©××××× ð³",true,false]].map(([label,isInst,isRec])=>(
<button key={label} onClick={()=>setNewBucket(p=>({...p,isInstallment:isInst,isRecurring:isRec}))}
style={{flex:1,background:(newBucket.isInstallment===isInst&&newBucket.isRecurring===isRec)?theme.fixedBg:"#f1f5f9",border:(newBucket.isInstallment===isInst&&newBucket.isRecurring===isRec)?"2px solid "+theme.fixedText:"2px solid transparent",borderRadius:8,padding:"9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>
))}
</div>
{newBucket.isRecurring&&<div style={{background:"#edf7f1",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#3d7a55"}}>ð ×××¦×× ×××××¨××ª â ×ª×¡××× ××××××××ª ××××× ×§×××¢ ×× ××××©</div>}
<div style={{display:"grid",gridTemplateColumns:newBucket.isInstallment?"1fr 1fr 1fr":"1fr 1fr",gap:8,marginBottom:10}}>
<input placeholder="×©×" value={newBucket.name} onChange={e=>setNewBucket(p=>({...p,name:e.target.value}))} style={inputStyle}/>
{newBucket.isInstallment?(
<>
<input placeholder="×¡××× ×××× âª" type="number" value={newBucket.totalAmount} onChange={e=>setNewBucket(p=>({...p,totalAmount:e.target.value}))} style={inputStyle}/>
<input placeholder="××¡×³ ×ª×©×××××" type="number" min="1" value={newBucket.installmentsLeft} onChange={e=>setNewBucket(p=>({...p,installmentsLeft:e.target.value}))} style={inputStyle}/>
</>
):(
<input placeholder="×¡××× âª / ××××©" type="number" value={newBucket.amount} onChange={e=>setNewBucket(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
)}
</div>
{newBucket.isInstallment&&newBucket.totalAmount&&newBucket.installmentsLeft&&(
<div style={{background:theme.fixedBg,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:theme.fixedText}}>
ð¡ ×ª×©××× ××××©×: âª{(Number(newBucket.totalAmount)/Number(newBucket.installmentsLeft)).toLocaleString("he-IL",{maximumFractionDigits:0})}
</div>
)}
<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
{Object.entries(ICONS).slice(11).map(([k,v])=>(<button key={k} onClick={()=>setNewBucket(p=>({...p,icon:k}))} style={{background:newBucket.icon===k?theme.fixedBg:"#f1f5f9",border:newBucket.icon===k?"2px solid "+theme.fixedText:"2px solid transparent",borderRadius:8,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{v}</button>))}
</div>
<button onClick={()=>addBucket("fixed")} style={{width:"100%",background:theme.fixedText,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>×××¡×£</button>
</div>
</>
)}
{/* ââ SAVINGS ââ */}
{view==="savings" && (
<>
<div style={{fontSize:15,fontWeight:700,marginBottom:14}}>ð· ××¡××× ××ª</div>
<div style={{background:`linear-gradient(135deg,${theme.savingsA},${theme.savingsB})`,borderRadius:16,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
<div>
<div style={{fontSize:11,opacity:.8,marginBottom:3}}>×¡×"× ××¤×§×××ª</div>
<div style={{fontSize:22,fontWeight:900}}>âª{totalSavings.toLocaleString("he-IL")}</div>
<div style={{fontSize:10,opacity:.7,marginTop:2}}>{(data.savings||[]).length} ×¨×©××××ª</div>
</div>
<div style={{borderRight:"1px solid rgba(255,255,255,.3)",paddingRight:12}}>
<div style={{fontSize:11,opacity:.8,marginBottom:3}}>××¦× × ××××</div>
<div style={{fontSize:22,fontWeight:900}}>âª{totalSnapshotBalance.toLocaleString("he-IL")}</div>
<div style={{fontSize:10,opacity:.7,marginTop:2}}>{(data.savingsSnapshot||[]).length} ×××¦×¨××</div>
</div>
</div>
</div>
<div style={{display:"flex",gap:8,marginBottom:16}}>
{[["deposits","ð° ××¤×§×××ª"],["snapshot","ð¸ ××¦× ××¡××× ××ª"]].map(([t,label])=>(
<button key={t} onClick={()=>setSavingsTab(t)}
style={{flex:1,background:savingsTab===t?theme.savingsB:"#f1f5f9",color:savingsTab===t?"#fff":"#6b7a8d",border:"none",borderRadius:10,padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
{label}
</button>
))}
</div>
{savingsTab==="deposits" && <>
{SAVING_CHANNELS.filter(ch=>(data.savings||[]).some(s=>s.channel===ch.id)).length>0&&(
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>××¤× ××¤××§</div>
{SAVING_CHANNELS.filter(ch=>(data.savings||[]).some(s=>s.channel===ch.id)).map(ch=>{
const total=(data.savings||[]).filter(s=>s.channel===ch.id).reduce((s,x)=>s+Number(x.amount),0);
const p=totalSavings>0?(total/totalSavings)*100:0;
return (<div key={ch.id} style={{marginBottom:10}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13}}>{ch.icon} {ch.label}</span><span style={{fontSize:13,fontWeight:700,color:theme.savingsA}}>âª{total.toLocaleString("he-IL")}</span></div>
<div style={{background:"#eef2f7",borderRadius:6,height:6,overflow:"hidden"}}><div style={{background:theme.savingsB,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/></div>
</div>);
})}
</div>
)}
{(data.savings||[]).length>0&&(
<div style={{marginBottom:16}}>
<div style={{fontSize:13,fontWeight:700,marginBottom:10}}>×× ××¨×©××××ª</div>
{[...(data.savings||[])].sort((a,b)=>b.createdAt-a.createdAt).map(s=>{
const ch=SAVING_CHANNELS.find(c=>c.id===s.channel)||SAVING_CHANNELS[6];
return (<div key={s.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
<div>
<div style={{fontSize:13,fontWeight:700}}>{ch.icon} {ch.label}</div>
{s.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{s.note}</div>}
<div style={{fontSize:11,color:"#c0cad8",marginTop:2}}>{new Date(s.date).toLocaleDateString("he-IL")}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontWeight:800,color:theme.savingsB,fontSize:15}}>âª{Number(s.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>deleteSaving(s.id)} style={{background:"none",border:"none",color:"#c0cad8",cursor:"pointer",fontSize:16,padding:0}}>â</button>
</div>
</div>);
})}
</div>
)}
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ ×¨×©×× ××¤×§××</div>
<select value={newSaving.channel} onChange={e=>setNewSaving(p=>({...p,channel:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
{SAVING_CHANNELS.map(ch=><option key={ch.id} value={ch.id}>{ch.icon} {ch.label}</option>)}
</select>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
<input type="number" placeholder="×¡××× âª" value={newSaving.amount} onChange={e=>setNewSaving(p=>({...p,amount:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
<input type="date" value={newSaving.date} onChange={e=>setNewSaving(p=>({...p,date:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
</div>
<input placeholder="××¢×¨×" value={newSaving.note} onChange={e=>setNewSaving(p=>({...p,note:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:12,fontSize:14,boxSizing:"border-box"}}/>
<button onClick={addSaving} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer"}}>×©×××¨ ××¤×§××</button>
</div>
</>}
{savingsTab==="snapshot" && <>
<div style={{fontSize:12,color:"#94a3b8",marginBottom:12,textAlign:"center"}}>×¨×©×× ××ª ×××ª×¨× ×× ×××××ª ××× ×××¦×¨ ××¡×××</div>
{(data.savingsSnapshot||[]).length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>××× ×××¦×¨× ××¡××× ×¢××××</div>}
{(data.savingsSnapshot||[]).map(item=>{
const ch=SAVING_CHANNELS.find(c=>c.id===item.channel)||SAVING_CHANNELS[6];
const p=totalSnapshotBalance>0?(item.balance/totalSnapshotBalance)*100:0;
return (
<div key={item.id} style={{...cardStyle,border:`1.5px solid ${theme.btnLight}`}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:20}}>{ch.icon}</span>
<div><div style={{fontSize:13,fontWeight:700}}>{item.name}</div><div style={{fontSize:11,color:"#94a3b8"}}>{ch.label}</div></div>
</div>
<div style={{display:"flex",alignItems:"center",gap:6}}>
{editSnapshotId===item.id ? (
<input type="number" defaultValue={item.balance} autoFocus
style={{...inputStyle,width:110,fontSize:13,padding:"6px 8px"}}
onBlur={e=>updateSnapshotBalance(item.id, e.target.value)}
onKeyDown={e=>e.key==="Enter"&&updateSnapshotBalance(item.id,e.target.value)}/>
) : (
<>
<span style={{fontSize:15,fontWeight:800,color:theme.savingsB}} onClick={()=>setEditSnapshotId(item.id)}>âª{Number(item.balance).toLocaleString("he-IL")}</span>
<button onClick={()=>setEditSnapshotId(item.id)} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>âï¸</button>
</>
)}
<button onClick={()=>deleteSnapshotItem(item.id)} style={{background:"#fdf0f0",border:"none",color:"#e07070",borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>â</button>
</div>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:5,overflow:"hidden"}}><div style={{background:theme.savingsB,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/></div>
<div style={{fontSize:10,color:"#94a3b8",marginTop:4,display:"flex",justifyContent:"space-between"}}>
<span>{Math.round(p)}% ×××ª××§</span><span>×¢×××× {new Date(item.updatedAt).toLocaleDateString("he-IL")}</span>
</div>
</div>
);
})}
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ ×××¡×£ ×××¦×¨ ××¡×××</div>
<select value={newSnapshotItem.channel} onChange={e=>setNewSnapshotItem(p=>({...p,channel:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:8,boxSizing:"border-box",fontSize:13}}>
{SAVING_CHANNELS.map(ch=><option key={ch.id} value={ch.id}>{ch.icon} {ch.label}</option>)}
</select>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<input placeholder="×©×" value={newSnapshotItem.name} onChange={e=>setNewSnapshotItem(p=>({...p,name:e.target.value}))} style={{...inputStyle,fontSize:13}}/>
<input type="number" placeholder="××ª×¨× âª" value={newSnapshotItem.balance} onChange={e=>setNewSnapshotItem(p=>({...p,balance:e.target.value}))} style={{...inputStyle,fontSize:13}}/>
</div>
<button onClick={addSnapshotItem} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>×××¡×£ ×××¦×¨</button>
</div>
</>}
</>
)}
{/* ââ ANALYTICS ââ */}
{view==="analytics" && (
<>
<div style={{fontSize:15,fontWeight:700,marginBottom:14}}>ð × ××ª××</div>

{/* Projection â now includes tracking-only buckets in budget */}
<div style={{background:`linear-gradient(135deg,${theme.a},${theme.b})`,borderRadius:16,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
<div style={{fontSize:12,opacity:.85,marginBottom:4}}>ð° ×××¡××× ×¦×¤×× ×××××©</div>
<div style={{fontSize:28,fontWeight:900}}>{projectedSavings>=0?`âª${Math.round(projectedSavings).toLocaleString("he-IL")}`:`-âª${Math.round(Math.abs(projectedSavings)).toLocaleString("he-IL")}`}</div>
<div style={{fontSize:12,opacity:.85,marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
<span>ð ×¢×××£ ×× ××ª××§×¦×: âª{Math.round(expectedSurplus).toLocaleString("he-IL")}</span>
<span>ð ×¢×××£ ××©×ª× ××ª (×¦×¤×): {projectedUnspentVariable>=0?`âª${Math.round(projectedUnspentVariable).toLocaleString("he-IL")}`:`-âª${Math.round(Math.abs(projectedUnspentVariable)).toLocaleString("he-IL")}`}</span>
{fixedSavingsBudget>0&&<span>ð¦ ××¡××× ××§×××¢××ª: âª{Math.round(fixedSavingsBudget).toLocaleString("he-IL")}</span>}
</div>
<div style={{marginTop:10,background:"rgba(255,255,255,.25)",borderRadius:8,height:8,overflow:"hidden"}}>
<div style={{background:projectedSavings>=0?"rgba(255,255,255,.85)":"rgba(224,112,112,.8)",height:"100%",width:`${Math.min(100,totalMonthlyIncome>0?(Math.max(0,projectedSavings)/totalMonthlyIncome)*100:0)}%`,borderRadius:8,transition:"width .4s"}}/>
</div>
<div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:5,opacity:.8}}>
<span>×××¦×× ××©×ª× ××ª (×¦×¤×): âª{Math.round(projectedVariableSpend).toLocaleString("he-IL")}</span>
<span>××× ×¡×: âª{Math.round(totalMonthlyIncome).toLocaleString("he-IL")}</span>
</div>
<div style={{fontSize:10,opacity:.7,marginTop:4,borderTop:"1px solid rgba(255,255,255,.2)",paddingTop:6}}>
×××¦× ×¢× ××: âª{Math.round(spentThisCycle).toLocaleString("he-IL")} | {Math.round(daysElapsed)} ×××× ××ª×× {cycleTotalDays}
</div>
</div>


{/* ââ Smart Budget Recommendations ââ */}
{(()=>{
  const varRecs = [];
  data.variableBuckets.forEach(b => {
    if(b.trackingOnly) return;
    const spent = data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
    const budget = Number(b.amount);
    const pct = budget > 0 ? spent/budget : 0;
    const proj = daysElapsed/cycleTotalDays > 0.1 ? spent/(daysElapsed/cycleTotalDays) : spent*2;
    if(pct >= 0.85) varRecs.push({type:pct>=1?'danger':'warn', name:b.name, icon:b.icon, budget, spent:Math.round(spent), proj:Math.round(proj), suggested:Math.round(proj*1.15/50)*50, reason:pct>=1?'××¨××ª ×-âª'+Math.round(spent-budget).toLocaleString('he-IL'):'××©×ª××©×ª ×-'+Math.round(pct*100)+'% ×¢× ××', action:pct>=1?'×××× ×ª×§×¦××':'×©×§×× ××××××'});
    else if(pct < 0.4 && daysElapsed/cycleTotalDays >= 0.45 && budget >= 300) varRecs.push({type:'good', name:b.name, icon:b.icon, budget, spent:Math.round(spent), proj:Math.round(proj), suggested:Math.max(Math.round(proj*1.25/50)*50,100), reason:'×¨×§ '+Math.round(pct*100)+'% ×× ××¦× ×-'+Math.round(daysElapsed/cycleTotalDays*100)+'% ×××ª×§××¤×', action:'×©×§×× ×××§×××'});
  });
  if(varRecs.length === 0) return null;
  return (
    <div style={{...cardStyle, marginBottom:16, border:'1.5px solid #c8e4f7'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <span style={{fontSize:13, fontWeight:700}}>ð¡ ××××¦××ª ×ª×§×¦××</span>
        <span style={{fontSize:11, color:'#555', background:theme.light, padding:'3px 8px', borderRadius:6}}>{varRecs.length} ××××¦××ª</span>
      </div>
      {varRecs.map((r,i)=>{
        const bg=r.type==='danger'?'#FAF0F0':r.type==='warn'?'#fdf8ec':'#f0faf5';
        const bdr=r.type==='danger'?'#f5c6c6':r.type==='warn'?'#f0dfa8':'#b7e4c7';
        const tc=r.type==='danger'?'#b03030':r.type==='warn'?'#7a4a00':'#1a7a42';
        const abg=r.type==='danger'?'#b03030':r.type==='warn'?'#7a4a00':'#1a7a42';
        const arr=r.type==='good'?'â':'â';
        return (
          <div key={i} style={{background:bg, border:'1px solid '+bdr, borderRadius:10, padding:'10px 12px', marginBottom:8}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
              <span style={{fontSize:14, fontWeight:600, color:'#1a3a5c'}}>{ICONS[r.icon]} {r.name}</span>
              <span style={{background:abg, color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600}}>{r.action}</span>
            </div>
            <div style={{fontSize:12, color:'#333', marginBottom:3}}>{r.reason}</div>
            <div style={{fontSize:12, color:tc, fontWeight:600}}>{arr} âª{r.budget.toLocaleString('he-IL')} â âª{r.suggested.toLocaleString('he-IL')}</div>
            <div style={{fontSize:10, color:'#555', marginTop:2}}>××¤××¢×: âª{r.spent.toLocaleString('he-IL')} | ×¦×¤×: âª{r.proj.toLocaleString('he-IL')}</div>
          </div>
        );
      })}
      <div style={{fontSize:11, color:'#666', marginTop:6, borderTop:'1px solid #eaf4fc', paddingTop:8, textAlign:'center'}}>âï¸ ××©×× ×× ×ª×§×¦×× â ×××¥ "××©×ª× ××ª" â "×¢×¨××"</div>
    </div>
  );
})()}

{/* ââ Weekly Variable Spending Chart ââ */}
{(()=>{
  // Billing cycle weekly breakdown â variable expenses only
  const weeks = [];
  let cur = new Date(cycleStart);
  while(cur <= cycleEnd) {
    const wStart = new Date(cur);
    const wEnd = new Date(cur); wEnd.setDate(wEnd.getDate() + 6);
    const wEndCapped = wEnd > cycleEnd ? new Date(cycleEnd) : wEnd;
    const wId = wStart.toISOString().slice(0,10);
    const wSpend = data.expenses.filter(e => {
      const d = new Date(e.date); d.setHours(0,0,0,0);
      return d >= wStart && d <= wEndCapped && variableBucketIds.has(e.bucketId);
    }).reduce((s,e) => s+Number(e.amount),0);
    const isPast = wEndCapped < today;
    const isCurrent = !isPast && wStart <= today;
    if(isPast || isCurrent) weeks.push({wId, wStart, wEndCapped, wSpend, isCurrent});
    cur.setDate(cur.getDate() + 7);
  }
  if(weeks.length === 0) return null;
  const maxSpend = Math.max(...weeks.map(w=>w.wSpend), 1);
  const fmtWk = (d) => d.getDate()+'/'+(d.getMonth()+1);
  return (
    <div style={{...cardStyle, marginBottom:16, border:'1.5px solid #c8e4f7'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
        <span style={{fontSize:13, fontWeight:700}}>ð × ××ª×× ×××¦×××ª</span>
        <span style={{fontSize:11, color:'#444', background:theme.light, padding:'3px 8px', borderRadius:6}}>{fmtWk(cycleStart)} â {fmtWk(cycleEnd)}</span>
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11, color:'#333', fontWeight:600, marginBottom:8}}>×××¦×××ª ××©×ª× ××ª ×©×××¢×××ª (âª)</div>
        <div style={{display:'flex', gap:4, alignItems:'flex-end', height:110, borderBottom:'1px solid #eaf4fc', paddingBottom:2, direction:'ltr'}}>
          {[...weeks].reverse().map((w,i)=>{
            const h = Math.max(Math.round((w.wSpend/maxSpend)*100),3);
            return (
              <div key={w.wId} style={{display:'flex', flexDirection:'column', alignItems:'center', flex:1, gap:2}}>
                <div style={{fontSize:10, color:w.isCurrent?'#1a6a9c':'#4a9cd4', fontWeight:w.isCurrent?700:400, textAlign:'center'}}>
                  {w.wSpend>0?'âª'+Math.round(w.wSpend).toLocaleString('he-IL'):''}
                </div>
                <div style={{width:'100%', height:80, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
                  <div style={{width:'70%', background:w.isCurrent?theme.btn:'#a8d2ee', borderRadius:'4px 4px 0 0', height:h+'%'}}/>
                </div>
                <div style={{fontSize:9, color:'#444', textAlign:'center'}}>{fmtWk(w.wStart)}-{fmtWk(w.wEndCapped)}</div>
                <div style={{fontSize:9, color:'#777'}}>{w.isCurrent?'â ×¢××©××':''}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{fontSize:11, color:'#333', fontWeight:600, marginBottom:10}}>×ª×§×¦×× vs ××¤××¢× â ××©×ª× ××ª</div>
        {[...data.variableBuckets].map(b=>({...b, spent:data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0)})).sort((a,b2)=>(b2.spent/b2.amount)-(a.spent/a.amount)).slice(0,7).map(b=>{
          const p = Math.min((b.spent/b.amount)*100, 100);
          const over = b.spent > b.amount;
          const clr = over?'#D07878':p>75?'#C9A96E':'#82B89A';
          const txt = over?'#A04848':'#2A6A55';
          const track = b.trackingOnly?<span style={{fontSize:9,color:'#777',background:'#f5f5f5',padding:'1px 4px',borderRadius:3,marginRight:4}}>××¢×§×</span>:null;
          return (
            <div key={b.id} style={{marginBottom:9}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3}}>
                <div style={{fontSize:11, color:'#1a3a5c', fontWeight:500}}>{ICONS[b.icon]} {b.name}{track}</div>
                <div style={{fontSize:11, color:txt, fontWeight:600, display:'flex', alignItems:'baseline', gap:4}}>
                  <span>âª{Math.round(b.spent).toLocaleString('he-IL')} / âª{b.amount.toLocaleString('he-IL')}</span>
                  <span style={{fontSize:10, color:over?'#A04848':p>75?'#9A7840':'#5a8a7a', fontWeight:500, opacity:0.85}}>({Math.round(p)}%)</span>
                </div>
              </div>
              <div style={{background:'#eaf4fc', borderRadius:4, height:7}}>
                <div style={{width:p+'%', background:clr, height:'100%', borderRadius:4}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})()}

{/* Category breakdown â with remaining budget per category */}
<div style={{...cardStyle,marginBottom:16}}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>×¤×××× ×§××××¨×××ª â ××××© × ××××</div>
{data.variableBuckets.length===0&&<div style={{color:"#94a3b8",fontSize:12,textAlign:"center"}}>××× ×§××××¨×××ª</div>}
{data.variableBuckets.map(b=>{
const spent=data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const budget=Number(b.amount);
const remaining=budget-spent;
const p=budget>0?Math.min(100,(spent/budget)*100):0;
const col=p>100?"#e07070":p>80?"#e8b87c":theme.btn;
const isExpanded = expandedCategory===b.id;
const bucketExps = data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).sort((a,b2)=>new Date(b2.date)-new Date(a.date));
return (
<div key={b.id} style={{marginBottom:14}}>
<div onClick={()=>setExpandedCategory(isExpanded?null:b.id)} style={{cursor:"pointer",userSelect:"none"}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
<span style={{fontSize:13,display:"flex",alignItems:"center",gap:4}}>{ICONS[b.icon]} {b.name}{b.trackingOnly&&<span style={{fontSize:9,background:"#fdf6e8",color:"#b07020",padding:"1px 4px",borderRadius:3,fontWeight:700}}>××¢×§×</span>}<span style={{fontSize:10,color:"#94a3b8",marginRight:2}}>{isExpanded?"â²":"â¼"}</span></span>
<div style={{textAlign:"left"}}>
<span style={{fontSize:12,fontWeight:700,color:col}}>âª{spent.toLocaleString("he-IL",{maximumFractionDigits:0})} / âª{budget.toLocaleString("he-IL")}</span>
</div>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:7,overflow:"hidden",marginBottom:4}}>
<div style={{background:col,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/>
</div>
<div style={{fontSize:11,color:remaining>=0?theme.acc:"#e07070",fontWeight:700}}>
{remaining>=0?`× ×©××¨: âª${remaining.toLocaleString("he-IL",{maximumFractionDigits:0})}`:`××¨×××: âª${Math.abs(remaining).toLocaleString("he-IL",{maximumFractionDigits:0})}`}
</div>
</div>
{isExpanded&&(
<div style={{background:"#f8fafc",borderRadius:10,marginTop:6,padding:"4px 0",border:"1px solid #e8eef5"}}>
{bucketExps.length===0
?<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"10px 0"}}>××× ×××¦×××ª ×××××©</div>
:bucketExps.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid #f1f5f9"}}>
<div style={{flex:1}}>
<div style={{fontSize:12,fontWeight:600,color:"#334155"}}>{e.note||"â"}</div>
<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{new Date(e.date).toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:13}}>âª{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={ev=>{ev.stopPropagation();setEditExpense({...e});}} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>âï¸</button>
</div>
</div>
))
}
</div>
)}
</div>
);
})}
{/* Fixed buckets remaining */}
{activeFixed.length>0&&<>
<div style={{fontSize:12,fontWeight:700,color:theme.fixedText,marginTop:12,marginBottom:8}}>×§×××¢××ª</div>
{activeFixed.map(b=>{
const monthly=getMonthlyAmount(b);
const spent=data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const remaining=monthly-spent;
const p=monthly>0?Math.min(100,(spent/monthly)*100):0;
const col=p>100?"#e07070":p>80?"#e8b87c":"#6bbf8e";
const isExpandedF = expandedCategory===b.id;
const bucketExpsF = data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).sort((a,b2)=>new Date(b2.date)-new Date(a.date));
return (
<div key={b.id} style={{marginBottom:14}}>
<div onClick={()=>setExpandedCategory(isExpandedF?null:b.id)} style={{cursor:"pointer",userSelect:"none"}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
<span style={{fontSize:13,display:"flex",alignItems:"center",gap:4}}>{ICONS[b.icon]} {b.name}<span style={{fontSize:10,color:"#94a3b8",marginRight:2}}>{isExpandedF?"â²":"â¼"}</span></span>
<span style={{fontSize:12,fontWeight:700,color:col}}>âª{spent.toLocaleString("he-IL",{maximumFractionDigits:0})} / âª{monthly.toLocaleString("he-IL",{maximumFractionDigits:0})}</span>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:7,overflow:"hidden",marginBottom:4}}>
<div style={{background:col,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/>
</div>
<div style={{fontSize:11,color:remaining>=0?"#6bbf8e":"#e07070",fontWeight:700}}>
{remaining>=0?`× ×©××¨: âª${remaining.toLocaleString("he-IL",{maximumFractionDigits:0})}`:`××¨×××: âª${Math.abs(remaining).toLocaleString("he-IL",{maximumFractionDigits:0})}`}
</div>
</div>
{isExpandedF&&(
<div style={{background:"#f8fafc",borderRadius:10,marginTop:6,padding:"4px 0",border:"1px solid #e8eef5"}}>
{bucketExpsF.length===0
?<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"10px 0"}}>××× ×××¦×××ª ×××××©</div>
:bucketExpsF.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid #f1f5f9"}}>
<div style={{flex:1}}>
<div style={{fontSize:12,fontWeight:600,color:"#334155"}}>{e.note||"â"}</div>
<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{new Date(e.date).toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:13}}>âª{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={ev=>{ev.stopPropagation();setEditExpense({...e});}} style={{background:theme.fixedBg,border:"none",color:theme.fixedText,borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>âï¸</button>
</div>
</div>
))
}
</div>
)}
</div>
);
})}
</>}
</div>

{/* Monthly history chart */}
{cycleHistory.length>1&&(
<div style={{...cardStyle,marginBottom:16}}>
<div style={{fontSize:13,fontWeight:700,marginBottom:14}}>×××¡×××¨×× ××××©××ª</div>
<div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,paddingBottom:4}}>
{cycleHistory.slice(-6).map((cy,i)=>{
const maxTotal=Math.max(...cycleHistory.slice(-6).map(c=>Math.max(c.total,c.budget)),1);
const barH=Math.max(4,(cy.total/maxTotal)*100);
const budH=Math.max(4,(cy.budget/maxTotal)*100);
const isOver=cy.total>cy.budget;
const isCurrent=cy.csStr===cycleStart.toISOString().slice(0,10);
return (
<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
<div style={{fontSize:8,fontWeight:700,color:isOver?"#e07070":theme.acc}}>{cy.total>0?`âª${Math.round(cy.total/1000)}k`:""}</div>
<div style={{width:"100%",position:"relative",display:"flex",alignItems:"flex-end",justifyContent:"center",height:90}}>
<div style={{position:"absolute",bottom:`${budH}%`,left:0,right:0,borderTop:"1.5px dashed #c8d4e0"}}/>
<div style={{width:"70%",background:isCurrent?theme.btn:isOver?"#e07070":"#a0b4c8",borderRadius:"4px 4px 0 0",height:`${barH}%`,opacity:isCurrent?1:0.65,transition:"height .4s"}}/>
</div>
<div style={{fontSize:8,color:isCurrent?theme.btn:"#94a3b8",fontWeight:isCurrent?700:400,textAlign:"center",lineHeight:1.2}}>{cy.label}</div>
</div>
);
})}
</div>
</div>
)}

{/* Search */}
{(()=>{
const filtered=searchQ.trim().length>1?data.expenses.filter(e=>{const bn=getBucketName(e.bucketId).toLowerCase();const note=(e.note||"").toLowerCase();const q=searchQ.toLowerCase();return bn.includes(q)||note.includes(q)||String(e.amount).includes(q);}).slice(0,20):[];
return (
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:10}}>ð ×××¤××© ×××¦×××ª</div>
<input placeholder="××¤×© ××¤× ×§××××¨××, ××¢×¨×, ×¡×××..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}
style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:13}}/>
{searchQ.trim().length>1&&filtered.length===0&&<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:12}}>×× × ××¦×× ×ª××¦×××ª</div>}
{filtered.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
<div>
<div style={{fontSize:13,fontWeight:600}}>{getBucketName(e.bucketId)}</div>
{e.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{e.note}</div>}
<div style={{fontSize:10,color:"#c0cad8"}}>{new Date(e.date).toLocaleDateString("he-IL")}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070"}}>âª{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>setEditExpense({...e})} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"3px 7px",cursor:"pointer",fontSize:11}}>âï¸</button>
<button onClick={()=>sendToTelegram(e, getBucketName)} title="×©×× ×××××¨×" style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:0}}>ð¤</button>
<button onClick={()=>deleteExpense(e.id)} style={{background:"none",border:"none",color:"#c0cad8",cursor:"pointer",fontSize:14}}>â</button>
</div>
</div>
))}
</div>
);
})()}
</>
)}
{/* ââ NOTES ââ */}
{view==="notes" && (
<>
<div style={{fontSize:15,fontWeight:700,marginBottom:14}}>ð ×¨×©××××ª</div>
<div style={{...cardStyle,marginBottom:16,background:"#f0faf4",border:"1.5px solid #b8e8cc"}}>
<input placeholder="×××ª×¨×ª (×××¤×¦××× ××)" value={newNote.title} onChange={e=>setNewNote(p=>({...p,title:e.target.value}))}
style={{width:"100%",border:"none",borderBottom:"1.5px solid #b8e8cc",background:"transparent",fontSize:14,fontWeight:600,marginBottom:8,outline:"none",boxSizing:"border-box",padding:"4px 0"}}/>
<textarea placeholder="××ª×× ×¨×¢×××, ×ª××××¨×ª..." value={newNote.body} onChange={e=>setNewNote(p=>({...p,body:e.target.value}))}
style={{width:"100%",border:"none",background:"transparent",fontSize:13,minHeight:80,marginBottom:10,boxSizing:"border-box",outline:"none",padding:"4px 0",fontFamily:"inherit",resize:"vertical"}}/>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
<span style={{fontSize:11,color:"#3d7a55"}}>×¦××¢:</span>
{["#e8f4e8","#e8f0f8","#fdf6e8","#f8e8f0","#f0e8f8","#fdf0f0"].map(c=>(
<button key={c} onClick={()=>setNewNote(p=>({...p,color:c}))}
style={{width:20,height:20,borderRadius:"50%",background:c,border:newNote.color===c?"3px solid #334155":"2px solid #c8d4e0",cursor:"pointer",padding:0}}/>
))}
</div>
<button onClick={addNote} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ ×××¡×£ ×¨×©×××</button>
</div>
{(data.notes||[]).length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:30}}>××× ×¨×©××××ª ×¢××××</div>}
{(data.notes||[]).map(n=>(
<div key={n.id} style={{background:n.color||"#e8f4e8",borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 2px 8px rgba(0,0,0,.05)",border:"1px solid rgba(0,0,0,.05)"}}>
{editNote?.id===n.id ? (
<>
<input value={editNote.title} onChange={e=>setEditNote(p=>({...p,title:e.target.value}))}
style={{width:"100%",border:"none",borderBottom:"1.5px solid rgba(0,0,0,.15)",background:"transparent",fontSize:14,fontWeight:700,marginBottom:8,outline:"none",boxSizing:"border-box",padding:"2px 0",fontFamily:"inherit"}}/>
<textarea value={editNote.body} onChange={e=>setEditNote(p=>({...p,body:e.target.value}))}
style={{width:"100%",border:"none",background:"transparent",fontSize:13,minHeight:70,resize:"vertical",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
<div style={{display:"flex",gap:8,marginTop:10}}>
{["#e8f4e8","#e8f0f8","#fdf6e8","#f8e8f0","#f0e8f8","#fdf0f0"].map(c=>(
<button key={c} onClick={()=>setEditNote(p=>({...p,color:c}))}
style={{width:18,height:18,borderRadius:"50%",background:c,border:editNote.color===c?"3px solid #334155":"2px solid #c8d4e0",cursor:"pointer",padding:0}}/>
))}
<div style={{flex:1}}/>
<button onClick={()=>setEditNote(null)} style={{background:"rgba(0,0,0,.08)",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>×××××</button>
<button onClick={saveNoteEdit} style={{background:"rgba(0,0,0,.12)",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>×©×××¨</button>
</div>
</>
) : (
<>
{n.title&&<div style={{fontSize:14,fontWeight:700,marginBottom:4,color:"#334155"}}>{n.title}</div>}
<div style={{fontSize:13,color:"#374151",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.body}</div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
<span style={{fontSize:10,color:"rgba(0,0,0,.3)"}}>{new Date(n.createdAt).toLocaleDateString("he-IL")}</span>
<div style={{display:"flex",gap:6}}>
<button onClick={()=>setEditNote({...n})} style={{background:"rgba(0,0,0,.07)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>âï¸</button>
<button onClick={()=>sendNoteToTelegram(n)} title="×©×× ×××××¨×" style={{background:"rgba(0,136,204,.1)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:11,color:"#0088cc",cursor:"pointer"}}>ð¤</button>
<button onClick={()=>deleteNote(n.id)} style={{background:"rgba(224,112,112,.1)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:11,color:"#e07070",cursor:"pointer"}}>â</button>
</div>
</div>
</>
)}
</div>
))}
</>
)}

{/* ââ SETTINGS ââ */}
{view==="settings" && (
<>
<div style={{fontSize:15,fontWeight:700,marginBottom:14}}>××××¨××ª</div>
<div style={{background:`linear-gradient(135deg,${theme.exportGradA},${theme.exportGradB})`,borderRadius:16,padding:"16px 18px",marginBottom:16}}>
<div style={{color:"#fff",fontWeight:800,fontSize:14,marginBottom:10}}>ð ×××¦×× ×××§×¡×</div>
<div style={{display:"flex",gap:8,marginBottom:10}}>
{[["weekly","ð ×©×××¢×"],["monthly","ðï¸ ××××©×"]].map(([t,label])=>(
<button key={t} onClick={()=>setExportType(t)} style={{flex:1,background:exportType===t?"#fff":"rgba(255,255,255,.25)",color:exportType===t?theme.exportGradA:"#fff",border:"none",borderRadius:8,padding:"8px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
))}
</div>
{exportType==="weekly"?(
<select value={exportWeek} onChange={e=>setExportWeek(e.target.value)} style={{width:"100%",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:600,background:"rgba(255,255,255,.25)",color:"#fff",outline:"none",cursor:"pointer",marginBottom:10,boxSizing:"border-box"}}>
<option value={getWeekId()} style={{color:"#1e293b"}}>×©×××¢ ×× â {getWeekLabel(getWeekId())}</option>
{allWeeks.filter(w=>w!==getWeekId()).map(w=>(<option key={w} value={w} style={{color:"#1e293b"}}>{getWeekLabel(w)}</option>))}
</select>
):(
<select value={exportCycle} onChange={e=>setExportCycle(e.target.value)} style={{width:"100%",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:600,background:"rgba(255,255,255,.25)",color:"#fff",outline:"none",cursor:"pointer",marginBottom:10,boxSizing:"border-box"}}>
<option value={getCycleStart().toISOString().slice(0,10)} style={{color:"#1e293b"}}>×××××¨ × ×××× â {cycleLabel}</option>
{allCycles.filter(c=>c!==getCycleStart().toISOString().slice(0,10)).map(c=>(<option key={c} value={c} style={{color:"#1e293b"}}>{getCycleLabel(c)}</option>))}
</select>
)}
<button onClick={exportToExcel} style={{width:"100%",background:"#fff",color:theme.exportGradA,border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:800,cursor:"pointer"}}>
â¬ï¸ ×××¨× {exportType==="weekly"?"××× ×©×××¢×":"××× ××××©×"}
</button>
{exportType==="monthly"&&<div style={{fontSize:10,color:"rgba(255,255,255,.65)",marginTop:6,textAlign:"center"}}>××××: ×××¦×××ª + ×¡×× Â· ×¡×××× ×§××××¨×××ª Â· ×¤××¨×× ×©×××¢× Â· ××¤× ×××¦×¢× ×ª×©×××</div>}
</div>
<div style={cardStyle}>
<div style={{fontWeight:800,fontSize:14,marginBottom:12,color:theme.primary}}>ð² ××××¨×</div>
<div style={{fontSize:12,color:theme.subText,marginBottom:12}}>×©×× ××× ×©×××¢× ××§×××¦×ª ×××××¦××¤ ××¢×ª</div>
<button onClick={async()=>{try{await sendWeeklyReport(data.expenses||[],data.variableBuckets||[],getWeekBudget(getWeekId()));setToast({msg:"××× × ×©×× ×××××¨× â",color:"#5aa67d"});setTimeout(()=>setToast(null),3000);}catch(err){setToast({msg:"×©×××× ××©××××ª ××××",color:"#e07070"});setTimeout(()=>setToast(null),3000);}}} style={{width:"100%",background:theme.primary,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:800,cursor:"pointer"}}>ð ×©×× ××× ×©×××¢× ×××××¨×</button>
</div>
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>ð° ××§××¨××ª ××× ×¡×</div>
{(data.incomes||[]).length===0&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>××¨× ×××××¨× ××§××¨××ª ××× ×¡×</div>}
{(data.incomes||[]).map(inc=>(
<div key={inc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f1f5f9"}}>
<div style={{fontSize:13,fontWeight:600,color:"#334155"}}>{inc.label}</div>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:13,fontWeight:800,color:"#6bbf8e"}}>âª{Number(inc.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>deleteIncome(inc.id)} style={{background:"#fdf0f0",border:"none",color:"#e07070",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>×××§</button>
</div>
</div>
))}
{(data.incomes||[]).length>0&&(
<div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f1f5f9"}}>
<span style={{fontSize:12,color:"#64748b"}}>×¡×"×</span>
<span style={{fontSize:13,fontWeight:800,color:"#6bbf8e"}}>âª{totalMonthlyIncome.toLocaleString("he-IL")}</span>
</div>
)}
<div style={{marginTop:14,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
<div style={{fontSize:12,fontWeight:600,marginBottom:8,color:"#6b7a8d"}}>+ ×××¡×£ ××§××¨ ××× ×¡×</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<input placeholder="×©×" value={newIncome.label} onChange={e=>setNewIncome(p=>({...p,label:e.target.value}))} style={inputStyle}/>
<input type="number" placeholder="×¡××× âª" value={newIncome.amount} onChange={e=>setNewIncome(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
</div>
<button onClick={addIncome} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>×××¡×£</button>
</div>
</div>
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>ð³ ×××¦×¢× ×ª×©×××</div>
{(data.paymentMethods||[]).length===0&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>××¨× ×××××¨×</div>}
{(data.paymentMethods||[]).map(pm=>(
<div key={pm.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontSize:18}}>{PAYMENT_TYPE_ICONS[pm.type]}</span>
<div>
<div style={{fontSize:13,fontWeight:600}}>{pm.name}</div>
{pm.type==="card"&&<div style={{fontSize:11,color:"#94a3b8"}}>****{pm.digits}</div>}
{pm.type==="bank"&&<div style={{fontSize:11,color:"#94a3b8"}}>××¢××¨× ×× ×§×××ª</div>}
{pm.type==="cash"&&<div style={{fontSize:11,color:"#94a3b8"}}>×××××</div>}
</div>
</div>
<button onClick={()=>deletePM(pm.id)} style={{background:"#fdf0f0",border:"none",color:"#e07070",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>×××§</button>
</div>
))}
<div style={{marginTop:14,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
<div style={{fontSize:12,fontWeight:600,marginBottom:10,color:"#6b7a8d"}}>+ ×××¡×£</div>
<div style={{display:"flex",gap:8,marginBottom:10}}>
{[["card","ð³ ××¨×××¡"],["bank","ð¦ ×× ×§"],["cash","ðµ ×××××"]].map(([t,label])=>(
<button key={t} onClick={()=>setNewPM(p=>({...p,type:t,digits:""}))} style={{flex:1,background:newPM.type===t?theme.btnLight:"#f1f5f9",border:newPM.type===t?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:8,padding:"8px 4px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{label}</button>
))}
</div>
<div style={{display:"grid",gridTemplateColumns:newPM.type==="card"?"1fr 1fr":"1fr",gap:10,marginBottom:10}}>
<input placeholder={newPM.type==="card"?"×©× ××¨×××¡":newPM.type==="bank"?"×©× ×× ×§":"×©×"} value={newPM.name} onChange={e=>setNewPM(p=>({...p,name:e.target.value}))} style={inputStyle}/>
{newPM.type==="card"&&<input placeholder="4 ×¡×¤×¨××ª" maxLength={4} value={newPM.digits} onChange={e=>setNewPM(p=>({...p,digits:e.target.value.replace(/\D/g,"").slice(0,4)}))} style={inputStyle}/>}
</div>
<button onClick={addPaymentMethod} style={{width:"100%",background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>×××¡×£</button>
</div>
</div>
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:600,marginBottom:12}}>×¡×××× ×ª×§×¦××</div>
<div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>×××××¨: {cycleLabel} ({Math.round(daysLeft)} ×××× × ××ª×¨×)</div>
{[{l:"××× ×¡× ××××©××ª",v:totalMonthlyIncome,c:theme.incomeColor},{l:"×××¦×××ª ×§×××¢××ª",v:totalFixed,c:"#e8b87c"},{l:"×××¦×××ª ××©×ª× ××ª",v:totalVariableBudget,c:theme.acc},{l:"××¢×§× (××××/×××ª\"×)",v:totalVariableBudgetIncl-totalVariableBudget,c:"#a0b4c8"},{l:"× ×©××¨ ×× ××ª××§×¦×",v:totalMonthlyIncome-totalBudgetIncl,c:(totalMonthlyIncome-totalBudgetIncl)>=0?theme.incomeColor:"#e07070"}].map(x=>(
<div key={x.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
<span style={{fontSize:13,color:"#6b7a8d"}}>{x.l}</span>
<span style={{fontSize:13,fontWeight:700,color:x.c}}>âª{Number(x.v||0).toLocaleString("he-IL")}</span>
</div>
))}
</div>
{/* Theme picker */}
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>ð¨ ×¤×××ª ×¦××¢××</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
{Object.entries(THEMES).map(([key,t])=>(
<button key={key} onClick={()=>save({...data,theme:key})}
style={{background:`linear-gradient(135deg,${t.a},${t.b})`,border:(data.theme||"pastel")===key?"3px solid #fff":"3px solid transparent",borderRadius:12,padding:"12px 10px",cursor:"pointer",boxShadow:(data.theme||"pastel")===key?"0 0 0 3px "+t.b+", 0 4px 12px rgba(0,0,0,.15)":"none",transition:"all .2s"}}>
<div style={{color:"#fff",fontSize:12,fontWeight:700,textShadow:"0 1px 2px rgba(0,0,0,.2)"}}>{t.name}</div>
</button>
))}
</div>
</div>
<button onClick={()=>{ save({...data, monthlyIncome:null, incomes:[]}); showToast("××× ×¡××ª ×××¤×¡× â", "#6bbf8e"); }} style={{width:"100%",background:"#fdf6e8",color:theme.fixedText,border:`1.5px solid ${theme.fixedBg}`,borderRadius:10,padding:12,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8}}>ð ×××¤××¡ ××× ×¡××ª ××××</button>
<div style={{marginTop:20,borderTop:"1px solid #f1f5f9",paddingTop:16}}>
<div style={{fontSize:13,fontWeight:700,marginBottom:4,color:theme.acc}}>××¤×ª× Gemini API</div>
<div style={{fontSize:11,color:"#a3b8cc",marginBottom:10}}>× ××¨×© ×××××× ×××¦×××ª ××ª××× × ××××××××ª</div>
<div style={{display:"flex",gap:8}}>
<input type="password" value={geminiApiKey} onChange={e=>setGeminiApiKey(e.target.value)} placeholder="××××§ ××¤×ª× API" style={{flex:1,border:"1px solid #dde4ed",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}} />
<button onClick={()=>{localStorage.setItem("gemini_api_key",geminiApiKey);showToast("××¤×ª× × ×©××¨","#6a9bc3");}} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer",flexShrink:0}}>×©×××¨</button>
</div>
</div>
<button onClick={()=>{setResetPin("");setResetError(false);setResetDialog(true);}} style={{width:"100%",background:"#FAF0F0",color:"#e07070",border:"1.5px solid #f5c6c6",borderRadius:10,padding:12,fontSize:13,fontWeight:700,cursor:"pointer"}}>ðï¸ ×××¤××¡ ×× ×× ×ª×× ××</button>
</>
)}
</div>
{/* FAB */}
{view!=="add-expense"&&view!=="savings"&&view!=="notes"&&view!=="analytics"&&(
<button onClick={()=>setView("add-expense")} style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${theme.btn},${theme.a})`,color:"#fff",border:"none",borderRadius:50,padding:"14px 30px",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 6px 24px ${theme.btn}44`,zIndex:50,whiteSpace:"nowrap"}}>
+ ×¨×©×× ×××¦××
</button>
)}

{/* OCR FAB - on analytics */}
{view==="analytics"&&(
<button onClick={()=>{ setShowOcrModal(true); setOcrImage(null); setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false},{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false},{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]); }}
style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${theme.btn},${theme.a})`,color:"#fff",border:"none",borderRadius:50,padding:"14px 24px",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:`0 6px 24px ${theme.btn}44`,zIndex:50,whiteSpace:"nowrap"}}>
ð· ××¢×× ×ª××× ×
</button>
)}

{/* Reset dialog */}
{resetDialog&&(
<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
<div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:320,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
<div style={{fontSize:22,textAlign:"center",marginBottom:8}}>ð</div>
<div style={{fontSize:15,fontWeight:800,textAlign:"center",color:"#334155",marginBottom:4}}>×××¤××¡ × ×ª×× ××</div>
<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",marginBottom:20}}>×¤×¢××× ×× ×ª×××§ ××ª ×× ×× ×ª×× ××</div>
<input type="password" placeholder="×¡××¡×× ××××©××¨" value={resetPin} onChange={e=>{setResetPin(e.target.value);setResetError(false);}}
style={{width:"100%",border:resetError?"2px solid #e07070":"1.5px solid #dde4ed",borderRadius:10,padding:"12px",fontSize:16,textAlign:"center",outline:"none",boxSizing:"border-box",marginBottom:6,letterSpacing:4}} autoFocus/>
{resetError&&<div style={{fontSize:11,color:"#e07070",textAlign:"center",marginBottom:10}}>×¡××¡×× ×©××××</div>}
{!resetError&&<div style={{marginBottom:10}}/>}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<button onClick={()=>setResetDialog(false)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>×××××</button>
<button onClick={()=>{if(resetPin==="1003"){localStorage.removeItem(STORAGE_KEY);setData(DEFAULT_STATE);setResetDialog(false);setResetPin("");showToast("×× ×ª×× ×× ×××¤×¡×","#e07070");}else{setResetError(true);setResetPin("");}}}
style={{background:"#e07070",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>××¤×¡</button>
</div>
</div>
</div>
)}

{/* Add/Edit expense sheet */}
{(view==="add-expense"||editExpense)&&(
<div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderRadius:"20px 20px 0 0",padding:24,boxShadow:"0 -8px 40px rgba(0,0,0,.1)",zIndex:100,maxWidth:480,margin:"0 auto"}}>
<div style={{width:36,height:4,background:"#dde4ed",borderRadius:2,margin:"0 auto 20px"}}/>
<div style={{fontSize:16,fontWeight:700,marginBottom:16}}>{editExpense?"âï¸ ×¢×¨×××ª ×××¦××":"×¨××©×× ×××¦××"}</div>
{(()=>{
const exp = editExpense || newExpense;
const setExp = editExpense ? (fn) => setEditExpense(prev => fn(prev)) : (fn) => setNewExpense(prev => fn(prev));
return (<>
<select value={exp.bucketId} onChange={e=>setExp(p=>({...p,bucketId:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
<option value="">×××¨ ×§××××¨××</option>
{data.variableBuckets.length>0&&<optgroup label="××©×ª× ××ª">{data.variableBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
{data.fixedBuckets.length>0&&<optgroup label="×§×××¢××ª">{data.fixedBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
</select>
{(data.paymentMethods||[]).length>0&&(
<select value={exp.paymentMethodId} onChange={e=>setExp(p=>({...p,paymentMethodId:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
<option value="">×××¦×¢× ×ª×©××× (×××¤×¦××× ××)</option>
{data.paymentMethods.map(pm=>(<option key={pm.id} value={pm.id}>{pm.type==="card"?`ð³ ${pm.name} ****${pm.digits}`:pm.type==="bank"?`ð¦ ${pm.name}`:`ðµ ${pm.name}`}</option>))}
</select>
)}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
<input type="number" placeholder="×¡××× âª" value={exp.amount} onChange={e=>setExp(p=>({...p,amount:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
<input type="date" value={exp.date} onChange={e=>setExp(p=>({...p,date:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
</div>
<input placeholder="××¢×¨× (×××¤×¦××× ××)" value={exp.note} onChange={e=>setExp(p=>({...p,note:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,fontSize:14,boxSizing:"border-box"}}/>
<div onClick={()=>setExp(p=>({...p,recurring:!p.recurring}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:14,background:exp.recurring?"#edf7f1":"#f4f7fb",border:exp.recurring?"1.5px solid #a8d5ba":"1.5px solid #dde4ed",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>ð</span>
<span style={{fontSize:12,fontWeight:600,color:exp.recurring?"#3d7a55":"#6b7a8d",flex:1}}>×××¦×× ×××××¨××ª â ×ª××××¨ ×× ××××© ××××××××ª</span>
<div style={{width:32,height:18,background:exp.recurring?"#6bbf8e":"#dde4ed",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:exp.recurring?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<button onClick={()=>{editExpense?setEditExpense(null):setView("dashboard");}} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:600,cursor:"pointer"}}>×××××</button>
<button onClick={()=>{editExpense?saveExpenseEdit():addExpense();}} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:"pointer"}}>{editExpense?"×¢×××":"×©×××¨"}</button>
</div>
</>);
})()}
</div>
)}

{/* Day expenses popup */}
{selectedDay&&(
<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
onClick={e=>{if(e.target===e.currentTarget)setSelectedDay(null);}}>
<div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"70vh",overflowY:"auto",padding:"20px 20px 32px"}}>
<div style={{width:36,height:4,background:"#dde4ed",borderRadius:2,margin:"0 auto 16px"}}/>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
<div>
<div style={{fontSize:15,fontWeight:800,color:"#334155"}}>{new Date(selectedDay.ds).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})}</div>
<div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>×¡×"×: âª{selectedDay.daySpend.toLocaleString("he-IL")}</div>
</div>
<button onClick={()=>setSelectedDay(null)} style={{background:"#f1f5f9",border:"none",borderRadius:10,width:32,height:32,fontSize:16,cursor:"pointer",color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>â</button>
</div>
{selectedDay.expenses.length===0
?<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:24}}>××× ×××¦×××ª ×××× ××</div>
:<div>
{selectedDay.expenses.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
<div style={{flex:1}}>
<div style={{fontSize:13,fontWeight:700,color:"#334155"}}>{getBucketName(e.bucketId)}</div>
{e.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{e.note}</div>}
<div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
<span style={{fontSize:10,background:fixedBucketIds.has(e.bucketId)?"#fdf6e8":"#eef4fb",color:fixedBucketIds.has(e.bucketId)?"#b07020":"#4a7fa5",padding:"1px 5px",borderRadius:3}}>{fixedBucketIds.has(e.bucketId)?"×§×××¢×":"××©×ª× ×"}</span>
{e.paymentMethodId&&<span style={{fontSize:10,color:theme.acc}}>{getPMLabel(e.paymentMethodId)}</span>}
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8,marginRight:4}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:15}}>âª{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>{setEditExpense({...e});setSelectedDay(null);}} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"3px 7px",cursor:"pointer",fontSize:11}}>âï¸</button>
</div>
</div>
))}
<div style={{marginTop:14,padding:"10px 14px",background:theme.light,borderRadius:10,display:"flex",justifyContent:"space-between"}}>
<span style={{fontSize:12,color:"#64748b"}}>×¡×"× ×××</span>
<span style={{fontSize:13,fontWeight:800,color:theme.acc}}>âª{selectedDay.daySpend.toLocaleString("he-IL")}</span>
</div>
</div>}
</div>
</div>
)}

{/* OCR Modal */}
{showOcrModal&&(
<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
<div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",padding:20}}>
<div style={{width:36,height:4,background:"#dde4ed",borderRadius:2,margin:"0 auto 16px"}}/>
<div style={{fontSize:16,fontWeight:700,marginBottom:12}}>ð· ××¢×××ª ×ª××× × ×××¨×××¡ ××©×¨××</div>
{!ocrImage?(
<>
<div style={{border:"2px dashed "+theme.btn,borderRadius:12,padding:"30px 20px",textAlign:"center",marginBottom:16,cursor:"pointer",background:theme.light}} onClick={()=>ocrFileRef.current?.click()}>
<div style={{fontSize:32,marginBottom:8}}>ð</div>
<div style={{fontSize:13,color:theme.acc,fontWeight:600}}>×××¥ ×××¢×××ª ×ª××× ×</div>
<div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>JPG, PNG, PDF</div>
</div>
<input ref={ocrFileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>handleOcrUpload(e.target.files[0])}/>
</>
):(
<>
<img src={ocrImage} style={{width:"100%",borderRadius:10,marginBottom:12,maxHeight:200,objectFit:"cover"}} alt="credit card statement"/>
<div style={{fontSize:12,color:"#6b7a8d",marginBottom:12}}>×¡×× ××ª ××××¦×××ª ×©××¨×¦×× × ××××¡××£ ×××× ×¤×¨×××:</div>
{ocrResults.map((r,i)=>(
<div key={i} style={{border:`1.5px solid ${r.confirmed?theme.btn:"#dde4ed"}`,borderRadius:10,padding:"10px 12px",marginBottom:8,background:r.confirmed?theme.light:"#fff"}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
<input type="checkbox" checked={r.confirmed} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,confirmed:e.target.checked}:x))} style={{width:16,height:16}}/>
<span style={{fontSize:12,fontWeight:700,color:r.confirmed?theme.acc:"#94a3b8"}}>×××¦×× {i+1}</span>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<input type="number" placeholder="×¡××× âª" value={r.amount} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,amount:e.target.value}:x))} style={{...inputStyle,fontSize:13}}/>
<input type="date" value={r.date} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,date:e.target.value}:x))} style={{...inputStyle,fontSize:13}}/>
</div>
<select value={r.bucketId} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,bucketId:e.target.value}:x))} style={{...inputStyle,width:"100%",marginBottom:8,boxSizing:"border-box",fontSize:13}}>
<option value="">×§××××¨××</option>
{data.variableBuckets.length>0&&<optgroup label="××©×ª× ××ª">{data.variableBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
{data.fixedBuckets.length>0&&<optgroup label="×§×××¢××ª">{data.fixedBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
</select>
<input placeholder="××¢×¨×" value={r.note} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,note:e.target.value}:x))} style={{...inputStyle,width:"100%",boxSizing:"border-box",fontSize:13}}/>
</div>
))}
<button onClick={()=>setOcrResults(p=>[...p,{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}])}
style={{width:"100%",background:"#f4f7fb",color:"#6b7a8d",border:"1.5px solid #dde4ed",borderRadius:8,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:10}}>
+ ×××¡×£ ×©××¨×
</button>
</>
)}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}}>
<button onClick={()=>{setShowOcrModal(false);setOcrImage(null);setOcrResults([]);}} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:600,cursor:"pointer"}}>×××××</button>
{ocrImage&&<button onClick={confirmOcrExpenses} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:"pointer"}}>××©×¨ ×××¦×××ª</button>}
</div>
</div>
</div>
)}
</div>
);
}
