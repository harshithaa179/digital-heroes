"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
  upcoming_event: string | null;
  event_date: string | null;
};

const empty = {
  name: "",
  description: "",
  image_url: "",
  upcoming_event: "",
  event_date: "",
  is_featured: false,
};

export default function AdminCharities() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<Charity[]>([]);
  const [f, setF] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const { data } = await supabase.from("charities").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Charity[]);
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

  async function save() {
    setMsg("");
    if (!f.name.trim()) return setMsg("Charity name is required.");
    const row = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      image_url: f.image_url.trim() || null,
      upcoming_event: f.upcoming_event.trim() || null,
      event_date: f.event_date || null,
      is_featured: f.is_featured,
    };
    let id = editingId;
    if (editingId) {
      const { error } = await supabase.from("charities").update(row).eq("id", editingId);
      if (error) return setMsg(error.message);
    } else {
      const { data, error } = await supabase.from("charities").insert(row).select("id").single();
      if (error) return setMsg(error.message);
      id = data.id;
    }
    // only one featured charity at a time
    if (row.is_featured && id) {
      await supabase.from("charities").update({ is_featured: false }).neq("id", id);
    }
    setF(empty);
    setEditingId(null);
    setMsg("Saved.");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this charity?")) return;
    const { error } = await supabase.from("charities").delete().eq("id", id);
    if (error) return setMsg("Could not delete: " + error.message);
    load();
  }

  function edit(c: Charity) {
    setEditingId(c.id);
    setF({
      name: c.name,
      description: c.description ?? "",
      image_url: c.image_url ?? "",
      upcoming_event: c.upcoming_event ?? "",
      event_date: c.event_date ?? "",
      is_featured: c.is_featured,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const card = "rounded-3xl border border-white/10 bg-forest/50 p-6";
  const input = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-sage";

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
        <Link href="/admin" className="text-sm text-cream/60 hover:text-cream">
          Back to admin
        </Link>
      </div>

      <p className="label mt-10">Admin</p>
      <h1 className="mt-2 text-4xl font-bold">
        Manage <em className="font-serif font-normal text-sage">charities.</em>
      </h1>

      <div className={`${card} mt-6`}>
        <p className="label">{editingId ? "Edit charity" : "Add a charity"}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className={input}
            placeholder="Name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <input
            className={input}
            placeholder="Image URL (optional)"
            value={f.image_url}
            onChange={(e) => setF({ ...f, image_url: e.target.value })}
          />
          <input
            className={input}
            placeholder="Upcoming event (e.g. Golf Day)"
            value={f.upcoming_event}
            onChange={(e) => setF({ ...f, upcoming_event: e.target.value })}
          />
          <input
            className={input}
            type="date"
            value={f.event_date}
            onChange={(e) => setF({ ...f, event_date: e.target.value })}
          />
          <textarea
            className={`${input} md:col-span-2`}
            rows={3}
            placeholder="Description"
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.is_featured}
            onChange={(e) => setF({ ...f, is_featured: e.target.checked })}
          />
          Feature on homepage
        </label>
        {msg && <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm">{msg}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={save} className="rounded-full bg-copper px-6 py-2 font-semibold text-ink">
            {editingId ? "Update" : "Add charity"}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setF(empty);
              }}
              className="rounded-full border border-white/20 px-6 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {list.map((c) => (
          <div key={c.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <p className="text-lg font-bold">
                {c.name}
                {c.is_featured && (
                  <span className="ml-2 rounded-full bg-copper/20 px-2 py-0.5 font-mono text-[10px] uppercase text-copper">
                    featured
                  </span>
                )}
              </p>
              <p className="text-sm text-cream/60">{c.description}</p>
              {c.upcoming_event && (
                <p className="text-sm text-sage">
                  {c.upcoming_event} {c.event_date ? "· " + c.event_date : ""}
                </p>
              )}
            </div>
            <div className="flex gap-4 text-sm">
              <button onClick={() => edit(c)} className="text-sage hover:underline">
                Edit
              </button>
              <button onClick={() => remove(c.id)} className="text-red-300 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}