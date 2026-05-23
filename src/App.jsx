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
theme: "pastel",
notes: [],
savingsSnapshot: [],
};

// ── PASTEL THEMES ──────────────────────────────────────────────────────────
const THEMES = {
pastel: {
name:"פסטל 🌸", a:"#b5c9e8", b:"#8fb3d9",
acc:"#6a9bc3", light:"#eef4fb", navActive:"#6a9bc3",
btn:"#6a9bc3", btnLight:"#daeaf7",
savingsA:"#a8d5ba", savingsB:"#6bbf8e",
fixedBg:"#fef4e4", fixedText:"#b07d3a", fixedSub:"#c8934a",
varBg:"#eef4fb", varText:"#4a7fa5", varSub:"#6a9bc3",
incomeColor:"#6bbf8e", expColor:"#e8b87c", surplusColor:"#6a9bc3",
exportGradA:"#7ab89a", exportGradB:"#5aa67d", exportAccent:"#5aa67d",
incomeAcc:"#6bbf8e",
},
lavender: {
name:"לבנדר 💜", a:"#c4b5e8", b:"#a08dd4",
acc:"#8b6fc7", light:"#f3f0fb", navActive:"#8b6fc7",
btn:"#8b6fc7", btnLight:"#e5ddf7",
savingsA:"#b5c9e8", savingsB:"#6a9bc3",
fixedBg:"#fef4fb", fixedText:"#8b4d9e", fixedSub:"#a05aab",
varBg:"#f3f0fb", varText:"#5e3f99", varSub:"#8b6fc7",
incomeColor:"#8b6fc7", expColor:"#e8b87c", surplusColor:"#7a5ec0",
exportGradA:"#7a5ec0", exportGradB:"#a08dd4", exportAccent:"#8b6fc7",
incomeAcc:"#8b6fc7",
},
mint: {
name:"מנטה 🌿", a:"#a8d5ba", b:"#6bbf8e",
acc:"#4aab72", light:"#edf7f1", navActive:"#4aab72",
btn:"#4aab72", btnLight:"#c8eeda",
savingsA:"#6bbf8e", savingsB:"#3d9960",
fixedBg:"#fef9e4", fixedText:"#8a7a20", fixedSub:"#a09030",
varBg:"#edf7f1", varText:"#2d7a50", varSub:"#4aab72",
incomeColor:"#4aab72", expColor:"#e8b87c", surplusColor:"#3d9960",
exportGradA:"#3d9960", exportGradB:"#6bbf8e", exportAccent:"#4aab72",
incomeAcc:"#4aab72",
},
peach: {
name:"אפרסק 🍑", a:"#f0c4a8", b:"#e89c72",
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
name:"שמים ☁️", a:"#aed4f0", b:"#78b8e8",
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
name:"ורוד 🌷", a:"#f0b5c4", b:"#e88aa0",
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

function fmt(d) { return d.toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit" }); }
function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Billing cycle helpers ────────────────────────────────────────────────
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

// ── Recurring expense helper: should it auto-add this cycle? ─────────────
function shouldAddRecurringThisCycle(expense, cycleStartStr) {
if (!expense.recurring) return false;
const expCycleStr = getCycleStart(new Date(expense.date)).toISOString().slice(0,10);
return expCycleStr <= cycleStartStr;
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
setData(next);
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
clearTimeout(window._supabaseSaveTimer);
window._supabaseSaveTimer = setTimeout(() => {
setSyncing(true);
saveToSupabase(next).then(() => {
setSyncing(false);
setLastSync(new Date());
});
}, 1500);
}, []);

const showToast = (msg, color = "#5aa67d") => {
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

// ── Income ────────────────────────────────────────────────────────────────
const totalMonthlyIncome = (data.incomes||[]).reduce((s,x)=>s+Number(x.amount||0),0) + Number(data.monthlyIncome||0);

const activeFixed = (data.fixedBuckets||[]).filter(b => !b.isInstallment || getInstallmentsRemaining(b) > 0);
const totalFixed = activeFixed.reduce((s,b) => s + getMonthlyAmount(b), 0);
const totalVariableBudget = data.variableBuckets.filter(b=>!b.trackingOnly).reduce((s,b) => s + Number(b.amount||0), 0);
const totalBudget = totalFixed + totalVariableBudget;
const remaining = totalMonthlyIncome - totalBudget;

// ── trackingOnly buckets include food & unexpected ─────────────────────
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

// ── Automatic dynamic weekly budget ──────────────────────────────────────
// Budget this week = (monthly variable budget - already spent in past completed weeks - fixed overflow) / weeks remaining
const currentWeekId = getWeekId();
const allCycleWeekIds = (() => {
const weeks = []; let cur = new Date(cycleStart);
while (cur <= cycleEnd) { weeks.push(getWeekId(cur)); cur.setDate(cur.getDate()+7); }
return [...new Set(weeks)];
})();
const pastCycleWeekIds = allCycleWeekIds.filter(w => w < currentWeekId);
const spentInPastCycleWeeks = pastCycleWeekIds.reduce((total, wid) => {
return total + data.expenses.filter(e => getWeekId(e.date)===wid && inCurrentCycle(e.date) && variableBucketIds.has(e.bucketId) && !trackingOnlyIds.has(e.bucketId)).reduce((s,e)=>s+Number(e.amount||0),0);
}, 0);
const weeksRemainingInCycle = allCycleWeekIds.filter(w => w >= currentWeekId).length;
const dynamicWeeklyBudget = Math.max(0, (totalVariableOnBudget - spentInPastCycleWeeks - fixedOverflowThisMonth) / Math.max(1, weeksRemainingInCycle));
const weeklyFixedOverflowPenalty = fixedOverflowThisMonth / Math.max(1, weeksRemainingInCycle);
// For a selected past week: proportional share based on days in cycle
const getWeekBudget = (weekId) => {
if (weekId >= currentWeekId) return dynamicWeeklyBudget;
const wStart = new Date(weekId); const wEnd = new Date(weekId); wEnd.setDate(wEnd.getDate()+6);
const overlapStart = wStart < cycleStart ? cycleStart : wStart;
const overlapEnd = wEnd > cycleEnd ? cycleEnd : wEnd;
const daysInCycle = Math.max(0, (overlapEnd - overlapStart) / 86400000 + 1);
return totalVariableOnBudget * (daysInCycle / cycleTotalDays);
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

// ── Analytics ─────────────────────────────────────────────────────────────
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
return { csStr, label: fmt2(cs)+"–"+fmt2(ce), total, budget: totalVariableBudgetIncl, byBucket };
});

const alerts = [];
data.variableBuckets.filter(b=>!b.trackingOnly).forEach(b => {
const monthlyBudgetB = Number(b.amount);
const monthlySpentB = data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const elapsedFraction = daysElapsed / cycleTotalDays;
const expectedByNow = monthlyBudgetB * elapsedFraction;
const pctOfMonth = monthlyBudgetB > 0 ? monthlySpentB / monthlyBudgetB : 0;
const pctOfExpected = expectedByNow > 0 ? monthlySpentB / expectedByNow : 0;
if (pctOfMonth >= 1) alerts.push({ type:"danger", msg:`${ICONS[b.icon]} ${b.name}: חרגת מהתקציב החודשי ב-₪${Math.round(monthlySpentB-monthlyBudgetB).toLocaleString("he-IL")}` });
else if (pctOfExpected >= 1.4 && pctOfMonth >= 0.6) alerts.push({ type:"warn", msg:`${ICONS[b.icon]} ${b.name}: קצב מהיר — ${Math.round(pctOfMonth*100)}% מהתקציב החודשי נוצל` });
else if (pctOfMonth >= 0.8) alerts.push({ type:"warn", msg:`${ICONS[b.icon]} ${b.name}: השתמשת ב-${Math.round(pctOfMonth*100)}% מהתקציב החודשי` });
});
if (fixedOverflowThisMonth > 0) alerts.push({ type:"warn", msg:`⚠️ חריגה בהוצאות קבועות: ₪${Math.round(fixedOverflowThisMonth).toLocaleString("he-IL")} החודש` });
if (projectedSavings < 0) alerts.push({ type:"danger", msg:`📉 בקצב הנוכחי גירעון צפוי של ₪${Math.round(Math.abs(projectedSavings)).toLocaleString("he-IL")} החודש` });
else if (projectedSavings > totalMonthlyIncome * 0.1) alerts.push({ type:"good", msg:`✓ חיסכון צפוי ₪${Math.round(projectedSavings).toLocaleString("he-IL")} החודש (עודף + משתנות לא מנוצלות)` });

const getBucketName = (id) => { const b=[...data.fixedBuckets,...data.variableBuckets].find(b=>b.id===id); return b?`${ICONS[b.icon]||"📌"} ${b.name}`:"—"; };
const getBucketType = (id) => { if (fixedBucketIds.has(id)) return "קבועה"; if (variableBucketIds.has(id)) return "משתנה"; return "—"; };
const getPMLabel = (id) => { if(!id) return "—"; const pm=(data.paymentMethods||[]).find(p=>p.id===id); if(!pm) return "—"; return pm.type==="card"?`💳 ${pm.name} ****${pm.digits}`:pm.type==="bank"?`🏦 ${pm.name}`:`💵 ${pm.name}`; };
// ── Handlers ──────────────────────────────────────────────────────────────
const addBucket = (type) => {
if (type === "fixed" && newBucket.isInstallment) {
if (!newBucket.name || !newBucket.totalAmount || !newBucket.installmentsLeft)
return showToast("נא למלא שם, סכום כולל ומספר תשלומים", "#e07070");
const bucket = { id: uid(), name: newBucket.name, icon: newBucket.icon, isInstallment: true,
totalAmount: Number(newBucket.totalAmount), installmentsLeft: Number(newBucket.installmentsLeft),
amount: Number(newBucket.totalAmount)/Number(newBucket.installmentsLeft),
createdAt: cycleStart.toISOString().slice(0,10) };
save({ ...data, fixedBuckets: [...data.fixedBuckets, bucket] });
setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"", isRecurring:false });
return showToast("תשלומים נוספו ✓");
}
// Check for recurring fixed expense
if (type === "fixed" && newBucket.isRecurring) {
if (!newBucket.name || !newBucket.amount) return showToast("נא למלא שם וסכום", "#e07070");
const bucket = { id: uid(), name: newBucket.name, amount: Number(newBucket.amount), icon: newBucket.icon, isRecurring: true };
save({ ...data, fixedBuckets: [...data.fixedBuckets, bucket] });
setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"", isRecurring:false });
return showToast("הוצאה קבועה מחזורית נוספה ✓");
}
if (!newBucket.name || !newBucket.amount) return showToast("נא למלא שם וסכום", "#e07070");
const bucket = { id: uid(), name: newBucket.name, amount: Number(newBucket.amount), icon: newBucket.icon, ...(type==="variable"?{trackingOnly:!!newBucket.trackingOnly}:{}) };
const key = type==="fixed"?"fixedBuckets":"variableBuckets";
save({ ...data, [key]: [...data[key], bucket] });
setNewBucket({ name:"", amount:"", icon:"misc", isInstallment:false, installmentsLeft:"", totalAmount:"", isRecurring:false });
showToast("באקט נוסף ✓");
};

