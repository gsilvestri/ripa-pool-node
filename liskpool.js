const fs = require('fs');
const readlineSync = require('readline-sync');
const request = require('request-promise');
const HEADER_VERSION = require('./package.json').version;
const DEFAULT_CONFIG = 'config.json';
const DEFAULT_POOLLOGS = 'docs/poollogs.json';
const DEFAULT_PAYMENTS = 'payments.json';
const DEFAULT_PASSPHRASES = 'passphrases.json';
var logger = require('winston');
logger.level = 'debug';
var config = require('./' + DEFAULT_CONFIG);
var poollogs = require('./' + DEFAULT_POOLLOGS);
var payments = require('./' + DEFAULT_PAYMENTS);
var passphrases = require('./' + DEFAULT_PASSPHRASES);

pool();

async function broadcastPayments(_config, _payments, _passphrases, _passphrasesFilename) {

	logger.info('Passphrases Filename: ' + _passphrasesFilename);
	logger.info('API endpoint: %s', _config.node);
	if (_payments !== null) {
		logger.debug('Payments array: %s', JSON.stringify(payments, null, 4));
		var uri = _config.node + _config.GET_NET_HASH_ENDPOINT;
		var nethashResponse = await request.get({url: uri,  json: true,	method: 'GET',headers: {
            'Content-Type': _config.HEADER_CONTENT_TYPE,
            'os': _config.HEADER_OS,
            'version': HEADER_VERSION,
            'port': _config.HEADER_PORT,
            'nethash': 'wrong-nethash'}
		});
		logger.debug('NetHash: ' + JSON.stringify(nethashResponse, null, 4));
	}
}


async function pool() {
	
	var configFilename = DEFAULT_CONFIG;
	var poollogsFilename = DEFAULT_POOLLOGS;
	var paymentsFilename = DEFAULT_PAYMENTS;
	var passphrasesFilename = DEFAULT_PASSPHRASES;
	var autosave = false;
	for (let j = 0; j < process.argv.length; j++) {  
		logger.debug(j + ' -> ' + (process.argv[j]));
		if (process.argv[j] === '-c') {
			configFilename = process.argv[j + 1];
		}
		if (process.argv[j] === '-y') {
			autosave = true
		}
	}
	if (configFilename !== DEFAULT_CONFIG) {
		//load custom config file
		var configFile = fs.readFileSync('./' + configFilename);
		config = JSON.parse(configFile);
	}
	if (config.logfile) {
		if (config.logfile !== DEFAULT_POOLLOGS) {
			//load custom poollogs file
			poollogsFilename = config.logfile;
			var poollogsFile = fs.readFileSync('./' + config.logfile);
			poollogs = JSON.parse(poollogsFile);
		}
	}
	if (config.paymentsFile) {
		if (config.paymentsFile !== DEFAULT_PAYMENTS) {
			//load custom payments file
			paymentsFilename = config.paymentsFile;
			var paymentsFile = fs.readFileSync('./' + config.paymentsFile);
			payments = JSON.parse(paymentsFile);
		}
	}
	if (config.secret) {
		if (config.secret !== DEFAULT_PASSPHRASES) {
			//load custom passphrases file
			passphrasesFilename = config.secret;
			var passphrasesFile = fs.readFileSync('./' + config.secret);
			passphrases = JSON.parse(passphrasesFile);
		}
	}
	logger.info('Config Filename: ' + configFilename);
	logger.debug('Config: ' + JSON.stringify(config, null, 4));
	logger.info('Poollogs Filename: ' + poollogsFilename);
	logger.debug('Poollogs: ' + JSON.stringify(poollogs, null, 4));
	var estimatePayoutsResult = await estimatePayouts(config, poollogs);
	logger.debug('Result pool(): ' + JSON.stringify(estimatePayoutsResult, null, 4));
	var payouts = estimatePayoutsResult.payouts;
	var log = estimatePayoutsResult.log;
	var forged = estimatePayoutsResult.forged;
	if (payouts && log && forged) {
		if (payouts.length > 0) {
			logger.info('Payments Filename: ' + paymentsFilename);
			payments.transactions = [];
			payments.transactionsPending = [];
			payments.donations = [];
			payments.donationsPercentage = [];
			logger.debug('Payments: ' + JSON.stringify(payments, null, 4));
			for (var i = 0; i < payouts.length; i++) {
				var address = payouts[i].address;
				var balance = payouts[i].balance;
				if (!log.accounts[address] && (balance != 0.0)) {
					log.accounts[address] = {pending: 0.0, received: 0.0 };
				}
				if ((balance > 0.0) && (balance < config.minpayout)) {
					log.accounts[address].pending += balance;
					continue
				} else {
					log.accounts[address].received += balance;
					payments.transactions.push({recipientId: address, amount: balance * 100000000});
				}
			}
			for (var y in log.accounts) {
				var amountPending = log.accounts[y].pending; 
				if (amountPending > config.minpayout) {
					payments.transactionsPending.push({recipientId: y, amount: amountPending * 100000000});
					log.accounts[y].received += amountPending;
					log.accounts[y].pending = 0.0;
				}
			}
			if (config.donations) {
				for (var y in config.donations) {
					payments.donations.push({recipientId: y, amount: log.accounts[y] * 100000000});
				}	
			}
			if (config.donationspercentage) {
				for (var y in config.donationspercentage) {
					var am = forged * config.donationspercentage[y] / 100;
					payments.donationsPercentage.push({recipientId: y, amount: am * 100000000});
				}	
			}
			log.lastpayout = Math.floor(Date.now() / 1000);
			var save = false;
			if (autosave) {
				save = true;
			} else {
				logger.info('Poollogs File: ' + JSON.stringify(log, null, 4))
				var reply = readlineSync.question('Do You want to save the file? ');
				if (reply.toLowerCase() === 'y') {
					save = true;
				}
			}
			if (save) {
				//write poollogs.json file 
				saveLog(log, poollogsFilename);
				//write payments.json file
				saveLog(payments, paymentsFilename);
			}
			broadcastPayments(config, payments, passphrases, passphrasesFilename);
		} else {
			logger.info('Nothing to distribute, exiting...');
		} 
	} else {
		logger.info('Nothing to distribute, exiting...');
	}
}

