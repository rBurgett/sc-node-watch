import fs from 'fs-extra-promise';
import { omit } from 'lodash';
import moment from 'moment';
import Datastore from 'nedb';
import path from 'path';
import request from 'superagent';

require('superagent-jsonapify')(request);

fs.ensureDirSync('data');

const records = new Datastore({
    filename: path.join('data', 'records.db'),
    autoload: true
});

const defaultRecord = () => ({
    date: moment().toISOString(),
    totalNodes: 0,
    familyNodes: 0,
    familytotal: 0,
    familyIncrease: 0,
    coinData: []
});

const addRecord = async function(data) {
    const record = await new Promise((resolve, reject) => {
        records.insert({ ...defaultRecord(), ...data }, (err, doc) => {
            if(err) reject(err);
            else resolve(doc);
        });
    });
    return record;
};

let fakeIncrease = 0;

const getAddressData = async function(address) {
    // fakeIncrease += 116;
    const baseURI = 'https://explorer.smartcash.cc/ext/getaddress/';
    const res = await request.get(baseURI + address);
    // return res.body;
    return {
        ...res.body,
        received: res.body.received + fakeIncrease
    };
};

const coinsToCompare = [
    'smartcash',
    'bitcoin',
    'ethereum',
    'dash',
    'eos',
    'electroneum',
    'blocknet'
];

// const cmcEndpoint = coin => `https://api.coinmarketcap.com/v1/ticker/${coin}/?convert=USD`;
const getCoinData = async function(coin) {
    // const { body } = await request.get(cmcEndpoint(coin));
    // return body[0];
    const data = await fs.readJSONAsync('coin-data.json');
    return data.find(c => c.id === coin);
};

const getData = async function() {
    const { nodes, addresses } = await fs.readJSONSync('meta.json');

    const doc = await new Promise((resolve, reject) => {
        records
            .find({})
            .sort({ date: -1 })
            .limit(1)
            .exec((err, docs) => {
                if(err) reject(err);
                else resolve(docs.length > 0 ? docs[0] : null);
            });
    });

    let total = 0;
    let totalInitial = 0;
    for(const { address, offset = 0, initialValue = 0 } of addresses) {
        const res = await getAddressData(address);
        total += res.received - offset;
        totalInitial += initialValue;
    }
    const increase = doc ? total - doc.familyTotal : total - totalInitial;
    const coinData = [];
    for(const coin of coinsToCompare) {
        const data = await getCoinData(coin);
        coinData.push(omit(data, ['24h_volume_usd', 'percent_change_1h', 'percent_change_24h', 'percent_change_7d', 'lastUpdated']));
    }
    // await fs.writeJSONAsync('coin-data.json', [smartData, ...coinData]);
    const newRecord = await addRecord({
        totalNodes: 0,
        familyNodes: nodes,
        familyTotal: total,
        familyIncrease: increase,
        coinData
    });
    return newRecord;
};

(async function() {
    try {

        for(let i = 0; i < 3; i++) {
            const data = await getData();
            // console.log(data);
            if(i < 2) await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch(err) {
        console.error(err);
    }
})();
