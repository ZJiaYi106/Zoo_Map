/**
 * 海滨国家森林公园手绘导览图 — 节点坐标与园路网络
 * 坐标系：x/y 为相对底图宽高的百分比（0–100），与 images/park-map.png 对齐
 * 底图为竖版手绘图，宽约高 0.71（宽/高）
 */

const MAP_IMAGE = "/images/park-map.png";
/** 底图宽高比 width/height，getImageInfo 失败时使用 */
const MAP_ASPECT_FALLBACK = 0.71;
const METER_PER_PERCENT = 11;

/** 游客可选 POI（已按导览图标注位置校验） */
const POI_SEED = [
  { id: 1, name: "售票处", intro: "购票入园，可在此领取纸质导览图。", type: "service", x: 14, y: 76 },
  { id: 2, name: "游客中心", intro: "咨询、寄存、失物招领与便民服务。", type: "service", x: 26, y: 73 },
  { id: 3, name: "中心广场", intro: "园区中枢广场，可换乘各主题园路。", type: "scenic", x: 43, y: 63 },
  { id: 4, name: "避险处", intro: "应急避险与临时庇护点。", type: "service", x: 47, y: 57 },
  { id: 5, name: "狮园", intro: "观赏狮子等猛兽，请沿步道参观勿投喂。", type: "scenic", x: 18, y: 30 },
  { id: 6, name: "鹤园", intro: "丹顶鹤等水禽栖息展示，宜保持安静。", type: "scenic", x: 40, y: 11 },
  { id: 7, name: "百鹅湖", intro: "湖面开阔，适合观鸟、休憩与拍照。", type: "scenic", x: 54, y: 23 },
  { id: 8, name: "雉鸡园", intro: "雉鸡及山地鸟类展示区域。", type: "scenic", x: 76, y: 9 },
  { id: 9, name: "东南门", intro: "园区东南侧出入口。", type: "gate", x: 83, y: 40 },
  { id: 10, name: "东南中", intro: "东南片区步道交汇点。", type: "rest", x: 74, y: 50 },
  { id: 11, name: "非洲部落", intro: "非洲风情主题展示区。", type: "scenic", x: 71, y: 68 },
  { id: 12, name: "青竹雅苑", intro: "竹林休憩与竹文化体验。", type: "scenic", x: 64, y: 79 },
  { id: 13, name: "主入口（S364）", intro: "沿 S364 抵达的主入口，建议先看导览。", type: "gate", x: 10, y: 86 },
  { id: 14, name: "观海平台", intro: "近海滨沙滩，可远眺海岸线。", type: "view", x: 87, y: 85 }
];

/** 园路岔口（路径规划用） */
const WAYPOINT_SEED = [
  { id: 101, x: 16, y: 75 },
  { id: 102, x: 28, y: 70 },
  { id: 103, x: 34, y: 64 },
  { id: 104, x: 21, y: 54 },
  { id: 105, x: 17, y: 44 },
  { id: 106, x: 28, y: 36 },
  { id: 107, x: 36, y: 24 },
  { id: 108, x: 46, y: 20 },
  { id: 109, x: 50, y: 35 },
  { id: 110, x: 56, y: 45 },
  { id: 111, x: 66, y: 32 },
  { id: 112, x: 72, y: 18 },
  { id: 113, x: 80, y: 46 },
  { id: 114, x: 70, y: 58 },
  { id: 115, x: 64, y: 66 },
  { id: 116, x: 50, y: 74 },
  { id: 117, x: 34, y: 76 },
  { id: 118, x: 48, y: 58 },
  { id: 119, x: 40, y: 50 },
  { id: 120, x: 48, y: 14 },
  { id: 121, x: 28, y: 62 }
];

