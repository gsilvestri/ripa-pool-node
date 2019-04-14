# Lisk pool distribution software
This software is created by lisk delegate "dakk", please consider a small donation if you
use this software: "2324852447570841050L" for lisk or "7725849364280821971S" for shift or
"AZAXtswaWS4v8eYMzJRjpd5pN3wMBj8Rmk" for ark.


## Configuration
Fork this repo; edit config.json and modify the first lines with your settings:

- pubkey: your delegate pubkey
- percentage: percentage to distribute
- secret: your secret
- secondsecret: your second secret or null if disabled
- node: the lisk node where you get forging info
- nodepay: the lisk node used for payments
- minpayout: the minimum amount for a payout
- coin: the name of the coin (LISK, ARK, SHIFT, RISE, or whatever you want)
- skip: a list of address to skip
- donations: a list of object (address: amount) for send static amount every payout
- donationspercentage: a list of object (address: percentage) for send static percentage every payout
- logfile: file where you want to write pending and sent amounts

Now edit docs/index.html and customize the webpage.

Finally edit poollogs_example.json and put in lastpayout the unixtimestamp of your last payout or the
date of pool starting; then move poollogs_example.json to poollogs.json.

### Ark & Kapu
If you are using this software on ark, you should edit pollogs_example_ark.json and put:

- lastpayout: the unixtimestamp of your last payout or the date of pool starting 
- lastforged: the forged amount recorded in your last payout or the forged amount of pool starting

then move poollogs_example_ark.json to poollogs.json.

Also, replace docs/index.html with docs/index.ark.html

## Running it

First install requests:

`pip3 install requests`

Then start it:

`python3 liskpool.py`

or if you want to use another config file:

`python3 liskpool.py -c config2.json`

It produces a file "payments.sh" with all payments shell commands. Run this file with:

`bash payments.sh`

The payments will be broadcasted (every 10 seconds). At the end you can move your generated
poollogs.json to docs/poollogs.json and send the update to your git repo.

To display the pool frontend, enable docs-site on github repository settings.


## Batch mode

The script is also runnable by cron using the -y argument:

`python3 liskpool.py -y`

There is also a 'batch.sh' file which run liskpool, then payments.sh and copy the poollogs.json
in the docs folder.