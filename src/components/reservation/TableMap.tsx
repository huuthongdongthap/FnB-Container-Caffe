import { cn } from '@/lib/cn';
import type { TableInfo } from '@/hooks/use-reservations';

interface TableMapProps {
  tables: TableInfo[];
  zone: string;
  selectedTable: string;
  onSelect: (tableId: string) => void;
}

const ZONE_TITLES: Record<string, string> = {
  VIP: 'Mặt Bằng Rooftop',
  Indoor: 'Mặt Bằng Café Bar',
  Outdoor: 'Mặt Bằng Sân Trống',
};

export function TableMap({ tables, zone, selectedTable, onSelect }: TableMapProps) {
  const zoneTables = tables.filter((t) => t.zone === zone);
  const zoneTitle = ZONE_TITLES[zone] || zone;

  if (zoneTables.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted border border-dashed border-border rounded-lg">
        <p className="text-sm">Không có bàn trong khu vực này</p>
      </div>
    );
  }

  const rows = [zoneTables.slice(0, 6), zoneTables.slice(6)];

  return (
    <div className="floor-plan">
      <h2 className="text-lg font-display font-semibold mb-2">{zoneTitle}</h2>
      <div className="flex gap-2 mb-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Trống
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Đã đặt
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Đang chọn
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-2 justify-center">
            {row.map((table) => {
              const isSelected = selectedTable === table.id;
              return (
                <button
                  key={table.id}
                  disabled={!table.available}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(table.id)}
                  className={cn(
                    'w-16 h-16 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-medium transition-all',
                    table.available && !isSelected && 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 cursor-pointer',
                    table.available && isSelected && 'border-sky-400 bg-sky-500/20 text-sky-200 ring-2 ring-sky-400/40',
                    !table.available && 'border-red-500/30 bg-red-500/15 text-red-300 cursor-not-allowed opacity-60'
                  )}
                >
                  <span className="font-mono text-sm font-bold">#{table.table_number}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
