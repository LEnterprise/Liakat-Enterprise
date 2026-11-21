(function () {
  "use strict";

  const S = window.LEStore;
  const $ = id => document.getElementById(id);
  const fmt = n => "B$ " + Math.round(n).toLocaleString("en-US");

  let dlg = null;
  let current = null;
  let draft = null;
  let submitted = null;

  const RULES = {
    name:  { input: "lqName",  err: "lqNameErr",  test: v => v.trim().length >= 2, msg: "Enter your full name." },
    phone: { input: "lqPhone", err: "lqPhoneErr", test: v => /^[+\d\s\-()]+$/.test(v.trim()) && v.replace(/\D/g, "").length >= 7,
             msg: "Enter a phone number with at least 7 digits, for example +673 712 3456." },
    email: { input: "lqEmail", err: "lqEmailErr", test: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), msg: "Enter a valid email address, like name@example.com." }
  };

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

  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "dlg";
    dlg.id = "landQuoteDialog";
    dlg.setAttribute("aria-labelledby", "lqTitle");
    dlg.innerHTML = `
      <div id="lqFormView">
        <form id="lqForm" novalidate style="display:flex; flex-direction:column; min-height:0;">
          <div class="dlg-body">
            <h2 id="lqTitle">Request a quote</h2>
            <p id="lqIntro"></p>
            <div class="dlg-quote">
              <div><span class="k">Your quote number</span><span class="vo-id" id="lqNo"></span></div>
              <div class="price"><span class="k">Listed price</span><span id="lqPrice"></span></div>
            </div>
            <div class="form-error" id="lqError" role="alert" hidden></div>
            <div class="field">
              <label for="lqName">Full name</label>
              <input id="lqName" name="name" type="text" autocomplete="name" aria-describedby="lqNameErr">
              <div class="err" id="lqNameErr"></div>
            </div>
            <div class="field">
              <label for="lqPhone">Phone number</label>
              <input id="lqPhone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+673 712 3456" aria-describedby="lqPhoneErr">
              <div class="err" id="lqPhoneErr"></div>
            </div>
            <div class="field">
              <label for="lqEmail">Email address</label>
              <input id="lqEmail" name="email" type="email" autocomplete="email" placeholder="name@example.com" aria-describedby="lqEmailErr">
              <div class="err" id="lqEmailErr"></div>
            </div>
          </div>
          <div class="dlg-foot stack">
            <button type="button" class="btn btn-outline" id="lqCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit quote request</button>
          </div>
        </form>
      </div>

      <div id="lqDoneView" hidden>
        <div class="dlg-body">
          <div class="dlg-icon ok">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
          </div>
          <h2 id="lqDoneTitle" tabindex="-1">Quote request sent</h2>
          <p id="lqDoneText"></p>
          <div class="dlg-quote big">
            <div><span class="k">Your quote number</span><span class="vo-id" id="lqDoneNo"></span></div>
          </div>
        </div>
        <div class="dlg-foot stack">
          <button type="button" class="btn btn-outline" id="lqCopy"><span id="lqCopyLabel" aria-live="polite">Copy quote number</span></button>
          <button type="button" class="btn btn-primary" id="lqDone">Done</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);

    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    $("lqCancel").addEventListener("click", () => dlg.close());
    $("lqDone").addEventListener("click", () => dlg.close());
    Object.values(RULES).forEach(r => $(r.input).addEventListener("input", () => $(r.input).setAttribute("aria-invalid", "false")));

    dlg.addEventListener("close", () => {
      unlockScroll();
      if (submitted) {
        submitted = null;
        $("lqForm").reset();
        Object.values(RULES).forEach(r => $(r.input).setAttribute("aria-invalid", "false"));
        showForm();
      }
    });

    $("lqForm").addEventListener("submit", onSubmit);
    $("lqCopy").addEventListener("click", copyNumber);
  }

  function showForm() { $("lqFormView").hidden = false; $("lqDoneView").hidden = true; }

  async function onSubmit(e) {
    e.preventDefault();
    let firstBad = null;
    Object.values(RULES).forEach(r => {
      const el = $(r.input), ok = r.test(el.value);
      el.setAttribute("aria-invalid", ok ? "false" : "true");
      $(r.err).textContent = ok ? "" : r.msg;
      if (!ok && !firstBad) firstBad = el;
    });
    if (firstBad) { firstBad.focus(); return; }

    const p = current;
    const record = {
      quoteNo: draft.quoteNo,
      submittedAt: new Date().toISOString(),
      status: "New",
      kind: "land",
      customer: { name: $("lqName").value.trim(), phone: $("lqPhone").value.trim(), email: $("lqEmail").value.trim() },
      property: { id: p.id, ref: p.ref, title: p.title, loc: p.loc, design: null, beds: 0, baths: 0, area: p.area, listedPrice: p.price },
      lines: [],
      upgradeTotal: 0,
      total: p.price,
      aiVisited: false
    };
    const sendBtn = document.querySelector('#lqForm button[type="submit"], button[type="submit"][form="lqForm"]');
    if (sendBtn.disabled) return;
    const sendLabel = sendBtn.textContent;
    sendBtn.disabled = true; sendBtn.textContent = "Sending\u2026";
    const saved = await S.addQuote(record);
    sendBtn.disabled = false; sendBtn.textContent = sendLabel;
    if (!saved) {
      const err = $("lqError");
      err.textContent = "We couldn't send your request. Please check your internet connection and try again.";
      err.hidden = false;
      return;
    }
    S.clearDraft(p.id);
    submitted = record;
    $("lqDoneText").textContent = "Thank you, " + record.customer.name + ". Our team will contact you about " + p.title + " to confirm the details and the price. Keep this quote number handy.";
    $("lqDoneNo").textContent = record.quoteNo;
    $("lqCopyLabel").textContent = "Copy quote number";
    $("lqFormView").hidden = true;
    $("lqDoneView").hidden = false;
    $("lqDoneTitle").focus();
  }

  async function copyNumber() {
    const text = submitted ? submitted.quoteNo : "";
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
      dlg.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch (__) {}
      ta.remove();
    }
    $("lqCopyLabel").textContent = ok ? "Copied" : "Couldn't copy";
    setTimeout(() => { $("lqCopyLabel").textContent = "Copy quote number"; }, 2000);
  }

  function open(property) {
    if (!property) return;
    if (!dlg) build();
    current = property;

    draft = S.getDraft(property.id);
    if (!draft || !draft.quoteNo) {
      draft = { quoteNo: S.newQuoteNo(), kind: "land" };
      S.saveDraft(property.id, draft);
    }

    showForm();
    $("lqError").hidden = true;
    $("lqTitle").textContent = "Request a quote for " + property.title;
    $("lqIntro").textContent = "Tell us how to reach you. Our team will contact you to confirm the details of this plot and its price.";
    $("lqNo").textContent = draft.quoteNo;
    $("lqPrice").textContent = fmt(property.price);

    lockScroll();
    dlg.showModal();
    $("lqName").focus();
  }

  window.LandQuote = { open: open };
})();
