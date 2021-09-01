# Infinity Economics Platform (IEP) Peer Explorer Backend
Infinity Economics is a new kind of cryptocurrency ecosystem equipped with total financial and economic features

This application is the backend for the Peer Explorer UI. A cronjob runs periodically to crawl, process and perform health checks on all peers in the network. It also removes peers if they are inactive for too long.

## Table of Contents
- [Getting Started](#getting-started)


## Features
- Crawl peers recursively via getPeers API
- Process peers to get peerState, Geo IP data and performance data for statistics
- Health check to always have a meaningful overview over the peers
- Clean process to remove peers that are inactive for a configurable amount of time
- Rest API for triggering some processes manually

## Getting Started
### Prerequisites

You need to have following tools installed:
````
node.js | version 10.24.1 or higher
````
````
npm | version 6.14.12 or higher
````

Install npm dependencies:
````
npm install
````

### Starting

Start the server:
````
npm run start
````

## Contributing

## License


## Credits


## Thanks
