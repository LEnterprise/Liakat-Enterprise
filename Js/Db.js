(function () {
  "use strict";

  const CFG = window.LE_CONFIG || {};
  const BASE = String(CFG.url || "").trim().replace(/\/+$/, "");
  const ANON = String(CFG.anonKey || "").trim();
  const configured = !!(BASE && ANON);

  const SESSION_KEY = "le.adminSession.v2";
  const POLL_MS = 30000;

  function toast(message) {
    try {
      let box = document.getElementById("leToast");
      if (!box) {
        box = document.createElement("div");
        box.id = "leToast";
        box.setAttribute("role", "alert");
        box.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:100000;max-width:min(92vw,520px);" +
          "background:#B42318;color:#fff;padding:12px 18px;border-radius:10px;font:600 14px/1.4 Inter,system-ui,sans-serif;" +
          "box-shadow:0 10px 30px rgba(0,0,0,.25);";
        document.body.appendChild(box);
      }
      box.textContent = message;
      box.hidden = false;
      clearTimeout(box._t);
      box._t = setTimeout(() => { box.hidden = true; }, 7000);
    } catch (_) {}
  }
  function reportError(e) {
    console.error(e);
    toast((e && e.message) || "Something went wrong. Please try again.");
  }
  function makeError(message, extra) { return Object.assign(new Error(message), extra || {}); }

  function readSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (s && s.refresh_token && s.email) return s;
    } catch (_) {}
    return null;
  }
  function writeSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); return true; } catch (_) { return false; }
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (_) {} }
  const isAdmin = () => configured && !!readSession();

  function storeTokens(j, fallbackEmail) {
    const now = Math.floor(Date.now() / 1000);
    return writeSession({
      email: (j.user && j.user.email) || fallbackEmail || "",
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || (now + (j.expires_in || 3600))
    });
  }

  let refreshing = null;
  async function accessToken() {
    const s = readSession();
    if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    if (!refreshing) {
      refreshing = (async () => {
        const res = await fetch(BASE + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { apikey: ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: s.refresh_token })
        });
        if (!res.ok) { clearSession(); return null; }
        const j = await res.json();
        storeTokens(j, s.email);
        return j.access_token;
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function login(email, password) {
    if (!configured) throw makeError("The database isn't connected yet.");
    let res;
    try {
      res = await fetch(BASE + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(email).trim(), password: String(password) })
      });
    } catch (_) { throw makeError("Couldn't reach the server. Check your internet connection."); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const bad = res.status === 400 || res.status === 401 || res.status === 422;
      throw makeError(bad ? "Incorrect email or password." : (j.error_description || j.msg || "Login failed. Please try again."), { status: res.status });
    }
    if (!storeTokens(j, email)) throw makeError("We couldn't start a session in this browser. Allow site storage for this page and try again.");
    let ok = false;
    try { ok = (await rpc("is_admin", {})) === true; } catch (_) {}
    if (!ok) { clearSession(); throw makeError("This account is not set up as an admin."); }
    return true;
  }
  function logout() { clearSession(); }

  async function request(path, opts) {
    opts = opts || {};
    const token = await accessToken();
    const headers = { apikey: ANON };
    if (token) headers.Authorization = "Bearer " + token;
    else if (ANON.indexOf("eyJ") === 0) headers.Authorization = "Bearer " + ANON;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.prefer) headers.Prefer = opts.prefer;
    let res;
    try {
      res = await fetch(BASE + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
      });
    } catch (_) { throw makeError("Couldn't reach the server. Check your internet connection and try again."); }

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      if (res.status === 401 && token) {
        clearSession();
        toast("Your admin session has ended. Please log in again.");
        setTimeout(() => window.location.reload(), 1500);
      }
      throw makeError((json && (json.message || json.error_description || json.msg)) || ("Request failed (" + res.status + ")"),
        { status: res.status, code: json && json.code });
    }
    return json;
  }
  const rpc = (name, args) => request("/rest/v1/rpc/" + name, { method: "POST", body: args || {} });
  const enc = encodeURIComponent;

  const loaders = [];
  let readyPromise = null;
  function register(name, fn) { loaders.push({ name: name, fn: fn }); }
  const ready = {
    then(onOk, onErr) {
      if (!readyPromise) {
        readyPromise = Promise.all(loaders.map(l =>
          Promise.resolve().then(l.fn).catch(e => { console.error("Loading " + l.name + " failed:", e); toast("Couldn't load " + l.name + " from the server."); })
        )).then(() => undefined);
      }
      return readyPromise.then(onOk, onErr);
    }
  };

  const collections = [];
  const anyListeners = [];
  const anyChange = () => anyListeners.forEach(fn => { try { fn(); } catch (_) {} });

  function collection(o) {
    const listeners = [];
    let cache = [];
    const keyOf = r => r && r[o.keyField];
    const notify = () => { listeners.forEach(fn => { try { fn(); } catch (_) {} }); anyChange(); };

    const readLocal = () => {
      try { const l = JSON.parse(localStorage.getItem(o.localKey)); return Array.isArray(l) ? l : []; }
      catch (_) { return []; }
    };
    const writeLocal = list => {
      try { localStorage.setItem(o.localKey, JSON.stringify(list)); return true; } catch (_) { return false; }
    };

    async function fetchAll() {
      if (!configured) return readLocal();
      if (isAdmin() || o.publicRead) {
        const rows = await request("/rest/v1/" + o.table + "?select=data&order=created_at.desc");
        return (Array.isArray(rows) ? rows : []).map(r => r.data).filter(Boolean);
      }
      if (o.clientLoad) return (await o.clientLoad()) || [];
      return [];
    }
    async function load() { cache = await fetchAll(); return cache; }
    async function refresh() {
      const next = await fetchAll();
      if (JSON.stringify(next) !== JSON.stringify(cache)) { cache = next; notify(); }
    }

    const getAll = () => cache;
    const find = key => cache.find(r => keyOf(r) === key) || null;
    const rowUrl = key => "/rest/v1/" + o.table + "?" + o.keyCol + "=eq." + enc(key);

    async function add(rec, opts) {
      opts = opts || {};
      if (!configured) {
        const list = readLocal();
        list.unshift(rec);
        if (!writeLocal(list)) return false;
        cache = list; notify();
        return rec;
      }
      try {
        let saved = rec;
        if (opts.submit) saved = (await opts.submit(rec)) || rec;
        else await request("/rest/v1/" + o.table, {
          method: "POST", prefer: "return=minimal",
          body: Object.assign({ [o.keyCol]: keyOf(rec), data: rec }, opts.extra || {})
        });
        if (isAdmin() || o.publicRead || o.clientLoad) { cache.unshift(saved); notify(); }
        return saved;
      } catch (e) {
        if (!opts.quiet) reportError(e);
        return false;
      }
    }

    async function update(key, patch, opts) {
      opts = opts || {};
      const i = cache.findIndex(r => keyOf(r) === key);
      if (i < 0) return false;
      const before = cache[i];
      const after = opts.replace ? Object.assign({}, patch) : Object.assign({}, before, patch);
      cache[i] = after; notify();
      if (!configured) return writeLocal(cache) ? true : (cache[i] = before, notify(), false);
      try {
        if (opts.submit) {
          const srv = await opts.submit(key, patch);
          if (srv && typeof srv === "object") { cache[cache.indexOf(after)] = srv; notify(); }
        } else {
          const done = await request(rowUrl(key), { method: "PATCH", prefer: "return=representation", body: { data: after } });
          if (!Array.isArray(done) || !done.length) throw makeError("The change wasn't saved. Please log in again and retry.");
        }
        return true;
      } catch (e) {
        const j = cache.indexOf(after);
        if (j >= 0) cache[j] = before;
        notify(); reportError(e);
        return false;
      }
    }

    async function remove(key) {
      const i = cache.findIndex(r => keyOf(r) === key);
      if (i < 0) return false;
      const gone = cache[i];
      cache.splice(i, 1); notify();
      if (!configured) return writeLocal(cache) ? true : (cache.splice(i, 0, gone), notify(), false);
      try {
        const done = await request(rowUrl(key), { method: "DELETE", prefer: "return=representation" });
        if (!Array.isArray(done) || !done.length) throw makeError("The record wasn't deleted. Please log in again and retry.");
        return true;
      } catch (e) {
        cache.splice(Math.min(i, cache.length), 0, gone);
        notify(); reportError(e);
        return false;
      }
    }

    async function removeAll() {
      const before = cache.slice();
      cache = []; notify();
      if (!configured) return writeLocal(cache) ? true : (cache = before, notify(), false);
      try {
        await request("/rest/v1/" + o.table + "?" + o.keyCol + "=not.is.null", { method: "DELETE", prefer: "return=minimal" });
        return true;
      } catch (e) { cache = before; notify(); reportError(e); return false; }
    }

    function setLocal(rec) {
      const i = cache.findIndex(r => keyOf(r) === keyOf(rec));
      if (i >= 0) cache[i] = rec; else cache.unshift(rec);
      notify();
    }

    window.addEventListener("storage", e => {
      if (!configured && (e.key === o.localKey || e.key === null)) { cache = readLocal(); notify(); }
    });

    const api = { load: load, refresh: refresh, getAll: getAll, find: find, add: add, update: update, remove: remove, removeAll: removeAll,
                  setLocal: setLocal, onChange: fn => listeners.push(fn) };
    collections.push(api);
    return api;
  }

  if (configured) {
    setInterval(() => {
      if (document.hidden || !isAdmin()) return;
      collections.forEach(c => c.refresh().catch(() => {}));
    }, POLL_MS);
  }

  async function badgeCounts() {
    const zero = { newQuotes: 0, reportedPayments: 0 };
    const countReported = plans => plans.reduce((n, p) => n + ((p && p.items) || []).filter(i => i.status === "Reported").length, 0);
    if (!configured) {
      let q = [], p = [];
      try { q = JSON.parse(localStorage.getItem("le.quotes.v1")) || []; } catch (_) {}
      try { p = JSON.parse(localStorage.getItem("le.payments.v1")) || []; } catch (_) {}
      return { newQuotes: q.filter(x => x.status === "New").length, reportedPayments: countReported(p) };
    }
    if (!isAdmin()) return zero;
    const [quotes, plans] = await Promise.all([
      request("/rest/v1/quote_requests?select=quote_no&data->>status=eq.New"),
      request("/rest/v1/payment_plans?select=data")
    ]);
    return { newQuotes: (quotes || []).length, reportedPayments: countReported((plans || []).map(r => r.data)) };
  }

  async function uploadPhoto(blob, name) {
    if (!configured) throw makeError("The database isn't connected.");
    const token = await accessToken();
    if (!token) throw makeError("Please log in again.");
    const path = Date.now().toString(36) + "-" + String(name).replace(/[^A-Za-z0-9._-]/g, "");
    let res;
    try {
      res = await fetch(BASE + "/storage/v1/object/listing-photos/" + path, {
        method: "POST",
        headers: { apikey: ANON, Authorization: "Bearer " + token, "Content-Type": blob.type || "image/jpeg", "x-upsert": "true" },
        body: blob
      });
    } catch (_) { throw makeError("Couldn't upload the photo. Check your internet connection."); }
    if (!res.ok) throw makeError("The photo couldn't be uploaded (" + res.status + ").");
    return BASE + "/storage/v1/object/public/listing-photos/" + path;
  }

  window.LEDb = {
    configured: configured, isAdmin: isAdmin, session: readSession,
    login: login, logout: logout, SESSION_KEY: SESSION_KEY,
    request: request, rpc: rpc, register: register, ready: ready, collection: collection,
    badgeCounts: badgeCounts, uploadPhoto: uploadPhoto,
    onAnyChange: fn => anyListeners.push(fn), reportError: reportError, toast: toast
  };
})();
