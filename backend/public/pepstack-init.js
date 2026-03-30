
// (function () {
//   'use strict';

//   if (!window.PepStackConfig) {
//     console.error('[PepStack] PepStackConfig not found.');
//     return;
//   }

//   const config      = window.PepStackConfig;
//   const API_URL     = config.apiUrl || 'https://chat-support-pro.onrender.com';
//   const PEPSCAN_URL = config.pepScanUrl || 'https://peptiscan-app.vercel.app/';

//   const style = document.createElement('style');
//   style.textContent = `
//   #psk-btn {
//     position:fixed; bottom:82px; left:20px; z-index:99990;
//     background:#fff; color:#111827; border:1.5px solid #e5e7eb; border-radius:24px;
//     padding:10px 18px 10px 14px; font-size:13px; font-weight:600; cursor:pointer;
//     display:flex; align-items:center; gap:8px; white-space:nowrap;
//     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
//     box-shadow:0 2px 14px rgba(0,0,0,.10),0 1px 3px rgba(0,0,0,.06);
//     transition:box-shadow .18s,transform .12s,border-color .18s,opacity .2s;
//   }
//   #psk-btn:hover { box-shadow:0 6px 20px rgba(0,0,0,.13); border-color:#3bbe28; transform:translateY(-2px); }
//   #psk-btn:active { transform:translateY(0); }
//   #psk-btn .psk-dot {
//     width:7px; height:7px; background:#3bbe28; border-radius:50%; flex-shrink:0;
//     animation:psk-pulse 2.2s ease-in-out infinite;
//   }
//   @keyframes psk-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.72)} }

//   #psk-overlay {
//     display:none; position:fixed; inset:0; background:rgba(17,24,39,.52);
//     z-index:99995; align-items:center; justify-content:center; backdrop-filter:blur(6px);
//   }
//   #psk-overlay.psk-open { display:flex; animation:psk-fadein .22s ease-out; }
//   @keyframes psk-fadein { from{opacity:0} to{opacity:1} }

//   #psk-modal {
//     background:#fff; border-radius:24px; width:96%; max-width:520px; max-height:92vh;
//     overflow-y:auto; padding:36px 32px 30px; position:relative;
//     animation:psk-slideup .3s cubic-bezier(.22,1,.36,1);
//     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111827;
//     box-shadow:0 24px 64px rgba(0,0,0,.16),0 4px 16px rgba(0,0,0,.08);
//     scrollbar-width:thin; scrollbar-color:#e5e7eb transparent;
//   }
//   @keyframes psk-slideup {
//     from{opacity:0;transform:translateY(20px) scale(.97)}
//     to{opacity:1;transform:translateY(0) scale(1)}
//   }

//   .psk-close {
//     position:absolute; top:16px; right:16px; background:#f3f4f6; border:none; border-radius:50%;
//     width:32px; height:32px; display:flex; align-items:center; justify-content:center;
//     cursor:pointer; color:#6b7280; font-size:15px; transition:background .14s,color .14s;
//   }
//   .psk-close:hover { background:#e5e7eb; color:#111827; }

//   .psk-logo-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
//   .psk-logo-icon {
//     width:36px; height:36px; background:linear-gradient(135deg,#f0fdf4,#dcfce7);
//     border:1.5px solid #bbf7d0; border-radius:10px;
//     display:flex; align-items:center; justify-content:center; font-size:18px;
//   }
//   .psk-logo-text { font-size:14px; font-weight:800; color:#111827; letter-spacing:-.2px; }
//   .psk-logo-sub  { font-size:10px; font-weight:500; color:#6b7280; letter-spacing:.3px; text-transform:uppercase; }

//   .psk-heading { font-size:22px; font-weight:800; color:#111827; margin:0 0 6px; line-height:1.2; letter-spacing:-.3px; }
//   .psk-sub { font-size:13.5px; color:#6b7280; margin:0 0 24px; line-height:1.55; }

//   .psk-divider-label {
//     font-size:10.5px; font-weight:700; letter-spacing:.7px; text-transform:uppercase;
//     color:#9ca3af; margin:20px 0 12px; display:flex; align-items:center; gap:8px;
//   }
//   .psk-divider-label::after { content:''; flex:1; height:1px; background:#f3f4f6; }

//   .psk-field { margin-bottom:13px; }
//   .psk-field label {
//     display:block; font-size:11px; font-weight:700;
//     letter-spacing:.6px; text-transform:uppercase; color:#9ca3af; margin-bottom:5px;
//   }
//   .psk-field input, .psk-field select, .psk-field textarea {
//     width:100%; background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:10px;
//     padding:11px 14px; font-size:14px; color:#111827; outline:none; box-sizing:border-box;
//     font-family:inherit; transition:border-color .15s,box-shadow .15s,background .15s;
//     -webkit-appearance:none; appearance:none;
//   }
//   .psk-field input::placeholder, .psk-field textarea::placeholder { color:#d1d5db; }
//   .psk-field input:focus, .psk-field select:focus, .psk-field textarea:focus {
//     border-color:#3bbe28; box-shadow:0 0 0 3px rgba(59,190,40,.12); background:#fff;
//   }
//   .psk-field select {
//     background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E");
//     background-repeat:no-repeat; background-position:right 14px center;
//     padding-right:36px; cursor:pointer;
//   }
//   .psk-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }

//   /* Goal chips */
//   .psk-chips { display:flex; flex-wrap:wrap; gap:7px; }
//   .psk-chip {
//     background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:99px;
//     padding:7px 14px; font-size:12.5px; font-weight:500; color:#374151;
//     cursor:pointer; transition:all .14s; user-select:none;
//   }
//   .psk-chip:hover { border-color:#3bbe28; color:#166534; background:#f0fdf4; }
//   .psk-chip.psk-sel { background:#f0fdf4; border-color:#3bbe28; color:#166534; font-weight:700; box-shadow:0 0 0 3px rgba(59,190,40,.10); }

//   /* Condition chips */
//   .psk-chip.red:hover { border-color:#ef4444; color:#991b1b; background:#fef2f2; }
//   .psk-chip.red.psk-sel { background:#fef2f2; border-color:#ef4444; color:#991b1b; font-weight:700; box-shadow:0 0 0 3px rgba(239,68,68,.08); }

//   .psk-none-link {
//     display:inline-block; margin-top:8px; font-size:11.5px; color:#9ca3af;
//     cursor:pointer; user-select:none; text-decoration:underline; text-decoration-style:dashed;
//   }
//   .psk-none-link:hover { color:#3bbe28; }

//   /* Custom goal */
//   .psk-custom-wrap { margin-top:12px; padding-top:12px; border-top:1.5px dashed #e5e7eb; }
//   .psk-custom-toggle {
//     display:flex; align-items:center; gap:6px; cursor:pointer;
//     font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase;
//     color:#9ca3af; user-select:none;
//   }
//   .psk-custom-toggle span { font-size:10px; transition:transform .2s; display:inline-block; }
//   .psk-custom-toggle span.open { transform:rotate(180deg); }
//   .psk-custom-body { display:none; margin-top:10px; }
//   .psk-custom-body.show { display:block; }
//   .psk-custom-body textarea { width:100%; box-sizing:border-box; }
//   .psk-custom-badge {
//     display:none; margin-top:6px; font-size:11px; color:#166534; font-weight:600;
//     background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px;
//     padding:3px 8px; width:fit-content;
//   }
//   .psk-custom-badge.show { display:inline-flex; align-items:center; gap:4px; }

//   .psk-btn-primary {
//     width:100%; background:#3bbe28; border:none; border-radius:12px;
//     padding:14px; font-size:15px; font-weight:700; color:#fff; cursor:pointer;
//     transition:background .16s,transform .1s,box-shadow .16s;
//     margin-top:22px; font-family:inherit; box-shadow:0 4px 14px rgba(59,190,40,.30);
//   }
//   .psk-btn-primary:hover:not(:disabled) { background:#33a822; transform:translateY(-1px); box-shadow:0 6px 20px rgba(59,190,40,.38); }
//   .psk-btn-primary:active:not(:disabled) { transform:translateY(0); }
//   .psk-btn-primary:disabled { opacity:.4; cursor:not-allowed; box-shadow:none; }

//   .psk-or {
//     display:flex; align-items:center; gap:12px;
//     margin:16px 0 13px; color:#d1d5db; font-size:12px; font-weight:500;
//   }
//   .psk-or::before,.psk-or::after { content:''; flex:1; height:1px; background:#f3f4f6; }

//   .psk-btn-scan {
//     width:100%; background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:12px;
//     padding:12px 14px; font-size:13px; font-weight:600; color:#374151; cursor:pointer;
//     transition:border-color .14s,color .14s,background .14s;
//     display:flex; align-items:center; justify-content:center;
//     gap:8px; font-family:inherit; text-decoration:none;
//   }
//   .psk-btn-scan:hover { border-color:#3bbe28; color:#166534; background:#f0fdf4; }

//   /* Loader */
//   .psk-loader { display:none; flex-direction:column; align-items:center; padding:48px 0 36px; gap:14px; }
//   .psk-loader.show { display:flex; }
//   .psk-spinner { width:38px; height:38px; border:3px solid #f3f4f6; border-top-color:#3bbe28; border-radius:50%; animation:psk-spin .72s linear infinite; }
//   @keyframes psk-spin { to{transform:rotate(360deg)} }
//   .psk-loader-txt { font-size:13px; color:#9ca3af; font-weight:500; }

