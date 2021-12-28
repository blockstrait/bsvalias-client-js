import { MapiClient } from '@blockstrait/mapi-client';

import { PaymentsClient } from '../src/payments-client';

jest.mock('@blockstrait/mapi-client');

const MapiClientMock = MapiClient as jest.MockedClass<typeof MapiClient>;
const SrvResolverMock = jest.fn();

describe('Payments client confirm payment function', () => {
  it('raises exception if arguments are invalid', async () => {
    const mapiClient = new MapiClientMock({ baseUrl: 'endpoint URL' });

    const srvResolver = new SrvResolverMock();

    const paymentsClient = new PaymentsClient({ srvResolver });

    await expect(paymentsClient.confirmPayment(undefined)).rejects.toThrow(
      /^`params` must be an object$/
    );

    await expect(paymentsClient.confirmPayment(null)).rejects.toThrow(
      /^`paymentIntent` must be an object$/
    );

    await expect(
      paymentsClient.confirmPayment({
        paymentIntent: true,
        rawTx: 'rawTx',
        mapiClient
      })
    ).rejects.toThrow(/^`paymentIntent` must be an object$/);

    await expect(
      paymentsClient.confirmPayment({
        paymentIntent: null,
        rawTx: 'rawTx',
        mapiClient
      })
    ).rejects.toThrow(/^`paymentIntent.outputs` must be an array$/);

    await expect(
      paymentsClient.confirmPayment({
        paymentIntent: {
          outputs: [],
          reference: null,
        },
        rawTx: 'rawTx',
        mapiClient
      })
    ).rejects.toThrow(/^`paymentIntent.reference` must be a string$/);

    await expect(
      paymentsClient.confirmPayment({
        paymentIntent: {
          outputs: [],
          reference: 'reference',
          sender: null,
        },
        rawTx: 'rawTx',
        mapiClient
      })
    ).rejects.toThrow(/^`paymentIntent.sender` must be an instance of Sender$/);
  });
});
