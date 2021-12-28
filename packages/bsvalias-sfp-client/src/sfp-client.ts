import {
  Request,
  CapabilityResolver,
  Capabilities,
  DohSrvResolver,
  SrvResolver,
  Validators,
  BsvAliasCapabilityNotSupportedError,
  BsvAliasUnexpectedServerResponseError,
} from '@blockstrait/bsvalias-core';

import { MapiClient } from '@blockstrait/mapi-client';

import { Sender } from './sender';

/**
 * BRFC ID of the P2P Payment Destination capability.
 */
const P2P_PAYMENT_DESTINATION_WITH_TOKEN_SUPPORT_BRFC = 'f792b6eff07a';

/**
 * BRFC ID of the Build Asset capability.
 */
const BUILD_ASSET_TRANSACTION_BRFC = '189e32d93d28';

/**
 * BRFC ID of the Authorize Transaction capability.
 */
const AUTHORIZE_TRANSACTION_BRFC = '95dddb461bff';

/**
 * BRFC ID of the P2P Transactions capability.
 */
const P2P_TRANSACTIONS_BRFC = '5f1323cddf31';

/**
 * BRFC ID of the Asset Information capability.
 */
const ASSET_INFORMATION_BRFC = '1300361cb2d4';

/**
 * Response format returned by a P2P Payment Destination endpoint.
 */
interface AssetTransferEndpointResponse {
  reference: string;
  outputs: Output[];
}

interface SigOperation {
  nScriptChunk: number;
  type: string;
  addressStr: string;
  nHashType: number;
}

/**
 * Response format returned by a Build Action endpoint.
 */
export interface BuidlActionEndpointResponse {
  hex: string;
  sigOperations: SigOperation[];
}

/**
 * Response format returned by a Authorize Transaction endpoint.
 */
export interface AuthorizeTransactionEndpointResponse {
  hex: string;
}

/**
 * Response format returned by a P2P Transaction endpoint.
 */
interface P2pTransactionResponse {
  txid: string;
  note?: string;
}

interface ProtocolData {
  authorizerPubkey: string;
}

/**
 * A response from the asset information endpoint.
 */
interface AssetInformationResponse {
  name: string;
  protocol: string;
  protocolData?: ProtocolData;
  supply?: string;
  alias?: string;
  description?: string;
  avatar?: string;
  url?: string;
}

export interface SfpClientParams {
  srvResolver?: SrvResolver;
  request?: Request;
}

/**
 * Parameters to pass to the initiateAssetTransfer() method.
 */
export interface InitiateAssetTransferParams {
  handle: string;
  amount: number;
  sender: Sender;
  asset?: string;
}

/**
 * Output elements to be passed to the buildAssetTransaction() method.
 */
interface BuildAssetOutputs {
  asset: string;
  address: string;
  amount: number;
  notes?: string;
}

/**
 * Parameters to pass to the buildAssetTransaction() method.
 */
export interface BuildAssetTransactionParams {
  hex: string;
  outputs: BuildAssetOutputs[];
}

/**
 * Representation of an output returned.
 */
export interface Output {
  satoshis: number;
  script: string;
}

/**
 * Result returned by the initiateAssetTransfer() method.
 */
export interface InitiateAssetTransferResult {
  outputs: Output[];
  reference: string;
  sender?: Sender;
}

/**
 * Result returned by the initiateAssetTransfer() method.
 */
export interface AssetTransferIntent {
  handle: string;
  outputs: Output[];
  reference: string;
  sender: Sender;
}

/**
 * Parameters to pass to the confirmAssetTransfer() method.
 */
export interface ConfirmAssetTransferParams {
  assetTransferIntent: AssetTransferIntent;
  mapiClient: MapiClient;
  rawTx: string;
}

/**
 * Result returned by the confirmAssetTransfer() method.
 */
export interface ConfirmAssetTransferResult {
  txid: string;
}

/**
 * Parameters to pass to the authorizeTransaction() method.
 */