const saveBucketEdit = () => {
if (!editBucket.name || !editBucket.amount) return showToast("נא למלא שם וסכום", "#e07070");
const key = editBucket.type==="fixed"?"fixedBuckets":"variableBuckets";
save({ ...data, [key]: data[key].map(b=>b.id===editBucket.id?{...b, name:editBucket.name, amount:Number(editBucket.amount), icon:editBucket.icon, ...(editBucket.type==="variable"?{trackingOnly:!!editBucket.trackingOnly}:{}), ...(editBucket.type==="fixed"?{isRecurring:!!editBucket.isRecurring, isSavings:!!editBucket.isSavings}:{})}:b) });
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
if (!newExpense.bucketId || !newExpense.amount) return showToast("נא לבחור קטגוריה וסכום", "#e07070");
const expense = { id:uid(), ...newExpense, amount:Number(newExpense.amount), createdAt:Date.now() };
save({ ...data, expenses:[...data.expenses, expense] });
setNewExpense({ bucketId:"", amount:"", note:"", date:new Date().toISOString().slice(0,10), paymentMethodId:"" });
showToast("הוצאה נרשמה ✓"); setView("dashboard");
};

const saveExpenseEdit = () => {
if (!editExpense.bucketId || !editExpense.amount) return showToast("נא לבחור קטגוריה וסכום", "#e07070");
save({ ...data, expenses: data.expenses.map(e => e.id===editExpense.id ? {...e, ...editExpense, amount:Number(editExpense.amount)} : e) });
setEditExpense(null); showToast("הוצאה עודכנה ✓");
};

const deleteExpense = (id) => save({ ...data, expenses:data.expenses.filter(e=>e.id!==id) });

const addPaymentMethod = () => {
if (!newPM.name) return showToast("נא להזין שם", "#e07070");
if (newPM.type==="card" && !/^\d{4}$/.test(newPM.digits)) return showToast("נא להזין 4 ספרות אחרונות", "#e07070");
const pm = { id:uid(), type:newPM.type, name:newPM.name, digits:newPM.digits };
save({ ...data, paymentMethods:[...(data.paymentMethods||[]), pm] });
setNewPM({ type:"card", name:"", digits:"" }); showToast("אמצעי תשלום נוסף ✓");
};
const deletePM = (id) => save({ ...data, paymentMethods:data.paymentMethods.filter(p=>p.id!==id) });

const addIncome = () => {
if (!newIncome.label || !newIncome.amount) return showToast("נא למלא שם וסכום", "#e07070");
const inc = { id: uid(), label: newIncome.label, amount: Number(newIncome.amount) };
save({ ...data, incomes: [...(data.incomes||[]), inc] });
setNewIncome({ label: "", amount: "" });
showToast("מקור הכנסה נוסף ✓");
};
const deleteIncome = (id) => save({ ...data, incomes: (data.incomes||[]).filter(x=>x.id!==id) });

const addSaving = () => {
if (!newSaving.amount) return showToast("נא להזין סכום", "#e07070");
const s = { id:uid(), ...newSaving, amount:Number(newSaving.amount), createdAt:Date.now() };
save({ ...data, savings:[...(data.savings||[]), s] });
setNewSaving({ channel:"bank", amount:"", note:"", date:new Date().toISOString().slice(0,10) });
showToast("חסכון נרשם ✓");
};
const deleteSaving = (id) => save({ ...data, savings:(data.savings||[]).filter(s=>s.id!==id) });
const totalSavings = (data.savings||[]).reduce((s,x)=>s+Number(x.amount),0);

const addSnapshotItem = () => {
if (!newSnapshotItem.name || !newSnapshotItem.balance) return showToast("נא למלא שם ויתרה", "#e07070");
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
if (!newNote.body.trim()) return showToast("נא לכתוב משהו", "#e8b87c");
const n = { id:uid(), title:newNote.title, body:newNote.body, color:newNote.color, createdAt:Date.now(), updatedAt:Date.now() };
save({ ...data, notes:[n, ...(data.notes||[])] });
setNewNote({ title:"", body:"", color:"#e8f4e8" });
showToast("רשומה נשמרה ✓");
};
const deleteNote = (id) => save({ ...data, notes:(data.notes||[]).filter(n=>n.id!==id) });
const saveNoteEdit = () => {
save({ ...data, notes:(data.notes||[]).map(n=>n.id===editNote.id?{...n,...editNote,updatedAt:Date.now()}:n) });
setEditNote(null); showToast("רשומה עודכנה ✓");
};

// ── Weekly redistribution is now fully automatic via dynamic budget ──

const theme = THEMES[data.theme||"pastel"] || THEMES.pastel;

// ── OCR handling ────────────────────────────────────────────────────────
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
      showToast("אנא הגדר מפתח Gemini בהגדרות", "#e07070");
      setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]);
      setOcrLoading(false);
      return;
    }
    try {
      showToast("מעבד תמונה...", "#6a9bc3");
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
        showToast("לא זוהו הוצאות בתמונה", "#e07070");
        setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]);
      } else {
        setOcrResults(parsed.map(r => ({amount:String(r.amount||""),date:r.date||new Date().toISOString().slice(0,10),note:r.note||r.merchant||"",bucketId:"",confirmed:true})));
      }
    } catch(err) {
      showToast("שגיאת API", "#e07070");
      setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]);
    }
    setOcrLoading(false);
  };
  reader.readAsDataURL(file);
};

const confirmOcrExpenses = () => {
const toAdd = ocrResults.filter(r => r.confirmed && r.amount && r.bucketId);
if (toAdd.length === 0) return showToast("לא סומנו הוצאות לאישור", "#e8b87c");
const newExpenses = toAdd.map(r => ({ id:uid(), bucketId:r.bucketId, amount:Number(r.amount), note:r.note||"", date:r.date, paymentMethodId:"", createdAt:Date.now() }));
save({ ...data, expenses: [...data.expenses, ...newExpenses] });
setShowOcrModal(false);
setOcrImage(null);
setOcrResults([]);
showToast(`${newExpenses.length} הוצאות נוספו ✓`);
};

// ── Export ────────────────────────────────────────────────────────────────
const allCycles = [...new Set(data.expenses.map(e => getCycleStart(new Date(e.date)).toISOString().slice(0,10)))].sort().reverse();
const getCycleLabel = (isoStr) => { const cs=new Date(isoStr); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9); return `${fmt2(cs)} – ${fmt2(ce)}`; };

const exportToExcel = () => {
const isMonthly = exportType === "monthly";
const periodExpenses = isMonthly
? data.expenses.filter(e => { const d=new Date(e.date); d.setHours(0,0,0,0); const cs=new Date(exportCycle); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9); return d>=cs&&d<=ce; })
: data.expenses.filter(e => getWeekId(e.date)===exportWeek);
if (periodExpenses.length===0) return showToast("אין הוצאות לתקופה זו", "#e8b87c");
const wb = XLSX.utils.book_new();
// Sheet 1: expenses with fixed/variable column
const expRows = periodExpenses.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(e=>({
"תאריך":e.date,
"קטגוריה":getBucketName(e.bucketId).replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g,"").trim(),
"סוג הוצאה":getBucketType(e.bucketId),
"סכום ₪":Number(e.amount),
"אמצעי תשלום":getPMLabel(e.paymentMethodId).replace(/[^\u0590-\u05FFa-zA-Z0-9\s*]/g,"").trim(),
"הערה":e.note||"",
}));
const wsExp=XLSX.utils.json_to_sheet(expRows,{header:["תאריך","קטגוריה","סוג הוצאה","סכום ₪","אמצעי תשלום","הערה"]});
wsExp["!cols"]=[{wch:12},{wch:18},{wch:12},{wch:10},{wch:22},{wch:20}];
XLSX.utils.book_append_sheet(wb,wsExp,"הוצאות");
// Sheet 2: bucket summary
const totalSpent=periodExpenses.reduce((s,e)=>s+Number(e.amount),0);
const budgetRef=isMonthly?totalVariableBudgetIncl:weeklyVariableBudget;
const budgetCol=isMonthly?"תקציב חודשי ₪":"תקציב שבועי ₪";
const bSum=data.variableBuckets.map(b=>{
const spent=periodExpenses.filter(e=>e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const bud=isMonthly?Number(b.amount):Number(b.amount)/weeksInMonth;
return {"קטגוריה":b.name,"סוג":"משתנה",[budgetCol]:Math.round(bud),"הוצאה בפועל ₪":spent,"נשאר ₪":Math.round(bud-spent),"אחוז ניצול":bud>0?Math.round((spent/bud)*100)+"%":"—"};
});
// Add fixed buckets to summary
activeFixed.forEach(b=>{
const spent=periodExpenses.filter(e=>e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0);
const bud=isMonthly?getMonthlyAmount(b):getMonthlyAmount(b)/weeksInMonth;
bSum.push({"קטגוריה":b.name,"סוג":"קבועה",[budgetCol]:Math.round(bud),"הוצאה בפועל ₪":spent,"נשאר ₪":Math.round(bud-spent),"אחוז ניצול":bud>0?Math.round((spent/bud)*100)+"%":"—"});
});
bSum.push({"קטגוריה":"סה\"כ","סוג":"",[budgetCol]:Math.round(budgetRef+totalFixed),"הוצאה בפועל ₪":Math.round(totalSpent),"נשאר ₪":Math.round(budgetRef+totalFixed-totalSpent),"אחוז ניצול":(budgetRef+totalFixed)>0?Math.round((totalSpent/(budgetRef+totalFixed))*100)+"%":"—"});
const wsS=XLSX.utils.json_to_sheet(bSum,{header:["קטגוריה","סוג",budgetCol,"הוצאה בפועל ₪","נשאר ₪","אחוז ניצול"]});
wsS["!cols"]=[{wch:18},{wch:10},{wch:16},{wch:16},{wch:12},{wch:14}];
XLSX.utils.book_append_sheet(wb,wsS,"סיכום קטגוריות");
if (isMonthly) {
const cs=new Date(exportCycle); const ce=new Date(cs); ce.setMonth(ce.getMonth()+1); ce.setDate(9);
const weeks=[]; let cur=new Date(cs);
while(cur<=ce){const wid=getWeekId(cur);if(!weeks.includes(wid))weeks.push(wid);cur.setDate(cur.getDate()+7);}
const wRows=weeks.map(wid=>{const wE=periodExpenses.filter(e=>getWeekId(e.date)===wid);return{"שבוע":getWeekLabel(wid),"הוצאות ₪":wE.reduce((s,e)=>s+Number(e.amount),0),"מספר עסקאות":wE.length};});
const wsW=XLSX.utils.json_to_sheet(wRows,{header:["שבוע","הוצאות ₪","מספר עסקאות"]});wsW["!cols"]=[{wch:22},{wch:14},{wch:16}];
XLSX.utils.book_append_sheet(wb,wsW,"פירוט שבועי");
}
const pmS=(data.paymentMethods||[]).map(pm=>{const pmE=periodExpenses.filter(e=>e.paymentMethodId===pm.id);return{"אמצעי תשלום":pm.type==="card"?`${pm.name} ****${pm.digits}`:pm.name,"מספר עסקאות":pmE.length,"סה\"כ ₪":pmE.reduce((s,e)=>s+Number(e.amount),0)};});
const utag=periodExpenses.filter(e=>!e.paymentMethodId);
if(utag.length>0)pmS.push({"אמצעי תשלום":"לא מוגדר","מספר עסקאות":utag.length,"סה\"כ ₪":utag.reduce((s,e)=>s+Number(e.amount),0)});
if(pmS.length>0){const wsPM=XLSX.utils.json_to_sheet(pmS,{header:["אמצעי תשלום","מספר עסקאות","סה\"כ ₪"]});wsPM["!cols"]=[{wch:24},{wch:16},{wch:12}];XLSX.utils.book_append_sheet(wb,wsPM,"לפי אמצעי תשלום");}
XLSX.writeFile(wb,isMonthly?`הוצאות_חודשי_${exportCycle}.xlsx`:`הוצאות_שבועי_${exportWeek}.xlsx`);
showToast("קובץ אקסל הורד ✓");
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
<div style={{ color:"#fff", fontSize:22, fontWeight:800, marginBottom:6 }}>הכספת המשפחתית</div>
<div style={{ color:"#bee3f8", fontSize:13, marginBottom:32 }}>הזן קוד כניסה</div>
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
⌫
</button>
</div>
</div>
);

