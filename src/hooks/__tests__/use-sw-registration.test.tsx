import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSWRegistration } from '../use-sw-registration';

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function worker(state: ServiceWorkerState = 'installing') {
  return Object.assign(new EventTarget(), { state, postMessage: vi.fn() });
}

function registration() {
  return Object.assign(new EventTarget(), {
    waiting: null as ReturnType<typeof worker> | null,
    active: null as ReturnType<typeof worker> | null,
    installing: null as ReturnType<typeof worker> | null,
  });
}

function setup() {
  const registered = deferred<ReturnType<typeof registration>>();
  const ready = deferred<ReturnType<typeof registration>>();
  const serviceWorker = Object.assign(new EventTarget(), {
    register: vi.fn().mockReturnValue(registered.promise), ready: ready.promise, controller: {},
  });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
  return { registered, ready, serviceWorker };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalServiceWorker) Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('service-worker registration lifecycle', () => {
  it('observes one registration once when register and ready return the same object', async () => {
    const { registered, ready, serviceWorker } = setup();
    const reg = registration();
    const add = vi.spyOn(reg, 'addEventListener');
    const remove = vi.spyOn(reg, 'removeEventListener');
    const removeController = vi.spyOn(serviceWorker, 'removeEventListener');
    const { result, unmount } = renderHook(useSWRegistration);
    await act(async () => { registered.resolve(reg); ready.resolve(reg); });
    expect(serviceWorker.register).toHaveBeenCalledExactlyOnceWith('/sw.js');
    expect(result.current.registration).toBe(reg);
    expect(add).toHaveBeenCalledExactlyOnceWith('updatefound', expect.any(Function));
    unmount();
    expect(remove).toHaveBeenCalledWith('updatefound', add.mock.calls[0]?.[1]);
    expect(removeController).toHaveBeenCalledWith('controllerchange', expect.any(Function));
  });

  it('does not attach listeners when registration promises resolve after unmount', async () => {
    const { registered, ready } = setup();
    const reg = registration();
    const add = vi.spyOn(reg, 'addEventListener');
    const installing = worker();
    reg.installing = installing;
    const addWorker = vi.spyOn(installing, 'addEventListener');
    const { unmount } = renderHook(useSWRegistration);
    unmount();
    await act(async () => { registered.resolve(reg); ready.resolve(reg); });
    expect(add).not.toHaveBeenCalled();
    expect(addWorker).not.toHaveBeenCalled();
  });

  it('ignores the disposed StrictMode setup while retaining one current listener set', async () => {
    const { registered, ready, serviceWorker } = setup();
    const next = deferred<ReturnType<typeof registration>>();
    serviceWorker.register.mockReturnValueOnce(registered.promise).mockReturnValueOnce(next.promise);
    const stale = registration();
    const current = registration();
    const addStale = vi.spyOn(stale, 'addEventListener');
    const addCurrent = vi.spyOn(current, 'addEventListener');
    const removeCurrent = vi.spyOn(current, 'removeEventListener');
    const { result, unmount } = renderHook(useSWRegistration, { reactStrictMode: true });
    await act(async () => { next.resolve(current); ready.resolve(current); registered.resolve(stale); });
    expect(serviceWorker.register).toHaveBeenCalledTimes(2);
    expect(addStale).not.toHaveBeenCalled();
    expect(addCurrent).toHaveBeenCalledTimes(1);
    expect(result.current.registration).toBe(current);
    unmount();
    expect(removeCurrent).toHaveBeenCalledWith('updatefound', addCurrent.mock.calls[0]?.[1]);
  });

  it('observes an already installing worker and detaches it when replaced', async () => {
    const { registered } = setup();
    const reg = registration();
    const first = worker();
    const second = worker();
    reg.installing = first;
    const firstAdd = vi.spyOn(first, 'addEventListener');
    const firstRemove = vi.spyOn(first, 'removeEventListener');
    const secondAdd = vi.spyOn(second, 'addEventListener');
    const secondRemove = vi.spyOn(second, 'removeEventListener');
    const { result, unmount } = renderHook(useSWRegistration);
    await act(async () => registered.resolve(reg));
    expect(firstAdd).toHaveBeenCalledExactlyOnceWith('statechange', expect.any(Function));
    act(() => { reg.installing = second; reg.dispatchEvent(new Event('updatefound')); });
    expect(firstRemove).toHaveBeenCalledWith('statechange', firstAdd.mock.calls[0]?.[1]);
    act(() => { first.state = 'installed'; first.dispatchEvent(new Event('statechange')); });
    expect(result.current.isUpdateAvailable).toBe(false);
    act(() => reg.dispatchEvent(new Event('updatefound')));
    expect(secondAdd).toHaveBeenCalledTimes(1);
    act(() => { second.state = 'installed'; second.dispatchEvent(new Event('statechange')); });
    expect(result.current.isUpdateAvailable).toBe(true);
    unmount();
    expect(secondRemove).toHaveBeenCalledWith('statechange', secondAdd.mock.calls[0]?.[1]);
  });

  it('releases the previous registration and worker when another registration resolves', async () => {
    const { registered, ready } = setup();
    const previous = registration();
    const current = registration();
    previous.installing = worker();
    const removeRegistration = vi.spyOn(previous, 'removeEventListener');
    const removeWorker = vi.spyOn(previous.installing, 'removeEventListener');
    const { result } = renderHook(useSWRegistration);
    await act(async () => ready.resolve(previous));
    await act(async () => registered.resolve(current));
    expect(removeRegistration).toHaveBeenCalledWith('updatefound', expect.any(Function));
    expect(removeWorker).toHaveBeenCalledWith('statechange', expect.any(Function));
    expect(result.current.registration).toBe(current);
    act(() => { previous.installing!.state = 'installed'; previous.installing!.dispatchEvent(new Event('statechange')); });
    expect(result.current.isUpdateAvailable).toBe(false);
  });

  it.each(['waiting', 'active'] as const)('posts SKIP_WAITING to the %s worker', async target => {
    const { registered } = setup();
    const reg = registration();
    const targetWorker = worker('installed');
    reg[target] = targetWorker;
    const { result } = renderHook(useSWRegistration);
    await act(async () => registered.resolve(reg));
    expect(result.current.isUpdateAvailable).toBe(target === 'waiting');
    act(() => result.current.skipWaiting());
    expect(targetWorker.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' });
  });

  it('keeps registration failures non-fatal and can still use ready', async () => {
    const { registered, ready } = setup();
    const reg = registration();
    reg.waiting = worker('installed');
    const { result } = renderHook(useSWRegistration);
    await act(async () => { registered.reject(new Error('Unavailable in development')); ready.resolve(reg); });
    expect(result.current.registration).toBe(reg);
    expect(result.current.isUpdateAvailable).toBe(true);
  });

  it('keeps unsupported browsers safe', () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    const { result } = renderHook(useSWRegistration);
    expect(result.current.registration).toBeNull();
    expect(result.current.isUpdateAvailable).toBe(false);
    expect(() => result.current.skipWaiting()).not.toThrow();
  });
});
