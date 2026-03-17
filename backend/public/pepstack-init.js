// (function () {
//   'use strict';

//   if (!window.PepStackConfig) {
//     console.error('[PepStack] PepStackConfig not found.');
//     return;
//   }

//   const config      = window.PepStackConfig;
//   const API_URL     = config.apiUrl || 'https://chat-support-pro.onrender.com';
//   const PEPSCAN_URL = config.pepScanUrl || 'https://pepti-scan.vercel.app/';

//   const style = document.createElement('style');
//   style.textContent = `
//   #psk-btn {
//     position: fixed;
//     bottom: 82px;
//     left: 20px;
//     z-index: 99990;
//     background: #ffffff;
//     color: #111827;
//     border: 1.5px solid #e5e7eb;
//     border-radius: 24px;
//     padding: 10px 18px 10px 14px;
//     font-size: 13px;
//     font-weight: 600;
//     letter-spacing: 0.1px;
//     cursor: pointer;
//     display: flex;
//     align-items: center;
//     gap: 8px;
//     white-space: nowrap;
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//     box-shadow: 0 2px 14px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06);
//     transition: box-shadow 0.18s, transform 0.12s, border-color 0.18s;
//   }
//   #psk-btn:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.13); border-color: #3bbe28; transform: translateY(-2px); }
//   #psk-btn:active { transform: translateY(0); }
//   #psk-btn .psk-dot {
//     width: 7px; height: 7px;
//     background: #3bbe28; border-radius: 50%; flex-shrink: 0;
//     animation: psk-pulse 2.2s ease-in-out infinite;
//   }
//   @keyframes psk-pulse {
//     0%,100% { opacity:1; transform:scale(1); }
//     50%      { opacity:.35; transform:scale(.72); }
//   }
//   #psk-overlay {
//     display: none; position: fixed; inset: 0;
//     background: rgba(17,24,39,0.52); z-index: 99995;
//     align-items: center; justify-content: center;
//     backdrop-filter: blur(6px);
//   }
//   #psk-overlay.psk-open { display: flex; animation: psk-fadein .22s ease-out; }
//   @keyframes psk-fadein { from{opacity:0} to{opacity:1} }
//   #psk-modal {
//     background: #ffffff; border-radius: 22px;
//     width: 94%; max-width: 488px; max-height: 92vh;
//     overflow-y: auto; padding: 32px 30px 28px; position: relative;
//     animation: psk-slideup .3s cubic-bezier(.22,1,.36,1);
//     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
//     color: #111827;
//     box-shadow: 0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08);
//     scrollbar-width: thin; scrollbar-color: #e5e7eb transparent;
//   }
//   @keyframes psk-slideup {
//     from { opacity:0; transform:translateY(22px) scale(.97); }
//     to   { opacity:1; transform:translateY(0) scale(1); }
//   }
//   .psk-close {
//     position: absolute; top: 18px; right: 18px;
//     background: #f3f4f6; border: none; border-radius: 50%;
//     width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
//     cursor: pointer; color: #6b7280; font-size: 15px;
//     transition: background .14s, color .14s; line-height: 1;
//   }
//   .psk-close:hover { background: #e5e7eb; color: #111827; }
//   .psk-steps { display: flex; gap: 5px; margin-bottom: 26px; }
//   .psk-step-pill { height: 3px; flex: 1; border-radius: 99px; background: #f3f4f6; transition: background .35s; }
//   .psk-step-pill.psk-active { background: #3bbe28; }
//   .psk-logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
//   .psk-logo-icon {
//     width: 36px; height: 36px;
//     background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
//     border: 1.5px solid #bbf7d0; border-radius: 10px;
//     display: flex; align-items: center; justify-content: center; font-size: 18px;
//   }
//   .psk-logo-label { display: flex; flex-direction: column; gap: 1px; }
//   .psk-logo-text { font-size: 14px; font-weight: 800; color: #111827; letter-spacing: -.2px; }
//   .psk-logo-sub  { font-size: 10px; font-weight: 500; color: #6b7280; letter-spacing: .3px; text-transform: uppercase; }
//   .psk-heading { font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 6px; line-height: 1.2; letter-spacing: -.3px; }
//   .psk-sub     { font-size: 13.5px; color: #6b7280; margin: 0 0 24px; line-height: 1.55; }
//   .psk-field { margin-bottom: 14px; }
//   .psk-field label {
//     display: block; font-size: 11px; font-weight: 700;
//     letter-spacing: .65px; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px;
//   }
//   .psk-field input,
//   .psk-field select {
//     width: 100%; background: #f9fafb; border: 1.5px solid #e5e7eb;
//     border-radius: 10px; padding: 11px 14px; font-size: 14px;
//     color: #111827; outline: none; box-sizing: border-box;
//     font-family: inherit; transition: border-color .15s, box-shadow .15s, background .15s;
//     -webkit-appearance: none; appearance: none;
//   }
//   .psk-field input::placeholder { color: #d1d5db; }
//   .psk-field input:focus,
//   .psk-field select:focus { border-color: #3bbe28; box-shadow: 0 0 0 3px rgba(59,190,40,0.12); background: #ffffff; }
//   .psk-field select {
//     background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E");
//     background-repeat: no-repeat; background-position: right 14px center;
//     padding-right: 36px; cursor: pointer;
//   }
//   .psk-field select option { background: #ffffff; color: #111827; }
//   .psk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
//   .psk-goal-label {
//     font-size: 11px; font-weight: 700; letter-spacing: .65px;
//     text-transform: uppercase; color: #9ca3af; margin: 0 0 10px;
//   }
//   .psk-chips { display: flex; flex-wrap: wrap; gap: 7px; }
//   .psk-chip {
//     background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 99px;
//     padding: 7px 15px; font-size: 12px; font-weight: 500;
//     color: #374151; cursor: pointer; transition: all .14s; user-select: none;
//   }
//   .psk-chip:hover { border-color: #3bbe28; color: #166534; background: #f0fdf4; }
//   .psk-chip.psk-sel {
//     background: #f0fdf4; border-color: #3bbe28; color: #166534;
//     font-weight: 700; box-shadow: 0 0 0 3px rgba(59,190,40,0.10);
//   }
//   .psk-btn-primary {
//     width: 100%; background: #3bbe28; border: none; border-radius: 12px;
//     padding: 14px; font-size: 14.5px; font-weight: 700; color: #ffffff;
//     cursor: pointer; transition: background .16s, transform .1s, box-shadow .16s;
//     letter-spacing: .1px; margin-top: 20px; font-family: inherit;
//     box-shadow: 0 4px 14px rgba(59,190,40,0.30);
//   }
//   .psk-btn-primary:hover:not(:disabled) { background: #33a822; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,190,40,0.38); }
//   .psk-btn-primary:active:not(:disabled) { transform: translateY(0); }
//   .psk-btn-primary:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }
//   .psk-divider {
//     display: flex; align-items: center; gap: 12px;
//     margin: 18px 0 14px; color: #d1d5db; font-size: 12px; font-weight: 500;
//   }
//   .psk-divider::before,
//   .psk-divider::after { content:''; flex:1; height:1px; background:#f3f4f6; }
//   .psk-btn-scan {
//     width: 100%; background: #f9fafb; border: 1.5px solid #e5e7eb;
//     border-radius: 12px; padding: 12px 14px; font-size: 13px;
//     font-weight: 600; color: #374151; cursor: pointer;
//     transition: border-color .14s, color .14s, background .14s;
//     display: flex; align-items: center; justify-content: center;
//     gap: 8px; font-family: inherit; text-decoration: none;
//   }
//   .psk-btn-scan:hover { border-color: #3bbe28; color: #166534; background: #f0fdf4; }
//   .psk-loader { display: none; flex-direction: column; align-items: center; padding: 44px 0 32px; gap: 16px; }
//   .psk-loader.psk-show { display: flex; }
//   .psk-spinner {
//     width: 40px; height: 40px;
//     border: 3px solid #f3f4f6; border-top-color: #3bbe28;
//     border-radius: 50%; animation: psk-spin .72s linear infinite;
//   }
//   @keyframes psk-spin { to { transform: rotate(360deg); } }
//   .psk-loader-txt { font-size: 13px; color: #9ca3af; font-weight: 500; }
//   #psk-results { display: none; }
//   #psk-results.psk-show { display: block; }
//   .psk-result-intro {
//     background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px;
//     padding: 15px 17px; font-size: 13.5px; line-height: 1.7;
//     color: #166534; margin-bottom: 18px;
//   }
//   .psk-stack-label {
//     font-size: 10.5px; font-weight: 700; letter-spacing: .7px;
//     text-transform: uppercase; color: #9ca3af; margin-bottom: 10px;
//     display: flex; align-items: center; gap: 6px;
//   }
//   .psk-stack-label::after { content:''; flex:1; height:1px; background:#f3f4f6; }
//   .psk-stack-cards { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
//   .psk-card {
//     background: #ffffff; border: 1.5px solid #f3f4f6; border-radius: 14px;
//     padding: 15px 17px; display: flex; align-items: flex-start; gap: 14px;
//     transition: border-color .15s, box-shadow .15s;
//     box-shadow: 0 1px 3px rgba(0,0,0,0.04);
//   }
//   .psk-card:hover { border-color: #bbf7d0; box-shadow: 0 4px 12px rgba(59,190,40,0.08); }
//   .psk-card-num {
//     width: 28px; height: 28px; background: #3bbe28; border-radius: 50%;
//     display: flex; align-items: center; justify-content: center;
//     font-size: 12px; font-weight: 800; color: #ffffff;
//     flex-shrink: 0; margin-top: 1px;
//     box-shadow: 0 2px 6px rgba(59,190,40,0.30);
//   }
//   .psk-card-body { flex: 1; min-width: 0; }
//   .psk-card-name { font-size: 14.5px; font-weight: 800; color: #111827; margin: 0 0 4px; }
//   .psk-card-why  { font-size: 12.5px; color: #4b5563; line-height: 1.6; margin: 0 0 6px; }
//   .psk-card-dose {
//     display: inline-flex; align-items: center; gap: 4px;
//     font-size: 11px; color: #6b7280;
//     background: #f9fafb; border: 1px solid #e5e7eb;
//     border-radius: 6px; padding: 3px 8px;
//   }
//   .psk-tip {
//     background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px;
//     padding: 13px 16px; font-size: 12.5px; line-height: 1.65;
//     color: #78350f; margin-bottom: 18px;
//     display: flex; gap: 10px; align-items: flex-start;
//   }
//   .psk-tip-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
//   .psk-tip-text { flex: 1; }
//   .psk-tip strong { color: #92400e; font-weight: 700; }
//   .psk-disclaimer {
//     font-size: 11px; color: #9ca3af; line-height: 1.6;
//     padding-top: 14px; border-top: 1px solid #f3f4f6; margin-bottom: 14px;
//   }
//   .psk-btn-reset {
//     background: transparent; border: 1.5px solid #e5e7eb; border-radius: 9px;
//     padding: 8px 16px; font-size: 12px; color: #6b7280;
//     cursor: pointer; font-family: inherit; transition: border-color .14s, color .14s;
//     display: inline-flex; align-items: center; gap: 5px;
//   }
//   .psk-btn-reset:hover { border-color: #3bbe28; color: #166534; }
//   .psk-error {
//     display: none; background: #fef2f2; border: 1.5px solid #fecaca;
//     border-radius: 10px; padding: 13px 16px; font-size: 13px;
//     color: #dc2626; margin-top: 14px; line-height: 1.5;
//   }
//   .psk-error.psk-show { display: block; }
//   @media (max-width: 480px) {
//     #psk-modal { padding: 24px 20px 22px; border-radius: 18px; }
//     .psk-heading { font-size: 19px; }
//     .psk-row { grid-template-columns: 1fr; gap: 0; }
//     #psk-btn { font-size: 12px; padding: 9px 14px 9px 11px; bottom: 82px; left: 20px; }
//   }
//   `;
//   document.head.appendChild(style);

