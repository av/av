#!/bin/bash
set -euo pipefail

rm -rf dist
npm run build

cd dist

vercel --prod
