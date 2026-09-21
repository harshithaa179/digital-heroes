"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function QuickNav() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function check() {
      const { data } = await supabase.auth.getUser();
      setLoggedIn(!!data.user);
      if (data.user) {
        const { data: me } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", data.user.id)
          .single();
        setIsAdmin(!!me?.is_admin);
      } else {
        setIsAdmin(false);
      }
    }
    check();
  }, [pathname]);

  if (pathname === "/login" || pathname === "/signup") return null;

  const links = [
    { href: "/", label: "Home" },
    { href: "/charities", label: "Charities" },
    ...(loggedIn ? [{ href: "/dashboard", label: "Dashboard" }] : [{ href: "/login", label: "Log in" }]),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-white/15 bg-ink/80 px-2 py-2 backdrop-blur-xl">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            pathname === l.href ? "bg-copper text-ink" : "text-cream/70 hover:bg-white/10"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}