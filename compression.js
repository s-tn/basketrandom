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


console.time();
//for (let i = 0; i < 10; i++) {
    /*console.log((compress({
        x: 145.00000476837158,
        y: 136.75001859664917,
        instVars: { hold: 0, who: -1 },
        velocity: [ 0, -6.861569090688135e-8 ]
      })));*/
      console.log(decompress("update[ZA=angle;ZB=instVars;ZC=which;ZD=first;ZE=angular;ZF=jump;ZG=moreJump;ZH=velocity;ZI=649746557371941e;ZJ=angularVelocity;ZK=have;ZL=ready()type|event|,,,event|update|,,,players[x|131.22147322|&&&y|140.71763754|&&&ZA|0.10076757|&&&ZB{ZC|0|^^^ZD|-1|^^^ZE|0|^^^ZF|0|^^^ZG|10.901|}&&&ZH[6.317050217590134e-30^9.ZI-8]&&&ZEVelocity|0|*x|166.09582901|&&&y|140.76058865|&&&ZA|0.08324001|&&&ZB{ZC|3|^^^ZD|-1|^^^ZE|0|^^^ZF|0|^^^ZG|10.901|}&&&ZH[-6.162975822039155e-30^9.ZI-8]&&&ZEVelocity|0|*x|82.25421906|&&&y|140.7621026|&&&ZA|0.0797271|&&&ZB{ZC|0|^^^ZD|1|^^^ZE|0|^^^ZF|0|^^^ZG|10.967|}&&&ZH[2.5750526185906883e-31^9.ZI-8]&&&ZEVelocity|0|*x|54.8797965|&&&y|140.92255831|&&&ZA|0.0298032|&&&ZB{ZC|3|^^^ZD|1|^^^ZE|0|^^^ZF|0|^^^ZG|10.967|}&&&ZH[7.703719777548943e-31^9.ZI-8]&&&ZEVelocity|0|],,,heads[x|134.2393827|&&&y|110.86983257|&&&ZA|6.19241861|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[-6.729451907697706e-25^9.ZI-8]*x|168.5901408|&&&y|110.86446895|&&&ZA|6.17235645|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[-5.3843503870633856e-24^9.ZI-8]*x|84.64349485|&&&y|110.85740049|&&&ZA|0.25510338|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[1.0361141048543276e-29^9.ZI-8]*x|55.77375484|&&&y|110.93588818|&&&ZA|0.22762015|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[-1.3461221094304498e-24^9.ZI-8]],,,arms[x|137.02297431|&&&y|113.16146609|&&&ZA|0|&&&ZB{ZK|0|^^^ZL|0|}&&&ZH[0^0]*x|171.41347131|&&&y|113.10696899|&&&ZA|0|&&&ZB{ZK|1|^^^ZL|0|}&&&ZH[0^0]*x|81.49374316|&&&y|112.61211723|&&&ZA|0|&&&ZB{ZK|1|^^^ZL|1|}&&&ZH[0^0]*x|52.71549487|&&&y|112.84559625|&&&ZA|0|&&&ZB{ZK|0|^^^ZL|0|}&&&ZH[0^0]],,,ball{x|171.41347131|***y|129.10696899|***ZB{hold|1|&&&who|2|}***ZH[0&0]},,,id|2706|"))
    //const decompressed = decompress(compressed);
    //console.log(decompressed);
//}
console.timeEnd(); // 1.5s