//   const container = document.createElement('div');
//   container.id = 'pepstack-widget';
//   container.innerHTML = `
//     <button id="psk-btn" aria-label="Get PepStack recommendations">
//       <span class="psk-dot"></span>
//       PepStack Recs
//     </button>

//     <div id="psk-overlay" role="dialog" aria-modal="true" aria-labelledby="psk-title">
//       <div id="psk-modal">
//         <button class="psk-close" id="psk-close" aria-label="Close">&#215;</button>

//         <div class="psk-steps">
//           <div class="psk-step-pill psk-active" id="psk-pill-1"></div>
//           <div class="psk-step-pill" id="psk-pill-2"></div>
//         </div>

//         <div class="psk-logo-row">
//           <div class="psk-logo-icon">&#129516;</div>
//           <div class="psk-logo-label">
//             <span class="psk-logo-text">PepStack</span>
//             <span class="psk-logo-sub">AI Protocol Builder</span>
//           </div>
//         </div>

//         <div id="psk-step1">
//           <h2 class="psk-heading" id="psk-title">Build your peptide stack</h2>
//           <p class="psk-sub">Enter your details and we'll recommend the right protocol for your body and goals.</p>

//           <div class="psk-row">
//             <div class="psk-field">
//               <label>Age</label>
//               <input type="number" id="psk-age" placeholder="e.g. 34" min="18" max="99">
//             </div>
//             <div class="psk-field">
//               <label>Biological Sex</label>
//               <select id="psk-sex">
//                 <option value="">Select</option>
//                 <option value="male">Male</option>
//                 <option value="female">Female</option>
//               </select>
//             </div>
//           </div>

//           <div class="psk-row">
//             <div class="psk-field">
//               <label>Height</label>
//               <input type="text" id="psk-height" placeholder="5'10 or 178cm">
//             </div>
//             <div class="psk-field">
//               <label>Weight</label>
//               <input type="text" id="psk-weight" placeholder="185lbs or 84kg">
//             </div>
//           </div>

//           <div class="psk-field">
//             <p class="psk-goal-label">Primary Goal</p>
//             <div class="psk-chips" id="psk-chips">
//               <div class="psk-chip" data-goal="Fat Loss">Fat Loss</div>
//               <div class="psk-chip" data-goal="Muscle Building">Muscle Building</div>
//               <div class="psk-chip" data-goal="Recovery &amp; Healing">Recovery &amp; Healing</div>
//               <div class="psk-chip" data-goal="Anti-Aging">Anti-Aging</div>
//               <div class="psk-chip" data-goal="Cognitive Enhancement">Cognitive Enhancement</div>
//               <div class="psk-chip" data-goal="Sleep Quality">Sleep Quality</div>
//               <div class="psk-chip" data-goal="Hormonal Support">Hormonal Support</div>
//               <div class="psk-chip" data-goal="Injury Repair">Injury Repair</div>
//               <div class="psk-chip" data-goal="Libido &amp; Sexual Health">Libido &amp; Sexual Health</div>
//               <div class="psk-chip" data-goal="General Wellness">General Wellness</div>
//             </div>
//           </div>

//           <button class="psk-btn-primary" id="psk-submit" disabled>
//             Get My Stack Recommendations &#8594;
//           </button>

//           <div class="psk-divider">or</div>

//           <a class="psk-btn-scan" id="psk-scan-link" href="${PEPSCAN_URL}" target="_blank" rel="noopener noreferrer">
//             &#128247; &nbsp;Scan my face for AI recommendations
//           </a>
//         </div>

//         <div class="psk-loader" id="psk-loader">
//           <div class="psk-spinner"></div>
//           <span class="psk-loader-txt">Analysing your profile&hellip;</span>
//         </div>

//         <div class="psk-error" id="psk-error"></div>

//         <div id="psk-results">
//           <div id="psk-results-inner"></div>
//           <p class="psk-disclaimer">For research purposes only. Not medical advice. Consult a qualified healthcare provider before starting any peptide protocol.</p>
//           <button class="psk-btn-reset" id="psk-reset">&#8592; Try a different goal</button>
//         </div>

//       </div>
//     </div>
//   `;
//   document.body.appendChild(container);

//   const btn       = document.getElementById('psk-btn');
//   const overlay   = document.getElementById('psk-overlay');
//   const closeBtn  = document.getElementById('psk-close');
//   const step1     = document.getElementById('psk-step1');
//   const loader    = document.getElementById('psk-loader');
//   const results   = document.getElementById('psk-results');
//   const inner     = document.getElementById('psk-results-inner');
//   const errorEl   = document.getElementById('psk-error');
//   const submitBtn = document.getElementById('psk-submit');
//   const resetBtn  = document.getElementById('psk-reset');
//   const pill1     = document.getElementById('psk-pill-1');
//   const pill2     = document.getElementById('psk-pill-2');
//   const ageEl     = document.getElementById('psk-age');
//   const sexEl     = document.getElementById('psk-sex');
//   const heightEl  = document.getElementById('psk-height');
//   const weightEl  = document.getElementById('psk-weight');
//   const chips     = document.querySelectorAll('.psk-chip');

//   let selectedGoal = null;

//   btn.addEventListener('click', openModal);
//   closeBtn.addEventListener('click', closeModal);
//   overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
//   document.addEventListener('keydown', function (e) {
//     if (e.key === 'Escape' && overlay.classList.contains('psk-open')) closeModal();
//   });

//   function openModal() {
//     overlay.classList.add('psk-open');
//     document.body.style.overflow = 'hidden';
//   }
//   function closeModal() {
//     overlay.classList.remove('psk-open');
//     const chatIframe = document.getElementById('chat-widget-iframe');
//     if (!chatIframe || !chatIframe.classList.contains('open')) {
//       document.body.style.overflow = '';
//     }
//   }