export interface AuthorizeTransactionParams {
  assetPaymail: string;
  hex: string;
}

function checkInitiateAssetTransferParams(params: InitiateAssetTransferParams) {
  if (typeof params !== 'object') {
    throw new TypeError('`params` must be an object');
  }

  const { handle, amount, asset, sender } = params || {};

  Validators.checkPaymailHandle(handle);

  if (!Number.isFinite(amount)) {
    throw new TypeError('`amount` must be a finite integer');
  }

  if (amount < 0) {
    throw new Error('`amount` must be a positive integer');
  }

  if (asset && typeof asset !== 'string') {
    throw new TypeError('`asset` must be a string');
  }

  if (!(sender instanceof Sender)) {
    throw new TypeError('`sender` must be an instance of Sender');
  }
}

function checkConfirmAssetTransferParams(params: ConfirmAssetTransferParams) {
  if (typeof params !== 'object') {
    throw new TypeError('`params` must be an object');
  }

  const { assetTransferIntent, rawTx, mapiClient } = params || {};

  if (typeof assetTransferIntent !== 'object') {
    throw new TypeError('`assetTransferIntent` must be an object');
  }

  if (!Array.isArray(assetTransferIntent?.outputs)) {
    throw new TypeError('`assetTransferIntent.outputs` must be an array');
  }

  if (
    assetTransferIntent.reference !== undefined &&
    typeof assetTransferIntent.reference !== 'string'
  ) {
    throw new TypeError('`assetTransferIntent.reference` must be a string');
  }

  if (
    assetTransferIntent.sender !== undefined &&
    !(assetTransferIntent.sender instanceof Sender)
  ) {
    throw new TypeError(
      '`assetTransferIntent.sender` must be an instance of Sender'
    );
  }

  if (!(mapiClient instanceof MapiClient)) {
    throw new TypeError('`mapiClient`must be an instance of MapiClient');
  }

  if (typeof rawTx !== 'string') {
    throw new TypeError('`rawTx` must be a string');
  }
}

function checkAuthorizeTransactionParams(params: AuthorizeTransactionParams) {
  if (typeof params !== 'object') {
    throw new TypeError('`params` must be an object');
  }

  const { assetPaymail, hex } = params;

  Validators.checkPaymailHandle(assetPaymail);

  if (typeof hex !== 'string') {
    throw new TypeError('`hex` must be a string');
  }
}

function checkBuildAssetTransactionParams(params: BuildAssetTransactionParams) {
  if (typeof params !== 'object') {
    throw new TypeError('`params` must be an object');
  }

  const { hex, outputs } = params;

  if (typeof hex !== 'string') {
    throw new TypeError('`hex` must be a string');
  }

  if (!Array.isArray(outputs)) {
    throw new TypeError('`outputs` must be an array');
  }
}

/**
 * Start an asset transfer to a specific paymail.
 */
export class SfpClient {
  private capabilityResolver: CapabilityResolver;
  private request: Request;

  constructor(params?: SfpClientParams) {
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

  async initiateAssetTransfer(
    params: InitiateAssetTransferParams
  ): Promise<InitiateAssetTransferResult> {
    checkInitiateAssetTransferParams(params);

    const { handle, amount, asset, sender } = params;

    if (amount < 0) {
      throw new Error('`amount` must be a positive integer');
    }

    const [alias, domainName] = handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined =
      capabilities[P2P_PAYMENT_DESTINATION_WITH_TOKEN_SUPPORT_BRFC];

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No p2p asset transfer destination capability found'
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

    const postData: any = {
      amount,
      protocol: 'SFP',
      asset,
    };

    const response: AssetTransferEndpointResponse = await this.request.post(
      p2pPaymentDestinationUrl,
      {},
      postData
    );

    return {
      sender,
      reference: response.reference,
      outputs: response.outputs,
    };
  }

  private async notifyP2pEndpoint(
    txid: string,
    params: ConfirmAssetTransferParams
  ) {
    const { assetTransferIntent, rawTx } = params;

    const [alias, domainName] = assetTransferIntent.handle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined = capabilities[P2P_TRANSACTIONS_BRFC];

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No P2P transaction capability found'
      );
    }

