module.exports = {
    logLevel : 'debug', // none, normal, debug
    dbURI : 'mongodb://user:user@ds043694.mongolab.com:43694/btcpayments', //URI to use to connect to db
    network : 'testnet', // testnet or livenet
    seedBytes : "testingseed24", // String of the seed master key
    btcMainAddress : "mqyp4A44N1ekc2LzoAjasMo4SToZUrwfrG", // Address to receive the payments
    paymentTimeout : 120, // In minutes
    limitBalance : 0.005,
    txFee : 0.0001,
    functionTimeout : 10 // In seconds
}
