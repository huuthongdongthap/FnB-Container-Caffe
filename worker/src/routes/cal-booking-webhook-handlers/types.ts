import { z } from 'zod';
import type { Env } from '../../types/env';

export interface CalBookingPayload {
  triggerEvent: string;
  createdAt: string;
  payload: {
    uid: string;
    title: string;
    startTime: string;
    endTime: string;
    attendees: Array<{ name: string; email: string; timeZone: string }>;
    organizer: { name: string; email: string };
    location: string;
    metadata?: Record<string, unknown>;
    rescheduleUid?: string;
    cancellationReason?: string;
  };
}

export interface BookingRecord {
  id: string;
  cal_uid: string;
  title: string;
  start_time: string;
  end_time: string;
  attendee_name: string;
  attendee_email: string;
  status: string;
  created_at: string;
}

export const calBookingPayloadSchema = z.object({
  triggerEvent: z.string().min(1),
  createdAt: z.string(),
  payload: z.object({
    uid: z.string().min(1),
    title: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    attendees: z
      .array(
        z.object({
          name: z.string(),
          email: z.string(),
          timeZone: z.string()
        })
      )
      .optional(),
    organizer: z.object({
      name: z.string(),
      email: z.string()
    }),
    location: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    rescheduleUid: z.string().optional(),
    cancellationReason: z.string().optional()
  })
});

export type CalBookingPayloadInput = z.infer<typeof calBookingPayloadSchema>;