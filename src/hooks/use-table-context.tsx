import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCartStore } from '@/hooks/stores/use-cart-store';

/* ═══════════════════════════════════════════════════════════════════
   TableContext — reads ?table= from URL and syncs to cart store.
   Exposes tableId and isDineIn flag app-wide.
   ═══════════════════════════════════════════════════════════════════ */

interface TableContextValue {
  tableId: string | null;
  isDineIn: boolean;
}

const TableContext = createContext<TableContextValue>({
  tableId: null,
  isDineIn: false,
});

export function TableProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const rawId = searchParams.get('table');
  const tableId = rawId && rawId.trim().length > 0 ? rawId.trim() : null;
  const setTableId = useCartStore((s) => s.setTableId);

  useEffect(() => {
    setTableId(tableId);
  }, [tableId, setTableId]);

  return (
    <TableContext.Provider value={{ tableId, isDineIn: tableId != null }}>
      {children}
    </TableContext.Provider>
  );
}

export function useTableContext(): TableContextValue {
  return useContext(TableContext);
}
