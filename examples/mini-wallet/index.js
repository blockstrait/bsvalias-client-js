'use strict';

const fs = require('fs');
const yargs = require('yargs');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const bsv = require('bsv');
const mkdir = require('make-dir');
const homedir = require('os').homedir();
const {
  PaymentsClient,
  Sender,
} = require('@blockstrait/bsvalias-payments-client');
const { MapiClient } = require('@blockstrait/mapi-client');

const miniWalletPath = `${homedir}/.mini-wallet`;
const keysPath = `${miniWalletPath}/.seed`;

async function readHdPrivateKey() {
  let xpriv = null;

  if (fs.existsSync(keysPath)) {
    const xprivStr = fs.readFileSync(keysPath, 'utf8');

    xpriv = bsv.HDPrivateKey.fromString(xprivStr);
  }

  return xpriv;
}

async function generateHdPrivateKey() {
  if (fs.existsSync(keysPath)) {
    throw new Error('secrets.key file already exists');
  }

  await mkdir(miniWalletPath);

  const xpriv = bsv.HDPrivateKey.fromRandom();

  fs.writeFileSync(keysPath, xpriv.toString());

  return xpriv;
}

async function getUtxos(address) {
  const utxoResponse = await axios.get(
    `https://api.whatsonchain.com/v1/bsv/main/address/${address.toString()}/unspent`
  );

  const utxos = [];

  for (let utxoResponseData of utxoResponse.data) {
    const scriptResponse = await axios.get(
      `https://api.whatsonchain.com/v1/bsv/main/tx/${utxoResponseData.tx_hash}/out/${utxoResponseData.tx_pos}/hex`
    );

    utxos.push(
      new bsv.Transaction.UnspentOutput({
        txid: utxoResponseData.tx_hash,
        outputIndex: utxoResponseData.tx_pos,
        address: address.toString(),
        script: scriptResponse.data,
        satoshis: utxoResponseData.value,
      })
    );
  }

  return utxos;
}

async function transferBsvToPaymail(handle, satoshis) {
  let xprv = await readHdPrivateKey();

  if (xprv === null) {
    xprv = await generateHdPrivateKey();
  }

  const privateKey = xprv.deriveChild("m/44'/0'/0'/0").privateKey;

  const address = privateKey.publicKey.toAddress();

  let message = `
#################################################################################
##
## Bitcoin Address: ${address.toString()}
##
#################################################################################\n\n`;

  console.log(message);

  qrcode.generate(`bitcoin:${address.toString()}?sv`, { small: true });

  const utxos = await getUtxos(address);

  if (utxos.length === 0) {
    console.log('No UTXOs found');

    process.exit(0);
  }

  message = `
#################################################################################
##
## UTXOS: ${utxos.map((utxo) => `\n##\n## ${utxo}`)}
##
#################################################################################\n\n`;

  console.log(message);

  const mapiClient = new MapiClient({
    baseUrl: 'https://mapi.taal.com',
  });

  const paymentsClient = new PaymentsClient();

  const sender = new Sender({
    handle: 'miniwallet@example.com',
  });

  const paymentIntent = await paymentsClient.initiatePayment({
    handle,
    sender,
    satoshis,
  });

  console.log(paymentIntent);

  const transaction = new bsv.Transaction().from(utxos);

  paymentIntent.outputs.forEach(output => {
    transaction.addOutput(
      new bsv.Transaction.Output({
        script: bsv.Script.fromHex(output.script),
        satoshis: output.satoshis,
      })
    );
  });

  transaction.change(address);
  transaction.sign(privateKey);

  console.log(transaction.toString());

  const { txid } = await paymentsClient.confirmPayment({
    paymentIntent,
    rawTx: transaction.toString(),
    mapiClient
  });

  console.log(`Transaction sent: ${txid}`);

  process.exit(0);
}

function main() {
  yargs
    .command('$0 send <paymail> <satoshis>', 'Mini wallet', {}, argv => {
      // TODO: arguments not used
      transferBsvToPaymail(argv.paymail, argv.satoshis);
    })
    .help().argv;
}

main();
