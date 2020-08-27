#!/bin/bash
set -e

rm -rf dist
parcel build index.pug
vercel --prod