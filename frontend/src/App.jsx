import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserProvider, Contract, parseEther } from "ethers";

const CONTRACT_ADDRESS = "0x2d3D8f0e3cad89773205e4Ea4783f129266D17a1";
const ABI = [
  { "inputs": [], "name": "totalCampaigns", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "string", "name": "_title", "type": "string" }, { "internalType": "string", "name": "_description", "type": "string" }, { "internalType": "uint256", "name": "_goalInEther", "type": "uint256" }, { "internalType": "uint256", "name": "_daysToRaise", "type": "uint256" }], "name": "createCampaign", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }], "name": "donate", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }, { "internalType": "string", "name": "_description", "type": "string" }, { "internalType": "uint256", "name": "_amountInEther", "type": "uint256" }], "name": "addMilestone", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }, { "internalType": "uint256", "name": "_milestoneId", "type": "uint256" }, { "internalType": "bool", "name": "_approve", "type": "bool" }], "name": "vote", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }], "name": "claimRefund", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }], "name": "getCampaign", "outputs": [{ "components": [{ "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "address payable", "name": "creator", "type": "address" }, { "internalType": "string", "name": "title", "type": "string" }, { "internalType": "string", "name": "description", "type": "string" }, { "internalType": "uint256", "name": "goalAmount", "type": "uint256" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }, { "internalType": "uint256", "name": "totalRaised", "type": "uint256" }, { "internalType": "bool", "name": "goalReached", "type": "bool" }, { "internalType": "bool", "name": "isCancelled", "type": "bool" }], "internalType": "struct CrowdFund.Campaign", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }, { "internalType": "uint256", "name": "_milestoneId", "type": "uint256" }], "name": "getMilestone", "outputs": [{ "components": [{ "internalType": "uint256", "name": "id", "type": "uint256" }, { "internalType": "string", "name": "description", "type": "string" }, { "internalType": "uint256", "name": "releaseAmount", "type": "uint256" }, { "internalType": "bool", "name": "isApproved", "type": "bool" }, { "internalType": "bool", "name": "isRejected", "type": "bool" }, { "internalType": "uint256", "name": "approveVotes", "type": "uint256" }, { "internalType": "uint256", "name": "rejectVotes", "type": "uint256" }], "internalType": "struct CrowdFund.Milestone", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }], "name": "getMyDonation", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }], "name": "getDonorCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }], "name": "getTimeRemaining", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "milestoneCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "hasVoted", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

const fmt = (wei) => { if (!wei) return "0"; const e = Number(BigInt(wei)) / 1e18; return e < 0.001 ? e.toFixed(6) : e.toFixed(4); };
const pct = (r, g) => { if (!g || BigInt(g) === 0n) return 0; return Math.min(100, Math.round((Number(BigInt(r)) / Number(BigInt(g))) * 100)); };
const shortAddr = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : "";
const timeLeft = (s) => { const n = Number(s); if (n<=0) return "Ended"; const d=Math.floor(n/86400),h=Math.floor((n%86400)/3600); return d>0?`${d}d ${h}h`:`${h}h ${Math.floor((n%3600)/60)}m`; };
const buildCampaign = (i, c, donors, t) => ({ id:i, creator:c.creator, title:c.title, description:c.description, goalAmount:c.goalAmount, deadline:c.deadline, totalRaised:c.totalRaised, goalReached:c.goalReached, isCancelled:c.isCancelled, donorCount:Number(donors), timeRemaining:t });

// ─── Animated grid background ──────────────────────────────────────────────
function GridBackground() {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.35,pointerEvents:"none"}} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="vf-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(134,239,172,0.25)" strokeWidth="0.5"/>
        </pattern>
        <radialGradient id="vf-fade" cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor="white" stopOpacity="0"/>
          <stop offset="100%" stopColor="white" stopOpacity="1"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#vf-grid)"/>
      <rect width="100%" height="100%" fill="url(#vf-fade)"/>
    </svg>
  );
}

// ─── Orbital ring animation (hero decoration) ──────────────────────────────
function OrbitalRings() {
  return (
    <div style={{position:"absolute",right:"-8%",top:"50%",transform:"translateY(-50%)",width:520,height:520,pointerEvents:"none",opacity:0.18}}>
      <svg viewBox="0 0 520 520" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"100%"}}>
        <circle cx="260" cy="260" r="200" stroke="#16a34a" strokeWidth="1" strokeDasharray="4 8"/>
        <circle cx="260" cy="260" r="150" stroke="#16a34a" strokeWidth="1" strokeDasharray="2 6"/>
        <circle cx="260" cy="260" r="100" stroke="#16a34a" strokeWidth="1.5"/>
        <circle cx="260" cy="60" r="8" fill="#16a34a" opacity="0.6"/>
        <circle cx="460" cy="260" r="5" fill="#16a34a" opacity="0.4"/>
        <circle cx="260" cy="360" r="6" fill="#16a34a" opacity="0.5"/>
        <circle cx="110" cy="160" r="4" fill="#16a34a" opacity="0.3"/>
      </svg>
    </div>
  );
}

// ─── Animated counter ──────────────────────────────────────────────────────
function AnimatedCounter({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  useEffect(() => {
    const target = parseFloat(value) || 0;
    let start = null;
    const duration = 1400;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(ease * target);
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);
  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}</>;
}

// ─── Trust score badge ─────────────────────────────────────────────────────
function TrustScore({ score = 98 }) {
  const r = 18, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#dcfce7" strokeWidth="4"/>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#16a34a" strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{transition:"stroke-dasharray 1s ease"}}/>
        <text x="22" y="27" textAnchor="middle" fontSize="10" fontWeight="700" fill="#15803d" fontFamily="'DM Sans',sans-serif">{score}</text>
      </svg>
      <div>
        <div style={{fontSize:11,fontWeight:700,color:"#15803d",letterSpacing:"0.5px",textTransform:"uppercase"}}>Trust Score</div>
        <div style={{fontSize:10,color:"#86efac"}}>Verified on-chain</div>
      </div>
    </div>
  );
}

// ─── Progress ring for campaign cards ─────────────────────────────────────
function ProgressRing({ pct: p, size = 52, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(p, 100) / 100 * circ;
  const color = p >= 100 ? "#3b82f6" : p >= 60 ? "#16a34a" : p >= 30 ? "#f59e0b" : "#e5e7eb";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ-dash}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.8s ease"}}/>
      <text x={size/2} y={size/2+4} textAnchor="middle" fontSize="10" fontWeight="700"
        fill={color === "#e5e7eb" ? "#94a3b8" : color} fontFamily="'DM Sans',sans-serif">{p}%</text>
    </svg>
  );
}

// ─── Milestone timeline node ───────────────────────────────────────────────
function MilestoneNode({ status, index }) {
  const colors = { approved:"#16a34a", rejected:"#ef4444", voting:"#f59e0b" };
  const c = colors[status] || "#94a3b8";
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" style={{flexShrink:0}}>
      <circle cx="14" cy="14" r="13" fill={c + "22"} stroke={c} strokeWidth="1.5"/>
      {status === "approved" && <path d="M9 14l4 4 6-7" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
      {status === "rejected" && <><path d="M10 10l8 8M18 10l-8 8" stroke={c} strokeWidth="2" strokeLinecap="round"/></>}
      {status === "voting" && <text x="14" y="19" textAnchor="middle" fontSize="11" fontWeight="700" fill={c} fontFamily="'DM Sans',sans-serif">{index+1}</text>}
    </svg>
  );
}

