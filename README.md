# LifePlanner — Australian Financial, Education & Career Planner

**[Live App (GitHub Pages)](https://pierrer22.github.io/lifeplan/)** · **[Source Repository](https://github.com/pierrer22/lifeplan)**

LifePlanner is an interactive React + TypeScript financial, housing, superannuation, HECS-HELP, novated lease, education ROI, and career progression planner built for Australian residents using **FY2026-27** (default) and **FY2025-26** ATO & state rules.

> **Disclaimer:** LifePlanner provides educational estimates and scenario modelling only and does not constitute personal financial, tax, or legal advice.

---

## Features

- **Overview & Action Roadmap** (`OverviewDashboard`, `ActionRoadmapView`):
  - **Goal Readiness Score (0–100)** across Housing, Cashflow, Retirement, and HECS trajectories.
  - **6 KPI summary cards**, contextual tax/MLS/FHSSS/housing alerts, monthly cashflow allocation bar chart, and multi-year net worth projection area chart.
  - **Actionable Roadmap** grouped by horizon (`Immediate`, `1-12 Months`, `1-3 Years`, `3+ Years`) and category, with estimated annual dollar impact and deep links to each calculator.
- **House Deposit & Required Income** (`HouseDepositCalc`):
  - Compares **5% HGS ($0 LMI)**, **10% + LMI**, and **20% ($0 LMI)** deposit strategies across all 8 Australian states and territories.
  - Models **2026 state stamp duty & First Home Buyer (FHB) concessions/grants** (including ACT HBCS $0 duty with no price cap from 1 July 2026, NSW FHBAS $0 up to $800k / tapered to $1M, VIC, QLD, WA, SA, TAS, NT) and regional/metro HGS price caps.
  - Includes **APRA +3% serviceability buffer** borrowing power with HECS debt impact, a **Required Gross Income solver**, and a deposit accumulation timeline incorporating FHSSS.
- **Mortgage Loan Approval** (`MortgageApprovalCalc`):
  - Models Australian bank underwriting across 4 gates: **APRA +3% serviceability buffer**, **LVR & HGS/LMI**, **Debt-to-Income (DTI)**, and **Employment & Credit Score**.
  - Applies **HEM living expense floors** (single/couple + dependents), **3.8%/month credit card limit shading**, 80% bonus shading, and exact borrowing power lost to HECS-HELP and credit cards.
  - Includes an **Interest Rate Stress Test** (`-0.5%` to `+3.0%`) and prioritized steps to strengthen loan approval.
- **Rent vs Save Optimizer** (`RentBudgetCalc`):
  - Calculates monthly surplus, savings rate, and **30% housing stress** status against household net income.
  - Models a weekly rent sensitivity curve ($250–$950/wk), maximum sustainable rent to stay on schedule, and capital-city rent benchmarks (Sydney, Canberra, Melbourne, Brisbane, Perth, Adelaide).
- **Rent vs Buy (Mortgage)** (`RentVsBuyCalc`):
  - Compares renting + investing against buying with a mortgage in both **Nominal** and **Inflation-Adjusted Real** dollars over 3–30 years.
  - Models rent increases, mortgage interest vs principal amortisation, capital growth, inflation, strata, council rates, water rates, home & renters insurance, maintenance, stamp duty/LMI, selling costs, and cashflow-parity portfolio returns.
- **Super & FHSSS** (`SuperFhsssCalc`):
  - Tracks employer SG (12.0% standard or custom, e.g. 15.4% APS) + salary sacrifice against the **$32,500** FY2026-27 ($30,000 FY2025-26) concessional cap and carry-forward unused cap eligibility (`TSB < $500,000`).
  - Evaluates bracket-aware income tax savings vs 15% contributions tax, **Division 293** ($250,000 threshold), RESC knock-on impact on HECS/MLS Repayment Income, **FHSSS** ($15,000/yr, $50,000 lifetime, deemed SIC ~7.1%, marginal + 2% - 30% offset exit tax) vs HISA, and super balance projected to age 60.
- **HECS-HELP Marginal Repayments** (`HecsCalc`):
  - Implements the **marginal HECS-HELP repayment brackets** for FY2026-27 and FY2025-26 on Repayment Income (taxable income + RFBA + reportable super + net investment losses).
  - Models **future Masters / study debt accumulation** (units per trimester/semester, 2026 CSP bands 1–4 or full-fee per EFTSL, SSAF via SA-HELP, **Student Start-up Loan (SSL — $1,349/period, up to 2/yr)**, and the ATO 11-month 1 June indexation exemption for same-year fees) with a year-by-year schedule and payoff trajectory comparing minimum compulsory repayments against voluntary extra repayments.
- **Novated Lease (EV / RFBA)** (`NovatedLeaseCalc`):
  - Compares **EV FBT-exempt**, **ICE/Hybrid ECM (20% post-tax)**, **Cash**, and **Car Loan** over 1–5 year lease terms using ATO statutory residuals (`65.63%` at 1 yr down to `28.13%` at 5 yrs).
  - Caps vehicle GST credit at **$69,674** ($6,334 max credit) + GST-free running costs.
  - Computes **RFBA** (`baseValue × 0.20 × 1.8868`) even for FBT-exempt EVs and calculates the exact knock-on extra HECS-HELP and Medicare Levy Surcharge costs, plus the **1 April 2027 $75,000 EV FBT transition** notice.
- **Career & Study ROI** (`CareerStudyCalc`):
  - Compares **CSP vs Full-Fee** tuition using **2026 CSP Student Contribution Bands 1–4 + SSAF** and **Full-Time / Part-Time / None** study modes across qualifications and Australian industry fields (including Austudy baseline modelling and a **Work Full-Time During Part-Time Study** toggle preserving 100% pay + annual raises).
  - Charts 10-year cumulative earnings, break-even years, Australian salary progression bands vs goal-required income, and a **Sydney vs Canberra** relocation disposable-income comparison.
- **Profile Persistence, Presets & Dark Mode** (`ProfileSidebar`, `PlannerContext`):
  - 4 pre-built Australian profiles (`sydney-renter`, `postgrad-student`, `mid-career-ev`, `public-sector-couple`), `localStorage` persistence, and JSON profile export/import.
  - 1-click **Dark Mode** header toggle with `prefers-color-scheme` auto-detection, persistent theme preference, and dark-adaptive Recharts visualizations.

---

## Tax & Policy Rules Reference

All constants are centralized in [`src/data/auConstants.ts`](src/data/auConstants.ts):

| Area | FY2026-27 (Default) | FY2025-26 |
| --- | --- | --- |
| **Resident Tax Brackets** *(excl. 2% Medicare Levy)* | $0–$18,200: 0%<br>$18,201–$45,000: 15%<br>$45,001–$135,000: 30%<br>$135,001–$190,000: 37%<br>$190,001+: 45% | $0–$18,200: 0%<br>$18,201–$45,000: 16%<br>$45,001–$135,000: 30%<br>$135,001–$190,000: 37%<br>$190,001+: 45% |
| **Medicare Levy** | 2% standard (low-income singles nil ≤ $27,222; 10% shade-in $27,223–$34,027) | Same |
| **MLS Tiers (Singles)** | ≤ $105k (0%), $105k–$123k (1.0%), $123k–$164k (1.25%), $164k+ (1.5%) | ≤ $101k (0%), $101k–$118k (1.0%), $118k–$158k (1.25%), $158k+ (1.5%) |
| **MLS Tiers (Families)** | 2× single thresholds (+$1,500 per dependent child after the first) | 2× single thresholds (+$1,500 per dependent child after the first) |
| **HECS-HELP Marginal** | $0–$69,528: Nil<br>$69,529–$129,717: 15c/$ over $69,528<br>$129,718–$186,050: $9,028 + 17c/$ over $129,717<br>$186,051+: 10% of total RI | $0–$67,000: Nil<br>$67,001–$125,000: 15c/$ over $67,000<br>$125,001–$179,285: $8,700 + 17c/$ over $125,000<br>$179,286+: 10% of total RI |
| **Super SG & Concessional Cap** | 12.0% SG · $32,500 cap · Div 293 at $250,000 | 12.0% SG · $30,000 cap · Div 293 at $250,000 |
| **Fuel-Efficient / Standard LCT** | $91,661 / $80,809 | $91,387 / $80,567 |

---

## Project Structure

```text
lifeplan/
├── .github/workflows/deploy.yml   # GitHub Actions -> GitHub Pages CI/CD
├── index.html
├── LICENSE                        # MIT License
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts / vitest.config.ts
└── src/
    ├── App.tsx
    ├── main.tsx / index.css
    ├── types/planner.ts             # Shared domain & engine contract types
    ├── data/
    │   ├── auConstants.ts           # FY2026-27 & FY2025-26 ATO/state constants
    │   └── presets.ts               # 4 preset profiles + DEFAULT_PROFILE
    ├── context/PlannerContext.tsx   # Profile state, localStorage, JSON import/export
    ├── engine/
    │   ├── tax.ts                   # Resident tax, LITO, Medicare, MLS, Div 293
    │   ├── hecs.ts                  # Marginal HECS-HELP & multi-year payoff
    │   ├── super.ts                 # Concessional cap, carry-forward, FHSSS
    │   ├── housing.ts               # Stamp duty, FHB, deposit strategies, rent optimizer
    │   ├── mortgageApproval.ts      # APRA +3% underwriting, HEM floor, DTI & card shading
    │   ├── rentVsBuy.ts             # Rent vs mortgage comparison with full ownership costs
    │   ├── novatedLease.ts          # EV/ICE lease, GST cap, RFBA HECS/MLS knock-on
    │   ├── education.ts             # CSP vs Full-Fee ROI & Austudy modelling
    │   ├── employment.ts            # Salary ladders & Sydney vs Canberra comparison
    │   ├── roadmap.ts               # Integrated LifePlan & Goal Readiness generator
    │   ├── index.ts                 # Barrel exports
    │   └── __tests__/               # Vitest unit & integration suites
    └── components/
        ├── Layout.tsx               # Header, preset/JSON controls, 9-tab nav, footer
        ├── ProfileSidebar.tsx       # 5-section accordion profile editor
        ├── OverviewDashboard.tsx    # Readiness score, KPIs, cashflow & net worth charts
        ├── ActionRoadmapView.tsx    # Filterable action steps with deep links
        ├── SharedPrimitives.tsx     # CurrencyInput, SliderField, StatCard, SectionCard
        └── calculators/             # 8 interactive calculator views + barrel export
```

---

## Commands

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Run Vitest unit & integration tests
npm test

# Type-check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Deployment (GitHub Pages)

Pushes to `main` automatically run `npm ci`, `npm test`, and `npm run build` (with Vite `base: '/lifeplan/'` under `GITHUB_ACTIONS`) and publish `./dist` to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

---

## License

Licensed under the [MIT License](LICENSE).
