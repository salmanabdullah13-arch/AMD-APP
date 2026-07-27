// ═══════════════════════════════════════
// AL MARAYA — data.js
// Edit this file to update jobs, staff,
// BOM data, capacity & reminders.
// ═══════════════════════════════════════

// DEPARTMENTS & STAFF
const DEPTS=[{k:"carp",n:"Carpentry",c:"#0f9d58"},{k:"paint",n:"Painting",c:"#c47d00"},{k:"uph",n:"Upholstery",c:"#d6336c"},{k:"curt",n:"Curtain",c:"#7c3aed"},{k:"metal",n:"Metal Works",c:"#475569"}];
function dc(k){return DEPTS.find(d=>d.k===k)||{n:k,c:"#888"};}
const STAFF=["Arun Kumar","Karthik Silva","Silva","Salman Abdullah","Operations"];


// ═══════════════════════════════════════
// CURTAIN MODULE DATA
// ═══════════════════════════════════════

// CURTAIN JOBS — jobs that have a curtain scope
//
// SCHEMA NOTE (windowGroups / layers — migrated from the old flat windowGroup/
// groupRole pattern):
//   Each job.windowGroups[] entry is ONE PHYSICAL WINDOW OPENING. Shared physical
//   properties (room, width, height, qty) live once on the group.
//   Each group has a `layers[]` array — one layer per independent production item
//   at that opening (e.g. main curtain + sheer, or curtain + Roman blind). Every
//   layer keeps its own treatment, fabric, calc, rail/track spec, and — critically —
//   its own `overhang`, since mounting depth differs by treatment even at the same
//   opening (e.g. a curtain track needs overhang, a recess-mounted Roman blind
//   doesn't). A group with one layer = a single-layer window; `role: 'single'`.
//   `qty` = number of identical physical openings this group represents (e.g.
//   qty:2 = two matching windows, tracked and produced as one batch).
//   `quoteEstimateMetres` = reference-only fabric estimate from the original quote,
//   per layer — Silva's calc sheet produces the real (actual) figure; the two are
//   compared to flag material overage, never to override her calc.
//
//   IMPORTANT — this is an AUTHORING format only. Every dashboard (Tracks, QC, BOM,
//   Windows page, Purchase Inquiries) still reads a FLAT `job.windows[]` array in
//   the old shape, produced by `flattenWindowGroups(job)` below. Layer ids are
//   preserved exactly as the old flat window ids were, so purchaseInquiries[].
//   windowIds[] and every other id reference elsewhere continue to work unchanged.
//   Migrating individual dashboards to read windowGroups/layers natively (and
//   retiring the flatten step) is next-session scope.
const curtainJobs = [
  // ═══════════════════════════════════════
  // AMD-15002 — Villa 5 Fit-out (Discovery Development)
  // Migrated to current schema — was on the old flat calc engine
  // ═══════════════════════════════════════
  {
    id: "AMD-15002",
    name: "Villa 5 Fit-out",
    client: "Discovery Development",
    val: 8450,
    deptVal: 2800, // curtain dept value within project — Operations use only, not shown in Curtain module UI
    status: "execution", // stages: bom_pending | bom_submitted | budget_pending | budget_approved | execution | complete
    bomStatus: "approved", // bom_pending | submitted | approved
    budgetStatus: "approved", // pending | approved | rejected
    bomRejectionComment: null, // string set by Operations on reject; cleared on (re)submit — single current comment, not a log
    wastageBuffer: 10, // % — adjustable per job
    windowGroups: [
      // ── Master Bedroom ──
      { id:"wg-15002-1", room:"Master Bedroom", width:280, height:260, qty:1, // 2 layers
        layers: [
          { id:"w001", role:"main", label:"Window 1", overhang:20,
            treatment:"curtain", fabricType:"main", fabricCode:"Kravet Boucle", designType:"Wave",
            fullness:2.5, rollWidth:140, patternRepeatV:32, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Aluminium U-Shape Head Rail — Ningbo CH016", railItemCode:"IT001886", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:19, calcDone:true, calc:null },
          { id:"w002", role:"sheer", label:"Window 2 — Sheer", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"Gulf Sheer Voile", designType:"Wave",
            fullness:2.5, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Aluminium U-Shape Head Rail — Ningbo CH016", railItemCode:"IT001886", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:9.6, calcDone:true, calc:null }
        ] },
      // ── Living Room ──
      { id:"w003", room:"Living Room", width:420, height:280, qty:1, // single-layer
        layers: [
          { id:"w003", role:"single", label:"Sliding Door — Motorized", overhang:30,
            treatment:"motorized", fabricType:"blackout", fabricCode:"Gulf Blackout 320", designType:"Triple pleat",
            fullness:2, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy RS100", remoteType:"Single-channel Somfy Remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:23.5, calcDone:true, calc:null }
        ] },
      // ── Study ──
      { id:"w004", room:"Study", width:120, height:180, qty:1, // single-layer
        layers: [
          { id:"w004", role:"single", label:"Roller Blind — Study", overhang:0,
            treatment:"roller", fabricType:"blackout", fabricCode:"Gulf Blackout 320", designType:null,
            fullness:1, rollWidth:200, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Roller Blind Bracket", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            cordType:"Ball chain", cordLength:180, cordSide:"right",
            quoteEstimateMetres:2.3, calcDone:true, calc:null }
        ] }
    ],
    bom: {
      fabric: [
        {type:"Main Fabric",   supplier:"Premium Fabric House", unitCost:18.5, budgeted:600, actual:650},
        {type:"Sheer Fabric",  supplier:"Gulf Textiles",        unitCost:8.0,  budgeted:180, actual:180},
        {type:"Blackout",      supplier:"Gulf Textiles",        unitCost:12.0, budgeted:220, actual:0}
      ],
      tracks: [
        {type:"Manual Track",    qty:3, unitCost:35, budgeted:105, actual:105},
        {type:"Motorized Track", qty:1, unitCost:320, budgeted:320, actual:320}
      ],
      motors: [
        {brand:"Somfy", model:"RS100", qty:1, unitCost:285, budgeted:285, actual:285}
      ],
      accessories: [
        {item:"Brackets",    qty:24, unitCost:1.2, budgeted:29,  actual:29},
        {item:"Gliders",     qty:200,unitCost:0.15,budgeted:30,  actual:30},
        {item:"Lead Weights",qty:12, unitCost:0.8, budgeted:10,  actual:10},
        {item:"Tie Backs",   qty:4,  unitCost:8.5, budgeted:34,  actual:0}
      ],
      labour: [
        {task:"Measuring",          hrs:3,  rate:8, budgeted:24,  actual:24},
        {task:"Track Assembly",     hrs:6,  rate:8, budgeted:48,  actual:48},
        {task:"Cutting & Sewing",   hrs:18, rate:8, budgeted:144, actual:160},
        {task:"Blind Fabrication",  hrs:0,  rate:8, budgeted:0,   actual:0},
        {task:"Installation",       hrs:8,  rate:8, budgeted:64,  actual:0}
      ],
      subcon: []
    },
    alerts: [],
    procurement: [
      {item:"Kravet Boucle fabric", supplier:"Premium Fabric House", ordered:"3 Jun", expected:"10 Jun", status:"pending", paid:false, cost:650},
      {item:"Somfy RS100 motor",    supplier:"Somfy BH",             ordered:"3 Jun", expected:"8 Jun",  status:"received",paid:true,  cost:285}
    ],
    installation: {
      scheduledDate: null,
      team: null,
      siteContact: null,
      status: "pending", // pending | scheduled | complete
      handoverSigned: false
    }
  },

  // ═══════════════════════════════════════
  // AMD-13374 — Poliform (id derived from Qtn No AMD-13374-1)
  // Q-Pro Job Card JB26AMD01863 · Jan 2026 · Salesman Salman Abdullah
  // Reference job — villa fit-out, ground + first floor
  // ═══════════════════════════════════════
  {
    id: "AMD-13374",
    name: "Poliform Villa — Drapery",
    client: "Poliform",
    qproJobCardNo: "JB26AMD01863",
    qproQuoteNo: "AMD-13374-1",
    val: null, // Operations-only value, not modeled for this reference job
    deptVal: null,
    status: "execution",
    bomStatus: "approved",
    budgetStatus: "approved",
    bomRejectionComment: null,
    wastageBuffer: 10,
    windowGroups: [
      // ── Living Room ──
      { id:"pf-lr1", room:"Living Room", width:292, height:330, qty:2, // single-layer
        layers: [
          { id:"pf-lr1", role:"single", label:"Sheer A", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.9, calcDone:true, calc:null }
        ] },
      { id:"pf-lr2", room:"Living Room", width:280, height:330, qty:2, // single-layer
        layers: [
          { id:"pf-lr2", role:"single", label:"Sheer B", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.9, calcDone:true, calc:null }
        ] },
      { id:"pf-lr3", room:"Living Room", width:290, height:330, qty:4, // single-layer
        layers: [
          { id:"pf-lr3", role:"single", label:"Sheer C", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.9, calcDone:true, calc:null }
        ] },
      // ── Dining Room ──
      { id:"pf-dr1", room:"Dining Room", width:307, height:330, qty:2, // single-layer
        layers: [
          { id:"pf-dr1", role:"single", label:"Sheer A", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.9, calcDone:true, calc:null }
        ] },
      { id:"pf-dr2", room:"Dining Room", width:310, height:330, qty:1, // single-layer
        layers: [
          { id:"pf-dr2", role:"single", label:"Sheer B", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.9, calcDone:true, calc:null }
        ] },
      { id:"pf-dr3", room:"Dining Room", width:300, height:330, qty:1, // single-layer
        layers: [
          { id:"pf-dr3", role:"single", label:"Sheer C", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.9, calcDone:true, calc:null }
        ] },
      { id:"pf-dr4", room:"Dining Room", width:255, height:330, qty:2, // single-layer
        layers: [
          { id:"pf-dr4", role:"single", label:"Sheer D", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:8, calcDone:true, calc:null }
        ] },
      // ── Gym Area ──
      { id:"pf-gy1", room:"Gym Area", width:260, height:330, qty:3, // single-layer
        layers: [
          { id:"pf-gy1", role:"single", label:"Sheer A", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:8, calcDone:true, calc:null }
        ] },
      { id:"pf-gy2", room:"Gym Area", width:255, height:330, qty:1, // single-layer
        layers: [
          { id:"pf-gy2", role:"single", label:"Sheer B", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:8, calcDone:true, calc:null }
        ] },
      { id:"pf-gy3", room:"Gym Area", width:370, height:330, qty:1, // single-layer
        layers: [
          { id:"pf-gy3", role:"single", label:"Sheer C", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.9, calcDone:true, calc:null }
        ] },
      { id:"pf-gy4", room:"Gym Area", width:600, height:330, qty:1, // single-layer
        layers: [
          { id:"pf-gy4", role:"single", label:"Sheer D", overhang:15,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:19.6, calcDone:true, calc:null }
        ] },
      // ── Bedroom - 1 ──
      { id:"wg-poliform-br1", room:"Bedroom - 1", width:565, height:354, qty:1, // 2 layers
        layers: [
          { id:"pf-br1-main", role:"main", label:"Blackout", overhang:20,
            treatment:"curtain", fabricType:"blackout", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:41.5, calcDone:true, calc:null },
          { id:"pf-br1-sheer", role:"sheer", label:"Sheer", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:20.9, calcDone:true, calc:null }
        ] },
      // ── Bedroom - 2 ──
      { id:"wg-poliform-br2", room:"Bedroom - 2", width:565, height:354, qty:1, // 2 layers
        layers: [
          { id:"pf-br2-main", role:"main", label:"Blackout", overhang:20,
            treatment:"curtain", fabricType:"blackout", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:41.5, calcDone:true, calc:null },
          { id:"pf-br2-sheer", role:"sheer", label:"Sheer", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:20.9, calcDone:true, calc:null }
        ] },
      // ── Bedroom - 3 ──
      { id:"wg-poliform-br3", room:"Bedroom - 3", width:565, height:354, qty:1, // 2 layers
        layers: [
          { id:"pf-br3-main", role:"main", label:"Blackout", overhang:20,
            treatment:"curtain", fabricType:"blackout", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:41.5, calcDone:true, calc:null },
          { id:"pf-br3-sheer", role:"sheer", label:"Sheer", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:20.9, calcDone:true, calc:null }
        ] },
      // ── Bedroom - 4 ──
      { id:"wg-poliform-br4", room:"Bedroom - 4", width:565, height:354, qty:1, // 2 layers
        layers: [
          { id:"pf-br4-main", role:"main", label:"Blackout", overhang:20,
            treatment:"curtain", fabricType:"blackout", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:41.5, calcDone:true, calc:null },
          { id:"pf-br4-sheer", role:"sheer", label:"Sheer", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Cord Rail — Heavy Duty White (COR001)", railItemCode:"IT002395", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:20.9, calcDone:true, calc:null }
        ] },
      // ── First Floor - Master Living ──
      { id:"wg-poliform-ffml", room:"First Floor - Master Living", width:588, height:354, qty:1, // 2 layers
        layers: [
          { id:"pf-ffml-main", role:"main", label:"Blackout — Motorized", overhang:20,
            treatment:"motorized", fabricType:"blackout", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy Glydea 60 RTS", remoteType:"Multi-channel Somfy Remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:31, calcDone:true, calc:null },
          { id:"pf-ffml-sheer", role:"sheer", label:"Sheer — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy Glydea 35 WT", remoteType:"Multi-channel Somfy Remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:20.9, calcDone:true, calc:null }
        ] },
      // ── First Floor - Master Bedroom ──
      { id:"wg-poliform-ffmb", room:"First Floor - Master Bedroom", width:565, height:354, qty:1, // 2 layers
        layers: [
          { id:"pf-ffmb-main", role:"main", label:"Blackout — Motorized", overhang:20,
            treatment:"motorized", fabricType:"blackout", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy Glydea 60 RTS", remoteType:"Multi-channel Somfy Remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:41.5, calcDone:true, calc:null },
          { id:"pf-ffmb-sheer", role:"sheer", label:"Sheer — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"TBS", designType:"Triple pleat",
            fullness:2.3, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy Glydea 35 WT", remoteType:"Multi-channel Somfy Remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:20.9, calcDone:true, calc:null }
        ] }
    ],
    bom: {
      fabric: [], tracks: [], motors: [], accessories: [], labour: [], subcon: []
    },
    alerts: [],
    procurement: [],
    installation: { scheduledDate: null, team: null, siteContact: null, status: "pending", handoverSigned: false }
  },

  // ═══════════════════════════════════════
  // AMD-13898 — Abdulla Bokhowa (id derived from Qtn No AMD-13898-1)
  // Q-Pro Job Card JB25AMD01739 · Nov 2025 · Salesman Salman Abdullah
  // Reference job — large villa, ground + first floor + basement + toilets
  // Mixed treatments: motorized curtains, manual curtains, Roman blinds,
  // wooden venetian blinds, roller blinds. Fabric metreage in the quote is
  // the ESTIMATE only — Silva's calc sheet remains the real figure.
  // ═══════════════════════════════════════
  {
    id: "AMD-13898",
    name: "Bokhowa Villa — Drapery",
    client: "Abdulla Bokhowa",
    qproJobCardNo: "JB25AMD01739",
    qproQuoteNo: "AMD-13898-1",
    val: null,
    deptVal: null,
    status: "execution",
    bomStatus: "approved",
    budgetStatus: "approved",
    bomRejectionComment: null,
    wastageBuffer: 10,
    windowGroups: [
      // ── External Majlis ──
      { id:"wg-bokhowa-w1", room:"External Majlis", width:540, height:350, qty:1, // 2 layers
        layers: [
          { id:"bk-w1-curtain", role:"curtain", label:"W1 — Curtain", overhang:20,
            treatment:"curtain", fabricType:"main", fabricCode:"YRK 408/02", designType:null,
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:37, calcDone:true, calc:null },
          { id:"bk-w1-roman", role:"roman_blind", label:"W1 — Roman Blind (2 pcs)", overhang:0,
            treatment:"roman", fabricType:"main", fabricCode:"Rhyme 02 — Pearl", designType:"2 pieces",
            fullness:1, rollWidth:280, patternRepeatV:0, patternRepeatH:0, topHem:5, bottomHem:5, sideHem:3,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Roman Blind Headrail — Unisoiel RAE01", railItemCode:"IT362", openingDirection:"fixed", bracketType:"Recess bracket",
            quoteEstimateMetres:8.3, calcDone:true, calc:null }
        ] },
      { id:"wg-bokhowa-w2", room:"External Majlis", width:420, height:350, qty:1, // 2 layers
        layers: [
          { id:"bk-w2-curtain", role:"curtain", label:"W2 — Curtain", overhang:20,
            treatment:"curtain", fabricType:"main", fabricCode:"YRK 408/02", designType:null,
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:28.8, calcDone:true, calc:null },
          { id:"bk-w2-roman", role:"roman_blind", label:"W2 — Roman Blind (2 pcs)", overhang:0,
            treatment:"roman", fabricType:"main", fabricCode:"Rhyme 02 — Pearl", designType:"2 pieces",
            fullness:1, rollWidth:280, patternRepeatV:0, patternRepeatH:0, topHem:5, bottomHem:5, sideHem:3,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Roman Blind Headrail — Unisoiel RAE01", railItemCode:"IT362", openingDirection:"fixed", bracketType:"Recess bracket",
            quoteEstimateMetres:8.3, calcDone:true, calc:null }
        ] },
      // ── GF Foyer ──
      { id:"bk-w3", room:"GF Foyer", width:540, height:350, qty:1, // single-layer
        layers: [
          { id:"bk-w3", role:"single", label:"W3 — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"DF324/46", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:16.6, calcDone:true, calc:null }
        ] },
      // ── GF Formal Living ──
      { id:"bk-w4w5", room:"GF Formal Living", width:160, height:350, qty:2, // single-layer
        layers: [
          { id:"bk-w4w5", role:"single", label:"W4 & W5 — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"DF324/46", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:8.5, calcDone:true, calc:null }
        ] },
      { id:"bk-w6", room:"GF Formal Living", width:500, height:350, qty:1, // single-layer
        layers: [
          { id:"bk-w6", role:"single", label:"W6 — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"DF324/46", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:16.6, calcDone:true, calc:null }
        ] },
      { id:"bk-w7", room:"GF Formal Living", width:550, height:350, qty:1, // single-layer
        layers: [
          { id:"bk-w7", role:"single", label:"W7 — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"DF324/46", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:20.7, calcDone:true, calc:null }
        ] },
      { id:"bk-w8", room:"GF Formal Living", width:350, height:350, qty:1, // single-layer
        layers: [
          { id:"bk-w8", role:"single", label:"W8 — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"DF324/46", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:12.6, calcDone:true, calc:null }
        ] },
      // ── GF Dining Area ──
      { id:"bk-w9", room:"GF Dining Area", width:550, height:350, qty:1, // single-layer
        layers: [
          { id:"bk-w9", role:"single", label:"W9 — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"DF324/46", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:20.7, calcDone:true, calc:null }
        ] },
      // ── GF Kitchen Area ──
      { id:"bk-w10", room:"GF Kitchen Area", width:697, height:350, qty:1, // single-layer
        layers: [
          { id:"bk-w10", role:"single", label:"W10 — Motorized", overhang:20,
            treatment:"motorized", fabricType:"sheer", fabricCode:"DF324/46", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:24.8, calcDone:true, calc:null }
        ] },
      // ── Master Bedroom ──
      { id:"wg-bokhowa-w11", room:"Master Bedroom", width:700, height:320, qty:1, // 2 layers
        layers: [
          { id:"bk-w11-main", role:"main", label:"W11 — Main (Motorized)", overhang:20,
            treatment:"motorized", fabricType:"main", fabricCode:"YRK 408-41", designType:"Pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 60 RTS with DCT", remoteType:"Multichannel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:45.2, calcDone:true, calc:null },
          { id:"bk-w11-sheer", role:"sheer", label:"W11 — Sheer (Manual)", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"DF324/02", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:22.8, calcDone:true, calc:null }
        ] },
      { id:"wg-bokhowa-w12", room:"Master Bedroom", width:125, height:320, qty:1, // 2 layers
        layers: [
          { id:"bk-w12-main", role:"main", label:"W12 — Main (Manual)", overhang:20,
            treatment:"curtain", fabricType:"main", fabricCode:"YRK 408-41", designType:"Wave",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:11.6, calcDone:true, calc:null },
          { id:"bk-w12-sheer", role:"sheer", label:"W12 — Sheer (Manual)", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"DF324/02", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:4.1, calcDone:true, calc:null }
        ] },
      // ── Girls Bedroom ──
      { id:"wg-bokhowa-w13", room:"Girls Bedroom", width:485, height:320, qty:1, // 2 layers
        layers: [
          { id:"bk-w13-main", role:"main", label:"W13 — Main (Motorized)", overhang:20,
            treatment:"motorized", fabricType:"main", fabricCode:"YRK 408-29", designType:"Wave",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"1-channel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:34, calcDone:true, calc:null },
          { id:"bk-w13-sheer", role:"sheer", label:"W13 — Sheer (Manual)", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"DF324/02", designType:"Wave",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:15.3, calcDone:true, calc:null }
        ] },
      { id:"bk-w14", room:"Girls Bedroom", width:150, height:320, qty:1, // single-layer
        layers: [
          { id:"bk-w14", role:"single", label:"W14 — Wooden Venetian Blind", overhang:0,
            treatment:"wooden", fabricType:null, fabricCode:null, designType:"50mm slats, manual",
            fullness:1, rollWidth:0, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Wooden Pole", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            quoteEstimateMetres:null, calcDone:true, calc:null }
        ] },
      // ── Bader's Bedroom ──
      { id:"wg-bokhowa-w15w16", room:"Bader's Bedroom", width:160, height:320, qty:2, // 2 layers
        layers: [
          { id:"bk-w15w16-main", role:"main", label:"W15 & W16 — Main (Motorized)", overhang:20,
            treatment:"motorized", fabricType:"main", fabricCode:"YRK 408-29", designType:"Pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"5-channel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:11.6, calcDone:true, calc:null },
          { id:"bk-w15w16-sheer", role:"sheer", label:"W15 & W16 — Sheer (Manual)", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"DF324/02", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:7.8, calcDone:true, calc:null }
        ] },
      // ── Faisal's Room ──
      { id:"wg-bokhowa-w17", room:"Faisal's Room", width:500, height:330, qty:1, // 2 layers
        layers: [
          { id:"bk-w17-main", role:"main", label:"W17 — Main (Motorized)", overhang:20,
            treatment:"motorized", fabricType:"main", fabricCode:"YRK 408/39", designType:"Pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 35 RTS with DCT", remoteType:"5-channel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:35, calcDone:true, calc:null },
          { id:"bk-w17-sheer", role:"sheer", label:"W17 — Sheer (Manual)", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"DF324/02", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:15.7, calcDone:true, calc:null }
        ] },
      { id:"wg-bokhowa-w18", room:"Faisal's Room", width:680, height:330, qty:1, // 2 layers
        layers: [
          { id:"bk-w18-main", role:"main", label:"W18 — Main (Motorized)", overhang:20,
            treatment:"motorized", fabricType:"main", fabricCode:"YRK 408/39", designType:"Pleat",
            fullness:2.3, rollWidth:140, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:true, motorBrand:"somfy", motorModel:"Somfy 60 RTS with DCT", remoteType:"5-channel remote",
            railType:"Somfy Glydea Track — raw rail", railItemCode:"IT450", openingDirection:"two_way", bracketType:"Motorised ceiling bracket",
            quoteEstimateMetres:38, calcDone:true, calc:null },
          { id:"bk-w18-sheer", role:"sheer", label:"W18 — Sheer (Manual)", overhang:20,
            treatment:"curtain", fabricType:"sheer", fabricCode:"DF324/02", designType:"Pleat",
            fullness:2.2, rollWidth:300, patternRepeatV:0, patternRepeatH:0, topHem:8, bottomHem:12, sideHem:5,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Unisoiel Cord Track — DC01 Heavy", railItemCode:"IT330", openingDirection:"two_way", bracketType:"Ceiling bracket",
            quoteEstimateMetres:23.5, calcDone:true, calc:null }
        ] },
      // ── Basement ──
      { id:"bk-w19", room:"Basement", width:280, height:270, qty:1, // single-layer
        layers: [
          { id:"bk-w19", role:"single", label:"W19 — Wooden Venetian Blind (2 pcs)", overhang:0,
            treatment:"wooden", fabricType:null, fabricCode:null, designType:"50mm slats, manual, 2 pieces",
            fullness:1, rollWidth:0, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Wooden Pole", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            quoteEstimateMetres:null, calcDone:true, calc:null }
        ] },
      { id:"bk-basement2", room:"Basement", width:175, height:185, qty:1, // single-layer
        layers: [
          { id:"bk-basement2", role:"single", label:"Wooden Venetian Blind", overhang:0,
            treatment:"wooden", fabricType:null, fabricCode:null, designType:"50mm slats, manual",
            fullness:1, rollWidth:0, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Wooden Pole", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            quoteEstimateMetres:null, calcDone:true, calc:null }
        ] },
      // ── Master Bathroom ──
      { id:"bk-w21", room:"Master Bathroom", width:250, height:290, qty:1, // single-layer
        layers: [
          { id:"bk-w21", role:"single", label:"W21 — Wooden Venetian Blind", overhang:0,
            treatment:"wooden", fabricType:null, fabricCode:null, designType:"50mm slats, manual",
            fullness:1, rollWidth:0, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Wooden Pole", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            quoteEstimateMetres:null, calcDone:true, calc:null }
        ] },
      // ── Basement — Driver Room ──
      { id:"bk-driverroom", room:"Basement — Driver Room", width:175, height:265, qty:1, // single-layer
        layers: [
          { id:"bk-driverroom", role:"single", label:"Wooden Venetian Blind", overhang:0,
            treatment:"wooden", fabricType:null, fabricCode:null, designType:"50mm slats, manual",
            fullness:1, rollWidth:0, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Wooden Pole", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            quoteEstimateMetres:null, calcDone:true, calc:null }
        ] },
      // ── Laundry ──
      { id:"bk-laundry", room:"Laundry", width:150, height:130, qty:1, // single-layer
        layers: [
          { id:"bk-laundry", role:"single", label:"Manual Roller Blind", overhang:0,
            treatment:"roller", fabricType:"main", fabricCode:"TBS", designType:null,
            fullness:1, rollWidth:200, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Roller Blind Bracket", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            cordType:"Ball chain", cordLength:120, cordSide:"right",
            quoteEstimateMetres:null, calcDone:true, calc:null }
        ] },
      // ── GF Kitchen + Dirty Kitchen ──
      { id:"bk-kitchen-roller", room:"GF Kitchen + Dirty Kitchen", width:154, height:150, qty:2, // single-layer
        layers: [
          { id:"bk-kitchen-roller", role:"single", label:"Manual Roller Blind", overhang:0,
            treatment:"roller", fabricType:"main", fabricCode:"TBS", designType:null,
            fullness:1, rollWidth:200, patternRepeatV:0, patternRepeatH:0, topHem:0, bottomHem:0, sideHem:0,
            motorized:false, motorBrand:null, motorModel:null, remoteType:null,
            railType:"Roller Blind Bracket", railItemCode:null, openingDirection:"fixed", bracketType:"Recess bracket",
            cordType:"Ball chain", cordLength:140, cordSide:"right",
            quoteEstimateMetres:null, calcDone:true, calc:null }
        ] }
    ],
    bom: {
      fabric: [], tracks: [], motors: [], accessories: [
        {item:"5 Channel Remote — Dining & Kitchen",              qty:1},
        {item:"16 Channel Remote — Foyer & Formal Living",        qty:1},
        {item:"5 Channel Remote — Master Bedroom",                qty:1},
        {item:"1 Channel Remote — Girl's Bedroom",                qty:1},
        {item:"5 Channel Remote — Bader's Room",                  qty:1},
        {item:"5 Channel Remote — Faisal's Room",                 qty:1},
        {item:"Dry Contact Receiver — 5014328",                   qty:14}
      ], labour: [], subcon: []
    },
    alerts: [],
    procurement: [],
    installation: { scheduledDate: null, team: null, siteContact: null, status: "pending", handoverSigned: false }
  }
];

// ═══════════════════════════════════════
// FLATTEN windowGroups → job.windows
// Translator so every existing dashboard (Tracks, QC, BOM, Windows page,
// Purchase Inquiries) keeps reading the old flat window shape unchanged.
// Layer ids are preserved exactly as the old flat window ids were.
// Migrating each dashboard to read windowGroups/layers directly (and
// retiring this step) is next-session scope — see SCHEMA NOTE above.
// ═══════════════════════════════════════
function flattenWindowGroups(job) {
  const windows = [];
  job.windowGroups.forEach(g => {
    const isMulti = g.layers.length > 1;
    g.layers.forEach(layer => {
      const w = {
        id: layer.id,
        windowGroup: isMulti ? g.id : null,
        groupRole: isMulti ? layer.role : null,
        room: g.room,
        label: layer.label,
        width: g.width, height: g.height, overhang: layer.overhang, qty: g.qty,
        treatment: layer.treatment,
        fabricType: layer.fabricType, fabricCode: layer.fabricCode, designType: layer.designType,
        fullness: layer.fullness, rollWidth: layer.rollWidth,
        patternRepeatV: layer.patternRepeatV, patternRepeatH: layer.patternRepeatH,
        topHem: layer.topHem, bottomHem: layer.bottomHem, sideHem: layer.sideHem,
        motorized: layer.motorized, motorBrand: layer.motorBrand, motorModel: layer.motorModel, remoteType: layer.remoteType,
        railType: layer.railType, railItemCode: layer.railItemCode !== undefined ? layer.railItemCode : null,
        openingDirection: layer.openingDirection, bracketType: layer.bracketType,
        quoteEstimateMetres: layer.quoteEstimateMetres,
        calcDone: layer.calcDone, calc: layer.calc,
      };
      if ('cordType' in layer)   w.cordType   = layer.cordType;
      if ('cordLength' in layer) w.cordLength = layer.cordLength;
      if ('cordSide' in layer)   w.cordSide   = layer.cordSide;
      windows.push(w);
    });
  });
  return windows;
}

// Hydrate job.windows immediately — before any other code (including
// curtain.js, which loads after this file) reads it.
curtainJobs.forEach(job => { job.windows = flattenWindowGroups(job); });

// ═══════════════════════════════════════
// PURCHASE INQUIRIES — global entity, NOT nested under curtainJobs
// Named "Purchase Inquiry" (not "Inquiry") to avoid colliding with a future
// client-facing Sales Inquiry once Phase 4 (Sales/Estimation) gets built.
// This is where material moves from any division (curtain today; upholstery,
// joinery later) through to the workshop — one inquiry commonly covers
// several windows/items at once, so ETA is set here and read per-window.
//
// VENDOR path (imported):
//   inquiry_raised -> po_raised -> po_approved -> sent_to_supplier
//   -> logistics_arranged -> arrived_bahrain -> received_by_curtain
// STOCK path (from Al Maraya's own limited inventory, code "AMD"):
//   reserved -> received_by_curtain
//
// "arrived_bahrain" vs "received_by_curtain" are deliberately separate
// stages — the fabric can be in the country for days before someone
// physically hands it to the department. Making that its own visible
// stage is the actual fix for the old "no one knows until it's handed
// over" problem.
// ═══════════════════════════════════════
const VENDORS = [
  { name: "Al Guthmi",  region: "Saudi Arabia / Dubai" },
  { name: "Janoub",     region: "Saudi Arabia" },
  { name: "Nassaj",     region: "Saudi Arabia" },
  { name: "York",       region: "Dubai" },
  { name: "D3",         region: "Bahrain / Dubai / KSA" },
  { name: "Silk Weave", region: "Dubai" },
  { name: "Al Kilani",  region: "Bahrain / Dubai / KSA" },
  { name: "Kalima",     region: "Bahrain / Dubai" },
  { name: "AMD",        region: "Own inventory — stock fabric" },
];

const PI_STAGE_LABELS = {
  inquiry_raised:      "Inquiry raised",
  po_raised:           "PO raised",
  po_approved:         "PO approved",
  sent_to_supplier:    "Sent to supplier",
  logistics_arranged:  "Logistics arranged",
  arrived_bahrain:     "Arrived in Bahrain",
  received_by_curtain: "Received by Curtain",
  reserved:            "Reserved from stock",
};
const PI_VENDOR_STAGES = ["inquiry_raised","po_raised","po_approved","sent_to_supplier","logistics_arranged","arrived_bahrain","received_by_curtain"];
const PI_STOCK_STAGES  = ["reserved","received_by_curtain"];

const purchaseInquiries = [
  // ── Villa 5 Fit-out (AMD-15002) ──
  {
    id: "PI-0001", division: "curtain", jobId: "AMD-15002", windowIds: ["w002"],
    vendor: "Gulf Textiles", vendorRegion: "Bahrain / Dubai", source: "vendor",
    fabricCode: "Gulf Sheer Voile", quantityOrdered: 10,
    stage: "received_by_curtain", eta: "2026-06-08",
    stageDates: { inquiry_raised:"2026-05-28", po_raised:"2026-05-29", po_approved:"2026-05-29", sent_to_supplier:"2026-05-30", logistics_arranged:"2026-06-02", arrived_bahrain:"2026-06-07", received_by_curtain:"2026-06-08" },
    notes: ""
  },
  {
    id: "PI-0002", division: "curtain", jobId: "AMD-15002", windowIds: ["w001"],
    vendor: "Al Kilani", vendorRegion: "Bahrain / Dubai / KSA", source: "vendor",
    fabricCode: "Kravet Boucle", quantityOrdered: 21,
    stage: "arrived_bahrain", eta: "2026-07-01",
    stageDates: { inquiry_raised:"2026-06-15", po_raised:"2026-06-16", po_approved:"2026-06-17", sent_to_supplier:"2026-06-18", logistics_arranged:"2026-06-25", arrived_bahrain:"2026-07-01" },
    notes: "Arrived — awaiting physical handover to Curtain department"
  },
  {
    id: "PI-0003", division: "curtain", jobId: "AMD-15002", windowIds: ["w003","w004"],
    vendor: "D3", vendorRegion: "Bahrain / Dubai / KSA", source: "vendor",
    fabricCode: "Gulf Blackout 320", quantityOrdered: 26,
    stage: "po_approved", eta: "2026-07-12",
    stageDates: { inquiry_raised:"2026-06-28", po_raised:"2026-06-30", po_approved:"2026-07-02" },
    notes: "Covers both the sliding door and the study roller blind — same fabric code, ordered together"
  },

  // ── Bokhowa Villa (AMD-13898) ──
  {
    id: "PI-0004", division: "curtain", jobId: "AMD-13898", windowIds: ["bk-w1-curtain","bk-w2-curtain"],
    vendor: "Janoub", vendorRegion: "Saudi Arabia", source: "vendor",
    fabricCode: "YRK 408/02", quantityOrdered: 55,
    stage: "sent_to_supplier", eta: "2026-07-15",
    stageDates: { inquiry_raised:"2026-06-20", po_raised:"2026-06-22", po_approved:"2026-06-23", sent_to_supplier:"2026-06-25" },
    notes: ""
  },
  {
    id: "PI-0005", division: "curtain", jobId: "AMD-13898", windowIds: ["bk-w1-roman","bk-w2-roman"],
    vendor: "Nassaj", vendorRegion: "Saudi Arabia", source: "vendor",
    fabricCode: "Rhyme 02 — Pearl", quantityOrdered: 16,
    stage: "logistics_arranged", eta: "2026-07-08",
    stageDates: { inquiry_raised:"2026-06-18", po_raised:"2026-06-19", po_approved:"2026-06-20", sent_to_supplier:"2026-06-21", logistics_arranged:"2026-06-29" },
    notes: ""
  },
  {
    id: "PI-0006", division: "curtain", jobId: "AMD-13898", windowIds: ["bk-w3","bk-w4w5","bk-w6","bk-w7","bk-w8","bk-w9","bk-w10"],
    vendor: "York", vendorRegion: "Dubai", source: "vendor",
    fabricCode: "DF324/46", quantityOrdered: 108,
    stage: "arrived_bahrain", eta: "2026-06-30",
    stageDates: { inquiry_raised:"2026-06-10", po_raised:"2026-06-11", po_approved:"2026-06-12", sent_to_supplier:"2026-06-13", logistics_arranged:"2026-06-22", arrived_bahrain:"2026-06-30" },
    notes: "One PO covering 7 windows in Foyer, Formal Living, Dining & Kitchen — arrived, awaiting handover"
  },
  {
    id: "PI-0007", division: "curtain", jobId: "AMD-13898", windowIds: ["bk-w11-main","bk-w12-main"],
    vendor: "Al Guthmi", vendorRegion: "Saudi Arabia / Dubai", source: "vendor",
    fabricCode: "YRK 408-41", quantityOrdered: 46,
    stage: "po_raised", eta: "2026-07-18",
    stageDates: { inquiry_raised:"2026-06-26", po_raised:"2026-06-28" },
    notes: ""
  },
  {
    id: "PI-0008", division: "curtain", jobId: "AMD-13898",
    windowIds: ["bk-w11-sheer","bk-w12-sheer","bk-w13-sheer","bk-w15w16-sheer","bk-w17-sheer","bk-w18-sheer"],
    vendor: "Silk Weave", vendorRegion: "Dubai", source: "vendor",
    fabricCode: "DF324/02", quantityOrdered: 78,
    stage: "inquiry_raised", eta: null,
    stageDates: { inquiry_raised:"2026-07-01" },
    notes: "ETA not set yet — waiting on PO before a delivery estimate is possible"
  },
  {
    id: "PI-0009", division: "curtain", jobId: "AMD-13898", windowIds: ["bk-w13-main","bk-w15w16-main"],
    vendor: "Al Kilani", vendorRegion: "Bahrain / Dubai / KSA", source: "vendor",
    fabricCode: "YRK 408-29", quantityOrdered: 49,
    stage: "po_approved", eta: "2026-07-14",
    stageDates: { inquiry_raised:"2026-06-24", po_raised:"2026-06-25", po_approved:"2026-06-27" },
    notes: ""
  },
  {
    id: "PI-0010", division: "curtain", jobId: "AMD-13898", windowIds: ["bk-w17-main","bk-w18-main"],
    vendor: "Kalima", vendorRegion: "Bahrain / Dubai", source: "vendor",
    fabricCode: "YRK 408/39", quantityOrdered: 70,
    stage: "received_by_curtain", eta: "2026-06-20",
    stageDates: { inquiry_raised:"2026-06-01", po_raised:"2026-06-02", po_approved:"2026-06-03", sent_to_supplier:"2026-06-04", logistics_arranged:"2026-06-12", arrived_bahrain:"2026-06-18", received_by_curtain:"2026-06-20" },
    notes: ""
  },
  {
    id: "PI-0011", division: "curtain", jobId: "AMD-13898", windowIds: ["bk-w14"],
    vendor: "AMD", vendorRegion: "Own inventory — stock fabric", source: "stock",
    fabricCode: null, quantityOrdered: null,
    stage: "received_by_curtain", eta: null,
    stageDates: { reserved:"2026-06-05", received_by_curtain:"2026-06-05" },
    notes: "Standard 50mm wooden slats — held in stock, no lead time"
  },
];

function nextPIId() {
  return "PI-" + String(purchaseInquiries.length + 1).padStart(4, "0");
}
// Raises a new fabric/rail purchase inquiry from the Curtain module (Silva).
// Additive only — same shape as every existing purchaseInquiries[] entry.
// Does not touch the new purchaseRequests/purchaseOrders chain; Curtain's
// tracker stays its own system per the earlier architecture decision.
function raiseInquiry({ jobId, windowIds, vendor, vendorRegion, source, fabricCode = null, quantityOrdered = null, notes = "" }) {
  const pi = {
    id: nextPIId(),
    division: "curtain",
    jobId,
    windowIds,
    vendor,
    vendorRegion,
    source,              // "vendor" | "stock"
    fabricCode,
    quantityOrdered,
    stage: "inquiry_raised",
    eta: null,
    stageDates: { inquiry_raised: todayStrGlobal() },
    notes
  };
  purchaseInquiries.push(pi);
  return pi;
}
// Local date helper — data.js has no existing todayStr(); curtain.js has its
// own todayStr() already, kept separate so this file has no cross-file
// dependency on load order.
function todayStrGlobal() {
  return new Date().toISOString().slice(0, 10);
}

function getInquiryForWindow(windowId) {
  return purchaseInquiries.find(pi => pi.windowIds.includes(windowId)) || null;
}
function getInquiriesForJob(jobId) {
  return purchaseInquiries.filter(pi => pi.jobId === jobId);
}
function piStages(inquiry) {
  return inquiry.source === "stock" ? PI_STOCK_STAGES : PI_VENDOR_STAGES;
}
function piIsDone(inquiry) {
  return inquiry.stage === "received_by_curtain";
}

// ═══════════════════════════════════════
// DAILY TIME LOG — global entity, NOT nested under curtainJobs.
// Same pattern as purchaseInquiries above: a flat, top-level list so it
// doesn't collide with anything job-shaped.
//
// One row = one (worker, date, job, window, role) entry with hours. A
// worker can have multiple rows on the same date to split a day across
// jobs — there's no single "day record" object, just flat rows filtered
// by worker+date.
//
// This is a SEPARATE ledger from job.bom.labour (Operations' existing
// task-based budget/actual view, in the curtainJobs seed data above) —
// it does not overwrite or reconcile with those numbers automatically.
// Per-person rates live in WORKER_RATES (curtain.js) and are only ever
// used to compute cost for Operations' future reference — Curtain UI
// shows hours only, never BD figures, per the cost-free rule.
//
// Starts empty — real entries are added from the Time Log grid as
// workshop days are logged going forward.
// ═══════════════════════════════════════
const timeLogs = [];

// ═══════════════════════════════════════
// TRACK STOCK — raw rail/track profile inventory
// Sourced from the Q-Pro stock export (StockItemExcelExport, imported 3 Jul 2026).
// This is now the SINGLE SOURCE OF TRUTH for rail/track types — curtain.js's
// calc sheet dropdown reads directly from this list (no separate hardcoded
// RAIL_TYPES constant anymore). Real stock is organized by supplier/product
// line, not by generic category, so entries are real item codes/names.
//
// TWO STOCK MODES:
//   'cut'   — raw material tracked in metres, cut to each window's exact
//             length (e.g. Somfy Glydea, Unisoiel tracks, Cord Rail).
//   'piece' — sold/stocked as fixed-length finished pieces used AS-IS, no
//             cutting (e.g. DEERA/CURACC/Taqani Grabber Rail in 1–5m
//             lengths) — confirmed with Salman 3 Jul 2026.
//
// DATA QUALITY: 4 items show negative Closing Stock in Q-Pro (unreconciled
// adjustments) — usable quantity is floored at 0 here; `rawStock` keeps the
// original Q-Pro figure for reference. Flagged `dataIssue:true`.
//
// JUDGMENT CALL: the old app data used two inconsistent labels for the same
// Somfy motor ("Motorised Rail (Somfy)" and "Somfy Glydea Track" both paired
// with "Somfy 35 RTS with DCT" motors in the seed data) — both were mapped
// to the real Glydea rail (IT450) since that's what's actually in stock
// (Movelite raw rail IT461 has only 5.62m). Not confirmed with Silva —
// flag if any of these jobs actually used Movelite rail.
// ═══════════════════════════════════════
const trackStock = [
  // ── Cut-to-length (raw material, tracked in metres) ──
  { itemCode:"IT002395", label:"Cord Rail — Heavy Duty White (COR001)",              mode:"cut", metresInStock:1922.7, reorderAt:200, lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT001886", label:"Aluminium U-Shape Head Rail — Ningbo CH016",          mode:"cut", metresInStock:5811.7, reorderAt:300, lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT330",    label:"Unisoiel Cord Track — DC01 Heavy",                    mode:"cut", metresInStock:239.4,  reorderAt:50,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT378",    label:"Unisoiel Baton Track — M581",                         mode:"cut", metresInStock:0, rawStock:-352.4, reorderAt:50, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"curtain_track_manual" },
  { itemCode:"IT450",    label:"Somfy Glydea Track — raw rail",                       mode:"cut", metresInStock:2204.4, reorderAt:100, lastUpdated:"2026-07-03", railCategory:"curtain_track_motorized" },
  { itemCode:"IT461",    label:"Somfy Movelite Track — raw rail",                     mode:"cut", metresInStock:5.62,   reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_motorized" },
  { itemCode:"IT358",    label:"Unisoiel Curved/Flexible Track — IBM01",              mode:"cut", metresInStock:440.2,  reorderAt:50,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT362",    label:"Roman Blind Headrail — Unisoiel RAE01",               mode:"cut", metresInStock:3311.6, reorderAt:100, lastUpdated:"2026-07-03", railCategory:"roman_headrail" },
  { itemCode:"IT001918", label:"134 Heavy Duty China Rail",                           mode:"cut", metresInStock:70,     reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT344",    label:"Foshan Heavy Duty Aluminium Curtain Track",           mode:"cut", metresInStock:71,     reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT381",    label:"Unisoiel Japanese Track Head Rail — PT19-3E (3-way)", mode:"cut", metresInStock:1190,  reorderAt:100, lastUpdated:"2026-07-03", railCategory:"japanese_track" },
  { itemCode:"IT382",    label:"Unisoiel Japanese Track Head Rail — PT19-5E (5-way)", mode:"cut", metresInStock:696,   reorderAt:100, lastUpdated:"2026-07-03", railCategory:"japanese_track" },
  { itemCode:"IT351",    label:"Salsabeel China Rail",                                mode:"cut", metresInStock:0,     reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },

  // ── Fixed-piece (used whole, not cut — Grabber Rail style) ──
  { itemCode:"IT339",    label:"DEERA Grabber Rail — American 1m",                    mode:"piece", pieceLengthM:1, piecesInStock:14, reorderAt:5,  lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT340",    label:"DEERA Grabber Rail — American 2m",                    mode:"piece", pieceLengthM:2, piecesInStock:8,  reorderAt:5,  lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT001537", label:"DEERA Grabber Rail — American 2m (Double bracket)",   mode:"piece", pieceLengthM:2, piecesInStock:54, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT341",    label:"DEERA Grabber Rail — American 3m",                    mode:"piece", pieceLengthM:3, piecesInStock:0, rawStock:-36, reorderAt:10, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"grabber_piece" },
  { itemCode:"IT001523", label:"DEERA Grabber Rail — American 3m (Double)",           mode:"piece", pieceLengthM:3, piecesInStock:26, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT342",    label:"DEERA Grabber Rail — American 4m",                    mode:"piece", pieceLengthM:4, piecesInStock:0, rawStock:-69, reorderAt:10, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"grabber_piece" },
  { itemCode:"IT002222", label:"DEERA Grabber Rail — American 4m (Double bracket)",   mode:"piece", pieceLengthM:4, piecesInStock:48, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT343",    label:"DEERA Grabber Rail — American 5m",                    mode:"piece", pieceLengthM:5, piecesInStock:0, rawStock:-3.5, reorderAt:5, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"grabber_piece" },
  { itemCode:"IT003167", label:"CURACC006 American Grabber Rail — 3m",                mode:"piece", pieceLengthM:3, piecesInStock:62, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT003168", label:"Taqani Curtain Rail — 3m Double R3",                  mode:"piece", pieceLengthM:3, piecesInStock:48, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },

  // ── No metre/piece stock tracking (hardware-based or not yet in this sheet) ──
  { itemCode:null, label:"Wooden Pole",           mode:null, note:"No matching item in current stock export — wooden blinds tracked separately.", railCategory:"wooden_pole" },
  { itemCode:null, label:"Roller Blind Bracket",  mode:null, note:"Hardware-based (bracket + end cap components) — see Hardware Pick List instead.", railCategory:"roller_bracket" },
];
function getTrackStock(itemCode) {
  return trackStock.find(t => t.itemCode === itemCode) || null;
}
function getTrackStockByLabel(label) {
  return trackStock.find(t => t.label === label) || null;
}

// ═══════════════════════════════════════
// HARDWARE RECIPES — small assembly components per rail type
// (runners, end caps, master carrier, belt, driver pulley, brackets, etc.)
//
// PROBLEM THIS SOLVES: Silva was going to have to manually count and enter
// every small component per window (runners, end caps, brackets...) at BOM
// stage — tedious and error-prone across 50+ windows. Instead, each rail's
// hardware is DERIVED from track length + motorized flag via a formula, so
// Silva's inputs stay exactly what they already are (track length via
// window width/overhang, rail type, motorized on/off). Nothing new for her
// to fill in.
//
// FORMULA TYPES (component.formula):
//   'fixed'             — flat qty per track, regardless of length (e.g. 2 end caps)
//   'perLength_count'   — density-based: qty = ceil(trackLengthM * perMetre)
//   'perLength_spacing' — spacing-based: qty = ceil(trackLengthCm / spacingCm) [+1 if plusOne]
//   'lengthMatch'       — qty in metres = track length (e.g. drive belt)
//   'unknown'           — not yet quantified; shows as "TBD" in the UI rather
//                          than guessing a number that would silently corrupt
//                          real inventory/BOM figures
//
// CONFIRMED vs UNCONFIRMED: `confirmed:true` components use real figures
// Salman gave directly (runner density, bracket spacing — both confirmed
// 3 Jul 2026 as general shop practice, not Somfy-specific). Everything else
// is a reasonable placeholder flagged `confirmed:false` — the UI must show
// these visibly as needing Silva's sign-off before anyone treats them as
// real purchasing/inventory numbers.
//
// CATEGORY DEFAULTS apply by trackStock.railCategory. TRACK_HARDWARE_RECIPES
// below can override per exact itemCode once Silva confirms a specific rail
// differs from its category's default (e.g. if Movelite ever needs a
// different belt spec than Glydea).
// ═══════════════════════════════════════
const HARDWARE_RECIPE_DEFAULTS = {
  curtain_track_manual: {
    label: "Manual curtain/rail track",
    components: [
      { key:"runner",  label:"Runner / Glider", unit:"pcs", formula:"perLength_count", perMetre:12, confirmed:true,
        note:"Shop average — 12 runners per metre, confirmed by Salman 3 Jul 2026" },
      { key:"bracket", label:"Ceiling Bracket", unit:"pcs", formula:"perLength_spacing", spacingCm:100, plusOne:true, confirmed:true,
        note:"Shop practice — one bracket per metre, confirmed by Salman 3 Jul 2026" },
      { key:"endCap",  label:"End Cap", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per track, one each end) — confirm with Silva" },
    ]
  },
  curtain_track_motorized: {
    label: "Motorized track (wave/glide, e.g. Somfy Glydea/Movelite)",
    components: [
      { key:"runner",       label:"Wave Glider / Runner", unit:"pcs", formula:"perLength_count", perMetre:12, confirmed:true,
        note:"Shop average — 12 runners per metre, confirmed by Salman 3 Jul 2026" },
      { key:"bracket",      label:"Motorised Ceiling Bracket", unit:"pcs", formula:"perLength_spacing", spacingCm:100, plusOne:true, confirmed:true,
        note:"Shop practice — one bracket per metre, confirmed by Salman 3 Jul 2026" },
      { key:"endCap",       label:"End Cap", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per track, one each end) — confirm with Silva" },
      { key:"masterCarrier",label:"Master Carrier", unit:"pcs", formula:"fixed", qty:1, confirmed:false,
        note:"Placeholder (1 per track) — confirm with Silva" },
      { key:"belt",         label:"Drive Belt", unit:"m", formula:"lengthMatch", onlyIf:"motorized", confirmed:false,
        note:"Assumed 1 belt run = track length — confirm with Silva" },
      { key:"driverPulley", label:"Driver Pulley", unit:"pcs", formula:"fixed", qty:1, onlyIf:"motorized", confirmed:false,
        note:"Placeholder (1 per motorized track) — confirm with Silva" },
    ]
  },
  roman_headrail: {
    label: "Roman blind headrail",
    components: [
      { key:"ring",    label:"Ring", unit:"pcs", formula:"unknown", confirmed:false,
        note:"Rings needed per width not yet quantified — flag for Silva" },
      { key:"bracket", label:"Recess Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per blind) — confirm with Silva" },
    ]
  },
  japanese_track: {
    label: "Japanese panel track",
    components: [
      { key:"panelCarrier", label:"Panel Carrier", unit:"pcs", formula:"unknown", confirmed:false,
        note:"Depends on number of panels ordered — not modeled yet, flag for Silva" },
      { key:"bracket",      label:"Ceiling Bracket", unit:"pcs", formula:"perLength_spacing", spacingCm:100, plusOne:true, confirmed:false,
        note:"Assumed same 1m spacing as curtain track — confirm with Silva" },
    ]
  },
  grabber_piece: {
    label: "Grabber Rail (finished piece)",
    components: [
      { key:"endBracket", label:"End Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Grabber rail may ship with brackets included — confirm whether these need separate stock" },
    ]
  },
  wooden_pole: {
    label: "Wooden pole",
    components: [
      { key:"ring",    label:"Wooden Ring", unit:"pcs", formula:"unknown", confirmed:false,
        note:"Rings needed per width not yet quantified — flag for Silva" },
      { key:"bracket", label:"Pole Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per pole) — confirm with Silva" },
      { key:"finial",  label:"Finial (pair)", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (1 pair per pole) — confirm with Silva" },
    ]
  },
  roller_bracket: {
    label: "Roller/blind bracket (no rail)",
    components: [
      { key:"bracket", label:"Roller Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:true,
        note:"Standard pair per blind" },
    ]
  },
};

// Per-exact-itemCode overrides — empty for now. Add entries here once Silva
// confirms a specific rail's hardware differs from its category default,
// e.g. TRACK_HARDWARE_RECIPES["IT461"] = { components:[...] } if Movelite
// ever turns out to need a different belt/runner spec than Glydea.
const TRACK_HARDWARE_RECIPES = {};

// Returns the recipe (component list) that applies to a given flat window/layer.
function getHardwareRecipeForWindow(w) {
  if (!w || !w.railType) return null;
  const stock = w.railItemCode ? getTrackStock(w.railItemCode) : getTrackStockByLabel(w.railType);
  if (!stock || !stock.railCategory) return null;
  if (w.railItemCode && TRACK_HARDWARE_RECIPES[w.railItemCode]) return TRACK_HARDWARE_RECIPES[w.railItemCode];
  return HARDWARE_RECIPE_DEFAULTS[stock.railCategory] || null;
}

// Explodes one window/layer into its hardware component list.
// Returns [] if the rail has no recipe (e.g. no railType set yet).
// Each result: { key, label, unit, qty (number or null if 'unknown'), confirmed, note }
function explodeWindowHardware(w) {
  const recipe = getHardwareRecipeForWindow(w);
  if (!recipe) return [];
  const trackLengthCm = (w.calc && w.calc.trackLength) ? w.calc.trackLength : (w.width + ((w.overhang || 0) * 2));
  const trackLengthM  = trackLengthCm / 100;
  const results = [];
  recipe.components.forEach(c => {
    if (c.onlyIf === 'motorized' && !w.motorized) return;
    let qty = null;
    if (c.formula === 'fixed')                  qty = c.qty;
    else if (c.formula === 'perLength_count')   qty = Math.ceil(trackLengthM * c.perMetre);
    else if (c.formula === 'perLength_spacing') qty = Math.ceil(trackLengthCm / c.spacingCm) + (c.plusOne ? 1 : 0);
    else if (c.formula === 'lengthMatch')       qty = parseFloat(trackLengthM.toFixed(2));
    else if (c.formula === 'unknown')           qty = null;
    results.push({ key:c.key, label:c.label, unit:c.unit, qty, confirmed:!!c.confirmed, note:c.note || null });
  });
  return results;
}

// ═══════════════════════════════════════
// FABRIC CALCULATION ENGINE
// Lives in curtain.js as calcFabricWithHems() — the real calc sheet formula,
// wired to Silva's Save button. data.js no longer runs its own calc engine;
// windows here only carry calcDone + input fields. curtain.js hydrates
// w.calc on load for any window already marked calcDone (seed/historical
// data), and recomputes live whenever a window schedule renders.
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// CURTAIN DASHBOARD KPIs
// Quantity-only — no cost figures. Cost/budget data lives in job.bom for
// the Operations module to use elsewhere; the Curtain module never renders it.
// ═══════════════════════════════════════
function getCurtainKPIs() {
  const kpis = {
    totalRunningJobs: 0,
    totalItemsToProduce: 0,
    awaitingBOM: 0,
    awaitingBudget: 0,
    materialOverage: 0,       // jobs with fabric or track actual exceeding the quote estimate
    fabricOrdersPending: 0,   // purchase inquiries not yet received by Curtain
    fabricArrivedAwaitingReceipt: 0, // arrived in Bahrain but not yet handed to Curtain
    productionInProgress: 0,
    installationPending: 0,
    windowsBehindSchedule: 0  // planned labour.endDate passed, item not yet Ready/Installed
  };

  curtainJobs.forEach(job => {
    // Running jobs = any job not marked complete
    if (job.status !== 'complete') {
      kpis.totalRunningJobs++;
      // Total items = physical windows (qty-weighted) in non-complete jobs
      kpis.totalItemsToProduce += (job.windows ? job.windows.reduce((s, w) => s + (w.qty || 1), 0) : 0);

      // Stage-vs-Plan — only meaningful for jobs actively running
      kpis.windowsBehindSchedule += getBehindScheduleWindows(job).length;
    }

    if (job.bomStatus === "bom_pending")   kpis.awaitingBOM++;
    if (job.budgetStatus === "pending")    kpis.awaitingBudget++;

    // Material overage — actual (Silva's calc) exceeding the quote's estimate
    const materialAlerts = getCurtainMaterialAlerts(job);
    if (materialAlerts.length > 0) kpis.materialOverage++;

    if (job.status === "execution") kpis.productionInProgress++;
    if (job.installation && job.installation.status === "pending" && job.status === "execution") kpis.installationPending++;
  });

  // Purchase inquiries — global entity, not per-job
  purchaseInquiries.forEach(pi => {
    if (pi.stage !== "received_by_curtain") kpis.fabricOrdersPending++;
    if (pi.stage === "arrived_bahrain") kpis.fabricArrivedAwaitingReceipt++;
  });

  return kpis;
}

// ═══════════════════════════════════════
// STAGE-VS-PLAN — behind schedule detection
// Zero new data entry: compares each window's planned labour.endDate
// (already entered in the WIP tab) against its actual current stage
// (already recorded every time Mark Complete is tapped). A window is
// "behind" if its planned end date has passed and it hasn't reached
// Ready/Installed yet. Deliberately simple — no interim checkpoint
// tracking, just planned-done-by vs actually-done.
// ═══════════════════════════════════════
function getBehindScheduleWindows(job) {
  if (!job.windows) return [];
  ensureItemCards(job);
  const today = todayStr();
  return job.windows
    .filter(w => {
      const card = job.itemCards[w.id];
      if (!card || !card.labour || !card.labour.endDate) return false;
      if (card.stage === 'Ready' || card.stage === 'Installed') return false;
      return daysBetween(card.labour.endDate, today) > 0;
    })
    .map(w => ({ w, card: job.itemCards[w.id] }));
}

// ═══════════════════════════════════════
// CURTAIN MATERIAL OVERAGE ALERTS
// Flags windows where Silva's actual calc sheet exceeds the quote's
// estimate — needs Operations Manager sign-off before production proceeds.
// Fabric: quote's quoteEstimateMetres (reference) vs calc.totalMetres (actual).
// Track: window width + overhang*2 (the estimate, same formula the calc
// sheet itself defaults to) vs calc.trackLength (actual — may differ if
// Silva has overridden the track length on the calc sheet).
// ═══════════════════════════════════════
function getCurtainMaterialAlerts(job) {
  const alerts = [];
  if (!job.windows) return alerts;

  job.windows.forEach(w => {
    if (!w.calcDone || !w.calc) return;

    // Fabric overage
    if (w.quoteEstimateMetres != null && w.calc.totalMetres > w.quoteEstimateMetres) {
      alerts.push({
        cat: "Fabric",
        windowLabel: w.label, room: w.room,
        estimated: w.quoteEstimateMetres, actual: w.calc.totalMetres,
        overBy: parseFloat((w.calc.totalMetres - w.quoteEstimateMetres).toFixed(2)),
        unit: "m"
      });
    }

    // Track overage — only for windows that actually carry a track/rail
    if (w.calc.trackLength) {
      const estimatedTrackCm = w.width + ((w.overhang || 0) * 2);
      if (w.calc.trackLength > estimatedTrackCm) {
        alerts.push({
          cat: "Track",
          windowLabel: w.label, room: w.room,
          estimated: parseFloat((estimatedTrackCm / 100).toFixed(2)), actual: parseFloat((w.calc.trackLength / 100).toFixed(2)),
          overBy: parseFloat(((w.calc.trackLength - estimatedTrackCm) / 100).toFixed(2)),
          unit: "m"
        });
      }
    }
  });

  return alerts;
}

// ═══════════════════════════════════════
// CURTAIN ROOM SUMMARY
// Groups windows by room for collapsed view
// ═══════════════════════════════════════
function getWindowsByRoom(job) {
  const rooms = {};
  job.windows.forEach(w => {
    if (!rooms[w.room]) rooms[w.room] = [];
    rooms[w.room].push(w);
  });
  return rooms;
}

// ═══════════════════════════════════════
// WINDOW COPY HELPER
// Returns a new window object copied from source
// ═══════════════════════════════════════
function copyWindow(sourceWindow, newId, newLabel) {
  return {
    ...JSON.parse(JSON.stringify(sourceWindow)),
    id: newId,
    windowGroup: null, groupRole: null, // copies are independent physical windows, not linked layers
    label: newLabel || sourceWindow.label + " (copy)",
    calc: null // will be recalculated
  };
}



// ═══════════════════════════════════════
// PROJECTS (live jobs — Operations module)
// ═══════════════════════════════════════
const projects=[
  {id:"AMD-15002",name:"Villa 5 Fit-out",client:"Discovery Development",val:8450,health:"warn",
   depts:[{k:"carp",pct:45},{k:"curt",pct:80},{k:"uph",pct:60}],
   budget:{sell:8450,cost:5900,mat:1800,lab:2500,sub:800,hir:200,oth:600},
   actuals:{mat:1900,lab:2700,sub:800,hir:200,oth:600},
   alerts:[
     {t:"Subcontractor overdue",s:"Glass supplier PO not received — expected 8 Jun. May delay Joinery finish.",tp:"warn",r:false},
     {t:"Progress invoice not raised",s:"Job 60% complete — progress milestone passed. Chase Accounts.",tp:"bad",r:false},
     {t:"3 snags open",s:"Post-installation snags reported by client. Not yet resolved.",tp:"bad",r:false}
   ],
   variations:[
     {id:"VO-01",desc:"Pelmet height +200mm both sides",reason:"Site measurement differs",sell:120,cost:75,status:"Approved"},
     {id:"VO-02",desc:"Brass table legs +100mm higher",reason:"Client change",sell:85,cost:40,status:"With Estimator"}
   ],
   subcons:[
     {name:"Gulf Glass Trading",item:"Sliding glass panels",ordered:"1 Jun",expected:"8 Jun",status:"overdue",paid:false},
     {name:"Al Noor Powder Coat",item:"Brass frame coating",ordered:"28 May",expected:"5 Jun",status:"received",paid:true},
     {name:"Premium Fabric House",item:"Kravet Boucle fabric",ordered:"3 Jun",expected:"10 Jun",status:"pending",paid:false}
   ],
   payments:{invoiced:8450,received:2535,breakdown:[
     {l:"Advance 30% — BD 2,535",st:"ok",n:"Received 2 May"},
     {l:"Progress 40% — BD 3,380",st:"warn",n:"Not yet raised"},
     {l:"Final 30% — BD 2,535",st:"grey",n:"On delivery"}
   ]},
   snags:[
     {dept:"Joinery",desc:"Wardrobe sliding door not closing flush",assigned:"Arun Kumar",r:false},
     {dept:"Curtain",desc:"Motorised track making noise on left side",assigned:"Silva",r:false},
     {dept:"Upholstery",desc:"Small fabric pull on armchair arm",assigned:"Karthik Silva",r:true}
   ],
   notes:[
     {by:"Operations",note:"Client Sophia is very detail-oriented. Do not promise dates without confirming capacity first.",d:"3 Jun"},
     {by:"Salman Abdullah",note:"Discovery Dev has 3 more villas planned — handle this job well.",d:"1 May"}
   ],
   comms:[
     {t:"Site visit",by:"Salman Abdullah",n:"Confirmed final fabric. Client happy.",d:"3 Jun",c:"var(--info)"},
     {t:"Client approval",by:"Aslam",n:"Approved revised quote via email.",d:"28 May",c:"var(--ok)"}
   ],
   docs:[
     {n:"signed-quote-villa5.pdf",c:"Signed Quote",d:"2 May",i:"📄"},
     {n:"BOQ-final.xlsx",c:"BOQ",d:"5 May",i:"📊"},
     {n:"site-photo-01.jpg",c:"Site photo",d:"3 Jun",i:"📷"}
   ],
   signoff:{done:false,date:null}
  },
  {id:"AMD-15010",name:"Majlis Refurbishment",client:"Ahmed Omar Trading",val:4200,health:"bad",
   depts:[{k:"carp",pct:85},{k:"uph",pct:40}],
   budget:{sell:4200,cost:2260,mat:840,lab:900,sub:300,hir:0,oth:220},
   actuals:{mat:860,lab:1110,sub:300,hir:0,oth:200},
   alerts:[
     {t:"Joinery BOM overdue",s:"48h deadline passed — fill or delegate in BOM / Budget.",tp:"bad",r:false},
     {t:"Over labour budget",s:"Joinery 14h over — margin eroding fast.",tp:"bad",r:false},
     {t:"Variation with Estimator",s:"VO-01 sent to estimator 3 days ago — no response yet.",tp:"warn",r:false}
   ],
   variations:[
     {id:"VO-01",desc:"Additional seating niche — 2 extra cushions + frame",reason:"Client added scope",sell:380,cost:210,status:"With Estimator"}
   ],
   subcons:[
     {name:"Fabric Studio BH",item:"Moroccan tufted fabric",ordered:"25 May",expected:"4 Jun",status:"received",paid:true}
   ],
   payments:{invoiced:4200,received:1260,breakdown:[
     {l:"Advance 30% — BD 1,260",st:"ok",n:"Received 1 May"},
     {l:"Progress 40% — BD 1,680",st:"warn",n:"Not yet raised"},
     {l:"Final 30% — BD 1,260",st:"grey",n:"On delivery"}
   ]},
   snags:[],
   notes:[{by:"Operations",note:"Ahmed Omar is a regular client — always pays on time. Fast-track if needed.",d:"2 May"}],
   comms:[{t:"Call",by:"Aslam",n:"Client confirmed delivery date 25 Jun.",d:"1 Jun",c:"var(--warn)"}],
   docs:[{n:"signed-quote-majlis.pdf",c:"Signed Quote",d:"30 Apr",i:"📄"}],
   signoff:{done:false,date:null}
  },
  {id:"AMD-14871",name:"Pocket Wall Cladding",client:"Cinqo Contracting",val:286,health:"ok",
   depts:[{k:"carp",pct:70}],
   budget:{sell:286,cost:200,mat:80,lab:60,sub:0,hir:0,oth:60},
   actuals:{mat:82,lab:62,sub:0,hir:0,oth:58},
   alerts:[],
   variations:[],
   subcons:[],
   payments:{invoiced:286,received:286,breakdown:[{l:"Full payment — BD 286",st:"ok",n:"Received"}]},
   snags:[],
   notes:[],
   comms:[],
   docs:[{n:"quote-cinqo.pdf",c:"Signed Quote",d:"20 May",i:"📄"}],
   signoff:{done:true,date:"2 Jun"}
  }
];

let currentJob = null;
let currentCurtainJob = null;

// ═══════════════════════════════════════
// BOM JOBS (Operations module)
// ═══════════════════════════════════════
const bomJobs=[
  {id:"AMD-15010",name:"Majlis Refurbishment",client:"Ahmed Omar",val:4200,
   depts:[
     {k:"carp",pm:"Arun Kumar",bom:{mat:840,lab:900,oth:220},status:"overdue",owner:"pm",delegate:null},
     {k:"uph",pm:"Karthik Silva",bom:{mat:320,lab:260,oth:80},status:"pending",owner:"pm",delegate:null}
   ]},
  {id:"AMD-14933",name:"Showroom Door Unit",client:"Al Maraya Decor",val:6800,
   depts:[
     {k:"carp",pm:"Arun Kumar",bom:{mat:1800,lab:1400,oth:300},status:"submitted",owner:"pm",delegate:null},
     {k:"metal",pm:"Silva",bom:{mat:600,lab:400,oth:160},status:"delegated",owner:"delegated",delegate:{to:"Karthik Silva",deadline:"Today 5pm"}},
     {k:"paint",pm:"Karthik Silva",bom:{mat:200,lab:150,oth:100},status:"pending",owner:"pm",delegate:null}
   ]},
  {id:"AMD-15002",name:"Villa 5 Fit-out",client:"Discovery Dev",val:8450,
   depts:[
     {k:"carp",pm:"Arun Kumar",bom:{mat:1200,lab:1100,oth:300},status:"submitted",owner:"ops",delegate:null},
     {k:"curt",pm:"Silva",bom:{mat:600,lab:400,oth:100},status:"submitted",owner:"pm",delegate:null},
     {k:"uph",pm:"Karthik Silva",bom:{mat:500,lab:380,oth:120},status:"submitted",owner:"pm",delegate:null}
   ]}
];

// ═══════════════════════════════════════
// DELIVERY CHECKLIST
// ═══════════════════════════════════════
const checks=[
  {l:"All items QC signed off by PM",n:"Production manager confirms finished to spec",done:true},
  {l:"Items packed and protected",n:"Foam, blankets, strapping — no bare edges",done:true},
  {l:"Delivery note prepared",n:"Itemised list matching job card",done:true},
  {l:"Client notified of delivery time",n:"Confirmed appointment with site contact",done:true},
  {l:"Vehicle and team assigned",n:"Team A, 3-ton truck",done:true},
  {l:"Site access confirmed",n:"Keys / access code / security",done:true},
  {l:"Installation tools loaded",n:"Drills, fixings, level, touch-up paint",done:false},
  {l:"Client sign-off form printed",n:"Physical form for signature on delivery",done:false},
];

// ═══════════════════════════════════════
// CAPACITY HEATMAP
// ═══════════════════════════════════════
const weeks=["2–6 Jun","9–13 Jun","16–20 Jun","23–27 Jun","30J–4Jul","7–11 Jul"];
const cap=[{n:"Carpentry",l:[4,4,3,2,1,1]},{n:"Painting",l:[3,2,2,1,2,1]},{n:"Upholstery",l:[1,1,2,1,0,0]},{n:"Curtain",l:[2,1,0,1,2,1]},{n:"Metal",l:[3,2,1,0,0,1]}];
const hstyles=["background:#e8f5e9;color:#2e7d32","background:#c8e6c9;color:#1b5e20","background:#fff3e0;color:#e65100","background:#ffe0b2;color:#bf360c","background:#ffcdd2;color:#b71c1c","background:#d9342b;color:#fff"];
const hl=["Free","Light","Mod","Heavy","~Full","FULL"];

// ═══════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════
const reminders=[
  {icon:"🔔",type:"BOM reminder",to:"Arun Kumar",msg:"Joinery BOM for Majlis Refurbishment overdue — please submit urgently",sent:"Today 9:00am",channel:"In-app + WhatsApp",acted:false},
  {icon:"📧",type:"Invoice reminder",to:"Accounts",msg:"Progress invoice for Villa 5 Fit-out not yet raised — job is 60% complete",sent:"Today 8:45am",channel:"In-app",acted:false},
  {icon:"🔔",type:"Supplier chase",to:"Gulf Glass Trading",msg:"PO for glass panels overdue — please confirm delivery date",sent:"Yesterday 4pm",channel:"WhatsApp",acted:false},
  {icon:"✅",type:"Budget approval",to:"Salman Abdullah",msg:"Showroom Door Unit budget BD 4,760 submitted for approval",sent:"Yesterday 2pm",channel:"In-app + WhatsApp",acted:true},
  {icon:"🔔",type:"Delegation alert",to:"Karthik Silva",msg:"Please fill Metal Works BOM for Showroom Door Unit — deadline today 5pm",sent:"Today 8:00am",channel:"In-app + WhatsApp",acted:false},
];
function renderReminders(){
  document.getElementById("rem-list").innerHTML=reminders.map((r,i)=>`
    <div class="rem-item" style="${r.acted?"opacity:.5":""}">
      <div class="rem-icon" style="background:${r.acted?"var(--ok-bg)":"var(--info-bg)"};">${r.icon}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${r.type} → ${r.to}</div>
        <div style="font-size:12px;color:var(--ink2);margin:2px 0;">${r.msg}</div>
        <div style="font-size:11px;color:var(--ink3);margin:3px 0;">${r.sent} · ${r.channel} · ${r.acted?'<span style="color:var(--ok);font-weight:600;">Acted on</span>':'<span style="color:var(--warn);">No response yet</span>'}</div>
      </div>
      ${!r.acted?`<button class="sm warn" onclick="resendReminder(${i})">Resend</button>`:""}
    </div>`).join("");
}
function resendReminder(i){
  showAlert("Reminder resent to "+reminders[i].to);
  reminders[i].sent="Just now";
  renderReminders();
}
renderReminders();

// ═══════════════════════════════════════
// PURCHASER MODULE — Purchase Request → Purchase Order → Purchase Invoice
// Built session: 5 Jul 2026
//
// SCOPE: covers all departments EXCEPT Curtain fabric ordering — Curtain's
// fabric/track requests are tracked separately via purchaseInquiries[]
// above (Silva's tracker, unchanged, do not touch). This system is for
// Upholstery, Joinery (incl. Painting), Metal Works, and general/stock
// purchasing — anything that isn't a curtain fabric/rail order.
//
// WORKFLOW: a department can only RAISE A REQUEST (purchaseRequests[]).
// Only the Purchaser converts a request into an actual Purchase Order.
// Every PO must be approved by Operations Manager or Owner before it can
// be converted into a Purchase Invoice on goods receipt. Conversion
// functions carry line items/supplier/job forward so nothing gets
// retyped between stages.
//
// FIELD NAMES on purchaseOrders[]/purchaseInvoices[] match the existing
// Q-Pro Purchase Order / Purchase Invoice print formats word-for-word
// (Supplier Name/Tel, Supplier Ref, Product/Service, FxRate (BD), etc.)
// so these feel identical to what Salman/the Purchaser already know.
//
// ID NOTE: Q-Pro's own Purchase Invoice also uses prefix "PI-" — but that
// collides with purchaseInquiries[] IDs (PI-0001 etc.) already in this
// file. Purchase Invoices here use prefix "INV-" instead. PR- and PO-
// were free, so those match Q-Pro as-is.
//
// JOB LINKING: linkedJobId always uses this system's own AMD-XXXXX job ID
// (matches projects[].id / curtainJobs[].id — the real link for all
// lookups/joins). qproJobRef is a display-only text field for the old
// Q-Pro job number (e.g. "JB26AMD02242"), kept only for cross-checking
// during the Q-Pro transition — never used in lookups or joins, safe to
// leave blank or drop later.
//
// DEPARTMENTS reuse the existing DEPTS keys (carp/paint/uph/curt/metal)
// rather than inventing a new enum. Painting rolls up into the Joinery
// KPI bucket on the dashboard (Salman's call, 5 Jul 2026) — "paint"
// stays its own DEPTS key underneath so nothing else that reads DEPTS
// breaks; the rollup only happens inside getPurchasingKPIs() below.
// ═══════════════════════════════════════

const purchaseRequests = [];

function nextPRId() {
  return "PR-" + String(purchaseRequests.length + 1).padStart(4, "0") + "-AMD";
}

// Matches Q-Pro's own three-way split (Inventory / Job / Others) across
// Purchase Request, Purchase Order, and Purchase Invoice alike — kept as one
// generic form with a Destination selector rather than 9 separate menu
// entries (Q-Pro's literal structure), since the fields are identical either
// way; a deliberate simplification, not a missed detail.
// destinationType: "inventory" (shared stock pool) | "job-direct" (issued
// straight to a job) | "others" (misc, non-stock non-job — e.g. office
// supplies). Internal `type` values stay "Stock"/"Job"/"Others" — only
// "Stock" ever triggers the stockEntries pool logic below.
function destinationTypeToType(destinationType) {
  if (destinationType === "job-direct") return "Job";
  if (destinationType === "others") return "Others";
  return "Stock";
}

function raisePurchaseRequest({ department, raisedBy, linkedJobId = null, destinationType, items, division = null }) {
  const pr = {
    id: nextPRId(),
    division,              // Q-Pro's own "Division" field on Purchase Request (Job) — optional, display-only here
    department,            // one of DEPTS keys: carp, paint, uph, curt, metal
    raisedBy,
    dateRaised: new Date().toISOString().slice(0, 10),
    linkedJobId,           // AMD-XXXXX or null
    destinationType,       // "inventory" | "job-direct"
    items,                 // [{ name, qty, unit, itemRef, remarks }] — itemRef is optional: { id, label } for a
                            // Curtain window/opening, or a free-text string for other divisions
    status: "open"         // open | converted | cancelled — PRs never require approval
  };
  purchaseRequests.push(pr);
  return pr;
}

// ═══════════════════════════════════════
// SUPPLIER MASTER (Masters → Accounts → Vendor / Supplier_master)
// The ONE canonical supplier list — every PO / Purchase Invoice / Payment /
// Debit Note lookup reads from here. The real Q-Pro system also has a
// second, vestigial "Inventory → Vendor" list (internally "Stock Group",
// just Name+Status) that no transaction actually reads from — that
// duplication is deliberately NOT replicated; this is the only master.
// ═══════════════════════════════════════
const suppliers = [];
const SUPPLIER_COUNTRIES = ["Bahrain", "Saudi Arabia", "UAE", "Kuwait", "Qatar", "Oman", "Other"];
const SUPPLIER_TAX_PERCENTS = [0, 5, 10];
const CASH_LEDGERS = ["Cash", "Bank - BBK Current", "Bank - NBB Current", "Petty Cash"];

function nextSupplierId() {
  return "SUP-" + String(suppliers.length + 1).padStart(4, "0");
}

function createSupplier({
  name, contactPerson, telephone, telephone2 = "", email = "", fax = "",
  vatName = "", vatNo = "", taxPercent = 10, isCredit = false, creditLimit = 0,
  creditDays = 0, bankAccountNumber = "", bankAccountHolderName = "", ibanNumber = "",
  bankSwift = "", bankName = "", bankBranch = "", address, crNo = "",
  country = "Bahrain", openingBalance = 0
} = {}) {
  if (!name || !name.trim()) return { error: "Name is required." };
  if (!contactPerson || !contactPerson.trim()) return { error: "Contact Person is required." };
  if (!telephone || !telephone.trim()) return { error: "Telephone is required." };
  if (!address || !address.trim()) return { error: "Address is required." };
  const supplier = {
    id: nextSupplierId(),
    name: name.trim(), contactPerson: contactPerson.trim(), telephone: telephone.trim(),
    telephone2, email, fax, vatName, vatNo, taxPercent: Number(taxPercent) || 0,
    isCredit: !!isCredit, creditLimit: Number(creditLimit) || 0, creditDays: Number(creditDays) || 0,
    bankAccountNumber, bankAccountHolderName, ibanNumber, bankSwift, bankName, bankBranch,
    address: address.trim(), crNo, country, openingBalance: Number(openingBalance) || 0,
    dateCreated: new Date().toISOString().slice(0, 10)
  };
  suppliers.push(supplier);
  return supplier;
}

function updateSupplier(supplierId, patch) {
  const s = suppliers.find(x => x.id === supplierId);
  if (!s) return null;
  Object.assign(s, patch);
  return s;
}

const purchaseOrders = [];

function nextPOId() {
  return "PO-" + String(purchaseOrders.length + 1).padStart(4, "0") + "-AMD";
}

// Converts a Purchase Request into a Purchase Order. Carries the items and
// job link forward automatically — the Purchaser only fills in supplier
// and pricing details, matching the Q-Pro PO creation form field-for-field.
function convertPRtoPO(prId, supplierDetails = {}) {
  const pr = purchaseRequests.find(p => p.id === prId);
  if (!pr) return null;
  const po = {
    id: nextPOId(),
    sourcePR: pr.id,
    department: pr.department,   // stamped directly so approvals/KPIs never need a sourcePR lookup
    date: new Date().toISOString().slice(0, 10),
    company: "Al Maraya Decor",
    paymentMode: supplierDetails.paymentMode || "Cash",
    supplierId: supplierDetails.supplierId || null,
    supplierNameTel: supplierDetails.supplierNameTel || "",
    supplierRef: supplierDetails.supplierRef || "",
    cashLedger: supplierDetails.cashLedger || null,
    purchaseRequest: pr.id,
    type: destinationTypeToType(pr.destinationType),
    linkedJobId: pr.linkedJobId,
    qproJobRef: null,
    currency: "Bahraini Dinar",
    exRate: 1,
    deliveryTerms: "",
    supplyAddress: "",
    items: pr.items.map(it => ({
      productService: it.name,
      qty: it.qty,
      unit: it.unit,
      itemRef: it.itemRef || null,   // optional { id, label } window/item allocation tag, or free text
      itemId: it.itemId || null,     // real Item Master reference (Inventory-type only) — feeds Stock Report/Job Material Requirement
      fxRateBD: 0,
      amountBD: 0,
      discountBD: 0,
      vatPercent: 10,
      vatBD: 0,
      netAmountBD: 0,
      ledger: "Purchase"
    })),
    approvalStatus: "pending",   // pending | approved | rejected
    approvedBy: null,
    approvalDate: null,
    rejectionComment: null,
    preparedBy: supplierDetails.preparedBy || null,
    status: "draft"              // draft | issued | invoiced
  };
  purchaseOrders.push(po);
  pr.status = "converted";
  return po;
}

// Creates a Purchase Order directly, with no Purchase Request behind it.
// Same shape/approval gate as a converted PO (sourcePR stays null) — per
// Salman's call (5 Jul 2026): PRs never require approval, but every PO
// does, regardless of whether it came from a PR or was raised directly.
function createPurchaseOrderDirect({ department, linkedJobId = null, destinationType = "inventory", supplierDetails = {}, items }) {
  const po = {
    id: nextPOId(),
    sourcePR: null,
    department,
    date: new Date().toISOString().slice(0, 10),
    company: "Al Maraya Decor",
    paymentMode: supplierDetails.paymentMode || "Cash",
    supplierId: supplierDetails.supplierId || null,
    supplierNameTel: supplierDetails.supplierNameTel || "",
    supplierRef: supplierDetails.supplierRef || "",
    cashLedger: supplierDetails.cashLedger || null,
    purchaseRequest: null,
    type: destinationTypeToType(destinationType),
    linkedJobId,
    qproJobRef: null,
    currency: "Bahraini Dinar",
    exRate: supplierDetails.exRate || 1,
    deliveryTerms: supplierDetails.deliveryTerms || "",
    supplyAddress: supplierDetails.supplyAddress || "",
    items: items.map(it => ({
      productService: it.name,
      qty: it.qty,
      unit: it.unit,
      itemRef: it.itemRef || null,
      itemId: it.itemId || null,
      fxRateBD: it.fxRateBD || 0,
      amountBD: 0,
      discountBD: it.discountBD || 0,
      vatPercent: it.vatPercent || 10,
      vatBD: 0,
      netAmountBD: 0,
      ledger: "Purchase"
    })),
    approvalStatus: "pending",
    approvedBy: null,
    approvalDate: null,
    rejectionComment: null,
    preparedBy: supplierDetails.preparedBy || null,
    status: "draft"
  };
  purchaseOrders.push(po);
  return po;
}

// Approval gate — nothing downstream (convertPOtoInvoice) will accept a PO
// that hasn't been through this. Restrict calling this in the UI to
// Operations Manager / Owner logins.
function approvePO(poId, approvedBy) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return null;
  po.approvalStatus = "approved";
  po.approvedBy = approvedBy;
  po.approvalDate = new Date().toISOString().slice(0, 10);
  po.status = "issued";
  return po;
}
function rejectPO(poId, rejectedBy, comment) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return null;
  po.approvalStatus = "rejected";
  po.approvedBy = rejectedBy;
  po.approvalDate = new Date().toISOString().slice(0, 10);
  po.rejectionComment = comment;
  return po;
}
function getPendingPOApprovals() {
  return purchaseOrders.filter(po => po.approvalStatus === "pending");
}

const purchaseInvoices = [];

function nextInvoiceId() {
  return "INV-" + String(purchaseInvoices.length + 1).padStart(4, "0") + "-AMD";
}

// Converts an APPROVED Purchase Order into a Purchase Invoice on goods
// receipt. Refuses to convert an unapproved PO — the approval gate is
// enforced here in code, not just hidden in the UI.
function convertPOtoInvoice(poId, receiptDetails = {}) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return null;
  if (po.approvalStatus !== "approved") {
    return { error: "PO must be approved before it can be invoiced." };
  }
  const inv = {
    id: nextInvoiceId(),
    sourcePO: po.id,
    department: po.department,
    type: po.type,
    dateReceived: new Date().toISOString().slice(0, 10),
    supplierId: po.supplierId || null,
    supplierNameTel: po.supplierNameTel,
    supplierRef: receiptDetails.supplierRef || "",   // vendor's own invoice number
    linkedJobId: po.linkedJobId,
    qproJobRef: null,
    items: (receiptDetails.items || po.items).map(it => ({
      itemName: it.productService || it.itemName,
      qty: it.qty,
      itemRef: it.itemRef || null,
      itemId: it.itemId || null,
      rateBD: it.rateBD || 0,
      discBD: it.discBD || 0,
      vatPercent: it.vatPercent || 10,
      amtBD: it.amtBD || 0
    })),
    totals: receiptDetails.totals || { total: 0, vat: 0, roundOff: 0, netAmount: 0 },
    otherExpenseAmount: 0,
    paidAmount: 0,
    preparedBy: receiptDetails.preparedBy || null,
    // A PO-converted invoice is already gated — its PO went through approval
    // before it could reach "issued". Auto-approved here so it never shows
    // up in the Approvals tab a second time.
    approvalStatus: "approved",
    approvedBy: po.approvedBy,
    approvalDate: new Date().toISOString().slice(0, 10),
    rejectionComment: null,
    status: "received"
  };
  purchaseInvoices.push(inv);
  po.status = "invoiced";

  // If this order was Stock-type (not job-direct), the received items land
  // in the shared inventory pool, awaiting the (future) Storekeeper screen.
  if (po.type === "Stock") {
    inv.items.forEach(it => {
      stockEntries.push({
        id: "STK-" + String(stockEntries.length + 1).padStart(4, "0"),
        sourceInvoice: inv.id,
        itemName: it.itemName,
        qty: it.qty,
        unit: "",
        status: "in-pool",     // in-pool | released
        releasedTo: null,
        dateReceived: inv.dateReceived
      });
      // Item Master items (as opposed to free-text stock names) also move
      // the real Item Master ledger — matches the Batch 2 note that only
      // "Inventory type" transactions referencing a real item affect the
      // Stock Report/Job Material Requirement.
      if (it.itemId) {
        const master = itemMaster.find(i => i.id === it.itemId);
        if (master) {
          master.closingStock = (master.closingStock || 0) + it.qty;
          master.lastPurchaseRate = it.rateBD || master.lastPurchaseRate;
        }
      }
    });
  }
  return inv;
}

// Creates a Purchase Invoice directly, with no Purchase Order behind it.
// Unlike a PO-converted invoice (auto-approved because its PO already went
// through approval), a direct invoice has never been gated by anything —
// so per Salman's call (5 Jul 2026) it needs its own approval before the
// items are treated as received / released to the stock pool.
//
// Two-stage flow (matches the real Q-Pro Purchase Invoice screen, minus its
// bugs): Submit lands here in "draft" — an edit view with an Other Expenses
// field. Confirm (confirmPurchaseInvoiceDraft below) moves it to
// "pending_approval" so it actually enters the Owner/Ops approval queue.
function createPurchaseInvoiceDirect({ department, linkedJobId = null, destinationType = "inventory", supplierDetails = {}, items, preparedBy, sourcePOSearch = null }) {
  const inv = {
    id: nextInvoiceId(),
    sourcePO: null,
    sourcePOSearch,               // PO id entered via "Search PO Number" + Locate, informational only
    department,
    type: destinationTypeToType(destinationType),
    dateReceived: new Date().toISOString().slice(0, 10),
    supplierId: supplierDetails.supplierId || null,
    supplierNameTel: supplierDetails.supplierNameTel || "",
    supplierRef: supplierDetails.supplierRef || "",
    linkedJobId,
    qproJobRef: null,
    items: items.map(it => ({
      itemName: it.name,
      qty: it.qty,
      itemRef: it.itemRef || null,
      itemId: it.itemId || null,
      rateBD: it.rateBD || 0,
      discBD: it.discBD || 0,
      vatPercent: it.vatPercent || 10,
      amtBD: it.amtBD || 0
    })),
    totals: supplierDetails.totals || { total: 0, vat: 0, roundOff: 0, netAmount: 0 },
    otherExpenseAmount: 0,
    paidAmount: 0,
    preparedBy: preparedBy || null,
    approvalStatus: "pending",   // pending | approved | rejected
    approvedBy: null,
    approvalDate: null,
    rejectionComment: null,
    status: "draft"   // draft (post-Submit, pre-Confirm) | pending_approval | received
  };
  purchaseInvoices.push(inv);
  return inv;
}

// Stage 2 of the Purchase Invoice flow — clicking "Confirm" on the draft
// view. Adds Other Expenses into the total and pushes the invoice into the
// real approval queue. Before this, the invoice sits in "draft" and does
// NOT show up in Approvals — matching the real form's draft/edit step.
function confirmPurchaseInvoiceDraft(invId, { otherExpenseAmount = 0 } = {}) {
  const inv = purchaseInvoices.find(i => i.id === invId);
  if (!inv) return null;
  if (inv.status !== "draft") return { error: "Only a draft invoice can be confirmed." };
  inv.otherExpenseAmount = Number(otherExpenseAmount) || 0;
  const base = inv.totals.netAmount || inv.totals.total || 0;
  inv.totals.netAmount = base + inv.otherExpenseAmount;
  inv.status = "pending_approval";
  return inv;
}

// Approval gate for direct invoices (mirrors approvePO/rejectPO). Only on
// approval do Stock-type items get released into the shared inventory pool
// — matches the same rule convertPOtoInvoice already follows.
function approveInvoice(invId, approvedBy) {
  const inv = purchaseInvoices.find(i => i.id === invId);
  if (!inv) return null;
  inv.approvalStatus = "approved";
  inv.approvedBy = approvedBy;
  inv.approvalDate = new Date().toISOString().slice(0, 10);
  inv.status = "received";
  if (inv.type === "Stock") {
    inv.items.forEach(it => {
      stockEntries.push({
        id: "STK-" + String(stockEntries.length + 1).padStart(4, "0"),
        sourceInvoice: inv.id,
        itemName: it.itemName,
        qty: it.qty,
        unit: "",
        status: "in-pool",
        releasedTo: null,
        dateReceived: inv.dateReceived
      });
      if (it.itemId) {
        const master = itemMaster.find(i => i.id === it.itemId);
        if (master) {
          master.closingStock = (master.closingStock || 0) + it.qty;
          master.lastPurchaseRate = it.rateBD || master.lastPurchaseRate;
        }
      }
    });
  }
  return inv;
}
function rejectInvoice(invId, rejectedBy, comment) {
  const inv = purchaseInvoices.find(i => i.id === invId);
  if (!inv) return null;
  inv.approvalStatus = "rejected";
  inv.approvedBy = rejectedBy;
  inv.approvalDate = new Date().toISOString().slice(0, 10);
  inv.rejectionComment = comment;
  return inv;
}
function getPendingInvoiceApprovals() {
  // A "draft" invoice hasn't been Confirmed yet — it doesn't enter the
  // approval queue until confirmPurchaseInvoiceDraft() flips it to
  // "pending_approval".
  return purchaseInvoices.filter(inv => inv.approvalStatus === "pending" && inv.status === "pending_approval");
}
function getDraftInvoices() {
  return purchaseInvoices.filter(inv => inv.status === "draft");
}

// ═══════════════════════════════════════
// SUPPLIER PAYMENT
// The real Q-Pro Payment screen has three confirmed, reproducible bugs:
// (1) the invoice-allocation table always shows "No Invoice List
//     Available..!" even for a vendor with a confirmed open invoice,
// (2) the Cash method's "Select" checkbox freezes the tab 30+ seconds,
// (3) "Create Payment" freezes the tab and the payment is never actually
//     created (never appears in the list afterwards).
// Per Salman's instruction these are genuine client-side defects to be
// FIXED here, not reproduced — getVendorOpenInvoices() below actually looks
// the invoices up, and createPayment() actually persists the record.
// ═══════════════════════════════════════
const payments = [];

function nextPaymentId() {
  return "PAY-" + String(payments.length + 1).padStart(4, "0") + "-AMD";
}

// Returns { invoiceId, invoiceDate, invoiceAmount, paidAmount, balanceAmount }
// rows for every received invoice of this vendor that still has a balance —
// this is the exact table the real system fails to populate.
function getVendorOpenInvoices(supplierId) {
  return purchaseInvoices
    .filter(inv => inv.supplierId === supplierId && inv.status === "received")
    .map(inv => {
      const invoiceAmount = (inv.totals && inv.totals.netAmount) || 0;
      const paidAmount = inv.paidAmount || 0;
      const balanceAmount = Math.round((invoiceAmount - paidAmount) * 1000) / 1000;
      return { invoiceId: inv.id, invoiceDate: inv.dateReceived, invoiceAmount, paidAmount, balanceAmount };
    })
    .filter(row => row.balanceAmount > 0.0001);
}

function createPayment({
  supplierId, division = null, paymentDate = null, methods = {}, amount,
  referenceNumber = "", allocations = [], advanceAmount = 0, ledgerSplits = [], remarks = ""
}) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return { error: "Please select a vendor." };
  if (!amount || Number(amount) <= 0) return { error: "Amount is required." };
  const payment = {
    id: nextPaymentId(),
    supplierId,
    division,
    paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
    methods,        // { cash:{enabled,amount}, cCard:{enabled,amount,type,authorized}, wallet:{enabled,amount,type,authorized}, cheque:{enabled,amount,number,bank} }
    amount: Number(amount),
    referenceNumber,
    allocations,    // [{ invoiceId, payingAmount, discountAmount }]
    advanceAmount: Number(advanceAmount) || 0,
    ledgerSplits,   // [{ ledger, amount, remarks }]
    remarks,
    status: "confirmed"
  };
  payments.push(payment);
  allocations.forEach(a => {
    const inv = purchaseInvoices.find(i => i.id === a.invoiceId);
    if (inv) inv.paidAmount = (inv.paidAmount || 0) + (Number(a.payingAmount) || 0);
  });
  return payment;
}

// ═══════════════════════════════════════
// DEBIT NOTE
// Real system reproduces the same freeze/non-persistence bug as Payment on
// submit (list stayed "No data available in table" afterward). Fixed here.
// ═══════════════════════════════════════
const debitNotes = [];
const DEBIT_NOTE_TAXABLE_TYPES = ["Taxable", "Non-Taxable", "Zero-Rated"];

function nextDebitNoteId() {
  return "DN-" + String(debitNotes.length + 1).padStart(4, "0") + "-AMD";
}

function createDebitNote({
  supplierId, division = null, ledger, debitNoteDate = null,
  taxableType = "Taxable", amount, reason = ""
}) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return { error: "Please select a vendor." };
  if (!ledger || !ledger.trim()) return { error: "Select Ledger is required." };
  if (!amount || Number(amount) <= 0) return { error: "Amount is required." };
  const dn = {
    id: nextDebitNoteId(),
    supplierId,
    division,
    ledger: ledger.trim(),
    debitNoteDate: debitNoteDate || new Date().toISOString().slice(0, 10),
    taxableType,
    amount: Number(amount),
    reason,
    status: "confirmed"
  };
  debitNotes.push(dn);
  return dn;
}

// ── INVENTORY STOCK POOL ──
// Populated automatically by convertPOtoInvoice() above for Stock-type
// orders. Release-to-department is the Storekeeper's screen — deferred to
// a later session. Entries just sit at "in-pool" until that screen exists.
const stockEntries = [];

// ── ITEM CARDS ──
// Flat, top-level — NOT nested inside job records, since jobs currently
// live in different arrays per module (projects[], curtainJobs[]) with no
// single unified job object yet. Same flat-list pattern as
// purchaseInquiries[]/timeLogs[] above. code format: "<jobId>-IT01",
// sequential per job (e.g. AMD-15002-IT01, AMD-15002-IT02).
const itemCards = [];

function nextItemCardCode(jobId) {
  const existing = itemCards.filter(ic => ic.jobId === jobId);
  return jobId + "-IT" + String(existing.length + 1).padStart(2, "0");
}
function issueItemCard(jobId, { description, qty, department, sourcePO = null, sourceStockEntry = null, itemRef = null }) {
  const card = {
    code: nextItemCardCode(jobId),
    jobId,
    description,
    qty,
    department,
    sourcePO,
    sourceStockEntry,
    itemRef,   // optional { id, label } window/item allocation tag, or free text — same shape as PR/PO/Invoice itemRef
    dateIssued: new Date().toISOString().slice(0, 10)
  };
  itemCards.push(card);
  return card;
}

// ── STOREKEEPER — release stock pool entries to departments ──
// Built session: 6 Jul 2026. Every release requires a job (Salman's call)
// so it always produces a traceable itemCard via issueItemCard() above.
// Supports partial release: if the released qty is less than the entry's
// full qty, the original entry keeps the remainder "in-pool" under its own
// id, and a NEW stock entry is created to carry the released portion — so
// "released" status always describes a fully-consumed record, never a
// part-consumed one.
function releaseStockEntry(entryId, { department, jobId, qty, issuedBy, itemRef = null }) {
  const entry = stockEntries.find(s => s.id === entryId);
  if (!entry) return { error: "Stock entry not found." };
  if (entry.status !== "in-pool") return { error: "This entry has already been released." };
  if (!jobId) return { error: "A job is required to release stock." };
  if (!issuedBy) return { error: "Issued-by name is required." };
  const releaseQty = Number(qty);
  if (!releaseQty || releaseQty <= 0) return { error: "Enter a quantity to release." };
  if (releaseQty > entry.qty) return { error: `Only ${entry.qty} ${entry.unit || ""} available in this entry.` };

  let releasedEntry;
  const today = new Date().toISOString().slice(0, 10);
  if (releaseQty === entry.qty) {
    entry.status = "released";
    entry.releasedTo = department;
    entry.releasedJobId = jobId;
    entry.dateReleased = today;
    entry.issuedBy = issuedBy;
    releasedEntry = entry;
  } else {
    entry.qty -= releaseQty; // remainder stays in-pool under the original id
    releasedEntry = {
      id: "STK-" + String(stockEntries.length + 1).padStart(4, "0"),
      sourceInvoice: entry.sourceInvoice,
      itemName: entry.itemName,
      qty: releaseQty,
      unit: entry.unit,
      status: "released",
      releasedTo: department,
      releasedJobId: jobId,
      dateReceived: entry.dateReceived,
      dateReleased: today,
      issuedBy
    };
    stockEntries.push(releasedEntry);
  }

  // Trace sourcePO through the invoice for the itemCard, since stock
  // entries only carry sourceInvoice, not sourcePO directly.
  const invoice = purchaseInvoices.find(i => i.id === releasedEntry.sourceInvoice);
  const sourcePO = invoice ? invoice.sourcePO : null;

  const card = issueItemCard(jobId, {
    description: releasedEntry.itemName,
    qty: releaseQty,
    department,
    sourcePO,
    sourceStockEntry: releasedEntry.id,
    itemRef
  });

  return { stockEntry: releasedEntry, itemCard: card };
}

// ── STOREKEEPER DASHBOARD SUMMARY ──
function getStockPoolSummary() {
  const inPool = stockEntries.filter(s => s.status === "in-pool");
  const today = new Date().toISOString().slice(0, 10);
  const releasedToday = stockEntries.filter(s => s.status === "released" && s.dateReleased === today);
  const releasedTotal = stockEntries.filter(s => s.status === "released");
  return {
    inPoolCount: inPool.length,
    inPoolQty: inPool.reduce((sum, s) => sum + s.qty, 0),
    distinctItemsInPool: new Set(inPool.map(s => s.itemName)).size,
    releasedTodayCount: releasedToday.length,
    releasedTotalCount: releasedTotal.length
  };
}

// ═══════════════════════════════════════
// STOCK ADJUSTMENT (Transactions → Inventory → Stock Adjustment)
// Only one Type ("Stock Adjustment") and one Location ("Location 1") exist
// in the real system — it is single-location/single-warehouse throughout,
// captured here as-is rather than building unused multi-location plumbing.
// Adjustment Reason is informational only (Q-Pro's own dropdown offers
// "Not Applicable"/"Issue"); qty is a signed delta the user enters directly
// (negative to reduce stock) rather than the Reason forcing a sign — kept
// simple and honest rather than guessing an unconfirmed business rule.
// ═══════════════════════════════════════
const stockAdjustments = [];
const STOCK_ADJUSTMENT_REASONS = ["Not Applicable", "Issue"];

function nextSANumber() {
  return "SA-" + String(stockAdjustments.length + 1).padStart(4, "0") + "-AMD";
}

function createStockAdjustment({ date = null, reason = "Not Applicable", items = [] } = {}) {
  if (!items.length) return { error: "Add at least one item." };
  const sa = {
    id: nextSANumber(),
    date: date || new Date().toISOString().slice(0, 10),
    type: "Stock Adjustment",
    location: "Location 1",
    reason,
    items: items.map(it => ({ itemId: it.itemId, itemName: it.itemName, unit: it.unit, qty: Number(it.qty) || 0 })),
    status: "confirmed"
  };
  stockAdjustments.push(sa);
  sa.items.forEach(it => {
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) + it.qty;
  });
  return sa;
}

// ═══════════════════════════════════════
// STOCK REPORTS (Reports → Stock Ledger)
// Only "Inventory type" transactions that reference a real Item Master
// entry (itemId set) ever appear here — a PO/Invoice line entered as free
// text under the "Others" type never touches these reports, matching the
// real system's behavior exactly (Batch 2 spec, section 6).
// ═══════════════════════════════════════

// The true item-level transaction ledger. Replays every voucher affecting
// this item in chronological order from its opening balance so each row's
// "closing stock" is an honest running total, not just today's snapshot.
function getStockReport({ itemId, voucherType = "All", from = "", to = "" } = {}) {
  const item = itemMaster.find(i => i.id === itemId);
  if (!item) return [];
  const vouchers = [];

  purchaseInvoices.forEach(inv => {
    if (inv.status !== "received") return;
    inv.items.forEach(it => {
      if (it.itemId !== itemId) return;
      const supplier = suppliers.find(s => s.id === inv.supplierId);
      vouchers.push({
        voucherType: "Purchase Invoice", voucherNo: inv.id, date: inv.dateReceived,
        vendor: supplier ? supplier.name : (inv.supplierNameTel || "—"),
        qty: it.qty, rate: it.rateBD || 0, amount: it.amtBD || 0, delta: it.qty
      });
    });
  });
  stockAdjustments.forEach(sa => {
    sa.items.forEach(it => {
      if (it.itemId !== itemId) return;
      vouchers.push({
        voucherType: "Stock Adjustment", voucherNo: sa.id, date: sa.date,
        vendor: "—", qty: Math.abs(it.qty), rate: 0, amount: 0, delta: it.qty
      });
    });
  });
  jobCards.forEach(job => {
    (job.materialsIssues || []).forEach(move => {
      if (move.status === "cancelled") return;
      move.items.forEach(it => {
        if (it.itemId !== itemId) return;
        vouchers.push({
          voucherType: "Material Issue", voucherNo: move.id, date: move.date,
          vendor: job.id, qty: it.qty, rate: 0, amount: 0, delta: -(Number(it.qty) || 0)
        });
      });
    });
    (job.materialsReturns || []).forEach(move => {
      if (move.status === "cancelled") return;
      move.items.forEach(it => {
        if (it.itemId !== itemId) return;
        vouchers.push({
          voucherType: "Material Return", voucherNo: move.id, date: move.date,
          vendor: job.id, qty: it.qty, rate: 0, amount: 0, delta: Number(it.qty) || 0
        });
      });
    });
  });

  vouchers.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let running = item.openingStock || 0;
  const withRunning = vouchers.map(v => { running += v.delta; return { ...v, closingStock: running }; });

  return withRunning.filter(v =>
    (voucherType === "All" || v.voucherType === voucherType) &&
    (!from || v.date >= from) && (!to || v.date <= to)
  );
}

// Flatter current-snapshot view vs. the transactional Stock Report above.
function getItemSummaryReport({ category = "", itemName = "", includeZero = true } = {}) {
  return itemMaster
    .filter(it => !category || it.stockCategory === category)
    .filter(it => !itemName || it.name.toLowerCase().includes(itemName.trim().toLowerCase()))
    .filter(it => includeZero || (it.closingStock || 0) !== 0)
    .map(it => ({ itemId: it.id, itemName: it.name, closingStock: it.closingStock || 0, purchaseRate: it.lastPurchaseRate || 0 }));
}

// The MRP-style reorder report. ORDERS is demand traced from Estimator BOM
// materials (only lines picked from the real Item Master via the Materials
// typeahead carry an itemId — see addBOMMaterial) on quotations behind
// still-open Job Cards; a job item whose material was typed as free text
// won't show demand here, same real-world distinction the spec calls out.
function getJobMaterialRequirement() {
  return itemMaster.map(item => {
    let orders = 0;
    jobCards.filter(j => j.status === "open").forEach(job => {
      const qtn = quotations.find(q => q.id === job.quotationId);
      if (!qtn) return;
      qtn.items.forEach(it => {
        if (!it.bom) return;
        it.bom.materials.forEach(m => { if (m.itemId === item.id) orders += m.qty; });
      });
    });

    let matIssued = 0;
    jobCards.forEach(job => {
      (job.materialsIssues || []).forEach(move => {
        if (move.status === "cancelled") return;
        move.items.forEach(it => { if (it.itemId === item.id) matIssued += Number(it.qty) || 0; });
      });
      (job.materialsReturns || []).forEach(move => {
        if (move.status === "cancelled") return;
        move.items.forEach(it => { if (it.itemId === item.id) matIssued -= Number(it.qty) || 0; });
      });
    });

    let poQty = 0;
    purchaseOrders.filter(po => po.type === "Stock" && po.status === "issued").forEach(po => {
      po.items.forEach(it => { if (it.itemId === item.id) poQty += Number(it.qty) || 0; });
    });

    const reqQty = Math.max(0, orders - matIssued - poQty - (item.closingStock || 0));
    return { itemId: item.id, itemName: item.name, unit: item.unit, closingStock: item.closingStock || 0, orders, matIssued, poQty, reqQty };
  });
}

// The "Create Purchase Request" button on Job Material Requirement — takes
// the checked shortfall rows and raises one Inventory-type PR covering all
// of them, same chain as any other PR (Purchases module Requests tab).
function createPurchaseRequestFromShortfall(itemIds, raisedBy, department = "carp", division = null) {
  const rows = getJobMaterialRequirement().filter(r => itemIds.includes(r.itemId) && r.reqQty > 0);
  if (!rows.length) return { error: "No shortfall items selected." };
  const items = rows.map(r => ({ name: r.itemName, qty: r.reqQty, unit: r.unit, itemId: r.itemId }));
  return raisePurchaseRequest({ department, raisedBy, destinationType: "inventory", items, division });
}

// ── PURCHASER DASHBOARD KPIs ──
// Segregated by division: Curtain reads from purchaseInquiries[] (its own
// unchanged tracker); Upholstery, Joinery (carp+paint combined), and Metal
// Works read from the new purchaseRequests/purchaseOrders chain above.
function getPurchasingKPIs() {
  const openPRs = purchaseRequests.filter(pr => pr.status === "open");
  const pendingApprovals = getPendingPOApprovals();
  const awaitingDelivery = purchaseOrders.filter(po => po.status === "issued");
  const openCurtainInquiries = purchaseInquiries.filter(pi => !piIsDone(pi));

  // Reads po.department directly (stamped on every PO whether converted
  // from a PR or created directly) rather than looking up sourcePR — a
  // direct PO has no PR to look up, so the old sourcePR-lookup version
  // silently dropped direct POs from every division bucket.
  function bucket(deptKeys) {
    return {
      openRequests: purchaseRequests.filter(pr => deptKeys.includes(pr.department) && pr.status === "open").length,
      pendingApprovals: purchaseOrders.filter(po => deptKeys.includes(po.department) && po.approvalStatus === "pending").length,
      awaitingDelivery: purchaseOrders.filter(po => deptKeys.includes(po.department) && po.status === "issued").length
    };
  }

  return {
    totals: {
      openRequests: openPRs.length,
      pendingPOApprovals: pendingApprovals.length,
      pendingInvoiceApprovals: getPendingInvoiceApprovals().length,
      awaitingDelivery: awaitingDelivery.length,
      curtainOpenInquiries: openCurtainInquiries.length
    },
    byDivision: {
      curtain: {
        openInquiries: openCurtainInquiries.length,
        awaitingVendor: purchaseInquiries.filter(pi => pi.source === "vendor" && !piIsDone(pi)).length
      },
      upholstery: bucket(["uph"]),
      joinery: bucket(["carp", "paint"]),
      metal: bucket(["metal"])
    }
  };
}


// ═══════════════════════════════════════
// EMPLOYEE RATES — fully-loaded labour cost per hour (BD), by full name.
// Built 6 Jul 2026 from real May/June 2026 payroll files (Admin +
// Production), covering basic salary + allowances + employer-side extras:
// GOSI (3% expat employer), EOSB/indemnity (4.2% employer monthly SIO
// contribution, ≤3yr tenure tier — no per-person hire dates available yet,
// so every entry defaults to the lower tier; bump individually to 8.4%
// once tenure is confirmed), LMRA work permit + health card (amortized
// over a 2-year permit), a flat BD 150 2-way home ticket (amortized over
// 2 years), and a 30-day/year paid annual leave accrual. Standard hours
// assumed at 240/month (30 days x 8h), matching AMD's own timesheet
// convention. Full source workbook: AMD_Labour_Cost_Per_Hour.xlsx.
//
// Full-name keyed (not first-name) to avoid collisions — several people
// share a first name / role name across departments. curtain.js's
// existing first-name rosters (STITCH_TEAM/TRACK_TEAM/INSTALL_CREW) and
// timeLogs[] stay on first names for the UI; CURTAIN_NAME_MAP in
// curtain.js bridges the 7 Curtain-side first names to their full-name
// key here for the cost lookup only.
//
// 'Shameer Shah' appeared in both payroll files with two different
// basic figures (admin batch vs production batch) — Salman confirmed
// it is one person and to use the admin-file figure; department is
// still tagged Carpentry (their real production role) below.
//
// TODO: replace the default EOSB tier with per-person actual tenure once
// hire dates are confirmed — several entries (Owner, Directors) likely
// already exceed 3 years and should be on the 8.4% tier.
// ═══════════════════════════════════════
const EMPLOYEE_RATES = {
  'Abdul Raheem Mohammed': { rate: 1.352, department: 'Admin/Office', category: 'Admin' },
  'Abdul Rehman Aslam Qureshi': { rate: 3.366, department: 'Admin/Office', category: 'Admin' },
  'Abdullah Abdul Haq': { rate: 10.957, department: 'Admin/Office', category: 'Admin' },
  'Altaf Hasan Ali Ghare': { rate: 2.26, department: 'Admin/Office', category: 'Admin' },
  'Arbaz Iqbal Malim': { rate: 0.787, department: 'Admin/Office', category: 'Admin' },
  'Arun Kumar A': { rate: 1.538, department: 'Admin/Office', category: 'Admin' },
  'Aslam Abdul Rehman Qureshi': { rate: 10.957, department: 'Admin/Office', category: 'Admin' },
  'Aysha Aslam Qureshi': { rate: 2.292, department: 'Admin/Office', category: 'Admin' },
  'Jinesh Valiyavalappil Jayarajan': { rate: 2.26, department: 'Admin/Office', category: 'Admin' },
  'Karthikeyan Selvaraj': { rate: 1.331, department: 'Admin/Office', category: 'Admin' },
  'Latif Ullah': { rate: 1.57, department: 'Admin/Office', category: 'Admin' },
  'Rajneesh Vailezhath': { rate: 1.954, department: 'Admin/Office', category: 'Admin' },
  'Salman Abdullah': { rate: 7.023, department: 'Admin/Office', category: 'Admin' },
  'Sampath Suresh Kumar': { rate: 1.811, department: 'Admin/Office', category: 'Admin' },
  'Sharad Kumar Viswakarma': { rate: 4.153, department: 'Admin/Office', category: 'Admin' },
  'Shuhaib Mundel Kattil': { rate: 0.896, department: 'Admin/Office', category: 'Admin' },
  'Sidharth Sathyan': { rate: 0.992, department: 'Admin/Office', category: 'Admin' },
  'Sujith Kumar Angadipurath': { rate: 2.452, department: 'Admin/Office', category: 'Admin' },
  'Venkateswara Rao Neredimilli': { rate: 0.655, department: 'Admin/Office', category: 'Admin' },
  'Zahra Abdullah': { rate: 3.783, department: 'Admin/Office', category: 'Admin' },
  'Ajay Paswan': { rate: 1.209, department: 'Carpentry', category: 'Production' },
  'Amith Sharma': { rate: 0.848, department: 'Carpentry', category: 'Production' },
  'Balwinder Signh': { rate: 0.89, department: 'Carpentry', category: 'Production' },
  'Brijanandan': { rate: 0.841, department: 'Carpentry', category: 'Production' },
  'Elakkiyaselvan Maharajan': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Govind Kharwar': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Gufran Ahmed': { rate: 1.538, department: 'Carpentry', category: 'Production' },
  'Jai Prakash': { rate: 0.89, department: 'Carpentry', category: 'Production' },
  'Jithendra': { rate: 0.752, department: 'Carpentry', category: 'Production' },
  'Mahendra Sahani': { rate: 0.896, department: 'Carpentry', category: 'Production' },
  'Manoj Sharma': { rate: 0.793, department: 'Carpentry', category: 'Production' },
  'Mohammed Khalid': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Mohammed Raza': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Raheed Mohammed': { rate: 1.137, department: 'Carpentry', category: 'Production' },
  'Raj Kumar': { rate: 0.992, department: 'Carpentry', category: 'Production' },
  'Ravindar Gadde': { rate: 0.931, department: 'Carpentry', category: 'Production' },
  'Sainath Vangala': { rate: 0.852, department: 'Carpentry', category: 'Production' },
  'Sameer Pasha': { rate: 0.835, department: 'Carpentry', category: 'Production' },
  'Shameer Shah': { rate: 0.896, department: 'Carpentry', category: 'Production' },
  'Subhan': { rate: 0.992, department: 'Carpentry', category: 'Production' },
  'Suneel Kumar': { rate: 0.896, department: 'Carpentry', category: 'Production' },
  'Upendra Paswan': { rate: 0.655, department: 'Carpentry', category: 'Production' },
  'Vijay Kumar': { rate: 0.697, department: 'Carpentry', category: 'Production' },
  'Vinod Sharma': { rate: 0.938, department: 'Carpentry', category: 'Production' },
  'Ibrahim Khurshid': { rate: 0.704, department: 'Curtain & Blinds', category: 'Production' },
  'Md Alenabi': { rate: 0.607, department: 'Curtain & Blinds', category: 'Production' },
  'Mhd Sahil': { rate: 0.607, department: 'Curtain & Blinds', category: 'Production' },
  'Mohammad Abdullah': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Mohammed Waseem Rahmani': { rate: 0.776, department: 'Curtain & Blinds', category: 'Production' },
  'Mohd. Javed': { rate: 0.992, department: 'Curtain & Blinds', category: 'Production' },
  'Muhammad Aslam': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Muhammad Furqan': { rate: 0.829, department: 'Curtain & Blinds', category: 'Production' },
  'Murugaiya Pillai Selvaraj': { rate: 1.329, department: 'Curtain & Blinds', category: 'Production' },
  'Mushraf Hussain': { rate: 0.824, department: 'Curtain & Blinds', category: 'Production' },
  'Rijwan Alam': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Saeed Ahmad': { rate: 1.028, department: 'Curtain & Blinds', category: 'Production' },
  'Shahzad Farooq': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Sohail Qureshi': { rate: 0.92, department: 'Curtain & Blinds', category: 'Production' },
  'Subutktgin (SHIBU)': { rate: 1.028, department: 'Curtain & Blinds', category: 'Production' },
  'Amran Mia Md Rahis Mia': { rate: 0.992, department: 'Upholstery', category: 'Production' },
  'Ifran Hussain': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Jamaluddin': { rate: 0.8, department: 'Upholstery', category: 'Production' },
  'Mohammad Naeem': { rate: 0.8, department: 'Upholstery', category: 'Production' },
  'Mohammed Rubel Miah': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Muhammad Jamshed': { rate: 0.8, department: 'Upholstery', category: 'Production' },
  'Prince Kaler': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Rajendra Kumar': { rate: 0.655, department: 'Upholstery', category: 'Production' },
  'Shamim Ansari': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Soheb Ahmed': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Ammar Bahadur': { rate: 0.704, department: 'Watchman', category: 'Production' },
};

// ═══════════════════════════════════════
// SALES MODULE DATA — Enquiry → Quotation
// Rebuilt 25 Jul 2026 from a live reverse-engineered Q-Pro reference
// (qpro.almarayadecor.com) supplied by Salman, replacing an earlier
// version of this module that was designed from a handoff brief but never
// actually landed in this repo (lost between sessions).
//
// GLOBAL WORKFLOW RULE (confirmed against live Q-Pro, not guessed):
// Quotations can ONLY be created by converting an existing Enquiry, and
// only once that Enquiry is linked to a real Customer record — never
// standalone, never from a bare prospect. Q-Pro's own error for the
// prospect-only case is "Please Select Customer To Proceed!!!" — reused
// verbatim in canConvertToQuotation()/convertEnquiryToQuotation() below.
//
// Estimator and Approver (the next two stages after Quotation) have not
// been mapped yet — do not build UI for them. quotation.stage tracks
// which of the three roles currently owns a quotation (sales/estimator/
// approver) so that hand-off is modeled even though only the Sales side
// has a real screen right now.
// ═══════════════════════════════════════

const ENQUIRY_SOURCES = ["Architect/Interior Designer", "Email", "Existing client", "Q-pro/Old quotes", "Referrals", "Social Media", "walk inn"];
const MEETING_TYPES = ["Telephone Call", "Whatsapp Chat", "Meeting at Client Office", "Meeting at Al Maraya Showroom", "Site Visit"];
const FOLLOWUP_OUTCOMES = ["On call/whatsapp", "Required design/proposal", "Client not attended", "On site measurements"];
// Divisions this Enquiry form offers — only "furniture" has been seen in the live
// Q-Pro URL path (furniture/Enquiry/createenquiry); the rest mirror AMD's own
// production divisions (DEPTS above) until Q-Pro's full division list is captured.
const SALES_DIVISIONS = ["Curtain & Blinds", "Furniture", "Joinery", "Upholstery", "Metal Works"];
const QUOTE_UNITS = ["Nos", "Meters", "Sqmtr", "CFT", "CBM", "Box", "Btl", "Ctn", "Yard", "Lot", "Window", "Room"];
// Common subset, NOT the full ISO-3166 list Q-Pro's Add Customer dropdown actually has —
// good enough until that full list is captured.
const COUNTRIES = ["Bahrain", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Qatar", "Oman", "India", "Pakistan", "Bangladesh", "Philippines", "Sri Lanka", "Nepal", "Egypt", "Jordan", "Lebanon", "United Kingdom", "United States", "Other"];
const COVERING_LETTER_TEMPLATES = { "Al Maraya decor.": (project) => `Sub: ${project}\n\nDear Sir/Madam,\n\nThank you for the opportunity to quote for the above-mentioned project. Please find our detailed quotation enclosed.\n\nWe look forward to being of service.\n\nRegards,\nAl Maraya Decor` };
const TERMS_TEMPLATES = { "Al Maraya Decor Standard.": `1. This quotation is valid for 30 days from the date of issue.\n2. 50% advance payment required to confirm the order, balance on completion.\n3. Delivery/installation timeline to be confirmed upon order confirmation.\n4. Prices are subject to change if scope of work changes.\n5. Any additional work outside this quotation will be charged separately.` };

// ── CUSTOMERS ──
// Customer Code format matches the live reference (C1508) — sequential from
// an arbitrary Q-Pro-observed starting point, not a business-meaningful number.
const customers = [
  {
    id: "C1508", name: "ZZTEST", contactPerson: "Test Contact", tel: "00099911", tel2: "", email: "", fax: "",
    vatName: "", vatNo: "", taxPercent: 10, isCredit: false, creditLimit: 0, creditDays: 0,
    bankAccountNumber: "", bankAccountHolderName: "", ibanNumber: "", bankSwift: "", bankName: "", bankBranch: "",
    address: "Test Address, Manama", crNo: "", country: "Bahrain", openingBalance: 0, salesMan: "Salman Abdullah",
    status: "approved", approvedBy: "Salman Abdullah", approvalDate: "2026-07-24", rejectionComment: null
  }
];
function nextCustomerCode() { return "C" + (1508 + customers.length); }
function customerTelExists(tel, excludeId = null) {
  return customers.some(c => c.id !== excludeId && c.tel === tel);
}
// Mirrors the live Add Customer form field-for-field. Telephone uniqueness is
// enforced here (confirmed live Q-Pro validation), matching the "*" required
// fields: Name, Contact Person, Telephone, Address.
//
// ASSUMPTION (not yet confirmed against live Q-Pro — flagged for Salman to
// correct): new customers start "pending" so they show up on the Approver's
// "New Customers" KPI, but are NOT blocked from use in the meantime — Sales
// can still pick a pending customer on an Enquiry right away. Approval here
// is presented as after-the-fact governance (catching duplicates/bad data),
// not a hard gate that would slow Sales down. If Q-Pro actually blocks a
// pending customer from being used until approved, this needs to change.
function createCustomer({ name, contactPerson, tel, tel2 = "", email = "", fax = "", vatName = "", vatNo = "", taxPercent = 0, isCredit = false, creditLimit = 0, creditDays = 0, bankAccountNumber = "", bankAccountHolderName = "", ibanNumber = "", bankSwift = "", bankName = "", bankBranch = "", address, crNo = "", country = "Bahrain", openingBalance = 0, salesMan }) {
  if (!name || !contactPerson || !tel || !address) return { error: "Name, Contact Person, Telephone and Address are required." };
  if (customerTelExists(tel)) return { error: "Telephone must be unique across all customers." };
  const c = { id: nextCustomerCode(), name, contactPerson, tel, tel2, email, fax, vatName, vatNo, taxPercent, isCredit, creditLimit, creditDays, bankAccountNumber, bankAccountHolderName, ibanNumber, bankSwift, bankName, bankBranch, address, crNo, country, openingBalance, salesMan, status: "pending", approvedBy: null, approvalDate: null, rejectionComment: null };
  customers.push(c);
  return c;
}
function approveCustomer(customerId, approvedBy) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return { error: "Customer not found." };
  c.status = "approved";
  c.approvedBy = approvedBy;
  c.approvalDate = new Date().toISOString().slice(0, 10);
  c.rejectionComment = null;
  return c;
}
function rejectCustomer(customerId, rejectedBy, comment) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return { error: "Customer not found." };
  if (!comment || !comment.trim()) return { error: "A rejection comment is required." };
  c.status = "rejected";
  c.approvedBy = rejectedBy;
  c.approvalDate = new Date().toISOString().slice(0, 10);
  c.rejectionComment = comment.trim();
  return c;
}

// ── ENQUIRIES ──
// Enq No format matches the live reference (ENQ04061AMD).
function nextEnquiryNo() { return "ENQ" + String(4061 + enquiries.length).padStart(5, "0") + "AMD"; }
// "Basic" tab (all fields below except followUps) is editable only by the
// assigned salesPerson in the live system — other roles see it locked with a
// banner. Enforced in the UI layer (sales.js), not here.
function createEnquiry({ division, customerId = null, prospectName = "", contactPerson, tel, email = "", requirements = "", source, salesPerson, dateCreated }) {
  if (!customerId && !prospectName) return { error: "Select a Customer or enter a New Prospect Name." };
  const e = {
    id: nextEnquiryNo(), division, customerId, prospectName: customerId ? "" : prospectName,
    contactPerson, tel, email, requirements, source, salesPerson,
    dateCreated: dateCreated || new Date().toISOString().slice(0, 10),
    followUps: [], linkedQuotationId: null
  };
  enquiries.push(e);
  return e;
}
// Notes must be at least 10 characters (live Q-Pro form validation).
function addFollowUp(enquiryId, { date, meetingType, outcome, notes }) {
  const e = enquiries.find(x => x.id === enquiryId);
  if (!e) return { error: "Enquiry not found." };
  if (!notes || notes.trim().length < 10) return { error: "Notes must be at least 10 characters." };
  e.followUps.push({ date: date || new Date().toISOString().slice(0, 10), meetingType, outcome, notes: notes.trim() });
  return e;
}
// "Cancel" on the live Enquiry List is a real permanent delete, not a status
// change — reproduced faithfully here rather than softened into a status flag.
function cancelEnquiry(enquiryId) {
  const idx = enquiries.findIndex(e => e.id === enquiryId);
  if (idx === -1) return { error: "Enquiry not found." };
  enquiries.splice(idx, 1);
  return { ok: true };
}
// Only available once the Enquiry is linked to a real Customer — reproduces
// the live "Please Select Customer To Proceed!!!" error for prospect-only enquiries.
function canConvertToQuotation(enquiry) { return !!(enquiry && enquiry.customerId); }

// ── QUOTATIONS ──
// Qtn No format matches the live reference (AMD-15350-0) — "-0" is revision 0.
const quotations = [];
function nextQtnNo() { return "AMD-" + (15350 + quotations.length) + "-0"; }
function computeQuotationTotals(qtn) {
  let itemTotal = 0, discTotal = 0, vatTotal = 0, netTotal = 0;
  qtn.items.forEach(it => {
    itemTotal += it.amount || 0;
    discTotal += it.discAmt || 0;
    vatTotal += ((it.amount || 0) - (it.discAmt || 0)) * (it.vatPercent || 0) / 100;
    netTotal += it.netAmount || 0;
  });
  return { itemTotal, discTotal, vatTotal, netTotal };
}
// Step 1 of the 3-step wizard. Refuses conversion from a prospect-only
// Enquiry — see canConvertToQuotation() above.
function convertEnquiryToQuotation(enquiryId, { projectName, taxPercent, contactPerson, withEstimation, notes = "" }) {
  const enq = enquiries.find(e => e.id === enquiryId);
  if (!enq) return { error: "Enquiry not found." };
  if (!canConvertToQuotation(enq)) return { error: "Please Select Customer To Proceed!!!" };
  const qtn = {
    id: nextQtnNo(), rev: 0, enquiryId, customerId: enq.customerId,
    projectName, taxPercent, contactPerson, withEstimation: !!withEstimation, notes,
    items: [], coveringLetterTemplate: null, coveringLetterBody: "", termsTemplate: null, termsBody: "",
    lifecycleStatus: "draft", stage: "sales",
    estimatorPickedBy: null, approverPickedBy: null,
    headerComment: "", auditLog: [],
    date: new Date().toISOString().slice(0, 10), confirmDate: null
  };
  quotations.push(qtn);
  enq.linkedQuotationId = qtn.id;
  logQuotationAudit(qtn, { action: "Create", user: enq.salesPerson, userType: "SALES", status: "Draft" });
  return qtn;
}
function nextQuotationItemId(qtn) { return qtn.items.length + 1; }
function addQuotationItem(qtnId, item) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  const amount = (item.qty || 0) * (item.rate || 0);
  const discAmt = item.discAmt || (amount * (item.discPercent || 0) / 100);
  const netAmount = qtn.withEstimation ? 0 : (amount - discAmt) * (1 + (item.vatPercent || 0) / 100);
  const row = {
    lineId: nextQuotationItemId(qtn), group: item.group || "", subgroup: item.subgroup || "",
    product: item.product, qty: item.qty || 0, unit: item.unit || "Nos",
    rate: qtn.withEstimation ? 0 : (item.rate || 0), amount: qtn.withEstimation ? 0 : amount,
    vatPercent: item.vatPercent || 0, discPercent: item.discPercent || 0, discAmt: qtn.withEstimation ? 0 : discAmt,
    netAmount: qtn.withEstimation ? 0 : netAmount,
    description: item.description || "", internalComments: item.internalComments || "", optional: !!item.optional,
    approverComment: "", // Approver's per-line comment — see setLineApproverComment() below
    bom: null // set by ensureItemBOM() once the Estimator adds a BOM — see ESTIMATOR section below
  };
  qtn.items.push(row);
  return row;
}
function removeQuotationItem(qtnId, lineId) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  qtn.items = qtn.items.filter(it => it.lineId !== lineId);
  return { ok: true };
}
// Step 3 of the wizard — "Update Quotation" on the live system. Stays
// lifecycleStatus "draft" — the live reference trace shows Draft persists
// through the ENTIRE Sales/Estimator/Approver loop, only flipping to "Open"
// when Approver clicks Approve Quote (see approveQuotation() below).
function finaliseQuotation(qtnId, { coveringLetterTemplate, termsTemplate }) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (coveringLetterTemplate && COVERING_LETTER_TEMPLATES[coveringLetterTemplate]) {
    qtn.coveringLetterTemplate = coveringLetterTemplate;
    qtn.coveringLetterBody = COVERING_LETTER_TEMPLATES[coveringLetterTemplate](qtn.projectName);
  }
  if (termsTemplate && TERMS_TEMPLATES[termsTemplate]) {
    qtn.termsTemplate = termsTemplate;
    qtn.termsBody = TERMS_TEMPLATES[termsTemplate];
  }
  qtn.stage = qtn.withEstimation ? "estimator" : "sales";
  return qtn;
}
// A hand-off never clears estimatorPickedBy/approverPickedBy — those persist
// for the life of the quotation once set, so returning to a role someone
// already picked (e.g. "Back to Estimator") lands straight in their queue
// instead of back in "Pending to Pick". Logged as "Transfer" regardless of
// which UI action triggered it (Back to Sales, Back to Estimator, Transfer
// to Estimator/Approver) — matches the live audit trail, which uses one
// generic action name for every stage move.
function transferQuotationStage(qtnId, newStage, actorName) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  qtn.stage = newStage;
  logQuotationAudit(qtn, { action: "Transfer", user: actorName, userType: newStage.toUpperCase() });
  return qtn;
}

// ═══════════════════════════════════════
// MODULE 3 — ESTIMATOR
// Rebuilt 25 Jul 2026 from the same live Q-Pro reverse-engineering pass as
// Enquiry/Quotation above. Covers: the Estimator dashboard (Pending to Pick /
// My Actions / With Approver / Confirmed / PR), picking a quotation, and the
// per-item Job Estimation BOM entry (Materials / Labour / Sub Contract /
// Hiring / Others / Summary) with the cost-plus pricing waterfall that
// writes the calculated Selling Price back onto the quotation item.
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// INVENTORY MASTERS (Masters → Inventory → ..., Batch 2 reverse-engineering)
// Unit / Stock Category / Catelog are simple flat lists. Masters → Inventory
// → Vendor (internal route "Group"/"Stock Group") is the vestigial
// duplicate already confirmed in Batch 1 (Purchases) as unused by any real
// transaction — not replicated here, same call as before.
// ═══════════════════════════════════════
const units = ["Box", "Btl", "CBM", "CFT", "Ctn", "Drm", "Gal", "Kg", "LM", "Ltr", "Meters", "Nos", "Pairs", "Pkt", "Roll", "Sets", "Sheet", "Sqmtr", "Yard"]
  .map(name => ({ name, status: "Enabled" }));

const stockCategories = [
  "Balance Fabrics (Curtain/Upholstery)", "Chemical Items", "Disposable Items", "Workshop Tools & Accessories",
  "Others", "Joinery Consumables", "Packaging Materials", "Printing & Stationary", "Non Stock Fabrics",
  "Carpets & Floorings", "Roller Blind & Accessories", "Curtain Tracks & Accessories", "Sample Books",
  "Stock Furniture", "Upholstery Consumables"
].map(name => ({ name }));

function addUnit(name) {
  if (!name || !name.trim()) return { error: "Name is required." };
  const u = { name: name.trim(), status: "Enabled" };
  units.push(u);
  return u;
}
function addStockCategory(name) {
  if (!name || !name.trim()) return { error: "Name is required." };
  const c = { name: name.trim() };
  stockCategories.push(c);
  return c;
}

// Catelog ("Brand") — a product line/collection tagged to a specific
// supplier, e.g. a manufacturer's fabric collection. Empty seed; grows as
// items get catalogued through the Inventory module.
const catelogs = [];
function nextCatelogId() { return "CAT-" + String(catelogs.length + 1).padStart(3, "0"); }
function createCatelog({ name, vendorId = null } = {}) {
  if (!name || !name.trim()) return { error: "Name is required." };
  const cat = { id: nextCatelogId(), name: name.trim(), vendorId };
  catelogs.push(cat);
  return cat;
}

// ── ITEM MASTER (Masters → Inventory → Item) ──
// The real item catalogue, superseding the small placeholder seed that used
// to stand in for it (Estimator's BOM Materials-tab typeahead now reads
// from this real master via searchItemMaster()/ITEM_MASTER below).
const itemMaster = [];
function nextItemStockCode() {
  return "IT" + String(3500 + itemMaster.length).padStart(6, "0");
}
function createItemMasterEntry({
  stockCategory, vendorId = null, catelogId = null, vatPercent = 10, name,
  rollWidth = null, packing = "", unit, cost = 0, sellingPrice = 0, reorderLevel = 0,
  description = "", purchaseAllowed = true, salesAllowed = true, rawMaterial = false,
  openingStock = 0
} = {}) {
  if (!stockCategory) return { error: "Stock Category is required." };
  if (!name || !name.trim()) return { error: "Stock Name is required." };
  if (!unit) return { error: "Units is required." };
  const item = {
    id: nextItemStockCode(), stockCategory, vendorId, catelogId, vatPercent: Number(vatPercent) || 0,
    name: name.trim(), rollWidth: rollWidth ? Number(rollWidth) : null, packing, unit,
    cost: Number(cost) || 0, avgCost: Number(cost) || 0, sellingPrice: Number(sellingPrice) || 0,
    reorderLevel: Number(reorderLevel) || 0, description,
    purchaseAllowed: !!purchaseAllowed, salesAllowed: !!salesAllowed, rawMaterial: !!rawMaterial,
    openingStock: Number(openingStock) || 0, closingStock: Number(openingStock) || 0, lastPurchaseRate: 0
  };
  itemMaster.push(item);
  return item;
}
function updateItemMasterEntry(itemId, patch) {
  const it = itemMaster.find(i => i.id === itemId);
  if (!it) return null;
  Object.assign(it, patch);
  return it;
}

// Small starter catalogue — same items the old placeholder seed carried —
// so the Estimator typeahead and the Reports below have something to work
// with immediately.
[
  { name: "Aluminium U-Shape Head Rail — Ningbo CH016", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 4.2, openingStock: 120 },
  { name: "Cord Rail — Heavy Duty White (COR001)", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 3.6, openingStock: 85 },
  { name: "Somfy Glydea Track — raw rail", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 28.5, openingStock: 14 },
  { name: "Unisoiel Cord Track — DC01 Heavy", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 5.1, openingStock: 60 },
  { name: "Roman Blind Headrail — Unisoiel RAE01", stockCategory: "Roller Blind & Accessories", unit: "Nos", cost: 6.8, openingStock: 22 },
  { name: "Test Curtain Fabric - Mapping Exercise", stockCategory: "Non Stock Fabrics", unit: "Meters", cost: 2.0, openingStock: 500 }
].forEach(seed => createItemMasterEntry(seed));

// Estimator's Materials tab was built against a flat `ITEM_MASTER` array
// with `.name`/`.cost`/`.unit` fields — kept as a live alias (not a copy) so
// it automatically reflects every item created through the real Inventory
// module from here on.
const ITEM_MASTER = itemMaster;

function searchItemMaster(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return itemMaster;
  return itemMaster.filter(it => it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q));
}
// Emp Category list — not captured from Q-Pro's own dropdown yet, seeded from
// common production role tiers used elsewhere in this app (EMPLOYEE_RATES 'category').
const EMP_CATEGORIES = ["Skilled", "Semi-Skilled", "Helper", "Supervisor"];

// Generalized so both Estimator and Approver can pick off their own stage's
// queue — a quotation is only "pending to pick" while sitting in the stage
// the picker owns. estimatorPickedBy/approverPickedBy are separate fields
// (not one shared pickedBy) because the live audit trail shows each role's
// pick is independent and persists even after the quote moves to another
// stage and comes back.
function pickQuotation(qtnId, personName, expectedStage) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (qtn.stage !== expectedStage) return { error: `This quotation is not in the ${expectedStage[0].toUpperCase()}${expectedStage.slice(1)} stage.` };
  const field = expectedStage === "approver" ? "approverPickedBy" : "estimatorPickedBy";
  if (qtn[field]) return { error: "This quotation has already been picked." };
  qtn[field] = personName;
  logQuotationAudit(qtn, { action: "Pick", user: personName, userType: expectedStage.toUpperCase() });
  return qtn;
}

function findQuotationItem(qtnId, lineId) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return null;
  return qtn.items.find(it => it.lineId === lineId) || null;
}

// Creates the BOM container the first time "+ Add BOM" is used on an item.
// Overhead defaults match the live-observed percentages (Material/Labour/
// Subcontract 5%, Hiring/Others 0%, Profit 30%).
function ensureItemBOM(item) {
  if (!item.bom) {
    item.bom = {
      materials: [], labour: [], subcontract: [], hiring: [], others: [],
      ohPercents: { material: 5, labour: 5, subcontract: 5, hiring: 0, others: 0 },
      profitPercent: 30, sellingPriceOverride: null, submitted: false
    };
  }
  return item.bom;
}
function addBOMMaterial(qtnId, lineId, { name, description = "", qty, unit, rate }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  const amount = (qty || 0) * (rate || 0);
  // If the name exactly matches a real Item Master entry (as it will when
  // picked from the Materials-tab typeahead, which is sourced from
  // itemMaster), tag the BOM line with itemId — this is what lets Job
  // Material Requirement (Inventory report) see real demand for the item.
  const master = itemMaster.find(it => it.name === name);
  bom.materials.push({ id: bom.materials.length + 1, itemId: master ? master.id : null, name, description, qty: qty || 0, unit, rate: rate || 0, amount });
  return bom;
}
function addBOMLabour(qtnId, lineId, { department, empCategory, noOfPpl, hrs, rate }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  const manHrs = (noOfPpl || 0) * (hrs || 0);
  const amount = manHrs * (rate || 0);
  bom.labour.push({ id: bom.labour.length + 1, department, empCategory, noOfPpl: noOfPpl || 0, hrs: hrs || 0, manHrs, rate: rate || 0, amount });
  return bom;
}
function addBOMSubcontract(qtnId, lineId, { vendor, workType, amount }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  bom.subcontract.push({ id: bom.subcontract.length + 1, vendor, workType, amount: amount || 0 });
  return bom;
}
function addBOMHiring(qtnId, lineId, { vendor, workType, amount }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  bom.hiring.push({ id: bom.hiring.length + 1, vendor, workType, amount: amount || 0 });
  return bom;
}
function addBOMOther(qtnId, lineId, { party, details, amount }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  bom.others.push({ id: bom.others.length + 1, party, details, amount: amount || 0 });
  return bom;
}
function removeBOMEntry(qtnId, lineId, category, entryId) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom[category] = item.bom[category].filter(r => r.id !== entryId);
  return item.bom;
}
function setBOMOHPercent(qtnId, lineId, category, val) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom.ohPercents[category] = val;
  return item.bom;
}
function setBOMProfitPercent(qtnId, lineId, val) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom.profitPercent = val;
  return item.bom;
}
function setBOMSellingOverride(qtnId, lineId, val) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom.sellingPriceOverride = (val === null || val === "") ? null : Number(val);
  return item.bom;
}

// Cost-plus waterfall — Total Cost -> per-category overhead -> Total Cost
// Incl. Overhead -> Profit % -> Selling Price. Verified against the live
// reference calc: 5 Meters x 2.000 material = 10.000 -> +5% Material OH =
// 10.500 -> +30% profit (3.150) = Selling Price 13.650.
function computeBOMTotals(bom) {
  const sum = arr => arr.reduce((s, r) => s + (r.amount || 0), 0);
  const materialCost = sum(bom.materials), labourCost = sum(bom.labour),
        subcontractCost = sum(bom.subcontract), hiringCost = sum(bom.hiring), othersCost = sum(bom.others);
  const totalCost = materialCost + labourCost + subcontractCost + hiringCost + othersCost;
  const oh = bom.ohPercents;
  const ohAmounts = {
    material: materialCost * oh.material / 100,
    labour: labourCost * oh.labour / 100,
    subcontract: subcontractCost * oh.subcontract / 100,
    hiring: hiringCost * oh.hiring / 100,
    others: othersCost * oh.others / 100
  };
  const totalCostInclOH = totalCost + ohAmounts.material + ohAmounts.labour + ohAmounts.subcontract + ohAmounts.hiring + ohAmounts.others;
  const profitAmount = totalCostInclOH * bom.profitPercent / 100;
  const calculatedSellingPrice = totalCostInclOH + profitAmount;
  return { materialCost, labourCost, subcontractCost, hiringCost, othersCost, totalCost, ohAmounts, totalCostInclOH, profitAmount, calculatedSellingPrice };
}

// "Submit" on the Summary tab — saves the BOM and writes the Selling Price
// (override if set, else the calculated figure) back onto the quotation
// item's Rate, recomputing Amount/Net Amount with VAT applied on top, same
// as the live-verified example (13.650 x 1.10 VAT = 15.015).
function submitItemBOM(qtnId, lineId) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  const totals = computeBOMTotals(item.bom);
  const sellingPrice = item.bom.sellingPriceOverride !== null ? item.bom.sellingPriceOverride : totals.calculatedSellingPrice;
  item.rate = sellingPrice;
  item.amount = item.qty * item.rate;
  item.discAmt = item.amount * (item.discPercent || 0) / 100;
  item.netAmount = (item.amount - item.discAmt) * (1 + (item.vatPercent || 0) / 100);
  item.bom.submitted = true;
  item.bom.qtyAtSubmit = item.qty; // lets the Estimation index flag "Copy BOM" if Sales changes Qty after this
  return { item, totals };
}
function clearItemBOM(qtnId, lineId) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  item.bom = null;
  item.rate = 0; item.amount = 0; item.discAmt = 0; item.netAmount = 0;
  return { ok: true };
}

// Estimator dashboard KPIs. PR Pending/Not Received is an approximation off
// the existing Purchasing chain (open PRs / issued-but-not-yet-invoiced POs)
// — Estimator's own PR view in Q-Pro hasn't been mapped in detail yet.
function getEstimatorKPIs(estimatorName) {
  const estQuotes = quotations.filter(q => q.stage === "estimator");
  const pendingToPickList = estQuotes.filter(q => !q.estimatorPickedBy);
  const myActionsList = estQuotes.filter(q => q.estimatorPickedBy === estimatorName);
  const withApprover = quotations.filter(q => q.stage === "approver").length;
  const confirmed = quotations.filter(q => q.lifecycleStatus === "confirmed").length;
  const prPending = purchaseRequests.filter(pr => pr.status === "open").length;
  const prNotReceived = purchaseOrders.filter(po => po.status === "issued").length;

  // Furniture/Joinery/Metal Works roll up into "Joinery", mirroring the same
  // rollup Purchasing already uses for its own category breakdown.
  function divisionCategory(div) {
    if (div === "Curtain & Blinds") return "curtain";
    if (div === "Upholstery") return "upholstery";
    return "joinery";
  }
  const categoryBreakdown = { curtain: 0, upholstery: 0, joinery: 0 };
  estQuotes.forEach(q => {
    const enq = enquiries.find(e => e.id === q.enquiryId);
    categoryBreakdown[divisionCategory(enq ? enq.division : "")]++;
  });

  return {
    pendingToPick: pendingToPickList.length, pendingToPickList,
    myActions: myActionsList.length, myActionsList,
    withApprover, confirmed, prPending, prNotReceived, categoryBreakdown
  };
}

// ═══════════════════════════════════════
// MODULE 4 — APPROVER
// Rebuilt 25 Jul 2026 from Salman's full live trace of the Sales ⇄
// Estimator ⇄ Approver loop, including the audit trail and the two
// independent comment channels. Key corrections this made to the Quotation
// module built earlier:
//   - lifecycleStatus stays "draft" through the WHOLE Estimator/Approver
//     loop — it only flips to "open" when Approver clicks Approve Quote.
//     (finaliseQuotation() below was wrongly setting "open" immediately.)
//   - pickedBy is per-role, not a single shared field — an Estimator's pick
//     and an Approver's pick are independent and both persist forever once
//     set (so "Back to Estimator" / re-transferring to the same role never
//     needs a re-pick — it lands straight in that person's queue).
//   - Comments are NOT a reject-time gate. They're two independent,
//     always-editable channels: one header/common comment (Approver ->
//     visible to Sales & Estimator), and one per-line comment (Approver ->
//     visible to Estimator). Sales' existing per-line internalComments is
//     the third channel, surfaced back to Approver on review.
// ═══════════════════════════════════════

// Every status transition gets one row here — Sales/Estimator/Approver hub
// pages all render this same log at the bottom of the page.
function logQuotationAudit(qtn, { action, user, userType, status }) {
  if (!qtn.auditLog) qtn.auditLog = [];
  const displayStatus = status || (qtn.lifecycleStatus.charAt(0).toUpperCase() + qtn.lifecycleStatus.slice(1));
  qtn.auditLog.push({
    seq: qtn.auditLog.length + 1,
    action, user, date: new Date().toISOString().slice(0, 10),
    userType, status: displayStatus
  });
}

// Approve Quote — the only action that flips Draft -> Open. Sends the
// quotation back to Sales' queue; "Confirm Quote" (Open -> Confirmed, the
// bridge into Jobs/Invoicing) is explicitly out of scope for this rebuild.
function approveQuotation(qtnId, approvedBy) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  qtn.stage = "sales";
  qtn.lifecycleStatus = "open";
  logQuotationAudit(qtn, { action: "Transfer", user: approvedBy, userType: "SALES", status: "Open" });
  return qtn;
}

// Header/common comment — Approver-authored, one per quote, read-only to
// Sales/Estimator via their own "View Approver Comments" link.
function setQuotationHeaderComment(qtnId, text) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  qtn.headerComment = text;
  return qtn;
}
// Per-line comment — Approver-authored, surfaced to the Estimator via the
// eye icon on the Estimation index / Job Estimation header.
function setLineApproverComment(qtnId, lineId, text) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  item.approverComment = text;
  return item;
}

// Sales-side post-return editing — Qty/Description/Internal Comments only.
// Rate stays Estimator-controlled even here; Amount/Net Amount recompute
// live off the current Rate (0 if not yet estimated).
function updateQuotationItemFields(qtnId, lineId, { qty, description, internalComments }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  if (qty !== undefined) item.qty = qty;
  if (description !== undefined) item.description = description;
  if (internalComments !== undefined) item.internalComments = internalComments;
  item.amount = item.qty * item.rate;
  item.discAmt = item.amount * (item.discPercent || 0) / 100;
  item.netAmount = (item.amount - item.discAmt) * (1 + (item.vatPercent || 0) / 100);
  return item;
}

// Approver dashboard KPIs. "PO Approval" deliberately reuses the existing
// Purchasing approval queue (getPendingPOApprovals()) rather than
// duplicating that data model — Approver's tile is a rollup + shortcut into
// Purchasing, not a second PO approval flow.
function getApproverKPIs(approverName) {
  const apprQuotes = quotations.filter(q => q.stage === "approver");
  const pendingToPickList = apprQuotes.filter(q => !q.approverPickedBy);
  const forApprovalList = apprQuotes.filter(q => q.approverPickedBy === approverName);
  const poApproval = getPendingPOApprovals().length;
  const prPending = purchaseRequests.filter(pr => pr.status === "open").length;
  const prNotReceived = purchaseOrders.filter(po => po.status === "issued").length;
  const newCustomersList = customers.filter(c => c.status === "pending");

  function divisionCategory(div) {
    if (div === "Curtain & Blinds") return "curtain";
    if (div === "Upholstery") return "upholstery";
    return "joinery";
  }
  const categoryBreakdown = { curtain: 0, upholstery: 0, joinery: 0 };
  apprQuotes.forEach(q => {
    const enq = enquiries.find(e => e.id === q.enquiryId);
    categoryBreakdown[divisionCategory(enq ? enq.division : "")]++;
  });

  return {
    pendingToPick: pendingToPickList.length, pendingToPickList,
    forApproval: forApprovalList.length, forApprovalList,
    quotationsTotal: quotations.length,
    prPending, prNotReceived, poApproval,
    newCustomers: newCustomersList.length, newCustomersList,
    categoryBreakdown
  };
}

// ── LIVE REFERENCE FIXTURE ──
// Built for testing against the real Q-Pro flow (Salman, 25 Jul 2026) — safe
// to reuse as a Claude Code test fixture. ENQ04061AMD -> AMD-15350-0, sitting
// in the Estimator stage exactly as it does live (With Estimation checked,
// so the one line item's rate is locked at 0 pending the Estimator role).
const enquiries = [
  {
    id: "ENQ04061AMD", division: "Furniture", customerId: "C1508", prospectName: "",
    contactPerson: "Test Contact", tel: "00099911", email: "", requirements: "Reference enquiry for Claude Code mapping exercise.",
    source: "walk inn", salesPerson: "Salman Abdullah", dateCreated: "2026-07-24",
    followUps: [
      { date: "2026-07-24", meetingType: "Telephone Call", outcome: "Required design/proposal", notes: "Client requested a quotation for one reference curtain item to validate the Sales module mapping." }
    ],
    linkedQuotationId: "AMD-15350-0"
  }
];
quotations.push({
  id: "AMD-15350-0", rev: 0, enquiryId: "ENQ04061AMD", customerId: "C1508",
  projectName: "ZZTEST Reference Project - Claude Mapping", taxPercent: 10, contactPerson: "Test Contact",
  withEstimation: true, notes: "",
  items: [
    { lineId: 1, group: "", subgroup: "", product: "Test Curtain Fabric - Mapping Exercise", qty: 1, unit: "Meters", rate: 0, amount: 0, vatPercent: 10, discPercent: 0, discAmt: 0, netAmount: 0, description: "", internalComments: "", optional: false, approverComment: "", bom: null }
  ],
  coveringLetterTemplate: "Al Maraya decor.", coveringLetterBody: COVERING_LETTER_TEMPLATES["Al Maraya decor."]("ZZTEST Reference Project - Claude Mapping"),
  termsTemplate: "Al Maraya Decor Standard.", termsBody: TERMS_TEMPLATES["Al Maraya Decor Standard."],
  // Draft the whole way through the loop — only Approve Quote flips this to Open (see approveQuotation()).
  lifecycleStatus: "draft", stage: "estimator",
  estimatorPickedBy: null, approverPickedBy: null, headerComment: "",
  date: "2026-07-24", confirmDate: null,
  auditLog: [
    { seq: 1, action: "Create", user: "Salman Abdullah", date: "2026-07-24", userType: "SALES", status: "Draft" }
  ]
});

// ═══════════════════════════════════════
// MODULE 5 — JOB CARD (post-Approval production/commercial tracking)
// Rebuilt 25 Jul 2026 from Salman's live Q-Pro trace (read-only exploration,
// no real production data touched). A Job Card is created from a Quotation
// once Sales clicks "Confirm Quote" (Open -> Confirmed) — the bridge this
// app's Approver module deliberately left unbuilt until now.
//
// DELIBERATELY KEPT SEPARATE from curtainJobs[]/projects[] — the pre-
// existing Curtain workshop production tracker (window groups, fabric BOM,
// installation crew scheduling) built in an earlier session on its own id
// scheme. Unifying the two is a real architectural question (which "job" is
// the source of truth?) that deserves its own dedicated session, not a side
// effect of this build. jobCards[] here is Q-Pro's own commercial wrapper —
// Job No, linked Quotation, delivery/materials/labour tracking — modeled
// generically across all divisions, not just Curtain.
// ═══════════════════════════════════════

// Not confirmed against Q-Pro's actual per-division department list — a
// placeholder subset good enough to exercise per-line-per-department status.
const JOB_DEPARTMENTS = ["Cutting", "Stitching", "Installation"];
// Only "Pending" and "Delivered" were directly observed; "In Progress" is a
// reasonable middle state added so the per-department status isn't a binary flag.
const JOB_LINE_STATUSES = ["Pending", "In Progress", "Delivered"];

const jobCards = [];
// Shape roughly matches the real qproJobCardNo values already seeded on
// curtainJobs[] (e.g. "JB26AMD01863") — not the real sequence, just the format.
function nextJobCardNo() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "JB" + yy + "AMD" + String(1000 + jobCards.length).padStart(5, "0");
}

function getJobCard(jobId) { return jobCards.find(j => j.id === jobId); }

// "Confirm Quote" — the action that actually creates the Job Card. Only
// available once Approver has moved a quotation to "Open" (see
// approveQuotation() in the APPROVER section above).
function confirmQuotationToJobCard(qtnId, confirmedBy) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (qtn.lifecycleStatus !== "open") return { error: "Quotation must be Open before it can be confirmed." };
  const totals = computeQuotationTotals(qtn);
  const job = {
    id: nextJobCardNo(), quotationId: qtn.id, customerId: qtn.customerId, projectName: qtn.projectName,
    date: new Date().toISOString().slice(0, 10), amount: totals.netTotal,
    status: "open", // open | completed | cancelled — the whole-job status shown on the Job Card List legend
    confirmDate: new Date().toISOString().slice(0, 10),
    items: qtn.items.map(it => ({
      lineId: it.lineId, product: it.product, qty: it.qty, unit: it.unit, rate: it.rate,
      discPercent: it.discPercent, amount: it.amount, vatPercent: it.vatPercent, netAmount: it.netAmount,
      deliveredQty: 0, departmentStatuses: [] // [{department, status}] — per-line-per-department, see updateJobLineStatus()
    })),
    poNo: null, poDate: null, vendor: null,
    deliveryNotes: [], materialsIssues: [], materialsReturns: [], labourCostEntries: [],
    linkedInvoiceIds: []
  };
  jobCards.push(job);
  qtn.lifecycleStatus = "confirmed";
  qtn.confirmDate = job.confirmDate;
  logQuotationAudit(qtn, { action: "Transfer", user: confirmedBy, userType: "SALES", status: "Confirmed" });
  return job;
}

// "Update BOM" on Edit Job — re-syncs Qty/Rate/Amount from the linked
// Quotation's current items (Estimation may have re-run since confirm),
// matched by lineId. Preserves deliveredQty/departmentStatuses on each job
// item since those belong to the Job, not the Quotation.
function refreshJobFromQuotation(jobId) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const qtn = quotations.find(q => q.id === job.quotationId);
  if (!qtn) return { error: "Linked Quotation not found." };
  job.items.forEach(item => {
    const src = qtn.items.find(it => it.lineId === item.lineId);
    if (src) {
      item.qty = src.qty; item.rate = src.rate; item.discPercent = src.discPercent;
      item.amount = src.amount; item.vatPercent = src.vatPercent; item.netAmount = src.netAmount;
    }
  });
  return job;
}

