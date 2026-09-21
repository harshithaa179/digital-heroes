"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, animate } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

/* ---------- reusable helpers ---------- */

// fades and slides up when scrolled into view
function Fade({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// number that counts up when visible
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 2,
      onUpdate: (x) => setV(Math.round(x)),
    });
    return () => controls.stop();
  }, [inView, to]);

  return <span ref={ref}>{v.toLocaleString("en-IN")}</span>;
}

type Charity = {
  id: string;
  name: string;
  description: string | null;
  upcoming_event: string | null;
  event_date: string | null;
};

/* ---------- page ---------- */

export default function Home() {
  const supabase = createClient();
  const [featured, setFeatured] = useState<Charity | null>(null);
  const [yearly, setYearly] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const ballsRef = useRef<HTMLDivElement>(null);
  const ballsInView = useInView(ballsRef, { once: true, margin: "-100px" });

  useEffect(() => {
    supabase
      .from("charities")
      .select("id,name,description,upcoming_event,event_date")
      .eq("is_featured", true)
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) setFeatured(data[0]);
      });

    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // starts Stripe checkout, sending the login token with the request
  async function subscribe() {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      return;
    }
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan: yearly ? "yearly" : "monthly" }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Could not start checkout.");
  }

  const steps = [
    { n: "01", t: "Subscribe", d: "Pick monthly or yearly. A part of every fee goes to a cause you choose." },
    { n: "02", t: "Enter your scores", d: "Log your last 5 Stableford scores. Simple, quick, always up to date." },
    { n: "03", t: "Win & give", d: "Match numbers in the monthly draw to win, while your charity wins every month." },
  ];

  const balls = [7, 19, 23, 34, 41];

  const tiers = [
    { m: "5-number match", p: 40, note: "Jackpot rolls over if unclaimed", hot: true },
    { m: "4-number match", p: 35, note: "Split equally between winners", hot: false },
    { m: "3-number match", p: 25, note: "Split equally between winners", hot: false },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* ===== NAVBAR ===== */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-lg font-bold">
            digital.<em className="font-serif font-normal text-sage">HEROES</em>
          </Link>
          <div className="flex items-center gap-4">
            {loggedIn ? (
              <Link href="/dashboard" className="text-sm text-cream/70 hover:text-cream">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="text-sm text-cream/70 hover:text-cream">
                Log in
              </Link>
            )}
            <Link
              href="/#pricing"
              className="rounded-full bg-copper px-5 py-2 text-sm font-semibold text-ink transition hover:scale-105 hover:brightness-110"
            >
              See pricing
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative flex min-h-screen items-center justify-center px-5 pt-20">
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-32 top-10 h-[520px] w-[520px] rounded-full bg-forest blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -bottom-20 -left-32 h-[420px] w-[420px] rounded-full bg-copper/20 blur-3xl"
        />

        <div className="relative max-w-4xl text-center">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="label">
            Play · Win · Give
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="mt-5 text-5xl font-bold leading-[1.05] md:text-8xl"
          >
            Your game.
            <br />
            Someone&apos;s{" "}
            <em className="font-serif font-normal text-sage">future.</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
            className="mx-auto mt-6 max-w-xl text-lg text-cream/70"
          >
            Log your scores, enter the monthly draw, and turn every subscription
            into real support for a charity you love.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="mt-9 flex flex-wrap justify-center gap-4"
          >
            <Link
              href={loggedIn ? "/dashboard" : "/signup"}
              className="rounded-full bg-copper px-8 py-4 font-semibold text-ink shadow-[0_0_40px_rgba(184,122,69,0.4)] transition hover:scale-105"
            >
              {loggedIn ? "Go to dashboard" : "Get started"}
            </Link>
            <Link
              href="/#how"
              className="rounded-full border border-white/20 px-8 py-4 font-semibold transition hover:bg-white/10"
            >
              How it works
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== IMPACT COUNTER ===== */}
      <section className="border-y border-white/10 bg-forest/40 py-16">
        <Fade className="mx-auto max-w-4xl px-5 text-center">
          <p className="label">Impact so far</p>
          <p className="mt-3 text-6xl font-bold text-copper md:text-8xl">
            ₹<CountUp to={1284500} />
          </p>
          <p className="mt-3 text-cream/60">raised for charities by our community</p>
        </Fade>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-28">
        <Fade>
          <p className="label">How it works</p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">
            Three steps.{" "}
            <em className="font-serif font-normal text-sage">Endless impact.</em>
          </h2>
        </Fade>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Fade key={s.n} delay={i * 0.15}>
              <div className="h-full rounded-3xl border border-white/10 bg-forest/50 p-8 transition duration-300 hover:-translate-y-2 hover:border-sage/60 hover:shadow-[0_0_40px_rgba(111,163,126,0.15)]">
                <p className="font-mono text-sm text-copper">{s.n}</p>
                <h3 className="mt-4 text-2xl font-bold">{s.t}</h3>
                <p className="mt-3 text-cream/65">{s.d}</p>
              </div>
            </Fade>
          ))}
        </div>
      </section>

      {/* ===== DRAW ===== */}
      <section className="bg-forest/30 py-28">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <Fade>
            <p className="label">The monthly draw</p>
            <h2 className="mt-3 text-4xl font-bold md:text-5xl">
              Five numbers.{" "}
              <em className="font-serif font-normal text-sage">One big moment.</em>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-cream/65">
              Every month five numbers are drawn. Match 3, 4 or all 5 of your
              scores to win a share of the prize pool.
            </p>
          </Fade>
          <div ref={ballsRef} className="mt-12 flex flex-wrap justify-center gap-4">
            {balls.map((b, i) => (
              <motion.div
                key={b}
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={ballsInView ? { scale: 1, rotate: 0, opacity: 1 } : {}}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: i * 0.2 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-copper text-3xl font-bold text-ink shadow-[0_0_35px_rgba(184,122,69,0.5)] md:h-24 md:w-24"
              >
                {b}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED CHARITY ===== */}
      <section className="mx-auto max-w-6xl px-5 py-28">
        <Fade>
          <p className="label">Featured charity</p>
        </Fade>
        <Fade delay={0.1}>
          <div className="mt-4 grid overflow-hidden rounded-3xl border border-white/10 bg-forest/60 md:grid-cols-2">
            <div className="flex min-h-[280px] items-center justify-center bg-gradient-to-br from-sage/30 to-copper/20">
              <span className="font-serif text-8xl italic text-cream/80">♡</span>
            </div>
            <div className="p-8 md:p-12">
              <h3 className="text-3xl font-bold md:text-4xl">
                {featured?.name ?? "Loading..."}
              </h3>
              <p className="mt-4 text-cream/70">
                {featured?.description ?? "Fetching our featured cause."}
              </p>
              {featured?.upcoming_event && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="label">Upcoming event</p>
                  <p className="mt-1 font-semibold">{featured.upcoming_event}</p>
                  {featured.event_date && (
                    <p className="text-sm text-cream/60">
                      {new Date(featured.event_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              )}
              <Link
                href="/charities"
                className="mt-6 inline-block rounded-full bg-copper px-6 py-3 font-semibold text-ink transition hover:scale-105"
              >
                Browse all charities
              </Link>
            </div>
          </div>
        </Fade>
      </section>

      {/* ===== PRIZE POOL ===== */}
      <section className="bg-forest/30 py-28">
        <div className="mx-auto max-w-3xl px-5">
          <Fade>
            <p className="label">Prize pool</p>
            <h2 className="mt-3 text-4xl font-bold md:text-5xl">
              Fair splits.{" "}
              <em className="font-serif font-normal text-sage">Every month.</em>
            </h2>
          </Fade>
          <div className="mt-10 space-y-7">
            {tiers.map((t, i) => (
              <Fade key={t.m} delay={i * 0.12}>
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold">
                    {t.m}
                    {t.hot && (
                      <span className="ml-3 rounded-full bg-copper/20 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-copper">
                        Jackpot
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-copper">{t.p}%</p>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${t.p * 2.4}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className={`h-full rounded-full ${t.hot ? "bg-copper" : "bg-sage"}`}
                  />
                </div>
                <p className="mt-1 text-sm text-cream/50">{t.note}</p>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="mx-auto max-w-4xl px-5 py-28 text-center">
        <Fade>
          <p className="label">Pricing</p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">
            Simple.{" "}
            <em className="font-serif font-normal text-sage">Transparent.</em>
          </h2>
          <div className="mx-auto mt-8 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                !yearly ? "bg-copper text-ink" : "text-cream/70"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                yearly ? "bg-copper text-ink" : "text-cream/70"
              }`}
            >
              Yearly
            </button>
          </div>
        </Fade>

        <Fade delay={0.15}>
          <div className="relative mx-auto mt-8 max-w-md rounded-3xl border border-sage/40 bg-forest/60 p-10">
            {yearly && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sage px-4 py-1 font-mono text-[11px] uppercase tracking-widest text-ink">
                Best value
              </span>
            )}
            <p className="text-6xl font-bold">
              ₹{yearly ? "4,999" : "499"}
              <span className="text-lg font-normal text-cream/50">
                /{yearly ? "year" : "month"}
              </span>
            </p>
            {yearly && (
              <p className="mt-1 text-sm text-sage">Save ₹989 compared to monthly</p>
            )}
            <ul className="mt-6 space-y-2 text-left text-cream/75">
              <li>✓ Entry into every monthly draw</li>
              <li>✓ Track your last 5 scores</li>
              <li>✓ Min. 10% goes to your charity</li>
              <li>✓ Cancel anytime</li>
            </ul>
            <button
              onClick={subscribe}
              className="mt-8 block w-full rounded-full bg-copper py-4 font-semibold text-ink transition hover:scale-[1.03]"
            >
              Subscribe
            </button>
            {!loggedIn && (
              <p className="mt-3 text-xs text-cream/40">
                You need to be logged in. New here?{" "}
                <Link href="/signup" className="text-sage underline">
                  Create an account
                </Link>
              </p>
            )}
          </div>
        </Fade>
      </section>

      {/* ===== FINAL CTA + FOOTER ===== */}
      <section className="relative overflow-hidden bg-forest py-24 text-center">
        <Fade className="relative mx-auto max-w-3xl px-5">
          <h2 className="text-4xl font-bold md:text-6xl">
            Ready to be a{" "}
            <em className="font-serif font-normal text-sage">hero?</em>
          </h2>
          <Link
            href="/#pricing"
            className="mt-8 inline-block rounded-full bg-copper px-10 py-4 font-semibold text-ink transition hover:scale-105"
          >
            See pricing
          </Link>
        </Fade>
      </section>

      <footer className="border-t border-white/10 py-8 pb-24 text-center text-sm text-cream/40">
        © 2026 digital.HEROES · Play. Win. Give.
      </footer>
    </main>
  );
}