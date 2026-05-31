// ─────────────────────────────────────────────────────────────────────────────
// Avatar.tsx — avatar components
// Sources: FinancialSanctum (Avatar), PaymentRecords (TxAvatar)
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from 'react';
import type { Tx, PaymentTransaction } from '../types/financial.types';
import { avatarGrad, initials } from '../helpers/hub.helpers';
import { avatarColor, initials as recInitials } from '../helpers/records.helpers';

// ─── Avatar (Hub — id-based gradient, name initials) ─────────────────────────

export const Avatar = memo(({ id, name, cls = 'w-8 h-8 text-xs' }: {
  id: string; name: string; cls?: string;
}) => (
  <div className={`${cls} rounded-md bg-gradient-to-br ${avatarGrad(id)} flex items-center justify-center flex-shrink-0 font-bold text-white select-none`}>
    {initials(name)}
  </div>
));
Avatar.displayName = 'Avatar';

// ─── TxAvatar (Records — round, uses full PaymentTransaction) ─────────────────

export const TxAvatar = memo(({ tx, cls = 'w-8 h-8 text-xs' }: {
  tx: PaymentTransaction; cls?: string;
}) => (
  <div className={`${cls} rounded-full bg-gradient-to-br ${avatarColor(tx.id)} flex items-center justify-center flex-shrink-0 font-bold text-white shadow-sm select-none`}>
    {recInitials(tx.user_name || tx.user_email)}
  </div>
));
TxAvatar.displayName = 'TxAvatar';