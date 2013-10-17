#!/bin/sh
./make.js $@
while true
  do inotifywait -e create -e delete -e modify -q -r src node_modules
  ./make.js $@
done
