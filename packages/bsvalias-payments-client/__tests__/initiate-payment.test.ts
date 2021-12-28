/* eslint @typescript-eslint/no-require-imports: "off" */

import { PlaintextPrivateKeyStore } from '@blockstrait/bitcoin-keystore';
import { CapabilityResolver, Request } from '@blockstrait/bsvalias-core';
import { MapiClient } from '@blockstrait/mapi-client';
import { mocked } from 'jest-mock';

import { PaymentsClient, PaymentIntent } from '../src/payments-client';
import { Sender } from '../src/sender';
const bsv = require('bsv');

jest.mock('@blockstrait/mapi-client');

const requestPostMock = jest.fn();
const isCapabilitySupportedForDomainMock = jest.fn();
const getCapabilitiesForDomainMock = jest.fn();

jest.mock('@blockstrait/bsvalias-core', () => {
  const original = jest.requireActual('@blockstrait/bsvalias-core');

  return {
    ...original,
    Request: jest.fn().mockImplementation(() => {
      return { post: requestPostMock };
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

mocked(CapabilityResolver, true);
mocked(Request, true);

const MapiClientMock = MapiClient as jest.MockedClass<typeof MapiClient>;
const SrvResolverMock = jest.fn();

describe('Payments client initiate payment function', () => {
  beforeEach(() => {
    isCapabilitySupportedForDomainMock.mockReset();
    getCapabilitiesForDomainMock.mockReset();
    requestPostMock.mockReset();
  });

  it('can retrieve P2P payment destination', async () => {
    const handleToQuery = 'test@example.com';
    const expectedReference = 'b025b4b5-01b2-412b-8ca8-71e7db03d0e8';
    const expectedOutputs = [
      {
        satoshis: 1000,
        script: '76a9146a83ec291893968ed985ef4cd50197040faeb6d888ac',
      },
    ];

    const p2pPaymentDestinationEndpointResponse = {
      reference: expectedReference,
      outputs: expectedOutputs,
    };

    const capabilityResponse = {
      '2a40af698840':
        'https://example.bsvalias.tld/api/p2p-payment-destination/{alias}@{domain.tld}',
    };

    isCapabilitySupportedForDomainMock.mockResolvedValueOnce(true);

    getCapabilitiesForDomainMock.mockResolvedValueOnce(capabilityResponse);

    requestPostMock.mockResolvedValueOnce(
      p2pPaymentDestinationEndpointResponse
    );

    const srvResolver = new SrvResolverMock();

    const paymentsClient = new PaymentsClient({ srvResolver });

    const sender = new Sender({
      handle: 'sender@example.com',
    });

    const result: PaymentIntent = await paymentsClient.initiatePayment({
      handle: handleToQuery,
      sender,
      satoshis: 1000,
    });

    const expectedResponse = {
      handle: handleToQuery,
      sender,
      outputs: expectedOutputs,
      reference: expectedReference,
    };

    expect(result).toEqual(expectedResponse);
  });

  it('can retrieve basic payment destination', async () => {
    const handleToQuery = 'test@example.com';
    const expectedOutputs = [
      {
        satoshis: 1000,
        script: '76a9146a83ec291893968ed985ef4cd50197040faeb6d888ac',
      },
    ];

    const basicPaymentDestinationEndpointResponse = {
      output: expectedOutputs[0].script,
    };

    const capabilityResponse = {
      paymentDestination:
        'https://bsvalias.example.org/{alias}@{domain.tld}/payment-destination',
    };

    isCapabilitySupportedForDomainMock.mockResolvedValueOnce(false);

    getCapabilitiesForDomainMock.mockResolvedValueOnce(capabilityResponse);

    requestPostMock.mockResolvedValueOnce(
      basicPaymentDestinationEndpointResponse
    );

    const srvResolver = new SrvResolverMock();

    const paymentsClient = new PaymentsClient({ srvResolver });

    const sender = new Sender({
      handle: 'sender@example.com',
    });

    const result: PaymentIntent = await paymentsClient.initiatePayment({
      handle: handleToQuery,
      sender,
      satoshis: 1000,
    });

    const expectedResponse: PaymentIntent = {
      handle: handleToQuery,
      sender,
      outputs: expectedOutputs,
    };

    expect(result).toEqual(expectedResponse);
  });

  it('throws exception if no private key is assigned to the sender, and sender validation is required', async () => {
    const handleToQuery = 'test@example.com';

    const capabilityResponse = {
      paymentDestination:
        'https://bsvalias.example.org/{alias}@{domain.tld}/payment-destination',
      '6745385c3fc0': true, // Sender validation enabled
    };

    isCapabilitySupportedForDomainMock.mockResolvedValueOnce(false);

    getCapabilitiesForDomainMock.mockResolvedValueOnce(capabilityResponse);

    const srvResolver = new SrvResolverMock();

    const paymentsClient = new PaymentsClient({ srvResolver });

    const sender = new Sender({
      handle: 'sender@example.com',
    });

    await expect(
      paymentsClient.initiatePayment({
        handle: handleToQuery,
        satoshis: 1000,
        sender,
      })
    ).rejects.toThrow(/^Signature is required before sending the request$/);
  });

  it('sends pubkey in basic payment destination request if Verify Public Key Owner capability is supported', async () => {
    const handleToQuery = 'test@example.com';
    const expectedOutputs = [
      {
        satoshis: 1000,
        script: '76a9146a83ec291893968ed985ef4cd50197040faeb6d888ac',
      },
    ];

    const basicPaymentDestinationEndpointResponse = {
      output: expectedOutputs[0].script,
    };

    const capabilityResponse = {
      paymentDestination:
        'https://bsvalias.example.org/{alias}@{domain.tld}/payment-destination',
      a9f510c16bde:
        'https://example.bsvalias.tld/api/{alias}@{domain.tld}/{pubkey}',
    };

    isCapabilitySupportedForDomainMock.mockResolvedValueOnce(false);

    getCapabilitiesForDomainMock.mockResolvedValueOnce(capabilityResponse);

    requestPostMock.mockResolvedValueOnce(
      basicPaymentDestinationEndpointResponse
    );

    const srvResolver = new SrvResolverMock();

    const paymentsClient = new PaymentsClient({ srvResolver });

    const privateKey = bsv.PrivateKey.fromWIF(
      'KyfTDHt4VVQ8qbnbg3DfdTjzxgJLVxJJmWiGoSTu4Tzt6okSX5UZ'
    );

    const expectedPublicKey = privateKey.publicKey;

    expect(expectedPublicKey.compressed).toEqual(true);

    const keyStore = new PlaintextPrivateKeyStore({
      privateKeyWif: privateKey.toWIF(),
    });

    const sender = new Sender({
      handle: 'sender@example.com',
      keyStore,
    });

    await paymentsClient.initiatePayment({
      handle: handleToQuery,
      sender,
      satoshis: 1000,
    });

    expect(requestPostMock.mock.calls[0][2].pubkey).toEqual(
      expectedPublicKey.toHex()
    );
  });

  it('raises exception if arguments are invalid', async () => {
    const handleToQuery = 'test@example.com';

    const srvResolver = new SrvResolverMock();

    const paymentsClient = new PaymentsClient({ srvResolver });

    const sender = new Sender({
      handle: 'sender@example.com',
    });

    // Invalid parameters
    await expect(paymentsClient.initiatePayment(undefined)).rejects.toThrow(
      /^`params` must be an object$/
    );

    // Invalid parameters
    await expect(paymentsClient.initiatePayment(null)).rejects.toThrow(
      /^`handle` must be a string$/
    );

    // Invalid handle type
    await expect(
      paymentsClient.initiatePayment({
        handle: {},
        sender,
        satoshis: 50,
      })
    ).rejects.toThrow(/^`handle` must be a string$/);

    // Invalid satoshis type
    await expect(
      paymentsClient.initiatePayment({
        handle: handleToQuery,
        sender,
        satoshis: '50',
      })
    ).rejects.toThrow(/^`satoshis` must be a finite integer$/);

    // Negative satoshis value
    await expect(
      paymentsClient.initiatePayment({
        handle: handleToQuery,
        sender,
        satoshis: -50,
      })
    ).rejects.toThrow(/^`satoshis` must be a positive integer$/);

    // Invalid sender type
    await expect(
      paymentsClient.initiatePayment({
        handle: handleToQuery,
        sender: null,
        satoshis: 50,
      })
    ).rejects.toThrow(/^`sender` must be an instance of Sender$/);
  });
});