//   /* Results */
//   #psk-results { display:none; }
//   #psk-results.show { display:block; }
//   .psk-result-intro { background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:12px; padding:15px 17px; font-size:13.5px; line-height:1.7; color:#166534; margin-bottom:18px; }
//   .psk-stack-label { font-size:10.5px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; color:#9ca3af; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
//   .psk-stack-label::after { content:''; flex:1; height:1px; background:#f3f4f6; }
//   .psk-stack-cards { display:flex; flex-direction:column; gap:10px; margin-bottom:18px; }
//   .psk-card { background:#fff; border:1.5px solid #f3f4f6; border-radius:14px; padding:15px 17px; display:flex; align-items:flex-start; gap:13px; transition:border-color .15s,box-shadow .15s; box-shadow:0 1px 3px rgba(0,0,0,.04); }
//   .psk-card:hover { border-color:#bbf7d0; box-shadow:0 4px 12px rgba(59,190,40,.08); }
//   .psk-card-num { width:27px; height:27px; background:#3bbe28; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:#fff; flex-shrink:0; margin-top:1px; box-shadow:0 2px 6px rgba(59,190,40,.28); }
//   .psk-card-body { flex:1; min-width:0; }
//   .psk-card-name { font-size:14px; font-weight:800; color:#111827; margin:0 0 4px; }
//   .psk-card-why  { font-size:12.5px; color:#4b5563; line-height:1.6; margin:0 0 6px; }
//   .psk-card-dose { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#6b7280; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:3px 8px; }
//   .psk-tip { background:#fffbeb; border:1.5px solid #fde68a; border-radius:12px; padding:13px 16px; font-size:12.5px; line-height:1.65; color:#78350f; margin-bottom:16px; display:flex; gap:9px; align-items:flex-start; }
//   .psk-tip strong { color:#92400e; font-weight:700; }
//   .psk-warning { background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; padding:12px 15px; font-size:12.5px; line-height:1.6; color:#991b1b; margin-bottom:12px; display:flex; gap:9px; align-items:flex-start; }
//   .psk-disclaimer { font-size:11px; color:#9ca3af; line-height:1.6; padding-top:13px; border-top:1px solid #f3f4f6; margin-bottom:13px; }
//   .psk-btn-reset { background:transparent; border:1.5px solid #e5e7eb; border-radius:9px; padding:8px 16px; font-size:12px; color:#6b7280; cursor:pointer; font-family:inherit; transition:border-color .14s,color .14s; display:inline-flex; align-items:center; gap:5px; }
//   .psk-btn-reset:hover { border-color:#3bbe28; color:#166534; }

//   .psk-error { display:none; background:#fef2f2; border:1.5px solid #fecaca; border-radius:10px; padding:12px 15px; font-size:13px; color:#dc2626; margin-top:12px; line-height:1.5; }
//   .psk-error.show { display:block; }

//   .psk-steps { display:flex; gap:5px; margin-bottom:26px; }
//   .psk-step-pill { height:3px; flex:1; border-radius:99px; background:#f3f4f6; transition:background .35s; }
//   .psk-step-pill.active { background:#3bbe28; }

//   /* ── Scan modal ── */
//   #psk-scan-overlay {
//     display:none; position:fixed; inset:0; background:rgba(17,24,39,.62);
//     z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(8px);
//   }
//   #psk-scan-overlay.open { display:flex; animation:psk-fadein .22s ease-out; }
//   #psk-scan-modal {
//     background:#fff; border-radius:22px; width:96%; max-width:900px;
//     height:90vh; max-height:860px; position:relative; overflow:hidden;
//     box-shadow:0 28px 72px rgba(0,0,0,.22),0 4px 16px rgba(0,0,0,.10);
//     animation:psk-slideup .3s cubic-bezier(.22,1,.36,1);
//     display:flex; flex-direction:column;
//   }
//   #psk-scan-header {
//     display:flex; align-items:center; gap:10px; padding:14px 18px 14px 20px;
//     border-bottom:1.5px solid #f3f4f6; flex-shrink:0; background:#fff; border-radius:22px 22px 0 0;
//   }
//   #psk-scan-header .psk-logo-icon { width:32px; height:32px; font-size:16px; flex-shrink:0; }
//   #psk-scan-header-title { flex:1; }
//   #psk-scan-header-title strong { font-size:13.5px; font-weight:800; color:#111827; display:block; letter-spacing:-.1px; }
//   #psk-scan-header-title span { font-size:11px; color:#9ca3af; font-weight:500; }
//   #psk-scan-close {
//     background:#f3f4f6; border:none; border-radius:50%;
//     width:32px; height:32px; display:flex; align-items:center; justify-content:center;
//     cursor:pointer; color:#6b7280; font-size:15px; transition:background .14s,color .14s; flex-shrink:0;
//   }
//   #psk-scan-close:hover { background:#e5e7eb; color:#111827; }
//   #psk-scan-iframe-wrap { flex:1; position:relative; overflow:hidden; }
//   #psk-scan-iframe { width:100%; height:100%; border:none; display:block; }
//   #psk-scan-loading {
//     position:absolute; inset:0; background:#fff;
//     display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;
//     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; transition:opacity .3s;
//   }
//   #psk-scan-loading.hidden { opacity:0; pointer-events:none; }
//   #psk-scan-loading .psk-spinner { width:36px; height:36px; }
//   #psk-scan-loading p { font-size:13px; color:#9ca3af; font-weight:500; margin:0; }

//   /* ── Mobile ── */
//   @media (max-width:540px) {
//     /* Floating button — keep it compact */
//     #psk-btn {
//       font-size:12px; padding:9px 13px 9px 11px;
//       bottom:74px; left:12px;
//     }

//     /* Main modal — bottom sheet */
//     #psk-overlay { align-items:flex-end; }
//     #psk-modal {
//       width:100%; max-width:100%; max-height:92vh;
//       border-radius:20px 20px 0 0;
//       padding:20px 18px 32px;
//       animation:psk-sheet-up .32s cubic-bezier(.22,1,.36,1);
//     }
//     @keyframes psk-sheet-up {
//       from { transform:translateY(100%); opacity:.6; }
//       to   { transform:translateY(0);    opacity:1; }
//     }

//     /* Pull handle */
//     #psk-modal::before {
//       content:''; display:block; width:36px; height:4px;
//       background:#e5e7eb; border-radius:99px;
//       margin:0 auto 16px; flex-shrink:0;
//     }

//     .psk-close { top:14px; right:14px; }
//     .psk-heading { font-size:19px; }
//     .psk-sub { font-size:13px; margin-bottom:18px; }

//     /* Stack 2-col rows */
//     .psk-row { grid-template-columns:1fr; gap:0; }

//     /* Bigger tap targets on chips */
//     .psk-chip { padding:8px 14px; font-size:12.5px; }

//     /* Inputs / selects — larger tap area */
//     .psk-field input,
//     .psk-field select,
//     .psk-field textarea { padding:13px 14px; font-size:15px; }

//     .psk-btn-primary { padding:15px; font-size:15px; }
//     .psk-btn-scan    { padding:14px; font-size:13px; }

//     /* Divider labels smaller */
//     .psk-divider-label { font-size:10px; margin:16px 0 10px; }

//     /* Scan modal — true full screen on mobile */
//     #psk-scan-overlay {
//       align-items:stretch;
//       justify-content:stretch;
//       padding:0;
//     }
//     #psk-scan-modal {
//       width:100%;
//       max-width:100%;
//       height:100%;
//       max-height:100%;
//       border-radius:0;
//       animation:psk-sheet-up .28s cubic-bezier(.22,1,.36,1);
//     }
//     #psk-scan-header {
//       padding:14px 16px;
//       /* Extra top padding for iPhone notch / status bar */
//       padding-top:max(14px, env(safe-area-inset-top));
//     }
//     #psk-scan-header-title strong { font-size:13px; }
//     #psk-scan-iframe-wrap { height:0; flex:1; }
//   }

//   /* Very small screens */
//   @media (max-width:360px) {
//     #psk-modal { padding:18px 14px 28px; }
//     .psk-heading { font-size:17px; }
//     .psk-chip { padding:7px 11px; font-size:12px; }
//   }
//   `;
//   document.head.appendChild(style);

//   const container = document.createElement('div');
//   container.id = 'pepstack-widget';
//   container.innerHTML = `
//     <button id="psk-btn" aria-label="Get PepStack recommendations">
//       <span class="psk-dot"></span>PepStack Recs
//     </button>

//     <div id="psk-overlay" role="dialog" aria-modal="true" aria-labelledby="psk-title">
//       <div id="psk-modal">
//         <button class="psk-close" id="psk-close">&#215;</button>

//         <div class="psk-steps">
//           <div class="psk-step-pill active" id="psk-pill-1"></div>
//           <div class="psk-step-pill" id="psk-pill-2"></div>
//         </div>

//         <div class="psk-logo-row">
//           <div class="psk-logo-icon">&#129516;</div>
//           <div>
//             <div class="psk-logo-text">PepStack</div>
//             <div class="psk-logo-sub">AI Protocol Builder</div>
//           </div>
//         </div>

//         <div id="psk-step1">
//           <h2 class="psk-heading" id="psk-title">Build your peptide stack</h2>
//           <p class="psk-sub">A few quick details so we can recommend the right protocol for you.</p>

//           <!-- Basic Info -->
//           <div class="psk-row">
//             <div class="psk-field">
//               <label>Age *</label>
//               <input type="number" id="psk-age" placeholder="e.g. 34" min="18" max="99">
//             </div>
//             <div class="psk-field">
//               <label>Biological Sex *</label>
//               <select id="psk-sex">
//                 <option value="">Select</option>
//                 <option value="male">Male</option>
//                 <option value="female">Female</option>
//               </select>
//             </div>
//           </div>

//           <div class="psk-row">
//             <div class="psk-field">
//               <label>Weight *</label>
//               <input type="text" id="psk-weight" placeholder="185lbs or 84kg">
//             </div>
//             <div class="psk-field">
//               <label>Height *</label>
//               <input type="text" id="psk-height" placeholder="5'10 or 178cm">
//             </div>
//           </div>

