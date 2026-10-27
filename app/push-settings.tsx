"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

async function api(action: string, subscription: PushSubscription) {
  const response = await fetch("/api/push", {method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({action, subscription: subscription.toJSON()})});
  const result = await response.json() as {error?: string};
  if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
}
export default function PushSettings() {
  const [open, setOpen] = useState(false), [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [supported, setSupported] = useState(true);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupported(false); return;
    }
    let disposed = false;
    void (async () => {
      const reg = await navigator.serviceWorker.register("/sw.js", {scope: "/", updateViaCache: "none"});
      registration.current = reg;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription && Notification.permission === "granted") {
        await api("subscribe", subscription);
        if (!disposed) setActive(true);
      }
    })().catch(() => { if (!disposed) setMessage("เชื่อมต่อแจ้งเตือนไม่สำเร็จ ลองกดเปิดแจ้งเตือนอีกครั้ง"); });
    return () => { disposed = true; };
  }, []);
  async function enable() {
    setBusy(true); setMessage("");
    let created: PushSubscription | null = null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("กรุณาอนุญาตแจ้งเตือนในการตั้งค่าเว็บไซต์ของเบราว์เซอร์");
      const response = await fetch("/api/push", {cache: "no-store"});
      const config = await response.json() as {configured?: boolean; publicKey?: string};
      if (!response.ok || !config.configured || !config.publicKey) throw new Error("ระบบแจ้งเตือนยังไม่พร้อม กรุณาลองอีกครั้ง");
      await navigator.serviceWorker.register("/sw.js", {scope: "/", updateViaCache: "none"});
      const reg = await navigator.serviceWorker.ready;
      registration.current = reg;
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        const key = Uint8Array.from(atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
        subscription = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key});
        created = subscription;
      }
      await api("subscribe", subscription);
      setActive(true); setMessage("เปิดแล้ว · ลองกดทดสอบแจ้งเตือน");
    } catch (error) {
      if (created) await created.unsubscribe().catch(() => {});
      setMessage(error instanceof Error ? error.message : "เปิดแจ้งเตือนไม่สำเร็จ");
    } finally { setBusy(false); }
  }
  async function change(action: "test" | "unsubscribe") {
    setBusy(true); setMessage("");
    try {
      const subscription = await registration.current?.pushManager.getSubscription();
      if (!subscription) { setActive(false); throw new Error("กรุณาเปิดแจ้งเตือนอีกครั้ง"); }
      await api(action, subscription);
      if (action === "unsubscribe") {
        await subscription.unsubscribe();
        setActive(false); setMessage("ปิดแจ้งเตือนบนเครื่องนี้แล้ว");
      } else setMessage("ส่งคำทดสอบแล้ว · ตรวจการแจ้งเตือนของคอมพิวเตอร์");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ");
    } finally { setBusy(false); }
  }
  return <div className="push-settings">
    <button className={"button secondary push-toggle " + (active ? "push-active" : "")}
      aria-expanded={open} aria-controls="push-options" onClick={() => setOpen(!open)}>
      {active ? <Bell size={15}/> : <BellOff size={15}/>} {active ? "แจ้งเตือนเปิดอยู่" : "เปิดแจ้งเตือน"}
    </button>
    {open && <section id="push-options" className="push-options" aria-label="ตั้งค่าการแจ้งเตือน">
      <div className="push-heading"><strong>แจ้งเตือนบนเครื่องนี้</strong><button className="icon-button" aria-label="ปิดตั้งค่าแจ้งเตือน" onClick={() => setOpen(false)}><X size={17}/></button></div>
      <p>ส่งงาน / Approve · รับได้แม้ปิดแท็บเว็บ</p>
      <p className="muted">เสียงตามการตั้งค่า Windows / Mac เบราว์เซอร์อาจต้องทำงานเบื้องหลัง</p>
      {!supported ? <p role="status">โปรดเปิดใน Chrome, Edge, Firefox หรือ Safari รุ่นที่รองรับ</p> :
        <div className="push-buttons">{active ? <><button className="button primary" disabled={busy} onClick={() => void change("test")}>ทดสอบแจ้งเตือน</button><button className="button secondary" disabled={busy} onClick={() => void change("unsubscribe")}>ปิดแจ้งเตือน</button></> :
          <button className="button primary" disabled={busy} onClick={() => void enable()}>{busy ? "กำลังเปิด…" : "อนุญาตแจ้งเตือน"}</button>}</div>}
      {message && <p className="push-message" role="status">{message}</p>}
    </section>}
  </div>;
}
