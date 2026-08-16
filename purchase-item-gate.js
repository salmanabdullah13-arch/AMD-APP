// ═══════════════════════════════════════════════════════════════════════
// The duplicate gate for item creation — design handoff 17a.
//
// Why this blocks rather than warns, in the handoff's own words: two codes
// for one item split the stock count, split the purchase history, and put
// two different "last rates" in front of the Estimator. That is a real
// failure, not a tidiness problem.
//
// This file is pure logic — no DOM, no rendering. It loads right after
// data.js so the item master is in scope, and it is the single source of
// the matching rule for both the create form and createItemMasterEntry()'s
// own guard. One copy, so the screen and the save can never disagree.
//
// Scope note: the handoff also requires this to run server-side on save
// ("a client-side gate is a courtesy, not a guarantee"). That needs a
// Postgres function against the live project, which needs a Management API
// token — see PURCHASE_ITEM_GATE_SERVER_SIDE at the bottom of this file.
// ═══════════════════════════════════════════════════════════════════════

// Thresholds are the handoff's, exactly. Named rather than inlined because
// createItemMasterEntry()'s guard has to test against the same numbers.
const ITEM_DUP_EXACT = 0.92;
const ITEM_DUP_NEAR  = 0.62;
const ITEM_DUP_WEAK  = 0.34;

// Abbreviation map. The handoff calls this out as "the part that does the
// work" and says to extend it from the real master's actual spellings —
// these are read off the live 200-item export already seeded in data.js
// (TOO090 SPANNER, WVN veneers, PLY sheets and so on), not invented.
const ITEM_ABBREV = {
  vnr: "veneer", ven: "veneer", veneers: "veneer", vener: "veneer",
  plywood: "ply", plw: "ply", plys: "ply",
  book: "bookmatch", matched: "bookmatch", bookmatched: "bookmatch",
  sht: "sheet", sheets: "sheet", shts: "sheet",
  ltr: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  mm: "mm", cm: "cm", mtr: "m", meter: "m", metre: "m", meters: "m", metres: "m",
  pcs: "nos", pc: "nos", piece: "nos", pieces: "nos", no: "nos",
  bd: "board", brd: "board",
  lam: "laminate", laminated: "laminate",
  mdf: "mdf", blk: "block", blockboard: "block",
  adh: "adhesive", glue: "adhesive",
  ss: "steel", stainless: "steel",
  alu: "aluminium", aluminum: "aluminium", al: "aluminium",
  scr: "screw", screws: "screw",
  hng: "hinge", hinges: "hinge",
  hdl: "handle", handles: "handle",
  fab: "fabric", fabrics: "fabric",
  cur: "curtain", curtains: "curtain",
  trk: "track", tracks: "track",
  spanner: "spanner", spanners: "spanner"
};

// Step 1-3 of the handoff's matching rule: normalise, map abbreviations,
// then split into word and numeric tokens. `.` is kept because a thickness
// like "1.2" is one token, not two.
function inorm(desc) {
  const raw = String(desc == null ? "" : desc)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .filter(Boolean);

  const words = [];
  const nums = [];
  raw.forEach(tok => {
    // A bare "." or a token of only dots carries no meaning — drop it.
    const t = tok.replace(/^\.+|\.+$/g, "");
    if (!t) return;
    const mapped = Object.prototype.hasOwnProperty.call(ITEM_ABBREV, t) ? ITEM_ABBREV[t] : t;
    // Numeric = digits with an optional single decimal point. "18" and
    // "1.2" are figures; "18mm" is a word token (it carries its own unit).
    if (/^[0-9]+(\.[0-9]+)?$/.test(mapped)) nums.push(mapped);
    else words.push(mapped);
  });

  return { words: words, nums: nums, tokens: words.concat(nums) };
}

function setOf(arr) { const s = {}; arr.forEach(x => { s[x] = true; }); return s; }
function sameSet(a, b) {
  const A = setOf(a), B = setOf(b);
  const ka = Object.keys(A), kb = Object.keys(B);
  if (ka.length !== kb.length) return false;
  return ka.every(k => B[k]);
}
function diceOn(a, b) {
  const A = setOf(a), B = setOf(b);
  const ka = Object.keys(A), kb = Object.keys(B);
  if (!ka.length && !kb.length) return 0;
  const shared = ka.filter(k => B[k]).length;
  return (2 * shared) / (ka.length + kb.length);
}

