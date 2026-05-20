'use client';

import { useEffect, useState } from 'react';

interface CostsData {
  timestamp: string;
  azure: {
    serviceName: string;
    mtdTotal: number;
    lastMonth: number;
    dailyAvg: number;
    eomForecast: number;
    resources: Array<{ name: string; current: number }>;
    spikeDetected: boolean;
    spikePct: number;
    analysis: string;
  };
  elevenlabs: {
    planName: string;
    status: string;
    percentUsed: number;
    charsUsed: number;
    charLimit: number;
    charsRemaining: number;
    burnRatePerDay: number;
    projectedEOM: number;
    willExceed: boolean;
    daysToReset: number;
    daysToExhaustion: number | null;
    voiceSlots: {
      standard: { used: number; limit: number };
      professional: { used: number; limit: number };
    };
    analysis: string;
  };
}

export default function CostsDashboard() {
  const [data, setData] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        const res = await fetch(`${base}/costs-data.json`);
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date(json.timestamp).toLocaleString());
      } catch (error) {
        console.error('Failed to fetch costs data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center h-screen">Failed to load cost data</div>;
  }

  const { azure, elevenlabs } = data;

  // Color coding for status
  const getAzureColor = (pct: number) => {
    if (pct < 40) return 'text-green-600';
    if (pct < 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getELColor = (pct: number) => {
    if (pct < 50) return 'text-green-600';
    if (pct < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getELForecastColor = (willExceed: boolean) => {
    return willExceed ? 'text-red-600' : 'text-green-600';
  };

  // Bar chart for top resources
  const maxCost = Math.max(...azure.resources.map(r => r.current), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Cost Dashboard</h1>
          <div className="text-sm text-slate-400">
            Last updated: {lastUpdated}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Azure Card */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">{azure.serviceName}</h2>
              <p className={`text-3xl font-bold mt-2 ${getAzureColor(azure.mtdTotal / 1000)}`}>
                ${azure.mtdTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-blue-200 mt-1">Month-to-Date Total</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-t border-blue-700 border-b">
              <div>
                <p className="text-blue-200 text-sm">Last Month</p>
                <p className="text-xl font-semibold text-white">
                  ${azure.lastMonth.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">Daily Avg</p>
                <p className="text-xl font-semibold text-white">
                  ${azure.dailyAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-blue-200 text-sm">EOM Forecast</p>
                <p className={`text-xl font-semibold ${
                  azure.eomForecast > azure.lastMonth * 1.3 ? 'text-red-400' :
                  azure.eomForecast > azure.lastMonth * 1.1 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  ${azure.eomForecast.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* Resource Groups Bar Chart */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-blue-200 mb-3 uppercase">Top 8 Resource Groups</h3>
              <div className="space-y-2">
                {azure.resources.map((resource, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-blue-100">{resource.name}</span>
                      <span className="text-blue-200">${resource.current.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-2 bg-blue-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                        style={{ width: `${(resource.current / maxCost) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div className={`p-3 rounded ${azure.spikeDetected ? 'bg-red-900/30 border border-red-700' : 'bg-green-900/30 border border-green-700'}`}>
              <p className={`text-sm ${azure.spikeDetected ? 'text-red-200' : 'text-green-200'}`}>
                {azure.analysis}
              </p>
            </div>
          </div>

          {/* ElevenLabs Card */}
          <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">{elevenlabs.planName}</h2>
              <p className={`text-3xl font-bold mt-2 ${getELColor(elevenlabs.percentUsed)}`}>
                {elevenlabs.percentUsed.toFixed(1)}%
              </p>
              <p className="text-sm text-purple-200 mt-1">Consumed</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-t border-purple-700 border-b">
              <div>
                <p className="text-purple-200 text-sm">Plan Tier</p>
                <p className="text-xl font-semibold text-white">{elevenlabs.status}</p>
              </div>
              <div>
                <p className="text-purple-200 text-sm">Burn Rate</p>
                <p className="text-xl font-semibold text-white">
                  {(elevenlabs.burnRatePerDay / 1000).toFixed(1)}K/day
                </p>
              </div>
              <div>
                <p className="text-purple-200 text-sm">EOM Projection</p>
                <p className={`text-xl font-semibold ${getELForecastColor(elevenlabs.willExceed)}`}>
                  {(elevenlabs.projectedEOM / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>

            {/* Donut Chart Equivalent - Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-center mb-3">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={
                        elevenlabs.percentUsed < 50 ? '#10b981' :
                        elevenlabs.percentUsed < 80 ? '#f59e0b' :
                        '#ef4444'
                      }
                      strokeWidth="8"
                      strokeDasharray={`${(elevenlabs.percentUsed / 100) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {elevenlabs.percentUsed.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Dual Progress Bars */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-purple-200">Characters Used</span>
                    <span className="text-purple-300">
                      {(elevenlabs.charsUsed / 1000000).toFixed(1)}M / {(elevenlabs.charLimit / 1000000).toFixed(0)}M
                    </span>
                  </div>
                  <div className="h-3 bg-purple-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-purple-600"
                      style={{ width: `${elevenlabs.percentUsed}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-purple-200">Billing Cycle Days</span>
                    <span className="text-purple-300">
                      {30 - elevenlabs.daysToReset} / 30
                    </span>
                  </div>
                  <div className="h-3 bg-purple-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${((30 - elevenlabs.daysToReset) / 30) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Slots */}
            <div className="mb-6 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-purple-900/50 p-2 rounded">
                <p className="text-purple-200">Standard Voices</p>
                <p className="text-white font-semibold">
                  {elevenlabs.voiceSlots.standard.used} / {elevenlabs.voiceSlots.standard.limit}
                </p>
              </div>
              <div className="bg-purple-900/50 p-2 rounded">
                <p className="text-purple-200">Pro Voices</p>
                <p className="text-white font-semibold">
                  {elevenlabs.voiceSlots.professional.used} / {elevenlabs.voiceSlots.professional.limit}
                </p>
              </div>
            </div>

            {/* Analysis */}
            <div className={`p-3 rounded ${elevenlabs.willExceed ? 'bg-red-900/30 border border-red-700' : 'bg-green-900/30 border border-green-700'}`}>
              <p className={`text-sm ${elevenlabs.willExceed ? 'text-red-200' : 'text-green-200'}`}>
                {elevenlabs.analysis}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
