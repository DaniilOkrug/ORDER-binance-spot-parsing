const Binance = require('node-binance-api');
const fs = require('fs');
const { logger } = require('./config/advanced/logger');

const config = require('./config/config.json');
const variables = require('./scripts/variablres');
const { binance } = require('./middleware/variables.middleware');

const { createDirecory, createFiles } = require('./scripts/functionality');

let mergedData = '';

let analyseData = {
    counter: 0,
    symbols: {},
};

(async () => {
    try {
        //Get list of coins
        const allCoins = Object.keys(await binance.prices()).filter((element) => {
            return element.includes('USDT');
        });;
        const newData = {};

        allCoins.forEach(coin => {
            newData[coin] = '';
        });

        //Create main directory
        createDirecory(variables.path);
        createDirecory(variables.path + '/pairs');

        let fileList = [
            {
                "path": `${variables.path}/allCoins_merged.csv`,
                "content": variables.initialData.binance
            },
            {
                "path": `${variables.path}/filteredPairs.csv`,
                "content": variables.initialData.binance
            }
        ];

        allCoins.forEach((coin) => {
            fileList.push({
                "path": `${variables.path}/pairs/${coin}.csv`,
                "content": variables.initialData.binance
            });

            analyseData.symbols[coin] = {};
        });

        createFiles(fileList);

        setInterval(async () => {
            console.log('Parse new data!');

            //Get data statistics
            const statistcsPrevDay = await binance.prevDay();
            const prices = await binance.prices();

            analyseData.counter++;


            statistcsPrevDay.forEach(pairStat => {
                if (!pairStat.symbol.includes('USDT')) return;

                const data = {
                    symbol: pairStat.symbol,
                    price: prices[pairStat.symbol],
                    change24h: pairStat.priceChangePercent,
                    max24: pairStat.highPrice,
                    min24: pairStat.lowPrice,
                    volume24: pairStat.quoteVolume
                }

                //Form new data
                newData[pairStat.symbol] += `${data.symbol};${data.price};${data.change24h};${data.max24};${data.min24};${data.volume24}\n`;
                
                analyseData.symbols[pairStat.symbol][analyseData.counter] = `${data.symbol};${data.price};${data.change24h};${data.max24};${data.min24};${data.volume24}\n`;


                fs.appendFile(`${variables.path}/pairs/${data.symbol}.csv`, newData[pairStat.symbol], function (err) {
                    try {
                        if (err) throw err;

                        //Writing new data us successeful
                        newData[pairStat.symbol] = '';
                    } catch {
                        if (err.code == "EBUSY") console.log(`File ${variables.path}/pairs/${data.symbol}.csv is busy!`);
                    }
                });
            });

            //Merge all data
            fs.truncate(`${variables.path}/allCoins_merged.csv`, err => {
                if (err) throw err;
                console.log('Merged file is cleared!');
            })

            allCoins.forEach((coin) => {
                fs.readFile(`${variables.path}/pairs/${coin}.csv`, (err, fileData) => {
                    if (err) throw err;

                    mergedData += fileData.slice(fileData.indexOf("\n") + 1) + '\n';
                });
            });

            fs.writeFile(`${variables.path}/allCoins_merged.csv`, variables.initialData.binance + mergedData, (err) => {
                if (err) throw err;

                mergedData = '';
            });

            //Analyse last 10 data
            if (analyseData.counter >= 10) {
                console.log('Data analysis!');
                
                allCoins.forEach(symbol => {
                    const symbolData = analyseData.symbols[symbol];
                    const keys = Object.keys(symbolData);

                    const tokensFirst = symbolData[keys[0]].split(';');
                    const tokensLast = symbolData[keys[keys.length - 1]].split(';');

                    if (Number(tokensFirst[2] - Number(tokensLast[2]) >= 1)) {
                        fs.appendFile(`${variables.path}/filteredPairs.csv`, symbolData[keys[keys.length - 1]], function (err) {
                            try {
                                if (err) throw err;
                                keys.forEach( key => { delete symbolData[key] } );
                            } catch {
                                if (err.code == "EBUSY") console.log(`File ${variables.path}/filteredPairs.csv is busy!`);
                            }
                        });
                    }
                });

                analyseData.counter = 0;
            }

            console.log(analyseData);
        }, config.time * 1000);
    } catch (err) {
        console.error(err);
        logger.error(new Error(err));
    }
})();
