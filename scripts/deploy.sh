#!/bin/bash
set -e

rm -rf dist
yarn parcel build src/index.pug
yarn parcel build src/harbor-qr.pug
vercel --prod