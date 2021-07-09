#!/bin/bash

while true
do
	git stage . 
    git commit -m "Automated commit"
	sleep 3
done