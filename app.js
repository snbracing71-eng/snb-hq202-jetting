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

  function normalizeVenueName(rawVenue) {
    const str = String(rawVenue || '').trim();
    if (!str || /^calder\s*park(\s*\/\s*track|\s*raceway)?$/i.test(str)) {
      return 'Calder Park Raceway';
    }
    return str;
  }

  function resolveSessionIsoDate(s, fallbackIso) {
    const fallback = (typeof fallbackIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fallbackIso.trim()))
      ? fallbackIso.trim()
      : getLocalTodayIso();
    if (!s || typeof s !== 'object') return fallback;

    const candidates = [s.sessionIsoDate, s.sessionDateIso, s.sessionDate, s.date];
    for (const raw of candidates) {
      if (!raw || typeof raw !== 'string') continue;
      const str = raw.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
      }
      // Match "11 Nov 2026" or "2 Nov 2025"
      const dmyText = str.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
      if (dmyText) {
        const dd = String(Number(dmyText[1])).padStart(2, '0');
        const mShort = dmyText[2].slice(0, 3).toLowerCase();
        const mIdx = MONTHS_SHORT.findIndex((m) => m.toLowerCase() === mShort);
        if (mIdx !== -1) {
          const mm = String(mIdx + 1).padStart(2, '0');
          return `${dmyText[3]}-${mm}-${dd}`;
        }
      }
      // Match "DD/MM/YYYY"
      const dmySlash = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmySlash) {
        const dd = String(Number(dmySlash[1])).padStart(2, '0');
        const mm = String(Number(dmySlash[2])).padStart(2, '0');
        return `${dmySlash[3]}-${mm}-${dd}`;
      }
    }
    return fallback;
  }

  function extractSessionYear(s) {
    const iso = resolveSessionIsoDate(s);
    const mIso = iso.match(/^(\d{4})-/);
    if (mIso) return mIso[1];
    const disp = String((s && (s.sessionDate || s.date)) || '');
    const mYear = disp.match(/\b(20\d{2}|19\d{2})\b/);
    return mYear ? mYear[1] : String(new Date().getFullYear());
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

  function createDefaultEvents() {
    const calderIso = '2026-11-08';
    const calderDisp = formatIsoDateDisplay(calderIso);
    const wintonIso = '2026-09-20';
    const wintonDisp = formatIsoDateDisplay(wintonIso);

    return [
      {
        id: 'evt_calder_nov26',
        venue: 'Calder Park Raceway',
        eventDate: calderIso,
        eventTitle: 'Club Championship Rd 4',
        locked: true,
        endedAt: '2026-11-08T17:15:00',
        sessions: [
          {
            id: 'calder_p1',
            eventId: 'evt_calder_nov26',
            status: 'completed',
            venue: 'Calder Park Raceway',
            sessionDateIso: calderIso,
            sessionIsoDate: calderIso,
            sessionDate: calderDisp,
            sessionName: 'Practice 1',
            timestamp: 'Sat 09:10',
            carbyId: '1 DME',
            manifoldId: 'Macca',
            exhaustId: 'Macca',
            jetId: 'm1_78',
            jetLabel: '#78',
            jetMm: 1.9812,
            rad: 97.4,
            fuelSg: 0.740,
            fuelTempC: 18.0,
            timing: 33.0,
            fuelPsi: 5.0,
            waterTempC: 82,
            afr3500: 12.94,
            afr4000: 12.88,
            afr4500: 12.82,
            afr5000: 12.79,
            afr5500: 12.78,
            afrWot: 12.78,
            peakRpm: 5900,
            afrStatus: 'verified',
            litresToPourL: 28.0,
            startingFuelReqL: 28.0,
            expectedBurnL: 10.4,
            fuelFloorL: 12.0,
            fuelInL: 28.0,
            fuelOutL: 17.6,
            fuelUsedL: 10.4,
            racedLaps: 8,
            measuredBurnLPerLap: 1.30,
            scaleWeightKg: 1378.0,
            postRaceEstKg: 1370.3,
            tyreHotTarget: 44.0,
            tyreCondition: 'dry',
            tyres: {
              FL: { tyreId: 'KB1', cold: 30.0, hot: 44.2, build: 14.2, nextCold: 29.8 },
              FR: { tyreId: 'KB2', cold: 30.0, hot: 44.8, build: 14.8, nextCold: 29.4 },
              RL: { tyreId: 'KB3', cold: 30.0, hot: 43.6, build: 13.6, nextCold: 30.3 },
              RR: { tyreId: 'KB4', cold: 30.0, hot: 44.0, build: 14.0, nextCold: 30.0 }
            },
            preRaceNotes: 'Mounted KB1-KB4 @ 30.0 psi cold square, #78 jet in 1 DME for morning shakedown.',
            postRaceNotes: 'Crisp morning air at Calder; 1 DME + Macca manifold/exhaust baseline shakedown.',
            notes: 'Crisp morning air at Calder; 1 DME + Macca manifold/exhaust baseline shakedown.'
          },
          {
            id: 'calder_q1',
            eventId: 'evt_calder_nov26',
            status: 'completed',
            venue: 'Calder Park Raceway',
            sessionDateIso: calderIso,
            sessionIsoDate: calderIso,
            sessionDate: calderDisp,
            sessionName: 'Qualifying',
            timestamp: 'Sat 11:45',
            carbyId: '1 DME',
            manifoldId: 'Macca',
            exhaustId: 'Macca',
            jetId: 'm1_78',
            jetLabel: '#78',
            jetMm: 1.9812,
            rad: 95.2,
            fuelSg: 0.740,
            fuelTempC: 19.5,
            timing: 33.5,
            fuelPsi: 5.0,
            waterTempC: 85,
            afr3500: 12.86,
            afr4000: 12.80,
            afr4500: 12.75,
            afr5000: 12.71,
            afr5500: 12.72,
            afrWot: 12.72,
            peakRpm: 5950,
            afrStatus: 'verified',
            litresToPourL: 28.0,
            startingFuelReqL: 28.0,
            expectedBurnL: 10.4,
            fuelFloorL: 12.0,
            fuelInL: 28.0,
            fuelOutL: 17.7,
            fuelUsedL: 10.3,
            racedLaps: 8,
            measuredBurnLPerLap: 1.29,
            scaleWeightKg: 1377.5,
            postRaceEstKg: 1369.9,
            tyreHotTarget: 44.0,
            tyreCondition: 'dry',
            tyres: {
              FL: { tyreId: 'KB1', cold: 29.8, hot: 44.0, build: 14.2, nextCold: 29.8 },
              FR: { tyreId: 'KB2', cold: 29.4, hot: 44.1, build: 14.7, nextCold: 29.3 },
              RL: { tyreId: 'KB3', cold: 30.3, hot: 43.9, build: 13.6, nextCold: 30.4 },
              RR: { tyreId: 'KB4', cold: 30.0, hot: 44.0, build: 14.0, nextCold: 30.0 }
            },
            preRaceNotes: 'Applied Practice 1 Next Cold PSIs (FL 29.8, FR 29.4, RL 30.3, RR 30.0), +0.5° timing.',
            postRaceNotes: 'Qualified P2; stagger dialed to 44.0 psi hot across all 4 corners.',
            notes: 'Qualified P2; stagger dialed to 44.0 psi hot across all 4 corners.'
          },
          {
            id: 'calder_r1',
            eventId: 'evt_calder_nov26',
            status: 'completed',
            venue: 'Calder Park Raceway',
            sessionDateIso: calderIso,
            sessionIsoDate: calderIso,
            sessionDate: calderDisp,
            sessionName: 'Race 1',
            timestamp: 'Sun 10:35',
            carbyId: '1 DME',
            manifoldId: 'Macca',
            exhaustId: 'Macca',
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
            afrStatus: 'verified',
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
            tyreCondition: 'dry',
            tyres: {
              FL: { tyreId: 'KB1', cold: 30.0, hot: 43.8, build: 13.8, nextCold: 30.2 },
              FR: { tyreId: 'KB2', cold: 30.0, hot: 44.6, build: 14.6, nextCold: 29.5 },
              RL: { tyreId: 'KB3', cold: 30.0, hot: 43.4, build: 13.4, nextCold: 30.5 },
              RR: { tyreId: 'KB4', cold: 30.0, hot: 44.2, build: 14.2, nextCold: 29.8 }
            },
            preRaceNotes: 'Stepped richer to #77 / 2.000 mm for pack slipstream protection; 36.0 L fuel in.',
            postRaceNotes: 'Safe rich slipstream setup (2.000mm drill in #77 body); 5.0 psi steady at block boss.',
            notes: 'Safe rich slipstream setup (2.000mm drill in #77 body); 5.0 psi steady at block boss.'
          },
          {
            id: 'calder_r2',
            eventId: 'evt_calder_nov26',
            status: 'completed',
            venue: 'Calder Park Raceway',
            sessionDateIso: calderIso,
            sessionIsoDate: calderIso,
            sessionDate: calderDisp,
            sessionName: 'Race 2',
            timestamp: 'Sun 14:20',
            carbyId: '1 DME',
            manifoldId: 'Macca',
            exhaustId: 'Macca',
            jetId: 'm1_78',
            jetLabel: '#78',
            jetMm: 1.9812,
            rad: 93.9,
            fuelSg: 0.740,
            fuelTempC: 21.0,
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
            afrStatus: 'verified',
            litresToPourL: 33.2,
            startingFuelReqL: 33.2,
            expectedBurnL: 15.6,
            fuelFloorL: 12.0,
            fuelInL: 33.2,
            fuelOutL: 17.5,
            fuelUsedL: 15.7,
            racedLaps: 12,
            measuredBurnLPerLap: 1.31,
            scaleWeightKg: 1377.0,
            postRaceEstKg: 1370.1,
            tyreHotTarget: 44.0,
            tyreCondition: 'dry',
            tyres: {
              FL: { tyreId: 'KB1', cold: 30.2, hot: 44.0, build: 13.8, nextCold: 30.2 },
              FR: { tyreId: 'KB2', cold: 29.5, hot: 44.1, build: 14.6, nextCold: 29.4 },
              RL: { tyreId: 'KB3', cold: 30.5, hot: 43.9, build: 13.4, nextCold: 30.6 },
              RR: { tyreId: 'KB4', cold: 29.8, hot: 44.0, build: 14.2, nextCold: 29.8 }
            },
            preRaceNotes: 'Dropped to #78 jet for 93.9% RAD; loaded Race 1 Next Cold PSIs across all 4 corners.',
            postRaceNotes: 'Stepped leaner to #78 — dead in 12.8-12.9 HQ 202 sweet spot, P1 finish.',
            notes: 'Stepped leaner to #78 — dead in 12.8-12.9 HQ 202 sweet spot, P1 finish.'
          }
        ]
      },
      {
        id: 'evt_winton_sep26',
        venue: 'Winton Motor Raceway',
        eventDate: wintonIso,
        eventTitle: 'Vic State Series Rd 3',
        locked: true,
        endedAt: '2026-09-20T16:45:00',
        sessions: [
          {
            id: 'winton_p1',
            eventId: 'evt_winton_sep26',
            status: 'completed',
            venue: 'Winton Motor Raceway',
            sessionDateIso: wintonIso,
            sessionIsoDate: wintonIso,
            sessionDate: wintonDisp,
            sessionName: 'Practice 1',
            timestamp: 'Sat 09:30',
            carbyId: 'SNB Carby',
            manifoldId: 'Macca',
            exhaustId: 'Macca',
            jetId: 'm1_78',
            jetLabel: '#78',
            jetMm: 1.9812,
            rad: 98.2,
            fuelSg: 0.740,
            fuelTempC: 16.5,
            timing: 33.0,
            fuelPsi: 5.0,
            waterTempC: 81,
            afr3500: 13.02,
            afr4000: 12.96,
            afr4500: 12.90,
            afr5000: 12.87,
            afr5500: 12.88,
            afrWot: 12.88,
            peakRpm: 5900,
            afrStatus: 'verified',
            litresToPourL: 29.0,
            startingFuelReqL: 29.0,
            expectedBurnL: 11.6,
            fuelFloorL: 12.0,
            fuelInL: 29.0,
            fuelOutL: 17.4,
            fuelUsedL: 11.6,
            racedLaps: 8,
            measuredBurnLPerLap: 1.45,
            scaleWeightKg: 1377.0,
            postRaceEstKg: 1370.4,
            tyreHotTarget: 44.0,
            tyreCondition: 'dry',
            tyres: {
              FL: { tyreId: 'KB1', cold: 29.6, hot: 44.1, build: 14.5, nextCold: 29.5 },
              FR: { tyreId: 'KB2', cold: 30.2, hot: 43.9, build: 13.7, nextCold: 30.3 },
              RL: { tyreId: 'KB3', cold: 29.8, hot: 44.0, build: 14.2, nextCold: 29.8 },
              RR: { tyreId: 'KB4', cold: 30.2, hot: 43.8, build: 13.6, nextCold: 30.4 }
            },
            preRaceNotes: 'Bolted on SNB Carby (#78 jet) + Winton CW cold stagger (FL 29.6, RL 29.8).',
            postRaceNotes: 'Cold Winton morning; SNB Carby crisp off the sweeper.',
            notes: 'Cold Winton morning; SNB Carby crisp off the sweeper.'
          },
          {
            id: 'winton_q1',
            eventId: 'evt_winton_sep26',
            status: 'completed',
            venue: 'Winton Motor Raceway',
            sessionDateIso: wintonIso,
            sessionIsoDate: wintonIso,
            sessionDate: wintonDisp,
            sessionName: 'Qualifying',
            timestamp: 'Sat 12:15',
            carbyId: 'SNB Carby',
            manifoldId: 'Macca',
            exhaustId: 'Macca',
            jetId: 'm1_78',
            jetLabel: '#78',
            jetMm: 1.9812,
            rad: 96.4,
            fuelSg: 0.740,
            fuelTempC: 18.0,
            timing: 33.5,
            fuelPsi: 5.0,
            waterTempC: 84,
            afr3500: 12.95,
            afr4000: 12.90,
            afr4500: 12.85,
            afr5000: 12.82,
            afr5500: 12.83,
            afrWot: 12.83,
            peakRpm: 5950,
            afrStatus: 'verified',
            litresToPourL: 29.0,
            startingFuelReqL: 29.0,
            expectedBurnL: 11.6,
            fuelFloorL: 12.0,
            fuelInL: 29.0,
            fuelOutL: 17.5,
            fuelUsedL: 11.5,
            racedLaps: 8,
            measuredBurnLPerLap: 1.44,
            scaleWeightKg: 1377.0,
            postRaceEstKg: 1370.5,
            tyreHotTarget: 44.0,
            tyreCondition: 'dry',
            tyres: {
              FL: { tyreId: 'KB1', cold: 29.5, hot: 44.0, build: 14.5, nextCold: 29.5 },
              FR: { tyreId: 'KB2', cold: 30.3, hot: 44.0, build: 13.7, nextCold: 30.3 },
              RL: { tyreId: 'KB3', cold: 29.8, hot: 44.0, build: 14.2, nextCold: 29.8 },
              RR: { tyreId: 'KB4', cold: 30.4, hot: 44.0, build: 13.6, nextCold: 30.4 }
            },
            preRaceNotes: 'Set Next Cold PSIs from Practice 1; kept #78 jet & bumped timing to 33.5°.',
            postRaceNotes: 'Front-row qualifying lap; 1.44 L/lap verified on pump-out.',
            notes: 'Front-row qualifying lap; 1.44 L/lap verified on pump-out.'
          },
          {
            id: 'winton_r1',
            eventId: 'evt_winton_sep26',
            status: 'completed',
            venue: 'Winton Motor Raceway',
            sessionDateIso: wintonIso,
            sessionIsoDate: wintonIso,
            sessionDate: wintonDisp,
            sessionName: 'Race 1',
            timestamp: 'Sun 13:40',
            carbyId: 'SNB Carby',
            manifoldId: 'Macca',
            exhaustId: 'Macca',
            jetId: 'm1_78',
            jetLabel: '#78',
            jetMm: 1.9812,
            rad: 95.8,
            fuelSg: 0.740,
            fuelTempC: 19.0,
            timing: 33.0,
            fuelPsi: 5.0,
            waterTempC: 85,
            afr3500: 12.92,
            afr4000: 12.87,
            afr4500: 12.83,
            afr5000: 12.80,
            afr5500: 12.81,
            afrWot: 12.80,
            peakRpm: 5950,
            afrStatus: 'verified',
            litresToPourL: 34.8,
            startingFuelReqL: 34.8,
            expectedBurnL: 17.4,
            fuelFloorL: 12.0,
            fuelInL: 35.0,
            fuelOutL: 17.6,
            fuelUsedL: 17.4,
            racedLaps: 12,
            measuredBurnLPerLap: 1.45,
            scaleWeightKg: 1377.0,
            postRaceEstKg: 1370.1,
            tyreHotTarget: 44.0,
            tyreCondition: 'dry',
            tyres: {
              FL: { tyreId: 'KB1', cold: null, hot: 44.0, build: null, nextCold: null },
              FR: { tyreId: 'KB2', cold: null, hot: 44.1, build: null, nextCold: null },
              RL: { tyreId: 'KB3', cold: null, hot: 43.9, build: null, nextCold: null },
              RR: { tyreId: 'KB4', cold: null, hot: 44.0, build: null, nextCold: null }
            },
            preRaceNotes: 'Cleared Cold PSI (already bled hot in Qualifying); poured 35.0 L for 12 laps.',
            postRaceNotes: 'Left tyres at hot-set from Qualifying; 12-lap race win with +5.1 kg scale margin.',
            notes: 'Left tyres at hot-set from Qualifying; 12-lap race win with +5.1 kg scale margin.'
          }
        ]
      }
    ];
  }

  function flattenEventsToSessions(events) {
    if (!Array.isArray(events)) return [];
    const flat = [];
    events.forEach((evt) => {
      if (!evt || !Array.isArray(evt.sessions)) return;
      const evtVenue = normalizeVenueName(evt.venue || 'Calder Park Raceway');
      const evtIso = evt.eventDate || getLocalTodayIso();
      const evtDisp = formatIsoDateDisplay(evtIso) || evtIso;
      evt.sessions.forEach((s) => {
        if (!s) return;
        s.eventId = evt.id;
        s.eventTitle = evt.eventTitle || '';
        s.eventLocked = Boolean(evt.locked);
        s.venue = normalizeVenueName(s.venue || evtVenue);
        s.sessionDateIso = s.sessionDateIso || s.sessionIsoDate || evtIso;
        s.sessionIsoDate = s.sessionDateIso;
        s.sessionDate = s.sessionDate || formatIsoDateDisplay(s.sessionDateIso) || evtDisp;
        flat.push(s);
      });
    });
    return flat;
  }

  function createDefaultSessions() {
    return flattenEventsToSessions(createDefaultEvents());
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

  const TRACK_DIRECTION_MAP = {
    'Calder Park': 'CW',
    'Calder Park Raceway': 'CW',
    'Winton': 'CW',
    'Winton Motor Raceway': 'CW',
    'Sandown': 'CCW',
    'Sandown Raceway': 'CCW',
    'Sandown International Raceway': 'CCW',
    'Phillip Island': 'CCW',
    'Phillip Island Grand Prix Circuit': 'CCW',
    'Sydney Motorsport Park': 'CCW',
    'Sydney Motorsport Park (SMSP)': 'CCW',
    'The Bend': 'CCW',
    'The Bend Motorsport Park': 'CCW',
    'Symmons Plains': 'CW',
    'Symmons Plains Raceway': 'CW',
    'Queensland Raceway': 'CCW',
    'Queensland Raceway (Willowbank)': 'CCW',
    'Mallala': 'CW',
    'Mallala Motorsport Park': 'CW',
    'Morgan Park': 'CW',
    'Morgan Park Raceway': 'CW',
    'Wakefield Park': 'CCW',
    'Wakefield Park / One Raceway': 'CCW',
    'One Raceway': 'CCW',
    'Barbagallo': 'CW',
    'Wanneroo': 'CW',
    'CARCO.com.au Raceway (Wanneroo)': 'CW',
    'Hidden Valley': 'CW',
    'Hidden Valley Raceway': 'CW',
    'Baskerville': 'CW',
    'Baskerville Raceway': 'CW',
    'Mount Panorama (Bathurst)': 'CCW',
    'Bathurst': 'CCW',
    'Lakeside Park': 'CW',
    'Broadford': 'CW',
    'Haunted Hills': 'CW',
    'Pheasant Wood': 'CW',
    'Collie Motorplex': 'CCW',
    'Townsville': 'CW'
  };

  const WET_PRESET_PROFILES = {
    drying: {
      label: 'Drying Line',
      unloadedFrontCold: 36.5,
      rearOffset: -1.2,      // Rear 1.2 psi softer for live-axle traction + drum brake footprint
      loadedSideOffset: -1.0,// Higher L/R stagger as dry line heats outside tyre
      hotTargetPsi: 44.0
    },
    light: {
      label: 'Light Rain',
      unloadedFrontCold: 38.8,
      rearOffset: -1.2,
      loadedSideOffset: -0.7,
      hotTargetPsi: 43.5
    },
    heavy: {
      label: 'Heavy Rain',
      unloadedFrontCold: 41.0,
      rearOffset: -1.2,
      loadedSideOffset: -0.4,// Minimal L/R stagger; water quenches both sides evenly
      hotTargetPsi: 44.5     // Extra structural crown to clear standing water
    }
  };

  function getTrackDirection(venueName = '') {
    if (TRACK_DIRECTION_MAP[venueName]) return TRACK_DIRECTION_MAP[venueName];
    const match = Object.keys(TRACK_DIRECTION_MAP).find((k) =>
      venueName.toLowerCase().includes(k.toLowerCase())
    );
    return match ? TRACK_DIRECTION_MAP[match] : 'CW';
  }

  function computeWetColdStagger(presetKey, direction) {
    const p = WET_PRESET_PROFILES[presetKey] || WET_PRESET_PROFILES.light;
    const unloadedF = p.unloadedFrontCold;
    const unloadedR = Number((unloadedF + p.rearOffset).toFixed(1));
    const loadedF   = Number((unloadedF + p.loadedSideOffset).toFixed(1));
    const loadedR   = Number((unloadedR + p.loadedSideOffset).toFixed(1));

    // Clockwise (CW) loads LEFT side (FL/RL); Anti-Clockwise (CCW) loads RIGHT side (FR/RR)
    const isCW = direction === 'CW';
    return {
      FL: isCW ? loadedF : unloadedF,
      FR: isCW ? unloadedF : loadedF,
      RL: isCW ? loadedR : unloadedR,
      RR: isCW ? unloadedR : loadedR,
      hotTargetPsi: p.hotTargetPsi,
      direction
    };
  }

  function createDefaultWetTyreSet(purchaseDate = '2026-01-01') {
    return [
      {
        id: 'KW1',
        code: 'KW1',
        label: 'KW1',
        spec: 'wet',
        stamp: 'HQRA #201 (Kenda KR15 Full-Tread Wet)',
        purchaseDate,
        treadMm: 8.0,
        durometer: 60,
        baseLaps: 0,
        totalLaps: 0,
        retired: false
      },
      {
        id: 'KW2',
        code: 'KW2',
        label: 'KW2',
        spec: 'wet',
        stamp: 'HQRA #202 (Kenda KR15 Full-Tread Wet)',
        purchaseDate,
        treadMm: 8.0,
        durometer: 60,
        baseLaps: 0,
        totalLaps: 0,
        retired: false
      },
      {
        id: 'KW3',
        code: 'KW3',
        label: 'KW3',
        spec: 'wet',
        stamp: 'HQRA #203 (Kenda KR15 Full-Tread Wet)',
        purchaseDate,
        treadMm: 8.0,
        durometer: 60,
        baseLaps: 0,
        totalLaps: 0,
        retired: false
      },
      {
        id: 'KW4',
        code: 'KW4',
        label: 'KW4',
        spec: 'wet',
        stamp: 'HQRA #204 (Kenda KR15 Full-Tread Wet)',
        purchaseDate,
        treadMm: 8.0,
        durometer: 60,
        baseLaps: 0,
        totalLaps: 0,
        retired: false
      }
    ];
  }

  function createDefaultTyrePool() {
    return [
      {
        id: 'KB1',
        code: 'KB1',
        label: 'KB1',
        spec: 'buffed',
        stamp: 'HQRA #101 (Kenda KR15 Buffed Dry)',
        purchaseDate: '2026-01-01',
        treadMm: 4.8,
        durometer: 62,
        baseLaps: 14,
        totalLaps: 24,
        retired: false
      },
      {
        id: 'KB2',
        code: 'KB2',
        label: 'KB2',
        spec: 'buffed',
        stamp: 'HQRA #102 (Kenda KR15 Buffed Dry)',
        purchaseDate: '2026-01-01',
        treadMm: 4.6,
        durometer: 63,
        baseLaps: 14,
        totalLaps: 24,
        retired: false
      },
      {
        id: 'KB3',
        code: 'KB3',
        label: 'KB3',
        spec: 'buffed',
        stamp: 'HQRA #103 (Kenda KR15 Buffed Dry)',
        purchaseDate: '2026-01-01',
        treadMm: 5.0,
        durometer: 62,
        baseLaps: 14,
        totalLaps: 24,
        retired: false
      },
      {
        id: 'KB4',
        code: 'KB4',
        label: 'KB4',
        spec: 'buffed',
        stamp: 'HQRA #104 (Kenda KR15 Buffed Dry)',
        purchaseDate: '2026-01-01',
        treadMm: 4.9,
        durometer: 62,
        baseLaps: 14,
        totalLaps: 24,
        retired: false
      },
      ...createDefaultWetTyreSet('2026-01-01')
    ];
  }

  function migrateLegacyTyreId(rawId) {
    if (!rawId || typeof rawId !== 'string') return rawId;
    const trimmed = rawId.trim();
    if (/^K([1-4])$/i.test(trimmed)) {
      return `KB${trimmed.slice(1)}`;
    }
    return trimmed;
  }

  function createDefaultTrackProfiles() {
    const profiles = {};
    Object.keys(DEFAULT_TRACK_BURN_L).forEach((track) => {
      const dir = getTrackDirection(track);
      const wetDef = computeWetColdStagger('light', dir);
      profiles[track] = {
        burnLPerLap: DEFAULT_TRACK_BURN_L[track],
        coldTyres:
          track === 'Calder Park Raceway'
            ? { FL: 30.2, FR: 29.5, RL: 30.5, RR: 29.8 }
            : { FL: 30.0, FR: 30.0, RL: 30.0, RR: 30.0 },
        wetColdTyres: { FL: wetDef.FL, FR: wetDef.FR, RL: wetDef.RL, RR: wetDef.RR }
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
      tyreCondition: 'dry',
      wetPreset: 'light',
      mountedTyres: { FL: 'KB1', FR: 'KB2', RL: 'KB3', RR: 'KB4' },
      coldTyres: { FL: 30.2, FR: 29.5, RL: 30.5, RR: 29.8 },
      hotTyres: { FL: null, FR: null, RL: null, RR: null },
      trackProfiles: createDefaultTrackProfiles(),
      pumpRuns: [],
      historyRuns: []
    };
  }

  const DEFAULT_CORNER_TYRE_IDS = { FL: 'KB1', FR: 'KB2', RL: 'KB3', RR: 'KB4' };

  function normalizeTyreCornersObject(rawCorners) {
    if (!rawCorners || typeof rawCorners !== 'object') return null;
    const pickOptPos = (v) =>
      v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0
        ? Number(Number(v).toFixed(1))
        : null;
    const normCorner = (newKey, oldKey) => {
      const src = rawCorners[newKey] || rawCorners[oldKey];
      if (!src || typeof src !== 'object') return null;
      const cold = pickOptPos(src.cold);
      const hot = pickOptPos(src.hot);
      const build = cold !== null && hot !== null ? Number((hot - cold).toFixed(1)) : null;
      const nextCold =
        cold !== null && hot !== null
          ? pickOptPos(src.nextCold)
          : cold !== null
          ? cold
          : null;
      const rawTid =
        typeof src.tyreId === 'string' && src.tyreId.trim()
          ? src.tyreId.trim()
          : DEFAULT_CORNER_TYRE_IDS[newKey] || 'KB1';
      const tyreId = migrateLegacyTyreId(rawTid);
      return {
        tyreId,
        cold,
        hot,
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
      FL: fl || { tyreId: 'KB1', cold: null, hot: null, build: null, nextCold: null },
      FR: fr || { tyreId: 'KB2', cold: null, hot: null, build: null, nextCold: null },
      RL: rl || { tyreId: 'KB3', cold: null, hot: null, build: null, nextCold: null },
      RR: rr || { tyreId: 'KB4', cold: null, hot: null, build: null, nextCold: null }
    };
  }

  function createDefaultManifolds() {
    return [
      {
        id: 'Macca',
        name: 'Macca',
        onCar: true,
        casting: 'Group 3H Cast Single-Barrel Log',
        portFlowCfm: { front: 155, middle: 155, rear: 155 },
        notes: 'Primary race manifold currently on car.'
      },
      {
        id: 'SNB',
        name: 'SNB',
        onCar: false,
        casting: 'Group 3H Cast Single-Barrel Log',
        portFlowCfm: { front: 155, middle: 155, rear: 155 },
        notes: 'Spare / development manifold.'
      }
    ];
  }

  function createDefaultExhausts() {
    return [
      {
        id: 'Macca',
        name: 'Macca',
        onCar: true,
        flowCfm: null,
        spec: 'Main #1 Race System (On Car)',
        notes: 'Main #1 exhaust currently on car.'
      },
      {
        id: 'DME',
        name: 'DME',
        onCar: false,
        flowCfm: null,
        spec: 'Test / Spare Header System',
        notes: 'To test & flow bench.'
      },
      {
        id: 'Pounder',
        name: 'Pounder',
        onCar: false,
        flowCfm: null,
        spec: 'Test / Spare Header System',
        notes: 'To test & flow bench.'
      },
      {
        id: 'Grunt',
        name: 'Grunt',
        onCar: false,
        flowCfm: null,
        spec: 'Test / Spare Header System',
        notes: 'To test & flow bench.'
      }
    ];
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

    // Hydrate Inlet Manifolds ("Macca" ON CAR & "SNB" seeded at 155 CFM across all 3 ports)
    const defManifolds = createDefaultManifolds();
    if (!Array.isArray(candidate.manifolds) || candidate.manifolds.length === 0) {
      candidate.manifolds = defManifolds;
    } else {
      const seenManIds = new Set();
      candidate.manifolds = candidate.manifolds
        .map((m, idx) => {
          const id = String(m.id || m.name || `Man_${idx + 1}`).trim();
          const name = String(m.name || id).trim();
          const pf = (m.portFlowCfm && typeof m.portFlowCfm === 'object') ? m.portFlowCfm : {};
          const front = Number.isFinite(Number(pf.front)) ? Number(pf.front) : 155;
          const middle = Number.isFinite(Number(pf.middle)) ? Number(pf.middle) : 155;
          const rear = Number.isFinite(Number(pf.rear)) ? Number(pf.rear) : 155;
          return {
            id,
            name,
            onCar: Boolean(m.onCar),
            casting: typeof m.casting === 'string' && m.casting.trim() ? m.casting.trim() : 'Group 3H Cast Single-Barrel Log',
            portFlowCfm: { front, middle, rear },
            notes: typeof m.notes === 'string' ? m.notes : ''
          };
        })
        .filter((m) => {
          if (seenManIds.has(m.id)) return false;
          seenManIds.add(m.id);
          return true;
        });

      defManifolds.forEach((dm) => {
        if (!candidate.manifolds.some((existing) => existing.id.toLowerCase() === dm.id.toLowerCase())) {
          candidate.manifolds.push(dm);
        }
      });
    }
    const activeManifold =
      candidate.manifolds.find((m) => m.id === candidate.activeManifoldId) ||
      candidate.manifolds.find((m) => m.onCar) ||
      candidate.manifolds[0];
    candidate.activeManifoldId = activeManifold ? activeManifold.id : 'Macca';
    candidate.manifolds.forEach((m) => {
      m.onCar = m.id === candidate.activeManifoldId;
    });

    // Hydrate Exhausts / Headers ("Macca" ON CAR + "DME", "Pounder", "Grunt")
    const defExhausts = createDefaultExhausts();
    if (!Array.isArray(candidate.exhausts) || candidate.exhausts.length === 0) {
      candidate.exhausts = defExhausts;
    } else {
      const seenExhIds = new Set();
      candidate.exhausts = candidate.exhausts
        .map((ex, idx) => {
          const id = String(ex.id || ex.name || `Exh_${idx + 1}`).trim();
          const name = String(ex.name || id).trim();
          const rawCfm = ex.flowCfm;
          const flowCfm =
            rawCfm !== null && rawCfm !== undefined && rawCfm !== '' && Number.isFinite(Number(rawCfm)) && Number(rawCfm) > 0
              ? Number(Number(rawCfm).toFixed(1))
              : null;
          return {
            id,
            name,
            onCar: Boolean(ex.onCar),
            flowCfm,
            spec: typeof ex.spec === 'string' && ex.spec.trim() ? ex.spec.trim() : 'Test / Spare Header System',
            notes: typeof ex.notes === 'string' ? ex.notes : ''
          };
        })
        .filter((ex) => {
          if (seenExhIds.has(ex.id)) return false;
          seenExhIds.add(ex.id);
          return true;
        });

      defExhausts.forEach((de) => {
        if (!candidate.exhausts.some((existing) => existing.id.toLowerCase() === de.id.toLowerCase())) {
          candidate.exhausts.push(de);
        }
      });
    }
    const activeExhaust =
      candidate.exhausts.find((ex) => ex.id === candidate.activeExhaustId) ||
      candidate.exhausts.find((ex) => ex.onCar) ||
      candidate.exhausts[0];
    candidate.activeExhaustId = activeExhaust ? activeExhaust.id : 'Macca';
    candidate.exhausts.forEach((ex) => {
      ex.onCar = ex.id === candidate.activeExhaustId;
    });

    const defTyrePool = createDefaultTyrePool();
    if (!Array.isArray(candidate.tyrePool) || candidate.tyrePool.length === 0) {
      candidate.tyrePool = defTyrePool;
    } else {
      const seenIds = new Set();
      candidate.tyrePool = candidate.tyrePool
        .map((t, idx) => {
          const rawId = String(t.id || t.label || t.code || `KB${idx + 1}`).trim();
          const id = migrateLegacyTyreId(rawId);
          const rawLabel = String(t.label || t.code || id).trim();
          const label = /^K[1-4]$/i.test(rawLabel) ? migrateLegacyTyreId(rawLabel) : rawLabel;
          const code = label;
          const isSeedDry = ['KB1', 'KB2', 'KB3', 'KB4'].includes(id);
          const isWet = t.spec === 'wet' || /^KW/i.test(id) || /^KW/i.test(label);
          const spec = isWet ? 'wet' : 'buffed';
          const purchaseDate =
            typeof t.purchaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.purchaseDate.trim())
              ? t.purchaseDate.trim()
              : isSeedDry || isWet
              ? '2026-01-01'
              : todayIso;
          const rawTread = Number(t.treadMm ?? t.treadDepthMm);
          const defaultTread = isWet ? 8.0 : isSeedDry ? 4.8 : 5.0;
          const treadMm = Number.isFinite(rawTread) ? Number(rawTread.toFixed(1)) : defaultTread;
          const rawDuro = Number(t.durometer ?? t.hardness);
          const durometer = Number.isFinite(rawDuro)
            ? Math.max(40, Math.min(95, Math.round(rawDuro)))
            : isWet
            ? 60
            : 62;
          const baseLaps = Number.isFinite(Number(t.baseLaps ?? t.initialLaps))
            ? Math.max(0, Math.round(Number(t.baseLaps ?? t.initialLaps)))
            : isSeedDry
            ? 14
            : 0;
          return {
            id,
            code,
            label,
            spec,
            stamp:
              typeof t.stamp === 'string' && t.stamp.trim()
                ? t.stamp.trim()
                : `Kenda KR15 ${spec === 'wet' ? 'Wet' : 'Buffed'} (${label})`,
            purchaseDate,
            treadMm,
            durometer,
            baseLaps,
            totalLaps: baseLaps,
            retired: Boolean(t.retired)
          };
        })
        .filter((t) => {
          if (seenIds.has(t.id)) return false;
          seenIds.add(t.id);
          return true;
        });

      // Seed ready-to-go set of 4 Full-Tread Wet tyres KW1-KW4 if no KW tyres exist yet
      const hasAnyWet = candidate.tyrePool.some((t) => t.spec === 'wet' || /^KW/i.test(t.id));
      if (!hasAnyWet) {
        createDefaultWetTyreSet('2026-01-01').forEach((wt) => {
          if (!candidate.tyrePool.some((existing) => existing.id === wt.id)) {
            candidate.tyrePool.push(wt);
          }
        });
      }
    }

    const b = candidate.baseline || createDefaultBaseline();
    b.venue = normalizeVenueName(b.venue);
    const baseIso = resolveSessionIsoDate(b, todayIso);
    b.sessionDateIso = baseIso;
    b.sessionIsoDate = baseIso;
    if (!b.sessionDate) {
      b.sessionDate = formatIsoDateDisplay(baseIso) || todayDisp;
    }
    if (!b.manifoldId) {
      b.manifoldId = candidate.activeManifoldId || 'Macca';
    }
    if (!b.exhaustId) {
      b.exhaustId = candidate.activeExhaustId || 'Macca';
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
    candidate.activeSessionId = candidate.activeSessionId || null;

    const defaultEvents = createDefaultEvents();
    const defaultSessions = flattenEventsToSessions(defaultEvents);
    const defCalderR1 = defaultSessions.find((ds) => ds.id === 'calder_r1');

    const hydrateSingleSession = (s, fallbackVenue, fallbackIso) => {
      const defMatch = defaultSessions.find((ds) => ds.id === s.id);
      const venue = normalizeVenueName(s.venue || fallbackVenue || 'Calder Park Raceway');
      const sessionDateIso = resolveSessionIsoDate(s, fallbackIso || todayIso);
      const sessionIsoDate = sessionDateIso;
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

      const inferredWet =
        s.tyreCondition === 'wet' ||
        (tyres && ['FL', 'FR', 'RL', 'RR'].some((c) => tyres[c] && /^KW/i.test(String(tyres[c].tyreId || ''))));

      const preRaceNotes =
        typeof s.preRaceNotes === 'string'
          ? s.preRaceNotes.trim()
          : defMatch && typeof defMatch.preRaceNotes === 'string'
          ? defMatch.preRaceNotes
          : '';
      const postRaceNotes =
        typeof s.postRaceNotes === 'string'
          ? s.postRaceNotes.trim()
          : defMatch && typeof defMatch.postRaceNotes === 'string'
          ? defMatch.postRaceNotes
          : typeof s.notes === 'string'
          ? s.notes.trim()
          : '';
      const combinedNotes = postRaceNotes || (typeof s.notes === 'string' ? s.notes.trim() : '') || preRaceNotes || '';

      return {
        ...s,
        status: s.status === 'active' ? 'active' : 'completed',
        venue,
        sessionDateIso,
        sessionIsoDate,
        sessionDate,
        manifoldId: s.manifoldId || 'Macca',
        exhaustId: s.exhaustId || 'Macca',
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
        tyreCondition: inferredWet ? 'wet' : 'dry',
        tyres,
        preRaceNotes,
        postRaceNotes,
        notes: combinedNotes
      };
    };

    // One-time Weekend Event Architecture Migration (v0.5.7):
    // Clear old flat loose dummy sessions and seed the 2 multi-session Locked Events
    if (!candidate.eventArchitectureV1) {
      candidate.events = defaultEvents.map((evt) => ({
        ...evt,
        venue: normalizeVenueName(evt.venue),
        locked: true,
        sessions: (evt.sessions || []).map((s) => hydrateSingleSession(s, evt.venue, evt.eventDate))
      }));
      candidate.activeEventId = null;
      candidate.activeSessionId = null;
      candidate.eventArchitectureV1 = true;
      candidate.awaitingPostRaceId = null;
    } else if (Array.isArray(candidate.events) && candidate.events.length > 0) {
      candidate.events = candidate.events.map((evt, idx) => {
        const evtVenue = normalizeVenueName(evt.venue || 'Calder Park Raceway');
        const evtIso =
          typeof evt.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(evt.eventDate.trim())
            ? evt.eventDate.trim()
            : todayIso;
        const evtId = String(evt.id || `evt_${idx + 1}`);
        const locked = Boolean(evt.locked);
        const sessions = Array.isArray(evt.sessions)
          ? evt.sessions.map((s) => {
              const hydrated = hydrateSingleSession(s, evtVenue, evtIso);
              hydrated.eventId = evtId;
              hydrated.eventTitle = evt.eventTitle || '';
              hydrated.eventLocked = locked;
              if (locked) {
                hydrated.status = 'completed';
              }
              return hydrated;
            })
          : [];
        return {
          id: evtId,
          venue: evtVenue,
          eventDate: evtIso,
          eventTitle: typeof evt.eventTitle === 'string' ? evt.eventTitle.trim() : '',
          locked,
          endedAt: evt.endedAt || (locked ? `${evtIso}T17:00:00` : null),
          sessions
        };
      });
      const activeEvt = candidate.activeEventId
        ? candidate.events.find((e) => e.id === candidate.activeEventId && !e.locked)
        : null;
      if (!activeEvt) {
        candidate.activeEventId = null;
        candidate.activeSessionId = null;
      } else {
        if (
          candidate.activeSessionId &&
          !activeEvt.sessions.some((s) => s && s.id === candidate.activeSessionId)
        ) {
          candidate.activeSessionId = null;
        }
        activeEvt.sessions.forEach((s) => {
          if (s) {
            s.status = s.id === candidate.activeSessionId ? 'active' : 'completed';
          }
        });
      }
    } else if (Array.isArray(candidate.sessions) && candidate.sessions.length > 0) {
      // Group legacy flat sessions by (venue + sessionDateIso) into locked events
      const groupedMap = new Map();
      candidate.sessions.forEach((rawS) => {
        const s = hydrateSingleSession(rawS, rawS.venue, todayIso);
        s.status = 'completed';
        const key = `${s.venue}__${s.sessionDateIso}`;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            id: `evt_${s.sessionDateIso.replace(/-/g, '')}_${groupedMap.size + 1}`,
            venue: s.venue,
            eventDate: s.sessionDateIso,
            eventTitle: s.eventTitle || 'Race Weekend',
            locked: true,
            endedAt: `${s.sessionDateIso}T17:00:00`,
            sessions: []
          });
        }
        groupedMap.get(key).sessions.push(s);
      });
      candidate.events = Array.from(groupedMap.values());
      candidate.activeEventId = null;
      candidate.activeSessionId = null;
      candidate.eventArchitectureV1 = true;
    } else {
      candidate.events = defaultEvents;
      candidate.activeEventId = null;
      candidate.activeSessionId = null;
      candidate.eventArchitectureV1 = true;
    }

    candidate.sessions = flattenEventsToSessions(candidate.events);

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
      const wetPresetVal =
        typeof ch.wetPreset === 'string' && WET_PRESET_PROFILES[ch.wetPreset]
          ? ch.wetPreset
          : 'light';

      if (ch.trackProfiles && typeof ch.trackProfiles === 'object') {
        Object.keys(ch.trackProfiles).forEach((k) => {
          const p = ch.trackProfiles[k];
          if (p && typeof p === 'object') {
            const ct = p.coldTyres || {};
            const wct = p.wetColdTyres || {};
            const wDef = computeWetColdStagger(wetPresetVal, getTrackDirection(k));
            const pickWetCorner = (cKey) => {
              const v = Number(wct[cKey]);
              if (!Number.isFinite(v) || v <= 0 || Math.abs(v - 28.0) < 0.05) {
                return wDef[cKey];
              }
              return v;
            };
            mergedProfiles[k] = {
              burnLPerLap: Number.isFinite(Number(p.burnLPerLap))
                ? Number(Number(p.burnLPerLap).toFixed(2))
                : DEFAULT_TRACK_BURN_L[k] || 1.30,
              coldTyres: {
                FL: Number.isFinite(Number(ct.FL ?? ct.LF)) ? Number(ct.FL ?? ct.LF) : 30.0,
                FR: Number.isFinite(Number(ct.FR ?? ct.RF)) ? Number(ct.FR ?? ct.RF) : 30.0,
                RL: Number.isFinite(Number(ct.RL ?? ct.LR)) ? Number(ct.RL ?? ct.LR) : 30.0,
                RR: Number.isFinite(Number(ct.RR)) ? Number(ct.RR) : 30.0
              },
              wetColdTyres: {
                FL: pickWetCorner('FL'),
                FR: pickWetCorner('FR'),
                RL: pickWetCorner('RL'),
                RR: pickWetCorner('RR')
              }
            };
          }
        });
      }

      const ht = (ch.hotTyres && typeof ch.hotTyres === 'object') ? ch.hotTyres : {};
      const hasMountedObj = Boolean(ch.mountedTyres && typeof ch.mountedTyres === 'object');
      const mt = hasMountedObj ? ch.mountedTyres : {};
      const usedCornerTyres = new Set();
      const validTyreId = (val, fallback) => {
        if (!hasMountedObj) {
          const migDef = migrateLegacyTyreId(fallback);
          if (candidate.tyrePool.some((t) => t.id === migDef) && !usedCornerTyres.has(migDef)) {
            usedCornerTyres.add(migDef);
            return migDef;
          }
          return '';
        }
        if (val === '' || val === 'UNASSIGNED' || val === null || val === undefined) {
          return '';
        }
        const rawStr = typeof val === 'string' ? val.trim() : '';
        if (!rawStr || rawStr === 'UNASSIGNED') {
          return '';
        }
        const str = migrateLegacyTyreId(rawStr);
        if (candidate.tyrePool.some((t) => t.id === str) && !usedCornerTyres.has(str)) {
          usedCornerTyres.add(str);
          return str;
        }
        // Duplicate tyreId across multiple corners or missing from pool -> Unmounted ('')
        return '';
      };

      const rawFloor = Number(ch.fuelFloorL);
      const migratedFloor = Number.isFinite(rawFloor) ? (rawFloor === 19.0 ? 12.0 : rawFloor) : defChassis.fuelFloorL;
      const hasColdObj = ch.coldTyres && typeof ch.coldTyres === 'object';
      const ctObj = hasColdObj ? ch.coldTyres : {};
      const pickColdCorner = (cKey, fallbackVal) => {
        if (!hasColdObj) return fallbackVal;
        const v = ctObj[cKey];
        if (v === null || v === '') return null;
        return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(Number(v).toFixed(1)) : fallbackVal;
      };

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
        tyreCondition: ch.tyreCondition === 'wet' ? 'wet' : 'dry',
        wetPreset: wetPresetVal,
        mountedTyres: {
          FL: validTyreId(mt.FL, 'KB1'),
          FR: validTyreId(mt.FR, 'KB2'),
          RL: validTyreId(mt.RL, 'KB3'),
          RR: validTyreId(mt.RR, 'KB4')
        },
        coldTyres: {
          FL: pickColdCorner('FL', defChassis.coldTyres.FL),
          FR: pickColdCorner('FR', defChassis.coldTyres.FR),
          RL: pickColdCorner('RL', defChassis.coldTyres.RL),
          RR: pickColdCorner('RR', defChassis.coldTyres.RR)
        },
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

      // Strict Scrutineering Rule: never allow Wet (KW) and Buffed (KB) on car simultaneously
      const mountedSpecs = new Set();
      ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
        const tid = candidate.chassis.mountedTyres[c];
        if (!tid) return;
        const tObj = candidate.tyrePool.find((t) => t.id === tid);
        if (tObj) {
          mountedSpecs.add(tObj.spec === 'wet' ? 'wet' : 'buffed');
        }
      });
      if (mountedSpecs.size > 1) {
        const preferredSpec = candidate.chassis.tyreCondition === 'wet' ? 'wet' : 'buffed';
        ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
          const tid = candidate.chassis.mountedTyres[c];
          if (!tid) return;
          const tObj = candidate.tyrePool.find((t) => t.id === tid);
          const tSpec = tObj && tObj.spec === 'wet' ? 'wet' : 'buffed';
          if (!tObj || tSpec !== preferredSpec) {
            candidate.chassis.mountedTyres[c] = '';
          }
        });
      } else if (mountedSpecs.size === 1) {
        const singleSpec = Array.from(mountedSpecs)[0];
        candidate.chassis.tyreCondition = singleSpec === 'wet' ? 'wet' : 'dry';
      }
    }

    // Compute live totalLaps = baseLaps + sum(session.racedLaps) for completed sessions in candidate.tyrePool
    candidate.tyrePool.forEach((t) => {
      let sessLaps = 0;
      (candidate.sessions || []).forEach((s) => {
        if (!s || s.status === 'active' || !s.tyres || typeof s.tyres !== 'object') return;
        const laps = Number(s.racedLaps);
        if (!Number.isFinite(laps) || laps <= 0) return;
        if (['FL', 'FR', 'RL', 'RR'].some((c) => s.tyres[c] && s.tyres[c].tyreId === t.id)) {
          sessLaps += Math.round(laps);
        }
      });
      t.totalLaps = (Number(t.baseLaps) || 0) + sessLaps;
    });

    return candidate;
  }

  function syncFlatSessionsFromEvents(targetState) {
    const st = targetState || state;
    if (!st) return [];
    if (!Array.isArray(st.events)) {
      st.events = createDefaultEvents();
    }
    st.sessions = flattenEventsToSessions(st.events);
    return st.sessions;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.baseline && Array.isArray(parsed.jets)) {
          return hydrateState(parsed);
        }
      }
    } catch (err) {
      console.warn('Restoring default state due to storage parse issue:', err);
    }
    return hydrateState({
      eventArchitectureV1: true,
      activeEventId: null,
      activeSessionId: null,
      events: createDefaultEvents(),
      baseline: createDefaultBaseline(),
      awaitingPostRaceId: null,
      jets: createDefaultJets(),
      carbies: createDefaultCarbies(),
      manifolds: createDefaultManifolds(),
      exhausts: createDefaultExhausts(),
      activeManifoldId: 'Macca',
      activeExhaustId: 'Macca',
      tyrePool: createDefaultTyrePool(),
      sessions: createDefaultSessions(),
      dynoPulls: createDefaultDynoPulls(),
      chassis: createDefaultChassisState()
    });
  }

  let state = loadState();
  // Persist the one-time eventArchitectureV1 migration immediately if needed
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}

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
    deleteSessionTargetId: null,
    selectedJetId: null,   // selected jet in Step 2
    editingSessionId: null,
    confirmDeleteSessionId: null,
    confirmDeletePumpRunId: null,
    confirmDeleteTyreLogId: null,
    confirmDeleteTyreId: null,
    expandedTyreId: null,
    expandedEventIds: new Set([
      ...(state.activeEventId ? [state.activeEventId] : []),
      ...(Array.isArray(state.events) && state.events[0] ? [state.events[0].id] : ['evt_calder_nov26'])
    ]),
    pendingActionAfterNewEvent: null,
    tyreStockFilter: 'all', // 'all' | 'buffed' | 'wet'
    newTyreSpec: 'buffed',  // 'buffed' | 'wet'
    logSearchTrack: 'ALL',
    logSearchYear: 'ALL',
    logSearchQuery: '',
    selectedFleetCarbyId: state.baseline.carbyId || '1 DME',
    selectedFleetManifoldId: state.activeManifoldId || 'Macca',
    selectedFleetExhaustId: state.activeExhaustId || 'Macca',
    dynoScrubRpm: 5000
  };

  function saveState() {
    syncFlatSessionsFromEvents(state);
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
        .map((c) => {
          const onCarTag = c.id === state.baseline.carbyId ? ' ★ ON CAR' : '';
          return `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${onCarTag} (40mm BXUV-3)</option>`;
        })
        .join('');
      if (prev && state.carbies.some((c) => c.id === prev)) {
        sel.value = prev;
      } else if (id === 'selectCalcCarby' || id === 'editBaseCarby') {
        sel.value = state.baseline.carbyId;
      }
    });

    const calcManSel = $('selectCalcManifold');
    if (calcManSel && Array.isArray(state.manifolds)) {
      const activeManId = state.activeManifoldId || 'Macca';
      calcManSel.innerHTML = state.manifolds
        .map((m) => {
          const onCarTag = m.id === activeManId ? ' ★ ON CAR' : '';
          const pf = m.portFlowCfm || { front: 155, middle: 155, rear: 155 };
          const avg = ((Number(pf.front) + Number(pf.middle) + Number(pf.rear)) / 3).toFixed(0);
          return `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}${onCarTag} (${avg} CFM)</option>`;
        })
        .join('');
      calcManSel.value = state.manifolds.some((m) => m.id === activeManId) ? activeManId : state.manifolds[0].id;
      const manObj = state.manifolds.find((m) => m.id === calcManSel.value);
      if (manObj && $('calcManifoldFlowHint')) {
        const pf = manObj.portFlowCfm || { front: 155, middle: 155, rear: 155 };
        const avg = ((Number(pf.front) + Number(pf.middle) + Number(pf.rear)) / 3).toFixed(0);
        $('calcManifoldFlowHint').textContent = `${avg} CFM`;
      }
    }

    const calcExhSel = $('selectCalcExhaust');
    if (calcExhSel && Array.isArray(state.exhausts)) {
      const activeExhId = state.activeExhaustId || 'Macca';
      calcExhSel.innerHTML = state.exhausts
        .map((ex) => {
          const onCarTag = ex.id === activeExhId ? ' ★ ON CAR' : '';
          const cfmTag = ex.flowCfm !== null && ex.flowCfm !== undefined ? ` • ${Number(ex.flowCfm).toFixed(0)} CFM` : '';
          return `<option value="${escapeHtml(ex.id)}">${escapeHtml(ex.name)}${onCarTag}${cfmTag}</option>`;
        })
        .join('');
      calcExhSel.value = state.exhausts.some((ex) => ex.id === activeExhId) ? activeExhId : state.exhausts[0].id;
      const exhObj = state.exhausts.find((ex) => ex.id === calcExhSel.value);
      if (exhObj && $('calcExhaustHint')) {
        $('calcExhaustHint').textContent =
          exhObj.flowCfm !== null && exhObj.flowCfm !== undefined
            ? `${Number(exhObj.flowCfm).toFixed(0)} CFM`
            : exhObj.id === 'Macca'
            ? 'Main #1'
            : 'On Car';
      }
    }

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
      const wDef = computeWetColdStagger(state.chassis.wetPreset || 'light', getTrackDirection(key));
      state.chassis.trackProfiles[key] = {
        burnLPerLap: DEFAULT_TRACK_BURN_L[key] || 1.30,
        coldTyres: { FL: 30.0, FR: 30.0, RL: 30.0, RR: 30.0 },
        wetColdTyres: { FL: wDef.FL, FR: wDef.FR, RL: wDef.RL, RR: wDef.RR }
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

  function getTrackLearnedFuelStats(venueName) {
    const venue = venueName || 'Calder Park Raceway';
    const seed = DEFAULT_TRACK_BURN_L[venue] || 1.30;
    const burnValues = [];

    (state.sessions || []).forEach((s) => {
      if ((s.venue || 'Calder Park Raceway') !== venue) return;
      const inL = Number(s.fuelInL);
      const outL = Number(s.fuelOutL);
      const laps = Number(s.racedLaps);
      const meas = Number(s.measuredBurnLPerLap);

      if (Number.isFinite(inL) && Number.isFinite(outL) && inL > outL && Number.isFinite(laps) && laps > 0) {
        burnValues.push((inL - outL) / laps);
      } else if (Number.isFinite(meas) && meas > 0 && Number.isFinite(inL) && inL > 0) {
        burnValues.push(meas);
      }
    });

    if (burnValues.length === 0) {
      return {
        learned: false,
        avg: Number(seed.toFixed(2)),
        min: Number(seed.toFixed(2)),
        max: Number(seed.toFixed(2)),
        count: 0,
        seed: Number(seed.toFixed(2))
      };
    }

    const sum = burnValues.reduce((acc, v) => acc + v, 0);
    const avg = Number((sum / burnValues.length).toFixed(2));
    const min = Number(Math.min(...burnValues).toFixed(2));
    const max = Number(Math.max(...burnValues).toFixed(2));
    return {
      learned: true,
      avg,
      min,
      max,
      count: burnValues.length,
      seed: Number(seed.toFixed(2))
    };
  }

  function getSessionTyreCondition(sess) {
    if (!sess) return 'dry';
    if (sess.tyreCondition === 'wet') return 'wet';
    if (sess.tyreCondition === 'dry') return 'dry';
    if (sess.tyres && typeof sess.tyres === 'object') {
      const hasWet = ['FL', 'FR', 'RL', 'RR'].some((c) => {
        const tid = sess.tyres[c] && sess.tyres[c].tyreId;
        if (!tid) return false;
        const tObj = getTyreById(tid);
        return (tObj && tObj.spec === 'wet') || /^KW/i.test(String(tid));
      });
      if (hasWet) return 'wet';
    }
    return 'dry';
  }

  function getTrackLearnedColdTyres(venueName, targetHotPsi = 44.0, conditionOpt) {
    const venue = venueName || 'Calder Park Raceway';
    const condition = conditionOpt || (state.chassis && state.chassis.tyreCondition) || 'dry';
    const presetKey = (state.chassis && state.chassis.wetPreset) || 'light';
    const direction = getTrackDirection(venue);
    const wetStagger = computeWetColdStagger(presetKey, direction);
    const presetProfile = WET_PRESET_PROFILES[presetKey] || WET_PRESET_PROFILES.light;
    const seedCold = condition === 'wet' ? wetStagger.FL : 30.0;
    const hotTarget = Number.isFinite(Number(targetHotPsi)) && Number(targetHotPsi) > 0 ? Number(targetHotPsi) : 44.0;
    const result = {
      venue,
      condition,
      direction,
      wetPreset: presetKey,
      wetPresetLabel: presetProfile.label,
      wetStagger,
      seedCold,
      hotTarget,
      totalRuns: 0,
      corners: {}
    };

    const runSet = new Set();
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const ideals = [];
      (state.sessions || []).forEach((s) => {
        if ((s.venue || 'Calder Park Raceway') !== venue) return;
        if (!s.tyres || !s.tyres[c]) return;
        if (getSessionTyreCondition(s) !== condition) return;
        const rawCold = s.tyres[c].cold;
        const rawHot = s.tyres[c].hot;
        const cold = rawCold !== null && rawCold !== undefined && rawCold !== '' ? Number(rawCold) : NaN;
        const hot = rawHot !== null && rawHot !== undefined && rawHot !== '' ? Number(rawHot) : NaN;
        if (Number.isFinite(cold) && cold > 10 && Number.isFinite(hot) && hot > 10) {
          const idealCold = ((hotTarget + 14.7) * (cold + 14.7)) / (hot + 14.7) - 14.7;
          ideals.push(idealCold);
          runSet.add(s.id);
        }
      });

      const cornerSeed = condition === 'wet' ? wetStagger[c] : 30.0;
      if (ideals.length > 0) {
        const avg = Number((ideals.reduce((a, b) => a + b, 0) / ideals.length).toFixed(1));
        const min = Number(Math.min(...ideals).toFixed(1));
        const max = Number(Math.max(...ideals).toFixed(1));
        result.corners[c] = {
          learned: true,
          avg,
          min,
          max,
          count: ideals.length
        };
      } else {
        result.corners[c] = {
          learned: false,
          avg: cornerSeed,
          min: cornerSeed,
          max: cornerSeed,
          count: 0
        };
      }
    });

    result.totalRuns = runSet.size;
    return result;
  }

  function loadTrackProfileToFuelAndTyreInputs(venueName) {
    const venue = venueName || getSelectedTrackVenue();
    const prof = ensureTrackProfile(venue);
    const fuelStats = getTrackLearnedFuelStats(venue);
    prof.burnLPerLap = fuelStats.avg;

    if ($('inputTrackBurnLPerLap')) {
      $('inputTrackBurnLPerLap').value = Number(prof.burnLPerLap).toFixed(2);
    }

    const condition = (state.chassis && state.chassis.tyreCondition) || 'dry';
    const presetKey = (state.chassis && state.chassis.wetPreset) || 'light';
    const wetStagger = computeWetColdStagger(presetKey, getTrackDirection(venue));
    const hotTarget =
      condition === 'wet'
        ? wetStagger.hotTargetPsi
        : readNum('inputTyreHotTarget', (state.chassis && state.chassis.tyreHotTarget) || 44.0);
    if (condition === 'wet' && $('inputTyreHotTarget')) {
      $('inputTyreHotTarget').value = hotTarget.toFixed(1);
      if (state.chassis) state.chassis.tyreHotTarget = hotTarget;
    }

    const tyreStats = getTrackLearnedColdTyres(venue, hotTarget, condition);
    if (condition === 'wet') {
      prof.wetColdTyres = { FL: wetStagger.FL, FR: wetStagger.FR, RL: wetStagger.RL, RR: wetStagger.RR };
    }
    const targetColdMap = condition === 'wet' ? prof.wetColdTyres : prof.coldTyres;

    if (state.chassis && !state.chassis.coldTyres) {
      state.chassis.coldTyres = { FL: 30.0, FR: 30.0, RL: 30.0, RR: 30.0 };
    }

    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const cStat = tyreStats.corners[c];
      const fallbackCold = condition === 'wet' ? wetStagger[c] : 30.0;
      const coldVal =
        cStat && cStat.learned
          ? cStat.avg
          : condition === 'wet'
          ? wetStagger[c]
          : targetColdMap && Number.isFinite(Number(targetColdMap[c]))
          ? Number(targetColdMap[c])
          : fallbackCold;
      if (targetColdMap) targetColdMap[c] = coldVal;
      if (state.chassis && state.chassis.coldTyres) {
        state.chassis.coldTyres[c] = Number(coldVal.toFixed(1));
      }
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl) {
        coldEl.value = Number(coldVal).toFixed(1);
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

  function getActiveEvent() {
    if (!state.activeEventId || !Array.isArray(state.events)) return null;
    const evt = state.events.find((e) => e && e.id === state.activeEventId && !e.locked);
    return evt || null;
  }

  function getActiveSession() {
    const evt = getActiveEvent();
    if (!evt || !state.activeSessionId || !Array.isArray(evt.sessions)) return null;
    return evt.sessions.find((s) => s && s.id === state.activeSessionId) || null;
  }

  function findEventForSession(sessionId) {
    if (!sessionId || !Array.isArray(state.events)) return null;
    for (let i = 0; i < state.events.length; i++) {
      const evt = state.events[i];
      if (evt && Array.isArray(evt.sessions) && evt.sessions.some((s) => s && s.id === sessionId)) {
        return evt;
      }
    }
    return null;
  }

  function isSessionLocked(sessionId) {
    const evt = findEventForSession(sessionId);
    return Boolean(evt && evt.locked);
  }

  function formatPitDayTimeLabel(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date();
    const dayStr = d.toLocaleDateString('en-AU', { weekday: 'short' });
    const timeStr = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dayStr} ${timeStr}`;
  }

  function updateCustomSessionVisibility() {
    [
      ['newEventFirstSession', 'newEventCustomSessionWrap'],
      ['nextSessionSelect', 'nextSessionCustomWrap']
    ].forEach(([selId, wrapId]) => {
      const sel = $(selId);
      const wrap = $(wrapId);
      if (sel && wrap) {
        wrap.style.display = sel.value === '__CUSTOM__' ? 'block' : 'none';
      }
    });
  }

  function setSessionNameOnAllTabs(sessionName) {
    const activeSess = getActiveSession();
    if (activeSess && sessionName) {
      activeSess.sessionName = String(sessionName).trim() || activeSess.sessionName;
    }
    updateCustomSessionVisibility();
  }

  function syncTrackAndDateFromBaseline() {
    const liveEvt = getActiveEvent();
    const baseVenue = (liveEvt && liveEvt.venue) || (state.baseline && state.baseline.venue) || 'Calder Park Raceway';
    const baseIso = (liveEvt && liveEvt.eventDate) || (state.baseline && state.baseline.sessionDateIso) || getLocalTodayIso();

    setVenueOnAllTrackSelectors(baseVenue, true);
    setSessionDateOnAllTabs(baseIso);
  }

  function readVenueFromSelectorPair(selId, customId) {
    const sel = $(selId);
    if (!sel) return (state.baseline && state.baseline.venue) || 'Calder Park Raceway';
    if (sel.value === '__CUSTOM_TRACK__' || sel.value === '__CUSTOM__') {
      const customVal = (($(customId) && $(customId).value) || '').trim();
      return customVal || 'Custom Circuit';
    }
    return sel.value || 'Calder Park Raceway';
  }

  function getSelectedTrackVenue() {
    const liveEvt = getActiveEvent();
    if (liveEvt && liveEvt.venue) return normalizeVenueName(liveEvt.venue);
    return normalizeVenueName((state.baseline && state.baseline.venue) || 'Calder Park Raceway');
  }

  function getSelectedFuelTrackVenue() {
    return getSelectedTrackVenue();
  }

  function getSelectedTyreTrackVenue() {
    return getSelectedTrackVenue();
  }

  function getSelectedSessionDate() {
    const liveEvt = getActiveEvent();
    if (liveEvt && liveEvt.eventDate) {
      return {
        iso: liveEvt.eventDate,
        display: formatIsoDateDisplay(liveEvt.eventDate) || liveEvt.eventDate
      };
    }
    const iso = (state.baseline && state.baseline.sessionDateIso) || getLocalTodayIso();
    return {
      iso,
      display: formatIsoDateDisplay(iso) || iso
    };
  }

  function readSessionNameFromSelectorPair(selId, customId) {
    const sel = $(selId);
    if (!sel) return 'Practice 1';
    if (sel.value === '__CUSTOM__') {
      const customVal = (($(customId) && $(customId).value) || '').trim();
      return customVal || 'Custom Session';
    }
    return sel.value || 'Practice 1';
  }

  function getSelectedSessionName() {
    const activeSess = getActiveSession();
    if (activeSess && activeSess.sessionName) {
      return activeSess.sessionName;
    }
    return (state.baseline && state.baseline.sessionName) || 'Practice 1';
  }

  function getNextLogicalSessionName(liveEvt, refNameOpt) {
    const sessions = (liveEvt && Array.isArray(liveEvt.sessions)) ? liveEvt.sessions : [];
    const existingNames = new Set(sessions.map((s) => s && s.sessionName).filter(Boolean));
    const lastSess = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const refName = refNameOpt || (lastSess && lastSess.sessionName) || '';
    const idx = SESSION_PROGRESSION.indexOf(refName);
    if (idx !== -1) {
      for (let i = idx + 1; i < SESSION_PROGRESSION.length; i++) {
        if (!existingNames.has(SESSION_PROGRESSION[i])) {
          return SESSION_PROGRESSION[i];
        }
      }
    }
    for (let i = 0; i < SESSION_PROGRESSION.length; i++) {
      if (!existingNames.has(SESSION_PROGRESSION[i])) {
        return SESSION_PROGRESSION[i];
      }
    }
    return `Session ${sessions.length + 1}`;
  }

  function syncPreRaceNotesInputs(notesStr) {
    const val = typeof notesStr === 'string' ? notesStr : '';
    ['inputPreRaceNotes', 'inputRunNotes'].forEach((id) => {
      const el = $(id);
      if (el && document.activeElement !== el) {
        el.value = val;
      }
    });
  }

  function syncSessionSelectFromBaseline() {
    syncTrackAndDateFromBaseline();
  }

  function buildCarriedForwardBaselineSummaryParts(venueName) {
    const venue = normalizeVenueName(venueName || getSelectedTrackVenue());
    const b = state.baseline || createDefaultBaseline();
    const afrTxt =
      b.wotAfr !== null && b.wotAfr !== undefined && Number.isFinite(Number(b.wotAfr))
        ? `${Number(b.wotAfr).toFixed(2)} WOT AFR`
        : 'Weather-Only';
    const tuneStr = `${b.carbyId} • ${b.jetLabel} (${Number(b.jetMm).toFixed(3)}mm) @ ${Number(b.rad).toFixed(1)}% RAD • ${afrTxt}`;

    const fuelStats = getTrackLearnedFuelStats(venue);
    const ch = state.chassis || createDefaultChassisState();
    const scaleWt = Number(ch.scaleCheckKg);
    const scaleStr = Number.isFinite(scaleWt) && scaleWt > 500 ? `${scaleWt.toFixed(1)} kg Scale Wt` : 'Surge+Burn Mode';
    const fuelStr = `${fuelStats.avg.toFixed(2)} L/lap (${venue}) • ${ch.raceLaps || 12} Laps • ${scaleStr}`;

    const ct = (ch && ch.coldTyres) || { FL: 30.0, FR: 30.0, RL: 30.0, RR: 30.0 };
    const mt = ensureMountedTyresState();
    const fmtC = (c) => {
      const v = ct[c];
      const psi = v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v).toFixed(1) : '30.0';
      const tid = mt[c] ? `[${mt[c]}] ` : '';
      return `${c} ${tid}${psi}`;
    };
    const tyreStr = `Next Cold Set: ${fmtC('FL')} • ${fmtC('FR')} • ${fmtC('RL')} • ${fmtC('RR')} PSI`;

    return { tuneStr, fuelStr, tyreStr };
  }

  function renderWeekendEventBanner() {
    const banner = $('weekendEventBanner');
    const gateNoEvent = $('eventGateNoEventView');
    const gateBetween = $('eventGateBetweenSessionsView');
    const liveView = $('eventBarLiveView');
    const liveEvt = getActiveEvent();
    const activeSess = getActiveSession();

    const isSetupTab =
      ui.activeTab === 'tab-calc' || ui.activeTab === 'tab-fuel' || ui.activeTab === 'tab-tyres';

    if (banner) {
      banner.style.display = isSetupTab ? 'block' : 'none';
    }

    const hasLockedActiveSession = Boolean(liveEvt && activeSess);
    ['calcActiveSessionContent', 'fuelActiveSessionContent', 'tyresActiveSessionContent'].forEach((wrapId) => {
      const wrapEl = $(wrapId);
      if (wrapEl) {
        wrapEl.style.display = hasLockedActiveSession ? 'block' : 'none';
      }
    });

    if (!banner || !gateNoEvent || !gateBetween || !liveView) return;

    // GATE A — No Active Event (!state.activeEventId)
    if (!liveEvt) {
      banner.classList.remove('live-active');
      gateNoEvent.style.display = 'block';
      gateBetween.style.display = 'none';
      liveView.style.display = 'none';
      return;
    }

    const dispDate = formatIsoDateDisplay(liveEvt.eventDate) || liveEvt.eventDate;
    const sessions = Array.isArray(liveEvt.sessions) ? liveEvt.sessions : [];

    // GATE B — Event Live, Between Sessions (state.activeEventId && !state.activeSessionId)
    if (!activeSess) {
      banner.classList.remove('live-active');
      gateNoEvent.style.display = 'none';
      gateBetween.style.display = 'block';
      liveView.style.display = 'none';

      const lastCompleted = sessions.length > 0 ? sessions[sessions.length - 1] : null;
      const titleSuffix = liveEvt.eventTitle ? ` • ${liveEvt.eventTitle}` : '';
      if ($('gateBetweenVenueDateLabel')) {
        $('gateBetweenVenueDateLabel').textContent = `\uD83D\uDFE2 ${liveEvt.venue} • ${dispDate}${titleSuffix}`;
      }
      if ($('gateBetweenCompletedTitle')) {
        $('gateBetweenCompletedTitle').textContent = lastCompleted
          ? `${lastCompleted.sessionName} Completed — Ready for Next Session`
          : `Event Active — Ready for Next Session`;
      }
      if ($('gateBetweenBaselineSummary')) {
        const summary = buildCarriedForwardBaselineSummaryParts(liveEvt.venue);
        $('gateBetweenBaselineSummary').innerHTML = `
          <div><strong>Tune Baseline:</strong> ${escapeHtml(summary.tuneStr)}</div>
          <div><strong>Fuel &amp; Wt:</strong> ${escapeHtml(summary.fuelStr)}</div>
          <div><strong>4-Corner Tyres:</strong> ${escapeHtml(summary.tyreStr)}</div>
        `;
      }
      return;
    }

    // LOCKED SINGLE-SESSION ACTIVE (state.activeEventId && state.activeSessionId)
    banner.classList.add('live-active');
    gateNoEvent.style.display = 'none';
    gateBetween.style.display = 'none';
    liveView.style.display = 'block';

    if ($('liveEventTrackDateCompact')) {
      $('liveEventTrackDateCompact').textContent = `\uD83D\uDFE2 ${liveEvt.venue} • ${dispDate}`;
    }
    if ($('liveLockedSessionPill')) {
      $('liveLockedSessionPill').textContent = `IN SESSION: ${activeSess.sessionName}`;
    }

    syncPreRaceNotesInputs(activeSess.preRaceNotes || '');
  }

  function createAndActivateSessionInEvent(targetEvt, sessionName, initialPreNotes) {
    if (!targetEvt) return null;
    if (!Array.isArray(targetEvt.sessions)) {
      targetEvt.sessions = [];
    }

    // Mark any prior sessions in this event as completed
    targetEvt.sessions.forEach((s) => {
      if (s) s.status = 'completed';
    });

    const venue = normalizeVenueName(targetEvt.venue || 'Calder Park Raceway');
    const evtIso = targetEvt.eventDate || getLocalTodayIso();
    const evtDisp = formatIsoDateDisplay(evtIso) || evtIso;
    const cleanName = (sessionName || 'Practice 1').trim() || 'Practice 1';
    const preNotes = typeof initialPreNotes === 'string' ? initialPreNotes.trim() : '';

    // Carry forward from previous completed session in event (if any) or Locked Baseline + Track Profile
    const prevSess = targetEvt.sessions.length > 0 ? targetEvt.sessions[targetEvt.sessions.length - 1] : null;
    const base = state.baseline || createDefaultBaseline();
    const ch = state.chassis || createDefaultChassisState();
    const prof = ensureTrackProfile(venue);
    const fuelStats = getTrackLearnedFuelStats(venue);
    prof.burnLPerLap = fuelStats.avg;

    if ($('inputTrackBurnLPerLap')) {
      $('inputTrackBurnLPerLap').value = Number(prof.burnLPerLap).toFixed(2);
    }

    // Carry forward 4-corner Next Cold Set PSIs into Cold PSI and clear Hot PSI for the upcoming session
    const mounted = ensureMountedTyresState();
    const activeCond = ch.tyreCondition === 'wet' ? 'wet' : 'dry';
    const hotTarget = Number.isFinite(Number(ch.tyreHotTarget)) ? Number(ch.tyreHotTarget) : 44.0;
    const learnedTyres = getTrackLearnedColdTyres(venue, hotTarget, activeCond);

    if (!ch.coldTyres || typeof ch.coldTyres !== 'object') {
      ch.coldTyres = { FL: 30.0, FR: 30.0, RL: 30.0, RR: 30.0 };
    }
    if (!ch.hotTyres || typeof ch.hotTyres !== 'object') {
      ch.hotTyres = { FL: null, FR: null, RL: null, RR: null };
    }

    const initialCorners = {};
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      let nextColdVal = null;
      if (prevSess && prevSess.tyres && prevSess.tyres[c]) {
        const prevCorner = prevSess.tyres[c];
        if (
          prevCorner.nextCold !== null &&
          prevCorner.nextCold !== undefined &&
          Number.isFinite(Number(prevCorner.nextCold)) &&
          Number(prevCorner.nextCold) > 0
        ) {
          nextColdVal = Number(Number(prevCorner.nextCold).toFixed(1));
        } else if (
          prevCorner.cold !== null &&
          prevCorner.cold !== undefined &&
          Number.isFinite(Number(prevCorner.cold)) &&
          Number(prevCorner.cold) > 0
        ) {
          nextColdVal = Number(Number(prevCorner.cold).toFixed(1));
        }
      }
      if (nextColdVal === null) {
        if (
          ch.coldTyres[c] !== null &&
          ch.coldTyres[c] !== undefined &&
          Number.isFinite(Number(ch.coldTyres[c])) &&
          Number(ch.coldTyres[c]) > 0
        ) {
          nextColdVal = Number(Number(ch.coldTyres[c]).toFixed(1));
        } else if (learnedTyres.corners[c] && Number.isFinite(Number(learnedTyres.corners[c].avg))) {
          nextColdVal = Number(Number(learnedTyres.corners[c].avg).toFixed(1));
        } else {
          nextColdVal = 30.0;
        }
      }

      ch.coldTyres[c] = nextColdVal;
      ch.hotTyres[c] = null;
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl) coldEl.value = nextColdVal.toFixed(1);
      const hotEl = $(`inputHotPsi_${c}`);
      if (hotEl) hotEl.value = '';

      initialCorners[c] = {
        tyreId: mounted[c] || '',
        cold: nextColdVal,
        hot: null,
        build: null,
        diff: null,
        nextCold: nextColdVal
      };
    });

    const activeCarbyId = (prevSess && prevSess.carbyId) || base.carbyId || '1 DME';
    const activeManifoldId = (prevSess && prevSess.manifoldId) || state.activeManifoldId || 'Macca';
    const activeExhaustId = (prevSess && prevSess.exhaustId) || state.activeExhaustId || 'Macca';
    const carbyObj = state.carbies.find((c) => c.id === activeCarbyId);
    const fallbackJet =
      (prevSess && findJetById(prevSess.jetId)) ||
      (carbyObj && findJetById(carbyObj.fittedJetId)) ||
      findJetById(base.jetId) ||
      state.jets[0];

    if ($('selectCalcCarby')) $('selectCalcCarby').value = activeCarbyId;
    if ($('selectCalcManifold')) $('selectCalcManifold').value = activeManifoldId;
    if ($('selectCalcExhaust')) $('selectCalcExhaust').value = activeExhaustId;

    const radVal = prevSess ? Number(prevSess.rad) : Number(readNum('inputRadPct', base.rad).toFixed(1));
    const sgVal = prevSess ? Number(prevSess.fuelSg) : Number(readNum('inputFuelSg', base.fuelSg).toFixed(3));
    const timingVal = prevSess ? Number(prevSess.timing) : Number(readNum('inputTotalTiming', base.timing).toFixed(1));
    const fuelPsiVal = prevSess && Number.isFinite(Number(prevSess.fuelPsi)) ? Number(prevSess.fuelPsi) : Number(base.fuelPsi || 5.0);

    if ($('inputRadPct')) $('inputRadPct').value = radVal.toFixed(1);
    if ($('inputFuelSg')) $('inputFuelSg').value = sgVal.toFixed(3);
    if ($('inputTotalTiming')) $('inputTotalTiming').value = timingVal.toFixed(1);

    const fuelSnap = recalcFuelAndWeight();

    const created = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'active',
      eventId: targetEvt.id,
      eventTitle: targetEvt.eventTitle || '',
      eventLocked: false,
      venue,
      sessionDateIso: evtIso,
      sessionIsoDate: evtIso,
      sessionDate: evtDisp,
      sessionName: cleanName,
      timestamp: formatPitDayTimeLabel(new Date()),
      carbyId: activeCarbyId,
      manifoldId: activeManifoldId,
      exhaustId: activeExhaustId,
      jetId: fallbackJet ? fallbackJet.id : base.jetId,
      jetLabel: fallbackJet ? fallbackJet.label : base.jetLabel,
      jetMm: fallbackJet ? fallbackJet.mm : base.jetMm,
      rad: radVal,
      fuelSg: sgVal,
      fuelTempC: Number(readNum('inputFuelTempC', 20.0).toFixed(1)),
      timing: timingVal,
      fuelPsi: fuelPsiVal,
      waterTempC: null,
      afr3500: null,
      afr4000: null,
      afr4500: null,
      afr5000: null,
      afr5500: null,
      afrWot:
        base.wotAfr !== null && Number.isFinite(Number(base.wotAfr))
          ? Number(base.wotAfr)
          : prevSess && Number.isFinite(Number(prevSess.afrWot))
          ? Number(prevSess.afrWot)
          : 12.80,
      peakRpm: (prevSess && prevSess.peakRpm) || base.peakRpm || 5900,
      afrStatus: 'estimated',
      litresToPourL: Number(fuelSnap.litresToPourL.toFixed(1)),
      startingFuelReqL: Number(fuelSnap.startingFuelReqL.toFixed(1)),
      expectedBurnL: Number(fuelSnap.expectedBurnL.toFixed(1)),
      fuelFloorL: Number(fuelSnap.safeFloorL.toFixed(1)),
      fuelInL: null,
      fuelOutL: null,
      fuelUsedL: null,
      racedLaps: fuelSnap.raceLaps,
      measuredBurnLPerLap: Number(fuelSnap.burnLPerLap.toFixed(2)),
      scaleWeightKg: fuelSnap.scaleCheckKg > 500 ? Number(fuelSnap.scaleCheckKg.toFixed(1)) : null,
      postRaceEstKg: fuelSnap.predictedPostRaceKg > 500 ? Number(fuelSnap.predictedPostRaceKg.toFixed(1)) : null,
      tyreHotTarget: hotTarget,
      tyreCondition: activeCond,
      tyres: initialCorners,
      preRaceNotes: preNotes,
      postRaceNotes: '',
      notes: preNotes
    };

    targetEvt.sessions.push(created);
    state.activeSessionId = created.id;
    state.awaitingPostRaceId = created.id;
    syncFlatSessionsFromEvents(state);
    syncPreRaceNotesInputs(preNotes);
    return created;
  }

  function openNewEventModal(pendingActionCallback) {
    ui.pendingActionAfterNewEvent = typeof pendingActionCallback === 'function' ? pendingActionCallback : null;
    const curVenue = (state.baseline && state.baseline.venue) || 'Calder Park Raceway';
    const sel = $('newEventTrack');
    const customWrap = $('newEventCustomTrackWrap');
    const customInp = $('newEventCustomTrack');
    if (sel) {
      const hasPreset = Array.from(sel.options).some(
        (opt) => opt.value === curVenue && opt.value !== '__CUSTOM_TRACK__' && opt.value !== '__CUSTOM__'
      );
      if (hasPreset) {
        sel.value = curVenue;
        if (customWrap) customWrap.style.display = 'none';
      } else {
        sel.value = '__CUSTOM__';
        if (customWrap) customWrap.style.display = 'block';
        if (customInp) customInp.value = curVenue;
      }
    }
    if ($('newEventDate')) {
      $('newEventDate').value = getLocalTodayIso();
    }
    if ($('newEventFirstSession')) {
      $('newEventFirstSession').value = 'Practice 1';
    }
    if ($('newEventCustomSessionWrap')) {
      $('newEventCustomSessionWrap').style.display = 'none';
    }
    if ($('newEventTitle')) {
      $('newEventTitle').value = '';
    }
    openModal('modalNewEvent');
  }

  function startLiveEventFromModal() {
    const venue = normalizeVenueName(readVenueFromSelectorPair('newEventTrack', 'newEventCustomTrack'));
    const eventDate = ($('newEventDate') && $('newEventDate').value) || getLocalTodayIso();
    const eventTitle = (($('newEventTitle') && $('newEventTitle').value) || '').trim();
    const firstSessionName = readSessionNameFromSelectorPair('newEventFirstSession', 'newEventCustomSession');

    // Lock any previously open event before starting the new one
    if (Array.isArray(state.events)) {
      state.events.forEach((evt) => {
        if (evt && !evt.locked) {
          evt.locked = true;
          evt.endedAt = new Date().toISOString();
          (evt.sessions || []).forEach((s) => {
            s.eventLocked = true;
            s.status = 'completed';
          });
        }
      });
    } else {
      state.events = [];
    }

    const newEvt = {
      id: `evt_${eventDate.replace(/-/g, '')}_${Date.now().toString(36)}`,
      venue,
      eventDate,
      eventTitle: eventTitle || 'Race Weekend',
      locked: false,
      endedAt: null,
      sessions: []
    };

    state.events.unshift(newEvt);
    state.activeEventId = newEvt.id;
    ui.expandedEventIds.add(newEvt.id);

    // Load circuit profile for Fuel & Tyres
    loadTrackProfileToFuelAndTyreInputs(venue);

    // Create and lock into the initial active session immediately
    createAndActivateSessionInEvent(newEvt, firstSessionName, '');

    const pendingFn = ui.pendingActionAfterNewEvent;
    ui.pendingActionAfterNewEvent = null;
    closeModal('modalNewEvent');

    saveState();
    setCalculatorStep(1);
    renderAll();

    if (typeof pendingFn === 'function') {
      pendingFn();
      return;
    }

    showToast(`LIVE EVENT STARTED: ${venue} • IN SESSION: ${firstSessionName}`);
  }

  function openPromptNextSessionModal(completedSess) {
    const liveEvt = getActiveEvent();
    if (!liveEvt) {
      openNewEventModal();
      return;
    }

    const lastSess =
      completedSess ||
      (Array.isArray(liveEvt.sessions) && liveEvt.sessions.length > 0
        ? liveEvt.sessions[liveEvt.sessions.length - 1]
        : null);

    const completedName = lastSess ? lastSess.sessionName : 'Previous Session';
    if ($('promptNextSessionTitle')) {
      $('promptNextSessionTitle').textContent = `${completedName} Saved & Locked as New Baseline`;
    }

    const summary = buildCarriedForwardBaselineSummaryParts(liveEvt.venue);
    if ($('promptBaseTuneSummary')) $('promptBaseTuneSummary').textContent = summary.tuneStr;
    if ($('promptBaseFuelSummary')) $('promptBaseFuelSummary').textContent = summary.fuelStr;
    if ($('promptBaseTyreSummary')) $('promptBaseTyreSummary').textContent = summary.tyreStr;

    const suggestedNext = getNextLogicalSessionName(liveEvt, lastSess ? lastSess.sessionName : '');
    const sel = $('nextSessionSelect');
    const customWrap = $('nextSessionCustomWrap');
    const customInp = $('nextSessionCustomInput');
    if (sel) {
      const hasOpt = Array.from(sel.options).some(
        (opt) => opt.value === suggestedNext && opt.value !== '__CUSTOM__'
      );
      if (hasOpt) {
        sel.value = suggestedNext;
        if (customWrap) customWrap.style.display = 'none';
      } else {
        sel.value = '__CUSTOM__';
        if (customWrap) customWrap.style.display = 'block';
        if (customInp) customInp.value = suggestedNext;
      }
    }
    if ($('nextSessionPreNotes')) {
      $('nextSessionPreNotes').value = '';
    }

    openModal('modalPromptNextSession');
  }

  function confirmStartNextSessionFromPrompt() {
    const liveEvt = getActiveEvent();
    if (!liveEvt) {
      closeModal('modalPromptNextSession');
      openNewEventModal();
      return;
    }

    const nextName = readSessionNameFromSelectorPair('nextSessionSelect', 'nextSessionCustomInput');
    const preNotes = (($('nextSessionPreNotes') && $('nextSessionPreNotes').value) || '').trim();

    const created = createAndActivateSessionInEvent(liveEvt, nextName, preNotes);
    ui.expandedEventIds.add(liveEvt.id);

    closeModal('modalPromptNextSession');
    saveState();
    setCalculatorStep(1);
    renderAll();
    if (ui.activeTab === 'tab-log' || ui.activeTab === 'tab-fleet') {
      switchTab('tab-calc');
    }
    showToast(`IN SESSION: ${created.sessionName} (${liveEvt.venue})`);
  }

  function deferNextSessionToGateB() {
    state.activeSessionId = null;
    closeModal('modalPromptNextSession');
    saveState();
    renderAll();
    showToast('Between Sessions — Tap "+ CREATE NEXT SESSION" when ready for pre-race setup');
  }

  function startNextLiveSession() {
    openPromptNextSessionModal();
  }

  function openEndEventModal() {
    const liveEvt = getActiveEvent();
    if (!liveEvt) return;
    const dispDate = formatIsoDateDisplay(liveEvt.eventDate) || liveEvt.eventDate;
    const sessCount = Array.isArray(liveEvt.sessions) ? liveEvt.sessions.length : 0;
    const titlePart = liveEvt.eventTitle ? `${liveEvt.eventTitle} • ` : '';

    if ($('endEventSummaryVenue')) {
      $('endEventSummaryVenue').textContent = liveEvt.venue;
    }
    if ($('endEventSummaryMeta')) {
      $('endEventSummaryMeta').textContent = `${dispDate} • ${titlePart}${sessCount} ${sessCount === 1 ? 'Session' : 'Sessions'} Logged`;
    }
    openModal('modalEndEvent');
  }

  function confirmEndActiveEvent() {
    const liveEvt = getActiveEvent();
    if (!liveEvt) {
      closeModal('modalEndEvent');
      return;
    }

    liveEvt.locked = true;
    liveEvt.endedAt = new Date().toISOString();
    (liveEvt.sessions || []).forEach((s) => {
      s.eventLocked = true;
      s.status = 'completed';
    });
    const endedId = liveEvt.id;
    const endedVenue = liveEvt.venue;
    state.activeEventId = null;
    state.activeSessionId = null;
    state.awaitingPostRaceId = null;
    ui.editingSessionId = null;
    ui.expandedEventIds.add(endedId);

    saveState();
    closeModal('modalEndEvent');
    closeModal('modalPromptNextSession');
    renderAll();
    switchTab('tab-log');
    showToast(`Event Locked & Saved — Read Only (${endedVenue})`);
  }

  /**
   * Upserts a unified session record inside the active Event (state.events) and syncs state.sessions,
   * writing strictly to the single locked activeSession (state.activeSessionId).
   * Strictly blocks any modification when no Event or Session is active or when an Event is locked.
   */
  function upsertUnifiedSession(patch) {
    let targetEvt = getActiveEvent();
    let existing = getActiveSession();

    // If patch specifies a session ID (e.g. inline edit in Session Log), check if it exists in an unlocked event
    if (patch && patch.id) {
      const ownerEvt = findEventForSession(patch.id);
      if (ownerEvt) {
        if (ownerEvt.locked) {
          showToast('Event is Locked & Read-Only — cannot modify locked sessions.');
          return ownerEvt.sessions.find((s) => s.id === patch.id) || null;
        }
        targetEvt = ownerEvt;
        existing = ownerEvt.sessions.find((s) => s.id === patch.id) || null;
      }
    }

    if (!targetEvt) {
      openNewEventModal();
      return null;
    }
    if (targetEvt.locked) {
      showToast('Event is Locked & Read-Only — start a New Event to log sessions.');
      return null;
    }
    if (!existing) {
      openPromptNextSessionModal();
      return null;
    }

    const timeLabel = formatPitDayTimeLabel(new Date());

    Object.keys(patch).forEach((k) => {
      if (k === 'id' || k === 'appendNote') return;
      if (patch[k] !== undefined) {
        existing[k] = patch[k];
      }
    });

    existing.eventId = targetEvt.id;
    existing.eventTitle = targetEvt.eventTitle || '';
    existing.eventLocked = Boolean(targetEvt.locked);
    existing.venue = normalizeVenueName(targetEvt.venue || existing.venue || 'Calder Park Raceway');
    existing.sessionDateIso = targetEvt.eventDate || existing.sessionDateIso || getLocalTodayIso();
    existing.sessionIsoDate = existing.sessionDateIso;
    existing.sessionDate = formatIsoDateDisplay(existing.sessionDateIso) || existing.sessionDateIso;

    if (!existing.manifoldId) {
      existing.manifoldId = ($('selectCalcManifold') && $('selectCalcManifold').value) || state.activeManifoldId || 'Macca';
    }
    if (!existing.exhaustId) {
      existing.exhaustId = ($('selectCalcExhaust') && $('selectCalcExhaust').value) || state.activeExhaustId || 'Macca';
    }
    if (patch.appendNote) {
      const cleanNote = String(patch.appendNote).trim();
      if (cleanNote) {
        existing.preRaceNotes = cleanNote;
      }
    }
    existing.notes = existing.postRaceNotes || existing.preRaceNotes || existing.notes || '';
    existing.timestamp = patch.timestamp || existing.timestamp || timeLabel;

    syncFlatSessionsFromEvents(state);
    return existing;
  }

  function applyCarbyBaselineAnchor(carbyId) {
    const carby = state.carbies.find((c) => c.id === carbyId);
    if (!carby || !carby.baselineAnchor) return;

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
      manifoldId: state.activeManifoldId || 'Macca',
      exhaustId: state.activeExhaustId || 'Macca',
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
    ui.selectedFleetCarbyId = carby.id;

    if ($('selectCalcCarby')) {
      $('selectCalcCarby').value = carby.id;
    }
    if ($('inputFuelSg')) {
      $('inputFuelSg').value = state.baseline.fuelSg.toFixed(3);
    }
    if ($('inputTotalTiming')) {
      $('inputTotalTiming').value = state.baseline.timing.toFixed(1);
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
    const liveEvt = getActiveEvent();
    if (!liveEvt) {
      openNewEventModal(() => confirmJetAndLockForNextRace());
      return;
    }
    const activeSess = getActiveSession();
    if (!activeSess) {
      openPromptNextSessionModal();
      return;
    }

    const phys = getActiveCalcPhysics();
    const chosenJet = findJetById(ui.selectedJetId);
    if (!chosenJet) return;

    const venue = normalizeVenueName(liveEvt.venue);
    const sessionDateIso = liveEvt.eventDate;
    const sessionDate = formatIsoDateDisplay(sessionDateIso) || sessionDateIso;
    const sessionName = activeSess.sessionName;
    const carbyId = $('selectCalcCarby').value || state.baseline.carbyId;
    const manifoldId = ($('selectCalcManifold') && $('selectCalcManifold').value) || state.activeManifoldId || 'Macca';
    const exhaustId = ($('selectCalcExhaust') && $('selectCalcExhaust').value) || state.activeExhaustId || 'Macca';
    const preNotesFromStep2 = ($('inputRunNotes') && $('inputRunNotes').value.trim()) || '';
    const preNotesFromStep1 = ($('inputPreRaceNotes') && $('inputPreRaceNotes').value.trim()) || '';
    const userPreNotes = preNotesFromStep2 || preNotesFromStep1 || activeSess.preRaceNotes || '';

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
      id: activeSess.id,
      venue,
      sessionDateIso,
      sessionDate,
      sessionName,
      carbyId,
      manifoldId,
      exhaustId,
      jetId: chosenJet.id,
      jetLabel: chosenJet.label,
      jetMm: chosenJet.mm,
      rad: Number(phys.effectiveNewRad.toFixed(1)),
      fuelSg: Number(phys.sgNew.toFixed(3)),
      fuelTempC: Number(phys.fuelTempC.toFixed(1)),
      timing: Number(phys.totalTiming.toFixed(1)),
      fuelPsi: state.baseline.fuelPsi,
      afrWot: predWot,
      peakRpm: activeSess.peakRpm || 5900,
      afrStatus: 'estimated',
      preRaceNotes: userPreNotes
    });
    if (!unifiedSession) return;

    state.awaitingPostRaceId = unifiedSession.id;

    // Update fitted jet on carby fleet record too
    const carbyObj = state.carbies.find((c) => c.id === carbyId);
    if (carbyObj) {
      carbyObj.fittedJetId = chosenJet.id;
    }

    // If Baseline was untested, update Baseline to this pre-race setup;
    // otherwise keep Locked Baseline on the last verified post-race setup until Save Post-Race & Complete Session promotes it!
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
        manifoldId,
        exhaustId,
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

    $('inputRadPct').value = unifiedSession.rad.toFixed(1);
    syncPreRaceNotesInputs(unifiedSession.preRaceNotes || '');

    renderAll();
    setCalculatorStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Locked ${chosenJet.label} to ${sessionName} (${venue})`);
  }

  /* ------------------------------------------------------------------------
     5B. RENDERING: TAB 2 (FUEL & WT) & TAB 3 (TYRES — VISUAL 2x2 CHASSIS)
     ------------------------------------------------------------------------ */
  function getTyreById(tyreId) {
    if (!Array.isArray(state.tyrePool)) {
      state.tyrePool = createDefaultTyrePool();
    }
    return state.tyrePool.find((t) => t.id === tyreId) || null;
  }
  const findTyreInPool = getTyreById;

  function getTyreCumulativeLaps(tyreId) {
    if (!tyreId || tyreId === 'UNASSIGNED') return 0;
    const tyre = getTyreById(tyreId);
    const baseLaps = tyre && Number.isFinite(Number(tyre.baseLaps)) ? Math.max(0, Math.round(Number(tyre.baseLaps))) : 0;
    let sessionLaps = 0;

    (state.sessions || []).forEach((s) => {
      if (!s || s.status === 'active' || !s.tyres || typeof s.tyres !== 'object') return;
      const laps = Number(s.racedLaps);
      if (!Number.isFinite(laps) || laps <= 0) return;
      const mountedOnAnyCorner = ['FL', 'FR', 'RL', 'RR'].some(
        (c) => s.tyres[c] && s.tyres[c].tyreId === tyreId
      );
      if (mountedOnAnyCorner) {
        sessionLaps += Math.round(laps);
      }
    });

    const total = baseLaps + sessionLaps;
    if (tyre) {
      tyre.totalLaps = total;
    }
    return total;
  }

  function getTreadStatusInfo(treadMmVal) {
    const mm = Number.isFinite(Number(treadMmVal)) ? Number(treadMmVal) : 5.0;
    if (mm < 1.5) {
      return {
        text: 'ILLEGAL <1.5MM',
        hintClass: 'field-hint txt-danger',
        cardClass: 'tread-danger',
        badgeClass: 'tyre-laps-badge danger',
        dotClass: 'danger'
      };
    }
    if (mm <= 2.0) {
      return {
        text: 'LOW TREAD',
        hintClass: 'field-hint amber',
        cardClass: 'tread-warn',
        badgeClass: 'tyre-laps-badge warn',
        dotClass: 'warn'
      };
    }
    return {
      text: `${mm.toFixed(1)}mm OK`,
      hintClass: 'field-hint emerald',
      cardClass: '',
      badgeClass: 'tyre-laps-badge',
      dotClass: 'ok'
    };
  }

  function getSuggestedNextTyreCode(specMode) {
    const isWet = specMode === 'wet';
    const prefix = isWet ? 'KW' : 'KB';
    const pool = state.tyrePool || [];
    let nextNum = 1;
    while (
      pool.some(
        (t) =>
          String(t.id || '').toUpperCase() === `${prefix}${nextNum}` ||
          String(t.label || '').toUpperCase() === `${prefix}${nextNum}`
      )
    ) {
      nextNum++;
    }
    return `${prefix}${nextNum}`;
  }

  function syncNewTyreSpecUi(specMode) {
    const isWet = specMode === 'wet';
    ui.newTyreSpec = isWet ? 'wet' : 'buffed';
    const btnBuffed = $('btnNewTyreSpecBuffed');
    const btnWet = $('btnNewTyreSpecWet');
    if (btnBuffed) {
      btnBuffed.classList.toggle('active', !isWet);
      btnBuffed.setAttribute('aria-pressed', !isWet ? 'true' : 'false');
    }
    if (btnWet) {
      btnWet.classList.toggle('active', isWet);
      btnWet.setAttribute('aria-pressed', isWet ? 'true' : 'false');
    }
    const suggestedCode = getSuggestedNextTyreCode(ui.newTyreSpec);
    const labelInp = $('newTyreLabel');
    if (labelInp) {
      const cur = labelInp.value.trim();
      if (!cur || /^K[BW]?\d+$/i.test(cur)) {
        labelInp.value = suggestedCode;
      }
      labelInp.placeholder = `e.g. ${suggestedCode}`;
    }
    const hintEl = $('newTyreCodeHint');
    if (hintEl) {
      hintEl.textContent = `Auto: ${suggestedCode}`;
    }
    const treadInp = $('newTyreTread');
    if (treadInp) {
      treadInp.value = isWet ? '8.0' : '5.0';
    }
    const treadHint = $('newTyreTreadHint');
    if (treadHint) {
      treadHint.textContent = isWet ? '8.0mm Wet' : '5.0mm Buffed';
    }
    const duroInp = $('newTyreHardness');
    if (duroInp && (duroInp.value === '62' || duroInp.value === '60')) {
      duroInp.value = isWet ? '60' : '62';
    }
  }

  function ensureMountedTyresState() {
    if (!state.chassis) {
      state.chassis = createDefaultChassisState();
    }
    if (!Array.isArray(state.tyrePool)) {
      state.tyrePool = createDefaultTyrePool();
    }
    if (!state.chassis.mountedTyres || typeof state.chassis.mountedTyres !== 'object') {
      state.chassis.mountedTyres = { FL: 'KB1', FR: 'KB2', RL: 'KB3', RR: 'KB4' };
    }

    const usedIds = new Set();
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const rawVal = state.chassis.mountedTyres[c];
      if (!rawVal || rawVal === 'UNASSIGNED') {
        state.chassis.mountedTyres[c] = '';
        return;
      }
      const curId = migrateLegacyTyreId(String(rawVal).trim());
      if (!curId || curId === 'UNASSIGNED') {
        state.chassis.mountedTyres[c] = '';
        return;
      }
      if (state.tyrePool.some((t) => t.id === curId) && !usedIds.has(curId)) {
        state.chassis.mountedTyres[c] = curId;
        usedIds.add(curId);
      } else {
        // Duplicate tyreId across multiple corners or missing from pool -> Unmounted ('')
        state.chassis.mountedTyres[c] = '';
      }
    });

    // Strict scrutineering rule: never allow 'wet' (KW) and 'buffed' (KB) tyres on the car simultaneously
    const mountedSpecs = new Set();
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const tid = state.chassis.mountedTyres[c];
      if (!tid) return;
      const tObj = state.tyrePool.find((t) => t.id === tid);
      if (tObj) {
        mountedSpecs.add(tObj.spec === 'wet' ? 'wet' : 'buffed');
      }
    });
    if (mountedSpecs.size > 1) {
      const targetSpec = state.chassis.tyreCondition === 'wet' ? 'wet' : 'buffed';
      ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
        const tid = state.chassis.mountedTyres[c];
        if (!tid) return;
        const tObj = state.tyrePool.find((t) => t.id === tid);
        const tSpec = tObj && tObj.spec === 'wet' ? 'wet' : 'buffed';
        if (tSpec !== targetSpec) {
          state.chassis.mountedTyres[c] = '';
        }
      });
    }

    return state.chassis.mountedTyres;
  }

  function unmountAllTyres() {
    const mounted = ensureMountedTyresState();
    const hadMounted = ['FL', 'FR', 'RL', 'RR'].some((c) => Boolean(mounted[c]));
    state.chassis.mountedTyres = { FL: '', FR: '', RL: '', RR: '' };
    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    recalcTyres();
    showToast(
      hadMounted
        ? 'Unmounted all 4 corners — Ready for fresh KB (Dry) or KW (Wet) set'
        : 'All 4 corners are already Unmounted'
    );
  }

  function syncTyreConditionUi() {
    if (!state.chassis) state.chassis = createDefaultChassisState();
    const isWet = state.chassis.tyreCondition === 'wet';
    const presetKey = state.chassis.wetPreset && WET_PRESET_PROFILES[state.chassis.wetPreset] ? state.chassis.wetPreset : 'light';
    const venue = getSelectedTyreTrackVenue();
    const direction = getTrackDirection(venue);

    const btnDry = $('btnTyreCondDry');
    const btnWet = $('btnTyreCondWet');
    const wetBar = $('wetSeverityBar');
    const dirBadge = $('wetTrackDirBadge');

    if (btnDry) {
      btnDry.classList.toggle('active', !isWet);
      btnDry.setAttribute('aria-pressed', !isWet ? 'true' : 'false');
    }
    if (btnWet) {
      btnWet.classList.toggle('active', isWet);
      btnWet.setAttribute('aria-pressed', isWet ? 'true' : 'false');
    }
    if (wetBar) {
      wetBar.style.display = isWet ? 'block' : 'none';
    }
    if (dirBadge) {
      dirBadge.textContent =
        direction === 'CCW'
          ? 'CCW • Right-Loaded (FR/RR)'
          : 'CW • Left-Loaded (FL/RL)';
    }

    ['drying', 'light', 'heavy'].forEach((k) => {
      const pBtn = $(`btnWetPreset_${k}`);
      if (pBtn) {
        const active = k === presetKey;
        pBtn.classList.toggle('active', active);
        pBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
      const subEl = $(`subWetPreset_${k}`);
      if (subEl && WET_PRESET_PROFILES[k]) {
        const stg = computeWetColdStagger(k, direction);
        subEl.textContent = `${stg.FL.toFixed(1)}/${stg.FR.toFixed(1)}F • ${stg.hotTargetPsi.toFixed(1)}H`;
      }
    });
  }

  function applyWetPreset(presetKey, silentToast = false) {
    if (!state.chassis) state.chassis = createDefaultChassisState();
    const validKey = WET_PRESET_PROFILES[presetKey] ? presetKey : 'light';
    state.chassis.wetPreset = validKey;
    state.chassis.tyreCondition = 'wet';

    const venue = getSelectedTyreTrackVenue();
    const prof = ensureTrackProfile(venue);
    const direction = getTrackDirection(venue);
    const stagger = computeWetColdStagger(validKey, direction);

    state.chassis.tyreHotTarget = stagger.hotTargetPsi;
    if ($('inputTyreHotTarget')) {
      $('inputTyreHotTarget').value = stagger.hotTargetPsi.toFixed(1);
    }

    prof.wetColdTyres = { FL: stagger.FL, FR: stagger.FR, RL: stagger.RL, RR: stagger.RR };
    if (!state.chassis.coldTyres || typeof state.chassis.coldTyres !== 'object') {
      state.chassis.coldTyres = { FL: stagger.FL, FR: stagger.FR, RL: stagger.RL, RR: stagger.RR };
    }

    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      state.chassis.coldTyres[c] = stagger[c];
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl) {
        coldEl.value = stagger[c].toFixed(1);
      }
    });

    saveState();
    syncTyreConditionUi();
    syncClearColdPsiBtnText();
    recalcTyres();

    if (!silentToast) {
      const pLabel = WET_PRESET_PROFILES[validKey].label;
      showToast(
        `${pLabel} (${direction}): FL ${stagger.FL.toFixed(1)} • FR ${stagger.FR.toFixed(1)} • RL ${stagger.RL.toFixed(1)} • RR ${stagger.RR.toFixed(1)} (Hot Target ${stagger.hotTargetPsi.toFixed(1)})`
      );
    }
  }

  function mountTyreSetBySpec(targetSpec) {
    if (!state.chassis) state.chassis = createDefaultChassisState();
    const isWet = targetSpec === 'wet';
    state.chassis.tyreCondition = isWet ? 'wet' : 'dry';

    const pool = state.tyrePool || [];
    const matching = pool.filter((t) => !t.retired && (isWet ? t.spec === 'wet' : t.spec !== 'wet'));
    const fallbackCodes = isWet ? ['KW1', 'KW2', 'KW3', 'KW4'] : ['KB1', 'KB2', 'KB3', 'KB4'];
    const corners = ['FL', 'FR', 'RL', 'RR'];

    // Clear all 4 corners cleanly first (unmounting all opposite-spec tyres) and assign 4 distinct unique tyres
    state.chassis.mountedTyres = { FL: '', FR: '', RL: '', RR: '' };
    const assignedIds = new Set();

    corners.forEach((c, idx) => {
      const byDefaultCode = pool.find((t) => !t.retired && t.id === fallbackCodes[idx] && !assignedIds.has(t.id));
      const chosen = byDefaultCode || matching.find((t) => !assignedIds.has(t.id)) || null;
      if (chosen) {
        state.chassis.mountedTyres[c] = chosen.id;
        assignedIds.add(chosen.id);
      } else {
        state.chassis.mountedTyres[c] = '';
      }
    });

    const venue = getSelectedTyreTrackVenue();
    const presetKey = state.chassis.wetPreset || 'light';
    const wetStagger = computeWetColdStagger(presetKey, getTrackDirection(venue));
    const targetHot = isWet ? wetStagger.hotTargetPsi : 44.0;
    state.chassis.tyreHotTarget = targetHot;
    if ($('inputTyreHotTarget')) {
      $('inputTyreHotTarget').value = targetHot.toFixed(1);
    }

    const learnedStats = getTrackLearnedColdTyres(venue, targetHot, state.chassis.tyreCondition);
    corners.forEach((c) => {
      const coldVal = learnedStats.corners[c] ? learnedStats.corners[c].avg : isWet ? wetStagger[c] : 30.0;
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl) {
        coldEl.value = coldVal.toFixed(1);
      }
      if (state.chassis.coldTyres) {
        state.chassis.coldTyres[c] = coldVal;
      }
    });

    saveState();
    syncTyreConditionUi();
    renderMountedTyreSelectors();
    renderTyreStockList();
    recalcTyres();

    const mountedSummary = corners.map((c) => `${c}:${state.chassis.mountedTyres[c] || '—'}`).join(' • ');
    showToast(`Switched to ${isWet ? 'DECLARED WET (KW)' : 'DRY — BUFFED (KB)'} (${mountedSummary})`);
  }

  function renderMountedTyreSelectors() {
    const mounted = ensureMountedTyresState();
    const pool = state.tyrePool || [];

    // Determine activeMountedSpec: if 1 or more tyres are currently mounted, lock to their spec ('wet' or 'buffed')
    let activeMountedSpec = null;
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const tid = mounted[c];
      if (!tid || activeMountedSpec) return;
      const tObj = getTyreById(tid);
      if (tObj) {
        activeMountedSpec = tObj.spec === 'wet' ? 'wet' : 'buffed';
      }
    });

    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const selEl = $(`selectMountedTyre_${c}`);
      const badgeEl = $(`outTyreTotalLaps_${c}`);
      const mountedId = mounted[c] || '';
      const mountedTyre = mountedId ? getTyreById(mountedId) : null;
      const totalLaps = mountedTyre ? getTyreCumulativeLaps(mountedTyre.id) : 0;
      const treadMm = mountedTyre && Number.isFinite(Number(mountedTyre.treadMm)) ? Number(mountedTyre.treadMm) : 5.0;
      const duro = mountedTyre && Number.isFinite(Number(mountedTyre.durometer)) ? Math.round(Number(mountedTyre.durometer)) : 62;
      const treadStatus = getTreadStatusInfo(treadMm);

      // Check if any OTHER corner has a tyre mounted (so we know whether switching this single corner would create an illegal mix)
      let otherCornersSpec = null;
      ['FL', 'FR', 'RL', 'RR'].forEach((otherC) => {
        if (otherC === c || otherCornersSpec) return;
        const otherTid = mounted[otherC];
        if (!otherTid) return;
        const otherObj = getTyreById(otherTid);
        if (otherObj) {
          otherCornersSpec = otherObj.spec === 'wet' ? 'wet' : 'buffed';
        }
      });

      if (selEl) {
        const options = [
          `<option value="">-- Remove Tyre (Unmounted) --</option>`
        ];
        pool.forEach((t) => {
          const laps = getTyreCumulativeLaps(t.id);
          const otherCornerEntry = Object.entries(mounted).find(([k, tid]) => k !== c && tid === t.id);
          const tMm = Number.isFinite(Number(t.treadMm)) ? Number(t.treadMm) : 5.0;
          const displayLabel = t.label || t.code || t.id;
          const tyreSpec = t.spec === 'wet' ? 'wet' : 'buffed';

          if (otherCornerEntry) {
            const otherCorner = otherCornerEntry[0];
            options.push(
              `<option value="${escapeHtml(t.id)}" disabled>${escapeHtml(displayLabel)} — Mounted on ${escapeHtml(otherCorner)} (Remove from ${escapeHtml(otherCorner)} first)</option>`
            );
          } else if (otherCornersSpec && tyreSpec !== otherCornersSpec) {
            const conflictReason =
              otherCornersSpec === 'buffed'
                ? 'ILLEGAL MIX (Remove Buffed tyres first)'
                : 'ILLEGAL MIX (Remove Wet tyres first)';
            options.push(
              `<option value="${escapeHtml(t.id)}" disabled>${escapeHtml(displayLabel)} — ${conflictReason}</option>`
            );
          } else {
            const suffix = t.id === mountedId ? ` (on ${c})` : ' (SPARE RACK)';
            options.push(
              `<option value="${escapeHtml(t.id)}">${escapeHtml(displayLabel)} — ${laps} Laps • ${tMm.toFixed(1)}mm${escapeHtml(suffix)}</option>`
            );
          }
        });
        selEl.innerHTML = options.join('');
        selEl.value = mountedTyre ? mountedId : '';
      }

      if (badgeEl) {
        if (!mountedTyre) {
          badgeEl.textContent = 'Unmounted';
          badgeEl.className = 'tyre-laps-badge unmounted';
        } else {
          const specLabel = mountedTyre.spec === 'wet' ? 'WET' : 'BUFF';
          const warnSuffix = treadMm < 1.5 ? ' (ILLEGAL <1.5mm!)' : treadMm <= 2.0 ? ' (LOW TREAD)' : '';
          badgeEl.textContent = `${specLabel} • ${totalLaps} laps • ${treadMm.toFixed(1)}mm • ${duro}A${warnSuffix}`;
          badgeEl.className = treadStatus.badgeClass;
        }
      }
    });

    syncTyreConditionUi();
  }

  function updateAccordionRowSummaryInPlace(tyreId) {
    const t = getTyreById(tyreId);
    if (!t) return;
    const totalLaps = getTyreCumulativeLaps(t.id);
    const treadMm = Number.isFinite(Number(t.treadMm)) ? Number(t.treadMm) : 5.0;
    const duro = Number.isFinite(Number(t.durometer)) ? Math.round(Number(t.durometer)) : 62;
    const st = getTreadStatusInfo(treadMm);

    const codeEl = $(`accCode_${tyreId}`);
    if (codeEl) codeEl.textContent = t.label || t.code || t.id;

    const dotEl = $(`accDot_${tyreId}`);
    if (dotEl) dotEl.className = `tread-dot ${st.dotClass}`;

    const metricsEl = $(`accMetrics_${tyreId}`);
    if (metricsEl) {
      const mmClass = treadMm < 1.5 ? 'txt-danger' : treadMm <= 2.0 ? 'txt-amber' : 'txt-emerald';
      metricsEl.innerHTML = `<span class="${mmClass}">${treadMm.toFixed(1)}mm</span> &bull; ${duro}A &bull; ${totalLaps} Laps`;
    }

    const specTagEl = $(`accSpecTag_${tyreId}`);
    if (specTagEl) {
      const isWet = t.spec === 'wet';
      specTagEl.textContent = isWet ? 'WET' : 'BUFFED';
      specTagEl.className = `tyre-spec-tag ${isWet ? 'wet' : 'buffed'}`;
    }

    const totalLapsHintEl = $(`stockTotalLaps_${tyreId}`);
    if (totalLapsHintEl) {
      const baseLaps = Number(t.baseLaps) || 0;
      const loggedLaps = Math.max(0, totalLaps - baseLaps);
      totalLapsHintEl.textContent = `Total: ${totalLaps} (${loggedLaps} logged)`;
    }
  }

  function renderTyreStockList() {
    const container = $('tyreStockListContainer');
    const countBadge = $('tyreStockCountBadge');
    const mounted = ensureMountedTyresState();
    const pool = state.tyrePool || [];

    const buffedCount = pool.filter((t) => t.spec !== 'wet').length;
    const wetCount = pool.filter((t) => t.spec === 'wet').length;

    if (countBadge) {
      countBadge.textContent = `${pool.length} Tyre${pool.length === 1 ? '' : 's'} (${buffedCount} KB • ${wetCount} KW)`;
    }
    if ($('countFilterAll')) $('countFilterAll').textContent = String(pool.length);
    if ($('countFilterBuffed')) $('countFilterBuffed').textContent = String(buffedCount);
    if ($('countFilterWet')) $('countFilterWet').textContent = String(wetCount);

    document.querySelectorAll('[data-tyre-stock-filter]').forEach((btn) => {
      const f = btn.getAttribute('data-tyre-stock-filter');
      btn.classList.toggle('active', f === (ui.tyreStockFilter || 'all'));
    });

    const newDateInp = $('newTyreDate');
    if (newDateInp && !newDateInp.value) {
      newDateInp.value = getLocalTodayIso();
    }

    if (!container) return;

    const activeFilter = ui.tyreStockFilter || 'all';
    const filteredPool = pool.filter((t) => {
      if (activeFilter === 'buffed') return t.spec !== 'wet';
      if (activeFilter === 'wet') return t.spec === 'wet';
      return true;
    });

    if (filteredPool.length === 0) {
      container.innerHTML = `
        <div class="card-elevated" style="text-align: center; padding: 14px;">
          <div style="font-size: 14px; font-weight: 800; color: var(--text-secondary);">
            No tyres match this filter. Tap "+ Add New Tyre" above to add tyres to your stock.
          </div>
        </div>
      `;
      return;
    }

    const cornerOrder = { FL: 1, FR: 2, RL: 3, RR: 4 };
    const sortedPool = [...filteredPool].sort((a, b) => {
      const cornerA = Object.entries(mounted).find(([, tid]) => tid === a.id);
      const cornerB = Object.entries(mounted).find(([, tid]) => tid === b.id);
      const rankA = cornerA ? cornerOrder[cornerA[0]] || 5 : 99;
      const rankB = cornerB ? cornerOrder[cornerB[0]] || 5 : 99;
      if (rankA !== rankB) return rankA - rankB;
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    });

    container.innerHTML = sortedPool
      .map((t) => {
        const totalLaps = getTyreCumulativeLaps(t.id);
        const baseLaps = Number.isFinite(Number(t.baseLaps)) ? Math.max(0, Math.round(Number(t.baseLaps))) : 0;
        const loggedLaps = Math.max(0, totalLaps - baseLaps);
        const mountedCorner = Object.entries(mounted).find(([, tid]) => tid === t.id);
        const isMounted = Boolean(mountedCorner);
        const isWet = t.spec === 'wet';
        const isExpanded = ui.expandedTyreId === t.id;

        const posBadgeHtml = isMounted
          ? `<span class="tyre-pos-badge mounted" id="stockPosBadge_${escapeHtml(t.id)}">${mountedCorner[0]}</span>`
          : `<span class="tyre-pos-badge spare" id="stockPosBadge_${escapeHtml(t.id)}">SPARE</span>`;

        const specTagHtml = `<span class="tyre-spec-tag ${isWet ? 'wet' : 'buffed'}" id="accSpecTag_${escapeHtml(t.id)}">${isWet ? 'WET' : 'BUFFED'}</span>`;

        const treadMm = Number.isFinite(Number(t.treadMm)) ? Number(t.treadMm) : isWet ? 8.0 : 5.0;
        const duro = Number.isFinite(Number(t.durometer)) ? Math.round(Number(t.durometer)) : isWet ? 60 : 62;
        const purchaseDate = t.purchaseDate || getLocalTodayIso();
        const treadStatus = getTreadStatusInfo(treadMm);
        const isConfirmingDelete = ui.confirmDeleteTyreId === t.id;

        const mmClass = treadMm < 1.5 ? 'txt-danger' : treadMm <= 2.0 ? 'txt-amber' : 'txt-emerald';
        const itemClasses = [
          'tyre-acc-item',
          isMounted ? 'is-mounted' : '',
          isExpanded ? 'is-open' : '',
          treadStatus.cardClass
        ]
          .filter(Boolean)
          .join(' ');

        return `
          <article class="${itemClasses}" id="tyreStockCard_${escapeHtml(t.id)}" data-tyre-stock-card="${escapeHtml(t.id)}">
            <button
              type="button"
              class="tyre-acc-summary"
              data-toggle-tyre-acc="${escapeHtml(t.id)}"
              aria-expanded="${isExpanded ? 'true' : 'false'}"
            >
              <div class="tyre-acc-left">
                <span class="tyre-acc-chevron">▸</span>
                <span class="tread-dot ${treadStatus.dotClass}" id="accDot_${escapeHtml(t.id)}"></span>
                <span class="tyre-acc-code" id="accCode_${escapeHtml(t.id)}">${escapeHtml(t.label || t.code || t.id)}</span>
                ${specTagHtml}
                ${posBadgeHtml}
              </div>
              <div class="tyre-acc-metrics" id="accMetrics_${escapeHtml(t.id)}">
                <span class="${mmClass}">${treadMm.toFixed(1)}mm</span> &bull; ${duro}A &bull; ${totalLaps} Laps
              </div>
            </button>

            <div class="tyre-acc-drawer" style="display: ${isExpanded ? 'flex' : 'none'};">
              <!-- Row 1 (2-col): Tyre Code + Type | Purchased Date -->
              <div class="form-grid-2 compact-pair-grid" style="margin-bottom: 0;">
                <div class="field-group" style="margin-bottom: 0;">
                  <div class="field-label-row">
                    <label class="field-label" for="stockLabel_${escapeHtml(t.id)}">Tyre Code &amp; Spec</label>
                    <span class="field-hint">${isWet ? 'Full-Tread Wet' : 'Buffed Dry'}</span>
                  </div>
                  <div class="tyre-drawer-code-row">
                    <input
                      type="text"
                      id="stockLabel_${escapeHtml(t.id)}"
                      class="tyre-stock-name-input"
                      data-tyre-label="${escapeHtml(t.id)}"
                      value="${escapeHtml(t.label || t.code || t.id)}"
                      aria-label="Tyre Code for ${escapeHtml(t.id)}"
                    />
                    <div class="tyre-spec-mini-toggle" role="group" aria-label="Tyre Spec Type">
                      <button
                        type="button"
                        class="tyre-spec-mini-btn ${!isWet ? 'active-buffed' : ''}"
                        data-tyre-spec-id="${escapeHtml(t.id)}"
                        data-tyre-spec-val="buffed"
                      >Buffed</button>
                      <button
                        type="button"
                        class="tyre-spec-mini-btn ${isWet ? 'active-wet' : ''}"
                        data-tyre-spec-id="${escapeHtml(t.id)}"
                        data-tyre-spec-val="wet"
                      >Wet</button>
                    </div>
                  </div>
                </div>

                <div class="field-group" style="margin-bottom: 0;">
                  <div class="field-label-row">
                    <label class="field-label" for="stockDate_${escapeHtml(t.id)}">Purchased Date</label>
                    <span class="field-hint">Batch</span>
                  </div>
                  <input
                    type="date"
                    id="stockDate_${escapeHtml(t.id)}"
                    class="text-input"
                    value="${escapeHtml(purchaseDate)}"
                    data-tyre-date="${escapeHtml(t.id)}"
                  />
                </div>
              </div>

              <!-- Row 2 (2-col wide steppers so 4.8 and 62 NEVER clip): Tread Depth (mm) | Hardness (Shore A) -->
              <div class="form-grid-2 compact-pair-grid" style="margin-bottom: 0;">
                <div class="field-group" style="margin-bottom: 0;">
                  <div class="field-label-row">
                    <label class="field-label" for="stockTread_${escapeHtml(t.id)}">Tread Depth (mm)</label>
                    <span class="${treadStatus.hintClass}" id="stockTreadStatus_${escapeHtml(t.id)}">${escapeHtml(treadStatus.text)}</span>
                  </div>
                  <div class="num-stepper">
                    <button type="button" class="stepper-btn" data-stepper-target="stockTread_${escapeHtml(t.id)}" data-step="-0.1" aria-label="Decrease ${escapeHtml(t.label || t.id)} Tread">&minus;</button>
                    <div class="num-input-wrap">
                      <input
                        type="number"
                        id="stockTread_${escapeHtml(t.id)}"
                        class="num-input"
                        value="${treadMm.toFixed(1)}"
                        min="0.0"
                        max="10.0"
                        step="0.1"
                        inputmode="decimal"
                        data-tyre-tread="${escapeHtml(t.id)}"
                      />
                      <span class="num-unit-badge">mm</span>
                    </div>
                    <button type="button" class="stepper-btn" data-stepper-target="stockTread_${escapeHtml(t.id)}" data-step="0.1" aria-label="Increase ${escapeHtml(t.label || t.id)} Tread">+</button>
                  </div>
                </div>

                <div class="field-group" style="margin-bottom: 0;">
                  <div class="field-label-row">
                    <label class="field-label" for="stockHardness_${escapeHtml(t.id)}">Hardness (Shore A)</label>
                    <span class="field-hint amber" id="stockHardnessStatus_${escapeHtml(t.id)}">${duro} Shore A</span>
                  </div>
                  <div class="num-stepper">
                    <button type="button" class="stepper-btn" data-stepper-target="stockHardness_${escapeHtml(t.id)}" data-step="-1" aria-label="Decrease ${escapeHtml(t.label || t.id)} Hardness">&minus;</button>
                    <div class="num-input-wrap">
                      <input
                        type="number"
                        id="stockHardness_${escapeHtml(t.id)}"
                        class="num-input"
                        value="${duro}"
                        min="40"
                        max="95"
                        step="1"
                        inputmode="numeric"
                        data-tyre-hardness="${escapeHtml(t.id)}"
                      />
                      <span class="num-unit-badge">A</span>
                    </div>
                    <button type="button" class="stepper-btn" data-stepper-target="stockHardness_${escapeHtml(t.id)}" data-step="1" aria-label="Increase ${escapeHtml(t.label || t.id)} Hardness">+</button>
                  </div>
                </div>
              </div>

              <!-- Row 3: Prior/Base Laps adjustment + 3D anodized RED Delete Tyre button (2-tap confirm) -->
              <div class="tyre-drawer-bottom-row">
                <div class="field-group" style="margin-bottom: 0;">
                  <div class="field-label-row">
                    <label class="field-label" for="stockBaseLaps_${escapeHtml(t.id)}">Prior / Base Laps</label>
                    <span class="field-hint" id="stockTotalLaps_${escapeHtml(t.id)}">Total: ${totalLaps} (${loggedLaps} logged)</span>
                  </div>
                  <div class="num-stepper">
                    <button type="button" class="stepper-btn" data-stepper-target="stockBaseLaps_${escapeHtml(t.id)}" data-step="-1" aria-label="Decrease ${escapeHtml(t.label || t.id)} Base Laps">&minus;</button>
                    <div class="num-input-wrap">
                      <input
                        type="number"
                        id="stockBaseLaps_${escapeHtml(t.id)}"
                        class="num-input"
                        value="${baseLaps}"
                        min="0"
                        max="500"
                        step="1"
                        inputmode="numeric"
                        data-tyre-baselaps="${escapeHtml(t.id)}"
                      />
                      <span class="num-unit-badge">laps</span>
                    </div>
                    <button type="button" class="stepper-btn" data-stepper-target="stockBaseLaps_${escapeHtml(t.id)}" data-step="1" aria-label="Increase ${escapeHtml(t.label || t.id)} Base Laps">+</button>
                  </div>
                </div>

                <button
                  type="button"
                  class="btn-icon-delete"
                  data-delete-tyre="${escapeHtml(t.id)}"
                  title="Remove Tyre"
                  aria-label="Remove Tyre"
                >&#10005;</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function addInlineTyreToStock() {
    if (!Array.isArray(state.tyrePool)) {
      state.tyrePool = createDefaultTyrePool();
    }
    const spec = ui.newTyreSpec === 'wet' ? 'wet' : 'buffed';
    const rawLabel = (($('newTyreLabel') && $('newTyreLabel').value) || '').trim();
    const suggested = getSuggestedNextTyreCode(spec);
    const label = rawLabel || suggested;
    const id = label.replace(/\s+/g, '_').toUpperCase();

    if (state.tyrePool.some((t) => t.id.toLowerCase() === id.toLowerCase())) {
      showToast(`Tyre "${label}" is already in stock`);
      return;
    }

    const rawDate = (($('newTyreDate') && $('newTyreDate').value) || '').trim();
    const purchaseDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : getLocalTodayIso();
    const defaultTread = spec === 'wet' ? 8.0 : 5.0;
    const treadMm = Number(Math.max(0.0, readNum('newTyreTread', defaultTread)).toFixed(1));
    const durometer = Math.max(40, Math.min(95, Math.round(readNum('newTyreHardness', spec === 'wet' ? 60 : 62))));
    const baseLaps = Math.max(0, Math.round(readNum('newTyreBaseLaps', 0)));

    const newTyre = {
      id,
      code: label,
      label,
      spec,
      stamp: `Kenda KR15 ${spec === 'wet' ? 'Wet' : 'Buffed'} (${label})`,
      purchaseDate,
      treadMm,
      durometer,
      baseLaps,
      totalLaps: baseLaps,
      retired: false
    };
    state.tyrePool.push(newTyre);

    if ($('newTyreLabel')) $('newTyreLabel').value = '';
    if ($('newTyreDate')) $('newTyreDate').value = getLocalTodayIso();
    if ($('newTyreBaseLaps')) $('newTyreBaseLaps').value = '0';
    syncNewTyreSpecUi(spec);

    const panel = $('addTyreInlinePanel');
    const toggleBtn = $('btnToggleAddTyreForm');
    if (panel) panel.style.display = 'none';
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.textContent = '+ Add New Tyre';
    }

    ui.expandedTyreId = newTyre.id;
    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    renderTyrePoolModal();
    recalcTyres();
    showToast(`Added ${label} (${spec === 'wet' ? 'Full-Tread Wet' : 'Buffed Dry'} • ${treadMm.toFixed(1)}mm) to Tyre Stock`);
  }

  function deleteTyreFromStock(tyreId) {
    const tyre = getTyreById(tyreId);
    if (!tyre) return;

    const removedLabel = tyre.label || tyre.code || tyre.id;
    if (typeof window.confirm === 'function' && !window.confirm(`Remove tyre ${removedLabel} from stock?`)) {
      return;
    }

    ui.confirmDeleteTyreId = null;
    if (ui.expandedTyreId === tyreId) {
      ui.expandedTyreId = null;
    }
    state.tyrePool = (state.tyrePool || []).filter((t) => t.id !== tyreId);

    if (state.chassis && state.chassis.mountedTyres) {
      const mt = state.chassis.mountedTyres;
      ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
        if (mt[c] === tyreId) {
          mt[c] = '';
        }
      });
    }

    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    renderTyrePoolModal();
    recalcTyres();
    showToast(`Deleted ${removedLabel} from Tyre Stock`);
  }

  function exportTyreStockCsv() {
    const mounted = ensureMountedTyresState();
    const pool = state.tyrePool || [];
    const headers = [
      'tyre_id',
      'label',
      'spec',
      'mounted_position',
      'purchase_date',
      'tread_mm',
      'tread_status',
      'durometer_shore_a',
      'base_laps',
      'logged_session_laps',
      'total_laps'
    ];
    const rows = pool.map((t) => {
      const totalLaps = getTyreCumulativeLaps(t.id);
      const baseLaps = Number(t.baseLaps) || 0;
      const sessLaps = Math.max(0, totalLaps - baseLaps);
      const mountedCorner = Object.entries(mounted).find(([, tid]) => tid === t.id);
      const pos = mountedCorner ? mountedCorner[0] : 'SPARE_RACK';
      const treadMm = Number.isFinite(Number(t.treadMm)) ? Number(t.treadMm) : 5.0;
      const status = treadMm < 1.5 ? 'ILLEGAL_<1.5MM' : treadMm <= 2.0 ? 'LOW_TREAD' : 'LEGAL_OK';
      const duro = Number.isFinite(Number(t.durometer)) ? Math.round(Number(t.durometer)) : 62;
      const spec = t.spec === 'wet' ? 'WET_KW' : 'BUFFED_KB';
      return [
        t.id,
        `"${String(t.label || t.code || t.id).replace(/"/g, '""')}"`,
        spec,
        pos,
        t.purchaseDate || getLocalTodayIso(),
        treadMm.toFixed(1),
        status,
        duro,
        baseLaps,
        sessLaps,
        totalLaps
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    triggerDownload(csv, 'snb-hq202-tyre-stock.csv', 'text/csv;charset=utf-8;');
    showToast('Exported Tyre Stock CSV');
  }

  function handleCornerTyreSelectChange(corner, newTyreId) {
    const mounted = ensureMountedTyresState();
    const prevTyreOnCorner = mounted[corner] || '';
    const cleanNewId = !newTyreId || newTyreId === 'UNASSIGNED' ? '' : String(newTyreId).trim();
    if (cleanNewId === prevTyreOnCorner) return;

    if (cleanNewId === '') {
      const prevTyreObj = prevTyreOnCorner ? getTyreById(prevTyreOnCorner) : null;
      const prevLabel = prevTyreObj ? prevTyreObj.label || prevTyreObj.id : prevTyreOnCorner;
      mounted[corner] = '';
      saveState();
      renderMountedTyreSelectors();
      renderTyreStockList();
      recalcTyres();
      showToast(prevLabel ? `Removed ${prevLabel} from ${corner} (Unmounted)` : `${corner} set to Unmounted`);
      return;
    }

    const otherCornerEntry = Object.entries(mounted).find(([cKey, tId]) => cKey !== corner && tId === cleanNewId);
    if (otherCornerEntry) {
      const otherCorner = otherCornerEntry[0];
      const tyreObj = getTyreById(cleanNewId);
      const tyreLabel = tyreObj ? tyreObj.label || tyreObj.id : cleanNewId;
      const selEl = $(`selectMountedTyre_${corner}`);
      if (selEl) {
        selEl.value = prevTyreOnCorner || '';
      }
      renderMountedTyreSelectors();
      showToast(`Remove ${tyreLabel} from ${otherCorner} first before mounting on ${corner}`);
      return;
    }

    const chosenTyreObj = getTyreById(cleanNewId);
    const chosenSpec = chosenTyreObj && chosenTyreObj.spec === 'wet' ? 'wet' : 'buffed';

    // Strict scrutineering guard: check the other 3 corners before saving
    const conflictingCorner = ['FL', 'FR', 'RL', 'RR'].find((cKey) => {
      if (cKey === corner) return false;
      const otherId = mounted[cKey];
      if (!otherId) return false;
      const otherObj = getTyreById(otherId);
      if (!otherObj) return false;
      const otherSpec = otherObj.spec === 'wet' ? 'wet' : 'buffed';
      return otherSpec !== chosenSpec;
    });

    if (conflictingCorner) {
      const selEl = $(`selectMountedTyre_${corner}`);
      if (selEl) {
        selEl.value = prevTyreOnCorner || '';
      }
      renderMountedTyreSelectors();
      showToast('Illegal Tyre Mix: Cannot have Wet (KW) and Buffed (KB) tyres on the car at the same time!');
      return;
    }

    mounted[corner] = cleanNewId;
    if (state.chassis) {
      state.chassis.tyreCondition = chosenSpec === 'wet' ? 'wet' : 'dry';
    }
    saveState();
    syncTyreConditionUi();
    renderMountedTyreSelectors();
    renderTyreStockList();
    recalcTyres();
    const mountedLabel = chosenTyreObj ? chosenTyreObj.label || chosenTyreObj.id : cleanNewId;
    showToast(`Mounted ${mountedLabel} on ${corner}`);
  }

  function swapMountedTyresLR() {
    const mounted = ensureMountedTyresState();
    const fl = mounted.FL;
    const fr = mounted.FR;
    const rl = mounted.RL;
    const rr = mounted.RR;
    mounted.FL = fr;
    mounted.FR = fl;
    mounted.RL = rr;
    mounted.RR = rl;
    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    recalcTyres();
    showToast(`Swapped Left ↔ Right: FL ${mounted.FL} | FR ${mounted.FR} • RL ${mounted.RL} | RR ${mounted.RR}`);
  }

  function swapMountedTyresFR() {
    const mounted = ensureMountedTyresState();
    const fl = mounted.FL;
    const fr = mounted.FR;
    const rl = mounted.RL;
    const rr = mounted.RR;
    mounted.FL = rl;
    mounted.RL = fl;
    mounted.FR = rr;
    mounted.RR = fr;
    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    recalcTyres();
    showToast(`Swapped Front ↕ Rear: FL ${mounted.FL} | FR ${mounted.FR} • RL ${mounted.RL} | RR ${mounted.RR}`);
  }

  function crossSwapMountedTyresX() {
    const mounted = ensureMountedTyresState();
    const fl = mounted.FL;
    const fr = mounted.FR;
    const rl = mounted.RL;
    const rr = mounted.RR;
    mounted.FL = rr;
    mounted.RR = fl;
    mounted.FR = rl;
    mounted.RL = fr;
    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    renderTyrePoolModal();
    recalcTyres();
    showToast(`Cross-Rotated X: FL ${mounted.FL} | FR ${mounted.FR} • RL ${mounted.RL} | RR ${mounted.RR}`);
  }

  function rotateMountedTyresClockwise() {
    const mounted = ensureMountedTyresState();
    const fl = mounted.FL;
    const fr = mounted.FR;
    const rr = mounted.RR;
    const rl = mounted.RL;
    mounted.FR = fl;
    mounted.RR = fr;
    mounted.RL = rr;
    mounted.FL = rl;
    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    renderTyrePoolModal();
    recalcTyres();
    showToast(`Rotated Clockwise: FL ${mounted.FL} → FR ${mounted.FR} → RR ${mounted.RR} → RL ${mounted.RL}`);
  }

  function renderTyrePoolModal() {
    const listEl = $('tyrePoolModalList');
    if (!listEl) return;
    const mounted = ensureMountedTyresState();
    const pool = state.tyrePool || [];

    // Suggest next tyre code (e.g. K5, K6) in the Add form if empty
    const codeInp = $('inputNewTyreCode');
    if (codeInp && !codeInp.value.trim()) {
      codeInp.placeholder = `e.g. K${pool.length + 1}`;
    }

    listEl.innerHTML = pool
      .map((t) => {
        const totalLaps = getTyreCumulativeLaps(t.id);
        const sessLaps = Math.max(0, totalLaps - (Number(t.baseLaps) || 0));
        const mountedCorner = Object.entries(mounted).find(([, tid]) => tid === t.id);
        const cornerBadge = mountedCorner
          ? `<span class="locked-badge" style="font-size: 12px; padding: 3px 8px;">Mounted: ${mountedCorner[0]}</span>`
          : t.retired
          ? `<span class="afr-status-badge estimated">RETIRED</span>`
          : `<span class="afr-status-badge verified">SPARE IN POOL</span>`;
        const treadMm = Number.isFinite(Number(t.treadMm)) ? Number(t.treadMm) : 7.5;
        const duro = Number.isFinite(Number(t.durometer)) ? Math.round(Number(t.durometer)) : 62;
        const treadWarn = treadMm <= 2.0;

        return `
          <div class="tyre-pool-item ${t.retired ? 'is-retired' : ''}">
            <div class="tyre-pool-head">
              <div>
                <div class="tyre-pool-title">${escapeHtml(t.label || t.code)} &bull; <span class="mono txt-emerald">${totalLaps} Laps From New</span></div>
                <div class="tyre-pool-meta">
                  Purchased: ${escapeHtml(t.purchaseDate || '2026-01-01')} &bull; Base: ${Number(t.baseLaps) || 0} + Logged: ${sessLaps} laps &bull;
                  <span class="${treadMm < 1.5 ? 'txt-danger' : treadWarn ? 'txt-amber' : 'txt-emerald'}">Tread: ${treadMm.toFixed(1)} mm</span> &bull; ${duro}A
                </div>
              </div>
              ${cornerBadge}
            </div>
            <div class="form-grid-2 compact-pair-grid" style="gap: 8px;">
              <div class="field-group" style="margin-bottom: 0;">
                <label class="field-label" style="font-size: 13px;" for="poolTread_${escapeHtml(t.id)}">Tread Depth (mm)</label>
                <div class="num-stepper">
                  <button type="button" class="stepper-btn" data-stepper-target="poolTread_${escapeHtml(t.id)}" data-step="-0.1">&minus;</button>
                  <div class="num-input-wrap">
                    <input type="number" id="poolTread_${escapeHtml(t.id)}" class="num-input" value="${treadMm.toFixed(1)}" min="0.0" max="10.0" step="0.1" data-pool-tread-id="${escapeHtml(t.id)}" />
                    <span class="num-unit-badge">mm</span>
                  </div>
                  <button type="button" class="stepper-btn" data-stepper-target="poolTread_${escapeHtml(t.id)}" data-step="0.1">+</button>
                </div>
              </div>
              <div class="field-group" style="margin-bottom: 0;">
                <label class="field-label" style="font-size: 13px;" for="poolBaseLaps_${escapeHtml(t.id)}">Prior / Base Laps</label>
                <div class="num-stepper">
                  <button type="button" class="stepper-btn" data-stepper-target="poolBaseLaps_${escapeHtml(t.id)}" data-step="-1">&minus;</button>
                  <div class="num-input-wrap">
                    <input type="number" id="poolBaseLaps_${escapeHtml(t.id)}" class="num-input" value="${Number(t.baseLaps) || 0}" min="0" max="500" step="1" data-pool-baselaps-id="${escapeHtml(t.id)}" />
                    <span class="num-unit-badge">laps</span>
                  </div>
                  <button type="button" class="stepper-btn" data-stepper-target="poolBaseLaps_${escapeHtml(t.id)}" data-step="1">+</button>
                </div>
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" class="btn-icon-delete" data-delete-tyre="${escapeHtml(t.id)}" title="Remove Tyre" aria-label="Remove Tyre">&#10005;</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function addNewTyreToPool() {
    if (!Array.isArray(state.tyrePool)) {
      state.tyrePool = createDefaultTyrePool();
    }
    const rawCode = (($('inputNewTyreCode') && $('inputNewTyreCode').value) || '').trim();
    let nextIdx = state.tyrePool.length + 1;
    while (state.tyrePool.some((t) => t.id.toLowerCase() === `k${nextIdx}`)) {
      nextIdx++;
    }
    const code = rawCode || `K${nextIdx}`;
    const id = code.replace(/\s+/g, '_');

    if (state.tyrePool.some((t) => t.id.toLowerCase() === id.toLowerCase())) {
      showToast(`Tyre "${code}" is already in the Kenda inventory`);
      return;
    }

    const stamp = (($('inputNewTyreStamp') && $('inputNewTyreStamp').value) || '').trim() || `HQRA Kenda KR15 (${code})`;
    const treadMm = Number(Math.max(0.0, readNum('inputNewTyreTreadMm', 7.5)).toFixed(1));
    const baseLaps = Math.max(0, Math.round(readNum('inputNewTyreBaseLaps', 0)));

    state.tyrePool.push({
      id,
      code,
      label: code,
      stamp,
      purchaseDate: getLocalTodayIso(),
      treadMm,
      durometer: 62,
      baseLaps,
      totalLaps: baseLaps,
      retired: false
    });

    if ($('inputNewTyreCode')) $('inputNewTyreCode').value = '';
    if ($('inputNewTyreStamp')) $('inputNewTyreStamp').value = '';
    if ($('inputNewTyreTreadMm')) $('inputNewTyreTreadMm').value = '7.5';
    if ($('inputNewTyreBaseLaps')) $('inputNewTyreBaseLaps').value = '0';

    saveState();
    renderMountedTyreSelectors();
    renderTyreStockList();
    renderTyrePoolModal();
    showToast(`Added ${code} (${treadMm.toFixed(1)} mm • ${baseLaps} base laps) to Tyre Stock`);
  }

  function hydrateFuelAndTyreInputs() {
    if (!state.chassis) {
      state.chassis = createDefaultChassisState();
    }
    const ch = state.chassis;
    const venue = getSelectedFuelTrackVenue();
    const prof = ensureTrackProfile(venue);

    const fuelStats = getTrackLearnedFuelStats(venue);
    prof.burnLPerLap = fuelStats.avg;

    if ($('inputTrackBurnLPerLap')) $('inputTrackBurnLPerLap').value = Number(prof.burnLPerLap).toFixed(2);
    if ($('inputRaceLaps')) $('inputRaceLaps').value = String(ch.raceLaps);
    if ($('inputTyreSessionLaps')) $('inputTyreSessionLaps').value = String(ch.raceLaps);
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

    const activeCond = ch.tyreCondition === 'wet' ? 'wet' : 'dry';
    const tyreStats = getTrackLearnedColdTyres(venue, ch.tyreHotTarget || 44.0, activeCond);

    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const coldEl = $(`inputColdPsi_${c}`);
      if (coldEl) {
        if (ch.coldTyres && ch.coldTyres[c] === null) {
          coldEl.value = '';
        } else {
          const cStat = tyreStats.corners[c];
          const storedCold =
            ch.coldTyres && ch.coldTyres[c] !== null && ch.coldTyres[c] !== undefined && Number.isFinite(Number(ch.coldTyres[c])) && Number(ch.coldTyres[c]) > 0
              ? Number(ch.coldTyres[c])
              : null;
          const coldVal =
            storedCold !== null
              ? storedCold
              : cStat && cStat.learned
              ? cStat.avg
              : prof.coldTyres && prof.coldTyres[c] !== null && Number.isFinite(Number(prof.coldTyres[c])) && Number(prof.coldTyres[c]) > 0
              ? Number(prof.coldTyres[c])
              : 30.0;
          prof.coldTyres[c] = coldVal;
          if (ch.coldTyres) ch.coldTyres[c] = coldVal;
          coldEl.value = coldVal.toFixed(1);
        }
      }
      const hotEl = $(`inputHotPsi_${c}`);
      if (hotEl) {
        const hotVal =
          ch.hotTyres && ch.hotTyres[c] !== null && ch.hotTyres[c] !== undefined && ch.hotTyres[c] !== '' && Number.isFinite(Number(ch.hotTyres[c])) && Number(ch.hotTyres[c]) > 0
            ? Number(ch.hotTyres[c])
            : null;
        hotEl.value = hotVal !== null ? hotVal.toFixed(1) : '';
      }
    });

    syncClearColdPsiBtnText();
    syncNewTyreSpecUi(ui.newTyreSpec || 'buffed');
    syncTyreConditionUi();
    renderMountedTyreSelectors();
    renderTyreStockList();
  }

  function syncClearColdPsiBtnText() {
    const btn = $('btnClearAllColdPsi');
    if (!btn) return;
    const anyColdHasVal = ['FL', 'FR', 'RL', 'RR'].some((c) => {
      const el = $(`inputColdPsi_${c}`);
      return el && String(el.value || '').trim() !== '';
    });
    btn.textContent = anyColdHasVal
      ? 'Clear Cold PSI (Already Bled Hot)'
      : 'Restore Learned Cold PSI';
  }

  function toggleClearOrRestoreColdPsi() {
    if (!state.chassis) state.chassis = createDefaultChassisState();
    const ch = state.chassis;
    if (!ch.coldTyres || typeof ch.coldTyres !== 'object') {
      ch.coldTyres = { FL: 30.2, FR: 29.5, RL: 30.5, RR: 29.8 };
    }
    const anyColdHasVal = ['FL', 'FR', 'RL', 'RR'].some((c) => {
      const el = $(`inputColdPsi_${c}`);
      return el && String(el.value || '').trim() !== '';
    });

    if (anyColdHasVal) {
      ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
        const el = $(`inputColdPsi_${c}`);
        if (el) el.value = '';
        ch.coldTyres[c] = null;
      });
      syncClearColdPsiBtnText();
      recalcTyres();
      showToast('Cleared Cold PSI (Hot-Only / Already Bled Hot mode)');
    } else {
      const venue = getSelectedTyreTrackVenue();
      const prof = ensureTrackProfile(venue);
      const activeCond = ch.tyreCondition === 'wet' ? 'wet' : 'dry';
      const tyreStats = getTrackLearnedColdTyres(venue, ch.tyreHotTarget || 44.0, activeCond);
      ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
        const cStat = tyreStats.corners[c];
        const coldVal =
          cStat && cStat.learned
            ? cStat.avg
            : prof.coldTyres && prof.coldTyres[c] !== null && Number.isFinite(Number(prof.coldTyres[c])) && Number(prof.coldTyres[c]) > 0
            ? Number(prof.coldTyres[c])
            : 30.0;
        const el = $(`inputColdPsi_${c}`);
        if (el) el.value = coldVal.toFixed(1);
        ch.coldTyres[c] = coldVal;
      });
      syncClearColdPsiBtnText();
      recalcTyres();
      showToast(`Restored ${venue} Cold PSIs`);
    }
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

    const fuelStats = getTrackLearnedFuelStats(venue);
    const activeFuelSg = Math.max(0.65, readNum('inputFuelSg', (state.baseline && state.baseline.fuelSg) || 0.740));
    const trackBurnLPerLap = Math.max(0.2, readNum('inputTrackBurnLPerLap', prof.burnLPerLap || fuelStats.avg || 1.30));
    const racedLaps = Math.max(1, Math.round(readNum('inputRaceLaps', ch.raceLaps || 12)));
    const surgeFloorL = Math.max(0, readNum('inputFuelFloorL', ch.fuelFloorL ?? 12.0));
    const tankResidualL = 0.0; // Tank is always pumped empty before pouring

    if ($('inputTyreSessionLaps') && document.activeElement !== $('inputTyreSessionLaps')) {
      $('inputTyreSessionLaps').value = String(racedLaps);
    }

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

    if ($('trackBurnSourceHint')) {
      const isOverridden = Math.abs(trackBurnLPerLap - fuelStats.avg) >= 0.015;
      if (isOverridden) {
        $('trackBurnSourceHint').textContent = `Manual Override`;
        $('trackBurnSourceHint').className = 'field-hint amber';
      } else if (fuelStats.learned) {
        $('trackBurnSourceHint').textContent = `Auto (${fuelStats.count} run${fuelStats.count === 1 ? '' : 's'})`;
        $('trackBurnSourceHint').className = 'field-hint emerald';
      } else {
        $('trackBurnSourceHint').textContent = 'Track Seed';
        $('trackBurnSourceHint').className = 'field-hint';
      }
    }

    if ($('trackBurnLearnedBanner')) {
      if (fuelStats.learned) {
        const overrideNote =
          Math.abs(trackBurnLPerLap - fuelStats.avg) >= 0.015
            ? ` • Manual override active (${trackBurnLPerLap.toFixed(2)} L/lap)`
            : ' • Live from Session Log';
        $('trackBurnLearnedBanner').innerHTML = `Auto-learned (${escapeHtml(venue)}): <strong>${fuelStats.avg.toFixed(2)} L/lap</strong> (${fuelStats.min.toFixed(2)}&ndash;${fuelStats.max.toFixed(2)} range, ${fuelStats.count} run${fuelStats.count === 1 ? '' : 's'})${escapeHtml(overrideNote)}`;
      } else {
        $('trackBurnLearnedBanner').innerHTML = `Auto-learned (${escapeHtml(venue)}): <strong>${fuelStats.seed.toFixed(2)} L/lap</strong> (Track seed default &bull; 0 pump-out runs logged yet)`;
      }
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
    const mounted = ensureMountedTyresState();
    const activeCond = ch.tyreCondition === 'wet' ? 'wet' : 'dry';

    const tyreHotTarget = readNum('inputTyreHotTarget', ch.tyreHotTarget || 44.0);
    ch.tyreHotTarget = Number(tyreHotTarget.toFixed(1));

    const tyreSessionLaps = Math.max(1, Math.round(readNum('inputTyreSessionLaps', ch.raceLaps || 12)));
    ch.raceLaps = tyreSessionLaps;
    if ($('inputRaceLaps') && document.activeElement !== $('inputRaceLaps')) {
      $('inputRaceLaps').value = String(tyreSessionLaps);
    }

    if ($('tyreTargetBadge')) {
      $('tyreTargetBadge').textContent = `Target ${tyreHotTarget.toFixed(1)} PSI`;
    }

    const learnedStats = getTrackLearnedColdTyres(venue, tyreHotTarget, activeCond);
    const condLabel = activeCond === 'wet' ? 'Wet KW' : 'Dry KB';
    if ($('tyreTrackLearnedHint')) {
      $('tyreTrackLearnedHint').textContent =
        learnedStats.totalRuns > 0
          ? `${condLabel} (${learnedStats.totalRuns} run${learnedStats.totalRuns === 1 ? '' : 's'})`
          : activeCond === 'wet'
          ? `${learnedStats.wetPresetLabel} (${learnedStats.direction})`
          : `${condLabel} Seed (${learnedStats.direction})`;
    }
    if ($('outTyreTrackLearnedSummary')) {
      const c = learnedStats.corners;
      $('outTyreTrackLearnedSummary').textContent = `FL ${c.FL.avg.toFixed(1)} • FR ${c.FR.avg.toFixed(1)} • RL ${c.RL.avg.toFixed(1)} • RR ${c.RR.avg.toFixed(1)}`;
    }
    if ($('outTyreTrackLearnedSub')) {
      $('outTyreTrackLearnedSub').textContent =
        learnedStats.totalRuns > 0
          ? `Auto-learned (${condLabel}) from ${learnedStats.totalRuns} hot-logged run${learnedStats.totalRuns === 1 ? '' : 's'} at ${venue} (${learnedStats.direction})`
          : activeCond === 'wet'
          ? `${learnedStats.wetPresetLabel} (${learnedStats.direction} ${learnedStats.direction === 'CCW' ? 'FR/RR loaded' : 'FL/RL loaded'}) • Target ${learnedStats.wetStagger.hotTargetPsi.toFixed(1)} PSI`
          : `Default 30.0 PSI cold start (${condLabel} • ${learnedStats.direction}) • Log Cold + Hot PSI to auto-learn ${venue}`;
    }

    renderMountedTyreSelectors();

    if (!ch.coldTyres || typeof ch.coldTyres !== 'object') {
      ch.coldTyres = { FL: 30.2, FR: 29.5, RL: 30.5, RR: 29.8 };
    }

    const corners = {};
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const cLearned = learnedStats.corners[c];
      if (cLearned && cLearned.learned && activeCond === 'dry') {
        prof.coldTyres[c] = cLearned.avg;
      }

      const coldEl = $(`inputColdPsi_${c}`);
      const rawCold = coldEl ? String(coldEl.value || '').trim() : '';
      const parsedCold = rawCold === '' ? null : parseFloat(rawCold);
      const cold =
        parsedCold !== null && Number.isFinite(parsedCold) && parsedCold > 0
          ? Number(parsedCold.toFixed(1))
          : null;

      const hotEl = $(`inputHotPsi_${c}`);
      const rawHot = hotEl ? String(hotEl.value || '').trim() : '';
      const parsedHot = rawHot === '' ? null : parseFloat(rawHot);
      const hot =
        parsedHot !== null && Number.isFinite(parsedHot) && parsedHot > 0
          ? Number(parsedHot.toFixed(1))
          : null;

      const build = cold !== null && hot !== null ? Number((hot - cold).toFixed(1)) : null;
      const diff = hot !== null ? Number((hot - tyreHotTarget).toFixed(1)) : null;
      const nextCold =
        cold !== null && hot !== null
          ? Number((((tyreHotTarget + 14.7) * (cold + 14.7)) / (hot + 14.7) - 14.7).toFixed(1))
          : cold !== null
          ? Number(cold.toFixed(1))
          : null;

      const tyreId = mounted[c] || '';
      corners[c] = { tyreId, cold, hot, build, diff, nextCold };

      ch.coldTyres[c] = cold;
      ch.hotTyres[c] = hot;

      const buildEl = $(`outTyreBuild_${c}`);
      const actionEl = $(`outTyreAction_${c}`);
      const nextColdEl = $(`outTyreNextCold_${c}`);
      const learnedEl = $(`outTyreLearnedCold_${c}`);

      if (learnedEl) {
        if (cLearned && cLearned.learned) {
          const rangeStr =
            Math.abs(cLearned.max - cLearned.min) >= 0.1
              ? `${cLearned.min.toFixed(1)}–${cLearned.max.toFixed(1)}`
              : `${cLearned.count} run${cLearned.count === 1 ? '' : 's'}`;
          learnedEl.textContent = `${cLearned.avg.toFixed(1)} psi (${rangeStr})`;
          learnedEl.className = 'mono txt-amber';
        } else if (activeCond === 'wet') {
          learnedEl.textContent = `${cLearned.avg.toFixed(1)} psi (${learnedStats.wetPresetLabel} ${learnedStats.direction})`;
          learnedEl.className = 'mono txt-amber';
        } else {
          learnedEl.textContent = `${cLearned.avg.toFixed(1)} psi (seed)`;
          learnedEl.className = 'mono';
        }
      }

      // Top Corner Action Badge depends ONLY on hotVal vs tyreHotTarget
      if (actionEl) {
        if (hot === null) {
          actionEl.textContent = 'HOT PSI?';
          actionEl.className = 'afr-status-badge estimated';
        } else if (Math.abs(diff) <= 0.15) {
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

      // Bottom Corner Telemetry Strip (GAIN & NEXT COLD SET)
      if (cold !== null && hot !== null) {
        const bSign = build >= 0 ? '+' : '';
        if (buildEl) {
          buildEl.textContent = `${bSign}${build.toFixed(1)} psi`;
          buildEl.className = build >= 8.0 && build <= 16.0 ? 'mono txt-emerald' : 'mono txt-amber';
        }
        if (nextColdEl) {
          nextColdEl.textContent = `${nextCold.toFixed(1)} psi`;
        }
      } else if (cold === null && hot !== null) {
        if (buildEl) {
          buildEl.textContent = '— (Hot-only)';
          buildEl.className = 'mono txt-amber';
        }
        if (nextColdEl) {
          nextColdEl.textContent = 'Bled Hot';
        }
      } else {
        if (buildEl) {
          buildEl.textContent = '—';
          buildEl.className = 'mono txt-amber';
        }
        if (nextColdEl) {
          nextColdEl.textContent = cold !== null ? `${cold.toFixed(1)} psi` : '—';
        }
      }
    });

    syncClearColdPsiBtnText();
    saveState();

    return {
      venue,
      tyreHotTarget,
      tyreSessionLaps,
      tyreCondition: activeCond,
      corners
    };
  }

  function recalculateTrackAverageBurn(venueName) {
    const prof = ensureTrackProfile(venueName);
    const stats = getTrackLearnedFuelStats(venueName);
    prof.burnLPerLap = stats.avg;
    if (getSelectedFuelTrackVenue() === venueName && $('inputTrackBurnLPerLap')) {
      $('inputTrackBurnLPerLap').value = prof.burnLPerLap.toFixed(2);
    }
  }

  function saveFuelAndWeightToSession() {
    const activeEvt = getActiveEvent();
    if (!activeEvt) {
      openNewEventModal();
      return;
    }
    const activeSess = getActiveSession();
    if (!activeSess) {
      openPromptNextSessionModal();
      return;
    }

    const fuelSnap = recalcFuelAndWeight();
    const hasValidPump = fuelSnap.pumpUsedL > 0 && fuelSnap.pumpLaps > 0;
    const measured = hasValidPump ? Number(fuelSnap.pumpMeasuredBurn.toFixed(2)) : null;

    const unified = upsertUnifiedSession({
      sessionId: activeSess.id,
      venue: activeEvt.venue,
      sessionDateIso: activeEvt.eventDate,
      sessionDate: formatIsoDateDisplay(activeEvt.eventDate),
      sessionName: activeSess.sessionName,
      litresToPourL: Number(fuelSnap.litresToPourL.toFixed(1)),
      startingFuelReqL: Number(fuelSnap.startingFuelReqL.toFixed(1)),
      expectedBurnL: Number(fuelSnap.expectedBurnL.toFixed(1)),
      fuelFloorL: Number(fuelSnap.safeFloorL.toFixed(1)),
      fuelInL: hasValidPump ? Number(fuelSnap.pumpBeforeL.toFixed(1)) : activeSess.fuelInL,
      fuelOutL: hasValidPump ? Number(fuelSnap.pumpAfterL.toFixed(1)) : activeSess.fuelOutL,
      fuelUsedL: hasValidPump ? Number(fuelSnap.pumpUsedL.toFixed(2)) : activeSess.fuelUsedL,
      racedLaps: hasValidPump ? fuelSnap.pumpLaps : fuelSnap.raceLaps,
      measuredBurnLPerLap: measured !== null ? measured : Number(fuelSnap.burnLPerLap.toFixed(2)),
      scaleWeightKg: Number(fuelSnap.scaleCheckKg.toFixed(1)),
      postRaceEstKg: Number(fuelSnap.predictedPostRaceKg.toFixed(1))
    });
    if (!unified) return;

    if (hasValidPump) {
      recalculateTrackAverageBurn(activeEvt.venue);
    }

    saveState();
    renderWeekendEventBanner();
    recalcFuelAndWeight();
    recalcTyres();
    renderTyreStockList();
    renderSessionLog();

    showToast(`Saved Pre-Race Fuel & Scale Wt to ${unified.sessionName}`);
  }

  function saveTyresToSession() {
    const activeEvt = getActiveEvent();
    if (!activeEvt) {
      openNewEventModal();
      return;
    }
    const activeSess = getActiveSession();
    if (!activeSess) {
      openPromptNextSessionModal();
      return;
    }
    const tyreSnap = recalcTyres();

    // Save Session Guard: verify zero mixed specs across FL..RR before writing to state.sessions
    const mountedSpecs = new Set();
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const tid = tyreSnap.corners[c] && tyreSnap.corners[c].tyreId;
      if (!tid || tid === 'UNASSIGNED') return;
      const tObj = getTyreById(tid);
      if (tObj) {
        mountedSpecs.add(tObj.spec === 'wet' ? 'wet' : 'buffed');
      }
    });
    if (mountedSpecs.size > 1) {
      showToast('Illegal Tyre Mix: Cannot have Wet (KW) and Buffed (KB) tyres on the car at the same time!');
      return;
    }

    const notes = (($('inputTyreRunNotes') && $('inputTyreRunNotes').value) || '').trim();
    const racedLapsToSave =
      Number.isFinite(Number(activeSess.racedLaps)) && Number(activeSess.racedLaps) > 0
        ? Math.round(Number(activeSess.racedLaps))
        : tyreSnap.tyreSessionLaps;

    const unified = upsertUnifiedSession({
      sessionId: activeSess.id,
      venue: activeEvt.venue,
      sessionDateIso: activeEvt.eventDate,
      sessionDate: formatIsoDateDisplay(activeEvt.eventDate),
      sessionName: activeSess.sessionName,
      racedLaps: racedLapsToSave,
      tyreHotTarget: Number(tyreSnap.tyreHotTarget.toFixed(1)),
      tyreCondition: tyreSnap.tyreCondition || 'dry',
      tyres: {
        FL: { ...tyreSnap.corners.FL },
        FR: { ...tyreSnap.corners.FR },
        RL: { ...tyreSnap.corners.RL },
        RR: { ...tyreSnap.corners.RR }
      },
      appendPreRaceNote: notes
    });
    if (!unified) return;

    if ($('inputTyreRunNotes')) {
      $('inputTyreRunNotes').value = '';
    }
    if ($('inputPreRaceNotes')) {
      $('inputPreRaceNotes').value = unified.preRaceNotes || '';
    }
    if ($('inputRunNotes')) {
      $('inputRunNotes').value = unified.preRaceNotes || '';
    }

    saveState();
    renderWeekendEventBanner();
    recalcTyres();
    renderTyreStockList();
    renderSessionLog();
    showToast(`Locked & Saved Pre-Race Cold Tyres to ${unified.sessionName}`);
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
    const lapsStr = Number.isFinite(Number(s.racedLaps)) && Number(s.racedLaps) > 0 ? ` • ${Math.round(Number(s.racedLaps))} Laps` : '';
    const pillsHtml = ['FL', 'FR', 'RL', 'RR']
      .map((c) => {
        const cr = s.tyres[c] || { tyreId: DEFAULT_CORNER_TYRE_IDS[c], cold: null, hot: null, nextCold: null };
        const tyreCode = cr.tyreId || DEFAULT_CORNER_TYRE_IDS[c] || c;
        const hasCold = cr.cold !== null && cr.cold !== undefined && cr.cold !== '' && Number.isFinite(Number(cr.cold)) && Number(cr.cold) > 0;
        const hasHot = cr.hot !== null && cr.hot !== undefined && cr.hot !== '' && Number.isFinite(Number(cr.hot)) && Number(cr.hot) > 0;
        const hasNext = cr.nextCold !== null && cr.nextCold !== undefined && cr.nextCold !== '' && Number.isFinite(Number(cr.nextCold)) && Number(cr.nextCold) > 0;

        let valHtml = '';
        let nextStr = '';
        if (hasCold && hasHot) {
          valHtml = `${Number(cr.cold).toFixed(1)}&rarr;${Number(cr.hot).toFixed(1)}`;
          if (hasNext) nextStr = `Next ${Number(cr.nextCold).toFixed(1)}`;
        } else if (!hasCold && hasHot) {
          valHtml = `Hot ${Number(cr.hot).toFixed(1)}`;
          nextStr = 'Bled Hot';
        } else if (hasCold && !hasHot) {
          valHtml = `Cold ${Number(cr.cold).toFixed(1)}`;
        } else {
          valHtml = `[${escapeHtml(tyreCode)}]`;
        }

        return `
          <div class="unified-tyre-pill">
            <span class="unified-tyre-corner">${c} [${escapeHtml(tyreCode)}]</span>
            <span class="unified-tyre-val">${valHtml}</span>
            ${nextStr ? `<span class="unified-tyre-next">${nextStr}</span>` : ''}
          </div>
        `;
      })
      .join('');

    return `
      <div class="unified-session-subblock">
        <div class="unified-subblock-title">4-Corner Tyres${escapeHtml(targetStr)}${escapeHtml(lapsStr)}</div>
        <div class="unified-tyre-grid">${pillsHtml}</div>
      </div>
    `;
  }

  function getSessionOrderWeight(s) {
    const name = String((s && s.sessionName) || '').trim().toLowerCase();
    const pracMatch = name.match(/^practice\s*(\d+)/i);
    if (pracMatch) return 10 + Number(pracMatch[1]);
    if (name.includes('practice')) return 15;
    if (name.includes('qualifying') || name.includes('quali')) return 20;
    if (name.includes('warm')) return 30;
    const raceMatch = name.match(/^race\s*(\d+)/i);
    if (raceMatch) return 40 + Number(raceMatch[1]);
    if (name.includes('final') || name.includes('trophy') || name.includes('feature')) return 55;
    if (name.includes('race')) return 45;
    return 35;
  }

  function buildSessionSearchBlob(s, evt) {
    if (!s) return '';
    const tyreParts = [];
    if (s.tyreCondition) tyreParts.push(s.tyreCondition);
    if (s.tyres && typeof s.tyres === 'object') {
      ['FL', 'FR', 'RL', 'RR'].forEach((corner) => {
        const cr = s.tyres[corner];
        if (!cr) return;
        const code = cr.tyreId || '';
        if (code) {
          tyreParts.push(code);
          if (code.toUpperCase().startsWith('KB')) tyreParts.push('KB', 'dry', 'buffed');
          if (code.toUpperCase().startsWith('KW')) tyreParts.push('KW', 'wet');
        }
        if (cr.cold !== null && cr.cold !== undefined && cr.cold !== '') tyreParts.push(Number(cr.cold).toFixed(1));
        if (cr.hot !== null && cr.hot !== undefined && cr.hot !== '') tyreParts.push(Number(cr.hot).toFixed(1));
      });
    }
    const jetMmStr = Number.isFinite(Number(s.jetMm)) ? Number(s.jetMm).toFixed(3) : '';
    const radStr = Number.isFinite(Number(s.rad)) ? Number(s.rad).toFixed(1) : '';
    const sgStr = Number.isFinite(Number(s.fuelSg)) ? Number(s.fuelSg).toFixed(3) : '';
    const timingStr = Number.isFinite(Number(s.timing)) ? Number(s.timing).toFixed(1) : '';
    const wotStr = Number.isFinite(Number(s.afrWot)) ? Number(s.afrWot).toFixed(2) : '';
    const peakRpmStr = Number.isFinite(Number(s.peakRpm)) ? String(Math.round(Number(s.peakRpm))) : '';
    const psiStr = Number.isFinite(Number(s.fuelPsi)) ? Number(s.fuelPsi).toFixed(1) : '';
    const waterStr = s.waterTempC !== null && s.waterTempC !== undefined && s.waterTempC !== '' ? `${s.waterTempC}c` : '';

    return [
      (evt && evt.eventTitle) || s.eventTitle || '',
      (evt && evt.eventDate) || '',
      s.sessionName || '',
      s.venue || (evt && evt.venue) || '',
      s.sessionDate || '',
      s.sessionIsoDate || s.sessionDateIso || '',
      s.timestamp || '',
      s.carbyId || '',
      s.manifoldId || 'Macca',
      s.exhaustId || 'Macca',
      s.jetLabel || '',
      jetMmStr,
      `${jetMmStr}mm`,
      radStr,
      sgStr,
      timingStr,
      wotStr,
      peakRpmStr,
      psiStr,
      waterStr,
      s.afrStatus || '',
      tyreParts.join(' '),
      s.preRaceNotes || '',
      s.postRaceNotes || '',
      s.notes || ''
    ]
      .join(' ')
      .toLowerCase();
  }

  function renderUnifiedSessionCardHtml(s, isEventLocked) {
    const isBaseline =
      state.baseline.linkedSessionId === s.id ||
      (state.baseline.sessionName === s.sessionName &&
        state.baseline.carbyId === s.carbyId &&
        Math.abs(state.baseline.jetMm - s.jetMm) < 0.0005 &&
        Math.abs(state.baseline.rad - s.rad) < 0.05);

    const prot = evaluateManifoldProtection(s.afrWot, s.timing);
    const endCylClass = prot.level === 'danger' ? 'txt-danger' : 'txt-emerald';
    const isEditing = !isEventLocked && ui.editingSessionId === s.id;
    const isEstimated = s.afrStatus === 'estimated';
    const isActiveRun = !isEventLocked && s.id === state.activeSessionId;
    const wotValClass = isEstimated
      ? 'txt-amber'
      : prot.level === 'danger'
      ? 'txt-danger'
      : 'txt-emerald';
    const peakRpmVal = Number.isFinite(Number(s.peakRpm)) ? Math.round(Number(s.peakRpm)) : 5900;
    const venueLabel = normalizeVenueName(s.venue || 'Calder Park Raceway');
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

    const preNoteStr = String(s.preRaceNotes || '').trim();
    const postNoteStr = String(s.postRaceNotes !== undefined ? s.postRaceNotes : s.notes || '').trim();
    const notesBlockHtml =
      preNoteStr || postNoteStr
        ? `
          <div class="session-notes-stack">
            ${
              preNoteStr
                ? `<div class="session-note-line"><span class="session-note-tag pre">PRE-RACE:</span> <span>${escapeHtml(preNoteStr)}</span></div>`
                : ''
            }
            ${
              postNoteStr
                ? `<div class="session-note-line"><span class="session-note-tag post">POST-RACE:</span> <span>${escapeHtml(postNoteStr)}</span></div>`
                : ''
            }
          </div>
        `
        : '';

    const actionsHtml = isEventLocked
      ? `
        <div class="session-actions" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);">
          <span class="locked-event-readonly-pill">&#128274; Locked Event</span>
          <button type="button" class="btn ${isBaseline ? 'btn-emerald-outline' : 'btn-amber-outline'}" data-lock-session="${escapeHtml(s.id)}">
            ${isBaseline ? 'Locked Baseline' : 'Load as Baseline'}
          </button>
        </div>
      `
      : `
        <div class="session-actions">
          <button type="button" class="btn ${isEditing ? 'btn-danger' : 'btn-secondary'}" data-edit-session-afr="${escapeHtml(s.id)}">
            ${isEditing ? 'Cancel Edit' : 'Edit Session'}
          </button>
          <button type="button" class="btn ${isBaseline ? 'btn-emerald-outline' : 'btn-amber-outline'}" data-lock-session="${escapeHtml(s.id)}">
            ${isBaseline ? 'Locked Baseline' : 'Lock as Baseline'}
          </button>
          <button type="button" class="btn-icon-delete" data-delete-session="${escapeHtml(s.id)}" title="Remove Session" aria-label="Remove Session">&#10005;</button>
        </div>
      `;

    return `
      <article class="session-card ${isBaseline ? 'is-baseline' : ''}" data-session-id="${escapeHtml(s.id)}">
        <div class="session-head">
          <div>
            <div class="session-title-line">
              ${escapeHtml(s.sessionName)} &bull; <span class="txt-amber">${escapeHtml(s.carbyId)}</span> &bull; <span style="font-size: 0.82em; color: var(--text-secondary);">${escapeHtml(s.manifoldId || 'Macca')} Man / ${escapeHtml(s.exhaustId || 'Macca')} Exh</span>
            </div>
            <div class="session-meta-line">
              <strong>${escapeHtml(venueLabel)}</strong> &bull; ${escapeHtml(dateLabel)}${escapeHtml(timePart)} &bull;
              <strong>${escapeHtml(s.jetLabel)}</strong> (${s.jetMm.toFixed(3)}mm) &bull;
              ${s.rad.toFixed(1)}% RAD &bull; SG ${s.fuelSg.toFixed(3)} (${fuelTempVal.toFixed(0)}&deg;C) &bull; ${s.timing.toFixed(1)}&deg; &bull; ${s.fuelPsi.toFixed(1)} psi &bull; ${waterHtml}
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            ${
              isActiveRun
                ? '<span class="in-session-locked-pill" style="padding: 2px 7px; font-size: 0.65rem;">ACTIVE SESSION</span>'
                : isBaseline
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

        ${notesBlockHtml}

        ${actionsHtml}

        ${isEditing ? renderInlineSessionAfrEditor(s) : ''}
      </article>
    `;
  }

  function renderSessionLog() {
    const fallbackIso = getLocalTodayIso();
    if (!Array.isArray(state.events) || state.events.length === 0) {
      state.events = createDefaultEvents();
    }
    syncFlatSessionsFromEvents(state);

    const trackCounts = new Map();
    state.events.forEach((evt) => {
      const normVenue = normalizeVenueName(evt.venue || 'Calder Park Raceway');
      evt.venue = normVenue;
      trackCounts.set(normVenue, (trackCounts.get(normVenue) || 0) + 1);
    });

    const trackSel = $('searchLogTrack');
    const yearSel = $('searchLogYear');
    const queryInput = $('searchLogQuery');
    const clearBtn = $('btnClearLogQuery');

    const tracksList = Array.from(trackCounts.keys()).sort((a, b) => a.localeCompare(b));
    if (ui.logSearchTrack !== 'ALL' && !trackCounts.has(ui.logSearchTrack)) {
      ui.logSearchTrack = 'ALL';
    }

    if (trackSel) {
      trackSel.innerHTML = [
        `<option value="ALL">All Saved Tracks (${state.events.length})</option>`,
        ...tracksList.map(
          (trk) => `<option value="${escapeHtml(trk)}">${escapeHtml(trk)} (${trackCounts.get(trk)})</option>`
        )
      ].join('');
      trackSel.value = ui.logSearchTrack || 'ALL';
    }

    const activeTrack = trackSel ? trackSel.value : ui.logSearchTrack || 'ALL';
    ui.logSearchTrack = activeTrack;

    // Collect years present across state.events for the selected track (or all tracks if ALL)
    const yearSet = new Set();
    state.events.forEach((evt) => {
      if (activeTrack === 'ALL' || normalizeVenueName(evt.venue) === activeTrack) {
        const yr = String(evt.eventDate || '').slice(0, 4);
        if (/^\d{4}$/.test(yr)) {
          yearSet.add(yr);
        }
      }
    });
    const yearsList = Array.from(yearSet).sort((a, b) => b.localeCompare(a));
    if (ui.logSearchYear !== 'ALL' && !yearSet.has(ui.logSearchYear)) {
      ui.logSearchYear = 'ALL';
    }

    if (yearSel) {
      yearSel.innerHTML = [
        `<option value="ALL">All Years</option>`,
        ...yearsList.map((yr) => `<option value="${escapeHtml(yr)}">${escapeHtml(yr)}</option>`)
      ].join('');
      yearSel.value = ui.logSearchYear || 'ALL';
    }

    const activeYear = yearSel ? yearSel.value : ui.logSearchYear || 'ALL';
    ui.logSearchYear = activeYear;

    if (queryInput && document.activeElement !== queryInput) {
      queryInput.value = ui.logSearchQuery || '';
    }
    const rawQuery = String(queryInput ? queryInput.value : ui.logSearchQuery || '');
    ui.logSearchQuery = rawQuery;
    if (clearBtn) {
      clearBtn.hidden = rawQuery.length === 0;
    }

    const queryTokens = rawQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    // Filter events and their sessions
    const filteredEventEntries = [];
    state.events.forEach((evt, evtIdx) => {
      const evtVenue = normalizeVenueName(evt.venue || 'Calder Park Raceway');
      const evtYear = String(evt.eventDate || '').slice(0, 4);
      const matchTrack = activeTrack === 'ALL' || evtVenue === activeTrack;
      const matchYear = activeYear === 'ALL' || evtYear === activeYear;
      if (!matchTrack || !matchYear) return;

      const rawSessions = Array.isArray(evt.sessions) ? evt.sessions : [];
      let matchedSessions = rawSessions;
      if (queryTokens.length > 0) {
        const evtHeaderBlob = [
          evt.eventTitle || '',
          evtVenue,
          evt.eventDate || '',
          formatIsoDateDisplay(evt.eventDate || fallbackIso) || '',
          evt.locked ? 'locked' : 'live'
        ]
          .join(' ')
          .toLowerCase();
        const headerMatchesAll = queryTokens.every((tok) => evtHeaderBlob.includes(tok));
        if (!headerMatchesAll) {
          matchedSessions = rawSessions.filter((s) => {
            const blob = buildSessionSearchBlob(s, evt);
            return queryTokens.every((tok) => blob.includes(tok));
          });
          if (matchedSessions.length === 0) return;
        }
      }

      // Order sessions inside the Event newest-to-oldest (Race 3 -> Race 2 -> Race 1 -> Qualifying -> Practice 1)
      const orderedSessions = matchedSessions
        .map((s, sIdx) => ({ s, sIdx }))
        .sort((a, b) => {
          const weightA = getSessionOrderWeight(a.s);
          const weightB = getSessionOrderWeight(b.s);
          if (weightA !== weightB) return weightB - weightA;
          return b.sIdx - a.sIdx;
        })
        .map((item) => item.s);

      filteredEventEntries.push({
        evt,
        evtIdx,
        orderedSessions
      });
    });

    // Sort Events: any LIVE EVENT pinned #1, then MOST RECENT EVENT DATE FIRST down to OLDEST LAST
    filteredEventEntries.sort((a, b) => {
      const isLiveA = !a.evt.locked && a.evt.id === state.activeEventId;
      const isLiveB = !b.evt.locked && b.evt.id === state.activeEventId;
      if (isLiveA !== isLiveB) return isLiveA ? -1 : 1;
      const dateA = a.evt.eventDate || fallbackIso;
      const dateB = b.evt.eventDate || fallbackIso;
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return a.evtIdx - b.evtIdx;
    });

    const totalRunsShown = filteredEventEntries.reduce((acc, item) => acc + item.orderedSessions.length, 0);
    const badgeEl = $('sessionCountBadge');
    if (badgeEl) {
      badgeEl.textContent = `${filteredEventEntries.length} ${filteredEventEntries.length === 1 ? 'EVENT' : 'EVENTS'} • ${totalRunsShown} ${totalRunsShown === 1 ? 'RUN' : 'RUNS'}`;
    }

    const listEl = $('sessionLogList');
    if (!listEl) return;

    if (filteredEventEntries.length === 0) {
      listEl.innerHTML = `
        <div class="log-empty-state-card">
          <div class="log-empty-state-title">No Matching Events Found</div>
          <div class="log-empty-state-sub">No saved events or sessions matched your active Track, Year, or keyword search filters.</div>
          <button type="button" class="btn btn-secondary" data-reset-log-filters="1">Reset Search Filters</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filteredEventEntries
      .map(({ evt, orderedSessions }) => {
        const isLiveEvt = !evt.locked && evt.id === state.activeEventId;
        const isExpanded =
          isLiveEvt ||
          queryTokens.length > 0 ||
          ui.expandedEventIds.has(evt.id);
        const dispDate = formatIsoDateDisplay(evt.eventDate || fallbackIso) || evt.eventDate;
        const titlePart = evt.eventTitle ? ` &bull; ${escapeHtml(evt.eventTitle)}` : '';
        const sessCount = orderedSessions.length;
        const statusBadgeHtml = isLiveEvt
          ? `<span class="event-status-badge live">&#128994; LIVE</span>`
          : `<span class="event-status-badge locked">&#128274; LOCKED</span>`;

        return `
          <section class="event-log-card ${isLiveEvt ? 'event-live' : 'event-locked'} ${isExpanded ? 'expanded' : ''}" data-event-id="${escapeHtml(evt.id)}">
            <button
              type="button"
              class="event-card-header"
              data-toggle-event-acc="${escapeHtml(evt.id)}"
              aria-expanded="${isExpanded ? 'true' : 'false'}"
            >
              <div class="event-header-left">
                <div class="event-header-venue">${escapeHtml(evt.venue)}</div>
                <div class="event-header-sub tabular">${escapeHtml(dispDate)}${titlePart}</div>
              </div>
              <div class="event-header-right">
                ${statusBadgeHtml}
                <span class="event-session-count-pill tabular">${sessCount} ${sessCount === 1 ? 'SESSION' : 'SESSIONS'}</span>
                <span class="event-acc-chevron" aria-hidden="true">&#9660;</span>
              </div>
            </button>

            <div class="event-sessions-body" style="display: ${isExpanded ? 'block' : 'none'};">
              ${
                orderedSessions.length > 0
                  ? orderedSessions.map((s) => renderUnifiedSessionCardHtml(s, Boolean(evt.locked))).join('')
                  : `<div style="padding: 10px 6px 14px; font-size: 0.78rem; color: var(--text-secondary);">No sessions logged in this event yet.</div>`
              }
            </div>
          </section>
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
            <input type="text" id="inlineVenue_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(venueVal)}" disabled />
          </div>
        </div>

        <div class="field-group" style="margin-bottom: 10px;">
          <label class="field-label" for="inlineDate_${escapeHtml(s.id)}">Session Date</label>
          <input type="date" id="inlineDate_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(dateIsoVal)}" disabled />
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

        <div class="field-group" style="margin-bottom: 10px;">
          <label class="field-label" for="inlinePreNotes_${escapeHtml(s.id)}">Pre-Race Notes</label>
          <input type="text" id="inlinePreNotes_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(s.preRaceNotes || '')}" />
        </div>

        <div class="field-group" style="margin-bottom: 12px;">
          <label class="field-label" for="inlineNotes_${escapeHtml(s.id)}">Post-Race Notes</label>
          <input type="text" id="inlineNotes_${escapeHtml(s.id)}" class="text-input" value="${escapeHtml(s.postRaceNotes !== undefined ? s.postRaceNotes : s.notes || '')}" />
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
    syncFlatSessionsFromEvents(state);
    const headers = [
      'Event_ID',
      'Event_Title',
      'Event_Date',
      'Event_Locked',
      'Track',
      'Session',
      'Session_Status',
      'Venue',
      'Date',
      'Timestamp',
      'Carby_ID',
      'Manifold_ID',
      'Exhaust_ID',
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
      'FL_Tyre_ID',
      'FL_Cold_PSI',
      'FL_Hot_PSI',
      'FL_NextCold_PSI',
      'FR_Tyre_ID',
      'FR_Cold_PSI',
      'FR_Hot_PSI',
      'FR_NextCold_PSI',
      'RL_Tyre_ID',
      'RL_Cold_PSI',
      'RL_Hot_PSI',
      'RL_NextCold_PSI',
      'RR_Tyre_ID',
      'RR_Cold_PSI',
      'RR_Hot_PSI',
      'RR_NextCold_PSI',
      'Pre_Race_Notes',
      'Post_Race_Notes'
    ];
    const fmtOptDec = (val, dec = 1) =>
      val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val))
        ? Number(val).toFixed(dec)
        : '';
    const rows = state.sessions.map((s) => {
      const ownerEvt = findEventForSession(s.id);
      const a35 = normalizeOptionalAfr(s.afr3500);
      const a40 = normalizeOptionalAfr(s.afr4000);
      const a45 = normalizeOptionalAfr(s.afr4500);
      const a50 = normalizeOptionalAfr(s.afr5000);
      const a55 = normalizeOptionalAfr(s.afr5500);
      const waterVal = normalizeOptionalWaterTemp(s.waterTempC);
      const fuelTempVal = Number.isFinite(Number(s.fuelTempC)) ? Number(s.fuelTempC) : 20.0;
      const peakRpmVal = Number.isFinite(Number(s.peakRpm)) ? Math.round(Number(s.peakRpm)) : 5900;
      const dateStr = s.sessionDate || formatIsoDateDisplay(s.sessionDateIso || getLocalTodayIso());
      const trackName = normalizeVenueName(s.venue || (ownerEvt && ownerEvt.venue) || 'Calder Park Raceway');
      const t = s.tyres || {};
      const fmtCorner = (c, k) => {
        if (!t[c]) return '';
        const v = t[c][k];
        return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0
          ? Number(v).toFixed(1)
          : '';
      };
      const fmtCornerTyreId = (c) => (t[c] && t[c].tyreId ? String(t[c].tyreId) : '');
      return [
        (ownerEvt && ownerEvt.id) || s.eventId || '',
        (ownerEvt && ownerEvt.eventTitle) || s.eventTitle || '',
        (ownerEvt && ownerEvt.eventDate) || s.sessionDateIso || '',
        ownerEvt ? (ownerEvt.locked ? 'LOCKED' : 'LIVE') : 'LOCKED',
        trackName,
        s.sessionName,
        s.status === 'active' ? 'ACTIVE' : 'COMPLETED',
        trackName,
        dateStr,
        s.timestamp || '',
        s.carbyId,
        s.manifoldId || 'Macca',
        s.exhaustId || 'Macca',
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
        fmtCornerTyreId('FL'),
        fmtCorner('FL', 'cold'),
        fmtCorner('FL', 'hot'),
        fmtCorner('FL', 'nextCold'),
        fmtCornerTyreId('FR'),
        fmtCorner('FR', 'cold'),
        fmtCorner('FR', 'hot'),
        fmtCorner('FR', 'nextCold'),
        fmtCornerTyreId('RL'),
        fmtCorner('RL', 'cold'),
        fmtCorner('RL', 'hot'),
        fmtCorner('RL', 'nextCold'),
        fmtCornerTyreId('RR'),
        fmtCorner('RR', 'cold'),
        fmtCorner('RR', 'hot'),
        fmtCorner('RR', 'nextCold'),
        s.preRaceNotes || '',
        s.postRaceNotes !== undefined ? s.postRaceNotes : s.notes || ''
      ];
    });

    const csvText = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    triggerDownload(csvText, 'snb-hq202-sessions.csv', 'text/csv;charset=utf-8;');
    showToast('Exported Event & Session Log CSV');
  }

  function backupJsonState() {
    syncFlatSessionsFromEvents(state);
    if (Array.isArray(state.tyrePool)) {
      state.tyrePool.forEach((t) => {
        t.totalLaps = getTyreCumulativeLaps(t.id);
      });
    }
    const payload = JSON.stringify(
      {
        app: 'SNB Racing — HQ 202 Jetting & AFR (v0.5.8 Event Edition)',
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
        if (
          !candidate.baseline ||
          (!Array.isArray(candidate.sessions) && !Array.isArray(candidate.events)) ||
          !Array.isArray(candidate.jets)
        ) {
          throw new Error('Invalid SNB backup schema');
        }
        candidate.eventArchitectureV1 = true;
        state = hydrateState(candidate);
        ui.weatherOnly = Boolean(state.baseline.weatherOnly || state.baseline.wotAfr === null);
        ui.expandedEventIds = new Set([
          ...(state.activeEventId ? [state.activeEventId] : []),
          ...(Array.isArray(state.events) && state.events[0] ? [state.events[0].id] : [])
        ]);
        saveState();
        syncSessionSelectFromBaseline();
        hydrateFuelAndTyreInputs();
        renderAll();
        showToast(`Restored ${state.events.length} events (${state.sessions.length} sessions) from JSON backup`);
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
     8. RENDERING: TAB 4 (CARBIES, INLET MANIFOLDS, EXHAUSTS & M1 JET KIT)
     ------------------------------------------------------------------------ */
  const PROTECTED_CARBY_IDS = ['1 DME', '2 DME', 'SNB Carby'];
  const PROTECTED_MANIFOLD_IDS = ['Macca', 'SNB'];
  const PROTECTED_EXHAUST_IDS = ['Macca', 'DME', 'Pounder', 'Grunt'];

  function renderCarbyFleet() {
    const container = $('carbyFleetContainer');
    const selectEl = $('selectFleetCarby');
    if (!container) return;

    if (!Array.isArray(state.carbies) || state.carbies.length === 0) {
      state.carbies = createDefaultCarbies();
    }

    const activeCarbyId = state.baseline && state.baseline.carbyId ? state.baseline.carbyId : state.carbies[0].id;
    if (!ui.selectedFleetCarbyId || !state.carbies.some((c) => c.id === ui.selectedFleetCarbyId)) {
      ui.selectedFleetCarbyId = activeCarbyId;
    }

    if (selectEl) {
      selectEl.innerHTML = state.carbies
        .map((c) => {
          const isActive = c.id === activeCarbyId;
          return `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${isActive ? ' ★ ON CAR' : ''}</option>`;
        })
        .join('');
      selectEl.value = ui.selectedFleetCarbyId;
    }

    const activeBadge = $('fleetCarbyActiveBadge');
    if (activeBadge) {
      activeBadge.textContent = `${activeCarbyId} ★ ON CAR`;
    }

    const c = state.carbies.find((item) => item.id === ui.selectedFleetCarbyId) || state.carbies[0];
    const fittedJet = findJetById(c.fittedJetId);
    const jetText = fittedJet ? `${fittedJet.label} (${fittedJet.mm.toFixed(3)} mm)` : 'Unassigned';
    const venturiLegal = c.venturiMm <= 30.94;
    const exitLegal = c.exitMm <= 40.00;
    const allLegal = venturiLegal && exitLegal && c.studsMm === 75.0;
    const isOnCar = c.id === activeCarbyId;
    const canDelete = !isOnCar && state.carbies.length > 1;

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

    container.innerHTML = `
      <div class="carby-card" style="margin-bottom: 0;">
        <div class="session-head" style="margin-bottom: 6px;">
          <div>
            <div class="session-title-line">
              ${escapeHtml(c.name)}
              ${isOnCar ? '<span class="locked-badge" style="margin-left: 6px;">★ ON CAR</span>' : ''}
            </div>
            <div class="session-meta-line">${escapeHtml(c.bodyType || 'Stromberg BXUV-3 40mm')} &bull; ${(c.studsMm || 75).toFixed(0)} mm Studs</div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="locked-badge" style="${allLegal ? '' : 'color: var(--danger); background: var(--danger-dim);'}">
              ${allLegal ? 'Grp 3H Legal' : 'Check Bore'}
            </span>
            ${
              canDelete
                ? `<button type="button" class="btn-icon-delete" data-delete-fleet-carby="${escapeHtml(c.id)}" title="Remove ${escapeHtml(c.name)}" aria-label="Remove ${escapeHtml(c.name)}">&#10005;</button>`
                : ''
            }
          </div>
        </div>

        <div class="carby-specs-grid">
          <div class="telem-cell">
            <span class="telem-label">Venturi</span>
            <span class="telem-val">${c.venturiMm.toFixed(2)} mm</span>
            <span class="telem-sub">&le; 30.94 mm limit</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">Throttle Bore</span>
            <span class="telem-val">${c.exitMm.toFixed(2)} mm</span>
            <span class="telem-sub">&le; 40.00 mm exit</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">Spill / Fitted Jet</span>
            <span class="telem-val txt-amber">${c.spillMm.toFixed(1)} mm &bull; ${Number(a.jetMm).toFixed(3)} mm</span>
            <span class="telem-sub">${escapeHtml(a.jetLabel)}</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">Anchor AFR / RAD</span>
            <span class="telem-val ${hasVerifiedAfr ? 'txt-emerald' : 'txt-amber'}">${hasVerifiedAfr ? Number(a.verifiedAfr).toFixed(2) : 'Untested'} @ ${Number(a.rad).toFixed(1)}%</span>
            <span class="telem-sub">${escapeHtml(anchorAfrText)}</span>
          </div>
        </div>

        ${c.notes ? `<p style="margin: 6px 0 10px; font-size: 0.78rem; color: var(--text-secondary);">${escapeHtml(c.notes)}</p>` : ''}

        <div class="form-grid-2">
          <button type="button" class="btn ${isOnCar ? 'btn-confirm' : 'btn-amber-outline'}" data-load-carby-anchor="${escapeHtml(c.id)}">
            ${isOnCar ? `${escapeHtml(c.name)} Active on Car` : `Set ${escapeHtml(c.name)} on Car`}
          </button>
          <button type="button" class="btn btn-secondary" data-edit-carby="${escapeHtml(c.id)}">
            Edit Selected Carby
          </button>
        </div>
      </div>
    `;
  }

  function renderManifoldFleet() {
    const container = $('manifoldFleetContainer');
    const selectEl = $('selectFleetManifold');
    if (!container) return;

    if (!Array.isArray(state.manifolds) || state.manifolds.length === 0) {
      state.manifolds = createDefaultManifolds();
    }
    const activeId = state.activeManifoldId || state.manifolds[0].id || 'Macca';
    if (!ui.selectedFleetManifoldId || !state.manifolds.some((m) => m.id === ui.selectedFleetManifoldId)) {
      ui.selectedFleetManifoldId = activeId;
    }

    if (selectEl) {
      selectEl.innerHTML = state.manifolds
        .map((m) => {
          const isOnCar = m.id === activeId;
          return `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}${isOnCar ? ' ★ ON CAR' : ''}</option>`;
        })
        .join('');
      selectEl.value = ui.selectedFleetManifoldId;
    }

    const badge = $('fleetManifoldActiveBadge');
    if (badge) {
      badge.textContent = `${activeId} ★ ON CAR`;
    }

    const m = state.manifolds.find((item) => item.id === ui.selectedFleetManifoldId) || state.manifolds[0];
    const isOnCar = m.id === activeId;
    const canDelete = !isOnCar && state.manifolds.length > 1;

    const pf = m.portFlowCfm || {};
    const cfmFront = Number.isFinite(Number(m.cfmFront))
      ? Number(m.cfmFront)
      : Number.isFinite(Number(pf.front))
      ? Number(pf.front)
      : 155;
    const cfmMiddle = Number.isFinite(Number(m.cfmMiddle))
      ? Number(m.cfmMiddle)
      : Number.isFinite(Number(pf.middle))
      ? Number(pf.middle)
      : 155;
    const cfmRear = Number.isFinite(Number(m.cfmRear))
      ? Number(m.cfmRear)
      : Number.isFinite(Number(pf.rear))
      ? Number(pf.rear)
      : 155;
    const avgCfm = (cfmFront + cfmMiddle + cfmRear) / 3;
    const endAvg = (cfmFront + cfmRear) / 2;
    const balPct = cfmMiddle > 0 ? (endAvg / cfmMiddle) * 100 : 100;
    const deltaPct = balPct - 100;
    const castingSpec = m.casting && m.casting.length <= 24 ? m.casting : 'Group 3H Cast Log';

    container.innerHTML = `
      <div class="carby-card" style="margin-bottom: 0;">
        <div class="session-head" style="margin-bottom: 6px;">
          <div>
            <div class="session-title-line">
              ${escapeHtml(m.name)}
              ${isOnCar ? '<span class="locked-badge" style="margin-left: 6px;">★ ON CAR</span>' : ''}
            </div>
            <div class="session-meta-line">HQ 202 Single-Carb Log Intake &bull; Port Flow Balanced</div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="locked-badge">GRP 3H CAST LOG</span>
            ${
              canDelete
                ? `<button type="button" class="btn-icon-delete" data-delete-fleet-manifold="${escapeHtml(m.id)}" title="Remove ${escapeHtml(m.name)}" aria-label="Remove ${escapeHtml(m.name)}">&#10005;</button>`
                : ''
            }
          </div>
        </div>

        <div class="carby-specs-grid">
          <div class="telem-cell">
            <span class="telem-label">FRONT / MID / REAR FLOW</span>
            <span class="telem-val">${cfmFront.toFixed(0)} &bull; ${cfmMiddle.toFixed(0)} &bull; ${cfmRear.toFixed(0)} CFM</span>
            <span class="telem-sub">Cyl #1/#2 &bull; #3/#4 &bull; #5/#6</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">AVG PORT FLOW</span>
            <span class="telem-val txt-emerald">${avgCfm.toFixed(1)} CFM</span>
            <span class="telem-sub">3-Runner Mean Flow</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">END-TO-MID BALANCE</span>
            <span class="telem-val ${Math.abs(deltaPct) <= 2.5 ? 'txt-emerald' : 'txt-amber'}">${balPct.toFixed(1)}%</span>
            <span class="telem-sub">#1/#2 &amp; #5/#6 vs #3/#4</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">CASTING SPEC</span>
            <span class="telem-val">${escapeHtml(castingSpec)}</span>
            <span class="telem-sub">${isOnCar ? 'Bolted on Car' : 'Workshop Spare'}</span>
          </div>
        </div>

        ${m.notes ? `<p style="margin: 6px 0 10px; font-size: 0.78rem; color: var(--text-secondary);">${escapeHtml(m.notes)}</p>` : ''}

        <div class="form-grid-2">
          <button type="button" class="btn ${isOnCar ? 'btn-confirm' : 'btn-amber-outline'}" data-set-manifold-on-car="${escapeHtml(m.id)}">
            ${isOnCar ? `${escapeHtml(m.name)} Active on Car` : `Set ${escapeHtml(m.name)} on Car`}
          </button>
          <button type="button" class="btn btn-secondary" data-edit-manifold="${escapeHtml(m.id)}">
            Edit Selected Manifold
          </button>
        </div>
      </div>
    `;
  }

  function renderExhaustFleet() {
    const container = $('exhaustFleetContainer');
    const selectEl = $('selectFleetExhaust');
    if (!container) return;

    if (!Array.isArray(state.exhausts) || state.exhausts.length === 0) {
      state.exhausts = createDefaultExhausts();
    }
    const activeId = state.activeExhaustId || state.exhausts[0].id || 'Macca';
    if (!ui.selectedFleetExhaustId || !state.exhausts.some((x) => x.id === ui.selectedFleetExhaustId)) {
      ui.selectedFleetExhaustId = activeId;
    }

    if (selectEl) {
      selectEl.innerHTML = state.exhausts
        .map((x) => {
          const isOnCar = x.id === activeId;
          return `<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)}${isOnCar ? ' ★ ON CAR' : ''}</option>`;
        })
        .join('');
      selectEl.value = ui.selectedFleetExhaustId;
    }

    const badge = $('fleetExhaustActiveBadge');
    if (badge) {
      badge.textContent = `${activeId} ★ ON CAR`;
    }

    const x = state.exhausts.find((item) => item.id === ui.selectedFleetExhaustId) || state.exhausts[0];
    const isOnCar = x.id === activeId;
    const canDelete = !isOnCar && state.exhausts.length > 1;
    const hasFlow =
      x.flowCfm !== null && x.flowCfm !== undefined && x.flowCfm !== '' && Number.isFinite(Number(x.flowCfm)) && Number(x.flowCfm) > 0;
    const pipeSpec = x.primarySpec || x.spec || (x.id === 'Macca' ? 'Main #1 Race System' : 'HQ 202 Race Extractors');
    const isMainRace = x.id === 'Macca' || /main\s*#?1/i.test(pipeSpec);
    const headerBadge = isMainRace ? 'MAIN #1' : 'TEST SYSTEM';
    const fleetRole = isMainRace ? 'Primary Race System' : 'To Flow & Dyno Test';
    const statusText = isOnCar ? 'Bolted on Car' : 'Workshop Rack';

    container.innerHTML = `
      <div class="carby-card" style="margin-bottom: 0;">
        <div class="session-head" style="margin-bottom: 6px;">
          <div>
            <div class="session-title-line">
              ${escapeHtml(x.name)}
              ${isOnCar ? '<span class="locked-badge" style="margin-left: 6px;">★ ON CAR</span>' : ''}
            </div>
            <div class="session-meta-line">HQ 202 Race Extractors &amp; Collector System</div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="locked-badge" style="${isMainRace ? '' : 'color: #FCD34D; border-color: rgba(245, 158, 11, 0.45);'}">${escapeHtml(headerBadge)}</span>
            ${
              canDelete
                ? `<button type="button" class="btn-icon-delete" data-delete-fleet-exhaust="${escapeHtml(x.id)}" title="Remove ${escapeHtml(x.name)}" aria-label="Remove ${escapeHtml(x.name)}">&#10005;</button>`
                : ''
            }
          </div>
        </div>

        <div class="carby-specs-grid">
          <div class="telem-cell">
            <span class="telem-label">BENCH FLOW</span>
            <span class="telem-val ${hasFlow ? 'txt-emerald' : 'txt-amber'}">${hasFlow ? `${Number(x.flowCfm).toFixed(0)} CFM` : 'Untested'}</span>
            <span class="telem-sub">${hasFlow ? 'Verified Bench CFM' : 'Awaiting Flow Bench'}</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">PIPE / COLLECTOR SPEC</span>
            <span class="telem-val">${escapeHtml(pipeSpec)}</span>
            <span class="telem-sub">Group 3H HQ 202</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">FLEET ROLE</span>
            <span class="telem-val ${isMainRace ? 'txt-emerald' : 'txt-amber'}">${escapeHtml(fleetRole)}</span>
            <span class="telem-sub">${isMainRace ? 'Number #1 System' : 'Development &amp; Dyno'}</span>
          </div>
          <div class="telem-cell">
            <span class="telem-label">STATUS</span>
            <span class="telem-val ${isOnCar ? 'txt-emerald' : ''}">${escapeHtml(statusText)}</span>
            <span class="telem-sub">${isOnCar ? 'Active on Race Car' : 'Ready to Swap'}</span>
          </div>
        </div>

        ${x.notes ? `<p style="margin: 6px 0 10px; font-size: 0.78rem; color: var(--text-secondary);">${escapeHtml(x.notes)}</p>` : ''}

        <div class="form-grid-2">
          <button type="button" class="btn ${isOnCar ? 'btn-confirm' : 'btn-amber-outline'}" data-set-exhaust-on-car="${escapeHtml(x.id)}">
            ${isOnCar ? `${escapeHtml(x.name)} Active on Car` : `Set ${escapeHtml(x.name)} on Car`}
          </button>
          <button type="button" class="btn btn-secondary" data-edit-exhaust="${escapeHtml(x.id)}">
            Edit Selected Exhaust
          </button>
        </div>
      </div>
    `;
  }

  function deleteFleetCarbyById(cid) {
    const targetId = cid || ui.selectedFleetCarbyId;
    if (!targetId || state.carbies.length <= 1) return;
    if (state.baseline && state.baseline.carbyId === targetId) {
      showToast('Cannot delete the Carby currently Active on Car');
      return;
    }
    state.carbies = state.carbies.filter((c) => c.id !== targetId);
    ui.selectedFleetCarbyId = state.baseline && state.baseline.carbyId ? state.baseline.carbyId : state.carbies[0].id;
    saveState();
    renderAll();
    showToast(`Removed ${targetId} from Carby Fleet`);
  }

  function deleteFleetManifoldById(mid) {
    const targetId = mid || ui.selectedFleetManifoldId;
    if (!targetId || state.manifolds.length <= 1) return;
    if (state.activeManifoldId === targetId) {
      showToast('Cannot delete the Manifold currently Active on Car');
      return;
    }
    state.manifolds = state.manifolds.filter((m) => m.id !== targetId);
    ui.selectedFleetManifoldId = state.activeManifoldId || state.manifolds[0].id;
    saveState();
    populateCarbySelects();
    renderManifoldFleet();
    showToast(`Removed ${targetId} Manifold`);
  }

  function setManifoldActiveOnCar(mid) {
    const targetId = mid || ui.selectedFleetManifoldId;
    if (!targetId) return;
    state.activeManifoldId = targetId;
    state.manifolds.forEach((m) => {
      m.onCar = m.id === targetId;
    });
    ui.selectedFleetManifoldId = targetId;
    saveState();
    populateCarbySelects();
    renderManifoldFleet();
    showToast(`${targetId} Manifold set ★ ON CAR`);
  }

  function deleteFleetExhaustById(xid) {
    const targetId = xid || ui.selectedFleetExhaustId;
    if (!targetId || state.exhausts.length <= 1) return;
    if (state.activeExhaustId === targetId) {
      showToast('Cannot delete the Exhaust currently Active on Car');
      return;
    }
    state.exhausts = state.exhausts.filter((x) => x.id !== targetId);
    ui.selectedFleetExhaustId = state.activeExhaustId || state.exhausts[0].id;
    saveState();
    populateCarbySelects();
    renderExhaustFleet();
    showToast(`Removed ${targetId} Exhaust`);
  }

  function setExhaustActiveOnCar(xid) {
    const targetId = xid || ui.selectedFleetExhaustId;
    if (!targetId) return;
    state.activeExhaustId = targetId;
    state.exhausts.forEach((x) => {
      x.onCar = x.id === targetId;
    });
    ui.selectedFleetExhaustId = targetId;
    saveState();
    populateCarbySelects();
    renderExhaustFleet();
    showToast(`${targetId} Exhaust set ★ ON CAR`);
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

  function syncModalPostFuelAndTyresPreview() {
    const inL = readNum('modalPostFuelInL', 0);
    const outL = readNum('modalPostFuelOutL', 0);
    const laps = Math.max(1, Math.round(readNum('modalPostRacedLaps', 10)));
    const usedL = Math.max(0, inL - outL);
    const burnEl = $('modalPostMeasuredBurnOut');
    if (burnEl) {
      if (inL > 0 && outL >= 0 && inL >= outL && laps > 0) {
        const burn = usedL / laps;
        burnEl.textContent = `${usedL.toFixed(1)} L used ÷ ${laps} laps = ${burn.toFixed(2)} L/lap`;
        burnEl.className = 'mono txt-emerald';
      } else {
        burnEl.textContent = '— L/lap';
        burnEl.className = 'mono txt-amber';
      }
    }

    const activeSess = getActiveSession() || (ui.postRaceTargetSessionId && state.sessions.find((s) => s.id === ui.postRaceTargetSessionId)) || null;
    const hotTarget =
      activeSess && Number.isFinite(Number(activeSess.tyreHotTarget))
        ? Number(activeSess.tyreHotTarget)
        : readNum('inputTyreHotTarget', 44.0);

    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const nextOutEl = $(`modalPostNextCold_${c}`);
      if (!nextOutEl) return;
      const hotRaw = $(`modalPostHotPsi_${c}`) ? String($(`modalPostHotPsi_${c}`).value || '').trim() : '';
      const hotVal = hotRaw !== '' ? parseFloat(hotRaw) : NaN;
      const coldFromSess =
        activeSess && activeSess.tyres && activeSess.tyres[c] && Number.isFinite(Number(activeSess.tyres[c].cold))
          ? Number(activeSess.tyres[c].cold)
          : readOptionalPsi(`inputColdPsi_${c}`);

      if (Number.isFinite(hotVal) && hotVal > 0 && coldFromSess !== null && Number.isFinite(coldFromSess) && coldFromSess > 0) {
        const nextCold = coldFromSess + (hotTarget - hotVal);
        nextOutEl.textContent = `Next Cold: ${nextCold.toFixed(1)} PSI (from ${coldFromSess.toFixed(1)} → ${hotVal.toFixed(1)})`;
        nextOutEl.className = 'field-hint emerald';
      } else if (coldFromSess !== null && Number.isFinite(coldFromSess) && coldFromSess > 0) {
        nextOutEl.textContent = `Cold Set: ${coldFromSess.toFixed(1)} PSI (Enter Hot PSI)`;
        nextOutEl.className = 'field-hint';
      } else {
        nextOutEl.textContent = 'Next Cold: —';
        nextOutEl.className = 'field-hint';
      }
    });
  }

  function openPostRaceAfrModal() {
    const liveEvt = getActiveEvent();
    if (!liveEvt) {
      openNewEventModal();
      return;
    }

    const activeSess = getActiveSession();
    const liveSessions = Array.isArray(liveEvt.sessions) ? liveEvt.sessions : [];
    const linked =
      activeSess ||
      (state.awaitingPostRaceId && liveSessions.find((s) => s.id === state.awaitingPostRaceId)) ||
      liveSessions[liveSessions.length - 1] ||
      null;

    if (!linked) {
      openPromptNextSessionModal();
      return;
    }

    ui.postRaceTargetSessionId = linked.id;

    const b = state.baseline;
    const sessionLabelName = linked.sessionName || b.sessionName;
    const sessionVenue = liveEvt.venue || linked.venue || b.venue || 'Calder Park Raceway';
    const sessionCarby = linked.carbyId || b.carbyId;
    const sessionJet = linked.jetLabel || b.jetLabel;

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

    // Section 2: Pre-populate Post-Race Fuel Pump-Out from session or Tab 2 inputs
    const defaultFuelIn =
      linked.fuelInL !== null && linked.fuelInL !== undefined && Number.isFinite(Number(linked.fuelInL))
        ? Number(linked.fuelInL)
        : linked.startingFuelReqL !== null && linked.startingFuelReqL !== undefined && Number.isFinite(Number(linked.startingFuelReqL))
        ? Number(linked.startingFuelReqL)
        : readNum('inputPumpBeforeL', 29.0);
    const defaultFuelOut =
      linked.fuelOutL !== null && linked.fuelOutL !== undefined && Number.isFinite(Number(linked.fuelOutL))
        ? Number(linked.fuelOutL)
        : readNum('inputPumpAfterL', 12.0);
    const defaultRacedLaps =
      linked.racedLaps !== null && linked.racedLaps !== undefined && Number.isFinite(Number(linked.racedLaps)) && Number(linked.racedLaps) > 0
        ? Math.round(Number(linked.racedLaps))
        : Math.max(1, Math.round(readNum('inputRaceLaps', 10)));

    if ($('modalPostFuelInL')) $('modalPostFuelInL').value = defaultFuelIn.toFixed(1);
    if ($('modalPostFuelOutL')) $('modalPostFuelOutL').value = defaultFuelOut.toFixed(1);
    if ($('modalPostRacedLaps')) $('modalPostRacedLaps').value = String(defaultRacedLaps);

    // Section 3: Pre-populate Post-Race 4-Corner Hot PSIs from Tab 3 inputs or session
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const hotModalEl = $(`modalPostHotPsi_${c}`);
      if (!hotModalEl) return;
      const tabHot = readOptionalPsi(`inputHotPsi_${c}`);
      const sessHot =
        linked.tyres && linked.tyres[c] && linked.tyres[c].hot !== null && linked.tyres[c].hot !== undefined && Number.isFinite(Number(linked.tyres[c].hot))
          ? Number(linked.tyres[c].hot)
          : null;
      const val = tabHot !== null ? tabHot : sessHot;
      hotModalEl.value = val !== null ? val.toFixed(1) : '';
    });

    syncModalPostFuelAndTyresPreview();

    if ($('modalPostNotes')) {
      $('modalPostNotes').value = linked.postRaceNotes || '';
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
    const liveEvt = getActiveEvent();
    const liveSessions = liveEvt && Array.isArray(liveEvt.sessions) ? liveEvt.sessions : [];
    let linked =
      getActiveSession() ||
      (ui.postRaceTargetSessionId && liveSessions.find((s) => s.id === ui.postRaceTargetSessionId)) ||
      (state.awaitingPostRaceId && liveSessions.find((s) => s.id === state.awaitingPostRaceId)) ||
      liveSessions[liveSessions.length - 1] ||
      null;

    if (!linked && liveEvt) {
      linked = upsertUnifiedSession({
        venue: liveEvt.venue,
        sessionDateIso: liveEvt.eventDate,
        sessionDate: formatIsoDateDisplay(liveEvt.eventDate),
        sessionName: getSelectedSessionName()
      });
    }

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
    const postNotesVal = ($('modalPostNotes') && $('modalPostNotes').value.trim()) || '';

    const a35 = readOptionalAfr('modalPost3500');
    const a40 = readOptionalAfr('modalPost4000');
    const a45 = readOptionalAfr('modalPost4500');
    const a50 = readOptionalAfr('modalPost5000');
    const a55 = readOptionalAfr('modalPost5500');

    // Read Post-Race Fuel Pump-Out
    const modalFuelInL = readNum('modalPostFuelInL', 0);
    const modalFuelOutL = readNum('modalPostFuelOutL', 0);
    const modalRacedLaps = Math.max(1, Math.round(readNum('modalPostRacedLaps', 10)));
    const hasValidPump = modalFuelInL > 0 && modalFuelOutL >= 0 && modalFuelInL > modalFuelOutL && modalRacedLaps > 0;
    const modalFuelUsedL = hasValidPump ? Number((modalFuelInL - modalFuelOutL).toFixed(2)) : null;
    const modalMeasuredBurn = hasValidPump ? Number((modalFuelUsedL / modalRacedLaps).toFixed(2)) : null;

    if (hasValidPump) {
      if ($('inputPumpBeforeL')) $('inputPumpBeforeL').value = modalFuelInL.toFixed(1);
      if ($('inputPumpAfterL')) $('inputPumpAfterL').value = modalFuelOutL.toFixed(1);
      if ($('inputPumpLaps')) $('inputPumpLaps').value = String(modalRacedLaps);
      if ($('inputRaceLaps')) $('inputRaceLaps').value = String(modalRacedLaps);
      if ($('inputTyreSessionLaps')) $('inputTyreSessionLaps').value = String(modalRacedLaps);
    }

    // Read Post-Race Hot Tyre PSIs & compute Next Cold Set for roll-forward
    const hotTarget =
      linked && Number.isFinite(Number(linked.tyreHotTarget))
        ? Number(linked.tyreHotTarget)
        : readNum('inputTyreHotTarget', 44.0);
    const mounted = ensureMountedTyresState();
    const nextColdRollForward = {};

    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const hotRaw = $(`modalPostHotPsi_${c}`) ? String($(`modalPostHotPsi_${c}`).value || '').trim() : '';
      const parsedHot = hotRaw !== '' ? parseFloat(hotRaw) : NaN;
      const hotPsi = Number.isFinite(parsedHot) && parsedHot > 0 ? Number(parsedHot.toFixed(1)) : null;

      const coldPsi =
        linked && linked.tyres && linked.tyres[c] && Number.isFinite(Number(linked.tyres[c].cold)) && Number(linked.tyres[c].cold) > 0
          ? Number(linked.tyres[c].cold)
          : readOptionalPsi(`inputColdPsi_${c}`);

      let nextColdPsi = null;
      if (coldPsi !== null && hotPsi !== null) {
        nextColdPsi = Number((coldPsi + (hotTarget - hotPsi)).toFixed(1));
      } else if (coldPsi !== null) {
        nextColdPsi = Number(coldPsi.toFixed(1));
      }

      if (linked) {
        if (!linked.tyres || typeof linked.tyres !== 'object') linked.tyres = {};
        const prevCorner = linked.tyres[c] || {};
        linked.tyres[c] = {
          ...prevCorner,
          tyreId: prevCorner.tyreId || mounted[c] || DEFAULT_CORNER_TYRE_IDS[c],
          cold: coldPsi,
          hot: hotPsi,
          nextCold: nextColdPsi
        };
      }
      if (nextColdPsi !== null) {
        nextColdRollForward[c] = nextColdPsi;
      }
    });

    const completedSessionName = linked ? linked.sessionName : state.baseline.sessionName;

    if (linked && !isSessionLocked(linked.id)) {
      linked.status = 'completed';
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
      linked.racedLaps = modalRacedLaps;
      if (hasValidPump) {
        linked.fuelInL = Number(modalFuelInL.toFixed(1));
        linked.fuelOutL = Number(modalFuelOutL.toFixed(1));
        linked.fuelUsedL = modalFuelUsedL;
        linked.measuredBurnLPerLap = modalMeasuredBurn;
      }
      if (postNotesVal) {
        linked.postRaceNotes = postNotesVal;
        linked.notes = postNotesVal;
      }

      // Promote this completed session into Locked Baseline for the next session
      const iso = linked.sessionDateIso || state.baseline.sessionDateIso || getLocalTodayIso();
      state.baseline = {
        venue: linked.venue || state.baseline.venue || 'Calder Park Raceway',
        sessionDateIso: iso,
        sessionDate: linked.sessionDate || formatIsoDateDisplay(iso),
        sessionName: linked.sessionName,
        carbyId: linked.carbyId,
        manifoldId: linked.manifoldId || state.activeManifoldId || 'Macca',
        exhaustId: linked.exhaustId || state.activeExhaustId || 'Macca',
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
    }

    // Roll-forward Fuel L/lap and Tyre Next Cold Set PSIs into live chassis baseline & clear Hot PSIs
    const venueForLearn = (liveEvt && liveEvt.venue) || (linked && linked.venue) || state.baseline.venue || 'Calder Park Raceway';
    syncFlatSessionsFromEvents(state);
    if (hasValidPump) {
      recalculateTrackAverageBurn(venueForLearn);
      const learnedFuel = getTrackLearnedFuelStats(venueForLearn);
      if ($('inputBurnLPerLap')) {
        $('inputBurnLPerLap').value = learnedFuel.avg.toFixed(2);
      }
      if (state.chassis) {
        state.chassis.burnLPerLap = learnedFuel.avg;
      }
    }

    const prof = ensureTrackProfile(venueForLearn);
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      if (Number.isFinite(nextColdRollForward[c])) {
        const nextColdVal = nextColdRollForward[c];
        if (state.chassis && state.chassis.coldTyres) {
          state.chassis.coldTyres[c] = nextColdVal;
        }
        if (state.chassis && state.chassis.tyreCondition !== 'wet' && prof && prof.coldTyres) {
          prof.coldTyres[c] = nextColdVal;
        }
        const coldInput = $(`inputColdPsi_${c}`);
        if (coldInput) coldInput.value = nextColdVal.toFixed(1);
      }
      if (state.chassis && state.chassis.hotTyres) {
        state.chassis.hotTyres[c] = null;
      }
      const hotInput = $(`inputHotPsi_${c}`);
      if (hotInput) hotInput.value = '';
    });

    // Update cumulative tyre laps across pool now that session is marked completed
    if (Array.isArray(state.tyrePool)) {
      state.tyrePool.forEach((t) => {
        t.totalLaps = getTyreCumulativeLaps(t.id);
      });
    }

    // Transition out of the completed session into Gate B / Prompt for Next Session
    state.activeSessionId = null;
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
    renderAll();

    // Immediately prompt for the next session in sequence
    openPromptNextSessionModal(completedSessionName);

    const waterMsg = waterTempC !== null ? ` • ${waterTempC}°C` : '';
    showToast(
      `Completed ${completedSessionName}: ${wot.toFixed(2)} AFR @ ${peakRpm} RPM${waterMsg} • Baseline Rolled Forward`
    );
  }

  function openDeleteSessionModal(sid) {
    if (isSessionLocked(sid)) {
      showToast('Event is Completed & Locked (Read-Only)');
      return;
    }
    const sess = state.sessions.find((s) => s.id === sid);
    if (!sess) return;

    ui.confirmDeleteSessionId = sid;
    const venueLabel = normalizeVenueName(sess.venue || 'Calder Park Raceway');
    if ($('deleteSessionTargetLabel')) {
      $('deleteSessionTargetLabel').textContent = `${sess.sessionName} • ${venueLabel} (${sess.carbyId} • ${sess.jetLabel})`;
    }
    if ($('deleteSessionStep1')) $('deleteSessionStep1').style.display = 'block';
    if ($('deleteSessionStep2')) $('deleteSessionStep2').style.display = 'none';
    openModal('modalDeleteSessionConfirm');
  }

  function advanceDeleteSessionStep2() {
    if (!ui.confirmDeleteSessionId) return;
    if ($('deleteSessionStep1')) $('deleteSessionStep1').style.display = 'none';
    if ($('deleteSessionStep2')) $('deleteSessionStep2').style.display = 'block';
  }

  function confirmPermanentDeleteSession() {
    const sid = ui.confirmDeleteSessionId;
    if (!sid) return;
    const sess = state.sessions.find((s) => s.id === sid);
    if (!sess) {
      closeModal('modalDeleteSessionConfirm');
      return;
    }

    const removedName = sess.sessionName;
    const removedVenue = sess.venue || 'Calder Park Raceway';
    const ownerEvt = findEventForSession(sid);
    if (ownerEvt && Array.isArray(ownerEvt.sessions)) {
      ownerEvt.sessions = ownerEvt.sessions.filter((s) => s.id !== sid);
    }
    if (state.activeSessionId === sid) {
      state.activeSessionId = null;
    }
    syncFlatSessionsFromEvents(state);
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
    if (Array.isArray(state.tyrePool)) {
      state.tyrePool.forEach((t) => {
        t.totalLaps = getTyreCumulativeLaps(t.id);
      });
    }
    closeModal('modalDeleteSessionConfirm');
    saveState();
    renderAll();
    showToast(`Permanently deleted ${removedName}`);
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
    const isNew = !carbyId || carbyId === '__NEW__';
    const carby = isNew
      ? {
          id: '__NEW__',
          name: '',
          venturiMm: 30.88,
          exitMm: 39.95,
          spillMm: 15.0,
          fittedJetId: 'm1_0800',
          notes: '',
          baselineAnchor: {
            jetMm: 2.032,
            rad: 94.3,
            fuelSg: 0.740,
            verifiedAfr: null,
            sourceLabel: 'Untested Anchor'
          }
        }
      : state.carbies.find((c) => c.id === carbyId);
    if (!carby) return;

    $('editCarbyIdHidden').value = isNew ? '__NEW__' : carby.id;
    if ($('editCarbyName')) {
      $('editCarbyName').value = isNew ? '' : carby.name || carby.id;
    }
    $('modalEditCarbyTitle').textContent = isNew
      ? 'Add New Carburettor (40mm BXUV-3)'
      : `Edit ${carby.name} (40mm BXUV-3)`;
    $('editCarbyVenturi').value = Number(carby.venturiMm ?? 30.88).toFixed(2);
    $('editCarbyExit').value = Number(carby.exitMm ?? 39.95).toFixed(2);
    $('editCarbySpill').value = Number(carby.spillMm ?? 15.0).toFixed(1);
    $('editCarbyNotes').value = carby.notes || '';

    const jetSel = $('editCarbyJet');
    jetSel.innerHTML = sortJetsByDiameter(state.jets)
      .map((j) => `<option value="${escapeHtml(j.id)}">${escapeHtml(j.label)} (${j.mm.toFixed(3)} mm)</option>`)
      .join('');
    jetSel.value = carby.fittedJetId || 'm1_0800';

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
    const isNew = !id || id === '__NEW__';
    const rawName = ($('editCarbyName') ? $('editCarbyName').value : '').trim();

    let carby = isNew ? null : state.carbies.find((c) => c.id === id);
    if (isNew) {
      if (!rawName) {
        showToast('Enter a Carby Name / ID');
        return;
      }
      if (state.carbies.some((c) => c.id.toLowerCase() === rawName.toLowerCase())) {
        showToast(`${rawName} is already in Carby Fleet`);
        return;
      }
      carby = {
        id: rawName,
        name: rawName,
        bodyType: 'Stromberg BXUV-3 40mm',
        studsMm: 75.0,
        venturiMm: 30.88,
        exitMm: 39.95,
        spillMm: 15.0,
        fittedJetId: 'm1_0800',
        notes: ''
      };
      state.carbies.push(carby);
      ui.selectedFleetCarbyId = carby.id;
    } else if (carby && rawName && rawName !== carby.name) {
      carby.name = rawName;
    }
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
    showToast(`${isNew ? 'Added' : 'Saved'} ${carby.name} specs & baseline anchor`);
  }

  function openEditManifoldModal(manifoldId) {
    const isNew = !manifoldId || manifoldId === '__NEW__';
    const m = isNew
      ? {
          id: '__NEW__',
          name: '',
          cfmFront: 155,
          cfmMiddle: 155,
          cfmRear: 155,
          casting: 'Group 3H Cast Log',
          notes: ''
        }
      : state.manifolds.find((item) => item.id === manifoldId);
    if (!m) return;

    const pf = m.portFlowCfm || {};
    const cfmFront = Number.isFinite(Number(m.cfmFront))
      ? Number(m.cfmFront)
      : Number.isFinite(Number(pf.front))
      ? Number(pf.front)
      : 155;
    const cfmMiddle = Number.isFinite(Number(m.cfmMiddle))
      ? Number(m.cfmMiddle)
      : Number.isFinite(Number(pf.middle))
      ? Number(pf.middle)
      : 155;
    const cfmRear = Number.isFinite(Number(m.cfmRear))
      ? Number(m.cfmRear)
      : Number.isFinite(Number(pf.rear))
      ? Number(pf.rear)
      : 155;

    if ($('editManifoldIdHidden')) $('editManifoldIdHidden').value = isNew ? '__NEW__' : m.id;
    if ($('modalEditManifoldTitle')) {
      $('modalEditManifoldTitle').textContent = isNew
        ? 'Add New Inlet Manifold (HQ 202)'
        : `Edit ${m.name} Manifold (HQ 202)`;
    }
    if ($('editManifoldName')) $('editManifoldName').value = isNew ? '' : m.name || m.id;
    if ($('editManifoldCfmFront')) $('editManifoldCfmFront').value = cfmFront.toFixed(0);
    if ($('editManifoldCfmMiddle')) $('editManifoldCfmMiddle').value = cfmMiddle.toFixed(0);
    if ($('editManifoldCfmRear')) $('editManifoldCfmRear').value = cfmRear.toFixed(0);
    if ($('editManifoldCasting')) {
      $('editManifoldCasting').value =
        m.casting && m.casting.length <= 24 ? m.casting : 'Group 3H Cast Log';
    }
    if ($('editManifoldNotes')) $('editManifoldNotes').value = m.notes || '';

    openModal('modalEditManifold');
  }

  function saveEditManifoldModal() {
    const id = $('editManifoldIdHidden') ? $('editManifoldIdHidden').value : '';
    const isNew = !id || id === '__NEW__';
    const rawName = ($('editManifoldName') ? $('editManifoldName').value : '').trim();

    let m = isNew ? null : state.manifolds.find((item) => item.id === id);
    if (isNew) {
      if (!rawName) {
        showToast('Enter a Manifold Name / ID');
        return;
      }
      if (state.manifolds.some((item) => item.id.toLowerCase() === rawName.toLowerCase())) {
        showToast(`${rawName} is already in Inlet Manifolds`);
        return;
      }
      m = {
        id: rawName,
        name: rawName,
        onCar: false
      };
      state.manifolds.push(m);
      ui.selectedFleetManifoldId = m.id;
    } else if (m && rawName) {
      m.name = rawName;
    }
    if (!m) return;

    const front = Math.round(readNum('editManifoldCfmFront', 155));
    const middle = Math.round(readNum('editManifoldCfmMiddle', 155));
    const rear = Math.round(readNum('editManifoldCfmRear', 155));
    m.cfmFront = front;
    m.cfmMiddle = middle;
    m.cfmRear = rear;
    m.portFlowCfm = { front, middle, rear };
    m.casting = ($('editManifoldCasting') ? $('editManifoldCasting').value.trim() : '') || 'Group 3H Cast Log';
    m.notes = ($('editManifoldNotes') ? $('editManifoldNotes').value.trim() : '');

    saveState();
    closeModal('modalEditManifold');
    populateCarbySelects();
    renderManifoldFleet();
    showToast(`${isNew ? 'Added' : 'Saved'} ${m.name} Manifold (${front}/${middle}/${rear} CFM)`);
  }

  function openEditExhaustModal(exhaustId) {
    const isNew = !exhaustId || exhaustId === '__NEW__';
    const x = isNew
      ? {
          id: '__NEW__',
          name: '',
          flowCfm: null,
          primarySpec: 'Tri-Y / 6-into-2-into-1 HQ 202 headers',
          notes: ''
        }
      : state.exhausts.find((item) => item.id === exhaustId);
    if (!x) return;

    if ($('editExhaustIdHidden')) $('editExhaustIdHidden').value = isNew ? '__NEW__' : x.id;
    if ($('modalEditExhaustTitle')) {
      $('modalEditExhaustTitle').textContent = isNew
        ? 'Add New Exhaust / Headers (HQ 202)'
        : `Edit ${x.name} Exhaust (HQ 202)`;
    }
    if ($('editExhaustName')) $('editExhaustName').value = isNew ? '' : x.name || x.id;
    const hasFlow =
      x.flowCfm !== null && x.flowCfm !== undefined && x.flowCfm !== '' && Number.isFinite(Number(x.flowCfm)) && Number(x.flowCfm) > 0;
    if ($('editExhaustFlowCfm')) $('editExhaustFlowCfm').value = hasFlow ? Number(x.flowCfm).toFixed(0) : '';
    if ($('editExhaustSpec')) {
      $('editExhaustSpec').value = x.primarySpec || x.spec || (x.id === 'Macca' ? 'Main #1 Race System' : 'HQ 202 Race Extractors');
    }
    if ($('editExhaustNotes')) $('editExhaustNotes').value = x.notes || '';

    openModal('modalEditExhaust');
  }

  function saveEditExhaustModal() {
    const id = $('editExhaustIdHidden') ? $('editExhaustIdHidden').value : '';
    const isNew = !id || id === '__NEW__';
    const rawName = ($('editExhaustName') ? $('editExhaustName').value : '').trim();

    let x = isNew ? null : state.exhausts.find((item) => item.id === id);
    if (isNew) {
      if (!rawName) {
        showToast('Enter an Exhaust Name / ID');
        return;
      }
      if (state.exhausts.some((item) => item.id.toLowerCase() === rawName.toLowerCase())) {
        showToast(`${rawName} is already in Exhaust Fleet`);
        return;
      }
      x = {
        id: rawName,
        name: rawName,
        onCar: false
      };
      state.exhausts.push(x);
      ui.selectedFleetExhaustId = x.id;
    } else if (x && rawName) {
      x.name = rawName;
    }
    if (!x) return;

    const rawCfm = $('editExhaustFlowCfm') ? $('editExhaustFlowCfm').value.trim() : '';
    const parsedCfm = parseFloat(rawCfm);
    x.flowCfm = rawCfm !== '' && Number.isFinite(parsedCfm) && parsedCfm > 0 ? Math.round(parsedCfm) : null;
    const specStr = ($('editExhaustSpec') ? $('editExhaustSpec').value.trim() : '') || 'HQ 202 Race Extractors';
    x.primarySpec = specStr;
    x.spec = specStr;
    x.notes = ($('editExhaustNotes') ? $('editExhaustNotes').value.trim() : '');

    saveState();
    closeModal('modalEditExhaust');
    populateCarbySelects();
    renderExhaustFleet();
    showToast(`${isNew ? 'Added' : 'Saved'} ${x.name} Exhaust specs`);
  }

  /* ------------------------------------------------------------------------
     10. GLOBAL STEPPER & EVENT DELEGATION
     ------------------------------------------------------------------------ */
  const FUEL_LITRE_STEPPER_IDS = new Set([
    'inputFuelFloorL',
    'inputPumpBeforeL',
    'inputPumpAfterL',
    'inputScaleCheckFuelL',
    'modalPostFuelInL',
    'modalPostFuelOutL'
  ]);

  function stepNumericInput(inputEl, delta) {
    if (!inputEl) return;
    const rawStr = String(inputEl.value || '').trim();
    const current = rawStr === '' ? NaN : parseFloat(rawStr);
    const min = inputEl.min !== '' ? parseFloat(inputEl.min) : -Infinity;
    const max = inputEl.max !== '' ? parseFloat(inputEl.max) : Infinity;
    const stepStr = String(Math.abs(delta));
    const idStr = String(inputEl.id || '');
    const decimals = FUEL_LITRE_STEPPER_IDS.has(idStr)
      ? 1
      : stepStr.includes('.')
      ? stepStr.split('.')[1].length
      : 0;

    // If an optional AFR, Cold/Hot Tyre PSI, Tyre Temp, Exhaust CFM, or Water Temp field is blank, start at a sensible default when stepping
    if (idStr === 'inputScaleCheckKg' && (!Number.isFinite(current) || current <= 500)) {
      inputEl.value = delta > 0 ? '1375.0' : '0.0';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (idStr === 'editExhaustFlowCfm' && (!Number.isFinite(current) || current <= 0)) {
      inputEl.value = '220';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (idStr.startsWith('inputColdPsi_') && (!Number.isFinite(current) || current <= 0)) {
      const cKey = idStr.replace('inputColdPsi_', '');
      const venue = getSelectedTyreTrackVenue();
      const activeCond = state.chassis && state.chassis.tyreCondition === 'wet' ? 'wet' : 'dry';
      const learned = getTrackLearnedColdTyres(venue, readNum('inputTyreHotTarget', 44.0), activeCond);
      const startCold =
        learned && learned.corners && learned.corners[cKey] && Number.isFinite(learned.corners[cKey].avg)
          ? learned.corners[cKey].avg
          : 30.0;
      inputEl.value = startCold.toFixed(1);
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
    renderWeekendEventBanner();
    if (tabId === 'tab-fuel') {
      recalcFuelAndWeight();
    }
    if (tabId === 'tab-tyres') {
      recalcTyres();
      renderTyreStockList();
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
    renderWeekendEventBanner();
    renderLockedBaselineBar();
    populateCarbySelects();
    renderStep1LiveHints();
    if (ui.calcStep === 2) {
      renderStep2Calculator(false);
    }
    recalcFuelAndWeight();
    recalcTyres();
    renderTyreStockList();
    renderSessionLog();
    renderDynoPullList();
    if (ui.activeTab === 'tab-dyno') {
      renderDynoCanvas();
    }
    renderCarbyFleet();
    renderManifoldFleet();
    renderExhaustFleet();
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

      const toggleEventAccBtn = e.target.closest('[data-toggle-event-acc]');
      if (toggleEventAccBtn) {
        const eid = toggleEventAccBtn.getAttribute('data-toggle-event-acc');
        if (!(ui.expandedEventIds instanceof Set)) {
          ui.expandedEventIds = new Set();
        }
        if (ui.expandedEventIds.has(eid)) {
          ui.expandedEventIds.delete(eid);
        } else {
          ui.expandedEventIds.add(eid);
        }
        renderSessionLog();
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

      const resetLogFiltersBtn = e.target.closest('[data-reset-log-filters]');
      if (resetLogFiltersBtn) {
        ui.logSearchTrack = 'ALL';
        ui.logSearchYear = 'ALL';
        ui.logSearchQuery = '';
        if ($('searchLogQuery')) $('searchLogQuery').value = '';
        if ($('btnClearLogQuery')) $('btnClearLogQuery').hidden = true;
        renderSessionLog();
        return;
      }

      const editSessionBtn = e.target.closest('[data-edit-session-afr]');
      if (editSessionBtn) {
        const sid = editSessionBtn.getAttribute('data-edit-session-afr');
        if (isSessionLocked(sid)) {
          showToast('Event is Completed & Locked (Read-Only)');
          return;
        }
        ui.editingSessionId = ui.editingSessionId === sid ? null : sid;
        renderSessionLog();
        return;
      }

      const saveSessionBtn = e.target.closest('[data-save-session-afr]');
      if (saveSessionBtn) {
        const sid = saveSessionBtn.getAttribute('data-save-session-afr');
        if (isSessionLocked(sid)) {
          showToast('Event is Completed & Locked (Read-Only)');
          return;
        }
        const sess = state.sessions.find((s) => s.id === sid);
        if (sess) {
          const nameInput = $(`inlineName_${sid}`);
          const preNotesInput = $(`inlinePreNotes_${sid}`);
          const notesInput = $(`inlineNotes_${sid}`);
          if (nameInput && nameInput.value.trim()) {
            sess.sessionName = nameInput.value.trim();
          }
          if (preNotesInput) {
            sess.preRaceNotes = preNotesInput.value.trim();
          }
          if (notesInput) {
            sess.postRaceNotes = notesInput.value.trim();
            sess.notes = sess.postRaceNotes;
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
          if (sess.manifoldId) {
            state.activeManifoldId = sess.manifoldId;
          }
          if (sess.exhaustId) {
            state.activeExhaustId = sess.exhaustId;
          }
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
        openDeleteSessionModal(sid);
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
        renderCarbyFleet();
        return;
      }

      const editCarbyBtn = e.target.closest('[data-edit-carby]');
      if (editCarbyBtn) {
        openEditCarbyModal(editCarbyBtn.getAttribute('data-edit-carby'));
        return;
      }

      const delFleetCarbyBtn = e.target.closest('[data-delete-fleet-carby]');
      if (delFleetCarbyBtn) {
        deleteFleetCarbyById(delFleetCarbyBtn.getAttribute('data-delete-fleet-carby'));
        return;
      }

      const setManifoldBtn = e.target.closest('[data-set-manifold-on-car]');
      if (setManifoldBtn) {
        setManifoldActiveOnCar(setManifoldBtn.getAttribute('data-set-manifold-on-car'));
        return;
      }

      const editManifoldBtn = e.target.closest('[data-edit-manifold]');
      if (editManifoldBtn) {
        openEditManifoldModal(editManifoldBtn.getAttribute('data-edit-manifold'));
        return;
      }

      const delFleetManifoldBtn = e.target.closest('[data-delete-fleet-manifold]');
      if (delFleetManifoldBtn) {
        deleteFleetManifoldById(delFleetManifoldBtn.getAttribute('data-delete-fleet-manifold'));
        return;
      }

      const setExhaustBtn = e.target.closest('[data-set-exhaust-on-car]');
      if (setExhaustBtn) {
        setExhaustActiveOnCar(setExhaustBtn.getAttribute('data-set-exhaust-on-car'));
        return;
      }

      const editExhaustBtn = e.target.closest('[data-edit-exhaust]');
      if (editExhaustBtn) {
        openEditExhaustModal(editExhaustBtn.getAttribute('data-edit-exhaust'));
        return;
      }

      const delFleetExhaustBtn = e.target.closest('[data-delete-fleet-exhaust]');
      if (delFleetExhaustBtn) {
        deleteFleetExhaustById(delFleetExhaustBtn.getAttribute('data-delete-fleet-exhaust'));
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
        return;
      }

      const toggleAccBtn = e.target.closest('[data-toggle-tyre-acc]');
      if (toggleAccBtn) {
        const tid = toggleAccBtn.getAttribute('data-toggle-tyre-acc');
        ui.expandedTyreId = ui.expandedTyreId === tid ? null : tid;
        renderTyreStockList();
        return;
      }

      const stockFilterBtn = e.target.closest('[data-tyre-stock-filter]');
      if (stockFilterBtn) {
        ui.tyreStockFilter = stockFilterBtn.getAttribute('data-tyre-stock-filter') || 'all';
        renderTyreStockList();
        return;
      }

      const newSpecBtn = e.target.closest('[data-new-tyre-spec]');
      if (newSpecBtn) {
        syncNewTyreSpecUi(newSpecBtn.getAttribute('data-new-tyre-spec'));
        return;
      }

      const drawerSpecBtn = e.target.closest('[data-tyre-spec-id]');
      if (drawerSpecBtn) {
        const tid = drawerSpecBtn.getAttribute('data-tyre-spec-id');
        const nextSpec = drawerSpecBtn.getAttribute('data-tyre-spec-val') === 'wet' ? 'wet' : 'buffed';
        const tyre = findTyreInPool(tid);
        if (tyre) {
          tyre.spec = nextSpec;
          tyre.stamp = `Kenda KR15 ${nextSpec === 'wet' ? 'Wet' : 'Buffed'} (${tyre.label || tyre.id})`;
          saveState();
          renderMountedTyreSelectors();
          renderTyreStockList();
        }
        return;
      }

      const condBtn = e.target.closest('[data-tyre-condition]');
      if (condBtn) {
        const cond = condBtn.getAttribute('data-tyre-condition') === 'wet' ? 'wet' : 'dry';
        mountTyreSetBySpec(cond === 'wet' ? 'wet' : 'buffed');
        return;
      }

      const wetPresetBtn = e.target.closest('[data-wet-preset]');
      if (wetPresetBtn) {
        const pKey = wetPresetBtn.getAttribute('data-wet-preset');
        applyWetPreset(pKey, false);
        return;
      }

      const deleteTyreBtn = e.target.closest('[data-delete-tyre]');
      if (deleteTyreBtn) {
        const tid = deleteTyreBtn.getAttribute('data-delete-tyre');
        deleteTyreFromStock(tid);
        return;
      }

      const toggleRetireTyreBtn = e.target.closest('[data-toggle-retire-tyre]');
      if (toggleRetireTyreBtn) {
        const tid = toggleRetireTyreBtn.getAttribute('data-toggle-retire-tyre');
        const tyre = findTyreInPool(tid);
        if (tyre) {
          tyre.retired = !tyre.retired;
          saveState();
          renderMountedTyreSelectors();
          renderTyreStockList();
          renderTyrePoolModal();
          showToast(`${tyre.id} marked ${tyre.retired ? 'Retired' : 'Active'}`);
        }
      }
    });

    // Direct change listeners on all 4 corner tyre dropdowns so switching tyres is always instant
    ['FL', 'FR', 'RL', 'RR'].forEach((c) => {
      const selEl = $(`selectMountedTyre_${c}`);
      if (selEl) {
        selEl.addEventListener('change', () => {
          handleCornerTyreSelectChange(c, selEl.value);
        });
      }
    });

    // Delegated document-level input/change listener for guaranteed live reactivity on Tab 2 (Fuel & Wt), Tab 3 (Tyres), and Tyre Stock Manager
    const handleLiveFuelOrTyreInput = (e) => {
      const target = e.target;
      if (!target) return;

      const cornerSel = target.getAttribute && target.getAttribute('data-corner-tyre-select');
      if (cornerSel) {
        handleCornerTyreSelectChange(cornerSel, target.value);
        return;
      }

      const stockTreadId = target.getAttribute && target.getAttribute('data-tyre-tread');
      if (stockTreadId) {
        const tyre = findTyreInPool(stockTreadId);
        const val = parseFloat(target.value);
        if (tyre && Number.isFinite(val)) {
          tyre.treadMm = Number(Math.max(0, val).toFixed(1));
          const st = getTreadStatusInfo(tyre.treadMm);
          const statusEl = $(`stockTreadStatus_${stockTreadId}`);
          if (statusEl) {
            statusEl.textContent = st.text;
            statusEl.className = st.hintClass;
          }
          const cardEl = $(`tyreStockCard_${stockTreadId}`);
          if (cardEl) {
            const mounted = ensureMountedTyresState();
            const isMounted = Object.values(mounted).includes(stockTreadId);
            const isExpanded = ui.expandedTyreId === stockTreadId;
            cardEl.className = ['tyre-acc-item', isMounted ? 'is-mounted' : '', isExpanded ? 'is-open' : '', st.cardClass]
              .filter(Boolean)
              .join(' ');
          }
          updateAccordionRowSummaryInPlace(stockTreadId);
          saveState();
          renderMountedTyreSelectors();
          renderTyrePoolModal();
        }
        return;
      }

      const stockHardnessId = target.getAttribute && target.getAttribute('data-tyre-hardness');
      if (stockHardnessId) {
        const tyre = findTyreInPool(stockHardnessId);
        const val = parseFloat(target.value);
        if (tyre && Number.isFinite(val)) {
          tyre.durometer = Math.max(40, Math.min(95, Math.round(val)));
          const statusEl = $(`stockHardnessStatus_${stockHardnessId}`);
          if (statusEl) {
            statusEl.textContent = `${tyre.durometer} Shore A`;
          }
          updateAccordionRowSummaryInPlace(stockHardnessId);
          saveState();
          renderMountedTyreSelectors();
          renderTyrePoolModal();
        }
        return;
      }

      const stockBaseLapsId = target.getAttribute && target.getAttribute('data-tyre-baselaps');
      if (stockBaseLapsId) {
        const tyre = findTyreInPool(stockBaseLapsId);
        const val = parseFloat(target.value);
        if (tyre && Number.isFinite(val)) {
          tyre.baseLaps = Math.max(0, Math.round(val));
          updateAccordionRowSummaryInPlace(stockBaseLapsId);
          saveState();
          renderMountedTyreSelectors();
          renderTyrePoolModal();
        }
        return;
      }

      const stockDateId = target.getAttribute && target.getAttribute('data-tyre-date');
      if (stockDateId) {
        const tyre = findTyreInPool(stockDateId);
        if (tyre && target.value) {
          tyre.purchaseDate = target.value;
          saveState();
          renderTyrePoolModal();
        }
        return;
      }

      const stockLabelId = target.getAttribute && target.getAttribute('data-tyre-label');
      if (stockLabelId) {
        const tyre = findTyreInPool(stockLabelId);
        if (tyre) {
          const nextLabel = target.value.trim() || tyre.id;
          tyre.label = nextLabel;
          tyre.code = nextLabel;
          tyre.stamp = `Kenda KR15 ${tyre.spec === 'wet' ? 'Wet' : 'Buffed'} (${nextLabel})`;
          updateAccordionRowSummaryInPlace(stockLabelId);
          saveState();
          renderMountedTyreSelectors();
          renderTyrePoolModal();
        }
        return;
      }

      const poolTreadId = target.getAttribute && target.getAttribute('data-pool-tread-id');
      if (poolTreadId) {
        const tyre = findTyreInPool(poolTreadId);
        const val = parseFloat(target.value);
        if (tyre && Number.isFinite(val)) {
          tyre.treadMm = Number(Math.max(0, val).toFixed(1));
          saveState();
          renderMountedTyreSelectors();
          renderTyreStockList();
        }
        return;
      }

      const poolBaseLapsId = target.getAttribute && target.getAttribute('data-pool-baselaps-id');
      if (poolBaseLapsId) {
        const tyre = findTyreInPool(poolBaseLapsId);
        const val = parseFloat(target.value);
        if (tyre && Number.isFinite(val)) {
          tyre.baseLaps = Math.max(0, Math.round(val));
          saveState();
          renderMountedTyreSelectors();
          renderTyreStockList();
          recalcTyres();
        }
        return;
      }

      if (!target.id) return;
      if (target.closest('#tab-fuel') || target.id === 'inputFuelSg') {
        recalcFuelAndWeight();
      } else if (target.closest('#tab-tyres') && !target.closest('#tyreStockManagerCard')) {
        recalcTyres();
      }
    };
    document.addEventListener('input', handleLiveFuelOrTyreInput);
    document.addEventListener('change', handleLiveFuelOrTyreInput);

    // Weekend Event Banner, Gatekeeper & Sequential Session Modals
    if ($('btnOpenNewEventModal')) {
      $('btnOpenNewEventModal').addEventListener('click', () => openNewEventModal());
    }
    if ($('btnCloseNewEventModal')) {
      $('btnCloseNewEventModal').addEventListener('click', () => closeModal('modalNewEvent'));
    }
    if ($('newEventTrack')) {
      $('newEventTrack').addEventListener('change', () => {
        if ($('newEventCustomTrackWrap')) {
          $('newEventCustomTrackWrap').style.display =
            $('newEventTrack').value === '__CUSTOM__' ? 'block' : 'none';
        }
      });
    }
    if ($('newEventFirstSession')) {
      $('newEventFirstSession').addEventListener('change', () => {
        if ($('newEventCustomSessionWrap')) {
          $('newEventCustomSessionWrap').style.display =
            $('newEventFirstSession').value === '__CUSTOM__' ? 'block' : 'none';
        }
      });
    }
    if ($('btnStartLiveEvent')) {
      $('btnStartLiveEvent').addEventListener('click', startLiveEventFromModal);
    }
    if ($('btnOpenCreateNextSession')) {
      $('btnOpenCreateNextSession').addEventListener('click', () => openPromptNextSessionModal());
    }
    if ($('nextSessionSelect')) {
      $('nextSessionSelect').addEventListener('change', () => {
        if ($('nextSessionCustomWrap')) {
          $('nextSessionCustomWrap').style.display =
            $('nextSessionSelect').value === '__CUSTOM__' ? 'block' : 'none';
        }
      });
    }
    if ($('btnConfirmStartNextSession')) {
      $('btnConfirmStartNextSession').addEventListener('click', confirmStartNextSessionFromPrompt);
    }
    if ($('btnDeferNextSession')) {
      $('btnDeferNextSession').addEventListener('click', deferNextSessionToGateB);
    }
    if ($('btnOpenEndEventModal')) {
      $('btnOpenEndEventModal').addEventListener('click', openEndEventModal);
    }
    if ($('btnOpenEndEventFromGateB')) {
      $('btnOpenEndEventFromGateB').addEventListener('click', openEndEventModal);
    }
    if ($('btnEndEventFromPrompt')) {
      $('btnEndEventFromPrompt').addEventListener('click', () => {
        closeModal('modalPromptNextSession');
        openEndEventModal();
      });
    }
    if ($('btnCloseEndEventModal')) {
      $('btnCloseEndEventModal').addEventListener('click', () => closeModal('modalEndEvent'));
    }
    if ($('btnKeepEventOpen')) {
      $('btnKeepEventOpen').addEventListener('click', () => closeModal('modalEndEvent'));
    }
    if ($('btnConfirmEndEvent')) {
      $('btnConfirmEndEvent').addEventListener('click', confirmEndActiveEvent);
    }

    // Two-step Delete Session Confirmation Modal
    if ($('btnCancelDeleteSessionStep1')) {
      $('btnCancelDeleteSessionStep1').addEventListener('click', () => {
        ui.confirmDeleteSessionId = null;
        closeModal('modalDeleteSessionConfirm');
      });
    }
    if ($('btnAdvanceDeleteSessionStep2')) {
      $('btnAdvanceDeleteSessionStep2').addEventListener('click', advanceDeleteSessionStep2);
    }
    if ($('btnCancelDeleteSessionStep2')) {
      $('btnCancelDeleteSessionStep2').addEventListener('click', () => {
        ui.confirmDeleteSessionId = null;
        closeModal('modalDeleteSessionConfirm');
      });
    }
    if ($('btnConfirmPermanentDeleteSession')) {
      $('btnConfirmPermanentDeleteSession').addEventListener('click', confirmPermanentDeleteSession);
    }

    // Live Pre-Race Notes sync between Step 1 (#inputPreRaceNotes), Step 2 (#inputRunNotes), and active session
    const syncPreRaceNotesLive = (val) => {
      if ($('inputPreRaceNotes') && $('inputPreRaceNotes').value !== val) {
        $('inputPreRaceNotes').value = val;
      }
      if ($('inputRunNotes') && $('inputRunNotes').value !== val) {
        $('inputRunNotes').value = val;
      }
      const activeSess = getActiveSession();
      if (activeSess) {
        activeSess.preRaceNotes = String(val || '').trim();
        saveState();
      }
    };
    if ($('inputPreRaceNotes')) {
      $('inputPreRaceNotes').addEventListener('input', (e) => syncPreRaceNotesLive(e.target.value));
    }
    if ($('inputRunNotes')) {
      $('inputRunNotes').addEventListener('input', (e) => syncPreRaceNotesLive(e.target.value));
    }

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

    $('selectCalcCarby').addEventListener('change', updateCarbySwapHint);

    if ($('selectCalcManifold')) {
      $('selectCalcManifold').addEventListener('change', () => {
        const mid = $('selectCalcManifold').value;
        if (mid) {
          state.activeManifoldId = mid;
          state.manifolds.forEach((m) => {
            m.onCar = m.id === mid;
          });
          ui.selectedFleetManifoldId = mid;
          saveState();
          renderManifoldFleet();
        }
      });
    }
    if ($('selectCalcExhaust')) {
      $('selectCalcExhaust').addEventListener('change', () => {
        const xid = $('selectCalcExhaust').value;
        if (xid) {
          state.activeExhaustId = xid;
          state.exhausts.forEach((x) => {
            x.onCar = x.id === xid;
          });
          ui.selectedFleetExhaustId = xid;
          saveState();
          renderExhaustFleet();
        }
      });
    }

    // Tab 4 (Carbies, Inlet Manifolds & Exhausts) unified selector + modal controls
    if ($('selectFleetCarby')) {
      $('selectFleetCarby').addEventListener('change', () => {
        ui.selectedFleetCarbyId = $('selectFleetCarby').value;
        renderCarbyFleet();
      });
    }
    if ($('btnAddNewCarby')) {
      $('btnAddNewCarby').addEventListener('click', () => {
        openEditCarbyModal('__NEW__');
      });
    }

    if ($('selectFleetManifold')) {
      $('selectFleetManifold').addEventListener('change', () => {
        ui.selectedFleetManifoldId = $('selectFleetManifold').value;
        renderManifoldFleet();
      });
    }
    if ($('btnAddManifold')) {
      $('btnAddManifold').addEventListener('click', () => {
        openEditManifoldModal('__NEW__');
      });
    }

    if ($('selectFleetExhaust')) {
      $('selectFleetExhaust').addEventListener('change', () => {
        ui.selectedFleetExhaustId = $('selectFleetExhaust').value;
        renderExhaustFleet();
      });
    }
    if ($('btnAddExhaust')) {
      $('btnAddExhaust').addEventListener('click', () => {
        openEditExhaustModal('__NEW__');
      });
    }

    // Tab 2 (Fuel & Wt) and Tab 3 (Tyres) unified session save, Complete Session & Tyre Stock buttons
    if ($('btnSaveFuelWeightSession')) {
      $('btnSaveFuelWeightSession').addEventListener('click', saveFuelAndWeightToSession);
    }
    if ($('btnCompleteSessionFromFuel')) {
      $('btnCompleteSessionFromFuel').addEventListener('click', openPostRaceAfrModal);
    }
    if ($('btnSaveTyresSession')) {
      $('btnSaveTyresSession').addEventListener('click', saveTyresToSession);
    }
    if ($('btnCompleteSessionFromTyres')) {
      $('btnCompleteSessionFromTyres').addEventListener('click', openPostRaceAfrModal);
    }
    if ($('btnClearAllColdPsi')) {
      $('btnClearAllColdPsi').addEventListener('click', toggleClearOrRestoreColdPsi);
    }
    if ($('btnUnmountAllTyres')) {
      $('btnUnmountAllTyres').addEventListener('click', unmountAllTyres);
    }
    if ($('btnCrossSwapTyresX')) {
      $('btnCrossSwapTyresX').addEventListener('click', () => {
        crossSwapMountedTyresX();
        renderTyrePoolModal();
      });
    }
    if ($('btnRotateClockwiseTyres')) {
      $('btnRotateClockwiseTyres').addEventListener('click', () => {
        rotateMountedTyresClockwise();
        renderTyrePoolModal();
      });
    }
    if ($('btnAddNewTyreToPool')) {
      $('btnAddNewTyreToPool').addEventListener('click', addNewTyreToPool);
    }
    if ($('btnToggleAddTyreForm')) {
      $('btnToggleAddTyreForm').addEventListener('click', () => {
        const panel = $('addTyreInlinePanel');
        const btn = $('btnToggleAddTyreForm');
        if (!panel || !btn) return;
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        btn.textContent = isHidden ? '− Hide Add Tyre' : '+ Add New Tyre';
        if (isHidden) {
          if ($('newTyreDate') && !$('newTyreDate').value) {
            $('newTyreDate').value = getLocalTodayIso();
          }
          syncNewTyreSpecUi(ui.newTyreSpec || 'buffed');
        }
      });
    }
    if ($('btnAddTyreToStock')) {
      $('btnAddTyreToStock').addEventListener('click', addInlineTyreToStock);
    }
    if ($('btnExportTyreStockCsv')) {
      $('btnExportTyreStockCsv').addEventListener('click', exportTyreStockCsv);
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

    // Baseline, Post-Race Completion & Fleet modals
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
    [
      'modalPostFuelInL',
      'modalPostFuelOutL',
      'modalPostRacedLaps',
      'modalPostHotPsi_FL',
      'modalPostHotPsi_FR',
      'modalPostHotPsi_RL',
      'modalPostHotPsi_RR'
    ].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener('input', syncModalPostFuelAndTyresPreview);
        el.addEventListener('change', syncModalPostFuelAndTyresPreview);
      }
    });

    $('btnOpenEditBaseline').addEventListener('click', openEditBaselineModal);
    $('btnSaveEditBaseline').addEventListener('click', saveEditBaselineModal);
    $('btnSaveCarbySpec').addEventListener('click', saveEditCarbyModal);
    if ($('btnSaveManifoldModal')) {
      $('btnSaveManifoldModal').addEventListener('click', saveEditManifoldModal);
    }
    if ($('btnSaveExhaustModal')) {
      $('btnSaveExhaustModal').addEventListener('click', saveEditExhaustModal);
    }

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

    // Session Log search & toolbar
    if ($('searchLogTrack')) {
      $('searchLogTrack').addEventListener('change', (e) => {
        ui.logSearchTrack = e.target.value || 'ALL';
        renderSessionLog();
      });
    }
    if ($('searchLogYear')) {
      $('searchLogYear').addEventListener('change', (e) => {
        ui.logSearchYear = e.target.value || 'ALL';
        renderSessionLog();
      });
    }
    if ($('searchLogQuery')) {
      const handleLogQueryInput = (e) => {
        ui.logSearchQuery = e.target.value || '';
        if ($('btnClearLogQuery')) {
          $('btnClearLogQuery').hidden = ui.logSearchQuery.length === 0;
        }
        renderSessionLog();
      };
      $('searchLogQuery').addEventListener('input', handleLogQueryInput);
      $('searchLogQuery').addEventListener('search', handleLogQueryInput);
    }
    if ($('btnClearLogQuery')) {
      $('btnClearLogQuery').addEventListener('click', () => {
        ui.logSearchQuery = '';
        const qInp = $('searchLogQuery');
        if (qInp) {
          qInp.value = '';
          qInp.focus();
        }
        $('btnClearLogQuery').hidden = true;
        renderSessionLog();
      });
    }
    $('btnExportSessionsCsv').addEventListener('click', exportSessionsCsv);
    $('btnBackupJson').addEventListener('click', backupJsonState);
    $('inputRestoreJson').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        restoreJsonState(e.target.files[0]);
        e.target.value = '';
      }
    });
    $('btnResetDemoData').addEventListener('click', () => {
      const defaultEvents = createDefaultEvents();
      state = {
        eventArchitectureV1: true,
        activeEventId: null,
        activeSessionId: null,
        events: defaultEvents,
        baseline: createDefaultBaseline(),
        awaitingPostRaceId: null,
        jets: createDefaultJets(),
        carbies: createDefaultCarbies(),
        manifolds: createDefaultManifolds(),
        exhausts: createDefaultExhausts(),
        activeManifoldId: 'Macca',
        activeExhaustId: 'Macca',
        sessions: flattenEventsToSessions(defaultEvents),
        dynoPulls: createDefaultDynoPulls(),
        chassis: createDefaultChassisState(),
        tyrePool: createDefaultTyrePool()
      };
      ui.weatherOnly = false;
      ui.logSearchTrack = 'ALL';
      ui.logSearchYear = 'ALL';
      ui.logSearchQuery = '';
      ui.expandedEventIds = new Set(['evt_calder_nov26']);
      if ($('searchLogQuery')) $('searchLogQuery').value = '';
      if ($('btnClearLogQuery')) $('btnClearLogQuery').hidden = true;
      if ($('selectCalcCarby')) {
        $('selectCalcCarby').value = state.baseline.carbyId;
      }
      saveState();
      syncSessionSelectFromBaseline();
      hydrateFuelAndTyreInputs();
      renderAll();
      showToast('Restored Calder Park & Winton Seed Events');
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
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js', { updateViaCache: 'none' })
          .then((reg) => {
            reg.update().catch(() => {});
          })
          .catch((err) => {
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
