(function () {
  "use strict";

  const KEY = "le.updates.v1";
  const STATUSES = ["In Progress", "On Track", "Delayed", "Completed"];
  const PILL = { "In Progress": "pill-blue", "On Track": "pill-green", "Delayed": "pill-amber", "Completed": "pill-navy" };

  const col = LEDb.collection({ table: "project_updates", keyField: "id", keyCol: "id", localKey: KEY, publicRead: true });
  LEDb.register("project updates", () => col.load());

  const getAll = () => col.getAll();
  const add = u => col.add(u);
  const update = (id, patch) => col.update(id, patch);
  const remove = id => col.remove(id);
  const newId = () => "pu_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const onChange = fn => col.onChange(fn);

  window.LEUpdates = { KEY, STATUSES, PILL, getAll, add, update, remove, newId, onChange };
})();
