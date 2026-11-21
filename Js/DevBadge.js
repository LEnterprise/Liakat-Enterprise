(function () {
  function paint(sel, n, text) {
    document.querySelectorAll(sel).forEach(el => {
      el.textContent = n;
      el.hidden = n === 0;
      el.setAttribute("aria-label", text(n));
    });
  }
  function update() {
    LEDb.badgeCounts().then(c => {
      paint("[data-quote-badge]", c.newQuotes, n => n + " new quote request" + (n === 1 ? "" : "s"));
      paint("[data-pay-badge]", c.reportedPayments, n => n + " payment" + (n === 1 ? "" : "s") + " awaiting confirmation");
    }).catch(() => {});
  }
  update();
  LEDb.onAnyChange(update);
  setInterval(() => { if (!document.hidden) update(); }, 30000);
  window.addEventListener("storage", update);
})();
