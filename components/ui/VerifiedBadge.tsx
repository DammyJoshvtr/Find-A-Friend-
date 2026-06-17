import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface VerifiedBadgeProps {
  type: string | null | undefined;
  customColor?: string | null;
  size?: number;
}

export const BADGE_COLORS: Record<string, string> = {
  verified: '#3b82f6',
  official: '#f59e0b',
  moderator: '#a78bfa',
  vendor: '#f97316',
  staff: '#10b981',
  alumni: '#94a3b8',
  guest: '#ec4899',
};

export const BADGE_LABELS: Record<string, string> = {
  verified: 'Verified Student',
  official: 'Official Account',
  moderator: 'Community Moderator',
  vendor: 'Campus Vendor',
  staff: 'University Staff',
  alumni: 'FAF Alumni',
  guest: 'Guest Visitor',
};

export default function VerifiedBadge({ type, customColor, size = 16 }: VerifiedBadgeProps) {
  if (!type || type === 'none') return null;
  const cleanType = String(type).toLowerCase().trim();
  const color = customColor || BADGE_COLORS[cleanType] || '#3b82f6';
  return <MaterialCommunityIcons name="check-decagram" size={size} color={color} />;
}
