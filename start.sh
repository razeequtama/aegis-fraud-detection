#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo " Starting AEGIS Fraud Detection System "
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PATH="${SCRIPT_DIR}/.env"
ENV_EXAMPLE_PATH="${SCRIPT_DIR}/.env.example"

# Ensure .env configuration file exists before container orchestration
if [ ! -f "${ENV_PATH}" ]; then
    if [ -f "${ENV_EXAMPLE_PATH}" ]; then
        echo "Notice: .env file not found. Initializing .env from .env.example..."
        cp "${ENV_EXAMPLE_PATH}" "${ENV_PATH}"
        echo "Created .env configuration successfully."
    else
        echo "Error: Neither .env nor .env.example was found. Cannot start services." >&2
        exit 1
    fi
fi

# Build and start all containers in detached mode
echo "Building and starting containers in detached mode..."
docker compose up --build -d

# Wait for frontend service to be responsive on http://localhost:5173
echo "Waiting for frontend to become available on http://localhost:5173..."
MAX_RETRIES=60
RETRY=0
READY=0

while [ "${RETRY}" -lt "${MAX_RETRIES}" ]; do
    if curl -fsSL -o /dev/null -m 2 http://localhost:5173 2>/dev/null; then
        READY=1
        break
    fi
    sleep 1
    RETRY=$((RETRY + 1))
done

if [ "${READY}" -eq 1 ]; then
    echo "Frontend is ready at http://localhost:5173"
    # Attempt to open default browser if desktop environment is present
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open http://localhost:5173 >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then
        open http://localhost:5173 >/dev/null 2>&1 || true
    fi
else
    echo "Timed out waiting for frontend. Viewing logs..."
fi

echo "Streaming Docker Compose logs (Press Ctrl+C to detach)..."
docker compose logs -f

