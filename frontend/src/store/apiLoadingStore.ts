import { create } from "zustand";

interface ApiLoadingState {
  pendingCount: number;
  beginRequest: () => void;
  endRequest: () => void;
}

export const useApiLoadingStore = create<ApiLoadingState>((set) => ({
  pendingCount: 0,
  beginRequest: () =>
    set((state) => ({ pendingCount: state.pendingCount + 1 })),
  endRequest: () =>
    set((state) => ({ pendingCount: Math.max(0, state.pendingCount - 1) })),
}));

/** Envuelve un fetch suelto para que cuente en la barra de progreso global. */
export function withApiProgress<T>(run: () => Promise<T>): Promise<T> {
  useApiLoadingStore.getState().beginRequest();
  return run().finally(() => {
    useApiLoadingStore.getState().endRequest();
  });
}
