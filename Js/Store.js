(function () {
  "use strict";

  const QUOTES_KEY = "le.quotes.v1";
  const DRAFT_PREFIX = "le.draft.v1.";
  const LAST_PROPERTY_KEY = "le.lastProperty.v1";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function newQuoteNo() {
    const d = new Date();
    const yymmdd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    const existing = new Set(quotes.getAll().map(q => q.quoteNo));
    let no;
    do {
      let tail = "";
      for (let i = 0; i < 4; i++) tail += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      no = "LQ-" + yymmdd + "-" + tail;
    } while (existing.has(no));
    return no;
  }

  function getDraft(propertyId) { return read(DRAFT_PREFIX + propertyId, null); }
  function saveDraft(propertyId, draft) { return write(DRAFT_PREFIX + propertyId, draft); }
  function clearDraft(propertyId) { remove(DRAFT_PREFIX + propertyId); }
  function getLastProperty() { return read(LAST_PROPERTY_KEY, null); }
  function setLastProperty(id) { write(LAST_PROPERTY_KEY, id); }

  const quotes = LEDb.collection({ table: "quote_requests", keyField: "quoteNo", keyCol: "quote_no", localKey: QUOTES_KEY });
  LEDb.register("quote requests", () => quotes.load());

  const getQuotes = () => quotes.getAll();

  async function addQuote(record) {
    if (!LEDb.configured) return quotes.add(record);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await LEDb.rpc("quote_submit", { p_quote_no: record.quoteNo, p_data: record });
        return record;
      } catch (e) {
        if (e && e.code === "23505") { record.quoteNo = newQuoteNo(); continue; }
        console.error(e);
        return false;
      }
    }
    return false;
  }
  const updateQuote = (quoteNo, patch) => quotes.update(quoteNo, patch);
  const deleteQuote = quoteNo => quotes.remove(quoteNo);

  const onChange = fn => quotes.onChange(fn);

  window.LEStore = {
    newQuoteNo,
    getDraft, saveDraft, clearDraft, getLastProperty, setLastProperty,
    getQuotes, addQuote, updateQuote, deleteQuote, onChange
  };
})();
