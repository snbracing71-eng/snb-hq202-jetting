# SNB Racing — HQ 202 Jetting & AFR (v0.3 Dark Edition)

Mobile-first, 100% offline-capable Progressive Web App (PWA) for pit-lane Stromberg BXUV-3 carburettor jetting, wideband AFR session tracking, dyno analysis, and M1 jet kit management on a **Group 3H HQ Holden 202** race car.

![SNB Racing](./snb-logo.jpg)

## Key Capabilities

- **Zero External Dependencies**: Built purely with vanilla HTML5, CSS3, and ES6 JavaScript (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`) for reliable pit-lane operation with zero cell reception.
- **OLED Pit-Lane Dark UI**: High-contrast `#090B0E` / `#11151C` / `#171C26` motorsport palette with minimum `48px` touch targets and dedicated `−` / `+` steppers on every numeric input.
- **Venturi Fourth-Root Physics Engine (No Double Counting)**:
  - **Kestrel RAD % Mode**: $\rho_{\text{ratio}} = \text{RAD}_{\text{new}} / \text{RAD}_{\text{base}}$
  - **Raw Weather Mode**: Moist-air & dry-$\text{O}_2$ density from Ambient Temp ($\text{K}$), Station Pressure ($\text{hPa}$ or $\text{psi}$), and Relative Humidity ($\text{\%}$) via Arden Buck's saturation vapor pressure equation.
  - **Ideal Orifice**: $\text{Ideal\_Jet\_mm} = \text{Base\_Jet\_mm} \cdot \rho_{\text{ratio}}^{0.25} \cdot \sqrt{\text{Logged\_AFR} / \text{Target\_AFR}} \cdot (\text{SG}_{\text{base}} / \text{SG}_{\text{new}})^{0.25}$
  - **Predicted WOT AFR**: $\text{Predicted\_AFR} = \text{Logged\_AFR} \cdot \sqrt{\rho_{\text{ratio}}} \cdot (\text{Base\_Jet\_mm} / \text{Chosen\_Jet\_mm})^2 \cdot \sqrt{\text{SG}_{\text{base}} / \text{SG}_{\text{new}}}$
  - **Siamesed Cast Log Manifold Protection**: Computes `#1 & #6` end-cylinder lean estimate ($\text{Predicted\_AFR} + 0.27$) and triggers detonation/head-gasket alerts when Total Timing $> 34.0^\circ$ with $\text{Predicted\_AFR} > 12.95$, or when `#1/#6` estimated AFR $\ge 13.25$.
- **Four-Tab Pit Workflow**:
  1. **Pit-Lane Calculator**: Locked Baseline Bar (`Race 1`, `1 DME`, `Jet #77 / 2.000 mm`, `94.3% RAD`, `12.50 WOT AFR`, `33.0°`, `5.0 psi` at block pump boss) + `Step 1 -> Next -> Confirm` loop.
  2. **Session Log**: Persistent `localStorage` notebook pre-seeded with 7 Calder Park sessions (`Practice 1–3`, `Qualifying`, `Races 1–3` across `1 DME` and `SNB Carby`), inline AFR editing (`3500–5000 RPM` + `WOT`), per-row baseline lock, CSV export, and JSON backup/restore.
  3. **Dyno Lab**: Dual `<canvas>` RWHP/Torque + `3500–5500 RPM` wideband AFR chart with `12.75–12.95` sweet-spot shading, interactive RPM scrubber, manual pull entry, and CSV overlay import.
  4. **40mm Carby Fleet & M1 Jet Kit**: Group 3H late-base `40.00 mm` Stromberg BXUV-3 fleet (`1 DME`, `2 DME`, `SNB Carby` — `75 mm` studs, $\le 30.94\text{ mm}$ venturi, $\le 40.00\text{ mm}$ exit port, `15.0 mm` spill height, HQRA heat shield between $2\times$ std 40mm gaskets) plus `#68–#80` M1 (`.001"`) jets & `1.950 mm` / `2.000 mm` custom drills with live `inch <-> mm <-> mm²` conversion.

## Installing on Trackside Phone

- **iOS (Safari)**: Open the hosted GitHub Pages URL → tap **Share** → **Add to Home Screen**.
- **Android (Chrome)**: Open the hosted GitHub Pages URL → tap **Install** in the header or browser menu → **Install App**.
