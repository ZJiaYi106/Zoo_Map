// pages/map/map.js — 海滨国家森林公园手绘导览图导航

const {
  MAP_IMAGE,
  MAP_ASPECT_FALLBACK,
  METER_PER_PERCENT,
  POI_SEED,
  EDGE_SEED,
  SCENE_TO_POI,
  TYPE_META,
  buildNodeMap
} = require("./map-data.js");

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function euclid(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function polylineLength(points) {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) sum += euclid(points[i - 1], points[i]);
  return sum;
}

/** Catmull-Rom 样条插值：在 p1→p2 之间用 p0/p3 控制曲线弧度 */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const cx = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const cy = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return { x: cx, y: cy };
}

/** 将折线顶点用 Catmull-Rom 样条平滑并超采样，使线路呈现细腻曲线 */
function smoothPolyline(polyline, sampleInterval) {
  if (polyline.length < 2) return polyline;
  var result = [];
  for (var i = 0; i < polyline.length - 1; i++) {
    var p0 = polyline[i > 0 ? i - 1 : 0];
    var p1 = polyline[i];
    var p2 = polyline[i + 1];
    var p3 = polyline[i < polyline.length - 2 ? i + 2 : polyline.length - 1];
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    var segLen = Math.sqrt(dx * dx + dy * dy);
    var n = Math.max(4, Math.ceil(segLen / sampleInterval));
    for (var j = 0; j < n; j++) {
      result.push(catmullRom(p0, p1, p2, p3, j / n));
    }
  }
  result.push(polyline[polyline.length - 1]);
  return result;
}

