/**
 * Phone validation helpers and schemas
 */

import { z } from 'zod';

export const VN_PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;

export const phoneSchema = z
  .string()
  .regex(VN_PHONE_REGEX, 'Số điện thoại không hợp lệ');
