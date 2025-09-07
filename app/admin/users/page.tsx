"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserListItem = { id: number; username: string; name?: string; is_admin: boolean };

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [form, setForm] = useState<{ id?: number; username: string; name?: string; password?: string; is_admin: boolean }>({ username: "", name: "", password: "", is_admin: false });
  const [error, setError] = useState("");
  const [csrf, setCsrf] = useState<string>("");

  const load = async () => {
    setError("");
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (!res.ok) { setError("Forbidden"); return; }
    const data = await res.json();
    setUsers(data.users || []);
  };

  useEffect(() => {
    setCsrf((document.cookie.match(/(?:^|; )csrfToken=([^;]+)/)?.[1]) || "");
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const method = form.id ? "PUT" : "POST";
    const res = await fetch("/api/admin/users", {
      method,
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify(form)
    });
    if (!res.ok) { const d = await res.json().catch(()=>({error:""})); setError(d.error || "Failed"); return; }
    setForm({ username: "", name: "", password: "", is_admin: false });
    await load();
    router.refresh();
  };

  const onDelete = async (id: number) => {
    setError("");
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE", headers: { "x-csrf-token": csrf } });
    if (!res.ok) { const d = await res.json().catch(()=>({error:""})); setError(d.error || "Failed"); return; }
    await load();
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="text-lg font-semibold">Users</div>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
        <div className="mt-4 divide-y">
          {users.map(u => (
            <div key={u.id} className="py-2 flex items-center gap-3">
              <div className="font-medium">{u.username}</div>
              <div className="text-neutral-500">{u.name}</div>
              {u.is_admin && <span className="badge">Admin</span>}
              <div className="ml-auto flex gap-2">
                <button className="btn" onClick={() => setForm({ id: u.id, username: u.username, name: u.name, is_admin: u.is_admin })}>Edit</button>
                <button className="btn" onClick={() => onDelete(u.id)}>Delete</button>
              </div>
            </div>
          ))}
          {users.length === 0 && <div className="text-sm text-neutral-500 py-4">No users yet.</div>}
        </div>
      </section>

      <section className="card p-5">
        <div className="text-lg font-semibold">{form.id ? "Edit User" : "Create User"}</div>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <input className="input" placeholder="Username" value={form.username} onChange={e=>setForm(f=>({...f, username: e.target.value}))} />
          <input className="input" placeholder="Name" value={form.name||""} onChange={e=>setForm(f=>({...f, name: e.target.value}))} />
          <input className="input" type="password" placeholder={form.id?"New password (optional)":"Password"} value={form.password||""} onChange={e=>setForm(f=>({...f, password: e.target.value}))} />
          <label className="badge gap-2 cursor-pointer w-min">
            <input type="checkbox" className="accent-accent" checked={form.is_admin} onChange={e=>setForm(f=>({...f, is_admin: e.target.checked}))} />
            Admin
          </label>
          <div className="flex gap-2">
            <button className="btn" type="submit">{form.id?"Update":"Create"}</button>
            {form.id && <button className="btn" type="button" onClick={()=>setForm({ username: "", name: "", password: "", is_admin: false })}>Cancel</button>}
          </div>
        </form>
      </section>
    </div>
  );
}


