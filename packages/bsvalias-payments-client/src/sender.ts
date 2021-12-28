import { KeyStore } from '@blockstrait/bitcoin-keystore';

/* eslint @typescript-eslint/no-require-imports: "off" */
const bsv = require('bsv');
const Message = require('bsv/message');

export interface SenderParams {
  handle: string;
  keyStore?: KeyStore;
}

export interface BasicSenderInfo {
  dt: Date;
  amount?: number;
  purpose?: string;
}

export class Sender {
  public handle: string;
  private keyStore?: KeyStore;

  constructor(params: SenderParams) {
    const { handle, keyStore } = params;

    this.handle = handle;

    this.keyStore = keyStore;

    if (this.keyStore && !(this.keyStore instanceof KeyStore)) {
      throw new Error('`keyStore` must be an instance of KeyStore');
    }
  }

  canSignSenderInfo(): boolean {
    return this.keyStore === undefined ? false : true;
  }

  getPublicKey(): Promise<string> {
    if (this.keyStore === undefined) {
      throw new Error('Sender does not have a valid key store');
    }

    return this.keyStore.getPublicKey();
  }

  async signBasicSenderInfo(senderInfo: BasicSenderInfo): Promise<string> {
    if (this.keyStore === undefined) {
      throw new Error('Sender cannot sign basic sender information');
    }

    const { amount, dt, purpose } = senderInfo;

    const parts = [this.handle, amount || '0', dt, purpose];

    const buffer = Buffer.from(parts.join(''));

    const messageToSign = new Message(buffer);

    const messageHash = messageToSign.magicHash();

    const derSignature = await this.keyStore.sign(messageHash);

    const signature = bsv.crypto.Signature.fromString(derSignature);

    return signature.toString('base64');
  }

  async signP2pInfo(txid: string): Promise<string> {
    if (this.keyStore === undefined) {
      throw new Error('Sender cannot sign p2p information');
    }

    const parts = [txid];

    const buffer = Buffer.from(parts.join(''));

    const messageToSign = new Message(buffer);

    const messageHash = messageToSign.magicHash();

    const derSignature = await this.keyStore.sign(messageHash);

    const signature = bsv.crypto.Signature.fromString(derSignature);

    return signature.toString('base64');
  }
}
