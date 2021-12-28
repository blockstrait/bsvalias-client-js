import { CapabilityResolver, Request } from '@blockstrait/bsvalias-core';
import { mocked } from 'jest-mock';

import { PkiClient } from '../src/pki-client';

const requestGetMock = jest.fn();
const isCapabilitySupportedForDomainMock = jest.fn();
const getCapabilitiesForDomainMock = jest.fn();

jest.mock('@blockstrait/bsvalias-core', () => {
  const original = jest.requireActual('@blockstrait/bsvalias-core');

  return {
    ...original,
    Request: jest.fn().mockImplementation(() => {
      return { get: requestGetMock };
    }),
    CapabilityResolver: jest.fn().mockImplementation(() => {
      return {
        isCapabilitySupportedForDomain: isCapabilitySupportedForDomainMock,
        getCapabilitiesForDomain: getCapabilitiesForDomainMock,
      };
    }),
  };
});

mocked(CapabilityResolver, true);
mocked(Request, true);

describe('PKI client', () => {
  beforeEach(() => {
    isCapabilitySupportedForDomainMock.mockReset();
    getCapabilitiesForDomainMock.mockReset();
    requestGetMock.mockReset();
  });

  it('Client can retrieve a public key from the server', async () => {
    const handleToQuery = 'test@mypaymail.co';
    const expectedPublicKeyHex =
      '02ee3ee211eae9dfec8ad733d8a7eeffc162403c8872e2134c76a42c0a0471bdcb';

    const pkiEndpointResponse = {
      bsvalias: '1.0',
      handle: handleToQuery,
      pubkey: expectedPublicKeyHex,
    };

    const capabilityResponse = {
      pki: 'https://bsvalias.example.org/{alias}@{domain.tld}/id',
    };

    getCapabilitiesForDomainMock.mockResolvedValueOnce(capabilityResponse);

    requestGetMock.mockResolvedValueOnce(pkiEndpointResponse);

    const pkiClient = new PkiClient();

    const publicKey = await pkiClient.getPublicKey(handleToQuery);

    expect(publicKey).toEqual(expectedPublicKeyHex);
  });

  it('Client can verify public key owner from the server', async () => {
    const handleToQuery = 'test@mypaymail.co';
    const expectedPublicKeyHex =
      '02ee3ee211eae9dfec8ad733d8a7eeffc162403c8872e2134c76a42c0a0471bdcb';

    const verifyPublicKeyOwnerEndpointResponse = {
      handle: handleToQuery,
      pubkey: expectedPublicKeyHex,
      match: true,
    };

    const capabilityResponse = {
      a9f510c16bde:
        'https://example.bsvalias.tld/api/{alias}@{domain.tld}/{pubkey}',
    };

    getCapabilitiesForDomainMock.mockResolvedValueOnce(capabilityResponse);

    requestGetMock.mockResolvedValueOnce(verifyPublicKeyOwnerEndpointResponse);

    const pkiClient = new PkiClient();

    const match = await pkiClient.verifyPublickeyOwner(
      handleToQuery,
      expectedPublicKeyHex
    );

    expect(match).toEqual(true);
  });
});