//           <!-- Goal -->
//           <div class="psk-divider-label">Primary Goal *</div>
//           <div class="psk-chips" id="psk-chips">
//             <div class="psk-chip" data-goal="Fat Loss">Fat Loss</div>
//             <div class="psk-chip" data-goal="Muscle Building">Muscle Building</div>
//             <div class="psk-chip" data-goal="Recovery &amp; Healing">Recovery &amp; Healing</div>
//             <div class="psk-chip" data-goal="Anti-Aging">Anti-Aging</div>
//             <div class="psk-chip" data-goal="Cognitive Enhancement">Cognitive Enhancement</div>
//             <div class="psk-chip" data-goal="Sleep Quality">Sleep Quality</div>
//             <div class="psk-chip" data-goal="Hormonal Support">Hormonal Support</div>
//             <div class="psk-chip" data-goal="Injury Repair">Injury Repair</div>
//             <div class="psk-chip" data-goal="Libido &amp; Sexual Health">Libido &amp; Sexual Health</div>
//             <div class="psk-chip" data-goal="Gut Health">Gut Health</div>
//             <div class="psk-chip" data-goal="Immune Support">Immune Support</div>
//             <div class="psk-chip" data-goal="Longevity">Longevity</div>
//             <div class="psk-chip" data-goal="General Wellness">General Wellness</div>
//           </div>
//           <div class="psk-custom-wrap">
//             <div class="psk-custom-toggle" id="psk-custom-toggle">
//               Don't see your goal? Describe it <span id="psk-custom-chevron">&#9660;</span>
//             </div>
//             <div class="psk-custom-body" id="psk-custom-body">
//               <textarea id="psk-custom-goal" placeholder="e.g. Reduce inflammation and improve gut health after surgery…" maxlength="300" style="min-height:64px;resize:vertical;margin-top:0"></textarea>
//               <div class="psk-custom-badge" id="psk-custom-badge">&#10003; Custom goal active</div>
//             </div>
//           </div>

//           <!-- Health & Safety -->
//           <div class="psk-divider-label">Health &amp; Safety</div>

//           <div class="psk-field">
//             <label>Medical Conditions</label>
//             <div class="psk-chips" id="psk-conditions">
//               <div class="psk-chip red" data-val="Diabetes">Diabetes</div>
//               <div class="psk-chip red" data-val="Hypertension">Hypertension</div>
//               <div class="psk-chip red" data-val="Heart Disease">Heart Disease</div>
//               <div class="psk-chip red" data-val="Cancer (active or history)">Cancer</div>
//               <div class="psk-chip red" data-val="Thyroid Disorder">Thyroid Disorder</div>
//               <div class="psk-chip red" data-val="Autoimmune Disease">Autoimmune</div>
//               <div class="psk-chip red" data-val="Kidney / Liver Disease">Kidney / Liver</div>
//               <div class="psk-chip red" data-val="PCOS">PCOS</div>
//               <div class="psk-chip red" data-val="Low Testosterone">Low Testosterone</div>
//               <div class="psk-chip red" data-val="Insulin Resistance">Insulin Resistance</div>
//               <div class="psk-chip red" data-val="Depression / Anxiety">Depression / Anxiety</div>
//               <div class="psk-chip red" data-val="Sleep Apnea">Sleep Apnea</div>
//               <div class="psk-chip red" data-val="Chronic Inflammation">Chronic Inflammation</div>
//               <div class="psk-chip red" data-val="Blood Clotting Disorder">Clotting Disorder</div>
//             </div>
//             <span class="psk-none-link" id="psk-cond-none">&#10003; None of the above</span>
//           </div>

//           <div class="psk-field">
//             <label>Current Medications / Hormones</label>
//             <input type="text" id="psk-meds" placeholder="e.g. TRT, Metformin, SSRIs, blood thinners, none">
//           </div>

//           <div class="psk-field">
//             <label>Allergies</label>
//             <input type="text" id="psk-allergies" placeholder="e.g. Penicillin, soy, none">
//           </div>

//           <!-- Experience -->
//           <div class="psk-divider-label">Experience</div>

//           <div class="psk-row">
//             <div class="psk-field">
//               <label>Peptide Experience</label>
//               <select id="psk-experience">
//                 <option value="">Select</option>
//                 <option value="never">First time</option>
//                 <option value="beginner">Beginner (1–2 tried)</option>
//                 <option value="intermediate">Intermediate</option>
//                 <option value="experienced">Experienced</option>
//               </select>
//             </div>
//             <div class="psk-field">
//               <label>Admin Preference</label>
//               <select id="psk-admin">
//                 <option value="">Select</option>
//                 <option value="injectable">Injections OK</option>
//                 <option value="no_inject">No injections</option>
//                 <option value="oral">Oral / sublingual only</option>
//                 <option value="nasal">Nasal spray only</option>
//               </select>
//             </div>
//           </div>

//           <button class="psk-btn-primary" id="psk-submit" disabled>
//             Get My Stack Recommendations &#8594;
//           </button>

//           <div class="psk-or">or</div>
//           <button class="psk-btn-scan" id="psk-scan-btn" type="button">
//             &#128247; &nbsp;Scan my face for AI recommendations
//           </button>
//         </div>

//         <!-- Loader -->
//         <div class="psk-loader" id="psk-loader">
//           <div class="psk-spinner"></div>
//           <span class="psk-loader-txt">Building your protocol&hellip;</span>
//         </div>

//         <div class="psk-error" id="psk-error"></div>

//         <!-- Results -->
//         <div id="psk-results">
//           <div id="psk-results-inner"></div>
//           <p class="psk-disclaimer">For research purposes only. Not medical advice. Consult a qualified healthcare provider before starting any peptide protocol.</p>
//           <button class="psk-btn-reset" id="psk-reset">&#8592; Start over</button>
//         </div>

//       </div>
//     </div>

//     <!-- Scan face modal -->
//     <div id="psk-scan-overlay">
//       <div id="psk-scan-modal">
//         <div id="psk-scan-header">
//           <div class="psk-logo-icon">&#128247;</div>
//           <div id="psk-scan-header-title">
//             <strong>PepScan — Face Analysis</strong>
//             <span>AI recommendations based on your facial biomarkers</span>
//           </div>
//           <button id="psk-scan-close">&#215;</button>
//         </div>
//         <div id="psk-scan-iframe-wrap">
//           <div id="psk-scan-loading">
//             <div class="psk-spinner"></div>
//             <p>Loading PepScan&hellip;</p>
//           </div>
//           <iframe id="psk-scan-iframe" title="PepScan Face Analysis" allow="camera"></iframe>
//         </div>
//       </div>
//     </div>
//   `;
//   document.body.appendChild(container);

//   /* ── refs ── */
//   const btn            = document.getElementById('psk-btn');
//   const overlay        = document.getElementById('psk-overlay');
//   const closeBtn       = document.getElementById('psk-close');
//   const step1          = document.getElementById('psk-step1');
//   const loader         = document.getElementById('psk-loader');
//   const results        = document.getElementById('psk-results');
//   const inner          = document.getElementById('psk-results-inner');
//   const errorEl        = document.getElementById('psk-error');
//   const submitBtn      = document.getElementById('psk-submit');
//   const resetBtn       = document.getElementById('psk-reset');
//   const pill2          = document.getElementById('psk-pill-2');
//   const ageEl          = document.getElementById('psk-age');
//   const sexEl          = document.getElementById('psk-sex');
//   const weightEl       = document.getElementById('psk-weight');
//   const heightEl       = document.getElementById('psk-height');
//   const medsEl         = document.getElementById('psk-meds');
//   const allergiesEl    = document.getElementById('psk-allergies');
//   const experienceEl   = document.getElementById('psk-experience');
//   const adminEl        = document.getElementById('psk-admin');
//   const chips          = document.querySelectorAll('#psk-chips .psk-chip');
//   const condChips      = document.querySelectorAll('#psk-conditions .psk-chip');
//   const condNoneBtn    = document.getElementById('psk-cond-none');
//   const customToggle   = document.getElementById('psk-custom-toggle');
//   const customBody     = document.getElementById('psk-custom-body');
//   const customChevron  = document.getElementById('psk-custom-chevron');
//   const customGoalEl   = document.getElementById('psk-custom-goal');
//   const customBadge    = document.getElementById('psk-custom-badge');

//   let selectedGoal       = null;
//   let selectedConditions = [];
//   let condNone           = false;

//   /* ── scan modal ── */
//   const scanBtn      = document.getElementById('psk-scan-btn');
//   const scanOverlay  = document.getElementById('psk-scan-overlay');
//   const scanClose    = document.getElementById('psk-scan-close');
//   const scanIframe   = document.getElementById('psk-scan-iframe');
//   const scanLoading  = document.getElementById('psk-scan-loading');

//   var scanBlocked = false; // set true if pepscan blocks iframe embedding

//   scanBtn.addEventListener('click', function (e) {
//     e.preventDefault();
//     e.stopPropagation();

//     // If we already know iframe is blocked, go straight to popup
//     if (scanBlocked) { openScanPopup(); return; }

//     scanOverlay.classList.add('open');
//     document.body.style.overflow = 'hidden';

//     if (!scanIframe.src || scanIframe.src === 'about:blank') {
//       scanLoading.classList.remove('hidden');
//       scanLoading.querySelector('p').textContent = 'Loading PepScan\u2026';

//       // Detect X-Frame-Options / CSP block via error event
//       scanIframe.onerror = function () {
//         handleIframeBlocked();
//       };

//       // Some browsers fire load even on blocked frames — check via postMessage or a timed fallback
//       var blockTimer = setTimeout(function () {
//         // If still loading after 6s and doc is inaccessible, assume blocked
//         try {
//           // Accessing contentDocument throws if cross-origin blocked
//           var doc = scanIframe.contentDocument || scanIframe.contentWindow.document;
//           if (!doc || doc.URL === 'about:blank') handleIframeBlocked();
//           else scanLoading.classList.add('hidden');
//         } catch (err) {
//           handleIframeBlocked();
//         }
//       }, 6000);

