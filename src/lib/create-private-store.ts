import { create, type StateCreator, type StoreApi } from 'zustand';
import { readClientSession, subscribeClientSession } from './client-session';

/** Retire private state and its in-flight setters whenever the session changes. */
export function createPrivateStore<T extends object>(initialize: StateCreator<T, [], []>) {
  let generation = 0;
  let rebuild: () => T;
  const store = create<T>((set, get, api) => {
    rebuild = () => {
      const current = ++generation;
      let retired: T;
      const guardedSet: StoreApi<T>['setState'] = (partial, replace) => {
        if (current !== generation) return;
        if (replace) set(partial as T, true);
        else set(partial, false);
      };
      const guardedGet = () => current === generation ? get() : retired;
      const state = initialize(guardedSet, guardedGet, { ...api, setState: guardedSet, getState: guardedGet });
      // A stale async action may call get().fetch... after its await. Its retired
      // action must not launch another request using the new user's credentials.
      retired = Object.fromEntries(Object.entries(state).map(([key, value]) => [key,
        typeof value === 'function'
          ? (...args: unknown[]) => current === generation ? value(...args) : undefined
          : value,
      ])) as T;
      return retired;
    };
    return rebuild();
  });
  if (typeof window !== 'undefined') {
    const identity = () => {
      const { token, user } = readClientSession();
      return `${token || ''}:${user?.id || ''}:${user?.tenantId || ''}:${user?.role || ''}`;
    };
    let previous = identity();
    subscribeClientSession(() => {
      const next = identity();
      if (next === previous) return;
      previous = next;
      store.setState(rebuild(), true);
    });
  }
  return store;
}
