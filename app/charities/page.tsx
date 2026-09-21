"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  is_featured: boolean;
  upcoming_event: string | null;
  event_date: string | null;
};

export default function Charities() {
  const [list, setList] = useState<Charity[]>([]);
  const [q, setQ] = useState("");
  const [onlyEvents, setOnlyEvents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function run() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("charities")
          .select("id,name,description,is_featured,upcoming_event,event_date")
          .order("is_featured", { ascending: false });
        if (error) setErr(error.message);
        setList(data ?? []);

      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load charities.");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, []);

  const shown = list.filter(
    (c) =>
      (c.name + " " + (c.description ?? "")).toLowerCase().includes(q.toLowerCase()) &&
      (!onlyEvents || c.upcoming_event)
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          digital.<em className="font-serif font-normal text-sage">HEROES</em>
        </Link>
        <Link href="/signup" className="rounded-full bg-copper px-5 py-2 text-sm font-semibold text-ink">
          Subscribe
        </Link>
      </div>

      <div className="mt-12">
        <p className="label">Charity directory</p>
        <h1 className="mt-2 text-4xl font-bold md:text-5xl">
          Causes worth <em className="font-serif font-normal text-sage">playing for.</em>
        </h1>
      </div>


      <div className="mt-8 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search charities..."
          className="w-full max-w-sm rounded-full border border-white/10 bg-white/5 px-5 py-3 outline-none focus:border-sage"
        />
        <button
          onClick={() => setOnlyEvents(!onlyEvents)}
          className={`rounded-full border px-5 py-3 text-sm transition ${
            onlyEvents ? "border-copper bg-copper text-ink" : "border-white/20"
          }`}
        >
          With upcoming events
        </button>
      </div>

      {loading && <p className="mt-10 text-cream/50">Loading...</p>}
      {err && (
        <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
      )}
      {!loading && !err && shown.length === 0 && (
        <p className="mt-10 text-cream/50">No charities match your search.</p>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {shown.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}

            transition={{ delay: i * 0.08 }}
            className="rounded-3xl border border-white/10 bg-forest/50 p-6 transition hover:-translate-y-2 hover:border-sage/60"
          >
            <div className="flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br from-sage/30 to-copper/20 font-serif text-5xl italic">
              ♡
            </div>
            {c.is_featured && (
              <span className="mt-4 inline-block rounded-full bg-copper/20 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-copper">
                Featured
              </span>
            )}
            <h3 className="mt-3 text-xl font-bold">{c.name}</h3>
            <p className="mt-2 text-sm text-cream/65">{c.description}</p>
            {c.upcoming_event && (
              <p className="mt-4 text-sm text-sage">
                📅 {c.upcoming_event}
                {c.event_date &&
                  " · " +
                    new Date(c.event_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </main>
  );
}