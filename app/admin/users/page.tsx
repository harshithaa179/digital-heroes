"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Sub = { id: string; status: string; plan: string | null; created_at: string };
type User = {
  id: string;
  full_name: string | null;
  email: string | null;
  charity_percent: number;
  is_admin: boolean;
  subscriptions: Sub[];
};
type Score = { id: string; score: number; played_on: string };

export default function AdminUsers() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [nameVal, setNameVal] = useState("");
  const [pctVal, setPctVal] = useState("10");

  const [scoreUser, setScoreUser] = useState<string | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [edits, setEdits] = useState<Record<string, { score: string; played_on: string }>>({});

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,email,charity_percent,is_admin,subscriptions(id,status,plan,created_at)")
      .order("created_at", { ascending: false });
    setUsers((data ?? []) as unknown as User[]);
  }

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");
      const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).single();
      if (!me?.is_admin) return router.replace("/dashboard");
      await load();
      setReady(true);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latest = (u: User) =>
    [...u.subscriptions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  async function saveProfile(id: string) {
    setMsg("");
    const pct = Number(pctVal);
    if (!nameVal.trim()) return setMsg("Name cannot be empty.");
    if (!Number.isInteger(pct) || pct < 10 || pct > 100) return setMsg("Charity percent must be 10 to 100.");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: nameVal.trim(), charity_percent: pct })
      .eq("id", id);
    if (error) return setMsg(error.message);
    setEditId(null);
    load();
  }

  async function setStatus(subId: string, status: string) {
    setMsg("");
    const { error } = await supabase.from("subscriptions").update({ status }).eq("id", subId);
    if (error) return setMsg(error.message);
    load();
  }

  async function fetchScores(uid: string) {
    const { data } = await supabase
      .from("scores")
      .select("id,score,played_on")
      .eq("user_id", uid)
      .order("played_on", { ascending: false });
    const list = data ?? [];
    setScores(list);
    setEdits(Object.fromEntries(list.map((s) => [s.id, { score: String(s.score), played_on: s.played_on }])));
    setScoreUser(uid);
  }

  async function toggleScores(uid: string) {
    if (scoreUser === uid) return setScoreUser(null);
    await fetchScores(uid);
  }

  async function saveScore(id: string) {
    setMsg("");
    const e = edits[id];
    const n = Number(e.score);
    if (!Number.isInteger(n) || n < 1 || n > 45) return setMsg("Score must be 1 to 45.");
    if (!e.played_on) return setMsg("Pick a date.");
    const { error } = await supabase.from("scores").update({ score: n, played_on: e.played_on }).eq("id", id);
    if (error) return setMsg(error.code === "23505" ? "That user already has a score on that date." : error.message);
    setMsg("Score saved.");
    if (scoreUser) await fetchScores(scoreUser);
  }

  const card = "rounded-3xl border border-white/10 bg-forest/50 p-5";
  const input = "rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-sage";

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="label">Checking admin access...</p>
      </main>
    );
  }

  const shown = users.filter((u) =>
    ((u.full_name ?? "") + " " + (u.email ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          digital.<em className="font-serif font-normal text-sage">HEROES</em>
        </Link>
        <Link href="/admin" className="text-sm text-cream/60 hover:text-cream">
          Back to admin
        </Link>
      </div>

      <p className="label mt-10">Admin</p>
      <h1 className="mt-2 text-4xl font-bold">
        Users and <em className="font-serif font-normal text-sage">scores.</em>
      </h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email..."
        className={`${input} mt-6 w-full max-w-sm`}
      />
      {msg && <p className="mt-4 rounded-lg bg-white/5 px-3 py-2 text-sm">{msg}</p>}

      <div className="mt-6 space-y-4">
        {shown.map((u) => {
          const sub = latest(u);
          return (
            <div key={u.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">
                    {u.full_name ?? "No name"}
                    {u.is_admin && (
                      <span className="ml-2 rounded-full bg-sage/20 px-2 py-0.5 font-mono text-[10px] uppercase text-sage">
                        admin
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-cream/60">{u.email}</p>
                  <p className="mt-1 text-sm text-cream/60">Charity share: {u.charity_percent}%</p>
                </div>

                <div className="text-right text-sm">
                  <p className="label">Subscription</p>
                  {sub ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="capitalize text-cream/70">{sub.plan}</span>
                      <select
                        value={sub.status}
                        onChange={(e) => setStatus(sub.id, e.target.value)}
                        className={input}
                      >
                        {["active", "canceled", "lapsed", "inactive"].map((s) => (
                          <option key={s} value={s} className="bg-ink">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="mt-1 text-cream/50">No subscription</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-4 text-sm">
                <button
                  onClick={() => {
                    setEditId(editId === u.id ? null : u.id);
                    setNameVal(u.full_name ?? "");
                    setPctVal(String(u.charity_percent));
                  }}
                  className="text-sage hover:underline"
                >
                  Edit profile
                </button>
                <button onClick={() => toggleScores(u.id)} className="text-sage hover:underline">
                  {scoreUser === u.id ? "Hide scores" : "View / edit scores"}
                </button>
              </div>

              {editId === u.id && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    className={input}
                    value={nameVal}
                    onChange={(e) => setNameVal(e.target.value)}
                    placeholder="Full name"
                  />
                  <input
                    className={`${input} w-28`}
                    type="number"
                    min={10}
                    max={100}
                    value={pctVal}
                    onChange={(e) => setPctVal(e.target.value)}
                  />
                  <button
                    onClick={() => saveProfile(u.id)}
                    className="rounded-full bg-copper px-5 py-2 font-semibold text-ink"
                  >
                    Save
                  </button>
                </div>
              )}

              {scoreUser === u.id && (
                <div className="mt-4 space-y-2">
                  {scores.length === 0 && <p className="text-sm text-cream/50">No scores yet.</p>}
                  {scores.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-3">
                      <input
                        className={`${input} w-24`}
                        type="number"
                        min={1}
                        max={45}
                        value={edits[s.id]?.score ?? ""}
                        onChange={(e) =>
                          setEdits({ ...edits, [s.id]: { ...edits[s.id], score: e.target.value } })
                        }
                      />
                      <input
                        className={input}
                        type="date"
                        value={edits[s.id]?.played_on ?? ""}
                        onChange={(e) =>
                          setEdits({ ...edits, [s.id]: { ...edits[s.id], played_on: e.target.value } })
                        }
                      />
                      <button
                        onClick={() => saveScore(s.id)}
                        className="rounded-full border border-copper px-4 py-1.5 text-sm text-copper"
                      >
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}