import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

const EXPENSE_CATS = ["อาหาร", "เดินทาง", "ที่พัก", "ช้อปปิ้ง", "บิล", "บันเทิง", "สุขภาพ", "อื่นๆ"];
const INCOME_CATS = ["เงินเดือน", "โบนัส", "ของขวัญ", "ฟรีแลนซ์", "อื่นๆ"];

function fmt(n) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
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

export default function ExpenseTracker({ session, onLogout }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATS[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [filter, setFilter] = useState("all");
  const [groupMode, setGroupMode] = useState("day");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [catView, setCatView] = useState("expense");
  const [error, setError] = useState("");
  const [networkError, setNetworkError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

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
    setSelectedPeriod("all");
  }, [groupMode]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of entries) {
      if (e.type === "income") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense, balance: income - expense };
  }, [entries]);

  const periodOptions = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = groupKey(e.date, groupMode);
      if (!map.has(key)) map.set(key, groupLabel(e.date, groupMode));
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries, groupMode]);

  const grouped = useMemo(() => {
    let list = [...entries];
    if (filter !== "all") list = list.filter((e) => e.type === filter);
    if (selectedPeriod !== "all") list = list.filter((e) => groupKey(e.date, groupMode) === selectedPeriod);
    list.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    const map = new Map();
    for (const e of list) {
      const key = groupKey(e.date, groupMode);
      if (!map.has(key)) map.set(key, { key, label: groupLabel(e.date, groupMode), items: [], income: 0, expense: 0 });
      const g = map.get(key);
      g.items.push(e);
      if (e.type === "income") g.income += e.amount; else g.expense += e.amount;
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [entries, filter, groupMode, selectedPeriod]);

  const pendingEntry = useMemo(
    () => entries.find((e) => e.id === pendingDeleteId) || null,
    [entries, pendingDeleteId]
  );

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
          <div style={{ fontSize: 24, fontWeight: 700 }}>บัญชีรายรับรายจ่าย</div>
        </div>

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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>สรุปตามหมวดหมู่</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="et-btn" onClick={() => setCatView("expense")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, border: "1px solid #cbbf9e", background: catView === "expense" ? "#b0413e" : "transparent", color: catView === "expense" ? "#fff" : inkColor }}>จ่าย</button>
                  <button className="et-btn" onClick={() => setCatView("income")} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, border: "1px solid #cbbf9e", background: catView === "income" ? "#2f6e51" : "transparent", color: catView === "income" ? "#fff" : inkColor }}>รับ</button>
                </div>
              </div>
              {catSummary.arr.length === 0 && <div style={{ fontSize: 13, color: "#9a8f6f" }}>ยังไม่มีข้อมูล</div>}
              {catSummary.arr.map((c) => (
                <div key={c.category} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                    <span>{c.category}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(c.amount)}</span>
                  </div>
                  <div style={{ height: 6, background: "#efe9d8", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${catSummary.max ? (c.amount / catSummary.max) * 100 : 0}%`, background: catColor, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[["all", "ทั้งหมด"], ["income", "รายรับ"], ["expense", "รายจ่าย"]].map(([k, l]) => (
                  <button key={k} className="et-btn" onClick={() => setFilter(k)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #cbbf9e", background: filter === k ? inkColor : "transparent", color: filter === k ? "#fff" : inkColor, fontSize: 13 }}>{l}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {[["day", "รายวัน"], ["month", "รายเดือน"], ["year", "รายปี"]].map(([k, l]) => (
                  <button key={k} className="et-btn" onClick={() => setGroupMode(k)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #cbbf9e", background: groupMode === k ? gold : "transparent", color: groupMode === k ? "#fff" : inkColor, fontSize: 13 }}>{l}</button>
                ))}
                <select
                  className="et-select"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  style={{ width: "auto", minWidth: 140, padding: "6px 30px 6px 12px", fontSize: 13 }}
                >
                  <option value="all">ทุกช่วงเวลา</option>
                  {periodOptions.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedPeriod !== "all" && grouped.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #e2d9c3", borderRadius: 10, padding: 24, textAlign: "center", color: "#9a8f6f", fontSize: 14, marginBottom: 16 }}>
                ไม่มีรายการในช่วงเวลาที่เลือก
              </div>
            )}

            {selectedPeriod === "all" && grouped.length === 0 && (
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
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{e.category}</div>
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
    </div>
  );
}
