"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Score = { id: string; score: number; played_on: string };
type Profile = {
  full_name: string | null;
  charity_percent: number;
  charities: { name: string } | null;
};
type Sub = {
  status: string;
  plan: string | null;
  current_period_end: string | null;
} | null;
type Winner = {
  id: string;
  prize_amount: number | null;
  match_type: number;
  verification_status: string;
  payment_status: string;
  proof_url: string | null;
};

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Sub>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [drawsEntered, setDrawsEntered] = useState(0);
  const [loading, setLoading] = useState(true);

  const [scoreVal, setScoreVal] = useState("");
  const [playedOn, setPlayedOn] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [proofMsg, setProofMsg] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    const uid = auth.user.id;
    setUserId(uid);

    const [p, s, sc, w, d] = await Promise.all([
      supabase.from("profiles").select("full_name,charity_percent,charities(name)").eq("id", uid).single(),
      supabase.from("subscriptions").select("status,plan,current_period_end").eq("user_id", uid).order("created_at", { ascending: false }).limit(1),
      supabase.from("scores").select("id,score,played_on").eq("user_id", uid).order("played_on", { ascending: false }),
      supabase.from("winners").select("id,prize_amount,match_type,verification_status,payment_status,proof_url").eq("user_id", uid),
      supabase.from("draw_entries").select("id", { count: "exact", head: true }).eq("user_id", uid),
    ]);

    setProfile(p.data as unknown as Profile);
    setSub(s.data?.[0] ?? null);
    setScores(sc.data ?? []);
    setWinners(w.data ?? []);
    setDrawsEntered(d.count ?? 0);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    async function init() {
      // after Stripe payment, confirm the subscription first
      const sid = new URLSearchParams(window.location.search).get("session_id");
      if (sid) {
        await fetch(`/api/verify?session_id=${sid}`);
        window.history.replaceState({}, "", "/dashboard");
      }
      load();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveScore() {
    setMsg("");
    const n = Number(scoreVal);
    if (!Number.isInteger(n) || n < 1 || n > 45) {
      setMsg("Score must be a whole number between 1 and 45.");
      return;
    }
    if (!playedOn) {
      setMsg("Please pick the date you played.");
      return;
    }
    if (playedOn > today) {
      setMsg("The date cannot be in the future.");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("scores")
        .update({ score: n, played_on: playedOn })
        .eq("id", editingId);
      if (error) {
        setMsg(error.code === "23505" ? "You already have a score for that date." : error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("scores")
        .insert({ user_id: userId, score: n, played_on: playedOn });
      if (error) {
        setMsg(error.code === "23505" ? "You already have a score for that date. Edit it instead." : error.message);
        return;
      }
    }
    setScoreVal("");
    setPlayedOn("");
    setEditingId(null);
    load();
  }

  async function removeScore(id: string) {
    await supabase.from("scores").delete().eq("id", id);
    load();
  }

  function startEdit(s: Score) {
    setEditingId(s.id);
    setScoreVal(String(s.score));
    setPlayedOn(s.played_on);
    setMsg("");
  }

  async function uploadProof(winnerId: string, file: File | undefined) {
    if (!file) return;
    setProofMsg("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setProofMsg("Please upload a PNG, JPG or WEBP screenshot.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProofMsg("File is too large. Maximum 5 MB.");
      return;
    }
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}/${winnerId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("proofs").upload(path, file);
    if (error) {
      setProofMsg(error.message);
      return;
    }
    const { data } = supabase.storage.from("proofs").getPublicUrl(path);
    const { error: e2 } = await supabase
      .from("winners")
      .update({ proof_url: data.publicUrl })
      .eq("id", winnerId);
    if (e2) {
      setProofMsg(e2.message);
      return;
    }
    setProofMsg("Proof uploaded. Waiting for admin review.");
    load();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const totalWon = winners.reduce((a, w) => a + Number(w.prize_amount ?? 0), 0);
  const isActive = sub?.status === "active";
  const card = "rounded-3xl border border-white/10 bg-forest/50 p-6";
  const input =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-sage transition";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="label">Loading your dashboard...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          digital.<em className="font-serif font-normal text-sage">HEROES</em>
        </Link>
        <button onClick={logout} className="text-sm text-cream/60 hover:text-cream">
          Log out
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
        <p className="label">Your dashboard</p>
        <h1 className="mt-2 text-4xl font-bold md:text-5xl">
          Hello, <em className="font-serif font-normal text-sage">{profile?.full_name ?? "hero"}.</em>
        </h1>
      </motion.div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <div className={card}>
          <p className="label">Subscription</p>
          <p className={`mt-3 text-3xl font-bold ${isActive ? "text-sage" : "text-copper"}`}>
            {isActive ? "Active" : sub?.status ? sub.status : "Inactive"}
          </p>
          {sub?.plan && <p className="mt-1 text-sm capitalize text-cream/60">{sub.plan} plan</p>}
          {sub?.current_period_end && (
            <p className="text-sm text-cream/60">
              Renews {new Date(sub.current_period_end).toLocaleDateString("en-IN")}
            </p>
          )}
          {!isActive && (
            <Link
              href="/#pricing"
              className="mt-4 inline-block rounded-full bg-copper px-5 py-2 text-sm font-semibold text-ink"
            >
              Subscribe to enter draws
            </Link>
          )}
        </div>

        <div className={card}>
          <p className="label">Your charity</p>
          <p className="mt-3 text-2xl font-bold">{profile?.charities?.name ?? "Not selected"}</p>
          <p className="mt-1 font-mono text-copper">{profile?.charity_percent}% of your fee</p>
        </div>

        <div className={card}>
          <p className="label">Winnings</p>
          <p className="mt-3 text-3xl font-bold text-copper">₹{totalWon.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-sm text-cream/60">
            {winners.length === 0
              ? "No wins yet. Keep playing!"
              : `Latest status: ${winners[winners.length - 1].payment_status}`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className={card}>
          <p className="label">{editingId ? "Edit score" : "Add a score"}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <input
              className={input}
              type="number"
              min={1}
              max={45}
              placeholder="Score (1-45)"
              value={scoreVal}
              onChange={(e) => setScoreVal(e.target.value)}
            />
            <input
              className={input}
              type="date"
              max={today}
              value={playedOn}
              onChange={(e) => setPlayedOn(e.target.value)}
            />
          </div>
          {msg && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{msg}</p>}
          <div className="mt-4 flex gap-3">
            <button
              onClick={saveScore}
              className="rounded-full bg-copper px-6 py-2 font-semibold text-ink transition hover:scale-105"
            >
              {editingId ? "Update" : "Save score"}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setScoreVal("");
                  setPlayedOn("");
                }}
                className="rounded-full border border-white/20 px-6 py-2"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-cream/50">
            Only your latest 5 scores are kept. A new score replaces the oldest. One score per date.
          </p>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between">
            <p className="label">Your last 5 scores</p>
            <p className="font-mono text-sm text-cream/50">{scores.length}/5</p>
          </div>
          <ul className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {scores.map((s) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-copper text-lg font-bold text-ink">
                      {s.score}
                    </span>
                    <span className="text-sm text-cream/70">
                      {new Date(s.played_on).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <button onClick={() => startEdit(s)} className="text-sage hover:underline">
                      Edit
                    </button>
                    <button onClick={() => removeScore(s.id)} className="text-red-300 hover:underline">
                      Delete
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
            {scores.length === 0 && <p className="text-sm text-cream/50">No scores yet. Add your first one.</p>}
          </ul>
        </div>
      </div>

      {winners.length > 0 && (
        <div className={`${card} mt-5`}>
          <p className="label">Your wins</p>
          <div className="mt-4 space-y-3">
            {winners.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {w.match_type}-number match ·{" "}
                    <span className="text-copper">₹{Number(w.prize_amount ?? 0).toLocaleString("en-IN")}</span>
                  </p>
                  <p className="font-mono text-xs uppercase tracking-widest text-cream/60">
                    {w.verification_status} · {w.payment_status}
                  </p>
                </div>
                {w.verification_status !== "approved" && (
                  <div className="mt-3 text-sm">
                    <p className="text-cream/60">
                      {w.proof_url
                        ? w.verification_status === "rejected"
                          ? "Your proof was rejected. Upload a clearer screenshot of your scores."
                          : "Proof submitted. Waiting for review."
                        : "Upload a screenshot of your scores from your golf platform to claim this prize."}
                    </p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => uploadProof(w.id, e.target.files?.[0])}
                      className="mt-2 text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          {proofMsg && <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm">{proofMsg}</p>}
        </div>
      )}

      <div className={`${card} mt-5`}>
        <p className="label">Participation</p>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-3xl font-bold">{drawsEntered}</p>
            <p className="text-sm text-cream/60">Draws entered</p>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </p>
            <p className="text-sm text-cream/60">Next draw</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{winners.length}</p>
            <p className="text-sm text-cream/60">Total wins</p>
          </div>
        </div>
      </div>
    </main>
  );
}