function nextDeliveryNoteId(job) { return "DN-" + job.id + "-" + (job.deliveryNotes.length + 1); }
// entries: [{ lineId, requiredQty }] — increments deliveredQty on each line,
// capped at the line's own Qty (can't over-deliver).
function addDeliveryNote(jobId, entries) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const lines = entries.map(e => {
    const item = job.items.find(it => it.lineId === e.lineId);
    if (!item) return null;
    const requiredQty = Math.min(e.requiredQty || 0, item.qty - item.deliveredQty);
    item.deliveredQty += requiredQty;
    return { lineId: e.lineId, requiredQty };
  }).filter(Boolean);
  const note = { id: nextDeliveryNoteId(job), date: new Date().toISOString().slice(0, 10), lines };
  job.deliveryNotes.push(note);
  return note;
}

function nextMaterialsMoveId(job, kind) { return kind + "-" + job.id + "-" + (job[kind === "MI" ? "materialsIssues" : "materialsReturns"].length + 1); }
// items: [{ jobItemLineId, itemId, stockItemName, unit, qty }] — Location is
// required (Q-Pro supports multi-warehouse stock; this app has one implicit
// location today, so it's captured but not yet validated against a location
// master). itemId is optional — only lines actually picked from the real
// Item Master (as opposed to free-text stock item names) move the needle on
// itemMaster[].closingStock, matching the real system's own distinction
// between Inventory-tracked items and free-text/job-direct material names.
function addMaterialsIssue(jobId, { location, items }) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (!location) return { error: "Location is required." };
  const move = { id: nextMaterialsMoveId(job, "MI"), date: new Date().toISOString().slice(0, 10), location, items, status: "confirmed" };
  job.materialsIssues.push(move);
  items.forEach(it => {
    if (!it.itemId) return;
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) - (Number(it.qty) || 0);
  });
  return move;
}
// Mirrors addMaterialsIssue() exactly — a reversal of stock issued to a job.
function addMaterialsReturn(jobId, { location, items }) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (!location) return { error: "Location is required." };
  const move = { id: nextMaterialsMoveId(job, "MR"), date: new Date().toISOString().slice(0, 10), location, items, status: "confirmed" };
  job.materialsReturns.push(move);
  items.forEach(it => {
    if (!it.itemId) return;
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) + (Number(it.qty) || 0);
  });
  return move;
}

