var assert = require("assert");

var btcPaymentsConfig = require('./config');
console.log("BTCPayments config: \n",btcPaymentsConfig);
var BTCPayments = null;
var paymentW = null;

describe('BTCPayments', function() {

	test('BTCPayments its created', function(done) {
		BTCPayments = new require('../lib/index')(btcPaymentsConfig,[],[],[]);
		done();
	});

	test('BTCPayments update', function(done) {
		BTCPayments.update(function(err){
			assert.equal(null, err);
			done();
		});
	});

	test('BTCPayments onComplete Test function', function(done) {
		var funcToAdd = function(payment,callback){
			console.log('BTC Payment tx completed');
			callback(null,payment);
		};
		BTCPayments.addOnComplete('Test', funcToAdd);
		BTCPayments.addOnComplete('ToDelete', funcToAdd);
		BTCPayments.removeOnComplete('ToDelete');
		BTCPayments.changeOnComplete('Test', function(payment,callback){
			console.log('BTC Payment tx completed, using edited function');
			callback(null,payment);
		});
		done();
	});

	test('BTCPayments onWarning Test function', function(done) {
		var funcToAdd = function(payment,callback){
			console.log('BTC Payment tx warned');
			callback(null,payment);
		};
		BTCPayments.addOnWarning('Test', funcToAdd);
		BTCPayments.addOnWarning('ToDelete',funcToAdd);
		BTCPayments.removeOnWarning('ToDelete');
		BTCPayments.changeOnWarning('Test', function(payment,callback){
			console.log('BTC Payment tx warned, using edited function');
			callback(null,payment);
		});
		done();
	});

	test('BTCPayments onCancel Test function', function(done) {
		var funcToAdd = function(payment,callback){
			console.log('BTC Payment tx canceled');
			callback(null,payment);
		};
		BTCPayments.addOnCancel('Test', funcToAdd);
		BTCPayments.addOnCancel('ToDelete', funcToAdd);
		BTCPayments.removeOnCancel('ToDelete');
		BTCPayments.changeOnCancel('Test', function(payment,callback){
			console.log('BTC Payment tx canceled, using edited function');
			callback(null,payment);
		});
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
		BTCPayments.cancelTX(paymentW.id,true,function(err,response){
			assert.equal(null, err);
			console.log(paymentW.id+' TX canceled, otherData: \n',response.otherData);
			done();
		})
   
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
