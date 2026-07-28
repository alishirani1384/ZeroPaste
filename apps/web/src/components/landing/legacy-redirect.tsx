"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

/** Client redirect for old `/landing` URLs (static export has no server redirects). */
export function LegacyRedirect({ to }: { to: Route }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return (
    <p className="p-8 text-center text-sm text-muted-foreground">
      Redirecting…
    </p>
  );
}
