/** Why the kit refused to fetch or use a remote document or image. */
export type FetchRefusal =
  | 'not-https'
  | 'private-address'
  | 'redirect'
  | 'bad-status'
  | 'bad-content-type'
  | 'too-large'
  | 'timeout'
  | 'not-an-image'
  | 'too-many-pixels'
  | 'host-not-allowed'
  | 'invalid-json';

/** The kit refused a fetch. `reason` says why, for logs and tests. */
export class FetchRefusedError extends Error {
  override readonly name = 'FetchRefusedError';

  constructor(
    readonly reason: FetchRefusal,
    message: string,
  ) {
    super(message);
  }
}
