import { CapabilityResolver, Request } from '@blockstrait/bsvalias-core';
import { mocked } from 'jest-mock';

import { ProfileClient } from '../src/profile-client';

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

describe('Profile client', () => {
  beforeEach(() => {
    isCapabilitySupportedForDomainMock.mockReset();
    getCapabilitiesForDomainMock.mockReset();
    requestGetMock.mockReset();
  });

  it('Client can retrieve the public profile from the server', async () => {
    const handleToQuery = 'test@mypaymail.co';
    const expectedProfile = {
      name: 'Profile name',
      pictureUrl: 'Avatar picture URL',
    };

    const profileEndpointResponse = {
      name: expectedProfile.name,
      avatar: expectedProfile.pictureUrl,
    };

    const capabilityResponse = {
      f12f968c92d6: 'https://bsvalias.example.org/{alias}@{domain.tld}/profile',
    };

    getCapabilitiesForDomainMock.mockResolvedValueOnce(capabilityResponse);

    requestGetMock.mockResolvedValueOnce(profileEndpointResponse);

    const profileClient = new ProfileClient();

    const profile = await profileClient.getProfile(handleToQuery);

    expect(profile).toEqual(expectedProfile);
  });
});
