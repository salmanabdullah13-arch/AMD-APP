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
    installationPending: 0
  };

  curtainJobs.forEach(job => {
    // Running jobs = any job not marked complete
    if (job.status !== 'complete') {
      kpis.totalRunningJobs++;
      // Total items = physical windows (qty-weighted) in non-complete jobs
      kpis.totalItemsToProduce += (job.windows ? job.windows.reduce((s, w) => s + (w.qty || 1), 0) : 0);
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
