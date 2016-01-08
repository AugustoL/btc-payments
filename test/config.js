module.exports = {
    logLevel : 'debug', // none, normal, debug
    dbURI : 'mongodb://user:15ssc51s65e1et65svt4k5u4@127.0.0.1:27017/augustolemble', //URI to use to connect to db (REQUIRED)
    network : 'testnet', // testnet or livenet
    seedBytes : "testingseed25", // String of the seed master key (REQUIRED)
    btcMainAddress : "mqyp4A44N1ekc2LzoAjasMo4SToZUrwfrG", // Address to receive the payments (REQUIRED)
    paymentTimeout : 120, // In minutes
    limitBalance : 0.005,
    txFee : 0.0001, //You
    functionTimeout : 10 // In seconds
}
