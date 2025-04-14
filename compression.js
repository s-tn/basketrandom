const data = {
    "type":"event",
    "event":"update",
    "players": [
        {"x":183.35634469985962,"y":140.9772276878357,"angle":0.018187444657087326,"instVars":{"which":0,"first":-1,"angular":-5.982530431453682e-7,"jump":0,"moreJump":10.992666666666507},"velocity":[-4.934403927125963e-9,-2.8736343860025215e-8],"angularVelocity":-8.801120721102507e-9},
        {"x":216.77093505859375,"y":140.88250398635864,"angle":6.16037238786091,"instVars":{"which":3,"first":-1,"angular":-2.686927568055985e-13,"jump":0,"moreJump":10.776333333333254},"velocity":[-3.0547502088897494e-15,-2.8381605399196985e-8],"angularVelocity":-3.952838067039803e-15},
        {"x":95.75695395469666,"y":140.99998474121094,"angle":6.1997433866011065,"instVars":{"which":0,"first":1,"angular":-3.200732462050616e-11,"jump":0,"moreJump":10.919333333333574},"velocity":[-3.063129905836936e-13,-2.838161372586967e-8],"angularVelocity":-4.708715513855599e-13},
        {"x":74.10696744918823,"y":140.83404541015625,"angle":0.06178544461727142,"instVars":{"which":3,"first":1,"angular":-7.27739312402667e-17,"jump":0,"moreJump":0},"velocity":[-7.528150560005931e-19,-2.8381605399196985e-8],"angularVelocity":-1.0706040469981686e-18}
    ],
    "heads":[
        {"x":183.90193562486684,"y":110.98219332899603,"angle":6.126410935317175,"instVars":{"which":0,"first":-1},"velocity":[-3.13745363023088e-7,-1.444125374838734e-8]},
        {"x":213.09579362061584,"y":111.10847908358114,"angle":5.974085513745443,"instVars":{"which":0,"first":-1},"velocity":[-1.3934957237798202e-13,-2.838158041917893e-8]},
        {"x":93.25659968310936,"y":111.10436958649298,"angle":0.10317200422286987,"instVars":{"which":0,"first":-1},"velocity":[-1.6832066610742574e-11,-2.8381322292325706e-8]},
        {"x":75.95935118894263,"y":110.8912909875832,"angle":0.259170800447464,"instVars":{"which":0,"first":-1},"velocity":[-3.7997989003695294e-17,-2.8381605399196985e-8]}
    ],
    "arms":[
        {"x":186.86506891455085,"y":113.03641785015849,"angle":0,"instVars":{"have":0,"ready":0},"velocity":[0,0]},
        {"x":216.31821518533735,"y":112.72588762862918,"angle":0,"instVars":{"have":0,"ready":0},"velocity":[0,0]},
        {"x":90.4337281958815,"y":113.3474393335873,"angle":0,"instVars":{"have":0,"ready":0},"velocity":[0,0]},
        {"x":72.84158375818603,"y":112.70223416177507,"angle":0,"instVars":{"have":0,"ready":0},"velocity":[0,0]}
    ],
    "ball":{
        "x":165.9399151802063,
        "y":136.5582823753357,
        "instVars":{"hold":0,"who":-1},
        "velocity":[0,5.632045940728858e-8]
    },
    "id":278
};

