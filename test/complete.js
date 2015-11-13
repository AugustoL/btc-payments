var assert = require("assert");

var btcPaymentsConfig = require('./config');
console.log(btcPaymentsConfig);
var BTCPayments = null;
var txWaiting = null;

describe('BTCPayments', function() {

	test('BTCPayments its created', function(done) {

		BTCPayments = new require('../lib/index')(btcPaymentsConfig,[]);
		done();

	});

	test('BTCPayments update', function(done) {

		BTCPayments.update(function(err){
			assert.equal(null, err);
			done();
		});

	});

	test('BTCPayments add Test paymentFucntion', function(done) {

		BTCPayments.addPaymentFuction('Test',function(callback){
			console.log('Type one tx done');
			callback(null,'Success');
		});
		done();

	});

	test('BTCPayments add ToDelete paymentFucntion', function(done) {

		BTCPayments.addPaymentFuction('ToDelete',function(callback){
			console.log('Type two tx done');
			callback(null,'Success');
		});
		done();

	});

	test('BTCPayments remove ToDelete paymentFucntion', function(done) {

		BTCPayments.deletePaymentFuction('ToDelete');
		done();

	});

	test('BTCPayments create a TX using Test operation and 0.001 of quantity', function(done) {

		BTCPayments.createTX('Test',0.001,{},function(err,newTX){
			txWaiting = newTX;
			assert.equal(null, err);
			assert.notEqual(null, txWaiting);
			done();
		})
    
  	});

  	test('BTCPayments update with new waitingTX', function(done) {

		BTCPayments.update(function(err){
			assert.equal(null, err);
			done();
		});

	});

});
