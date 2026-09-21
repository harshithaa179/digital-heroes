"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const input =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-sage transition";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">

      <div className="pointer-events-none absolute -left-40 -bottom-40 h-[500px] w-[500px] rounded-full bg-forest blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-forest/60 p-8 backdrop-blur">
        <p className="label">Welcome back</p>
        <h1 className="mt-2 text-4xl font-bold">
          Good to see you,{" "}
          <em className="font-serif font-normal text-sage">hero.</em>
        </h1>
        <div className="mt-6 space-y-4">
          <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-full bg-copper py-3 font-semibold text-ink transition hover:scale-[1.02] hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-cream/60">
          New here?{" "}
          <Link href="/signup" className="text-sage underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}