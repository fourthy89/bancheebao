import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth.jsx";
import ExpenseTracker from "./App.jsx";

const inkColor = "#20304a";
const paper = "#f4efe3";

export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = ยังไม่รู้, null = ไม่ได้ login, object = login แล้ว

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ยังโหลด session อยู่
  if (session === undefined) {
    return (
      <div
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Segoe UI', Roboto, sans-serif",
          background: paper,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: inkColor,
        }}
      >
        กำลังโหลด...
      </div>
    );
  }

  // ยังไม่ได้ login -> ไปหน้า Auth
  if (!session) {
    return <Auth />;
  }

  // login แล้ว -> ไปหน้าแอปหลัก พร้อมส่ง session/logout ลงไป
  return <ExpenseTracker session={session} onLogout={() => supabase.auth.signOut()} />;
}