// Cross-job flattened list for the Inventory module's Material Issue /
// Material Return screens (Transactions → Inventory → ...) — Q-Pro shows
// these as their own top-level document lists (MI/MR NUMBER, CLIENT, DATE,
// JOB NUMBER, ACTION) rather than nested under each Job Card, so this reads
// across every jobCards[] entry instead of duplicating the storage.
function getAllMaterialsMoves(kind) {
  const field = kind === "MI" ? "materialsIssues" : "materialsReturns";
  const rows = [];
  jobCards.forEach(job => {
    const c = customers.find(x => x.id === job.customerId);
    (job[field] || []).forEach(move => {
      rows.push({ move, jobId: job.id, client: c ? c.name : "—" });
    });
  });
  return rows.sort((a, b) => (b.move.date || "").localeCompare(a.move.date || ""));
}

// Cancelling reverses the stock effect (mirror-image of the original move)
// and flags the move itself — matches the "cancelled" red/pink visual state
// observed in the real Material Return list.
function cancelMaterialsMove(jobId, kind, moveId) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const field = kind === "MI" ? "materialsIssues" : "materialsReturns";
  const move = job[field].find(m => m.id === moveId);
  if (!move) return { error: "Move not found." };
  if (move.status === "cancelled") return { error: "Already cancelled." };
  const sign = kind === "MI" ? 1 : -1; // reverse: MI cancel gives stock back, MR cancel takes it back out
  move.items.forEach(it => {
    if (!it.itemId) return;
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) + sign * (Number(it.qty) || 0);
  });
  move.status = "cancelled";
  return move;
}

