(function () {
  'use strict';

  if (!window.PepStackConfig) {
    console.error('[PepStack] PepStackConfig not found.');
    return;
  }

  const config      = window.PepStackConfig;
  const API_URL     = config.apiUrl || 'https://chat-support-pro.onrender.com';
  const PEPSCAN_URL = config.pepScanUrl || 'https://pepscan.app';

  const style = document.createElement('style');
  style.textContent = `
  #psk-btn {
    position: fixed;
    bottom: 82px;
    left: 20px;
    z-index: 99990;
    background: #ffffff;
    color: #111827;
    border: 1.5px solid #e5e7eb;
    border-radius: 24px;
    padding: 10px 18px 10px 14px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 2px 14px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06);
    transition: box-shadow 0.18s, transform 0.12s, border-color 0.18s;
  }
  #psk-btn:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.13); border-color: #3bbe28; transform: translateY(-2px); }
  #psk-btn:active { transform: translateY(0); }
  #psk-btn .psk-dot {
    width: 7px; height: 7px;
    background: #3bbe28; border-radius: 50%; flex-shrink: 0;
    animation: psk-pulse 2.2s ease-in-out infinite;
  }
  @keyframes psk-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.35; transform:scale(.72); }
  }
  #psk-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(17,24,39,0.52); z-index: 99995;
    align-items: center; justify-content: center;
    backdrop-filter: blur(6px);
  }
  #psk-overlay.psk-open { display: flex; animation: psk-fadein .22s ease-out; }
  @keyframes psk-fadein { from{opacity:0} to{opacity:1} }
  #psk-modal {
    background: #ffffff; border-radius: 22px;
    width: 94%; max-width: 488px; max-height: 92vh;
    overflow-y: auto; padding: 32px 30px 28px; position: relative;
    animation: psk-slideup .3s cubic-bezier(.22,1,.36,1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #111827;
    box-shadow: 0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08);
    scrollbar-width: thin; scrollbar-color: #e5e7eb transparent;
  }
  @keyframes psk-slideup {
    from { opacity:0; transform:translateY(22px) scale(.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  .psk-close {
    position: absolute; top: 18px; right: 18px;
    background: #f3f4f6; border: none; border-radius: 50%;
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #6b7280; font-size: 15px;
    transition: background .14s, color .14s; line-height: 1;
  }
  .psk-close:hover { background: #e5e7eb; color: #111827; }
  .psk-steps { display: flex; gap: 5px; margin-bottom: 26px; }
  .psk-step-pill { height: 3px; flex: 1; border-radius: 99px; background: #f3f4f6; transition: background .35s; }
  .psk-step-pill.psk-active { background: #3bbe28; }
  .psk-logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .psk-logo-icon {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    border: 1.5px solid #bbf7d0; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .psk-logo-label { display: flex; flex-direction: column; gap: 1px; }
  .psk-logo-text { font-size: 14px; font-weight: 800; color: #111827; letter-spacing: -.2px; }
  .psk-logo-sub  { font-size: 10px; font-weight: 500; color: #6b7280; letter-spacing: .3px; text-transform: uppercase; }
  .psk-heading { font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 6px; line-height: 1.2; letter-spacing: -.3px; }
  .psk-sub     { font-size: 13.5px; color: #6b7280; margin: 0 0 24px; line-height: 1.55; }
  .psk-field { margin-bottom: 14px; }
  .psk-field label {
    display: block; font-size: 11px; font-weight: 700;
    letter-spacing: .65px; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px;
  }
  .psk-field input,
  .psk-field select {
    width: 100%; background: #f9fafb; border: 1.5px solid #e5e7eb;
    border-radius: 10px; padding: 11px 14px; font-size: 14px;
    color: #111827; outline: none; box-sizing: border-box;
    font-family: inherit; transition: border-color .15s, box-shadow .15s, background .15s;
    -webkit-appearance: none; appearance: none;
  }
  .psk-field input::placeholder { color: #d1d5db; }
  .psk-field input:focus,
  .psk-field select:focus { border-color: #3bbe28; box-shadow: 0 0 0 3px rgba(59,190,40,0.12); background: #ffffff; }
  .psk-field select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239ca3af'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center;
    padding-right: 36px; cursor: pointer;
  }
  .psk-field select option { background: #ffffff; color: #111827; }
  .psk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .psk-goal-label {
    font-size: 11px; font-weight: 700; letter-spacing: .65px;
    text-transform: uppercase; color: #9ca3af; margin: 0 0 10px;
  }
  .psk-chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .psk-chip {
    background: #f9fafb; border: 1.5px solid #e5e7eb; border-radius: 99px;
    padding: 7px 15px; font-size: 12px; font-weight: 500;
    color: #374151; cursor: pointer; transition: all .14s; user-select: none;
  }
  .psk-chip:hover { border-color: #3bbe28; color: #166534; background: #f0fdf4; }
  .psk-chip.psk-sel {
    background: #f0fdf4; border-color: #3bbe28; color: #166534;
    font-weight: 700; box-shadow: 0 0 0 3px rgba(59,190,40,0.10);
  }
  .psk-btn-primary {
    width: 100%; background: #3bbe28; border: none; border-radius: 12px;
    padding: 14px; font-size: 14.5px; font-weight: 700; color: #ffffff;
    cursor: pointer; transition: background .16s, transform .1s, box-shadow .16s;
    letter-spacing: .1px; margin-top: 20px; font-family: inherit;
    box-shadow: 0 4px 14px rgba(59,190,40,0.30);
  }
  .psk-btn-primary:hover:not(:disabled) { background: #33a822; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,190,40,0.38); }
  .psk-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .psk-btn-primary:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }
  .psk-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 18px 0 14px; color: #d1d5db; font-size: 12px; font-weight: 500;
  }
  .psk-divider::before,
  .psk-divider::after { content:''; flex:1; height:1px; background:#f3f4f6; }
  .psk-btn-scan {
    width: 100%; background: #f9fafb; border: 1.5px solid #e5e7eb;
    border-radius: 12px; padding: 12px 14px; font-size: 13px;
    font-weight: 600; color: #374151; cursor: pointer;
    transition: border-color .14s, color .14s, background .14s;
    display: flex; align-items: center; justify-content: center;
    gap: 8px; font-family: inherit; text-decoration: none;
  }
  .psk-btn-scan:hover { border-color: #3bbe28; color: #166534; background: #f0fdf4; }
  .psk-loader { display: none; flex-direction: column; align-items: center; padding: 44px 0 32px; gap: 16px; }
  .psk-loader.psk-show { display: flex; }
  .psk-spinner {
    width: 40px; height: 40px;
    border: 3px solid #f3f4f6; border-top-color: #3bbe28;
    border-radius: 50%; animation: psk-spin .72s linear infinite;
  }
  @keyframes psk-spin { to { transform: rotate(360deg); } }
  .psk-loader-txt { font-size: 13px; color: #9ca3af; font-weight: 500; }
  #psk-results { display: none; }
  #psk-results.psk-show { display: block; }
  .psk-result-intro {
    background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px;
    padding: 15px 17px; font-size: 13.5px; line-height: 1.7;
    color: #166534; margin-bottom: 18px;
  }
  .psk-stack-label {
    font-size: 10.5px; font-weight: 700; letter-spacing: .7px;
    text-transform: uppercase; color: #9ca3af; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .psk-stack-label::after { content:''; flex:1; height:1px; background:#f3f4f6; }
  .psk-stack-cards { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
  .psk-card {
    background: #ffffff; border: 1.5px solid #f3f4f6; border-radius: 14px;
    padding: 15px 17px; display: flex; align-items: flex-start; gap: 14px;
    transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .psk-card:hover { border-color: #bbf7d0; box-shadow: 0 4px 12px rgba(59,190,40,0.08); }
  .psk-card-num {
    width: 28px; height: 28px; background: #3bbe28; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800; color: #ffffff;
    flex-shrink: 0; margin-top: 1px;
    box-shadow: 0 2px 6px rgba(59,190,40,0.30);
  }
  .psk-card-body { flex: 1; min-width: 0; }
  .psk-card-name { font-size: 14.5px; font-weight: 800; color: #111827; margin: 0 0 4px; }
  .psk-card-why  { font-size: 12.5px; color: #4b5563; line-height: 1.6; margin: 0 0 6px; }
  .psk-card-dose {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; color: #6b7280;
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 6px; padding: 3px 8px;
  }
  .psk-tip {
    background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px;
    padding: 13px 16px; font-size: 12.5px; line-height: 1.65;
    color: #78350f; margin-bottom: 18px;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .psk-tip-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
  .psk-tip-text { flex: 1; }
  .psk-tip strong { color: #92400e; font-weight: 700; }
  .psk-disclaimer {
    font-size: 11px; color: #9ca3af; line-height: 1.6;
    padding-top: 14px; border-top: 1px solid #f3f4f6; margin-bottom: 14px;
  }
  .psk-btn-reset {
    background: transparent; border: 1.5px solid #e5e7eb; border-radius: 9px;
    padding: 8px 16px; font-size: 12px; color: #6b7280;
    cursor: pointer; font-family: inherit; transition: border-color .14s, color .14s;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .psk-btn-reset:hover { border-color: #3bbe28; color: #166534; }
  .psk-error {
    display: none; background: #fef2f2; border: 1.5px solid #fecaca;
    border-radius: 10px; padding: 13px 16px; font-size: 13px;
    color: #dc2626; margin-top: 14px; line-height: 1.5;
  }
  .psk-error.psk-show { display: block; }
  @media (max-width: 480px) {
    #psk-modal { padding: 24px 20px 22px; border-radius: 18px; }
    .psk-heading { font-size: 19px; }
    .psk-row { grid-template-columns: 1fr; gap: 0; }
    #psk-btn { font-size: 12px; padding: 9px 14px 9px 11px; bottom: 82px; left: 20px; }
  }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'pepstack-widget';
  container.innerHTML = `
    <button id="psk-btn" aria-label="Get PepStack recommendations">
      <span class="psk-dot"></span>
      PepStack Recs
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
          <p class="psk-sub">Enter your details and we'll recommend the right protocol for your body and goals.</p>

          <div class="psk-row">
            <div class="psk-field">
              <label>Age</label>
              <input type="number" id="psk-age" placeholder="e.g. 34" min="18" max="99">
            </div>
            <div class="psk-field">
              <label>Biological Sex</label>
              <select id="psk-sex">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div class="psk-row">
            <div class="psk-field">
              <label>Height</label>
              <input type="text" id="psk-height" placeholder="5'10 or 178cm">
            </div>
            <div class="psk-field">
              <label>Weight</label>
              <input type="text" id="psk-weight" placeholder="185lbs or 84kg">
            </div>
          </div>

          <div class="psk-field">
            <p class="psk-goal-label">Primary Goal</p>
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
              <div class="psk-chip" data-goal="General Wellness">General Wellness</div>
            </div>
          </div>

          <button class="psk-btn-primary" id="psk-submit" disabled>
            Get My Stack Recommendations &#8594;
          </button>

          <div class="psk-divider">or</div>

          <a class="psk-btn-scan" id="psk-scan-link" href="${PEPSCAN_URL}" target="_blank" rel="noopener noreferrer">
            &#128247; &nbsp;Scan my face for AI recommendations
          </a>
        </div>

        <div class="psk-loader" id="psk-loader">
          <div class="psk-spinner"></div>
          <span class="psk-loader-txt">Analysing your profile&hellip;</span>
        </div>

        <div class="psk-error" id="psk-error"></div>

        <div id="psk-results">
          <div id="psk-results-inner"></div>
          <p class="psk-disclaimer">For research purposes only. Not medical advice. Consult a qualified healthcare provider before starting any peptide protocol.</p>
          <button class="psk-btn-reset" id="psk-reset">&#8592; Try a different goal</button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(container);

  const btn       = document.getElementById('psk-btn');
  const overlay   = document.getElementById('psk-overlay');
  const closeBtn  = document.getElementById('psk-close');
  const step1     = document.getElementById('psk-step1');
  const loader    = document.getElementById('psk-loader');
  const results   = document.getElementById('psk-results');
  const inner     = document.getElementById('psk-results-inner');
  const errorEl   = document.getElementById('psk-error');
  const submitBtn = document.getElementById('psk-submit');
  const resetBtn  = document.getElementById('psk-reset');
  const pill1     = document.getElementById('psk-pill-1');
  const pill2     = document.getElementById('psk-pill-2');
  const ageEl     = document.getElementById('psk-age');
  const sexEl     = document.getElementById('psk-sex');
  const heightEl  = document.getElementById('psk-height');
  const weightEl  = document.getElementById('psk-weight');
  const chips     = document.querySelectorAll('.psk-chip');

  let selectedGoal = null;

  btn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('psk-open')) closeModal();
  });

  function openModal() {
    overlay.classList.add('psk-open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    overlay.classList.remove('psk-open');
    const chatIframe = document.getElementById('chat-widget-iframe');
    if (!chatIframe || !chatIframe.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('psk-sel'); });
      c.classList.add('psk-sel');
      selectedGoal = c.dataset.goal;
      checkReady();
    });
  });

  [ageEl, sexEl, heightEl, weightEl].forEach(function (el) {
    el.addEventListener('input', checkReady);
    el.addEventListener('change', checkReady);
  });

  function checkReady() {
    submitBtn.disabled = !(ageEl.value.trim() && sexEl.value && heightEl.value.trim() && weightEl.value.trim() && selectedGoal);
  }

  submitBtn.addEventListener('click', function () {
    if (submitBtn.disabled) return;
    showLoader();
    fetch(API_URL + '/pepstack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal:   selectedGoal,
        age:    ageEl.value.trim(),
        sex:    sexEl.value,
        height: heightEl.value.trim(),
        weight: weightEl.value.trim()
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.json();
    })
    .then(function (data) { hideLoader(); renderResults(data); })
    .catch(function (err) {
      hideLoader();
      showError('Could not load recommendations. Please try again.');
      console.error('[PepStack]', err);
    });
  });

  resetBtn.addEventListener('click', resetForm);

  function resetForm() {
    results.classList.remove('psk-show');
    inner.innerHTML = '';
    errorEl.classList.remove('psk-show');
    chips.forEach(function (c) { c.classList.remove('psk-sel'); });
    ageEl.value = ''; sexEl.value = ''; heightEl.value = ''; weightEl.value = '';
    selectedGoal = null; submitBtn.disabled = true; step1.style.display = '';
    pill1.classList.add('psk-active'); pill2.classList.remove('psk-active');
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

  function renderResults(data) {
    var html = '';
    if (data.summary) {
      html += '<div class="psk-result-intro">' + esc(data.summary) + '</div>';
    }
    if (data.stack && data.stack.length) {
      html += '<p class="psk-stack-label">Your recommended stack</p>';
      html += '<div class="psk-stack-cards">';
      data.stack.forEach(function (item, i) {
        html += '<div class="psk-card">';
        html += '<div class="psk-card-num">' + (i + 1) + '</div>';
        html += '<div class="psk-card-body">';
        html += '<p class="psk-card-name">' + esc(item.name) + '</p>';
        if (item.why)  html += '<p class="psk-card-why">' + esc(item.why) + '</p>';
        if (item.dose) html += '<span class="psk-card-dose">&#128200; ' + esc(item.dose) + '</span>';
        html += '</div></div>';
      });
      html += '</div>';
    }
    if (data.tip) {
      html += '<div class="psk-tip"><span class="psk-tip-icon">&#128161;</span><span class="psk-tip-text"><strong>Stack tip:</strong> ' + esc(data.tip) + '</span></div>';
    }
    inner.innerHTML = html;
    results.classList.add('psk-show');
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  console.log('✅ PepStack widget loaded');
})();