//   chips.forEach(function (c) {
//     c.addEventListener('click', function () {
//       chips.forEach(function (x) { x.classList.remove('psk-sel'); });
//       c.classList.add('psk-sel');
//       selectedGoal = c.dataset.goal;
//       checkReady();
//     });
//   });

//   [ageEl, sexEl, heightEl, weightEl].forEach(function (el) {
//     el.addEventListener('input', checkReady);
//     el.addEventListener('change', checkReady);
//   });

//   function checkReady() {
//     submitBtn.disabled = !(ageEl.value.trim() && sexEl.value && heightEl.value.trim() && weightEl.value.trim() && selectedGoal);
//   }

//   submitBtn.addEventListener('click', function () {
//     if (submitBtn.disabled) return;
//     showLoader();
//     fetch(API_URL + '/pepstack', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         goal:   selectedGoal,
//         age:    ageEl.value.trim(),
//         sex:    sexEl.value,
//         height: heightEl.value.trim(),
//         weight: weightEl.value.trim()
//       })
//     })
//     .then(function (res) {
//       if (!res.ok) throw new Error('status ' + res.status);
//       return res.json();
//     })
//     .then(function (data) { hideLoader(); renderResults(data); })
//     .catch(function (err) {
//       hideLoader();
//       showError('Could not load recommendations. Please try again.');
//       console.error('[PepStack]', err);
//     });
//   });

//   resetBtn.addEventListener('click', resetForm);

//   function resetForm() {
//     results.classList.remove('psk-show');
//     inner.innerHTML = '';
//     errorEl.classList.remove('psk-show');
//     chips.forEach(function (c) { c.classList.remove('psk-sel'); });
//     ageEl.value = ''; sexEl.value = ''; heightEl.value = ''; weightEl.value = '';
//     selectedGoal = null; submitBtn.disabled = true; step1.style.display = '';
//     pill1.classList.add('psk-active'); pill2.classList.remove('psk-active');
//   }

//   function showLoader() {
//     step1.style.display = 'none'; loader.classList.add('psk-show');
//     errorEl.classList.remove('psk-show'); results.classList.remove('psk-show');
//     pill2.classList.add('psk-active');
//   }
//   function hideLoader() { loader.classList.remove('psk-show'); }
//   function showError(msg) {
//     step1.style.display = ''; pill2.classList.remove('psk-active');
//     errorEl.textContent = msg; errorEl.classList.add('psk-show');
//   }

//   function renderResults(data) {
//     var html = '';
//     if (data.summary) {
//       html += '<div class="psk-result-intro">' + esc(data.summary) + '</div>';
//     }
//     if (data.stack && data.stack.length) {
//       html += '<p class="psk-stack-label">Your recommended stack</p>';
//       html += '<div class="psk-stack-cards">';
//       data.stack.forEach(function (item, i) {
//         html += '<div class="psk-card">';
//         html += '<div class="psk-card-num">' + (i + 1) + '</div>';
//         html += '<div class="psk-card-body">';
//         html += '<p class="psk-card-name">' + esc(item.name) + '</p>';
//         if (item.why)  html += '<p class="psk-card-why">' + esc(item.why) + '</p>';
//         if (item.dose) html += '<span class="psk-card-dose">&#128200; ' + esc(item.dose) + '</span>';
//         html += '</div></div>';
//       });
//       html += '</div>';
//     }
//     if (data.tip) {
//       html += '<div class="psk-tip"><span class="psk-tip-icon">&#128161;</span><span class="psk-tip-text"><strong>Stack tip:</strong> ' + esc(data.tip) + '</span></div>';
//     }
//     inner.innerHTML = html;
//     results.classList.add('psk-show');
//   }

//   function esc(str) {
//     return String(str || '')
//       .replace(/&/g, '&amp;').replace(/</g, '&lt;')
//       .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
//   }

//   console.log('✅ PepStack widget loaded');
// })();