//       scanIframe.onload = function () {
//         clearTimeout(blockTimer);
//         try {
//           var doc = scanIframe.contentDocument || scanIframe.contentWindow.document;
//           // If the URL is still about:blank after load, it was blocked
//           if (!doc || doc.URL === 'about:blank' || doc.body === null) {
//             handleIframeBlocked();
//           } else {
//             scanLoading.classList.add('hidden');
//           }
//         } catch (err) {
//           // Cross-origin block — this is expected when site loads normally (CORS)
//           // If we get a SecurityError it actually loaded fine, just cross-origin
//           if (err.name === 'SecurityError') {
//             scanLoading.classList.add('hidden'); // loaded OK, just cross-origin
//           } else {
//             handleIframeBlocked();
//           }
//         }
//       };

//       scanIframe.src = PEPSCAN_URL;
//     }
//   });

//   function handleIframeBlocked() {
//     scanBlocked = true;
//     closeScanModal();
//     // Reset iframe so we don't retry the blocked URL
//     scanIframe.src = 'about:blank';
//     openScanPopup();
//   }

//   function openScanPopup() {
//     var isMobile = window.innerWidth <= 768;
//     var w, h, left, top;
//     if (isMobile) {
//       // Fill the whole screen on mobile
//       w    = window.screen.availWidth;
//       h    = window.screen.availHeight;
//       left = 0;
//       top  = 0;
//     } else {
//       w    = Math.min(900, window.screen.availWidth - 40);
//       h    = Math.min(820, window.screen.availHeight - 40);
//       left = Math.round((window.screen.availWidth  - w) / 2);
//       top  = Math.round((window.screen.availHeight - h) / 2);
//     }
//     var popup = window.open(
//       PEPSCAN_URL,
//       'pepscan',
//       'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
//       ',scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
//     );
//     if (!popup) {
//       window.location.href = PEPSCAN_URL;
//     } else {
//       popup.focus();
//     }
//   }

//   scanClose.addEventListener('click', closeScanModal);
//   scanOverlay.addEventListener('click', function (e) { if (e.target === scanOverlay) closeScanModal(); });
//   document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && scanOverlay.classList.contains('open')) closeScanModal(); });
//   function closeScanModal() {
//     scanOverlay.classList.remove('open');
//     var ci = document.getElementById('chat-widget-iframe');
//     if (!ci || !ci.classList.contains('open')) document.body.style.overflow = '';
//   }

//   /* ── modal ── */
//   btn.addEventListener('click', openModal);
//   closeBtn.addEventListener('click', closeModal);
//   overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
//   document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('psk-open')) closeModal(); });
//   function openModal()  { overlay.classList.add('psk-open'); document.body.style.overflow = 'hidden'; }
//   function closeModal() {
//     overlay.classList.remove('psk-open');
//     var ci = document.getElementById('chat-widget-iframe');
//     if (!ci || !ci.classList.contains('open')) document.body.style.overflow = '';
//   }

//   /* ── goal chips ── */
//   chips.forEach(function (c) {
//     c.addEventListener('click', function () {
//       chips.forEach(function (x) { x.classList.remove('psk-sel'); });
//       c.classList.add('psk-sel');
//       selectedGoal = c.dataset.goal;
//       customGoalEl.value = ''; customBadge.classList.remove('show');
//       checkReady();
//     });
//   });
//   customToggle.addEventListener('click', function () {
//     var open = customBody.classList.contains('show');
//     customBody.classList.toggle('show', !open);
//     customChevron.classList.toggle('open', !open);
//     if (!open) setTimeout(function () { customGoalEl.focus(); }, 50);
//   });
//   customGoalEl.addEventListener('input', function () {
//     var v = customGoalEl.value.trim();
//     if (v) { chips.forEach(function (x) { x.classList.remove('psk-sel'); }); selectedGoal = null; customBadge.classList.add('show'); }
//     else   { customBadge.classList.remove('show'); }
//     checkReady();
//   });

//   /* ── condition chips ── */
//   condChips.forEach(function (c) {
//     c.addEventListener('click', function () {
//       condNone = false; condNoneBtn.style.color = ''; condNoneBtn.textContent = '✓ None of the above';
//       c.classList.toggle('psk-sel');
//       selectedConditions = Array.from(condChips).filter(function (x) { return x.classList.contains('psk-sel'); }).map(function (x) { return x.dataset.val; });
//     });
//   });
//   condNoneBtn.addEventListener('click', function () {
//     condNone = !condNone;
//     condChips.forEach(function (x) { x.classList.remove('psk-sel'); });
//     selectedConditions = [];
//     condNoneBtn.textContent = condNone ? '✓ None of the above (selected)' : '✓ None of the above';
//     condNoneBtn.style.color = condNone ? '#166534' : '';
//   });

//   /* ── required field watch ── */
//   [ageEl, sexEl, weightEl, heightEl].forEach(function (el) {
//     el.addEventListener('input',  checkReady);
//     el.addEventListener('change', checkReady);
//   });

//   function getGoal() { return customGoalEl.value.trim() || selectedGoal || null; }
//   function checkReady() {
//     submitBtn.disabled = !(ageEl.value.trim() && sexEl.value && weightEl.value.trim() && heightEl.value.trim() && getGoal());
//   }

//   /* ── submit ── */
//   submitBtn.addEventListener('click', function () {
//     if (submitBtn.disabled) return;
//     showLoader();
//     fetch(API_URL + '/pepstack', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         age:              ageEl.value.trim(),
//         sex:              sexEl.value,
//         weight:           weightEl.value.trim(),
//         height:           heightEl.value.trim(),
//         goal:             getGoal(),
//         conditions:       selectedConditions,
//         conditions_none:  condNone,
//         medications:      medsEl.value.trim(),
//         allergies:        allergiesEl.value.trim(),
//         experience:       experienceEl.value,
//         admin_pref:       adminEl.value
//       })
//     })
//     .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
//     .then(function (data) { hideLoader(); renderResults(data); })
//     .catch(function (err) { hideLoader(); showError('Could not load recommendations. Please try again.'); console.error('[PepStack]', err); });
//   });

//   /* ── reset ── */
//   resetBtn.addEventListener('click', resetForm);
//   function resetForm() {
//     results.classList.remove('show'); inner.innerHTML = ''; errorEl.classList.remove('show');
//     chips.forEach(function (c) { c.classList.remove('psk-sel'); });
//     condChips.forEach(function (c) { c.classList.remove('psk-sel'); });
//     selectedGoal = null; selectedConditions = []; condNone = false;
//     condNoneBtn.textContent = '✓ None of the above'; condNoneBtn.style.color = '';
//     customGoalEl.value = ''; customBadge.classList.remove('show');
//     customBody.classList.remove('show'); customChevron.classList.remove('open');
//     ageEl.value = ''; sexEl.value = ''; weightEl.value = ''; heightEl.value = '';
//     medsEl.value = ''; allergiesEl.value = ''; experienceEl.value = ''; adminEl.value = '';
//     submitBtn.disabled = true; step1.style.display = '';
//     document.getElementById('psk-pill-1').classList.add('active');
//     pill2.classList.remove('active');
//   }

//   function showLoader() { step1.style.display = 'none'; loader.classList.add('show'); errorEl.classList.remove('show'); results.classList.remove('show'); pill2.classList.add('active'); }
//   function hideLoader() { loader.classList.remove('show'); }
//   function showError(msg) { step1.style.display = ''; pill2.classList.remove('active'); errorEl.textContent = msg; errorEl.classList.add('show'); }

//   /* ── render ── */
//   function renderResults(data) {
//     var html = '';
//     if (data.warnings && data.warnings.length) data.warnings.forEach(function (w) { html += '<div class="psk-warning">&#9888;&#65039; ' + esc(w) + '</div>'; });
//     if (data.summary) html += '<div class="psk-result-intro">' + esc(data.summary) + '</div>';
//     if (data.stack && data.stack.length) {
//       html += '<p class="psk-stack-label">Your recommended stack</p><div class="psk-stack-cards">';
//       data.stack.forEach(function (item, i) {
//         html += '<div class="psk-card"><div class="psk-card-num">' + (i + 1) + '</div><div class="psk-card-body">';
//         html += '<p class="psk-card-name">' + esc(item.name) + '</p>';
//         if (item.why)  html += '<p class="psk-card-why">'  + esc(item.why)  + '</p>';
//         if (item.dose) html += '<span class="psk-card-dose">&#128200; ' + esc(item.dose) + '</span>';
//         html += '</div></div>';
//       });
//       html += '</div>';
//     }
//     if (data.tip) html += '<div class="psk-tip">&#128161; <span><strong>Stack tip:</strong> ' + esc(data.tip) + '</span></div>';
//     inner.innerHTML = html;
//     results.classList.add('show');
//   }

//   function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

//   /* ── Hide PepStack btn when chat widget is open ── */
//   function syncBtnVisibility() {
//     var iframe = document.getElementById('chat-widget-iframe');
//     var chatBtn = document.getElementById('chat-widget-button');
//     var open = (iframe && iframe.classList.contains('open')) ||
//                (chatBtn && chatBtn.classList.contains('active'));
//     btn.style.opacity       = open ? '0' : '';
//     btn.style.pointerEvents = open ? 'none' : '';
//     btn.style.transform     = open ? 'translateY(8px)' : '';
//   }

//   // Watch class changes on the chat button (most reliable signal)
//   function attachChatObserver() {
//     var chatBtn = document.getElementById('chat-widget-button');
//     var chatIframe = document.getElementById('chat-widget-iframe');
//     if (!chatBtn && !chatIframe) return false;

//     var observer = new MutationObserver(syncBtnVisibility);
//     if (chatBtn)    observer.observe(chatBtn,    { attributes: true, attributeFilter: ['class'] });
//     if (chatIframe) observer.observe(chatIframe, { attributes: true, attributeFilter: ['class'] });
//     return true;
//   }

