#!/bin/bash
set -euo pipefail

rm -rf dist
npm run build

cd dist

vercel link --yes --project av-codes
vercel --prod
