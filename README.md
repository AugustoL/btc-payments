# btc-payments
An NPM module to easily configure and integrate a BTC payments processor into nodejs, using a hierarchical deterministic addresses you will receive all your payments on a single address. You will also dont need the bitcoin blockchain to push text, so its very lightweight and you can use the testnet network for testing. 

# Update Steps
1. Get all the addresses in the addressesPool that are waiting to receive a payment.
2. Get the paymentWaiting that the address is waiting.
3. Get all the utxos (unspent inputs) of the address.
4. Check all the unspentPuts, get a total balance of the address.
5. Three posible cases:
  * The address balance its the same and it didnt receive any btc or not the enough btc to complete the payment, finish.
  * The address reach the timeout waiting and the payment got canceled, finish.
  * The address balance its enough to complete the payment, to step 6.
6. If the address balance its higer than the mininimun balance that every address can have send the btcs to the main address using all the utxos, if not the adrees finish waiting and its free to be used for another payment. 
  
# TO DO
* Add onPaymentCanceled functions.
* Write more tests.

