import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  POOL_PERCENT,
  TIER_SHARE,
  randomNumbers,
  weightedNumbers,
  countMatches,
  computePrizes,
  round2,
} from "@/lib/draw";

type SubRow = { user_id: string; plan: string | null; amount: number | string | null };

export async function POST(req: Request) {
  try {
    // 1) Only admins may run draws
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!me?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

    // 2) Read and validate the request
    const body = await req.json();
    const action = body.action as "simulate" | "publish";
    if (action !== "simulate" && action !== "publish") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const mode = body.mode === "algorithm" ? "algorithm" : "random";
    const month = String(body.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Pick a month" }, { status: 400 });
    }
    const drawMonth = `${month}-01`;

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3) One published draw per month
    const { data: existing } = await admin
      .from("draws")
      .select("id,status")
      .eq("draw_month", drawMonth)
      .maybeSingle();
    if (existing?.status === "published") {
      return NextResponse.json({ error: "This month's draw is already published." }, { status: 400 });
    }

    // 4) Active subscribers (latest subscription per user)
    const { data: subs } = await admin
      .from("subscriptions")
      .select("user_id,plan,amount,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const latest = new Map<string, SubRow>();
    for (const s of (subs ?? []) as SubRow[]) if (!latest.has(s.user_id)) latest.set(s.user_id, s);

    // 5) Prize pool = POOL_PERCENT of each subscriber's monthly-equivalent fee
    let pool = 0;
    for (const s of latest.values()) {
      const monthly = s.plan === "yearly" ? Number(s.amount) / 12 : Number(s.amount);
      pool += (monthly * POOL_PERCENT) / 100;
    }
    pool = round2(pool);

    // 6) Participants = active subscribers who have all 5 scores
    const userIds = [...latest.keys()];
    const { data: scoreRows } = userIds.length
      ? await admin.from("scores").select("user_id,score").in("user_id", userIds)
      : { data: [] as { user_id: string; score: number }[] };
    const byUser = new Map<string, number[]>();
    for (const r of scoreRows ?? []) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.score]);
    }
    const participants = [...byUser.entries()].filter(([, nums]) => nums.length === 5);
    const allScores = participants.flatMap(([, nums]) => nums);

    // 7) Winning numbers: reuse the simulated ones on publish, otherwise generate
    let winning: number[];
    if (action === "publish" && Array.isArray(body.numbers)) {
      const nums = body.numbers.map(Number);
      const ok =
        nums.length === 5 &&
        new Set(nums).size === 5 &&
        nums.every((n: number) => Number.isInteger(n) && n >= 1 && n <= 45);
      if (!ok) return NextResponse.json({ error: "Invalid numbers" }, { status: 400 });
      winning = [...nums].sort((a: number, b: number) => a - b);
    } else {
      winning = mode === "algorithm" ? weightedNumbers(allScores) : randomNumbers();
    }

    // 8) Jackpot rollover from the previous published draw
    let carry = 0;
    const { data: prev } = await admin
      .from("draws")
      .select("id,total_pool,jackpot_carry_in")
      .eq("status", "published")
      .lt("draw_month", drawMonth)
      .order("draw_month", { ascending: false })
      .limit(1);
    if (prev && prev[0]) {
      const { count } = await admin
        .from("winners")
        .select("id", { count: "exact", head: true })
        .eq("draw_id", prev[0].id)
        .eq("match_type", 5);
      if (!count) carry = round2(Number(prev[0].total_pool) * TIER_SHARE[5] + Number(prev[0].jackpot_carry_in));
    }

    // 9) Match every participant and work out prizes
    const entries = participants.map(([uid, nums]) => ({
      user_id: uid,
      numbers: nums,
      match_count: countMatches(nums, winning),
    }));
    const counts: Record<3 | 4 | 5, number> = { 3: 0, 4: 0, 5: 0 };
    for (const e of entries) if (e.match_count >= 3) counts[e.match_count as 3 | 4 | 5]++;
    const { tier, perWinner, jackpotRollsOver } = computePrizes(pool, carry, counts);

    const winnersList = entries
      .filter((e) => e.match_count >= 3)
      .map((e) => ({
        user_id: e.user_id,
        match: e.match_count,
        prize: perWinner[e.match_count as 3 | 4 | 5],
      }));

    const names = new Map<string, string>();
    if (winnersList.length) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", winnersList.map((w) => w.user_id));
      for (const p of profs ?? []) names.set(p.id, p.full_name ?? p.email ?? "Player");
    }

    // 10) Publish = save everything
    if (action === "publish") {
      const drawRow = {
        draw_month: drawMonth,
        mode,
        winning_numbers: winning,
        status: "published",
        total_pool: pool,
        jackpot_carry_in: carry,
        published_at: new Date().toISOString(),
      };
      let drawId: string;
      if (existing?.id) {
        drawId = existing.id;
        const { error } = await admin.from("draws").update(drawRow).eq("id", drawId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await admin.from("draws").insert(drawRow).select("id").single();
        if (error) throw new Error(error.message);
        drawId = data.id;
      }
      if (entries.length) {
        const { error } = await admin
          .from("draw_entries")
          .insert(entries.map((e) => ({ draw_id: drawId, ...e })));
        if (error) throw new Error(error.message);
      }
      if (winnersList.length) {
        const { error } = await admin.from("winners").insert(
          winnersList.map((w) => ({
            draw_id: drawId,
            user_id: w.user_id,
            match_type: w.match,
            prize_amount: w.prize,
          }))
        );
        if (error) throw new Error(error.message);
      }
    }

    return NextResponse.json({
      published: action === "publish",
      numbers: winning,
      pool,
      carryIn: carry,
      tier,
      participants: entries.length,
      counts,
      perWinner,
      jackpotRollsOver,
      winners: winnersList.map((w) => ({ ...w, name: names.get(w.user_id) ?? "Player" })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Draw failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}