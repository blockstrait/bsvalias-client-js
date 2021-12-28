import { mocked } from 'jest-mock';

import { CapabilityResolver } from '../src/capability-resolver';
import { DohSrvResolver } from '../src/doh-srv-resolver';

import { Request } from '../src/request';

const requestGetMock = jest.fn();

jest.mock('../src/request', () => {
  return {
    Request: jest.fn().mockImplementation(() => {
      return { get: requestGetMock };
    }),
  };
});

mocked(Request, true);

describe('Capabilities resolver handles valid server responses', () => {
  beforeEach(() => {
    requestGetMock.mockReset();
  });

  it('returns /.well-known/bsvalias URL if service returns SRV records', async () => {
    const dnsQueryResponse = {
      Status: 0,
      AD: true,
      Question: [
        {
          name: '_bsvalias._tcp.mypaymail.co',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.mypaymail.co',
          type: 33,
          TTL: 299,
          data: '10 10 443 example-target.com',
        },
      ],
    };

    const wellKnownEndpointResponse = {
      bsvalias: '1.0',
      capabilities: {
        pki: 'https://bsvalias.example.org/{alias}@{domain.tld}/id',
        paymentDestination:
          'https://bsvalias.example.org/{alias}@{domain.tld}/payment-destination',
      },
    };

    const mockWellKnownGetRequest = requestGetMock
      .mockResolvedValueOnce(dnsQueryResponse)
      .mockResolvedValueOnce(wellKnownEndpointResponse);

    const resolver = new DohSrvResolver();

    const client = new CapabilityResolver({ srvResolver: resolver });

    const capabilities = await client.getCapabilitiesForDomain('mypaymail.co');

    expect(mockWellKnownGetRequest.mock.calls[1][0]).toEqual(
      'https://example-target.com:443/.well-known/bsvalias'
    );
    expect(capabilities).toEqual(wellKnownEndpointResponse.capabilities);
  });

  it('returns /.well-known/bsvalias URL if service does not return SRV records', async () => {
    const dnsQueryResponse = {
      Status: 3, //NXDOMAIN
      AD: true,
      Question: [
        {
          name: '_bsvalias._tcp.mypaymail.co',
          type: 33,
        },
      ],
    };

    const wellKnownEndpointResponse = {
      bsvalias: '1.0',
      capabilities: {
        pki: 'https://bsvalias.example.org/{alias}@{domain.tld}/id',
        paymentDestination:
          'https://bsvalias.example.org/{alias}@{domain.tld}/payment-destination',
      },
    };

    const mockWellKnownGetRequest = requestGetMock
      .mockResolvedValueOnce(dnsQueryResponse)
      .mockResolvedValueOnce(wellKnownEndpointResponse);

    const resolver = new DohSrvResolver();

    const client = new CapabilityResolver({ srvResolver: resolver });

    const capabilities = await client.getCapabilitiesForDomain('mypaymail.co');

    expect(mockWellKnownGetRequest.mock.calls[1][0]).toEqual(
      'https://mypaymail.co:443/.well-known/bsvalias'
    );
    expect(capabilities).toEqual(wellKnownEndpointResponse.capabilities);
  });
});
