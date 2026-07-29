"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSupabaseBrowser } from "@/lib/supabase";

type Status = "working" | "ok" | "error";

const SUCCESS_DETAIL =
  "Your email is confirmed. Open ZeroPaste on desktop or Android and sign in with the same email and password.";

function readCallbackParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = url.searchParams.get("code");
  const access_token = hash.get("access_token") ?? url.searchParams.get("access_token");
  const refresh_token = hash.get("refresh_token") ?? url.searchParams.get("refresh_token");
  const type = hash.get("type") ?? url.searchParams.get("type");
  const errorDescription =
    hash.get("error_description") ??
    url.searchParams.get("error_description") ??
    hash.get("error") ??
    url.searchParams.get("error");
  return { code, access_token, refresh_token, type, errorDescription };
}

/**
 * Supabase verifies the email *before* redirecting here. Tokens in the URL mean
 * confirmation already succeeded — even if this site has no Supabase env vars
 * (marketing deploy) we should still show success.
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>("working");
  const [detail, setDetail] = useState("Confirming your email…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { code, access_token, refresh_token, type, errorDescription } = readCallbackParams();

      if (errorDescription) {
        if (!cancelled) {
          setStatus("error");
          setDetail(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
        }
        window.history.replaceState({}, document.title, "/auth/callback");
        return;
      }

      const looksConfirmed = Boolean(
        code || (access_token && refresh_token) || type === "signup" || type === "email",
      );

      const client = getSupabaseBrowser();
      if (client) {
        try {
          if (code) {
            const { error } = await client.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else if (access_token && refresh_token) {
            const { error } = await client.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
          // Desktop/mobile keep their own session — don't leave a browser login hanging.
          await client.auth.signOut({ scope: "local" });
        } catch (e) {
          // Tokens in the URL still mean Supabase already confirmed the address.
          if (!looksConfirmed) {
            if (!cancelled) {
              setStatus("error");
              setDetail(e instanceof Error ? e.message : "Could not finish this link.");
            }
            window.history.replaceState({}, document.title, "/auth/callback");
            return;
          }
        }
      } else if (!looksConfirmed) {
        if (!cancelled) {
          setStatus("error");
          setDetail(
            "This confirmation link is missing tokens. Open the latest email from ZeroPaste, or sign in — if login works, your email is already confirmed.",
          );
        }
        return;
      }

      window.history.replaceState({}, document.title, "/auth/callback");
      if (!cancelled) {
        setStatus("ok");
        setDetail(SUCCESS_DETAIL);
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
