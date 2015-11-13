var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var async = require('async');


module.exports = function(db,logger,paymentFunctions) {
	//////////////////////////////////////////      TX WAITING       //////////////////////////////////////////
	var paymentWaiting = new Schema({
		dateBegin : { type : Date, required : true },
		opName : { type : String, required : true, min : 0 },
		toAddress : { type : String, required : true },
		quantity : { type : Number, required : true, min : 0 },
		otherData : { type : Schema.Types.Mixed, required : false }
	});
	paymentWaiting.methods.create = function () {
		this.dateBegin = new Date();
		this.opName = 0;
		this.toAddress = "empty";
		this.quantity = 0;
		this.otherData = {};
	};
	paymentWaiting.methods.fill = function (opName,toAddress,quantity,otherData) {
		this.dateBegin = new Date();
		this.opName = opName;
		this.toAddress = toAddress;
		this.quantity = quantity;
		this.otherData = otherData;
	};
	paymentWaiting.methods.complete = function(addressW,txs,callback) {
		logger.log('Completing tx opName: '+this.opName);
		var self = this;
		async.waterfall([
			function(callback){
				newPaymentDone = new db.paymentsDone();
				newPaymentDone.create(txs,self.dateBegin,self.opName,addressW.string,self.toAddress,self.quantity,self.otherData);
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
				paymentFunctions[self.opName](self.otherData,function(err,done){
					callback(err,done);
				})
			},
		],function(err,done){
            if (err)
                callback(err);
            else
                callback(null,done);
        })	
	};

	db.paymentsWaiting = db.model('paymentsWaiting', paymentWaiting);

	//////////////////////////////////////////      TX DONE      //////////////////////////////////////////
	
	var paymentDone = new Schema({
		txs : { type : [String], required : true },
		dateBegin : { type : Date, required : true },
		dateFinish : { type : Date, required : true },
		opName : { type : String, required : true, min : 0 },
		fromAddress : { type : String, required : true },
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
};