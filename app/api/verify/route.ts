import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function GET(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    }
    const stripe = getStripe();

    const sessionId = new URL(req.url).searchParams.get("session_id");
    if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const userId = session.metadata?.user_id;
    if (!userId) return NextResponse.json({ error: "Unknown session" }, { status: 400 });
    if (session.status !== "complete") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const sub = session.subscription as Stripe.Subscription;
    const periodEnd =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sub as any).current_period_end ?? (sub.items.data[0] as any)?.current_period_end;

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();

    const row = {
      user_id: userId,
      plan: session.metadata?.plan,
      status: "active",
      stripe_customer_id: String(session.customer),
      stripe_subscription_id: sub.id,
      amount: (session.amount_total ?? 0) / 100,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    };

    if (existing) await admin.from("subscriptions").update(row).eq("id", existing.id);
    else await admin.from("subscriptions").insert(row);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verify failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}