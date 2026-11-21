(function () {
  "use strict";

  const KEY = "le.listings.v1";
  const HIDDEN_KEY = "le.listings.hidden.v1";
  const BUILT_IN = (typeof properties !== "undefined" ? properties : []).filter(p => !p.custom);

  const DISTRICTS = ["Brunei-Muara", "Tutong", "Belait", "Temburong"];

  const custom = LEDb.collection({ table: "listings", keyField: "id", keyCol: "id", localKey: KEY, publicRead: true });
  const removed = LEDb.collection({ table: "removed_listings", keyField: "id", keyCol: "id", localKey: HIDDEN_KEY, publicRead: true });
  LEDb.register("listings", async () => { await Promise.all([custom.load(), removed.load()]); rebuild(); });
  const getCustom = () => custom.getAll();
  const getHidden = () => removed.getAll().map(r => r && r.id).filter(x => typeof x === "string");
  const onChange = fn => { custom.onChange(fn); removed.onChange(fn); };
  custom.onChange(() => rebuild());
  removed.onChange(() => rebuild());

  const str = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 200);
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const pairs = (list, max) => (Array.isArray(list) ? list : [])
    .filter(r => Array.isArray(r) && r.length >= 2)
    .map(r => [str(r[0], 40), str(r[1], 60)]).filter(r => r[0] && r[1]).slice(0, max || 12);

  function normalize(l) {
    if (!l || typeof l !== "object") return null;
    const id = str(l.id, 80), title = str(l.title, 80), loc = str(l.loc, 80);
    const price = Math.round(num(l.price));
    const areaText = str(l.area, 30);
    if (!/^[a-z0-9-]+$/.test(id) || !title || !loc || price <= 0 || !/\d/.test(areaText)) return null;
    const isHouse = l.type === "For Sale";

    const p = {
      id: id,
      ref: str(l.ref, 20) || "LE-000",
      title: title,
      loc: loc,
      areaName: str(l.areaName, 40),
      district: str(l.district, 30),
      price: price,
      type: isHouse ? "For Sale" : "Land",
      beds: isHouse ? Math.max(0, Math.round(num(l.beds))) : 0,
      baths: isHouse ? Math.max(0, Math.round(num(l.baths))) : 0,
      area: areaText,
      icon: isHouse ? "house" : "land",
      design: isHouse && l.design ? str(l.design, 60) : null,
      desc: str(l.desc, 800),
      features: (Array.isArray(l.features) ? l.features : []).map(f => str(f, 60)).filter(Boolean).slice(0, 10),
      featured: !!l.featured,
      createdAt: str(l.createdAt, 40),
      custom: true
    };
    if (l.tag === "Featured" || l.tag === "New") p.tag = l.tag;
    if (typeof l.image === "string" && l.image) p.image = l.image;
    if (typeof l.thumb === "string" && l.thumb) p.thumb = l.thumb;
    if (l.tenure) p.tenure = str(l.tenure, 40);
    if (l.address) p.address = str(l.address, 160);
    if (l.imageNote) p.imageNote = str(l.imageNote, 40);
    if (isHouse) {
      p.style = str(l.style, 60);
      const fl = Math.round(num(l.floors));
      if (fl >= 1) p.floors = Math.min(10, fl);
      p.rooms = pairs(l.rooms);
    } else {
      p.details = pairs(l.details);
    }
    return p;
  }

  function rebuild() {
    if (typeof properties === "undefined") return;
    const hidden = new Set(getHidden());
    const base = BUILT_IN.filter(p => !hidden.has(p.id));
    properties.splice(0, properties.length, ...base);
    const seen = new Set(properties.map(p => p.id));
    const add = [];
    getCustom().forEach(l => {
      const n = normalize(l);
      if (n && !seen.has(n.id)) { seen.add(n.id); add.push(n); }
    });
    properties.unshift.apply(properties, add);
  }

  const add = listing => custom.add(listing);
  const update = (id, listing) => custom.update(id, listing, { replace: true });
  function remove(id) {
    if (BUILT_IN.some(p => p.id === id)) {
      if (getHidden().includes(id)) return Promise.resolve(true);
      return removed.add({ id: id }).then(r => !!r);
    }
    return custom.remove(id);
  }
  const removedCount = () => BUILT_IN.filter(p => getHidden().includes(p.id)).length;
  const restoreRemoved = () => removed.removeAll();
  const getRaw = id => getCustom().find(x => x && x.id === id) || null;

  const slug = s => str(s, 80).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "listing";
  function uniqueId(title, keepId) {
    const taken = new Set(properties.map(p => p.id));
    if (keepId) taken.delete(keepId);
    const base = slug(title);
    let id = base, n = 2;
    while (taken.has(id)) id = base + "-" + (n++);
    return id;
  }
  function nextRef() {
    const highest = properties.reduce((m, p) => {
      const n = parseInt(String(p.ref || "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return "LE-" + String(highest + 1).padStart(3, "0");
  }
  function locationNames() {
    const names = [];
    if (typeof properties !== "undefined") {
      properties.forEach(p => {
        if (p.areaName && !names.some(n => n.toLowerCase() === p.areaName.toLowerCase())) names.push(p.areaName);
      });
    }
    return names;
  }
  function canonicalArea(name) {
    const clean = str(name, 40);
    return locationNames().find(n => n.toLowerCase() === clean.toLowerCase()) || clean;
  }
  function designs() {
    const map = new Map();
    properties.forEach(p => { if (p.design && !map.has(p.design)) map.set(p.design, p.style || ""); });
    return [...map.entries()].map(([name, style]) => ({ name: name, style: style })).sort((a, b) => a.name.localeCompare(b.name));
  }
  const locLabel = (area, district) => area + ", " + (district === "Brunei-Muara" ? "Brunei" : district);

  function exportText() {
    const list = properties.map(p => { const c = Object.assign({}, p); delete c.custom; delete c.createdAt; return c; });
    return "const properties = " + JSON.stringify(list, null, 2) + ";\n";
  }

  rebuild();

  window.LEListings = {
    KEY: KEY, DISTRICTS: DISTRICTS,
    getCustom: getCustom, getRaw: getRaw, onChange: onChange, add: add, update: update, remove: remove, removedCount: removedCount, restoreRemoved: restoreRemoved, rebuild: rebuild,
    normalize: normalize, uniqueId: uniqueId, nextRef: nextRef, slug: slug,
    locationNames: locationNames, canonicalArea: canonicalArea, designs: designs, locLabel: locLabel,
    exportText: exportText
  };
})();
