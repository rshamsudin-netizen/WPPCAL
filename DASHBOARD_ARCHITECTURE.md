# Cost Dashboard Architecture

## Project Structure

```
.
├── .github/workflows/
│   └── update-costs.yml              # Hourly data collection + GitHub Pages deploy
├── scripts/
│   └── collect-costs.py              # Data fetcher (Azure Cost Management API + ElevenLabs API)
├── app/
│   └── dashboard/
│       └── page.tsx                  # React dashboard component
├── public/
│   └── costs-data.json               # Live data (auto-updated by workflow)
├── COSTS_DASHBOARD_SETUP.md          # Quick start guide
└── DASHBOARD_ARCHITECTURE.md         # This file
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions (Hourly)                   │
│  Runs: scripts/collect-costs.py                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ├─► Azure Cost Management API
                  │   (via az rest - Cost Management Reader role)
                  │   → Resource groups, MTD costs, historical
                  │
                  └─► ElevenLabs API
                      (via curl - $XI_API_KEY)
                      → Character usage, burn rate, voice slots
                  │
                  └─► Writes → public/costs-data.json
                      │
                      └─► GitHub Pages Deploy
                          │
                          └─► Browser fetches → Live Dashboard
                              (app/dashboard/page.tsx)
                              │
                              └─► Auto-refresh every 5 min
```

## Components

### 1. Data Collector (`scripts/collect-costs.py`)

**Runs via GitHub Actions on schedule (hourly)**

**Azure Data**
- Fetches MTD spend grouped by Resource Group (top 8)
- Fetches last month's full spend for comparison
- Calculates:
  - Daily average = MTD total / days into month
  - EOM forecast = MTD + (daily avg × remaining days)
  - Spike detection = MTD vs last month (>30% = alert)
- Output: JSON with costs, analysis, spike flags

**ElevenLabs Data**
- Fetches subscription status (tier, usage, limits)
- Calculates:
  - % consumed = (chars_used / char_limit) × 100
  - Burn rate = chars_used / days_elapsed
  - Days to exhaustion = remaining_chars / burn_rate
  - Will exceed = projected_end > limit
- Output: JSON with usage, burn rate, voice slots, alerts

### 2. Dashboard (`app/dashboard/page.tsx`)

**Client-side React component**

**Azure Card**
- Header: Service name + MTD total (scaled by forecast)
- Stats Row: 3 KPIs (last month | daily avg | EOM forecast)
  - Color-coded: Green <10%, Yellow 10-30%, Red >30%
- Bar Chart: Top 8 resource groups (horizontal bars)
- Analysis Box: Spike detection + trend summary

**ElevenLabs Card**
- Header: Plan name + % used (color-coded)
- Stats Row: 3 KPIs (plan tier | burn rate/day | EOM projection)
  - Color-coded: Green <50%, Yellow 50-80%, Red >80%
- Donut Chart: % in center + 2 progress bars
  - Bar 1: Characters consumed (purple)
  - Bar 2: Days into billing cycle (pink)
- Voice Slots: Standard & Professional inventory
- Analysis Box: Will exceed limit warning or confirmation

**Auto-Refresh**
- Fetches `/costs-data.json` every 5 minutes
- No page reload needed
- Graceful loading + error states

### 3. GitHub Actions Workflow (`.github/workflows/update-costs.yml`)

**Triggers**
- Schedule: Hourly at top of hour (cron: `0 * * * *`)
- Manual: workflow_dispatch (run anytime from Actions tab)

**Steps**
1. Checkout code
2. Authenticate to Azure (via Service Principal)
3. Setup Python 3.11
4. Run `collect-costs.py`
5. Commit + push `costs-data.json` (if changed)
6. Deploy `public/` to GitHub Pages
7. (Optional) Slack notification on failure

## Required Secrets

```
AZURE_CLIENT_ID         Service principal client ID
AZURE_TENANT_ID         Azure tenant ID
AZURE_SUBSCRIPTION_ID   Subscription ID
XI_API_KEY              ElevenLabs API key
SLACK_WEBHOOK_URL       (Optional) Slack webhook for alerts
```

## Local Development

### Test Data Collection
```bash
# Setup
az login
export XI_API_KEY="your-key"

# Run
npm run collect-costs

# Output
✅ Data written to public/costs-data.json
```

### Run Dashboard
```bash
npm run dev
# Visit http://localhost:3000/dashboard
```

### Watch Mode (auto-collect every file change)
```bash
npm run collect-costs:watch
```

## Deployment

### Initial Setup
1. Push code to GitHub
2. Add secrets (Settings → Secrets and variables → Actions)
3. Enable GitHub Pages (Settings → Pages → Source: GitHub Actions)
4. Trigger workflow (Actions tab → update-costs → Run workflow)

### Verification
- ✅ Workflow runs: Actions tab shows green checkmark
- ✅ Data file updates: Check `public/costs-data.json` commit
- ✅ Dashboard live: Visit `https://username.github.io/dashboard`
- ✅ Auto-refresh: Check browser console for fetch calls every 5 min

## Customization

### Change Update Frequency
Edit `.github/workflows/update-costs.yml`:
```yaml
- cron: '*/15 * * * *'  # Every 15 minutes
- cron: '0 9 * * *'     # Daily at 9 AM UTC
```

### Change Resource Groups Count
Edit `scripts/collect-costs.py`:
```python
'resources': sorted(resources, key=lambda x: x['current'], reverse=True)[:12],
#                                                                        ^ Change 8 to 12
```

### Add More Services
Extend `scripts/collect-costs.py` main():
```python
# Add new data source
def get_datadog_usage():
    # Fetch and parse Datadog API
    return {...}

# In main()
output = {
    'timestamp': ...,
    'azure': azure,
    'elevenlabs': elevenlabs,
    'datadog': get_datadog_usage()  # ← Add here
}
```

Then update `app/dashboard/page.tsx` to display the new card.

## Performance

**Data Freshness**: 1 hour (configurable via cron)
**Dashboard Refresh**: 5 minutes from local JSON
**File Size**: ~2-5 KB (very lightweight)
**Page Load**: <1s (static next.js + JSON fetch)
**GitHub Pages**: Free + unlimited bandwidth

## Security

- **Azure**: Service Principal with "Cost Management Reader" role (read-only)
- **ElevenLabs**: API key in GitHub Secrets (not exposed in logs)
- **Data**: Public JSON file (cost/usage data only, no secrets)
- **Workflow**: Signed commits with GitHub Actions identity

## Troubleshooting

### Dashboard shows "Loading..."
- Check browser console for fetch errors
- Verify `public/costs-data.json` exists and is valid JSON
- Check GitHub Pages deployment (Settings → Pages)

### Workflow fails
- Check Azure auth (verify service principal has "Cost Management Reader")
- Verify all secrets are set
- Check GitHub Actions logs for error details

### No data update for hours
- Check workflow schedule (Actions tab → update-costs)
- Trigger manually: Actions → update-costs → Run workflow
- Check commit history: verify JSON commits appear

---

**Questions?** See [COSTS_DASHBOARD_SETUP.md](COSTS_DASHBOARD_SETUP.md) for setup instructions.
