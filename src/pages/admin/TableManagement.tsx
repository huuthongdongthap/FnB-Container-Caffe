'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { HelmetHead } from '@/components/seo/HelmetHead';
import type { CafeTableRow, OrderRow } from './TableManagement-types';
import { STATUS_KEYS_MAP, STATUS_OPTIONS, ACTIVE_ORDER_STATUSES } from './TableManagement-constants';
import { TableCard } from './TableManagement-card';
import { TableFilters } from './TableManagement-filters';

export type { CafeTableRow, OrderRow };

export default function TableManagementPage() {
	const { t } = useTranslation('admin');
	const statusLabel = (status: CafeTableRow['status']) =>
		t(`admin.tableManagement.${STATUS_KEYS_MAP[status]}`, { fallback: status });

	const [tables, setTables] = useState<CafeTableRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState<string | null>(null);
	const [filterZone, setFilterZone] = useState<string>('all');
	const [filterStatus, setFilterStatus] = useState<string>('all');
	const [activeOrderCounts, setActiveOrderCounts] = useState<Record<string, number>>({});
	const [ordersLoading, setOrdersLoading] = useState(true);

	const loadTables = useCallback(async () => {
		try {
			const url =
				filterZone !== 'all' || filterStatus !== 'all'
					? `/api/tables?${filterZone !== 'all' ? 'zone=' + encodeURIComponent(filterZone) : ''}${filterZone !== 'all' && filterStatus !== 'all' ? '&' : ''}${filterStatus !== 'all' ? 'status=' + encodeURIComponent(filterStatus) : ''}`
					: '/api/tables';
			const res = await apiFetch<{ success: boolean; data: CafeTableRow[] }>(url);
			if (res?.success) setTables(res.data);
			setLoading(false);
		} catch {
			setLoading(false);
		}
	}, [filterZone, filterStatus]);

	const loadActiveOrders = useCallback(async () => {
		try {
			const res = await apiFetch<{ success: boolean; data: OrderRow[] }>('/api/orders?limit=20');
			const rows = res?.success ? res.data : [];
			const counts: Record<string, number> = {};
			for (const o of rows) {
				if (ACTIVE_ORDER_STATUSES.has(o.status)) {
					counts[o.table_id] = (counts[o.table_id] || 0) + 1;
				}
			}
			setActiveOrderCounts(counts);
		} catch { /* silent */ } finally {
			setOrdersLoading(false);
		}
	}, []);

	useEffect(() => {
		loadTables();
		loadActiveOrders();
		const poll = setInterval(() => { loadTables(); loadActiveOrders(); }, 15000);
		return () => clearInterval(poll);
	}, [loadTables, loadActiveOrders]);

	const setStatus = async (id: string, status: CafeTableRow['status']) => {
		setUpdating(id);
		try {
			await apiFetch(`/api/tables/${id}/status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status }),
			});
			setTables((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
		} catch { /* silent — next poll recovers */ }
		setUpdating(null);
	};

	const bulkSetStatus = async (status: CafeTableRow['status']) => {
		setUpdating('BULK');
		try {
			const current = filterStatus !== 'all' ? tables.filter((t) => t.status === filterStatus) : tables;
			await Promise.all(
				current.map((t) =>
					apiFetch(`/api/tables/${t.id}/status`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ status }),
					}),
				),
			);
			loadTables();
		} finally { setUpdating(null); }
	};

	const releaseTable = async (table: CafeTableRow) => {
		setUpdating(table.id);
		try {
			await apiFetch(`/api/tables/${table.id}/status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'Available' }),
			});
			setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, status: 'Available' as const } : t)));
		} catch { /* silent — next poll recovers */ }
		setUpdating(null);
	};

	const zones = Array.from(new Set(tables.map((t) => t.zone))).sort();
	const grouped = tables.reduce<Record<string, CafeTableRow[]>>((acc, t) => {
		(acc[t.zone] ||= []).push(t);
		return acc;
	}, {});

	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="animate-pulse text-muted">{t('admin.tableManagement.loading', { fallback: t('qrCodes.loading') })}</div>
			</div>
		);
	}

	return (
		<>
			<HelmetHead title={t('admin.tableManagement.title')} description="Real-time table status management" />
			<div className="min-h-screen bg-background p-4 md:p-6">
				<div className="max-w-7xl mx-auto">
					<div className="flex flex-wrap items-center justify-between gap-3 mb-6">
						<h1 className="text-2xl font-display font-bold">{t('admin.tableManagement.title')}</h1>
						<div className="flex gap-2 flex-wrap">
							<button onClick={() => bulkSetStatus('Available')} disabled={updating === 'BULK'}
								className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
								{t("admin.tableManagement.openAll", { fallback: "Open all" })}
							</button>
							<button onClick={() => {/* future */}}
								className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
								{t("admin.tableManagement.bookAll", { fallback: "Book all" })}
							</button>
							<button onClick={loadTables}
								className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
								{t("admin.tableManagement.refresh", { fallback: "Refresh" })}
							</button>
						</div>
					</div>

					{!loading && !ordersLoading && (
						<div className="flex flex-wrap gap-3 mb-4 text-sm">
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
								<span className="w-2 h-2 rounded-full bg-emerald-400" />
								{tables.filter((tb) => tb.status === 'Available').length} {t('admin.tableManagement.availableShort')}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
								<span className="w-2 h-2 rounded-full bg-amber-400" />
								{tables.filter((tb) => tb.status === 'Occupied').length} {t('admin.tableManagement.occupiedShort')}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
								<span className="w-2 h-2 rounded-full bg-sky-400" />
								{Object.values(activeOrderCounts).reduce((s, v) => s + v, 0)} {t('admin.tableManagement.pendingOrdersShort')}
							</span>
						</div>
					)}

					<TableFilters filterZone={filterZone} filterStatus={filterStatus} zones={zones}
						onZoneChange={setFilterZone} onStatusChange={setFilterStatus} statusLabel={statusLabel} />

					{tables.length === 0 ? (
						<p className="text-center text-muted py-12">{t("admin.tableManagement.noTables", { fallback: "No tables found" })}</p>
					) : (
						<div className="space-y-8">
							{Object.entries(grouped).map(([zone, zoneTables]) => (
								<section key={zone}>
									<h2 className="text-lg font-semibold text-gray-500 mb-4 border-b pb-2">
										{zone} <span className="text-xs text-gray-400 ml-2">({zoneTables.length})</span>
									</h2>
									<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
										{zoneTables.map((table) => (
											<TableCard key={table.id} table={table} zone={zone}
												activeCount={activeOrderCounts[table.id] || 0}
												isUpdating={updating === table.id}
												onSetStatus={setStatus} onRelease={releaseTable} />
										))}
									</div>
								</section>
							))}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
