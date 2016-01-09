var assert = require("assert");

var btcPaymentsConfig = require('./config');
console.log("BTCPayments config: \n",btcPaymentsConfig);
var BTCPayments = null;
var paymentW = null;

describe('BTCPayments run app', function() {

	test('BTCPayments its created', function(done) {

		BTCPayments = new require('../lib/index')(btcPaymentsConfig,[],[]);
		done();

	});

	test('BTCPayments add onComplete Test function', function(done) {

		BTCPayments.addOnComplete('Test',function(otherData,callback){
			console.log('onComplete function called Test added');
			callback(null,'Success');
		});
		done();

	});

	test('BTCPayments add onCancel Test function', function(done) {

		BTCPayments.addOnCancel('Test',function(otherData,callback){
			console.log('onCancel function called Test added');
			callback(null,'Success');
		});
		done();

	});

  	test('BTCPayments update with new waitingTX', function(done) {

		BTCPayments.start();

	});

});


