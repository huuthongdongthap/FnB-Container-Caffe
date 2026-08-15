import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND, StatusBadge } from './dashboard-utils';
import type { Subscription } from '@/hooks/use-subscriptions';

interface Props {
  subscription: Subscription | null | undefined;
  isLoading: boolean;
}

export default function SubscriptionSummaryCard({ subscription, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardBody>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full mt-4" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardBody>
        <h2 className="font-display text-lg font-bold">Gói hiện tại / Current Plan</h2>
        {subscription ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {subscription.plan_name || 'Container ' + (subscription.container_number || '')}
              </span>
              <StatusBadge status={subscription.status} />
            </div>
            <div className="text-sm text-gray-600">
              <span>{formatVND(subscription.amount_vnd)}/tháng</span>
              {subscription.zone && <span className="ml-3">· Zone: {subscription.zone}</span>}
              {subscription.container_number && <span className="ml-3">· #{subscription.container_number}</span>}
            </div>
            {subscription.current_period_end && (
              <div className="text-xs text-gray-500">
                Gia hạn tiếp theo: {new Date(subscription.current_period_end).toLocaleDateString('vi-VN')}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 text-sm text-gray-600">
            Chưa có subscription. <Link to="/subscriptions" className="text-blue-600 underline">Xem gói</Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
