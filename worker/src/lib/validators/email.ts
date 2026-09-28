/**
 * Email validation helpers and schemas
 */

import { z } from 'zod';

export const emailSchema = z.string().email('Email không hợp lệ');