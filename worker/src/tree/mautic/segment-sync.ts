/**
 * Mautic Bridge — Segment sync (tier/recency/birthday segments)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import type { MauticClient } from '../../lib/mautic-client';

export async function syncSegments(
  env: Record<string, unknown>,
  client: MauticClient,
  customers: Array<Record<string, unknown>>,
  contactIdMap: Record<string, number>
): Promise<number> {
  const tierSegmentMap: Record<string, number> = {
    bronze: (env.MAUTIC_SEGMENT_LOYALTY_BRONZE as number) || 0,
    silver: (env.MAUTIC_SEGMENT_LOYALTY_SILVER as number) || 0,
    gold: (env.MAUTIC_SEGMENT_LOYALTY_GOLD as number) || 0,
    platinum: (env.MAUTIC_SEGMENT_LOYALTY_PLATINUM as number) || 0
  };
  const activeSegment = (env.MAUTIC_SEGMENT_ACTIVE as number) || 0;
  const atRiskSegment = (env.MAUTIC_SEGMENT_AT_RISK as number) || 0;
  const inactiveSegment = (env.MAUTIC_SEGMENT_INACTIVE as number) || 0;
  const birthdaySegment = (env.MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH as number) || 0;

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  let assigned = 0;

  for (const customer of customers) {
    const rawEmail = typeof customer.email === 'string' ? customer.email.trim() : '';
    const phoneOrId = String(customer.phone || customer.id || '');
    const rawTenant = typeof customer.tenant_id === 'string' ? customer.tenant_id.trim() : '';
    const rowTenant = rawTenant || 'default';
    let contactId: number | undefined;
    if (rawEmail) {
      contactId = contactIdMap[rawEmail];
    } else if (rowTenant !== 'default' && rowTenant !== '*') {
      contactId =
        contactIdMap[`${rowTenant}+${phoneOrId}@aura-cafe.internal`] ??
        contactIdMap[`${rowTenant}+${phoneOrId}@aura-fnb.local`];
      if (!contactId) {
        const hasCrossTenantPhoneCollision = customers.some((other) => {
          if (other === customer) return false;
          const otherPhone = String(other.phone || other.id || '');
          const otherTenant = (typeof other.tenant_id === 'string' && other.tenant_id.trim()) || 'default';
          return otherPhone === phoneOrId && otherTenant !== rowTenant;
        });
        if (!hasCrossTenantPhoneCollision) {
          contactId =
            contactIdMap[`${phoneOrId}@aura-cafe.internal`] ??
            contactIdMap[`${phoneOrId}@aura-fnb.local`];
        }
      }
    } else {
      contactId =
        contactIdMap[`${phoneOrId}@aura-cafe.internal`] ??
        contactIdMap[`${phoneOrId}@aura-fnb.local`];
    }
    if (!contactId) {
      continue;
    }

    const tier = ((customer.loyalty_tier as string) || 'bronze').toLowerCase();
    const tierSegmentId = tierSegmentMap[tier];
    if (tierSegmentId > 0) {
      await client.addContactToSegment(contactId, tierSegmentId);
      assigned++;
    }

    const lastOrder = customer.last_order_date as string | null;
    if (lastOrder) {
      const daysSince = Math.floor((now.getTime() - new Date(lastOrder).getTime()) / 86400000);
      let recencySegmentId = 0;
      if (daysSince <= 30) {
        recencySegmentId = activeSegment;
      } else if (daysSince <= 60) {
        recencySegmentId = atRiskSegment;
      } else {
        recencySegmentId = inactiveSegment;
      }
      if (recencySegmentId > 0) {
        await client.addContactToSegment(contactId, recencySegmentId);
        assigned++;
      }
    } else {
      if (inactiveSegment > 0) {
        await client.addContactToSegment(contactId, inactiveSegment);
        assigned++;
      }
    }

    const birthday = customer.birthday as string | null;
    if (birthday && birthdaySegment > 0) {
      const bdayMonth = birthday.slice(5, 7);
      if (bdayMonth === currentMonth) {
        await client.addContactToSegment(contactId, birthdaySegment);
        assigned++;
      }
    }
  }

  return assigned;
}
