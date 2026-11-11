/* ==========================================================================
   SNB Racing — HQ 202 Jetting & AFR (v0.3 Dark Edition)
   Zero-dependency ES6 Pit-Lane Physics, Session Log, Dyno Lab & BXUV-3 Kit
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'snb_hq202_jetting_state_v03';
  const ISA_STD_DENSITY = 1.2250; // kg/m^3 at 15C (288.15K), 1013.25 hPa, 0% RH
  const R_DRY = 287.058;          // J/(kg*K) dry air gas constant
  const R_VAPOR = 461.495;        // J/(kg*K) water vapor gas constant
  const HPA_PER_PSI = 68.9475729318;
  const MM_PER_INCH = 25.4;
  const END_CYL_LEAN_OFFSET = 0.27; // #1 & #6 siamesed cast log manifold lean bias

  /* ------------------------------------------------------------------------
     1. FACTORY SEED DATA (Group 3H HQ Holden 202 — Calder Park & BXUV-3 Kit)
     ------------------------------------------------------------------------ */
  function createDefaultJets() {
    const jets = [];
    for (let num = 68; num <= 80; num++) {
      const inch = num * 0.001;
      const mm = Number((inch * MM_PER_INCH).toFixed(4));
      jets.push({
        id: `m1_${num}`,
        label: `#${num}`,
        stamp: `#${num} M1`,
        mm,
        custom: false,
        inToolbox: true
      });
    }
    // Custom precision metric drills specified for HQ 202 kit
    jets.push({
      id: 'drill_1950',
      label: '1.950 mm Drill',
      stamp: 'Custom 1.950 mm',
      mm: 1.9500,
      custom: true,
      inToolbox: true
    });
    jets.push({
      id: 'drill_2000',
      label: 'Jet #77 / 2.000 mm',
      stamp: '#77 Body / 2.000 mm Drill',
      mm: 2.0000,
      custom: true,
      inToolbox: true
    });

    return sortJetsByDiameter(jets);
  }

  function sortJetsByDiameter(jets) {
    return [...jets].sort((a, b) => a.mm - b.mm);
  }

  function createDefaultCarbies() {
    return [
      {
        id: '1 DME',
        name: '1 DME',
        bodyType: 'Late-Base 40.00 mm Stromberg BXUV-3',
        studsMm: 75.0,
        venturiMm: 30.90,
        exitMm: 39.98,
        spillMm: 15.0,
        gasketStack: 'HQRA heat shield between 2x std 40mm gaskets',
        fittedJetId: 'drill_2000',
        baselineAnchor: {
          sourceLabel: 'Calder Race 1',
          jetId: 'drill_2000',
          jetLabel: 'Jet #77 / 2.000 mm',
          jetMm: 2.000,
          rad: 94.3,
          fuelSg: 0.740,
          verifiedAfr: 12.50,
          timing: 33.0,
          fuelPsi: 5.0
        },
        notes: 'Primary race unit — crisp booster signal, Calder Race 1 verified baseline.'
      },
      {
        id: '2 DME',
        name: '2 DME',
        bodyType: 'Late-Base 40.00 mm Stromberg BXUV-3',
        studsMm: 75.0,
        venturiMm: 30.88,
        exitMm: 39.95,
        spillMm: 15.0,
        gasketStack: 'HQRA heat shield between 2x std 40mm gaskets',
        fittedJetId: 'm1_74',
        baselineAnchor: {
          sourceLabel: 'Untested / DME Build Sheet',
          jetId: 'm1_74',
          jetLabel: '#74 DME Spec / 1.880 mm',
          jetMm: 1.880,
          rad: 100.0,
          fuelSg: 0.740,
          verifiedAfr: null,
          timing: 33.0,
          fuelPsi: 5.0
        },
        notes: 'Untested DME build-sheet unit — #74 (1.880 mm) @ 100.0% RAD, Weather-Only until run.'
      },
      {
        id: 'SNB Carby',
        name: 'SNB Carby',
        bodyType: 'Late-Base 40.00 mm Stromberg BXUV-3',
        studsMm: 75.0,
        venturiMm: 30.92,
        exitMm: 40.00,
        spillMm: 15.0,
        gasketStack: 'HQRA heat shield between 2x std 40mm gaskets',
        fittedJetId: 'm1_70',
        baselineAnchor: {
          sourceLabel: 'Calder P2',
          jetId: 'm1_70',
          jetLabel: '#70 / 1.788 mm',
          jetMm: 1.788,
          rad: 96.0,
          fuelSg: 0.740,
          verifiedAfr: 11.90,
          timing: 33.0,
          fuelPsi: 5.0
        },
        notes: 'Development 40mm BXUV-3 — 15.0 mm spill, #70 (1.788 mm) verified 11.90 AFR at Calder P2.'
      }
    ];
  }

  function createDefaultBaseline() {
    return {
      sessionName: 'Race 1',
      carbyId: '1 DME',
      jetId: 'drill_2000',
      jetLabel: 'Jet #77 / 2.000 mm',
      jetMm: 2.000,
      rad: 94.3,
      fuelSg: 0.740,
      wotAfr: 12.50,
      afrStatus: 'verified', // 'verified' | 'estimated' | 'untested'
      weatherOnly: false,
      timing: 33.0,
      fuelPsi: 5.0,
      linkedSessionId: 'calder_r1'
    };
  }

  function createDefaultSessions() {
    return [
      {
        id: 'calder_p1',
        venue: 'Calder Park',
        sessionName: 'Practice 1',
        timestamp: 'Sat 08:45',
        carbyId: 'SNB Carby',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 98.6,
        fuelSg: 0.740,
        timing: 32.0,
        fuelPsi: 5.0,
        afr3500: 13.05,
        afr4000: 12.98,
        afr4500: 12.92,
        afr5000: 12.89,
        afrWot: 12.90,
        notes: 'Crisp morning air at Calder; SNB Carby clean pull to 5300 RPM.'
      },
      {
        id: 'calder_p2',
        venue: 'Calder Park',
        sessionName: 'Practice 2',
        timestamp: 'Sat 10:15',
        carbyId: 'SNB Carby',
        jetId: 'drill_1950',
        jetLabel: '1.950 mm Drill',
        jetMm: 1.9500,
        rad: 96.8,
        fuelSg: 0.740,
        timing: 33.0,
        fuelPsi: 5.0,
        afr3500: 13.22,
        afr4000: 13.15,
        afr4500: 13.10,
        afr5000: 13.06,
        afrWot: 13.08,
        notes: 'Tested 1.950mm custom drill — #1/#6 end-cyl est 13.35 (too lean down back straight).'
      },
      {
        id: 'calder_p3',
        venue: 'Calder Park',
        sessionName: 'Practice 3',
        timestamp: 'Sat 11:40',
        carbyId: '1 DME',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 95.6,
        fuelSg: 0.740,
        timing: 33.0,
        fuelPsi: 5.0,
        afr3500: 12.90,
        afr4000: 12.84,
        afr4500: 12.79,
        afr5000: 12.76,
        afrWot: 12.78,
        notes: 'Bolted on 1 DME with HQRA shield; strong mid-corner torque.'
      },
      {
        id: 'calder_q1',
        venue: 'Calder Park',
        sessionName: 'Qualifying',
        timestamp: 'Sat 13:10',
        carbyId: '1 DME',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 94.8,
        fuelSg: 0.740,
        timing: 33.5,
        fuelPsi: 5.0,
        afr3500: 12.86,
        afr4000: 12.80,
        afr4500: 12.75,
        afr5000: 12.71,
        afrWot: 12.72,
        notes: 'Qualified P2; slight richness as track air warmed.'
      },
      {
        id: 'calder_r1',
        venue: 'Calder Park',
        sessionName: 'Race 1',
        timestamp: 'Sun 10:35',
        carbyId: '1 DME',
        jetId: 'drill_2000',
        jetLabel: 'Jet #77 / 2.000 mm',
        jetMm: 2.0000,
        rad: 94.3,
        fuelSg: 0.740,
        timing: 33.0,
        fuelPsi: 5.0,
        afr3500: 12.68,
        afr4000: 12.60,
        afr4500: 12.55,
        afr5000: 12.52,
        afrWot: 12.50,
        notes: 'Safe rich slipstream setup (2.000mm drill in #77 body); 5.0 psi steady at block boss.'
      },
      {
        id: 'calder_r2',
        venue: 'Calder Park',
        sessionName: 'Race 2',
        timestamp: 'Sun 13:50',
        carbyId: '1 DME',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 93.9,
        fuelSg: 0.740,
        timing: 33.0,
        fuelPsi: 5.0,
        afr3500: 12.92,
        afr4000: 12.88,
        afr4500: 12.84,
        afr5000: 12.81,
        afrWot: 12.82,
        notes: 'Stepped leaner to #78 — dead in 12.8-12.9 HQ 202 sweet spot, pulled hard to 5400.'
      },
      {
        id: 'calder_r3',
        venue: 'Calder Park',
        sessionName: 'Race 3',
        timestamp: 'Sun 16:20',
        carbyId: 'SNB Carby',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 95.2,
        fuelSg: 0.740,
        timing: 33.0,
        fuelPsi: 5.0,
        afr3500: 12.96,
        afr4000: 12.91,
        afr4500: 12.88,
        afr5000: 12.86,
        afrWot: 12.87,
        notes: 'Late cool change on SNB Carby; zero stumble off hairpin, P1 finish.'
      }
    ];
  }

  function createDefaultDynoPulls() {
    return [
      {
        id: 'dyno_1',
        name: '1 DME — #77/2.000mm (Rich Base 33°)',
        carbyId: '1 DME',
        color: '#F59E0B',
        rad: 94.3,
        timing: 33.0,
        visible: true,
        points: [
          { rpm: 3500, hp: 108.5, tq: 162.8, afr: 12.68 },
          { rpm: 3750, hp: 116.2, tq: 162.7, afr: 12.64 },
          { rpm: 4000, hp: 123.0, tq: 161.5, afr: 12.60 },
          { rpm: 4250, hp: 128.6, tq: 158.9, afr: 12.57 },
          { rpm: 4500, hp: 132.8, tq: 155.0, afr: 12.55 },
          { rpm: 4750, hp: 135.4, tq: 149.7, afr: 12.53 },
          { rpm: 5000, hp: 136.6, tq: 143.5, afr: 12.50 },
          { rpm: 5250, hp: 135.1, tq: 135.2, afr: 12.48 },
          { rpm: 5500, hp: 131.4, tq: 125.5, afr: 12.46 }
        ]
      },
      {
        id: 'dyno_2',
        name: '1 DME — #78/1.981mm (Sweet-Spot 33°)',
        carbyId: '1 DME',
        color: '#10B981',
        rad: 94.5,
        timing: 33.0,
        visible: true,
        points: [
          { rpm: 3500, hp: 110.4, tq: 165.7, afr: 12.92 },
          { rpm: 3750, hp: 118.6, tq: 166.1, afr: 12.90 },
          { rpm: 4000, hp: 126.1, tq: 165.6, afr: 12.88 },
          { rpm: 4250, hp: 132.2, tq: 163.4, afr: 12.86 },
          { rpm: 4500, hp: 136.9, tq: 159.8, afr: 12.85 },
          { rpm: 4750, hp: 139.8, tq: 154.6, afr: 12.84 },
          { rpm: 5000, hp: 141.3, tq: 148.4, afr: 12.82 },
          { rpm: 5250, hp: 140.4, tq: 140.5, afr: 12.80 },
          { rpm: 5500, hp: 136.8, tq: 130.6, afr: 12.79 }
        ]
      },
      {
        id: 'dyno_3',
        name: 'SNB Carby — #78/1.981mm (HQRA Shield)',
        carbyId: 'SNB Carby',
        color: '#38BDF8',
        rad: 95.2,
        timing: 33.0,
        visible: false,
        points: [
          { rpm: 3500, hp: 109.9, tq: 164.9, afr: 12.95 },
          { rpm: 3750, hp: 118.1, tq: 165.4, afr: 12.93 },
          { rpm: 4000, hp: 125.5, tq: 164.8, afr: 12.91 },
          { rpm: 4250, hp: 131.7, tq: 162.8, afr: 12.89 },
          { rpm: 4500, hp: 136.4, tq: 159.2, afr: 12.88 },
          { rpm: 4750, hp: 139.3, tq: 154.0, afr: 12.87 },
          { rpm: 5000, hp: 140.8, tq: 147.9, afr: 12.86 },
          { rpm: 5250, hp: 140.1, tq: 140.2, afr: 12.85 },
          { rpm: 5500, hp: 136.5, tq: 130.3, afr: 12.84 }
        ]
      }
    ];
  }

  /* ------------------------------------------------------------------------
     2. APPLICATION STATE & PERSISTENCE
     ------------------------------------------------------------------------ */
  function hydrateState(candidate) {
    const defaultCarbies = createDefaultCarbies();
    candidate.jets = sortJetsByDiameter(candidate.jets || createDefaultJets());

    if (!Array.isArray(candidate.carbies) || candidate.carbies.length === 0) {
      candidate.carbies = defaultCarbies;
    } else {
      candidate.carbies = candidate.carbies.map((c) => {
        const def = defaultCarbies.find((d) => d.id === c.id);
        if (!c.baselineAnchor && def) {
          return {
            ...c,
            fittedJetId: c.id === '2 DME' && c.fittedJetId === 'm1_76' ? 'm1_74' : c.fittedJetId,
            baselineAnchor: { ...def.baselineAnchor },
            notes: def.notes
          };
        }
        return c;
      });
    }

    const b = candidate.baseline || createDefaultBaseline();
    const hasNumericAfr = b.wotAfr !== null && b.wotAfr !== undefined && Number.isFinite(Number(b.wotAfr));
    if (!b.afrStatus) {
      b.afrStatus = hasNumericAfr ? 'verified' : 'untested';
    }
    if (!hasNumericAfr) {
      b.wotAfr = null;
      b.afrStatus = 'untested';
    }
    if (typeof b.weatherOnly !== 'boolean') {
      b.weatherOnly = !hasNumericAfr;
    }
    candidate.baseline = b;

    candidate.sessions = (candidate.sessions || []).map((s) => ({
      ...s,
      afrStatus: s.afrStatus || 'verified'
    }));

    if (!Array.isArray(candidate.dynoPulls)) {
      candidate.dynoPulls = createDefaultDynoPulls();
    }
    return candidate;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.baseline && Array.isArray(parsed.jets) && Array.isArray(parsed.sessions)) {
          return hydrateState(parsed);
        }
      }
    } catch (err) {
      console.warn('Restoring default state due to storage parse issue:', err);
    }
    return hydrateState({
      baseline: createDefaultBaseline(),
      jets: createDefaultJets(),
      carbies: createDefaultCarbies(),
      sessions: createDefaultSessions(),
      dynoPulls: createDefaultDynoPulls()
    });
  }

  let state = loadState();

  // Transient UI state
  const ui = {
    activeTab: 'tab-calc',
    calcStep: 1,
    weatherMode: 'rad',    // 'rad' | 'raw'
    pressUnit: 'hPa',      // 'hPa' | 'psi'
    weatherOnly: Boolean(state.baseline.weatherOnly || state.baseline.wotAfr === null),
    editBaseWeatherOnly: false,
    editCarbyAnchorUntested: false,
    selectedJetId: null,   // selected jet in Step 2
    editingSessionId: null,
    dynoScrubRpm: 5000
  };

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Unable to persist state:', err);
    }
  }

  /* ------------------------------------------------------------------------
     3. CORE PHYSICS ENGINE (NO DOUBLE COUNTING)
     ------------------------------------------------------------------------ */

  /**
   * Buck's (1981/1996) Saturation Vapor Pressure over liquid water in hPa.
   * Higher RH increases water vapor pressure Pv, displacing dry O2 molecules,
   * lowering air density and leaning the required carburettor main jet.
   */
  function computeBuckVaporPressureHpa(tempC) {
    return 6.1121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  }

  function computeRawMoistAirTelemetry(tempC, pressureVal, pressUnit, rhPct) {
    const tempK = tempC + 273.15;
    const totalHpa = pressUnit === 'psi' ? pressureVal * HPA_PER_PSI : pressureVal;
    const clampedRh = Math.max(0, Math.min(100, rhPct));
    const pSatHpa = computeBuckVaporPressureHpa(tempC);
    const pvHpa = (clampedRh / 100) * pSatHpa;
    const pdHpa = Math.max(0, totalHpa - pvHpa);

    const pdPa = pdHpa * 100;
    const pvPa = pvHpa * 100;

    // Moist air density (kg/m^3) & dry oxygen-bearing partial density (kg/m^3)
    const rhoDry = pdPa / (R_DRY * tempK);
    const rhoMoist = rhoDry + pvPa / (R_VAPOR * tempK);
    const equivRad = (rhoMoist / ISA_STD_DENSITY) * 100;

    return {
      tempC,
      tempK,
      totalHpa,
      pvHpa,
      rhoDry,
      rhoMoist,
      equivRad
    };
  }

  function orificeAreaMm2(diameterMm) {
    const r = diameterMm / 2;
    return Math.PI * r * r;
  }

  function mmToInch(mm) {
    return mm / MM_PER_INCH;
  }

  function inchToMm(inch) {
    return inch * MM_PER_INCH;
  }

  /**
   * Venturi Fourth-Root Orifice Equations:
   * Standard Mode:
   *   Ideal_Jet_mm = Base_Jet_mm * ((rho_ratio)^0.25) * sqrt(Logged_AFR / Target_AFR) * ((SG_base / SG_new)^0.25)
   * Weather-Only / Practice 1 Mode (No Verified AFR or O2 Switch ON -> sqrt(Logged_AFR / Target_AFR) = 1.000):
   *   Ideal_Jet_mm = Base_Jet_mm * ((rho_ratio)^0.25) * ((SG_base / SG_new)^0.25)
   * Predicted_AFR = Base_Ref_AFR * sqrt(rho_ratio) * ((Base_Jet_mm / Chosen_Jet_mm)^2) * sqrt(SG_base / SG_new)
   */
  function calculateIdealJetMm(baseJetMm, rhoRatio, loggedAfr, targetAfr, sgBase, sgNew, weatherOnly = false) {
    const safeRho = Math.max(0.5, rhoRatio);
    const safeSgRatio = Math.max(0.5, sgBase / sgNew);
    const hasLogged = loggedAfr !== null && loggedAfr !== undefined && Number.isFinite(Number(loggedAfr));
    const afrMultiplier = weatherOnly || !hasLogged
      ? 1.000
      : Math.sqrt(Math.max(0.5, Number(loggedAfr) / targetAfr));
    return baseJetMm * Math.pow(safeRho, 0.25) * afrMultiplier * Math.pow(safeSgRatio, 0.25);
  }

  function calculatePredictedAfr(loggedAfr, rhoRatio, baseJetMm, chosenJetMm, sgBase, sgNew) {
    const safeRho = Math.max(0.5, rhoRatio);
    const safeSgRatio = Math.max(0.5, sgBase / sgNew);
    const jetRatioSq = Math.pow(baseJetMm / chosenJetMm, 2);
    return loggedAfr * Math.sqrt(safeRho) * jetRatioSq * Math.sqrt(safeSgRatio);
  }

  /**
   * Siamesed cast log manifold protection:
   * End-cylinder (#1 & #6) lean estimate = Predicted_AFR + 0.27.
   * Detonation / head-gasket danger if:
   *   (Total Timing > 34.0 deg && Predicted_AFR > 12.95) OR (#1/#6 estimated AFR >= 13.25)
   */
  function evaluateManifoldProtection(predictedAfr, totalTiming) {
    const endCylAfr = predictedAfr + END_CYL_LEAN_OFFSET;
    const timingLeanDanger = totalTiming > 34.0 && predictedAfr > 12.95;
    const endCylLeanDanger = endCylAfr >= 13.25;

    if (timingLeanDanger || endCylLeanDanger) {
      const reasons = [];
      if (endCylLeanDanger) {
        reasons.push(`#1 & #6 siamesed log end-cylinders estimated at ${endCylAfr.toFixed(2)} AFR (>= 13.25 lean limit)`);
      }
      if (timingLeanDanger) {
        reasons.push(`Total Timing ${totalTiming.toFixed(1)}° (> 34.0°) combined with ${predictedAfr.toFixed(2)} WOT AFR (> 12.95)`);
      }
      return {
        level: 'danger',
        endCylAfr,
        title: 'DETONATION / HEAD-GASKET DANGER (#1 & #6 LEAN)',
        message: `${reasons.join(' + ')}. High risk of detonation, nipping #1/#6 top rings, or torching the head gasket between siamesed bores. Step richer or pull timing to <= 34.0°!`
      };
    }

    if (totalTiming > 34.0 || totalTiming < 32.0) {
      return {
        level: 'warning',
        endCylAfr,
        title: `TIMING OUTSIDE 32–34° WINDOW (${totalTiming.toFixed(1)}° BTDC)`,
        message: `Predicted WOT AFR is ${predictedAfr.toFixed(2)} (#1/#6 est. ${endCylAfr.toFixed(2)}), keep total timing inside 32.0–34.0° BTDC on cast iron 202 chamber.`
      };
    }

    if (predictedAfr < 12.60) {
      return {
        level: 'warning',
        endCylAfr,
        title: `SAFE RICH MARGIN (${predictedAfr.toFixed(2)} WOT / #1&#6 ${endCylAfr.toFixed(2)})`,
        message: `Cylinder #1 & #6 well protected (${endCylAfr.toFixed(2)} < 13.25), but richer than 12.75–12.95 power band — may cost ~3–5 RWHP at 5000+ RPM.`
      };
    }

    return {
      level: 'safe',
      endCylAfr,
      title: `SWEET-SPOT & #1/#6 PROTECTED (${endCylAfr.toFixed(2)} AFR)`,
      message: `Collector ${predictedAfr.toFixed(2)} AFR puts #1 & #6 end-cylinders at ${endCylAfr.toFixed(2)} (< 13.25 limit) with ${totalTiming.toFixed(1)}° BTDC timing.`
    };
  }

  /* ------------------------------------------------------------------------
     4. UI HELPERS & TOAST
     ------------------------------------------------------------------------ */
  function $(id) {
    return document.getElementById(id);
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = $('pitToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 2800);
  }

  function readNum(id, fallback) {
    const el = $(id);
    if (!el) return fallback;
    const val = parseFloat(el.value);
    return Number.isFinite(val) ? val : fallback;
  }

  function findJetById(id) {
    return state.jets.find((j) => j.id === id) || null;
  }

  function findNearestJetByMm(mmVal) {
    const sorted = sortJetsByDiameter(state.jets);
    let best = sorted[0] || null;
    let bestDiff = Infinity;
    sorted.forEach((j) => {
      const d = Math.abs(j.mm - mmVal);
      if (d < bestDiff) {
        bestDiff = d;
        best = j;
      }
    });
    return best;
  }

  function getActiveCalcPhysics() {
    const base = state.baseline;
    const targetAfr = readNum('inputTargetAfr', 12.85);
    const sgNew = readNum('inputFuelSg', 0.740);
    const totalTiming = readNum('inputTotalTiming', 33.0);

    const hasNumericBaseAfr =
      base.wotAfr !== null && base.wotAfr !== undefined && Number.isFinite(Number(base.wotAfr));
    const isWeatherOnly = Boolean(!hasNumericBaseAfr || ui.weatherOnly || base.weatherOnly);
    const effectiveBaseAfr = hasNumericBaseAfr ? Number(base.wotAfr) : targetAfr;
    const afrMultiplier = isWeatherOnly
      ? 1.000
      : Math.sqrt(Math.max(0.5, Number(base.wotAfr) / targetAfr));

    let rhoRatio = 1.0;
    let effectiveNewRad = base.rad;
    let rawTelemetry = null;

    if (ui.weatherMode === 'rad') {
      const liveRad = readNum('inputRadPct', base.rad);
      effectiveNewRad = liveRad;
      rhoRatio = liveRad / base.rad; // Mode A: Kestrel RAD % exclusively
    } else {
      // Mode B: Raw Weather via Buck's equation exclusively (no double counting)
      const tempC = readNum('inputTempC', 24.0);
      const pressVal = readNum('inputPressure', ui.pressUnit === 'psi' ? 14.46 : 997.0);
      const rhPct = readNum('inputRhPct', 41);
      rawTelemetry = computeRawMoistAirTelemetry(tempC, pressVal, ui.pressUnit, rhPct);
      const rhoBase = (base.rad / 100) * ISA_STD_DENSITY;
      rhoRatio = rawTelemetry.rhoMoist / rhoBase;
      effectiveNewRad = rawTelemetry.equivRad;
    }

    const idealJetMm = calculateIdealJetMm(
      base.jetMm,
      rhoRatio,
      base.wotAfr,
      targetAfr,
      base.fuelSg,
      sgNew,
      isWeatherOnly
    );

    const unchangedAfr = calculatePredictedAfr(
      effectiveBaseAfr,
      rhoRatio,
      base.jetMm,
      base.jetMm,
      base.fuelSg,
      sgNew
    );

    return {
      base,
      hasNumericBaseAfr,
      isWeatherOnly,
      effectiveBaseAfr,
      afrMultiplier,
      targetAfr,
      sgNew,
      totalTiming,
      rhoRatio,
      densityShiftPct: (rhoRatio - 1) * 100,
      effectiveNewRad,
      rawTelemetry,
      idealJetMm,
      idealJetInch: mmToInch(idealJetMm),
      idealAreaMm2: orificeAreaMm2(idealJetMm),
      unchangedAfr,
      unchangedEndCyl: unchangedAfr + END_CYL_LEAN_OFFSET
    };
  }

  function pickToolboxTriplet(idealMm) {
    const activeJets = sortJetsByDiameter(state.jets.filter((j) => j.inToolbox));
    const pool = activeJets.length > 0 ? activeJets : sortJetsByDiameter(state.jets);

    let bestIdx = 0;
    let bestDiff = Infinity;
    pool.forEach((jet, idx) => {
      const diff = Math.abs(jet.mm - idealMm);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });

    return {
      pool,
      leaner: bestIdx > 0 ? pool[bestIdx - 1] : null,
      recommended: pool[bestIdx],
      richer: bestIdx < pool.length - 1 ? pool[bestIdx + 1] : null
    };
  }

  /* ------------------------------------------------------------------------
     5. RENDERING: TAB 1 (CALCULATOR & LOCKED BASELINE)
     ------------------------------------------------------------------------ */
  function renderLockedBaselineBar() {
    const b = state.baseline;
    $('baseSessionCarbyLabel').textContent = `${b.sessionName} • ${b.carbyId}`;
    $('baseJetLabel').textContent = b.jetLabel;
    $('baseJetSub').textContent = `${b.jetMm.toFixed(3)} mm • ${orificeAreaMm2(b.jetMm).toFixed(3)} mm² (${mmToInch(b.jetMm).toFixed(4)}")`;
    $('baseRadLabel').textContent = `${b.rad.toFixed(1)}% RAD`;
    $('baseSgLabel').textContent = `SG ${b.fuelSg.toFixed(3)} kg/L`;

    const afrCell = $('baseAfrCell');
    const afrTitle = $('baseAfrTitleLabel');
    const afrValEl = $('baseAfrLabel');
    const afrBadge = $('baseAfrStatusBadge');
    const endCylEl = $('baseEndCylLabel');

    const hasAfr = b.wotAfr !== null && b.wotAfr !== undefined && Number.isFinite(Number(b.wotAfr));

    if (!hasAfr || b.afrStatus === 'untested') {
      afrCell.className = 'telem-cell afr-estimated-cell';
      afrTitle.textContent = 'Baseline WOT AFR';
      afrValEl.textContent = 'Untested';
      afrValEl.className = 'telem-val txt-amber';
      afrBadge.textContent = 'WEATHER-ONLY (No Track AFR)';
      afrBadge.className = 'afr-status-badge estimated';
      endCylEl.textContent = 'Pure RAD % & SG 4th-root';
      endCylEl.className = 'telem-sub';
    } else if (b.afrStatus === 'estimated') {
      const numericAfr = Number(b.wotAfr);
      const endCyl = numericAfr + END_CYL_LEAN_OFFSET;
      afrCell.className = 'telem-cell afr-estimated-cell';
      afrTitle.textContent = 'Predicted WOT AFR';
      afrValEl.textContent = numericAfr.toFixed(2);
      afrValEl.className = 'telem-val txt-amber';
      afrBadge.textContent = 'ESTIMATED (Awaiting Track Read)';
      afrBadge.className = 'afr-status-badge estimated';
      endCylEl.textContent = `#1/#6 Est: ${endCyl.toFixed(2)}`;
      endCylEl.className = endCyl >= 13.25 ? 'telem-sub txt-danger' : 'telem-sub';
    } else {
      const numericAfr = Number(b.wotAfr);
      const endCyl = numericAfr + END_CYL_LEAN_OFFSET;
      afrCell.className = 'telem-cell afr-verified-cell';
      afrTitle.textContent = 'Logged WOT AFR';
      afrValEl.textContent = numericAfr.toFixed(2);
      afrValEl.className = 'telem-val';
      afrBadge.textContent = 'VERIFIED ON TRACK';
      afrBadge.className = 'afr-status-badge verified';
      endCylEl.textContent = `#1/#6: ${endCyl.toFixed(2)}`;
      endCylEl.className = endCyl >= 13.25 ? 'telem-sub txt-danger' : 'telem-sub';
    }

    $('baseCarbyOnly').textContent = b.carbyId;
    $('baseTimingLabel').textContent = `${b.timing.toFixed(1)}° BTDC`;
    $('baseFuelPsiLabel').textContent = `${b.fuelPsi.toFixed(1)} psi`;
  }

  function populateCarbySelects() {
    const selects = ['selectCalcCarby', 'editBaseCarby', 'dynoPullCarby'];
    selects.forEach((id) => {
      const sel = $(id);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = state.carbies
        .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (40mm BXUV-3)</option>`)
        .join('');
      if (prev && state.carbies.some((c) => c.id === prev)) {
        sel.value = prev;
      } else if (id === 'selectCalcCarby' || id === 'editBaseCarby') {
        sel.value = state.baseline.carbyId;
      }
    });
    updateCarbySwapHint();
  }

  const SESSION_PROGRESSION = [
    'Practice 1',
    'Practice 2',
    'Practice 3',
    'Practice 4',
    'Practice 5',
    'Practice 6',
    'Practice 7',
    'Qualifying',
    'Warm Up',
    'Race 1',
    'Race 2',
    'Race 3',
    'Race 4',
    'Final'
  ];

  function updateCustomSessionVisibility() {
    const sel = $('selectSessionName');
    const wrap = $('customSessionWrap');
    if (!sel || !wrap) return;
    wrap.style.display = sel.value === '__CUSTOM__' ? 'block' : 'none';
  }

  function syncSessionSelectFromBaseline() {
    const sel = $('selectSessionName');
    if (!sel) return;
    const baseName = (state.baseline && state.baseline.sessionName) || '';
    const idx = SESSION_PROGRESSION.indexOf(baseName);
    if (idx !== -1 && idx + 1 < SESSION_PROGRESSION.length) {
      sel.value = SESSION_PROGRESSION[idx + 1];
    } else {
      sel.value = 'Race 1';
    }
    updateCustomSessionVisibility();
  }

  function getSelectedSessionName() {
    const sel = $('selectSessionName');
    if (!sel) return `Session ${state.sessions.length + 1}`;
    if (sel.value === '__CUSTOM__') {
      const customVal = ($('inputCustomSessionName') && $('inputCustomSessionName').value || '').trim();
      return customVal || 'Custom Session';
    }
    return sel.value || 'Race 1';
  }

  function applyCarbyBaselineAnchor(carbyId) {
    const carby = state.carbies.find((c) => c.id === carbyId);
    if (!carby || !carby.baselineAnchor) return;

    const prevBaseName = state.baseline.sessionName;
    const a = carby.baselineAnchor;
    const hasVerified =
      a.verifiedAfr !== null && a.verifiedAfr !== undefined && Number.isFinite(Number(a.verifiedAfr));

    state.baseline = {
      sessionName: a.sourceLabel || `${carby.name} Anchor`,
      carbyId: carby.id,
      jetId: a.jetId || carby.fittedJetId,
      jetLabel: a.jetLabel || `#Jet (${Number(a.jetMm).toFixed(3)} mm)`,
      jetMm: Number(a.jetMm),
      rad: Number(a.rad),
      fuelSg: Number(a.fuelSg),
      wotAfr: hasVerified ? Number(a.verifiedAfr) : null,
      afrStatus: hasVerified ? 'verified' : 'untested',
      weatherOnly: !hasVerified,
      timing: Number(a.timing || 33.0),
      fuelPsi: Number(a.fuelPsi || 5.0),
      linkedSessionId: null
    };

    ui.weatherOnly = !hasVerified;

    if ($('selectCalcCarby')) {
      $('selectCalcCarby').value = carby.id;
    }
    if ($('inputFuelSg')) {
      $('inputFuelSg').value = state.baseline.fuelSg.toFixed(3);
    }
    if ($('inputTotalTiming')) {
      $('inputTotalTiming').value = state.baseline.timing.toFixed(1);
    }

    // If session dropdown was still sitting on default Race 2 from Race 1 seed when bolting on a spare/P1 carby, default to Practice 1
    const sessSel = $('selectSessionName');
    if (sessSel && sessSel.value === 'Race 2' && prevBaseName === 'Race 1' && carby.id !== '1 DME') {
      sessSel.value = 'Practice 1';
      updateCustomSessionVisibility();
    }

    saveState();
    renderAll();
    if (ui.calcStep === 2) {
      renderStep2Calculator(true);
    }
    showToast(
      `Loaded ${carby.name} anchor (${state.baseline.jetMm.toFixed(3)} mm @ ${state.baseline.rad.toFixed(1)}% RAD)`
    );
  }

  function updateCarbySwapHint() {
    const sel = $('selectCalcCarby');
    const hint = $('carbySwapHint');
    const banner1 = $('carbySwitchBanner');
    const banner2 = $('step2CarbyMismatchBanner');
    if (!sel || !hint) return;

    if (sel.value === state.baseline.carbyId) {
      hint.textContent = 'Matches Baseline';
      hint.className = 'field-hint emerald';
      if (banner1) banner1.style.display = 'none';
      if (banner2) banner2.style.display = 'none';
      return;
    }

    hint.textContent = `Baseline is ${state.baseline.carbyId}`;
    hint.className = 'field-hint amber';

    const targetCarby = state.carbies.find((c) => c.id === sel.value);
    if (!targetCarby || !targetCarby.baselineAnchor) return;

    const a = targetCarby.baselineAnchor;
    const hasVerified =
      a.verifiedAfr !== null && a.verifiedAfr !== undefined && Number.isFinite(Number(a.verifiedAfr));
    const afrSummary = hasVerified
      ? `${Number(a.verifiedAfr).toFixed(2)} Verified AFR (${a.sourceLabel})`
      : `Untested / DME Build Sheet (Weather-Only)`;

    const titleText = `Switched to ${targetCarby.name} — Load ${targetCarby.name}'s saved baseline anchor?`;
    const descText = `Active Locked Baseline is still ${state.baseline.carbyId} (${state.baseline.jetMm.toFixed(3)} mm @ ${state.baseline.rad.toFixed(1)}% RAD). Tap below to load ${targetCarby.name}: ${a.jetLabel} (${Number(a.jetMm).toFixed(3)} mm), ${Number(a.rad).toFixed(1)}% RAD, ${Number(a.fuelSg).toFixed(3)} SG • ${afrSummary}.`;
    const btnText = `LOAD ${targetCarby.name.toUpperCase()} SAVED BASELINE ANCHOR`;

    if (banner1) {
      $('carbySwitchBannerTitle').textContent = titleText;
      $('carbySwitchBannerDesc').textContent = descText;
      $('btnLoadSwitchedCarbyAnchor').textContent = btnText;
      banner1.style.display = 'block';
    }
    if (banner2) {
      $('step2CarbyMismatchTitle').textContent = titleText;
      $('step2CarbyMismatchDesc').textContent = descText;
      $('btnStep2LoadCarbyAnchor').textContent = btnText;
      banner2.style.display = 'block';
    }
  }

  function renderStep1WeatherOnlySwitch(phys) {
    const btn = $('btnToggleStep1WeatherOnly');
    const sub = $('step1WeatherOnlySub');
    const pill = $('step1WeatherOnlyPill');
    const multHint = $('step1AfrMultiplierHint');
    const tgtHint = $('targetAfrHint');
    if (!btn || !sub || !pill) return;

    btn.classList.toggle('active', phys.isWeatherOnly);
    btn.setAttribute('aria-checked', phys.isWeatherOnly ? 'true' : 'false');
    pill.textContent = phys.isWeatherOnly ? 'ON' : 'OFF';

    if (!phys.hasNumericBaseAfr) {
      sub.textContent = 'AUTO ON • Baseline has no track AFR (√AFR = 1.000×)';
    } else if (phys.isWeatherOnly) {
      sub.textContent = 'ON • Scaling purely from Kestrel RAD % & Fuel SG (1.000×)';
    } else if (phys.base.afrStatus === 'estimated') {
      sub.textContent = `OFF • Chaining from ${Number(phys.base.wotAfr).toFixed(2)} Estimated AFR`;
    } else {
      sub.textContent = `OFF • Scaling from ${Number(phys.base.wotAfr).toFixed(2)} Verified AFR`;
    }

    if (multHint) {
      multHint.textContent = phys.isWeatherOnly
        ? '√AFR mult: 1.000× (Weather-Only)'
        : `√AFR mult: ${phys.afrMultiplier.toFixed(3)}×`;
      multHint.className = phys.isWeatherOnly ? 'field-hint amber' : 'field-hint emerald';
    }

    if (tgtHint) {
      tgtHint.textContent = phys.isWeatherOnly
        ? 'Est. AFR ref only (Jet mult = 1.000×)'
        : '12.8–12.9 Power Window';
      tgtHint.className = phys.isWeatherOnly ? 'field-hint amber' : 'field-hint emerald';
    }
  }

  function renderStep1LiveHints() {
    const phys = getActiveCalcPhysics();
    const sign = phys.densityShiftPct >= 0 ? '+' : '';
    $('liveRadDeltaHint').textContent = `ρ ratio: ${phys.rhoRatio.toFixed(3)} (${sign}${phys.densityShiftPct.toFixed(1)}%)`;

    if (ui.weatherMode === 'raw' && phys.rawTelemetry) {
      const rt = phys.rawTelemetry;
      $('liveKelvinReadout').textContent = `${rt.tempK.toFixed(2)} K`;
      $('rawMoistRhoLabel').textContent = `${rt.rhoMoist.toFixed(3)} kg/m³ (${rt.equivRad.toFixed(1)}% RAD)`;
      $('rawBuckPvLabel').textContent = `${rt.pvHpa.toFixed(1)} hPa • ${rt.rhoDry.toFixed(3)} kg/m³`;
    } else {
      const tc = readNum('inputTempC', 24.0);
      $('liveKelvinReadout').textContent = `${(tc + 273.15).toFixed(2)} K`;
    }

    renderStep1WeatherOnlySwitch(phys);
    updateCarbySwapHint();
  }

  function renderStep2Calculator(autoPickRecommended = false) {
    const phys = getActiveCalcPhysics();
    const triplet = pickToolboxTriplet(phys.idealJetMm);

    if (autoPickRecommended || !ui.selectedJetId || !findJetById(ui.selectedJetId)) {
      ui.selectedJetId = triplet.recommended ? triplet.recommended.id : state.jets[0].id;
    }

    updateCarbySwapHint();

    const shiftSign = phys.densityShiftPct >= 0 ? '+' : '';
    const shiftEl = $('outDensityShift');
    shiftEl.textContent = `${shiftSign}${phys.densityShiftPct.toFixed(2)}%`;
    shiftEl.className =
      Math.abs(phys.densityShiftPct) < 0.3
        ? 'telem-val'
        : phys.densityShiftPct > 0
        ? 'telem-val txt-amber'
        : 'telem-val txt-emerald';

    $('outDensitySub').textContent = `${phys.base.rad.toFixed(1)}% → ${phys.effectiveNewRad.toFixed(1)}% RAD`;
    $('outIdealOrifice').textContent = `${phys.idealJetMm.toFixed(3)} mm (${phys.idealJetInch.toFixed(4)}")`;
    $('outIdealInchArea').textContent = phys.isWeatherOnly
      ? `${phys.idealAreaMm2.toFixed(3)} mm² • Weather-Only (1.000× AFR)`
      : `${phys.idealAreaMm2.toFixed(3)} mm² • √AFR ${phys.afrMultiplier.toFixed(3)}×`;

    $('unchangedJetName').textContent = phys.base.jetLabel;
    $('unchangedPredAfr').textContent = phys.unchangedAfr.toFixed(2);
    $('unchangedPredAfr').className =
      phys.unchangedEndCyl >= 13.25
        ? 'jet-afr-big txt-danger'
        : phys.unchangedAfr >= 12.75 && phys.unchangedAfr <= 12.95
        ? 'jet-afr-big txt-emerald'
        : 'jet-afr-big txt-amber';
    $('unchangedEndCylText').textContent = phys.hasNumericBaseAfr
      ? `#1 & #6 End-Cyl Est: ${phys.unchangedEndCyl.toFixed(2)} AFR`
      : `Weather-Only Est (#1/#6: ${phys.unchangedEndCyl.toFixed(2)} AFR)`;

    const activeCount = state.jets.filter((j) => j.inToolbox).length;
    $('activeToolboxCountHint').textContent = `${activeCount} active in toolbox`;

    const slots = [
      { role: '1 Step Leaner', jet: triplet.leaner, isRec: false },
      { role: 'Recommended Kit Jet', jet: triplet.recommended, isRec: true },
      { role: '1 Step Richer', jet: triplet.richer, isRec: false }
    ];

    const afrUnitLabel = phys.hasNumericBaseAfr ? 'AFR' : 'Est AFR';

    const container = $('toolboxJetCardsContainer');
    container.innerHTML = slots
      .map((slot) => {
        if (!slot.jet) {
          return `
            <div class="jet-card" style="opacity: 0.45; cursor: default;" aria-disabled="true">
              <div class="jet-card-top">
                <span class="jet-role-tag">${escapeHtml(slot.role)}</span>
              </div>
              <div class="jet-name-big">End of Toolbox Range</div>
              <div class="jet-card-meta"><span>Enable more jets in Tab 4</span></div>
            </div>
          `;
        }

        const predAfr = calculatePredictedAfr(
          phys.effectiveBaseAfr,
          phys.rhoRatio,
          phys.base.jetMm,
          slot.jet.mm,
          phys.base.fuelSg,
          phys.sgNew
        );
        const prot = evaluateManifoldProtection(predAfr, phys.totalTiming);
        const isSelected = ui.selectedJetId === slot.jet.id;
        const deltaTarget = predAfr - phys.targetAfr;
        const deltaStr = `${deltaTarget >= 0 ? '+' : ''}${deltaTarget.toFixed(2)} vs tgt`;
        const afrColorClass =
          prot.level === 'danger'
            ? 'txt-danger'
            : predAfr >= 12.75 && predAfr <= 12.95
            ? 'txt-emerald'
            : 'txt-amber';

        const cardClasses = [
          'jet-card',
          slot.isRec ? 'recommended' : '',
          isSelected ? 'selected' : '',
          prot.level === 'danger' ? 'danger-jet' : ''
        ]
          .filter(Boolean)
          .join(' ');

        return `
          <button
            type="button"
            class="${cardClasses}"
            data-pick-jet="${escapeHtml(slot.jet.id)}"
            aria-pressed="${isSelected ? 'true' : 'false'}"
          >
            <div class="jet-card-top">
              <span class="jet-role-tag">${escapeHtml(slot.role)}</span>
              <span class="mono" style="font-size: 15px; font-weight: 700; color: var(--text-secondary);">
                ${slot.jet.mm.toFixed(3)} mm (${mmToInch(slot.jet.mm).toFixed(4)}")
              </span>
            </div>
            <div class="jet-card-main">
              <span class="jet-name-big">${escapeHtml(slot.jet.label)}</span>
              <span class="jet-afr-big ${afrColorClass}">${predAfr.toFixed(2)} <small style="font-size: 15px;">${afrUnitLabel}</small></span>
            </div>
            <div class="jet-card-meta">
              <span class="${prot.endCylAfr >= 13.25 ? 'txt-danger' : ''}">#1/#6 Est: ${prot.endCylAfr.toFixed(2)}</span>
              <span>${orificeAreaMm2(slot.jet.mm).toFixed(3)} mm² • ${deltaStr}</span>
            </div>
          </button>
        `;
      })
      .join('');

    // Populate Full-Kit Dropdown
    const fullSelect = $('selectFullJetKit');
    fullSelect.innerHTML = sortJetsByDiameter(state.jets)
      .map((j) => {
        const pred = calculatePredictedAfr(
          phys.effectiveBaseAfr,
          phys.rhoRatio,
          phys.base.jetMm,
          j.mm,
          phys.base.fuelSg,
          phys.sgNew
        );
        const boxTag = j.inToolbox ? 'Box' : 'Out';
        return `<option value="${escapeHtml(j.id)}">${escapeHtml(j.label)} (${j.mm.toFixed(3)}mm) ${pred.toFixed(2)} AFR [${boxTag}]</option>`;
      })
      .join('');
    fullSelect.value = ui.selectedJetId;

    updateSelectedJetProtectionBanner(phys);
  }

  function updateSelectedJetProtectionBanner(phys) {
    const chosenJet = findJetById(ui.selectedJetId) || state.jets[0];
    if (!chosenJet) return;

    const predAfr = calculatePredictedAfr(
      phys.effectiveBaseAfr,
      phys.rhoRatio,
      phys.base.jetMm,
      chosenJet.mm,
      phys.base.fuelSg,
      phys.sgNew
    );
    const prot = evaluateManifoldProtection(predAfr, phys.totalTiming);

    $('selectedJetQuickSummary').textContent = `Selected: ${chosenJet.label} (${predAfr.toFixed(2)} ${phys.hasNumericBaseAfr ? 'AFR' : 'Est AFR'})`;
    const banner = $('manifoldProtectionAlert');
    banner.className = `manifold-alert ${prot.level}`;
    $('manifoldAlertTitle').textContent = prot.title;
    $('manifoldAlertBody').textContent = phys.isWeatherOnly
      ? `[Weather-Only 1.000× AFR Mode] ${prot.message}`
      : prot.message;
  }

  function setCalculatorStep(stepNum, autoPick = false) {
    ui.calcStep = stepNum;
    const s1 = $('calcStep1View');
    const s2 = $('calcStep2View');
    const b1 = $('btnStep1Nav');
    const b2 = $('btnStep2Nav');

    if (stepNum === 1) {
      s1.style.display = 'block';
      s2.style.display = 'none';
      b1.classList.add('active');
      b2.classList.remove('active');
      b1.setAttribute('aria-selected', 'true');
      b2.setAttribute('aria-selected', 'false');
      renderStep1LiveHints();
    } else {
      s1.style.display = 'none';
      s2.style.display = 'block';
      b1.classList.remove('active');
      b2.classList.add('active');
      b1.setAttribute('aria-selected', 'false');
      b2.setAttribute('aria-selected', 'true');
      renderStep2Calculator(autoPick);
    }
  }

  function confirmJetAndLockForNextRace() {
    const phys = getActiveCalcPhysics();
    const chosenJet = findJetById(ui.selectedJetId);
    if (!chosenJet) return;

    const sessionName = getSelectedSessionName();
    const carbyId = $('selectCalcCarby').value || state.baseline.carbyId;
    const modeNote = phys.isWeatherOnly ? 'Weather-Only 1.000× AFR' : `${ui.weatherMode.toUpperCase()} mode`;
    const notes =
      ($('inputRunNotes').value || '').trim() ||
      `Locked pre-run from ${phys.base.sessionName} (${modeNote}) — awaiting track wideband read.`;

    const predWot = Number(
      calculatePredictedAfr(
        phys.effectiveBaseAfr,
        phys.rhoRatio,
        phys.base.jetMm,
        chosenJet.mm,
        phys.base.fuelSg,
        phys.sgNew
      ).toFixed(2)
    );

    const newSessionId = `run_${Date.now()}`;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });

    const newSession = {
      id: newSessionId,
      venue: 'Calder Park / Track',
      sessionName,
      timestamp: `Pit ${timeLabel}`,
      carbyId,
      jetId: chosenJet.id,
      jetLabel: chosenJet.label,
      jetMm: chosenJet.mm,
      rad: Number(phys.effectiveNewRad.toFixed(1)),
      fuelSg: Number(phys.sgNew.toFixed(3)),
      timing: Number(phys.totalTiming.toFixed(1)),
      fuelPsi: state.baseline.fuelPsi,
      afr3500: Number((predWot + 0.14).toFixed(2)),
      afr4000: Number((predWot + 0.08).toFixed(2)),
      afr4500: Number((predWot + 0.04).toFixed(2)),
      afr5000: Number((predWot + 0.01).toFixed(2)),
      afrWot: predWot,
      afrStatus: 'estimated',
      notes
    };

    state.sessions.push(newSession);

    // Update fitted jet on carby fleet record too
    const carbyObj = state.carbies.find((c) => c.id === carbyId);
    if (carbyObj) {
      carbyObj.fittedJetId = chosenJet.id;
    }

    // Lock as new Baseline with Predicted_AFR stored as ESTIMATED (Awaiting Track Read)
    // so chained weather calculations into Practice 2 still work mathematically!
    state.baseline = {
      sessionName,
      carbyId,
      jetId: chosenJet.id,
      jetLabel: chosenJet.label,
      jetMm: chosenJet.mm,
      rad: Number(phys.effectiveNewRad.toFixed(1)),
      fuelSg: Number(phys.sgNew.toFixed(3)),
      wotAfr: predWot,
      afrStatus: 'estimated',
      weatherOnly: false,
      timing: Number(phys.totalTiming.toFixed(1)),
      fuelPsi: state.baseline.fuelPsi,
      linkedSessionId: newSessionId
    };
    ui.weatherOnly = false;

    saveState();

    // Sync Step 1 live RAD to the newly locked RAD & advance suggested session dropdown
    $('inputRadPct').value = state.baseline.rad.toFixed(1);
    $('inputRunNotes').value = '';
    if ($('inputCustomSessionName')) {
      $('inputCustomSessionName').value = '';
    }
    syncSessionSelectFromBaseline();

    renderAll();
    setCalculatorStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Locked ${sessionName} (${chosenJet.label}) — Estimated AFR ${predWot.toFixed(2)} awaiting track read`);
  }

  /* ------------------------------------------------------------------------
     6. RENDERING: TAB 2 (SESSION LOG, INLINE AFR EDIT, CSV & JSON)
     ------------------------------------------------------------------------ */
  function renderSessionLog() {
    const filterVal = $('filterLogCarby') ? $('filterLogCarby').value : 'ALL';
    const filtered = state.sessions.filter((s) => filterVal === 'ALL' || s.carbyId === filterVal);
    $('sessionCountBadge').textContent = `${state.sessions.length} Runs`;

    const listEl = $('sessionLogList');
    if (!listEl) return;

    // Display newest sessions at top while showing sequence index
    const ordered = [...filtered].reverse();

    listEl.innerHTML = ordered
      .map((s) => {
        const isBaseline =
          state.baseline.linkedSessionId === s.id ||
          (state.baseline.sessionName === s.sessionName &&
            state.baseline.carbyId === s.carbyId &&
            Math.abs(state.baseline.jetMm - s.jetMm) < 0.0005 &&
            Math.abs(state.baseline.rad - s.rad) < 0.05);

        const prot = evaluateManifoldProtection(s.afrWot, s.timing);
        const endCylClass = prot.level === 'danger' ? 'txt-danger' : 'txt-emerald';
        const isEditing = ui.editingSessionId === s.id;
        const isEstimated = s.afrStatus === 'estimated';
        const wotValClass = isEstimated
          ? 'txt-amber'
          : prot.level === 'danger'
          ? 'txt-danger'
          : 'txt-emerald';

        return `
          <article class="session-card ${isBaseline ? 'is-baseline' : ''}" data-session-id="${escapeHtml(s.id)}">
            <div class="session-head">
              <div>
                <div class="session-title-line">
                  ${escapeHtml(s.sessionName)} &bull; <span class="txt-amber">${escapeHtml(s.carbyId)}</span>
                </div>
                <div class="session-meta-line">
                  ${escapeHtml(s.venue || 'Calder Park')} (${escapeHtml(s.timestamp || '')}) &bull;
                  <strong>${escapeHtml(s.jetLabel)}</strong> (${s.jetMm.toFixed(3)}mm) &bull;
                  ${s.rad.toFixed(1)}% RAD &bull; ${s.timing.toFixed(1)}&deg; &bull; ${s.fuelPsi.toFixed(1)} psi
                </div>
              </div>
              <div style="text-align: right; flex-shrink: 0;">
                ${
                  isBaseline
                    ? '<span class="locked-badge">Baseline</span>'
                    : `<span class="mono ${endCylClass}" style="font-size: 0.75rem; font-weight: 800;">#1/#6: ${prot.endCylAfr.toFixed(2)}</span>`
                }
                <div style="margin-top: 4px;">
                  <span class="afr-status-badge ${isEstimated ? 'estimated' : 'verified'}">
                    ${isEstimated ? 'ESTIMATED' : 'VERIFIED'}
                  </span>
                </div>
              </div>
            </div>

            <div class="afr-rpm-strip">
              <div class="afr-pill">
                <span class="afr-pill-rpm">3500</span>
                <span class="afr-pill-val">${Number(s.afr3500).toFixed(2)}</span>
              </div>
              <div class="afr-pill">
                <span class="afr-pill-rpm">4000</span>
                <span class="afr-pill-val">${Number(s.afr4000).toFixed(2)}</span>
              </div>
              <div class="afr-pill">
                <span class="afr-pill-rpm">4500</span>
                <span class="afr-pill-val">${Number(s.afr4500).toFixed(2)}</span>
              </div>
              <div class="afr-pill">
                <span class="afr-pill-rpm">5000</span>
                <span class="afr-pill-val">${Number(s.afr5000).toFixed(2)}</span>
              </div>
              <div class="afr-pill wot-pill">
                <span class="afr-pill-rpm">WOT</span>
                <span class="afr-pill-val ${wotValClass}">${Number(s.afrWot).toFixed(2)}</span>
              </div>
            </div>

            ${s.notes ? `<p style="margin: 6px 0 4px; font-size: 0.77rem; color: var(--text-secondary);">${escapeHtml(s.notes)}</p>` : ''}

            <div class="session-actions">
              <button type="button" class="btn btn-secondary" data-edit-session-afr="${escapeHtml(s.id)}">
                ${isEditing ? 'Cancel Edit' : 'Edit Post-Race AFR'}
              </button>
              <button type="button" class="btn ${isBaseline ? 'btn-emerald-outline' : 'btn-amber-outline'}" data-lock-session="${escapeHtml(s.id)}">
                ${isBaseline ? 'Locked Baseline' : 'Lock as Baseline'}
              </button>
            </div>

            ${
              isEditing
                ? renderInlineSessionAfrEditor(s)
                : ''
            }
          </article>
        `;
      })
      .join('');
  }

  function renderInlineSessionAfrEditor(s) {
    const fields = [
      { key: '3500', label: '3500 RPM', val: s.afr3500 },
      { key: '4000', label: '4000 RPM', val: s.afr4000 },
      { key: '4500', label: '4500 RPM', val: s.afr4500 },
      { key: '5000', label: '5000 RPM', val: s.afr5000 },
      { key: 'Wot', label: 'WOT Collector AFR', val: s.afrWot }
    ];
    return `
      <div class="inline-afr-editor">
        <div class="form-grid-2 stack-mobile" style="margin-bottom: 10px;">
          ${fields
            .map(
              (f) => `
              <div class="field-group" style="margin-bottom: 0;">
                <label class="field-label" for="inlineAfr_${escapeHtml(s.id)}_${f.key}">${f.label}</label>
                <div class="num-stepper">
                  <button type="button" class="stepper-btn" data-stepper-target="inlineAfr_${escapeHtml(s.id)}_${f.key}" data-step="-0.05" aria-label="Decrease ${f.label}">&minus;</button>
                  <div class="num-input-wrap">
                    <input type="number" id="inlineAfr_${escapeHtml(s.id)}_${f.key}" class="num-input" value="${Number(f.val).toFixed(2)}" min="10.00" max="16.00" step="0.05" />
                  </div>
                  <button type="button" class="stepper-btn" data-stepper-target="inlineAfr_${escapeHtml(s.id)}_${f.key}" data-step="0.05" aria-label="Increase ${f.label}">+</button>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
        <button type="button" class="btn btn-confirm btn-full" data-save-session-afr="${escapeHtml(s.id)}">
          Save Post-Race AFRs
        </button>
      </div>
    `;
  }

  function exportSessionsCsv() {
    const headers = [
      'Session',
      'Venue',
      'Timestamp',
      'Carby_ID',
      'Jet_Label',
      'Jet_mm',
      'RAD_Pct',
      'Fuel_SG',
      'Timing_BTDC',
      'Fuel_PSI',
      'AFR_3500',
      'AFR_4000',
      'AFR_4500',
      'AFR_5000',
      'AFR_WOT',
      'AFR_Status',
      'EndCyl_1_6_Est',
      'Notes'
    ];
    const rows = state.sessions.map((s) => [
      s.sessionName,
      s.venue || 'Calder Park',
      s.timestamp || '',
      s.carbyId,
      s.jetLabel,
      s.jetMm.toFixed(4),
      s.rad.toFixed(1),
      s.fuelSg.toFixed(3),
      s.timing.toFixed(1),
      s.fuelPsi.toFixed(1),
      Number(s.afr3500).toFixed(2),
      Number(s.afr4000).toFixed(2),
      Number(s.afr4500).toFixed(2),
      Number(s.afr5000).toFixed(2),
      Number(s.afrWot).toFixed(2),
      s.afrStatus === 'estimated' ? 'ESTIMATED' : 'VERIFIED',
      (Number(s.afrWot) + END_CYL_LEAN_OFFSET).toFixed(2),
      s.notes || ''
    ]);

    const csvText = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    triggerDownload(csvText, 'snb-hq202-sessions.csv', 'text/csv;charset=utf-8;');
    showToast('Exported Session Log CSV');
  }

  function backupJsonState() {
    const payload = JSON.stringify(
      {
        app: 'SNB Racing — HQ 202 Jetting & AFR (v0.3 Dark Edition)',
        exportedAt: new Date().toISOString(),
        state
      },
      null,
      2
    );
    triggerDownload(payload, 'snb-hq202-backup.json', 'application/json');
    showToast('Downloaded JSON Backup');
  }

  function restoreJsonState(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const candidate = parsed.state ? parsed.state : parsed;
        if (!candidate.baseline || !Array.isArray(candidate.sessions) || !Array.isArray(candidate.jets)) {
          throw new Error('Invalid SNB backup schema');
        }
        state = hydrateState(candidate);
        ui.weatherOnly = Boolean(state.baseline.weatherOnly || state.baseline.wotAfr === null);
        saveState();
        syncSessionSelectFromBaseline();
        renderAll();
        showToast(`Restored ${state.sessions.length} sessions from JSON backup`);
      } catch (err) {
        showToast('Invalid JSON backup file');
      }
    };
    reader.readAsText(file);
  }

  function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------------
     7. RENDERING: TAB 3 (DYNO LAB DUAL HTML5 CANVAS + OVERLAYS)
     ------------------------------------------------------------------------ */
  const DYNO_COLORS = ['#F59E0B', '#10B981', '#38BDF8', '#FB7185', '#A3E635', '#F472B6'];

  function renderDynoRpmFormInputs() {
    const rpms = [3500, 4000, 4500, 5000, 5500];
    const defaults = {
      3500: { hp: 109.5, tq: 164.3, afr: 12.90 },
      4000: { hp: 125.0, tq: 164.1, afr: 12.86 },
      4500: { hp: 136.0, tq: 158.7, afr: 12.84 },
      5000: { hp: 140.5, tq: 147.6, afr: 12.82 },
      5500: { hp: 136.0, tq: 129.9, afr: 12.80 }
    };
    const container = $('dynoRpmInputsContainer');
    if (!container) return;

    container.innerHTML = rpms
      .map((rpm) => {
        const d = defaults[rpm];
        return `
          <div class="card-elevated" style="margin-bottom: 8px;">
            <div style="font-size: 0.78rem; font-weight: 800; color: var(--amber); margin-bottom: 6px;">${rpm} RPM Telemetry</div>
            <div class="form-grid-2 stack-mobile" style="margin-bottom: 8px;">
              <div>
                <label class="field-label" for="dynoHp_${rpm}">RWHP</label>
                <div class="num-stepper">
                  <button type="button" class="stepper-btn" data-stepper-target="dynoHp_${rpm}" data-step="-0.5" aria-label="Decrease ${rpm} HP">&minus;</button>
                  <div class="num-input-wrap">
                    <input type="number" id="dynoHp_${rpm}" class="num-input" value="${d.hp.toFixed(1)}" min="50" max="260" step="0.5" />
                    <span class="num-unit-badge">HP</span>
                  </div>
                  <button type="button" class="stepper-btn" data-stepper-target="dynoHp_${rpm}" data-step="0.5" aria-label="Increase ${rpm} HP">+</button>
                </div>
              </div>
              <div>
                <label class="field-label" for="dynoTq_${rpm}">Torque (ft&middot;lb)</label>
                <div class="num-stepper">
                  <button type="button" class="stepper-btn" data-stepper-target="dynoTq_${rpm}" data-step="-0.5" aria-label="Decrease ${rpm} Torque">&minus;</button>
                  <div class="num-input-wrap">
                    <input type="number" id="dynoTq_${rpm}" class="num-input" value="${d.tq.toFixed(1)}" min="60" max="300" step="0.5" />
                    <span class="num-unit-badge">ft&middot;lb</span>
                  </div>
                  <button type="button" class="stepper-btn" data-stepper-target="dynoTq_${rpm}" data-step="0.5" aria-label="Increase ${rpm} Torque">+</button>
                </div>
              </div>
            </div>
            <div>
              <label class="field-label" for="dynoAfr_${rpm}">Wideband AFR @ ${rpm}</label>
              <div class="num-stepper">
                <button type="button" class="stepper-btn" data-stepper-target="dynoAfr_${rpm}" data-step="-0.05" aria-label="Decrease ${rpm} AFR">&minus;</button>
                <div class="num-input-wrap">
                  <input type="number" id="dynoAfr_${rpm}" class="num-input" value="${d.afr.toFixed(2)}" min="10.5" max="15.5" step="0.05" />
                  <span class="num-unit-badge">AFR</span>
                </div>
                <button type="button" class="stepper-btn" data-stepper-target="dynoAfr_${rpm}" data-step="0.05" aria-label="Increase ${rpm} AFR">+</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderDynoPullList() {
    const listEl = $('dynoPullToggleList');
    if (!listEl) return;

    listEl.innerHTML = state.dynoPulls
      .map((p) => {
        const peakHp = Math.max(...p.points.map((pt) => pt.hp));
        const peakTq = Math.max(...p.points.map((pt) => pt.tq));
        return `
          <button
            type="button"
            class="pull-toggle-btn ${p.visible ? '' : 'off'}"
            data-toggle-pull="${escapeHtml(p.id)}"
            aria-pressed="${p.visible ? 'true' : 'false'}"
          >
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
              <span class="pull-swatch" style="background: ${escapeHtml(p.color)};"></span>
              <div style="min-width: 0;">
                <div style="font-size: 0.84rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(p.name)}
                </div>
                <div class="mono" style="font-size: 0.71rem; color: var(--text-muted);">
                  Peak ${peakHp.toFixed(1)} HP &bull; ${peakTq.toFixed(1)} ft&middot;lb &bull; ${p.rad.toFixed(1)}% RAD
                </div>
              </div>
            </div>
            <span style="font-size: 0.72rem; font-weight: 800; color: ${p.visible ? 'var(--emerald)' : 'var(--text-muted)'};">
              ${p.visible ? 'ON' : 'OFF'}
            </span>
          </button>
        `;
      })
      .join('');
  }

  function interpolatePullAtRpm(pull, rpm) {
    const pts = [...pull.points].sort((a, b) => a.rpm - b.rpm);
    if (pts.length === 0) return { hp: 0, tq: 0, afr: 12.85 };
    if (rpm <= pts[0].rpm) return pts[0];
    if (rpm >= pts[pts.length - 1].rpm) return pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      if (rpm >= p0.rpm && rpm <= p1.rpm) {
        const t = (rpm - p0.rpm) / (p1.rpm - p0.rpm);
        return {
          hp: p0.hp + t * (p1.hp - p0.hp),
          tq: p0.tq + t * (p1.tq - p0.tq),
          afr: p0.afr + t * (p1.afr - p0.afr)
        };
      }
    }
    return pts[0];
  }

  function renderDynoCanvas() {
    const canvas = $('dynoCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(300, Math.floor(rect.width || 340));
    const cssH = 390;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear background (#090B0E)
    ctx.fillStyle = '#090B0E';
    ctx.fillRect(0, 0, cssW, cssH);

    const padL = 42;
    const padR = 14;
    const plotW = cssW - padL - padR;

    // Upper Plot: HP & Torque (y: 16 -> 186)
    const topY = 18;
    const topH = 166;

    // Lower Plot: Wideband AFR 3500-5500 RPM (y: 214 -> 358)
    const botY = 214;
    const botH = 144;

    const minRpm = 3500;
    const maxRpm = 5500;
    const xForRpm = (rpm) => padL + ((rpm - minRpm) / (maxRpm - minRpm)) * plotW;

    // Determine Y ranges
    const activePulls = state.dynoPulls.filter((p) => p.visible);
    let minPwr = 95;
    let maxPwr = 175;
    if (activePulls.length > 0) {
      const vals = activePulls.flatMap((p) => p.points.flatMap((pt) => [pt.hp, pt.tq]));
      minPwr = Math.min(95, Math.floor(Math.min(...vals) / 10) * 10 - 5);
      maxPwr = Math.max(175, Math.ceil(Math.max(...vals) / 10) * 10 + 5);
    }
    const yForPwr = (v) => topY + topH - ((v - minPwr) / (maxPwr - minPwr)) * topH;

    const minAfr = 12.10;
    const maxAfr = 13.50;
    const yForAfr = (afr) => botY + botH - ((afr - minAfr) / (maxAfr - minAfr)) * botH;

    // Grid lines & axes
    ctx.strokeStyle = '#1D2532';
    ctx.lineWidth = 1;
    ctx.font = '700 10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = '#94A3B8';

    // Vertical RPM grid lines (3500 to 5500 every 250 RPM)
    for (let rpm = 3500; rpm <= 5500; rpm += 250) {
      const x = xForRpm(rpm);
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY + topH);
      ctx.moveTo(x, botY);
      ctx.lineTo(x, botY + botH);
      ctx.stroke();

      if (rpm % 500 === 0) {
        ctx.textAlign = 'center';
        ctx.fillText(String(rpm), x, botY + botH + 16);
      }
    }

    // Upper horizontal grid (HP / Torque)
    const pwrStep = 20;
    ctx.textAlign = 'right';
    for (let v = Math.ceil(minPwr / pwrStep) * pwrStep; v <= maxPwr; v += pwrStep) {
      const y = yForPwr(v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(String(v), padL - 6, y + 3);
    }

    // Title labels inside plots
    ctx.textAlign = 'left';
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '800 10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('RWHP (SOLID) & TORQUE FT·LB (DASHED)', padL + 4, topY - 4);
    ctx.fillText('WIDEBAND COLLECTOR AFR (3500–5500 RPM)', padL + 4, botY - 5);

    // Lower Plot: Shaded 12.75–12.95 Sweet-Spot Band
    const ySweetTop = yForAfr(12.95);
    const ySweetBot = yForAfr(12.75);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
    ctx.fillRect(padL, ySweetTop, plotW, ySweetBot - ySweetTop);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, ySweetTop);
    ctx.lineTo(padL + plotW, ySweetTop);
    ctx.moveTo(padL, ySweetBot);
    ctx.lineTo(padL + plotW, ySweetBot);
    ctx.stroke();

    // #1/#6 >= 13.25 Lean Danger Line (12.98 Collector AFR)
    const yDanger = yForAfr(12.98);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.beginPath();
    ctx.moveTo(padL, yDanger);
    ctx.lineTo(padL + plotW, yDanger);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#10B981';
    ctx.font = '700 9.5px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('12.75–12.95 SWEET SPOT', padL + plotW - 4, ySweetBot + 11);

    ctx.fillStyle = '#EF4444';
    ctx.fillText('#1/#6 LEAN LIMIT (12.98+)', padL + plotW - 4, yDanger - 4);

    // AFR Y-axis ticks
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 10px ui-monospace, monospace';
    [12.2, 12.5, 12.8, 13.1, 13.4].forEach((afr) => {
      const y = yForAfr(afr);
      ctx.strokeStyle = '#1D2532';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(afr.toFixed(1), padL - 6, y + 3);
    });

    // Plot frames
    ctx.strokeStyle = '#263040';
    ctx.strokeRect(padL, topY, plotW, topH);
    ctx.strokeRect(padL, botY, plotW, botH);

    // Draw Active Pull Curves
    activePulls.forEach((pull) => {
      const pts = [...pull.points]
        .filter((p) => p.rpm >= minRpm && p.rpm <= maxRpm)
        .sort((a, b) => a.rpm - b.rpm);
      if (pts.length < 2) return;

      // 1. HP Solid Line
      ctx.strokeStyle = pull.color;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([]);
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const x = xForRpm(pt.rpm);
        const y = yForPwr(pt.hp);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 2. Torque Dashed Line
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const x = xForRpm(pt.rpm);
        const y = yForPwr(pt.tq);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 3. AFR Solid Line + Dots
      ctx.lineWidth = 2.3;
      ctx.setLineDash([]);
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const x = xForRpm(pt.rpm);
        const y = yForAfr(Math.max(minAfr, Math.min(maxAfr, pt.afr)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      pts.forEach((pt) => {
        const x = xForRpm(pt.rpm);
        const y = yForAfr(Math.max(minAfr, Math.min(maxAfr, pt.afr)));
        ctx.fillStyle = pull.color;
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Vertical Scrub Cursor
    if (ui.dynoScrubRpm >= minRpm && ui.dynoScrubRpm <= maxRpm) {
      const sx = xForRpm(ui.dynoScrubRpm);
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, topY);
      ctx.lineTo(sx, topY + topH);
      ctx.moveTo(sx, botY);
      ctx.lineTo(sx, botY + botH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    updateDynoScrubReadout(activePulls);
  }

  function updateDynoScrubReadout(activePulls) {
    const bar = $('dynoScrubReadout');
    if (!bar) return;
    if (!activePulls || activePulls.length === 0) {
      bar.innerHTML = `<span>Enable a dyno pull below to view curves</span>`;
      return;
    }
    const lead = activePulls[0];
    const sample = interpolatePullAtRpm(lead, ui.dynoScrubRpm);
    const endCyl = sample.afr + END_CYL_LEAN_OFFSET;
    bar.innerHTML = `
      <span><strong>${Math.round(ui.dynoScrubRpm)} RPM</strong> (${escapeHtml(lead.carbyId)})</span>
      <span class="mono">
        <strong>${sample.hp.toFixed(1)}</strong> HP &bull;
        <strong>${sample.tq.toFixed(1)}</strong> ft&middot;lb &bull;
        AFR <strong class="${endCyl >= 13.25 ? 'txt-danger' : 'txt-emerald'}">${sample.afr.toFixed(2)}</strong>
        (#1/#6 ${endCyl.toFixed(2)})
      </span>
    `;
  }

  function importDynoCsvFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result)
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const points = [];
        lines.forEach((line) => {
          const cols = line.split(/[,;\t]/).map((c) => parseFloat(c.replace(/"/g, '').trim()));
          if (cols.length >= 4 && Number.isFinite(cols[0]) && cols[0] >= 2500 && cols[0] <= 7000) {
            points.push({
              rpm: cols[0],
              hp: cols[1],
              tq: cols[2],
              afr: cols[3]
            });
          }
        });
        if (points.length < 2) {
          showToast('CSV needs at least 2 rows of: rpm,hp,torque,afr');
          return;
        }
        const color = DYNO_COLORS[state.dynoPulls.length % DYNO_COLORS.length];
        const pullName = file.name.replace(/\.[^.]+$/, '');
        state.dynoPulls.push({
          id: `dyno_${Date.now()}`,
          name: `${pullName} (CSV)`,
          carbyId: state.baseline.carbyId,
          color,
          rad: state.baseline.rad,
          timing: state.baseline.timing,
          visible: true,
          points: points.sort((a, b) => a.rpm - b.rpm)
        });
        saveState();
        renderDynoPullList();
        renderDynoCanvas();
        showToast(`Imported ${points.length} RPM points from ${file.name}`);
      } catch (err) {
        showToast('Could not parse Dyno CSV file');
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------------
     8. RENDERING: TAB 4 (40MM CARBY FLEET & M1 JET KIT)
     ------------------------------------------------------------------------ */
  function renderCarbyFleet() {
    const container = $('carbyFleetContainer');
    if (!container) return;

    container.innerHTML = state.carbies
      .map((c) => {
        const fittedJet = findJetById(c.fittedJetId);
        const jetText = fittedJet ? `${fittedJet.label} (${fittedJet.mm.toFixed(3)} mm)` : 'Unassigned';
        const venturiLegal = c.venturiMm <= 30.94;
        const exitLegal = c.exitMm <= 40.00;
        const allLegal = venturiLegal && exitLegal && c.studsMm === 75.0;

        const a = c.baselineAnchor || {
          jetLabel: jetText,
          jetMm: fittedJet ? fittedJet.mm : 2.000,
          rad: 94.3,
          fuelSg: 0.740,
          verifiedAfr: null,
          sourceLabel: 'Fleet Anchor'
        };
        const hasVerifiedAfr =
          a.verifiedAfr !== null && a.verifiedAfr !== undefined && Number.isFinite(Number(a.verifiedAfr));
        const anchorAfrText = hasVerifiedAfr
          ? `${Number(a.verifiedAfr).toFixed(2)} Verified AFR (${a.sourceLabel})`
          : `Untested / Weather-Only (${a.sourceLabel})`;

        return `
          <div class="carby-card">
            <div class="session-head" style="margin-bottom: 6px;">
              <div>
                <div class="session-title-line">${escapeHtml(c.name)}</div>
                <div class="session-meta-line">${escapeHtml(c.bodyType)}</div>
              </div>
              <span class="locked-badge" style="${allLegal ? '' : 'color: var(--danger); background: var(--danger-dim);'}">
                ${allLegal ? 'Grp 3H Legal' : 'Check Bore'}
              </span>
            </div>

            <div class="carby-specs-grid">
              <div class="telem-cell">
                <span class="telem-label">Studs / Venturi</span>
                <span class="telem-val">${c.studsMm.toFixed(0)} mm / ${c.venturiMm.toFixed(2)} mm</span>
                <span class="telem-sub">&le; 30.94 mm limit</span>
              </div>
              <div class="telem-cell">
                <span class="telem-label">Exit Port / Spill</span>
                <span class="telem-val">${c.exitMm.toFixed(2)} mm / ${c.spillMm.toFixed(1)} mm</span>
                <span class="telem-sub">&le; 40.00 mm &bull; 15.0 spill</span>
              </div>
              <div class="telem-cell">
                <span class="telem-label">Saved Baseline Anchor</span>
                <span class="telem-val txt-amber">${Number(a.jetMm).toFixed(3)} mm @ ${Number(a.rad).toFixed(1)}%</span>
                <span class="telem-sub">${escapeHtml(a.jetLabel)} &bull; SG ${Number(a.fuelSg).toFixed(3)}</span>
              </div>
              <div class="telem-cell">
                <span class="telem-label">Anchor WOT AFR</span>
                <span class="telem-val ${hasVerifiedAfr ? 'txt-emerald' : 'txt-amber'}">${hasVerifiedAfr ? Number(a.verifiedAfr).toFixed(2) : 'Untested'}</span>
                <span class="telem-sub">${escapeHtml(anchorAfrText)}</span>
              </div>
            </div>

            <p style="margin: 6px 0 10px; font-size: 0.78rem; color: var(--text-secondary);">${escapeHtml(c.notes || '')}</p>

            <div class="form-grid-2">
              <button type="button" class="btn btn-amber-outline" data-load-carby-anchor="${escapeHtml(c.id)}">
                Load ${escapeHtml(c.name)} Anchor
              </button>
              <button type="button" class="btn btn-secondary" data-edit-carby="${escapeHtml(c.id)}">
                Edit Bench Specs
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderJetInventory() {
    const listEl = $('jetInventoryList');
    if (!listEl) return;

    const sorted = sortJetsByDiameter(state.jets);
    const inBoxCount = sorted.filter((j) => j.inToolbox).length;
    $('toolboxSummaryBadge').textContent = `${inBoxCount} / ${sorted.length} In Box`;

    listEl.innerHTML = sorted
      .map((j) => {
        const inch = mmToInch(j.mm);
        const area = orificeAreaMm2(j.mm);
        const rowClass = [
          'jet-inv-row',
          j.custom ? 'custom-drill' : '',
          j.inToolbox ? '' : 'out-of-box'
        ]
          .filter(Boolean)
          .join(' ');

        return `
          <div class="${rowClass}">
            <div>
              <div style="font-size: 0.92rem; font-weight: 800; color: var(--text);">
                ${escapeHtml(j.label)}
              </div>
              <div style="font-size: 0.69rem; color: ${j.custom ? 'var(--amber)' : 'var(--text-muted)'};">
                ${escapeHtml(j.stamp || (j.custom ? 'Custom Drill' : 'M1 .001" Series'))}
              </div>
            </div>

            <div class="mono" style="font-size: 0.76rem; color: var(--text-secondary);">
              <div><strong>${j.mm.toFixed(3)} mm</strong> (${inch.toFixed(4)}")</div>
              <div style="color: var(--text-muted);">${area.toFixed(3)} mm&sup2; area</div>
            </div>

            <button
              type="button"
              class="toggle-box-btn ${j.inToolbox ? 'in-box' : 'out-box'}"
              data-toggle-jet-box="${escapeHtml(j.id)}"
              aria-pressed="${j.inToolbox ? 'true' : 'false'}"
            >
              ${j.inToolbox ? 'In Toolbox' : 'Out'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  function updateOrificeConverter(source) {
    let mmVal = readNum('convMmInput', 1.981);
    let inchVal = readNum('convInchInput', 0.0780);

    if (source === 'inch') {
      mmVal = inchToMm(inchVal);
      $('convMmInput').value = mmVal.toFixed(3);
    } else {
      inchVal = mmToInch(mmVal);
      $('convInchInput').value = inchVal.toFixed(4);
    }

    const area = orificeAreaMm2(mmVal);
    const baseArea = orificeAreaMm2(2.000);
    const areaPct = ((area - baseArea) / baseArea) * 100;

    $('convAreaOut').textContent = `${area.toFixed(3)} mm²`;
    $('convVsBaseOut').textContent = `${areaPct >= 0 ? '+' : ''}${areaPct.toFixed(2)}% area vs 2.000 mm`;

    const sorted = sortJetsByDiameter(state.jets);
    let nearest = sorted[0];
    let bestDiff = Infinity;
    sorted.forEach((j) => {
      const d = Math.abs(j.mm - mmVal);
      if (d < bestDiff) {
        bestDiff = d;
        nearest = j;
      }
    });
    if (nearest) {
      $('convNearestJetOut').textContent = `${nearest.label} (${nearest.mm.toFixed(3)} mm)`;
      $('convStampHint').textContent = `Δ ${(mmVal - nearest.mm >= 0 ? '+' : '')}${(mmVal - nearest.mm).toFixed(3)} mm`;
    }
  }

  /* ------------------------------------------------------------------------
     9. MODALS & INTERACTION HANDLERS
     ------------------------------------------------------------------------ */
  function openModal(id) {
    const m = $(id);
    if (m) m.classList.add('open');
  }

  function closeModal(id) {
    const m = $(id);
    if (m) m.classList.remove('open');
  }

  function openPostRaceAfrModal() {
    const b = state.baseline;
    const refAfr =
      b.wotAfr !== null && b.wotAfr !== undefined && Number.isFinite(Number(b.wotAfr))
        ? Number(b.wotAfr)
        : 12.80;
    $('postRaceModalSessionLabel').textContent = `${b.sessionName} (${b.carbyId} • ${b.jetLabel})`;
    $('modalPostWotAfr').value = refAfr.toFixed(2);
    $('modalPostEndCylPreview').textContent = `#1/#6 Est: ${(refAfr + END_CYL_LEAN_OFFSET).toFixed(2)}`;

    const linked = state.sessions.find((s) => s.id === b.linkedSessionId);
    $('modalPost3500').value = linked ? Number(linked.afr3500).toFixed(2) : (refAfr + 0.16).toFixed(2);
    $('modalPost4000').value = linked ? Number(linked.afr4000).toFixed(2) : (refAfr + 0.10).toFixed(2);
    $('modalPost4500').value = linked ? Number(linked.afr4500).toFixed(2) : (refAfr + 0.05).toFixed(2);
    $('modalPost5000').value = linked ? Number(linked.afr5000).toFixed(2) : (refAfr + 0.02).toFixed(2);

    openModal('modalPostRaceAfr');
  }

  function savePostRaceAfrModal() {
    const fallbackAfr =
      state.baseline.wotAfr !== null && Number.isFinite(Number(state.baseline.wotAfr))
        ? Number(state.baseline.wotAfr)
        : 12.80;
    const wot = readNum('modalPostWotAfr', fallbackAfr);
    const a35 = readNum('modalPost3500', wot + 0.15);
    const a40 = readNum('modalPost4000', wot + 0.10);
    const a45 = readNum('modalPost4500', wot + 0.05);
    const a50 = readNum('modalPost5000', wot + 0.02);

    state.baseline.wotAfr = Number(wot.toFixed(2));
    state.baseline.afrStatus = 'verified';
    state.baseline.weatherOnly = false;
    ui.weatherOnly = false;

    const linked = state.sessions.find((s) => s.id === state.baseline.linkedSessionId);
    if (linked) {
      linked.afr3500 = Number(a35.toFixed(2));
      linked.afr4000 = Number(a40.toFixed(2));
      linked.afr4500 = Number(a45.toFixed(2));
      linked.afr5000 = Number(a50.toFixed(2));
      linked.afrWot = Number(wot.toFixed(2));
      linked.afrStatus = 'verified';
    }

    // Update the matching carby's saved baseline anchor with the newly verified track reading
    const carby = state.carbies.find((c) => c.id === state.baseline.carbyId);
    if (carby && carby.baselineAnchor) {
      carby.baselineAnchor.jetId = state.baseline.jetId;
      carby.baselineAnchor.jetLabel = state.baseline.jetLabel;
      carby.baselineAnchor.jetMm = state.baseline.jetMm;
      carby.baselineAnchor.rad = state.baseline.rad;
      carby.baselineAnchor.fuelSg = state.baseline.fuelSg;
      carby.baselineAnchor.verifiedAfr = state.baseline.wotAfr;
      carby.baselineAnchor.sourceLabel = state.baseline.sessionName;
    }

    saveState();
    closeModal('modalPostRaceAfr');
    renderAll();
    showToast(`Verified Post-Race WOT AFR (${wot.toFixed(2)}) on Track`);
  }

  function syncEditBaselineModalWeatherOnlyUi() {
    const btn = $('btnToggleEditBaseWeatherOnly');
    const pill = $('editBaseWeatherOnlyPill');
    const sub = $('editBaseWeatherOnlySub');
    const hint = $('editBaseWeatherOnlyHint');
    const afrGroup = $('editBaseWotAfrGroup');
    if (!btn || !pill || !sub || !afrGroup) return;

    const isWo = Boolean(ui.editBaseWeatherOnly);
    btn.classList.toggle('active', isWo);
    btn.setAttribute('aria-checked', isWo ? 'true' : 'false');
    pill.textContent = isWo ? 'ON (1.000×)' : 'OFF';
    sub.textContent = isWo
      ? 'ON • No Verified AFR — scales purely from RAD % & SG'
      : 'OFF • Baseline has Verified Track AFR';
    if (hint) {
      hint.textContent = isWo ? 'Weather-Only (1.000×)' : 'Verified AFR Mode';
      hint.className = isWo ? 'field-hint amber' : 'field-hint emerald';
    }
    afrGroup.classList.toggle('field-disabled-overlay', isWo);
  }

  function openEditBaselineModal() {
    const b = state.baseline;
    populateCarbySelects();
    const jetSel = $('editBaseJet');
    jetSel.innerHTML = sortJetsByDiameter(state.jets)
      .map((j) => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.label)} (${j.mm.toFixed(3)} mm)</option>`)
      .join('');

    $('editBaseSession').value = b.sessionName;
    $('editBaseCarby').value = b.carbyId;
    if (state.jets.some((j) => j.id === b.jetId)) {
      jetSel.value = b.jetId;
    } else {
      const near = findNearestJetByMm(b.jetMm);
      if (near) jetSel.value = near.id;
    }
    if ($('editBaseJetMm')) {
      $('editBaseJetMm').value = Number(b.jetMm).toFixed(3);
    }
    $('editBaseRad').value = b.rad.toFixed(1);
    $('editBaseSg').value = b.fuelSg.toFixed(3);

    const hasNumericAfr =
      b.wotAfr !== null && b.wotAfr !== undefined && Number.isFinite(Number(b.wotAfr));
    ui.editBaseWeatherOnly = Boolean(b.weatherOnly || !hasNumericAfr || b.afrStatus === 'untested');
    $('editBaseWotAfr').value = hasNumericAfr ? Number(b.wotAfr).toFixed(2) : '12.50';
    syncEditBaselineModalWeatherOnlyUi();

    $('editBaseTiming').value = b.timing.toFixed(1);
    $('editBaseFuelPsi').value = b.fuelPsi.toFixed(1);

    openModal('modalEditBaseline');
  }

  function saveEditBaselineModal() {
    const jet = findJetById($('editBaseJet').value) || state.jets[0];
    const jetMm = Number(readNum('editBaseJetMm', jet.mm).toFixed(4));
    const isCustomMm = Math.abs(jetMm - jet.mm) > 0.0015;
    const jetLabel = isCustomMm
      ? `${jet.label.split('/')[0].trim()} / ${jetMm.toFixed(3)} mm`
      : jet.label;

    const isWo = Boolean(ui.editBaseWeatherOnly);
    const wotAfrVal = isWo ? null : Number(readNum('editBaseWotAfr', 12.50).toFixed(2));

    state.baseline = {
      sessionName: ($('editBaseSession').value || '').trim() || 'Baseline',
      carbyId: $('editBaseCarby').value || '1 DME',
      jetId: jet.id,
      jetLabel,
      jetMm,
      rad: Number(readNum('editBaseRad', 94.3).toFixed(1)),
      fuelSg: Number(readNum('editBaseSg', 0.740).toFixed(3)),
      wotAfr: wotAfrVal,
      afrStatus: isWo ? 'untested' : 'verified',
      weatherOnly: isWo,
      timing: Number(readNum('editBaseTiming', 33.0).toFixed(1)),
      fuelPsi: Number(readNum('editBaseFuelPsi', 5.0).toFixed(1)),
      linkedSessionId: null
    };
    ui.weatherOnly = isWo;

    if ($('selectCalcCarby')) {
      $('selectCalcCarby').value = state.baseline.carbyId;
    }
    saveState();
    closeModal('modalEditBaseline');
    syncSessionSelectFromBaseline();
    renderAll();
    showToast(
      `Locked ${state.baseline.sessionName} (${state.baseline.jetMm.toFixed(3)} mm${isWo ? ' • Weather-Only' : ''})`
    );
  }

  function syncEditCarbyAnchorUntestedUi() {
    const btn = $('btnToggleCarbyAnchorUntested');
    const pill = $('editCarbyAnchorUntestedPill');
    const sub = $('editCarbyAnchorUntestedSub');
    const group = $('editCarbyAnchorAfrGroup');
    if (!btn || !pill || !sub || !group) return;

    const untested = Boolean(ui.editCarbyAnchorUntested);
    btn.classList.toggle('active', untested);
    btn.setAttribute('aria-checked', untested ? 'true' : 'false');
    pill.textContent = untested ? 'UNTESTED' : 'VERIFIED';
    sub.textContent = untested
      ? 'ON • Untested / DME Build Sheet (Weather-Only 1.000×)'
      : 'OFF • Has Verified Track AFR';
    group.classList.toggle('field-disabled-overlay', untested);
  }

  function openEditCarbyModal(carbyId) {
    const carby = state.carbies.find((c) => c.id === carbyId);
    if (!carby) return;

    $('editCarbyIdHidden').value = carby.id;
    $('modalEditCarbyTitle').textContent = `Edit ${carby.name} (40mm BXUV-3)`;
    $('editCarbyVenturi').value = carby.venturiMm.toFixed(2);
    $('editCarbyExit').value = carby.exitMm.toFixed(2);
    $('editCarbySpill').value = carby.spillMm.toFixed(1);
    $('editCarbyNotes').value = carby.notes || '';

    const jetSel = $('editCarbyJet');
    jetSel.innerHTML = sortJetsByDiameter(state.jets)
      .map((j) => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.label)} (${j.mm.toFixed(3)} mm)</option>`)
      .join('');
    jetSel.value = carby.fittedJetId;

    const a = carby.baselineAnchor || {
      jetMm: 2.000,
      rad: 94.3,
      fuelSg: 0.740,
      verifiedAfr: null,
      sourceLabel: 'Fleet Anchor'
    };
    $('editCarbyAnchorJetMm').value = Number(a.jetMm).toFixed(3);
    $('editCarbyAnchorRad').value = Number(a.rad).toFixed(1);
    $('editCarbyAnchorSg').value = Number(a.fuelSg).toFixed(3);
    $('editCarbyAnchorSource').value = a.sourceLabel || '';

    const hasVerified =
      a.verifiedAfr !== null && a.verifiedAfr !== undefined && Number.isFinite(Number(a.verifiedAfr));
    ui.editCarbyAnchorUntested = !hasVerified;
    $('editCarbyAnchorAfr').value = hasVerified ? Number(a.verifiedAfr).toFixed(2) : '12.50';
    syncEditCarbyAnchorUntestedUi();

    openModal('modalEditCarby');
  }

  function saveEditCarbyModal() {
    const id = $('editCarbyIdHidden').value;
    const carby = state.carbies.find((c) => c.id === id);
    if (!carby) return;

    // Enforce Group 3H 40mm late-base Stromberg BXUV-3 maximum limits
    const venturi = Math.min(30.94, Math.max(28.0, readNum('editCarbyVenturi', 30.90)));
    const exitBore = Math.min(40.00, Math.max(38.0, readNum('editCarbyExit', 40.00)));
    const spill = Math.min(20.0, Math.max(11.0, readNum('editCarbySpill', 15.0)));

    carby.venturiMm = Number(venturi.toFixed(2));
    carby.exitMm = Number(exitBore.toFixed(2));
    carby.spillMm = Number(spill.toFixed(1));
    carby.fittedJetId = $('editCarbyJet').value;
    carby.notes = ($('editCarbyNotes').value || '').trim();

    const fittedJet = findJetById(carby.fittedJetId);
    const anchorJetMm = Number(readNum('editCarbyAnchorJetMm', fittedJet ? fittedJet.mm : 2.000).toFixed(4));
    const nearestJet = findNearestJetByMm(anchorJetMm) || fittedJet || state.jets[0];
    const untested = Boolean(ui.editCarbyAnchorUntested);

    carby.baselineAnchor = {
      jetId: nearestJet.id,
      jetLabel: `${nearestJet.label.split('/')[0].trim()} / ${anchorJetMm.toFixed(3)} mm`,
      jetMm: anchorJetMm,
      rad: Number(readNum('editCarbyAnchorRad', 94.3).toFixed(1)),
      fuelSg: Number(readNum('editCarbyAnchorSg', 0.740).toFixed(3)),
      verifiedAfr: untested ? null : Number(readNum('editCarbyAnchorAfr', 12.50).toFixed(2)),
      sourceLabel: ($('editCarbyAnchorSource').value || '').trim() || `${carby.name} Anchor`,
      timing: carby.baselineAnchor && carby.baselineAnchor.timing ? carby.baselineAnchor.timing : 33.0,
      fuelPsi: carby.baselineAnchor && carby.baselineAnchor.fuelPsi ? carby.baselineAnchor.fuelPsi : 5.0
    };

    saveState();
    closeModal('modalEditCarby');
    renderAll();
    showToast(`Saved ${carby.name} specs & baseline anchor`);
  }

  /* ------------------------------------------------------------------------
     10. GLOBAL STEPPER & EVENT DELEGATION
     ------------------------------------------------------------------------ */
  function stepNumericInput(inputEl, delta) {
    if (!inputEl) return;
    const current = parseFloat(inputEl.value);
    const min = inputEl.min !== '' ? parseFloat(inputEl.min) : -Infinity;
    const max = inputEl.max !== '' ? parseFloat(inputEl.max) : Infinity;
    const stepStr = String(Math.abs(delta));
    const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;

    const baseVal = Number.isFinite(current) ? current : 0;
    let next = baseVal + delta;
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);

    inputEl.value = next.toFixed(decimals);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function switchTab(tabId) {
    ui.activeTab = tabId;
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === tabId);
    });
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const active = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (tabId === 'tab-dyno') {
      requestAnimationFrame(() => renderDynoCanvas());
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderAll() {
    renderLockedBaselineBar();
    populateCarbySelects();
    renderStep1LiveHints();
    if (ui.calcStep === 2) {
      renderStep2Calculator(false);
    }
    renderSessionLog();
    renderDynoPullList();
    if (ui.activeTab === 'tab-dyno') {
      renderDynoCanvas();
    }
    renderCarbyFleet();
    renderJetInventory();
    updateOrificeConverter('mm');
  }

  /* ------------------------------------------------------------------------
     11. INITIALIZATION & PWA REGISTRATION
     ------------------------------------------------------------------------ */
  function bindEvents() {
    // Delegated click handler for steppers, tabs, cards, log buttons, fleet
    document.addEventListener('click', (e) => {
      const stepperBtn = e.target.closest('[data-stepper-target]');
      if (stepperBtn) {
        const targetId = stepperBtn.getAttribute('data-stepper-target');
        const delta = parseFloat(stepperBtn.getAttribute('data-step'));
        stepNumericInput($(targetId), delta);
        return;
      }

      const tabBtn = e.target.closest('.tab-btn[data-tab]');
      if (tabBtn) {
        switchTab(tabBtn.getAttribute('data-tab'));
        return;
      }

      const modeBtn = e.target.closest('[data-weather-mode]');
      if (modeBtn) {
        ui.weatherMode = modeBtn.getAttribute('data-weather-mode');
        $('btnModeRad').classList.toggle('active', ui.weatherMode === 'rad');
        $('btnModeRaw').classList.toggle('active', ui.weatherMode === 'raw');
        $('weatherPanelRad').style.display = ui.weatherMode === 'rad' ? 'block' : 'none';
        $('weatherPanelRaw').style.display = ui.weatherMode === 'raw' ? 'block' : 'none';
        renderStep1LiveHints();
        return;
      }

      const pickJetCard = e.target.closest('[data-pick-jet]');
      if (pickJetCard) {
        ui.selectedJetId = pickJetCard.getAttribute('data-pick-jet');
        renderStep2Calculator(false);
        return;
      }

      const closeModalBtn = e.target.closest('[data-close-modal]');
      if (closeModalBtn) {
        closeModal(closeModalBtn.getAttribute('data-close-modal'));
        return;
      }

      const editSessionBtn = e.target.closest('[data-edit-session-afr]');
      if (editSessionBtn) {
        const sid = editSessionBtn.getAttribute('data-edit-session-afr');
        ui.editingSessionId = ui.editingSessionId === sid ? null : sid;
        renderSessionLog();
        return;
      }

      const saveSessionBtn = e.target.closest('[data-save-session-afr]');
      if (saveSessionBtn) {
        const sid = saveSessionBtn.getAttribute('data-save-session-afr');
        const sess = state.sessions.find((s) => s.id === sid);
        if (sess) {
          sess.afr3500 = Number(readNum(`inlineAfr_${sid}_3500`, sess.afr3500).toFixed(2));
          sess.afr4000 = Number(readNum(`inlineAfr_${sid}_4000`, sess.afr4000).toFixed(2));
          sess.afr4500 = Number(readNum(`inlineAfr_${sid}_4500`, sess.afr4500).toFixed(2));
          sess.afr5000 = Number(readNum(`inlineAfr_${sid}_5000`, sess.afr5000).toFixed(2));
          sess.afrWot = Number(readNum(`inlineAfr_${sid}_Wot`, sess.afrWot).toFixed(2));
          sess.afrStatus = 'verified';
          if (state.baseline.linkedSessionId === sid) {
            state.baseline.wotAfr = sess.afrWot;
            state.baseline.afrStatus = 'verified';
            state.baseline.weatherOnly = false;
            ui.weatherOnly = false;
          }
          ui.editingSessionId = null;
          saveState();
          renderAll();
          showToast(`Verified Post-Race AFR for ${sess.sessionName}`);
        }
        return;
      }

      const lockSessionBtn = e.target.closest('[data-lock-session]');
      if (lockSessionBtn) {
        const sid = lockSessionBtn.getAttribute('data-lock-session');
        const sess = state.sessions.find((s) => s.id === sid);
        if (sess) {
          state.baseline = {
            sessionName: sess.sessionName,
            carbyId: sess.carbyId,
            jetId: sess.jetId,
            jetLabel: sess.jetLabel,
            jetMm: sess.jetMm,
            rad: sess.rad,
            fuelSg: sess.fuelSg,
            wotAfr: sess.afrWot,
            afrStatus: sess.afrStatus || 'verified',
            weatherOnly: false,
            timing: sess.timing,
            fuelPsi: sess.fuelPsi,
            linkedSessionId: sess.id
          };
          ui.weatherOnly = false;
          if ($('selectCalcCarby')) {
            $('selectCalcCarby').value = sess.carbyId;
          }
          saveState();
          syncSessionSelectFromBaseline();
          renderAll();
          showToast(`Locked ${sess.sessionName} (${sess.jetLabel}) as Baseline`);
        }
        return;
      }

      const togglePullBtn = e.target.closest('[data-toggle-pull]');
      if (togglePullBtn) {
        const pid = togglePullBtn.getAttribute('data-toggle-pull');
        const pull = state.dynoPulls.find((p) => p.id === pid);
        if (pull) {
          pull.visible = !pull.visible;
          saveState();
          renderDynoPullList();
          renderDynoCanvas();
        }
        return;
      }

      const loadAnchorBtn = e.target.closest('[data-load-carby-anchor]');
      if (loadAnchorBtn) {
        const cid = loadAnchorBtn.getAttribute('data-load-carby-anchor');
        applyCarbyBaselineAnchor(cid);
        switchTab('tab-calc');
        return;
      }

      const editCarbyBtn = e.target.closest('[data-edit-carby]');
      if (editCarbyBtn) {
        openEditCarbyModal(editCarbyBtn.getAttribute('data-edit-carby'));
        return;
      }

      const toggleJetBtn = e.target.closest('[data-toggle-jet-box]');
      if (toggleJetBtn) {
        const jid = toggleJetBtn.getAttribute('data-toggle-jet-box');
        const jet = findJetById(jid);
        if (jet) {
          jet.inToolbox = !jet.inToolbox;
          saveState();
          renderJetInventory();
          if (ui.calcStep === 2) renderStep2Calculator(false);
        }
      }
    });

    // Calculator buttons & Back navigation (preserving all Step 1 inputs)
    const scrollToStepNav = () => {
      const stepNav = document.querySelector('.calc-step-nav');
      if (stepNav) {
        stepNav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    const returnToStep1 = () => {
      setCalculatorStep(1);
      scrollToStepNav();
    };
    $('btnStep1Nav').addEventListener('click', () => setCalculatorStep(1));
    $('btnStep2Nav').addEventListener('click', () => setCalculatorStep(2, true));
    $('btnNextCalculateJet').addEventListener('click', () => {
      setCalculatorStep(2, true);
      scrollToStepNav();
    });
    $('btnBackToStep1Top').addEventListener('click', returnToStep1);
    $('btnBackToStep1Bottom').addEventListener('click', returnToStep1);
    $('btnConfirmLockJet').addEventListener('click', confirmJetAndLockForNextRace);

    $('selectSessionName').addEventListener('change', updateCustomSessionVisibility);
    $('selectCalcCarby').addEventListener('change', updateCarbySwapHint);

    if ($('btnLoadSwitchedCarbyAnchor')) {
      $('btnLoadSwitchedCarbyAnchor').addEventListener('click', () => {
        applyCarbyBaselineAnchor($('selectCalcCarby').value);
      });
    }
    if ($('btnStep2LoadCarbyAnchor')) {
      $('btnStep2LoadCarbyAnchor').addEventListener('click', () => {
        applyCarbyBaselineAnchor($('selectCalcCarby').value);
      });
    }

    if ($('btnToggleStep1WeatherOnly')) {
      $('btnToggleStep1WeatherOnly').addEventListener('click', () => {
        const hasBaseAfr =
          state.baseline.wotAfr !== null &&
          state.baseline.wotAfr !== undefined &&
          Number.isFinite(Number(state.baseline.wotAfr));
        if (!hasBaseAfr || state.baseline.afrStatus === 'untested') {
          showToast('Baseline has no AFR reading — Weather-Only (1.000×) stays active until Post-Race AFR is saved');
          return;
        }
        ui.weatherOnly = !ui.weatherOnly;
        state.baseline.weatherOnly = ui.weatherOnly;
        saveState();
        renderAll();
        showToast(
          ui.weatherOnly
            ? 'Weather-Only Mode ON — √(Logged/Target) = 1.000×'
            : 'Wideband AFR Correction Active'
        );
      });
    }

    // Station pressure unit toggle (hPa <-> psi)
    $('btnTogglePressUnit').addEventListener('click', () => {
      const curVal = readNum('inputPressure', 997.0);
      if (ui.pressUnit === 'hPa') {
        ui.pressUnit = 'psi';
        const psi = curVal / HPA_PER_PSI;
        $('inputPressure').step = '0.05';
        $('inputPressure').value = psi.toFixed(2);
        $('btnPressMinus').setAttribute('data-step', '-0.05');
        $('btnPressPlus').setAttribute('data-step', '0.05');
      } else {
        ui.pressUnit = 'hPa';
        const hpa = curVal * HPA_PER_PSI;
        $('inputPressure').step = '1';
        $('inputPressure').value = hpa.toFixed(1);
        $('btnPressMinus').setAttribute('data-step', '-1');
        $('btnPressPlus').setAttribute('data-step', '1');
      }
      $('pressUnitBtnLabel').textContent = ui.pressUnit;
      $('pressUnitBadge').textContent = ui.pressUnit;
      renderStep1LiveHints();
    });

    // Live input listeners for Step 1 & Converter
    ['inputRadPct', 'inputTempC', 'inputPressure', 'inputRhPct', 'inputFuelSg', 'inputTargetAfr', 'inputTotalTiming'].forEach((id) => {
      $(id).addEventListener('input', renderStep1LiveHints);
    });

    $('selectFullJetKit').addEventListener('change', (e) => {
      ui.selectedJetId = e.target.value;
      renderStep2Calculator(false);
    });

    // Baseline modals
    $('btnOpenPostRaceAfr').addEventListener('click', openPostRaceAfrModal);
    $('btnSavePostRaceAfr').addEventListener('click', savePostRaceAfrModal);
    $('modalPostWotAfr').addEventListener('input', () => {
      const wot = readNum('modalPostWotAfr', 12.50);
      $('modalPostEndCylPreview').textContent = `#1/#6 Est: ${(wot + END_CYL_LEAN_OFFSET).toFixed(2)}`;
    });

    $('btnOpenEditBaseline').addEventListener('click', openEditBaselineModal);
    $('btnSaveEditBaseline').addEventListener('click', saveEditBaselineModal);
    $('btnSaveCarbySpec').addEventListener('click', saveEditCarbyModal);

    if ($('btnToggleEditBaseWeatherOnly')) {
      $('btnToggleEditBaseWeatherOnly').addEventListener('click', () => {
        ui.editBaseWeatherOnly = !ui.editBaseWeatherOnly;
        syncEditBaselineModalWeatherOnlyUi();
      });
    }
    if ($('editBaseJet')) {
      $('editBaseJet').addEventListener('change', () => {
        const j = findJetById($('editBaseJet').value);
        if (j && $('editBaseJetMm')) {
          $('editBaseJetMm').value = j.mm.toFixed(3);
        }
      });
    }
    if ($('btnEditModalLoadAnchor')) {
      $('btnEditModalLoadAnchor').addEventListener('click', () => {
        const carbyId = $('editBaseCarby').value;
        const carby = state.carbies.find((c) => c.id === carbyId);
        if (!carby || !carby.baselineAnchor) return;
        const a = carby.baselineAnchor;
        $('editBaseSession').value = a.sourceLabel || `${carby.name} Anchor`;
        if (state.jets.some((j) => j.id === a.jetId)) {
          $('editBaseJet').value = a.jetId;
        }
        if ($('editBaseJetMm')) {
          $('editBaseJetMm').value = Number(a.jetMm).toFixed(3);
        }
        $('editBaseRad').value = Number(a.rad).toFixed(1);
        $('editBaseSg').value = Number(a.fuelSg).toFixed(3);
        const hasVer =
          a.verifiedAfr !== null && a.verifiedAfr !== undefined && Number.isFinite(Number(a.verifiedAfr));
        ui.editBaseWeatherOnly = !hasVer;
        if (hasVer) {
          $('editBaseWotAfr').value = Number(a.verifiedAfr).toFixed(2);
        }
        syncEditBaselineModalWeatherOnlyUi();
        showToast(`Loaded ${carby.name} anchor into editor`);
      });
    }
    if ($('btnToggleCarbyAnchorUntested')) {
      $('btnToggleCarbyAnchorUntested').addEventListener('click', () => {
        ui.editCarbyAnchorUntested = !ui.editCarbyAnchorUntested;
        syncEditCarbyAnchorUntestedUi();
      });
    }

    // Session Log toolbar
    $('filterLogCarby').addEventListener('change', renderSessionLog);
    $('btnExportSessionsCsv').addEventListener('click', exportSessionsCsv);
    $('btnBackupJson').addEventListener('click', backupJsonState);
    $('inputRestoreJson').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        restoreJsonState(e.target.files[0]);
        e.target.value = '';
      }
    });
    $('btnResetDemoData').addEventListener('click', () => {
      state = {
        baseline: createDefaultBaseline(),
        jets: createDefaultJets(),
        carbies: createDefaultCarbies(),
        sessions: createDefaultSessions(),
        dynoPulls: createDefaultDynoPulls()
      };
      ui.weatherOnly = false;
      if ($('selectCalcCarby')) {
        $('selectCalcCarby').value = state.baseline.carbyId;
      }
      saveState();
      syncSessionSelectFromBaseline();
      renderAll();
      showToast('Restored Calder Park Race 1 Seed Data');
    });

    // Dyno Lab interactions
    $('btnToggleDynoForm').addEventListener('click', () => {
      const card = $('dynoManualFormCard');
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    });

    $('btnSaveManualDynoPull').addEventListener('click', () => {
      const rpms = [3500, 4000, 4500, 5000, 5500];
      const points = rpms.map((rpm) => ({
        rpm,
        hp: readNum(`dynoHp_${rpm}`, 130),
        tq: readNum(`dynoTq_${rpm}`, 155),
        afr: readNum(`dynoAfr_${rpm}`, 12.85)
      }));
      const name = ($('dynoPullName').value || '').trim() || `Pull ${state.dynoPulls.length + 1}`;
      const carbyId = $('dynoPullCarby').value || '1 DME';
      const color = DYNO_COLORS[state.dynoPulls.length % DYNO_COLORS.length];

      state.dynoPulls.push({
        id: `dyno_${Date.now()}`,
        name,
        carbyId,
        color,
        rad: readNum('dynoRadInput', 96.0),
        timing: readNum('dynoTimingInput', 33.0),
        visible: true,
        points
      });
      saveState();
      $('dynoManualFormCard').style.display = 'none';
      renderDynoPullList();
      renderDynoCanvas();
      showToast(`Added "${name}" to Dyno Chart`);
    });

    $('inputImportDynoCsv').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importDynoCsvFile(e.target.files[0]);
        e.target.value = '';
      }
    });

    $('btnDownloadDynoTemplate').addEventListener('click', () => {
      const sample = [
        'rpm,hp,torque,afr',
        '3500,111.0,166.6,12.88',
        '4000,126.8,166.5,12.86',
        '4500,137.5,160.5,12.84',
        '5000,142.0,149.2,12.82',
        '5500,137.4,131.2,12.80'
      ].join('\n');
      triggerDownload(sample, 'hq202-dyno-sample.csv', 'text/csv;charset=utf-8;');
      showToast('Downloaded Sample Dyno CSV');
    });

    // Dyno Canvas Pointer Scrubbing
    const canvas = $('dynoCanvas');
    const handleScrub = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const padL = 42;
      const padR = 14;
      const plotW = Math.max(1, rect.width - padL - padR);
      const relX = Math.max(0, Math.min(plotW, clientX - rect.left - padL));
      ui.dynoScrubRpm = 3500 + (relX / plotW) * 2000;
      renderDynoCanvas();
    };
    canvas.addEventListener('pointerdown', (e) => handleScrub(e.clientX));
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons > 0 || e.pointerType === 'touch') {
        handleScrub(e.clientX);
      }
    });
    window.addEventListener('resize', () => {
      if (ui.activeTab === 'tab-dyno') renderDynoCanvas();
    });

    // Tab 4 Orifice Converter & Custom Jet Builder
    $('convInchInput').addEventListener('input', () => updateOrificeConverter('inch'));
    $('convMmInput').addEventListener('input', () => updateOrificeConverter('mm'));

    $('btnAddCustomJet').addEventListener('click', () => {
      const mmVal = Number(readNum('convMmInput', 1.970).toFixed(4));
      const customLabel =
        ($('customJetLabelInput').value || '').trim() ||
        `Custom ${mmVal.toFixed(3)} mm Drill`;
      const newJet = {
        id: `custom_${Date.now()}`,
        label: customLabel,
        stamp: `Custom ${mmVal.toFixed(3)} mm (${mmToInch(mmVal).toFixed(4)}")`,
        mm: mmVal,
        custom: true,
        inToolbox: true
      };
      state.jets = sortJetsByDiameter([...state.jets, newJet]);
      $('customJetLabelInput').value = '';
      saveState();
      renderAll();
      showToast(`Added ${customLabel} to Active Toolbox`);
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('open');
      });
    });

    // Network status & PWA Install prompt
    const updateNetBadge = () => {
      const badge = $('netStatusBadge');
      const txt = $('netStatusText');
      if (!navigator.onLine) {
        badge.classList.add('offline');
        txt.textContent = 'Pit Offline';
      } else {
        badge.classList.remove('offline');
        txt.textContent = 'Offline Ready';
      }
    };
    window.addEventListener('online', updateNetBadge);
    window.addEventListener('offline', updateNetBadge);
    updateNetBadge();

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      $('btnInstallPwa').style.display = 'inline-flex';
    });
    $('btnInstallPwa').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      $('btnInstallPwa').style.display = 'none';
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('Service worker registration skipped:', err);
        });
      });
    }
  }

  // Boot app
  renderDynoRpmFormInputs();
  bindEvents();
  syncSessionSelectFromBaseline();
  renderAll();
  registerServiceWorker();
})();