// Per-line-per-department status — upserts (replaces the existing entry for
// that department on that line, or adds a new one).
function updateJobLineStatus(jobId, lineId, department, status) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  if (!item) return { error: "Line item not found." };
  const existing = item.departmentStatuses.find(d => d.department === department);
  if (existing) existing.status = status;
  else item.departmentStatuses.push({ department, status });
  return item;
}

// Actual labour cost entry — pairs with the Estimator's earlier Labour Cost
// TAB estimate (estimate-vs-actual). OT multiplier of 1.5x is a standard
// assumption, not confirmed against Q-Pro's own calculation.
function addLabourCostEntry(jobId, { employee, jobItemLineId, normalHrs = 0, otHrs = 0, normalRate = 0, otRate = 0 }) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const amount = normalHrs * normalRate + otHrs * otRate * 1.5;
  const entry = { id: job.labourCostEntries.length + 1, employee, jobItemLineId, normalHrs, otHrs, normalRate, otRate, amount, date: new Date().toISOString().slice(0, 10) };
  job.labourCostEntries.push(entry);
  return entry;
}

function setJobStatus(jobId, status) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  job.status = status;
  return job;
}

function getJobCardKPIs() {
  return {
    open: jobCards.filter(j => j.status === "open").length,
    completed: jobCards.filter(j => j.status === "completed").length,
    cancelled: jobCards.filter(j => j.status === "cancelled").length
  };
}

