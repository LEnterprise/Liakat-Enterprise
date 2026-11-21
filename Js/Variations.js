(function () {
  "use strict";

  const KEY = "le.variations.v1";

  const STATUSES = ["Pending Approval", "In Review", "Approved", "Rejected", "Withdrawn"];
  const PILL = {
    "Pending Approval": "pill-amber",
    "In Review": "pill-blue",
    "Approved": "pill-green",
    "Rejected": "pill-red",
    "Withdrawn": "pill-navy"
  };
  const OPEN = ["Pending Approval", "In Review"];

  const AREAS = [
    "Kitchen", "Living room", "Dining area", "Master bedroom", "Bedroom",
    "Bathroom", "Main door / entrance", "Staircase", "Garage / car porch",
    "Garden / exterior", "Whole house", "Other"
  ];
  const TYPES = [
    "Change a material or finish",
    "Add something new",
    "Remove or leave out something",
    "Change the layout or room size",
    "Electrical, plumbing or lighting",
    "Other"
  ];
  const TIMINGS = [
    "As soon as possible",
    "Before finishes are installed",
    "Flexible, advise me"
  ];

  const MINE_KEY = "le.myVariations.v1";
  const mine = () => { try { const l = JSON.parse(localStorage.getItem(MINE_KEY)); return Array.isArray(l) ? l : []; } catch (_) { return []; } };
  const saveMine = list => { try { localStorage.setItem(MINE_KEY, JSON.stringify(list)); } catch (_) {} };

  const col = LEDb.collection({
    table: "variation_orders", keyField: "id", keyCol: "id", localKey: KEY,
    clientLoad: async () => {
      const tokens = mine().map(m => m.token);
      if (!tokens.length) return [];
      const rows = await LEDb.rpc("vo_get", { p_tokens: tokens });
      return Array.isArray(rows) ? rows : [];
    }
  });
  LEDb.register("variation requests", () => col.load());

  const getAll = () => col.getAll();

  function newId() {
    if (LEDb.configured && !LEDb.isAdmin()) return "VO-NEW";
    const highest = getAll().reduce((m, v) => {
      const n = parseInt(String(v.id || "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return "VO-" + String(highest + 1).padStart(3, "0");
  }

  function add(vo) {
    if (!LEDb.configured) return col.add(vo);
    return col.add(vo, {
      quiet: true,
      submit: async rec => {
        const token = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
        const id = await LEDb.rpc("vo_submit", { p_token: token, p_data: rec });
        saveMine(mine().concat({ id: id, token: token }));
        return Object.assign({}, rec, { id: id, status: "Pending Approval" });
      }
    });
  }
  function update(id, patch) {
    if (LEDb.configured && !LEDb.isAdmin()) {
      const m = mine().find(x => x.id === id);
      if (!m || patch.status !== "Withdrawn") return Promise.resolve(false);
      return col.update(id, patch, { submit: () => LEDb.rpc("vo_withdraw", { p_id: id, p_token: m.token }) });
    }
    return col.update(id, patch);
  }
  const remove = id => col.remove(id);
  const onChange = fn => col.onChange(fn);

  window.LEVariations = {
    KEY, STATUSES, PILL, OPEN, AREAS, TYPES, TIMINGS,
    getAll, add, update, remove, newId, onChange
  };
})();
