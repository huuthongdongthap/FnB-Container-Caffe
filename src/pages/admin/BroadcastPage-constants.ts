/**
 * BroadcastPage — channel option definitions
 */

import React from 'react';
import { MessageCircle, Smartphone, Mail, Send } from 'lucide-react';
import type { Channel } from './BroadcastPage-types';

export const CHANNEL_OPTIONS: { value: Channel; labelKey: string; icon: React.ElementType }[] = [
  { value: 'zns', labelKey: 'broadcast.channelZns', icon: MessageCircle },
  { value: 'sms', labelKey: 'broadcast.channelSms', icon: Smartphone },
  { value: 'email', labelKey: 'broadcast.channelEmail', icon: Mail },
  { value: 'all', labelKey: 'broadcast.channelAll', icon: Send },
];