function saveLog(_file, _fileName) {

	const jsonString = JSON.stringify(_file, null, 4);
	logger.debug('Saving Filename: ' + _fileName);
	logger.debug('Saving File: ' + jsonString);
	fs.writeFileSync('./' + _fileName, jsonString);
}

async function estimatePayouts(_conf, _log) {
	
	var result = {payouts: {}, log: {}, forged: {}};
	if (_conf.coin) {
		var rew = 0;
		var payouts = [];
		var forged = 0;
		var coin = _conf.coin;
		if (coin.toLowerCase() === 'xpx') {
			//change based on coin
		} else {
			//default
		}
		var uri = _conf.node + '/api/delegates/forging/getForgedByAccount?generatorPublicKey=' + _conf.pubkey;
		var d = await request.get({url: uri,  json: true,	method: 'GET'});
		if (d) {
			if (d.success) {
				logger.debug('Response Forged: ' + JSON.stringify(d, null, 4));
				var lf = _log.lastforged;
				rew = d.rewards;
				_log.lastforged = rew; 
				rew = rew - lf;
				logger.debug('Rew: ' + rew + ' ' + _conf.coin);
				forged = (rew / 100000000) * _conf.percentage / 100;
				logger.debug('To distribute: ' + forged + ' ' + _conf.coin);
				if (forged > 0.1) {
					uri = _conf.node + '/api/delegates/voters?publicKey=' + _conf.pubkey;
					d = await request.get({url: uri,  json: true,	method: 'GET'});
					if (d) {
						if (d.success) {
							logger.debug('Response Voters: ' + JSON.stringify(d, null, 4));
							weight = 0.0;
							payouts = [];
							for (var i = 0; i < d.accounts.length; i++) {
								if ((d.accounts[i].balance !== '0') && !(_conf.skip.includes(d.accounts[i].address))) {
									weight += parseFloat(d.accounts[i].balance) / 100000000;
								}
							}
							logger.debug('Total weight is: ' + weight);
							for (var i = 0; i < d.accounts.length; i++) {
								if ((d.accounts[i].balance !== '0') && !(_conf.skip.includes(d.accounts[i].address))) {
									var _address = d.accounts[i].address;
									var _balance = (parseFloat(d.accounts[i].balance) / 100000000 * forged) / weight;
									payouts.push({ address: _address, balance: _balance});
									logger.debug(_address + ' ' + _balance);
								}
							}
						}
					}	
				}
			}
		}
		result.payouts = payouts;
		result.log = _log;
		result.forged = forged;
	}
	logger.debug('Result estimatePayouts(): ' + JSON.stringify(result, null, 4));
	return result;
}
