import React from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useMyActiveSubscription, useMyInvoices } from '@/hooks/use-subscriptions';
import { Link } from 'react-router-dom';
import SubscriptionSummaryCard from './subscription-summary-card';
import InvoiceTableCard from './invoice-table-card';
import CancelSubscriptionDialog from './cancel-dialog';

export default function CustomerDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: sub, isLoading: subLoading } = useMyActiveSubscription();
  const { data: invoices, isLoading: invLoading } = useMyInvoices();

  if (subLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <HelmetHead title="Dashboard — AURA CAFE" description="Customer dashboard" canonical="/saas/dashboard" />
        <Card className="p-10">
          <h2 className="font-display text-xl font-bold">Vui lòng đăng nhập</h2>
          <p className="mt-2 text-sm text-gray-600">Bạn cần đăng nhập để xem dashboard.</p>
          <Link to="/account"><Button className="mt-4">Đăng nhập</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] mx-auto max-w-4xl px-4 py-24">
      <HelmetHead title="Dashboard — AURA CAFE" description="Manage your subscription and billing" canonical="/saas/dashboard" />

      <h1 className="font-display text-3xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-[color:var(--aura-chrome-bright)]/60">
        Xin chào, {user.name || user.email}
      </p>

      <SubscriptionSummaryCard subscription={sub} isLoading={subLoading} />
      <InvoiceTableCard invoices={invoices} isLoading={invLoading} />

      {sub && (
        <div className="mt-6 flex justify-end">
          <CancelSubscriptionDialog
            subscriptionId={sub.id}
            trigger={<Button variant="destructive" size="sm">Huỷ subscription</Button>}
          />
        </div>
      )}
    </div>
  );
}
