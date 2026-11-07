import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from 'i18next';
import SWUpdatePrompt from '../SWUpdatePrompt';

const hook = vi.hoisted(() => ({ isUpdateAvailable: true, skipWaiting: vi.fn() }));
vi.mock('@/hooks/use-sw-registration', () => ({ useSWRegistration: () => hook }));

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
const originalWindow = window;
let serviceWorker: EventTarget;
let reload: ReturnType<typeof vi.fn>;

const reloadButton = () => screen.getByRole('button', {
  name: i18n.t('pwa.swUpdateReload', 'Tải lại ngay'),
});

beforeEach(() => {
  hook.isUpdateAvailable = true;
  hook.skipWaiting.mockReset();
  serviceWorker = new EventTarget();
  reload = vi.fn();
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
  // Location.reload is unforgeable in jsdom; intercept only that window property.
  vi.stubGlobal('window', new Proxy(originalWindow, {
    get(target, key) {
      return key === 'location' ? { reload } : Reflect.get(target, key, target);
    },
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalServiceWorker) Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('service-worker update action', () => {
  it('keeps the banner hidden until an update is available', () => {
    hook.isUpdateAvailable = false;
    render(<SWUpdatePrompt />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(hook.skipWaiting).not.toHaveBeenCalled();
  });

  it('retains the dismiss action without posting a worker message', () => {
    render(<SWUpdatePrompt />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('pwa.swUpdateLater', 'Để sau') }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(hook.skipWaiting).not.toHaveBeenCalled();
  });

  it('uses one reload action and listener across repeated clicks', () => {
    const add = vi.spyOn(serviceWorker, 'addEventListener');
    const remove = vi.spyOn(serviceWorker, 'removeEventListener');
    render(<SWUpdatePrompt />);
    fireEvent.click(reloadButton());
    fireEvent.click(reloadButton());
    expect(hook.skipWaiting).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledExactlyOnceWith('controllerchange', expect.any(Function), { once: true });
    act(() => serviceWorker.dispatchEvent(new Event('controllerchange')));
    act(() => serviceWorker.dispatchEvent(new Event('controllerchange')));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('controllerchange', add.mock.calls[0]?.[1]);
    fireEvent.click(reloadButton());
    expect(hook.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('attaches its listener before posting SKIP_WAITING, including immediate takeover', () => {
    hook.skipWaiting.mockImplementation(() => serviceWorker.dispatchEvent(new Event('controllerchange')));
    render(<SWUpdatePrompt />);
    fireEvent.click(reloadButton());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('removes a pending reload listener on unmount', () => {
    const add = vi.spyOn(serviceWorker, 'addEventListener');
    const remove = vi.spyOn(serviceWorker, 'removeEventListener');
    const { unmount } = render(<SWUpdatePrompt />);
    fireEvent.click(reloadButton());
    unmount();
    expect(remove).toHaveBeenCalledWith('controllerchange', add.mock.calls[0]?.[1]);
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
  });
});