    if (typeof urlTemplate !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const paymentNotificationUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName);

    const postData: any = {
      hex: rawTx,
      reference: assetTransferIntent.reference,
    };

    if (assetTransferIntent.sender) {
      if (!(assetTransferIntent.sender instanceof Sender)) {
        throw new TypeError('`sender` must be an instance of Sender');
      }

      postData.metadata = {
        sender: assetTransferIntent.sender.handle,
      };
    }

    if (
      assetTransferIntent.sender &&
      assetTransferIntent.sender.canSignSenderInfo()
    ) {
      postData.metadata.pubkey =
        await assetTransferIntent.sender.getPublicKey();
      postData.metadata.signature =
        await assetTransferIntent.sender.signP2pInfo(txid);
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

  async buildAssetTransaction(
    params: BuildAssetTransactionParams
  ): Promise<BuidlActionEndpointResponse> {
    checkBuildAssetTransactionParams(params);

    const { hex, outputs } = params;

    const paymailHandleParts = outputs[0].asset.split('@');

    const domainName = paymailHandleParts[1];

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const url: string | undefined = capabilities[BUILD_ASSET_TRANSACTION_BRFC];

    if (typeof url === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No build action capability found'
      );
    }

    if (typeof url !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const postData: any = {
      hex,
      outputs,
    };

    const response: BuidlActionEndpointResponse = await this.request.post(
      url,
      {},
      postData
    );

    return response;
  }

  async authorizeTransaction(
    params: AuthorizeTransactionParams
  ): Promise<AuthorizeTransactionEndpointResponse> {
    checkAuthorizeTransactionParams(params);

    const { hex, assetPaymail } = params;

    const assetPaymailHandleParts = assetPaymail.split('@');

    const domainName = assetPaymailHandleParts[1];

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const url: string | undefined = capabilities[AUTHORIZE_TRANSACTION_BRFC];

    if (typeof url === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No authorize transaction capability found'
      );
    }

    if (typeof url !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const postData: any = { hex };

    const response: AuthorizeTransactionEndpointResponse =
      await this.request.post(url, {}, postData);

    return response;
  }

  /**
   * Confirm asset transfer by submitting the signed transaction.
   */
  async confirmAssetTransfer(
    params: ConfirmAssetTransferParams
  ): Promise<ConfirmAssetTransferResult> {
    checkConfirmAssetTransferParams(params);

    const { rawTx, mapiClient } = params;

    const r = await mapiClient.submitTransaction({ rawTx });

    const txid = r.txid;

    await this.notifyP2pEndpoint(txid, params);

    return { txid };
  }

  /**
   * Obtain asset information.
   */
  async requestAssetInformation(
    assetHandle: string
  ): Promise<AssetInformationResponse> {
    Validators.checkPaymailHandle(assetHandle);

    const [alias, domainName] = assetHandle.split('@');

    const capabilities: Capabilities =
      await this.capabilityResolver.getCapabilitiesForDomain(domainName);

    const urlTemplate: string | undefined =
      capabilities[ASSET_INFORMATION_BRFC];

    if (typeof urlTemplate === undefined) {
      throw new BsvAliasCapabilityNotSupportedError(
        'No asset information capability found'
      );
    }

    if (typeof urlTemplate !== 'string') {
      throw new BsvAliasUnexpectedServerResponseError(
        'Capability information must be a string'
      );
    }

    const assetInformationUrl = urlTemplate
      .replace('{alias}', alias)
      .replace('{domain.tld}', domainName);

    const response: AssetInformationResponse = await this.request.get(
      assetInformationUrl,
      { responseType: 'json' }
    );

    return response;
  }
}
