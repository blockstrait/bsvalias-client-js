import {
  Request,
  CapabilityResolver,
  Capabilities,
  DohSrvResolver,
  SrvResolver,
  Validators,
  BsvAliasClientConfigurationError,
  BsvAliasCapabilityNotSupportedError,
  BsvAliasUnexpectedServerResponseError,
} from '@blockstrait/bsvalias-core';

import { MapiClient } from '@blockstrait/mapi-client';

import { Sender } from './sender';

/**
 * BRFC ID of the P2P Payment Destination capability.
 */
const P2P_PAYMENT_DESTINATION_BRFC = '2a40af698840';

/**
 * BRFC ID of the P2P Transactions capability.
 */
const P2P_TRANSACTIONS_BRFC = '5f1323cddf31';

/**
 * BRFC ID of the Basic Payment Destination capability.
 */
const BASIC_PAYMENT_RESOLUTION_BRFC = 'paymentDestination';

/**
 * BRFC ID of the Sender Validation capability.
 */
const SENDER_VALIDATION_BRFC = '6745385c3fc0';

/**
 * Response format returned by a Basic Payment Destination endpoint.
 */
interface BasicPaymentDestinationResponse {
  output: string;
}

/**
 * Response format returned by a P2P Payment Destination endpoint.
 */
interface P2pPaymentDestinationResponse {
  reference: string;
  outputs: Output[];
}

/**
 * Response format returned by a P2P Transaction endpoint.
 */
interface P2pTransactionResponse {
  txid: string;
  note?: string;
}

/**
 * Parameters to pass to the private getBasicPaymentDestination() method.
 */
interface GetBasicPaymentDestinationParams {
  sender: Sender;
  handle: string;
  satoshis: number;
  purpose?: string;
}

export interface PaymentsClientParams {
  srvResolver?: SrvResolver;
  request?: Request;
}

/**
 * Parameters to pass to the initialPayment() method.
 */
export interface InitiatePaymentParams {
  handle: string;
  satoshis: number;
  sender: Sender;
}

/**
 * Representation of an output returned.
 */
export interface Output {
  satoshis: number;
  script: string;
}

/**
 * Result returned by the initiatePayment() method.
 */
export interface PaymentIntent {
  handle: string;
  outputs: Output[];
  reference?: string;
  sender?: Sender;
}

/**
 * Parameters to pass to the confirmPayment() method.
 */
export interface ConfirmPaymentParams {
  paymentIntent: PaymentIntent;
  mapiClient: MapiClient;
  rawTx: string;
}

/**
 * Result returned by the confirmPayment() method.
 */
export interface ConfirmPaymentResult {
  txid: string;
}

function checkInitiatePaymentParams(params: InitiatePaymentParams) {
  if (typeof params !== 'object') {
    throw new TypeError('`params` must be an object');
  }

  const { handle, satoshis, sender } = params || {};

  Validators.checkPaymailHandle(handle);

  if (!Number.isFinite(satoshis)) {
    throw new TypeError('`satoshis` must be a finite integer');
  }

  if (satoshis < 0) {
    throw new Error('`satoshis` must be a positive integer');
  }

  if (!(sender instanceof Sender)) {
    throw new TypeError('`sender` must be an instance of Sender');
  }
}

function checkConfirmPaymentParams(params: ConfirmPaymentParams) {
  if (typeof params !== 'object') {
    throw new TypeError('`params` must be an object');
  }

  const { paymentIntent, rawTx, mapiClient } = params || {};

  if (typeof paymentIntent !== 'object') {
    throw new TypeError('`paymentIntent` must be an object');
  }

  if (!Array.isArray(paymentIntent?.outputs)) {
    throw new TypeError('`paymentIntent.outputs` must be an array');
  }

  if (
    paymentIntent.reference !== undefined &&
    typeof paymentIntent.reference !== 'string'
  ) {
    throw new TypeError('`paymentIntent.reference` must be a string');
  }

  if (
    paymentIntent.sender !== undefined &&
    !(paymentIntent.sender instanceof Sender)
  ) {
    throw new TypeError('`paymentIntent.sender` must be an instance of Sender');
  }

  if (!(mapiClient instanceof MapiClient)) {
    throw new TypeError('`mapiClient`must be an instance of MapiClient');
  }

  if (typeof rawTx !== 'string') {
    throw new TypeError('`rawTx` must be a string');
  }
}

function checkGetBasicPaymentDestinationParams(
  params: GetBasicPaymentDestinationParams
) {
  if (typeof params !== 'object') {
    throw new TypeError('`params` must be an object');
  }

  const { handle, satoshis, sender, purpose } = params || {};

  Validators.checkPaymailHandle(handle);

  if (!Number.isFinite(satoshis)) {
    throw new TypeError('`satoshis` must be a finite integer');
  }

  if (satoshis < 0) {
    throw new Error('`satoshis` must be a positive integer');
  }

  if (!(sender instanceof Sender)) {
    throw new TypeError('`sender` must be an instance of Sender');
  }

  if (purpose && typeof purpose !== 'string') {
    throw new TypeError('`purpose` must be a string');
  }
}

/**
 * Start a payment to a specific paymail.
 */
export class PaymentsClient {
  private capabilityResolver: CapabilityResolver;
  private request: Request;

