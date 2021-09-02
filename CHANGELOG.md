# Release 0.3.2
- added readme
- refactored crawling process to recursively check for peers
- all connected peers are now stored in db, even if no peerState is available
- refactored global stats data accumulation
- refactored peer state data accumulation
- refactored geoIp data accumulation
- refactored error handling
- refactored logging/implemented logging mechanism for debug/testing/production
- refactored asynchronous functions to async/await instead of callbacks
- cronjob now running tasks sequentially to avoid overlapped processing of peers
- removed blacklist/whitelist mechanism (nodes already have blacklist functionality)
- implemented health check mechanism to flag peers as inactive when they are not returned by getPeers anymore
- implemented clean mechanism to delete peers that are inactive for a configurable amount of time

# Release 0.3.0
- dockerized project
- fix db connection
- added gitlab ci/cd config
- moved base app folder to root
- updated nodejs version
- up mongoose version
- fix geo ip lookup
- add  additional logging for debugging
- adjust browsersync to take port and public path from process env
- added ip server IP
- catch parse error when parsing node response for peerstate
- use fetch for bootnodes
- added npm dependency envsub
