# `bsvalias` TypeScript client

## What is `bsvalias`?

`bsvalias` is a set of related protocols that allow BSV service providers to advertise the services they provide, and end-users to consume those services in a standardised manner. `bsvalias` is typically known as `Paymail` today, although `Paymail` is a subset of the `bsvalias` set of protocols.

One important aspect of the `bsvalias` standard is that it allows service providers to create their protocols and advertise them to clients that understand them. `bsvalias` clients can decide which services they want to consume and determine if a service provider supports them.

## Why is `bsvalias` important?

Before `bsvalias` existed, the only way to convey information to clients was to use Bitcoin addresses (which essentially encodes a specific output script to include in a transaction). As services become more sophisticated and feature-rich, more signalling is needed. Some use cases are:

- Offer wallet services that use custom script templates rather than the commonly-used P2PKH template.
- Receive transactions directly using an HTTP endpoint to avoid running a Bitcoin node to scan and filter all transactions.
- Offer the ability to receive other types of digital assets other than BSV (e.g. NFTs, collectables, etc...).

## About this library

This library has been developed after working with `bsvalias` and `Paymail` for a while. There are several benefits you gain by using this library:

- The library is organised into multiple packages. Each package deals with a specific feature offered to end-users, not individual capabilities. This is because some features use multiple capabilities at the same time.
- In case new functionality needs to be developed, this can be done outside of this library, and can reuse existing components as needed. Also, existing components can be re-written and hosted elsewhere without affecting this library.
- The packages provided try to offer complete functionality **whenever possible**. For example, if a transaction needs to be broadcasted, the library will do that for you rather than you having to do it outside the library itself.
- When external services are required to provide some functionality, standardised interfaces are used **whenever possible**. For example, this library will use the MAPI API interface to broadcast transactions.

## Building all packages

Execute the following commands from the top-level directory.

Install dependencies:

    npm install

Bootstrap all the packages:

    lerna bootstrap

Build all the packages:

    npm run build

## Building individual packages

Execute the following commands from a specific package folder (e.g. `packages/bsvalias-core`).

Install dependencies:

    npm install

Build all the packages:

    npm run build

## Testing

Execute the following command from the top-level directory to test all the packages or from each package folder to test a specific package:

    npm run test