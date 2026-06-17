import { useState, useEffect, useRef, useCallback } from "react";
import "@fontsource/inter";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:        "#080c10",
  surface:   "#0d1117",
  panel:     "#111820",
  border:    "#1c2433",
  unvisited: "#1a2236",
  nodeStroke:"#2d3f5c",
  queued:    "#f59e0b",   // amber  – in queue
  queueedBg:"#2d1f00",
  active:    "#38bdf8",   // sky    – currently dequeuing
  activeBg:  "#0c2d3f",
  visited:   "#22c55e",   // green  – done
  visitedBg: "#0a2210",
  target:    "#a78bfa",   // violet – target node
  targetBg:  "#1e1040",
  path:      "#fb923c",   // orange – shortest path
  text:      "#e2e8f0",
  muted:     "#64748b",
  edge:      "#1e2d40",
  edgeActive:"#38bdf8",
  edgePath:  "#fb923c",
  white:     "#fff",
};

// ── Default graph ─────────────────────────────────────────────────────────────
const DEFAULT_NODES = [
  { id: "A", x: 300, y: 60 },
  { id: "B", x: 140, y: 170 },
  { id: "C", x: 460, y: 170 },
  { id: "D", x:  60, y: 295 },
  { id: "E", x: 230, y: 295 },
  { id: "F", x: 380, y: 295 },
  { id: "G", x: 540, y: 295 },
  { id: "H", x: 120, y: 410 },
  { id: "I", x: 305, y: 410 },
  { id: "J", x: 480, y: 410 },
];

const DEFAULT_EDGES = [
  ["A","B"],["A","C"],
  ["B","D"],["B","E"],
  ["C","F"],["C","G"],
  ["D","H"],["E","H"],["E","I"],
  ["F","I"],["F","J"],["G","J"],
  ["H","I"],["I","J"],
];

// ── BFS step recorder ─────────────────────────────────────────────────────────
function bfsSteps(nodes, edges, startId, targetId) {
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });
  edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });

  const steps = [];
  const visited = new Set([startId]);
  const parent = { [startId]: null };
  const queue = [startId];
  const visitedOrder = [];

  steps.push({
    queue: [...queue],
    visited: new Set(visited),
    active: null,
    parent: { ...parent },
    visitedOrder: [],
    found: false,
    msg: `Start BFS from node ${startId}. Enqueue ${startId}.`,
  });

  while (queue.length > 0) {
    const cur = queue.shift();
    visitedOrder.push(cur);

    const isTarget = cur === targetId;
    steps.push({
      queue: [...queue],
      visited: new Set(visited),
      active: cur,
      parent: { ...parent },
      visitedOrder: [...visitedOrder],
      found: isTarget,
      msg: isTarget
        ? `Dequeue ${cur} — TARGET FOUND!`
        : `Dequeue ${cur}. Explore Neighbours: [${adj[cur].filter(n => !visited.has(n)).join(", ") || "None New"}]`,
    });

    if (isTarget) break;

    for (const nb of adj[cur]) {
      if (!visited.has(nb)) {
        visited.add(nb);
        parent[nb] = cur;
        queue.push(nb);
        steps.push({
          queue: [...queue],
          visited: new Set(visited),
          active: cur,
          enqueuing: nb,
          parent: { ...parent },
          visitedOrder: [...visitedOrder],
          found: false,
          msg: `  Enqueue Neighbour ${nb} (parent = ${cur})`,
        });
      }
    }
  }

  if (!steps[steps.length - 1].found && targetId) {
    steps.push({
      queue: [],
      visited: new Set(visited),
      active: null,
      parent: { ...parent },
      visitedOrder: [...visitedOrder],
      found: false,
      done: true,
      msg: targetId ? `BFS complete. Node ${targetId} not reachable from ${startId}.` : `BFS complete. All reachable nodes visited.`,
    });
  }

  return steps;
}

function getPath(parent, target) {
  const path = [];
  let cur = target;
  while (cur !== null && cur !== undefined) {
    path.unshift(cur);
    cur = parent[cur];
  }
  return path;
}

