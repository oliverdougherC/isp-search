import net from 'node:net';

/**
 * Deterministic suites must not touch the network. This setup file makes every outbound
 * connection attempt fail loudly, except loopback (used by in-process HTTP servers in tests)
 * and except when `ISP_SEARCH_TEST_NETWORK=true` is set explicitly for opt-in live canaries.
 */
const allowNetwork = process.env['ISP_SEARCH_TEST_NETWORK'] === 'true';

function isLoopback(host: string | undefined): boolean {
  return (
    host === undefined ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.startsWith('127.')
  );
}

function hostOf(args: readonly unknown[]): string | undefined {
  const first = args[0];
  if (typeof first === 'object' && first !== null && 'host' in first) {
    const host: unknown = (first as { host?: unknown }).host;
    return typeof host === 'string' ? host : undefined;
  }
  return typeof args[1] === 'string' ? args[1] : undefined;
}

if (!allowNetwork) {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with Reflect.apply below
  const originalConnect = net.Socket.prototype.connect as unknown as (
    ...args: unknown[]
  ) => net.Socket;
  const guardedConnect = function guardedConnect(this: net.Socket, ...args: unknown[]): net.Socket {
    const host = hostOf(args);
    if (!isLoopback(host)) {
      throw new Error(
        `Network access is disabled in deterministic tests (attempted connection to ${host ?? 'unknown'}). ` +
          'Set ISP_SEARCH_TEST_NETWORK=true only for explicit live canaries.',
      );
    }
    return Reflect.apply(originalConnect, this, args);
  };
  net.Socket.prototype.connect = guardedConnect;
}

export {};
