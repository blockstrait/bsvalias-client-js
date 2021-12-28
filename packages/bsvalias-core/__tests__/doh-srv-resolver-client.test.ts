import { mocked } from 'jest-mock';

import { mockRandom, resetMockRandom } from 'jest-mock-random';

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

describe('DoH srvResolver handles valid server responses', () => {
  beforeEach(() => {
    requestGetMock.mockClear();
  });

  it('can get BSV alias SRV record from server', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 443 example.com',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    const srvResolverResponse = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    const expectedResponse = {
      services: [
        {
          host: 'example.com',
          port: 443,
        },
      ],
      isDomainSecure: true,
    };

    expect(srvResolverResponse).toEqual(expectedResponse);
  });

  it('returns SRV records by priority order', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 443 target1.example.com',
        },
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '7 10 443 target2.example.com',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    const srvResolverResponse = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    const expectedResponse = {
      services: [
        {
          host: 'target2.example.com',
          port: 443,
        },
        {
          host: 'target1.example.com',
          port: 443,
        },
      ],
      isDomainSecure: true,
    };

    expect(srvResolverResponse).toEqual(expectedResponse);
  });

  it('returns SRV records that have the same priority using weight', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 3 443 target1.example.com',
        },
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 7 443 target2.example.com',
        },
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 443 target3.example.com',
        },
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '7 10 443 target4.example.com',
        },
      ],
    };

    requestGetMock
      .mockResolvedValueOnce(dnsQueryResponse)
      .mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    /* With Math.random() returning 0.3:
     *   Iteration 1:
     *    - Running weights: 3, 10, 20: random: 6
     *    - Result: pick 10
     *   Iteration 2:
     *    - Running weights: 3, 10, random: 3
     *    - Result: pick 3
     *   Iteration 3:
     *    - Result: pick 10
     *   Expected order: target2, target1, target3
     *
     * With Math.random() returning 0.5:
     *   Iteration 1:
     *    - Running weights: 3, 10, 20: random: 10
     *    - Result: pick 10
     *   Iteration 2:
     *    - Running weights: 3, 10, random: 6
     *    - Result: pick 10
     *   Iteration 3:
     *    - Result: pick 3
     *   Expected order: target2, target3, target1
     */
    mockRandom([0.3, 0.3, 0.5, 0.5]);

    let srvResolverResponse = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    let expectedResponse = {
      services: [
        {
          host: 'target4.example.com',
          port: 443,
        },
        {
          host: 'target2.example.com',
          port: 443,
        },
        {
          host: 'target1.example.com',
          port: 443,
        },
        {
          host: 'target3.example.com',
          port: 443,
        },
      ],
      isDomainSecure: true,
    };

    expect(srvResolverResponse).toEqual(expectedResponse);

    srvResolverResponse = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    expectedResponse = {
      services: [
        {
          host: 'target4.example.com',
          port: 443,
        },
        {
          host: 'target2.example.com',
          port: 443,
        },
        {
          host: 'target3.example.com',
          port: 443,
        },
        {
          host: 'target1.example.com',
          port: 443,
        },
      ],
      isDomainSecure: true,
    };

    expect(srvResolverResponse).toEqual(expectedResponse);

    resetMockRandom();
  });

  it('returns `null` if server replies with `Status = NXDOMAIN`', async () => {
    const dnsQueryResponse = {
      Status: 3, // NXDOMAIN
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 443 .',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    const srvResolverResponse = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    expect(srvResolverResponse).toEqual(null);
  });

  it('returns `null` if server returns one RR with target value set to `.`', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 443 .',
        },
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '7 10 443 example.com',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    const srvResolverResponse = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    expect(srvResolverResponse).toEqual(null);
  });

  it('returns response if server returns more than one RR with target value set to `.`', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 443 .',
        },
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '7 10 443 .',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    const srvResolverResponse = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    const expectedResponse = {
      services: [],
      isDomainSecure: true,
    };

    expect(srvResolverResponse).toEqual(expectedResponse);
  });

  it('throws exception if `Status` returned by the server is different from NXDOMAIN or NOERROR', async () => {
    const dnsQueryResponse = {
      Status: 2, // != NXDOMAIN or NOERROR
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Error response sent by the server$/);
  });
});

describe('DoH srvResolver handles invalid responses sent by a server', () => {
  it('throws exception if no `Question` field is returned by the server', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^No `Question` field found$/);
  });

  it('throws exception if server returns incorrect number of `Question` elements', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
        {
          name: 'another element',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 443 example.com',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Expected only one `Question` element$/);
  });

  it('throws exception if no answer matches the question', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: 'example.com',
          type: 33,
          TTL: 299,
          data: 'some data',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^No valid answer found$/);
  });

  it('Returns null if no `Answer` field is returned by the server', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    const response = await srvResolver.locateServices(
      'example.com',
      'bsvalias',
      'tcp'
    );

    expect(response).toEqual(null);
  });

  it('throws exception if server returns unexpected Question `name` field', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: 'invalid name',
          type: 33,
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Invalid question name$/);
  });

  it('throws exception if server returns unexpected Question `type` field', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 32, // != 33
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Invalid question type$/);
  });
});

describe('DoH srvResolver handles invalid SRV data sent by a server', () => {
  it('throws exception if answer contains less than four elements separated by spaces', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: 'only three words',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Invalid answer$/);
  });

  it('throws exception if SRV data contains invalid priority value', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: 'not-a-number 10 443 example.com',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Invalid priority/);
  });

  it('throws exception if SRV data contains invalid weight value', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 not-a-number 443 example.com',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Invalid weight/);
  });

  it('throws exception if SRV data contains invalid port value', async () => {
    const dnsQueryResponse = {
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
        },
      ],
      Answer: [
        {
          name: '_bsvalias._tcp.example.com',
          type: 33,
          TTL: 299,
          data: '10 10 not-a-number example.com',
        },
      ],
    };

    requestGetMock.mockResolvedValueOnce(dnsQueryResponse);

    const srvResolver = new DohSrvResolver();

    await expect(
      srvResolver.locateServices('example.com', 'bsvalias', 'tcp')
    ).rejects.toThrow(/^Invalid port/);
  });
});
