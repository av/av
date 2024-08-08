#!/bin/bash
set -e

rm -rf dist
yarn parcel build src/index.pug
yarn parcel build src/harbor-qr.pug

cp -r public/* dist/
cd dist

vercel --prod