// ═══════════════════════════════════════
// MODULE 6 — TAX INVOICE
// From Salman's live Q-Pro trace: a Tax Invoice is a system-generated PDF
// tied 1:1 to a Job Card — there's no standalone "Create Invoice" form for
// a Sales-role user. Generation is modeled here as a manual action from the
// Job Card hub (rather than auto-firing on Confirm Quote) since the live
// trace only says "likely" for that second trigger — safer to make it an
// explicit action than to silently double-generate invoices later if that
// assumption turns out wrong.
//
// No real customer/bank/IBAN details were captured (Salman deliberately
// didn't reproduce them) — this app has none to seed with, so payment
// details on the rendered document are placeholders, not real data.
// ═══════════════════════════════════════

const taxInvoices = [];
// Shape mirrors qproJobCardNo's "JB26AMD01863" convention: IN + YY + division
// code + sequence. Division code defaults to "AMD" (the company code seen
// elsewhere) since the real per-division code list hasn't been captured.
function nextInvoiceNo() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "IN" + yy + "AMD" + String(1000 + taxInvoices.length).padStart(5, "0");
}

function getInvoicesForJob(jobId) { return taxInvoices.filter(inv => inv.jobId === jobId); }

// invoicedPercent defaults to 100 (full invoice) — Q-Pro's own partial-
// invoicing rules (e.g. milestone billing) weren't captured in this trace.
function generateInvoiceFromJob(jobId, { lpoNo = null, invoicedPercent = 100 } = {}) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const total = job.items.reduce((s, it) => s + it.amount, 0);
  const vat = job.items.reduce((s, it) => s + (it.amount * (it.vatPercent || 0) / 100), 0) * (invoicedPercent / 100);
  const invoicedTotal = total * (invoicedPercent / 100);
  const netTotal = invoicedTotal + vat;
  const inv = {
    id: nextInvoiceNo(), jobId, quotationId: job.quotationId, customerId: job.customerId,
    date: new Date().toISOString().slice(0, 10), lpoNo,
    items: job.items.map(it => ({ description: it.product, qty: it.qty, unit: it.unit, rate: it.rate, amount: it.amount })),
    totals: { total, invoicedPercent, vat, netTotal }
  };
  taxInvoices.push(inv);
  job.linkedInvoiceIds.push(inv.id);
  return inv;
}

