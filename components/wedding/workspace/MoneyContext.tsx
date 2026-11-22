'use client';

import { createContext, useContext } from 'react';

// What of this wedding's money the signed-in person may see and work (set by the API: lib/wedding/moneyView.ts). The default is
// full, so a screen rendered outside the Control Room behaves exactly as before.
export interface WorkspaceMoney {
  access: 'full' | 'read' | 'none';
  vendorMoney: boolean; // vendor agreed prices and payouts — and every vendor-booking action, which changes them
  commission: boolean; // Shaadi Shopping's commission on payouts
  assign: boolean; // may choose the coordinator (founder only — it decides who sees the money)
}

export const FULL_MONEY: WorkspaceMoney = { access: 'full', vendorMoney: true, commission: true, assign: true };

const WorkspaceMoneyContext = createContext<WorkspaceMoney>(FULL_MONEY);

export const WorkspaceMoneyProvider = WorkspaceMoneyContext.Provider;

export function useWorkspaceMoney(): WorkspaceMoney {
  return useContext(WorkspaceMoneyContext);
}