(function () {
  'use strict';

  if (!window.PepStackConfig) {
    console.error('[PepStack] PepStackConfig not found.');
    return;
  }

  const config      = window.PepStackConfig;
  const API_URL     = config.apiUrl || 'https://chat-support-pro.onrender.com';
  const PEPSCAN_URL = config.pepScanUrl || 'https://pepti-scan.vercel.app/';

  /* ─────────────────────────── STYLES ─────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
  #psk-btn {
    position:fixed; bottom:82px; left:20px; z-index:99990;
    background:#ffffff; color:#111827; border:1.5px solid #e5e7eb; border-radius:24px;
    padding:10px 18px 10px 14px; font-size:13px; font-weight:600; letter-spacing:.1px;
    cursor:pointer; display:flex; align-items:center; gap:8px; white-space:nowrap;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    box-shadow:0 2px 14px rgba(0,0,0,.10),0 1px 3px rgba(0,0,0,.06);
    transition:box-shadow .18s,transform .12s,border-color .18s;
  }
  #psk-btn:hover { box-shadow:0 6px 20px rgba(0,0,0,.13); border-color:#3bbe28; transform:translateY(-2px); }
  #psk-btn:active { transform:translateY(0); }
  #psk-btn .psk-dot {
    width:7px; height:7px; background:#3bbe28; border-radius:50%; flex-shrink:0;
    animation:psk-pulse 2.2s ease-in-out infinite;
  }
  @keyframes psk-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.72)} }
  #psk-overlay {
    display:none; position:fixed; inset:0; background:rgba(17,24,39,.52);
    z-index:99995; align-items:center; justify-content:center; backdrop-filter:blur(6px);
  }
  #psk-overlay.psk-open { display:flex; animation:psk-fadein .22s ease-out; }
  @keyframes psk-fadein { from{opacity:0} to{opacity:1} }
  #psk-modal {
    background:#ffffff; border-radius:24px; width:96%; max-width:600px; max-height:94vh;
    overflow-y:auto; padding:38px 36px 32px; position:relative;
    animation:psk-slideup .3s cubic-bezier(.22,1,.36,1);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111827;
    box-shadow:0 24px 64px rgba(0,0,0,.16),0 4px 16px rgba(0,0,0,.08);
    scrollbar-width:thin; scrollbar-color:#e5e7eb transparent;
  }
  @keyframes psk-slideup {
    from{opacity:0;transform:translateY(22px) scale(.97)}
    to{opacity:1;transform:translateY(0) scale(1)}
  }
  .psk-close {
    position:absolute; top:18px; right:18px; background:#f3f4f6; border:none; border-radius:50%;
    width:34px; height:34px; display:flex; align-items:center; justify-content:center;
    cursor:pointer; color:#6b7280; font-size:15px; transition:background .14s,color .14s; line-height:1;
  }
  .psk-close:hover { background:#e5e7eb; color:#111827; }
  .psk-steps { display:flex; gap:5px; margin-bottom:28px; }
  .psk-step-pill { height:3px; flex:1; border-radius:99px; background:#f3f4f6; transition:background .35s; }
  .psk-step-pill.psk-active { background:#3bbe28; }
  .psk-logo-row { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
  .psk-logo-icon {
    width:38px; height:38px; background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);
    border:1.5px solid #bbf7d0; border-radius:10px;
    display:flex; align-items:center; justify-content:center; font-size:19px;
  }
  .psk-logo-label { display:flex; flex-direction:column; gap:1px; }
  .psk-logo-text { font-size:14px; font-weight:800; color:#111827; letter-spacing:-.2px; }
  .psk-logo-sub  { font-size:10px; font-weight:500; color:#6b7280; letter-spacing:.3px; text-transform:uppercase; }
  .psk-heading { font-size:24px; font-weight:800; color:#111827; margin:0 0 7px; line-height:1.2; letter-spacing:-.3px; }
  .psk-sub { font-size:14px; color:#6b7280; margin:0 0 22px; line-height:1.55; }
  /* Section blocks */
  .psk-section { border:1.5px solid #f3f4f6; border-radius:14px; margin-bottom:12px; overflow:hidden; }
  .psk-section-header {
    display:flex; align-items:center; gap:10px; padding:13px 15px;
    cursor:pointer; user-select:none; background:#fafafa; transition:background .14s;
  }
  .psk-section-header:hover { background:#f3f4f6; }
  .psk-section-icon {
    width:30px; height:30px; border-radius:8px;
    display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0;
  }
  .psk-section-icon.green  { background:#f0fdf4; border:1px solid #bbf7d0; }
  .psk-section-icon.blue   { background:#eff6ff; border:1px solid #bfdbfe; }
  .psk-section-icon.amber  { background:#fffbeb; border:1px solid #fde68a; }
  .psk-section-icon.red    { background:#fef2f2; border:1px solid #fecaca; }
  .psk-section-icon.purple { background:#faf5ff; border:1px solid #e9d5ff; }
  .psk-section-icon.slate  { background:#f8fafc; border:1px solid #e2e8f0; }
  .psk-section-title { flex:1; font-size:13px; font-weight:700; color:#111827; letter-spacing:-.1px; }
  .psk-section-badge {
    font-size:10px; font-weight:600; color:#6b7280; background:#f3f4f6;
    border-radius:99px; padding:2px 9px; letter-spacing:.3px; white-space:nowrap;
  }
  .psk-section-badge.filled { background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; }
  .psk-section-chevron { font-size:10px; color:#9ca3af; transition:transform .2s; display:inline-block; margin-left:4px; }
  .psk-section-chevron.psk-open { transform:rotate(180deg); }
  .psk-section-body { display:none; padding:16px; border-top:1.5px solid #f3f4f6; }
  .psk-section-body.psk-show { display:block; }
  /* Fields */
  .psk-field { margin-bottom:14px; }
  .psk-field:last-child { margin-bottom:0; }
  .psk-field label {
    display:block; font-size:11px; font-weight:700;
    letter-spacing:.65px; text-transform:uppercase; color:#9ca3af; margin-bottom:5px;
  }
  .psk-field-hint { font-size:11.5px; color:#b0b8c4; margin-bottom:7px; line-height:1.45; }
  .psk-field input,.psk-field select,.psk-field textarea {
    width:100%; background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:10px;
    padding:11px 14px; font-size:14px; color:#111827; outline:none; box-sizing:border-box;
    font-family:inherit; transition:border-color .15s,box-shadow .15s,background .15s;
    -webkit-appearance:none; appearance:none;
  }
  .psk-field input::placeholder,.psk-field textarea::placeholder { color:#d1d5db; }
  .psk-field input:focus,.psk-field select:focus,.psk-field textarea:focus {
    border-color:#3bbe28; box-shadow:0 0 0 3px rgba(59,190,40,.12); background:#fff;
  }
  .psk-field textarea { resize:vertical; min-height:70px; line-height:1.5; }
  .psk-field select {
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 14px center;
    padding-right:36px; cursor:pointer;
  }
  .psk-field select option { background:#fff; color:#111827; }
  .psk-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  /* Chips */
  .psk-chips { display:flex; flex-wrap:wrap; gap:7px; }
  .psk-chip {
    background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:99px;
    padding:6px 14px; font-size:12px; font-weight:500; color:#374151;
    cursor:pointer; transition:all .14s; user-select:none;
  }
  .psk-chip:hover { border-color:#3bbe28; color:#166534; background:#f0fdf4; }
  .psk-chip.psk-sel { background:#f0fdf4; border-color:#3bbe28; color:#166534; font-weight:700; box-shadow:0 0 0 3px rgba(59,190,40,.10); }
  .psk-chip.red:hover { border-color:#ef4444; color:#991b1b; background:#fef2f2; }
  .psk-chip.red.psk-sel { background:#fef2f2; border-color:#ef4444; color:#991b1b; box-shadow:0 0 0 3px rgba(239,68,68,.08); }
  /* Custom goal */
  .psk-custom-goal-wrap { margin-top:13px; padding-top:13px; border-top:1.5px dashed #e5e7eb; }
  .psk-custom-goal-header { display:flex; align-items:center; gap:8px; cursor:pointer; }
  .psk-custom-goal-toggle { font-size:11px; font-weight:700; letter-spacing:.65px; text-transform:uppercase; color:#9ca3af; user-select:none; flex:1; }
  .psk-custom-goal-chevron { font-size:11px; color:#9ca3af; transition:transform .2s; display:inline-block; }
  .psk-custom-goal-chevron.psk-open { transform:rotate(180deg); }
  .psk-custom-goal-body { display:none; margin-top:10px; }
  .psk-custom-goal-body.psk-show { display:block; }
  .psk-custom-hint { font-size:11.5px; color:#b0b8c4; margin-bottom:8px; line-height:1.45; }
  .psk-custom-active-badge {
    display:none; align-items:center; gap:5px; font-size:11px; color:#166534; font-weight:600;
    background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:3px 8px;
    width:fit-content; margin-top:6px;
  }
  .psk-custom-active-badge.psk-show { display:inline-flex; }
  .psk-req { color:#ef4444; font-size:10px; margin-left:2px; }
  /* Progress */
  .psk-progress-wrap { margin-bottom:20px; }
  .psk-progress-label { display:flex; justify-content:space-between; margin-bottom:5px; }
  .psk-progress-txt { font-size:11px; color:#9ca3af; font-weight:600; letter-spacing:.4px; text-transform:uppercase; }
  .psk-progress-pct { font-size:11px; color:#3bbe28; font-weight:700; }
  .psk-progress-bar { height:4px; background:#f3f4f6; border-radius:99px; overflow:hidden; }
  .psk-progress-fill { height:100%; background:#3bbe28; border-radius:99px; transition:width .4s cubic-bezier(.22,1,.36,1); width:0%; }
  .psk-none-chip {
    font-size:11.5px; color:#9ca3af; cursor:pointer; user-select:none;
    text-decoration:underline; text-decoration-style:dashed; margin-top:8px; display:inline-block;
  }
  .psk-none-chip:hover { color:#3bbe28; }
  /* Buttons */
  .psk-btn-primary {
    width:100%; background:#3bbe28; border:none; border-radius:12px;
    padding:15px; font-size:15px; font-weight:700; color:#fff;
    cursor:pointer; transition:background .16s,transform .1s,box-shadow .16s;
    letter-spacing:.1px; margin-top:20px; font-family:inherit;
    box-shadow:0 4px 14px rgba(59,190,40,.30);
  }
  .psk-btn-primary:hover:not(:disabled) { background:#33a822; transform:translateY(-1px); box-shadow:0 6px 20px rgba(59,190,40,.38); }
  .psk-btn-primary:active:not(:disabled) { transform:translateY(0); }
  .psk-btn-primary:disabled { opacity:.4; cursor:not-allowed; box-shadow:none; }
  .psk-divider {
    display:flex; align-items:center; gap:12px;
    margin:18px 0 14px; color:#d1d5db; font-size:12px; font-weight:500;
  }
  .psk-divider::before,.psk-divider::after { content:''; flex:1; height:1px; background:#f3f4f6; }
  .psk-btn-scan {
    width:100%; background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:12px;
    padding:13px 14px; font-size:13px; font-weight:600; color:#374151; cursor:pointer;
    transition:border-color .14s,color .14s,background .14s;
    display:flex; align-items:center; justify-content:center;
    gap:8px; font-family:inherit; text-decoration:none;
  }
  .psk-btn-scan:hover { border-color:#3bbe28; color:#166534; background:#f0fdf4; }
  /* Loader */
  .psk-loader { display:none; flex-direction:column; align-items:center; padding:52px 0 40px; gap:16px; }
  .psk-loader.psk-show { display:flex; }
  .psk-spinner { width:40px; height:40px; border:3px solid #f3f4f6; border-top-color:#3bbe28; border-radius:50%; animation:psk-spin .72s linear infinite; }
  @keyframes psk-spin { to{transform:rotate(360deg)} }
  .psk-loader-txt { font-size:13px; color:#9ca3af; font-weight:500; }
  /* Results */
  #psk-results { display:none; }
  #psk-results.psk-show { display:block; }
  .psk-result-intro { background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:12px; padding:16px 18px; font-size:13.5px; line-height:1.7; color:#166534; margin-bottom:20px; }
  .psk-stack-label { font-size:10.5px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; color:#9ca3af; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
  .psk-stack-label::after { content:''; flex:1; height:1px; background:#f3f4f6; }
  .psk-stack-cards { display:flex; flex-direction:column; gap:10px; margin-bottom:20px; }
  .psk-card { background:#fff; border:1.5px solid #f3f4f6; border-radius:14px; padding:16px 18px; display:flex; align-items:flex-start; gap:14px; transition:border-color .15s,box-shadow .15s; box-shadow:0 1px 3px rgba(0,0,0,.04); }
  .psk-card:hover { border-color:#bbf7d0; box-shadow:0 4px 12px rgba(59,190,40,.08); }
  .psk-card-num { width:28px; height:28px; background:#3bbe28; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:#fff; flex-shrink:0; margin-top:1px; box-shadow:0 2px 6px rgba(59,190,40,.30); }
  .psk-card-body { flex:1; min-width:0; }
  .psk-card-name { font-size:14.5px; font-weight:800; color:#111827; margin:0 0 4px; }
  .psk-card-why  { font-size:12.5px; color:#4b5563; line-height:1.6; margin:0 0 6px; }
  .psk-card-dose { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#6b7280; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:3px 8px; }
  .psk-tip { background:#fffbeb; border:1.5px solid #fde68a; border-radius:12px; padding:14px 17px; font-size:12.5px; line-height:1.65; color:#78350f; margin-bottom:18px; display:flex; gap:10px; align-items:flex-start; }
  .psk-tip-icon { font-size:15px; flex-shrink:0; margin-top:1px; }
  .psk-tip-text { flex:1; }
  .psk-tip strong { color:#92400e; font-weight:700; }
  .psk-warning { background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; padding:13px 16px; font-size:12.5px; line-height:1.65; color:#991b1b; margin-bottom:14px; display:flex; gap:10px; align-items:flex-start; }
  .psk-warning-icon { font-size:15px; flex-shrink:0; margin-top:1px; }
  .psk-disclaimer { font-size:11px; color:#9ca3af; line-height:1.6; padding-top:14px; border-top:1px solid #f3f4f6; margin-bottom:14px; }
  .psk-btn-reset { background:transparent; border:1.5px solid #e5e7eb; border-radius:9px; padding:8px 16px; font-size:12px; color:#6b7280; cursor:pointer; font-family:inherit; transition:border-color .14s,color .14s; display:inline-flex; align-items:center; gap:5px; }
  .psk-btn-reset:hover { border-color:#3bbe28; color:#166534; }
  .psk-error { display:none; background:#fef2f2; border:1.5px solid #fecaca; border-radius:10px; padding:13px 16px; font-size:13px; color:#dc2626; margin-top:14px; line-height:1.5; }
  .psk-error.psk-show { display:block; }
  @media (max-width:540px) {
    #psk-modal { padding:26px 20px 24px; border-radius:20px; }
    .psk-heading { font-size:20px; }
    .psk-row { grid-template-columns:1fr; gap:0; }
    #psk-btn { font-size:12px; padding:9px 14px 9px 11px; }
  }
  `;
  document.head.appendChild(style);

  /* ─────────────────────────── HTML ─────────────────────────── */
  const container = document.createElement('div');
  container.id = 'pepstack-widget';
  container.innerHTML = `
    <button id="psk-btn" aria-label="Get PepStack recommendations">
      <span class="psk-dot"></span>PepStack Recs
    </button>

    <div id="psk-overlay" role="dialog" aria-modal="true" aria-labelledby="psk-title">
      <div id="psk-modal">
        <button class="psk-close" id="psk-close" aria-label="Close">&#215;</button>
        <div class="psk-steps">
          <div class="psk-step-pill psk-active" id="psk-pill-1"></div>
          <div class="psk-step-pill" id="psk-pill-2"></div>
        </div>
        <div class="psk-logo-row">
          <div class="psk-logo-icon">&#129516;</div>
          <div class="psk-logo-label">
            <span class="psk-logo-text">PepStack</span>
            <span class="psk-logo-sub">AI Protocol Builder</span>
          </div>
        </div>

        <div id="psk-step1">
          <h2 class="psk-heading" id="psk-title">Build your peptide stack</h2>
          <p class="psk-sub">The more you share, the more accurate and safe your recommendations will be.</p>

          <div class="psk-progress-wrap">
            <div class="psk-progress-label">
              <span class="psk-progress-txt">Profile completeness</span>
              <span class="psk-progress-pct" id="psk-pct">0%</span>
            </div>
            <div class="psk-progress-bar"><div class="psk-progress-fill" id="psk-fill"></div></div>
          </div>

          <!-- 1. About You -->
          <div class="psk-section">
            <div class="psk-section-header" data-section="s-about">
              <div class="psk-section-icon green">&#128100;</div>
              <span class="psk-section-title">About You <span class="psk-req">*</span></span>
              <span class="psk-section-badge filled" id="badge-s-about">Required</span>
              <span class="psk-section-chevron psk-open" id="chev-s-about">&#9660;</span>
            </div>
            <div class="psk-section-body psk-show" id="body-s-about">
              <div class="psk-row">
                <div class="psk-field">
                  <label>Age <span class="psk-req">*</span></label>
                  <input type="number" id="psk-age" placeholder="e.g. 34" min="18" max="99">
                </div>
                <div class="psk-field">
                  <label>Biological Sex <span class="psk-req">*</span></label>
                  <select id="psk-sex">
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
              </div>
              <div class="psk-row">
                <div class="psk-field">
                  <label>Height <span class="psk-req">*</span></label>
                  <input type="text" id="psk-height" placeholder="5'10 or 178cm">
                </div>
                <div class="psk-field">
                  <label>Weight <span class="psk-req">*</span></label>
                  <input type="text" id="psk-weight" placeholder="185lbs or 84kg">
                </div>
              </div>
              <div class="psk-row">
                <div class="psk-field">
                  <label>Body Fat % <span style="font-weight:400;text-transform:none;font-size:10px">(optional)</span></label>
                  <input type="text" id="psk-bf" placeholder="e.g. 18%">
                </div>
                <div class="psk-field">
                  <label>Activity Level <span class="psk-req">*</span></label>
                  <select id="psk-fitness">
                    <option value="">Select</option>
                    <option value="sedentary">Sedentary (desk, no exercise)</option>
                    <option value="light">Lightly active (1–2x/week)</option>
                    <option value="moderate">Moderately active (3–4x/week)</option>
                    <option value="very">Very active (5–6x/week)</option>
                    <option value="athlete">Athlete / training daily</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Primary Goal -->
          <div class="psk-section">
            <div class="psk-section-header" data-section="s-goal">
              <div class="psk-section-icon blue">&#127919;</div>
              <span class="psk-section-title">Primary Goal <span class="psk-req">*</span></span>
              <span class="psk-section-badge" id="badge-s-goal">Not set</span>
              <span class="psk-section-chevron psk-open" id="chev-s-goal">&#9660;</span>
            </div>
            <div class="psk-section-body psk-show" id="body-s-goal">
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
                <div class="psk-chip" data-goal="Inflammation Reduction">Inflammation Reduction</div>
                <div class="psk-chip" data-goal="Longevity">Longevity</div>
                <div class="psk-chip" data-goal="General Wellness">General Wellness</div>
              </div>
              <div class="psk-custom-goal-wrap">
                <div class="psk-custom-goal-header" id="psk-custom-toggle">
                  <span class="psk-custom-goal-toggle">Don't see your goal? Describe it</span>
                  <span class="psk-custom-goal-chevron" id="psk-custom-chevron">&#9660;</span>
                </div>
                <div class="psk-custom-goal-body" id="psk-custom-body">
                  <p class="psk-custom-hint">Describe your specific goal. This overrides the chip selection above.</p>
                  <textarea id="psk-custom-goal" placeholder="e.g. Improve gut health and reduce inflammation after surgery…" maxlength="300"></textarea>
                  <span class="psk-custom-active-badge" id="psk-custom-badge">&#10003; Custom goal active</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Health Profile -->
          <div class="psk-section">
            <div class="psk-section-header" data-section="s-health">
              <div class="psk-section-icon red">&#129657;</div>
              <span class="psk-section-title">Health Profile &nbsp;<span style="font-size:10px;font-weight:500;color:#9ca3af">(strongly recommended)</span></span>
              <span class="psk-section-badge" id="badge-s-health">Not filled</span>
              <span class="psk-section-chevron" id="chev-s-health">&#9660;</span>
            </div>
            <div class="psk-section-body" id="body-s-health">
              <div class="psk-field">
                <label>Medical Conditions</label>
                <div class="psk-field-hint">Select all that apply — some conditions affect which peptides are safe.</div>
                <div class="psk-chips" id="psk-conditions">
                  <div class="psk-chip red" data-val="Type 1 Diabetes">Type 1 Diabetes</div>
                  <div class="psk-chip red" data-val="Type 2 Diabetes">Type 2 Diabetes</div>
                  <div class="psk-chip red" data-val="Hypertension">Hypertension</div>
                  <div class="psk-chip red" data-val="Heart Disease">Heart Disease</div>
                  <div class="psk-chip red" data-val="Cancer (active)">Cancer (active)</div>
                  <div class="psk-chip red" data-val="Cancer (history)">Cancer (history)</div>
                  <div class="psk-chip red" data-val="Thyroid Disorder">Thyroid Disorder</div>
                  <div class="psk-chip red" data-val="Autoimmune Disease">Autoimmune Disease</div>
                  <div class="psk-chip red" data-val="Kidney Disease">Kidney Disease</div>
                  <div class="psk-chip red" data-val="Liver Disease">Liver Disease</div>
                  <div class="psk-chip red" data-val="PCOS">PCOS</div>
                  <div class="psk-chip red" data-val="Insulin Resistance">Insulin Resistance</div>
                  <div class="psk-chip red" data-val="Low Testosterone">Low Testosterone</div>
                  <div class="psk-chip red" data-val="Menopause / Perimenopause">Menopause / Perimenopause</div>
                  <div class="psk-chip red" data-val="Depression / Anxiety">Depression / Anxiety</div>
                  <div class="psk-chip red" data-val="Sleep Apnea">Sleep Apnea</div>
                  <div class="psk-chip red" data-val="Chronic Pain">Chronic Pain</div>
                  <div class="psk-chip red" data-val="Fibromyalgia">Fibromyalgia</div>
                  <div class="psk-chip red" data-val="IBS / IBD">IBS / IBD</div>
                  <div class="psk-chip red" data-val="Fatty Liver (NAFLD)">Fatty Liver (NAFLD)</div>
                  <div class="psk-chip red" data-val="Neuropathy">Neuropathy</div>
                  <div class="psk-chip red" data-val="Osteoporosis / Osteopenia">Osteoporosis / Osteopenia</div>
                  <div class="psk-chip red" data-val="Stroke / TIA (history)">Stroke / TIA (history)</div>
                  <div class="psk-chip red" data-val="Blood Clotting Disorder">Blood Clotting Disorder</div>
                  <div class="psk-chip red" data-val="HIV / Immunocompromised">HIV / Immunocompromised</div>
                </div>
                <span class="psk-none-chip" id="psk-conditions-none">&#10003; None of the above</span>
              </div>
              <div class="psk-field">
                <label>Other / unlisted conditions</label>
                <input type="text" id="psk-conditions-other" placeholder="e.g. Lyme disease, Hashimoto's, Long COVID, PTSD…">
              </div>
              <div class="psk-field">
                <label>Known Allergies</label>
                <div class="psk-field-hint">Drug, food, or substance allergies — include anything relevant.</div>
                <input type="text" id="psk-allergies" placeholder="e.g. Penicillin, latex, soy, shellfish, none">
              </div>
              <div class="psk-field">
                <label>Current Medications &amp; Supplements</label>
                <div class="psk-field-hint">Include prescription drugs, TRT/HRT, blood thinners, SSRIs, metformin, insulin, steroids, SARMs, etc.</div>
                <textarea id="psk-meds" placeholder="e.g. Testosterone Cypionate 150mg/week, Metformin 500mg, Lisinopril 10mg, Vitamin D 5000IU…"></textarea>
              </div>
              <div class="psk-field">
                <label>Recent Bloodwork / Lab Values <span style="font-weight:400;text-transform:none;font-size:10px">(optional but helpful)</span></label>
                <div class="psk-field-hint">Paste key markers — IGF-1, total/free testosterone, thyroid (TSH/T3/T4), HbA1c, lipids, CRP, DHEA, cortisol, etc.</div>
                <textarea id="psk-labs" placeholder="e.g. Total T: 420 ng/dL, Free T: 12 pg/mL, IGF-1: 180 ng/mL, TSH: 2.1, HbA1c: 5.8%, CRP: 1.2…"></textarea>
              </div>
              <div class="psk-row">
                <div class="psk-field">
                  <label>Pregnancy / Reproductive Status</label>
                  <select id="psk-pregnancy">
                    <option value="">Select</option>
                    <option value="no">No</option>
                    <option value="pregnant">Currently pregnant</option>
                    <option value="breastfeeding">Breastfeeding</option>
                    <option value="trying">Trying to conceive</option>
                    <option value="na">N/A (male)</option>
                  </select>
                </div>
                <div class="psk-field">
                  <label>Recent Surgery / Injury</label>
                  <input type="text" id="psk-surgery" placeholder="e.g. ACL repair 3mo ago, rotator cuff surgery">
                </div>
              </div>
              <div class="psk-field">
                <label>Family History <span style="font-weight:400;text-transform:none;font-size:10px">(optional)</span></label>
                <div class="psk-field-hint">Relevant genetic predispositions — cancer, heart disease, diabetes, etc.</div>
                <input type="text" id="psk-family-history" placeholder="e.g. Father — prostate cancer, Mother — Type 2 diabetes">
              </div>
            </div>
          </div>

          <!-- 4. Lifestyle -->
          <div class="psk-section">
            <div class="psk-section-header" data-section="s-lifestyle">
              <div class="psk-section-icon amber">&#127774;</div>
              <span class="psk-section-title">Lifestyle &amp; Habits</span>
              <span class="psk-section-badge" id="badge-s-lifestyle">Not filled</span>
              <span class="psk-section-chevron" id="chev-s-lifestyle">&#9660;</span>
            </div>
            <div class="psk-section-body" id="body-s-lifestyle">
              <div class="psk-row">
                <div class="psk-field">
                  <label>Diet Type</label>
                  <select id="psk-diet">
                    <option value="">Select</option>
                    <option value="standard">Standard / Mixed</option>
                    <option value="keto">Keto / Low-carb</option>
                    <option value="carnivore">Carnivore</option>
                    <option value="paleo">Paleo</option>
                    <option value="mediterranean">Mediterranean</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="if">Intermittent Fasting</option>
                    <option value="deficit">Caloric Deficit (cut)</option>
                    <option value="surplus">Caloric Surplus (bulk)</option>
                  </select>
                </div>
                <div class="psk-field">
                  <label>Avg Sleep (hrs/night)</label>
                  <select id="psk-sleep">
                    <option value="">Select</option>
                    <option value="lt5">Less than 5 hrs</option>
                    <option value="5-6">5–6 hrs</option>
                    <option value="6-7">6–7 hrs</option>
                    <option value="7-8">7–8 hrs (optimal)</option>
                    <option value="gt8">8+ hrs</option>
                  </select>
                </div>
              </div>
              <div class="psk-row">
                <div class="psk-field">
                  <label>Stress Level</label>
                  <select id="psk-stress">
                    <option value="">Select</option>
                    <option value="low">Low — relaxed most days</option>
                    <option value="moderate">Moderate — manageable</option>
                    <option value="high">High — frequent stress</option>
                    <option value="extreme">Extreme — burnout / chronic</option>
                  </select>
                </div>
                <div class="psk-field">
                  <label>Training Style</label>
                  <select id="psk-training">
                    <option value="">Select</option>
                    <option value="none">None</option>
                    <option value="cardio">Primarily cardio</option>
                    <option value="strength">Strength / resistance</option>
                    <option value="hiit">HIIT / CrossFit</option>
                    <option value="sports">Team sports / martial arts</option>
                    <option value="hybrid">Hybrid (cardio + weights)</option>
                    <option value="yoga">Yoga / mobility / rehab</option>
                  </select>
                </div>
              </div>
              <div class="psk-row">
                <div class="psk-field">
                  <label>Alcohol Use</label>
                  <select id="psk-alcohol">
                    <option value="">Select</option>
                    <option value="none">None</option>
                    <option value="occasional">Occasional (1–2x/month)</option>
                    <option value="moderate">Moderate (1–2x/week)</option>
                    <option value="frequent">Frequent (3–4x/week)</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
                <div class="psk-field">
                  <label>Smoking / Tobacco / Vaping</label>
                  <select id="psk-smoking">
                    <option value="">Select</option>
                    <option value="none">Non-smoker</option>
                    <option value="former">Former smoker</option>
                    <option value="occasional">Occasional</option>
                    <option value="current">Current smoker</option>
                    <option value="vaping">Vaping</option>
                  </select>
                </div>
              </div>
              <div class="psk-row">
                <div class="psk-field">
                  <label>Occupation Type</label>
                  <select id="psk-occupation">
                    <option value="">Select</option>
                    <option value="desk">Desk / sedentary</option>
                    <option value="standing">Standing / on feet all day</option>
                    <option value="physical">Physically demanding</option>
                    <option value="shift">Shift worker / irregular hours</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
                <div class="psk-field">
                  <label>Sun / Outdoor Exposure</label>
                  <select id="psk-sun">
                    <option value="">Select</option>
                    <option value="low">Minimal (mostly indoors)</option>
                    <option value="moderate">Moderate (1–2 hrs/day)</option>
                    <option value="high">High (outdoor job/lifestyle)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Peptide Experience -->
          <div class="psk-section">
            <div class="psk-section-header" data-section="s-exp">
              <div class="psk-section-icon purple">&#128300;</div>
              <span class="psk-section-title">Peptide Experience</span>
              <span class="psk-section-badge" id="badge-s-exp">Not filled</span>
              <span class="psk-section-chevron" id="chev-s-exp">&#9660;</span>
            </div>
            <div class="psk-section-body" id="body-s-exp">
              <div class="psk-row">
                <div class="psk-field">
                  <label>Experience Level</label>
                  <select id="psk-experience">
                    <option value="">Select</option>
                    <option value="never">Never used peptides</option>
                    <option value="beginner">Beginner (1–2 tried)</option>
                    <option value="intermediate">Intermediate (3–6 cycles)</option>
                    <option value="experienced">Experienced (multiple protocols)</option>
                    <option value="advanced">Advanced / researcher</option>
                  </select>
                </div>
                <div class="psk-field">
                  <label>Admin Route Preference</label>
                  <select id="psk-admin">
                    <option value="">Select</option>
                    <option value="subq">SubQ injections ✓</option>
                    <option value="im">IM injections ✓</option>
                    <option value="both">Both SubQ &amp; IM ✓</option>
                    <option value="oral">Oral / sublingual only</option>
                    <option value="nasal">Nasal spray only</option>
                    <option value="topical">Topical only</option>
                    <option value="no_inject">No injections</option>
                  </select>
                </div>
              </div>
              <div class="psk-field">
                <label>Peptides Currently Using</label>
                <div class="psk-field-hint">List active peptides to avoid duplication or interactions.</div>
                <textarea id="psk-current-peps" placeholder="e.g. BPC-157 250mcg/day, TB-500 2.5mg/week, Semaglutide 0.5mg/week, none…"></textarea>
              </div>
              <div class="psk-field">
                <label>Peptides to Avoid / Had Issues With</label>
                <input type="text" id="psk-avoid" placeholder="e.g. GHRP-6 (hunger sides), CJC-1295 (water retention), none">
              </div>
              <div class="psk-row">
                <div class="psk-field">
                  <label>Monthly Budget (USD)</label>
                  <select id="psk-budget">
                    <option value="">Select</option>
                    <option value="under50">Under $50</option>
                    <option value="50-100">$50 – $100</option>
                    <option value="100-200">$100 – $200</option>
                    <option value="200-400">$200 – $400</option>
                    <option value="400+">$400+</option>
                    <option value="no_limit">No limit</option>
                  </select>
                </div>
                <div class="psk-field">
                  <label>Protocol Duration Goal</label>
                  <select id="psk-duration">
                    <option value="">Select</option>
                    <option value="4wk">4 weeks</option>
                    <option value="8wk">8 weeks</option>
                    <option value="12wk">12 weeks</option>
                    <option value="16wk">16 weeks</option>
                    <option value="ongoing">Ongoing / maintenance</option>
                    <option value="unsure">Not sure yet</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 6. Additional Notes -->
          <div class="psk-section">
            <div class="psk-section-header" data-section="s-notes">
              <div class="psk-section-icon slate">&#128221;</div>
              <span class="psk-section-title">Anything Else?</span>
              <span class="psk-section-badge" id="badge-s-notes">Optional</span>
              <span class="psk-section-chevron" id="chev-s-notes">&#9660;</span>
            </div>
            <div class="psk-section-body" id="body-s-notes">
              <div class="psk-field">
                <label>Additional Notes</label>
                <div class="psk-field-hint">Anything else relevant — past protocols, specific outcomes desired, sensitivities, questions for the AI, etc.</div>
                <textarea id="psk-notes" placeholder="e.g. I've tried GH secretagogues before with good results but want something more targeted for joint repair and skin…" maxlength="500"></textarea>
              </div>
            </div>
          </div>

          <button class="psk-btn-primary" id="psk-submit" disabled>
            Get My Stack Recommendations &#8594;
          </button>

          <div class="psk-divider">or</div>
          <a class="psk-btn-scan" href="${PEPSCAN_URL}" target="_blank" rel="noopener noreferrer">
            &#128247; &nbsp;Scan my face for AI recommendations
          </a>
        </div>

        <!-- Loader -->
        <div class="psk-loader" id="psk-loader">
          <div class="psk-spinner"></div>
          <span class="psk-loader-txt">Analysing your full profile&hellip;</span>
        </div>

        <div class="psk-error" id="psk-error"></div>

        <!-- Results -->
        <div id="psk-results">
          <div id="psk-results-inner"></div>
          <p class="psk-disclaimer">For research purposes only. Not medical advice. Consult a qualified healthcare provider before starting any peptide protocol. Always disclose peptide use to your doctor, especially if you have existing health conditions or take medications.</p>
          <button class="psk-btn-reset" id="psk-reset">&#8592; Try a different profile</button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(container);

  /* ─────────────────────────── REFS ─────────────────────────── */
  const btn             = document.getElementById('psk-btn');
  const overlay         = document.getElementById('psk-overlay');
  const closeBtn        = document.getElementById('psk-close');
  const step1           = document.getElementById('psk-step1');
  const loader          = document.getElementById('psk-loader');
  const results         = document.getElementById('psk-results');
  const inner           = document.getElementById('psk-results-inner');
  const errorEl         = document.getElementById('psk-error');
  const submitBtn       = document.getElementById('psk-submit');
  const resetBtn        = document.getElementById('psk-reset');
  const pill1           = document.getElementById('psk-pill-1');
  const pill2           = document.getElementById('psk-pill-2');
  const ageEl           = document.getElementById('psk-age');
  const sexEl           = document.getElementById('psk-sex');
  const heightEl        = document.getElementById('psk-height');
  const weightEl        = document.getElementById('psk-weight');
  const fitnessEl       = document.getElementById('psk-fitness');
  const bfEl            = document.getElementById('psk-bf');
  const chips           = document.querySelectorAll('#psk-chips .psk-chip');
  const customToggle    = document.getElementById('psk-custom-toggle');
  const customBody      = document.getElementById('psk-custom-body');
  const customChevron   = document.getElementById('psk-custom-chevron');
  const customGoalEl    = document.getElementById('psk-custom-goal');
  const customBadge     = document.getElementById('psk-custom-badge');
  const conditionChips  = document.querySelectorAll('#psk-conditions .psk-chip');
  const condNoneBtn     = document.getElementById('psk-conditions-none');
  const condOtherEl     = document.getElementById('psk-conditions-other');
  const allergiesEl     = document.getElementById('psk-allergies');
  const medsEl          = document.getElementById('psk-meds');
  const labsEl          = document.getElementById('psk-labs');
  const pregnancyEl     = document.getElementById('psk-pregnancy');
  const surgeryEl       = document.getElementById('psk-surgery');
  const familyHxEl      = document.getElementById('psk-family-history');
  const dietEl          = document.getElementById('psk-diet');
  const sleepEl         = document.getElementById('psk-sleep');
  const stressEl        = document.getElementById('psk-stress');
  const alcoholEl       = document.getElementById('psk-alcohol');
  const smokingEl       = document.getElementById('psk-smoking');
  const trainingEl      = document.getElementById('psk-training');
  const occupationEl    = document.getElementById('psk-occupation');
  const sunEl           = document.getElementById('psk-sun');
  const experienceEl    = document.getElementById('psk-experience');
  const adminEl         = document.getElementById('psk-admin');
  const currentPepsEl   = document.getElementById('psk-current-peps');
  const avoidEl         = document.getElementById('psk-avoid');
  const budgetEl        = document.getElementById('psk-budget');
  const durationEl      = document.getElementById('psk-duration');
  const notesEl         = document.getElementById('psk-notes');
  const fillBar         = document.getElementById('psk-fill');
  const pctLabel        = document.getElementById('psk-pct');

  let selectedGoal       = null;
  let selectedConditions = [];
  let conditionsNone     = false;

  /* ─────────────────────────── ACCORDION ─────────────────────── */
  document.querySelectorAll('.psk-section-header').forEach(function (hdr) {
    hdr.addEventListener('click', function () {
      var id   = hdr.dataset.section;
      var body = document.getElementById('body-' + id);
      var chev = document.getElementById('chev-' + id);
      var open = body.classList.contains('psk-show');
      body.classList.toggle('psk-show', !open);
      if (chev) chev.classList.toggle('psk-open', !open);
    });
  });

  /* ─────────────────────────── MODAL ─────────────────────────── */
  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('psk-open')) closeModal();
  });
  function openModal()  { overlay.classList.add('psk-open'); document.body.style.overflow = 'hidden'; }
  function closeModal() {
    overlay.classList.remove('psk-open');
    var chatIframe = document.getElementById('chat-widget-iframe');
    if (!chatIframe || !chatIframe.classList.contains('open')) document.body.style.overflow = '';
  }

  /* ─────────────────────────── GOAL CHIPS ─────────────────────── */
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('psk-sel'); });
      c.classList.add('psk-sel');
      selectedGoal = c.dataset.goal;
      customGoalEl.value = '';
      customBadge.classList.remove('psk-show');
      updateGoalBadge();
      checkReady();
    });
  });
  customToggle.addEventListener('click', function () {
    var open = customBody.classList.contains('psk-show');
    customBody.classList.toggle('psk-show', !open);
    customChevron.classList.toggle('psk-open', !open);
    if (!open) setTimeout(function () { customGoalEl.focus(); }, 60);
  });
  customGoalEl.addEventListener('input', function () {
    var val = customGoalEl.value.trim();
    if (val) {
      chips.forEach(function (x) { x.classList.remove('psk-sel'); });
      selectedGoal = null;
      customBadge.classList.add('psk-show');
    } else {
      customBadge.classList.remove('psk-show');
    }
    updateGoalBadge();
    checkReady();
  });

  /* ─────────────────────────── CONDITION CHIPS ─────────────────── */
  conditionChips.forEach(function (c) {
    c.addEventListener('click', function () {
      conditionsNone = false;
      condNoneBtn.textContent = '✓ None of the above';
      condNoneBtn.style.color = '';
      c.classList.toggle('psk-sel');
      selectedConditions = Array.from(conditionChips)
        .filter(function (x) { return x.classList.contains('psk-sel'); })
        .map(function (x) { return x.dataset.val; });
      tick();
    });
  });
  condNoneBtn.addEventListener('click', function () {
    conditionsNone = !conditionsNone;
    if (conditionsNone) {
      conditionChips.forEach(function (x) { x.classList.remove('psk-sel'); });
      selectedConditions = [];
      condNoneBtn.textContent = '✓ None of the above (selected)';
      condNoneBtn.style.color = '#166534';
    } else {
      condNoneBtn.textContent = '✓ None of the above';
      condNoneBtn.style.color = '';
    }
    tick();
  });

  /* ─────────────────────────── WATCH ALL FIELDS ─────────────────── */
  var watchEls = [ageEl, sexEl, heightEl, weightEl, fitnessEl, bfEl,
    allergiesEl, medsEl, labsEl, pregnancyEl, surgeryEl, familyHxEl, condOtherEl,
    dietEl, sleepEl, stressEl, alcoholEl, smokingEl, trainingEl, occupationEl, sunEl,
    experienceEl, adminEl, currentPepsEl, avoidEl, budgetEl, durationEl, notesEl];

  watchEls.forEach(function (el) {
    el.addEventListener('input',  tick);
    el.addEventListener('change', tick);
  });

  /* ─────────────────────────── TICK (progress + badges + ready) ── */
  function filledVal(el) { return el && el.value.trim() !== ''; }

  function tick() {
    checkReady();
    updateProgress();
    updateAllBadges();
  }

  function getActiveGoal() { return customGoalEl.value.trim() || selectedGoal || null; }

  function checkReady() {
    submitBtn.disabled = !(filledVal(ageEl) && filledVal(sexEl) && filledVal(heightEl) && filledVal(weightEl) && filledVal(fitnessEl) && getActiveGoal());
  }

  function updateProgress() {
    var score = 0, total = 0;
    function add(pts, filled) { total += pts; if (filled) score += pts; }
    // Required (weight 2)
    add(2, filledVal(ageEl)); add(2, filledVal(sexEl));
    add(2, filledVal(heightEl)); add(2, filledVal(weightEl));
    add(2, filledVal(fitnessEl)); add(2, !!getActiveGoal());
    // Health (weight 1.5 each — critical)
    add(1.5, selectedConditions.length > 0 || conditionsNone);
    add(1.5, filledVal(allergiesEl)); add(1.5, filledVal(medsEl));
    add(1, filledVal(pregnancyEl)); add(1, filledVal(labsEl));
    add(0.5, filledVal(surgeryEl)); add(0.5, filledVal(familyHxEl)); add(0.5, filledVal(condOtherEl));
    // Lifestyle (weight 1)
    [dietEl, sleepEl, stressEl, alcoholEl, smokingEl, trainingEl, occupationEl, sunEl].forEach(function (el) { add(1, filledVal(el)); });
    // Experience (weight 1)
    [experienceEl, adminEl, budgetEl, durationEl].forEach(function (el) { add(1, filledVal(el)); });
    // Bonus (weight 0.5)
    [currentPepsEl, avoidEl, notesEl].forEach(function (el) { add(0.5, filledVal(el)); });
    var pct = Math.min(100, Math.round((score / total) * 100));
    fillBar.style.width = pct + '%';
    pctLabel.textContent = pct + '%';
  }

  function updateGoalBadge() {
    var g = getActiveGoal();
    setBadge('s-goal', g ? (g.length > 18 ? g.slice(0, 16) + '…' : g) : null, g ? 'Not set' : 'Not set');
  }

  function setBadge(id, val, emptyText) {
    var b = document.getElementById('badge-' + id);
    if (!b) return;
    if (val) { b.textContent = val; b.classList.add('filled'); }
    else     { b.textContent = emptyText || 'Not filled'; b.classList.remove('filled'); }
  }

  function updateAllBadges() {
    updateGoalBadge();
    // About
    var aboutN = [ageEl, sexEl, heightEl, weightEl, fitnessEl].filter(filledVal).length;
    setBadge('s-about', aboutN === 5 ? 'Complete ✓' : (aboutN > 0 ? aboutN + '/5 filled' : null), 'Required');
    // Health
    var healthN = [allergiesEl, medsEl, pregnancyEl, condOtherEl, labsEl, surgeryEl, familyHxEl].filter(filledVal).length
      + (selectedConditions.length > 0 || conditionsNone ? 1 : 0);
    setBadge('s-health', healthN > 0 ? healthN + ' field' + (healthN > 1 ? 's' : '') + ' filled' : null, 'Not filled');
    // Lifestyle
    var lifeN = [dietEl, sleepEl, stressEl, alcoholEl, smokingEl, trainingEl, occupationEl, sunEl].filter(filledVal).length;
    setBadge('s-lifestyle', lifeN > 0 ? lifeN + '/8 filled' : null, 'Not filled');
    // Exp
    var expN = [experienceEl, adminEl, budgetEl, durationEl].filter(filledVal).length;
    setBadge('s-exp', expN > 0 ? expN + '/4 filled' : null, 'Not filled');
    // Notes
    setBadge('s-notes', filledVal(notesEl) ? 'Added ✓' : null, 'Optional');
  }

  /* ─────────────────────────── SUBMIT ─────────────────────────── */
  submitBtn.addEventListener('click', function () {
    if (submitBtn.disabled) return;
    showLoader();
    fetch(API_URL + '/pepstack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Core
        goal:              getActiveGoal(),
        age:               ageEl.value.trim(),
        sex:               sexEl.value,
        height:            heightEl.value.trim(),
        weight:            weightEl.value.trim(),
        body_fat:          bfEl.value.trim(),
        fitness_level:     fitnessEl.value,
        // Health
        conditions:        selectedConditions,
        conditions_none:   conditionsNone,
        conditions_other:  condOtherEl.value.trim(),
        allergies:         allergiesEl.value.trim(),
        medications:       medsEl.value.trim(),
        labs:              labsEl.value.trim(),
        pregnancy:         pregnancyEl.value,
        surgery:           surgeryEl.value.trim(),
        family_history:    familyHxEl.value.trim(),
        // Lifestyle
        diet:              dietEl.value,
        sleep:             sleepEl.value,
        stress:            stressEl.value,
        alcohol:           alcoholEl.value,
        smoking:           smokingEl.value,
        training:          trainingEl.value,
        occupation:        occupationEl.value,
        sun_exposure:      sunEl.value,
        // Experience
        experience:        experienceEl.value,
        admin_pref:        adminEl.value,
        current_peptides:  currentPepsEl.value.trim(),
        avoid_peptides:    avoidEl.value.trim(),
        budget:            budgetEl.value,
        duration:          durationEl.value,
        // Extra
        notes:             notesEl.value.trim()
      })
    })
    .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .then(function (data) { hideLoader(); renderResults(data); })
    .catch(function (err) {
      hideLoader();
      showError('Could not load recommendations. Please try again.');
      console.error('[PepStack]', err);
    });
  });

  /* ─────────────────────────── RESET ─────────────────────────── */
  resetBtn.addEventListener('click', resetForm);
  function resetForm() {
    results.classList.remove('psk-show');
    inner.innerHTML = ''; errorEl.classList.remove('psk-show');
    chips.forEach(function (c) { c.classList.remove('psk-sel'); });
    conditionChips.forEach(function (c) { c.classList.remove('psk-sel'); });
    selectedGoal = null; selectedConditions = []; conditionsNone = false;
    condNoneBtn.textContent = '✓ None of the above'; condNoneBtn.style.color = '';
    customGoalEl.value = ''; customBadge.classList.remove('psk-show');
    customBody.classList.remove('psk-show'); customChevron.classList.remove('psk-open');
    watchEls.forEach(function (el) { el.value = ''; });
    submitBtn.disabled = true; step1.style.display = '';
    pill1.classList.add('psk-active'); pill2.classList.remove('psk-active');
    fillBar.style.width = '0%'; pctLabel.textContent = '0%';
    updateAllBadges();
    setBadge('s-about', null, 'Required');
    setBadge('s-goal',  null, 'Not set');
  }

  function showLoader() {
    step1.style.display = 'none'; loader.classList.add('psk-show');
    errorEl.classList.remove('psk-show'); results.classList.remove('psk-show');
    pill2.classList.add('psk-active');
  }
  function hideLoader() { loader.classList.remove('psk-show'); }
  function showError(msg) {
    step1.style.display = ''; pill2.classList.remove('psk-active');
    errorEl.textContent = msg; errorEl.classList.add('psk-show');
  }

  /* ─────────────────────────── RENDER RESULTS ─────────────────── */
  function renderResults(data) {
    var html = '';
    if (data.warnings && data.warnings.length) {
      data.warnings.forEach(function (w) {
        html += '<div class="psk-warning"><span class="psk-warning-icon">&#9888;&#65039;</span><span>' + esc(w) + '</span></div>';
      });
    }
    if (data.summary) html += '<div class="psk-result-intro">' + esc(data.summary) + '</div>';
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
    if (data.tip) html += '<div class="psk-tip"><span class="psk-tip-icon">&#128161;</span><span class="psk-tip-text"><strong>Stack tip:</strong> ' + esc(data.tip) + '</span></div>';
    inner.innerHTML = html;
    results.classList.add('psk-show');
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  console.log('✅ PepStack widget loaded (full profile mode)');
})();