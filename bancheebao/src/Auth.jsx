import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const inkColor = "#20304a";
const paper = "#f4efe3";
const gold = "#9c7a34";

export default function Auth() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("สมัครสำเร็จ! ถ้าระบบเปิดยืนยันอีเมลไว้ ให้เช็คอีเมลก่อนเข้าใช้งาน");
      }
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  function translateError(msg) {
    if (!msg) return "เกิดข้อผิดพลาด กรุณาลองใหม่";
    if (msg.includes("Invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    if (msg.includes("User already registered")) return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
    if (msg.includes("Password should be at least")) return "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร";
    return msg;
  }

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Segoe UI', Roboto, sans-serif",
        background: paper,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 14px",
        boxSizing: "border-box",
        color: inkColor,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: 12,
          padding: "32px 28px",
          boxShadow: "0 8px 24px rgba(32,48,74,0.12)",
          border: "1px solid #e4dcc4",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: 3, color: gold, marginBottom: 4 }}>
            BANCHEEBAO · สมุดบัญชี
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "#5a5240" }}>
              อีเมล
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width: "100%",
                padding: "10px 11px",
                borderRadius: 6,
                border: "1px solid #cbbf9e",
                fontFamily: "inherit",
                boxSizing: "border-box",
                fontSize: 15,
              }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "#5a5240" }}>
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{
                width: "100%",
                padding: "10px 11px",
                borderRadius: 6,
                border: "1px solid #cbbf9e",
                fontFamily: "inherit",
                boxSizing: "border-box",
                fontSize: 15,
              }}
            />
          </div>

          {error && (
            <div style={{ color: "#b0413e", fontSize: 13.5, marginBottom: 14 }}>{error}</div>
          )}
          {info && (
            <div style={{ color: "#2f6e51", fontSize: 13.5, marginBottom: 14 }}>{info}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 6,
              border: "none",
              background: inkColor,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13.5 }}>
          {mode === "login" ? (
            <span>
              ยังไม่มีบัญชี?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setInfo("");
                }}
                style={{ color: gold, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, textDecoration: "underline" }}
              >
                สมัครสมาชิก
              </button>
            </span>
          ) : (
            <span>
              มีบัญชีอยู่แล้ว?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setInfo("");
                }}
                style={{ color: gold, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, textDecoration: "underline" }}
              >
                เข้าสู่ระบบ
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
