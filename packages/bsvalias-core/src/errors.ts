/**
 * Client-side error.
 */
export class BsvAliasClientError extends Error {}

/**
 * Unexpected client-side network error.
 */
export class UnexpectedBsvAliasNetworkError extends BsvAliasClientError {}

/**
 * Could not establish a connection between the client and the server; connection timed out.
 */
export class ConnectionTimeoutError extends BsvAliasClientError {
  constructor() {
    super('Connection timeout');
  }
}

/**
 * Error response from DNS server.
 */
export class DnsServerResponseError extends BsvAliasClientError {}

/**
 * Invalid configuration supplied to the BSV alias client instance.
 */
export class BsvAliasClientConfigurationError extends BsvAliasClientError {}

/**
 * BSV alias server replied with an HTTP error.
 */
export class BsvAliasServerErrorResponse extends BsvAliasClientError {
  public readonly status: number;
  public readonly response: any;

  constructor(status: number, response: any) {
    super(`BsvAlias service responded with status: ${status}`);

    this.status = status;
    this.response = response;
  }
}

/**
 * BSV alias server replied with an unexpected response.
 */
export class BsvAliasUnexpectedServerResponseError extends BsvAliasClientError {}

/**
 * Capability requested is not supported by the BSV alias server.
 */
export class BsvAliasCapabilityNotSupportedError extends BsvAliasClientError {}

/**
 * The domain where the BSV alias is hosted does not have DNSSEC enabled.
 */
export class DNSSECNotEnabledError extends BsvAliasClientError {}
