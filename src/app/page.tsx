"use client";

import { useState, FormEvent } from "react";
import styles from "./page.module.css";

const BUY_URL = process.env.NEXT_PUBLIC_SUMUP_BUY_URL ?? "#";

export default function Home() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
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
        setMessage(data.error ?? "Une erreur est survenue.");
        return;
      }

      setStatus("success");
      setMessage("Téléchargement en cours…");
      window.location.href = data.downloadUrl;
    } catch {
      setStatus("error");
      setMessage("Impossible de contacter le serveur. Réessayez.");
    }
  }

  return (
    <main className={styles.page}>
      <video
        className={styles.bgVideo}
        src="/trailer.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className={styles.overlay} />

      <div className={styles.content}>
        <h1 className={styles.title}>Intercité</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.codeInput}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Code d'activation"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={status === "loading" || status === "success"}
            maxLength={12}
          />
          <button
            className={styles.downloadButton}
            type="submit"
            disabled={status === "loading" || status === "success" || !code.trim()}
          >
            {status === "loading" ? "Vérification…" : "Télécharger"}
          </button>
          {status === "error" && <p className={styles.error}>{message}</p>}
          {status === "success" && <p className={styles.success}>{message}</p>}
        </form>

        <div className={styles.divider}>ou</div>

        <a className={styles.buyButton} href={BUY_URL}>
          Acheter le film
        </a>
      </div>
    </main>
  );
}
