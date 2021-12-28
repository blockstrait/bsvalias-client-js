import {
  Request,
  SrvResolver,
  CapabilityResolver,
  Capabilities,
  DohSrvResolver,
  BsvAliasCapabilityNotSupportedError,
  BsvAliasUnexpectedServerResponseError,
} from '@blockstrait/bsvalias-core';

/* eslint @typescript-eslint/no-require-imports: "off" */
const bsv = require('bsv');

export interface PkiClientParams {
  srvResolver?: SrvResolver;
  request?: Request;
}

/**
 * Supported BSV alias versions.
 */
const BSVALIAS_VERSION = '1.0';

/**
 * BRFC ID of the Verify Public Key Owner capability.
 */
const VERIFY_PUBLIC_KEY_OWNER_BRFC = 'a9f510c16bde';

/**
 * A response from the pki endpoint. An example response would be:
 * ```json
 * {
 *    "bsvalias": "1.0",
 *    "handle": "<alias>@<domain>.<tld>",
 *    "pubkey": "..."
 * }
 * ```
 */
interface PkiResponse {
  bsvalias: string;
  handle: string;
  pubkey: string;
}

/**
 * A response from the verify public key owner endpoint. An example response would be:
 * ```json
 * {
 *    "handle": "<alias>@<domain>.<tld>",
 *    "pubkey": "<consulted public key>",
 *    "match": true
 * }
 * ```
 */
interface VerifyPublicKeyOwnerResponse {
  handle: string;
  pubkey: string;
  match: boolean;
}

/**
 * Implements the following BRFCs:
 * - 0c4339ef99c2 (Public Key Infrastructure version 1), as described in https://bsvalias.org/03-public-key-infrastructure.html.
 * - a9f510c16bde (Verify Public Key Owner version 1), as described in https://bsvalias.org/05-verify-public-key-owner.html.
 */
export class PkiClient {
  private capabilityResolver: CapabilityResolver;
  private request: Request;

  constructor(params?: PkiClientParams) {
    const _params = params || {};

    let srvResolver = _params.srvResolver;

    if (srvResolver === undefined) {
      srvResolver = new DohSrvResolver();
    }

    this.capabilityResolver = new CapabilityResolver({ srvResolver });

    if (_params.request === undefined) {
      this.request = new Request();
    } else {
      this.request = _params.request;
    }
  }

  /**
   * Retrieve a stable secp256k1 public key from the server.
   *
   * @param handle Paymail handle to query.
   *
   * @returns A valid secp256k1 public key compressed and hex-encoded.
   */
  async getPublicKey(handle: string): Promise<string> {
    const [alias, domainName] = handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined = capabilities.pki;

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError('No pki capability found');
    }

    if (typeof urlTemplate !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const pkiUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName);

    const response: PkiResponse = await this.request.get(pkiUrl, {
      responseType: 'json',
    });

    if (response.bsvalias !== BSVALIAS_VERSION) {
      throw new BsvAliasUnexpectedServerResponseError(
        'Invalid BSV alias version received from the server'
      );
    }

    if (response.handle !== handle) {
      throw new BsvAliasUnexpectedServerResponseError(
        'Handle returned in the response does not match the one sent in the request'
      );
    }

    let publicKey;

    try {
      publicKey = bsv.PublicKey.fromHex(response.pubkey);
    } catch (error) {
      throw new BsvAliasUnexpectedServerResponseError(
        'Invalid public key received'
      );
    }

    return publicKey.toHex();
  }

  /**
   * Verify if a given secp256k1 public key is a valid identity key for a given paymail handle.
   *
   * @param handle Paymail handle to query.
   * @param publicKey The secp256k1 public key to verify, compressed and hex-encoded.
   *
   * @returns Whether the public key is a valid identity key or not.
   */
  async verifyPublickeyOwner(
    handle: string,
    publicKey: string
  ): Promise<boolean> {
    const [alias, domainName] = handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined =
      capabilities[VERIFY_PUBLIC_KEY_OWNER_BRFC];

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No verify public key owner capability found'
      );
    }

    if (typeof urlTemplate !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const verifyPublicKeyOwnerUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName)
      .replace('{pubkey}', publicKey);

    const response: VerifyPublicKeyOwnerResponse = await this.request.get(
      verifyPublicKeyOwnerUrl,
      { responseType: 'json' }
    );

    if (response.handle !== handle) {
      throw new BsvAliasUnexpectedServerResponseError(
        'Handle returned in the response does not match the one sent in the request'
      );
    }

    if (response.pubkey !== publicKey) {
      throw new BsvAliasUnexpectedServerResponseError(
        'Public key returned in the response does not match the one sent in the request'
      );
    }

    if (!response.match) {
      throw new BsvAliasUnexpectedServerResponseError(
        '`match` field not received'
      );
    }

    return response.match;
  }
}