//   // Chat widget may not be in DOM yet — poll until found then attach
//   if (!attachChatObserver()) {
//     var pollTimer = setInterval(function () {
//       if (attachChatObserver()) {
//         clearInterval(pollTimer);
//         syncBtnVisibility();
//       }
//     }, 300);
//     // Give up after 15s
//     setTimeout(function () { clearInterval(pollTimer); }, 15000);
//   }

//   syncBtnVisibility();

//   console.log('✅ PepStack widget loaded');
// })();


(function () {
  'use strict';

  if (!window.PepStackConfig) {
    console.error('[PepStack] PepStackConfig not found.');
    return;
  }

  const config      = window.PepStackConfig;
  const API_URL     = config.apiUrl     || 'https://chat-support-pro.onrender.com';
  const PEPSCAN_URL = config.pepScanUrl || 'https://peptiscan-app.vercel.app/';

  /* ─────────────────────────────────────────────
     STYLES
  ───────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');

  #pepstack-widget * { box-sizing: border-box; margin: 0; padding: 0; }
  #pepstack-widget    { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

  @keyframes psk-pulse  { 0%,100%{box-shadow:0 0 0 3px rgba(59,190,40,.25)} 50%{box-shadow:0 0 0 7px rgba(59,190,40,.06)} }
  @keyframes psk-spin   { to{transform:rotate(360deg)} }
  @keyframes psk-fadein { from{opacity:0} to{opacity:1} }
  @keyframes psk-slideup{
    from{opacity:0;transform:translateY(28px) scale(.97)}
    to  {opacity:1;transform:translateY(0)    scale(1)}
  }
  @keyframes psk-sheet {
    from{transform:translateY(100%)}
    to  {transform:translateY(0)}
  }

  /* ── Floating trigger button ── */
  #psk-btn {
    position: fixed; bottom: 82px; left: 20px; z-index: 99990;
    background: #0a0a0a; color: #fff; border: none; border-radius: 100px;
    padding: 11px 20px 11px 14px; font-size: 13px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; gap: 9px;
    white-space: nowrap; font-family: inherit; letter-spacing: -.1px;
    box-shadow: 0 4px 24px rgba(59,190,40,.4), 0 2px 8px rgba(0,0,0,.3);
    transition: box-shadow .2s, transform .15s, opacity .2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  #psk-btn:hover  { box-shadow: 0 6px 32px rgba(59,190,40,.55), 0 2px 12px rgba(0,0,0,.3); transform: translateY(-2px); }
  #psk-btn:active { transform: scale(.96); }
  #psk-btn .psk-dot {
    width: 8px; height: 8px; background: #3bbe28; border-radius: 50%; flex-shrink: 0;
    animation: psk-pulse 2.4s ease-in-out infinite;
  }

  /* ── Backdrop ── */
  #psk-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,.6);
    z-index: 99995;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    align-items: center; justify-content: center;
  }
  #psk-overlay.psk-open { display: flex; animation: psk-fadein .22s ease-out; }

  /* ════════════════════════════════════════════
     MODAL — flex column, header + scroll + footer
  ════════════════════════════════════════════ */
  #psk-modal {
    background: #fff;
    border-radius: 24px;
    width: 96%;
    max-width: 500px;
    max-height: min(88vh, 88dvh);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    font-family: inherit;
    color: #111827;
    box-shadow: 0 32px 80px rgba(0,0,0,.24), 0 0 0 1px rgba(0,0,0,.06);
    animation: psk-slideup .32s cubic-bezier(.22,1,.36,1);
  }

  /* ── Dark sticky header ── */
  .psk-modal-head {
    flex-shrink: 0;
    background: #0a0a0a;
    border-radius: 24px 24px 0 0;
    padding: 20px 20px 0;
    background-image:
      radial-gradient(ellipse 65% 90% at 115% -15%, rgba(59,190,40,.32) 0%, transparent 60%),
      radial-gradient(ellipse 45% 55% at -10% 115%, rgba(59,190,40,.14) 0%, transparent 60%);
    position: relative;
  }
  .psk-close {
    position: absolute; top: 14px; right: 14px;
    background: rgba(255,255,255,.1); border: none; border-radius: 50%;
    width: 32px; height: 32px; min-width: 32px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: rgba(255,255,255,.65); font-size: 16px; line-height: 1;
    transition: background .14s, color .14s;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  }
  .psk-close:hover  { background: rgba(255,255,255,.2); color: #fff; }
  .psk-close:active { background: rgba(255,255,255,.25); }

  .psk-header-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(59,190,40,.15); border: 1px solid rgba(59,190,40,.3);
    border-radius: 99px; padding: 4px 11px; margin-bottom: 10px;
    font-size: 10px; font-weight: 700; color: #3bbe28;
    letter-spacing: .6px; text-transform: uppercase;
  }
  .psk-header-badge .psk-dot {
    width: 6px; height: 6px; background: #3bbe28; border-radius: 50%;
    animation: psk-pulse 2.4s ease-in-out infinite;
  }
  .psk-modal-head h2 {
    font-size: 20px; font-weight: 800; color: #fff;
    line-height: 1.22; letter-spacing: -.4px; margin-bottom: 5px;
  }
  .psk-modal-head p {
    font-size: 12.5px; color: rgba(255,255,255,.48); line-height: 1.55; padding-bottom: 16px;
  }
  .psk-steps {
    display: flex; gap: 5px; padding-bottom: 14px;
  }
  .psk-step-pill {
    height: 3px; flex: 1; border-radius: 99px;
    background: rgba(255,255,255,.14); transition: background .35s;
  }
  .psk-step-pill.active { background: #3bbe28; }

  /* ── Scrollable content ── */
  .psk-modal-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
  }
  .psk-modal-scroll::-webkit-scrollbar { width: 4px; }
  .psk-modal-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }

  /* ── Sticky footer ── */
  .psk-modal-foot {
    flex-shrink: 0;
    background: #fff;
    border-top: 1px solid #f0f0f0;
    padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
  }

  /* ── Form body ── */
  .psk-form-body { padding: 20px 20px 4px; }

  .psk-section-label {
    font-size: 10px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase;
    color: #9ca3af; margin: 18px 0 9px;
    display: flex; align-items: center; gap: 8px;
  }
  .psk-section-label:first-child { margin-top: 0; }
  .psk-section-label::after { content: ''; flex: 1; height: 1px; background: #f0f0f0; }

  .psk-field { margin-bottom: 11px; }
  .psk-field label {
    display: block; font-size: 11px; font-weight: 700;
    letter-spacing: .5px; text-transform: uppercase; color: #6b7280; margin-bottom: 5px;
  }
  .psk-field input,
  .psk-field select,
  .psk-field textarea {
    width: 100%; background: #f9fafb; border: 1.5px solid #ebebeb; border-radius: 12px;
    padding: 12px 14px; font-size: 16px; color: #111827; outline: none;
    font-family: inherit;
    transition: border-color .15s, box-shadow .15s, background .15s;
    -webkit-appearance: none; appearance: none;
  }
  /* font-size:16px prevents iOS auto-zoom on focus */
  .psk-field input::placeholder,
  .psk-field textarea::placeholder { color: #c8cdd8; }
  .psk-field input:focus,
  .psk-field select:focus,
  .psk-field textarea:focus {
    border-color: #3bbe28; box-shadow: 0 0 0 3px rgba(59,190,40,.1); background: #fff;
  }
  .psk-field select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; cursor: pointer;
  }
  .psk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* ── Chips ── */
  .psk-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .psk-chip {
    background: #f9fafb; border: 1.5px solid #ebebeb; border-radius: 99px;
    padding: 8px 14px; font-size: 13px; font-weight: 600; color: #4b5563;
    cursor: pointer; transition: all .14s; user-select: none;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; line-height: 1.2;
  }
  .psk-chip:active { transform: scale(.94); }
  .psk-chip.psk-sel {
    background: #0a0a0a; border-color: #0a0a0a; color: #fff; font-weight: 700;
    box-shadow: 0 2px 10px rgba(0,0,0,.2);
  }
  .psk-chip.red.psk-sel { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }

  .psk-none-link {
    display: inline-flex; align-items: center; gap: 4px; margin-top: 9px;
    font-size: 12px; color: #9ca3af; cursor: pointer; user-select: none;
    font-weight: 600; transition: color .14s;
    -webkit-tap-highlight-color: transparent; padding: 4px 0;
  }
  .psk-none-link.active { color: #3bbe28; }

  .psk-custom-wrap { margin-top: 10px; }
  .psk-custom-toggle {
    display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
    font-size: 12px; font-weight: 600; color: #9ca3af; user-select: none;
    transition: color .14s;
    text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 3px;
    -webkit-tap-highlight-color: transparent; padding: 4px 0;
  }
  .psk-custom-body { display: none; margin-top: 8px; }
  .psk-custom-body.show { display: block; }
  .psk-custom-body textarea { resize: vertical; min-height: 72px; }
  .psk-custom-badge {
    display: none; margin-top: 6px; font-size: 11px; color: #166534; font-weight: 700;
    background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 3px 9px; width: fit-content;
  }
  .psk-custom-badge.show { display: inline-flex; align-items: center; gap: 4px; }

  /* ── CTA buttons ── */
  .psk-btn-primary {
    width: 100%; background: #0a0a0a; border: none; border-radius: 14px;
    padding: 15px; font-size: 15px; font-weight: 800; color: #fff; cursor: pointer;
    transition: background .16s, transform .1s, box-shadow .16s;
    font-family: inherit; letter-spacing: -.1px;
    box-shadow: 0 4px 18px rgba(0,0,0,.22);
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  }
  .psk-btn-primary:hover:not(:disabled) { background: #3bbe28; box-shadow: 0 6px 24px rgba(59,190,40,.4); transform: translateY(-1px); }
  .psk-btn-primary:active:not(:disabled) { transform: scale(.97); }
  .psk-btn-primary:disabled { opacity: .32; cursor: not-allowed; box-shadow: none; }

  .psk-or {
    display: flex; align-items: center; gap: 10px;
    margin: 11px 0 10px; color: #d1d5db; font-size: 10.5px; font-weight: 700;
    letter-spacing: .5px; text-transform: uppercase;
  }
  .psk-or::before,.psk-or::after { content: ''; flex: 1; height: 1px; background: #f3f4f6; }

  .psk-btn-scan {
    width: 100%; background: #f9fafb; border: 1.5px solid #ebebeb; border-radius: 14px;
    padding: 13px 14px; font-size: 14px; font-weight: 700; color: #374151; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    font-family: inherit; letter-spacing: -.1px;
    transition: border-color .14s, color .14s, background .14s;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  }
  .psk-btn-scan:active { background: #f0fdf4; border-color: #3bbe28; color: #166534; }

  .psk-error {
    display: none; background: #fef2f2; border: 1.5px solid #fecaca;
    border-radius: 10px; padding: 11px 14px; font-size: 13px; color: #dc2626;
    margin-top: 10px; line-height: 1.5;
  }
  .psk-error.show { display: block; }

  /* ── Loader ── */
  .psk-loader {
    display: none; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 0; gap: 14px;
  }
  .psk-loader.show { display: flex; }
  .psk-spinner {
    width: 38px; height: 38px; border: 3px solid #f3f4f6;
    border-top-color: #3bbe28; border-radius: 50%; animation: psk-spin .72s linear infinite;
  }
  .psk-loader-txt { font-size: 13.5px; color: #6b7280; font-weight: 700; }
  .psk-loader-sub { font-size: 12px; color: #c4c9d4; }

  /* ── Results ── */
  #psk-results { display: none; }
  #psk-results.show { display: block; }

  .psk-result-header {
    background: #0a0a0a;
    padding: 20px 20px 18px;
    background-image: radial-gradient(ellipse 65% 90% at 115% -15%, rgba(59,190,40,.32) 0%, transparent 60%);
  }
  .psk-result-header h3 { font-size: 18px; font-weight: 800; color: #fff; margin: 8px 0 5px; letter-spacing: -.3px; }
  .psk-result-summary { font-size: 13px; color: rgba(255,255,255,.55); line-height: 1.6; }

  .psk-results-body { padding: 18px 20px 16px; }

  .psk-warning {
    background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px;
    padding: 11px 13px; font-size: 12.5px; line-height: 1.6; color: #991b1b;
    margin-bottom: 10px; display: flex; gap: 8px; align-items: flex-start;
  }
  .psk-stack-label {
    font-size: 10px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase;
    color: #9ca3af; margin: 0 0 9px; display: flex; align-items: center; gap: 6px;
  }
  .psk-stack-label::after { content: ''; flex: 1; height: 1px; background: #f3f4f6; }
  .psk-stack-cards { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .psk-card {
    background: #fff; border: 1.5px solid #f0f0f0; border-radius: 16px;
    padding: 14px 15px; display: flex; align-items: flex-start; gap: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,.04);
  }
  .psk-card-num {
    width: 28px; height: 28px; min-width: 28px; background: #0a0a0a; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11.5px; font-weight: 800; color: #fff; margin-top: 1px;
  }
  .psk-card-body { flex: 1; min-width: 0; }
  .psk-card-name { font-size: 14px; font-weight: 800; color: #111827; margin-bottom: 4px; letter-spacing: -.2px; }
  .psk-card-why  { font-size: 12.5px; color: #6b7280; line-height: 1.6; margin-bottom: 7px; }
  .psk-card-dose {
    display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700;
    color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 99px; padding: 3px 9px;
  }
  .psk-tip {
    background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 14px;
    padding: 13px 14px; font-size: 12.5px; line-height: 1.65; color: #78350f;
    margin-bottom: 14px; display: flex; gap: 9px; align-items: flex-start;
  }
  .psk-tip strong { color: #92400e; }
  .psk-disclaimer {
    font-size: 11px; color: #c4c9d4; line-height: 1.65;
    padding-top: 12px; border-top: 1px solid #f3f4f6; margin-bottom: 12px;
  }
  .psk-btn-reset {
    background: transparent; border: 1.5px solid #e5e7eb; border-radius: 10px;
    padding: 10px 17px; font-size: 12.5px; font-weight: 700; color: #6b7280; cursor: pointer;
    font-family: inherit; display: inline-flex; align-items: center; gap: 5px;
    -webkit-tap-highlight-color: transparent;
  }
  .psk-btn-reset:active { border-color: #3bbe28; color: #166534; background: #f0fdf4; }

  /* ── Scan overlay ── */
  #psk-scan-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,.72);
    z-index: 99999; align-items: center; justify-content: center;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  #psk-scan-overlay.open { display: flex; animation: psk-fadein .22s ease-out; }
  #psk-scan-modal {
    background: #fff; border-radius: 22px; width: 96%; max-width: 900px;
    height: min(90vh,90dvh); max-height: 860px;
    position: relative; overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,.28);
    animation: psk-slideup .3s cubic-bezier(.22,1,.36,1);
    display: flex; flex-direction: column;
  }
  #psk-scan-header {
    display: flex; align-items: center; gap: 10px; padding: 14px 18px;
    border-bottom: 1.5px solid #f3f4f6; flex-shrink: 0; background: #fff;
    border-radius: 22px 22px 0 0;
  }
  #psk-scan-header .psk-logo-icon {
    width: 32px; height: 32px; background: linear-gradient(135deg,#f0fdf4,#dcfce7);
    border: 1.5px solid #bbf7d0; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;
  }
  #psk-scan-header-title { flex: 1; }
  #psk-scan-header-title strong { font-size: 13.5px; font-weight: 800; color: #111827; display: block; }
  #psk-scan-header-title span   { font-size: 11px; color: #9ca3af; }
  #psk-scan-close {
    background: #f3f4f6; border: none; border-radius: 50%;
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #6b7280; font-size: 15px; flex-shrink: 0;
    transition: background .14s, color .14s;
  }
  #psk-scan-close:hover { background: #e5e7eb; color: #111827; }
  #psk-scan-iframe-wrap { flex: 1; position: relative; overflow: hidden; }
  #psk-scan-iframe { width: 100%; height: 100%; border: none; display: block; }
  #psk-scan-loading {
    position: absolute; inset: 0; background: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
    font-family: inherit; transition: opacity .3s;
  }
  #psk-scan-loading.hidden { opacity: 0; pointer-events: none; }
  #psk-scan-loading p { font-size: 13px; color: #9ca3af; font-weight: 500; }

  /* ════════════════════════════════════════════
     RESPONSIVE
  ════════════════════════════════════════════ */

  /* ── Mobile: bottom sheet (≤ 640px) ── */
  @media (max-width: 640px) {
    #psk-btn { font-size: 12.5px; padding: 10px 15px 10px 12px; bottom: 76px; left: 14px; }

    #psk-overlay { align-items: flex-end; }

    #psk-modal {
      width: 100%;
      max-width: 100%;
      border-radius: 22px 22px 0 0;
      /* Use dvh for accuracy, fall back to vh */
      max-height: 94dvh;
      max-height: 94vh;
      animation: psk-sheet .34s cubic-bezier(.22,1,.36,1);
    }

    /* Drag handle */
    .psk-modal-head::before {
      content: '';
      display: block;
      width: 36px; height: 4px;
      background: rgba(255,255,255,.2);
      border-radius: 99px;
      margin: 0 auto 14px;
    }

    .psk-modal-head { border-radius: 22px 22px 0 0; padding: 14px 18px 0; }
    .psk-modal-head h2 { font-size: 19px; }
    .psk-modal-head p  { font-size: 12px; padding-bottom: 14px; }
    .psk-close { top: 12px; right: 12px; }

    /* Stack 2-col rows vertically */
    .psk-row { grid-template-columns: 1fr; gap: 0; }

    .psk-form-body { padding: 16px 18px 4px; }

    .psk-chip { padding: 9px 14px; font-size: 13px; }

    /* Sticky footer with home-indicator clearance */
    .psk-modal-foot {
      padding: 12px 18px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 12px));
    }
    .psk-btn-primary { padding: 16px; font-size: 16px; }
    .psk-btn-scan    { padding: 14px; font-size: 14px; }

    /* Scan modal → fullscreen */
    #psk-scan-overlay { align-items: stretch; }
    #psk-scan-modal {
      width: 100%; max-width: 100%;
      height: 100dvh; height: 100vh;
      max-height: none; border-radius: 0;
      animation: psk-sheet .28s cubic-bezier(.22,1,.36,1);
    }
    #psk-scan-header { padding-top: max(14px, env(safe-area-inset-top, 14px)); }
  }

  /* ── Very small (iPhone SE 1st gen, 320px) ── */
  @media (max-width: 375px) {
    .psk-modal-head h2 { font-size: 17px; }
    .psk-form-body { padding: 14px 15px 4px; }
    .psk-modal-foot { padding: 11px 15px; padding-bottom: calc(11px + env(safe-area-inset-bottom, 10px)); }
    .psk-chip { padding: 8px 12px; font-size: 12.5px; }
    .psk-btn-primary { font-size: 15px; padding: 15px; }
    .psk-section-label { font-size: 9.5px; margin: 14px 0 8px; }
  }

  /* ── Tablet (641–1024px) ── */
  @media (min-width: 641px) and (max-width: 1024px) {
    #psk-modal { max-width: 480px; max-height: 86vh; max-height: 86dvh; }
  }
  `;
  document.head.appendChild(style);

  /* ─────────────────────────────────────────────
     HTML
  ───────────────────────────────────────────── */
  const container = document.createElement('div');
  container.id = 'pepstack-widget';
  container.innerHTML = `
    <button id="psk-btn" aria-label="Open PepStack">
      <span class="psk-dot"></span>PepStack Recs
    </button>

    <div id="psk-overlay" role="dialog" aria-modal="true" aria-labelledby="psk-title">
      <div id="psk-modal">

        <!-- Sticky dark header -->
        <div class="psk-modal-head">
          <button class="psk-close" id="psk-close" aria-label="Close">&#215;</button>
          <div class="psk-header-badge"><span class="psk-dot"></span>AI Protocol Builder</div>
          <h2 id="psk-title">Build your peptide stack</h2>
          <p>A few quick details so we can suggest the right protocol.</p>
          <div class="psk-steps">
            <div class="psk-step-pill active" id="psk-pill-1"></div>
            <div class="psk-step-pill" id="psk-pill-2"></div>
          </div>
        </div>

        <!-- Scrollable middle -->
        <div class="psk-modal-scroll" id="psk-modal-scroll">

          <!-- Loader -->
          <div class="psk-loader" id="psk-loader">
            <div class="psk-spinner"></div>
            <span class="psk-loader-txt">Building your protocol&hellip;</span>
            <span class="psk-loader-sub">Analyzing your health profile</span>
          </div>

          <!-- Results -->
          <div id="psk-results">
            <div class="psk-result-header">
              <div class="psk-header-badge"><span class="psk-dot"></span>Your Protocol</div>
              <h3>Recommended Stack</h3>
              <p class="psk-result-summary" id="psk-result-summary"></p>
            </div>
            <div class="psk-results-body">
              <div id="psk-results-inner"></div>
              <p class="psk-disclaimer">For research purposes only. Not medical advice. Consult a qualified healthcare provider before starting any peptide protocol.</p>
              <button class="psk-btn-reset" id="psk-reset">&#8592; Start over</button>
            </div>
          </div>

          <!-- Form fields -->
          <div class="psk-form-body" id="psk-step1">

            <div class="psk-section-label">About You</div>

            <div class="psk-row">
              <div class="psk-field">
                <label>Age *</label>
                <input type="number" id="psk-age" placeholder="e.g. 34" min="18" max="99" inputmode="numeric">
              </div>
              <div class="psk-field">
                <label>Biological Sex *</label>
                <select id="psk-sex">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div class="psk-row">
              <div class="psk-field">
                <label>Weight *</label>
                <input type="text" id="psk-weight" placeholder="185 lbs or 84 kg">
              </div>
              <div class="psk-field">
                <label>Height *</label>
                <input type="text" id="psk-height" placeholder="5'10 or 178 cm">
              </div>
            </div>

            <div class="psk-section-label">Primary Goal *</div>
            <div class="psk-chips" id="psk-chips">
              <div class="psk-chip" data-goal="Fat Loss">Fat Loss</div>
              <div class="psk-chip" data-goal="Muscle Building">Muscle Building</div>
              <div class="psk-chip" data-goal="Recovery &amp; Healing">Recovery &amp; Healing</div>
              <div class="psk-chip" data-goal="Anti-Aging">Anti-Aging</div>
              <div class="psk-chip" data-goal="Cognitive Enhancement">Cognitive Enhancement</div>
              <div class="psk-chip" data-goal="Sleep Quality">Sleep Quality</div>
              <div class="psk-chip" data-goal="Hormonal Support">Hormonal Support</div>
              <div class="psk-chip" data-goal="Injury Repair">Injury Repair</div>
              <div class="psk-chip" data-goal="Libido &amp; Sexual Health">Libido &amp; Sexual Health</div>
              <div class="psk-chip" data-goal="Gut Health">Gut Health</div>
              <div class="psk-chip" data-goal="Immune Support">Immune Support</div>
              <div class="psk-chip" data-goal="Longevity">Longevity</div>
              <div class="psk-chip" data-goal="General Wellness">General Wellness</div>
            </div>
            <div class="psk-custom-wrap">
              <span class="psk-custom-toggle" id="psk-custom-toggle">Something else? Describe your goal ↓</span>
              <div class="psk-custom-body" id="psk-custom-body">
                <textarea id="psk-custom-goal" placeholder="e.g. Reduce inflammation and improve gut health after surgery…" maxlength="300" style="margin-top:8px;min-height:72px;resize:vertical"></textarea>
                <div class="psk-custom-badge" id="psk-custom-badge">&#10003; Custom goal active</div>
              </div>
            </div>

            <div class="psk-section-label" style="margin-top:20px">Health &amp; Safety</div>

            <div class="psk-field">
              <label>Medical Conditions</label>
              <div class="psk-chips" id="psk-conditions">
                <div class="psk-chip red" data-val="Diabetes">Diabetes</div>
                <div class="psk-chip red" data-val="Hypertension">Hypertension</div>
                <div class="psk-chip red" data-val="Heart Disease">Heart Disease</div>
                <div class="psk-chip red" data-val="Cancer (active or history)">Cancer</div>
                <div class="psk-chip red" data-val="Thyroid Disorder">Thyroid Disorder</div>
                <div class="psk-chip red" data-val="Autoimmune Disease">Autoimmune</div>
                <div class="psk-chip red" data-val="Kidney / Liver Disease">Kidney / Liver</div>
                <div class="psk-chip red" data-val="PCOS">PCOS</div>
                <div class="psk-chip red" data-val="Low Testosterone">Low Testosterone</div>
                <div class="psk-chip red" data-val="Insulin Resistance">Insulin Resistance</div>
                <div class="psk-chip red" data-val="Depression / Anxiety">Depression / Anxiety</div>
                <div class="psk-chip red" data-val="Sleep Apnea">Sleep Apnea</div>
                <div class="psk-chip red" data-val="Chronic Inflammation">Chronic Inflammation</div>
                <div class="psk-chip red" data-val="Blood Clotting Disorder">Clotting Disorder</div>
              </div>
              <span class="psk-none-link" id="psk-cond-none">&#10003; None of the above</span>
            </div>

            <div class="psk-field" style="margin-bottom:20px">
              <label>Current Medications</label>
              <input type="text" id="psk-meds" placeholder="e.g. TRT, Metformin, SSRIs, or none">
            </div>

            <div class="psk-error" id="psk-error"></div>

          </div><!-- /psk-step1 -->

        </div><!-- /psk-modal-scroll -->

        <!-- Sticky footer CTA -->
        <div class="psk-modal-foot" id="psk-modal-foot">
          <button class="psk-btn-primary" id="psk-submit" disabled>
            Get My Stack Recommendations &nbsp;&#8594;
          </button>
          <div class="psk-or">or</div>
          <button class="psk-btn-scan" id="psk-scan-btn" type="button">
            &#128247;&nbsp; Scan my face for AI recommendations
          </button>
        </div>

      </div>
    </div>

    <!-- PepScan iframe modal -->
    <div id="psk-scan-overlay">
      <div id="psk-scan-modal">
        <div id="psk-scan-header">
          <div class="psk-logo-icon">&#128247;</div>
          <div id="psk-scan-header-title">
            <strong>PepScan — Face Analysis</strong>
            <span>AI recommendations from your facial biomarkers</span>
          </div>
          <button id="psk-scan-close">&#215;</button>
        </div>
        <div id="psk-scan-iframe-wrap">
          <div id="psk-scan-loading">
            <div class="psk-spinner"></div>
            <p>Loading PepScan&hellip;</p>
          </div>
          <iframe id="psk-scan-iframe" title="PepScan Face Analysis" allow="camera"></iframe>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  /* ─────────────────────────────────────────────
     REFS
  ───────────────────────────────────────────── */
  const btn          = document.getElementById('psk-btn');
  const overlay      = document.getElementById('psk-overlay');
  const closeBtn     = document.getElementById('psk-close');
  const modalScroll  = document.getElementById('psk-modal-scroll');
  const modalFoot    = document.getElementById('psk-modal-foot');
  const step1        = document.getElementById('psk-step1');
  const loader       = document.getElementById('psk-loader');
  const results      = document.getElementById('psk-results');
  const inner        = document.getElementById('psk-results-inner');
  const summaryEl    = document.getElementById('psk-result-summary');
  const errorEl      = document.getElementById('psk-error');
  const submitBtn    = document.getElementById('psk-submit');
  const resetBtn     = document.getElementById('psk-reset');
  const pill2        = document.getElementById('psk-pill-2');
  const ageEl        = document.getElementById('psk-age');
  const sexEl        = document.getElementById('psk-sex');
  const weightEl     = document.getElementById('psk-weight');
  const heightEl     = document.getElementById('psk-height');
  const medsEl       = document.getElementById('psk-meds');
  const chips        = document.querySelectorAll('#psk-chips .psk-chip');
  const condChips    = document.querySelectorAll('#psk-conditions .psk-chip');
  const condNoneBtn  = document.getElementById('psk-cond-none');
  const customToggle = document.getElementById('psk-custom-toggle');
  const customBody   = document.getElementById('psk-custom-body');
  const customGoalEl = document.getElementById('psk-custom-goal');
  const customBadge  = document.getElementById('psk-custom-badge');
  const scanBtn      = document.getElementById('psk-scan-btn');
  const scanOverlay  = document.getElementById('psk-scan-overlay');
  const scanClose    = document.getElementById('psk-scan-close');
  const scanIframe   = document.getElementById('psk-scan-iframe');
  const scanLoading  = document.getElementById('psk-scan-loading');

  let selectedGoal       = null;
  let selectedConditions = [];
  let condNone           = false;
  let scanBlocked        = false;

  /* ─────────────────────────────────────────────
     MODAL OPEN / CLOSE
  ───────────────────────────────────────────── */
  function openModal() {
    overlay.classList.add('psk-open');
    document.body.style.overflow = 'hidden';
    modalScroll.scrollTop = 0;
  }
  function closeModal() {
    overlay.classList.remove('psk-open');
    if (!scanOverlay.classList.contains('open')) document.body.style.overflow = '';
  }

  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (scanOverlay.classList.contains('open')) closeScanModal();
    else if (overlay.classList.contains('psk-open')) closeModal();
  });

  /* ─────────────────────────────────────────────
     FOOTER VISIBILITY
  ───────────────────────────────────────────── */
  function setFooterVisible(v) { modalFoot.style.display = v ? '' : 'none'; }

  /* ─────────────────────────────────────────────
     GOAL CHIPS
  ───────────────────────────────────────────── */
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('psk-sel'); });
      c.classList.add('psk-sel');
      selectedGoal = c.dataset.goal;
      customGoalEl.value = ''; customBadge.classList.remove('show');
      checkReady();
    });
  });
  customToggle.addEventListener('click', function () {
    var open = customBody.classList.contains('show');
    customBody.classList.toggle('show', !open);
    if (!open) setTimeout(function () { customGoalEl.focus(); }, 80);
  });
  customGoalEl.addEventListener('input', function () {
    var v = customGoalEl.value.trim();
    if (v) { chips.forEach(function (x) { x.classList.remove('psk-sel'); }); selectedGoal = null; customBadge.classList.add('show'); }
    else   { customBadge.classList.remove('show'); }
    checkReady();
  });

  /* ─────────────────────────────────────────────
     CONDITION CHIPS
  ───────────────────────────────────────────── */
  condChips.forEach(function (c) {
    c.addEventListener('click', function () {
      condNone = false;
      condNoneBtn.classList.remove('active');
      condNoneBtn.textContent = '✓ None of the above';
      c.classList.toggle('psk-sel');
      selectedConditions = Array.from(condChips)
        .filter(function (x) { return x.classList.contains('psk-sel'); })
        .map(function (x) { return x.dataset.val; });
    });
  });
  condNoneBtn.addEventListener('click', function () {
    condNone = !condNone;
    condChips.forEach(function (x) { x.classList.remove('psk-sel'); });
    selectedConditions = [];
    condNoneBtn.classList.toggle('active', condNone);
    condNoneBtn.textContent = condNone ? '✓ None of the above (selected)' : '✓ None of the above';
  });

  /* ─────────────────────────────────────────────
     VALIDATION
  ───────────────────────────────────────────── */
  [ageEl, sexEl, weightEl, heightEl].forEach(function (el) {
    el.addEventListener('input',  checkReady);
    el.addEventListener('change', checkReady);
  });
  function getGoal() { return customGoalEl.value.trim() || selectedGoal || null; }
  function checkReady() {
    submitBtn.disabled = !(
      ageEl.value.trim() && sexEl.value &&
      weightEl.value.trim() && heightEl.value.trim() && getGoal()
    );
  }

  /* ─────────────────────────────────────────────
     SUBMIT
  ───────────────────────────────────────────── */
  submitBtn.addEventListener('click', function () {
    if (submitBtn.disabled) return;
    showLoader();
    fetch(API_URL + '/pepstack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age:             ageEl.value.trim(),
        sex:             sexEl.value,
        weight:          weightEl.value.trim(),
        height:          heightEl.value.trim(),
        goal:            getGoal(),
        conditions:      selectedConditions,
        conditions_none: condNone,
        medications:     medsEl.value.trim()
      })
    })
    .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .then(function (data) { hideLoader(); renderResults(data); })
    .catch(function (err) {
      hideLoader(); showError('Could not load recommendations. Please try again.');
      console.error('[PepStack]', err);
    });
  });

  /* ─────────────────────────────────────────────
     RESET
  ───────────────────────────────────────────── */
  resetBtn.addEventListener('click', resetForm);
  function resetForm() {
    results.classList.remove('show'); inner.innerHTML = ''; summaryEl.textContent = '';
    errorEl.classList.remove('show');
    chips.forEach(function (c)     { c.classList.remove('psk-sel'); });
    condChips.forEach(function (c) { c.classList.remove('psk-sel'); });
    selectedGoal = null; selectedConditions = []; condNone = false;
    condNoneBtn.textContent = '✓ None of the above'; condNoneBtn.classList.remove('active');
    customGoalEl.value = ''; customBadge.classList.remove('show');
    customBody.classList.remove('show');
    ageEl.value = ''; sexEl.value = ''; weightEl.value = ''; heightEl.value = '';
    medsEl.value = '';
    submitBtn.disabled = true;
    step1.style.display = '';
    setFooterVisible(true);
    document.getElementById('psk-pill-1').classList.add('active');
    pill2.classList.remove('active');
    modalScroll.scrollTop = 0;
  }

  /* ─────────────────────────────────────────────
     STATE HELPERS
  ───────────────────────────────────────────── */
  function showLoader() {
    step1.style.display = 'none'; results.classList.remove('show');
    loader.classList.add('show'); errorEl.classList.remove('show');
    setFooterVisible(false); pill2.classList.add('active');
    modalScroll.scrollTop = 0;
  }
  function hideLoader() { loader.classList.remove('show'); }
  function showError(msg) {
    step1.style.display = ''; setFooterVisible(true);
    pill2.classList.remove('active');
    errorEl.textContent = msg; errorEl.classList.add('show');
  }

  /* ─────────────────────────────────────────────
     RENDER RESULTS
  ───────────────────────────────────────────── */
  function renderResults(data) {
    var html = '';
    if (data.warnings && data.warnings.length) {
      data.warnings.forEach(function (w) { html += '<div class="psk-warning">&#9888;&#65039; ' + esc(w) + '</div>'; });
    }
    if (data.stack && data.stack.length) {
      html += '<p class="psk-stack-label">Your recommended stack</p><div class="psk-stack-cards">';
      data.stack.forEach(function (item, i) {
        html += '<div class="psk-card"><div class="psk-card-num">' + (i + 1) + '</div><div class="psk-card-body">';
        html += '<p class="psk-card-name">' + esc(item.name) + '</p>';
        if (item.why)  html += '<p class="psk-card-why">'  + esc(item.why)  + '</p>';
        if (item.dose) html += '<span class="psk-card-dose">&#128200; ' + esc(item.dose) + '</span>';
        html += '</div></div>';
      });
      html += '</div>';
    }
    if (data.tip) html += '<div class="psk-tip">&#128161; <span><strong>Stack tip:</strong> ' + esc(data.tip) + '</span></div>';

    if (data.summary && summaryEl) summaryEl.textContent = data.summary;
    inner.innerHTML = html;
    results.classList.add('show');
    setFooterVisible(false);
    modalScroll.scrollTop = 0;
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ─────────────────────────────────────────────
     SCAN MODAL
  ───────────────────────────────────────────── */
  scanBtn.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (scanBlocked) { openScanPopup(); return; }
    scanOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (!scanIframe.src || scanIframe.src === 'about:blank') {
      scanLoading.classList.remove('hidden');
      scanLoading.querySelector('p').textContent = 'Loading PepScan\u2026';
      scanIframe.onerror = function () { handleIframeBlocked(); };
      var blockTimer = setTimeout(function () {
        try {
          var doc = scanIframe.contentDocument || scanIframe.contentWindow.document;
          if (!doc || doc.URL === 'about:blank') handleIframeBlocked();
          else scanLoading.classList.add('hidden');
        } catch (err) { handleIframeBlocked(); }
      }, 6000);
      scanIframe.onload = function () {
        clearTimeout(blockTimer);
        try {
          var doc = scanIframe.contentDocument || scanIframe.contentWindow.document;
          if (!doc || doc.URL === 'about:blank' || doc.body === null) handleIframeBlocked();
          else scanLoading.classList.add('hidden');
        } catch (err) {
          if (err.name === 'SecurityError') scanLoading.classList.add('hidden');
          else handleIframeBlocked();
        }
      };
      scanIframe.src = PEPSCAN_URL;
    }
  });

  function handleIframeBlocked() {
    scanBlocked = true; closeScanModal();
    scanIframe.src = 'about:blank'; openScanPopup();
  }
  function openScanPopup() {
    var isMobile = window.innerWidth <= 768;
    var w, h, left, top;
    if (isMobile) { w = window.screen.availWidth; h = window.screen.availHeight; left = 0; top = 0; }
    else {
      w    = Math.min(900, window.screen.availWidth  - 40);
      h    = Math.min(820, window.screen.availHeight - 40);
      left = Math.round((window.screen.availWidth  - w) / 2);
      top  = Math.round((window.screen.availHeight - h) / 2);
    }
    var popup = window.open(PEPSCAN_URL, 'pepscan',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
      ',scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
    if (!popup) window.location.href = PEPSCAN_URL;
    else popup.focus();
  }

  scanClose.addEventListener('click', closeScanModal);
  scanOverlay.addEventListener('click', function (e) { if (e.target === scanOverlay) closeScanModal(); });
  function closeScanModal() {
    scanOverlay.classList.remove('open');
    if (!overlay.classList.contains('psk-open')) document.body.style.overflow = '';
  }

  /* ─────────────────────────────────────────────
     HIDE TRIGGER WHEN CHAT WIDGET IS OPEN
  ───────────────────────────────────────────── */
  function syncBtnVisibility() {
    var iframe  = document.getElementById('chat-widget-iframe');
    var chatBtn = document.getElementById('chat-widget-button');
    var open = (iframe && iframe.classList.contains('open')) ||
               (chatBtn && chatBtn.classList.contains('active'));
    btn.style.opacity       = open ? '0' : '';
    btn.style.pointerEvents = open ? 'none' : '';
    btn.style.transform     = open ? 'translateY(10px)' : '';
  }
  function attachChatObserver() {
    var chatBtn    = document.getElementById('chat-widget-button');
    var chatIframe = document.getElementById('chat-widget-iframe');
    if (!chatBtn && !chatIframe) return false;
    var obs = new MutationObserver(syncBtnVisibility);
    if (chatBtn)    obs.observe(chatBtn,    { attributes: true, attributeFilter: ['class'] });
    if (chatIframe) obs.observe(chatIframe, { attributes: true, attributeFilter: ['class'] });
    return true;
  }
  if (!attachChatObserver()) {
    var pollTimer = setInterval(function () {
      if (attachChatObserver()) { clearInterval(pollTimer); syncBtnVisibility(); }
    }, 300);
    setTimeout(function () { clearInterval(pollTimer); }, 15000);
  }
  syncBtnVisibility();

  console.log('✅ PepStack widget loaded');
})();