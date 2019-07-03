#!/bin/bash
set -e

rm -rf dist
parcel build index.pug
cp ./now.json ./dist/now.json
cd ./dist
now --name av.codes --target production