const mongoose = require('mongoose');

const CONNECT_TIMEOUT_MS = 10_000;

const MONGOOSE_OPTS = {
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
    socketTimeoutMS: CONNECT_TIMEOUT_MS,
};

let mongod = null;

async function connectTestDb() {
    if (process.env.MONGO_TEST_URI) {
        await mongoose.connect(process.env.MONGO_TEST_URI, MONGOOSE_OPTS);
        return;
    }

    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), MONGOOSE_OPTS);
}

async function disconnectTestDb() {
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
        mongod = null;
    }
}

module.exports = { connectTestDb, disconnectTestDb };
