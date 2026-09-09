"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";

const embeddedButtonClass =
  "absolute right-1.5 top-1.5 bottom-1.5 rounded-full border-none bg-brand px-4 text-[0.85rem] font-bold whitespace-nowrap text-white transition-colors enabled:hover:bg-brand-hover enabled:active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50";

export default function ThankYou() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
        return;
      }

      setStatus("success");
      setMessage("Starting download…");
      window.location.href = data.downloadUrl;
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Please try again.");
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center gap-8 bg-black px-10 py-16 text-center">
      <Image
        src="/logo.png"
        alt="Intercité"
        width={140}
        height={140}
        priority
        className="h-[140px] w-[140px] object-contain"
      />

      <div className="flex max-w-[440px] flex-col gap-3">
        <h1 className="text-2xl font-bold text-white">
          Thanks for your purchase!
        </h1>
        <p className="text-[0.95rem] leading-relaxed text-white/75">
          Your download code is on its way to your inbox. Please check your
          spam.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative w-full max-w-[360px]">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Activation code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={status === "loading" || status === "success"}
          maxLength={12}
          className="h-full w-full rounded-full border border-white/25 bg-white/8 py-4 pl-5 pr-[6.5rem] text-base tracking-[0.08em] text-white backdrop-blur-md placeholder:tracking-normal placeholder:text-white/50 focus:border-brand-hover focus:outline-none"
        />
        <button
          type="submit"
          disabled={
            status === "loading" || status === "success" || !code.trim()
          }
          className={embeddedButtonClass}
        >
          {status === "loading" ? "…" : "Download"}
        </button>
      </form>

      {status === "error" && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[0.9rem] text-[#ff8080]">{message}</p>
          {message === "This code has already been used." && (
            <a
              href={`mailto:quenot.ryoma@gmail.com?subject=${encodeURIComponent("Code reissue request")}&body=${encodeURIComponent(`My code ${code} has already been used, can I get a new one?`)}`}
              className="text-[0.9rem] font-bold text-white underline underline-offset-2"
            >
              Request a new code
            </a>
          )}
        </div>
      )}
      {status === "success" && (
        <p className="text-[0.9rem] text-[#7fd99c]">{message}</p>
      )}
    </main>
  );
}
