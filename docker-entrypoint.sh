#!/bin/sh
set -eu

# Commands supplied to docker run are maintenance commands, not application startup.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

node dist/database/prepare.js

exec node dist/main.js