// ═══════════════════════════════════════
// ACCOUNTS — GENERAL LEDGER (Batch 3: Chart of Accounts, Ledger, General
// Receipt, General Payment, Journal)
// Traced from a live Q-Pro spec (docs/qpro-mapping/batch-3-accounts.txt).
// This is the real bookkeeping layer underneath Sales/Purchases — separate
// from accounts.js's pre-existing read-only KPI dashboard (revenue/
// receivables/payables), which stays untouched. Every payment-method field
// on Receipt/Credit Note/Payment (Batch 1/4) is supposed to resolve to one
// of these ledgers via a Voucher Ledger Mapping (Batch 5) — that mapping
// step itself is out of scope for this pass; ledgers are picked directly.
//
// 15 system Primary groups are locked/non-editable in the live system (no
// parent, can't be renamed) — modeled the same way here. The 11 custom
// sub-groups and their Primary Group classification (Asset/Liability/
// Income/Expense) are the real values from the live trace.
// ═══════════════════════════════════════

const ACCOUNTS_PRIMARY_GROUPS = [
  { name: "Branch/Divisions", classification: "Asset" },
  { name: "Capital Account", classification: "Liability" },
  { name: "Current Assets", classification: "Asset" },
  { name: "Current Liabilities", classification: "Liability" },
  { name: "Direct Expenses", classification: "Expense" },
  { name: "Direct Incomes", classification: "Income" },
  { name: "Fixed Assets", classification: "Asset" },
  { name: "Indirect Expenses", classification: "Expense" },
  { name: "Indirect Incomes", classification: "Income" },
  { name: "Investments", classification: "Asset" },
  { name: "Loans (Liability)", classification: "Liability" },
  { name: "Misc. Expenses (Asset)", classification: "Asset" },
  { name: "Purchase Accounts", classification: "Expense" },
  { name: "Sales Accounts", classification: "Income" },
  { name: "Suspense A/c", classification: "Asset" }
];
const ACCOUNTS_CLASSIFICATIONS = ["Asset", "Liability", "Income", "Expense"];