// ─── Gamification: Achievement badge ──────────────────────────────────────
function AchievementBadge({ label, icon, unlocked }) {
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
      borderRadius:99,border:`1px solid ${unlocked?"#bbf7d0":"#e5e7eb"}`,
      background:unlocked?"#f0fdf4":"#f8fafc",
      transition:"all 0.3s",cursor:"default",
      opacity: unlocked ? 1 : 0.45
    }}>
      <span style={{fontSize:14}}>{icon}</span>
      <span style={{fontSize:11,fontWeight:700,color:unlocked?"#15803d":"#94a3b8",letterSpacing:"0.3px"}}>{label}</span>
    </div>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0a0f1e;
    --ink2: #1e293b;
    --ink3: #475569;
    --ink4: #94a3b8;
    --ink5: #cbd5e1;
    --surface: #ffffff;
    --surface2: #f8fafc;
    --surface3: #f1f5f9;
    --green: #16a34a;
    --green-l: #dcfce7;
    --green-m: #86efac;
    --green-d: #15803d;
    --teal: #0d9488;
    --blue: #3b82f6;
    --amber: #f59e0b;
    --rose: #f43f5e;
    --border: rgba(0,0,0,0.07);
    --border2: rgba(0,0,0,0.12);
    --shadow-xs: 0 1px 3px rgba(0,0,0,0.06);
    --shadow-sm: 0 2px 8px rgba(0,0,0,0.07);
    --shadow: 0 4px 20px rgba(0,0,0,0.08);
    --shadow-lg: 0 12px 40px rgba(0,0,0,0.12);
    --shadow-green: 0 8px 32px rgba(22,163,74,0.18);
    --r: 16px;
    --r2: 12px;
    --r3: 8px;
    --serif: 'DM Serif Display', Georgia, serif;
    --sans: 'DM Sans', system-ui, sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --max: 1200px;
  }

  html { scroll-behavior: smooth; font-size: 16px; }
  body { background: var(--surface); color: var(--ink); font-family: var(--sans); min-height: 100vh; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--surface3); }
  ::-webkit-scrollbar-thumb { background: var(--green-m); border-radius: 3px; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes slideRight { from { transform:translateX(-12px); opacity:0; } to { transform:translateX(0); opacity:1; } }
  @keyframes pulse2 { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes modalIn { from { opacity:0; transform:translateY(20px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes orbitSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes countUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,0.3);} 50%{box-shadow:0 0 0 8px rgba(22,163,74,0);} }
  @keyframes shimmer { 0%{background-position:-400px 0;} 100%{background-position:400px 0;} }

  .app { min-height:100vh; display:flex; flex-direction:column; overflow-x:hidden; }

  /* ── HEADER ──────────────────────────── */
  .hdr {
    position:sticky; top:0; z-index:100;
    background:rgba(255,255,255,0.85);
    backdrop-filter:blur(24px) saturate(180%);
    border-bottom:1px solid var(--border);
    padding:0 2rem; height:64px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .hdr-logo { display:flex; align-items:center; gap:10px; text-decoration:none; }
  .hdr-logo-mark {
    width:34px; height:34px; border-radius:10px;
    background:linear-gradient(135deg,#16a34a,#0d9488);
    display:flex; align-items:center; justify-content:center;
  }
  .hdr-logo-mark svg { width:18px; height:18px; }
  .hdr-logo-name { font-family:var(--serif); font-size:20px; color:var(--ink); letter-spacing:-0.3px; }
  .hdr-logo-name span { color:var(--green); }
  .hdr-nav { display:flex; gap:2px; }
  .hdr-nav-link {
    padding:7px 14px; border:none; background:none; border-radius:8px;
    cursor:pointer; font-family:var(--sans); font-size:13.5px; font-weight:500;
    color:var(--ink3); transition:all 0.18s;
  }
  .hdr-nav-link:hover { background:var(--surface2); color:var(--ink); }
  .hdr-right { display:flex; align-items:center; gap:10px; }
  .net-tag {
    display:flex; align-items:center; gap:5px; padding:4px 10px;
    border-radius:99px; border:1px solid #bbf7d0; background:#f0fdf4;
    font-size:11px; font-weight:700; color:var(--green-d); letter-spacing:0.3px;
  }
  .net-tag-dot { width:5px; height:5px; border-radius:50%; background:var(--green); animation:pulse2 2s infinite; }
  .btn-connect {
    padding:9px 20px; border-radius:99px; border:none;
    background:var(--ink); color:white; font-family:var(--sans);
    font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s;
    letter-spacing:0.2px;
  }
  .btn-connect:hover { background:var(--ink2); transform:translateY(-1px); box-shadow:var(--shadow); }
  .wallet-chip {
    display:flex; align-items:center; gap:6px; padding:8px 14px;
    border-radius:99px; background:var(--surface2); border:1px solid var(--border2);
    font-size:12.5px; font-weight:600; color:var(--ink2);
    font-family:var(--mono);
  }
  .wallet-chip-dot { width:6px; height:6px; border-radius:50%; background:var(--green); animation:glowPulse 3s infinite; }

  /* ── HERO ─────────────────────────────── */
  .hero {
    position:relative; overflow:hidden;
    padding:6rem 2rem 5rem;
    background:linear-gradient(160deg,#f0fdf4 0%,#fafffe 40%,#eff6ff 100%);
    min-height:86vh; display:flex; align-items:center;
  }
  .hero-inner { position:relative; z-index:1; max-width:var(--max); margin:0 auto; width:100%; display:grid; grid-template-columns:1fr 1fr; gap:4rem; align-items:center; }
  .hero-left { animation:fadeUp 0.7s ease both; }
  .hero-right { animation:fadeUp 0.7s ease 0.15s both; }
  .hero-kicker {
    display:inline-flex; align-items:center; gap:8px;
    padding:5px 14px; border-radius:99px;
    border:1px solid #bbf7d0; background:#f0fdf4;
    font-size:12px; font-weight:600; color:var(--green-d);
    margin-bottom:1.5rem; letter-spacing:0.3px;
  }
  .hero-kicker-dot { width:6px; height:6px; border-radius:50%; background:var(--green); animation:pulse2 2s infinite; }
  .hero-h1 {
    font-family:var(--serif); font-size:clamp(2.8rem,5vw,4.2rem);
    line-height:1.08; color:var(--ink);
    margin-bottom:1.25rem; letter-spacing:-1.5px;
  }
  .hero-h1 em { font-style:italic; color:var(--green); }
  .hero-sub { font-size:1.05rem; color:var(--ink3); line-height:1.75; margin-bottom:2rem; font-weight:400; max-width:480px; }
  .hero-actions { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:3rem; }
  .btn-primary {
    padding:13px 28px; border-radius:99px; border:none;
    background:var(--green); color:white; font-family:var(--sans);
    font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s;
    letter-spacing:0.2px; box-shadow:var(--shadow-green);
  }
  .btn-primary:hover { background:var(--green-d); transform:translateY(-2px); }
  .btn-ghost {
    padding:12px 24px; border-radius:99px;
    background:white; border:1.5px solid var(--border2);
    font-family:var(--sans); font-size:14px; font-weight:600;
    color:var(--ink2); cursor:pointer; transition:all 0.2s;
  }
  .btn-ghost:hover { border-color:var(--green); color:var(--green); }
  .hero-stats { display:flex; gap:2rem; flex-wrap:wrap; }
  .hero-stat { }
  .hero-stat-val { font-family:var(--serif); font-size:2.4rem; color:var(--ink); letter-spacing:-1px; animation:countUp 0.8s ease both; }
  .hero-stat-label { font-size:12px; color:var(--ink4); font-weight:500; margin-top:2px; }
  .hero-stat-divider { width:1px; background:var(--border2); align-self:stretch; margin:4px 0; }

  /* Hero right panel */
  .hero-panel {
    background:white; border-radius:24px; border:1px solid var(--border);
    box-shadow:var(--shadow-lg); overflow:hidden;
  }
  .hero-panel-bar { height:4px; background:linear-gradient(90deg,#16a34a,#0d9488,#3b82f6); }
  .hero-panel-body { padding:1.75rem; }
  .hero-panel-title { font-size:11px; font-weight:700; color:var(--ink4); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:1.25rem; }
  .hero-panel-campaign { margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border); }
  .hero-panel-campaign:last-child { border:none; margin:0; padding:0; }
  .hpc-name { font-weight:600; font-size:14px; color:var(--ink); margin-bottom:6px; }
  .hpc-track { height:5px; background:var(--surface3); border-radius:3px; overflow:hidden; margin-bottom:6px; }
  .hpc-fill { height:100%; border-radius:3px; transition:width 1.2s ease; }
  .hpc-meta { display:flex; justify-content:space-between; font-size:11px; color:var(--ink4); font-weight:500; }
  .hero-panel-trust { margin-top:1.25rem; padding-top:1.25rem; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }

  /* ── TICKER ─────────────────────────── */
  .ticker { background:var(--ink); padding:10px 0; overflow:hidden; }
  .ticker-track { display:flex; gap:0; animation:marquee 30s linear infinite; white-space:nowrap; }
  .ticker-item { display:inline-flex; align-items:center; gap:10px; padding:0 2.5rem; font-size:12.5px; color:#64748b; font-weight:500; }
  .ticker-item strong { color:#4ade80; font-weight:700; }
  .ticker-sep { color:#1e3a2f; }

  /* ── SECTION BASE ─────────────────────── */
  .section { padding:6rem 2rem; }
  .section-inner { max-width:var(--max); margin:0 auto; }
  .section-kicker { font-size:11.5px; font-weight:700; color:var(--green); letter-spacing:2px; text-transform:uppercase; margin-bottom:0.75rem; display:flex; align-items:center; gap:8px; }
  .section-kicker::before { content:''; width:20px; height:2px; background:var(--green); border-radius:2px; }
  .section-h2 { font-family:var(--serif); font-size:clamp(1.8rem,3vw,2.6rem); color:var(--ink); line-height:1.18; margin-bottom:1rem; letter-spacing:-0.5px; }
  .section-sub { font-size:1rem; color:var(--ink3); line-height:1.8; max-width:560px; font-weight:400; }

  /* ── HOW IT WORKS ─────────────────────── */
  .how-section { background:var(--surface2); }
  .how-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; margin-top:3rem; }
  .how-card {
    background:white; border-radius:var(--r); border:1px solid var(--border);
    padding:2rem; position:relative; overflow:hidden;
    transition:all 0.3s; cursor:default;
  }
  .how-card::before {
    content:''; position:absolute; top:0; left:0; right:0; height:3px;
    opacity:0; transition:opacity 0.3s;
  }
  .how-card:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); border-color:transparent; }
  .how-card:hover::before { opacity:1; }
  .how-card-1::before { background:var(--green); }
  .how-card-2::before { background:var(--amber); }
  .how-card-3::before { background:var(--blue); }
  .how-num {
    width:32px; height:32px; border-radius:10px;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:700; color:white;
    margin-bottom:1.25rem;
  }
  .how-icon { font-size:1.75rem; margin-bottom:0.875rem; display:block; }
  .how-title { font-family:var(--serif); font-size:1.1rem; color:var(--ink); margin-bottom:0.5rem; }
  .how-desc { font-size:13.5px; color:var(--ink3); line-height:1.75; }

  /* ── FEATURES ──────────────────────── */
  .features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.25rem; margin-top:3rem; }
  .feature-card {
    border-radius:var(--r2); padding:1.5rem; border:1px solid transparent;
    transition:all 0.25s; position:relative; overflow:hidden;
  }
  .feature-card:hover { transform:translateY(-3px); box-shadow:var(--shadow); border-color:var(--green-l); }
  .feature-card-inner { position:relative; z-index:1; }
  .feature-icon-wrap { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:1rem; font-size:20px; }
  .feature-title { font-weight:700; font-size:14.5px; color:var(--ink); margin-bottom:0.4rem; }
  .feature-desc { font-size:13px; color:var(--ink3); line-height:1.7; }

  /* ── IMPACT ──────────────────────── */
  .impact-section { background:var(--ink); color:white; }
  .impact-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1.5rem; margin-top:3rem; }
  .impact-card { border-radius:var(--r2); padding:1.5rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); text-align:center; }
  .impact-val { font-family:var(--serif); font-size:2.4rem; color:#4ade80; letter-spacing:-1px; }
  .impact-label { font-size:12px; color:#64748b; font-weight:500; margin-top:4px; }
  .impact-bar { height:3px; border-radius:2px; background:#1e3a2f; overflow:hidden; margin-top:1rem; }
  .impact-bar-fill { height:100%; border-radius:2px; background:linear-gradient(90deg,#16a34a,#4ade80); transition:width 1.5s ease; }

  /* ── CAMPAIGNS ─────────────────────── */
  .campaigns-section { background:white; }
  .campaigns-topbar { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:2rem; flex-wrap:wrap; gap:1rem; }
  .tab-group { display:flex; background:var(--surface2); border-radius:99px; padding:3px; gap:2px; border:1px solid var(--border); }
  .tab { padding:6px 18px; border-radius:99px; border:none; background:none; cursor:pointer; font-family:var(--sans); font-size:13px; font-weight:600; color:var(--ink4); transition:all 0.2s; }
  .tab.active { background:white; color:var(--ink); box-shadow:var(--shadow-xs); }
  .btn-new {
    padding:9px 20px; border-radius:99px;
    background:var(--green); color:white; border:none;
    font-family:var(--sans); font-size:13px; font-weight:600;
    cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px;
    letter-spacing:0.2px;
  }
  .btn-new:hover { background:var(--green-d); transform:translateY(-1px); }
  .btn-new svg { width:14px; height:14px; }
  .campaigns-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:1.5rem; }

  /* ── CAMPAIGN CARD ─────────────────── */
  .c-card {
    border-radius:var(--r); border:1px solid var(--border);
    overflow:hidden; cursor:pointer; transition:all 0.25s;
    background:white; box-shadow:var(--shadow-xs);
    display:flex; flex-direction:column;
  }
  .c-card:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); border-color:#bbf7d0; }
  .c-card-accent { height:3px; }
  .c-card-body { padding:1.25rem; flex:1; }
  .c-card-chips { display:flex; gap:6px; margin-bottom:0.875rem; flex-wrap:wrap; }
  .chip {
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 9px; border-radius:99px;
    font-size:11px; font-weight:700; letter-spacing:0.2px;
  }
  .chip-active { background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
  .chip-reached { background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
  .chip-ended { background:#f8fafc; color:var(--ink4); border:1px solid var(--border); }
  .chip-chain { background:var(--surface2); color:var(--ink3); border:1px solid var(--border); }
  .chip-dot { width:4px; height:4px; border-radius:50%; background:currentColor; }
  .c-card-title { font-family:var(--serif); font-size:1.05rem; color:var(--ink); margin-bottom:0.35rem; line-height:1.3; }
  .c-card-desc { font-size:12.5px; color:var(--ink4); line-height:1.65; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .c-card-footer { padding:1rem 1.25rem; border-top:1px solid var(--border); display:flex; align-items:center; gap:1rem; }
  .c-card-progress { flex:1; }
  .c-card-raised { font-family:var(--serif); font-size:1.1rem; color:var(--ink); }
  .c-card-meta { font-size:11.5px; color:var(--ink4); margin-top:3px; }
  .c-card-track { height:4px; background:var(--surface3); border-radius:2px; overflow:hidden; margin:6px 0; }
  .c-card-fill { height:100%; border-radius:2px; transition:width 0.8s ease; }
  .btn-fund {
    padding:8px 16px; border-radius:99px; border:none;
    background:var(--green); color:white; font-family:var(--sans);
    font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; white-space:nowrap;
  }
  .btn-fund:hover { background:var(--green-d); }

  /* ── TESTIMONIALS ─────────────────── */
  .testimonials-section { background:var(--surface2); }
  .test-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; margin-top:3rem; }
  .test-card { background:white; border-radius:var(--r2); padding:1.5rem; border:1px solid var(--border); box-shadow:var(--shadow-xs); }
  .test-stars { display:flex; gap:2px; margin-bottom:0.75rem; }
  .test-star { width:13px; height:13px; }
  .test-text { font-family:var(--serif); font-size:14px; font-style:italic; color:var(--ink2); line-height:1.75; margin-bottom:1.25rem; }
  .test-author { display:flex; align-items:center; gap:10px; }
  .test-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; }
  .test-name { font-size:13px; font-weight:700; color:var(--ink); }
  .test-role { font-size:11px; color:var(--ink4); }

  /* ── CTA ──────────────────────────── */
  .cta-section { background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#064e3b 100%); padding:6rem 2rem; text-align:center; position:relative; overflow:hidden; }
  .cta-grid { position:absolute; inset:0; opacity:0.06; }
  .cta-inner { position:relative; z-index:1; max-width:680px; margin:0 auto; }
  .cta-h2 { font-family:var(--serif); font-size:clamp(2rem,4vw,3rem); color:white; line-height:1.12; margin-bottom:1rem; letter-spacing:-0.5px; }
  .cta-sub { font-size:1rem; color:#86efac; line-height:1.8; margin-bottom:2rem; }
  .cta-btns { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .btn-cta-light { padding:13px 28px; border-radius:99px; background:white; border:none; font-family:var(--sans); font-size:14px; font-weight:700; color:#15803d; cursor:pointer; transition:all 0.2s; }
  .btn-cta-light:hover { background:#f0fdf4; transform:translateY(-2px); }
  .btn-cta-outline { padding:12px 24px; border-radius:99px; background:transparent; border:1.5px solid rgba(255,255,255,0.35); font-family:var(--sans); font-size:14px; font-weight:600; color:white; cursor:pointer; transition:all 0.2s; }
  .btn-cta-outline:hover { border-color:white; background:rgba(255,255,255,0.08); }

  /* ── ACHIEVEMENTS ──────────────────── */
  .achievements { display:flex; gap:8px; flex-wrap:wrap; margin-top:1.5rem; justify-content:center; }

  /* ── FOOTER ───────────────────────── */
  .footer { background:var(--ink); padding:4rem 2rem 2rem; }
  .footer-inner { max-width:var(--max); margin:0 auto; }
  .footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:3rem; margin-bottom:3rem; }
  .footer-brand { }
  .footer-logo { display:flex; align-items:center; gap:8px; margin-bottom:1rem; }
  .footer-logo-name { font-family:var(--serif); font-size:20px; color:white; }
  .footer-logo-name span { color:#4ade80; }
  .footer-tag { font-size:13px; color:#475569; line-height:1.7; max-width:260px; margin-bottom:1.5rem; }
  .footer-contract { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:#4ade80; font-family:var(--mono); background:rgba(74,222,128,0.06); padding:6px 10px; border-radius:6px; border:1px solid rgba(74,222,128,0.15); }
  .footer-col-title { font-size:11px; font-weight:700; color:#334155; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:1.25rem; }
  .footer-link { display:block; font-size:13px; color:#475569; background:none; border:none; cursor:pointer; font-family:var(--sans); text-align:left; padding:4px 0; transition:color 0.2s; margin-bottom:4px; }
  .footer-link:hover { color:#4ade80; }
  .footer-bottom { border-top:1px solid #1e293b; padding-top:1.5rem; display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#334155; }

  /* ── MODAL ────────────────────────── */
  .modal-overlay { position:fixed; inset:0; z-index:200; background:rgba(10,15,30,0.6); backdrop-filter:blur(16px); display:flex; align-items:flex-start; justify-content:center; padding:1.5rem 1rem; overflow-y:auto; }
  .modal { background:white; border-radius:20px; width:100%; max-width:820px; margin:auto; animation:modalIn 0.25s ease; box-shadow:0 40px 80px rgba(0,0,0,0.25); overflow:hidden; }
  .modal-bar { height:4px; background:linear-gradient(90deg,var(--green),var(--teal),var(--blue)); }
  .modal-layout { display:grid; grid-template-columns:1fr 300px; min-height:400px; }
  .modal-main { padding:2rem; border-right:1px solid var(--border); overflow-y:auto; max-height:82vh; }
  .modal-sidebar { padding:1.5rem; background:var(--surface2); overflow-y:auto; max-height:82vh; }
  .modal-eyebrow { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; }
  .modal-eyebrow-label { font-size:11px; font-weight:700; color:var(--green); letter-spacing:2px; text-transform:uppercase; }
  .modal-close { width:30px; height:30px; border-radius:50%; border:1px solid var(--border2); background:white; cursor:pointer; font-size:17px; display:flex; align-items:center; justify-content:center; color:var(--ink4); transition:all 0.15s; }
  .modal-close:hover { background:#fef2f2; color:var(--rose); border-color:var(--rose); }
  .modal-title { font-family:var(--serif); font-size:1.5rem; color:var(--ink); margin-bottom:0.5rem; line-height:1.2; }
  .modal-creator { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:99px; background:#ede9fe; border:1px solid #ddd6fe; font-size:12px; color:#7c3aed; font-weight:600; margin-bottom:1rem; font-family:var(--mono); }
  .modal-desc { font-size:14px; color:var(--ink3); line-height:1.8; margin-bottom:1.25rem; }
  .secure-badge { display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:var(--r3); background:#f0fdf4; border:1px solid #bbf7d0; margin-bottom:1.25rem; }
  .secure-badge-text { font-size:12px; color:var(--green-d); font-weight:600; }
  .secure-badge-addr { font-size:10px; color:var(--ink4); margin-left:auto; font-family:var(--mono); }
  .modal-divider { border:none; border-top:1.5px dashed var(--border); margin:1.25rem 0; }
  .ms-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
  .ms-title { font-family:var(--serif); font-size:1rem; color:var(--ink); }
  .ms-count { font-size:11px; color:var(--ink4); background:var(--surface2); padding:3px 10px; border-radius:99px; border:1px solid var(--border); }
  .ms-timeline { position:relative; padding-left:36px; }
  .ms-timeline::before { content:''; position:absolute; left:13px; top:16px; bottom:16px; width:1.5px; background:linear-gradient(180deg,var(--green) 0%,var(--border) 100%); border-radius:2px; }
  .ms-item { position:relative; margin-bottom:1rem; }
  .ms-node { position:absolute; left:-36px; top:8px; }
  .ms-box { background:white; border:1.5px solid var(--border); border-radius:var(--r2); padding:1rem; transition:all 0.2s; }
  .ms-box:hover { box-shadow:var(--shadow-sm); }
  .ms-box.active { border-color:var(--amber); background:#fffbeb; }
  .ms-top { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:6px; }
  .ms-desc-text { font-size:13px; font-weight:600; color:var(--ink); line-height:1.4; }
  .ms-sub { font-size:11px; color:var(--ink4); }
  .ms-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
  .ms-eth { font-family:var(--serif); font-size:1rem; color:var(--ink); }
  .ms-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:99px; }
  .ms-badge-approved { background:#f0fdf4; color:var(--green-d); }
  .ms-badge-rejected { background:#fef2f2; color:var(--rose); }
  .ms-badge-voting { background:#fffbeb; color:#92400e; }
  .vote-bar-labels { display:flex; justify-content:space-between; font-size:11px; color:var(--ink4); margin-bottom:4px; }
  .vote-track { height:4px; background:var(--surface3); border-radius:2px; overflow:hidden; }
  .vote-fill { height:100%; background:var(--green); border-radius:2px; transition:width 0.5s; }
  .vote-btns { display:flex; gap:8px; margin-top:8px; }
  .btn-approve { flex:1; padding:8px; border-radius:99px; background:var(--green); border:none; color:white; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:var(--sans); }
  .btn-approve:hover:not(:disabled) { background:var(--green-d); }
  .btn-reject { flex:1; padding:8px; border-radius:99px; background:white; border:1.5px solid var(--border2); color:var(--ink3); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:var(--sans); }
  .btn-reject:hover:not(:disabled) { border-color:var(--rose); color:var(--rose); background:#fef2f2; }
  .btn-approve:disabled,.btn-reject:disabled { opacity:0.35; cursor:not-allowed; }
  .voted-label { font-size:12px; color:var(--green); font-weight:600; text-align:center; padding:6px; background:#f0fdf4; border-radius:8px; }

  .sidebar-raised { font-family:var(--serif); font-size:2.2rem; color:var(--ink); letter-spacing:-1px; }
  .sidebar-goal { font-size:13px; color:var(--ink4); margin-bottom:8px; }
  .sidebar-track { height:8px; background:var(--surface3); border-radius:4px; overflow:hidden; margin-bottom:6px; }
  .sidebar-fill { height:100%; border-radius:4px; transition:width 1s; background:linear-gradient(90deg,var(--green),#4ade80); }
  .sidebar-fill.full { background:linear-gradient(90deg,var(--blue),#60a5fa); }
  .sidebar-pct { font-size:14px; font-weight:700; color:var(--green); text-align:right; margin-bottom:1rem; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.625rem; margin-bottom:1rem; }
  .info-cell { background:white; border-radius:var(--r3); padding:0.75rem; border:1px solid var(--border); }
  .info-cell-label { font-size:10px; color:var(--ink4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
  .info-cell-val { font-size:14px; font-weight:700; color:var(--ink); }
  .info-cell-val.green { color:var(--green-d); }

  .donate-label { font-size:11px; font-weight:700; color:var(--ink4); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
  .donate-row { display:flex; gap:8px; margin-bottom:0.75rem; }
  .donate-input { flex:1; padding:10px 14px; border:1.5px solid var(--border2); border-radius:var(--r3); font-family:var(--sans); font-size:13px; color:var(--ink); outline:none; transition:border-color 0.2s; }
  .donate-input:focus { border-color:var(--green); }
  .donate-submit { padding:10px 16px; background:var(--green); border:none; border-radius:var(--r3); font-family:var(--sans); font-size:12px; font-weight:700; color:white; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
  .donate-submit:hover:not(:disabled) { background:var(--green-d); }
  .donate-submit:disabled { opacity:0.4; cursor:not-allowed; }
  .my-donation { display:flex; justify-content:space-between; padding:7px 12px; border-radius:8px; background:#f0fdf4; border:1px solid #bbf7d0; margin-bottom:8px; font-size:12px; }
  .my-donation-label { color:var(--green-d); font-weight:500; }
  .my-donation-val { font-weight:700; color:var(--green-d); font-family:var(--mono); }
  .creator-note { padding:10px 14px; background:#eff6ff; border-radius:var(--r3); font-size:12px; color:#1d4ed8; border:1px solid #bfdbfe; margin-bottom:1rem; text-align:center; font-weight:600; }
  .refund-box { padding:1rem; background:#fffbeb; border:1.5px solid #fde68a; border-radius:var(--r3); margin-bottom:1rem; }
  .refund-box-title { font-size:11px; font-weight:700; color:#92400e; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
  .refund-box-desc { font-size:12px; color:var(--ink3); margin-bottom:8px; line-height:1.5; }
  .btn-refund { width:100%; padding:10px; border-radius:var(--r3); background:var(--amber); border:none; color:white; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:var(--sans); }
  .btn-refund:hover:not(:disabled) { background:#d97706; }
  .btn-refund:disabled { opacity:0.4; cursor:not-allowed; }
  .sc-info { margin-top:1rem; }
  .sc-title { font-size:10px; font-weight:700; color:var(--ink4); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
  .sc-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border); font-size:11px; }
  .sc-row:last-child { border:none; }
  .sc-key { color:var(--ink4); }
  .sc-val { color:var(--ink2); font-weight:600; }
  .sc-val.green { color:var(--green-d); }

  /* ── CREATE MODAL ──────────────────── */
  .modal-create { max-width:540px; }
  .create-header { padding:1.75rem 1.75rem 1.25rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start; }
  .create-title { font-family:var(--serif); font-size:1.4rem; color:var(--ink); }
  .create-body { padding:1.75rem; }
  .form-group { margin-bottom:1rem; }
  .form-label { display:block; font-size:11px; color:var(--ink3); margin-bottom:6px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; }
  .form-input,.form-textarea { width:100%; padding:11px 14px; border:1.5px solid var(--border2); border-radius:var(--r3); font-family:var(--sans); font-size:14px; color:var(--ink); outline:none; transition:border-color 0.2s; background:white; }
  .form-input:focus,.form-textarea:focus { border-color:var(--green); }
  .form-input::placeholder,.form-textarea::placeholder { color:var(--ink5); }
  .form-textarea { resize:vertical; min-height:90px; line-height:1.6; }
  .form-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  .form-hint { font-size:11px; color:var(--ink4); margin-top:3px; }
  .btn-create-submit { width:100%; padding:13px; border-radius:99px; background:var(--green); border:none; font-family:var(--sans); font-size:14px; font-weight:700; color:white; cursor:pointer; transition:all 0.2s; letter-spacing:0.2px; }
  .btn-create-submit:hover:not(:disabled) { background:var(--green-d); transform:translateY(-1px); }
  .btn-create-submit:disabled { opacity:0.4; cursor:not-allowed; }
  .btn-cancel { width:100%; padding:12px; border-radius:99px; background:transparent; border:1.5px solid var(--border2); font-family:var(--sans); font-size:13px; font-weight:600; color:var(--ink3); cursor:pointer; transition:all 0.2s; margin-top:8px; }
  .btn-cancel:hover { border-color:var(--rose); color:var(--rose); }
  .ms-request { margin-top:1.25rem; background:#fffbeb; border:1.5px solid #fde68a; border-radius:var(--r2); padding:1.25rem; }
  .ms-request-label { font-size:11px; font-weight:700; color:#92400e; text-transform:uppercase; letter-spacing:1px; margin-bottom:1rem; }

  /* ── TOAST ────────────────────────── */
  .toast { position:fixed; bottom:2rem; right:2rem; z-index:300; background:white; border:1px solid var(--border); border-radius:var(--r2); padding:1rem 1.25rem; max-width:320px; box-shadow:var(--shadow-lg); animation:modalIn 0.25s ease; }
  .toast.success { border-left:3px solid var(--green); }
  .toast.error { border-left:3px solid var(--rose); }
  .toast.loading { border-left:3px solid var(--amber); }
  .toast-title { font-size:13.5px; font-weight:700; color:var(--ink); margin-bottom:2px; }
  .toast-msg { font-size:12px; color:var(--ink4); line-height:1.5; }

  /* ── EMPTY / LOADING ─────────────── */
  .empty { text-align:center; padding:4rem 2rem; }
  .empty-icon { font-size:3rem; margin-bottom:1rem; display:block; }
  .empty-title { font-family:var(--serif); font-size:1.25rem; color:var(--ink2); margin-bottom:0.5rem; }
  .empty-desc { font-size:13.5px; color:var(--ink4); line-height:1.65; max-width:300px; margin:0 auto; }
  .spinner { width:20px; height:20px; border:2px solid var(--border2); border-top-color:var(--green); border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; }
  .loading-center { display:flex; align-items:center; justify-content:center; gap:12px; padding:4rem; color:var(--ink4); font-size:13.5px; font-weight:500; }

  @media(max-width:960px) {
    .hero-inner { grid-template-columns:1fr; }
    .hero-right { display:none; }
    .how-grid { grid-template-columns:1fr; }
    .features-grid { grid-template-columns:1fr 1fr; }
    .test-grid { grid-template-columns:1fr; }
    .impact-grid { grid-template-columns:1fr 1fr; }
    .modal-layout { grid-template-columns:1fr; }
    .footer-grid { grid-template-columns:1fr 1fr; }
  }
  @media(max-width:640px) {
    .hdr { padding:0 1rem; }
    .hdr-nav { display:none; }
    .hero { padding:4rem 1rem 3.5rem; }
    .section { padding:4rem 1rem; }
    .campaigns-grid { grid-template-columns:1fr; }
    .features-grid { grid-template-columns:1fr; }
    .form-row { grid-template-columns:1fr; }
    .footer-grid { grid-template-columns:1fr; gap:2rem; }
    .impact-grid { grid-template-columns:1fr 1fr; }
  }
`;

export default function App() {
  const [account, setAccount]         = useState(null);
  const [contract, setContract]       = useState(null);
  const [campaigns, setCampaigns]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [tab, setTab]                 = useState("explore");
  const [selected, setSelected]       = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [toast, setToast]             = useState(null);
  const [stats, setStats]             = useState({ total: 0, raised: 0, donors: 0 });
  const [createForm, setCreateForm]   = useState({ title:"", description:"", goal:"", days:"" });
  const [donateAmt, setDonateAmt]     = useState("");
  const [milestoneForm, setMilestoneForm] = useState({ description:"", amount:"" });
  const [campaignMilestones, setCampaignMilestones] = useState([]);
  const [myDonation, setMyDonation]   = useState("0");
  const [txPending, setTxPending]     = useState(false);

  const showToast = (type, title, msg) => { setToast({type,title,msg}); setTimeout(() => setToast(null), 4200); };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) { showToast("error","No wallet found","Install MetaMask to connect."); return; }
      const p = new BrowserProvider(window.ethereum);
      await p.send("eth_requestAccounts",[]);
      const s = await p.getSigner();
      const a = await s.getAddress();
      const c = new Contract(CONTRACT_ADDRESS, ABI, s);
      setAccount(a); setContract(c);
      showToast("success","Wallet connected",`${shortAddr(a)} — Sepolia Testnet`);
    } catch(e) { showToast("error","Connection failed",e.message?.slice(0,80)); }
  };

  useEffect(() => {
    if (window.ethereum) window.ethereum.on("accountsChanged",() => { setAccount(null); setContract(null); });
  }, []);

  const loadCampaigns = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const total = await contract.totalCampaigns();
      const count = Number(total);
      const list = [];
      let totalRaised = 0n, totalDonors = 0;
      for (let i = 0; i < count; i++) {
        const c = await contract.getCampaign(i);
        const donors = await contract.getDonorCount(i);
        const timeRem = await contract.getTimeRemaining(i);
        list.push(buildCampaign(i, c, donors, timeRem));
        totalRaised += BigInt(c.totalRaised);
        totalDonors += Number(donors);
      }
      setCampaigns(list);
      setStats({ total: count, raised: totalRaised.toString(), donors: totalDonors });
    } catch(e) { showToast("error","Load failed",e.message?.slice(0,60)); }
    setLoading(false);
  }, [contract]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const openCampaign = async (c) => {
    if (!c) return;
    setSelected(c); setCampaignMilestones([]); setMyDonation("0");
    if (!contract || !account) return;
    try {
      const donation = await contract.getMyDonation(c.id);
      setMyDonation(donation.toString());
      const mCount = await contract.milestoneCount(c.id);
      const ms = [];
      for (let i = 0; i < Number(mCount); i++) {
        const m = await contract.getMilestone(c.id, i);
        const voted = await contract.hasVoted(c.id, i, account);
        ms.push({ id:i, description:m.description, releaseAmount:m.releaseAmount, isApproved:m.isApproved, isRejected:m.isRejected, approveVotes:m.approveVotes, rejectVotes:m.rejectVotes, voted });
      }
      setCampaignMilestones(ms);
    } catch(e) { console.log(e); }
  };

  const handleCreate = async () => {
    if (!contract) { showToast("error","Not connected","Connect your wallet first."); return; }
    const { title, description, goal, days } = createForm;
    if (!title||!description||!goal||!days) { showToast("error","Missing fields","Please fill in all fields."); return; }
    setTxPending(true);
    showToast("loading","Deploying campaign...","Confirm in MetaMask");
    try {
      const tx = await contract.createCampaign(title, description, BigInt(goal), BigInt(days));
      await tx.wait();
      showToast("success","Campaign is live","Your campaign is now on the blockchain.");
      setShowCreate(false); setCreateForm({title:"",description:"",goal:"",days:""});
      await loadCampaigns();
    } catch(e) { showToast("error","Failed",e.reason||e.message?.slice(0,80)); }
    setTxPending(false);
  };

  const handleDonate = async () => {
    if (!contract||!selected) return;
    if (!donateAmt||isNaN(donateAmt)||Number(donateAmt)<=0) { showToast("error","Invalid amount","Enter a valid ETH amount."); return; }
    setTxPending(true);
    showToast("loading","Processing donation...","Confirm in MetaMask");
    try {
      const tx = await contract.donate(selected.id, { value: parseEther(donateAmt) });
      await tx.wait();
      showToast("success","Donation received",`${donateAmt} ETH secured in escrow.`);
      setDonateAmt("");
      await loadCampaigns();
      const updated = await contract.getCampaign(selected.id);
      const donors = await contract.getDonorCount(selected.id);
      const timeRem = await contract.getTimeRemaining(selected.id);
      const donation = await contract.getMyDonation(selected.id);
      setSelected(buildCampaign(selected.id, updated, donors, timeRem));
      setMyDonation(donation.toString());
    } catch(e) { showToast("error","Donation failed",e.reason||e.message?.slice(0,80)); }
    setTxPending(false);
  };

  const handleAddMilestone = async () => {
    if (!contract||!selected) return;
    if (!milestoneForm.description||!milestoneForm.amount) { showToast("error","Missing fields","Fill description and amount."); return; }
    setTxPending(true);
    showToast("loading","Submitting milestone...","Confirm in MetaMask");
    try {
      const tx = await contract.addMilestone(selected.id, milestoneForm.description, BigInt(milestoneForm.amount));
      await tx.wait();
      showToast("success","Milestone submitted","Donors can now vote on this release.");
      setMilestoneForm({description:"",amount:""});
      await openCampaign(selected);
    } catch(e) { showToast("error","Failed",e.reason||e.message?.slice(0,80)); }
    setTxPending(false);
  };

  const handleVote = async (milestoneId, approve) => {
    if (!contract||!selected) return;
    setTxPending(true);
    showToast("loading",approve?"Voting to approve...":"Voting to reject...","Confirm in MetaMask");
    try {
      const tx = await contract.vote(selected.id, milestoneId, approve);
      await tx.wait();
      showToast("success",approve?"Approved":"Rejected","Your vote is recorded on-chain.");
      await openCampaign(selected);
    } catch(e) { showToast("error","Vote failed",e.reason||e.message?.slice(0,80)); }
    setTxPending(false);
  };

  const handleRefund = async () => {
    if (!contract||!selected) return;
    setTxPending(true);
    showToast("loading","Claiming refund...","Confirm in MetaMask");
    try {
      const tx = await contract.claimRefund(selected.id);
      await tx.wait();
      showToast("success","Refund processed","ETH returned to your wallet.");
      setMyDonation("0");
      await loadCampaigns();
    } catch(e) { showToast("error","Refund failed",e.reason||e.message?.slice(0,80)); }
    setTxPending(false);
  };

  const closeModal = () => setSelected(null);
  const isCreator = selected && account && selected.creator?.toLowerCase() === account.toLowerCase();
  const filtered = tab === "mine" ? campaigns.filter(c => c.creator?.toLowerCase() === account?.toLowerCase()) : campaigns;
  const selPct = selected ? pct(selected.totalRaised, selected.goalAmount) : 0;

  // Gamification achievements
  const achievements = [
    { label:"First Donor", icon:"◆", unlocked: stats.donors > 0 },
    { label:"Goal Reached", icon:"▲", unlocked: campaigns.some(c => c.goalReached) },
    { label:"Verified Builder", icon:"●", unlocked: !!account },
    { label:"On-Chain Voter", icon:"◉", unlocked: campaignMilestones.some(m => m.voted) },
  ];

  // Sample hero panel data (fallback to stats)
  const heroPanelCampaigns = campaigns.slice(0,3);

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* HEADER */}
        <header className="hdr">
          <div className="hdr-logo">
            <div className="hdr-logo-mark">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 2C5.13 2 2 5.13 2 9s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z" fill="white" opacity="0.3"/>
                <path d="M9 4v5l3 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="9" cy="9" r="1.5" fill="white"/>
              </svg>
            </div>
            <span className="hdr-logo-name">Veri<span>Fund</span></span>
          </div>
          <nav className="hdr-nav">
            <button className="hdr-nav-link" onClick={() => document.getElementById("campaigns")?.scrollIntoView({behavior:"smooth"})}>Campaigns</button>
            <button className="hdr-nav-link" onClick={() => document.getElementById("how")?.scrollIntoView({behavior:"smooth"})}>How It Works</button>
            <button className="hdr-nav-link" onClick={() => document.getElementById("impact")?.scrollIntoView({behavior:"smooth"})}>Impact</button>
          </nav>
          <div className="hdr-right">
            {account && <div className="net-tag"><div className="net-tag-dot"></div>Sepolia</div>}
            {account ? (
              <div className="wallet-chip"><div className="wallet-chip-dot"></div>{shortAddr(account)}</div>
            ) : (
              <button className="btn-connect" onClick={connectWallet}>Connect Wallet</button>
            )}
          </div>
        </header>

        {/* HERO */}
        <section className="hero">
          <GridBackground />
          <OrbitalRings />
          <div className="hero-inner">
            <div className="hero-left">
              <div className="hero-kicker">
                <div className="hero-kicker-dot"></div>
                Crowdfunding secured by smart contracts
              </div>
              <h1 className="hero-h1">
                Fund with proof.<br />
                Give with <em>certainty</em>.
              </h1>
              <p className="hero-sub">
                VeriFund locks donations in escrow and releases funds only when donors vote to approve. Zero intermediaries. Zero trust required. Every rupee accounted for — forever.
              </p>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => { if (account) setShowCreate(true); else connectWallet(); }}>
                  {account ? "Start a Campaign" : "Connect Wallet"}
                </button>
                <button className="btn-ghost" onClick={() => document.getElementById("campaigns")?.scrollIntoView({behavior:"smooth"})}>
                  Browse Campaigns
                </button>
              </div>
              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="hero-stat-val"><AnimatedCounter value={stats.total}/></div>
                  <div className="hero-stat-label">Campaigns</div>
                </div>
                <div className="hero-stat-divider"></div>
                <div className="hero-stat">
                  <div className="hero-stat-val"><AnimatedCounter value={parseFloat(fmt(stats.raised))} decimals={3}/> ETH</div>
                  <div className="hero-stat-label">Secured in escrow</div>
                </div>
                <div className="hero-stat-divider"></div>
                <div className="hero-stat">
                  <div className="hero-stat-val"><AnimatedCounter value={stats.donors}/></div>
                  <div className="hero-stat-label">Verified donors</div>
                </div>
              </div>
            </div>
            <div className="hero-right">
              <div className="hero-panel">
                <div className="hero-panel-bar"></div>
                <div className="hero-panel-body">
                  <div className="hero-panel-title">Live on-chain · Sepolia</div>
                  {heroPanelCampaigns.length === 0 ? (
                    <div style={{textAlign:"center",padding:"2rem 1rem",color:"var(--ink4)",fontSize:13}}>
                      Connect wallet to see live campaigns
                    </div>
                  ) : heroPanelCampaigns.map((c,i) => {
                    const cp = pct(c.totalRaised, c.goalAmount);
                    return (
                      <div className="hero-panel-campaign" key={i}>
                        <div className="hpc-name">{c.title}</div>
                        <div className="hpc-track">
                          <div className="hpc-fill" style={{width:`${cp}%`,background:c.goalReached?"#3b82f6":"var(--green)"}}></div>
                        </div>
                        <div className="hpc-meta">
                          <span>{fmt(c.totalRaised)} ETH raised</span>
                          <span>{cp}% · {c.donorCount} donors</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="hero-panel-trust">
                    <TrustScore score={98}/>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--ink4)",letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:2}}>Network</div>
                      <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--green-d)"}}>{CONTRACT_ADDRESS.slice(0,10)}...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TICKER */}
        <div className="ticker">
          <div className="ticker-track">
            {[...Array(3)].map((_,ri) => (
              <span key={ri} style={{display:"contents"}}>
                <span className="ticker-item">Funds held in <strong>Smart Contract Escrow</strong></span>
                <span className="ticker-item ticker-sep">·</span>
                <span className="ticker-item"><strong>Donor Voting</strong> required to release funds</span>
                <span className="ticker-item ticker-sep">·</span>
                <span className="ticker-item"><strong>Automatic Refunds</strong> if goal not met</span>
                <span className="ticker-item ticker-sep">·</span>
                <span className="ticker-item"><strong>100% Transparent</strong> on Etherscan</span>
                <span className="ticker-item ticker-sep">·</span>
                <span className="ticker-item">Built on <strong>Ethereum</strong> — zero intermediaries</span>
                <span className="ticker-item ticker-sep">·</span>
              </span>
            ))}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section className="section how-section" id="how">
          <div className="section-inner">
            <div className="section-kicker">How It Works</div>
            <h2 className="section-h2">Three steps. Code enforces everything.</h2>
            <p className="section-sub">No middleman. No admin. No trust required — smart contracts do exactly what they promised.</p>
            <div className="how-grid">
              <div className="how-card how-card-1">
                <div className="how-num" style={{background:"var(--green)"}}>01</div>
                <span className="how-icon" style={{fontSize:"1.5rem"}}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" fill="#dcfce7"/><path d="M9 14l4-6 5 8" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <div className="how-title">Create & Fund</div>
                <div className="how-desc">A creator launches a campaign with a goal and deadline. Donors contribute ETH — held securely in smart contract escrow. Not a single wei touches the creator until donors approve.</div>
              </div>
              <div className="how-card how-card-2">
                <div className="how-num" style={{background:"var(--amber)"}}>02</div>
                <span className="how-icon" style={{fontSize:"1.5rem"}}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" fill="#fffbeb"/><rect x="9" y="10" width="10" height="8" rx="2" stroke="#f59e0b" strokeWidth="1.8"/><path d="M12 14h4M12 16.5h2" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </span>
                <div className="how-title">Milestone Voting</div>
                <div className="how-desc">Goal reached? The creator submits a milestone — what was done, what's needed. Every donor votes. A majority approves or rejects the release. Democracy, on-chain.</div>
              </div>
              <div className="how-card how-card-3">
                <div className="how-num" style={{background:"var(--blue)"}}>03</div>
                <span className="how-icon" style={{fontSize:"1.5rem"}}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" fill="#eff6ff"/><path d="M10 14l3 3 5-5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <div className="how-title">Funds Released or Refunded</div>
                <div className="how-desc">Milestone approved — creator gets paid automatically. Goal not reached by deadline — every donor gets a full refund. No human can override. The contract always wins.</div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="section">
          <div className="section-inner">
            <div className="section-kicker">Platform Features</div>
            <h2 className="section-h2">Built for accountability.<br />Designed for people.</h2>
            <div className="features-grid">
              {[
                { icon:"🔐", title:"Escrow Protection", desc:"All donations go into a smart contract — not the creator's wallet. Funds are mathematically locked until donors vote to release.", bg:"#f0fdf4", iconBg:"#dcfce7" },
                { icon:"🗳️", title:"On-Chain Voting", desc:"Every donor votes on milestone approvals. Results are permanently on the blockchain — no one can change them, ever.", bg:"#eff6ff", iconBg:"#dbeafe" },
                { icon:"↩", title:"Automatic Refunds", desc:"If the goal isn't met by deadline, the contract makes refunds available instantly. No waiting, no admin approval needed.", bg:"#fffbeb", iconBg:"#fef3c7" },
                { icon:"🔍", title:"Full Transparency", desc:"Every transaction — donation, release, refund — is public on Etherscan. Anyone can audit any campaign at any time.", bg:"#ede9fe", iconBg:"#ddd6fe" },
                { icon:"⚡", title:"Milestone Roadmap", desc:"Creators break goals into milestones. Donors see exactly what each fund release is for before voting.", bg:"#fef2f2", iconBg:"#fee2e2" },
                { icon:"🌐", title:"Borderless Access", desc:"No banks, no borders, no bureaucracy. Anyone with a crypto wallet can donate or create a campaign instantly.", bg:"#f0fdf4", iconBg:"#dcfce7" },
              ].map((f,i) => (
                <div className="feature-card" key={i} style={{background:f.bg}}>
                  <div className="feature-card-inner">
                    <div className="feature-icon-wrap" style={{background:f.iconBg}}>{f.icon}</div>
                    <div className="feature-title">{f.title}</div>
                    <div className="feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* IMPACT */}
        <section className="section impact-section" id="impact">
          <div className="section-inner">
            <div className="section-kicker" style={{color:"#4ade80"}}>Platform Impact</div>
            <h2 className="section-h2" style={{color:"white"}}>Numbers that matter.</h2>
            <div className="impact-grid">
              {[
                { val: stats.total, label:"Active Campaigns", barPct: Math.min(stats.total * 10, 100), decimals: 0 },
                { val: parseFloat(fmt(stats.raised)), label:"ETH Secured in Escrow", barPct: 72, decimals: 4 },
                { val: stats.donors, label:"Verified Donors", barPct: Math.min(stats.donors * 5, 100), decimals: 0 },
                { val: 98, label:"Trust Score", barPct: 98, decimals: 0 },
              ].map((item,i) => (
                <div className="impact-card" key={i}>
                  <div className="impact-val">
                    <AnimatedCounter value={item.val} decimals={item.decimals}/>
                    {i === 3 ? "%" : i === 1 ? " ETH" : ""}
                  </div>
                  <div className="impact-label">{item.label}</div>
                  <div className="impact-bar"><div className="impact-bar-fill" style={{width:`${item.barPct}%`}}></div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="section testimonials-section">
          <div className="section-inner">
            <div className="section-kicker">Community</div>
            <h2 className="section-h2">Real people. Real impact.</h2>
            <div className="test-grid">
              {[
                { text:"As a donor, I finally feel in control. I voted on every milestone for a school construction campaign and watched my contribution actually build something.", name:"Rajan Mehta", role:"Donor — Mumbai", initials:"RM", color:"#f0fdf4", tc:"#15803d" },
                { text:"I raised funds for my mother's treatment. Donors could see every hospital invoice before approving. Their trust made all the difference.", name:"Anjali Singh", role:"Campaign Creator — Delhi", initials:"AS", color:"#eff6ff", tc:"#1d4ed8" },
                { text:"The automatic refund feature is brilliant. When a campaign I backed didn't reach its goal, my ETH returned instantly — no questions asked.", name:"Vikram Nair", role:"Developer — Bangalore", initials:"VN", color:"#fffbeb", tc:"#92400e" },
              ].map((t,i) => (
                <div className="test-card" key={i}>
                  <div className="test-stars">
                    {[...Array(5)].map((_,si) => (
                      <svg key={si} className="test-star" viewBox="0 0 14 14" fill="#f59e0b"><path d="M7 1l1.8 3.6L13 5.2l-3 2.9.7 4.1L7 10.5l-3.7 1.7.7-4.1L1 5.2l4.2-.6z"/></svg>
                    ))}
                  </div>
                  <div className="test-text">"{t.text}"</div>
                  <div className="test-author">
                    <div className="test-avatar" style={{background:t.color,color:t.tc}}>{t.initials}</div>
                    <div><div className="test-name">{t.name}</div><div className="test-role">{t.role}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <svg className="cta-grid" xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="cta-g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#cta-g)"/>
          </svg>
          <div className="cta-inner">
            <h2 className="cta-h2">Join a community that gives with confidence</h2>
            <p className="cta-sub">Whether you have a cause to fund or a contribution to make — VeriFund ensures every action counts, every decision is transparent, and every promise is kept by code.</p>

            {/* Gamification achievements */}
            <div className="achievements">
              {achievements.map((a,i) => <AchievementBadge key={i} label={a.label} icon={a.icon} unlocked={a.unlocked}/>)}
            </div>

            <div style={{height:"1.5rem"}}></div>
            <div className="cta-btns">
              <button className="btn-cta-light" onClick={() => { if (account) setShowCreate(true); else connectWallet(); }}>
                {account ? "Launch Your Campaign" : "Connect & Start"}
              </button>
              <button className="btn-cta-outline" onClick={() => document.getElementById("campaigns")?.scrollIntoView({behavior:"smooth"})}>
                Browse Campaigns
              </button>
            </div>
          </div>
        </section>

        {/* CAMPAIGNS */}
        <section className="section campaigns-section" id="campaigns">
          <div className="section-inner">
            <div className="campaigns-topbar">
              <div>
                <div className="section-kicker">Live On-Chain</div>
                <h2 className="section-h2" style={{fontSize:"2rem",marginBottom:0}}>{tab==="mine"?"Your Campaigns":"Active Campaigns"}</h2>
              </div>
              <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                <div className="tab-group">
                  <button className={`tab ${tab==="explore"?"active":""}`} onClick={()=>setTab("explore")}>All</button>
                  {account && <button className={`tab ${tab==="mine"?"active":""}`} onClick={()=>setTab("mine")}>Mine</button>}
                </div>
                {account && (
                  <button className="btn-new" onClick={()=>setShowCreate(true)}>
                    <svg viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    New Campaign
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="loading-center"><div className="spinner"></div>Loading from the blockchain…</div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">◎</span>
                <div className="empty-title">{tab==="mine"?"No campaigns yet":"No campaigns yet"}</div>
                <div className="empty-desc">{tab==="mine"?"Create your first campaign and start making a difference.":account?"Be the first to launch a campaign on VeriFund.":"Connect your wallet to see and support campaigns."}</div>
              </div>
            ) : (
              <div className="campaigns-grid">
                {filtered.map((c, i) => {
                  const cp = pct(c.totalRaised, c.goalAmount);
                  const status = c.goalReached ? "reached" : (Number(c.timeRemaining) > 0 ? "active" : "ended");
                  const accentColor = status === "reached" ? "#3b82f6" : status === "active" ? "var(--green)" : "var(--ink5)";
                  return (
                    <div className="c-card" key={i} onClick={() => openCampaign(c)} style={{animationDelay:`${i*0.06}s`}}>
                      <div className="c-card-accent" style={{background:accentColor}}></div>
                      <div className="c-card-body">
                        <div className="c-card-chips">
                          {status==="active"  && <span className="chip chip-active"><span className="chip-dot"></span>Active</span>}
                          {status==="reached" && <span className="chip chip-reached">Goal Reached</span>}
                          {status==="ended"   && <span className="chip chip-ended">Ended</span>}
                          <span className="chip chip-chain">On-Chain</span>
                        </div>
                        <div className="c-card-title">{c.title}</div>
                        <div className="c-card-desc">{c.description}</div>
                      </div>
                      <div className="c-card-footer">
                        <div className="c-card-progress">
                          <div className="c-card-raised">{fmt(c.totalRaised)} ETH</div>
                          <div className="c-card-track">
                            <div className="c-card-fill" style={{width:`${cp}%`,background:accentColor}}></div>
                          </div>
                          <div className="c-card-meta">Goal: {fmt(c.goalAmount)} ETH · {c.donorCount} donors · {timeLeft(c.timeRemaining)}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                          <ProgressRing pct={cp} size={48} stroke={5}/>
                          {status==="active" && <button className="btn-fund" onClick={e=>{e.stopPropagation();openCampaign(c);}}>Fund</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-grid">
              <div className="footer-brand">
                <div className="footer-logo">
                  <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#16a34a,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="white" opacity="0.3"/><path d="M7 2v5l2.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  </div>
                  <span className="footer-logo-name">Veri<span>Fund</span></span>
                </div>
                <div className="footer-tag">Trustless crowdfunding on Ethereum. Donations protected by smart contracts. Fund releases decided by the community.</div>
                <div className="footer-contract">
                  <span style={{width:5,height:5,borderRadius:"50%",background:"#4ade80",display:"block"}}></span>
                  {CONTRACT_ADDRESS.slice(0,14)}…{CONTRACT_ADDRESS.slice(-6)}
                </div>
              </div>
              <div>
                <div className="footer-col-title">Platform</div>
                <button className="footer-link" onClick={()=>document.getElementById("campaigns")?.scrollIntoView({behavior:"smooth"})}>Explore Campaigns</button>
                <button className="footer-link" onClick={()=>{if(account)setShowCreate(true);else connectWallet();}}>Start a Campaign</button>
                <button className="footer-link" onClick={()=>document.getElementById("how")?.scrollIntoView({behavior:"smooth"})}>How It Works</button>
              </div>
              <div>
                <div className="footer-col-title">On-Chain</div>
                <button className="footer-link" onClick={()=>window.open(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`,"_blank")}>View Contract ↗</button>
                <button className="footer-link" onClick={()=>window.open(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}#code`,"_blank")}>Verify Source ↗</button>
              </div>
              <div>
                <div className="footer-col-title">Community</div>
                <button className="footer-link">About VeriFund</button>
                <button className="footer-link">For Donors</button>
                <button className="footer-link">For Creators</button>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© 2025 VeriFund · Built on Ethereum · Zero Trust Required</span>
              <span>Every rupee accounted for</span>
            </div>
          </div>
        </footer>

        {/* CREATE MODAL */}
        {showCreate && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowCreate(false);}}>
            <div className="modal modal-create">
              <div className="modal-bar"></div>
              <div className="create-header">
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--green)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>New Campaign</div>
                  <div className="create-title">Launch your campaign</div>
                </div>
                <button className="modal-close" onClick={()=>setShowCreate(false)}>×</button>
              </div>
              <div className="create-body">
                <div className="secure-badge">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L2 3.5v4c0 2.5 2 4.5 5 5.5 3-1 5-3 5-5.5v-4L7 1z" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.2"/><path d="M5 7l1.5 1.5L9 5.5" stroke="#16a34a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="secure-badge-text">Funds secured by Ethereum smart contract</span>
                  <span className="secure-badge-addr">{CONTRACT_ADDRESS.slice(0,10)}…</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Campaign Title</label>
                  <input className="form-input" placeholder="e.g. Medical aid for flood victims in Punjab" value={createForm.title} onChange={e=>setCreateForm({...createForm,title:e.target.value})}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Your Story</label>
                  <textarea className="form-textarea" placeholder="Tell donors why this campaign matters, what you'll do with funds, and how they can track progress…" value={createForm.description} onChange={e=>setCreateForm({...createForm,description:e.target.value})}/>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Funding Goal (ETH)</label>
                    <input className="form-input" type="number" min="1" placeholder="e.g. 2" value={createForm.goal} onChange={e=>setCreateForm({...createForm,goal:e.target.value})}/>
                    <div className="form-hint">Whole numbers only — 1, 2, 3…</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration (Days)</label>
                    <input className="form-input" type="number" min="1" max="90" placeholder="e.g. 30" value={createForm.days} onChange={e=>setCreateForm({...createForm,days:e.target.value})}/>
                    <div className="form-hint">Between 1 and 90 days</div>
                  </div>
                </div>
                <button className="btn-create-submit" onClick={handleCreate} disabled={txPending}>{txPending?"Deploying to blockchain…":"Deploy Campaign On-Chain"}</button>
                <button className="btn-cancel" onClick={()=>setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* CAMPAIGN DETAIL MODAL */}
        {selected && (
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)closeModal();}}>
            <div className="modal">
              <div className="modal-bar"></div>
              <div className="modal-layout">
                <div className="modal-main">
                  <div className="modal-eyebrow">
                    <div className="modal-eyebrow-label">Campaign #{selected.id}</div>
                    <button className="modal-close" onClick={closeModal}>×</button>
                  </div>
                  <div className="modal-title">{selected.title}</div>
                  <div className="modal-creator">{isCreator?"You created this":shortAddr(selected.creator)}</div>
                  <div className="secure-badge">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L2 3.5v4c0 2.5 2 4.5 5 5.5 3-1 5-3 5-5.5v-4L7 1z" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.2"/></svg>
                    <span className="secure-badge-text">Verified Smart Contract — Escrow + Voting</span>
                    <span className="secure-badge-addr">{CONTRACT_ADDRESS.slice(0,12)}…</span>
                  </div>
                  <p className="modal-desc">{selected.description}</p>

                  {/* Donate in main */}
                  {account && !isCreator && Number(selected.timeRemaining) > 0 && !selected.goalReached && (
                    <div style={{marginBottom:"1.25rem"}}>
                      <div className="donate-label">Back this campaign</div>
                      {myDonation !== "0" && (
                        <div className="my-donation"><span className="my-donation-label">Your contribution</span><span className="my-donation-val">{fmt(myDonation)} ETH</span></div>
                      )}
                      <div className="donate-row">
                        <input className="donate-input" type="number" step="0.001" placeholder="ETH amount (e.g. 0.01)" value={donateAmt} onChange={e=>setDonateAmt(e.target.value)}/>
                        <button className="donate-submit" onClick={handleDonate} disabled={txPending}>{txPending?"…":"Donate"}</button>
                      </div>
                    </div>
                  )}
                  {isCreator && Number(selected.timeRemaining) > 0 && !selected.goalReached && (
                    <div className="creator-note">Share this campaign so donors can contribute</div>
                  )}
                  {account && !isCreator && Number(selected.timeRemaining) === 0 && !selected.goalReached && myDonation !== "0" && (
                    <div className="refund-box">
                      <div className="refund-box-title">Claim Your Refund</div>
                      <div className="refund-box-desc">This campaign didn't reach its goal. Your {fmt(myDonation)} ETH is ready to be refunded.</div>
                      <button className="btn-refund" onClick={handleRefund} disabled={txPending}>{txPending?"Processing…":`Claim ${fmt(myDonation)} ETH`}</button>
                    </div>
                  )}

                  <div className="modal-divider"></div>

                  <div className="ms-header">
                    <div className="ms-title">Milestone Roadmap</div>
                    <div className="ms-count">{campaignMilestones.length} milestones</div>
                  </div>

                  {campaignMilestones.length === 0 && (
                    <div style={{padding:"1.25rem",textAlign:"center",color:"var(--ink4)",fontSize:13,background:"var(--surface2)",borderRadius:"var(--r2)",border:"1.5px dashed var(--border)"}}>
                      {isCreator && selected.goalReached ? "Goal reached — submit your first milestone to request funds." : "No milestones submitted yet."}
                    </div>
                  )}

                  <div className="ms-timeline">
                    {campaignMilestones.map((m, i) => {
                      const tot = Number(m.approveVotes) + Number(m.rejectVotes);
                      const ap = tot > 0 ? Math.round((Number(m.approveVotes)/tot)*100) : 0;
                      const status = m.isApproved ? "approved" : m.isRejected ? "rejected" : "voting";
                      return (
                        <div className="ms-item" key={i}>
                          <div className="ms-node"><MilestoneNode status={status} index={i}/></div>
                          <div className={`ms-box ${!m.isApproved&&!m.isRejected?"active":""}`}>
                            <div className="ms-top">
                              <div>
                                <div className="ms-desc-text">{m.description}</div>
                                <div className="ms-sub">Milestone #{i}</div>
                              </div>
                              <div className="ms-right">
                                <div className="ms-eth">{fmt(m.releaseAmount)} ETH</div>
                                <div className={`ms-badge ms-badge-${status}`}>
                                  {m.isApproved?"Released":m.isRejected?"Rejected":"Voting"}
                                </div>
                              </div>
                            </div>
                            {!m.isApproved && !m.isRejected && (
                              <div>
                                <div className="vote-bar-labels">
                                  <span>{Number(m.approveVotes)} approve</span>
                                  <span>{ap}%{ap>=50?" — majority reached":""}</span>
                                  <span>{Number(m.rejectVotes)} reject</span>
                                </div>
                                <div className="vote-track"><div className="vote-fill" style={{width:`${ap}%`}}></div></div>
                              </div>
                            )}
                            {account && !isCreator && !m.isApproved && !m.isRejected && !m.voted && myDonation !== "0" && (
                              <div className="vote-btns">
                                <button className="btn-approve" onClick={()=>handleVote(i,true)} disabled={txPending}>Approve Release</button>
                                <button className="btn-reject" onClick={()=>handleVote(i,false)} disabled={txPending}>Reject</button>
                              </div>
                            )}
                            {m.voted && !m.isApproved && !m.isRejected && <div className="voted-label">Your vote is recorded on-chain</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isCreator && selected.goalReached && (
                    <div className="ms-request">
                      <div className="ms-request-label">Request Fund Release</div>
                      <div className="form-group">
                        <label className="form-label">What did you accomplish?</label>
                        <input className="form-input" placeholder="Describe the milestone and what this release funds…" value={milestoneForm.description} onChange={e=>setMilestoneForm({...milestoneForm,description:e.target.value})}/>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Amount to Release (ETH)</label>
                        <input className="form-input" type="number" min="1" placeholder="Whole ETH amount" value={milestoneForm.amount} onChange={e=>setMilestoneForm({...milestoneForm,amount:e.target.value})}/>
                      </div>
                      <button className="btn-create-submit" onClick={handleAddMilestone} disabled={txPending} style={{marginTop:8}}>{txPending?"Submitting…":"Submit for Donor Vote"}</button>
                    </div>
                  )}
                </div>

                {/* SIDEBAR */}
                <div className="modal-sidebar">
                  <div className="sidebar-raised">{fmt(selected.totalRaised)} ETH</div>
                  <div className="sidebar-goal">raised of {fmt(selected.goalAmount)} ETH goal</div>
                  <div className="sidebar-track">
                    <div className={`sidebar-fill ${selected.goalReached?"full":""}`} style={{width:`${selPct}%`}}></div>
                  </div>
                  <div className="sidebar-pct">{selPct}% funded</div>
                  <div className="info-grid">
                    <div className="info-cell"><div className="info-cell-label">Donors</div><div className="info-cell-val green">{selected.donorCount}</div></div>
                    <div className="info-cell"><div className="info-cell-label">Time Left</div><div className="info-cell-val">{timeLeft(selected.timeRemaining)}</div></div>
                    <div className="info-cell"><div className="info-cell-label">Status</div><div className={`info-cell-val ${selected.goalReached?"green":""}`}>{selected.goalReached?"Funded":Number(selected.timeRemaining)>0?"Active":"Ended"}</div></div>
                    <div className="info-cell"><div className="info-cell-label">Campaign ID</div><div className="info-cell-val">#{selected.id}</div></div>
                  </div>
                  {!account && (
                    <button className="btn-create-submit" style={{marginBottom:"1rem",fontSize:13}} onClick={connectWallet}>Connect Wallet to Donate</button>
                  )}
                  <div className="modal-divider"></div>
                  <div className="sc-info">
                    <div className="sc-title">Smart Contract Info</div>
                    <div className="sc-row"><span className="sc-key">Protocol</span><span className="sc-val">Escrow + Voting</span></div>
                    <div className="sc-row"><span className="sc-key">Network</span><span className="sc-val">Sepolia Testnet</span></div>
                    <div className="sc-row"><span className="sc-key">Vote Threshold</span><span className="sc-val">50% majority</span></div>
                    <div className="sc-row"><span className="sc-key">Refund Policy</span><span className="sc-val green">Auto-guaranteed</span></div>
                    <div className="sc-row"><span className="sc-key">Source</span><span className="sc-val green">Public on Etherscan</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div className={`toast ${toast.type}`}>
            <div className="toast-title">{toast.title}</div>
            {toast.msg && <div className="toast-msg">{toast.msg}</div>}
          </div>
        )}
      </div>
    </>
  );
}