function compress(data) {
    const separators = [
        ',',
        '*',
        '&',
        '^',
        '~',
        '=',
        '@',
        '//',
        '??',
        '..',
        'AA',
        'QT',
        '``',
        '__'
    ];
    
    const replacements = [
        'ZA',
        'ZB',
        'ZC',
        'ZD',
        'ZE',
        'ZF',
        'ZG',
        'ZH',
        'ZI',
        'ZJ',
        'ZK',
        'ZL',
        'ZM',
        'ZN',
        'ZO',
        'ZP',
        'ZQ',
        'ZR'
    ];
    
    function iterCondense(data, layer = 0) {
        if (typeof data !== 'object') return data;
    
        const sep = separators[layer];
    
        return Object.keys(data).map((key, i, obj) => {
            if (!isNaN(parseFloat(data[key]))) data[key] = parseFloat(data[key]);
    
            if (Array.isArray(data[key])) {
                return `${i === 0 ? '' : sep}${key}[${data[key].map(entry => `${iterCondense(entry, layer + 2)}`).join(separators[layer + 1])}]${i === obj.length - 1 ? '' : sep}`;
            } else if (typeof data[key] === 'object') {
                return `${i === 0 ? '' : sep}${key}{${iterCondense(data[key], layer + 1)}}${i === obj.length - 1 ? '' : sep}`;
            } else if (typeof data[key] === 'number') {
                return `${i === 0 ? '' : sep}${key}|${String(parseFloat(data[key].toFixed(8)))}|${i === obj.length - 1 ? '' : sep}`;
            } else {
                return `${i === 0 ? '' : sep}${key}|${String(data[key])}|${i === obj.length - 1 ? '' : sep}`;
            }
        }).join(sep);
    }
    
    function compressNames(data) {
        const matches = data.match(/\w{4,}/g);
        const obj = {};
        matches.forEach(match => obj[match] = (obj[match] || 0) + 1);
    
        for (var phrase in obj) {
            if (obj[phrase] < 4) {
                delete obj[phrase];
                continue;
            }
    
            obj[phrase] = replacements[Object.keys(obj).indexOf(phrase)];
    
            data = data.replaceAll(phrase, obj[phrase]);
        }
    
        const dict = Object.entries(obj).map(entry => entry.toReversed()).map(([key, prop]) => `${key}=${prop}`).join(';');
    
        return `${dict}()${data}`;
    }

    return compressNames(iterCondense(data));
}

function decompress(fullData) {
    const separators = [
        ',',
        '*',
        '&',
        '^',
        '~',
        '=',
        '@',
        '//',
        '??',
        '..',
        'AA',
        'QT',
        '``',
        '__'
    ];
    
    let dict = fullData.match(/([A-Z]{2})=([a-zA-Z0-9_]+)/g);
    let data = fullData.replace(/^[^()]+\(\)/, '');
    let obj = Object.fromEntries(dict.map(entry => entry.split('=').map(e => e.trim())));

    for (var phrase in obj) {
        data = data.replaceAll(phrase, obj[phrase]);
    }

    function layer(d, l = 0) {
        const obj = {};
        const sep = separators[l];
        const split = d.split(sep);

        for (const section of split) {
            if (section.match(/^([^\|\{\}\[]+)\|(.+)\|/)) {
                let [ key, value ] = section.match(/^([^\|\{\}\[]+)\|(.+)\|/).slice(1, 3);

                if (value.match(/^[\-\d\.]+$/)) value = parseFloat(value);

                obj[key] = value;
            } else if (section.match(/^([^\|\{\}\[]+)\[(.+)\]/)) {
                const [ key, value ] = section.match(/^([^\|\{\}\[]+)\[(.+)\]/).slice(1, 3);

                obj[key] = layerArray(value, l + 1);
            } else if (section.match(/^([^\|\{\}\[]+)\{(.+)\}/)) {
                const [ key, value ] = section.match(/^([^\|\{\}\[]+)\{(.+)\}/).slice(1, 3);

                obj[key] = layer(value, l + 1);
            }
        }
        return obj;
    }

    function layerArray(d, l = 0) {
        const arr = [];
        const sep = separators[l];
        const split = d.split(sep);

        for (const section of split) {
            arr.push(layer(section, l + 1))
        }
        
        return arr;
    }

    return layer(data)
}


console.time();
//for (let i = 0; i < 10; i++) {
    console.log(decompress(compress(data)));
    //const decompressed = decompress(compressed);
    //console.log(decompressed);
//}
console.timeEnd(); // 1.5s