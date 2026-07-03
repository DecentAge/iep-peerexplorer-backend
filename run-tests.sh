#!/usr/bin/env bash
# Runs the jest integration tests against a throwaway mongod instance.
#
# Strategy (in order):
#   1. If `mongod` is on PATH, use it (system install).
#   2. Otherwise, use the binary that mongodb-memory-server downloads into
#      node_modules/.cache — we launch it from bash (Node's child_process.spawn
#      cannot execute that path in some environments due to sandboxing).
#
# Mongod is started on a free ephemeral port with a unique dbpath so concurrent
# runs never clash, and is always stopped on exit.
set -euo pipefail

MONGOD_DBPATH="$(mktemp -d -t iep-test-db.XXXXXX)"
MONGOD_LOG="$(mktemp -t iep-test-mongod.XXXXXX.log)"
MONGOD_PID=""
MONGOD_PORT=""
MONGOD_READY_TIMEOUT=15       # seconds to wait for mongod to accept connections
DOWNLOAD_TIMEOUT=120          # seconds to wait for binary download

export MONGOMS_DOWNLOAD_DIR="$(pwd)/.mongod-cache"
mkdir -p "$MONGOMS_DOWNLOAD_DIR"

cleanup() {
    local code=$?
    if [ -n "$MONGOD_PID" ] && kill -0 "$MONGOD_PID" 2>/dev/null; then
        kill "$MONGOD_PID" 2>/dev/null || true
        # Give mongod up to 5s to shut down gracefully, then force-kill
        for _ in 1 2 3 4 5; do
            kill -0 "$MONGOD_PID" 2>/dev/null || break
            sleep 1
        done
        kill -9 "$MONGOD_PID" 2>/dev/null || true
    fi
    rm -rf "$MONGOD_DBPATH" "$MONGOD_LOG" 2>/dev/null || true
    exit "$code"
}
trap cleanup EXIT INT TERM

# Pick a free port by letting the OS assign one, then closing it.
pick_free_port() {
    node -e "
        const net = require('net');
        const s = net.createServer();
        s.listen(0, '127.0.0.1', () => {
            const port = s.address().port;
            s.close(() => process.stdout.write(String(port)));
        });
    "
}

wait_for_mongod() {
    local deadline=$(( $(date +%s) + MONGOD_READY_TIMEOUT ))
    while true; do
        if ! kill -0 "$MONGOD_PID" 2>/dev/null; then
            echo "ERROR: mongod exited unexpectedly. Log:" >&2
            tail -40 "$MONGOD_LOG" >&2
            exit 1
        fi
        if node -e "
            const net = require('net');
            const s = net.createConnection($MONGOD_PORT, '127.0.0.1');
            s.on('connect', () => { s.destroy(); process.exit(0); });
            s.on('error',   () => process.exit(1));
          " 2>/dev/null; then
            return 0
        fi
        if [ "$(date +%s)" -ge "$deadline" ]; then
            echo "ERROR: mongod did not become ready within ${MONGOD_READY_TIMEOUT}s" >&2
            tail -40 "$MONGOD_LOG" >&2
            exit 1
        fi
        sleep 0.25
    done
}

find_or_download_binary() {
    echo "Locating mongod binary (may download on first run, up to ${DOWNLOAD_TIMEOUT}s)..." >&2
    local bin
    bin=$(timeout "$DOWNLOAD_TIMEOUT" node -e "
        const { MongoBinary } = require('mongodb-memory-server-core');
        MongoBinary.getPath().then(p => { process.stdout.write(p); process.exit(0); })
                             .catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
    " 2>/dev/null) || {
        echo "ERROR: Could not obtain mongod binary within ${DOWNLOAD_TIMEOUT}s." >&2
        echo "Install MongoDB to skip the download: https://www.mongodb.com/docs/manual/administration/install-on-linux/" >&2
        exit 1
    }
    echo "$bin"
}

if command -v mongod &>/dev/null; then
    MONGOD_BIN="mongod"
else
    MONGOD_BIN=$(find_or_download_binary)
fi

MONGOD_PORT=$(pick_free_port)
echo "Starting mongod on 127.0.0.1:${MONGOD_PORT} (dbpath=${MONGOD_DBPATH})..."

# Start in background (not --fork) so we own the PID and can reliably kill it.
"$MONGOD_BIN" --dbpath "$MONGOD_DBPATH" --port "$MONGOD_PORT" \
              --bind_ip 127.0.0.1 --logpath "$MONGOD_LOG" --quiet &
MONGOD_PID=$!

wait_for_mongod

export MONGO_TEST_URI="mongodb://127.0.0.1:${MONGOD_PORT}/iep_test"
echo "mongod ready. Running tests..."
node node_modules/jest/bin/jest.js --forceExit "$@"