// Steps 4-5: Dice over the token sets, then the handoff's three
// adjustments. Order matters — the "identical words, different figures"
// floor has to be applied after the base score, not instead of it.
function iScore(descA, descB) {
  const a = typeof descA === "string" ? inorm(descA) : descA;
  const b = typeof descB === "string" ? inorm(descB) : descB;

  let score = diceOn(a.tokens, b.tokens);

  const wordsSame = sameSet(a.words, b.words);
  const numsSame = sameSet(a.nums, b.nums);

  if (wordsSame && numsSame) return 1.0;
  // Same item, different size — a variant, not automatically a duplicate.
  // Floored, not set: a closer base score is allowed to stand.
  if (wordsSame && !numsSame) score = Math.max(score, 0.70);
  // Different words, identical figures — a nudge, not a verdict.
  else if (!wordsSame && numsSame && a.nums.length) score = score + 0.10;

  return Math.max(0, Math.min(1, score));
}

// How many BOMs actually use a code. Shown on every match row, because
// "used on 14 BOMs" is what tells the officer the existing code is the
// live one and theirs is the stray.
function itemBomUsageCount(itemId) {
  if (!itemId || typeof quotations === "undefined") return 0;
  let n = 0;
  quotations.forEach(q => {
    (q.items || []).forEach(it => {
      const mats = (it.bom && it.bom.materials) || [];
      if (mats.some(m => m.itemId === itemId)) n++;
    });
  });
  return n;
}

// Step 6: keep matches at or above the weak threshold, best first, top 3.
function iScored(desc, master) {
  const list = master || (typeof itemMaster !== "undefined" ? itemMaster : []);
  const target = inorm(desc);
  if (!target.tokens.length) return [];
  return list
    .map(it => ({
      item: it,
      id: it.id,
      name: it.name,
      unit: it.unit,
      score: iScore(target, inorm(it.name)),
      bomUses: itemBomUsageCount(it.id)
    }))
    .filter(m => m.score >= ITEM_DUP_WEAK)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// The gate itself. Returns everything the card needs to render AND the one
// answer that matters: may this be created right now?
//
// `override` / `difference` are the officer's declared "not a duplicate"
// plus the stated difference. They only ever unlock a NEAR match — an
// exact match has no override, by design.
function itemGateState(desc, opts) {
  const o = opts || {};
  const matches = iScored(desc, o.master);
  const top = matches.length ? matches[0].score : 0;

  let state = "clear";
  if (top >= ITEM_DUP_EXACT) state = "exact";
  else if (top >= ITEM_DUP_NEAR) state = "near";
  else if (top >= ITEM_DUP_WEAK) state = "weak";

  let canCreate = true;
  let blockedBy = null;
  let reason = "";

  if (state === "exact") {
    canCreate = false;
    blockedBy = matches[0].id;
    reason = "Blocked — " + matches[0].id + " is this item";
  } else if (state === "near") {
    // Both halves are required: declaring it and saying why.
    const declared = !!o.override && !!(o.difference && String(o.difference).trim());
    canCreate = declared;
    if (!canCreate) {
      blockedBy = matches[0].id;
      reason = "State a difference to create this code";
    }
  }

  return {
    state: state,
    matches: matches,
    topScore: top,
    canCreate: canCreate,
    blockedBy: blockedBy,
    reason: reason,
    // Copy is frozen by the handoff — these are its exact strings.
    title: state === "exact" ? "This item already exists"
      : state === "near" ? "Close to an existing code"
        : state === "weak" ? "One loose match"
          : "No match — safe to create"
  };
}

// The four differences the handoff allows. A free-text reason is not
// offered on purpose: the stated difference is shown to anyone who later
// searches either spelling, so it has to be one of a known set to be
// worth reading.
const ITEM_DIFF_REASONS = ["Different thickness", "Different cut", "Different grade", "Different size"];

// Editing the description resets the override and the stated difference —
// a reason given for one spelling must not carry to another. Callers hold
// the form state, so this is the rule they apply on every keystroke.
function itemGateResetOnEdit(prev, nextDesc) {
  if (!prev || prev.desc === nextDesc) return prev || { desc: nextDesc, override: false, difference: "" };
  return { desc: nextDesc, override: false, difference: "" };
}

// ── Server-side ────────────────────────────────────────────────────────
// Outstanding, and deliberately not faked: the handoff requires the same
// normalisation and threshold to run on save, server-side. That means a
// Postgres function plus a trigger on the item-master table, which needs a
// Management API token this session does not have. Until it exists, this
// gate is enforced in createItemMasterEntry() (below, real) and in the
// create form (a courtesy). Flagged rather than silently skipped.
const PURCHASE_ITEM_GATE_SERVER_SIDE = false;
