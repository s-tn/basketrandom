export function compress(data) {
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
            if (!isNaN(parseFloat(data[key])) && !Array.isArray(data[key])) data[key] = parseFloat(data[key]);
    
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

export function decompress(fullData) {
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
    
    let dict = fullData.match(/([A-Z]{2})=([a-zA-Z0-9_]+)/g) || [];
    let data = fullData.replace(/^[^()]*\(\)/, '');
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
            if (section.match(/^[\-\d\.]+$/)) {
                arr.push(parseFloat(section));
                continue;
            }
            arr.push(layer(section, l + 1))
        }
        
        return arr;
    }

    return layer(data)
}