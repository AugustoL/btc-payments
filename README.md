# Btc-Payments
An NPM module to easily configure and integrate a BTC payments processor into nodejs, using a hierarchical deterministic addresses you will receive all your payments on a single address. You will also don't need the bitcoin blockchain to push text, so its very lightweight and you can use the testnet network for testing. 

## Install
1. Run: 
	```
	npm install btc-payments
	```
2. Create a config.js to run the processor with this format:
```
	{
		logLevel : 'debug', // none, normal, debug
		dbURI : 'mongodb://USER:PASS@IP:PORT/DBNAME', //URI to use to connect to db
		network : 'testnet', // testnet or livenet
		seedBytes : "your secret string to recover all your balances", // String of the seed master key
		btcMainAddress : "YOUR_BTC_MAIN_ADDRESS", // Address to receive the payments
		paymentTimeout : 120, // The amount of time in minutes that the user have to make the payment
		limitBalance : 0.005, //The max balance that your waiting addresses can have
		txFee : 0.0001, // The fee amount to use in your transactions to teh BTC main address
		functionTimeout : 10 // The amount of time of second that you want to wait beetwen processor updates
	}
```
3. Create the processor object: 
```
	BTCPayments = new require('btc-payments')(btcPaymentsConfig,[],[]);
```
4. Add the onComplete and onCancel payments functions:
```
	BTCPayments.addOnComplete('Test',function(otherData,callback){
		logger.log('Test payment type completed');
		logger.log('Message in otherData: '+otherData.message);
		callback(null,'Success');
	});
	BTCPayments.addOnCancel('Test',function(otherData,callback){
		logger.log('Test payment type canceled');
		logger.log('Message in otherData: '+otherData.message);
		callback(null,'Success');
	});
```
5. Start the processor:
```
	BTCPayments.start();
```

## Update Steps
1. Get all the addresses in the addressesPool that are waiting to receive a payment.
2. Get the paymentWaiting that the address is waiting.
3. Get all the utxos (unspent inputs) of the address.
4. Check all the utxos, get a total balance of the address.
5. Three possible cases:
  * The address balance its the same and it didn't receive any btc or not the enough btc to complete the payment, finish.
  * The address reach the timeout waiting and the payment got canceled, finish.
  * The address balance its enough to complete the payment, to step 6.
6. If the address balance its higher than the minimum balance that every address can have send the btcs to the main address using all the utxos, if not the address finish waiting and its free to be used for another payment. 
  
## TO DO

- [x] Add onPaymentCanceled functions.
- [x] Add editOnComplete and editOnCancel functions.
- [x] Write basic tests.
- [x] Stop gracefully.
- [x] Added from address.
- [ ] Tests with real data.
- [ ] Pause and start processor.
- [ ] Better error handling.
- [ ] Add wariningTimeout functions.
- [ ] Better documentation.
- [ ] improve performance.
