/** 景点封面路径：兼容数据库仍返回 .png 的情况 */
const LOCAL_COVER_BY_NAME = {
  "猛兽区观景台": "/images/scenic-beast-deck.jpg",
  "狮虎园": "/images/scenic-lion-yard.jpg",
  "食草动物区": "/images/scenic-herbivore-zone.jpg",
  "长颈鹿互动广场": "/images/scenic-giraffe-plaza.jpg",
  "鸟类表演场": "/images/scenic-bird-show.jpg",
  "水禽湖": "/images/scenic-waterfowl-lake.jpg",
  "售票处": "/images/home-banner.jpg",
  "游客中心": "/images/home-banner.jpg",
  "中心广场": "/images/scenic-herbivore-zone.jpg",
  "狮园": "/images/scenic-lion-yard.jpg",
  "鹤园": "/images/scenic-bird-show.jpg",
  "百鹅湖": "/images/scenic-waterfowl-lake.jpg",
  "雉鸡园": "/images/scenic-bird-show.jpg",
  "观海平台": "/images/home-banner.jpg"
};

const PNG_TO_JPG = {
  "/images/scenic-beast-deck.png": "/images/scenic-beast-deck.jpg",
  "/images/scenic-lion-yard.png": "/images/scenic-lion-yard.jpg",
  "/images/scenic-herbivore-zone.png": "/images/scenic-herbivore-zone.jpg",
  "/images/scenic-giraffe-plaza.png": "/images/scenic-giraffe-plaza.jpg",
  "/images/scenic-bird-show.png": "/images/scenic-bird-show.jpg",
  "/images/scenic-waterfowl-lake.png": "/images/scenic-waterfowl-lake.jpg",
  "/images/home-banner.png": "/images/home-banner.jpg"
};

const FALLBACK = "/images/home-banner.jpg";

function resolveScenicImage(item) {
  const name = item && item.name ? String(item.name).trim() : "";
  if (name && LOCAL_COVER_BY_NAME[name]) return LOCAL_COVER_BY_NAME[name];
  let path = item && item.image ? String(item.image).trim() : "";
  if (!path) return FALLBACK;
  if (PNG_TO_JPG[path]) return PNG_TO_JPG[path];
  if (/^\/images\/scenic-.+\.png$/i.test(path)) return path.replace(/\.png$/i, ".jpg");
  return path;
}

module.exports = {
  LOCAL_COVER_BY_NAME,
  resolveScenicImage,
  FALLBACK
};
