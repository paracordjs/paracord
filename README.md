# Paracord

## Table of Contents

- [About](#about)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Requirements](#requirements)
  - [Installing](#installing)
  - [Optional Dependencies](#optional-dependencies)
- [Examples](#examples)
- [Missing Features](#missing-features)
- [Contributing](#contributing)
- [Licensing](#licensing)
- [Links](#links)

---

## About

A highly-scalable NodeJS framework built to interact with [Discord's API](https://discordapp.com/developers/docs/intro).

Paracord addresses an important problem that large bot owners will inevitably encounter, how to avoid the exponential costs of vertically scaling infrastructure in the cloud while maintaining high reliability and availability. Paracord solves this by utilizing clients and servers running [grpc](https://grpc.io/) to support limited interprocess communication between shards on remote hosts. Bots of all sizes can use this framework to get started and seamlessly transition to multi-shard and eventually multi-host configurations with the addition of just a few lines of code.

---

## Features

- Native horizontal scaling
- Fast and efficient inter-host communication with [grpc](https://grpc.io/)
- Leverages [pm2](https://pm2.keymetrics.io/) for individual shard logging and management
- Optional remote rate limit handling
- Limited abstractions, working closer to the API
- Modularized REST and Gateway clients

---

## Getting started

### Requirements

Paracord requires NodeJS 10.17+.

If you plan to shard, a global installation of [pm2](https://pm2.keymetrics.io/) is required. To install pm2 globally, run the following command:

```shell
npm install pm2 -g
```

### Installing

Getting started with any of the clients is as simple as installing the package into your project and importing the client you want.

```shell
npm install paracord
```

### Optional Dependencies

Optional dependencies should be installed with the package.
However, if you choose to not install them then here is what to know.

For sharding, the pm2 npm package will need to be installed to your project:

```shell
npm install pm2
```

If you plan to use the rpc services, you will need to install the grpc packages in the command below:

```shell
npm install grpc@1.24.2 @grpc/grpc-js@0.6.15 @grpc/proto-loader@0.5.3
```

---

## Examples

Importing a client into your project is easy.

```javascript
// This is an example. You can find more in the examples directory of this repo.
const { Paracord } = require("paracord");
```

The available clients are `Paracord`, `Api`, `Gateway`, `ShardLauncher`, and `Server`. In a generalized bot scenario, you will be using the `Paracord` client.

Examples with each client can be found in [docs/examples](examples/examples.md).

---

## Missing Features

At the moment, Paracord is missing some functionality that is common in Discord frameworks. they are listed here:

- Voice handling
- Connection compression

---

## Contributing

Right now there is no formal process for contributing. If you wish to start making contributions, please reach out to me, Lando#7777, first. You can find me in the [Paracord Discord](https://discord.gg/EBp3GCm).

---

## Licensing

The code in this project is licensed under the [Apache 2.0 license](LICENSE).

---

## Links

- Discord Server: https://discord.gg/EBp3GCm
- Repository: https://github.com/paracordjs/paracord
- Issue tracker: https://github.com/paracordjs/paracord/issues
  - In case of sensitive bugs like security vulnerabilities, please contact
    paracord@opayq.com directly instead of using issue tracker. We value your effort
    to improve the security and privacy of this project!
- Related projects:
  - Statbot: https://statbot.net/
