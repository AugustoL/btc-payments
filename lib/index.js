var mongoose = require('mongoose');
var async = require('async');

module.exports = function(conf,completeFunctions,cancelFunctions) {

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
        dbURI : conf.dbURI,
        seedBytes : conf.seedBytes,
        btcMainAddress : conf.btcMainAddress,
        logLevel : conf.logLevel || 'normal',
        network : conf.network || 'testnet' , 
        paymentTimeout : conf.paymentTimeout || 120,
        limitBalance : conf.limitBalance || 0.05,
        txFee : conf.txFee || 0.0001,
        functionTimeout : conf.functionTimeout || 60
    };

    var logger = new require('just-a-logger')(config.logLevel);

    //Connect to DB
    mongoose.connect(config.dbURI);
    var db = mongoose.connection || null;
    db.on('error', console.error.bind(console, 'Connection error:'));
    
    require('./schemas')(db,logger,completeFunctions,cancelFunctions); 
    var processor = require('./processor')(db,logger,config) || null;

    db.once('open', function(err) {
    	if (err)
    		throw new Error(err.toString());
    	else
    		logger.important('Connected to BTC-Payments DB');
    });

    module.createTX = function(opName,btcQuantity,otherData,callback){
    	
        if (!processor)
        	throw new Error('Processor not defined, connect to db before start');
        if (!completeFunctions[opName])
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
                        callback(null, newPaymentWaiting);
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
                        logger.log('Succes on adding tickets, now waiting for the payment');
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

    module.cancelTX = function(paymentWID,executeFunc,callback){
        if (!processor)
            throw new Error('Processor not defined, connect to db before start');

        logger.log("Canceling tx "+paymentWID);
        async.waterfall([

            //Getting paymentWaiting
            function(callback){
                db.paymentsWaiting.findOne({ _id : paymentWID }).exec(function(err, paymentWaiting){
                    if (err)
                        callback(err);
                    else if (paymentWaiting)
                        callback(null, paymentWaiting);
                    else
                        callback('Payment waiting tx wasnt found');
                });
            },

            //Getting addressWaiting
            function(paymentWaiting, callback){
                db.poolAddresses.findOne({ paymentWaiting : new mongoose.Types.ObjectId(paymentWaiting.id) },{},function(err, addressW){
                    if (err)
                        callback(err);
                    else if (addressW)
                        callback(null,addressW,paymentWaiting);
                    else
                        callback('Address waiting tx wasnt found');
                });
            },

            //Finishing addressWaiting
            function(addressW, paymentWaiting, callback){
                addressW.finishWaiting(addressW.balance,function(err){
                    if (err)
                        callback(err);
                    else
                        callback(null,paymentWaiting);
                })
            },

            //Deleting paymentWaiting
            function(paymentWaiting, callback){
                paymentWaiting.cancel(executeFunc, function(err,done){
                    if (err)
                        callback(err);
                    else 
                        callback(null,done)
                });
            }

        ], function (err,done) {
            if (err){
                logger.error(err.toString());
                callback(err);
            } else {
                callback(null,done);
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

    //Return the onComplete functions
    module.onCompleteFunctions = function(){
    	return completeFunctions;
    }

    //Return the onCancel functions
    module.onCancelFunctions = function(){
        return cancelFunctions;
    }

    //Delete a payment function by name
    module.removeOnComplete = function(name){
        if (completeFunctions[name]){
            var newFunctions = [];
            for (func in completeFunctions){
                if (func != name)
                    newFunctions[func] = completeFunctions[func];
            }
            completeFunctions = newFunctions;
        } else
            throw (name+' onCancel function cant be removed because it not exist');
    }

    //Delete a onCancel function by name
    module.removeOnCancel = function(name){
        if (cancelFunctions[name]){
            var newFunctions = [];
            for (func in cancelFunctions){
                if (func != name)
                    newFunctions[func] = cancelFunctions[func];
            }
            cancelFunctions = newFunctions;
        } else
            throw (name+' onCancel function cant be removed because it not exist');
    }

	// Add a onComplete fucntion using the name of the operation and a function(otherData,callback){ //DO YOUR STUFF }  
    module.addOnComplete = function(name,func){
        if (!completeFunctions[name])
            completeFunctions[name] = func;
        else
            throw (name+' onComplete function cant be created because already exist');
    }

    // Add a onCancel fucntion using the name of the operation and a function(otherData,callback){ //DO YOUR STUFF }  
    module.addOnCancel = function(name,func){ 
        if (!cancelFunctions[name])
            cancelFunctions[name] = func;
        else
            throw (name+' onCancel function cant be created because already exist');
    }

    // Change a onComplete fucntion using the name of the operation and a function(otherData,callback){ //DO YOUR STUFF } 
    module.changeOnComplete = function(name,func){
        if (completeFunctions[name])
            completeFunctions[name] = func;
        else
            throw (name+' onComplete function cant be changed because it not exist');
    }

    // Change a onCancel fucntion using the name of the operation and a function(otherData,callback){ //DO YOUR STUFF } 
    module.changeOnCancel = function(name,func){ 
        if (cancelFunctions[name])
            cancelFunctions[name] = func;
        else
            throw (name+' onCancel function cant be changed because it not exist');
    }

    // Close btc-payments
    module.close = function(callback){ 
        if (processor)
            processor.stop(function(err){
                callback(err);
            })
    }

    process.on('SIGINT', function () {
        module.close(function(err){
            process.exit();
        });
    });

    return module;

}