// ── Graph SVG ─────────────────────────────────────────────────────────────────
function GraphSVG({ nodes, edges, step, start, target, dragging, onMouseDown }) {
  const visited = step?.visited || new Set();
  const active = step?.active;
  const queue = new Set(step?.queue || []);
  const enqueuing = step?.enqueuing;
  const parent = step?.parent || {};
  const found = step?.found;

  const pathSet = new Set();
  const pathEdges = new Set();
  if (found && target) {
    const p = getPath(parent, target);
    p.forEach(n => pathSet.add(n));
    for (let i = 0; i < p.length - 1; i++) pathEdges.add(`${p[i]}-${p[i+1]}`);
  }

  function edgeKey(a, b) {
    return [a, b].sort().join("-");
  }

  return (
    <svg
      viewBox="0 0 610 480"
      style={{ width: "100%", height: "100%", cursor: dragging ? "grabbing" : "default" }}
    >
      {/* Edges */}
      {edges.map(([a, b]) => {
        const na = nodes.find(n => n.id === a);
        const nb = nodes.find(n => n.id === b);
        if (!na || !nb) return null;
        const key = edgeKey(a, b);
        const onPath = pathEdges.has(key);
        const isActive = (active === a && visited.has(b)) || (active === b && visited.has(a));
        return (
          <line key={key}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke={onPath ? C.edgePath : isActive ? C.edgeActive : C.edge}
            strokeWidth={onPath ? 3 : isActive ? 2 : 1.5}
            opacity={onPath ? 1 : isActive ? 0.8 : 0.5}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const isStart = node.id === start;
        const isTarget = node.id === target;
        const isActive = node.id === active;
        const isQueued = queue.has(node.id);
        const isVisited = step?.visitedOrder?.includes(node.id);
        const isEnqueuing = node.id === enqueuing;
        const onPath = pathSet.has(node.id);

        let fill = C.unvisited;
        let stroke = C.nodeStroke;
        let strokeW = 1.5;
        let textCol = C.muted;

        if (isVisited) { fill = C.visitedBg; stroke = C.visited; textCol = C.visited; }
        if (isQueued)  { fill = C.queueedBg; stroke = C.queued;  textCol = C.queued; strokeW = 2; }
        if (isEnqueuing) { fill = C.queueedBg; stroke = C.queued; textCol = C.queued; strokeW = 2.5; }
        if (isActive)  { fill = C.activeBg;  stroke = C.active;  textCol = C.active;  strokeW = 3; }
        if (isStart)   { strokeW = Math.max(strokeW, 2.5); }
        if (isTarget)  { fill = C.targetBg;  stroke = C.target;  textCol = C.target;  strokeW = 2.5; }
        if (onPath && found) { fill = "#1a0d00"; stroke = C.path; textCol = C.path; strokeW = 3; }

        const r = 26;

        return (
          <g key={node.id}
            onMouseDown={e => onMouseDown(e, node.id)}
            style={{ cursor: "grab" }}>
            <circle cx={node.x} cy={node.y} r={r}
              fill={fill} stroke={stroke} strokeWidth={strokeW}
            />
            {isStart && (
              <circle cx={node.x} cy={node.y} r={r + 5}
                fill="none" stroke={C.active} strokeWidth={1} opacity={0.35} strokeDasharray="3 3" />
            )}
            <text x={node.x} y={node.y + 5} textAnchor="middle"
              fontSize={14} fontWeight={800} fill={textCol} style={{ userSelect: "none" }}>
              {node.id}
            </text>
            {/* visit order badge */}
            {isVisited && step?.visitedOrder && (
              <text x={node.x + r - 4} y={node.y - r + 8}
                textAnchor="middle" fontSize={9} fontWeight={700}
                fill={onPath && found ? C.path : C.visited} opacity={0.85}>
                {step.visitedOrder.indexOf(node.id) + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Queue strip ───────────────────────────────────────────────────────────────
function QueueStrip({ queue }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", minWidth: 48 }}>Queue:</span>
      {queue.length === 0
        ? <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>[ empty ]</span>
        : queue.map((n, i) => (
          <div key={i} style={{
            background: C.queueedBg, border: `1px solid ${C.queued}`,
            borderRadius: 5, padding: "3px 10px",
            fontSize: 12, fontWeight: 700, color: C.queued, fontFamily: "monospace",
          }}>{n}</div>
        ))
      }
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BFSViz() {
  const [nodes, setNodes] = useState(DEFAULT_NODES.map(n => ({ ...n })));
  const [edges] = useState(DEFAULT_EDGES);
  const [start, setStart] = useState("A");
  const [target, setTarget] = useState("J");
  const [steps, setSteps] = useState([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const dragRef = useRef(null);
  const svgRef = useRef(null);
  const intervalRef = useRef(null);
  const logRef = useRef(null);

  const recompute = useCallback((s, t, ns) => {
    const st = bfsSteps(ns, edges, s, t);
    setSteps(st);
    setStepIdx(0);
    setPlaying(false);
  }, [edges]);

  useEffect(() => { recompute(start, target, nodes); }, [start, target]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setStepIdx(prev => {
          if (prev >= steps.length - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, speed);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, steps, speed]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [stepIdx]);

  // drag nodes
  const handleMouseDown = useCallback((e, id) => {
    e.preventDefault();
    dragRef.current = { id, startX: e.clientX, startY: e.clientY };
    const move = (me) => {
      if (!dragRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = 610 / rect.width;
      const scaleY = 480 / rect.height;
      setNodes(prev => prev.map(n =>
        n.id === dragRef.current.id
          ? { ...n, x: Math.max(30, Math.min(580, (me.clientX - rect.left) * scaleX)), y: Math.max(30, Math.min(450, (me.clientY - rect.top) * scaleY)) }
          : n
      ));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      recompute(start, target, nodes);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [nodes, start, target, recompute]);

  const curStep = steps[stepIdx] || steps[0];
  const nodeIds = nodes.map(n => n.id);

  const pathNodes = curStep?.found && target ? getPath(curStep.parent, target) : [];

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'Inter','ui-sans-serif',sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "26px 14px 52px",
    }}>
      <style>{`
        select { appearance: none; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:${C.bg}; }
        ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:3px; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 16, fontSize: 34, fontWeight: 800, letterSpacing: "-0.5px" }}>
          <span style={{ color: C.queued }}>Breadth </span>
          <span style={{ color: C.queued }}>First </span>
          <span style={{ color: C.queued }}>Search</span>
        </h1>
        <p style={{ margin: "4px 0 0", color: C.white, fontSize: 13 }}>
          Explore the graph level by level — Every node at distance <em>k</em> before any at <em>k+1</em>
        </p>
      </div>

      {/* Config bar */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        justifyContent: "center", marginBottom: 16,
        background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "10px 16px",
      }}>
        <NodePicker label="Start" value={start} options={nodeIds} color={C.active}
          onChange={v => { setStart(v); }} />
        <NodePicker label="Target" value={target} options={nodeIds} color={C.target}
          onChange={v => { setTarget(v); }} />
        <div style={{ width: 1, height: 20, background: C.border }} />
        <button onClick={() => { setStepIdx(0); setPlaying(false); }} style={btn(C.border, C.muted)}>⏮</button>
        <button onClick={() => setStepIdx(p => Math.max(0, p - 1))} style={btn(C.border, C.text)}>‹</button>
        <button onClick={() => setPlaying(p => !p)}
          style={btn(playing ? C.activeBg : "#0a1d2a", C.active, true)}>
          {playing ? "⏸" : "▶"}
        </button>
        <button onClick={() => setStepIdx(p => Math.min(steps.length - 1, p + 1))} style={btn(C.border, C.text)}>›</button>
        <button onClick={() => { setStepIdx(steps.length - 1); setPlaying(false); }} style={btn(C.border, C.muted)}>⏭</button>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <span style={{ color: C.muted }}>Speed</span>
          <input type="range" min={100} max={1500} step={50} value={1600 - speed}
            onChange={e => setSpeed(1600 - Number(e.target.value))}
            style={{ width: 80, accentColor: C.active }} />
        </div>
      </div>

      {/* Step progress */}
      <div style={{ width: "100%", maxWidth: 940, marginBottom: 12 }}>
        <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: steps.length > 1 ? `${(stepIdx / (steps.length - 1)) * 100}%` : "0%",
            background: `linear-gradient(90deg, ${C.active}, ${C.visited})`,
            transition: "width 0.15s",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: C.muted }}>
          <span>Step {stepIdx + 1} / {steps.length}</span>
          <span>{curStep?.visitedOrder?.length || 0} visited · {curStep?.queue?.length || 0} in queue</span>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: 14, width: "100%", maxWidth: 940, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>

        {/* Graph */}
        <div ref={svgRef} style={{
          flex: "1 1 520px", height: 480,
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden",
        }}>
          <GraphSVG
            nodes={nodes} edges={edges}
            step={curStep} start={start} target={target}
            dragging={!!dragRef.current}
            onMouseDown={handleMouseDown}
          />
        </div>

        {/* Right panel */}
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Current action */}
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>CURRENT ACTION</div>
            <div style={{
              fontSize: 12, fontFamily: "monospace", lineHeight: 1.6,
              color: curStep?.found ? C.path : curStep?.type === "prune" ? C.queued : C.text,
              minHeight: 36,
            }}>
              {curStep?.msg || "—"}
            </div>
          </div>

          {/* Queue */}
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>QUEUE (FIFO)</div>
            <QueueStrip queue={curStep?.queue || []} />
          </div>

          {/* Visited order */}
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>VISITED ORDER</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(curStep?.visitedOrder || []).map((n, i) => (
                <div key={i} style={{
                  background: pathNodes.includes(n) ? "#1a0d00" : C.visitedBg,
                  border: `1px solid ${pathNodes.includes(n) ? C.path : C.visited}`,
                  borderRadius: 5, padding: "3px 9px",
                  fontSize: 12, fontWeight: 700,
                  color: pathNodes.includes(n) ? C.path : C.visited,
                  fontFamily: "monospace",
                }}>
                  {i + 1}. {n}
                </div>
              ))}
              {(!curStep?.visitedOrder || curStep.visitedOrder.length === 0) && (
                <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>—</span>
              )}
            </div>
          </div>

          {/* Shortest path */}
          {curStep?.found && pathNodes.length > 0 && (
            <div style={{
              background: "#0f0800", border: `1px solid ${C.path}44`,
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 11, color: C.path, marginBottom: 8, fontWeight: 700 }}>
                ✓ SHORTEST PATH ({pathNodes.length - 1} hops)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                {pathNodes.map((n, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      background: "#1a0d00", border: `1px solid ${C.path}`,
                      borderRadius: 5, padding: "3px 9px",
                      fontSize: 13, fontWeight: 800, color: C.path, fontFamily: "monospace",
                    }}>{n}</span>
                    {i < pathNodes.length - 1 && <span style={{ color: C.muted, fontSize: 12 }}>→</span>}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                BFS always finds the shortest path in an unweighted graph.
              </div>
            </div>
          )}

          {/* Explanation */}
          <div style={{
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "12px 14px",
            fontSize: 12, lineHeight: 1.7, color: C.muted,
          }}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>EXPLANATION</div>
            <p style={{ margin: "0 0 6px" }}>
              BFS uses a <span style={{ color: C.queued, fontWeight: 600 }}>FIFO queue</span>. Enqueue the start node, then repeatedly dequeue a node, visit it, and enqueue its unvisited neighbours.
            </p>
            <p style={{ margin: "0 0 6px" }}>
              This guarantees nodes are visited in order of their distance from the source — level 1, then level 2, and so on.
            </p>
            <p style={{ margin: 0, color: C.path }}>
              In an unweighted graph, BFS always finds the <strong>shortest path</strong>.
            </p>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3, fontSize: 11, color: C.muted, flexDirection: "row", alignItems: "middle" }}>
            {[
              { col: C.active,  label: "Dequeuing" },
              { col: C.queued,  label: "In queue" },
              { col: C.visited, label: "Visited" },
              { col: C.target,  label: "Target" },
              { col: C.path,    label: "Shortest path" },
            ].map(({ col, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: col, display: "inline-block" }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p style={{ color: C.muted, fontSize: 11, marginTop: 16 }}>
        Drag nodes to rearrange | Change start/target to explore different paths
      </p>
      <p style={{ color: C.queued, fontSize: 14, marginTop: 0 }}>
        @questwithavinash
      </p>
    </div>
  );
}

function NodePicker({ label, value, options, color, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}:</span>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            padding: "4px 24px 4px 10px",
            borderRadius: 6, border: `1px solid ${color}55`,
            background: C.surface, color, fontSize: 13, fontWeight: 700,
            cursor: "pointer", outline: "none",
          }}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
          color, fontSize: 9, pointerEvents: "none" }}>▼</span>
      </div>
    </div>
  );
}

function btn(bg, col, bold = false) {
  return {
    padding: "5px 13px", borderRadius: 7,
    border: `1px solid ${col}33`,
    background: bg, color: col,
    cursor: "pointer", fontSize: 13,
    fontWeight: bold ? 700 : 500,
  };
}