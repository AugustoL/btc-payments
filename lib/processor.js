var bitcore = require('bitcore-lib');
var async = require('async');
var request = require('request');
var events = require('events');

module.exports = function(db,logger,config) {

    var masterKey = new bitcore.HDPrivateKey.fromSeed( bitcore.crypto.Hash.sha256(new Buffer(config.seedBytes)) ,config.network);
    var status = 'init'; // init, running, stoping, stoped
    var eventEmitter = new events.EventEmitter();

    function sendTX(unspent,to,privKeys,callback){
        //Build TX
        var tx = new bitcore.Transaction()
        .from(unspent)
        .to(new bitcore.Address.fromString(to.address.toString(),config.network), parseInt(100000000*to.amount)) 
        .sign(privKeys)
        .fee(parseInt(100000000*config.txFee))

        //Serialize and send TX      
        var raw_tx = tx.serialize().toString('hex'); 
        var url = 'http://btc.blockr.io/api/v1/tx/push';
        if (config.network == 'testnet')
            url = 'http://tbtc.blockr.io/api/v1/tx/push';
        
        request.post({url:url, form: {"hex":raw_tx}}, function(err,httpResponse,hash){
            if (err){
                logger.error('Error sending raw tx: '+ raw_tx);
                callback(err);
            } else if (hash){
                logger.success('Success sending raw tx: '+ raw_tx);
                callback(null,true);
            } else{
                logger.warning('Probelm sending raw tx: '+ raw_tx);
                callback(null,false);
            }
        });
        
    }

    module.start = function(){
        status = 'running';
        setInterval(module.update, config.functionTimeout*1000);
    };

    module.stop = function(callback){
        try {
            eventEmitter.on('stop', function(){
                callback(null);
            });
            status = 'stop';
        } catch (e){
            callback(e);
        }     
    };

    module.update = function(callback){
        if (status != 'stop'){
            logger.log('Updating BTC-Paymnets...');
            async.waterfall([

                //Get all addresses waiting
                function(callback){
                    module.getAddressesWaiting(callback);
                },

                //Check state and payment of all address waiting
                function(addressesWaiting, callback){

                    //ForEachLimit AddressWaiting
                    async.forEachLimit(addressesWaiting,1, function(addressWaiting,callback){           
                        checkAddressWaiting(addressWaiting,function(err){
                            if (err){
                                callback(err);
                            } else {
                                callback(null);
                            }
                        });
                    },function(err){
                        if (err)
                            callback(err);
                        else
                            callback(null);
                    });

                }     

            //All addresses waiting checked   
            ],function(err, results){
                if (err){
                    logger.error(err.toString());
                    if (callback)
                        callback(err);
                    else
                        throw err;
                } else {
                    logger.log("Finish updating addresses!");
                    if (callback)
                        callback(null);
                }
            });
        } else{
            eventEmitter.emit('stop');
        }          
    };
    /*
     Get a free address from the pool or create a new one
    */
    module.getFreeAddress = function(newPaymentWaiting,callback){
        async.waterfall([
            function(callback){
                db.poolAddresses.findOne({$where: "this.waiting == false"},{},function(err,address){
                    if (err){
                        logger.error(err.toString());
                        throw err;
                    } else {
                        callback(null,address);
                    }    
                })
            },
            function(address,callback){
                if (address){
                    //Address already created found
                    address.startWaiting(newPaymentWaiting.id,function(err){
                        if (err)
                            callback(err);
                        else {
                            logger.log("New address for payment obtained: "+address.string);
                            callback(null,address.string);
                        }
                    })
                } else {
                    //Creating new addres derivating form masterkey
                    db.poolAddresses.find({},{},function(err,allAddresses){
                        if (!err){
                            var deriveIndex = allAddresses.length;
                            logger.log("Derivating form master key on m/"+deriveIndex+"'");
                            var derivedPriv = new bitcore.PrivateKey( masterKey.derive('m/'+deriveIndex+"'").privateKey, config.network)
                            var newAddress = new db.poolAddresses();
                            newAddress.create(deriveIndex,derivedPriv,new bitcore.PublicKey.fromPrivateKey(derivedPriv),new bitcore.Address.fromPublicKey(new bitcore.PublicKey.fromPrivateKey(derivedPriv),config.network).toString(),true,newPaymentWaiting,function(err){
                                if (err){
                                    callback(err)
                                } else {
                                    logger.log("New address for payment generated: "+newAddress.string);
                                    callback(null,newAddress.string);
                                }
                            });
                        } else {
                            callback('Couldnt get free address.');
                        }
                    });
                } 
            }
        ],function(err,address){
            if (err){
                logger.error("Error getting free address from pool").
                callback(err);
            } else {
               callback(null,address);
            }
        });
    };

    //Get all the addresses waiting on the pool
    module.getAddressesWaiting = function(callback){
        db.poolAddresses.find({$where: "this.waiting == true"},{},function(err, addressesWaiting){
            if (err)
                callback(err);
            else if (addressesWaiting)
                callback(null, addressesWaiting);
            else
                callback([]);
        });
    };
    /*
     Check if the address waiting received their bitcoins
     If the btcs are received and the btc balance its higher that the min amount that every address can have send the btcs to the mainAddress.
     To send all the btcs on the address we get all the unused inputs and create a tx.
     We push the raw tx using the blocker.io api and complete the paymentW.
     Once the paymentWaiting is complete it creates a paymentDone object and trigger the paymentFunction for that type of operation.
    */
    function checkAddressWaiting(addressW,callback){
        
        logger.log('Checking address: '+addressW.string);
        async.waterfall([

            //Get PaymentWaiting
            function(callback){
                logger.log('Looking for tx waiting id: '+addressW.paymentWaiting);
                db.paymentsWaiting.findOne({ "_id" : addressW.paymentWaiting },{},function(err,paymentWaiting){
                    if (err){
                        callback(err);
                    } else if (paymentWaiting){
                        callback(null,paymentWaiting);
                    } else {
                        callback('No tx waiting found fo address: '+addressW.string);
                    }
                });  
            },

            //Get utxos
            function(paymentW,callback){
                logger.log('Getting utxos..');
                request("http://tbtc.blockr.io/api/v1/address/unspent/"+addressW.string, function(err, response, utxos) { 
                    if (err)
                        callback(err);
                    else if (utxos)
                        callback(null,utxos,paymentW);
                    else
                        callback(null,[],paymentW);
                });
            },

            //Check utxos AddressWaiting
            function(utxos,paymentW,callback){
                logger.log('Checking '+JSON.parse(utxos).data.unspent.length+' utxos..');
                checkUtxos(utxos,addressW,function(err,txs,amountW,unusedBalance,unspent,fromAddress){
                    if (err) {
                        callback(err);
                    } else {
                        callback(null,paymentW,txs,amountW,unusedBalance,unspent,fromAddress);
                    }
                });
            },

            //All utxos in AddressWaiting checked, now parse and sendTX if have to
            function(paymentW,txs,amountW,unusedBalance,unspent,fromAddress,callback){ 
                if ((amountW >= paymentW.quantity)&&(unusedBalance >= config.limitBalance)&&(unspent.length > 0)){
                    //Address have the necessary amount send a tx, after tx is sent its going to wait again
                    var to = {
                        address: config.btcMainAddress, 
                        amount:unusedBalance-config.txFee
                    };
                    //Sending TX
                    sendTX(unspent, to, [addressW.privKey.toString()], function(err,done){
                        if (err) {
                            callback(err,null,null);
                        } else if (done) {
                            paymentW.complete(addressW,fromAddress,txs,function(err,done){
                                if (err){
                                    callback(err,null,null);
                                } else {
                                    logger.log("Tx parsed for address: "+addressW.string+" using txs: "+txs.toString());
                                    callback(null,true,0);
                                }     
                            });
                        } else {
                            callback('Problem sending TX',null,null);
                        }
                    });
                } else if ((amountW >= paymentW.quantity)&&(unspent.length > 0)){                                 
                    //Address dont have the minimun balance to send a tx, it will be set to receive another payment
                    logger.log('Parsing tx to done with txs: '+txs.toString());  
                    paymentW.complete(addressW,fromAddress,txs,function(err,done){
                        if (err){
                            callback(err);
                        } else {
                            callback(null,true,unusedBalance);
                        }
                    });
                } else {
                    //Check the X minutes timeout to receive payment
                    if (paymentW && (unspent.length == 0) && ( (((new Date(paymentW.dateBegin.getTime() + config.paymentTimeout*60000))-new Date())/60000) < 0)){
                        paymentW.remove();
                        logger.log('PaymentW timeout, removed.');
                        callback(null,true,0);
                    } else {
                        logger.log('Nothing to parse on address..');
                        callback(null,null,null);
                    }
                }

            },
            //If address finish waiting we change their status so we can use it again.
            function(finishWaiting,unusedBalance,callback){
                if (finishWaiting){
                    logger.log('Address finishing waiting..');
                    addressW.finishWaiting(unusedBalance,function(err){
                        if (err){
                            logger.error(err.toString());
                            callback(err);
                        }else{
                            logger.log(addressW);
                            callback(null);
                        }
                    });
                } else {
                    callback(null);
                }
            }
        
        ],function(err){
            if (err)
                callback(err);
            else
                callback(null);
        })
    }
    
    function checkUtxos(utxos,addressW,callback){
        var txs = [];
        var amountW = 0;
        var unusedBalance = 0;
        var unspent = [];
        var fromAddress = [];
        async.forEachLimit(JSON.parse(utxos).data.unspent,1,function(utxo, callback){
            async.waterfall([
                //Check if the txid its already done
                function(callback){
                    db.paymentsDone.find({ txs: { $in : [utxo.tx]} }, {},function(err,paymentDone){
                        if (err){
                            callback(err);
                        } else if (paymentDone && paymentDone.length > 0){
                            callback(null,true,utxo);
                        } else {
                            callback(null,false,utxo);
                        }
                    });
                },
                //Push the tx if have to.
                function(paymentDone,utxo,callback){
                    var newUtxo = new bitcore.Transaction.UnspentOutput({
                        txid : utxo.tx,
                        vout : utxo.n,
                        address : addressW.string,
                        scriptPubKey : utxo.script,
                        amount : utxo.amount
                    });
                    unspent.push(newUtxo);
                    unusedBalance = unusedBalance + parseFloat(utxo.amount);
                    if (!paymentDone){
                        txs.push(utxo.tx);
                        amountW = amountW + parseFloat(utxo.amount);
                        request("http://tbtc.blockr.io/api/v1/tx/info/"+utxo.tx, function(err, response, txReturn) { 
                            txReturn = JSON.parse(txReturn);
                            for (var i = 0; i < txReturn.data.vins.length; i++) {
                                fromAddress.push(txReturn.data.vins[i].address.toString());
                                logger.important(txReturn.data.vins[i].address.toString());
                            };
                            callback(null);
                        });
                    } else {
                        callback(null);
                    }
                }
            ], function(err){
                callback(err);
            });       
        }, function(err){
            if (err)
                callback(err);
            else
                callback(null,txs,amountW,unusedBalance,unspent,fromAddress);
        });
    }


    return module;

}