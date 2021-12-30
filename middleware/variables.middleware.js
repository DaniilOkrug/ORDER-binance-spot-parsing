const Binance = require('node-binance-api');
const config = require('../config/config.json');

module.exports = {
    binance: new Binance().options({
        APIKEY: config.binance.apiKey,
        APISECRET: config.binance.apiSecret
    })
}