export interface DomainService {
  host: string;
  port: number;
}

export interface SrvResolverResponse {
  services: DomainService[];
  isDomainSecure: boolean;
}

export abstract class SrvResolver {
  abstract locateServices(
    domainName: string,
    service: string,
    protocol: string
  ): Promise<SrvResolverResponse | null>;
}
