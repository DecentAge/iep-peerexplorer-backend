/******************************************************************************
 * Copyright © 2017 XIN Community                                             *
 *                                                                            *
 * See the DEVELOPER-AGREEMENT.txt and LICENSE.txt files at  the top-level    *
 * directory of this distribution for the individual copyright  holder        *
 * information and the developer policies on copyright and licensing.         *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement, no part of the    *
 * XIN software, including this file, may be copied, modified, propagated,    *
 * or distributed except according to the terms contained in the LICENSE.txt  *
 * file.                                                                      *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

module.exports = {
    port: 8888,
    publicPath: process.env.PUBLIC_PATH || '/peerexplorer-backend',
    nodeApiHost: process.env.IEP_PEEREXPLORER_BACKEND_NODE_API_HOST || '199.127.137.169',
    nodeApiPort: process.env.IEP_PEEREXPLORER_BACKEND_NODE_API_PORT || '',
    removeInactiveAfterMinutes: process.env.IEP_PEEREXPLORER_BACKEND_REMOVE_INACTIVE_PEERS_MINUTES || 60,
    concurrent: 15,
    rankFactor:1.00,
    adminkey:'**YourAdminKeyHere**',
    logLevel: process.env.IEP_PEEREXPLORER_BACKEND_LOGLEVEL || 'info' // or debug for more details
};
