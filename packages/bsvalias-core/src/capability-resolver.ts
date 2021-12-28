import {
  DNSSECNotEnabledError,
  BsvAliasUnexpectedServerResponseError,
} from './errors';
import { Request } from './request';
import { SrvResolver, SrvResolverResponse } from './srv-resolver';

const BSVALIAS_VERSION = '1.0';

/**
 * A capability can be any data structure. It is a up to the specific protocol to interpret its meaning.
 */
export type Capability = any;

/**
 * Capabilities returned by a server. The keys are BRFC IDs that uniquely identify a capability.
 */
export interface Capabilities {
  [key: string]: Capability;
}

/**
 * A response from a /.well-known/bsvalias endpoint. An example response would be:
 * ```json
 * {
 *    "bsvalias": "1.0",
 *    "capabilities": {
 *      "pki": "https://bsvalias.example.org/{alias}@{domain.tld}/id",
 *      "paymentDestination": "https://bsvalias.example.org/{alias}@{domain.tld}/payment-destination"
 *    }
 * }
 * ```
 */
interface CapabilitiesResponse {
  bsvalias: string;
  capabilities: Capabilities;
}

/**
 * Parameters passed to the `CapabilityResolver` constructor.
 */
export interface CapabilityResolverParams {
  srvResolver: SrvResolver;
  request?: Request;
}

/**
 * Queries remote servers to fetch their capabilities.
 */
export class CapabilityResolver {
  private srvResolver: SrvResolver;
  private request: Request;

  constructor(params: CapabilityResolverParams) {
    this.srvResolver = params.srvResolver;

    if (params.request === undefined) {
      this.request = new Request();
    } else {
      this.request = params.request;
    }
  }

  async getCapabilitiesForDomain(domainName: string): Promise<Capabilities> {
    const wellKnownBsvAliasUrl = await this.getWellKnownBaseUrl(domainName);

    const response: CapabilitiesResponse = await this.request.get(
      wellKnownBsvAliasUrl
    );

    if (typeof response.capabilities !== 'object') {
      throw new BsvAliasUnexpectedServerResponseError(
        'No capabilities returned'
      );
    }

    if (response.bsvalias !== BSVALIAS_VERSION) {
      throw new BsvAliasUnexpectedServerResponseError(
        'Unsupported BSV alias version'
      );
    }

    const capabilities: Capabilities = response.capabilities;

    return capabilities;
  }

  async isCapabilitySupportedForDomain(
    capabilityCode: string,
    domainName: string
  ): Promise<boolean> {
    const capabilities = await this.getCapabilitiesForDomain(domainName);

    const value = capabilities[capabilityCode];

    return value === undefined ? false : true;
  }

  private async getWellKnownBaseUrl(domainName: string): Promise<string> {
    let targetDomainName = domainName;
    let targetPort = 443;
    let isSecure = false;

    const srvResolverResponse: SrvResolverResponse | null =
      await this.srvResolver.locateServices(domainName, 'bsvalias', 'tcp');

    if (srvResolverResponse !== null) {
      const service = srvResolverResponse.services[0];

      targetDomainName = service.host;
      targetPort = service.port;

      isSecure = srvResolverResponse.isDomainSecure;
    }

    if (
      this.domainsAreEqual(targetDomainName, domainName) ||
      this.domainsAreEqual(targetDomainName, `www.${domainName}`)
    ) {
      isSecure = true;
    }

    if (!isSecure) {
      throw new DNSSECNotEnabledError(
        `DNSSEC not enabled on domain ${targetDomainName}`
      );
    }

    return `https://${targetDomainName}:${targetPort}/.well-known/bsvalias`;
  }

  private domainsAreEqual(domainName1: string, domainName2: string): boolean {
    return domainName1.replace(/\.$/, '') === domainName2.replace(/\.$/, '');
  }
}