const EDGE_SEED = [
  { a: 13, b: 1, via: [{ x: 11, y: 82 }] },
  { a: 1, b: 101, via: [{ x: 14, y: 78 }] },
  { a: 101, b: 2, via: [{ x: 20, y: 74 }] },
  { a: 2, b: 102, via: [{ x: 24, y: 72 }] },
  { a: 102, b: 103, via: [{ x: 30, y: 68 }] },
  { a: 103, b: 3, via: [{ x: 38, y: 65 }] },
  { a: 3, b: 4, via: [] },
  { a: 3, b: 118, via: [{ x: 46, y: 60 }] },
  { a: 118, b: 119, via: [] },
  { a: 119, b: 5, via: [{ x: 30, y: 42 }, { x: 22, y: 36 }] },
  { a: 5, b: 106, via: [{ x: 20, y: 28 }] },
  { a: 106, b: 107, via: [{ x: 32, y: 30 }] },
  { a: 107, b: 108, via: [] },
  { a: 108, b: 6, via: [{ x: 44, y: 16 }] },
  { a: 6, b: 120, via: [] },
  { a: 120, b: 7, via: [{ x: 51, y: 19 }] },
  { a: 7, b: 109, via: [{ x: 55, y: 28 }] },
  { a: 3, b: 109, via: [{ x: 44, y: 56 }, { x: 48, y: 48 }] },
  { a: 7, b: 112, via: [{ x: 62, y: 16 }, { x: 70, y: 12 }] },
  { a: 109, b: 110, via: [] },
  { a: 110, b: 10, via: [{ x: 66, y: 48 }] },
  { a: 8, b: 112, via: [{ x: 75, y: 14 }] },
  { a: 112, b: 111, via: [{ x: 70, y: 26 }] },
  { a: 111, b: 109, via: [] },
  { a: 8, b: 113, via: [{ x: 80, y: 22 }] },
  { a: 113, b: 9, via: [] },
  { a: 9, b: 10, via: [{ x: 80, y: 45 }] },
  { a: 10, b: 114, via: [] },
  { a: 114, b: 11, via: [{ x: 72, y: 64 }] },
  { a: 11, b: 115, via: [] },
  { a: 115, b: 12, via: [{ x: 66, y: 74 }] },
  { a: 12, b: 116, via: [{ x: 56, y: 78 }] },
  { a: 116, b: 3, via: [{ x: 48, y: 68 }] },
  { a: 3, b: 117, via: [{ x: 38, y: 70 }] },
  { a: 117, b: 2, via: [] },
  { a: 3, b: 121, via: [{ x: 32, y: 64 }] },
  { a: 121, b: 104, via: [] },
  { a: 104, b: 105, via: [] },
  { a: 105, b: 106, via: [] },
  { a: 12, b: 14, via: [{ x: 76, y: 82 }] },
  { a: 116, b: 14, via: [{ x: 70, y: 80 }] },
  { a: 7, b: 108, via: [] },
  { a: 10, b: 113, via: [{ x: 78, y: 52 }] }
];

const SCENE_TO_POI = {
  main: 13,
  entrance: 13,
  s364: 13,
  ticket: 1,
  ticket_office: 1,
  visitor: 2,
  center: 3,
  square: 3,
  shelter: 4,
  lion: 5,
  crane: 6,
  lake: 7,
  swan: 7,
  pheasant: 8,
  southeast_gate: 9,
  southeast: 10,
  africa: 11,
  bamboo: 12,
  sea: 14,
  beach: 14
};

const TYPE_META = {
  gate: { label: "出入口", cls: "type-gate", color: "#1565c0" },
  service: { label: "服务", cls: "type-service", color: "#6a4c9a" },
  scenic: { label: "景点", cls: "type-scenic", color: "#2e7d32" },
  view: { label: "观景", cls: "type-view", color: "#e65100" },
  rest: { label: "休憩", cls: "type-rest", color: "#546e7a" }
};

function buildNodeMap() {
  const map = {};
  POI_SEED.forEach((p) => { map[p.id] = { x: p.x, y: p.y }; });
  WAYPOINT_SEED.forEach((w) => { map[w.id] = { x: w.x, y: w.y }; });
  return map;
}

module.exports = {
  MAP_IMAGE,
  MAP_ASPECT_FALLBACK,
  METER_PER_PERCENT,
  POI_SEED,
  WAYPOINT_SEED,
  EDGE_SEED,
  SCENE_TO_POI,
  TYPE_META,
  buildNodeMap
};
