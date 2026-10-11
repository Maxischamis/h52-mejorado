#!/bin/zsh
cd "$(dirname "$0")"
node build-data.mjs || exit 1
python3 preview.py
