#!/usr/bin/env python3
"""
Collect Azure and ElevenLabs cost data for the dashboard.
Run via GitHub Actions on schedule, writes to public/costs-data.json
"""
import json
import subprocess
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

def run_command(cmd, shell=False):
    """Run shell command and return parsed JSON output."""
    try:
        result = subprocess.run(cmd if shell else cmd.split(),
                              shell=shell, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Error: {result.stderr}", file=sys.stderr)
            return None
        return result.stdout
    except Exception as e:
        print(f"Command failed: {e}", file=sys.stderr)
        return None

def get_azure_costs():
    """Fetch Azure spend by resource group (MTD and last month)."""
    billing_scope = "providers/Microsoft.Billing/billingAccounts/ec2de4d2-d81a-58a4-9481-f1a4127485bd:cbc234b0-fa88-4650-9e38-d00e166097cc_2019-05-31"

    # MTD costs by resource group
    mtd_cmd = f"""az rest --method POST \\
      --url "https://management.azure.com/{billing_scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \\
      --body '{{
        "type": "ActualCost",
        "timeframe": "MonthToDate",
        "dataset": {{
          "granularity": "None",
          "aggregation": {{"totalCost": {{"name": "Cost", "function": "Sum"}}}},
          "grouping": [{{"type": "Dimension", "name": "ResourceGroupName"}}],
          "sorting": [{{"name": "Cost", "direction": "Descending"}}]
        }}
      }}'"""

    # Last month full
    last_month_cmd = f"""az rest --method POST \\
      --url "https://management.azure.com/{billing_scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \\
      --body '{{
        "type": "ActualCost",
        "timeframe": "LastMonth",
        "dataset": {{
          "granularity": "None",
          "aggregation": {{"totalCost": {{"name": "Cost", "function": "Sum"}}}}
        }}
      }}'"""

    mtd_output = run_command(mtd_cmd, shell=True)
    last_month_output = run_command(last_month_cmd, shell=True)

    mtd_data = json.loads(mtd_output) if mtd_output else {}
    last_month_data = json.loads(last_month_output) if last_month_output else {}

    # Parse MTD by resource group
    resources = []
    mtd_total = 0
    try:
        for row in mtd_data.get('properties', {}).get('rows', []):
            cost = row[0]
            name = row[1] if len(row) > 1 else 'Unknown'
            resources.append({'name': name, 'current': round(cost, 2)})
            mtd_total += cost
    except (KeyError, TypeError):
        pass

    # Get last month total
    last_month_total = 0
    try:
        for row in last_month_data.get('properties', {}).get('rows', []):
            last_month_total += row[0]
    except (KeyError, TypeError):
        pass

    # Fetch historical for comparison (approximate same-day window)
    today = datetime.now()
    days_into_month = today.day
    start_of_month = today.replace(day=1)
    last_month_date = start_of_month - timedelta(days=1)
    last_month_range_start = last_month_date.replace(day=1)
    last_month_range_end = last_month_date.replace(day=min(days_into_month, 28))

    # Calculate daily average and forecast
    daily_avg = mtd_total / max(days_into_month, 1)
    days_in_month = 30  # approximate
    eom_forecast = mtd_total + (daily_avg * (days_in_month - days_into_month))

    # Spike detection
    spike_pct = ((mtd_total - last_month_total) / last_month_total * 100) if last_month_total > 0 else 0
    spike_detected = spike_pct > 30

    return {
        'serviceName': 'Azure',
        'mtdTotal': round(mtd_total, 2),
        'lastMonth': round(last_month_total, 2),
        'dailyAvg': round(daily_avg, 2),
        'eomForecast': round(eom_forecast, 2),
        'resources': sorted(resources, key=lambda x: x['current'], reverse=True)[:8],
        'spikeDetected': spike_detected,
        'spikePct': round(spike_pct, 1),
        'analysis': f"{'⚠️ Spike detected: ' if spike_detected else ''}Spending is ${mtd_total:,.0f} MTD, trending to ${eom_forecast:,.0f} by month-end."
    }

def get_elevenlabs_usage():
    """Fetch ElevenLabs subscription and usage data."""
    api_key = os.getenv('XI_API_KEY')
    if not api_key:
        print("Error: XI_API_KEY not set", file=sys.stderr)
        return None

    cmd = f'curl -s "https://api.elevenlabs.io/v1/user/subscription" -H "xi-api-key: {api_key}"'
    output = run_command(cmd, shell=True)

    if not output:
        return None

    data = json.loads(output)

    tier = data.get('tier', 'unknown').replace('_', ' ').title()
    used = data.get('character_count', 0)
    limit = data.get('character_limit', 0)
    pct = (used / limit * 100) if limit else 0
    remaining = limit - used

    # Parse reset time
    reset_ts = data.get('next_character_count_reset_unix', 0)
    reset_dt = datetime.fromtimestamp(reset_ts, tz=timezone.utc) if reset_ts else None

    now = datetime.now(tz=timezone.utc)
    days_remaining = max((reset_dt - now).days if reset_dt else 30, 1)
    days_elapsed = max(30 - days_remaining, 1)

    # Burn rate
    burn_rate = used / days_elapsed if days_elapsed > 0 else 0
    projected = burn_rate * days_remaining
    will_exceed = projected > remaining
    days_to_zero = int(remaining / burn_rate) if burn_rate > 0 else float('inf')

    # Voice slots
    v_used = data.get('voice_count', 0)
    v_limit = data.get('voice_limit', 0)
    pv_used = data.get('professional_voice_count', 0)
    pv_limit = data.get('professional_voice_limit', 0)

    return {
        'planName': tier,
        'status': data.get('status', 'unknown').title(),
        'percentUsed': round(pct, 1),
        'charsUsed': used,
        'charLimit': limit,
        'charsRemaining': remaining,
        'burnRatePerDay': round(burn_rate, 0),
        'projectedEOM': round(projected, 0),
        'willExceed': will_exceed,
        'daysToReset': days_remaining,
        'daysToExhaustion': int(days_to_zero) if days_to_zero != float('inf') else None,
        'voiceSlots': {
            'standard': {'used': v_used, 'limit': v_limit},
            'professional': {'used': pv_used, 'limit': pv_limit}
        },
        'analysis': f"{'⚠️ Will exceed limit in ~' + str(days_to_zero) + ' days' if will_exceed else '✅ On track to stay within limit'}"
    }

def main():
    """Collect all data and write to public/costs-data.json"""
    azure = get_azure_costs()
    elevenlabs = get_elevenlabs_usage()

    if not azure or not elevenlabs:
        print("Error: Failed to fetch cost data", file=sys.stderr)
        sys.exit(1)

    output = {
        'timestamp': datetime.now(tz=timezone.utc).isoformat(),
        'azure': azure,
        'elevenlabs': elevenlabs
    }

    # Write to public folder
    output_path = Path('public/costs-data.json')
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"✅ Data written to {output_path}")
    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
