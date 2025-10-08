"use client";
import * as React from "react";

type Props = {
  label?: string;
  max?: number; // default 3
  onUploaded: (urls: string[]) => void;
};
export default function ImagePicker({ label = "Attach images", max = 3, onUploaded }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  const onChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr("");
    try {
      const form = new FormData();
      const toSend = Array.from(files).slice(0, max);
      toSend.forEach((f) => form.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
      if (!res.ok) {
        try { setErr((await res.json())?.error || "Upload failed"); } catch { setErr("Upload failed"); }
        return;
      }
      const data = await res.json();
      onUploaded(Array.isArray(data.urls) ? data.urls : []);
      e.currentTarget.value = ""; // reset input
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50">
        <input type="file" accept="image/*" multiple onChange={onChange} className="hidden" />
        📎 {label}
      </label>
      {busy && <span className="text-[11px] text-neutral-500">uploading…</span>}
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
