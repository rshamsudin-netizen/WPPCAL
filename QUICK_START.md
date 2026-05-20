# Cost Dashboard — Quick Start Checklist

## ✅ What's Built

- ✅ **Data Collector** (`scripts/collect-costs.py`) — Fetches Azure & ElevenLabs costs
- ✅ **Dashboard UI** (`app/dashboard/page.tsx`) — Real-time display with auto-refresh
- ✅ **GitHub Actions** (`.github/workflows/update-costs.yml`) — Hourly updates
- ✅ **Data File** (`public/costs-data.json`) — Live JSON endpoint

## 🚀 Next Steps (5 min setup)

### 1️⃣ Create Azure Service Principal
```bash
az login
az ad sp create-for-rbac \
  --name "github-cost-dashboard" \
  --role "Cost Management Reader" \
  --scopes "/subscriptions/{YOUR_SUBSCRIPTION_ID}"
```

You'll get output like:
```json
{
  "clientId": "xxxx-xxxx-xxxx",
  "tenantId": "yyyy-yyyy-yyyy",
  "subscriptionId": "zzzz-zzzz-zzzz"
}
```

Save these!

### 2️⃣ Add GitHub Secrets
Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | From step 1: clientId |
| `AZURE_TENANT_ID` | From step 1: tenantId |
| `AZURE_SUBSCRIPTION_ID` | From step 1: subscriptionId |
| `XI_API_KEY` | Your ElevenLabs API key |
| `SLACK_WEBHOOK_URL` | (Optional) Slack notification |

### 3️⃣ Enable GitHub Pages
1. Go to **Settings → Pages**
2. Select **Source: GitHub Actions**
3. (Optional) Add custom domain: `costs.swordhealth.dev`

### 4️⃣ Push & Deploy
```bash
git add .
git commit -m "Add cost dashboard"
git push origin main
```

### 5️⃣ Test It
1. Go to **Actions** tab → **update-costs** → **Run workflow**
2. Wait for it to complete (green checkmark)
3. Visit dashboard: `http://localhost:3000/dashboard` (locally) or live URL

**Done! 🎉** Dashboard updates every hour automatically.

---

## 📊 Dashboard Features

**Azure Card**
- MTD total + last month comparison
- Daily average & EOM forecast
- Top 8 resource groups chart
- Spike detection (>30% vs last month)

**ElevenLabs Card**
- Usage % with donut chart
- Character burn rate
- Projected end-of-month
- Voice slot inventory
- Limit warnings

## 🔍 Check Status

**Local test:**
```bash
export XI_API_KEY="your-key"
npm run collect-costs
```

**Live dashboard:**
- GitHub Pages URL: `https://{username}.github.io/dashboard`
- Check JSON: `https://{username}.github.io/costs-data.json`

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| Workflow fails | Check GitHub Actions logs; verify all 4 secrets are set |
| Dashboard shows "Loading..." | Check browser dev console; verify `/costs-data.json` is valid |
| No data in JSON | Trigger workflow manually from Actions tab |
| Azure auth error | Verify service principal has "Cost Management Reader" role |

See **COSTS_DASHBOARD_SETUP.md** for detailed troubleshooting.

---

## 📚 Full Docs

- **Setup**: [COSTS_DASHBOARD_SETUP.md](COSTS_DASHBOARD_SETUP.md)
- **Architecture**: [DASHBOARD_ARCHITECTURE.md](DASHBOARD_ARCHITECTURE.md)

**Need help?** Run locally first: `npm run dev` → http://localhost:3000/dashboard
