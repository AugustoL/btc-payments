var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var async = require('async');

module.exports = function(db,logger,_onComplete,_onCancel,_onWarning,_onCreate) {

	module.onComplete = _onComplete;
	module.onCancel = _onCancel;
	module.onWarning = _onWarning;
	module.onCreate = _onCreate;

	function createPayment(payment,callback) {
		if (module.onCreate['*']){
			module.onCreate['*'](payment,function(err,done){
				callback(err,done);
			})
		} else if (module.onCreate[payment.opName]){
			module.onCreate[payment.opName](payment,function(err,done){
				callback(err,done);
			})
		} else {
			callback('Operation with that name isnt defined on onCreate functions.');
		}
	}

	function completePayment(payment,callback) {
		if (module.onComplete['*']){
			module.onComplete['*'](payment,function(err,done){
				callback(err,done);
			})
		} else if (module.onComplete[payment.opName]){
			module.onComplete[payment.opName](payment,function(err,done){
				callback(err,done);
			})
		} else {
			callback('Operation with that name isnt defined on onComplete functions.');
		}
	}

	function cancelPayment(payment,callback) {
		if (module.onCancel['*']){
			module.onCancel['*'](payment,function(err,done){
				callback(err,done);
			})
		} else if (module.onCancel[payment.opName]){
			module.onCancel[payment.opName](payment,function(err,done){
				callback(err,done);
			})
		} else {
			callback('Operation with that name isnt defined on onCancel functions.');
		}
	}

	function warnPayment(payment,callback) {
		if (module.onWarning['*']){
			module.onWarning['*'](payment,function(err,done){
				callback(err,done);
			})
		} else if (module.onWarning[payment.opName]){
			module.onWarning[payment.opName](payment,function(err,done){
				callback(err,done);
			})
		} else {
			callback('Operation with that name isnt defined on onWarning functions.');
		}
	}

	//////////////////////////////////////////      TX WAITING       //////////////////////////////////////////
	
	var paymentWaiting = new Schema({
		dateBegin : { type : Date, required : true, default : new Date() },
		opName : { type : String, required : true, min : 0, default : 0 },
		warned : { type : Boolean, required : true, default : false },
		toAddress : { type : String, required : true, default : "empty" },
		quantity : { type : Number, required : true, min : 0, default : 0 },
		otherData : { type : Schema.Types.Mixed, required : false, default : {} }
	});
	paymentWaiting.methods.create = function (opName,toAddress,quantity,otherData,callback) {
		var self = this;
		async.waterfall([
			function(callback){
				self.dateBegin = new Date();
				self.opName = opName;
				self.toAddress = toAddress;
				self.quantity = quantity;
				self.otherData = otherData;
				self.save(function(err){
					if (err)
						callback(err);
					else 
						callback(null)
				});
			},
			function(callback){
				createPayment(self,function(err,done){
		            if (err)
		                callback(err);
		            else
		                callback(null,done);
		        })
			},
		],function(err,done){
            if (err)
                callback(err);
            else
                callback(null,done);
        });

	};
	paymentWaiting.methods.complete = function(addressW,fromAddress,txs,callback) {
		logger.log('Completing tx '+this.id);
		var self = this;
		async.waterfall([
			function(callback){
				newPaymentDone = new db.paymentsDone();
				newPaymentDone.create(txs,self.dateBegin,self.opName,fromAddress,self.toAddress,self.quantity,self.otherData);
				newPaymentDone.save(function(err){
					if (err)
						callback(err);
					else
						callback(null);
				})
			},
			function(callback){
				self.remove(function(err){
					if (err)
						callback(err);
					else 
						callback(null)
				});
			},
			function(callback){
				completePayment(self,function(err,done){
		            if (err)
		                callback(err);
		            else
		                callback(null,done);
		        })
			},
		],function(err,done){
            if (err)
                callback(err);
            else
                callback(null,done);
        });
	};
	paymentWaiting.methods.cancel = function(execFunc,callback) {
		var self = this;
		logger.log('Canceling tx '+self.id);
		async.waterfall([
			function(callback){
		        self.remove(function(err){
					if (err)
						callback(err);
					else 
						callback(null)
				});
		    },
		    function(callback){
		    	if (execFunc){
		    		cancelPayment(self,function(err,done){
			            if (err)
			                callback(err);
			            else
			                callback(null,done);
			        });
		    	} else {
		    		callback(null,true);
		    	}
		    }
		],function(err,done){
            if (err)
                callback(err);
            else
                callback(null,done);
        });
	};
	paymentWaiting.methods.warn = function(callback) {
		var self = this;
		logger.log('Warning tx '+self.id);
		async.waterfall([
			function(callback){
		        self.remove(function(err){
					if (err)
						callback(err);
					else 
						callback(null)
				});
		    },
		    function(callback){
	    		warnPayment(self,function(err,done){
		            if (err)
		                callback(err);
		            else
		                callback(null,done);
		        });
		    }
		],function(err,done){
            if (err)
                callback(err);
            else
                callback(null,done);
        });
	};

	db.paymentsWaiting = db.model('paymentsWaiting', paymentWaiting);

	//////////////////////////////////////////      TX DONE      //////////////////////////////////////////
	
	var paymentDone = new Schema({
		txs : { type : [String], required : true },
		dateBegin : { type : Date, required : true },
		dateFinish : { type : Date, required : true },
		opName : { type : String, required : true, min : 0 },
		fromAddress : { type : [String], required : true },
		toAddress : { type : String, required : true },
		quantity : { type : Number, required : true, min : 0 },
		otherData : { type : Schema.Types.Mixed, required : false }
	});
	paymentDone.methods.create = function(txs,dateBegin,opName,fromAddress,toAddress,quantity,otherData) {
		this.txs = txs;
		this.dateBegin = dateBegin;
		this.dateFinish = new Date();
		this.opName = opName;
		this.fromAddress = fromAddress;
		this.toAddress = toAddress;
		this.quantity = quantity;
		this.otherData = otherData;
	};

	db.paymentsDone = db.model('paymentsDone', paymentDone);

	//////////////////////////////////////////      ADDRESES      //////////////////////////////////////////

	var address = new Schema({
		derived : { type : Number, required : true, min : 0 },
		privKey : { type : String, required : true },
		pubKey : { type : String, required : true },
		string : { type : String, required : true },
		waiting : { type : Boolean, required : true },
		paymentWaiting : { type : Schema.Types.ObjectId },
		balance : { type : Number, required : true, min : 0 }				
	});

	address.methods.finishWaiting = function(newBalance,callback) {
		this.waiting = false;
		this.paymentWaiting = null;
		this.balance = newBalance;
        this.save(function(err){
        	if (err)
        		callback(err);
        	else
        		callback(null);
        });
	}

	address.methods.startWaiting = function(paymentWaitingID,callback) {
		this.waiting = true;
		this.paymentWaiting = paymentWaitingID;
        this.save(function(err){
        	if (err)
        		callback(err);
        	else
        		callback(null);
        });
	}

	address.methods.create = function(derived,privKey,pubKey,address,waiting,paymentWaiting,callback){
		this.derived = derived;
		this.privKey = privKey;
		this.pubKey = pubKey;
		this.string = address;
		this.waiting = waiting;
		this.paymentWaiting = paymentWaiting.id;
		this.balance = 0;
        this.save(function(err){
        	if (err)
        		callback(err);
        	else
        		callback(null);
        });
	}

	db.poolAddresses = db.model('poolAddresses', address);

	return module;
};