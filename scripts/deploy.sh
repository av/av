#!/bin/bash
set -e

rm -rf dist
parcel build src/index.pug
vercel --prod