  constructor(params?: PaymentsClientParams) {
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

  async getBasicPaymentDestination(
    params: GetBasicPaymentDestinationParams
  ): Promise<Output> {
    checkGetBasicPaymentDestinationParams(params);

    const { handle, satoshis, purpose, sender } = params;

    const [alias, domainName] = handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined =
      capabilities[BASIC_PAYMENT_RESOLUTION_BRFC];

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No basic payment destination capability found'
      );
    }

    if (typeof urlTemplate !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const basicPaymentDestinationUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName);

    const now = new Date(Date.now());

    const basicPaymentDestinationPostData: any = {
      senderHandle: sender.handle,
      amount: satoshis,
      dt: now.toISOString(),
    };

    if (purpose) {
      basicPaymentDestinationPostData.purpose = purpose;
    }

    const canSignSenderInfo = sender.canSignSenderInfo();

    const senderValidationEnabled: boolean | undefined =
      capabilities[SENDER_VALIDATION_BRFC];

    if (senderValidationEnabled === true && !canSignSenderInfo) {
      throw new BsvAliasClientConfigurationError(
        'Signature is required before sending the request'
      );
    }

    if (canSignSenderInfo) {
      basicPaymentDestinationPostData.signature =
        await sender.signBasicSenderInfo({
          amount: satoshis,
          dt: now,
          purpose,
        });

      basicPaymentDestinationPostData.pubkey = await sender.getPublicKey();
    }

    const response: BasicPaymentDestinationResponse = await this.request.post(
      basicPaymentDestinationUrl,
      {},
      basicPaymentDestinationPostData
    );

    return {
      satoshis,
      script: response.output,
    };
  }

  /**
   * @internal
   */
  private async initiateP2pPayment(
    handle: string,
    satoshis: number
  ): Promise<any> {
    const [alias, domainName] = handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined =
      capabilities[P2P_PAYMENT_DESTINATION_BRFC];

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No P2P payment destination capability found'
      );
    }

    if (typeof urlTemplate !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const p2pPaymentDestinationUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName);

    const p2pPaymentDestinationPostData: any = {
      satoshis,
    };

    const response: P2pPaymentDestinationResponse = await this.request.post(
      p2pPaymentDestinationUrl,
      {},
      p2pPaymentDestinationPostData
    );

    return {
      reference: response.reference,
      outputs: response.outputs,
    };
  }

  /**
   * @internal
   */
  private async notifyP2pEndpoint(txid: string, params: ConfirmPaymentParams) {
    const { paymentIntent, rawTx } = params;

    if (paymentIntent.reference === undefined) {
      throw new Error('Reference must be specified');
    }

    const [alias, domainName] = paymentIntent.handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined = capabilities[P2P_TRANSACTIONS_BRFC];

    if (typeof urlTemplate !== 'string') {
      throw new Error('No P2P transaction capability found');
    }

    const paymentNotificationUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName);

    const postData: any = {
      hex: rawTx,
      reference: paymentIntent.reference,
    };

    if (paymentIntent.sender) {
      postData.metadata = {
        sender: paymentIntent.sender.handle,
      };
    }

    if (paymentIntent.sender && paymentIntent.sender.canSignSenderInfo()) {
      postData.metadata.pubkey = await paymentIntent.sender.getPublicKey();
      postData.metadata.signature = await paymentIntent.sender.signP2pInfo(
        txid
      );
    }

    const response: P2pTransactionResponse = await this.request.post(
      paymentNotificationUrl,
      {},
      postData
    );

    return {
      txid: response.txid,
      note: response.note,
    };
  }

  /**
   * Initiate a payment against a paymail handle. The recipient may or may not support P2P payments.
   */
  async initiatePayment(params: InitiatePaymentParams): Promise<PaymentIntent> {
    checkInitiatePaymentParams(params);

    const { handle, satoshis, sender } = params;

    const paymailHandleParts = handle.split('@');

    const domainName = paymailHandleParts[1];

    const isP2pPaymentDestinationSupported =
      await this.capabilityResolver.isCapabilitySupportedForDomain(
        P2P_PAYMENT_DESTINATION_BRFC,
        domainName
      );

    let result: PaymentIntent;

    if (isP2pPaymentDestinationSupported) {
      const { outputs, reference } = await this.initiateP2pPayment(
        handle,
        satoshis
      );

      result = {
        handle,
        sender,
        reference,
        outputs,
      };
    } else {
      const output: Output = await this.getBasicPaymentDestination({
        handle,
        satoshis,
        sender,
      });

      result = {
        handle,
        sender,
        outputs: [output],
      };
    }

    return result;
  }

  /**
   * Confirm payment by providing a signed transaction.
   */
  async confirmPayment(
    params: ConfirmPaymentParams
  ): Promise<ConfirmPaymentResult> {
    checkConfirmPaymentParams(params);

    const { paymentIntent, mapiClient, rawTx } = params;

    const r = await mapiClient.submitTransaction({ rawTx });

    const txid = r.txid;

    const isP2pPayment = paymentIntent.reference === undefined ? false : true;

    if (isP2pPayment) {
      await this.notifyP2pEndpoint(txid, params);
    }

    return { txid };
  }
}
