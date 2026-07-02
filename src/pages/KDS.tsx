import { useState, useEffect } from 'react';
import { useKDS } from '@/hooks/use-kds';
import { useKdsAudio } from '@/hooks/use-kds-audio';
import { TicketQueue } from '@/components/kds/TicketQueue';

export default function KDSPage() {
  const [station, setStation] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState(new Date());

  const { orders, isLoading, completeOrder, updateStatus } = useKDS(station);

  // Audio alert on new orders via Web Audio API
  useKdsAudio(orders.length, soundEnabled);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');

  const avgTime = orders.length > 0
    ? Math.round(
        orders.reduce((sum, o) => {
          const elapsed = Date.now() - new Date(o.createdAt).getTime();
          return sum + elapsed;
        }, 0) / orders.length / 60_000
      )
    : 0;

  const handleComplete = (orderId: string) => {
    updateStatus(orderId, 'served');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      {/* Header */}
      <header className="kds-header bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-display font-bold">
            &#127830; AURA KDS
          </span>
          <span className="text-2xl font-mono tabular-nums" id="kdsClock">
            {clock.toLocaleTimeString('vi-VN')}
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex gap-4">
            <span>Chờ: <b>{pendingOrders.length}</b></span>
            <span>Đang làm: <b>{preparingOrders.length}</b></span>
            <span>Sẵn sàng: <b>{readyOrders.length}</b></span>
            <span>Avg: <b>{avgTime}m</b></span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              title="Toàn màn hình"
            >
              {isFullscreen ? '⤵️' : '⬝️'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              title="Refresh"
            >
              &#8635;
            </button>
          </div>
        </div>
      </header>

      {/* Station filter */}
      <div className="flex gap-2 px-6 py-3 bg-gray-800 border-b border-gray-700">
        {['all', 'drinks', 'food'].map((s) => (
          <button
            key={s}
            onClick={() => setStation(s)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              station === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s === 'all' ? 'Tất cả' : s === 'drinks' ? 'Đồ uống' : 'Đồ ăn'}
          </button>
        ))}
      </div>

      {/* Main board */}
      <main className="p-6">
        <TicketQueue
          orders={orders}
          station={station}
          onComplete={handleComplete}
          loading={isLoading}
        />
      </main>
    </div>
  );
}
