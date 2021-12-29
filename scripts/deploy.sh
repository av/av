#!/bin/bash
set -e

rm -rf dist
yarn parcel build src/index.pug
vercel --prod