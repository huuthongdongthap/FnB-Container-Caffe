'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { isSameAccountScope, readSessionSnapshot, useClientSessionScope, type SessionSnapshot } from '@/lib/client-session';
import type { CafeTableRow, OrderRow, TableTransferFeedback } from './TableManagement-types';
import { STATUS_KEYS_MAP, STATUS_OPTIONS as _STATUS_OPTIONS, ACTIVE_ORDER_STATUSES } from './TableManagement-constants';
import { TableCard } from './TableManagement-card';
import { TableFilters } from './TableManagement-filters';
import { TableTransferDialog } from './table-transfer-dialog';

const TRANSFER_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier']);

export type { CafeTableRow, OrderRow };

export default function TableManagementPage() {
	const session = useClientSessionScope();
	const canTransfer = Boolean(session.token && session.role && TRANSFER_ROLES.has(session.role));
	const scope = JSON.stringify([session.tenantId, session.userScope, session.role]);
	const feedbackKey = canTransfer && session.userId ? `aura:table-transfer:${scope}` : null;
	return <ScopedTableManagement key={JSON.stringify([scope, canTransfer])} {...{ session, canTransfer, feedbackKey }} />;
}

function ScopedTableManagement({ session, canTransfer, feedbackKey }: {
	session: SessionSnapshot;
	canTransfer: boolean;
	feedbackKey: string | null;
}) {
	const { t, i18n } = useTranslation();
	const [source, setSource] = useState<CafeTableRow | null>(null);
	const [feedback, setFeedback] = useState<TableTransferFeedback | null>(() => {
		if (!feedbackKey) return null;
		try {
			const raw = sessionStorage.getItem(feedbackKey);
			const saved = raw ? JSON.parse(raw) as Partial<TableTransferFeedback> | null : null;
			return saved && (saved.kind === 'success' || saved.kind === 'error') && typeof saved.message === 'string'
				? { kind: saved.kind, message: saved.message } : null;
		} catch { return null; }
	});

	const recordFeedback = (next: TableTransferFeedback | null) => {
		const current = readSessionSnapshot();
		if (!current.token || !isSameAccountScope(current, session)) return;
		setFeedback(next);
		if (feedbackKey) {
			try {
				if (next) sessionStorage.setItem(feedbackKey, JSON.stringify(next));
				else sessionStorage.removeItem(feedbackKey);
			} catch { /* Feedback remains visible when browser storage is unavailable. */ }
		}
	};
	const statusLabel = (status: CafeTableRow['status']) =>
		t(`admin.tableManagement.${STATUS_KEYS_MAP[status]}`, { defaultValue: status, fallback: status });

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
			const res = await apiFetch<{ success: boolean; data: unknown }>('/api/orders?limit=200&order_type=dine_in');
			const raw = res?.success ? (res.data as unknown) : [];
			const rows = Array.isArray(raw)
				? (raw as Array<{ table_id?: string; status: string }>)
				: Array.isArray((raw as { orders?: unknown[] })?.orders)
					? (raw as { orders: Array<{ table_id?: string; status: string }> }).orders
					: [];
			const counts: Record<string, number> = {};
			for (const o of rows) {
				if (o.table_id && ACTIVE_ORDER_STATUSES.has(String(o.status || '').toLowerCase())) {
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
			recordFeedback(null);
		} catch (err) {
			const msg = err instanceof Error ? err.message : (i18n.language?.startsWith('vi') ? 'Không thể cập nhật trạng thái bàn' : 'Failed to update table status');
			recordFeedback({ kind: 'error', message: msg });
		}
		setUpdating(null);
	};

	const bulkSetStatus = async (status: CafeTableRow['status']) => {
		const vi = i18n.language?.startsWith('vi');
		const confirmMsg = status === 'Available'
			? (vi ? 'Mở trống tất cả các bàn đang hiển thị?' : 'Release all displayed tables to Available?')
			: (vi ? 'Đặt trước tất cả các bàn đang hiển thị?' : 'Mark all displayed tables as Reserved?');
		if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;
		setUpdating('BULK');
		try {
			const current = filterStatus !== 'all'
				? tables.filter((t) => String(t.status || '').toLowerCase() === filterStatus.toLowerCase())
				: tables;
			const settled = await Promise.allSettled(
				current.map((t) =>
					apiFetch(`/api/tables/${t.id}/status`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ status }),
					}),
				),
			);
			const failedCount = settled.filter((r) => r.status === 'rejected').length;
			if (failedCount > 0) {
				recordFeedback({
					kind: 'error',
					message: vi
						? `Không thể cập nhật ${failedCount}/${current.length} bàn (có thể còn đơn chưa thanh toán).`
						: `Failed to update ${failedCount}/${current.length} tables (unpaid active orders may exist).`,
				});
			} else {
				recordFeedback(null);
			}
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
			recordFeedback(null);
		} catch (err) {
			const msg = err instanceof Error ? err.message : (i18n.language?.startsWith('vi') ? 'Không thể trả bàn (bàn có thể còn đơn chưa thanh toán)' : 'Failed to release table');
			recordFeedback({ kind: 'error', message: msg });
		}
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
				<div className="animate-pulse text-muted">{t('admin.tableManagement.loading', { defaultValue: t('qrCodes.loading'), fallback: t('qrCodes.loading') })}</div>
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
								{t("admin.tableManagement.openAll", { defaultValue: "Open all", fallback: "Open all" })}
							</button>
							<button onClick={() => bulkSetStatus('Reserved')} disabled={updating === 'BULK'}
								className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
								{t("admin.tableManagement.bookAll", { defaultValue: "Book all", fallback: "Book all" })}
							</button>
							<button onClick={loadTables}
								className="px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-foreground hover:bg-muted/20 transition-colors">
								{t("admin.tableManagement.refresh", { defaultValue: "Refresh", fallback: "Refresh" })}
							</button>
						</div>
					</div>

					{!loading && !ordersLoading && (
						<div className="flex flex-wrap gap-3 mb-4 text-sm">
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
								<span className="w-2 h-2 rounded-full bg-emerald-500" />
								{tables.filter((tb) => String(tb.status || '').toLowerCase() === 'available').length} {t('admin.tableManagement.availableShort')}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
								<span className="w-2 h-2 rounded-full bg-amber-500" />
								{tables.filter((tb) => String(tb.status || '').toLowerCase() === 'occupied').length} {t('admin.tableManagement.occupiedShort')}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
								<span className="w-2 h-2 rounded-full bg-sky-500" />
								{tables.filter((tb) => String(tb.status || '').toLowerCase() === 'reserved').length} {t('admin.tableManagement.reservedShort', { defaultValue: 'Reserved' })}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">
								<span className="w-2 h-2 rounded-full bg-red-500" />
								{tables.filter((tb) => String(tb.status || '').toLowerCase() === 'overdue').length} {t('admin.tableManagement.overdueShort', { defaultValue: 'Overdue' })}
							</span>
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
								<span className="w-2 h-2 rounded-full bg-indigo-500" />
								{Object.values(activeOrderCounts).reduce((s, v) => s + v, 0)} {t('admin.tableManagement.pendingOrdersShort')}
							</span>
						</div>
					)}

					{feedback && (
						<div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
							<p role={feedback.kind === 'error' ? 'alert' : 'status'} className="min-w-0 break-words">{feedback.message}</p>
							<button type="button" className="underline" onClick={() => recordFeedback(null)}>
								{i18n.language?.startsWith('vi') ? 'Đóng thông báo' : 'Dismiss notice'}
							</button>
						</div>
					)}

					<TableFilters filterZone={filterZone} filterStatus={filterStatus} zones={zones}
						onZoneChange={setFilterZone} onStatusChange={setFilterStatus} statusLabel={statusLabel} />

					{tables.length === 0 ? (
						<p className="text-center text-muted py-12">{t("admin.tableManagement.noTables", { defaultValue: "No tables found", fallback: "No tables found" })}</p>
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
												onSetStatus={setStatus} onRelease={releaseTable}
												onTransfer={canTransfer ? setSource : undefined} />
										))}
									</div>
								</section>
							))}
						</div>
					)}
				</div>
			</div>
			{source && (
				<TableTransferDialog source={source} session={session} onClose={() => setSource(null)}
					onResult={(result) => {
						recordFeedback(result);
						if (result.kind === 'success') {
							setSource(null);
							void loadTables();
							void loadActiveOrders();
						}
					}} />
			)}
		</>
	);
}
