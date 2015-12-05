var assert = require("assert");

var btcPaymentsConfig = require('./config');
console.log("BTCPayments config: \n",btcPaymentsConfig);
var BTCPayments = null;

describe('BTCPayments', function() {

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

	test('BTCPayments add onComplete ToDelete fucntion', function(done) {

		BTCPayments.addOnComplete('ToDelete',function(otherData,callback){
			console.log('onComplete function called toDelete added');
			callback(null,'Success');
		});
		done();

	});

	test('BTCPayments remove onComplete ToDelete function', function(done) {

		BTCPayments.removeOnComplete('ToDelete');
		done();

	});

	test('BTCPayments add onCancel Test function', function(done) {

		BTCPayments.addOnCancel('Test',function(otherData,callback){
			console.log('onCancel function called Test added');
			callback(null,'Success');
		});
		done();

	});

	test('BTCPayments add onCancel ToDelete fucntion', function(done) {

		BTCPayments.addOnCancel('ToDelete',function(otherData,callback){
			console.log('onCancel function called toDelete added');
			callback(null,'Success');
		});
		done();

	});

	test('BTCPayments remove onCancel ToDelete function', function(done) {

		BTCPayments.removeOnCancel('ToDelete');
		console.log('onCancel function called toDelete removed');
		done();

	});

});


