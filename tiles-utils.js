const pi = Math.PI;

function buidTilesBbox(x, y, tileSize = 256) {
  return [
    [x * tileSize, y * tileSize],
    [(x + 1) * tileSize, (y + 1) * tileSize]
  ];
}

function project(latLon) {
  const MAX_LATITUDE = 85.0511287798;
  const lat = Math.max(Math.min(MAX_LATITUDE, latLon[0]), -MAX_LATITUDE);
  const x = deg2rad(latLon[1]);
  const y = deg2rad(lat);
  const projectedY = Math.log(Math.tan(pi / 4 + y / 2));
  return [x, projectedY];
}

function unproject(point) {
  const lon = rad2deg(point[0]);
  const lat = rad2deg(2 * Math.atan(Math.exp(point[1])) - pi / 2);
  return [lat, lon];
}

function untransform(point, scale) {
  const A = 0.159154943;
  const C = -A;
  const x = (point[0] / scale - 0.5) / A;
  const y = (point[1] / scale - 0.5) / C;
  return [x, y];
}

function transform(point, scale) {
  const A = 0.159154943; // 0.5 * pi
  const C = -A;
  const x = scale * (A * point[0] + 0.5);
  const y = scale * (C * point[1] + 0.5);
  return [x, y];
}

function scale(zoom) {
  return 256 * Math.pow(2, zoom);
}

function pointToLatLng(point, zoom) {
  const currentScale = scale(zoom);
  const untransformedPoint = untransform(point, currentScale);
  return unproject(untransformedPoint);
}

function latLngToPoint(latlng, zoom) {
  const projectedPoint = project(latlng);
  const currentScale = scale(zoom);
  return transform(projectedPoint, currentScale);
}

function convertLatLng(latLng) {
  const R = 6378137;
  const MAX_LATITUDE = 85.0511287798;
  const d = pi / 180;
  const max = MAX_LATITUDE;
  const lat = Math.max(Math.min(max, latLng[0]), -max);
  const sin = Math.sin(lat * d);
  return [R * latLng[1] * d, (R * Math.log((1 + sin) / (1 - sin))) / 2];
}

function getBbox(x, y, z) {
  const bboxTiles = buidTilesBbox(x, y, 256);
  const bounds = [
    pointToLatLng([bboxTiles[0][0], bboxTiles[0][1]], z),
    pointToLatLng([bboxTiles[1][0], bboxTiles[1][1]], z)
  ];
  const nw = convertLatLng(bounds[0]);
  const se = convertLatLng(bounds[1]);
  return [nw[0], se[1], se[0], nw[1]].join(',');
}

function deg2rad(deg) {
  return (deg * pi) / 180;
}

function rad2deg(rad) {
  return (rad * 180) / pi;
}

module.exports = {
  buidTilesBbox,
  project,
  unproject,
  untransform,
  transform,
  scale,
  pointToLatLng,
  latLngToPoint,
  convertLatLng,
  getBbox,
  deg2rad,
  rad2deg
};
