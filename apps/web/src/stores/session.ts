import { create } from 'zustand';
import type { AuthResponse, Me, ModuleCode } from '@stockpro/shared';

interface SessionState {
  accessToken: string | null;
  me: Me | null;
  setSession: (auth: AuthResponse) => void;
  setMe: (me: Me) => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set) => ({
  accessToken: null,
  me: null,
  setSession: (auth) => set({ accessToken: auth.accessToken, me: auth.me }),
  setMe: (me) => set({ me }),
  clear: () => set({ accessToken: null, me: null }),
}));

export function hasPermission(me: Me | null, module: ModuleCode) {
  return !!me && me.user.permissions.includes(module);
}

export function useCan(module: ModuleCode) {
  return useSession((s) => hasPermission(s.me, module));
}
