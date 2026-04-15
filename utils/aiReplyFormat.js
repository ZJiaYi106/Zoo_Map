/**
 * 若后端仍返回路线 JSON 字符串（旧部署 / 异常），在端上格式化为可读中文。
 * 与 backend ai_agent._format_route_json_for_user 语义对齐。
 */
function formatRouteJsonForDisplay(text) {
  if (!text || typeof text !== "string") return text;
  const t = text.trim();
  if (!t.startsWith("{")) return text;
  let obj;
  try {
    obj = JSON.parse(t);
  } catch (e) {
    return text;
  }
  if (!obj || typeof obj !== "object") return text;
  if (obj.route_name == null && !Array.isArray(obj.points)) return text;

  const name = (obj.route_name || "推荐游览路线").trim();
  const minutes = obj.duration_minutes;
  const diff = (obj.difficulty || "适中").trim();
  const summary = (obj.summary || "").trim();
  const crowd = (obj.crowding_hint || "").trim();
  const poly = (obj.polyline_hint || "").trim();
  const points = obj.points || [];

  const lines = [];
  lines.push(`为您规划：${name}`);
  if (minutes != null) {
    lines.push(`预计全程约 ${minutes} 分钟，体力难度：${diff}。`);
  } else {
    lines.push(`体力难度：${diff}。`);
  }
  if (summary) lines.push(summary);
  if (crowd) lines.push(`游园提示：${crowd}`);
  if (poly) lines.push(`行走建议：${poly}`);

  if (points.length) {
    lines.push("\n【建议游览顺序】");
    points.forEach((p, i) => {
      if (!p || typeof p !== "object") return;
      const pname = (p.name || "景点").trim();
      const stay = p.stay_minutes;
      const note = (p.note || "").trim();
      let seg = `${i + 1}. ${pname}`;
      if (stay != null) seg += `（建议停留约 ${stay} 分钟）`;
      lines.push(seg);
      if (note) lines.push(`   · ${note}`);
    });
  }

  lines.push(
    "\n温馨提示：园内请遵守安全规定，勿投喂、勿敲打玻璃；以上路线为智能规划参考，请以现场指引与当日公告为准。"
  );
  return lines.join("\n").trim();
}

module.exports = { formatRouteJsonForDisplay };