Page({
  data: {
    mapImage: MAP_IMAGE,
    poiList: [],
    roadSegments: [],
    routeDots: [],
    showDetail: false,
    currentPoi: { id: null, name: "", intro: "", type: "" },
    startId: 13,
    endId: 6,
    startIndex: 12,
    endIndex: 5,
    poiNames: [],
    routeText: "未规划路线",
    routeMeters: 0,
    routeMinutes: 0,
    isNavigating: false,
    navHint: "",
    navHintShort: "沿园路步行",
    legendOpen: false,
    sceneStyle: "transform: translate3d(0px, 0px, 0) scale(1);",
    mapViewportStyle: "",
    mapCam: { ready: 0, vw: 0, vh: 0, ch: 0, minScale: 1, maxScale: 3, tx: 0, ty: 0, scale: 1 },
    hasRoute: false,
    userPoiId: 13,
    userPosStyle: "",
    legendItems: [],
    activeLegendType: "all",
    legendPoiList: [],
    coordX: 0,
    coordY: 0,
    showCoord: false
  },

  onLoad(options) {
    this.nodeMap = buildNodeMap();
    this.poiMap = {};
    POI_SEED.forEach((p) => { this.poiMap[p.id] = p; });
    this.edgePolylineMap = this._buildEdgePolylineMap();
    this.adj = this._buildGraph();
    this.viewport = { w: 0, h: 0 };
    this.contentHeight = 0;
    this.mapAspect = MAP_ASPECT_FALLBACK;
    this.camera = { scale: 1, tx: 0, ty: 0 };
    this.fitScale = 1;
    this.routePath = [];
    this.routePolyline = [];
    this.gesture = null;

    this.setData({
      poiList: this._decoratePoiList(new Set(), "all"),
      roadSegments: [],
      poiNames: POI_SEED.map((p) => p.name),
      legendItems: this._buildLegendItems(),
      navHint: "沿米色园路步行，绿色线为推荐路线",
      navHintShort: "沿园路步行"
    });

    this._initUserPositionByQr(options || {});

    if (options.from === "facility") {
      this._applyMapFocus();
    }
  },

  onReady() {
    this._loadMapImageMeta(() => {
      this._layoutMapStage(() => {
        this._syncUserPosStyle();
        this._centerOnPoi(this.data.userPoiId || this.data.startId, true);
      });
    });
  },

  onUnload() {},

  _loadMapImageMeta(cb) {
    wx.getImageInfo({
      src: MAP_IMAGE,
      success: (res) => {
        if (res.width && res.height) this.mapAspect = res.width / res.height;
        if (cb) cb();
      },
      fail: () => {
        this.mapAspect = MAP_ASPECT_FALLBACK;
        if (cb) cb();
      }
    });
  },

  _layoutMapStage(cb, retry) {
    const q = wx.createSelectorQuery();
    q.select(".map-wrap").boundingClientRect();
    q.exec((res) => {
      const wrap = res && res[0];
      if (!wrap || !wrap.width) {
        if (cb) cb();
        return;
      }
      if ((!wrap.height || wrap.height < 80) && (retry || 0) < 8) {
        setTimeout(() => this._layoutMapStage(cb, (retry || 0) + 1), 60);
        return;
      }
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const winH = win.windowHeight || 640;
      const margin = 4;
      const availW = wrap.width - margin;
      let availH = Math.max(wrap.height, winH * 0.58) - 6;
      const aspect = this.mapAspect || MAP_ASPECT_FALLBACK;
      let mapW;
      let mapH;
      mapW = availW;
      mapH = mapW / aspect;
      if (mapH > availH) {
        mapH = availH;
        mapW = mapH * aspect;
      }
      this.viewport = { w: mapW, h: mapH };
      this.contentHeight = mapH;
      this.fitScale = 1;
      this.minScale = 0.85;
      this.maxScale = 3.2;
      this.camera = { scale: 1, tx: 0, ty: 0 };
      this.setData({
        mapViewportStyle: `width:${mapW}px;height:${mapH}px;margin:6px auto 0;`
      }, () => {
        this._pushMapCam({ scale: 1, tx: 0, ty: 0 });
        if (cb) cb();
      });
    });
  },

  _measureViewport(cb) {
    const q = wx.createSelectorQuery();
    q.select("#mapViewport").boundingClientRect();
    q.exec((res) => {
      const r = res && res[0];
      if (!r || !r.width || !r.height) return;
      this.viewport = { w: r.width, h: r.height };
      this.contentHeight = r.height;
      if (cb) cb();
    });
  },

  _pushMapCam(partial) {
    const { w, h } = this.viewport;
    const ch = this.contentHeight || h;
    const cam = {
      scale: partial.scale != null ? partial.scale : this.camera.scale,
      tx: partial.tx != null ? partial.tx : this.camera.tx,
      ty: partial.ty != null ? partial.ty : this.camera.ty
    };
    this._clampCamera(cam);
    this.camera = cam;
    this.setData({
      sceneStyle: `transform: translate3d(${cam.tx}px, ${cam.ty}px, 0) scale(${cam.scale});`,
      mapCam: {
        ready: 1,
        vw: w,
        vh: h,
        ch,
        minScale: this.minScale,
        maxScale: this.maxScale,
        tx: cam.tx,
        ty: cam.ty,
        scale: cam.scale
      }
    });
  },

  syncMapCamera(e) {
    const p = e || {};
    this.camera = {
      tx: Number(p.tx) || 0,
      ty: Number(p.ty) || 0,
      scale: Number(p.scale) || 1
    };
  },

  onMapTapAt(e) {
    const px = Number(e.x);
    const py = Number(e.y);
    if (!px && !py) return;
    const { w, h } = this.viewport;
    if (!w || !h) return;
    const q = wx.createSelectorQuery();
    q.select("#mapViewport").boundingClientRect();
    q.exec((res) => {
      const vp = res && res[0];
      if (!vp) return;
      const s = this.camera.scale || 1;
      const tx = this.camera.tx || 0;
      const ty = this.camera.ty || 0;
      const sx = (px - vp.left - tx) / s;
      const sy = (py - vp.top - ty) / s;
      const pctX = (sx / w) * 100;
      const pctY = (sy / h) * 100;
      const rx = Math.round(pctX * 100) / 100;
      const ry = Math.round(pctY * 100) / 100;
      this.setData({ coordX: rx, coordY: ry, showCoord: true });
      if (this._coordTimer) clearTimeout(this._coordTimer);
      this._coordTimer = setTimeout(() => this.setData({ showCoord: false }), 4000);
      let hit = null;
      let best = 8;
      POI_SEED.forEach((p) => {
        if (this.data.activeLegendType !== "all" && p.type !== this.data.activeLegendType) return;
        const d = Math.sqrt((p.x - pctX) ** 2 + (p.y - pctY) ** 2);
        if (d < best) {
          best = d;
          hit = p;
        }
      });
      if (hit) this._openPoiDetail(hit);
    });
  },

  _openPoiDetail(poi) {
    if (!poi) return;
    this.setData({ showDetail: true, currentPoi: poi });
  },

  _buildEdgePolylineMap() {
    const map = {};
    EDGE_SEED.forEach((edge) => {
      const na = this.nodeMap[edge.a];
      const nb = this.nodeMap[edge.b];
      const via = (edge.via || []).map((p) => ({ x: p.x, y: p.y }));
      map[edgeKey(edge.a, edge.b)] = {
        from: edge.a,
        points: [na, ...via, nb]
      };
    });
    return map;
  },

  _getEdgePolyline(a, b) {
    const entry = this.edgePolylineMap[edgeKey(a, b)];
    if (entry) {
      return entry.from === a ? entry.points : entry.points.slice().reverse();
    }
    const na = this.nodeMap[a];
    const nb = this.nodeMap[b];
    if (na && nb) return [na, nb];
    return [];
  },

  _buildGraph() {
    const adj = {};
    Object.keys(this.nodeMap).forEach((id) => { adj[id] = []; });
    EDGE_SEED.forEach((edge) => {
      const pts = this._getEdgePolyline(edge.a, edge.b);
      const w = polylineLength(pts);
      adj[edge.a].push({ to: edge.b, w });
      adj[edge.b].push({ to: edge.a, w });
    });
    return adj;
  },

  _expandPathToPolyline(pathIds) {
    if (!pathIds || pathIds.length < 2) return [];
    let poly = [];
    for (let i = 0; i < pathIds.length - 1; i += 1) {
      const seg = this._getEdgePolyline(pathIds[i], pathIds[i + 1]);
      if (!seg.length) continue;
      if (!poly.length) poly = seg.slice();
      else poly = poly.concat(seg.slice(1));
    }
    return poly;
  },

  _buildRouteSegments(polyline) {
    const segments = [];
    for (let i = 0; i < polyline.length - 1; i += 1) {
      const p1 = polyline[i];
      const p2 = polyline[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      segments.push({
        id: i + 1,
        style: `left:${p1.x}%;top:${p1.y}%;width:${len}%;transform:rotate(${ang}deg);`,
        onRoute: true
      });
    }
    return segments;
  },

  _buildRouteDots(polyline, interval) {
    const dots = [];
    if (polyline.length < 2) return dots;
    let cursor = 0;
    let traveled = 0;
    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i];
      const p2 = polyline[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      while (cursor <= traveled + segLen) {
        const t = (cursor - traveled) / segLen;
        dots.push({
          id: `d${dots.length}`,
          style: `left:${p1.x + dx * t}%;top:${p1.y + dy * t}%;`
        });
        cursor += interval;
      }
      traveled += segLen;
    }
    const last = polyline[polyline.length - 1];
    dots.push({ id: `d${dots.length}`, style: `left:${last.x}%;top:${last.y}%;` });
    return dots;
  },

  _buildLegendItems() {
    const items = [{ type: "all", label: "全部", cls: "type-all", color: "#455a64" }];
    Object.keys(TYPE_META).forEach((k) => {
      items.push({ type: k, ...TYPE_META[k] });
    });
    return items;
  },

  _decoratePoiList(pathSet, activeType) {
    return POI_SEED.map((p) => {
      const meta = TYPE_META[p.type] || TYPE_META.scenic;
      const hidden = activeType !== "all" && p.type !== activeType;
      return {
        ...p,
        typeLabel: meta.label,
        typeClass: meta.cls,
        onRoute: pathSet.has(String(p.id)),
        hidden
      };
    });
  },

  _refreshLegendPoiList(type) {
    if (type === "all") {
      this.setData({ legendPoiList: [] });
      return;
    }
    const list = POI_SEED.filter((p) => p.type === type).map((p) => ({ id: p.id, name: p.name }));
    this.setData({ legendPoiList: list });
  },

  _applyMapFocus() {
    try {
      const f = wx.getStorageSync("mapFocus");
      wx.removeStorageSync("mapFocus");
      if (!f || !f.title) {
        return;
      }
      const target = POI_SEED.find((p) => p.name === f.title || (f.title && p.name.indexOf(f.title) >= 0));
      if (!target) {
        return;
      }
      const endIndex = POI_SEED.findIndex((p) => p.id === target.id);
      this.setData({
        endId: target.id,
        endIndex: endIndex < 0 ? 0 : endIndex,
        showDetail: true,
        currentPoi: target
      }, () => this.planRoute());
    } catch (e) {
      console.warn(e);
      this.planRoute();
    }
  },

  _initUserPositionByQr(options) {
    let userPoiId = 13;
    const rawScene = decodeURIComponent(options.scene || options.qr || "").trim().toLowerCase();
    if (rawScene) {
      const mapped = SCENE_TO_POI[rawScene];
      if (mapped && this.poiMap[mapped]) {
        userPoiId = mapped;
      } else if (/^\d+$/.test(rawScene) && this.poiMap[Number(rawScene)]) {
        userPoiId = Number(rawScene);
      }
    }
    const idx = POI_SEED.findIndex((p) => p.id === userPoiId);
    this.setData({
      userPoiId,
      startId: userPoiId,
      startIndex: idx < 0 ? 0 : idx
    });
  },

  _syncUserPosStyle() {
    const p = this.poiMap[this.data.userPoiId] || this.nodeMap[this.data.userPoiId];
    if (!p) return;
    this.setData({ userPosStyle: `left:${p.x}%;top:${p.y}%;` });
  },

  onStartChange(e) {
    const idx = Number(e.detail.value || 0);
    const id = POI_SEED[idx] ? POI_SEED[idx].id : this.data.startId;
    this.setData({ startIndex: idx, startId: id, isNavigating: false }, () => {
      this.planRoute();
      this._centerOnPoi(id, true);
    });
  },

  onEndChange(e) {
    const idx = Number(e.detail.value || 0);
    const id = POI_SEED[idx] ? POI_SEED[idx].id : this.data.endId;
    this.setData({ endIndex: idx, endId: id, isNavigating: false }, () => this.planRoute());
  },

  onPoiTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    const poi = this.poiMap[id];
    if (!poi) return;
    if (this.data.activeLegendType !== "all" && poi.type !== this.data.activeLegendType) return;
    this._openPoiDetail(poi);
  },

  onToggleLegend() {
    this.setData({ legendOpen: !this.data.legendOpen });
  },

  onLegendTap(e) {
    const type = e.currentTarget.dataset.type || "all";
    const pathSet = new Set(this.routePath.map((id) => String(id)));
    this.setData({
      activeLegendType: type,
      poiList: this._decoratePoiList(pathSet, type)
    });
    this._refreshLegendPoiList(type);
  },

  onLegendPoiTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    const idx = POI_SEED.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const target = POI_SEED[idx];
    this.setData({
      endId: id,
      endIndex: idx,
      currentPoi: target,
      showDetail: true
    }, () => this.planRoute());
  },

  closePopup() {
    this.setData({ showDetail: false });
  },

  setStartFromCurrent() {
    const id = this.data.currentPoi.id;
    if (!id) return;
    const idx = POI_SEED.findIndex((p) => p.id === id);
    this.setData({
      startId: id,
      startIndex: idx < 0 ? this.data.startIndex : idx,
      showDetail: false,
      isNavigating: false
    }, () => {
      this.planRoute();
      this._centerOnPoi(id, true);
    });
  },

  setEndFromCurrent() {
    const id = this.data.currentPoi.id;
    if (!id) return;
    const idx = POI_SEED.findIndex((p) => p.id === id);
    this.setData({
      endId: id,
      endIndex: idx < 0 ? this.data.endIndex : idx,
      showDetail: false,
      isNavigating: false
    }, () => this.planRoute());
  },

  startNavigationToCurrent() {
    const id = this.data.currentPoi.id;
    if (!id) return;
    const idx = POI_SEED.findIndex((p) => p.id === id);
    this.setData({
      endId: id,
      endIndex: idx < 0 ? this.data.endIndex : idx,
      showDetail: false
    }, () => {
      this.planRoute();
      this.startNavigation();
    });
  },

  startNavigation() {
    if (this.routePath.length < 2) {
      this.planRoute();
    }
    if (this.routePath.length < 2) {
      wx.showToast({ title: "请先选择起点和终点", icon: "none" });
      return;
    }
    this.setData({
      isNavigating: true,
      navHint: `正在导航：${this.poiMap[this.data.startId].name} → ${this.poiMap[this.data.endId].name}`,
      navHintShort: '导航中'
    }, () => this.planRoute());
  },

  stopNavigation() {
    this.setData({
      isNavigating: false,
      navHint: "导航已结束，可重新选择起终点",
      navHintShort: "沿园路步行"
    });
  },

  clearRoute() {
    this.routePath = [];
    this.routePolyline = [];
    this.setData({
      roadSegments: [],
      routeDots: [],
      hasRoute: false,
      routeText: "未规划路线",
      routeMeters: 0,
      routeMinutes: 0,
      isNavigating: false,
      navHint: "路线已清除，请选择起终点后点击「开始导航」",
      navHintShort: "沿园路步行",
      poiList: this._decoratePoiList(new Set(), this.data.activeLegendType)
    });
  },

  planRoute() {
    const start = this.data.startId;
    const end = this.data.endId;
    if (!start || !end || !this.poiMap[start] || !this.poiMap[end]) return;
    if (start === end) {
      wx.showToast({ title: "起终点相同", icon: "none" });
      return;
    }
    const { path, distPercent } = this._dijkstra(start, end);
    if (!path.length) {
      wx.showToast({ title: "当前无可达路径", icon: "none" });
      return;
    }
    this.routePath = path;
    const polyline = this._expandPathToPolyline(path);
    const smooth = smoothPolyline(polyline, 0.03);
    this.routePolyline = smooth;

    const meters = Math.round(distPercent * METER_PER_PERCENT);
    const minutes = Math.max(1, Math.round(meters / 70));
    const poiSteps = path.filter((id) => this.poiMap[id]).map((id) => this.poiMap[id].name);
    const text = poiSteps.length ? poiSteps.join("  →  ") : path.map((id) => `#${id}`).join("  →  ");
    const pathSet = new Set(path.map((id) => String(id)));
    const poiList = this._decoratePoiList(pathSet, this.data.activeLegendType);
    this.setData({
      poiList,
      roadSegments: this._buildRouteSegments(smooth),
      routeDots: this._buildRouteDots(smooth, 1.5),
      routeText: text,
      routeMeters: meters,
      routeMinutes: minutes,
      hasRoute: true,
      navHint: this.data.isNavigating
        ? `正在导航：${this.poiMap[start].name} → ${this.poiMap[end].name}`
        : "绿色线贴合园路弯道，点击「开始导航」",
      navHintShort: this.data.isNavigating ? '导航中' : '沿园路步行'
    });
  },

  _dijkstra(start, end) {
    const ids = Object.keys(this.nodeMap).map(Number);
    const dist = {};
    const prev = {};
    const visited = {};
    ids.forEach((id) => {
      dist[id] = Infinity;
      prev[id] = null;
      visited[id] = false;
    });
    dist[start] = 0;

    while (true) {
      let u = null;
      let best = Infinity;
      ids.forEach((id) => {
        if (!visited[id] && dist[id] < best) {
          best = dist[id];
          u = id;
        }
      });
      if (u === null || u === end) break;
      visited[u] = true;
      (this.adj[u] || []).forEach((e) => {
        if (visited[e.to]) return;
        const nd = dist[u] + e.w;
        if (nd < dist[e.to]) {
          dist[e.to] = nd;
          prev[e.to] = u;
        }
      });
    }

    const path = [];
    if (dist[end] !== Infinity) {
      let cur = end;
      while (cur !== null) {
        path.push(cur);
        cur = prev[cur];
      }
      path.reverse();
    }
    return { path, distPercent: dist[end] === Infinity ? 0 : dist[end] };
  },

  onZoomIn() {
    const cx = this.viewport.w / 2;
    const cy = this.viewport.h / 2;
    this._zoomAt(cx, cy, 1.28);
  },

  onZoomOut() {
    const cx = this.viewport.w / 2;
    const cy = this.viewport.h / 2;
    this._zoomAt(cx, cy, 1 / 1.28);
  },

  onZoomReset() {
    this._fitFullMap(true);
  },

  _zoomAt(cx, cy, factor) {
    const old = this.camera.scale;
    const next = Math.max(this.minScale, Math.min(this.maxScale, old * factor));
    const fx = (cx - this.camera.tx) / old;
    const fy = (cy - this.camera.ty) / old;
    this._pushMapCam({
      scale: next,
      tx: cx - fx * next,
      ty: cy - fy * next
    });
  },

  _fitFullMap(update) {
    this._pushMapCam({ scale: this.fitScale, tx: 0, ty: 0 });
  },

  _centerOnPoi(id, update) {
    const p = this.poiMap[id] || this.nodeMap[id];
    if (!p) return;
    this._centerOnPercent(p.x, p.y, update);
  },

  _centerOnPercent(x, y, update) {
    const { w, h } = this.viewport;
    if (!w || !h) return;
    const s = Math.max(this.camera.scale, 1.15);
    const px = (x / 100) * w;
    const py = (y / 100) * h;
    this._pushMapCam({
      scale: s,
      tx: w / 2 - px * s,
      ty: h / 2 - py * s
    });
  },

  _clampCamera(cam) {
    const { w, h } = this.viewport;
    if (!w || !h) return cam;
    const ch = this.contentHeight || h;
    const s = Math.max(this.minScale, Math.min(this.maxScale, cam.scale));
    const sw = w * s;
    const sh = ch * s;
    let minX = w - sw;
    let minY = h - sh;
    let maxX = 0;
    let maxY = 0;
    if (sw <= w) {
      minX = maxX = (w - sw) / 2;
    }
    if (sh <= h) {
      minY = maxY = (h - sh) / 2;
    }
    cam.scale = s;
    cam.tx = Math.min(maxX, Math.max(minX, cam.tx));
    cam.ty = Math.min(maxY, Math.max(minY, cam.ty));
    return cam;
  },

  goAiRoute() {
    wx.navigateTo({ url: "/pages/ai/ai?preset=route" });
  },

  goFacility() {
    wx.navigateTo({ url: "/pages/map/facility" });
  }
});
