var assert = require("assert");

var btcPaymentsConfig = require('./config');
console.log("BTCPayments config: \n",btcPaymentsConfig);
var BTCPayments = null;
var paymentW = null;

describe('BTCPayments', function() {

	test('BTCPayments its created', function(done) {

		BTCPayments = new require('../lib/index')(btcPaymentsConfig,[],[]);
		done();

	});

	test('BTCPayments update', function(done) {

		BTCPayments.update(function(err){
			assert.equal(null, err);
			done();
		});

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

	test('BTCPayments create a TX using Test operation and 0.001 of quantity', function(done) {

		BTCPayments.createTX('Test',0.001,{},function(err,newPaymentW){
			paymentW = newPaymentW;
			assert.equal(null, err);
			assert.notEqual(null, paymentW);
			console.log('New TX added: \n',paymentW);
			done();
		})
    
  	});

  	test('BTCPayments update with new waitingTX', function(done) {

		BTCPayments.update(function(err){
			assert.equal(null, err);
			done();
		});

	});

  	test('BTCPayments removes a txWaiting', function(done) {

		BTCPayments.cancelTX(paymentW.id,true,function(err,doneCancel){
			assert.equal(null, err);
			console.log(paymentW.id+' TX canceled, otherData: \n',doneCancel);
			done();
		})
    
  	});

  	test('BTCPayments update with new waitingTX', function(done) {

		BTCPayments.update(function(err){
			assert.equal(null, err);
			done();
		});

	});

	test('BTCPayments start proccess', function(done) {

		BTCPayments.start();
		done();

	});

	test('BTCPayments close after 10 seconds', function(done) {

		console.log('Closing processor..');
		setTimeout(function() {
		    BTCPayments.close(function(err){
				assert.equal(null, err);
				done();
			});
		}, 10000);

	});

});
