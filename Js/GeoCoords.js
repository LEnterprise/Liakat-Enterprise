(function () {
  "use strict";

  const VILLAGES = {
    "Sg. Hanching":    { lat: 4.9681, lng: 114.9777 },
    "Subok":           { lat: 4.8936, lng: 114.9656 },
    "Bunut Kanan":     { lat: 4.8923, lng: 114.8570 },
    "Tampoi":          { lat: 4.8923, lng: 114.8570 },
    "Jangsak":         { lat: 4.8810, lng: 114.8708 },
    "Kapok":           { lat: 5.0227, lng: 115.0454 },
    "Serusop":         { lat: 4.9468, lng: 114.9440 },
    "Tanjung Nangka":  { lat: 4.8764, lng: 114.8289 },
  };
  const FALLBACK = { lat: 4.9403, lng: 114.9480 };

  const RING = [[0, 0], [0.0012, 0.0009], [-0.0012, 0.0009], [0.0012, -0.0009], [-0.0012, -0.0009], [0, 0.0017], [0, -0.0017], [0.0019, 0]];

  function coordsFor(areaName, indexInArea) {
    const base = VILLAGES[areaName] || FALLBACK;
    const off = RING[indexInArea % RING.length];
    return { lat: +(base.lat + off[0]).toFixed(6), lng: +(base.lng + off[1]).toFixed(6), knownVillage: !!VILLAGES[areaName] };
  }

  function placeAll(list) {
    const seen = {};
    return list.map(p => {
      const key = p.areaName || "";
      const i = seen[key] || 0; seen[key] = i + 1;
      return Object.assign({}, p, coordsFor(key, i));
    });
  }

  window.LEGeo = { VILLAGES: VILLAGES, coordsFor: coordsFor, placeAll: placeAll };
})();
