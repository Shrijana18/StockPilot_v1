import{t as E,j as e,y as p}from"./index-DRC3F7i0.js";import{r as o}from"./router-BPBaD_i0.js";import{n as U,b as $,c as B,s as _}from"./firebase-DWi1MSv1.js";import{l as F}from"./logInventoryChange-kGfLyhaN.js";import{A as G}from"./AdvancedBrandInputForm-SuxBeOfL.js";import"./vendor-Ckhrjn13.js";import"./index.esm-Bux_mLJ0.js";const O=()=>e.jsx("span",{className:"inline-flex items-center gap-1 align-baseline ml-2",children:[0,1,2].map(d=>e.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce",style:{animationDelay:`${d*120}ms`,animationDuration:"1.2s"}},d))}),H=({message:d="Creating inventory…",step:u=0,className:g=""})=>e.jsxs("div",{className:`fixed inset-0 z-[70] overflow-hidden ${g}`,children:[e.jsx("div",{className:"absolute inset-0 bg-slate-900/50 backdrop-blur-xl"}),e.jsx("div",{className:"absolute inset-0 ai-grid-pattern"}),e.jsx("div",{className:"absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,.15),transparent_60%)]"}),e.jsxs("div",{className:"relative h-full w-full flex flex-col items-center justify-center text-center",children:[e.jsxs("div",{className:"relative w-48 h-48 mb-6 flex items-center justify-center",children:[Array.from({length:4}).map((l,r)=>e.jsx("div",{className:"absolute rounded-full border-2 border-cyan-300/30 animate-pulse-orb",style:{inset:`${r*20}px`,animationDelay:`${r*200}ms`,animationDuration:"2s"}},r)),e.jsxs("svg",{className:"absolute w-16 h-16 text-cyan-300 animate-spin-slow",xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",children:[e.jsx("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),e.jsx("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"})]})]}),e.jsxs("div",{className:"text-cyan-200/95 font-semibold tracking-wide text-xl drop-shadow",children:[d," ",e.jsx(O,{})]}),e.jsxs("div",{className:"mt-8 w-full max-w-xl px-6",children:[e.jsx("div",{className:"flex items-center justify-between text-xs text-white/70 mb-2",children:["Understanding brand","Finding SKUs","Pricing","Taxes & HSN","Building items"].map((l,r)=>e.jsx("span",{className:`transition-colors duration-500 ${r<=u?"text-emerald-300 font-medium":""}`,children:l},r))}),e.jsx("div",{className:"h-1.5 w-full bg-white/15 rounded-full overflow-hidden",children:e.jsx("div",{className:"h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all duration-500 ease-out",style:{width:`${(u+1)/5*100}%`}})})]})]})]}),j=[{id:"itemDetails",label:"Item Details"},{id:"hsnCode",label:"HSN"},{id:"gstRate",label:"GST %"},{id:"pricingMode",label:"Pricing Mode"},{id:"basePrice",label:"Base"},{id:"mrp",label:"MRP"},{id:"quantity",label:"Qty"},{id:"costPrice",label:"Cost"},{id:"sellingPrice",label:"Price"},{id:"action",label:"Action"}],X=({userId:d})=>{const[u,g]=o.useState(""),[l,r]=o.useState([]),[c,x]=o.useState(!1),[C,b]=o.useState(!1),[k,f]=o.useState(0),[S,y]=o.useState(!1),[w,v]=o.useState(new Set),[m,h]=o.useState(!1),P=U(E),N=j.filter(t=>!w.has(t.id));o.useEffect(()=>{if(c)b(!0);else{const t=setTimeout(()=>b(!1),500);return()=>clearTimeout(t)}},[c]),o.useEffect(()=>{if(!c)return;f(0);const t=setInterval(()=>{f(n=>(n+1)%5)},900);return()=>clearInterval(t)},[c]);const I="https://us-central1-stockpilotv1.cloudfunctions.net/generateInventoryByBrand",A=t=>{let n=t?.inventory||t?.items||t?.result?.inventory||t?.result?.items||[];return Array.isArray(n)||(n=[]),n.filter(a=>(a?.productName||a?.name)&&(a?.sku||a?.SKU)).map(a=>({productName:a.productName||a.name||"",brand:a.brand||"",category:a.category||"General",sku:a.sku||a.SKU||"",unit:a.unit||a.Unit||"",quantity:a.quantity??"",costPrice:a.costPrice??"",sellingPrice:a.price??a.mrp??a.sellingPrice??"",imageUrl:a.imageUrl||"",hsnCode:a.hsnCode||a.hsn||a.HSN||"",gstRate:a.gstRate??a.gst??a.GST??"",pricingMode:a.pricingMode||a.PricingMode||"MRP_INCLUSIVE",basePrice:a.basePrice??"",mrp:a.mrp??"",source:a.source||"ai"}))},D=async t=>{const n=await fetch(I,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});let a;try{a=await n.json()}catch{a=null}if(!n.ok){const s=a?.error||`Request failed with ${n.status}`;throw new Error(s)}return a},M=async t=>{const n=t?.prompt;if(!n||n.trim().length===0){p.error("Prompt cannot be empty.");return}x(!0),r([]);try{const a=await D(t),s=A(a);r(s),s.length===0&&p.info("AI couldn't generate items. Try rephrasing your prompt.")}catch(a){console.error("Prompt-based inventory error:",a),p.error(`Failed to fetch inventory: ${a.message}`)}finally{x(!1)}},L=async()=>{if(!d||l.length===0){p.error("There is no inventory to upload.");return}const t=p.loading("Adding items to inventory...");try{for(const n of l){const a=await $(B(P,"businesses",d,"products"),{...n,source:"ai",createdAt:_()});await F({productId:a.id,sku:n.sku,previousData:{},updatedData:n,action:"created",source:"ai"})}p.update(t,{render:"Inventory added successfully!",type:"success",isLoading:!1,autoClose:5e3}),y(!0),setTimeout(()=>y(!1),2e3),r([])}catch(n){console.error("Upload Error:",n),p.update(t,{render:"Failed to add inventory.",type:"error",isLoading:!1,autoClose:5e3})}},i=(t,n,a)=>{const s=[...l];s[t][n]=a,r(s)},T=t=>{r(n=>n.filter((a,s)=>s!==t))},R=[0,5,12,18,28],z=["MRP_INCLUSIVE","BASE_PLUS_GST"];return e.jsxs("div",{className:"relative p-4 sm:p-6 max-w-7xl mx-auto text-white rounded-3xl shadow-2xl overflow-hidden clean-ai-bg isolate animate-fade-in-up",children:[C&&e.jsx(H,{message:"Crafting your inventory",step:k,className:c?"animate-fade-in":"animate-fade-out"}),e.jsxs("div",{className:`relative z-10 transition-opacity duration-300 ${c?"opacity-20 pointer-events-none":"opacity-100"}`,children:[e.jsxs("header",{className:"text-center mb-8",children:[e.jsxs("div",{className:"inline-flex items-center gap-3 px-4 py-2 bg-slate-900/50 border border-cyan-400/20 rounded-full shadow-lg shadow-cyan-500/10 mb-4",children:[e.jsx("span",{className:"ai-orb","aria-hidden":!0}),e.jsx("span",{className:"font-semibold text-cyan-300",children:"AI Generator Active"})]}),e.jsx("h1",{className:"text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400",children:"AI-Powered Inventory"})]}),e.jsx("div",{className:"mb-10 max-w-3xl mx-auto p-1 bg-gradient-to-br from-cyan-400/50 via-purple-500/50 to-pink-500/50 rounded-2xl shadow-lg shadow-cyan-700/20 transition-all duration-300 hover:shadow-cyan-500/40 hover:scale-[1.01] input-glow-container",children:e.jsx("div",{className:"p-6 bg-[#0e1e3e] rounded-xl",children:e.jsx(G,{onGenerate:M,isLoading:c})})}),l.length>0&&e.jsx("div",{className:"animate-fade-in-up",style:{animationDuration:"0.5s"},children:e.jsxs("div",{className:"overflow-x-auto p-4 sm:p-6 rounded-2xl bg-slate-900/50 border border-white/10 shadow-xl shadow-black/20 backdrop-blur-lg",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4 flex-wrap gap-2",children:[e.jsxs("span",{className:"text-white/80 text-sm",children:[e.jsx("span",{className:"font-semibold text-cyan-300",children:l.length})," items · Customize columns below"]}),e.jsxs("div",{className:"relative",children:[e.jsxs("button",{type:"button",onClick:()=>h(t=>!t),className:"inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 text-sm font-medium transition","aria-expanded":m,children:[e.jsx("span",{children:"⚙️"}),"Show / Hide Columns",e.jsx("span",{className:"text-white/60",children:m?"▲":"▼"})]}),m&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"fixed inset-0 z-10","aria-hidden":"true",onClick:()=>h(!1)}),e.jsxs("div",{className:"absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-slate-900 shadow-2xl z-20 overflow-hidden py-2",children:[e.jsx("div",{className:"px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/70 uppercase tracking-wider",children:"Toggle columns"}),j.map(t=>e.jsxs("label",{className:"flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer text-sm text-white/90",children:[e.jsx("input",{type:"checkbox",checked:!w.has(t.id),onChange:()=>{v(n=>{const a=new Set(n);return a.has(t.id)?a.delete(t.id):a.add(t.id),a})},className:"rounded border-white/30 text-cyan-400 focus:ring-cyan-400/50"}),t.label]},t.id)),e.jsx("button",{type:"button",onClick:()=>{v(new Set),h(!1)},className:"w-full px-3 py-2 text-left text-sm text-cyan-300 hover:bg-white/5 border-t border-white/10",children:"Show all columns"})]})]})]})]}),e.jsxs("table",{className:"min-w-full text-sm",children:[e.jsx("thead",{className:"sticky top-0 z-10",children:e.jsx("tr",{className:"border-b border-white/20 text-white/80 select-none",children:N.map(t=>e.jsx("th",{className:`px-3 py-3 ${t.id==="action"?"text-center":"text-left"} ${t.id==="itemDetails"?"w-[36%]":""}`,children:t.label},t.id))})}),e.jsx("tbody",{children:l.map((t,n)=>e.jsx("tr",{className:"align-top border-t border-white/10 transition-colors duration-300 hover:bg-cyan-500/10 animate-slide-in-up",style:{animationDelay:`${n*60}ms`},children:N.map(a=>a.id==="itemDetails"?e.jsx("td",{className:"px-3 py-3",children:e.jsxs("div",{className:"space-y-1.5",children:[e.jsx("input",{value:t.productName??"",onChange:s=>i(n,"productName",s.target.value),className:"editable-input font-semibold text-base text-white",placeholder:"Product name"}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx("input",{value:t.brand??"",onChange:s=>i(n,"brand",s.target.value),className:"editable-input",placeholder:"Brand"}),e.jsx("input",{value:t.category??"",onChange:s=>i(n,"category",s.target.value),className:"editable-input",placeholder:"Category"})]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx("input",{value:t.sku??"",onChange:s=>i(n,"sku",s.target.value),className:"editable-input",placeholder:"SKU"}),e.jsx("input",{value:t.unit??"",onChange:s=>i(n,"unit",s.target.value),className:"editable-input",placeholder:"Unit"})]})]})},a.id):a.id==="hsnCode"?e.jsx("td",{className:"px-2 py-3",children:e.jsx("input",{value:t.hsnCode??"",onChange:s=>i(n,"hsnCode",s.target.value),className:"editable-input w-20",placeholder:"HSN"})},a.id):a.id==="gstRate"?e.jsx("td",{className:"px-2 py-3",children:e.jsxs("select",{value:t.gstRate??"",onChange:s=>i(n,"gstRate",Number(s.target.value)),className:"editable-input w-20",children:[e.jsx("option",{value:"",className:"bg-slate-900",children:"—"}),R.map(s=>e.jsx("option",{value:s,className:"bg-slate-900",children:s},s))]})},a.id):a.id==="pricingMode"?e.jsx("td",{className:"px-2 py-3",children:e.jsxs("select",{value:t.pricingMode??"",onChange:s=>i(n,"pricingMode",s.target.value),className:"editable-input w-36",children:[e.jsx("option",{value:"",className:"bg-slate-900",children:"—"}),z.map(s=>e.jsx("option",{value:s,className:"bg-slate-900",children:s},s))]})},a.id):a.id==="basePrice"?e.jsx("td",{className:"px-2 py-3",children:e.jsx("input",{type:"number",value:t.basePrice??"",onChange:s=>i(n,"basePrice",s.target.value),className:"editable-input w-20",placeholder:"Base"})},a.id):a.id==="mrp"?e.jsx("td",{className:"px-2 py-3",children:e.jsx("input",{type:"number",value:t.mrp??"",onChange:s=>i(n,"mrp",s.target.value),className:"editable-input w-20",placeholder:"MRP"})},a.id):a.id==="quantity"?e.jsx("td",{className:"px-2 py-3",children:e.jsx("input",{type:"number",value:t.quantity??"",onChange:s=>i(n,"quantity",s.target.value),className:"editable-input w-20",placeholder:"Qty"})},a.id):a.id==="costPrice"?e.jsx("td",{className:"px-2 py-3",children:e.jsx("input",{type:"number",value:t.costPrice??"",onChange:s=>i(n,"costPrice",s.target.value),className:"editable-input w-20",placeholder:"Cost"})},a.id):a.id==="sellingPrice"?e.jsx("td",{className:"px-2 py-3",children:e.jsx("input",{type:"number",value:t.sellingPrice??"",onChange:s=>i(n,"sellingPrice",s.target.value),className:"editable-input w-20",placeholder:"Price"})},a.id):a.id==="action"?e.jsx("td",{className:"px-2 py-3 text-center",children:e.jsx("button",{className:"w-8 h-8 flex items-center justify-center text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 rounded-full transition-all duration-300",onClick:()=>T(n),"aria-label":"Remove item",children:e.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",className:"h-5 w-5",viewBox:"0 0 20 20",fill:"currentColor",children:e.jsx("path",{fillRule:"evenodd",d:"M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",clipRule:"evenodd"})})})},a.id):null)},t.sku+n))})]}),e.jsxs("div",{className:"mt-6 flex flex-col sm:flex-row gap-4 justify-center",children:[e.jsx("button",{onClick:L,className:"px-8 py-3 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-cyan-300 to-purple-400 button-glow-effect",children:"Add All to Inventory"}),e.jsx("button",{onClick:()=>r([]),className:"px-8 py-3 rounded-xl border border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white backdrop-blur-md transition-all duration-300",children:"Clear List"})]})]})})]}),S&&e.jsx("div",{className:"pointer-events-none fixed inset-0 z-[60]",children:Array.from({length:40}).map((t,n)=>{const a=Math.random()*8+4,s=150+Math.random()*60;return e.jsx("span",{className:"absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-confetti-burst",style:{width:a,height:a,background:`hsl(${s}, 90%, 65%)`,"--angle":`${Math.random()*360}deg`,"--distance":`${Math.random()*150+50}px`,animationDuration:`${Math.random()*.5+.5}s`}},n)})}),e.jsx("style",{children:`
        /* Enhanced AI background */
        .clean-ai-bg {
          background-color: #0b1220;
          background-image:
            radial-gradient(ellipse 50% 40% at 20% 0%, rgba(16,185,129,0.12), transparent),
            radial-gradient(ellipse 50% 40% at 80% 100%, rgba(59,130,246,0.12), transparent);
        }

        /* Animated grid pattern for loader */
        .ai-grid-pattern {
            background-image: 
                linear-gradient(rgba(20, 83, 45, 0.2) 1px, transparent 1px), 
                linear-gradient(90deg, rgba(20, 83, 45, 0.2) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: pan-grid 20s linear infinite;
        }

        /* Magical header orb */
        .ai-orb {
            width:12px; height:12px; border-radius:9999px; display:inline-block;
            background: radial-gradient(circle at 30% 30%, #fff 0 25%, #67e8f9 45%, #22d3ee 70%, transparent 72%);
            box-shadow: 0 0 10px #22d3ee, 0 0 20px rgba(103,232,249,.35);
            animation: orb-breath 2.8s ease-in-out infinite;
        }

        /* Table Input Styling */
        .editable-input {
            width: 100%;
            background-color: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            padding: 6px 8px;
            color: #E2E8F0; /* slate-200 */
            transition: all 0.2s ease-in-out;
            outline: none;
        }
        .editable-input:focus {
            background-color: rgba(255,255,255,0.1);
            border-color: #22d3ee; /* cyan-400 */
            box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.3);
        }
        select.editable-input {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E');
            background-repeat: no-repeat;
            background-position: right 0.7em top 50%;
            background-size: 0.65em auto;
        }

        /* Premium button glow effect */
        .button-glow-effect {
            position: relative;
            transition: all 0.3s ease;
            overflow: hidden;
        }
        .button-glow-effect::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 150%;
            padding-top: 150%;
            background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
            border-radius: 50%;
            opacity: 0;
            transition: all 0.5s ease;
        }
        .button-glow-effect:hover::before {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
        }
        .button-glow-effect:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }

        /* --- KEYFRAME ANIMATIONS --- */
        @keyframes pan-grid {
            0% { background-position: 0% 0%; }
            100% { background-position: 50px 50px; }
        }
        @keyframes pulse-orb {
            0%, 100% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 2s linear infinite; }
        
        @keyframes orb-breath { 
            0%,100% { filter:saturate(120%) brightness(1); transform: scale(1); } 
            50% { filter:saturate(160%) brightness(1.2); transform: scale(1.05); } 
        }

        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        
        @keyframes fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
        .animate-fade-out { animation: fade-out 0.5s ease-in forwards; }

        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }

        @keyframes slide-in-up {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in-up {
            opacity: 0;
            animation: slide-in-up 0.4s ease-out forwards;
        }

        /* Confetti Burst Animation */
        @keyframes confetti-burst {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            80% { transform: translate(calc(-50% + cos(var(--angle)) * var(--distance)), calc(-50% + sin(var(--angle)) * var(--distance))) scale(1); opacity: 1; }
            100% { opacity: 0; }
        }
        .animate-confetti-burst {
          animation-name: confetti-burst;
          animation-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
          animation-fill-mode: forwards;
        }
      `})]})};export{X as default};
