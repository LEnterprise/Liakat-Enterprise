(function () {
  "use strict";

  const DEMO = !LEDb.configured;
  const DEV_USER = "admin";
  const DEV_PASS = "bingo123";

  const SESSION_KEY = DEMO ? "le.devSession.v1" : LEDb.SESSION_KEY;
  const SESSION_HOURS = 8;
  const DEV_PAGES = ["ManageUpdates.html", "Approvals.html", "Payments.html", "QuoteRequests.html", "Listings.html"];

  const IS_DEV_PAGE = /\/Developer\/[^\/]*$/.test(window.location.pathname);
  const ROOT = IS_DEV_PAGE ? "../" : "";

  function readSession() {
    if (!DEMO) {
      const s = LEDb.session();
      return s ? { user: s.email } : null;
    }
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (s && s.user && typeof s.at === "number" && Date.now() - s.at < SESSION_HOURS * 3600 * 1000) return s;
      if (s) localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
    return null;
  }
  function startSession(user) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user: user, at: Date.now() })); return true; }
    catch (_) { return false; }
  }
  function endSession() {
    if (!DEMO) { LEDb.logout(); return; }
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }
  const safeNext = n => DEV_PAGES.includes(n) ? n : "ManageUpdates.html";
  const devUrl = n => ROOT + "Developer/" + safeNext(n);

  function guard() {
    if (!IS_DEV_PAGE || readSession()) return true;
    document.documentElement.style.display = "none";
    const page = window.location.pathname.split("/").pop();
    const q = "?login=dev" + (DEV_PAGES.includes(page) ? "&next=" + encodeURIComponent(page) : "");
    window.location.replace(ROOT + "index.html" + q);
    return false;
  }
  if (!guard()) return;
  if (IS_DEV_PAGE) {
    window.addEventListener("pageshow", e => { if (e.persisted) guard(); });
    window.addEventListener("storage", e => { if (e.key === SESSION_KEY || e.key === null) guard(); });
  }

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const ICON_KEY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l3 3M14.5 8.5l2 2"/></svg>';
  const ICON_GRID = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  const ICON_OUT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>';

  let wrap, btn, panel, dlg, form, userEl, passEl, errEl, pendingNext = null;

  function lockScroll() {
    const de = document.documentElement;
    if (de.classList.contains("pd-lock")) return;
    const sw = window.innerWidth - de.clientWidth;
    if (sw > 0) de.style.paddingRight = sw + "px";
    de.classList.add("pd-lock");
  }
  function unlockScroll() {
    if (document.querySelector("dialog[open]")) return;
    document.documentElement.classList.remove("pd-lock");
    document.documentElement.style.paddingRight = "";
  }

  function renderPanel() {
    const s = readSession();
    btn.classList.toggle("signed-in", !!s);
    btn.setAttribute("aria-label", s ? "Account, signed in as " + s.user : "Account");
    panel.innerHTML = s
      ? `<div class="ap-head">Signed in as ${esc(s.user)}</div>
         <a class="ap-item" href="${devUrl("ManageUpdates.html")}">${ICON_GRID} Open Admin portal</a>
         <button type="button" class="ap-item" id="apLogout">${ICON_OUT} Log out</button>`
      : `<div class="ap-head">Admin access</div>
         <button type="button" class="ap-item" id="apLogin">${ICON_KEY} Log in to Admin</button>`;
  }
  function openPanel() {
    renderPanel();
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const first = panel.querySelector(".ap-item");
    if (first) first.focus();
  }
  function closePanel(returnFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (returnFocus) btn.focus();
  }

  function buildDialog() {
    const d = document.createElement("dialog");
    d.className = "dlg";
    d.id = "devLoginDialog";
    d.setAttribute("aria-labelledby", "dlTitle");
    d.innerHTML = `
      <form id="devLoginForm" novalidate style="display:flex; flex-direction:column; min-height:0;">
        <div class="dlg-body">
          <div class="dlg-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </div>
          <h2 id="dlTitle">Log in to Admin</h2>
          <p>Enter your admin ${DEMO ? "username" : "email"} and password to open the Admin portal.</p>
          <div class="form-error" id="dlError" role="alert" hidden style="margin-top:14px;"></div>
          <div class="field" style="margin-top:16px;">
            <label for="dlUser">${DEMO ? "Username" : "Email"}</label>
            <input id="dlUser" name="username" type="${DEMO ? "text" : "email"}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="dlUserErr">
            <div class="err" id="dlUserErr"></div>
          </div>
          <div class="field">
            <label for="dlPass">Password</label>
            <input id="dlPass" name="password" type="password" autocomplete="current-password" aria-describedby="dlPassErr">
            <div class="err" id="dlPassErr"></div>
          </div>
        </div>
        <div class="dlg-foot stack">
          <button type="button" class="btn btn-outline" id="dlCancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Log in</button>
        </div>
      </form>`;
    document.body.appendChild(d);
    return d;
  }

  function fieldError(input, msg) {
    input.setAttribute("aria-invalid", "true");
    document.getElementById(input.id + "Err").textContent = msg;
  }
  function clearErrors() {
    [userEl, passEl].forEach(i => { i.setAttribute("aria-invalid", "false"); document.getElementById(i.id + "Err").textContent = ""; });
    errEl.hidden = true;
  }
  function openLogin(next) {
    pendingNext = safeNext(next);
    closePanel(false);
    clearErrors();
    userEl.value = ""; passEl.value = "";
    lockScroll();
    dlg.showModal();
    userEl.focus();
  }
  function stripLoginParams() {
    try {
      const u = new URL(window.location.href);
      if (!u.searchParams.has("login") && !u.searchParams.has("next")) return;
      u.searchParams.delete("login"); u.searchParams.delete("next");
      history.replaceState(null, "", u);
    } catch (_) {}
  }

  function init() {
    const oldBtn = document.querySelector(".header-actions .avatar-btn");
    if (!oldBtn) return;
    wrap = oldBtn.parentElement;

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-btn";
    btn.innerHTML = oldBtn.innerHTML;
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "accountPanel");
    oldBtn.replaceWith(btn);

    panel = document.createElement("div");
    panel.className = "account-panel";
    panel.id = "accountPanel";
    panel.hidden = true;
    wrap.appendChild(panel);

    dlg = buildDialog();
    form = document.getElementById("devLoginForm");
    userEl = document.getElementById("dlUser");
    passEl = document.getElementById("dlPass");
    errEl = document.getElementById("dlError");
    renderPanel();

    btn.addEventListener("click", () => { panel.hidden ? openPanel() : closePanel(false); });
    panel.addEventListener("click", e => {
      if (e.target.closest("#apLogin")) openLogin(null);
      if (e.target.closest("#apLogout")) {
        endSession();
        if (IS_DEV_PAGE) window.location.href = ROOT + "index.html";
        else { closePanel(true); renderPanel(); }
      }
    });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) closePanel(false); });
    document.addEventListener("focusin", e => { if (!wrap.contains(e.target)) closePanel(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden && !dlg.open) closePanel(true); });

    dlg.addEventListener("close", () => { unlockScroll(); passEl.value = ""; pendingNext = null; stripLoginParams(); });
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    document.getElementById("dlCancel").addEventListener("click", () => dlg.close());
    [userEl, passEl].forEach(i => i.addEventListener("input", () => { i.setAttribute("aria-invalid", "false"); errEl.hidden = true; }));

    form.addEventListener("submit", async e => {
      e.preventDefault();
      clearErrors();
      const u = userEl.value.trim(), p = passEl.value;
      if (!u) { fieldError(userEl, DEMO ? "Enter your username." : "Enter your email."); userEl.focus(); return; }
      if (!p) { fieldError(passEl, "Enter your password."); passEl.focus(); return; }

      if (DEMO) {
        if (u === DEV_USER && p === DEV_PASS) {
          if (!startSession(u)) {
            errEl.textContent = "We couldn't start a session in this browser. Allow site storage for this page and try again.";
            errEl.hidden = false;
            return;
          }
          window.location.href = devUrl(pendingNext);
        } else {
          errEl.textContent = "Incorrect username or password.";
          errEl.hidden = false;
          passEl.value = "";
          passEl.focus();
        }
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true; submit.textContent = "Logging in\u2026";
      try {
        await LEDb.login(u, p);
        window.location.href = devUrl(pendingNext);
      } catch (err) {
        errEl.textContent = (err && err.message) || "Login failed. Please try again.";
        errEl.hidden = false;
        passEl.value = "";
        passEl.focus();
      }
      submit.disabled = false; submit.textContent = "Log in";
    });

    const params = new URLSearchParams(window.location.search);
    if (!IS_DEV_PAGE && params.get("login") === "dev") {
      if (readSession()) window.location.replace(devUrl(params.get("next")));
      else openLogin(params.get("next"));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
