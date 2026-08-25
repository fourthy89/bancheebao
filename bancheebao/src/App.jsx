import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";

const EXPENSE_CATS = ["อาหาร", "เดินทาง", "ที่อยู่อาศัย", "บิล", "ช้อปปิ้ง", "ของใช้ส่วนตัว", "จุกจิก", "สุขภาพ", "ความบันเทิง", "แฟน", "การศึกษา", "การลงทุน", "อื่นๆ"];
const INCOME_CATS = ["เงินเดือน", "ฟรีแลนซ์", "ธุรกิจ", "เงินปันผล", "การลงทุน", "เงินจากครอบครัว", "อื่นๆ"];
const ADMIN_UID = "f8488495-4086-45e6-a797-ee9b965006b9";

function fmt(n) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toISODate(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}
function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function fmtDateTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const datePart = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart} น.`;
}
function groupLabel(dateStr, mode) {
  const d = new Date(dateStr + "T00:00:00");
  if (mode === "day") return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  if (mode === "month") return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  return d.toLocaleDateString("th-TH", { year: "numeric" });
}
function groupKey(dateStr, mode) {
  if (mode === "day") return dateStr;
  if (mode === "month") return dateStr.slice(0, 7);
  return dateStr.slice(0, 4);
}

const UI_STATE_KEY = "bancheebao:ui-state";
function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveUiState(partial) {
  try {
    const current = loadUiState();
    localStorage.setItem(UI_STATE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch (e) {}
}

export default function ExpenseTracker({ session, onLogout }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState(() => loadUiState().type || "expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATS[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [filter, setFilter] = useState(() => loadUiState().filter || "all");
  const [groupMode, setGroupMode] = useState(() => loadUiState().groupMode || "day");
  const [selectedPeriod, setSelectedPeriod] = useState(() => loadUiState().selectedPeriod || "all");
  const [quickRange, setQuickRange] = useState(() => loadUiState().quickRange || "7d"); // "all" | "today" | "3d" | "7d"
  const [customRange, setCustomRange] = useState(() => loadUiState().customRange || null); // {start, end} | null
  const [calendarMode, setCalendarMode] = useState("single"); // "single" | "range"
  const [rangeAnchor, setRangeAnchor] = useState(null); // iso string ของวันเริ่มต้นที่กดไว้ระหว่างเลือกช่วง
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month: 0-indexed
  });
  const calendarRef = useRef(null);
  const [catView, setCatView] = useState(() => loadUiState().catView || "expense");
  const [catCollapsed, setCatCollapsed] = useState(() => loadUiState().catCollapsed || false);
  const [categoryFilter, setCategoryFilter] = useState(() => loadUiState().categoryFilter || null);
  const [error, setError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null); // entry object ที่กำลังแก้ไข หรือ null
  const [editType, setEditType] = useState("expense");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(entry) {
    setEditingEntry(entry);
    setEditType(entry.type);
    setEditAmount(String(entry.amount));
    setEditCategory(entry.category);
    setEditNote(entry.note || "");
    setEditDate(entry.date);
    setEditError("");
  }

  function closeEdit() {
    setEditingEntry(null);
  }

  async function saveEdit() {
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) {
      setEditError("กรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setEditError("");
    setEditSaving(true);
    const { data, error: updateError } = await supabase
      .from("entries")
      .update({
        type: editType,
        amount: Math.round(amt * 100) / 100,
        category: editCategory,
        note: editNote.trim(),
        date: editDate,
      })
      .eq("id", editingEntry.id)
      .select()
      .single();
    setEditSaving(false);
    if (updateError) {
      setEditError(
        isAuthError(updateError)
          ? "เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
          : "บันทึกการแก้ไขไม่สำเร็จ: " + updateError.message
      );
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
    setEditingEntry(null);
  }
  const isAdmin = session?.user?.id === ADMIN_UID;
  const [viewMode, setViewMode] = useState(() => (isAdmin && loadUiState().viewMode === "admin" ? "admin" : "user"));
  const [adminEntries, setAdminEntries] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const skipPeriodReset = useRef(true);

  async function loadAdminEntries() {
    setAdminLoading(true);
    setAdminError("");
    const { data, error: adminFetchError } = await supabase.rpc("get_admin_entries");
    if (adminFetchError) {
      setAdminError("โหลดข้อมูลแอดมินไม่สำเร็จ: " + adminFetchError.message);
    } else {
      setAdminEntries(data || []);
    }
    setAdminLoading(false);
  }

  function openAdminView() {
    setViewMode("admin");
    loadAdminEntries();
  }

  function isAuthError(err) {
    if (!err) return false;
    const msg = (err.message || "").toLowerCase();
    return err.status === 401 || msg.includes("jwt") || msg.includes("token") || msg.includes("auth");
  }

  async function loadEntries() {
    setNetworkError("");
    const { data, error: fetchError } = await supabase
      .from("entries")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (fetchError) {
      setNetworkError(
        isAuthError(fetchError)
          ? "เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
          : "โหลดข้อมูลไม่สำเร็จ: " + fetchError.message
      );
    } else {
      setEntries(data || []);
    }
    setLoaded(true);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    setCategory(type === "expense" ? EXPENSE_CATS[0] : INCOME_CATS[0]);
  }, [type]);

  useEffect(() => {
    if (skipPeriodReset.current) {
      skipPeriodReset.current = false;
      return;
    }
    setSelectedPeriod("all");
  }, [groupMode]);

  useEffect(() => {
    saveUiState({ type, filter, groupMode, selectedPeriod, quickRange, customRange, catView, catCollapsed, categoryFilter, viewMode: isAdmin ? viewMode : "user" });
  }, [type, filter, groupMode, selectedPeriod, quickRange, customRange, catView, catCollapsed, categoryFilter, viewMode, isAdmin]);

  useEffect(() => {
    if (isAdmin && viewMode === "admin") {
      loadAdminEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredList = useMemo(() => {
    let list = [...entries];
    if (customRange) {
      list = list.filter((e) => e.date >= customRange.start && e.date <= customRange.end);
    } else if (quickRange === "today") list = list.filter((e) => e.date === todayStr());
    else if (quickRange === "3d") list = list.filter((e) => e.date >= daysAgoStr(2));
    else if (quickRange === "7d") list = list.filter((e) => e.date >= daysAgoStr(6));
    else if (selectedPeriod !== "all") list = list.filter((e) => groupKey(e.date, groupMode) === selectedPeriod);
    if (filter !== "all") list = list.filter((e) => e.type === filter);
    if (categoryFilter) list = list.filter((e) => e.type === categoryFilter.type && e.category === categoryFilter.category);
    return list;
  }, [entries, filter, groupMode, selectedPeriod, quickRange, customRange, categoryFilter]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of filteredList) {
      if (e.type === "income") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense, balance: income - expense };
  }, [filteredList]);

  const entriesDatesSet = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);

  useEffect(() => {
    if (!calendarOpen) return;
    function handleClickOutside(ev) {
      if (calendarRef.current && !calendarRef.current.contains(ev.target)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  const periodOptions = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = groupKey(e.date, groupMode);
      if (!map.has(key)) map.set(key, groupLabel(e.date, groupMode));
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries, groupMode]);

  const grouped = useMemo(() => {
    let list = [...filteredList];
    list.sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at));
    const map = new Map();
    for (const e of list) {
      const key = groupKey(e.date, groupMode);
      if (!map.has(key)) map.set(key, { key, label: groupLabel(e.date, groupMode), items: [], income: 0, expense: 0 });
      const g = map.get(key);
      g.items.push(e);
      if (e.type === "income") g.income += e.amount; else g.expense += e.amount;
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredList, groupMode]);

  const pendingEntry = useMemo(
    () => entries.find((e) => e.id === pendingDeleteId) || null,
    [entries, pendingDeleteId]
  );

  const adminGrouped = useMemo(() => {
    const map = new Map();
    for (const e of adminEntries) {
      const key = e.email || e.user_id;
      if (!map.has(key)) map.set(key, { email: key, items: [], expense: 0, income: 0 });
      const g = map.get(key);
      g.items.push(e);
      if (e.type === "income") g.income += e.amount; else g.expense += e.amount;
    }
    return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [adminEntries]);

  const catSummary = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (e.type !== catView) continue;
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    }
    const arr = Array.from(map.entries()).map(([category, amount]) => ({ category, amount }));
    arr.sort((a, b) => b.amount - a.amount);
    const max = arr.length ? arr[0].amount : 0;
    return { arr, max };
  }, [entries, catView]);

  async function addEntry() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("กรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setError("");
    setNetworkError("");
    setSaving(true);
    const newEntry = {
      user_id: session.user.id,
      type,
      amount: Math.round(amt * 100) / 100,
      category,
      note: note.trim(),
      date,
    };
    const { data, error: insertError } = await supabase
      .from("entries")
      .insert(newEntry)
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setNetworkError(
        isAuthError(insertError)
          ? "เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
          : "บันทึกรายการไม่สำเร็จ: " + insertError.message
      );
      return;
    }
    setEntries((prev) => [data, ...prev]);
    setAmount(""); setNote("");
  }

  function requestDelete(id) {
    if (deletingId) return; // กันกดลบซ้ำระหว่างที่รายการก่อนหน้ายังลบไม่เสร็จ
    setPendingDeleteId(id);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    const prevEntries = entries;
    setDeletingId(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setNetworkError("");
    const { error: deleteError } = await supabase.from("entries").delete().eq("id", id);
    setDeletingId(null);
    if (deleteError) {
      setNetworkError(
        isAuthError(deleteError)
          ? "เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
          : "ลบรายการไม่สำเร็จ: " + deleteError.message
      );
      setEntries(prevEntries);
    }
  }

  const inkColor = "#20304a";
  const paper = "#f4efe3";
  const gold = "#9c7a34";
  const catColor = catView === "expense" ? "#b0413e" : "#2f6e51";

  if (!loaded) {
    return (
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Segoe UI', Roboto, sans-serif", background: paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: inkColor }}>
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Segoe UI', Roboto, sans-serif", background: paper, minHeight: "100vh", padding: "20px 14px", color: inkColor, boxSizing: "border-box", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }}>
      <style>{`
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
        .et-wrap { max-width: 980px; margin: 0 auto; }
        .et-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 800px) {
          .et-grid { grid-template-columns: 340px 1fr; align-items: start; }
        }
        .et-input { width: 100%; padding: 10px 11px; border-radius: 6px; border: 1px solid #cbbf9e; font-family: inherit; box-sizing: border-box; font-size: 15px; }
        .et-select { width: 100%; padding: 10px 32px 10px 11px; border-radius: 6px; border: 1px solid #cbbf9e; font-family: inherit; box-sizing: border-box; font-size: 15px; appearance: none; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2320304a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 11px center; }
        .et-btn { cursor: pointer; font-family: inherit; }
        .et-modal-overlay { position: fixed; inset: 0; background: rgba(32,48,74,0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; box-sizing: border-box; animation: et-fade-in 0.15s ease-out; }
        .et-modal-card { background: #fff; border-radius: 12px; max-width: 360px; width: 100%; padding: 24px; box-sizing: border-box; box-shadow: 0 12px 32px rgba(32,48,74,0.25); animation: et-pop-in 0.18s ease-out; }
        @keyframes et-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes et-pop-in { from { opacity: 0; transform: scale(0.96) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      <div className="et-wrap">
        {session && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginBottom: 8, fontSize: 13 }}>
            {isAdmin && (
              <button
                className="et-btn"
                onClick={() => (viewMode === "admin" ? setViewMode("user") : openAdminView())}
                style={{ border: "1px solid #9c7a34", background: viewMode === "admin" ? "#9c7a34" : "#fff", color: viewMode === "admin" ? "#fff" : "#9c7a34", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 700 }}
              >
                {viewMode === "admin" ? "กลับหน้าหลัก" : "มุมมองแอดมิน"}
              </button>
            )}
            <span style={{ color: "#5a5240" }}>{session.user?.email}</span>
            <button
              className="et-btn"
              onClick={onLogout}
              style={{ border: "1px solid #cbbf9e", background: "#fff", color: inkColor, borderRadius: 6, padding: "5px 12px", fontSize: 13 }}
            >
              ออกจากระบบ
            </button>
          </div>
        )}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: 3, color: gold, marginBottom: 4 }}>BANCHEEBAO · สมุดบัญชี</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{viewMode === "admin" ? "มุมมองแอดมิน · ทุกรายการ" : "บัญชีรายรับรายจ่าย"}</div>
        </div>

        {viewMode === "admin" ? (
          <div>
            {adminError && (
              <div style={{ background: "#fdecea", border: "1px solid #e19a92", color: "#b0413e", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                {adminError}
              </div>
            )}
            {adminLoading && (
              <div style={{ textAlign: "center", padding: 24, color: "#9a8f6f", fontSize: 14 }}>กำลังโหลดข้อมูลทุกบัญชี...</div>
            )}
            {!adminLoading && !adminError && adminEntries.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, padding: 24, textAlign: "center", color: "#9a8f6f", fontSize: 14 }}>
                ยังไม่มีรายการในระบบ
              </div>
            )}
            {!adminLoading && adminEntries.length > 0 && adminGrouped.map((g) => (
              <div key={g.email} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: inkColor }}>📧 {g.email}</span>
                  <span style={{ fontSize: 12, color: "#7a7259" }}>
                    <span style={{ color: "#2f6e51" }}>+{fmt(g.income)}</span>{"  "}
                    <span style={{ color: "#b0413e" }}>-{fmt(g.expense)}</span>
                  </span>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, overflow: "hidden" }}>
                  {g.items.map((e, i) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderTop: i === 0 ? "none" : "1px dashed #e2d9c3" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{e.category}</div>
                        <div style={{ fontSize: 12, color: "#9a8f6f" }}>{e.note} {fmtDateTime(e.created_at)}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: e.type === "income" ? "#2f6e51" : "#b0413e" }}>
                        {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <>
        {networkError && (
          <div style={{ background: "#fdecea", border: "1px solid #e19a92", color: "#b0413e", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
            {networkError}
          </div>
        )}

        <div className="et-grid">
          <div>
            <div style={{ background: inkColor, color: paper, borderRadius: 10, padding: "18px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>รายรับ</div>
                  <div style={{ fontSize: 17, color: "#8fd19e" }}>+{fmt(totals.income)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7, textAlign: "right" }}>รายจ่าย</div>
                  <div style={{ fontSize: 17, color: "#e19a92", textAlign: "right" }}>-{fmt(totals.expense)}</div>
                </div>
              </div>
              <div style={{ borderTop: "1px dashed rgba(244,239,227,0.3)", margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>ยอดคงเหลือ</span>
                <span style={{ fontSize: 24, color: gold }}>{fmt(totals.balance)} ฿</span>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button className="et-btn" onClick={() => setType("expense")} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: type === "expense" ? "#b0413e" : "transparent", color: type === "expense" ? "#fff" : inkColor, fontWeight: 700 }}>รายจ่าย</button>
                <button className="et-btn" onClick={() => setType("income")} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: type === "income" ? "#2f6e51" : "transparent", color: type === "income" ? "#fff" : inkColor, fontWeight: 700 }}>รายรับ</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input className="et-input" type="number" placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <input className="et-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 150 }} />
              </div>
              <select className="et-select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginBottom: 10 }}>
                {(type === "expense" ? EXPENSE_CATS : INCOME_CATS).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="et-input" type="text" placeholder="โน้ต (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 12 }} />
              {error && <div style={{ color: "#b0413e", fontSize: 13, marginBottom: 8 }}>{error}</div>}
              <button className="et-btn" onClick={addEntry} disabled={saving} style={{ width: "100%", padding: "11px 0", borderRadius: 6, border: "none", background: gold, color: "#fff", fontWeight: 700, fontSize: 15, opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}>{saving ? "กำลังบันทึก..." : "บันทึกรายการ"}</button>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: catCollapsed ? 0 : 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => setCatCollapsed(!catCollapsed)}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>สรุปตามหมวดหมู่</span>
                  <span style={{ fontSize: 11, color: "#9a8f6f", transform: catCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▼</span>
                </div>
                {!catCollapsed && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="et-btn" onClick={() => setCatView("expense")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, border: "1px solid #cbbf9e", background: catView === "expense" ? "#b0413e" : "transparent", color: catView === "expense" ? "#fff" : inkColor }}>จ่าย</button>
                  <button className="et-btn" onClick={() => setCatView("income")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, border: "1px solid #cbbf9e", background: catView === "income" ? "#2f6e51" : "transparent", color: catView === "income" ? "#fff" : inkColor }}>รับ</button>
                </div>
                )}
              </div>
              {!catCollapsed && <>
              {catSummary.arr.length === 0 && <div style={{ fontSize: 13, color: "#9a8f6f" }}>ยังไม่มีข้อมูล</div>}
              {catSummary.arr.map((c) => {
                const isActive = categoryFilter && categoryFilter.type === catView && categoryFilter.category === c.category;
                return (
                <div
                  key={c.category}
                  onClick={() => setCategoryFilter(isActive ? null : { type: catView, category: c.category })}
                  style={{ marginBottom: 8, cursor: "pointer", padding: "4px 6px", margin: "-4px -6px 4px -6px", borderRadius: 6, background: isActive ? "#f0e4c4" : "transparent" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                    <span style={{ fontWeight: isActive ? 700 : 400, color: isActive ? gold : inkColor }}>{isActive ? "● " : ""}{c.category}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  </div>
                  <div style={{ height: 6, background: "#efe9d8", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${catSummary.max ? (c.amount / catSummary.max) * 100 : 0}%`, background: catColor, borderRadius: 3 }} />
                  </div>
                </div>
                );
              })}
              {categoryFilter && (
                <button
                  className="et-btn"
                  onClick={() => setCategoryFilter(null)}
                  style={{ marginTop: 4, fontSize: 12, padding: "4px 10px", borderRadius: 14, border: "1px solid #cbbf9e", background: "transparent", color: inkColor }}
                >
                  ล้างตัวกรองหมวดหมู่
                </button>
              )}
              </>}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "#9a8f6f", alignSelf: "center", marginRight: 2 }}>แสดง:</span>
              {[["today", "วันนี้"], ["3d", "3 วันล่าสุด"], ["7d", "7 วันล่าสุด"], ["all", "ทั้งหมด"]].map(([k, l]) => (
                <button key={k} className="et-btn" onClick={() => { setQuickRange(k); setSelectedPeriod("all"); setCustomRange(null); setCategoryFilter(null); }} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #cbbf9e", background: quickRange === k ? inkColor : "transparent", color: quickRange === k ? "#fff" : inkColor, fontSize: 12 }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {[["all", "ทั้งหมด"], ["income", "รายรับ"], ["expense", "รายจ่าย"]].map(([k, l]) => (
                <button key={k} className="et-btn" onClick={() => { setFilter(k); setCategoryFilter(null); }} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #cbbf9e", background: filter === k ? inkColor : "transparent", color: filter === k ? "#fff" : inkColor, fontSize: 13 }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
                {[["day", "รายวัน"], ["month", "รายเดือน"], ["year", "รายปี"]].map(([k, l]) => (
                  <button key={k} className="et-btn" onClick={() => setGroupMode(k)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #cbbf9e", background: groupMode === k ? gold : "transparent", color: groupMode === k ? "#fff" : inkColor, fontSize: 13 }}>{l}</button>
                ))}
                {groupMode === "day" ? (
                  <div ref={calendarRef} style={{ position: "relative" }}>
                    <button
                      className="et-btn"
                      onClick={() => {
                        if (!calendarOpen) {
                          const anchorDate = customRange ? customRange.start : selectedPeriod !== "all" ? selectedPeriod : null;
                          if (anchorDate) {
                            const d = new Date(anchorDate + "T00:00:00");
                            setCalendarView({ year: d.getFullYear(), month: d.getMonth() });
                          }
                        }
                        setCalendarOpen((v) => !v);
                      }}
                      style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #cbbf9e", background: (selectedPeriod !== "all" || customRange) ? gold : "transparent", color: (selectedPeriod !== "all" || customRange) ? "#fff" : inkColor, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      📅 {customRange ? `${groupLabel(customRange.start, "day")} - ${groupLabel(customRange.end, "day")}` : selectedPeriod === "all" ? "ทุกวัน" : groupLabel(selectedPeriod, "day")}
                    </button>
                    {calendarOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, boxShadow: "0 8px 24px rgba(32,48,74,0.18)", padding: 14, width: 260 }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                          <button className="et-btn" onClick={() => { setCalendarMode("single"); setRangeAnchor(null); }} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: calendarMode === "single" ? inkColor : "transparent", color: calendarMode === "single" ? "#fff" : inkColor, fontSize: 12 }}>วันเดียว</button>
                          <button className="et-btn" onClick={() => { setCalendarMode("range"); setRangeAnchor(null); }} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: calendarMode === "range" ? inkColor : "transparent", color: calendarMode === "range" ? "#fff" : inkColor, fontSize: 12 }}>ช่วงวันที่</button>
                        </div>
                        {calendarMode === "range" && (
                          <div style={{ fontSize: 11, color: "#9a8f6f", marginBottom: 8, textAlign: "center" }}>
                            {rangeAnchor ? `เลือกวันสิ้นสุด (เริ่ม ${groupLabel(rangeAnchor, "day")})` : "เลือกวันเริ่มต้น"}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <button className="et-btn" onClick={() => setCalendarView((v) => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })} style={{ border: "none", background: "transparent", color: inkColor, fontSize: 16, padding: 4 }}>‹</button>
                          <div style={{ fontSize: 14, fontWeight: 700, color: inkColor }}>
                            {THAI_MONTHS_SHORT[calendarView.month]} {calendarView.year + 543}
                          </div>
                          <button className="et-btn" onClick={() => setCalendarView((v) => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })} style={{ border: "none", background: "transparent", color: inkColor, fontSize: 16, padding: 4 }}>›</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                          {THAI_WEEKDAYS.map((w) => (
                            <div key={w} style={{ textAlign: "center", fontSize: 11, color: "#9a8f6f", padding: "2px 0" }}>{w}</div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                          {buildMonthGrid(calendarView.year, calendarView.month).map((day, idx) => {
                            if (day === null) return <div key={idx} />;
                            const iso = toISODate(calendarView.year, calendarView.month, day);
                            const isToday = iso === todayStr();
                            const hasEntry = entriesDatesSet.has(iso);
                            const isSingleSelected = calendarMode === "single" && selectedPeriod === iso;
                            const isRangeAnchor = calendarMode === "range" && rangeAnchor === iso;
                            const inRange = calendarMode === "range" && customRange && iso >= customRange.start && iso <= customRange.end;
                            const isRangeEdge = calendarMode === "range" && customRange && (iso === customRange.start || iso === customRange.end);
                            const isSelected = isSingleSelected || isRangeAnchor || isRangeEdge;
                            return (
                              <button
                                key={idx}
                                className="et-btn"
                                onClick={() => {
                                  if (calendarMode === "single") {
                                    setSelectedPeriod(iso);
                                    setQuickRange("all");
                                    setCustomRange(null);
                                    setCategoryFilter(null);
                                    setCalendarOpen(false);
                                  } else {
                                    if (!rangeAnchor) {
                                      setRangeAnchor(iso);
                                    } else {
                                      const start = iso < rangeAnchor ? iso : rangeAnchor;
                                      const end = iso < rangeAnchor ? rangeAnchor : iso;
                                      setCustomRange({ start, end });
                                      setQuickRange("all");
                                      setSelectedPeriod("all");
                                      setCategoryFilter(null);
                                      setRangeAnchor(null);
                                      setCalendarOpen(false);
                                    }
                                  }
                                }}
                                style={{
                                  aspectRatio: "1",
                                  border: isToday && !isSelected ? "1px solid #9c7a34" : "1px solid transparent",
                                  borderRadius: inRange && !isRangeEdge ? 0 : 6,
                                  background: isSelected ? gold : inRange ? "#f0e4c4" : "transparent",
                                  color: isSelected ? "#fff" : inkColor,
                                  fontSize: 12,
                                  position: "relative",
                                  padding: 0,
                                }}
                              >
                                {day}
                                {hasEntry && !isSelected && (
                                  <span style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#9c7a34" }} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          className="et-btn"
                          onClick={() => { setSelectedPeriod("all"); setCustomRange(null); setCategoryFilter(null); setRangeAnchor(null); setCalendarOpen(false); }}
                          style={{ width: "100%", marginTop: 10, padding: "7px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: "transparent", color: inkColor, fontSize: 13 }}
                        >
                          ทั้งหมด (ล้างตัวเลือก)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    className="et-select"
                    value={selectedPeriod}
                    onChange={(e) => { setSelectedPeriod(e.target.value); setQuickRange("all"); setCustomRange(null); setCategoryFilter(null); }}
                    style={{ width: "auto", minWidth: 140, padding: "6px 30px 6px 12px", fontSize: 13 }}
                  >
                    <option value="all">ทุกช่วงเวลา</option>
                    {periodOptions.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                )}
              </div>

            {entries.length > 0 && grouped.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, padding: 24, textAlign: "center", color: "#9a8f6f", fontSize: 14, marginBottom: 16 }}>
                ไม่มีรายการในช่วงเวลาที่เลือก ลองเปลี่ยนตัวกรอง "แสดง" หรือ "ช่วงเวลา" ดูครับ
              </div>
            )}

            {entries.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, padding: 24, textAlign: "center", color: "#9a8f6f", fontSize: 14 }}>
                ยังไม่มีรายการ เริ่มบันทึกรายการแรกได้เลย
              </div>
            )}

            {grouped.map((g) => (
              <div key={g.key} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: gold }}>{g.label}</span>
                  <span style={{ fontSize: 12, color: "#7a7259" }}>
                    <span style={{ color: "#2f6e51" }}>+{fmt(g.income)}</span>{"  "}
                    <span style={{ color: "#b0413e" }}>-{fmt(g.expense)}</span>
                  </span>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, overflow: "hidden" }}>
                  {g.items.map((e, i) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderTop: i === 0 ? "none" : "1px dashed #e2d9c3" }}>
                      <div style={{ cursor: "pointer" }} onClick={() => openEdit(e)}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: inkColor, textDecoration: "underline", textDecorationColor: "#e2d9c3", textUnderlineOffset: 3 }}>{e.category}</div>
                        <div style={{ fontSize: 12, color: "#9a8f6f" }}>{e.note}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: e.type === "income" ? "#2f6e51" : "#b0413e" }}>
                          {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                        </div>
                        <button className="et-btn" onClick={() => requestDelete(e.id)} disabled={deletingId !== null} aria-label="ลบรายการ" style={{ border: "none", background: "transparent", color: "#b0a688", fontSize: 16, padding: 4, opacity: deletingId === e.id ? 0.4 : deletingId !== null ? 0.7 : 1, cursor: deletingId !== null ? "default" : "pointer" }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#b0a688", marginTop: 16 }}>
          ข้อมูลถูกบันทึกไว้ในระบบฐานข้อมูลของคุณโดยอัตโนมัติ
        </div>
        </>
        )}
      </div>

      {pendingEntry && (
        <div className="et-modal-overlay" onClick={cancelDelete}>
          <div className="et-modal-card" onClick={(ev) => ev.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>ยืนยันลบรายการ</div>
            <div style={{ fontSize: 14, color: "#5a5240", marginBottom: 4 }}>
              การลบไม่สามารถย้อนกลับได้ ต้องการลบรายการนี้ใช่ไหม?
            </div>
            <div style={{ background: paper, borderRadius: 8, padding: "10px 14px", margin: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{pendingEntry.category}</div>
                {pendingEntry.note && <div style={{ fontSize: 12, color: "#9a8f6f" }}>{pendingEntry.note}</div>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: pendingEntry.type === "income" ? "#2f6e51" : "#b0413e" }}>
                {pendingEntry.type === "income" ? "+" : "-"}{fmt(pendingEntry.amount)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="et-btn" onClick={cancelDelete} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: "transparent", color: inkColor, fontWeight: 700, fontSize: 14 }}>
                ยกเลิก
              </button>
              <button className="et-btn" onClick={confirmDelete} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "none", background: "#b0413e", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEntry && (
        <div className="et-modal-overlay" onClick={closeEdit}>
          <div className="et-modal-card" onClick={(ev) => ev.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>แก้ไขรายการ</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="et-btn" onClick={() => setEditType("expense")} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: editType === "expense" ? "#b0413e" : "transparent", color: editType === "expense" ? "#fff" : inkColor, fontWeight: 700 }}>รายจ่าย</button>
              <button className="et-btn" onClick={() => setEditType("income")} style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: editType === "income" ? "#2f6e51" : "transparent", color: editType === "income" ? "#fff" : inkColor, fontWeight: 700 }}>รายรับ</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input className="et-input" type="number" placeholder="จำนวนเงิน" value={editAmount} onChange={(ev) => setEditAmount(ev.target.value)} />
              <input className="et-input" type="date" value={editDate} onChange={(ev) => setEditDate(ev.target.value)} style={{ maxWidth: 150 }} />
            </div>
            <select className="et-select" value={editCategory} onChange={(ev) => setEditCategory(ev.target.value)} style={{ marginBottom: 10 }}>
              {(editType === "expense" ? EXPENSE_CATS : INCOME_CATS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="et-input" type="text" placeholder="โน้ต (ไม่บังคับ)" value={editNote} onChange={(ev) => setEditNote(ev.target.value)} style={{ marginBottom: 12 }} />
            {editError && <div style={{ color: "#b0413e", fontSize: 13, marginBottom: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="et-btn" onClick={closeEdit} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "1px solid #cbbf9e", background: "transparent", color: inkColor, fontWeight: 700, fontSize: 14 }}>
                ยกเลิก
              </button>
              <button className="et-btn" onClick={saveEdit} disabled={editSaving} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "none", background: gold, color: "#fff", fontWeight: 700, fontSize: 14, opacity: editSaving ? 0.6 : 1 }}>
                {editSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