"update[ZA=angle;ZB=instVars;ZC=which;ZD=first;ZE=angular;ZF=jump;ZG=moreJump;ZH=velocity;ZI=angularVelocity;ZJ=have;ZK=ready()type|event|,,,event|update|,,,players[x|193.86247396|&&&y|140.92774391|&&&ZA|6.1755526|&&&ZB{ZC|0|^^^ZD|-1|^^^ZE|0|^^^ZF|0|^^^ZG|12.48|}&&&ZH|0|&&&ZEVelocity|0|*x|254.44417|&&&y|141.04288816|&&&ZA|6.21408783|&&&ZB{ZC|3|^^^ZD|-1|^^^ZE|0|^^^ZF|0|^^^ZG|10.98533333|}&&&ZH|0|&&&ZEVelocity|0|*x|139.23054934|&&&y|140.93544483|&&&ZA|6.17813419|&&&ZB{ZC|0|^^^ZD|1|^^^ZE|0|^^^ZF|0|^^^ZG|10.98533333|}&&&ZH|0|&&&ZEVelocity|0|*x|54.47747707|&&&y|140.8462882|&&&ZA|0.05577816|&&&ZB{ZC|3|^^^ZD|1|^^^ZE|0|^^^ZF|0|^^^ZG|7.326|}&&&ZH|0|&&&ZEVelocity|0|],,,heads[x|190.63973101|&&&y|111.10135492|&&&ZA|5.97675917|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|0|*x|252.37288458|&&&y|111.11449137|&&&ZA|6.03168241|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|0|*x|136.08480881|&&&y|111.10083292|&&&ZA|0.1043894|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|0|*x|56.14994999|&&&y|110.89295002|&&&ZA|0.25265709|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|0|],,,arms[x|193.83721333|&&&y|112.76749956|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|*x|255.50382106|&&&y|112.90257652|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|*x|133.31106366|&&&y|113.40437712|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|*x|53.04312156|&&&y|112.72258603|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|],,,ball{x|88.35375905|***y|136.7500186|***ZB{hold|0|&&&who|-1|}***ZH|0|},,,id|8824|"
"update[ZA=angle;ZB=instVars;ZC=which;ZD=first;ZE=angular;ZF=jump;ZG=moreJump;ZH=velocity;ZI=angularVelocity;ZJ=have;ZK=ready()type|event|,,,event|update|,,,players[x|196.31370306|&&&y|140.68239927|&&&ZA|0.11649565|&&&ZB{ZC|0|^^^ZD|-1|^^^ZE|43.56431404|^^^ZF|0|^^^ZG|10.78733333|}&&&ZH|0.50530112|&&&ZEVelocity|0.65160567|*x|208.4135294|&&&y|140.86362123|&&&ZA|0.05543219|&&&ZB{ZC|3|^^^ZD|-1|^^^ZE|0.54054399|^^^ZF|0|^^^ZG|7.227|}&&&ZH|0.00508982|&&&ZEVelocity|0.00808509|*x|115.57956934|&&&y|141.0902977|&&&ZA|6.22991989|&&&ZB{ZC|0|^^^ZD|1|^^^ZE|-0.00026195|^^^ZF|0|^^^ZG|10.94133333|}&&&ZH|-0.00000203|&&&ZEVelocity|-0.00000392|*x|74.06347394|&&&y|140.96558094|&&&ZA|6.18823269|&&&ZB{ZC|3|^^^ZD|1|^^^ZE|0|^^^ZF|0|^^^ZG|0|}&&&ZH|0|&&&ZEVelocity|0|],,,heads[x|199.80066851|&&&y|110.88573624|&&&ZA|6.19969846|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|22.07397968|*x|210.07563134|&&&y|110.90971156|&&&ZA|6.1533501|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|0.26881285|*x|113.98236464|&&&y|111.13284473|&&&ZA|0.15614827|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|-0.00012964|*x|71.21917156|&&&y|111.10072323|&&&ZA|0.11448198|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH|0|],,,arms[x|202.54787458|&&&y|113.22087882|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|*x|212.96022794|&&&y|113.07283981|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|*x|111.09309756|&&&y|113.28972988|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|*x|68.42230771|&&&y|113.37614014|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH|0|],,,ball{x|49.24639463|***y|40.33130705|***ZB{hold|0|&&&who|-1|}***ZH|0|},,,id|3705|"
"update[ZA=angle;ZB=instVars;ZC=which;ZD=first;ZE=angular;ZF=jump;ZG=moreJump;ZH=velocity;ZI=angularVelocity;ZJ=have;ZK=ready()type|event|,,,event|update|,,,players[x|203.96153927|&&&y|138.34842443|&&&ZA|1.32800424|&&&ZB{ZC|0|^^^ZD|-1|^^^ZE|-210.63836432|^^^ZF|0|^^^ZG|10.89733333|}&&&ZH[-8.655044436454773^1.5733664855360985]&&&ZEVelocity|-2.61799383|*x|245.87025642|&&&y|140.29244184|&&&ZA|0.30956957|&&&ZB{ZC|3|^^^ZD|-1|^^^ZE|81.46249057|^^^ZF|0|^^^ZG|1.826|}&&&ZH[1.7267050221562386^-3.97949256002903]&&&ZEVelocity|1.2059747|*x|115.15033245|&&&y|140.95722437|&&&ZA|0.01615008|&&&ZB{ZC|0|^^^ZD|1|^^^ZE|19.78683473|^^^ZF|0|^^^ZG|0|}&&&ZH[0.1614399836398661^-0.9115302935242653]&&&ZEVelocity|0.27833694|*x|74.08320904|&&&y|141.12446308|&&&ZA|6.25341131|&&&ZB{ZC|3|^^^ZD|1|^^^ZE|-0.00007737|^^^ZF|0|^^^ZG|0|}&&&ZH[0^0]&&&ZEVelocity|-0.00000109|],,,heads[x|233.08218479|&&&y|131.13580115|&&&ZA|1.55395114|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[-27.59968638420105^-86.08755469322205]*x|255.00970713|&&&y|111.71851201|&&&ZA|0.36428833|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[61.80717349052429^6.392012536525726]*x|115.63480838|&&&y|110.96114769|&&&ZA|0.19782589|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[10.382143408060074^-0.12724793050438166]*x|73.19012416|&&&y|111.13776906|&&&ZA|0.17068836|&&&ZB{ZC|0|^^^ZD|-1|}&&&ZH[0^0]],,,arms[x|231.86155463|&&&y|134.5288508|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH[0^0]*x|257.25781419|&&&y|114.53737384|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH[0^0]*x|112.60290631|&&&y|112.9124277|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH[0^0]*x|70.25099003|&&&y|113.22618182|&&&ZA|0|&&&ZB{ZJ|0|^^^ZK|0|}&&&ZH[0^0]],,,ball{x|104.11691666|***y|40.63499272|***ZB{hold|0|&&&who|-1|}***ZH[-106.8055510520935&35.33478081226349]},,,id|313|"