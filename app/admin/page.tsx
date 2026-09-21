"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Tab = "reports" | "draw" | "winners";

type Stats = {
  users: number;
  active: number;
  pool: number;
  charity: number;
  draws: number;
  winners: number;
  paidOut: number;
};

type Sim = {
  published: boolean;
  numbers: number[];
  pool: number;
  carryIn: number;
  tier: Record<string, number>;
  participants: number;
  counts: Record<string, number>;
  perWinner: Record<string, number>;
  jackpotRollsOver: boolean;
  winners: { user_id: string; name: string; match: number; prize: number }[];
};

type WinnerRow = {
  id: string;
  match_type: number;
  prize_amount: number | null;
  proof_url: string | null;
  verification_status: string;
  payment_status: string;
  profiles: { full_name: string | null; email: string | null } | null;
  draws: { draw_month: string } | null;
};

const money = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("reports");
  const [stats, setStats] = useState<Stats | null>(null);
  const [winners, setWinners] = useState<WinnerRow[]>([]);

  // draw controls
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [mode, setMode] = useState<"random" | "algorithm">("random");
  const [sim, setSim] = useState<Sim | null>(null);
  const [busy, setBusy] = useState(false);
  const [drawMsg, setDrawMsg] = useState("");

  async function loadStats() {
    const [pr, sb, dr, wn, dn] = await Promise.all([
      supabase.from("profiles").select("id,charity_percent"),
      supabase.from("subscriptions").select("user_id,amount,status"),
      supabase.from("draws").select("id,total_pool,status"),
      supabase.from("winners").select("prize_amount,payment_status"),
      supabase.from("donations").select("amount"),
    ]);

    const percent = new Map<string, number>();
    for (const p of pr.data ?? []) percent.set(p.id, Number(p.charity_percent));

    let charity = 0;
    for (const s of sb.data ?? []) {
      charity += (Number(s.amount ?? 0) * (percent.get(s.user_id) ?? 10)) / 100;
    }
    for (const d of dn.data ?? []) charity += Number(d.amount);

    const activeUsers = new Set(
      (sb.data ?? []).filter((s) => s.status === "active").map((s) => s.user_id)
    );
    const published = (dr.data ?? []).filter((d) => d.status === "published");

    setStats({
      users: pr.data?.length ?? 0,
      active: activeUsers.size,
      pool: published.reduce((a, d) => a + Number(d.total_pool), 0),
      charity,
      draws: published.length,
      winners: wn.data?.length ?? 0,
      paidOut: (wn.data ?? [])
        .filter((w) => w.payment_status === "paid")
        .reduce((a, w) => a + Number(w.prize_amount ?? 0), 0),
    });
  }

  async function loadWinners() {
    const { data } = await supabase
      .from("winners")
      .select(
        "id,match_type,prize_amount,proof_url,verification_status,payment_status,profiles(full_name,email),draws(draw_month)"
      )
      .order("created_at", { ascending: false });
    setWinners((data ?? []) as unknown as WinnerRow[]);
  }

  async function loadAll() {
    await Promise.all([loadStats(), loadWinners()]);
  }

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }
      const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).single();
      if (!me?.is_admin) {
        router.replace("/dashboard");
        return;
      }
      await loadAll();
      setReady(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callDraw(action: "simulate" | "publish") {
    setBusy(true);
    setDrawMsg("");
    try {
      const res = await fetch("/api/admin/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          mode,
          month,
          numbers: action === "publish" ? sim?.numbers : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDrawMsg(data.error ?? "Something went wrong.");
      } else {
        setSim(data);
        if (action === "publish") {
          setDrawMsg("Draw published. Winners are now listed under Winners.");
          loadAll();
        }
      }
    } catch {
      setDrawMsg("Network error. Try again.");
    }
    setBusy(false);
  }

  async function setVerification(id: string, status: "approved" | "rejected") {
    await supabase.from("winners").update({ verification_status: status }).eq("id", id);
    loadWinners();
  }

  async function markPaid(id: string) {
    await supabase.from("winners").update({ payment_status: "paid" }).eq("id", id);
    loadAll();
  }

  const card = "rounded-3xl border border-white/10 bg-forest/50 p-6";
  const input =
    "rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-sage transition";
  const pill = (t: string) =>
    `rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
      t === "approved" || t === "paid"
        ? "bg-sage/20 text-sage"
        : t === "rejected"
        ? "bg-red-500/20 text-red-300"
        : "bg-copper/20 text-copper"
    }`;

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="label">Checking admin access...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          digital.<em className="font-serif font-normal text-sage">HEROES</em>
        </Link>
        <Link href="/dashboard" className="text-sm text-cream/60 hover:text-cream">
          My dashboard
        </Link>
      </div>

      <div className="mt-10">
        <p className="label">Admin panel</p>
        <h1 className="mt-2 text-4xl font-bold md:text-5xl">
          Full <em className="font-serif font-normal text-sage">control.</em>
        </h1>
      </div>

      <div className="mt-6 flex gap-5 text-sm">
        <Link href="/admin/users" className="text-sage underline">
          Manage users and scores
        </Link>
        <Link href="/admin/charities" className="text-sage underline">
          Manage charities
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {(["reports", "draw", "winners"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-6 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-copper text-ink" : "border border-white/20 text-cream/70 hover:bg-white/10"
            }`}
          >
            {t === "reports" ? "Reports" : t === "draw" ? "Draw" : "Winners"}
          </button>
        ))}
      </div>

      {/* ===== REPORTS ===== */}
      {tab === "reports" && stats && (
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            ["Total users", String(stats.users)],
            ["Active subscribers", String(stats.active)],
            ["Total prize pool (published)", money(stats.pool)],
            ["Charity contributions", money(stats.charity)],
            ["Draws published", String(stats.draws)],
            ["Winners / paid out", `${stats.winners} / ${money(stats.paidOut)}`],
          ].map(([label, value]) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={card}
            >
              <p className="label">{label}</p>
              <p className="mt-3 text-3xl font-bold text-copper">{value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ===== DRAW ===== */}
      {tab === "draw" && (
        <div className={`${card} mt-6`}>
          <p className="label">Configure draw</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setSim(null);
                setDrawMsg("");
              }}
              className={input}
            />
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "random" | "algorithm");
                setSim(null);
              }}
              className={input}
            >
              <option value="random" className="bg-ink">
                Random (lottery style)
              </option>
              <option value="algorithm" className="bg-ink">
                Algorithmic (weighted by score frequency)
              </option>
            </select>
            <button
              onClick={() => callDraw("simulate")}
              disabled={busy}
              className="rounded-full border border-copper px-6 py-3 font-semibold text-copper transition hover:bg-copper hover:text-ink disabled:opacity-50"
            >
              {busy ? "Working..." : "Run simulation"}
            </button>
            <button
              onClick={() => callDraw("publish")}
              disabled={busy || !sim || sim.published}
              className="rounded-full bg-copper px-6 py-3 font-semibold text-ink transition hover:scale-105 disabled:opacity-40"
            >
              Publish results
            </button>
          </div>

          {drawMsg && (
            <p className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-sm text-cream/80">{drawMsg}</p>
          )}

          {sim && (
            <div className="mt-8">
              <p className="label">
                {sim.published ? "Published numbers" : "Simulated numbers (not saved yet)"}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {sim.numbers.map((n, i) => (
                  <motion.div
                    key={`${sim.numbers.join("-")}-${i}`}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12, delay: i * 0.25 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-copper text-2xl font-bold text-ink shadow-[0_0_30px_rgba(184,122,69,0.5)]"
                  >
                    {n}
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-cream/60">Prize pool this month</p>
                  <p className="text-2xl font-bold">{money(sim.pool)}</p>
                </div>
                <div>
                  <p className="text-sm text-cream/60">Jackpot carried in</p>
                  <p className="text-2xl font-bold">{money(sim.carryIn)}</p>
                </div>
                <div>
                  <p className="text-sm text-cream/60">Participants (5 scores + active)</p>
                  <p className="text-2xl font-bold">{sim.participants}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {["5", "4", "3"].map((k) => (
                  <div
                    key={k}
                    className="flex flex-wrap items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="font-semibold">{k}-number match</p>
                    <p className="text-sm text-cream/70">
                      Tier {money(sim.tier[k])} · {sim.counts[k]} winner(s) · {money(sim.perWinner[k])} each
                    </p>
                  </div>
                ))}
              </div>

              {sim.jackpotRollsOver && (
                <p className="mt-4 rounded-lg bg-copper/15 px-3 py-2 text-sm text-copper">
                  No 5-match winner. The jackpot ({money(sim.tier["5"])}) rolls over to next month.
                </p>
              )}

              {sim.winners.length > 0 && (
                <div className="mt-6">
                  <p className="label">Winners</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {sim.winners.map((w) => (
                      <li key={w.user_id}>
                        {w.name}: {w.match} matches, {money(w.prize)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== WINNERS ===== */}
      {tab === "winners" && (
        <div className="mt-6 space-y-4">
          {winners.length === 0 && <p className="text-cream/50">No winners yet. Publish a draw first.</p>}
          {winners.map((w) => (
            <div key={w.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold">
                    {w.profiles?.full_name ?? w.profiles?.email ?? "Player"}
                  </p>
                  <p className="text-sm text-cream/60">
                    {w.match_type}-number match · draw {w.draws?.draw_month?.slice(0, 7)} ·{" "}
                    <span className="text-copper">{money(Number(w.prize_amount ?? 0))}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className={pill(w.verification_status)}>{w.verification_status}</span>
                  <span className={pill(w.payment_status)}>{w.payment_status}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {w.proof_url ? (
                  <a href={w.proof_url} target="_blank" className="text-sage underline">
                    View proof screenshot
                  </a>
                ) : (
                  <span className="text-cream/50">No proof uploaded yet</span>
                )}

                {w.proof_url && w.verification_status !== "approved" && (
                  <>
                    <button
                      onClick={() => setVerification(w.id, "approved")}
                      className="rounded-full bg-sage px-4 py-1.5 font-semibold text-ink"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setVerification(w.id, "rejected")}
                      className="rounded-full border border-red-300/60 px-4 py-1.5 text-red-300"
                    >
                      Reject
                    </button>
                  </>
                )}

                {w.verification_status === "approved" && w.payment_status === "pending" && (
                  <button
                    onClick={() => markPaid(w.id)}
                    className="rounded-full bg-copper px-4 py-1.5 font-semibold text-ink"
                  >
                    Mark as paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}