const pct = (val,max) => Math.min(100, max>0?(val/max)*100:0);
const weekPct = pct(spentThisWeek, weeklyVariableBudget);
const barColor = weekPct>90?"#e07070":weekPct>70?"#e8b87c":"#6bbf8e";
const hasFixedOverflow = fixedOverflowThisMonth > 0;
const inputStyle = { border:"1.5px solid #dde4ed", borderRadius:10, padding:"10px 12px", fontSize:13, outline:"none", background:"#fff" };
const cardStyle = { background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 6px rgba(0,0,0,.06)" };
return (
<div style={{ fontFamily:"'Segoe UI',sans-serif", direction:"rtl", background:"#f4f7fb", minHeight:"100vh", maxWidth:480, margin:"0 auto", paddingBottom:90 }}
onClick={e=>{ if(showWeekPicker && !e.target.closest('[data-weekpicker]')) setShowWeekPicker(false); }}>

{toast && <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background:toast.color, color:"#fff", padding:"10px 22px", borderRadius:50, fontWeight:700, zIndex:999, boxShadow:"0 4px 20px rgba(0,0,0,.15)", fontSize:14 }}>{toast.msg}</div>}

{/* Header */}
<div style={{ background:`linear-gradient(135deg,${theme.a} 0%,${theme.b} 100%)`, padding:"28px 20px 20px", color:"#fff" }}>
<div style={{ fontSize:12, opacity:.8, marginBottom:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
<span>ניהול הוצאות בית</span>
<span style={{ fontSize:10, opacity:.8 }}>
{syncing ? "⟳ מסנכרן..." : lastSync ? `✓ ${lastSync.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}` : ""}
</span>
</div>
<div style={{ fontSize:28, fontWeight:800 }}>
{leftThisWeek>=0?`₪${leftThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})}`:`-₪${Math.abs(leftThisWeek).toLocaleString("he-IL",{maximumFractionDigits:0})}`}
</div>
<div style={{ fontSize:13, opacity:.85, marginBottom:12 }}>
נשאר השבוע{hasFixedOverflow&&<span style={{fontSize:11,opacity:.8}}> (כולל קיזוז חריגות)</span>}
</div>
<div style={{ background:"rgba(255,255,255,.25)", borderRadius:8, height:8, overflow:"hidden" }}>
<div style={{ background:"rgba(255,255,255,.9)", height:"100%", width:`${weekPct}%`, transition:"width .4s", borderRadius:8 }} />
</div>
<div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:5, opacity:.8 }}>
<span>₪{spentThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})} הוצאה{trackingSpentThisWeek>0?` + ₪${trackingSpentThisWeek.toLocaleString("he-IL",{maximumFractionDigits:0})} מעקב`:""}</span>
<span>תקציב שבוע: ₪{weeklyVariableBudget.toLocaleString("he-IL",{maximumFractionDigits:0})}{selectedWeek>=currentWeekId&&weeksRemainingInCycle>1?<span style={{fontSize:9,opacity:.7}}> ({weeksRemainingInCycle} שבועות)</span>:null}{selectedWeek>currentWeekId?<span style={{fontSize:9,background:"rgba(234,179,8,.2)",borderRadius:4,padding:"1px 5px",marginRight:4,color:"#b45309"}}>📅 צפוי</span>:null}</span>
</div>
{hasFixedOverflow && (
<div style={{ marginTop:10, background:"rgba(224,112,112,.25)", borderRadius:10, padding:"8px 12px", fontSize:11, display:"flex", alignItems:"center", gap:6 }}>
<span>⚠️</span>
<span>חריגה בקבועות: ₪{fixedOverflowThisMonth.toLocaleString("he-IL",{maximumFractionDigits:0})} | קנס: ₪{weeklyFixedOverflowPenalty.toLocaleString("he-IL",{maximumFractionDigits:0})}/שבוע</span>
</div>
)}
{/* Week navigation */}
<div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
<button onClick={()=>{ const d=new Date(selectedWeek); d.setDate(d.getDate()-7); setSelectedWeek(getWeekId(d)); }}
style={{ background:"rgba(255,255,255,.25)", border:"none", color:"#fff", borderRadius:10, width:32, height:32, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>
<div style={{ flex:1, position:"relative" }} data-weekpicker="true">
<button onClick={()=>setShowWeekPicker(p=>!p)}
style={{ width:"100%", background:"rgba(255,255,255,.25)", border:"none", color:"#fff", borderRadius:10, padding:"6px 10px", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
<span>📅</span>
<span>{selectedWeek===getWeekId()?"שבוע זה":getWeekLabel(selectedWeek)}</span>
</button>
{showWeekPicker && (
<div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, left:0, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", zIndex:200, padding:12, maxHeight:260, overflowY:"auto" }}>
<div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:8, textAlign:"center" }}>בחר שבוע</div>
{[getWeekId(), ...[...new Set([...allWeeks].filter(w=>w!==getWeekId()))].sort().reverse()].map(w=>(
<button key={w} onClick={()=>{ setSelectedWeek(w); setShowWeekPicker(false); }}
style={{ width:"100%", background:selectedWeek===w?theme.light:"transparent", color:selectedWeek===w?theme.acc:"#1e293b", border:"none", borderRadius:8, padding:"8px 10px", fontSize:12, fontWeight:selectedWeek===w?700:400, cursor:"pointer", textAlign:"right", marginBottom:2 }}>
{w===getWeekId()?"שבוע זה — ":""}{getWeekLabel(w)}
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
style={{ background:"rgba(255,255,255,.25)", border:"none", color:"#fff", borderRadius:10, width:32, height:32, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>›</button>
</div>
</div>

{/* Nav */}
<div style={{ background:"#fff", borderBottom:"1px solid #e8eef5", display:"flex", justifyContent:"space-around", padding:"10px 0" }}>
{[["dashboard","📊","סיכום"],["variable","🔄","משתנות"],["fixed","📌","קבועות"],["savings","🐷","חסכון"],["analytics","📈","ניתוח"],["notes","📝","רשומות"],["settings","⚙️","הגדרות"]].map(([id,icon,label])=>(
<button key={id} onClick={()=>setView(id)} style={{ background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:"pointer", color:view===id?theme.acc:"#a0aec0", fontSize:10, fontWeight:view===id?700:400, padding:"4px 8px" }}>
<span style={{fontSize:18}}>{icon}</span>{label}
</button>
))}
</div>

<div style={{ padding:"16px 16px 0" }}>
{/* ── DASHBOARD ── */}
{view==="dashboard" && (
<>
<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
{[{label:"הכנסה",val:totalMonthlyIncome,color:theme.incomeColor,bg:theme.light},{label:"תקציב",val:totalBudgetIncl,color:"#e8b87c",bg:"#fdf6e8"},{label:"עודף",val:totalMonthlyIncome-totalBudgetIncl,color:(totalMonthlyIncome-totalBudgetIncl)>=0?theme.acc:"#e07070",bg:(totalMonthlyIncome-totalBudgetIncl)>=0?theme.light:"#fdf0f0"}].map(c=>(
<div key={c.label} style={{ background:c.bg, borderRadius:14, padding:"12px 10px", textAlign:"center" }}>
<div style={{fontSize:11,color:"#6b7a8d",marginBottom:4}}>{c.label}</div>
<div style={{fontSize:15,fontWeight:800,color:c.color}}>₪{Math.abs(c.val).toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
</div>
))}
</div>

{/* Alerts */}
{alerts.length>0&&(
<div style={{marginBottom:12}}>
{alerts.map((a,i)=>(
<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,marginBottom:6,background:a.type==="danger"?"#fdf0f0":a.type==="warn"?"#fdf8ec":"#edf7f1",border:`1px solid ${a.type==="danger"?"#f5c6c6":a.type==="warn"?"#f0dfa8":"#b8e8cc"}`}}>
<span style={{fontSize:12,color:a.type==="danger"?"#c05050":a.type==="warn"?"#b07020":"#4aab72",fontWeight:600,lineHeight:1.4}}>{a.msg}</span>
</div>
))}
</div>
)}

{/* Test Tubes */}
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
<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={gradA} stopOpacity="0.9"/><stop offset="100%" stopColor={gradB} stopOpacity="1"/></linearGradient>
<linearGradient id={shimId} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(255,255,255,0.5)"/><stop offset="45%" stopColor="rgba(255,255,255,0.0)"/></linearGradient>
<clipPath id={clipId}><path d={tubeClipPath}/></clipPath>
</defs>
{ticks.map(t=>{const ty2=botY-t*fillableH;return(<g key={t}><line x1={tx+tw} y1={ty2} x2={tx+tw+8} y2={ty2} stroke="#c8d4e0" strokeWidth="1.2"/><text x={tx+tw+11} y={ty2+4} fontSize="8" fill="#94a3b8" fontWeight="600">{Math.round(t*100)}%</text></g>);})}
<path d={tubePath} fill="rgba(248,250,252,0.95)" stroke="rgba(148,163,184,0.3)" strokeWidth="1.5"/>
{clamp>0&&<rect x={tx} y={liquidY} width={tw} height={TH} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`}/>}
{clamp>0.02&&<path d={`M ${tx+1} ${liquidY} Q ${tx+tw*0.3} ${liquidY-3} ${tx+tw*0.5} ${liquidY} Q ${tx+tw*0.7} ${liquidY+3} ${tx+tw-1} ${liquidY}`} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" clipPath={`url(#${clipId})`}/>}
<rect x={tx+3} y={topY} width={7} height={(botY-topY)*0.7} rx={3} fill={`url(#${shimId})`} clipPath={`url(#${clipId})`}/>
<path d={tubePath} fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1.5"/>
<rect x={tx-3} y={topY-8} width={tw+6} height={9} rx={3} fill="#e8eef5" stroke="rgba(148,163,184,0.5)" strokeWidth="1"/>
<text x={tx+tw/2} y={topY+(botY-topY)*0.55} textAnchor="middle" fontSize="15" fontWeight="900" fill={clamp>0.4?"rgba(255,255,255,0.95)":"#64748b"} style={{fontFamily:"system-ui,sans-serif"}}>{Math.round(fillPct*100)}%</text>
</svg>
{showDots&&<div style={{display:"flex",gap:5}}>{DAY_LABELS.map((d,i)=>(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{width:9,height:9,borderRadius:"50%",background:i<daysPassed?gradB:"#dde4ed",boxShadow:i===dayOfWeek?`0 0 0 2px #fff, 0 0 0 3.5px ${gradB}`:"none",transition:"all .2s"}}/><span style={{fontSize:8,color:i===dayOfWeek?gradB:"#94a3b8",fontWeight:i===dayOfWeek?800:400}}>{d}</span></div>))}</div>}
<div style={{textAlign:"center"}}>
<div style={{fontSize:13,fontWeight:800,color:"#334155"}}>{sub}</div>
{extra&&<div style={{fontSize:11,fontWeight:700,color:"#e07070",marginTop:2}}>{extra}</div>}
</div>
</div>
);
};
const statusMsg=budgetOver?{text:`חרגת ₪${Math.abs(Math.round(leftThisWeek)).toLocaleString("he-IL")}`,color:"#c05050",bg:"#fdf0f0"}:weekFillPct>budgetFillPct+0.15?{text:"הימים רצים מהתקציב",color:"#9a7020",bg:"#fdf8ec"}:{text:"אתה בקצב טוב ✓",color:"#3d7a55",bg:"#edf7f1"};
return (
<div style={{...cardStyle,marginBottom:16,background:"#f8fbff",border:"1px solid #e0e8f0"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
<span style={{fontSize:13,fontWeight:700,color:"#334155"}}>מצב השבוע</span>
<span style={{fontSize:11,fontWeight:700,color:statusMsg.color,background:statusMsg.bg,padding:"3px 10px",borderRadius:20}}>{statusMsg.text}</span>
</div>
<div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-start"}}>
<Tube label="days" fillPct={weekFillPct} gradA="#c4b5e8" gradB="#8b6fc7" title="ימים שעברו" sub={`${daysPassed} / 7`} showDots/>
<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",paddingTop:90,gap:4,opacity:.25}}>
<div style={{width:1,height:36,background:"#94a3b8"}}/><span style={{fontSize:9,fontWeight:800,color:"#94a3b8",letterSpacing:1}}>VS</span><div style={{width:1,height:36,background:"#94a3b8"}}/>
</div>
<Tube label="budget" fillPct={budgetFillPct} gradA={budgetOver?"#f5c6c6":budgetFillPct<0.25?"#fce8b0":"#a8d5ba"} gradB={budgetOver?"#e07070":budgetFillPct<0.25?"#d4a040":"#6bbf8e"} title="תקציב שנשאר" sub={`₪${Math.abs(Math.round(leftThisWeek)).toLocaleString("he-IL")}`} extra={budgetOver?"חריגה!":null}/>
</div>
{/* Redistribution is automatic — no manual button needed */}
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
<span style={{fontSize:13,fontWeight:700,color:"#334155"}}>הוצאות יומיות — החודש</span>
<span style={{fontSize:11,color:"#94a3b8"}}>ממוצע ₪{Math.round(avgSpend).toLocaleString("he-IL")}/יום</span>
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
<div title={day.ds+": ₪"+day.daySpend}
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
<span>— תקציב יומי ₪{Math.round(dailyBudget).toLocaleString("he-IL")}</span>
<span>9/{new Date(cycleEnd).getMonth()+1}</span>
</div>
</div>
</div>
);
})()}

{/* Variable buckets summary */}
<div style={{marginBottom:16}}>
<div style={{fontSize:13,fontWeight:700,color:"#334155",marginBottom:10}}>משתנות – {getWeekLabel(selectedWeek)}</div>
{data.variableBuckets.length===0?<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>אין באקטים משתנים עדיין</div>:
data.variableBuckets.map(b=>{
const monthlyBudget=Number(b.amount); const monthlySpent=data.expenses.filter(e=>inCurrentCycle(e.date)&&e.bucketId===b.id).reduce((s,e)=>s+Number(e.amount),0); const p=pct(monthlySpent,monthlyBudget); const bc=p>90?"#e07070":p>65?"#e8b87c":"#6bbf8e";
return (<div key={b.id} style={{...cardStyle,padding:"12px 14px",marginBottom:8}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>{ICONS[b.icon]}</span><span style={{fontSize:14,fontWeight:600}}>{b.name}</span>{b.trackingOnly&&<span style={{fontSize:9,background:"#fdf6e8",color:"#b07020",padding:"2px 5px",borderRadius:4,fontWeight:700}}>מעקב</span>}</div>
<div style={{fontSize:12,color:"#6b7a8d"}}><span style={{color:bc,fontWeight:700}}>₪{monthlySpent.toLocaleString("he-IL",{maximumFractionDigits:0})}</span>{" / "}₪{monthlyBudget.toLocaleString("he-IL",{maximumFractionDigits:0})}</div>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:5,overflow:"hidden"}}><div style={{background:bc,height:"100%",width:`${p}%`,transition:"width .3s",borderRadius:6}}/></div>
</div>);
})}
</div>

{/* Recent expenses with filter + scroll */}
<div style={{marginBottom:16}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<div style={{fontSize:13,fontWeight:700,color:"#334155"}}>הוצאות אחרונות</div>
<div style={{display:"flex",gap:6}}>
{[["all","הכל"],["variable","משתנות"],["fixed","קבועות"]].map(([f,label])=>(
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
if (filtered.length===0) return <div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>אין הוצאות</div>;
return (
<div style={{maxHeight:expenseFilter==="all"?340:500,overflowY:"auto",paddingLeft:2}}>
{filtered.map(e=>(
<div key={e.id} style={{background:"#fff",borderRadius:10,padding:"10px 14px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
<div>
<div style={{fontSize:13,fontWeight:600}}>{getBucketName(e.bucketId)}</div>
{e.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{e.note}</div>}
<div style={{fontSize:11,color:"#c0cad8",display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
<span>{new Date(e.date).toLocaleDateString("he-IL")}</span>
<span style={{background:fixedBucketIds.has(e.bucketId)?"#fdf6e8":"#eef4fb",color:fixedBucketIds.has(e.bucketId)?"#b07020":"#4a7fa5",padding:"0 4px",borderRadius:3,fontSize:10}}>{fixedBucketIds.has(e.bucketId)?"קבועה":"משתנה"}</span>
{e.recurring&&<span style={{background:"#edf7f1",color:"#3d7a55",padding:"0 4px",borderRadius:3,fontSize:10,fontWeight:700}}>🔄 מחזורי</span>}
{e.paymentMethodId&&<span style={{color:theme.acc}}>{getPMLabel(e.paymentMethodId)}</span>}
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:15}}>₪{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>setEditExpense({...e})} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
<button onClick={()=>deleteExpense(e.id)} style={{background:"none",border:"none",color:"#c0cad8",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
</div>
</div>
))}
</div>
);
})()}
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
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
{Object.entries(ICONS).slice(0,11).map(([k,v])=>(<button key={k} onClick={()=>setEditBucket(p=>({...p,icon:k}))} style={{background:editBucket.icon===k?theme.btnLight:"#f1f5f9",border:editBucket.icon===k?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:7,padding:"5px 8px",fontSize:15,cursor:"pointer"}}>{v}</button>))}
</div>
<div onClick={()=>setEditBucket(p=>({...p,trackingOnly:!p.trackingOnly}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:editBucket.trackingOnly?"#fdf6e8":"#edf7f1",border:editBucket.trackingOnly?"1.5px solid #e8b87c":"1.5px solid #a8d5ba",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>{editBucket.trackingOnly?"📊":"💰"}</span>
<span style={{fontSize:12,fontWeight:600,color:editBucket.trackingOnly?"#9a7020":"#3d7a55",flex:1}}>{editBucket.trackingOnly?"מעקב בלבד — לא משפיע על תקציב שבועי":"מחושב בתקציב השבועי"}</span>
<div style={{width:32,height:18,background:editBucket.trackingOnly?"#e8b87c":"#6bbf8e",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:editBucket.trackingOnly?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<button onClick={()=>setEditBucket(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>ביטול</button>
<button onClick={()=>deleteBucket("variable",b.id)} style={{background:"#fdf0f0",color:"#e07070",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>מחק</button>
<button onClick={saveBucketEdit} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>שמור</button>
</div>
</>
):(
<>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
<div style={{display:"flex",alignItems:"center",gap:8,fontSize:15,fontWeight:700}}>
<span style={{fontSize:13,color:"#c0cad8",cursor:"grab",marginLeft:2}}>⠿</span>
<span>{ICONS[b.icon]}</span>
<div>{b.name}{b.trackingOnly&&<span style={{fontSize:9,background:"#fdf6e8",color:"#b07020",padding:"1px 5px",borderRadius:4,fontWeight:700,marginRight:4}}>מעקב</span>}</div>
</div>
<button onClick={()=>setEditBucket({...b,type:"variable"})} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>✏️ ערוך</button>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12}}>
{[{l:"חודשי",v:`₪${Number(b.amount).toLocaleString("he-IL")}`,c:theme.acc},{l:"שבועי",v:`₪${wB.toLocaleString("he-IL",{maximumFractionDigits:0})}`,c:"#8b6fc7"},{l:"הוצאה",v:`₪${spent.toLocaleString("he-IL")}`,c:spent>wB?"#e07070":"#6bbf8e"}].map(x=>(
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
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ הוסף באקט משתנה</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
<input placeholder="שם" value={newBucket.name} onChange={e=>setNewBucket(p=>({...p,name:e.target.value}))} style={inputStyle}/>
<input placeholder="סכום חודשי ₪" type="number" value={newBucket.amount} onChange={e=>setNewBucket(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
{Object.entries(ICONS).slice(0,11).map(([k,v])=>(<button key={k} onClick={()=>setNewBucket(p=>({...p,icon:k}))} style={{background:newBucket.icon===k?theme.btnLight:"#f1f5f9",border:newBucket.icon===k?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:8,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{v}</button>))}
</div>
<div onClick={()=>setNewBucket(p=>({...p,trackingOnly:!p.trackingOnly}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:newBucket.trackingOnly?"#fdf6e8":"#edf7f1",border:newBucket.trackingOnly?"1.5px solid #e8b87c":"1.5px solid #a8d5ba",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>{newBucket.trackingOnly?"📊":"💰"}</span>
<span style={{fontSize:12,fontWeight:600,color:newBucket.trackingOnly?"#9a7020":"#3d7a55",flex:1}}>{newBucket.trackingOnly?"מעקב בלבד — לא משפיע על תקציב שבועי":"מחושב בתקציב השבועי"}</span>
<div style={{width:32,height:18,background:newBucket.trackingOnly?"#e8b87c":"#6bbf8e",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:newBucket.trackingOnly?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
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
style={{...cardStyle,border:isEditing?"2px solid "+theme.fixedText:hasOver?"1.5px solid #f5c6c6":"1.5px solid transparent",cursor:isEditing?"default":"grab",userSelect:"none"}}>
{isEditing?(
<>
<div style={{fontSize:12,fontWeight:700,color:theme.fixedText,marginBottom:10}}>✏️ עריכת הוצאה קבועה</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<input value={editBucket.name} onChange={e=>setEditBucket(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="שם"/>
<input type="number" value={editBucket.amount} onChange={e=>setEditBucket(p=>({...p,amount:e.target.value}))} style={inputStyle} placeholder="סכום ₪"/>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
{Object.entries(ICONS).slice(11).map(([k,v])=>(<button key={k} onClick={()=>setEditBucket(p=>({...p,icon:k}))} style={{background:editBucket.icon===k?theme.fixedBg:"#f1f5f9",border:editBucket.icon===k?"2px solid "+theme.fixedText:"2px solid transparent",borderRadius:7,padding:"5px 8px",fontSize:15,cursor:"pointer"}}>{v}</button>))}
</div>
<div onClick={()=>setEditBucket(p=>({...p,isRecurring:!p.isRecurring}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:8,background:editBucket.isRecurring?"#edf7f1":"#f4f7fb",border:editBucket.isRecurring?"1.5px solid #a8d5ba":"1.5px solid #dde4ed",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>🔄</span>
<span style={{fontSize:12,fontWeight:600,color:editBucket.isRecurring?"#3d7a55":"#6b7a8d",flex:1}}>חיוב מחזורי אוטומטי</span>
<div style={{width:32,height:18,background:editBucket.isRecurring?"#6bbf8e":"#dde4ed",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:editBucket.isRecurring?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div onClick={()=>setEditBucket(p=>({...p,isSavings:!p.isSavings}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:10,background:editBucket.isSavings?"#edf4fb":"#f4f7fb",border:editBucket.isSavings?"1.5px solid #aed4f0":"1.5px solid #dde4ed",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>🐷</span>
<span style={{fontSize:12,fontWeight:600,color:editBucket.isSavings?"#4a7fa5":"#6b7a8d",flex:1}}>הוצאה זו הולכת לחסכון — נספרת כחיסכון</span>
<div style={{width:32,height:18,background:editBucket.isSavings?"#6a9bc3":"#dde4ed",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:editBucket.isSavings?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<button onClick={()=>setEditBucket(null)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>ביטול</button>
<button onClick={()=>deleteBucket("fixed",b.id)} style={{background:"#fdf0f0",color:"#e07070",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:600,cursor:"pointer"}}>מחק</button>
<button onClick={saveBucketEdit} style={{background:theme.fixedText,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>שמור</button>
</div>
</>
):(
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:13,color:"#c0cad8",cursor:"grab"}}>⠿</span>
<span style={{fontSize:22}}>{ICONS[b.icon]}</span>
<div>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:14,fontWeight:700}}>{b.name}</span>
{b.isRecurring&&<span style={{fontSize:9,background:"#edf7f1",color:"#3d7a55",padding:"1px 5px",borderRadius:4,fontWeight:700}}>🔄 מחזורי</span>}
{b.isSavings&&<span style={{fontSize:9,background:"#edf4fb",color:"#4a7fa5",padding:"1px 5px",borderRadius:4,fontWeight:700}}>🐷 חסכון</span>}
</div>
<div style={{fontSize:13,color:"#6b7a8d"}}>
{b.isInstallment
? <>💳 ₪{monthly.toLocaleString("he-IL",{maximumFractionDigits:0})}/חודש · {instLeft} תשלומים נותרו</>
: <>₪{Number(b.amount).toLocaleString("he-IL")} / חודש</>}
</div>
<div style={{fontSize:12,color:spentB>0?(hasOver?"#e07070":"#6bbf8e"):"#94a3b8",marginTop:1}}>
שולם החודש: ₪{spentB.toLocaleString("he-IL")}
{hasOver&&<span style={{fontWeight:700}}> | חריגה: ₪{overflow.toLocaleString("he-IL")}</span>}
</div>
</div>
</div>
<button onClick={()=>setEditBucket({...b,type:"fixed"})} style={{background:theme.fixedBg,border:"none",color:theme.fixedText,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>✏️ ערוך</button>
</div>
)}
</div>
);
})}
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ הוסף הוצאה קבועה</div>
<div style={{display:"flex",gap:8,marginBottom:12}}>
{[["רגילה",false,false],["מחזורי 🔄",false,true],["תשלומים 💳",true,false]].map(([label,isInst,isRec])=>(
<button key={label} onClick={()=>setNewBucket(p=>({...p,isInstallment:isInst,isRecurring:isRec}))}
style={{flex:1,background:(newBucket.isInstallment===isInst&&newBucket.isRecurring===isRec)?theme.fixedBg:"#f1f5f9",border:(newBucket.isInstallment===isInst&&newBucket.isRecurring===isRec)?"2px solid "+theme.fixedText:"2px solid transparent",borderRadius:8,padding:"9px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>
))}
</div>
{newBucket.isRecurring&&<div style={{background:"#edf7f1",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#3d7a55"}}>🔄 הוצאה מחזורית — תסומן אוטומטית כחיוב קבוע כל חודש</div>}
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
<div style={{background:theme.fixedBg,borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:theme.fixedText}}>
💡 תשלום חודשי: ₪{(Number(newBucket.totalAmount)/Number(newBucket.installmentsLeft)).toLocaleString("he-IL",{maximumFractionDigits:0})}
</div>
)}
<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
{Object.entries(ICONS).slice(11).map(([k,v])=>(<button key={k} onClick={()=>setNewBucket(p=>({...p,icon:k}))} style={{background:newBucket.icon===k?theme.fixedBg:"#f1f5f9",border:newBucket.icon===k?"2px solid "+theme.fixedText:"2px solid transparent",borderRadius:8,padding:"6px 10px",fontSize:16,cursor:"pointer"}}>{v}</button>))}
</div>
<button onClick={()=>addBucket("fixed")} style={{width:"100%",background:theme.fixedText,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>הוסף</button>
</div>
</>
)}
{/* ── SAVINGS ── */}
{view==="savings" && (
<>
<div style={{fontSize:15,fontWeight:700,marginBottom:14}}>🐷 חסכונות</div>
<div style={{background:`linear-gradient(135deg,${theme.savingsA},${theme.savingsB})`,borderRadius:16,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
<div>
<div style={{fontSize:11,opacity:.8,marginBottom:3}}>סה"כ הפקדות</div>
<div style={{fontSize:22,fontWeight:900}}>₪{totalSavings.toLocaleString("he-IL")}</div>
<div style={{fontSize:10,opacity:.7,marginTop:2}}>{(data.savings||[]).length} רשומות</div>
</div>
<div style={{borderRight:"1px solid rgba(255,255,255,.3)",paddingRight:12}}>
<div style={{fontSize:11,opacity:.8,marginBottom:3}}>מצב נוכחי</div>
<div style={{fontSize:22,fontWeight:900}}>₪{totalSnapshotBalance.toLocaleString("he-IL")}</div>
<div style={{fontSize:10,opacity:.7,marginTop:2}}>{(data.savingsSnapshot||[]).length} מוצרים</div>
</div>
</div>
</div>
<div style={{display:"flex",gap:8,marginBottom:16}}>
{[["deposits","💰 הפקדות"],["snapshot","📸 מצב חסכונות"]].map(([t,label])=>(
<button key={t} onClick={()=>setSavingsTab(t)}
style={{flex:1,background:savingsTab===t?theme.savingsB:"#f1f5f9",color:savingsTab===t?"#fff":"#6b7a8d",border:"none",borderRadius:10,padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
{label}
</button>
))}
</div>
{savingsTab==="deposits" && <>
{SAVING_CHANNELS.filter(ch=>(data.savings||[]).some(s=>s.channel===ch.id)).length>0&&(
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>לפי אפיק</div>
{SAVING_CHANNELS.filter(ch=>(data.savings||[]).some(s=>s.channel===ch.id)).map(ch=>{
const total=(data.savings||[]).filter(s=>s.channel===ch.id).reduce((s,x)=>s+Number(x.amount),0);
const p=totalSavings>0?(total/totalSavings)*100:0;
return (<div key={ch.id} style={{marginBottom:10}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13}}>{ch.icon} {ch.label}</span><span style={{fontSize:13,fontWeight:700,color:theme.savingsA}}>₪{total.toLocaleString("he-IL")}</span></div>
<div style={{background:"#eef2f7",borderRadius:6,height:6,overflow:"hidden"}}><div style={{background:theme.savingsB,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/></div>
</div>);
})}
</div>
)}
{(data.savings||[]).length>0&&(
<div style={{marginBottom:16}}>
<div style={{fontSize:13,fontWeight:700,marginBottom:10}}>כל הרשומות</div>
{[...(data.savings||[])].sort((a,b)=>b.createdAt-a.createdAt).map(s=>{
const ch=SAVING_CHANNELS.find(c=>c.id===s.channel)||SAVING_CHANNELS[6];
return (<div key={s.id} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
<div>
<div style={{fontSize:13,fontWeight:700}}>{ch.icon} {ch.label}</div>
{s.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{s.note}</div>}
<div style={{fontSize:11,color:"#c0cad8",marginTop:2}}>{new Date(s.date).toLocaleDateString("he-IL")}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontWeight:800,color:theme.savingsB,fontSize:15}}>₪{Number(s.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>deleteSaving(s.id)} style={{background:"none",border:"none",color:"#c0cad8",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
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
{savingsTab==="snapshot" && <>
<div style={{fontSize:12,color:"#94a3b8",marginBottom:12,textAlign:"center"}}>רשום את היתרה הנוכחית בכל מוצר חסכון</div>
{(data.savingsSnapshot||[]).length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>אין מוצרי חסכון עדיין</div>}
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
<span style={{fontSize:15,fontWeight:800,color:theme.savingsB}} onClick={()=>setEditSnapshotId(item.id)}>₪{Number(item.balance).toLocaleString("he-IL")}</span>
<button onClick={()=>setEditSnapshotId(item.id)} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
</>
)}
<button onClick={()=>deleteSnapshotItem(item.id)} style={{background:"#fdf0f0",border:"none",color:"#e07070",borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✕</button>
</div>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:5,overflow:"hidden"}}><div style={{background:theme.savingsB,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/></div>
<div style={{fontSize:10,color:"#94a3b8",marginTop:4,display:"flex",justifyContent:"space-between"}}>
<span>{Math.round(p)}% מהתיק</span><span>עודכן {new Date(item.updatedAt).toLocaleDateString("he-IL")}</span>
</div>
</div>
);
})}
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>+ הוסף מוצר חסכון</div>
<select value={newSnapshotItem.channel} onChange={e=>setNewSnapshotItem(p=>({...p,channel:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:8,boxSizing:"border-box",fontSize:13}}>
{SAVING_CHANNELS.map(ch=><option key={ch.id} value={ch.id}>{ch.icon} {ch.label}</option>)}
</select>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<input placeholder="שם" value={newSnapshotItem.name} onChange={e=>setNewSnapshotItem(p=>({...p,name:e.target.value}))} style={{...inputStyle,fontSize:13}}/>
<input type="number" placeholder="יתרה ₪" value={newSnapshotItem.balance} onChange={e=>setNewSnapshotItem(p=>({...p,balance:e.target.value}))} style={{...inputStyle,fontSize:13}}/>
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

{/* Projection — now includes tracking-only buckets in budget */}
<div style={{background:`linear-gradient(135deg,${theme.a},${theme.b})`,borderRadius:16,padding:"18px 20px",marginBottom:16,color:"#fff"}}>
<div style={{fontSize:12,opacity:.85,marginBottom:4}}>💰 חיסכון צפוי החודש</div>
<div style={{fontSize:28,fontWeight:900}}>{projectedSavings>=0?`₪${Math.round(projectedSavings).toLocaleString("he-IL")}`:`-₪${Math.round(Math.abs(projectedSavings)).toLocaleString("he-IL")}`}</div>
<div style={{fontSize:12,opacity:.85,marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
<span>📌 עודף לא מתוקצב: ₪{Math.round(expectedSurplus).toLocaleString("he-IL")}</span>
<span>🔄 עודף משתנות (צפי): {projectedUnspentVariable>=0?`₪${Math.round(projectedUnspentVariable).toLocaleString("he-IL")}`:`-₪${Math.round(Math.abs(projectedUnspentVariable)).toLocaleString("he-IL")}`}</span>
{fixedSavingsBudget>0&&<span>🏦 חסכון מקבועות: ₪{Math.round(fixedSavingsBudget).toLocaleString("he-IL")}</span>}
</div>
<div style={{marginTop:10,background:"rgba(255,255,255,.25)",borderRadius:8,height:8,overflow:"hidden"}}>
<div style={{background:projectedSavings>=0?"rgba(255,255,255,.85)":"rgba(224,112,112,.8)",height:"100%",width:`${Math.min(100,totalMonthlyIncome>0?(Math.max(0,projectedSavings)/totalMonthlyIncome)*100:0)}%`,borderRadius:8,transition:"width .4s"}}/>
</div>
<div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:5,opacity:.8}}>
<span>הוצאה משתנות (צפי): ₪{Math.round(projectedVariableSpend).toLocaleString("he-IL")}</span>
<span>הכנסה: ₪{Math.round(totalMonthlyIncome).toLocaleString("he-IL")}</span>
</div>
<div style={{fontSize:10,opacity:.7,marginTop:4,borderTop:"1px solid rgba(255,255,255,.2)",paddingTop:6}}>
הוצא עד כה: ₪{Math.round(spentThisCycle).toLocaleString("he-IL")} | {Math.round(daysElapsed)} ימים מתוך {cycleTotalDays}
</div>
</div>

{/* Category breakdown — with remaining budget per category */}
<div style={{...cardStyle,marginBottom:16}}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>פילוח קטגוריות — חודש נוכחי</div>
{data.variableBuckets.length===0&&<div style={{color:"#94a3b8",fontSize:12,textAlign:"center"}}>אין קטגוריות</div>}
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
<span style={{fontSize:13,display:"flex",alignItems:"center",gap:4}}>{ICONS[b.icon]} {b.name}{b.trackingOnly&&<span style={{fontSize:9,background:"#fdf6e8",color:"#b07020",padding:"1px 4px",borderRadius:3,fontWeight:700}}>מעקב</span>}<span style={{fontSize:10,color:"#94a3b8",marginRight:2}}>{isExpanded?"▲":"▼"}</span></span>
<div style={{textAlign:"left"}}>
<span style={{fontSize:12,fontWeight:700,color:col}}>₪{spent.toLocaleString("he-IL",{maximumFractionDigits:0})} / ₪{budget.toLocaleString("he-IL")}</span>
</div>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:7,overflow:"hidden",marginBottom:4}}>
<div style={{background:col,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/>
</div>
<div style={{fontSize:11,color:remaining>=0?theme.acc:"#e07070",fontWeight:700}}>
{remaining>=0?`נשאר: ₪${remaining.toLocaleString("he-IL",{maximumFractionDigits:0})}`:`חריגה: ₪${Math.abs(remaining).toLocaleString("he-IL",{maximumFractionDigits:0})}`}
</div>
</div>
{isExpanded&&(
<div style={{background:"#f8fafc",borderRadius:10,marginTop:6,padding:"4px 0",border:"1px solid #e8eef5"}}>
{bucketExps.length===0
?<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"10px 0"}}>אין הוצאות החודש</div>
:bucketExps.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid #f1f5f9"}}>
<div style={{flex:1}}>
<div style={{fontSize:12,fontWeight:600,color:"#334155"}}>{e.note||"—"}</div>
<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{new Date(e.date).toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:13}}>₪{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={ev=>{ev.stopPropagation();setEditExpense({...e});}} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>✏️</button>
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
<div style={{fontSize:12,fontWeight:700,color:theme.fixedText,marginTop:12,marginBottom:8}}>קבועות</div>
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
<span style={{fontSize:13,display:"flex",alignItems:"center",gap:4}}>{ICONS[b.icon]} {b.name}<span style={{fontSize:10,color:"#94a3b8",marginRight:2}}>{isExpandedF?"▲":"▼"}</span></span>
<span style={{fontSize:12,fontWeight:700,color:col}}>₪{spent.toLocaleString("he-IL",{maximumFractionDigits:0})} / ₪{monthly.toLocaleString("he-IL",{maximumFractionDigits:0})}</span>
</div>
<div style={{background:"#eef2f7",borderRadius:6,height:7,overflow:"hidden",marginBottom:4}}>
<div style={{background:col,height:"100%",width:`${p}%`,borderRadius:6,transition:"width .4s"}}/>
</div>
<div style={{fontSize:11,color:remaining>=0?"#6bbf8e":"#e07070",fontWeight:700}}>
{remaining>=0?`נשאר: ₪${remaining.toLocaleString("he-IL",{maximumFractionDigits:0})}`:`חריגה: ₪${Math.abs(remaining).toLocaleString("he-IL",{maximumFractionDigits:0})}`}
</div>
</div>
{isExpandedF&&(
<div style={{background:"#f8fafc",borderRadius:10,marginTop:6,padding:"4px 0",border:"1px solid #e8eef5"}}>
{bucketExpsF.length===0
?<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"10px 0"}}>אין הוצאות החודש</div>
:bucketExpsF.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid #f1f5f9"}}>
<div style={{flex:1}}>
<div style={{fontSize:12,fontWeight:600,color:"#334155"}}>{e.note||"—"}</div>
<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{new Date(e.date).toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:13}}>₪{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={ev=>{ev.stopPropagation();setEditExpense({...e});}} style={{background:theme.fixedBg,border:"none",color:theme.fixedText,borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>✏️</button>
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
<div style={{fontSize:13,fontWeight:700,marginBottom:14}}>היסטוריה חודשית</div>
<div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,paddingBottom:4}}>
{cycleHistory.slice(-6).map((cy,i)=>{
const maxTotal=Math.max(...cycleHistory.slice(-6).map(c=>Math.max(c.total,c.budget)),1);
const barH=Math.max(4,(cy.total/maxTotal)*100);
const budH=Math.max(4,(cy.budget/maxTotal)*100);
const isOver=cy.total>cy.budget;
const isCurrent=cy.csStr===cycleStart.toISOString().slice(0,10);
return (
<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
<div style={{fontSize:8,fontWeight:700,color:isOver?"#e07070":theme.acc}}>{cy.total>0?`₪${Math.round(cy.total/1000)}k`:""}</div>
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
<div style={{fontSize:13,fontWeight:700,marginBottom:10}}>🔍 חיפוש הוצאות</div>
<input placeholder="חפש לפי קטגוריה, הערה, סכום..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}
style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:13}}/>
{searchQ.trim().length>1&&filtered.length===0&&<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:12}}>לא נמצאו תוצאות</div>}
{filtered.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
<div>
<div style={{fontSize:13,fontWeight:600}}>{getBucketName(e.bucketId)}</div>
{e.note&&<div style={{fontSize:11,color:"#94a3b8"}}>{e.note}</div>}
<div style={{fontSize:10,color:"#c0cad8"}}>{new Date(e.date).toLocaleDateString("he-IL")}</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{fontWeight:800,color:"#e07070"}}>₪{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>setEditExpense({...e})} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
<button onClick={()=>deleteExpense(e.id)} style={{background:"none",border:"none",color:"#c0cad8",cursor:"pointer",fontSize:14}}>✕</button>
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
<div style={{...cardStyle,marginBottom:16,background:"#f0faf4",border:"1.5px solid #b8e8cc"}}>
<input placeholder="כותרת (אופציונלי)" value={newNote.title} onChange={e=>setNewNote(p=>({...p,title:e.target.value}))}
style={{width:"100%",border:"none",borderBottom:"1.5px solid #b8e8cc",background:"transparent",fontSize:14,fontWeight:600,marginBottom:8,outline:"none",boxSizing:"border-box",padding:"4px 0"}}/>
<textarea placeholder="כתוב רעיון, תזכורת..." value={newNote.body} onChange={e=>setNewNote(p=>({...p,body:e.target.value}))}
style={{width:"100%",border:"none",background:"transparent",fontSize:13,minHeight:80,marginBottom:10,boxSizing:"border-box",outline:"none",padding:"4px 0",fontFamily:"inherit",resize:"vertical"}}/>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
<span style={{fontSize:11,color:"#3d7a55"}}>צבע:</span>
{["#e8f4e8","#e8f0f8","#fdf6e8","#f8e8f0","#f0e8f8","#fdf0f0"].map(c=>(
<button key={c} onClick={()=>setNewNote(p=>({...p,color:c}))}
style={{width:20,height:20,borderRadius:"50%",background:c,border:newNote.color===c?"3px solid #334155":"2px solid #c8d4e0",cursor:"pointer",padding:0}}/>
))}
</div>
<button onClick={addNote} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ הוסף רשומה</button>
</div>
{(data.notes||[]).length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:30}}>אין רשומות עדיין</div>}
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
<button onClick={()=>setEditNote(null)} style={{background:"rgba(0,0,0,.08)",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer"}}>ביטול</button>
<button onClick={saveNoteEdit} style={{background:"rgba(0,0,0,.12)",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>שמור</button>
</div>
</>
) : (
<>
{n.title&&<div style={{fontSize:14,fontWeight:700,marginBottom:4,color:"#334155"}}>{n.title}</div>}
<div style={{fontSize:13,color:"#374151",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.body}</div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
<span style={{fontSize:10,color:"rgba(0,0,0,.3)"}}>{new Date(n.createdAt).toLocaleDateString("he-IL")}</span>
<div style={{display:"flex",gap:6}}>
<button onClick={()=>setEditNote({...n})} style={{background:"rgba(0,0,0,.07)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
<button onClick={()=>deleteNote(n.id)} style={{background:"rgba(224,112,112,.1)",border:"none",borderRadius:8,padding:"4px 8px",fontSize:11,color:"#e07070",cursor:"pointer"}}>✕</button>
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
<button key={t} onClick={()=>setExportType(t)} style={{flex:1,background:exportType===t?"#fff":"rgba(255,255,255,.25)",color:exportType===t?theme.exportGradA:"#fff",border:"none",borderRadius:8,padding:"8px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
))}
</div>
{exportType==="weekly"?(
<select value={exportWeek} onChange={e=>setExportWeek(e.target.value)} style={{width:"100%",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:600,background:"rgba(255,255,255,.25)",color:"#fff",outline:"none",cursor:"pointer",marginBottom:10,boxSizing:"border-box"}}>
<option value={getWeekId()} style={{color:"#1e293b"}}>שבוע זה – {getWeekLabel(getWeekId())}</option>
{allWeeks.filter(w=>w!==getWeekId()).map(w=>(<option key={w} value={w} style={{color:"#1e293b"}}>{getWeekLabel(w)}</option>))}
</select>
):(
<select value={exportCycle} onChange={e=>setExportCycle(e.target.value)} style={{width:"100%",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:600,background:"rgba(255,255,255,.25)",color:"#fff",outline:"none",cursor:"pointer",marginBottom:10,boxSizing:"border-box"}}>
<option value={getCycleStart().toISOString().slice(0,10)} style={{color:"#1e293b"}}>מחזור נוכחי – {cycleLabel}</option>
{allCycles.filter(c=>c!==getCycleStart().toISOString().slice(0,10)).map(c=>(<option key={c} value={c} style={{color:"#1e293b"}}>{getCycleLabel(c)}</option>))}
</select>
)}
<button onClick={exportToExcel} style={{width:"100%",background:"#fff",color:theme.exportGradA,border:"none",borderRadius:8,padding:"10px",fontSize:13,fontWeight:800,cursor:"pointer"}}>
⬇️ הורד {exportType==="weekly"?"דוח שבועי":"דוח חודשי"}
</button>
{exportType==="monthly"&&<div style={{fontSize:10,color:"rgba(255,255,255,.65)",marginTop:6,textAlign:"center"}}>כולל: הוצאות + סוג · סיכום קטגוריות · פירוט שבועי · לפי אמצעי תשלום</div>}
</div>
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>💰 מקורות הכנסה</div>
{(data.incomes||[]).length===0&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>טרם הוגדרו מקורות הכנסה</div>}
{(data.incomes||[]).map(inc=>(
<div key={inc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f1f5f9"}}>
<div style={{fontSize:13,fontWeight:600,color:"#334155"}}>{inc.label}</div>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:13,fontWeight:800,color:"#6bbf8e"}}>₪{Number(inc.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>deleteIncome(inc.id)} style={{background:"#fdf0f0",border:"none",color:"#e07070",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>מחק</button>
</div>
</div>
))}
{(data.incomes||[]).length>0&&(
<div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f1f5f9"}}>
<span style={{fontSize:12,color:"#64748b"}}>סה"כ</span>
<span style={{fontSize:13,fontWeight:800,color:"#6bbf8e"}}>₪{totalMonthlyIncome.toLocaleString("he-IL")}</span>
</div>
)}
<div style={{marginTop:14,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
<div style={{fontSize:12,fontWeight:600,marginBottom:8,color:"#6b7a8d"}}>+ הוסף מקור הכנסה</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<input placeholder="שם" value={newIncome.label} onChange={e=>setNewIncome(p=>({...p,label:e.target.value}))} style={inputStyle}/>
<input type="number" placeholder="סכום ₪" value={newIncome.amount} onChange={e=>setNewIncome(p=>({...p,amount:e.target.value}))} style={inputStyle}/>
</div>
<button onClick={addIncome} style={{width:"100%",background:theme.savingsB,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>הוסף</button>
</div>
</div>
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:700,marginBottom:12}}>💳 אמצעי תשלום</div>
{(data.paymentMethods||[]).length===0&&<div style={{fontSize:12,color:"#94a3b8",marginBottom:12}}>טרם הוגדרו</div>}
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
<button onClick={()=>deletePM(pm.id)} style={{background:"#fdf0f0",border:"none",color:"#e07070",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>מחק</button>
</div>
))}
<div style={{marginTop:14,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
<div style={{fontSize:12,fontWeight:600,marginBottom:10,color:"#6b7a8d"}}>+ הוסף</div>
<div style={{display:"flex",gap:8,marginBottom:10}}>
{[["card","💳 כרטיס"],["bank","🏦 בנק"],["cash","💵 מזומן"]].map(([t,label])=>(
<button key={t} onClick={()=>setNewPM(p=>({...p,type:t,digits:""}))} style={{flex:1,background:newPM.type===t?theme.btnLight:"#f1f5f9",border:newPM.type===t?`2px solid ${theme.btn}`:"2px solid transparent",borderRadius:8,padding:"8px 4px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{label}</button>
))}
</div>
<div style={{display:"grid",gridTemplateColumns:newPM.type==="card"?"1fr 1fr":"1fr",gap:10,marginBottom:10}}>
<input placeholder={newPM.type==="card"?"שם כרטיס":newPM.type==="bank"?"שם בנק":"שם"} value={newPM.name} onChange={e=>setNewPM(p=>({...p,name:e.target.value}))} style={inputStyle}/>
{newPM.type==="card"&&<input placeholder="4 ספרות" maxLength={4} value={newPM.digits} onChange={e=>setNewPM(p=>({...p,digits:e.target.value.replace(/\D/g,"").slice(0,4)}))} style={inputStyle}/>}
</div>
<button onClick={addPaymentMethod} style={{width:"100%",background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>הוסף</button>
</div>
</div>
<div style={cardStyle}>
<div style={{fontSize:13,fontWeight:600,marginBottom:12}}>סיכום תקציב</div>
<div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>מחזור: {cycleLabel} ({Math.round(daysLeft)} ימים נותרו)</div>
{[{l:"הכנסה חודשית",v:totalMonthlyIncome,c:theme.incomeColor},{l:"הוצאות קבועות",v:totalFixed,c:"#e8b87c"},{l:"הוצאות משתנות",v:totalVariableBudget,c:theme.acc},{l:"מעקב (מזון/בלת\"מ)",v:totalVariableBudgetIncl-totalVariableBudget,c:"#a0b4c8"},{l:"נשאר לא מתוקצב",v:totalMonthlyIncome-totalBudgetIncl,c:(totalMonthlyIncome-totalBudgetIncl)>=0?theme.incomeCo<div style={{marginTop:20,borderTop:"1px solid #f1f5f9",paddingTop:16}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:4,color:theme.acc}}>מפתח Gemini API</div>
          <div style={{fontSize:11,color:"#a3b8cc",marginBottom:10}}>נדרש לזיהוי הוצאות מתמונה אוטומטית</div>
          <div style={{display:"flex",gap:8}}>
            <input type="password" value={geminiApiKey} onChange={e=>setGeminiApiKey(e.target.value)} placeholder="הדבק מפתח API" style={{flex:1,border:"1px solid #dde4ed",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}} />
            <button onClick={()=>{localStorage.setItem("gemini_api_key",geminiApiKey);showToast("מפתח נשמר ✓","#6a9bc3");}} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer",flexShrink:0}}>שמור</button>
          </div>
        </div>
        lor:"#e07070"}].map(x=>(
<div key={x.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
<span style={{fontSize:13,color:"#6b7a8d"}}>{x.l}</span>
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
style={{background:`linear-gradient(135deg,${t.a},${t.b})`,border:(data.theme||"pastel")===key?"3px solid #fff":"3px solid transparent",borderRadius:12,padding:"12px 10px",cursor:"pointer",boxShadow:(data.theme||"pastel")===key?"0 0 0 3px "+t.b+", 0 4px 12px rgba(0,0,0,.15)":"none",transition:"all .2s"}}>
<div style={{color:"#fff",fontSize:12,fontWeight:700,textShadow:"0 1px 2px rgba(0,0,0,.2)"}}>{t.name}</div>
</button>
))}
</div>
</div>
<button onClick={()=>{ save({...data, monthlyIncome:null, incomes:[]}); showToast("הכנסות אופסו ✓", "#6bbf8e"); }} style={{width:"100%",background:"#fdf6e8",color:theme.fixedText,border:`1.5px solid ${theme.fixedBg}`,borderRadius:10,padding:12,fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8}}>🔄 איפוס הכנסות בלבד</button>
<button onClick={()=>{setResetPin("");setResetError(false);setResetDialog(true);}} style={{width:"100%",background:"#fdf0f0",color:"#e07070",border:"1.5px solid #f5c6c6",borderRadius:10,padding:12,fontSize:13,fontWeight:700,cursor:"pointer"}}>🗑️ איפוס כל הנתונים</button>
</>
)}
</div>
{/* FAB */}
{view!=="add-expense"&&view!=="savings"&&view!=="notes"&&view!=="analytics"&&(
<button onClick={()=>setView("add-expense")} style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${theme.btn},${theme.a})`,color:"#fff",border:"none",borderRadius:50,padding:"14px 30px",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 6px 24px ${theme.btn}44`,zIndex:50,whiteSpace:"nowrap"}}>
+ רשום הוצאה
</button>
)}

{/* OCR FAB - on analytics */}
{view==="analytics"&&(
<button onClick={()=>{ setShowOcrModal(true); setOcrImage(null); setOcrResults([{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false},{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false},{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}]); }}
style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${theme.btn},${theme.a})`,color:"#fff",border:"none",borderRadius:50,padding:"14px 24px",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:`0 6px 24px ${theme.btn}44`,zIndex:50,whiteSpace:"nowrap"}}>
📷 העלה תמונה
</button>
)}

{/* Reset dialog */}
{resetDialog&&(
<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
<div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:320,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
<div style={{fontSize:22,textAlign:"center",marginBottom:8}}>🔐</div>
<div style={{fontSize:15,fontWeight:800,textAlign:"center",color:"#334155",marginBottom:4}}>איפוס נתונים</div>
<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",marginBottom:20}}>פעולה זו תמחק את כל הנתונים</div>
<input type="password" placeholder="סיסמה לאישור" value={resetPin} onChange={e=>{setResetPin(e.target.value);setResetError(false);}}
style={{width:"100%",border:resetError?"2px solid #e07070":"1.5px solid #dde4ed",borderRadius:10,padding:"12px",fontSize:16,textAlign:"center",outline:"none",boxSizing:"border-box",marginBottom:6,letterSpacing:4}} autoFocus/>
{resetError&&<div style={{fontSize:11,color:"#e07070",textAlign:"center",marginBottom:10}}>סיסמה שגויה</div>}
{!resetError&&<div style={{marginBottom:10}}/>}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<button onClick={()=>setResetDialog(false)} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>ביטול</button>
<button onClick={()=>{if(resetPin==="1003"){localStorage.removeItem(STORAGE_KEY);setData(DEFAULT_STATE);setResetDialog(false);setResetPin("");showToast("הנתונים אופסו","#e07070");}else{setResetError(true);setResetPin("");}}}
style={{background:"#e07070",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>אפס</button>
</div>
</div>
</div>
)}

{/* Add/Edit expense sheet */}
{(view==="add-expense"||editExpense)&&(
<div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderRadius:"20px 20px 0 0",padding:24,boxShadow:"0 -8px 40px rgba(0,0,0,.1)",zIndex:100,maxWidth:480,margin:"0 auto"}}>
<div style={{width:36,height:4,background:"#dde4ed",borderRadius:2,margin:"0 auto 20px"}}/>
<div style={{fontSize:16,fontWeight:700,marginBottom:16}}>{editExpense?"✏️ עריכת הוצאה":"רישום הוצאה"}</div>
{(()=>{
const exp = editExpense || newExpense;
const setExp = editExpense ? (fn) => setEditExpense(prev => fn(prev)) : (fn) => setNewExpense(prev => fn(prev));
return (<>
<select value={exp.bucketId} onChange={e=>setExp(p=>({...p,bucketId:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
<option value="">בחר קטגוריה</option>
{data.variableBuckets.length>0&&<optgroup label="משתנות">{data.variableBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
{data.fixedBuckets.length>0&&<optgroup label="קבועות">{data.fixedBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
</select>
{(data.paymentMethods||[]).length>0&&(
<select value={exp.paymentMethodId} onChange={e=>setExp(p=>({...p,paymentMethodId:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:14}}>
<option value="">אמצעי תשלום (אופציונלי)</option>
{data.paymentMethods.map(pm=>(<option key={pm.id} value={pm.id}>{pm.type==="card"?`💳 ${pm.name} ****${pm.digits}`:pm.type==="bank"?`🏦 ${pm.name}`:`💵 ${pm.name}`}</option>))}
</select>
)}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
<input type="number" placeholder="סכום ₪" value={exp.amount} onChange={e=>setExp(p=>({...p,amount:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
<input type="date" value={exp.date} onChange={e=>setExp(p=>({...p,date:e.target.value}))} style={{...inputStyle,fontSize:14}}/>
</div>
<input placeholder="הערה (אופציונלי)" value={exp.note} onChange={e=>setExp(p=>({...p,note:e.target.value}))} style={{...inputStyle,width:"100%",marginBottom:10,fontSize:14,boxSizing:"border-box"}}/>
<div onClick={()=>setExp(p=>({...p,recurring:!p.recurring}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:14,background:exp.recurring?"#edf7f1":"#f4f7fb",border:exp.recurring?"1.5px solid #a8d5ba":"1.5px solid #dde4ed",borderRadius:8,cursor:"pointer",userSelect:"none"}}>
<span style={{fontSize:14}}>🔄</span>
<span style={{fontSize:12,fontWeight:600,color:exp.recurring?"#3d7a55":"#6b7a8d",flex:1}}>הוצאה מחזורית — תחזור כל חודש אוטומטית</span>
<div style={{width:32,height:18,background:exp.recurring?"#6bbf8e":"#dde4ed",borderRadius:9,position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:exp.recurring?14:2,width:14,height:14,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<button onClick={()=>{editExpense?setEditExpense(null):setView("dashboard");}} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:600,cursor:"pointer"}}>ביטול</button>
<button onClick={()=>{editExpense?saveExpenseEdit():addExpense();}} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:"pointer"}}>{editExpense?"עדכן":"שמור"}</button>
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
<div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>סה"כ: ₪{selectedDay.daySpend.toLocaleString("he-IL")}</div>
</div>
<button onClick={()=>setSelectedDay(null)} style={{background:"#f1f5f9",border:"none",borderRadius:10,width:32,height:32,fontSize:16,cursor:"pointer",color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
</div>
{selectedDay.expenses.length===0
?<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:24}}>אין הוצאות ביום זה</div>
:<div>
{selectedDay.expenses.map(e=>(
<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
<div style={{flex:1}}>
<div style={{fontSize:13,fontWeight:700,color:"#334155"}}>{getBucketName(e.bucketId)}</div>
{e.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{e.note}</div>}
<div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
<span style={{fontSize:10,background:fixedBucketIds.has(e.bucketId)?"#fdf6e8":"#eef4fb",color:fixedBucketIds.has(e.bucketId)?"#b07020":"#4a7fa5",padding:"1px 5px",borderRadius:3}}>{fixedBucketIds.has(e.bucketId)?"קבועה":"משתנה"}</span>
{e.paymentMethodId&&<span style={{fontSize:10,color:theme.acc}}>{getPMLabel(e.paymentMethodId)}</span>}
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:8,marginRight:4}}>
<span style={{fontWeight:800,color:"#e07070",fontSize:15}}>₪{Number(e.amount).toLocaleString("he-IL")}</span>
<button onClick={()=>{setEditExpense({...e});setSelectedDay(null);}} style={{background:theme.btnLight,border:"none",color:theme.btn,borderRadius:7,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
</div>
</div>
))}
<div style={{marginTop:14,padding:"10px 14px",background:theme.light,borderRadius:10,display:"flex",justifyContent:"space-between"}}>
<span style={{fontSize:12,color:"#64748b"}}>סה"כ יום</span>
<span style={{fontSize:13,fontWeight:800,color:theme.acc}}>₪{selectedDay.daySpend.toLocaleString("he-IL")}</span>
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
<div style={{fontSize:16,fontWeight:700,marginBottom:12}}>📷 העלאת תמונה מכרטיס אשראי</div>
{!ocrImage?(
<>
<div style={{border:"2px dashed "+theme.btn,borderRadius:12,padding:"30px 20px",textAlign:"center",marginBottom:16,cursor:"pointer",background:theme.light}} onClick={()=>ocrFileRef.current?.click()}>
<div style={{fontSize:32,marginBottom:8}}>📄</div>
<div style={{fontSize:13,color:theme.acc,fontWeight:600}}>לחץ להעלאת תמונה</div>
<div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>JPG, PNG, PDF</div>
</div>
<input ref={ocrFileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>handleOcrUpload(e.target.files[0])}/>
</>
):(
<>
<img src={ocrImage} style={{width:"100%",borderRadius:10,marginBottom:12,maxHeight:200,objectFit:"cover"}} alt="credit card statement"/>
<div style={{fontSize:12,color:"#6b7a8d",marginBottom:12}}>סמן את ההוצאות שברצונך להוסיף ומלא פרטים:</div>
{ocrResults.map((r,i)=>(
<div key={i} style={{border:`1.5px solid ${r.confirmed?theme.btn:"#dde4ed"}`,borderRadius:10,padding:"10px 12px",marginBottom:8,background:r.confirmed?theme.light:"#fff"}}>
<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
<input type="checkbox" checked={r.confirmed} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,confirmed:e.target.checked}:x))} style={{width:16,height:16}}/>
<span style={{fontSize:12,fontWeight:700,color:r.confirmed?theme.acc:"#94a3b8"}}>הוצאה {i+1}</span>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<input type="number" placeholder="סכום ₪" value={r.amount} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,amount:e.target.value}:x))} style={{...inputStyle,fontSize:13}}/>
<input type="date" value={r.date} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,date:e.target.value}:x))} style={{...inputStyle,fontSize:13}}/>
</div>
<select value={r.bucketId} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,bucketId:e.target.value}:x))} style={{...inputStyle,width:"100%",marginBottom:8,boxSizing:"border-box",fontSize:13}}>
<option value="">קטגוריה</option>
{data.variableBuckets.length>0&&<optgroup label="משתנות">{data.variableBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
{data.fixedBuckets.length>0&&<optgroup label="קבועות">{data.fixedBuckets.map(b=><option key={b.id} value={b.id}>{ICONS[b.icon]} {b.name}</option>)}</optgroup>}
</select>
<input placeholder="הערה" value={r.note} onChange={e=>setOcrResults(prev=>prev.map((x,j)=>j===i?{...x,note:e.target.value}:x))} style={{...inputStyle,width:"100%",boxSizing:"border-box",fontSize:13}}/>
</div>
))}
<button onClick={()=>setOcrResults(p=>[...p,{amount:"",date:new Date().toISOString().slice(0,10),note:"",bucketId:"",confirmed:false}])}
style={{width:"100%",background:"#f4f7fb",color:"#6b7a8d",border:"1.5px solid #dde4ed",borderRadius:8,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:10}}>
+ הוסף שורה
</button>
</>
)}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}}>
<button onClick={()=>{setShowOcrModal(false);setOcrImage(null);setOcrResults([]);}} style={{background:"#f1f5f9",color:"#64748b",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:600,cursor:"pointer"}}>ביטול</button>
{ocrImage&&<button onClick={confirmOcrExpenses} style={{background:theme.btn,color:"#fff",border:"none",borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:"pointer"}}>אשר הוצאות</button>}
</div>
</div>
</div>
)}
</div>
);
}
