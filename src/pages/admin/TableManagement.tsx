'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api-client';
import { HelmetHead } from '@/components/seo/HelmetHead';

interface CafeTableRow {
	id: string;
	table_number: number;
	zone: string;
	capacity: number;
	status: 'Available' | 'Occupied' | 'Reserved' | 'Overdue';
	updated_at?: string;
}

interface OrderRow {
	table_id: string;
	status: string;
}

const STATUS_KEYS_MAP: Record<string, string> = {
 Available: 'statusAvailable',
 Occupied: 'statusOccupied',
 Reserved: 'statusReserved',
 Overdue: 'statusOverdue',
};

const STATUS_OPTIONS: Array<{ value: CafeTableRow['status']; dot: string }> = [
 { value: 'Available', dot: 'bg-emerald-400' },
 { value: 'Occupied', dot: 'bg-amber-400' },
 { value: 'Reserved', dot: 'bg-sky-400' },
 { value: 'Overdue', dot: 'bg-red-400' },
];

const ACTIVE_ORDER_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready']);

export default function TableManagementPage() {
	const t = useTranslations('admin');
const statusLabel = (status: CafeTableRow['status']) =>
 t(`admin.tableManagement.${STATUS_KEYS_MAP[status]}`, { fallback: status });

const clickStatusLabel = (key: string) =>
 t(`admin.tableManagement.${key}`, { fallback: 'Cycle status' });

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
		} catch {
			// silent — badges simply don't render if orders can't load
		} finally {
			setOrdersLoading(false);
		}
	}, []);

	useEffect(() => {
		loadTables();
		loadActiveOrders();
		const poll = setInterval(() => {
			loadTables();
			loadActiveOrders();
		}, 15000);
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
		} catch {
			/* silent — next poll recovers */
		}
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
		} finally {
			setUpdating(null);
		}
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
		} catch {
			// silent — next poll recovers
		}
		setUpdating(null);
	};

	// Derive all zones from data
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
							<button
								onClick={() => bulkSetStatus('Available')}
								disabled={updating === 'BULK'}
								className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
							>
								{t("admin.tableManagement.openAll", { fallback: "Open all" })}
							</button>
							<button
								onClick={() => {
									/* future: clear unpaid orders */
								}}
								className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
							>
								{t("admin.tableManagement.bookAll", { fallback: "Book all" })}
							</button>
							<button
								onClick={loadTables}
								className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
							>
								{t("admin.tableManagement.refresh", { fallback: "Refresh" })}
							</button>
						</div>
					</div>

					{/* Quick stats header */}
					{!loading && !ordersLoading && (
						<div className="flex flex-wrap gap-3 mb-4 text-sm">
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
								<span className="w-2 h-2 rounded-full bg-emerald-400" />
								{tables.filter((tb) => tb.status === 'Available').length}{' '}
								{t('admin.tableManagement.availableShort')}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
								<span className="w-2 h-2 rounded-full bg-amber-400" />
								{tables.filter((tb) => tb.status === 'Occupied').length}{' '}
								{t('admin.tableManagement.occupiedShort')}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
								<span className="w-2 h-2 rounded-full bg-sky-400" />
								{Object.values(activeOrderCounts).reduce((s, v) => s + v, 0)}{' '}
								{t('admin.tableManagement.pendingOrdersShort')}
							</span>
						</div>
					)}

					{/* Filters */}
					<div className="flex gap-3 mb-4 flex-wrap text-sm">
						<label className="text-muted">{t("admin.tableManagement.filtersLabel", { fallback: "Filter:" })}</label>
						<select
							value={filterZone}
							onChange={(e) => setFilterZone(e.target.value)}
							className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
						>
							<option value="all">{t("admin.tableManagement.allZones", { fallback: "All zones" })}</option>
							{zones.map((z) => (
								<option key={z} value={z}>
									{z}
								</option>
							))}
						</select>
						<select
							value={filterStatus}
							onChange={(e) => setFilterStatus(e.target.value)}
							className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
						>
							<option value="all">{t("admin.tableManagement.allStatuses", { fallback: "All statuses" })}</option>
							{STATUS_OPTIONS.map((s) => (
								<option key={s.value} value={s.value}>
									{statusLabel(s.value)}
								</option>
							))}
						</select>
					</div>

					{tables.length === 0 ? (
						<p className="text-center text-muted py-12">{t("admin.tableManagement.noTables", { fallback: "No tables found" })}</p>
					) : (
						<div className="space-y-8">
							{Object.entries(grouped).map(([zone, zoneTables]) => (
								<section key={zone}>
									<h2 className="text-lg font-semibold text-gray-500 mb-4 border-b pb-2">
										{zone}{' '}
										<span className="text-xs text-gray-400 ml-2">({zoneTables.length})</span>
									</h2>
									<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
										{zoneTables.map((table) => {
											const activeCount = activeOrderCounts[table.id] || 0;
											const isUpdating = updating === table.id;
											return (
												<div
													key={table.id}
													className="rounded-xl border border-border bg-[var(--aura-bg-elevated)] p-4 flex flex-col items-center text-center transition-all hover:shadow-md"
												>
													<span className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
														{zone}
													</span>
													<span className="text-2xl font-display font-bold mb-2">
														{String(table.table_number)}
													</span>

													{/* Status badge — clickable */}
													<div className="relative group">
														<button
															disabled={isUpdating}
															onClick={() => {
																const next = STATUS_OPTIONS.find((s) => s.value !== table.status);
																if (next) setStatus(table.id, next.value);
															}}
															title={clickStatusLabel("clickCycleStatus")}
															className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:ring-2 hover:ring-primary/50"
														>
															<span
																className={`w-2 h-2 rounded-full ${STATUS_OPTIONS.find((s) => s.value === table.status)?.dot}`}
															/>
															<span className="whitespace-nowrap">
																{statusLabel(table.status)}
															</span>
														</button>

														{/* Quick actions dropdown */}
														<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block group-focus-within:block bg-white dark:bg-gray-800 rounded-lg shadow-lg border py-1 min-w-[130px] z-10">
															{STATUS_OPTIONS.map((s) => (
																<button
																	key={s.value}
																	onClick={() => setStatus(table.id, s.value)}
																	className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
																>
																	<span className={`w-2 h-2 rounded-full ${s.dot}`} />
																	{statusLabel(s.value)}
																	{table.status === s.value ? ' ✓' : ''}
																</button>
															))}
														</div>
													</div>

													{/* Order count badge + KDS button */}
													<div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
														{activeCount > 0 && (
															<button
																onClick={() => {
																	window.location.href = '/kds';
																}}
																className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium hover:bg-amber-200 transition-colors"
																title={t('admin.tableManagement.viewKDS')}
															>
																{activeCount}{' '}
																{t('admin.tableManagement.orders')}
															</button>
														)}
														<button
															onClick={() => {
																window.location.href = '/kds';
															}}
															className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium hover:bg-gray-200 transition-colors"
															title={t('admin.tableManagement.openKDS')}
														>
															🍳 KDS
														</button>
													</div>

													{/* Manual release button on Occupied tables */}
													{table.status === 'Occupied' && (
														<button
															disabled={isUpdating}
															onClick={() => releaseTable(table)}
															className="mt-2 px-2.5 py-1 text-[11px] rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
														>
															{t('admin.tableManagement.releaseTable')}
														</button>
													)}

													<span className="text-[10px] text-gray-400 mt-1.5">
														{t('admin.tableManagement.capacity')}: {table.capacity}
													</span>
													{isUpdating && <span className="text-xs text-primary mt-1 animate-pulse">...</span>}
												</div>
											);
										})}
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
