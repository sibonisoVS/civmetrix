# CivMetrix

**Civil construction site management, in a single page.**

CivMetrix is a web-based management system for civil engineering and construction sites. It brings daily site records, labour, plant & equipment, procurement, costing, and professional reporting into one place — running entirely in the browser as a single self-contained page, backed by Google Sheets. A whole site office can work from one link, with no servers to run and nothing to install.

🔗 **Live app:** https://sibonisovs.github.io/civmetrix-/CivMetrix.html

---

## Features

### Site records
- **Daily Activity Logs** — capture daily site progress, weather, sections, and remarks
- **BOQ & Measurements** — bill of quantities, measurement sheets, and progress tracking
- **IPC** — interim payment certificates

### Labour & timesheets
- **Workers Register** — site workforce, trades, and foreman teams
- **Timesheets** — weekly and monthly, with overtime handling and team-based grouping
- **Foreman's Report** — labour, material, plant, and daily-progress returns

### Plant & equipment
- **Plant Inventory** — equipment register with rate types (per hour / day / week / month), minimum hours, rainy-day minimums, and fuel data
- **Plant Usage Records** — daily plant entries with hour-meter and clock capture, idle time, breakdowns, and inclement weather
- **Fuel Disbursements** — fuel issues and variance tracking

### Plant reporting
- **Monthly Plant Return** — day-by-day return with agreed-hours/days billing
- **Cost & Production** and **Full Report** — costing across the fleet
- **Loss & Utilisation Analysis** — productive vs. billed time, minimum/standby and idle losses, and per-activity utilisation

### Procurement & stores
- Suppliers, Purchase Orders, Stores, and Sub-Contractor inventory

### Administration
- **Role-based access control** — Admin, Editor, Site Agent, Data Entry, Foreman, Stores, SHEQ, Site Admin and more
- **Multi-project** support with per-project data
- **Inter-Project Transfers** — move workers and assets between projects
- **Organization branding** — company logo and report headers applied across all documents

All reports are print-ready and export to PDF.

---

## How it's built

CivMetrix is intentionally lightweight and self-hosting-friendly:

- **Frontend:** a single self-contained HTML file — plain HTML, CSS, and JavaScript, no build step and no framework.
- **Backend:** Google Apps Script (`doGet` via JSONP for reads/small writes, `doPost` for larger payloads).
- **Database:** Google Sheets — one sheet per data collection.
- **Hosting:** GitHub Pages (free, static).

This means your data stays in your own Google account, and the whole system can be deployed for free.

---

## Deploy your own

1. **Fork or clone** this repository.
2. **Set up the backend:** open the app's **Setup** screen, copy the embedded Google Apps Script, paste it into a new [Google Apps Script](https://script.google.com) project, and deploy it as a **Web App** (execute as you, accessible to anyone with the link). Copy the deployment URL.
3. **Connect it:** paste that Web App URL into the app's Setup screen so the app knows where its Google Sheets backend lives.
4. **Publish:** enable **GitHub Pages** for the repository (Settings → Pages → deploy from branch). Your app will be served at `https://<your-username>.github.io/<repo>/CivMetrix.html`.

> **Tip:** after deploying an update, do a hard refresh (Ctrl/Cmd + Shift + R) so the browser loads the new version instead of a cached one.

---

## Usage

1. Open the live link (or your own deployment).
2. Sign in and select (or create) a project.
3. Use the tabs to capture daily records, timesheets, plant usage, and fuel.
4. Generate and print reports from the reporting screens.

---

## Roadmap

Ongoing refinement of billing edge cases, reporting, and analysis as real site usage surfaces new scenarios.

---

## License

> Choose a license that fits your intent. If CivMetrix is proprietary, you can state **"All rights reserved."** If you'd like it to be open source, [MIT](https://choosealicense.com/licenses/mit/) is a simple, permissive option.

---

## Author

Built and maintained by [@sibonisovs](https://github.com/sibonisovs).

*CivMetrix — measure the site, manage the build.*
