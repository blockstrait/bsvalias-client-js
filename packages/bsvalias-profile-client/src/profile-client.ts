import {
  Request,
  SrvResolver,
  CapabilityResolver,
  Capabilities,
  DohSrvResolver,
  BsvAliasCapabilityNotSupportedError,
  BsvAliasUnexpectedServerResponseError,
} from '@blockstrait/bsvalias-core';

/**
 * BRFC ID of the Public Profile capability.
 */
const PROFILE_BRFC = 'f12f968c92d6';

/**
 * A response from the profile endpoint. An example response would be:
 * ```json
 * {
 *    "name": "<name>",
 *    "avatar": "<Avatar URL>"
 * }
 * ```
 */
interface ProfileResponse {
  name: string;
  avatar?: string;
}

export interface ProfileClientParams {
  srvResolver?: SrvResolver;
  request?: Request;
}

export interface GetProfileResult {
  name: string;
  pictureUrl?: string;
}

/**
 * Get public profile.
 */
export class ProfileClient {
  private capabilityResolver: CapabilityResolver;
  private request: Request;

  constructor(params?: ProfileClientParams) {
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
   * Retrieve public profile from the server.
   *
   * @param handle Paymail handle to query.
   *
   * @returns Profile retrieved from the server.
   */
  async getProfile(handle: string): Promise<GetProfileResult> {
    const [alias, domainName] = handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined = capabilities[PROFILE_BRFC];

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No profile capability found'
      );
    }

    if (typeof urlTemplate !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const profileUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName);

    const response: ProfileResponse = await this.request.get(profileUrl, {
      responseType: 'json',
    });

    return {
      name: response.name,
      pictureUrl: response.avatar,
    };
  }
}
