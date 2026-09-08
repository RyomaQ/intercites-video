"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";

const PRICE_EUR = process.env.NEXT_PUBLIC_DIGITAL_PRICE_EUR ?? "4";

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 3.5L10.5 8L6 12.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16.5 8.5a5 5 0 010 7M19 6a9 9 0 010 12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const embeddedButtonClass =
  "absolute right-1.5 top-1.5 bottom-1.5 rounded-full border-none bg-brand px-4 text-[0.85rem] font-bold whitespace-nowrap text-white transition-colors enabled:hover:bg-brand-hover enabled:active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50";

export default function Home() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");
  const [message, setMessage] = useState("");

  const [buying, setBuying] = useState(false);
  const [email, setEmail] = useState("");
  const [buyStatus, setBuyStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [buyMessage, setBuyMessage] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const emailInputRef = useRef<HTMLInputElement>(null);

  function handleBuyClick() {
    // flushSync forces the email input to exist in the DOM before we call
    // .focus() in the same click handler, so the browser still treats the
    // focus as tied to the user gesture and shows autofill suggestions.
    flushSync(() => setBuying(true));
    emailInputRef.current?.focus();
  }

  useEffect(() => {
    fetch("/api/trailer")
      .then((res) => res.json())
      .then((data) => {
        if (data.url) setVideoUrl(data.url);
      })
      .catch(() => {});
  }, []);

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  async function handleBuy(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setBuyStatus("loading");
    setBuyMessage("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setBuyStatus("error");
        setBuyMessage(data.error ?? "Something went wrong.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setBuyStatus("error");
      setBuyMessage("Couldn't reach the server. Please try again.");
    }
  }

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
    <main className="relative flex min-h-dvh w-full items-end justify-start overflow-hidden bg-black">
      {videoUrl && (
        <video
          ref={videoRef}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      )}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.45)_45%,rgba(0,0,0,0.35)_100%)]" />

      {videoUrl && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Unmute" : "Mute"}
          className="absolute right-6 top-6 z-20 flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
        >
          <SpeakerIcon muted={muted} />
        </button>
      )}

      <div className="relative z-10 flex w-full max-w-[560px] flex-col items-start gap-8 px-10 py-16 text-left">
        <Image
          src="/logo.png"
          alt="Intercité"
          width={140}
          height={140}
          priority
          className="h-[140px] w-[140px] object-contain drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]"
        />

        <p className="text-[0.95rem] leading-relaxed text-white/75">
          Years in the making, this film brings together the French BMX street
          scene from the youngest riders to the OGs, from major cities to the
          most remote corners. 7 months of filming, 15,000 km by train, nearly
          150 riders across the country.
        </p>

        <div className="mt-1 flex w-full flex-col items-stretch gap-6">
          {!buying ? (
            <button
              type="button"
              onClick={handleBuyClick}
              className="inline-flex items-center justify-center gap-[0.4rem] rounded-full border-none bg-brand px-6 py-4 text-base font-bold tracking-[0.02em] text-white transition-colors enabled:hover:bg-brand-hover enabled:active:scale-[0.98] enabled:active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
            >
              Buy · €{PRICE_EUR}
              <ChevronIcon />
            </button>
          ) : (
            <form onSubmit={handleBuy} className="relative">
              <input
                ref={emailInputRef}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={buyStatus === "loading"}
                className="h-full w-full rounded-full border border-white/25 bg-white/8 py-4 pl-5 pr-[6.5rem] text-base tracking-[0.08em] text-white backdrop-blur-md placeholder:tracking-normal placeholder:text-white/50 focus:border-brand-hover focus:outline-none"
              />
              <button
                type="submit"
                disabled={buyStatus === "loading" || !email.trim()}
                className={embeddedButtonClass}
              >
                {buyStatus === "loading" ? "…" : `Pay €${PRICE_EUR}`}
              </button>
            </form>
          )}

          <form onSubmit={handleSubmit} className="relative">
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
        </div>

        {status === "error" && (
          <p className="text-[0.9rem] text-[#ff8080]">{message}</p>
        )}
        {status === "success" && (
          <p className="text-[0.9rem] text-[#7fd99c]">{message}</p>
        )}
        {buyStatus === "error" && (
          <p className="text-[0.9rem] text-[#ff8080]">{buyMessage}</p>
        )}
      </div>
    </main>
  );
}
