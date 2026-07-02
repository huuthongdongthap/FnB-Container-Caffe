---
phase: 2
title: SMS/email channel modules
status: completed
priority: P1
effort: 2h
dependencies: [1]
---

# Phase 2: SMS/Email Channel Modules

## Files to Create

```
worker/src/tree/campaigns/channels/
├── sms.ts       — SpeedSMS campaign sender (thin wrapper around speedsms-client)
├── email.ts     — SendGrid campaign sender (thin wrapper around email.ts lib)
├── zalo.ts      — Zalo ZNS campaign sender (thin wrapper around tree/zalo/)
└── __tests__/
    └── channels.test.ts
```

### `channels/sms.ts`

```typescript
import { sendSMS } from '../../../../lib/speedsms-client';

export async function sendCampaignSms(env, message: CampaignMessage): Promise<CampaignResult> {
  const result = await sendSMS(env, { phone: message.to, message: message.body });
  return { trigger: message.trigger, channel: 'sms', customer_id: message.data?.customer_id as string, sent: result.success, error: result.success ? undefined : 'send_failed' };
}
```

### `channels/email.ts`

Same pattern — wrap `sendEmail` from `../../../../lib/email`.

### `channels/zalo.ts`

Same pattern — wrap `notifyMember` from `../../tree/zalo/notify-member`.

## Templates

### `tree/campaigns/templates.ts`

Bilingual (VN+EN) message templates per trigger:

- **welcome:** "Chào {name}, chúc mừng bạn đã trở thành thành viên AURA! Nhập WELCOME10 để giảm 10% đơn đầu tiên."
- **birthday:** "Chúc mừng sinh nhật {name}! AURA tặng bạn 15% giảm giá trong hôm nay. Hãy đến quán để nhận ưu đãi nhé!"
- **winback:** "{name} ơi, đã lâu bạn chưa ghé AURA. Hôm nay giảm 15% cho bạn. Hẹn gặp lại nhé!"
- **post_visit:** "Cảm ơn {name} đã ghé AURA hôm nay! Đánh giá trải nghiệm của bạn tại: {link}"
- **cashback_expiry:** "{name} ơi, {amount} VND cashback của bạn sắp hết hạn trong {days_left} ngày. Hãy sử dụng ngay!"

## TDD Steps

1. Write tests:
   - Each channel sends correctly via wrapped client
   - Templates render with proper VN content
   - Template fallback for missing variables
2. Implement
3. `npm test` → all pass
4. Commit: `feat(campaigns): add SMS/email/Zalo channel modules + templates`
