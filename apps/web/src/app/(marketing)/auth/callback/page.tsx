"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSupabaseBrowser } from "@/lib/supabase";

type Status = "working" | "ok" | "error";

/**
 * Supabase email confirmation / recovery lands here with tokens in the URL hash
 * (or ?code= for PKCE). Completes the session in the browser, then tells the
 * user to return to the desktop/mobile app and sign in.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>("working");
  const [detail, setDetail] = useState("Confirming your email…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const client = getSupabaseBrowser();
      if (!client) {
        if (!cancelled) {
          setStatus("error");
          setDetail("Supabase is not configured on this site.");
        }
        return;
      }

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const hash = window.location.hash.replace(/^#/, "");
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await client.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) throw error;
          } else {
            // Link may already have been consumed; treat as confirmed if we have a session.
            const { data } = await client.auth.getSession();
            if (!data.session) {
              throw new Error("No confirmation tokens found in this link.");
            }
          }
        }

        // Desktop/mobile keep their own session — don't leave a browser login hanging.
        await client.auth.signOut({ scope: "local" });

        // Strip secrets from the address bar.
        window.history.replaceState({}, document.title, "/auth/callback");

        if (!cancelled) {
          setStatus("ok");
          setDetail(
            "Your email is confirmed. Open ZeroPaste on desktop or Android and sign in with the same email and password.",
          );
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setDetail(e instanceof Error ? e.message : "Could not confirm this link.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-3 text-sm font-medium tracking-wide text-[#666]">ZeroPaste</p>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-[#101010]">
        {status === "working" && "Confirming…"}
        {status === "ok" && "Email confirmed"}
        {status === "error" && "Confirmation issue"}
      </h1>
      <p className="mb-8 text-base leading-relaxed text-[#444]">{detail}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/download"
          className="rounded-full bg-[#101010] px-5 py-2.5 text-sm font-medium text-white no-underline"
        >
          Download ZeroPaste
        </Link>
        <Link
          href="/"
          className="rounded-full border border-[#ddd] bg-white px-5 py-2.5 text-sm font-medium text-[#101010] no-underline"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
