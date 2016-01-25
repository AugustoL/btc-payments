var mongoose = require('mongoose');
var async = require('async');

module.exports = function(conf,completeFunctions,cancelFunctions,warningFunctions,createFunctions) {

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
        throw new Error('paymentTimeout minutes needs to be more than 5');
    if (conf.limitBalance && (conf.limitBalance < 0))
        throw new Error('limitBalance needs to be more than 0');
    if (conf.txFee && (conf.txFee < 0))
        throw new Error('txFee needs to be more than 0');
    if (conf.functionTimeout && (conf.functionTimeout < 0))
        throw new Error('functionTimeout needs to be more than 0');
    if (conf.warningTimeout && (conf.warningTimeout < 0))
        throw new Error('warningTimeout needs to be more than 0');

    var config = {
        dbURI : conf.dbURI,
        seedBytes : conf.seedBytes,
        btcMainAddress : conf.btcMainAddress,
        logLevel : conf.logLevel || 'normal',
        network : conf.network || 'testnet' , 
        paymentTimeout : conf.paymentTimeout || 120,
        limitBalance : conf.limitBalance || 0.05,
        txFee : conf.txFee || 0.0001,
        functionTimeout : conf.functionTimeout || 60,
        warningTimeout : conf.warningTimeout || 30
    };

    var logger = new require('just-a-logger')(config.logLevel);

    //Connect to DB
    mongoose.connect(config.dbURI);
    var db = mongoose.connection || null;
    db.on('error', console.error.bind(console, 'Connection error:'));
    
    var schemas = require('./schemas')(db,logger,completeFunctions,cancelFunctions,warningFunctions,createFunctions); 
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
                newPaymentWaiting.create(opName,toAddress,btcQuantity,otherData,function(err){
                    if(err) {
                        callback(err);
                    } else {
                        logger.log('Succes on adding payment, now waiting for the payment');
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

    //Return the onCreate functions
    module.onCreateFunctions = function(){
        return schemas.onCreate;
    }

    //Return the onComplete functions
    module.onCompleteFunctions = function(){
    	return schemas.onComplete;
    }

    //Return the onCancel functions
    module.onCancelFunctions = function(){
        return schemas.onCancel;
    }

    //Return the onWarning functions
    module.onWarningFunctions = function(){
        return schemas.onWarning;
    }

    //Delete a payment function by name
    module.removeOnCreate = function(name){
        if (schemas.onCreate[name]){
            var newFunctions = [];
            for (func in schemas.onCreate){
                if (func != name)
                    newFunctions[func] = schemas.onCreate[func];
            }
            schemas.onCreate = newFunctions;
        } else
            throw (name+' onCreate function cant be removed because it not exist');
    }

    //Delete a payment function by name
    module.removeOnComplete = function(name){
        if (schemas.onComplete[name]){
            var newFunctions = [];
            for (func in schemas.onComplete){
                if (func != name)
                    newFunctions[func] = schemas.onComplete[func];
            }
            schemas.onComplete = newFunctions;
        } else
            throw (name+' onComplete function cant be removed because it not exist');
    }

    //Delete a onCancel function by name
    module.removeOnCancel = function(name){
        if (schemas.onCancel[name]){
            var newFunctions = [];
            for (func in schemas.onCancel){
                if (func != name)
                    newFunctions[func] = schemas.onCancel[func];
            }
            schemas.onCancel = newFunctions;
        } else
            throw (name+' onCancel function cant be removed because it not exist');
    }

    //Delete a onCancel function by name
    module.removeOnWarning = function(name){
        if (schemas.onWarning[name]){
            var newFunctions = [];
            for (func in schemas.onWarning){
                if (func != name)
                    newFunctions[func] = schemas.onWarning[func];
            }
            schemas.onWarning = newFunctions;
        } else
            throw (name+' onWarning function cant be removed because it not exist');
    }

    // Add a onCreate function using the name of the operation and a function(payment,callback){ //DO YOUR STUFF }  
    module.addOnCreate = function(name,func){
        if (!schemas.onCreate[name])
            schemas.onCreate[name] = func;
        else
            throw (name+' onCreate function cant be created because already exist');
    }

	// Add a onComplete function using the name of the operation and a function(payment,callback){ //DO YOUR STUFF }  
    module.addOnComplete = function(name,func){
        if (!schemas.onComplete[name])
            schemas.onComplete[name] = func;
        else
            throw (name+' onComplete function cant be created because already exist');
    }

    // Add a onCancel function using the name of the operation and a function(payment,callback){ //DO YOUR STUFF }  
    module.addOnCancel = function(name,func){ 
        if (!schemas.onCancel[name])
            schemas.onCancel[name] = func;
        else
            throw (name+' onCancel function cant be created because already exist');
    }

    // Add a onWarning function using the name of the operation and a function(payment,callback){ //DO YOUR STUFF }  
    module.addOnWarning = function(name,func){ 
        if (!schemas.onWarning[name])
            schemas.onWarning[name] = func;
        else
            throw (name+' onWarning function cant be created because already exist');
    }

    // Change a onCreate function using the name of the operation and a function(payment,callback){ //DO YOUR STUFF } 
    module.changeOnCreate = function(name,func){
        if (schemas.onCreate[name]){
            schemas.onCreate[name] = func;
            console.log(schemas.onCreate[name].toString())
        }
        else
            throw (name+' onCreate function cant be changed because it not exist');
    }

    // Change a onComplete function using the name of the operation and a function(payment,callback){ //DO YOUR STUFF } 
    module.changeOnComplete = function(name,func){
        if (schemas.onComplete[name])
            schemas.onComplete[name] = func;
        else
            throw (name+' onComplete function cant be changed because it not exist');
    }

    // Change a onCancel fucntion using the name of the operation and a function(payment,callback){ //DO YOUR STUFF } 
    module.changeOnCancel = function(name,func){ 
        if (schemas.onCancel[name])
            schemas.onCancel[name] = func;
        else
            throw (name+' onCancel function cant be changed because it not exist');
    }

    // Change a onWarning fucntion using the name of the operation and a function(payment,callback){ //DO YOUR STUFF } 
    module.changeOnWarning = function(name,func){ 
        if (schemas.onWarning[name])
            schemas.onWarning[name] = func;
        else
            throw (name+' onWarning function cant be changed because it not exist');
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