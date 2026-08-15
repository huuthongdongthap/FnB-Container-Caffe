import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { Sidebar } from './admin-terminal-sidebar';
import { TopBar } from './admin-terminal-top-bar';
import { AnalyticsCards } from './admin-terminal-analytics-cards';
import { RevenueChart } from './admin-terminal-revenue-chart';

export default function AdminTerminal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [chartView, setChartView] = useState<'monthly' | 'quarterly'>('monthly');

  return (
    <StitchShell>
      <Sidebar />
      <TopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="ml-72 pt-20 p-10 min-h-screen">
        <section className="mb-12">
          <AnalyticsCards />
          <RevenueChart chartView={chartView} onChartViewChange={setChartView} />
        </section>
      </main>
    </StitchShell>
  );
}
