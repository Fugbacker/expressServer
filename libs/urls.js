export const getClickUrls = (inputType, convertedType, bbox, z, x, y) => [
  `https://mobile.rosreestr.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetFeatureInfo&QUERY_LAYERS=${inputType}&SERVICE=WMS&VERSION=1.3.0&FORMAT=image%2Fpng&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&INFO_FORMAT=application%2Fjson&FEATURE_COUNT=10&I=91&J=508&WIDTH=512&HEIGHT=512&CRS=EPSG%3A3857&BBOX=${bbox}`,
  `https://map.ru/api/wms?x=${x}&y=${y}&layers=${inputType}`,
  `https://pub.fgislk.gov.ru/map/nspd/api/aeggis/v3/${inputType}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&FORMAT=image/png&TRANSPARENT=true&QUERY_LAYERS=${inputType}&LAYERS=${inputType}&INFO_FORMAT=application/json&FEATURE_COUNT=10&RANDOM=${Math.random()}&I=235&J=24&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&STYLES=&BBOX=${bbox}`,
  `https://pkk.reestrn.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetFeatureInfo&QUERY_LAYERS=${inputType}&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&INFO_FORMAT=application/json&FEATURE_COUNT=10&I=172&J=34&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
  `https://binep.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetFeatureInfo&QUERY_LAYERS=${inputType}&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&INFO_FORMAT=application/json&FEATURE_COUNT=10&I=172&J=34&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
  `https://nspd.gov.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetFeatureInfo&QUERY_LAYERS=${inputType}&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&INFO_FORMAT=application/json&FEATURE_COUNT=10&I=416&J=271&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
  `https://test.fgishub.ru/apipoint.php?point=/api/aeggis/v3/${inputType}/wms&REQUEST=GetFeatureInfo&QUERY_LAYERS=${inputType}&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&INFO_FORMAT=application/json&FEATURE_COUNT=10&I=1122&J=371&WIDTH=1903&HEIGHT=900&CRS=EPSG:3857&BBOX=${bbox}`,
  `https://api.roscadastres.com`,
  `https://binep.ru/api/v3/search`,

];

export const getTileUrls = (inputType, convertedType, bbox, z, x, y) => [
  `https://mobile.rosreestr.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
  `https://pub.fgislk.gov.ru/map/nspd/api/aeggis/v2/${inputType}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=${inputType}&STYLES=&RANDOM=${Math.random()}&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
  `https://pkk.reestr54.ru/tiles/?bbox=${bbox}&layer=${inputType}`,
  `https://pkk.reestrn.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
  `https://geo.mapbaza.ru/geoserver/postgis/wms?REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=postgis:layer_${inputType}&CRS=EPSG:3857&WIDTH=512&HEIGHT=512&BBOX=${bbox}`,
  `https://binep.ru/api/aeggis/v3/${inputType}/wms?service=WMS&request=GetMap&layers=${inputType}&styles=&format=image/png&transparent=true&version=1.3.0&width=512&height=512&RANDOM=${Math.random()}&crs=EPSG:3857&bbox=${bbox}`,
  `https://nspd.gov.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
  // `https://apipkk.ru/api/aeggis/v3/${inputType}/wms?REQUEST=GetMap&SERVICE=WMS&VERSION=1.3.0&FORMAT=image/png&STYLES=&TRANSPARENT=true&LAYERS=${inputType}&RANDOM=${Math.random()}&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX=${bbox}`,
];

export const getGeoportalUrls = (cadNum) => [
  // `https://kadastr.notusx.ru/index.php?action=getAddresses&address=${cadNum}`,
  `https://nspd.gov.ru/api/geoportal/v2/search/assistantSurveyor?query=${cadNum}`, //нет
  // `https://ns2.mapbaza.ru/api/geoportal/v2/search/geoportal?query=${cadNum}&thematicSearchId=1`,
  // `https://nspd.gov.ru/api/geoportal/v2/search/cadastralPrice?query=${cadNum}`, //нет
  // `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${cadNum}`, //нет
  // `https://mobile.rosreestr.ru/api/geoportal/v2/search/mapDemo?query=${cadNum}`, //нет
  // `https://test.fgishub.ru/api.php?query=${cadNum}`,
  // 'https://binep.ru/api/v3/search',
  // `https://apipkk.ru/api/geoportal/v2/search/geoportal?query=${cadNum}`,
  // `https://map.ru/api/kad/suggestions?query=${cadNum}`,
  // `https://pub.fgislk.gov.ru/map/nspd/api/geoportal/v2/search/geoportal?query=${cadNum}`,
  // `https://fgistp.economy.gov.ru/controllers/router.php?path=api/geoportal/v2/search/geoportal&controller=nspd&op=proxy&function=wms&REQUEST=thematicSearchId=1&query=${cadNum}`, //нет
  // `https://api.roscadastres.com/pkk_files/data2.php?type=5&id=${cadNum}`,
  // `https://nspd.gov.ru/api/data-fund/v1/geom?kind=land&cadNumber=${cadNum}`, //нет
  // `https://pkk.reestrn.ru/api/geoportal/v2/search/geoportal?query=${cadNum}`,
];

export const getHistoryUrls = (cadNum) => [
  `https://apipkk.ru/api/data-fund/v2/cadastral-history-diagram?cadNumber=${cadNum}`,
  `https://nspd.gov.ru/api/data-fund/v2/cadastral-history-diagram?cadNumber=${cadNum}`,
];


 export const origins = [
    "https://pkk-egrp365.ru",
    "https://nspd-rosreestr.ru",
    "https://egrp-rosreestr.ru",
    "https://rosreestr-pkk.ru",
    "https://pkk5-rosreestor.ru",
    "https://egrp365-karta.ru",
    "https://rosreestr-russia.ru",
    "https://ppk5-rosreestra.ru",
    "https://rosreestr-egrp.ru",
    "https://ppk5.ru",
    "https://pkk-gov.ru",
  ];

