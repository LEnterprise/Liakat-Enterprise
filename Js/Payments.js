(function () {
  "use strict";

  const KEY = "le.payments.v1";
  const METHODS = ["Bank Transfer", "Cashier's Cheque", "Online Banking"];
  const PILL = {
    "Paid": "pill-green",
    "Pending": "pill-amber",
    "Overdue": "pill-red",
    "Awaiting confirmation": "pill-blue"
  };

  const MINE_KEY = "le.myPlans.v1";
  const mine = () => { try { const l = JSON.parse(localStorage.getItem(MINE_KEY)); return Array.isArray(l) ? l : []; } catch (_) { return []; } };
  const saveMine = list => { try { localStorage.setItem(MINE_KEY, JSON.stringify(list)); } catch (_) {} };
  const cleanCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const col = LEDb.collection({
    table: "payment_plans", keyField: "id", keyCol: "id", localKey: KEY,
    clientLoad: async () => {
      const saved = mine();
      const plans = await Promise.all(saved.map(m => LEDb.rpc("plan_get", { p_id: m.id, p_code: m.code }).catch(() => null)));
      const ok = plans.filter(p => p && p.id);
      if (ok.length !== saved.length) saveMine(saved.filter(m => ok.some(p => p.id === m.id)));
      return ok;
    }
  });
  LEDb.register("payment plans", () => col.load());

  const getAll = () => col.getAll();

  const rand = () => Math.random().toString(36).slice(2, 7);
  function newId() {
    const highest = getAll().reduce((m, p) => {
      const n = parseInt(String(p.id || "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return "PP-" + String(highest + 1).padStart(3, "0");
  }
  const newItemId = () => "pi_" + Date.now().toString(36) + rand();

  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function newAccessCode() {
    let c = "";
    const bytes = new Uint32Array(8);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(bytes) : bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 4294967296); });
    for (let i = 0; i < 8; i++) c += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    return c;
  }
  const formatCode = c => { c = cleanCode(c); return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : c; };

  function add(plan) {
    if (!plan.accessCode) plan.accessCode = newAccessCode();
    return col.add(plan, { extra: { access_code: cleanCode(plan.accessCode) } });
  }
  const update = (id, patch) => col.update(id, patch);

  function updateItem(planId, itemId, patch) {
    const p = col.find(planId);
    if (!p || !(p.items || []).some(x => x.id === itemId)) return Promise.resolve(false);
    const items = p.items.map(x => x.id === itemId ? Object.assign({}, x, patch) : x);
    if (LEDb.configured && !LEDb.isAdmin()) {
      const m = mine().find(x => x.id === planId);
      if (!m || patch.status !== "Reported") return Promise.resolve(false);
      return col.update(planId, { items: items }, {
        submit: () => LEDb.rpc("plan_report", {
          p_id: planId, p_code: m.code, p_item: itemId,
          p_method: patch.method || "", p_date: patch.paidDate || "", p_ref: patch.reference || ""
        })
      });
    }
    return col.update(planId, { items: items });
  }
  const remove = id => col.remove(id);

  async function lookup(id, code) {
    id = String(id || "").trim().toUpperCase();
    code = cleanCode(code);
    if (!LEDb.configured) return getAll().find(p => p.id === id) || null;
    if (!id || !code) return null;
    const plan = await LEDb.rpc("plan_get", { p_id: id, p_code: code });
    if (!plan || !plan.id) return null;
    saveMine(mine().filter(m => m.id !== plan.id).concat({ id: plan.id, code: code }));
    col.setLocal(plan);
    return plan;
  }
  const forget = id => { saveMine(mine().filter(m => m.id !== id)); };

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function displayStatus(item) {
    if (item.status === "Paid") return "Paid";
    if (item.status === "Reported") return "Awaiting confirmation";
    return item.dueDate && item.dueDate < today() ? "Overdue" : "Pending";
  }
  function totals(plan) {
    const items = plan.items || [];
    const sum = list => list.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const total = sum(items);
    const paid = sum(items.filter(i => i.status === "Paid"));
    const reported = items.filter(i => i.status === "Reported");
    const due = items
      .filter(i => i.status !== "Paid")
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    return {
      total: total,
      paid: paid,
      remaining: total - paid,
      pct: total > 0 ? Math.round(paid / total * 100) : 0,
      reportedCount: reported.length,
      overdueCount: items.filter(i => displayStatus(i) === "Overdue").length,
      next: due.find(i => i.status === "Pending") || null,
      complete: items.length > 0 && paid === total
    };
  }

  const onChange = fn => col.onChange(fn);

  window.LEPayments = {
    KEY, METHODS, PILL,
    getAll, add, update, updateItem, remove, newId, newItemId, newAccessCode, formatCode, lookup, forget,
    today, displayStatus, totals, onChange
  };
})();
