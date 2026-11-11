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

  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function getLocalTodayIso() {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch (_) {
      // Fallback to local system date
    }
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatIsoDateDisplay(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') return '';
    const match = isoStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return isoStr;
    const year = Number(match[1]);
    const monthIdx = Number(match[2]) - 1;
    const day = Number(match[3]);
    const monthName = MONTHS_SHORT[monthIdx] || match[2];
    return `${day} ${monthName} ${year}`;
  }

  function normalizeOptionalAfr(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? Number(num.toFixed(2)) : null;
  }

  function normalizeOptionalWaterTemp(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
  }

  function createDefaultBaseline() {
    const todayIso = getLocalTodayIso();
    return {
      venue: 'Calder Park Raceway',
      sessionDateIso: todayIso,
      sessionDate: formatIsoDateDisplay(todayIso),
      sessionName: 'Race 1',
      carbyId: '1 DME',
      jetId: 'drill_2000',
      jetLabel: 'Jet #77 / 2.000 mm',
      jetMm: 2.000,
      rad: 94.3,
      fuelSg: 0.740,
      wotAfr: 12.50,
      peakRpm: 5900,
      afrStatus: 'verified', // 'verified' | 'estimated' | 'untested'
      weatherOnly: false,
      timing: 33.0,
      fuelPsi: 5.0,
      waterTempC: 84,
      linkedSessionId: 'calder_r1'
    };
  }

  function createDefaultSessions() {
    const todayIso = getLocalTodayIso();
    const todayDisp = formatIsoDateDisplay(todayIso);
    return [
      {
        id: 'calder_p1',
        venue: 'Calder Park Raceway',
        sessionDateIso: todayIso,
        sessionDate: todayDisp,
        sessionName: 'Practice 1',
        timestamp: 'Sat 08:45',
        carbyId: 'SNB Carby',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 98.6,
        fuelSg: 0.740,
        fuelTempC: 20.0,
        timing: 32.0,
        fuelPsi: 5.0,
        waterTempC: 82,
        afr3500: 13.05,
        afr4000: 12.98,
        afr4500: 12.92,
        afr5000: 12.89,
        afr5500: 12.90,
        afrWot: 12.90,
        peakRpm: 5900,
        notes: 'Crisp morning air at Calder; SNB Carby clean pull to 5900 RPM.'
      },
      {
        id: 'calder_p2',
        venue: 'Calder Park Raceway',
        sessionDateIso: todayIso,
        sessionDate: todayDisp,
        sessionName: 'Practice 2',
        timestamp: 'Sat 10:15',
        carbyId: 'SNB Carby',
        jetId: 'drill_1950',
        jetLabel: '1.950 mm Drill',
        jetMm: 1.9500,
        rad: 96.8,
        fuelSg: 0.740,
        fuelTempC: 20.0,
        timing: 33.0,
        fuelPsi: 5.0,
        waterTempC: 85,
        afr3500: 13.22,
        afr4000: 13.15,
        afr4500: 13.10,
        afr5000: 13.06,
        afr5500: 13.07,
        afrWot: 13.08,
        peakRpm: 5900,
        notes: 'Tested 1.950mm custom drill — #1/#6 end-cyl est 13.35 (too lean down back straight).'
      },
      {
        id: 'calder_p3',
        venue: 'Calder Park Raceway',
        sessionDateIso: todayIso,
        sessionDate: todayDisp,
        sessionName: 'Practice 3',
        timestamp: 'Sat 11:40',
        carbyId: '1 DME',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 95.6,
        fuelSg: 0.740,
        fuelTempC: 20.0,
        timing: 33.0,
        fuelPsi: 5.0,
        waterTempC: 84,
        afr3500: 12.90,
        afr4000: 12.84,
        afr4500: 12.79,
        afr5000: 12.76,
        afr5500: 12.77,
        afrWot: 12.78,
        peakRpm: 5900,
        notes: 'Bolted on 1 DME with HQRA shield; strong mid-corner torque.'
      },
      {
        id: 'calder_q1',
        venue: 'Calder Park Raceway',
        sessionDateIso: todayIso,
        sessionDate: todayDisp,
        sessionName: 'Qualifying',
        timestamp: 'Sat 13:10',
        carbyId: '1 DME',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 94.8,
        fuelSg: 0.740,
        fuelTempC: 20.0,
        timing: 33.5,
        fuelPsi: 5.0,
        waterTempC: 86,
        afr3500: 12.86,
        afr4000: 12.80,
        afr4500: 12.75,
        afr5000: 12.71,
        afr5500: 12.72,
        afrWot: 12.72,
        peakRpm: 5950,
        notes: 'Qualified P2; slight richness as track air warmed.'
      },
      {
        id: 'calder_r1',
        venue: 'Calder Park Raceway',
        sessionDateIso: todayIso,
        sessionDate: todayDisp,
        sessionName: 'Race 1',
        timestamp: 'Sun 10:35',
        carbyId: '1 DME',
        jetId: 'drill_2000',
        jetLabel: 'Jet #77 / 2.000 mm',
        jetMm: 2.0000,
        rad: 94.3,
        fuelSg: 0.740,
        fuelTempC: 20.0,
        timing: 33.0,
        fuelPsi: 5.0,
        waterTempC: 84,
        afr3500: 12.68,
        afr4000: 12.60,
        afr4500: 12.55,
        afr5000: 12.52,
        afr5500: 12.51,
        afrWot: 12.50,
        peakRpm: 5900,
        litresToPourL: 33.2,
        startingFuelReqL: 33.2,
        expectedBurnL: 15.6,
        fuelFloorL: 12.0,
        fuelInL: 36.0,
        fuelOutL: 23.0,
        fuelUsedL: 13.0,
        racedLaps: 10,
        measuredBurnLPerLap: 1.30,
        scaleWeightKg: 1377.0,
        postRaceEstKg: 1370.0,
        tyreHotTarget: 44.0,
        tyres: {
          FL: { cold: 30.0, hot: 43.8, build: 13.8, nextCold: 30.2 },
          FR: { cold: 30.0, hot: 44.6, build: 14.6, nextCold: 29.5 },
          RL: { cold: 30.0, hot: 43.4, build: 13.4, nextCold: 30.5 },
          RR: { cold: 30.0, hot: 44.2, build: 14.2, nextCold: 29.8 }
        },
        notes: 'Safe rich slipstream setup (2.000mm drill in #77 body); 5.0 psi steady at block boss.'
      },
      {
        id: 'calder_r2',
        venue: 'Calder Park Raceway',
        sessionDateIso: todayIso,
        sessionDate: todayDisp,
        sessionName: 'Race 2',
        timestamp: 'Sun 13:50',
        carbyId: '1 DME',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 93.9,
        fuelSg: 0.740,
        fuelTempC: 20.0,
        timing: 33.0,
        fuelPsi: 5.0,
        waterTempC: 87,
        afr3500: 12.92,
        afr4000: 12.88,
        afr4500: 12.84,
        afr5000: 12.81,
        afr5500: 12.82,
        afrWot: 12.82,
        peakRpm: 5950,
        notes: 'Stepped leaner to #78 — dead in 12.8-12.9 HQ 202 sweet spot, pulled hard to 5950.'
      },
      {
        id: 'calder_r3',
        venue: 'Calder Park Raceway',
        sessionDateIso: todayIso,
        sessionDate: todayDisp,
        sessionName: 'Race 3',
        timestamp: 'Sun 16:20',
        carbyId: 'SNB Carby',
        jetId: 'm1_78',
        jetLabel: '#78',
        jetMm: 1.9812,
        rad: 95.2,
        fuelSg: 0.740,
        fuelTempC: 20.0,
        timing: 33.0,
        fuelPsi: 5.0,
        waterTempC: 83,
        afr3500: 12.96,
        afr4000: 12.91,
        afr4500: 12.88,
        afr5000: 12.86,
        afr5500: 12.87,
        afrWot: 12.87,
        peakRpm: 6000,
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
          { rpm: 5500, hp: 131.4, tq: 125.5, afr: 12.46 },
          { rpm: 5750, hp: 127.0, tq: 116.0, afr: 12.45 },
          { rpm: 6000, hp: 121.8, tq: 106.6, afr: 12.44 }
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
          { rpm: 5500, hp: 136.8, tq: 130.6, afr: 12.79 },
          { rpm: 5750, hp: 132.8, tq: 121.3, afr: 12.78 },
          { rpm: 6000, hp: 128.0, tq: 112.0, afr: 12.78 }
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
          { rpm: 5500, hp: 136.5, tq: 130.3, afr: 12.84 },
          { rpm: 5750, hp: 132.4, tq: 120.9, afr: 12.83 },
          { rpm: 6000, hp: 127.6, tq: 111.7, afr: 12.83 }
        ]
      }
    ];
  }

  const DEFAULT_TRACK_BURN_L = {
    'Calder Park Raceway': 1.30,
    'Sandown Raceway': 1.75,
    'Winton Motor Raceway': 1.65,
    'Phillip Island Grand Prix Circuit': 2.35,
    'Haunted Hills / Bryant Park': 0.90,
    'Broadford State Motorcycle Complex': 1.25,
    'Sydney Motorsport Park (SMSP)': 2.10,
    'Mount Panorama (Bathurst)': 3.40,
    'Wakefield Park / One Raceway': 1.30,
    'Pheasant Wood Circuit': 0.95,
    'Queensland Raceway (Willowbank)': 1.70,
    'Morgan Park Raceway': 1.60,
    'Lakeside Park': 1.35,
    'Townsville Reid Park': 1.60,
    'The Bend Motorsport Park': 2.50,
    'Mallala Motorsport Park': 1.45,
    'CARCO.com.au Raceway (Wanneroo)': 1.40,
    'Collie Motorplex': 1.40,
    'Symmons Plains Raceway': 1.35,
    'Baskerville Raceway': 1.20,
    'Hidden Valley Raceway': 1.60
  };

  function createDefaultTrackProfiles() {
    const profiles = {};
    Object.keys(DEFAULT_TRACK_BURN_L).forEach((track) => {
      profiles[track] = {
        burnLPerLap: DEFAULT_TRACK_BURN_L[track],
        coldTyres: { FL: 30.0, FR: 30.0, RL: 30.0, RR: 30.0 }
      };
    });
    return profiles;
  }

  function createDefaultChassisState() {
    return {
      raceLaps: 12,
      fuelFloorL: 12.0,
      currentTankL: 0.0,
      pumpBeforeL: 36.0,
      pumpAfterL: 23.0,
      pumpLaps: 10,
      minLegalKg: 1365.0,
      scaleCheckKg: 1377.0,
      scaleCheckFuelL: 27.0,
      tyreHotTarget: 44.0,
      hotTyres: { FL: null, FR: null, RL: null, RR: null },
      trackProfiles: createDefaultTrackProfiles(),
      pumpRuns: [],
      historyRuns: []
    };
  }

  function normalizeTyreCornersObject(rawCorners) {
    if (!rawCorners || typeof rawCorners !== 'object') return null;
    const pickOpt = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const normCorner = (newKey, oldKey) => {
      const src = rawCorners[newKey] || rawCorners[oldKey];
      if (!src || typeof src !== 'object') return null;
      const cold = Number.isFinite(Number(src.cold)) ? Number(Number(src.cold).toFixed(1)) : 30.0;
      const hot = pickOpt(src.hot);
      const build = hot !== null ? Number((hot - cold).toFixed(1)) : pickOpt(src.build);
      const nextCold = Number.isFinite(Number(src.nextCold)) ? Number(Number(src.nextCold).toFixed(1)) : cold;
      return {
        cold,
        hot: hot !== null ? Number(hot.toFixed(1)) : null,
        build,
        nextCold
      };
    };
    const fl = normCorner('FL', 'LF');
    const fr = normCorner('FR', 'RF');
    const rl = normCorner('RL', 'LR');
    const rr = normCorner('RR', 'RR');
    if (!fl && !fr && !rl && !rr) return null;
    return {
      FL: fl || { cold: 30.0, hot: null, build: null, nextCold: 30.0 },
      FR: fr || { cold: 30.0, hot: null, build: null, nextCold: 30.0 },
      RL: rl || { cold: 30.0, hot: null, build: null, nextCold: 30.0 },
      RR: rr || { cold: 30.0, hot: null, build: null, nextCold: 30.0 }
    };
  }

  /* ------------------------------------------------------------------------
     2. APPLICATION STATE & PERSISTENCE
     ------------------------------------------------------------------------ */
  function hydrateState(candidate) {
    const defaultCarbies = createDefaultCarbies();
    const todayIso = getLocalTodayIso();
    const todayDisp = formatIsoDateDisplay(todayIso);
    const pickOptNum = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

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
    if (!b.venue || b.venue === 'Calder Park' || b.venue === 'Calder Park / Track') {
      b.venue = 'Calder Park Raceway';
    }
    if (!b.sessionDateIso) {
      b.sessionDateIso = todayIso;
    }
    if (!b.sessionDate) {
      b.sessionDate = formatIsoDateDisplay(b.sessionDateIso) || todayDisp;
    }
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
    if (!Number.isFinite(Number(b.peakRpm))) {
      b.peakRpm = 5900;
    }
    if (b.waterTempC === undefined) {
      b.waterTempC = b.linkedSessionId === 'calder_r1' || b.sessionName === 'Race 1' ? 84 : null;
    } else {
      b.waterTempC = normalizeOptionalWaterTemp(b.waterTempC);
    }
    candidate.baseline = b;
    candidate.awaitingPostRaceId = candidate.awaitingPostRaceId || null;

    const defaultSessions = createDefaultSessions();
    const defCalderR1 = defaultSessions.find((ds) => ds.id === 'calder_r1');

    candidate.sessions = (candidate.sessions || []).map((s) => {
      const venue =
        !s.venue || s.venue === 'Calder Park' || s.venue === 'Calder Park / Track'
          ? 'Calder Park Raceway'
          : s.venue;
      const sessionDateIso = s.sessionDateIso || todayIso;
      const sessionDate = s.sessionDate || formatIsoDateDisplay(sessionDateIso) || todayDisp;
      const a35 = normalizeOptionalAfr(s.afr3500);
      const a40 = normalizeOptionalAfr(s.afr4000);
      const a45 = normalizeOptionalAfr(s.afr4500);
      const a50 = normalizeOptionalAfr(s.afr5000);
      const aWot = Number.isFinite(Number(s.afrWot)) ? Number(Number(s.afrWot).toFixed(2)) : 12.80;
      let a55 = normalizeOptionalAfr(s.afr5500);
      if (a55 === null && s.afr5500 === undefined && a50 !== null && String(s.id || '').startsWith('calder_')) {
        a55 = Number(((a50 + aWot) / 2).toFixed(2));
      }
      const peakRpm = Number.isFinite(Number(s.peakRpm)) ? Math.round(Number(s.peakRpm)) : 5900;
      const waterTempC = normalizeOptionalWaterTemp(s.waterTempC);
      const fuelTempC = Number.isFinite(Number(s.fuelTempC)) ? Number(Number(s.fuelTempC).toFixed(1)) : 20.0;

      let tyres = normalizeTyreCornersObject(s.tyres || s.corners);
      let litresToPourL = pickOptNum(s.litresToPourL ?? s.pourJugsL);
      let startingFuelReqL = pickOptNum(s.startingFuelReqL ?? s.startFuelReqL);
      let expectedBurnL = pickOptNum(s.expectedBurnL);
      let fuelFloorL = pickOptNum(s.fuelFloorL);
      let fuelInL = pickOptNum(s.fuelInL ?? s.beforeL);
      let fuelOutL = pickOptNum(s.fuelOutL ?? s.afterL);
      let fuelUsedL = pickOptNum(s.fuelUsedL ?? s.usedL);
      let racedLaps = pickOptNum(s.racedLaps ?? s.laps);
      let measuredBurnLPerLap = pickOptNum(s.measuredBurnLPerLap ?? s.burnLPerLap);
      let scaleWeightKg = pickOptNum(s.scaleWeightKg);
      let postRaceEstKg = pickOptNum(s.postRaceEstKg ?? s.predPostRaceKg);
      let tyreHotTarget = pickOptNum(s.tyreHotTarget);

      // Back-fill seed Race 1 with unified Fuel/Weight & Tyres if not yet populated
      if (s.id === 'calder_r1' && defCalderR1) {
        if (!tyres) tyres = normalizeTyreCornersObject(defCalderR1.tyres);
        if (litresToPourL === null) litresToPourL = defCalderR1.litresToPourL;
        if (startingFuelReqL === null) startingFuelReqL = defCalderR1.startingFuelReqL;
        if (expectedBurnL === null) expectedBurnL = defCalderR1.expectedBurnL;
        if (fuelFloorL === null || fuelFloorL === 19.0) fuelFloorL = defCalderR1.fuelFloorL;
        if (fuelInL === null) fuelInL = defCalderR1.fuelInL;
        if (fuelOutL === null) fuelOutL = defCalderR1.fuelOutL;
        if (fuelUsedL === null) fuelUsedL = defCalderR1.fuelUsedL;
        if (racedLaps === null) racedLaps = defCalderR1.racedLaps;
        if (measuredBurnLPerLap === null) measuredBurnLPerLap = defCalderR1.measuredBurnLPerLap;
        if (scaleWeightKg === null) scaleWeightKg = defCalderR1.scaleWeightKg;
        if (postRaceEstKg === null) postRaceEstKg = defCalderR1.postRaceEstKg;
        if (tyreHotTarget === null) tyreHotTarget = defCalderR1.tyreHotTarget;
      }

      return {
        ...s,
        venue,
        sessionDateIso,
        sessionDate,
        fuelTempC,
        waterTempC,
        afr3500: a35,
        afr4000: a40,
        afr4500: a45,
        afr5000: a50,
        afr5500: a55,
        afrWot: aWot,
        peakRpm,
        afrStatus: s.afrStatus || 'verified',
        litresToPourL,
        startingFuelReqL,
        expectedBurnL,
        fuelFloorL,
        fuelInL,
        fuelOutL,
        fuelUsedL,
        racedLaps: racedLaps !== null ? Math.round(racedLaps) : null,
        measuredBurnLPerLap,
        scaleWeightKg,
        postRaceEstKg,
        tyreHotTarget,
        tyres
      };
    });

    const defaultPulls = createDefaultDynoPulls();
    if (!Array.isArray(candidate.dynoPulls)) {
      candidate.dynoPulls = defaultPulls;
    } else {
      candidate.dynoPulls = candidate.dynoPulls.map((p) => {
        const defPull = defaultPulls.find((d) => d.id === p.id);
        const has6000 = Array.isArray(p.points) && p.points.some((pt) => pt.rpm >= 6000);
        if (defPull && !has6000) {
          return {
            ...p,
            points: defPull.points
          };
        }
        return p;
      });
    }

    const defChassis = createDefaultChassisState();
    if (!candidate.chassis || typeof candidate.chassis !== 'object') {
      candidate.chassis = defChassis;
    } else {
      const ch = candidate.chassis;
      const mergedProfiles = createDefaultTrackProfiles();
      if (ch.trackProfiles && typeof ch.trackProfiles === 'object') {
        Object.keys(ch.trackProfiles).forEach((k) => {
          const p = ch.trackProfiles[k];
          if (p && typeof p === 'object') {
            const ct = p.coldTyres || {};
            mergedProfiles[k] = {
              burnLPerLap: Number.isFinite(Number(p.burnLPerLap))
                ? Number(Number(p.burnLPerLap).toFixed(2))
                : DEFAULT_TRACK_BURN_L[k] || 1.30,
              coldTyres: {
                FL: Number.isFinite(Number(ct.FL ?? ct.LF)) ? Number(ct.FL ?? ct.LF) : 30.0,
                FR: Number.isFinite(Number(ct.FR ?? ct.RF)) ? Number(ct.FR ?? ct.RF) : 30.0,
                RL: Number.isFinite(Number(ct.RL ?? ct.LR)) ? Number(ct.RL ?? ct.LR) : 30.0,
                RR: Number.isFinite(Number(ct.RR)) ? Number(ct.RR) : 30.0
              }
            };
          }
        });
      }

      const ht = (ch.hotTyres && typeof ch.hotTyres === 'object') ? ch.hotTyres : {};

      // Migrate any legacy standalone pumpRuns or historyRuns into unified candidate.sessions
      const findSessionForLegacy = (venue, dateDisp, sessName) => {
        const vNorm = venue || 'Calder Park Raceway';
        const sNorm = sessName || 'Race 1';
        for (let i = candidate.sessions.length - 1; i >= 0; i--) {
          const s = candidate.sessions[i];
          if (s.venue === vNorm && s.sessionName === sNorm && (!dateDisp || s.sessionDate === dateDisp)) {
            return s;
          }
        }
        for (let i = candidate.sessions.length - 1; i >= 0; i--) {
          const s = candidate.sessions[i];
          if (s.venue === vNorm && s.sessionName === sNorm) {
            return s;
          }
        }
        return null;
      };

      if (Array.isArray(ch.pumpRuns) && ch.pumpRuns.length > 0) {
        ch.pumpRuns.forEach((pr) => {
          if (!pr || pr.id === 'pump_calder_seed') return;
          const target = findSessionForLegacy(pr.venue, pr.sessionDate, pr.sessionName);
          if (target) {
            target.fuelInL = pickOptNum(pr.beforeL) ?? target.fuelInL;
            target.fuelOutL = pickOptNum(pr.afterL) ?? target.fuelOutL;
            target.fuelUsedL = pickOptNum(pr.usedL) ?? target.fuelUsedL;
            target.racedLaps = pickOptNum(pr.laps) !== null ? Math.round(Number(pr.laps)) : target.racedLaps;
            target.measuredBurnLPerLap = pickOptNum(pr.burnLPerLap) ?? target.measuredBurnLPerLap;
          }
        });
      }

      if (Array.isArray(ch.historyRuns) && ch.historyRuns.length > 0) {
        ch.historyRuns.forEach((hr) => {
          if (!hr || hr.id === 'chassis_calder_seed') return;
          const target = findSessionForLegacy(hr.venue, hr.sessionDate, hr.sessionName);
          const normTyres = normalizeTyreCornersObject(hr.corners);
          if (target) {
            if (normTyres) target.tyres = normTyres;
            if (pickOptNum(hr.tyreHotTarget) !== null) target.tyreHotTarget = Number(hr.tyreHotTarget);
            if (pickOptNum(hr.pourJugsL) !== null && target.litresToPourL === null) {
              target.litresToPourL = Number(hr.pourJugsL);
            }
            if (pickOptNum(hr.startFuelReqL) !== null && target.startingFuelReqL === null) {
              target.startingFuelReqL = Number(hr.startFuelReqL);
            }
            if (pickOptNum(hr.predPostRaceKg) !== null && target.postRaceEstKg === null) {
              target.postRaceEstKg = Number(hr.predPostRaceKg);
            }
          }
        });
      }

      const rawFloor = Number(ch.fuelFloorL);
      const migratedFloor = Number.isFinite(rawFloor) ? (rawFloor === 19.0 ? 12.0 : rawFloor) : defChassis.fuelFloorL;

      candidate.chassis = {
        raceLaps: Number.isFinite(Number(ch.raceLaps)) ? Math.round(Number(ch.raceLaps)) : defChassis.raceLaps,
        fuelFloorL: migratedFloor,
        currentTankL: 0.0,
        pumpBeforeL: Number.isFinite(Number(ch.pumpBeforeL)) ? Number(ch.pumpBeforeL) : defChassis.pumpBeforeL,
        pumpAfterL: Number.isFinite(Number(ch.pumpAfterL)) ? Number(ch.pumpAfterL) : defChassis.pumpAfterL,
        pumpLaps: Number.isFinite(Number(ch.pumpLaps)) ? Math.round(Number(ch.pumpLaps)) : defChassis.pumpLaps,
        minLegalKg: Number.isFinite(Number(ch.minLegalKg)) ? Number(ch.minLegalKg) : defChassis.minLegalKg,
        scaleCheckKg: Number.isFinite(Number(ch.scaleCheckKg)) ? Number(ch.scaleCheckKg) : defChassis.scaleCheckKg,
        scaleCheckFuelL: Number.isFinite(Number(ch.scaleCheckFuelL))
          ? Number(ch.scaleCheckFuelL)
          : defChassis.scaleCheckFuelL,
        tyreHotTarget: Number.isFinite(Number(ch.tyreHotTarget)) ? Number(ch.tyreHotTarget) : defChassis.tyreHotTarget,
        hotTyres: {
          FL: pickOptNum(ht.FL ?? ht.LF),
          FR: pickOptNum(ht.FR ?? ht.RF),
          RL: pickOptNum(ht.RL ?? ht.LR),
          RR: pickOptNum(ht.RR)
        },
        trackProfiles: mergedProfiles,
        pumpRuns: [],
        historyRuns: []
      };
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
      awaitingPostRaceId: null,
      jets: createDefaultJets(),
      carbies: createDefaultCarbies(),
      sessions: createDefaultSessions(),
      dynoPulls: createDefaultDynoPulls(),
      chassis: createDefaultChassisState()
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
    postRaceTargetSessionId: null,
    selectedJetId: null,   // selected jet in Step 2
    editingSessionId: null,
    confirmDeleteSessionId: null,
    confirmDeletePumpRunId: null,
    confirmDeleteTyreLogId: null,
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
    const fuelTempC = readNum('inputFuelTempC', 20.0);
    const sg15Eq = sgNew + 0.0007 * (fuelTempC - 15);
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
      fuelTempC,
      sg15Eq,
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
  function getPendingPostRaceSession() {
    if (state.awaitingPostRaceId) {
      const found = state.sessions.find((s) => s.id === state.awaitingPostRaceId);
      if (found) return found;
    }
    for (let i = state.sessions.length - 1; i >= 0; i--) {
      if (state.sessions[i].afrStatus === 'estimated') {
        return state.sessions[i];
      }
    }
    return null;
  }

  function renderLockedBaselineBar() {
    const b = state.baseline;
    const venueStr = b.venue || 'Calder Park Raceway';
    const dateStr = b.sessionDate || formatIsoDateDisplay(b.sessionDateIso || getLocalTodayIso());
    $('baseSessionCarbyLabel').textContent = `${venueStr} • ${dateStr} • ${b.sessionName} • ${b.carbyId}`;
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

  function updateCustomTrackVisibility() {
    [
      ['selectTrackVenue', 'customTrackWrap'],
      ['selectFuelTrack', 'customFuelTrackWrap'],
      ['selectTyreTrack', 'customTyreTrackWrap']
    ].forEach(([selId, wrapId]) => {
      const sel = $(selId);
      const wrap = $(wrapId);
      if (sel && wrap) {
        wrap.style.display = sel.value === '__CUSTOM_TRACK__' ? 'block' : 'none';
      }
    });
  }

  function ensureTrackProfile(venueName) {
    const key = venueName || 'Calder Park Raceway';
    if (!state.chassis) {
      state.chassis = createDefaultChassisState();
    }
    if (!state.chassis.trackProfiles) {
      state.chassis.trackProfiles = createDefaultTrackProfiles();
    }
    if (!state.chassis.trackProfiles[key]) {
      state.chassis.trackProfiles[key] = {
        burnLPerLap: DEFAULT_TRACK_BURN_L[key] || 1.30,
        coldTyres: { FL: 30.0, FR: 30.0, RL: 30.0, RR: 30.0 }
      };
    }
    return state.chassis.trackProfiles[key];
  }

  function setVenueOnAllTrackSelectors(venueName, loadProfile = true) {
    const targetVenue = (venueName || '').trim() || 'Calder Park Raceway';
    [
      ['selectTrackVenue', 'inputCustomTrack'],
      ['selectFuelTrack', 'inputCustomFuelTrack'],
      ['selectTyreTrack', 'inputCustomTyreTrack']
    ].forEach(([selId, customId]) => {
      const sel = $(selId);
      const customInp = $(customId);
      if (!sel) return;
      const hasOption = Array.from(sel.options).some((opt) => opt.value === targetVenue);
      if (hasOption) {
        sel.value = targetVenue;
      } else {
        sel.value = '__CUSTOM_TRACK__';
        if (customInp) customInp.value = targetVenue;
      }
    });

    updateCustomTrackVisibility();

    if (loadProfile) {
      loadTrackProfileToFuelAndTyreInputs(targetVenue);
    }
  }

  function loadTrackProfileToFuelAndTyreInputs(venueName) {
    const venue = venueName || getSelectedTrackVenue();
    const prof = ensureTrackProfile(venue);
    if ($('inputTrackBurnLPerLap')) {
      $('inputTrackBurnLPerLap').value = Number(prof.burnLPerLap).toFixed(2);
    }
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl && prof.coldTyres && Number.isFinite(Number(prof.coldTyres[c]))) {
        coldEl.value = Number(prof.coldTyres[c]).toFixed(1);
      }
    });
  }

  function updateSessionDateHint() {
    const dateEl = $('inputSessionDate');
    const hintEl = $('sessionDateFormattedHint');
    if (!dateEl || !hintEl) return;
    const iso = dateEl.value || getLocalTodayIso();
    hintEl.textContent = formatIsoDateDisplay(iso) || 'Auto-Today';
  }

  function setSessionDateOnAllTabs(dateIso) {
    const iso = (dateIso || '').trim() || getLocalTodayIso();
    ['inputSessionDate', 'inputFuelSessionDate', 'inputTyreSessionDate'].forEach((id) => {
      const el = $(id);
      if (el) el.value = iso;
    });
    updateSessionDateHint();
  }

  function updateCustomSessionVisibility() {
    [
      ['selectSessionName', 'customSessionWrap'],
      ['selectFuelSessionName', 'customFuelSessionWrap'],
      ['selectTyreSessionName', 'customTyreSessionWrap']
    ].forEach(([selId, wrapId]) => {
      const sel = $(selId);
      const wrap = $(wrapId);
      if (sel && wrap) {
        wrap.style.display = sel.value === '__CUSTOM__' ? 'block' : 'none';
      }
    });
  }

  function setSessionNameOnAllTabs(sessionName) {
    const targetName = (sessionName || '').trim() || 'Race 1';
    [
      ['selectSessionName', 'inputCustomSessionName'],
      ['selectFuelSessionName', 'inputCustomFuelSessionName'],
      ['selectTyreSessionName', 'inputCustomTyreSessionName']
    ].forEach(([selId, customId]) => {
      const sel = $(selId);
      const customInp = $(customId);
      if (!sel) return;
      const hasOption = Array.from(sel.options).some((opt) => opt.value === targetName && opt.value !== '__CUSTOM__');
      if (hasOption) {
        sel.value = targetName;
      } else {
        sel.value = '__CUSTOM__';
        if (customInp) customInp.value = targetName;
      }
    });
    updateCustomSessionVisibility();
  }

  function syncTrackAndDateFromBaseline() {
    const baseVenue = (state.baseline && state.baseline.venue) || 'Calder Park Raceway';
    const baseIso = (state.baseline && state.baseline.sessionDateIso) || getLocalTodayIso();

    setVenueOnAllTrackSelectors(baseVenue, true);
    setSessionDateOnAllTabs(baseIso);
  }

  function readVenueFromSelectorPair(selId, customId) {
    const sel = $(selId);
    if (!sel) return (state.baseline && state.baseline.venue) || 'Calder Park Raceway';
    if (sel.value === '__CUSTOM_TRACK__') {
      const customVal = (($(customId) && $(customId).value) || '').trim();
      return customVal || 'Custom Circuit';
    }
    return sel.value || 'Calder Park Raceway';
  }

  function getSelectedTrackVenue() {
    return readVenueFromSelectorPair('selectTrackVenue', 'inputCustomTrack');
  }

  function getSelectedFuelTrackVenue() {
    return $('selectFuelTrack')
      ? readVenueFromSelectorPair('selectFuelTrack', 'inputCustomFuelTrack')
      : getSelectedTrackVenue();
  }

  function getSelectedTyreTrackVenue() {
    return $('selectTyreTrack')
      ? readVenueFromSelectorPair('selectTyreTrack', 'inputCustomTyreTrack')
      : getSelectedFuelTrackVenue();
  }

  function getSelectedSessionDate() {
    const dateInput = $('inputSessionDate') || $('inputFuelSessionDate') || $('inputTyreSessionDate');
    const iso = (dateInput && dateInput.value) ? dateInput.value : getLocalTodayIso();
    return {
      iso,
      display: formatIsoDateDisplay(iso) || iso
    };
  }

  function readSessionNameFromSelectorPair(selId, customId) {
    const sel = $(selId);
    if (!sel) return 'Race 1';
    if (sel.value === '__CUSTOM__') {
      const customVal = (($(customId) && $(customId).value) || '').trim();
      return customVal || 'Custom Session';
    }
    return sel.value || 'Race 1';
  }

  function getSelectedSessionName() {
    return readSessionNameFromSelectorPair('selectSessionName', 'inputCustomSessionName');
  }

  function syncSessionSelectFromBaseline(refSessionName) {
    const pendingSess = getPendingPostRaceSession();
    const baseName =
      refSessionName ||
      (pendingSess && pendingSess.sessionName) ||
      (state.baseline && state.baseline.sessionName) ||
      '';
    const idx = SESSION_PROGRESSION.indexOf(baseName);
    const nextSessionName =
      idx !== -1 && idx + 1 < SESSION_PROGRESSION.length ? SESSION_PROGRESSION[idx + 1] : 'Race 1';

    setSessionNameOnAllTabs(nextSessionName);
    syncTrackAndDateFromBaseline();
  }

  /**
   * Upserts a unified session record in state.sessions matching (venue + sessionDateIso/sessionDate + sessionName)
   * or an explicit session id, merging Tune, Fuel/Weight, and 4-Corner Tyre telemetry into ONE unified session card.
   */
  function upsertUnifiedSession(patch) {
    const venue = (patch.venue || getSelectedTrackVenue() || 'Calder Park Raceway').trim();
    const { iso: activeIso, display: activeDisp } = getSelectedSessionDate();
    const sessionDateIso = patch.sessionDateIso || activeIso;
    const sessionDate = patch.sessionDate || formatIsoDateDisplay(sessionDateIso) || activeDisp;
    const sessionName = (patch.sessionName || getSelectedSessionName() || 'Race 1').trim();
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });

    let existing = null;
    if (patch.id) {
      existing = state.sessions.find((s) => s.id === patch.id) || null;
    }
    if (!existing) {
      for (let i = state.sessions.length - 1; i >= 0; i--) {
        const s = state.sessions[i];
        const sameVenue = (s.venue || 'Calder Park Raceway') === venue;
        const sameName = (s.sessionName || '') === sessionName;
        const sameDate = s.sessionDateIso === sessionDateIso || s.sessionDate === sessionDate;
        if (sameVenue && sameName && sameDate) {
          existing = s;
          break;
        }
      }
    }

    if (existing) {
      Object.keys(patch).forEach((k) => {
        if (k === 'id' || k === 'appendNote') return;
        if (patch[k] !== undefined) {
          existing[k] = patch[k];
        }
      });
      if (patch.appendNote) {
        const cleanNote = String(patch.appendNote).trim();
        if (cleanNote && (!existing.notes || !existing.notes.includes(cleanNote))) {
          existing.notes = existing.notes ? `${existing.notes} • ${cleanNote}` : cleanNote;
        }
      }
      existing.timestamp = patch.timestamp || `Pit ${timeLabel}`;
      return existing;
    }

    const base = state.baseline || createDefaultBaseline();
    const activeCarbyId = patch.carbyId || ($('selectCalcCarby') && $('selectCalcCarby').value) || base.carbyId || '1 DME';
    const carbyObj = state.carbies.find((c) => c.id === activeCarbyId);
    const fallbackJet =
      (carbyObj && findJetById(carbyObj.fittedJetId)) ||
      findJetById(base.jetId) ||
      state.jets[0];

    const created = {
      id: patch.id || `run_${Date.now()}`,
      venue,
      sessionDateIso,
      sessionDate,
      sessionName,
      timestamp: patch.timestamp || `Pit ${timeLabel}`,
      carbyId: activeCarbyId,
      jetId: patch.jetId || (fallbackJet ? fallbackJet.id : base.jetId),
      jetLabel: patch.jetLabel || (fallbackJet ? fallbackJet.label : base.jetLabel),
      jetMm: patch.jetMm !== undefined ? patch.jetMm : fallbackJet ? fallbackJet.mm : base.jetMm,
      rad: patch.rad !== undefined ? patch.rad : Number(readNum('inputRadPct', base.rad).toFixed(1)),
      fuelSg: patch.fuelSg !== undefined ? patch.fuelSg : Number(readNum('inputFuelSg', base.fuelSg).toFixed(3)),
      fuelTempC: patch.fuelTempC !== undefined ? patch.fuelTempC : Number(readNum('inputFuelTempC', 20.0).toFixed(1)),
      timing: patch.timing !== undefined ? patch.timing : Number(readNum('inputTotalTiming', base.timing).toFixed(1)),
      fuelPsi: patch.fuelPsi !== undefined ? patch.fuelPsi : base.fuelPsi || 5.0,
      waterTempC: patch.waterTempC !== undefined ? patch.waterTempC : null,
      afr3500: patch.afr3500 !== undefined ? patch.afr3500 : null,
      afr4000: patch.afr4000 !== undefined ? patch.afr4000 : null,
      afr4500: patch.afr4500 !== undefined ? patch.afr4500 : null,
      afr5000: patch.afr5000 !== undefined ? patch.afr5000 : null,
      afr5500: patch.afr5500 !== undefined ? patch.afr5500 : null,
      afrWot:
        patch.afrWot !== undefined
          ? patch.afrWot
          : base.wotAfr !== null && Number.isFinite(Number(base.wotAfr))
          ? Number(base.wotAfr)
          : 12.80,
      peakRpm: patch.peakRpm || base.peakRpm || 5900,
      afrStatus: patch.afrStatus || 'estimated',
      litresToPourL: patch.litresToPourL !== undefined ? patch.litresToPourL : null,
      startingFuelReqL: patch.startingFuelReqL !== undefined ? patch.startingFuelReqL : null,
      expectedBurnL: patch.expectedBurnL !== undefined ? patch.expectedBurnL : null,
      fuelFloorL: patch.fuelFloorL !== undefined ? patch.fuelFloorL : null,
      fuelInL: patch.fuelInL !== undefined ? patch.fuelInL : null,
      fuelOutL: patch.fuelOutL !== undefined ? patch.fuelOutL : null,
      fuelUsedL: patch.fuelUsedL !== undefined ? patch.fuelUsedL : null,
      racedLaps: patch.racedLaps !== undefined ? patch.racedLaps : null,
      measuredBurnLPerLap: patch.measuredBurnLPerLap !== undefined ? patch.measuredBurnLPerLap : null,
      scaleWeightKg: patch.scaleWeightKg !== undefined ? patch.scaleWeightKg : null,
      postRaceEstKg: patch.postRaceEstKg !== undefined ? patch.postRaceEstKg : null,
      tyreHotTarget: patch.tyreHotTarget !== undefined ? patch.tyreHotTarget : null,
      tyres: patch.tyres || null,
      notes: patch.notes || patch.appendNote || ''
    };

    state.sessions.push(created);
    return created;
  }

  function applyCarbyBaselineAnchor(carbyId) {
    const carby = state.carbies.find((c) => c.id === carbyId);
    if (!carby || !carby.baselineAnchor) return;

    const prevBaseName = state.baseline.sessionName;
    const venue = getSelectedTrackVenue();
    const { iso: sessionDateIso, display: sessionDate } = getSelectedSessionDate();
    const a = carby.baselineAnchor;
    const hasVerified =
      a.verifiedAfr !== null && a.verifiedAfr !== undefined && Number.isFinite(Number(a.verifiedAfr));

    state.baseline = {
      venue,
      sessionDateIso,
      sessionDate,
      sessionName: a.sourceLabel || `${carby.name} Anchor`,
      carbyId: carby.id,
      jetId: a.jetId || carby.fittedJetId,
      jetLabel: a.jetLabel || `#Jet (${Number(a.jetMm).toFixed(3)} mm)`,
      jetMm: Number(a.jetMm),
      rad: Number(a.rad),
      fuelSg: Number(a.fuelSg),
      wotAfr: hasVerified ? Number(a.verifiedAfr) : null,
      peakRpm: 5900,
      afrStatus: hasVerified ? 'verified' : 'untested',
      weatherOnly: !hasVerified,
      timing: Number(a.timing || 33.0),
      fuelPsi: Number(a.fuelPsi || 5.0),
      waterTempC: normalizeOptionalWaterTemp(a.waterTempC),
      linkedSessionId: null
    };
    state.awaitingPostRaceId = null;

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
      setSessionNameOnAllTabs('Practice 1');
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
    const tgtHint = $('targetAfrHint');
    if (tgtHint) {
      tgtHint.textContent = phys.isWeatherOnly ? 'Weather-Only (1.000×)' : '12.8–12.9';
      tgtHint.className = phys.isWeatherOnly ? 'field-hint amber' : 'field-hint emerald';
    }
  }

  function renderStep1LiveHints() {
    const phys = getActiveCalcPhysics();
    const sign = phys.densityShiftPct >= 0 ? '+' : '';
    $('liveRadDeltaHint').textContent = `ρ ratio: ${phys.rhoRatio.toFixed(3)} (${sign}${phys.densityShiftPct.toFixed(1)}%)`;

    const sg15Hint = $('fuelTempSg15Hint');
    if (sg15Hint) {
      sg15Hint.textContent = `15°C eq: ${phys.sg15Eq.toFixed(3)}`;
    }

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
    updateSessionDateHint();
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
              <div class="jet-card-meta"><span>Enable more jets in Tab 5</span></div>
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

    const venue = getSelectedTrackVenue();
    const { iso: sessionDateIso, display: sessionDate } = getSelectedSessionDate();
    const sessionName = getSelectedSessionName();
    const carbyId = $('selectCalcCarby').value || state.baseline.carbyId;
    const modeNote = phys.isWeatherOnly ? 'Weather-Only 1.000× AFR' : `${ui.weatherMode.toUpperCase()} mode`;
    const userNotes = ($('inputRunNotes').value || '').trim();
    const defaultNote = `Locked pre-run at ${venue} (${sessionDate}) from ${phys.base.sessionName} (${modeNote}).`;

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

    const unifiedSession = upsertUnifiedSession({
      venue,
      sessionDateIso,
      sessionDate,
      sessionName,
      carbyId,
      jetId: chosenJet.id,
      jetLabel: chosenJet.label,
      jetMm: chosenJet.mm,
      rad: Number(phys.effectiveNewRad.toFixed(1)),
      fuelSg: Number(phys.sgNew.toFixed(3)),
      fuelTempC: Number(phys.fuelTempC.toFixed(1)),
      timing: Number(phys.totalTiming.toFixed(1)),
      fuelPsi: state.baseline.fuelPsi,
      afrWot: predWot,
      peakRpm: 5900,
      afrStatus: 'estimated',
      appendNote: userNotes || defaultNote
    });

    state.awaitingPostRaceId = unifiedSession.id;

    // Update fitted jet on carby fleet record too
    const carbyObj = state.carbies.find((c) => c.id === carbyId);
    if (carbyObj) {
      carbyObj.fittedJetId = chosenJet.id;
    }

    // If Baseline was untested/Practice 1, update Baseline to this pre-race setup;
    // otherwise keep Locked Baseline on the last verified post-race setup until Save Post Race Session promotes it!
    const wasUntested =
      state.baseline.afrStatus === 'untested' ||
      state.baseline.wotAfr === null ||
      state.baseline.wotAfr === undefined;
    if (wasUntested) {
      state.baseline = {
        venue,
        sessionDateIso,
        sessionDate,
        sessionName,
        carbyId,
        jetId: chosenJet.id,
        jetLabel: chosenJet.label,
        jetMm: chosenJet.mm,
        rad: Number(phys.effectiveNewRad.toFixed(1)),
        fuelSg: Number(phys.sgNew.toFixed(3)),
        wotAfr: predWot,
        peakRpm: 5900,
        afrStatus: 'estimated',
        weatherOnly: false,
        timing: Number(phys.totalTiming.toFixed(1)),
        fuelPsi: state.baseline.fuelPsi,
        waterTempC: null,
        linkedSessionId: unifiedSession.id
      };
      ui.weatherOnly = false;
    }

    saveState();

    // Sync Step 1 live RAD to the newly locked RAD & keep active session synced across Tabs 1-3
    $('inputRadPct').value = unifiedSession.rad.toFixed(1);
    $('inputRunNotes').value = '';
    setSessionNameOnAllTabs(sessionName);

    renderAll();
    setCalculatorStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Locked ${sessionName} (${chosenJet.label}) to Unified Session Log`);
  }

  /* ------------------------------------------------------------------------
     5B. RENDERING: TAB 2 (FUEL & WT) & TAB 3 (TYRES — VISUAL 2x2 CHASSIS)
     ------------------------------------------------------------------------ */
  function hydrateFuelAndTyreInputs() {
    if (!state.chassis) {
      state.chassis = createDefaultChassisState();
    }
    const ch = state.chassis;
    const venue = getSelectedFuelTrackVenue();
    const prof = ensureTrackProfile(venue);

    if ($('inputTrackBurnLPerLap')) $('inputTrackBurnLPerLap').value = Number(prof.burnLPerLap).toFixed(2);
    if ($('inputRaceLaps')) $('inputRaceLaps').value = String(ch.raceLaps);
    if ($('inputFuelFloorL')) $('inputFuelFloorL').value = Number(ch.fuelFloorL ?? 12.0).toFixed(1);

    if ($('inputPumpBeforeL')) $('inputPumpBeforeL').value = Number(ch.pumpBeforeL).toFixed(1);
    if ($('inputPumpAfterL')) $('inputPumpAfterL').value = Number(ch.pumpAfterL).toFixed(1);
    if ($('inputPumpLaps')) $('inputPumpLaps').value = String(ch.pumpLaps);

    if ($('inputScaleCheckKg')) {
      const scVal = Number(ch.scaleCheckKg);
      $('inputScaleCheckKg').value = Number.isFinite(scVal) && scVal > 0 ? scVal.toFixed(1) : '';
    }
    if ($('inputScaleCheckFuelL')) $('inputScaleCheckFuelL').value = Number(ch.scaleCheckFuelL).toFixed(1);
    if ($('inputTyreHotTarget')) $('inputTyreHotTarget').value = Number(ch.tyreHotTarget).toFixed(1);

    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl) {
        const coldVal = prof.coldTyres && Number.isFinite(Number(prof.coldTyres[c])) ? Number(prof.coldTyres[c]) : 30.0;
        coldEl.value = coldVal.toFixed(1);
      }
      const hotEl = $(`inputHotPsi_${c}`);
      if (hotEl) {
        const hotVal =
          ch.hotTyres && ch.hotTyres[c] !== null && Number.isFinite(Number(ch.hotTyres[c]))
            ? Number(ch.hotTyres[c])
            : null;
        hotEl.value = hotVal !== null ? hotVal.toFixed(1) : '';
      }
    });
  }

  function recalcFuelAndWeight() {
    if (!state.chassis) {
      state.chassis = createDefaultChassisState();
    }
    const ch = state.chassis;
    const venue = getSelectedFuelTrackVenue();
    const prof = ensureTrackProfile(venue);

    const LEGAL_MIN_KG = 1365.0;
    const TARGET_POST_RACE_KG = 1370.0; // Fixed 1365kg + 5kg buffer

    const activeFuelSg = Math.max(0.65, readNum('inputFuelSg', (state.baseline && state.baseline.fuelSg) || 0.740));
    const trackBurnLPerLap = Math.max(0.2, readNum('inputTrackBurnLPerLap', prof.burnLPerLap || 1.30));
    const racedLaps = Math.max(1, Math.round(readNum('inputRaceLaps', ch.raceLaps || 12)));
    const surgeFloorL = Math.max(0, readNum('inputFuelFloorL', ch.fuelFloorL ?? 12.0));
    const tankResidualL = 0.0; // Tank is always pumped empty before pouring

    const scaleInputEl = $('inputScaleCheckKg');
    const rawScaleStr = scaleInputEl ? String(scaleInputEl.value || '').trim() : String(ch.scaleCheckKg ?? 1377.0);
    const parsedScaleKg = rawScaleStr === '' ? 0 : parseFloat(rawScaleStr);
    const scaleCheckKg = Number.isFinite(parsedScaleKg) && parsedScaleKg > 0 ? parsedScaleKg : 0;
    const hasValidScales = scaleCheckKg > 500;

    const scaleCheckFuelL = Math.max(0, readNum('inputScaleCheckFuelL', ch.scaleCheckFuelL ?? 27.0));
    const scaleFuelMassKg = scaleCheckFuelL * activeFuelSg;

    // Exact Live Fuel + Weight Coupling
    const expectedBurnL = racedLaps * trackBurnLPerLap;

    let dryCarDriverKg = 0;
    let postRaceKgAtSurgeFloor = 0;
    let extraBufferFuelL = 0.0;

    if (hasValidScales) {
      dryCarDriverKg = scaleCheckKg - scaleCheckFuelL * activeFuelSg;
      postRaceKgAtSurgeFloor = dryCarDriverKg + surgeFloorL * activeFuelSg;
      const shortfallTo1370Kg = Math.max(0, TARGET_POST_RACE_KG - postRaceKgAtSurgeFloor);
      extraBufferFuelL = shortfallTo1370Kg > 0 ? Math.ceil((shortfallTo1370Kg / activeFuelSg) * 10) / 10 : 0.0;
    }

    const litresToPourL = expectedBurnL + surgeFloorL + extraBufferFuelL;
    const totalStartingFuelL = litresToPourL;
    const startFuelMassKg = totalStartingFuelL * activeFuelSg;

    const endFuelL = surgeFloorL + extraBufferFuelL;
    const endFuelKg = endFuelL * activeFuelSg;
    const predictedPostRaceKg = hasValidScales ? dryCarDriverKg + endFuelKg : 0;
    const marginKg = hasValidScales ? predictedPostRaceKg - LEGAL_MIN_KG : 0;

    // Pump-Out L/Lap Refiner
    const pumpBeforeL = Math.max(0, readNum('inputPumpBeforeL', ch.pumpBeforeL ?? 36.0));
    const pumpAfterL = Math.max(0, readNum('inputPumpAfterL', ch.pumpAfterL ?? 23.0));
    const pumpLaps = Math.max(1, Math.round(readNum('inputPumpLaps', ch.pumpLaps || 10)));
    const pumpUsedL = Math.max(0, pumpBeforeL - pumpAfterL);
    const pumpUsedKg = pumpUsedL * activeFuelSg;
    const pumpMeasuredBurn = pumpLaps > 0 ? pumpUsedL / pumpLaps : 0;

    // Persist Fuel & Weight state
    prof.burnLPerLap = Number(trackBurnLPerLap.toFixed(2));
    ch.raceLaps = racedLaps;
    ch.fuelFloorL = Number(surgeFloorL.toFixed(1));
    ch.currentTankL = 0.0;
    ch.pumpBeforeL = Number(pumpBeforeL.toFixed(1));
    ch.pumpAfterL = Number(pumpAfterL.toFixed(1));
    ch.pumpLaps = pumpLaps;
    ch.minLegalKg = LEGAL_MIN_KG;
    ch.scaleCheckKg = Number(scaleCheckKg.toFixed(1));
    ch.scaleCheckFuelL = Number(scaleCheckFuelL.toFixed(1));

    if ($('fuelActiveSgBadge')) {
      $('fuelActiveSgBadge').textContent = `SG ${activeFuelSg.toFixed(3)} kg/L`;
    }

    const sessionsWithPumpForTrack = (state.sessions || []).filter(
      (s) => s.venue === venue && Number.isFinite(Number(s.measuredBurnLPerLap)) && Number(s.measuredBurnLPerLap) > 0
    );
    if ($('trackBurnSourceHint')) {
      $('trackBurnSourceHint').textContent =
        sessionsWithPumpForTrack.length > 0
          ? `${sessionsWithPumpForTrack.length} pump-out${sessionsWithPumpForTrack.length === 1 ? '' : 's'}`
          : 'Track Base';
    }

    // Sub-Section A: Pre-Race Fuel Load Planner (ONLY 2 Large Side-by-Side Boxes)
    if ($('outFuelExpectedBurnL')) {
      $('outFuelExpectedBurnL').textContent = `${expectedBurnL.toFixed(1)} L`;
    }
    if ($('outFuelExpectedBurnSub')) {
      $('outFuelExpectedBurnSub').textContent = `${racedLaps} laps × ${trackBurnLPerLap.toFixed(2)} L/lap`;
    }

    const pourCell = $('cellFuelPourJugs');
    const pourVal = $('outFuelPourJugsL');
    const pourSub = $('outFuelPourJugsSub');
    if (pourVal) {
      pourVal.textContent = `${litresToPourL.toFixed(1)} L`;
      pourVal.className = litresToPourL > 74.0 ? 'telem-val txt-danger' : 'telem-val txt-emerald';
    }
    if (pourCell) {
      pourCell.className =
        litresToPourL > 74.0 ? 'telem-cell afr-estimated-cell' : 'telem-cell afr-verified-cell';
    }
    if (pourSub) {
      if (litresToPourL > 74.0) {
        pourSub.textContent = `OVER 74.0 L TANK! (${startFuelMassKg.toFixed(1)} kg)`;
        pourSub.className = 'telem-sub txt-danger';
      } else if (extraBufferFuelL > 0) {
        pourSub.textContent = `${expectedBurnL.toFixed(1)}L burn + ${surgeFloorL.toFixed(1)}L surge + ${extraBufferFuelL.toFixed(1)}L (1370kg buffer)`;
        pourSub.className = 'telem-sub txt-amber';
      } else if (hasValidScales) {
        pourSub.textContent = `${expectedBurnL.toFixed(1)}L burn + ${surgeFloorL.toFixed(1)}L surge • >=1370kg OK`;
        pourSub.className = 'telem-sub txt-emerald';
      } else {
        pourSub.textContent = `${expectedBurnL.toFixed(1)}L burn + ${surgeFloorL.toFixed(1)}L surge`;
        pourSub.className = 'telem-sub';
      }
    }

    // Sub-Section B: Post-Session Pump-Out L/Lap Refiner
    if ($('outPumpMeasuredBurn')) {
      $('outPumpMeasuredBurn').textContent = `${pumpMeasuredBurn.toFixed(2)} L/lap`;
    }
    if ($('outPumpUsedL')) {
      $('outPumpUsedL').textContent = `Used: ${pumpUsedL.toFixed(2)} L (${pumpUsedKg.toFixed(1)} kg)`;
    }

    // Card 2: Weekend Track Scales & 1365 kg Check (Fixed 1365.0 kg Min / 1370.0 kg Target)
    if ($('minWeightBadge')) {
      $('minWeightBadge').textContent = `Legal Min: ${LEGAL_MIN_KG.toFixed(1)} kg • Target w/ +5 kg Buffer: ${TARGET_POST_RACE_KG.toFixed(1)} kg`;
    }
    if ($('scaleFuelMassHint')) {
      $('scaleFuelMassHint').textContent = `${scaleFuelMassKg.toFixed(1)} kg @ SG`;
    }

    const predWeightCell = $('cellPredPostRaceWeight');
    const predWeightVal = $('outPredPostRaceKg');
    const predMarginEl = $('outPredPostRaceMargin');
    const weightAlert = $('scrutineerWeightAlert');
    const weightTitle = $('scrutineerAlertTitle');
    const weightBody = $('scrutineerAlertBody');

    if (!hasValidScales) {
      if ($('outDryCarDriverKg')) {
        $('outDryCarDriverKg').textContent = 'Not Weighed';
      }
      if ($('outDryCarDriverSub')) {
        $('outDryCarDriverSub').textContent = 'Enter Official Track Scale Wt (kg)';
      }
      if (predWeightVal) {
        predWeightVal.textContent = '— kg';
        predWeightVal.className = 'telem-val txt-amber';
      }
      if (predWeightCell) {
        predWeightCell.className = 'telem-cell afr-estimated-cell';
      }
      if (predMarginEl) {
        predMarginEl.textContent = `${endFuelL.toFixed(1)} L end fuel • Surge + Burn mode`;
        predMarginEl.className = 'telem-sub txt-amber';
      }
      if (weightAlert && weightTitle && weightBody) {
        weightAlert.className = 'manifold-alert warning';
        weightTitle.textContent = `TRACK SCALES NOT ENTERED — SURGE + BURN MODE (${litresToPourL.toFixed(1)} L)`;
        weightBody.textContent = `Enter your car + driver weight from the weekend track scales above to auto-adjust Litres to Pour for a ${TARGET_POST_RACE_KG.toFixed(1)} kg (+5.0 kg buffer over ${LEGAL_MIN_KG.toFixed(0)} kg) post-race target.`;
      }
    } else {
      if ($('outDryCarDriverKg')) {
        $('outDryCarDriverKg').textContent = `${dryCarDriverKg.toFixed(1)} kg`;
      }
      if ($('outDryCarDriverSub')) {
        $('outDryCarDriverSub').textContent = `${scaleCheckKg.toFixed(1)} kg − ${scaleFuelMassKg.toFixed(1)} kg fuel`;
      }
      if (predWeightVal) {
        predWeightVal.textContent = `${predictedPostRaceKg.toFixed(1)} kg`;
        predWeightVal.className =
          marginKg < 0
            ? 'telem-val txt-danger'
            : marginKg < 4.95
            ? 'telem-val txt-amber'
            : 'telem-val txt-emerald';
      }
      if (predWeightCell) {
        predWeightCell.className =
          marginKg < 4.95 ? 'telem-cell afr-estimated-cell' : 'telem-cell afr-verified-cell';
      }
      if (predMarginEl) {
        const sign = marginKg >= 0 ? '+' : '';
        predMarginEl.textContent = `${endFuelL.toFixed(1)} L end fuel • ${sign}${marginKg.toFixed(1)} kg vs ${LEGAL_MIN_KG.toFixed(1)} kg min`;
        predMarginEl.className =
          marginKg < 0 ? 'telem-sub txt-danger' : marginKg < 4.95 ? 'telem-sub txt-amber' : 'telem-sub txt-emerald';
      }

      if (weightAlert && weightTitle && weightBody) {
        if (litresToPourL > 74.0) {
          weightAlert.className = 'manifold-alert danger';
          weightTitle.textContent = `TANK CAPACITY EXCEEDED (${litresToPourL.toFixed(1)} L > 74.0 L MAX)`;
          weightBody.textContent = `Reaching ${TARGET_POST_RACE_KG.toFixed(1)} kg requires ${litresToPourL.toFixed(1)} L, which exceeds the 74.0 L tank limit! Bolt in physical lead ballast so less fuel mass is required.`;
        } else if (extraBufferFuelL > 0) {
          weightAlert.className = 'manifold-alert safe';
          weightTitle.textContent = `SCRUTINEERING WEIGHT SAFE (+${marginKg.toFixed(1)} KG BUFFER @ ${predictedPostRaceKg.toFixed(1)} KG)`;
          weightBody.textContent = `Auto-added +${extraBufferFuelL.toFixed(1)} L (1370kg buffer) to Litres to Pour (${litresToPourL.toFixed(1)} L total) so car crosses post-race scales at ${predictedPostRaceKg.toFixed(1)} kg (+${marginKg.toFixed(1)} kg buffer over ${LEGAL_MIN_KG.toFixed(1)} kg legal min).`;
        } else {
          weightAlert.className = 'manifold-alert safe';
          weightTitle.textContent = `SCRUTINEERING WEIGHT SAFE (+${marginKg.toFixed(1)} KG BUFFER @ ${predictedPostRaceKg.toFixed(1)} KG)`;
          weightBody.textContent = `Dry Car + Driver is ${dryCarDriverKg.toFixed(1)} kg. Finishing with ${surgeFloorL.toFixed(1)} L surge floor (${endFuelKg.toFixed(1)} kg) puts post-race weight at ${predictedPostRaceKg.toFixed(1)} kg (+${marginKg.toFixed(1)} kg over ${LEGAL_MIN_KG.toFixed(1)} kg legal min — no extra buffer fuel needed).`;
        }
      }
    }

    saveState();

    return {
      venue,
      activeFuelSg,
      burnLPerLap: trackBurnLPerLap,
      raceLaps: racedLaps,
      safeFloorL: surgeFloorL,
      surgeFloorL,
      currentResidualL: tankResidualL,
      expectedBurnL,
      extraBufferFuelL,
      extraWeightFuelL: extraBufferFuelL,
      startingFuelReqL: totalStartingFuelL,
      litresToPourL,
      startFuelMassKg,
      pumpBeforeL,
      pumpAfterL,
      pumpLaps,
      pumpUsedL,
      pumpMeasuredBurn,
      minLegalKg: LEGAL_MIN_KG,
      targetPostRaceKg: TARGET_POST_RACE_KG,
      hasValidScales,
      scaleCheckKg,
      scaleCheckFuelL,
      scaleFuelMassKg,
      dryCarDriverKg,
      endFuelL,
      endFuelKg,
      predictedPostRaceKg,
      marginKg
    };
  }

  function recalcTyres() {
    if (!state.chassis) {
      state.chassis = createDefaultChassisState();
    }
    const ch = state.chassis;
    const venue = getSelectedTyreTrackVenue();
    const prof = ensureTrackProfile(venue);

    const tyreHotTarget = readNum('inputTyreHotTarget', ch.tyreHotTarget || 44.0);
    ch.tyreHotTarget = Number(tyreHotTarget.toFixed(1));

    if ($('tyreTargetBadge')) {
      $('tyreTargetBadge').textContent = `Target ${tyreHotTarget.toFixed(1)} PSI`;
    }

    const corners = {};
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const cold = readNum(`inputColdPsi_${c}`, (prof.coldTyres && prof.coldTyres[c]) || 30.0);
      const hotEl = $(`inputHotPsi_${c}`);
      const rawHot = hotEl ? String(hotEl.value || '').trim() : '';
      const parsedHot = rawHot !== '' ? parseFloat(rawHot) : NaN;
      const hot = Number.isFinite(parsedHot) && parsedHot > 0 ? Number(parsedHot.toFixed(1)) : null;

      const build = hot !== null ? Number((hot - cold).toFixed(1)) : null;
      const diff = hot !== null ? Number((hot - tyreHotTarget).toFixed(1)) : null;
      const nextCold =
        hot !== null
          ? Number((((tyreHotTarget + 14.7) * (cold + 14.7)) / (hot + 14.7) - 14.7).toFixed(1))
          : Number(cold.toFixed(1));

      corners[c] = { cold, hot, build, diff, nextCold };

      ch.hotTyres[c] = hot;

      const buildEl = $(`outTyreBuild_${c}`);
      const actionEl = $(`outTyreAction_${c}`);
      const nextColdEl = $(`outTyreNextCold_${c}`);

      if (hot === null) {
        if (buildEl) {
          buildEl.textContent = '—';
          buildEl.className = 'mono txt-amber';
        }
        if (actionEl) {
          actionEl.textContent = 'HOT PSI?';
          actionEl.className = 'afr-status-badge estimated';
        }
        if (nextColdEl) {
          nextColdEl.textContent = `${cold.toFixed(1)} psi`;
        }
      } else {
        const bSign = build >= 0 ? '+' : '';
        if (buildEl) {
          buildEl.textContent = `${bSign}${build.toFixed(1)} psi`;
          buildEl.className = build >= 8.0 && build <= 16.0 ? 'mono txt-emerald' : 'mono txt-amber';
        }
        if (actionEl) {
          if (Math.abs(diff) <= 0.15) {
            actionEl.textContent = `${tyreHotTarget.toFixed(1)} OK`;
            actionEl.className = 'afr-status-badge verified';
          } else if (diff > 0.15) {
            actionEl.textContent = `BLEED −${diff.toFixed(1)}`;
            actionEl.className = diff >= 1.5 ? 'afr-status-badge danger' : 'afr-status-badge estimated';
          } else {
            actionEl.textContent = `ADD +${Math.abs(diff).toFixed(1)}`;
            actionEl.className = 'afr-status-badge cyan';
          }
        }
        if (nextColdEl) {
          nextColdEl.textContent = `${nextCold.toFixed(1)} psi`;
        }
      }
    });

    saveState();

    return {
      venue,
      tyreHotTarget,
      corners
    };
  }

  function recalculateTrackAverageBurn(venueName) {
    const prof = ensureTrackProfile(venueName);
    const sessionsForTrack = (state.sessions || []).filter(
      (s) => s.venue === venueName && Number.isFinite(Number(s.measuredBurnLPerLap)) && Number(s.measuredBurnLPerLap) > 0
    );
    if (sessionsForTrack.length > 0) {
      const avg =
        sessionsForTrack.reduce((acc, s) => acc + Number(s.measuredBurnLPerLap), 0) / sessionsForTrack.length;
      prof.burnLPerLap = Number(avg.toFixed(2));
    } else {
      prof.burnLPerLap = DEFAULT_TRACK_BURN_L[venueName] || 1.30;
    }
    if (getSelectedFuelTrackVenue() === venueName && $('inputTrackBurnLPerLap')) {
      $('inputTrackBurnLPerLap').value = prof.burnLPerLap.toFixed(2);
    }
  }

  function saveFuelAndWeightToSession(calibratePumpOut = false) {
    const fuelSnap = recalcFuelAndWeight();
    if (calibratePumpOut && (fuelSnap.pumpUsedL <= 0 || fuelSnap.pumpLaps <= 0)) {
      showToast('Fuel In Before Run (L) must be greater than Fuel Pumped Out (L)');
      return;
    }

    const { iso: sessionDateIso, display: sessionDate } = getSelectedSessionDate();
    const sessionName = getSelectedSessionName();
    const hasValidPump = fuelSnap.pumpUsedL > 0 && fuelSnap.pumpLaps > 0;
    const measured = hasValidPump ? Number(fuelSnap.pumpMeasuredBurn.toFixed(2)) : null;

    const unified = upsertUnifiedSession({
      venue: fuelSnap.venue,
      sessionDateIso,
      sessionDate,
      sessionName,
      litresToPourL: Number(fuelSnap.litresToPourL.toFixed(1)),
      startingFuelReqL: Number(fuelSnap.startingFuelReqL.toFixed(1)),
      expectedBurnL: Number(fuelSnap.expectedBurnL.toFixed(1)),
      fuelFloorL: Number(fuelSnap.safeFloorL.toFixed(1)),
      fuelInL: hasValidPump ? Number(fuelSnap.pumpBeforeL.toFixed(1)) : null,
      fuelOutL: hasValidPump ? Number(fuelSnap.pumpAfterL.toFixed(1)) : null,
      fuelUsedL: hasValidPump ? Number(fuelSnap.pumpUsedL.toFixed(2)) : null,
      racedLaps: hasValidPump ? fuelSnap.pumpLaps : fuelSnap.raceLaps,
      measuredBurnLPerLap: measured !== null ? measured : Number(fuelSnap.burnLPerLap.toFixed(2)),
      scaleWeightKg: Number(fuelSnap.scaleCheckKg.toFixed(1)),
      postRaceEstKg: Number(fuelSnap.predictedPostRaceKg.toFixed(1))
    });

    if (calibratePumpOut && measured !== null) {
      recalculateTrackAverageBurn(fuelSnap.venue);
    }

    saveState();
    recalcFuelAndWeight();
    renderSessionLog();

    if (calibratePumpOut && measured !== null) {
      const newAvg = ensureTrackProfile(fuelSnap.venue).burnLPerLap;
      showToast(
        `Saved ${unified.sessionName} Pump-Out (${measured.toFixed(2)} L/lap) • ${fuelSnap.venue} Avg ${newAvg.toFixed(2)} L/lap`
      );
    } else {
      showToast(
        `Saved Fuel & Weight (${fuelSnap.litresToPourL.toFixed(1)} L Pour • ${fuelSnap.predictedPostRaceKg.toFixed(1)} kg Est) to ${unified.sessionName}`
      );
    }
  }

  function saveColdStartsToTrackProfile() {
    const tyreSnap = recalcTyres();
    const prof = ensureTrackProfile(tyreSnap.venue);
    const hasAnyHot = ['FL', 'FR', 'RL', 'RR'].some((c) => tyreSnap.corners[c].hot !== null);

    // If Hot Off-Track PSI values are entered, promote the calculated Next Cold Set into Cold Start PSI & save!
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const nextVal =
        hasAnyHot && tyreSnap.corners[c].hot !== null ? tyreSnap.corners[c].nextCold : tyreSnap.corners[c].cold;
      prof.coldTyres[c] = Number(nextVal.toFixed(1));
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl) coldEl.value = prof.coldTyres[c].toFixed(1);
    });

    recalcTyres();
    const c = prof.coldTyres;
    showToast(
      `Saved ${tyreSnap.venue} Cold PSI: FL ${c.FL.toFixed(1)} • FR ${c.FR.toFixed(1)} • RL ${c.RL.toFixed(1)} • RR ${c.RR.toFixed(1)}`
    );
  }

  function saveTyresToSession() {
    const tyreSnap = recalcTyres();
    const { iso: sessionDateIso, display: sessionDate } = getSelectedSessionDate();
    const sessionName = getSelectedSessionName();
    const notes = (($('inputTyreRunNotes') && $('inputTyreRunNotes').value) || '').trim();

    const unified = upsertUnifiedSession({
      venue: tyreSnap.venue,
      sessionDateIso,
      sessionDate,
      sessionName,
      tyreHotTarget: Number(tyreSnap.tyreHotTarget.toFixed(1)),
      tyres: {
        FL: { ...tyreSnap.corners.FL },
        FR: { ...tyreSnap.corners.FR },
        RL: { ...tyreSnap.corners.RL },
        RR: { ...tyreSnap.corners.RR }
      },
      appendNote: notes
    });

    if ($('inputTyreRunNotes')) {
      $('inputTyreRunNotes').value = '';
    }
    saveState();
    renderSessionLog();
    showToast(`Saved 4-Corner Tyres to ${unified.sessionName} (${unified.venue}) in Session Log`);
  }

  function exportTyresCsv() {
    exportSessionsCsv();
  }

  /* ------------------------------------------------------------------------
     6. RENDERING: TAB 4 (UNIFIED SESSION LOG, INLINE EDIT, CSV & JSON)
     ------------------------------------------------------------------------ */
  function formatOptionalPillAfr(val) {
    const norm = normalizeOptionalAfr(val);
    return norm !== null ? norm.toFixed(2) : '&mdash;';
  }

  function renderUnifiedFuelWeightBlock(s) {
    const hasPour = s.litresToPourL !== null && s.litresToPourL !== undefined && Number.isFinite(Number(s.litresToPourL));
    const hasPump =
      s.fuelInL !== null &&
      s.fuelInL !== undefined &&
      Number.isFinite(Number(s.fuelInL)) &&
      s.fuelOutL !== null &&
      s.fuelOutL !== undefined &&
      Number.isFinite(Number(s.fuelOutL));
    const hasWeight =
      (s.postRaceEstKg !== null && s.postRaceEstKg !== undefined && Number.isFinite(Number(s.postRaceEstKg))) ||
      (s.scaleWeightKg !== null && s.scaleWeightKg !== undefined && Number.isFinite(Number(s.scaleWeightKg)));

    if (!hasPour && !hasPump && !hasWeight) return '';

    const parts = [];
    if (hasPour) {
      parts.push(`<span>Pour: <strong class="txt-emerald">${Number(s.litresToPourL).toFixed(1)} L</strong></span>`);
    }
    if (hasPump) {
      const inL = Number(s.fuelInL);
      const outL = Number(s.fuelOutL);
      const usedL = Number.isFinite(Number(s.fuelUsedL)) ? Number(s.fuelUsedL) : Math.max(0, inL - outL);
      const laps = Number.isFinite(Number(s.racedLaps)) && Number(s.racedLaps) > 0 ? Math.round(Number(s.racedLaps)) : null;
      const burn =
        Number.isFinite(Number(s.measuredBurnLPerLap)) && Number(s.measuredBurnLPerLap) > 0
          ? Number(s.measuredBurnLPerLap)
          : laps
          ? usedL / laps
          : null;
      const lapBurnStr =
        laps && burn !== null ? ` (${laps} laps = <strong class="txt-emerald">${burn.toFixed(2)} L/lap</strong>)` : '';
      parts.push(
        `<span>In: <strong>${inL.toFixed(1)}L</strong> &bull; Out: <strong>${outL.toFixed(1)}L</strong> &bull; Used: <strong>${usedL.toFixed(1)}L</strong>${lapBurnStr}</span>`
      );
    }
    if (hasWeight) {
      const wt = Number.isFinite(Number(s.postRaceEstKg)) ? Number(s.postRaceEstKg) : Number(s.scaleWeightKg);
      const wtClass = wt < 1365.0 ? 'txt-danger' : wt < 1368.0 ? 'txt-amber' : 'txt-emerald';
      parts.push(`<span>Scale/Est Wt: <strong class="${wtClass}">${wt.toFixed(1)} kg</strong></span>`);
    }

    return `
      <div class="unified-session-subblock">
        <div class="unified-subblock-title">Fuel &amp; Scrutineering Weight</div>
        <div class="unified-fuel-line">${parts.join(' &bull; ')}</div>
      </div>
    `;
  }

  function renderUnifiedTyresBlock(s) {
    if (!s.tyres || typeof s.tyres !== 'object') return '';
    const targetStr = Number.isFinite(Number(s.tyreHotTarget)) ? ` (Hot Target ${Number(s.tyreHotTarget).toFixed(1)} PSI)` : '';
    const pillsHtml = ['FL', 'FR', 'RL', 'RR']
      .map((c) => {
        const cr = s.tyres[c] || { cold: 30.0, hot: null, nextCold: 30.0 };
        const coldStr = Number.isFinite(Number(cr.cold)) ? `${Number(cr.cold).toFixed(1)}C` : '—C';
        const hotStr = cr.hot !== null && Number.isFinite(Number(cr.hot)) ? `${Number(cr.hot).toFixed(1)}H` : '—H';
        const nextStr = Number.isFinite(Number(cr.nextCold)) ? `Next ${Number(cr.nextCold).toFixed(1)}` : '';
        return `
          <div class="unified-tyre-pill">
            <span class="unified-tyre-corner">${c}</span>
            <span class="unified-tyre-val">${coldStr} &rarr; ${hotStr}</span>
            ${nextStr ? `<span class="unified-tyre-next">${nextStr}</span>` : ''}
          </div>
        `;
      })
      .join('');

    return `
      <div class="unified-session-subblock">
        <div class="unified-subblock-title">4-Corner Tyres${escapeHtml(targetStr)}</div>
        <div class="unified-tyre-grid">${pillsHtml}</div>
      </div>
    `;
  }

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
        const isConfirmingDelete = ui.confirmDeleteSessionId === s.id;
        const isEstimated = s.afrStatus === 'estimated';
        const wotValClass = isEstimated
          ? 'txt-amber'
          : prot.level === 'danger'
          ? 'txt-danger'
          : 'txt-emerald';
        const peakRpmVal = Number.isFinite(Number(s.peakRpm)) ? Math.round(Number(s.peakRpm)) : 5900;
        const venueLabel = s.venue || 'Calder Park Raceway';
        const dateLabel = s.sessionDate || formatIsoDateDisplay(s.sessionDateIso || getLocalTodayIso());
        const timePart = s.timestamp ? ` (${s.timestamp})` : '';
        const waterTemp = normalizeOptionalWaterTemp(s.waterTempC);
        const waterHtml =
          waterTemp !== null
            ? `<span class="${waterTemp >= 98 ? 'txt-danger' : waterTemp >= 92 ? 'txt-amber' : ''}">${waterTemp}&deg;C H&#8322;O</span>`
            : `<span>&mdash;&deg;C H&#8322;O</span>`;
        const fuelTempVal = Number.isFinite(Number(s.fuelTempC)) ? Number(s.fuelTempC) : 20.0;

        const stages = [
          { rpm: '3500', val: normalizeOptionalAfr(s.afr3500) },
          { rpm: '4000', val: normalizeOptionalAfr(s.afr4000) },
          { rpm: '4500', val: normalizeOptionalAfr(s.afr4500) },
          { rpm: '5000', val: normalizeOptionalAfr(s.afr5000) },
          { rpm: '5500', val: normalizeOptionalAfr(s.afr5500) }
        ];

        return `
          <article class="session-card ${isBaseline ? 'is-baseline' : ''}" data-session-id="${escapeHtml(s.id)}">
            <div class="session-head">
              <div>
                <div class="session-title-line">
                  ${escapeHtml(s.sessionName)} &bull; <span class="txt-amber">${escapeHtml(s.carbyId)}</span>
                </div>
                <div class="session-meta-line">
                  <strong>${escapeHtml(venueLabel)}</strong> &bull; ${escapeHtml(dateLabel)}${escapeHtml(timePart)} &bull;
                  <strong>${escapeHtml(s.jetLabel)}</strong> (${s.jetMm.toFixed(3)}mm) &bull;
                  ${s.rad.toFixed(1)}% RAD &bull; SG ${s.fuelSg.toFixed(3)} (${fuelTempVal.toFixed(0)}&deg;C) &bull; ${s.timing.toFixed(1)}&deg; &bull; ${s.fuelPsi.toFixed(1)} psi &bull; ${waterHtml}
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
              ${stages
                .map(
                  (st) => `
                  <div class="afr-pill">
                    <span class="afr-pill-rpm">${st.rpm}</span>
                    <span class="afr-pill-val ${st.val === null ? 'is-blank' : ''}">${st.val !== null ? st.val.toFixed(2) : '&mdash;'}</span>
                  </div>
                `
                )
                .join('')}
              <div class="afr-pill wot-pill">
                <span class="afr-pill-rpm">WOT @ ${peakRpmVal}</span>
                <span class="afr-pill-val ${wotValClass}">${Number(s.afrWot).toFixed(2)}</span>
              </div>
            </div>

            ${renderUnifiedFuelWeightBlock(s)}
            ${renderUnifiedTyresBlock(s)}

            ${s.notes ? `<p style="margin: 6px 0 4px; font-size: 0.77rem; color: var(--text-secondary);">${escapeHtml(s.notes)}</p>` : ''}

            <div class="session-actions">
              <button type="button" class="btn ${isEditing ? 'btn-danger' : 'btn-secondary'}" data-edit-session-afr="${escapeHtml(s.id)}">
                ${isEditing ? 'Cancel Edit' : 'Edit Session'}
              </button>
              <button type="button" class="btn ${isBaseline ? 'btn-emerald-outline' : 'btn-amber-outline'}" data-lock-session="${escapeHtml(s.id)}">
                ${isBaseline ? 'Locked Baseline' : 'Lock as Baseline'}
              </button>
              <button type="button" class="btn btn-danger" data-delete-session="${escapeHtml(s.id)}">
                ${isConfirmingDelete ? 'Tap Again to Delete' : 'Remove'}
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
    const peakRpmVal = Number.isFinite(Number(s.peakRpm)) ? Math.round(Number(s.peakRpm)) : 5900;
    const dateIsoVal = s.sessionDateIso || getLocalTodayIso();
    const venueVal = s.venue || 'Calder Park Raceway';
    const waterVal = normalizeOptionalWaterTemp(s.waterTempC);
    const optStages = [
      { key: '3500', label: '3500 RPM AFR (Optional)', val: normalizeOptionalAfr(s.afr3500) },
      { key: '4000', label: '4000 RPM AFR (Optional)', val: normalizeOptionalAfr(s.afr4000) },
      { key: '4500', label: '4500 RPM AFR (Optional)', val: normalizeOptionalAfr(s.afr4500) },
      { key: '5000', label: '5000 RPM AFR (Optional)', val: normalizeOptionalAfr(s.afr5000) },
      { key: '5500', label: '5500 RPM AFR (Optional)', val: normalizeOptionalAfr(s.afr5500) }
    ];
    return `
      <div class="inline-afr-editor">
        <div class="form-grid-2 stack-mobile" style="margin-bottom: 10px;">
          <div class="field-group" style="margin-bottom: 0;">
            <label class="field-label" for="inlineName_${escapeHtml(s.id)}">Session Name</label>
            <input type="text" id="inlineName_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(s.sessionName)}" />
          </div>
          <div class="field-group" style="margin-bottom: 0;">
            <label class="field-label" for="inlineVenue_${escapeHtml(s.id)}">Circuit / Track</label>
            <input type="text" id="inlineVenue_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(venueVal)}" />
          </div>
        </div>

        <div class="field-group" style="margin-bottom: 10px;">
          <label class="field-label" for="inlineDate_${escapeHtml(s.id)}">Session Date</label>
          <input type="date" id="inlineDate_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(dateIsoVal)}" />
        </div>

        <div class="field-group" style="margin-bottom: 10px;">
          <label class="field-label" for="inlinePeakRpm_${escapeHtml(s.id)}">Top / Peak WOT RPM</label>
          <div class="num-stepper">
            <button type="button" class="stepper-btn" data-stepper-target="inlinePeakRpm_${escapeHtml(s.id)}" data-step="-50" aria-label="Decrease Top WOT RPM">&minus;</button>
            <div class="num-input-wrap">
              <input type="number" id="inlinePeakRpm_${escapeHtml(s.id)}" class="num-input" value="${peakRpmVal}" min="4500" max="6800" step="50" />
              <span class="num-unit-badge">RPM</span>
            </div>
            <button type="button" class="stepper-btn" data-stepper-target="inlinePeakRpm_${escapeHtml(s.id)}" data-step="50" aria-label="Increase Top WOT RPM">+</button>
          </div>
        </div>

        <div class="field-group" style="margin-bottom: 10px;">
          <label class="field-label" for="inlineAfr_${escapeHtml(s.id)}_Wot">Logged Peak WOT AFR</label>
          <div class="num-stepper">
            <button type="button" class="stepper-btn" data-stepper-target="inlineAfr_${escapeHtml(s.id)}_Wot" data-step="-0.05" aria-label="Decrease WOT Collector AFR">&minus;</button>
            <div class="num-input-wrap">
              <input type="number" id="inlineAfr_${escapeHtml(s.id)}_Wot" class="num-input" value="${Number(s.afrWot).toFixed(2)}" min="10.00" max="16.00" step="0.05" />
              <span class="num-unit-badge">AFR</span>
            </div>
            <button type="button" class="stepper-btn" data-stepper-target="inlineAfr_${escapeHtml(s.id)}_Wot" data-step="0.05" aria-label="Increase WOT Collector AFR">+</button>
          </div>
        </div>

        <div class="field-group" style="margin-bottom: 10px;">
          <label class="field-label" for="inlineFuelPsi_${escapeHtml(s.id)}">WOT Fuel Pressure (psi)</label>
          <div class="num-stepper">
            <button type="button" class="stepper-btn" data-stepper-target="inlineFuelPsi_${escapeHtml(s.id)}" data-step="-0.1" aria-label="Decrease Session Fuel Pressure">&minus;</button>
            <div class="num-input-wrap">
              <input type="number" id="inlineFuelPsi_${escapeHtml(s.id)}" class="num-input" value="${Number(s.fuelPsi ?? 5.0).toFixed(1)}" min="2.0" max="8.5" step="0.1" />
              <span class="num-unit-badge">psi</span>
            </div>
            <button type="button" class="stepper-btn" data-stepper-target="inlineFuelPsi_${escapeHtml(s.id)}" data-step="0.1" aria-label="Increase Session Fuel Pressure">+</button>
          </div>
        </div>

        <div class="field-group" style="margin-bottom: 10px;">
          <label class="field-label" for="inlineWaterTemp_${escapeHtml(s.id)}">Peak Water Temp (&deg;C)</label>
          <div class="num-stepper">
            <button type="button" class="stepper-btn" data-stepper-target="inlineWaterTemp_${escapeHtml(s.id)}" data-step="-1" aria-label="Decrease Session Water Temp">&minus;</button>
            <div class="num-input-wrap">
              <input type="number" id="inlineWaterTemp_${escapeHtml(s.id)}" class="num-input" value="${waterVal !== null ? waterVal : ''}" placeholder="&mdash;" min="50" max="125" step="1" />
              <span class="num-unit-badge">&deg;C</span>
            </div>
            <button type="button" class="stepper-btn" data-stepper-target="inlineWaterTemp_${escapeHtml(s.id)}" data-step="1" aria-label="Increase Session Water Temp">+</button>
          </div>
        </div>

        <div class="field-group" style="margin-bottom: 12px;">
          <label class="field-label" for="inlineNotes_${escapeHtml(s.id)}">Session Notes</label>
          <input type="text" id="inlineNotes_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(s.notes || '')}" />
        </div>

        <div class="mid-sweep-panel" style="margin-bottom: 12px;">
          <div class="mid-sweep-head">
            <span class="field-hint">Optional 3500&ndash;5500 RPM Sweep (leave blank for &mdash;)</span>
            <button type="button" class="btn btn-danger btn-xs" data-clear-inline-sweep="${escapeHtml(s.id)}">
              Clear Sweep (Leave Blank)
            </button>
          </div>
          ${optStages
            .map(
              (f) => `
              <div class="field-group" style="margin-bottom: 10px;">
                <label class="field-label" for="inlineAfr_${escapeHtml(s.id)}_${f.key}">${f.label}</label>
                <div class="num-stepper">
                  <button type="button" class="stepper-btn" data-stepper-target="inlineAfr_${escapeHtml(s.id)}_${f.key}" data-step="-0.05" aria-label="Decrease ${f.label}">&minus;</button>
                  <div class="num-input-wrap">
                    <input type="number" id="inlineAfr_${escapeHtml(s.id)}_${f.key}" class="num-input" value="${f.val !== null ? f.val.toFixed(2) : ''}" placeholder="&mdash;" min="10.00" max="16.00" step="0.05" />
                    <span class="num-unit-badge">AFR</span>
                  </div>
                  <button type="button" class="stepper-btn" data-stepper-target="inlineAfr_${escapeHtml(s.id)}_${f.key}" data-step="0.05" aria-label="Increase ${f.label}">+</button>
                </div>
              </div>
            `
            )
            .join('')}
        </div>

        <button type="button" class="btn btn-confirm btn-full" data-save-session-afr="${escapeHtml(s.id)}">
          Save Session &amp; Post-Race Telemetry
        </button>
      </div>
    `;
  }

  function exportSessionsCsv() {
    const headers = [
      'Session',
      'Venue',
      'Date',
      'Timestamp',
      'Carby_ID',
      'Jet_Label',
      'Jet_mm',
      'RAD_Pct',
      'Fuel_SG',
      'Fuel_Temp_C',
      'Timing_BTDC',
      'Fuel_PSI',
      'Water_Temp_C',
      'AFR_3500',
      'AFR_4000',
      'AFR_4500',
      'AFR_5000',
      'AFR_5500',
      'AFR_WOT',
      'Peak_WOT_RPM',
      'AFR_Status',
      'EndCyl_1_6_Est',
      'Litres_To_Pour_L',
      'Starting_Fuel_Req_L',
      'Fuel_In_L',
      'Fuel_Out_L',
      'Fuel_Used_L',
      'Raced_Laps',
      'Measured_Burn_L_Lap',
      'Scale_Weight_Kg',
      'Post_Race_Est_Kg',
      'Tyre_Hot_Target_PSI',
      'FL_Cold_PSI',
      'FL_Hot_PSI',
      'FL_NextCold_PSI',
      'FR_Cold_PSI',
      'FR_Hot_PSI',
      'FR_NextCold_PSI',
      'RL_Cold_PSI',
      'RL_Hot_PSI',
      'RL_NextCold_PSI',
      'RR_Cold_PSI',
      'RR_Hot_PSI',
      'RR_NextCold_PSI',
      'Notes'
    ];
    const fmtOptDec = (val, dec = 1) =>
      val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val))
        ? Number(val).toFixed(dec)
        : '';
    const rows = state.sessions.map((s) => {
      const a35 = normalizeOptionalAfr(s.afr3500);
      const a40 = normalizeOptionalAfr(s.afr4000);
      const a45 = normalizeOptionalAfr(s.afr4500);
      const a50 = normalizeOptionalAfr(s.afr5000);
      const a55 = normalizeOptionalAfr(s.afr5500);
      const waterVal = normalizeOptionalWaterTemp(s.waterTempC);
      const fuelTempVal = Number.isFinite(Number(s.fuelTempC)) ? Number(s.fuelTempC) : 20.0;
      const peakRpmVal = Number.isFinite(Number(s.peakRpm)) ? Math.round(Number(s.peakRpm)) : 5900;
      const dateStr = s.sessionDate || formatIsoDateDisplay(s.sessionDateIso || getLocalTodayIso());
      const t = s.tyres || {};
      const fmtCorner = (c, k) => (t[c] ? fmtOptDec(t[c][k], 1) : '');
      return [
        s.sessionName,
        s.venue || 'Calder Park Raceway',
        dateStr,
        s.timestamp || '',
        s.carbyId,
        s.jetLabel,
        s.jetMm.toFixed(4),
        s.rad.toFixed(1),
        s.fuelSg.toFixed(3),
        fuelTempVal.toFixed(1),
        s.timing.toFixed(1),
        s.fuelPsi.toFixed(1),
        waterVal !== null ? String(waterVal) : '',
        a35 !== null ? a35.toFixed(2) : '',
        a40 !== null ? a40.toFixed(2) : '',
        a45 !== null ? a45.toFixed(2) : '',
        a50 !== null ? a50.toFixed(2) : '',
        a55 !== null ? a55.toFixed(2) : '',
        Number(s.afrWot).toFixed(2),
        String(peakRpmVal),
        s.afrStatus === 'estimated' ? 'ESTIMATED' : 'VERIFIED',
        (Number(s.afrWot) + END_CYL_LEAN_OFFSET).toFixed(2),
        fmtOptDec(s.litresToPourL, 1),
        fmtOptDec(s.startingFuelReqL, 1),
        fmtOptDec(s.fuelInL, 1),
        fmtOptDec(s.fuelOutL, 1),
        fmtOptDec(s.fuelUsedL, 2),
        s.racedLaps !== null && s.racedLaps !== undefined ? String(Math.round(Number(s.racedLaps))) : '',
        fmtOptDec(s.measuredBurnLPerLap, 2),
        fmtOptDec(s.scaleWeightKg, 1),
        fmtOptDec(s.postRaceEstKg, 1),
        fmtOptDec(s.tyreHotTarget, 1),
        fmtCorner('FL', 'cold'),
        fmtCorner('FL', 'hot'),
        fmtCorner('FL', 'nextCold'),
        fmtCorner('FR', 'cold'),
        fmtCorner('FR', 'hot'),
        fmtCorner('FR', 'nextCold'),
        fmtCorner('RL', 'cold'),
        fmtCorner('RL', 'hot'),
        fmtCorner('RL', 'nextCold'),
        fmtCorner('RR', 'cold'),
        fmtCorner('RR', 'hot'),
        fmtCorner('RR', 'nextCold'),
        s.notes || ''
      ];
    });

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
        hydrateFuelAndTyreInputs();
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
    const rpms = [3500, 4000, 4500, 5000, 5500, 6000];
    const defaults = {
      3500: { hp: 109.5, tq: 164.3, afr: 12.90 },
      4000: { hp: 125.0, tq: 164.1, afr: 12.86 },
      4500: { hp: 136.0, tq: 158.7, afr: 12.84 },
      5000: { hp: 140.5, tq: 147.6, afr: 12.82 },
      5500: { hp: 136.0, tq: 129.9, afr: 12.80 },
      6000: { hp: 128.5, tq: 112.5, afr: 12.79 }
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

    // Lower Plot: Wideband AFR 3500-6000 RPM (y: 214 -> 358)
    const botY = 214;
    const botH = 144;

    const minRpm = 3500;
    const maxRpm = 6000;
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

    // Vertical RPM grid lines (3500 to 6000 every 250 RPM)
    for (let rpm = 3500; rpm <= 6000; rpm += 250) {
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
    ctx.fillText('WIDEBAND COLLECTOR AFR (3500–6000 RPM)', padL + 4, botY - 5);

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

  function readOptionalAfr(id) {
    const el = $(id);
    if (!el) return null;
    const raw = String(el.value || '').trim();
    if (raw === '') return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null;
  }

  function readOptionalWaterTemp(id) {
    const el = $(id);
    if (!el) return null;
    const raw = String(el.value || '').trim();
    if (raw === '') return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  function syncPostRaceSkipAfrUi() {
    const skipEl = $('modalPostSkipAfr');
    const wrapEl = $('modalPostWotAfrStepperWrap');
    const previewEl = $('modalPostEndCylPreview');
    if (!skipEl || !wrapEl) return;
    const skipped = Boolean(skipEl.checked);
    wrapEl.classList.toggle('field-disabled-overlay', skipped);
    if (previewEl) {
      if (skipped) {
        previewEl.textContent = 'AFR Unchanged / Skipped';
        previewEl.className = 'field-hint amber';
      } else {
        const wot = readNum('modalPostWotAfr', 12.50);
        previewEl.textContent = `#1/#6 Est: ${(wot + END_CYL_LEAN_OFFSET).toFixed(2)}`;
        previewEl.className = 'field-hint emerald';
      }
    }
  }

  function syncPostRaceWaterHintUi() {
    const hintEl = $('modalPostWaterHint');
    if (!hintEl) return;
    const wt = readOptionalWaterTemp('modalPostWaterTemp');
    if (wt !== null && wt >= 98) {
      hintEl.textContent = `HOT ALERT: ${wt}°C (≥ 98°C)`;
      hintEl.className = 'field-hint danger';
    } else {
      hintEl.textContent = 'warn ≥ 98°C';
      hintEl.className = 'field-hint amber';
    }
  }

  function openPostRaceAfrModal() {
    const b = state.baseline;
    const pendingSess = getPendingPostRaceSession();
    const linked =
      pendingSess ||
      state.sessions.find((s) => s.id === b.linkedSessionId) ||
      state.sessions[state.sessions.length - 1] ||
      null;

    ui.postRaceTargetSessionId = linked ? linked.id : null;

    const sessionLabelName = linked ? linked.sessionName : b.sessionName;
    const sessionVenue = (linked && linked.venue) || b.venue || 'Calder Park Raceway';
    const sessionCarby = (linked && linked.carbyId) || b.carbyId;
    const sessionJet = (linked && linked.jetLabel) || b.jetLabel;

    const refAfr =
      linked && Number.isFinite(Number(linked.afrWot))
        ? Number(linked.afrWot)
        : b.wotAfr !== null && b.wotAfr !== undefined && Number.isFinite(Number(b.wotAfr))
        ? Number(b.wotAfr)
        : 12.80;

    const peakRpm =
      linked && Number.isFinite(Number(linked.peakRpm))
        ? Math.round(Number(linked.peakRpm))
        : Number.isFinite(Number(b.peakRpm))
        ? Math.round(Number(b.peakRpm))
        : 5900;

    const fuelPsi =
      linked && Number.isFinite(Number(linked.fuelPsi))
        ? Number(linked.fuelPsi)
        : Number.isFinite(Number(b.fuelPsi))
        ? Number(b.fuelPsi)
        : 5.0;

    const waterTemp =
      linked && normalizeOptionalWaterTemp(linked.waterTempC) !== null
        ? normalizeOptionalWaterTemp(linked.waterTempC)
        : normalizeOptionalWaterTemp(b.waterTempC) !== null
        ? normalizeOptionalWaterTemp(b.waterTempC)
        : 85;

    $('postRaceModalSessionLabel').textContent = `${sessionLabelName} • ${sessionVenue} (${sessionCarby} • ${sessionJet})`;
    if ($('modalPostPeakRpm')) {
      $('modalPostPeakRpm').value = String(peakRpm);
    }
    $('modalPostWotAfr').value = refAfr.toFixed(2);
    if ($('modalPostSkipAfr')) {
      $('modalPostSkipAfr').checked = false;
    }
    syncPostRaceSkipAfrUi();

    if ($('modalPostFuelPsi')) {
      $('modalPostFuelPsi').value = fuelPsi.toFixed(1);
    }
    if ($('modalPostWaterTemp')) {
      $('modalPostWaterTemp').value = String(waterTemp);
    }
    syncPostRaceWaterHintUi();

    if ($('modalPostNotes')) {
      $('modalPostNotes').value = linked && linked.notes ? linked.notes : '';
    }

    const fmtOpt = (val) => {
      const norm = normalizeOptionalAfr(val);
      return norm !== null ? norm.toFixed(2) : '';
    };
    $('modalPost3500').value = linked ? fmtOpt(linked.afr3500) : '';
    $('modalPost4000').value = linked ? fmtOpt(linked.afr4000) : '';
    $('modalPost4500').value = linked ? fmtOpt(linked.afr4500) : '';
    $('modalPost5000').value = linked ? fmtOpt(linked.afr5000) : '';
    if ($('modalPost5500')) {
      $('modalPost5500').value = linked ? fmtOpt(linked.afr5500) : '';
    }

    const hasAnyMidStage =
      linked &&
      [linked.afr3500, linked.afr4000, linked.afr4500, linked.afr5000, linked.afr5500].some(
        (v) => normalizeOptionalAfr(v) !== null
      );
    const wrap = $('postMidSweepWrap');
    const toggleBtn = $('btnTogglePostMidSweep');
    if (wrap && toggleBtn) {
      wrap.style.display = hasAnyMidStage ? 'block' : 'none';
      toggleBtn.setAttribute('aria-expanded', hasAnyMidStage ? 'true' : 'false');
      toggleBtn.textContent = hasAnyMidStage
        ? '− Hide Optional Mid-Range RPM Sweep (3500–5500 RPM)'
        : '+ Optional Mid-Range RPM Sweep (3500–5500 RPM)';
    }

    openModal('modalPostRaceAfr');
  }

  function savePostRaceAfrModal() {
    const linked =
      (ui.postRaceTargetSessionId && state.sessions.find((s) => s.id === ui.postRaceTargetSessionId)) ||
      getPendingPostRaceSession() ||
      state.sessions.find((s) => s.id === state.baseline.linkedSessionId) ||
      null;

    const fallbackAfr =
      linked && Number.isFinite(Number(linked.afrWot))
        ? Number(linked.afrWot)
        : state.baseline.wotAfr !== null && Number.isFinite(Number(state.baseline.wotAfr))
        ? Number(state.baseline.wotAfr)
        : 12.80;

    const skipAfr = Boolean($('modalPostSkipAfr') && $('modalPostSkipAfr').checked);
    const peakRpm = Math.round(readNum('modalPostPeakRpm', 5900));
    const wot = skipAfr ? fallbackAfr : Number(readNum('modalPostWotAfr', fallbackAfr).toFixed(2));
    const fuelPsi = Number(readNum('modalPostFuelPsi', state.baseline.fuelPsi || 5.0).toFixed(1));
    const waterTempC = readOptionalWaterTemp('modalPostWaterTemp');
    const notesVal = ($('modalPostNotes') && $('modalPostNotes').value.trim()) || '';

    const a35 = readOptionalAfr('modalPost3500');
    const a40 = readOptionalAfr('modalPost4000');
    const a45 = readOptionalAfr('modalPost4500');
    const a50 = readOptionalAfr('modalPost5000');
    const a55 = readOptionalAfr('modalPost5500');

    if (linked) {
      linked.afr3500 = a35;
      linked.afr4000 = a40;
      linked.afr4500 = a45;
      linked.afr5000 = a50;
      linked.afr5500 = a55;
      if (!skipAfr) {
        linked.afrWot = wot;
        linked.afrStatus = 'verified';
      } else if (!linked.afrStatus || linked.afrStatus === 'estimated') {
        linked.afrStatus = 'verified';
      }
      linked.peakRpm = peakRpm;
      linked.fuelPsi = fuelPsi;
      linked.waterTempC = waterTempC;
      if (notesVal) {
        linked.notes = notesVal;
      }

      // Promote this verified post-race session into Locked Baseline
      const iso = linked.sessionDateIso || state.baseline.sessionDateIso || getLocalTodayIso();
      state.baseline = {
        venue: linked.venue || state.baseline.venue || 'Calder Park Raceway',
        sessionDateIso: iso,
        sessionDate: linked.sessionDate || formatIsoDateDisplay(iso),
        sessionName: linked.sessionName,
        carbyId: linked.carbyId,
        jetId: linked.jetId,
        jetLabel: linked.jetLabel,
        jetMm: linked.jetMm,
        rad: linked.rad,
        fuelSg: linked.fuelSg,
        wotAfr: skipAfr && state.baseline.afrStatus === 'untested' ? null : linked.afrWot,
        peakRpm: linked.peakRpm,
        afrStatus: skipAfr && state.baseline.afrStatus === 'untested' ? 'untested' : 'verified',
        weatherOnly: Boolean(skipAfr && state.baseline.afrStatus === 'untested'),
        timing: linked.timing,
        fuelPsi: linked.fuelPsi,
        waterTempC: linked.waterTempC,
        linkedSessionId: linked.id
      };
      ui.weatherOnly = state.baseline.weatherOnly;
    } else {
      if (!skipAfr) {
        state.baseline.wotAfr = wot;
        state.baseline.afrStatus = 'verified';
        state.baseline.weatherOnly = false;
        ui.weatherOnly = false;
      }
      state.baseline.peakRpm = peakRpm;
      state.baseline.fuelPsi = fuelPsi;
      state.baseline.waterTempC = waterTempC;
    }

    state.awaitingPostRaceId = null;
    ui.postRaceTargetSessionId = null;

    // Update the matching carby's saved baseline anchor with the newly verified track reading
    const carby = state.carbies.find((c) => c.id === state.baseline.carbyId);
    if (carby && carby.baselineAnchor) {
      carby.baselineAnchor.jetId = state.baseline.jetId;
      carby.baselineAnchor.jetLabel = state.baseline.jetLabel;
      carby.baselineAnchor.jetMm = state.baseline.jetMm;
      carby.baselineAnchor.rad = state.baseline.rad;
      carby.baselineAnchor.fuelSg = state.baseline.fuelSg;
      if (!skipAfr && state.baseline.wotAfr !== null) {
        carby.baselineAnchor.verifiedAfr = state.baseline.wotAfr;
      }
      carby.baselineAnchor.fuelPsi = state.baseline.fuelPsi;
      carby.baselineAnchor.waterTempC = state.baseline.waterTempC;
      carby.baselineAnchor.sourceLabel = state.baseline.sessionName;
    }

    if ($('selectCalcCarby')) {
      $('selectCalcCarby').value = state.baseline.carbyId;
    }
    if ($('inputRadPct')) {
      $('inputRadPct').value = state.baseline.rad.toFixed(1);
    }

    saveState();
    closeModal('modalPostRaceAfr');
    syncSessionSelectFromBaseline(state.baseline.sessionName);
    renderAll();
    const waterMsg = waterTempC !== null ? ` • ${waterTempC}°C` : '';
    showToast(
      `Saved ${state.baseline.sessionName}: ${wot.toFixed(2)} AFR @ ${peakRpm} RPM • ${fuelPsi.toFixed(1)} psi${waterMsg}`
    );
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
    if ($('editBaseVenue')) {
      $('editBaseVenue').value = b.venue || 'Calder Park Raceway';
    }
    if ($('editBaseDate')) {
      $('editBaseDate').value = b.sessionDateIso || getLocalTodayIso();
    }
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
    if ($('editBaseWaterTemp')) {
      const wt = normalizeOptionalWaterTemp(b.waterTempC);
      $('editBaseWaterTemp').value = wt !== null ? String(wt) : '';
    }

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
    const venueVal =
      ($('editBaseVenue') && $('editBaseVenue').value.trim()) ||
      state.baseline.venue ||
      'Calder Park Raceway';
    const dateIsoVal =
      ($('editBaseDate') && $('editBaseDate').value.trim()) ||
      state.baseline.sessionDateIso ||
      getLocalTodayIso();
    const waterTempC = readOptionalWaterTemp('editBaseWaterTemp');

    state.baseline = {
      sessionName: ($('editBaseSession').value || '').trim() || 'Baseline',
      venue: venueVal,
      sessionDateIso: dateIsoVal,
      sessionDate: formatIsoDateDisplay(dateIsoVal),
      carbyId: $('editBaseCarby').value || '1 DME',
      jetId: jet.id,
      jetLabel,
      jetMm,
      rad: Number(readNum('editBaseRad', 94.3).toFixed(1)),
      fuelSg: Number(readNum('editBaseSg', 0.740).toFixed(3)),
      wotAfr: wotAfrVal,
      peakRpm: state.baseline.peakRpm || 5900,
      afrStatus: isWo ? 'untested' : 'verified',
      weatherOnly: isWo,
      timing: Number(readNum('editBaseTiming', 33.0).toFixed(1)),
      fuelPsi: Number(readNum('editBaseFuelPsi', 5.0).toFixed(1)),
      waterTempC,
      linkedSessionId: null
    };
    state.awaitingPostRaceId = null;
    ui.weatherOnly = isWo;

    if ($('selectCalcCarby')) {
      $('selectCalcCarby').value = state.baseline.carbyId;
    }
    saveState();
    closeModal('modalEditBaseline');
    syncSessionSelectFromBaseline();
    renderAll();
    showToast(
      `Locked ${state.baseline.sessionName} • ${state.baseline.venue} (${state.baseline.jetMm.toFixed(3)} mm${isWo ? ' • Weather-Only' : ''})`
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
    const rawStr = String(inputEl.value || '').trim();
    const current = rawStr === '' ? NaN : parseFloat(rawStr);
    const min = inputEl.min !== '' ? parseFloat(inputEl.min) : -Infinity;
    const max = inputEl.max !== '' ? parseFloat(inputEl.max) : Infinity;
    const stepStr = String(Math.abs(delta));
    const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;

    // If an optional AFR, Hot Tyre PSI, Tyre Temp, or Water Temp field is blank, start at a sensible default when stepping
    const idStr = String(inputEl.id || '');
    if (idStr === 'inputScaleCheckKg' && (!Number.isFinite(current) || current <= 500)) {
      inputEl.value = delta > 0 ? '1375.0' : '0.0';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const fallbackBase =
      idStr.startsWith('inputColdTemp_')
        ? 22
        : idStr.startsWith('inputHotTemp_')
        ? 68
        : min >= 10 && max <= 16.5
        ? 12.80
        : min >= 18 && max <= 65
        ? readNum('inputTyreHotTarget', 44.0)
        : min >= 45 && max <= 130
        ? 85
        : Number.isFinite(min)
        ? min
        : 0;
    const baseVal = Number.isFinite(current) ? current : fallbackBase;
    let next = baseVal + (Number.isFinite(current) ? delta : 0);
    if (Number.isFinite(min)) next = Math.max(min, next);
    if (Number.isFinite(max)) next = Math.min(max, next);

    inputEl.value = next.toFixed(decimals);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
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
    if (tabId === 'tab-fuel') {
      recalcFuelAndWeight();
    }
    if (tabId === 'tab-tyres') {
      recalcTyres();
    }
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
    recalcFuelAndWeight();
    recalcTyres();
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

      const clearInlineSweepBtn = e.target.closest('[data-clear-inline-sweep]');
      if (clearInlineSweepBtn) {
        const sid = clearInlineSweepBtn.getAttribute('data-clear-inline-sweep');
        [3500, 4000, 4500, 5000, 5500].forEach((rpm) => {
          const inp = $(`inlineAfr_${sid}_${rpm}`);
          if (inp) inp.value = '';
        });
        showToast('Cleared 3500–5500 RPM fields (will save as blank)');
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
          const nameInput = $(`inlineName_${sid}`);
          const venueInput = $(`inlineVenue_${sid}`);
          const dateInput = $(`inlineDate_${sid}`);
          const notesInput = $(`inlineNotes_${sid}`);
          if (nameInput && nameInput.value.trim()) {
            sess.sessionName = nameInput.value.trim();
          }
          if (venueInput && venueInput.value.trim()) {
            sess.venue = venueInput.value.trim();
          }
          if (dateInput && dateInput.value.trim()) {
            sess.sessionDateIso = dateInput.value.trim();
            sess.sessionDate = formatIsoDateDisplay(sess.sessionDateIso);
          }
          if (notesInput) {
            sess.notes = notesInput.value.trim();
          }

          sess.afr3500 = readOptionalAfr(`inlineAfr_${sid}_3500`);
          sess.afr4000 = readOptionalAfr(`inlineAfr_${sid}_4000`);
          sess.afr4500 = readOptionalAfr(`inlineAfr_${sid}_4500`);
          sess.afr5000 = readOptionalAfr(`inlineAfr_${sid}_5000`);
          sess.afr5500 = readOptionalAfr(`inlineAfr_${sid}_5500`);
          sess.afrWot = Number(readNum(`inlineAfr_${sid}_Wot`, sess.afrWot ?? 12.80).toFixed(2));
          sess.peakRpm = Math.round(readNum(`inlinePeakRpm_${sid}`, sess.peakRpm || 5900));
          sess.fuelPsi = Number(readNum(`inlineFuelPsi_${sid}`, sess.fuelPsi ?? 5.0).toFixed(1));
          sess.waterTempC = readOptionalWaterTemp(`inlineWaterTemp_${sid}`);
          sess.afrStatus = 'verified';

          if (state.awaitingPostRaceId === sid) {
            state.awaitingPostRaceId = null;
          }
          if (state.baseline.linkedSessionId === sid) {
            state.baseline.sessionName = sess.sessionName;
            state.baseline.venue = sess.venue;
            state.baseline.sessionDateIso = sess.sessionDateIso;
            state.baseline.sessionDate = sess.sessionDate;
            state.baseline.wotAfr = sess.afrWot;
            state.baseline.peakRpm = sess.peakRpm;
            state.baseline.fuelPsi = sess.fuelPsi;
            state.baseline.waterTempC = sess.waterTempC;
            state.baseline.afrStatus = 'verified';
            state.baseline.weatherOnly = false;
            ui.weatherOnly = false;
          }
          ui.editingSessionId = null;
          saveState();
          renderAll();
          showToast(`Saved ${sess.sessionName} (${sess.venue})`);
        }
        return;
      }

      const lockSessionBtn = e.target.closest('[data-lock-session]');
      if (lockSessionBtn) {
        const sid = lockSessionBtn.getAttribute('data-lock-session');
        const sess = state.sessions.find((s) => s.id === sid);
        if (sess) {
          const iso = sess.sessionDateIso || getLocalTodayIso();
          state.baseline = {
            sessionName: sess.sessionName,
            venue: sess.venue || 'Calder Park Raceway',
            sessionDateIso: iso,
            sessionDate: sess.sessionDate || formatIsoDateDisplay(iso),
            carbyId: sess.carbyId,
            jetId: sess.jetId,
            jetLabel: sess.jetLabel,
            jetMm: sess.jetMm,
            rad: sess.rad,
            fuelSg: sess.fuelSg,
            wotAfr: sess.afrWot,
            peakRpm: sess.peakRpm || 5900,
            afrStatus: sess.afrStatus || 'verified',
            weatherOnly: false,
            timing: sess.timing,
            fuelPsi: sess.fuelPsi,
            waterTempC: normalizeOptionalWaterTemp(sess.waterTempC),
            linkedSessionId: sess.id
          };
          state.awaitingPostRaceId = null;
          ui.weatherOnly = false;
          if ($('selectCalcCarby')) {
            $('selectCalcCarby').value = sess.carbyId;
          }
          saveState();
          syncSessionSelectFromBaseline(sess.sessionName);
          renderAll();
          showToast(`Locked ${sess.sessionName} • ${state.baseline.venue} (${sess.jetLabel}) as Baseline`);
        }
        return;
      }

      const deleteSessionBtn = e.target.closest('[data-delete-session]');
      if (deleteSessionBtn) {
        const sid = deleteSessionBtn.getAttribute('data-delete-session');
        const sess = state.sessions.find((s) => s.id === sid);
        if (!sess) return;

        if (ui.confirmDeleteSessionId !== sid) {
          ui.confirmDeleteSessionId = sid;
          renderSessionLog();
          showToast(`Tap "Tap Again to Delete" to remove ${sess.sessionName}`);
          setTimeout(() => {
            if (ui.confirmDeleteSessionId === sid) {
              ui.confirmDeleteSessionId = null;
              renderSessionLog();
            }
          }, 4000);
          return;
        }

        const removedName = sess.sessionName;
        const removedVenue = sess.venue || 'Calder Park Raceway';
        state.sessions = state.sessions.filter((s) => s.id !== sid);
        if (state.baseline.linkedSessionId === sid) {
          state.baseline.linkedSessionId = null;
        }
        if (state.awaitingPostRaceId === sid) {
          state.awaitingPostRaceId = null;
        }
        if (ui.editingSessionId === sid) {
          ui.editingSessionId = null;
        }
        ui.confirmDeleteSessionId = null;
        recalculateTrackAverageBurn(removedVenue);
        saveState();
        renderAll();
        showToast(`Removed ${removedName}`);
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

    // Delegated document-level input/change listener for guaranteed live reactivity on Tab 2 (Fuel & Wt) and Tab 3 (Tyres)
    const handleLiveFuelOrTyreInput = (e) => {
      const target = e.target;
      if (!target || !target.id) return;
      if (target.closest('#tab-fuel') || target.id === 'inputFuelSg') {
        recalcFuelAndWeight();
      } else if (target.closest('#tab-tyres')) {
        recalcTyres();
      }
    };
    document.addEventListener('input', handleLiveFuelOrTyreInput);
    document.addEventListener('change', handleLiveFuelOrTyreInput);

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

    // Synchronized Session Name Selectors across Tab 1 (Calculator), Tab 2 (Fuel & Wt), and Tab 3 (Tyres)
    [
      ['selectSessionName', 'inputCustomSessionName'],
      ['selectFuelSessionName', 'inputCustomFuelSessionName'],
      ['selectTyreSessionName', 'inputCustomTyreSessionName']
    ].forEach(([selId, customId]) => {
      const sel = $(selId);
      const customInp = $(customId);
      if (sel) {
        sel.addEventListener('change', () => {
          updateCustomSessionVisibility();
          if (sel.value !== '__CUSTOM__') {
            setSessionNameOnAllTabs(sel.value);
          } else {
            ['selectSessionName', 'selectFuelSessionName', 'selectTyreSessionName'].forEach((otherId) => {
              if ($(otherId)) $(otherId).value = '__CUSTOM__';
            });
            updateCustomSessionVisibility();
          }
        });
      }
      if (customInp) {
        customInp.addEventListener('input', () => {
          const val = customInp.value;
          ['inputCustomSessionName', 'inputCustomFuelSessionName', 'inputCustomTyreSessionName'].forEach((otherId) => {
            if (otherId !== customId && $(otherId)) $(otherId).value = val;
          });
        });
      }
    });

    // Synchronized Session Date inputs across Tab 1 (Calculator), Tab 2 (Fuel & Wt), and Tab 3 (Tyres)
    ['inputSessionDate', 'inputFuelSessionDate', 'inputTyreSessionDate'].forEach((dateId) => {
      const el = $(dateId);
      if (el) {
        const syncDate = () => {
          if (el.value) setSessionDateOnAllTabs(el.value);
        };
        el.addEventListener('change', syncDate);
        el.addEventListener('input', syncDate);
      }
    });

    // Synchronized Track Selectors across Tab 1 (Calculator), Tab 2 (Fuel & Wt), and Tab 3 (Tyres)
    if ($('selectTrackVenue')) {
      $('selectTrackVenue').addEventListener('change', () => {
        updateCustomTrackVisibility();
        const venue = getSelectedTrackVenue();
        setVenueOnAllTrackSelectors(venue, true);
        recalcFuelAndWeight();
        recalcTyres();
      });
    }
    if ($('inputCustomTrack')) {
      $('inputCustomTrack').addEventListener('input', () => {
        const val = $('inputCustomTrack').value;
        if ($('inputCustomFuelTrack')) $('inputCustomFuelTrack').value = val;
        if ($('inputCustomTyreTrack')) $('inputCustomTyreTrack').value = val;
        const venue = getSelectedTrackVenue();
        loadTrackProfileToFuelAndTyreInputs(venue);
        recalcFuelAndWeight();
        recalcTyres();
      });
    }
    if ($('selectFuelTrack')) {
      $('selectFuelTrack').addEventListener('change', () => {
        updateCustomTrackVisibility();
        const venue = getSelectedFuelTrackVenue();
        setVenueOnAllTrackSelectors(venue, true);
        recalcFuelAndWeight();
        recalcTyres();
        showToast(`Loaded ${venue} L/lap & Cold Tyre profile`);
      });
    }
    if ($('inputCustomFuelTrack')) {
      $('inputCustomFuelTrack').addEventListener('input', () => {
        const val = $('inputCustomFuelTrack').value;
        if ($('inputCustomTrack')) $('inputCustomTrack').value = val;
        if ($('inputCustomTyreTrack')) $('inputCustomTyreTrack').value = val;
        const venue = getSelectedFuelTrackVenue();
        loadTrackProfileToFuelAndTyreInputs(venue);
        recalcFuelAndWeight();
        recalcTyres();
      });
    }
    if ($('selectTyreTrack')) {
      $('selectTyreTrack').addEventListener('change', () => {
        updateCustomTrackVisibility();
        const venue = getSelectedTyreTrackVenue();
        setVenueOnAllTrackSelectors(venue, true);
        recalcFuelAndWeight();
        recalcTyres();
        showToast(`Loaded ${venue} Cold Tyre & L/lap profile`);
      });
    }
    if ($('inputCustomTyreTrack')) {
      $('inputCustomTyreTrack').addEventListener('input', () => {
        const val = $('inputCustomTyreTrack').value;
        if ($('inputCustomTrack')) $('inputCustomTrack').value = val;
        if ($('inputCustomFuelTrack')) $('inputCustomFuelTrack').value = val;
        const venue = getSelectedTyreTrackVenue();
        loadTrackProfileToFuelAndTyreInputs(venue);
        recalcFuelAndWeight();
        recalcTyres();
      });
    }

    $('selectCalcCarby').addEventListener('change', updateCarbySwapHint);

    // Tab 2 (Fuel & Wt) and Tab 3 (Tyres) unified session save buttons
    if ($('btnSaveFuelWeightSession')) {
      $('btnSaveFuelWeightSession').addEventListener('click', saveFuelAndWeightToSession);
    }
    if ($('btnSaveTrackColdTyres')) {
      $('btnSaveTrackColdTyres').addEventListener('click', saveColdStartsToTrackProfile);
    }
    if ($('btnSaveTyresSession')) {
      $('btnSaveTyresSession').addEventListener('click', saveTyresToSession);
    }

    if ($('btnTogglePostMidSweep')) {
      $('btnTogglePostMidSweep').addEventListener('click', () => {
        const wrap = $('postMidSweepWrap');
        const btn = $('btnTogglePostMidSweep');
        if (!wrap || !btn) return;
        const isHidden = wrap.style.display === 'none';
        wrap.style.display = isHidden ? 'block' : 'none';
        btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        btn.textContent = isHidden
          ? '− Hide Optional Mid-Range RPM Sweep (3500–5500 RPM)'
          : '+ Optional Mid-Range RPM Sweep (3500–5500 RPM)';
      });
    }

    if ($('btnClearPostMidSweep')) {
      $('btnClearPostMidSweep').addEventListener('click', () => {
        ['modalPost3500', 'modalPost4000', 'modalPost4500', 'modalPost5000', 'modalPost5500'].forEach((id) => {
          const el = $(id);
          if (el) el.value = '';
        });
        showToast('Cleared 3500–5500 RPM sweep (will save as blank)');
      });
    }

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
    ['inputRadPct', 'inputTempC', 'inputPressure', 'inputRhPct', 'inputFuelSg', 'inputFuelTempC', 'inputTargetAfr', 'inputTotalTiming'].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener('input', () => {
          renderStep1LiveHints();
          if (id === 'inputFuelSg') recalcFuelAndWeight();
        });
      }
    });

    $('selectFullJetKit').addEventListener('change', (e) => {
      ui.selectedJetId = e.target.value;
      renderStep2Calculator(false);
    });

    // Baseline modals
    $('btnOpenPostRaceAfr').addEventListener('click', openPostRaceAfrModal);
    $('btnSavePostRaceAfr').addEventListener('click', savePostRaceAfrModal);
    $('modalPostWotAfr').addEventListener('input', () => {
      syncPostRaceSkipAfrUi();
    });
    if ($('modalPostSkipAfr')) {
      $('modalPostSkipAfr').addEventListener('change', syncPostRaceSkipAfrUi);
    }
    if ($('modalPostWaterTemp')) {
      $('modalPostWaterTemp').addEventListener('input', syncPostRaceWaterHintUi);
    }

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
        awaitingPostRaceId: null,
        jets: createDefaultJets(),
        carbies: createDefaultCarbies(),
        sessions: createDefaultSessions(),
        dynoPulls: createDefaultDynoPulls(),
        chassis: createDefaultChassisState()
      };
      ui.weatherOnly = false;
      if ($('selectCalcCarby')) {
        $('selectCalcCarby').value = state.baseline.carbyId;
      }
      saveState();
      syncSessionSelectFromBaseline();
      hydrateFuelAndTyreInputs();
      renderAll();
      showToast('Restored Calder Park Race 1 Seed Data');
    });

    // Dyno Lab interactions (guarded when #tab-dyno is not in active DOM)
    if ($('btnToggleDynoForm')) {
      $('btnToggleDynoForm').addEventListener('click', () => {
        const card = $('dynoManualFormCard');
        if (card) card.style.display = card.style.display === 'none' ? 'block' : 'none';
      });
    }

    if ($('btnSaveManualDynoPull')) {
      $('btnSaveManualDynoPull').addEventListener('click', () => {
        const rpms = [3500, 4000, 4500, 5000, 5500, 6000];
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
        if ($('dynoManualFormCard')) $('dynoManualFormCard').style.display = 'none';
        renderDynoPullList();
        renderDynoCanvas();
        showToast(`Added "${name}" to Dyno Chart`);
      });
    }

    if ($('inputImportDynoCsv')) {
      $('inputImportDynoCsv').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          importDynoCsvFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    if ($('btnDownloadDynoTemplate')) {
      $('btnDownloadDynoTemplate').addEventListener('click', () => {
        const sample = [
          'rpm,hp,torque,afr',
          '3500,111.0,166.6,12.88',
          '4000,126.8,166.5,12.86',
          '4500,137.5,160.5,12.84',
          '5000,142.0,149.2,12.82',
          '5500,137.4,131.2,12.80',
          '6000,129.8,113.6,12.79'
        ].join('\n');
        triggerDownload(sample, 'hq202-dyno-sample.csv', 'text/csv;charset=utf-8;');
        showToast('Downloaded Sample Dyno CSV');
      });
    }

    // Dyno Canvas Pointer Scrubbing (guarded)
    const canvas = $('dynoCanvas');
    if (canvas) {
      const handleScrub = (clientX) => {
        const rect = canvas.getBoundingClientRect();
        const padL = 42;
        const padR = 14;
        const plotW = Math.max(1, rect.width - padL - padR);
        const relX = Math.max(0, Math.min(plotW, clientX - rect.left - padL));
        ui.dynoScrubRpm = 3500 + (relX / plotW) * 2500;
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
    }

    // Tab 5 Orifice Converter & Custom Jet Builder
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
  syncSessionSelectFromBaseline();
  hydrateFuelAndTyreInputs();
  bindEvents();
  renderAll();
  registerServiceWorker();
})();
