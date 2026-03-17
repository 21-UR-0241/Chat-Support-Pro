(function () {
  'use strict';

  if (!window.PepStackConfig) {
    console.error('[PepStack] PepStackConfig not found.');
    return;
  }

  const config      = window.PepStackConfig;
  const API_URL     = config.apiUrl || 'https://chat-support-pro.onrender.com';
  const PEPSCAN_URL = config.pepScanUrl || 'https://pepscan.app';

  // ── Inject styles ────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
  #psk-btn {
    position: fixed;
    bottom: 82px;
    left: 20px;
    z-index: 99990;
    background: #ffffff;
    color: #1a1a1a;
    border: 1.5px solid #e2e8f0;
    border-radius: 22px;
    padding: 9px 16px 9px 13px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 2px 12px rgba(0,0,0,0.10);
    transition: box-shadow 0.16s, transform 0.12s, border-color 0.16s;
  }
  #psk-btn:hover { box-shadow: 0 4px 18px rgba(0,0,0,0.14); border-color: #3bbe28; transform: translateY(-2px); }
  #psk-btn:active { transform: translateY(0); }
  #psk-btn .psk-dot {
    width: 7px; height: 7px;
    background: #3bbe28;
    border-radius: 50%;
    flex-shrink: 0;
    animation: psk-pulse 2.4s ease-in-out infinite;
  }
  @keyframes psk-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.4; transform:scale(.75); }
  }
  #psk-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,0.55);
    z-index: 99995;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  #psk-overlay.psk-open { display: flex; animation: psk-fadein .2s ease-out; }
  @keyframes psk-fadein { from{opacity:0} to{opacity:1} }
  #psk-modal {
    background: #ffffff;
    border: 1px solid #e8edf2;
    border-radius: 20px;
    width: 94%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 30px 28px 26px;
    position: relative;
    animation: psk-slideup .28s cubic-bezier(.22,1,.36,1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1a1a1a;
    box-shadow: 0 20px 60px rgba(0,0,0,0.14);
    scrollbar-width: thin;
    scrollbar-color: #e2e8f0 transparent;
  }
  @keyframes psk-slideup {
    from { opacity:0; transform:translateY(20px) scale(.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  .psk-close {
    position: absolute; top: 16px; right: 16px;
    background: #f5f7fa; border: 1px solid #e2e8f0;
    border-radius: 50%; width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #64748b; font-size: 16px;
    transition: background .14s, color .14s; line-height: 1;
  }
  .psk-close:hover { background: #e8edf2; color: #1a1a1a; }
  .psk-steps { display: flex; gap: 6px; margin-bottom: 24px; }
  .psk-step-pill {
    height: 3px; flex: 1; border-radius: 3px;
    background: #e8edf2; transition: background .3s;
  }
  .psk-step-pill.psk-active { background: #3bbe28; }
  .psk-logo-row { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; }
  .psk-logo-icon {
    width: 34px; height: 34px; background: #f0faf0;
    border: 1.5px solid #d1f0cc; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; font-size: 17px;
  }
  .psk-logo-text { font-size: 14px; font-weight: 700; color: #1a1a1a; letter-spacing: .2px; }
  .psk-heading { font-size: 21px; font-weight: 700; color: #0f172a; margin: 0 0 5px; line-height: 1.25; }
  .psk-sub    { font-size: 13px; color: #64748b; margin: 0 0 22px; line-height: 1.5; }
  .psk-field  { margin-bottom: 14px; }
  .psk-field label {
    display: block; font-size: 11px; font-weight: 700;
    letter-spacing: .7px; text-transform: uppercase;
    color: #94a3b8; margin-bottom: 6px;
  }
  .psk-field input,
  .psk-field select,
  .psk-field textarea {
    width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0;
    border-radius: 9px; padding: 11px 13px; font-size: 14px;
    color: #1a1a1a; outline: none; box-sizing: border-box;
    font-family: inherit; transition: border-color .14s, box-shadow .14s;
    -webkit-appearance: none; appearance: none;
  }
  .psk-field input::placeholder,
  .psk-field textarea::placeholder { color: #cbd5e1; }
  .psk-field input:focus,
  .psk-field select:focus,
  .psk-field textarea:focus { border-color: #3bbe28; box-shadow: 0 0 0 3px rgba(59,190,40,0.10); background: #fff; }
  .psk-field select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 13px center;
    padding-right: 34px; cursor: pointer;
  }
  .psk-field select option { background: #ffffff; color: #1a1a1a; }
  .psk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .psk-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 6px; }
  .psk-chip {
    background: #f8fafc; border: 1.5px solid #e2e8f0;
    border-radius: 18px; padding: 6px 14px;
    font-size: 12px; font-weight: 500; color: #475569; cursor: pointer;
    transition: all .14s; user-select: none;
  }
  .psk-chip:hover { border-color: #3bbe28; color: #22863a; background: #f0faf0; }
  .psk-chip.psk-sel {
    background: #f0faf0; border-color: #3bbe28;
    color: #22863a; font-weight: 700;
  }
  .psk-btn-primary {
    width: 100%; background: #3bbe28; border: none;
    border-radius: 10px; padding: 13px; font-size: 14px;
    font-weight: 700; color: #ffffff; cursor: pointer;
    transition: background .16s, transform .1s, box-shadow .16s; letter-spacing: .2px;
    margin-top: 18px; font-family: inherit;
    box-shadow: 0 2px 10px rgba(59,190,40,0.25);
  }
  .psk-btn-primary:hover:not(:disabled) { background: #33a822; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59,190,40,0.35); }
  .psk-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .psk-btn-primary:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
  .psk-scan-divider {
    display: flex; align-items: center; gap: 10px;
    margin: 16px 0; color: #cbd5e1; font-size: 12px;
  }
  .psk-scan-divider::before,
  .psk-scan-divider::after { content:''; flex:1; height:1px; background:#e8edf2; }
  .psk-btn-scan {
    width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0;
    border-radius: 10px; padding: 11px 13px; font-size: 13px;
    font-weight: 600; color: #475569; cursor: pointer;
    transition: border-color .14s, color .14s, background .14s;
    display: flex; align-items: center; justify-content: center;
    gap: 8px; font-family: inherit; text-decoration: none;
  }
  .psk-btn-scan:hover { border-color: #3bbe28; color: #22863a; background: #f0faf0; }
  .psk-loader {
    display: none; flex-direction: column;
    align-items: center; padding: 40px 0 28px; gap: 14px;
  }
  .psk-loader.psk-show { display: flex; }
  .psk-spinner {
    width: 38px; height: 38px;
    border: 2.5px solid #e8edf2; border-top-color: #3bbe28;
    border-radius: 50%; animation: psk-spin .75s linear infinite;
  }
  @keyframes psk-spin { to { transform: rotate(360deg); } }
  .psk-loader-txt { font-size: 13px; color: #94a3b8; }
  #psk-results { display: none; }
  #psk-results.psk-show { display: block; }
  .psk-result-intro {
    background: #f0faf0; border: 1.5px solid #d1f0cc; border-radius: 11px;
    padding: 14px 16px; font-size: 13px; line-height: 1.7;
    color: #1a4a1a; margin-bottom: 16px;
  }
  .psk-stack-label {
    font-size: 11px; font-weight: 700; letter-spacing: .7px;
    text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;
  }
  .psk-stack-cards { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
  .psk-card {
    background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 11px;
    padding: 14px 16px; display: flex; align-items: flex-start; gap: 13px;
    transition: border-color .14s;
  }
  .psk-card:hover { border-color: #d1f0cc; }
  .psk-card-num {
    width: 26px; height: 26px; background: #3bbe28;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #ffffff;
    flex-shrink: 0; margin-top: 1px;
  }
  .psk-card-body { flex: 1; min-width: 0; }
  .psk-card-name { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
  .psk-card-why  { font-size: 12px; color: #475569; line-height: 1.55; margin: 0 0 5px; }
  .psk-card-dose { font-size: 11px; color: #94a3b8; font-style: italic; }
  .psk-tip {
    background: #f8fafc; border-left: 3px solid #3bbe28;
    border-radius: 0 8px 8px 0; padding: 12px 15px;
    font-size: 12px; line-height: 1.65; color: #475569; margin-bottom: 16px;
  }
  .psk-tip strong { color: #1a1a1a; font-weight: 700; }
  .psk-disclaimer {
    font-size: 11px; color: #94a3b8; line-height: 1.55;
    padding-top: 12px; border-top: 1px solid #e8edf2; margin-bottom: 14px;
  }
  .psk-btn-reset {
    background: transparent; border: 1.5px solid #e2e8f0; border-radius: 8px;
    padding: 8px 15px; font-size: 12px; color: #64748b;
    cursor: pointer; font-family: inherit; transition: border-color .14s, color .14s;
  }
  .psk-btn-reset:hover { border-color: #3bbe28; color: #22863a; }
  .psk-error {
    display: none; background: #fff5f5; border: 1.5px solid #fed7d7;
    border-radius: 9px; padding: 13px 15px; font-size: 13px;
    color: #c53030; margin-top: 14px;
  }
  .psk-error.psk-show { display: block; }
  @media (max-width: 480px) {
    #psk-modal { padding: 22px 18px 20px; }
    .psk-heading { font-size: 18px; }
    .psk-row { grid-template-columns: 1fr; gap: 0; }
    #psk-btn { font-size: 12px; padding: 8px 13px 8px 10px; bottom: 82px; left: 20px; }
  }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ───────────────────────────────────────────────────────────────
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
          <span class="psk-logo-text">PepStack</span>
        </div>

        <div id="psk-step1">
          <h2 class="psk-heading" id="psk-title">Build your peptide stack</h2>
          <p class="psk-sub">Enter your details for a personalised protocol recommendation</p>

          <div class="psk-row">
            <div class="psk-field">
              <label>Age</label>
              <input type="number" id="psk-age" placeholder="e.g. 34" min="18" max="99">
            </div>
            <div class="psk-field">
              <label>Biological sex</label>
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
              <input type="text" id="psk-height" placeholder="e.g. 5'10 or 178cm">
            </div>
            <div class="psk-field">
              <label>Weight</label>
              <input type="text" id="psk-weight" placeholder="e.g. 185lbs or 84kg">
            </div>
          </div>

          <div class="psk-field">
            <label>Primary goal</label>
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

          <div class="psk-scan-divider">or</div>

          <a class="psk-btn-scan" id="psk-scan-link" href="${PEPSCAN_URL}" target="_blank" rel="noopener noreferrer">
            &#128247; Scan my face for AI recommendations
          </a>
        </div>

        <div class="psk-loader" id="psk-loader">
          <div class="psk-spinner"></div>
          <span class="psk-loader-txt">Analysing your profile and building your stack&hellip;</span>
        </div>

        <div class="psk-error" id="psk-error"></div>

        <div id="psk-results">
          <div id="psk-results-inner"></div>
          <p class="psk-disclaimer">For research purposes only. Not medical advice. Consult a qualified healthcare provider before use.</p>
          <button class="psk-btn-reset" id="psk-reset">&#8592; Start over</button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(container);

  // ── Wire up logic ─────────────────────────────────────────────────────────────
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

  // open / close
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
    document.body.style.overflow = '';
  }

  // chips
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('psk-sel'); });
      c.classList.add('psk-sel');
      selectedGoal = c.dataset.goal;
      checkReady();
    });
  });

  // field validation
  [ageEl, sexEl, heightEl, weightEl].forEach(function (el) {
    el.addEventListener('input', checkReady);
    el.addEventListener('change', checkReady);
  });

  function checkReady() {
    var ready = ageEl.value.trim() && sexEl.value && heightEl.value.trim() && weightEl.value.trim() && selectedGoal;
    submitBtn.disabled = !ready;
  }

  // submit
  submitBtn.addEventListener('click', function () {
    if (submitBtn.disabled) return;

    var payload = {
      goal:   selectedGoal,
      age:    ageEl.value.trim(),
      sex:    sexEl.value,
      height: heightEl.value.trim(),
      weight: weightEl.value.trim()
    };

    showLoader();

    fetch(API_URL + '/pepstack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.json();
    })
    .then(function (data) {
      hideLoader();
      renderResults(data);
    })
    .catch(function (err) {
      hideLoader();
      showError('Could not load recommendations. Please try again.');
      console.error('[PepStack]', err);
    });
  });

  // reset
  resetBtn.addEventListener('click', resetForm);

  function resetForm() {
    results.classList.remove('psk-show');
    inner.innerHTML = '';
    errorEl.classList.remove('psk-show');
    chips.forEach(function (c) { c.classList.remove('psk-sel'); });
    ageEl.value = '';
    sexEl.value = '';
    heightEl.value = '';
    weightEl.value = '';
    selectedGoal = null;
    submitBtn.disabled = true;
    step1.style.display = '';
    pill1.classList.add('psk-active');
    pill2.classList.remove('psk-active');
  }

  // states
  function showLoader() {
    step1.style.display = 'none';
    loader.classList.add('psk-show');
    errorEl.classList.remove('psk-show');
    results.classList.remove('psk-show');
    pill2.classList.add('psk-active');
  }
  function hideLoader() {
    loader.classList.remove('psk-show');
  }
  function showError(msg) {
    step1.style.display = '';
    pill2.classList.remove('psk-active');
    errorEl.textContent = msg;
    errorEl.classList.add('psk-show');
  }

  // render
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
        if (item.why)  html += '<p class="psk-card-why">'  + esc(item.why)  + '</p>';
        if (item.dose) html += '<p class="psk-card-dose">' + esc(item.dose) + '</p>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    if (data.tip) {
      html += '<div class="psk-tip"><strong>Stack tip:</strong> ' + esc(data.tip) + '</div>';
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