// The 11 real custom sub-groups from the live trace, each Under one Primary.
const ACCOUNTS_CUSTOM_GROUPS = [
  { name: "Customers", under: "Current Assets" },
  { name: "Suppliers", under: "Current Liabilities" },
  { name: "Sales", under: "Current Assets" },
  { name: "Duties & Taxes", under: "Current Liabilities" },
  { name: "Purchases", under: "Direct Expenses" },
  { name: "Cash Accounts", under: "Current Assets" },
  { name: "Bank Accounts", under: "Current Assets" },
  { name: "Salary & Staff Costs", under: "Indirect Expenses" },
  { name: "Staff Salaries", under: "Indirect Expenses" },
  { name: "Machinery Repair & Maintenance", under: "Indirect Expenses" },
  { name: "Tools & Equipment", under: "Indirect Expenses" }
];

const accountsGroups = [
  ...ACCOUNTS_PRIMARY_GROUPS.map((g, i) => ({
    id: "AG-" + String(i + 1).padStart(3, "0"),
    name: g.name, under: "Primary", isPrimary: true, editable: false,
    classification: g.classification, sortOption: i + 1
  })),
  ...ACCOUNTS_CUSTOM_GROUPS.map((g, i) => ({
    id: "AG-" + String(ACCOUNTS_PRIMARY_GROUPS.length + i + 1).padStart(3, "0"),
    name: g.name, under: g.under, isPrimary: false, editable: true,
    classification: ACCOUNTS_PRIMARY_GROUPS.find(p => p.name === g.under).classification,
    sortOption: ACCOUNTS_PRIMARY_GROUPS.length + i + 1
  }))
];

