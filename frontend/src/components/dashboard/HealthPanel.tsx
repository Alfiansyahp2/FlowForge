import { useState, useEffect } from 'react';
import { workflowApi, runsApi } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Activity, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface HealthMetrics {
  total_runs: number;
  active_runs: number;
  success_rate: number;
  avg_duration: number;
  last_24h_runs: number;
}

export function HealthPanel() {
  const [metrics, setMetrics] = useState<HealthMetrics>({
    total_runs: 0,
    active_runs: 0,
    success_rate: 0,
    avg_duration: 0,
    last_24h_runs: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      // Fetch runs from the last 24 hours
      const response = await runsApi.list({
        status: '',
        page: 1,
        per_page: 100,
      });

      const runs = response.data || [];
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const last24hRuns = runs.filter((run: any) => {
        const runDate = new Date(run.started_at);
        return runDate >= yesterday && runDate <= now;
      });

      const activeRuns = runs.filter((run: any) => run.status === 'running').length;
      const completedRuns = last24hRuns.filter((run: any) => run.status === 'completed');
      const failedRuns = last24hRuns.filter((run: any) => run.status === 'failed');

      const totalDuration = completedRuns.reduce((sum: number, run: any) => sum + (run.duration || 0), 0);
      const avgDuration = completedRuns.length > 0 ? Math.round(totalDuration / completedRuns.length) : 0;

      const successRate = last24hRuns.length > 0
        ? Math.round((completedRuns.length / last24hRuns.length) * 100)
        : 0;

      setMetrics({
        total_runs: runs.length,
        active_runs: activeRuns,
        success_rate: successRate,
        avg_duration: avgDuration,
        last_24h_runs: last24hRuns.length,
      });
    } catch (error) {
      console.error('Failed to load health metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Active Runs',
      value: metrics.active_runs,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Success Rate (24h)',
      value: `${metrics.success_rate}%`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      title: 'Avg Duration',
      value: `${metrics.avg_duration}ms`,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Total Runs (24h)',
      value: metrics.last_24h_runs,
      icon: TrendingUp,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className={`border ${stat.borderColor}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className={`text-2xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
