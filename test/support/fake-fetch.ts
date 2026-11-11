import { vi } from 'vitest';
import type { Mock } from 'vitest';

import type { FetchFunction } from '../../src/index.js';

export type FetchMock = Mock<FetchFunction>;

/** A fetch that answers every request with the given response. */
export function answering(response: () => Response): FetchMock {
  return vi.fn<FetchFunction>(async () => response());
}

/** A fetch that only finishes when its signal aborts. */
export function hanging(): FetchMock {
  return vi.fn<FetchFunction>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
  );
}

/** A body stream that sends `size` bytes without saying how many up front. */
export function unsizedBody(size: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller): void {
      if (sent >= size) return controller.close();
      const chunk = new Uint8Array(Math.min(1024, size - sent)).fill(0x20);
      sent += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
}

export const publicResolver = async (): Promise<string[]> => ['93.184.215.14'];
