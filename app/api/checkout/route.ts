import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient as createPlain } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    }
    const stripe = getStripe();

    // 1) Try the login token sent by the browser
    let user = null;
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token) {
      const plain = createPlain(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
      const { data } = await plain.auth.getUser(token);
      user = data.user;
    }
    // 2) Fall back to cookies
    if (!user) {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
    if (!user) {
      return NextResponse.json({ error: "Please log in first." }, { status: 401 });
    }

    const { plan } = await req.json();
    const yearly = plan === "yearly";
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "inr",
            unit_amount: yearly ? 499900 : 49900,
            recurring: { interval: yearly ? "year" : "month" },
            product_data: {
              name: yearly ? "Digital Heroes Yearly" : "Digital Heroes Monthly",
            },
          },
        },
      ],
      metadata: { user_id: user.id, plan: yearly ? "yearly" : "monthly" },
      success_url: `${site}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/#pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}