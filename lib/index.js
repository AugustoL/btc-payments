var mongoose = require('mongoose');
var async = require('async');

module.exports = function(conf,paymentFunc) {

    var module = {};
    var db = {};
    var processor = null;
    var paymentFunctions = paymentFunc;

    if (!conf.dbURI)
        throw new Error('dbURI not defined on config');
    if (!conf.seedBytes)
        throw new Error('seedBytes not defined on config');
    if (!conf.btcMainAddress)
        throw new Error('btcMainAddress not defined on config');
    if (conf.logLevel && (conf.logLevel != 'none') && (conf.logLevel != 'normal') && (conf.logLevel != 'debug'))
        throw new Error('logLevel needs to be none, normal or debug');
    if (conf.network && (conf.network != 'testnet') && (conf.network != 'livenet'))
        throw new Error('network needs to be testnet or livenet');
    if (conf.paymentTimeout && (conf.paymentTimeout <= 5))
        throw new Error('paymentTimeout needs to be more than 5');
    if (conf.limitBalance && (conf.limitBalance < 0))
        throw new Error('limitBalance needs to be more than 0');
    if (conf.txFee && (conf.txFee < 0))
        throw new Error('txFee needs to be more than 0');
    if (conf.functionTimeout && (conf.functionTimeout < 0))
        throw new Error('functionTimeout needs to be more than 0');

    var config = {
        dbURI : conf.dbURI, //URI to use to connect to db
        seedBytes : conf.seedBytes, // String of the seed master key
        btcMainAddress : conf.btcMainAddress, // Address to receive the payments
        logLevel : conf.logLevel || 'none', // none, normal, debug
        network : conf.network || 'testnet' , // testnet or livenet
        paymentTimeout : conf.paymentTimeout || 120, // In minutes
        limitBalance : conf.limitBalance || 0.05,
        txFee : conf.txFee || 0.0001,
        functionTimeout : conf.functionTimeout || 60  // In seconds
    }

    var logger = new require('just-a-logger')(config.logLevel);

    //Connect to DB
    mongoose.connect(config.dbURI);
    db = mongoose.connection;
    db.on('error', console.error.bind(console, 'Connection error:'));
    
    require('./schemas')(db,logger,paymentFunctions); 
    processor = require('./processor')(db,logger,config);

    db.once('open', function(err) {
    	if (err)
    		throw new Error(err.toString());
    	else
    		logger.important('Connected to BTC-Payments DB');
    });

    module.createTX = function(opName,btcQuantity,otherData,callback){
    	if (!processor)
        	throw new Error('Processor not defined, connect to db before start');
        if (!paymentFunctions[opName])
        	throw new Error('Operation function not defined');
        if (btcQuantity < 0)
        	throw new Error('Ivalid BTC quantity');
        logger.log("Creating tx..");
        async.waterfall([
            //Create newTX
            function(callback){
                newPaymentWaiting = new db.paymentsWaiting();
                newPaymentWaiting.create();
                newPaymentWaiting.save(function(err){
                    if (err)
                        callback(err);
                    else
                        callback(null,newPaymentWaiting);
                })
            },
            //Get free address from pool
            function(newPaymentWaiting,callback){
                processor.getFreeAddress(newPaymentWaiting,function(err,toAddress){
                    if (err)
                        callback(err);
                    else
                        callback(null,toAddress,newPaymentWaiting);
                });
            },
            //Saving Payment TX
            function(toAddress,newPaymentWaiting,callback){
                newPaymentWaiting.fill(opName,toAddress,btcQuantity,otherData);
                newPaymentWaiting.save(function (err) {
                    if(err) {
                        callback(err);
                    } else {
                        logger.success('Succes on adding tickets, now waiting for the payment');
                        callback(null,newPaymentWaiting);
                    }
                });
            }
        ], function (err, newPaymentWaiting) {
            if (err){
                logger.error(err.toString());
                callback(err);
            } else {
                callback(null,newPaymentWaiting);
            }
        });
    }

    //Start procesing with automatic updates
    module.start = function(){
        logger.important('Starting BTC-Payments..');
        if (!processor)
        	throw new Error('Processor not defined, connect to db before start');
        else
        	processor.start();
    }

    //Trigger the update on the processor
    module.update = function(callback){
        logger.important('Updating BTC-Payments..');
        if (!processor)
        	if (callback)
        		callback('Processor not defined, connect to db before start')
        	else	
        		throw new Error('Processor not defined, connect to db before start');
        else
        	processor.update(callback);
    }

    module.getPoolAddresses = function(type,limit,callback){
        var findBy = {};
        if (type == 'waiting')
            findBy = {$where: "this.waiting == true"};
        else if (type == 'free')
            findBy = {$where: "this.waiting == false"};
        db.poolAddresses.find(findBy,{},function(err, addresses){
            if (err)
                callback(err);
            else
                callback(null,addresses);
        });
    }

    module.getPaymentsDone = function(limit,callback){
    	db.paymentsDone.find({}).limit(limit).exec(function(err, paymentsDone){
            if (err)
                callback(err);
            else if (paymentsDone)
                callback(null, paymentsDone);
            else
                callback([]);
        });
    }

    module.getPaymentsWaiting = function(limit,callback){
    	db.paymentsWaiting.find({}).limit(limit).exec(function(err, paymentsWaiting){
            if (err)
                callback(err);
            else if (paymentsWaiting)
                callback(null, paymentsWaiting);
            else
                callback([]);
        });
    }

    module.getPaymentDone = function(id,callback){
    	db.paymentsDone.find({id : id}).exec(function(err, paymentDone){
            if (err)
                callback(err);
            else if (paymentDone)
                callback(null, paymentDone);
            else
                callback([]);
        });
    }

    module.getPaymentWaiting = function(id,callback){
    	db.paymentsWaiting.find({id : id}).exec(function(err, paymentsWaiting){
            if (err)
                callback(err);
            else if (paymentsWaiting)
                callback(null, paymentsWaiting);
            else
                callback([]);
        });
    }

    //Return the payment fuctions
    module.getPaymentFuctions = function(){
    	return paymentFunctions;
    }

    //Delete a payment function by name
    module.deletePaymentFuction = function(name){
    	var newFunctions = [];
    	for (func in paymentFunctions){
    		if (func != name)
    			newFunctions[func] = paymentFunctions[func];
    	}
		paymentFunctions = newFunctions;
    }

	// Add a payment fucntion uusing the name of the operation and a 
	// Function must be like:
	// function(otherData,callback){ //DO YOUR STUFF }; 
    module.addPaymentFuction = function(name,func){	
    	paymentFunctions[name] = func;
    }

    return module;

}