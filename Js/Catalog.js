(function () {
  "use strict";

  const ITEMS = [
    { code:"T001", name:"Porcelain White", cat:"tiles", type:"Floor Tile",    size:"60 x 60 cm",  finish:"Glossy",   price:12, unit:"sqft", color:"#EDEAE3", img:"Img/Materials/PorcelainWhite.jpg", imgSm:"Img/Materials/PorcelainWhiteSm.jpg", standard:true },
    { code:"T002", name:"Grey Stone",      cat:"tiles", type:"Floor Tile",    size:"60 x 60 cm",  finish:"Matte",    price:14, unit:"sqft", color:"#B7BEC6", img:"Img/Materials/GreyStone.jpg", imgSm:"Img/Materials/GreyStoneSm.jpg" },
    { code:"T004", name:"Wood Look",       cat:"tiles", type:"Floor Tile",    size:"20 x 120 cm", finish:"Matte",    price:18, unit:"sqft", color:"#A9754C", img:"Img/Materials/WoodLook.jpg", imgSm:"Img/Materials/WoodLookSm.jpg" },
    { code:"T008", name:"Terrazzo",        cat:"tiles", type:"Floor Tile",    size:"60 x 60 cm",  finish:"Matte",    price:17, unit:"sqft", color:"#DCDCD6", img:"Img/Materials/Terrazzo.jpg", imgSm:"Img/Materials/TerrazzoSm.jpg" },
    { code:"T009", name:"Sand Beige",      cat:"tiles", type:"Floor Tile",    size:"60 x 60 cm",  finish:"Matte",    price:13, unit:"sqft", color:"#D9CDB4", img:"Img/Materials/SandBeige.jpg", imgSm:"Img/Materials/SandBeigeSm.jpg" },

    { code:"T005", name:"Matte Grey",      cat:"tiles", type:"Wall Tile",     size:"30 x 60 cm",  finish:"Matte",    price:13, unit:"sqft", color:"#8D9199", img:"Img/Materials/MatteGrey.jpg", imgSm:"Img/Materials/MatteGreySm.jpg", standard:true },
    { code:"T003", name:"Beige Marble",    cat:"tiles", type:"Wall Tile",     size:"30 x 60 cm",  finish:"Polished", price:16, unit:"sqft", color:"#DCC9A6", img:"Img/Materials/BeigeMarble.jpg", imgSm:"Img/Materials/BeigeMarbleSm.jpg" },
    { code:"T011", name:"White Subway",    cat:"tiles", type:"Wall Tile",     size:"10 x 30 cm",  finish:"Glossy",   price:15, unit:"sqft", color:"#F4F4F1", img:"Img/Materials/WhiteSubway.jpg", imgSm:"Img/Materials/WhiteSubwaySm.jpg" },

    { code:"T007", name:"Classic White",   cat:"tiles", type:"Bathroom Tile", size:"30 x 30 cm",  finish:"Glossy",   price:11, unit:"sqft", color:"#F1F0EC", img:"Img/Materials/ClassicWhite.jpg", imgSm:"Img/Materials/ClassicWhiteSm.jpg", standard:true },
    { code:"T010", name:"Slate Grey",      cat:"tiles", type:"Bathroom Tile", size:"30 x 60 cm",  finish:"Matte",    price:15, unit:"sqft", color:"#6E7A85", img:"Img/Materials/SlateGrey.jpg", imgSm:"Img/Materials/SlateGreySm.jpg" },
    { code:"T006", name:"Black Marble",    cat:"tiles", type:"Bathroom Tile", size:"30 x 30 cm",  finish:"Polished", price:22, unit:"sqft", color:"#26282C", img:"Img/Materials/BlackMarble.jpg", imgSm:"Img/Materials/BlackMarbleSm.jpg" },

    { code:"D005", name:"Steel Security Door",   cat:"doors", type:"Main Door",     size:"100 x 210 cm", finish:"Powder-coated grey", price:980,  unit:"door", color:"#5A626C", img:"Img/Materials/SteelSecurityDoor.jpg", imgSm:"Img/Materials/SteelSecurityDoorSm.jpg", standard:true },
    { code:"D004", name:"Solid Timber Door",     cat:"doors", type:"Main Door",     size:"100 x 210 cm", finish:"Natural timber",     price:1450, unit:"door", color:"#8A5A34", img:"Img/Materials/SolidTimberDoor.jpg", imgSm:"Img/Materials/SolidTimberDoorSm.jpg" },
    { code:"D006", name:"Glass & Timber Door",   cat:"doors", type:"Main Door",     size:"110 x 220 cm", finish:"Timber, glazed",     price:2100, unit:"door", color:"#B98F62", img:"Img/Materials/GlassTimberDoor.jpg", imgSm:"Img/Materials/GlassTimberDoorSm.jpg" },

    { code:"D001", name:"Flush Door White",      cat:"doors", type:"Interior Door", size:"80 x 210 cm",  finish:"Painted white",      price:220,  unit:"door", color:"#F3F2EE", img:"Img/Materials/FlushDoorWhite.jpg", imgSm:"Img/Materials/FlushDoorWhiteSm.jpg", standard:true },
    { code:"D002", name:"Oak Veneer Door",       cat:"doors", type:"Interior Door", size:"80 x 210 cm",  finish:"Oak veneer",         price:320,  unit:"door", color:"#C79A63", img:"Img/Materials/OakVeneerDoor.jpg", imgSm:"Img/Materials/OakVeneerDoorSm.jpg" },
    { code:"D003", name:"Walnut Panel Door",     cat:"doors", type:"Interior Door", size:"80 x 210 cm",  finish:"Walnut panel",       price:380,  unit:"door", color:"#6B4A33", img:"Img/Materials/WalnutPanelDoor.jpg", imgSm:"Img/Materials/WalnutPanelDoorSm.jpg" },

    { code:"S001", name:"Essential Set", cat:"sanitary", type:"Sanitary Set", size:"WC, basin, shower",            finish:"White ceramic",       price:850,  unit:"set", color:"#F1F0EC", img:"Img/Materials/EssentialSet.jpg", imgSm:"Img/Materials/EssentialSetSm.jpg", standard:true },
    { code:"S002", name:"Comfort Set",   cat:"sanitary", type:"Sanitary Set", size:"Wall-hung WC, basin, shower", finish:"White ceramic",       price:1350, unit:"set", color:"#E3E6EA", img:"Img/Materials/ComfortSet.jpg", imgSm:"Img/Materials/ComfortSetSm.jpg" },
    { code:"S003", name:"Premium Set",   cat:"sanitary", type:"Sanitary Set", size:"Wall-hung WC, basin, rain shower", finish:"Matte black fittings", price:2200, unit:"set", color:"#33363B", img:"Img/Materials/PremiumSet.jpg", imgSm:"Img/Materials/PremiumSetSm.jpg" },
    { code:"S004", name:"Designer Set",  cat:"sanitary", type:"Sanitary Set", size:"Wall-hung WC, vanity, rain shower", finish:"Brushed brass fittings", price:3100, unit:"set", color:"#C9A56A", img:"Img/Materials/DesignerSet.jpg", imgSm:"Img/Materials/DesignerSetSm.jpg" }
  ];

  const round10 = n => Math.round(n / 10) * 10;

  const SLOTS = {
    floor:    { key:"floor",    type:"Floor Tile",    label:"Floor tiles",    where:"Living, dining & bedrooms", qty: h => round10(h.area * 0.70) },
    wall:     { key:"wall",     type:"Wall Tile",     label:"Wall tiles",     where:"Kitchen & feature walls",   qty: h => round10(h.area * 0.05) },
    bath:     { key:"bath",     type:"Bathroom Tile", label:"Bathroom tiles", where:"Bathroom floors & walls",   qty: h => h.baths * 100 },
    main:     { key:"main",     type:"Main Door",     label:"Main door",      where:"Front entrance",            qty: () => 1 },
    interior: { key:"interior", type:"Interior Door", label:"Interior doors", where:"Bedrooms & bathrooms",      qty: h => h.beds + h.baths },
    sanitary: { key:"sanitary", type:"Sanitary Set",  label:"Sanitary wares", where:"One set per bathroom",      qty: h => h.baths }
  };
  const SLOT_ORDER = ["floor", "wall", "bath", "main", "interior", "sanitary"];

  const UNIT_LABEL = { sqft: "sqft", door: "door", set: "set" };
  const UNIT_LABEL_PLURAL = { sqft: "sqft", door: "doors", set: "sets" };

  const byCode = code => ITEMS.find(i => i.code === code) || null;
  const slotForType = type => SLOT_ORDER.map(k => SLOTS[k]).find(s => s.type === type) || null;
  const standardFor = slotKey => ITEMS.find(i => i.type === SLOTS[slotKey].type && i.standard);

  const fmt = n => "B$ " + Math.round(n).toLocaleString("en-US");
  const fmtDelta = n => n === 0 ? "Included" : (n > 0 ? "+ " : "− ") + fmt(Math.abs(n));
  const fmtPrice = item => fmt(item.price) + " / " + UNIT_LABEL[item.unit];
  const fmtQty = (qty, unit) => qty.toLocaleString("en-US") + " " + (qty === 1 ? UNIT_LABEL[unit] : UNIT_LABEL_PLURAL[unit]);

  function houseFrom(p) {
    return { price: p.price, beds: p.beds, baths: p.baths, area: parseInt(String(p.area).replace(/[^\d]/g, ""), 10) };
  }

  function standardPicks() {
    const picks = {};
    SLOT_ORDER.forEach(k => { picks[k] = standardFor(k).code; });
    return picks;
  }

  function computeQuote(property, picks) {
    const h = houseFrom(property);
    const lines = SLOT_ORDER.map(key => {
      const slot = SLOTS[key];
      const std = standardFor(key);
      let item = byCode(picks && picks[key]);
      if (!item || item.type !== slot.type) item = std;
      const qty = slot.qty(h);
      const upgradeCost = (item.price - std.price) * qty;
      return {
        slot: key, label: slot.label, where: slot.where,
        code: item.code, name: item.name, type: item.type, unit: item.unit, unitPrice: item.price, color: item.color, img: item.img, imgSm: item.imgSm,
        standardCode: std.code, standardName: std.name, standardPrice: std.price,
        qty, upgradeCost, isUpgrade: item.code !== std.code
      };
    });
    const upgradeTotal = lines.reduce((sum, l) => sum + l.upgradeCost, 0);
    return { lines, listedPrice: h.price, upgradeTotal, total: h.price + upgradeTotal };
  }

  function previewCost(property, item) {
    const slot = slotForType(item.type);
    const std = standardFor(slot.key);
    const qty = slot.qty(houseFrom(property));
    return { slot, std, qty, delta: (item.price - std.price) * qty };
  }

  window.LECatalog = {
    items: ITEMS, slots: SLOTS, slotOrder: SLOT_ORDER,
    byCode, slotForType, standardFor, standardPicks, computeQuote, previewCost, houseFrom,
    fmt, fmtDelta, fmtPrice, fmtQty
  };
})();
