"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Charity = { id: string; name: string; description: string | null };

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [charityId, setCharityId] = useState("");
  const [percent, setPercent] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("charities")
      .select("id,name,description")
      .then(({ data }) => {
        if (data) {
          setCharities(data);
          if (data[0]) setCharityId(data[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function handleSignup() {
    setError("");
    if (!name || !email || password.length < 6) {
      setError("Enter your name, email and a password of at least 6 characters.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error || !data.user) {
      setError(error?.message ?? "Signup failed. Try again.");
      setLoading(false);
      return;
    }
    await supabase
  .from("profiles")
  .update({ charity_id: charityId, charity_percent: percent })
  .eq("id", data.user.id);
  router.push("/dashboard");
  }

  const input =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-sage transition";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-forest blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-forest/60 p-8 backdrop-blur">

        <p className="label">Join the movement</p>
        <h1 className="mt-2 text-4xl font-bold">
          Play. Win.{" "}
          <em className="font-serif font-normal text-sage">Give.</em>
        </h1>

        <div className="mt-6 space-y-4">
          <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} />

          <div>
            <p className="label mb-2">Choose your charity</p>
            <select className={input} value={charityId} onChange={(e) => setCharityId(e.target.value)}>
              {charities.map((c) => (
                <option key={c.id} value={c.id} className="bg-ink">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between">
              <p className="label">Your contribution</p>
              <p className="font-mono text-sm text-copper">{percent}% of your fee</p>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              value={percent}

              onChange={(e) => setPercent(Number(e.target.value))}
              className="mt-2 w-full accent-[#b87a45]"
            />
            <p className="mt-1 text-xs text-cream/50">Minimum 10%. Slide to give more.</p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full rounded-full bg-copper py-3 font-semibold text-ink transition hover:scale-[1.02] hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-cream/60">
          Already a hero?{" "}
          <Link href="/login" className="text-sage underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}