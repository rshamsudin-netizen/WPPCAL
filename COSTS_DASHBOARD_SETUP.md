# Cost Dashboard Setup Guide

This dashboard tracks Azure and ElevenLabs costs in real-time, updated hourly via GitHub Actions.

## What You Get

- **Azure Card**: MTD spend, last month comparison, daily average, EOM forecast
  - Top 8 resource groups comparison chart
  - Automatic spike detection (>30% vs last month)
  - Trend analysis
  
- **ElevenLabs Card**: Usage %, burn rate, projected EOD
  - Visual donut chart + dual progress bars
  - Voice slot inventory
  - Limit warnings

## Quick Setup

### 1. Initialize Data File
```bash
mkdir -p public
cat > public/costs-data.json << 'EOF'
{
  "timestamp": "2025-01-01T00:00:00+00:00",
  "azure": {
    "serviceName": "Azure",
    "mtdTotal": 0,
    "lastMonth": 0,
    "dailyAvg": 0,
    "eomForecast": 0,
    "resources": [],
    "spikeDetected": false,
    "spikePct": 0,
    "analysis": "Loading..."
  },
  "elevenlabs": {
    "planName": "Loading...",
    "status": "Unknown",
    "percentUsed": 0,
    "charsUsed": 0,
    "charLimit": 0,
    "charsRemaining": 0,
    "burnRatePerDay": 0,
    "projectedEOM": 0,
    "willExceed": false,
    "daysToReset": 0,
    "daysToExhaustion": null,
    "voiceSlots": {
      "standard": { "used": 0, "limit": 0 },
      "professional": { "used": 0, "limit": 0 }
    },
    "analysis": "Loading..."
  }
}
EOF
```

### 2. Local Testing (Optional)
Test the data collection locally:
```bash
# Ensure you're logged into Azure
az login

# Set ElevenLabs API key
export XI_API_KEY="your-api-key-here"

# Run the script
python scripts/collect-costs.py
```

### 3. GitHub Configuration

#### Required Secrets
Add these to your GitHub repository settings (Settings → Secrets and variables → Actions):

```
Azure:
  AZURE_CLIENT_ID         - Service principal client ID
  AZURE_TENANT_ID         - Azure tenant ID
  AZURE_SUBSCRIPTION_ID   - Subscription ID

ElevenLabs:
  XI_API_KEY              - Your ElevenLabs API key

Optional:
  SLACK_WEBHOOK_URL       - For failure notifications
```

**Create Azure Service Principal:**
```bash
az ad sp create-for-rbac \
  --name "github-cost-dashboard" \
  --role "Cost Management Reader" \
  --scopes "/subscriptions/{subscription-id}"
```

#### GitHub Pages Setup
1. Go to Settings → Pages
2. Set Source: "GitHub Actions"
3. (Optional) Configure custom domain: `costs.swordhealth.dev`

**To use a custom domain:**
- Update `.github/workflows/update-costs.yml` line with your domain:
  ```yaml
  cname: costs.swordhealth.dev
  ```
- Configure DNS CNAME record pointing to `username.github.io`

### 4. Deploy
```bash
# Push to main branch
git add .
git commit -m "Add cost dashboard"
git push origin main
```

The dashboard will:
- ✅ Run immediately via `workflow_dispatch`
- ⏰ Run hourly automatically
- 📊 Update `public/costs-data.json`
- 🚀 Deploy to GitHub Pages

### 5. Access
- **Local**: `npm run dev` → http://localhost:3000/dashboard
- **Live**: `https://username.github.io/dashboard` or your custom domain

## Dashboard Details

### Azure Card Colors
- **Green**: EOM forecast within 10% of last month
- **Yellow**: 10-30% increase
- **Red**: >30% increase

### ElevenLabs Card Colors
- **Green**: <50% used
- **Yellow**: 50-80% used
- **Red**: >80% used

### Auto-Refresh
Dashboard refreshes every 5 minutes from `public/costs-data.json`. No browser refresh needed.

## Troubleshooting

**Script fails locally?**
```bash
# Check Azure auth
az account show

# Check ElevenLabs access
curl https://api.elevenlabs.io/v1/user/subscription -H "xi-api-key: $XI_API_KEY"
```

**GitHub Actions fails?**
- Check workflow logs: Actions tab → update-costs → latest run
- Verify all secrets are set (Settings → Secrets → verify all 3+ are present)
- Ensure Azure service principal has "Cost Management Reader" role

**Data not updating?**
- Check GitHub Pages deployment: Settings → Pages
- Force run: Actions tab → update-costs → Run workflow → Run workflow

## Advanced

### Change Update Frequency
Edit `.github/workflows/update-costs.yml` cron schedule:
```yaml
- cron: '0 * * * *'  # Hourly (0 top of hour, every hour)
- cron: '*/15 * * * *'  # Every 15 minutes
- cron: '0 0 * * *'  # Daily at midnight UTC
```

### Add Slack Notifications on Success
```yaml
- name: Slack notification
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Cost data updated successfully"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Modify Resource Group Display
Edit `scripts/collect-costs.py`:
```python
resources.append({'name': name, 'current': round(cost, 2)})
# ...
resources.append({'name': name, 'current': round(cost, 2), 'lastMonth': round(prev_cost, 2)})
# ...
'resources': sorted(resources, key=lambda x: x['current'], reverse=True)[:8],
#                                                                           ^ Change from 8
```

---

**Questions?** Check the [GitHub Actions docs](https://docs.github.com/en/actions) or reach out to the team.
