#!/usr/bin/env bash
set -euo pipefail

docker builder prune -af
docker image prune -af
