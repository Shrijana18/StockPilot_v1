import{j as e}from"./index-DRC3F7i0.js";import{u as w,r as o}from"./router-BPBaD_i0.js";import"./vendor-Ckhrjn13.js";import"./firebase-DWi1MSv1.js";import"./index.esm-Bux_mLJ0.js";let p;try{p=require("@capacitor/haptics").Haptics}catch{p=null}const k="/assets/flyp_logo.png",b="/assets/flyp_logo.png",j="FLYP";function N(t,a=30){const[r,n]=o.useState(""),[s,l]=o.useState(!1);return o.useEffect(()=>{n(""),l(!1);const d=setInterval(()=>{n(m=>m.length<t.length?t.substring(0,m.length+1):(clearInterval(d),l(!0),m))},a);return()=>clearInterval(d)},[t,a]),{displayedText:r,isDone:s}}function C(){const t=w(),[a,r]=o.useState(k),[n,s]=o.useState("splash"),[l,d]=o.useState(!1),m="From AI billing to smart inventory, seamless orders and real‑time analytics — your complete Supply Chain OS.",{displayedText:f,isDone:g}=N(m,30);o.useEffect(()=>{document.body.style.overscrollBehavior="none";const i=setTimeout(()=>s("brand"),1e3),c=setTimeout(()=>s("ready"),2200);return()=>{clearTimeout(i),clearTimeout(c),document.body.style.overscrollBehavior=""}},[]),o.useEffect(()=>{const i=u=>{const y=Math.max(-1,Math.min(1,(u.gamma||0)/30)),v=Math.max(-1,Math.min(1,(u.beta||0)/30));document.documentElement.style.setProperty("--tilt-x",`${y*6}px`),document.documentElement.style.setProperty("--tilt-y",`${v*6}px`)};window.addEventListener("deviceorientation",i,!0);const c=setInterval(()=>{const u=Date.now()/4e3;document.documentElement.style.setProperty("--tilt-x",`${Math.sin(u)*4}px`),document.documentElement.style.setProperty("--tilt-y",`${Math.cos(u)*4}px`)},120);return()=>{window.removeEventListener("deviceorientation",i,!0),clearInterval(c)}},[]),o.useEffect(()=>{const i=c=>{document.documentElement.style.setProperty("--mouse-x",`${c.clientX}px`),document.documentElement.style.setProperty("--mouse-y",`${c.clientY}px`)};return window.addEventListener("mousemove",i),()=>window.removeEventListener("mousemove",i)},[]);const x=i=>async()=>{if(!l){try{p&&(await p.selectionStart(),await p.selectionChanged(),await p.selectionEnd())}catch{}d(!0),setTimeout(()=>t(i),260)}};return e.jsxs("div",{className:"relative min-h-[100dvh] bg-black text-white flex flex-col overflow-hidden landing-container",children:[e.jsx($,{}),e.jsxs("div",{className:"pointer-events-none absolute inset-0 -z-10",children:[e.jsx("div",{className:"absolute inset-0",style:{boxShadow:"inset 0 0 140px rgba(0,0,0,.85)"}}),e.jsx("div",{className:"absolute inset-0 opacity-[.06] mix-blend-overlay grain"})]}),l&&e.jsx("div",{className:"fixed inset-0 z-[60] bg-black animate-fade-to-black"}),n==="splash"&&e.jsxs("div",{className:"fixed inset-0 z-50 grid place-items-center bg-black",children:[e.jsx("div",{className:"absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_40%,rgba(16,185,129,.18),transparent_60%)] pointer-events-none"}),e.jsx("img",{src:a,onError:()=>r(b),alt:"FLYP",className:"h-28 w-28 object-contain animate-logo-zoom drop-shadow-[0_12px_60px_rgba(16,185,129,.55)]"})]}),n!=="ready"&&e.jsxs("div",{className:`fixed inset-0 z-40 grid place-items-center bg-black ${n==="brand"?"animate-iris-open":""}`,children:[e.jsx(S,{}),e.jsxs("div",{className:"relative flex flex-col items-center",children:[e.jsx("img",{src:a,onError:()=>r(b),alt:"FLYP",className:`h-14 w-14 object-contain mb-3 opacity-0 animate-brand-fade ${n==="brand"?"animate-logo-to-lockup":""}`,style:{animationDelay:"100ms"}}),e.jsx(T,{})]})]}),e.jsxs("div",{className:"absolute inset-0 -z-10 overflow-hidden",children:[e.jsx("div",{className:"orb orb-a"}),e.jsx("div",{className:"orb orb-b"})]}),e.jsx("div",{className:"aurora-tilt pointer-events-none absolute -inset-20 -z-10","aria-hidden":!0,children:e.jsx("div",{className:"animate-aurora absolute inset-0"})}),e.jsx("div",{className:"pointer-events-none absolute inset-0 -z-10 boot-grid"}),e.jsx("header",{className:"px-4 pt-1.5 pb-1 opacity-0 animate-fade-in",style:{paddingTop:"max(env(safe-area-inset-top), 8px)",animationDelay:"2400ms",animationFillMode:"both"},children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2.5",children:[e.jsx("img",{src:a,onError:()=>r(b),alt:"",className:"h-10 w-10 object-contain drop-shadow-[0_0_24px_rgba(16,185,129,.45)]","aria-hidden":!0}),e.jsx("span",{className:"text-sm font-medium text-white/70 tracking-wider",children:"Supply Chain OS"})]}),e.jsx("button",{onClick:x("/dashboard"),className:"text-xs px-3 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[.98] transition-colors",children:"Skip"})]})}),e.jsxs("main",{className:"flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-2 sm:pt-4",children:[e.jsx("div",{className:"opacity-0 animate-fade-up",style:{animationDelay:"2520ms",animationFillMode:"both"},children:e.jsxs("div",{className:"relative",children:[e.jsx(E,{logoSrc:a}),e.jsx("span",{className:"pointer-events-none absolute inset-0 block animate-wordmark-sheen bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.25),transparent)] mix-blend-overlay"}),e.jsx("i",{className:"pointer-events-none absolute left-0 right-0 -bottom-2 h-[3px] rounded-full animate-tricolor"}),n==="ready"&&e.jsxs(e.Fragment,{children:[e.jsx(z,{}),e.jsx("span",{className:"pointer-events-none absolute inset-0 animate-pulse-ring rounded-[56px] border border-emerald-400/0"})]})]})}),e.jsxs("p",{className:"mt-4 text-white/85 max-w-[28ch] min-h-[120px] mx-auto opacity-0 animate-fade-up-slow [text-wrap:balance]",style:{animationDelay:"2900ms",animationFillMode:"both"},children:[f,!g&&e.jsx("span",{className:"typing-caret",children:"|"})]}),e.jsx("div",{className:"mt-5 w-full overflow-hidden opacity-0 animate-fade-up-slow",style:{animationDelay:"3000ms",animationFillMode:"both"},children:e.jsx("div",{className:"feature-rail",children:["AI Billing","Inventory","Orders","Analytics","Distributor Connect","Purchase","Returns","GST","Payments","Insights"].concat(["AI Billing","Inventory","Orders","Analytics","Distributor Connect","Purchase","Returns","GST","Payments","Insights"]).map((i,c)=>e.jsx("span",{className:"chip",children:i},c))})}),e.jsx("div",{className:"mt-5 opacity-0 animate-fade-up-slow",style:{animationDelay:"3080ms",animationFillMode:"both"},children:e.jsx(I,{})}),e.jsxs("div",{className:"mt-8 w-full max-w-xs space-y-3",children:[e.jsx(h,{onClick:x("/auth?type=register"),style:{animationDelay:"3150ms"},variant:"primary",children:"Create Account"}),e.jsx(h,{onClick:x("/auth?type=login"),style:{animationDelay:"3250ms"},variant:"ghost",children:"Sign In"}),e.jsx(h,{onClick:x("/dashboard"),style:{animationDelay:"3350ms"},variant:"soft",children:"Continue"})]})]}),e.jsx("footer",{className:"px-4 pb-4 text-center text-[11px] text-white/50 opacity-0 animate-fade-in",style:{paddingBottom:"env(safe-area-inset-bottom)",animationDelay:"3400ms",animationFillMode:"both"},children:"Made for mobile • Optimized for Android & iOS • v1"})]})}function S(){return e.jsx("svg",{className:"absolute inset-0 w-full h-full opacity-60","aria-hidden":!0,children:Array.from({length:8}).map((t,a)=>e.jsxs("circle",{cx:"50%",cy:"45%",r:"2",fill:a%2?"#86efac":"#67e8f9",children:[e.jsx("animate",{attributeName:"r",values:"1.5;2.5;1.5",dur:`${2+a%3}s`,repeatCount:"indefinite"}),e.jsx("animate",{attributeName:"cx",values:"50%; 52%; 48%; 50%",dur:`${3+a*.2}s`,repeatCount:"indefinite"}),e.jsx("animate",{attributeName:"cy",values:"45%; 43%; 47%; 45%",dur:`${3.2+a*.2}s`,repeatCount:"indefinite"})]},a))})}function z(){return e.jsx("svg",{className:"absolute inset-0 w-[220px] h-[80px] -translate-x-1/2 left-1/2 -top-8 pointer-events-none",viewBox:"0 0 220 80","aria-hidden":!0,children:Array.from({length:18}).map((t,a)=>{const r=.05*a,n=110,s=40,l=a/18*Math.PI*2,d=Math.cos(l)*40,m=Math.sin(l)*20,f=a%3===0?"#86efac":a%3===1?"#67e8f9":"#a78bfa";return e.jsxs("circle",{cx:n,cy:s,r:"2",fill:f,opacity:"0",children:[e.jsx("animate",{attributeName:"opacity",values:"0;1;0",dur:"900ms",begin:`${r}s`,fill:"freeze"}),e.jsx("animate",{attributeName:"cx",values:`${n};${n+d}`,dur:"900ms",begin:`${r}s`,fill:"freeze"}),e.jsx("animate",{attributeName:"cy",values:`${s};${s+m}`,dur:"900ms",begin:`${r}s`,fill:"freeze"}),e.jsx("animate",{attributeName:"r",values:"2;0",dur:"900ms",begin:`${r}s`,fill:"freeze"})]},a)})})}function T(){return e.jsxs("div",{className:"relative select-none",children:[e.jsx("div",{className:"text-4xl font-extrabold tracking-[.18em] flex",children:j.split("").map((t,a)=>e.jsx("span",{className:"opacity-0 animate-letter-fade-up",style:{animationDelay:`${240+a*80}ms`},children:t},a))}),e.jsx("div",{className:"absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-emerald-400/0 via-emerald-400/80 to-cyan-300/0 rounded-full opacity-0 animate-brand-fade",style:{animationDelay:"600ms"}})]})}function E({logoSrc:t}){return e.jsxs("div",{className:"flex flex-col items-center justify-center gap-3",children:[e.jsx("img",{src:t,alt:"",className:"h-20 w-20 sm:h-24 sm:w-24 object-contain drop-shadow-[0_8px_32px_rgba(16,185,129,.45)]","aria-hidden":!0}),e.jsx("span",{className:"text-sm font-medium text-white/70 tracking-wider",children:"Supply Chain OS"})]})}function h({children:t,variant:a="primary",...r}){const n="w-full rounded-xl py-3.5 text-base font-semibold transition will-change-transform opacity-0 animate-fade-up-slow active:scale-[.98]",s={primary:"bg-emerald-500 text-neutral-900 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400",ghost:"border border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md",soft:"bg-white/8 text-white/85 hover:bg-white/12 border border-white/10"};return e.jsx("button",{className:`${n} ${s[a]}`,...r,children:t})}function I(){return e.jsxs("div",{className:"inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-white/12 bg-white/[.06] backdrop-blur-md",children:[e.jsx("span",{className:"text-[12px] font-semibold bg-[linear-gradient(90deg,#ff9933,#ffffff,#128807)] bg-clip-text text-transparent animate-tricolor-text",children:"Made in India — for the world"}),e.jsx("span",{"aria-hidden":!0,children:"🇮🇳"})]})}function $(){return e.jsx("style",{children:`
      :root {
        --tilt-x: 0px;
        --tilt-y: 0px;
        --mouse-x: 50vw;
        --mouse-y: 50vh;
      }

      /* NEW: Interactive mouse light */
      .landing-container::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 1; /* Position it above background but below content */
        background: radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(16, 185, 129, 0.1), transparent 80%);
        pointer-events: none;
        transition: background .2s ease-out;
      }
      
      .orb { position:absolute; border-radius:9999px; filter: blur(70px); opacity:.2; }
      .orb-a { width: 360px; height: 360px; background:#22d3ee; left: -80px; bottom: -80px; }
      .orb-b { width: 280px; height: 280px; background:#34d399; right: -60px; top: -60px; opacity:.16; }

      .aurora-tilt { transform: translate3d(var(--tilt-x), var(--tilt-y), 0); transition: transform .2s ease-out; }

      @media (prefers-reduced-motion: no-preference) {
        .animate-logo-zoom { animation: logoZoom 1s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes logoZoom { 0% { transform: scale(1.35); opacity: 0; filter: blur(6px) } 65% { transform: scale(1.02); opacity: 1; filter: blur(0) } 100% { transform: scale(1.00); opacity: 1 } }

        .animate-iris-open { animation: irisOpen 1s ease forwards; -webkit-mask-image: radial-gradient(circle at 50% 45%, #000 0%, #000 0%, transparent 0%); mask-image: radial-gradient(circle at 50% 45%, #000 0%, #000 0%, transparent 0%); -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; }
        @keyframes irisOpen { 0% { -webkit-mask-size: 0% 0%; mask-size: 0% 0%; opacity:1 } 100% { -webkit-mask-size: 220% 220%; mask-size: 220% 220%; opacity:0 } }

        .animate-logo-to-lockup { animation: logoToLockup .9s cubic-bezier(.23,1,.32,1) .1s both; }
        @keyframes logoToLockup { from { transform: translateY(10px) scale(1.15); opacity:0 } to { transform: translateY(0) scale(1); opacity:1 } }

        .animate-brand-fade { animation: brandFade .7s ease both; }
        @keyframes brandFade { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        
        /* NEW: Letter animation */
        .animate-letter-fade-up { animation: letterFadeUp .6s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes letterFadeUp {
          from { transform: translateY(15px) rotate(5deg); opacity: 0; }
          to { transform: translateY(0) rotate(0deg); opacity: 1; }
        }

        .animate-fade-in { animation: fadeIn .8s ease both; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

        .animate-fade-up { animation: fadeUp .8s cubic-bezier(.23,1,.32,1) both; }
        .animate-fade-up-slow { animation: fadeUpSlow .9s cubic-bezier(.23,1,.32,1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeUpSlow { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }

        .animate-aurora { background: radial-gradient(ellipse 50% 40% at 20% 10%, rgba(56,189,248,.12), transparent), radial-gradient(ellipse 50% 30% at 80% 0%, rgba(34,197,94,.12), transparent); animation: auroraShift 18s ease-in-out infinite alternate; }
        @keyframes auroraShift { 0% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(-2%,1%,0) scale(1.02) } 100% { transform: translate3d(2%,-1%,0) scale(1.03) } }

        .animate-wordmark-sheen { animation: wordSheen 2.2s ease-in-out 2.6s both; }
        @keyframes wordSheen { 0% { transform: translateX(-140%) rotate(10deg); opacity: 0 } 10% { opacity: .8 } 100% { transform: translateX(140%) rotate(10deg); opacity: 0 } }

        .animate-pulse-ring { animation: pulseRing 1.4s ease-out 0.2s both; }
        @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.0); opacity:0 } 30% { box-shadow: 0 0 0 10px rgba(16,185,129,0.25); opacity:1 } 100% { box-shadow: 0 0 0 32px rgba(16,185,129,0); opacity:0 } }

        .typing-caret { display:inline-block; width:1ch; animation: caretBlink 1s steps(1) infinite; }
        @keyframes caretBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }

        .grain { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="120" height="120" filter="url(%23n)" opacity="0.35"/></svg>'); background-size: 120px 120px; animation: grainShift 8s steps(6) infinite; }
        @keyframes grainShift { 0%{transform:translate(0,0)} 20%{transform:translate(-10px,6px)} 40%{transform:translate(8px,-12px)} 60%{transform:translate(-4px,8px)} 80%{transform:translate(12px,4px)} 100%{transform:translate(0,0)} }

        .animate-chip-pulse { animation: chipPulse 3s ease-in-out infinite; }
        @keyframes chipPulse { 0%,100%{ box-shadow: 0 0 0 rgba(16,185,129,0) } 50%{ box-shadow: 0 0 24px rgba(16,185,129,.18) } }

        .animate-tricolor { background: linear-gradient(90deg,#ff9933,#ffffff,#128807); filter: blur(.2px); }
        .animate-tricolor-text { background-size: 200% 100%; animation: triText 4s ease-in-out infinite; }
        @keyframes triText { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }

        .animate-fade-to-black { animation: fadeToBlack .26s ease forwards; }
        @keyframes fadeToBlack { from { opacity: 0 } to { opacity: 1 } }

        .feature-rail { display:flex; gap:.5rem; padding:0 .5rem; width:max-content; animation: rail 22s linear infinite; }
        .chip { font-size:11px; letter-spacing:.02em; padding:.35rem .7rem; border-radius:9999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); backdrop-filter: blur(6px); white-space:nowrap; }
        @keyframes rail { from { transform: translateX(0) } to { transform: translateX(-50%) } }

        /* NEW: Power-on grid animation */
        .boot-grid {
          background-image:
            linear-gradient(to right, rgba(34, 197, 94, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 197, 94, 0.2) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 10%, transparent 60%);
          animation: gridBoot 3s ease-out both;
          animation-delay: 2s; /* Start it as the main UI appears */
        }
        @keyframes gridBoot {
          from {
            opacity: 0;
            transform: perspective(600px) rotateX(70deg) translateY(100px);
          }
          to {
            opacity: 1;
            transform: perspective(600px) rotateX(70deg) translateY(0);
          }
        }
      }

      .feature-rail { display:flex; gap:.5rem; padding:0 .5rem; width:max-content; }
      .chip { font-size:11px; letter-spacing:.02em; padding:.35rem .7rem; border-radius:9999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); backdrop-filter: blur(6px); white-space:nowrap; }
    `})}export{C as default};