function nextAccountsGroupId() {
  return "AG-" + String(accountsGroups.length + 1).padStart(3, "0");
}

// Only custom sub-groups can be created/edited — the 15 Primary groups are
// locked, matching the live system exactly (Edit action only shows on the
// 11 custom rows there).
function createAccountsGroup({ name, under, sortOption = accountsGroups.length + 1 } = {}) {
  if (!name || !name.trim()) return { error: "Group Name is required." };
  const parent = accountsGroups.find(g => g.name === under && g.isPrimary);
  if (!parent) return { error: "Under (a Primary group) is required." };
  const group = {
    id: nextAccountsGroupId(), name: name.trim(), under: parent.name,
    isPrimary: false, editable: true, classification: parent.classification,
    sortOption: Number(sortOption) || accountsGroups.length + 1
  };
  accountsGroups.push(group);
  return group;
}

const ACCOUNTS_TAXABILITY_OPTIONS = ["Taxable (10%)", "Taxable (5%)", "Taxable (0%)", "Exempt (0%)", "Out of scope (0%)"];

// Ledger master — the actual Chart-of-Accounts list every "Ledger"
// autocomplete across Receipt/Payment/Journal reads from. Seeded with the
// real ledger names already referenced elsewhere in this app (Purchase —
// the default PO/PI line ledger; the CASH_LEDGERS list) plus the GL
// accounts named in the live trace (Sales, Sales Return, VAT, etc.), since
// those are confirmed real values rather than invented ones. There is
// deliberately no separate "Bank" master — a bank account is just a Ledger
// under "Bank Accounts" with the banking fields filled in, matching the
// live system exactly.
const ledgers = [
  { code: "LED0001", name: "Cash", group: "Cash Accounts" },
  { code: "LED0002", name: "Bank - BBK Current", group: "Bank Accounts" },
  { code: "LED0003", name: "Bank - NBB Current", group: "Bank Accounts" },
  { code: "LED0004", name: "Petty Cash", group: "Cash Accounts" },
  { code: "LED0005", name: "Purchase", group: "Purchases" },
  { code: "LED0006", name: "Sales", group: "Sales" },
  { code: "LED0007", name: "Sales Return", group: "Sales" },
  { code: "LED0008", name: "Discount (Sales/Purchase)", group: "Purchases" },
  { code: "LED0009", name: "VAT", group: "Duties & Taxes" },
  { code: "LED0010", name: "Printing & Stationery", group: "Indirect Expenses" },
  { code: "LED0011", name: "Freight & Courier Charges", group: "Indirect Expenses" },
  { code: "LED0012", name: "Salary", group: "Staff Salaries" },
  { code: "LED0013", name: "Air Ticket", group: "Indirect Expenses" },
  { code: "LED0014", name: "Air Ticket Payable", group: "Current Liabilities" },
  { code: "LED0015", name: "Round OFF", group: "Suspense A/c" },
  { code: "LED0016", name: "Project Cost - Commission", group: "Direct Expenses" },
  { code: "LED0017", name: "Food Expenses", group: "Indirect Expenses" },
  { code: "LED0018", name: "Repair and Maintenance", group: "Machinery Repair & Maintenance" },
  { code: "LED0019", name: "Tools and equipments", group: "Tools & Equipment" }
].map((l, i) => ({
  id: "LG-" + String(i + 1).padStart(4, "0"),
  code: l.code, name: l.name, groupName: l.group,
  taxability: "Out of scope (0%)",
  bankAccountNumber: "", bankAccountHolderName: "", ibanNumber: "", bankSwift: "", bankName: "", bankBranch: "",
  openingBalance: 0, isPayroll: false
}));

function nextLedgerCode() {
  return "LED" + String(ledgers.length + 1).padStart(4, "0");
}

function createLedger({
  name, groupName, taxability = "Out of scope (0%)",
  bankAccountNumber = "", bankAccountHolderName = "", ibanNumber = "", bankSwift = "", bankName = "", bankBranch = "",
  openingBalance = 0, isPayroll = false
} = {}) {
  if (!name || !name.trim()) return { error: "Ledger Name is required." };
  const group = accountsGroups.find(g => g.name === groupName);
  if (!group) return { error: "Under (Group) is required." };
  const ledger = {
    id: "LG-" + String(ledgers.length + 1).padStart(4, "0"),
    code: nextLedgerCode(), name: name.trim(), groupName: group.name, taxability,
    bankAccountNumber, bankAccountHolderName, ibanNumber, bankSwift, bankName, bankBranch,
    openingBalance: Number(openingBalance) || 0, isPayroll: !!isPayroll
  };
  ledgers.push(ledger);
  return ledger;
}

// Shared by General Receipt/Payment/Journal — the five payment-mode blocks
// (Cash/Bank/C Card/Wallet/Cheque) sum to the header Amount, confirmed live
// ("entering 50 in Cash auto-populated Amount as 50.000").
function sumPaymentMethods(methods = {}) {
  return ["cash", "bank", "cCard", "wallet", "cheque"]
    .reduce((s, k) => s + (methods[k] && methods[k].enabled ? (Number(methods[k].amount) || 0) : 0), 0);
}

const generalReceipts = [];
function nextGeneralReceiptId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "GR" + yy + String(generalReceipts.length + 1).padStart(5, "0");
}

// General Receipt — pure GL-coded receipt, no Customer/Invoice linkage
// (confirmed live: the Ledger autocomplete only matches Chart-of-Accounts
// entries, returns "No Results Found" for a customer name).
function createGeneralReceipt({ date = null, methods = {}, amount, lines = [], remarks = "" } = {}) {
  const computedAmount = sumPaymentMethods(methods);
  const finalAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : computedAmount;
  const lineTotal = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 1000) / 1000;
  if (!finalAmount || finalAmount <= 0 || Math.round(finalAmount * 1000) / 1000 !== lineTotal) {
    return { error: "Please check entered Amount." };
  }
  const receipt = {
    id: nextGeneralReceiptId(), date: date || new Date().toISOString().slice(0, 10),
    methods, amount: finalAmount,
    lines: lines.map(l => ({ ledgerId: l.ledgerId, amount: Number(l.amount) || 0, narration: l.narration || "" })),
    remarks, status: "confirmed"
  };
  generalReceipts.push(receipt);
  return receipt;
}

const generalPayments = [];
function nextGeneralPaymentId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "GP" + yy + String(generalPayments.length + 1).padStart(5, "0");
}

// General Payment — structurally identical header to General Receipt, but
// each line can optionally tie to a Job (+ Job Item) — its real-world use
// confirmed live as refunding customer advances / job-related outgoing
// payments, distinct from Journal (pure GL) and the Purchasing module's
// supplier-invoice Payment screen (Batch 1).
function createGeneralPayment({ date = null, methods = {}, amount, lines = [], remarks = "" } = {}) {
  const computedAmount = sumPaymentMethods(methods);
  const finalAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : computedAmount;
  const lineTotal = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 1000) / 1000;
  if (!finalAmount || finalAmount <= 0 || Math.round(finalAmount * 1000) / 1000 !== lineTotal) {
    return { error: "Please check entered Amount." };
  }
  const payment = {
    id: nextGeneralPaymentId(), date: date || new Date().toISOString().slice(0, 10),
    methods, amount: finalAmount,
    lines: lines.map(l => ({
      ledgerId: l.ledgerId, amount: Number(l.amount) || 0, narration: l.narration || "",
      jobId: l.jobId || null, jobItemRef: l.jobItemRef || null
    })),
    remarks, status: "confirmed"
  };
  generalPayments.push(payment);
  return payment;
}
function cancelGeneralPayment(paymentId) {
  const p = generalPayments.find(x => x.id === paymentId);
  if (!p) return null;
  p.status = "cancelled";
  return p;
}

const journals = [];
function nextJournalId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "JL" + yy + String(journals.length + 1).padStart(5, "0");
}

// Journal — free-form multi-line double entry. Confirmed live across ~100
// real entries: every entry's Debit total must equal its Credit total. That
// balance is enforced here, not just assumed, so a rebuild can't silently
// post an unbalanced entry the way a UI-only validation might miss.
function createJournal({ date = null, lines = [], remarks = "" } = {}) {
  if (!lines || lines.length < 2) return { error: "A Journal needs at least two lines (one Debit, one Credit)." };
  const drTotal = Math.round(lines.reduce((s, l) => s + (Number(l.dr) || 0), 0) * 1000) / 1000;
  const crTotal = Math.round(lines.reduce((s, l) => s + (Number(l.cr) || 0), 0) * 1000) / 1000;
  if (drTotal !== crTotal || drTotal === 0) {
    return { error: "Debit total must equal Credit total." };
  }
  const journal = {
    id: nextJournalId(), date: date || new Date().toISOString().slice(0, 10),
    lines: lines.map(l => ({
      ledgerId: l.ledgerId, dr: Number(l.dr) || 0, cr: Number(l.cr) || 0,
      revLedgerId: l.revLedgerId || null, narration: l.narration || "",
      jobId: l.jobId || null, jobItemRef: l.jobItemRef || null
    })),
    drTotal, crTotal, remarks, status: "confirmed"
  };
  journals.push(journal);
  return journal;
}
function cancelJournal(journalId) {
  const j = journals.find(x => x.id === journalId);
  if (!j) return null;
  j.status = "cancelled";
  return j;
}
