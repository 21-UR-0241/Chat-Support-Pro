(function () {
  'use strict';

  if (!window.PepStackConfig) {
    console.error('[PepStack] PepStackConfig not found.');
    return;
  }

  const config      = window.PepStackConfig;
  const API_URL     = config.apiUrl || 'https://chat-support-pro.onrender.com';
  const PEPSCAN_URL = config.pepScanUrl || 'https://pepscan.app';

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
  #psk-btn {
    position: fixed; bottom: 82px; left: 20px; z-index: 99990;
    background: #ffffff; color: #111827; border: 1.5px solid #e5e7eb;
    border-radius: 24px; padding: 10px 18px 10px 14px; font-size: 13px;
    font-weight: 600; cursor: pointer; display: flex; align-items: center;
    gap: 8px; white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 2px 14px rgba(0,0,0,0.10); transition: box-shadow .18s, transform .12s, border-color .18s;
  }
  #psk-btn:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.13); border-color: #3bbe28; transform: translateY(-2px); }
  #psk-btn:active { transform: translateY(0); }
  #psk-btn .psk-dot {
    width: 7px; height: 7px; background: #3bbe28; border-radius: 50%; flex-shrink: 0;
    animation: psk-pulse 2.2s ease-in-out infinite;
  }
  @keyframes psk-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.72)} }

  #psk-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(17,24,39,0.50); z-index: 99995;
    align-items: flex-end; justify-content: flex-start;
    padding: 0 0 0 20px;
  }
  #psk-overlay.psk-open { display: flex; animation: psk-fadein .2s ease-out; }
  @keyframes psk-fadein { from{opacity:0} to{opacity:1} }

  #psk-window {
    background: #ffffff; border-radius: 18px 18px 18px 4px;
    width: 360px; max-width: calc(100vw - 40px);
    height: 540px; max-height: calc(100vh - 120px);
    display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
    animation: psk-slideup .3s cubic-bezier(.22,1,.36,1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden; margin-bottom: 20px;
  }
  @keyframes psk-slideup { from{opacity:0;transform:translateY(16px) scale(.97)} to{opacity:1;transform:none} }

  #psk-header {
    background: #ffffff; border-bottom: 1px solid #f3f4f6;
    padding: 14px 16px; display: flex; align-items: center;
    gap: 10px; flex-shrink: 0;
  }
  .psk-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(135deg, #3bbe28, #22a018);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; flex-shrink: 0;
  }
  .psk-header-info { flex: 1; min-width: 0; }
  .psk-header-name { font-size: 14px; font-weight: 700; color: #111827; }
  .psk-header-status { font-size: 11px; color: #3bbe28; font-weight: 500; display: flex; align-items: center; gap: 4px; }
  .psk-status-dot { width: 6px; height: 6px; background: #3bbe28; border-radius: 50%; display: inline-block; }
  .psk-close {
    background: #f3f4f6; border: none; border-radius: 50%;
    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #6b7280; font-size: 14px; transition: background .14s, color .14s;
    flex-shrink: 0;
  }
  .psk-close:hover { background: #e5e7eb; color: #111827; }

  #psk-messages {
    flex: 1; overflow-y: auto; padding: 16px 14px 8px;
    display: flex; flex-direction: column; gap: 10px;
    scrollbar-width: thin; scrollbar-color: #e5e7eb transparent;
  }

  .psk-msg { display: flex; gap: 8px; align-items: flex-end; max-width: 100%; }
  .psk-msg.psk-ai  { justify-content: flex-start; }
  .psk-msg.psk-usr { justify-content: flex-end; }

  .psk-msg-avatar {
    width: 26px; height: 26px; border-radius: 50%;
    background: linear-gradient(135deg, #3bbe28, #22a018);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; flex-shrink: 0; margin-bottom: 2px;
  }

  .psk-bubble {
    max-width: 78%; padding: 10px 13px; border-radius: 16px;
    font-size: 13.5px; line-height: 1.55; word-break: break-word;
  }
  .psk-ai .psk-bubble {
    background: #f3f4f6; color: #111827;
    border-bottom-left-radius: 4px;
  }
  .psk-usr .psk-bubble {
    background: #3bbe28; color: #ffffff;
    border-bottom-right-radius: 4px;
  }

  .psk-bubble-time {
    font-size: 10px; color: #9ca3af; margin-top: 3px; padding: 0 4px;
  }
  .psk-ai .psk-bubble-time  { text-align: left; }
  .psk-usr .psk-bubble-time { text-align: right; }

  .psk-msg-col { display: flex; flex-direction: column; max-width: 78%; }
  .psk-usr .psk-msg-col { align-items: flex-end; }
  .psk-ai  .psk-msg-col { align-items: flex-start; }

  .psk-typing {
    display: flex; align-items: center; gap: 4px;
    background: #f3f4f6; padding: 10px 14px; border-radius: 16px;
    border-bottom-left-radius: 4px; width: fit-content;
  }
  .psk-typing span {
    width: 6px; height: 6px; background: #9ca3af; border-radius: 50%;
    animation: psk-bounce .9s ease-in-out infinite;
  }
  .psk-typing span:nth-child(2) { animation-delay: .15s; }
  .psk-typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes psk-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

  .psk-chips-row {
    display: flex; flex-wrap: wrap; gap: 6px;
    padding: 4px 0 2px;
  }
  .psk-qchip {
    background: #ffffff; border: 1.5px solid #e5e7eb; border-radius: 99px;
    padding: 6px 14px; font-size: 12px; font-weight: 500; color: #374151;
    cursor: pointer; transition: all .14s; user-select: none;
    font-family: inherit;
  }
  .psk-qchip:hover { border-color: #3bbe28; color: #166534; background: #f0fdf4; }
  .psk-qchip:active { transform: scale(.97); }

  #psk-input-row {
    padding: 10px 12px 12px; border-top: 1px solid #f3f4f6;
    display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
  }
  #psk-input {
    flex: 1; background: #f9fafb; border: 1.5px solid #e5e7eb;
    border-radius: 22px; padding: 9px 14px; font-size: 13.5px;
    color: #111827; outline: none; resize: none; overflow: hidden;
    font-family: inherit; line-height: 1.4; max-height: 80px;
    transition: border-color .15s, box-shadow .15s;
  }
  #psk-input::placeholder { color: #d1d5db; }
  #psk-input:focus { border-color: #3bbe28; box-shadow: 0 0 0 3px rgba(59,190,40,0.10); background: #fff; }
  #psk-send {
    width: 36px; height: 36px; background: #3bbe28; border: none; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0; transition: background .15s, transform .1s;
    box-shadow: 0 2px 8px rgba(59,190,40,0.30);
  }
  #psk-send:hover:not(:disabled) { background: #33a822; transform: scale(1.05); }
  #psk-send:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }
  #psk-send svg { width: 16px; height: 16px; fill: #fff; }

  .psk-result-card {
    background: #ffffff; border: 1.5px solid #f3f4f6; border-radius: 14px;
    padding: 12px 14px; margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: border-color .15s;
  }
  .psk-result-card:hover { border-color: #bbf7d0; }
  .psk-result-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .psk-result-num {
    width: 22px; height: 22px; background: #3bbe28; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0;
  }
  .psk-result-name { font-size: 13.5px; font-weight: 800; color: #111827; }
  .psk-result-why { font-size: 12px; color: #4b5563; line-height: 1.55; margin-bottom: 5px; }
  .psk-result-dose {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 10.5px; color: #6b7280;
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 5px; padding: 2px 7px;
  }
  .psk-tip-bubble {
    background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px;
    padding: 10px 13px; font-size: 12px; line-height: 1.6; color: #78350f;
    margin-top: 6px;
  }
  .psk-tip-bubble strong { color: #92400e; }
  .psk-restart-btn {
    background: transparent; border: 1.5px solid #e5e7eb; border-radius: 99px;
    padding: 7px 16px; font-size: 12px; color: #6b7280; cursor: pointer;
    font-family: inherit; transition: border-color .14s, color .14s; margin-top: 4px;
  }
  .psk-restart-btn:hover { border-color: #3bbe28; color: #166534; }
  .psk-scan-link {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; color: #6b7280; text-decoration: none;
    border: 1.5px solid #e5e7eb; border-radius: 99px; padding: 7px 14px;
    transition: border-color .14s, color .14s; margin-top: 4px; background: #f9fafb;
  }
  .psk-scan-link:hover { border-color: #3bbe28; color: #166534; background: #f0fdf4; }
  .psk-disclaimer-sm { font-size: 10.5px; color: #9ca3af; line-height: 1.5; margin-top: 8px; }

  @media (max-width: 480px) {
    #psk-window { width: calc(100vw - 40px); height: 480px; }
    #psk-overlay { padding: 0 0 0 12px; }
    #psk-btn { font-size: 12px; padding: 9px 14px 9px 11px; }
  }
  `;
  document.head.appendChild(style);

  // ── HTML ────────────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'pepstack-widget';
  container.innerHTML = `
    <button id="psk-btn" aria-label="PepStack AI Recommendations">
      <span class="psk-dot"></span>
      PepStack Recs
    </button>

    <div id="psk-overlay" role="dialog" aria-modal="true" aria-label="PepStack AI">
      <div id="psk-window">

        <div id="psk-header">
          <div class="psk-avatar">🧬</div>
          <div class="psk-header-info">
            <div class="psk-header-name">PepStack AI</div>
            <div class="psk-header-status"><span class="psk-status-dot"></span> AI Protocol Builder</div>
          </div>
          <button class="psk-close" id="psk-close" aria-label="Close">&#215;</button>
        </div>

        <div id="psk-messages"></div>

        <div id="psk-input-row">
          <textarea id="psk-input" rows="1" placeholder="Type a message…"></textarea>
          <button id="psk-send" disabled>
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(container);

  // ── State ───────────────────────────────────────────────────────────────────
  const STEPS = ['goal', 'age', 'sex', 'height_weight', 'done'];
  let step = 0;
  let profile = { goal: null, age: null, sex: null, height: null, weight: null };
  let isLoading = false;

  const btn       = document.getElementById('psk-btn');
  const overlay   = document.getElementById('psk-overlay');
  const closeBtn  = document.getElementById('psk-close');
  const messages  = document.getElementById('psk-messages');
  const input     = document.getElementById('psk-input');
  const sendBtn   = document.getElementById('psk-send');

  // ── Open / Close ────────────────────────────────────────────────────────────
  btn.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeChat(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('psk-open')) closeChat();
  });

  function openChat() {
    overlay.classList.add('psk-open');
    document.body.style.overflow = 'hidden';
    if (messages.children.length === 0) startConversation();
    setTimeout(() => input.focus(), 300);
  }
  function closeChat() {
    overlay.classList.remove('psk-open');
    const chatIframe = document.getElementById('chat-widget-iframe');
    if (!chatIframe || !chatIframe.classList.contains('open')) document.body.style.overflow = '';
  }

  // ── Input handling ───────────────────────────────────────────────────────────
  input.addEventListener('input', function () {
    sendBtn.disabled = !input.value.trim() || isLoading;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  sendBtn.addEventListener('click', handleSend);

  function handleSend() {
    const text = input.value.trim();
    if (!text || isLoading) return;
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    processUserInput(text);
  }

  // ── Conversation flow ────────────────────────────────────────────────────────
  function startConversation() {
    step = 0;
    profile = { goal: null, age: null, sex: null, height: null, weight: null };
    setTimeout(() => {
      addAIMessage("Hey! I'm PepStack AI 👋 I'll build you a personalised peptide protocol in just a few quick questions.", false);
    }, 400);
    setTimeout(() => {
      addAIMessage("What's your primary goal?", false, [
        'Fat Loss', 'Muscle Building', 'Recovery & Healing', 'Anti-Aging',
        'Cognitive Enhancement', 'Sleep Quality', 'Hormonal Support',
        'Injury Repair', 'Libido & Sexual Health', 'General Wellness'
      ]);
    }, 1200);
  }

  function processUserInput(text) {
    addUserMessage(text);

    if (STEPS[step] === 'goal') {
      profile.goal = text;
      step++;
      showTyping(() => {
        addAIMessage("Great choice! Now, how old are you?", false, ['18–25', '26–35', '36–45', '46–55', '55+']);
      });

    } else if (STEPS[step] === 'age') {
      profile.age = text;
      step++;
      showTyping(() => {
        addAIMessage("Got it. What's your biological sex?", false, ['Male', 'Female']);
      });

    } else if (STEPS[step] === 'sex') {
      profile.sex = text.toLowerCase();
      step++;
      showTyping(() => {
        addAIMessage("Almost there! What's your height and weight? (e.g. 5'10, 185lbs — or metric is fine too)", false);
      });

    } else if (STEPS[step] === 'height_weight') {
      // Accept combined or parse separately
      const combined = text;
      const heightMatch = combined.match(/(\d+['′]\d+|\d+\s*cm|\d+\s*ft\s*\d*\s*in?)/i);
      const weightMatch = combined.match(/(\d+\s*(?:lbs?|kg|pounds?))/i);
      profile.height = heightMatch ? heightMatch[0] : combined;
      profile.weight = weightMatch ? weightMatch[0] : combined;
      step++;
      showTyping(() => {
        addAIMessage("Perfect — let me build your personalised stack now. Give me a moment... 🔬");
        setTimeout(() => fetchRecommendations(), 600);
      }, 800);
    }
  }

  function fetchRecommendations() {
    isLoading = true;
    sendBtn.disabled = true;
    input.disabled = true;
    showTypingPersist();

    fetch(API_URL + '/pepstack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal:   profile.goal,
        age:    profile.age,
        sex:    profile.sex,
        height: profile.height,
        weight: profile.weight
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.json();
    })
    .then(function (data) {
      removeTypingPersist();
      isLoading = false;
      input.disabled = false;
      renderRecommendations(data);
    })
    .catch(function (err) {
      removeTypingPersist();
      isLoading = false;
      input.disabled = false;
      addAIMessage("Sorry, I ran into an issue fetching your recommendations. Want to try again?", false, ['Try again']);
      step = 3; // reset to height_weight step so retry works
      console.error('[PepStack]', err);
    });
  }

  function renderRecommendations(data) {
    // Summary bubble
    if (data.summary) {
      addAIMessage(data.summary);
    }

    // Stack cards as a single bubble
    if (data.stack && data.stack.length) {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'psk-msg psk-ai';
      const col = document.createElement('div');
      col.className = 'psk-msg-col';

      const avatar = document.createElement('div');
      avatar.className = 'psk-msg-avatar';
      avatar.textContent = '🧬';

      data.stack.forEach(function (item, i) {
        const card = document.createElement('div');
        card.className = 'psk-result-card';
        card.innerHTML =
          '<div class="psk-result-card-header">' +
            '<div class="psk-result-num">' + (i + 1) + '</div>' +
            '<div class="psk-result-name">' + esc(item.name) + '</div>' +
          '</div>' +
          (item.why  ? '<div class="psk-result-why">'  + esc(item.why)  + '</div>' : '') +
          (item.dose ? '<div class="psk-result-dose">📊 ' + esc(item.dose) + '</div>' : '');
        col.appendChild(card);
      });

      cardDiv.appendChild(avatar);
      cardDiv.appendChild(col);
      messages.appendChild(cardDiv);
    }

    // Tip
    if (data.tip) {
      const tipWrap = document.createElement('div');
      tipWrap.className = 'psk-msg psk-ai';
      const col = document.createElement('div');
      col.className = 'psk-msg-col';
      const avatar = document.createElement('div');
      avatar.className = 'psk-msg-avatar';
      avatar.textContent = '🧬';
      const tip = document.createElement('div');
      tip.className = 'psk-tip-bubble';
      tip.innerHTML = '<strong>💡 Stack tip:</strong> ' + esc(data.tip);
      col.appendChild(tip);
      tipWrap.appendChild(avatar);
      tipWrap.appendChild(col);
      messages.appendChild(tipWrap);
    }

    // Action row
    setTimeout(() => {
      const actionWrap = document.createElement('div');
      actionWrap.className = 'psk-msg psk-ai';
      const col = document.createElement('div');
      col.className = 'psk-msg-col';
      const avatar = document.createElement('div');
      avatar.className = 'psk-msg-avatar';
      avatar.textContent = '🧬';

      addAIMessageRaw(col, "Have questions about any of these? Feel free to ask — or try a different goal below.");

      const actions = document.createElement('div');
      actions.className = 'psk-chips-row';

      const restart = document.createElement('button');
      restart.className = 'psk-restart-btn';
      restart.textContent = '↩ Try a different goal';
      restart.addEventListener('click', function () {
        messages.innerHTML = '';
        startConversation();
      });

      const scanLink = document.createElement('a');
      scanLink.className = 'psk-scan-link';
      scanLink.href = PEPSCAN_URL;
      scanLink.target = '_blank';
      scanLink.rel = 'noopener noreferrer';
      scanLink.innerHTML = '📷 Face scan';

      const disclaimer = document.createElement('p');
      disclaimer.className = 'psk-disclaimer-sm';
      disclaimer.textContent = 'For research purposes only. Not medical advice.';

      col.appendChild(actions);
      actions.appendChild(restart);
      actions.appendChild(scanLink);
      col.appendChild(disclaimer);

      actionWrap.appendChild(avatar);
      actionWrap.appendChild(col);
      messages.appendChild(actionWrap);

      // re-enable input for follow-up questions
      input.placeholder = 'Ask a follow-up question…';
      sendBtn.disabled = false;
      step = 'followup';
      scrollBottom();
    }, 400);

    scrollBottom();
  }

  // ── Follow-up after recommendations ──────────────────────────────────────────
  // If user types after receiving recs, send to chat or just acknowledge
  // We override processUserInput by checking step === 'followup'
  const _origProcess = processUserInput;
  function processUserInput(text) {
    if (step === 'followup') {
      addUserMessage(text);
      showTyping(() => {
        addAIMessage("Great question! For detailed answers about these peptides, our support team via the chat button can help, or feel free to ask in the store chat. Want to try a new goal instead?", false, ['↩ Start over']);
      });
      return;
    }
    _origProcess(text);
  }

  // ── Message helpers ──────────────────────────────────────────────────────────
  function addAIMessage(text, animate, chips) {
    animate = animate !== false;
    const wrap = document.createElement('div');
    wrap.className = 'psk-msg psk-ai';

    const avatar = document.createElement('div');
    avatar.className = 'psk-msg-avatar';
    avatar.textContent = '🧬';

    const col = document.createElement('div');
    col.className = 'psk-msg-col';

    const bubble = document.createElement('div');
    bubble.className = 'psk-bubble';
    bubble.textContent = text;

    col.appendChild(bubble);

    if (chips && chips.length) {
      const row = document.createElement('div');
      row.className = 'psk-chips-row';
      chips.forEach(function (label) {
        const chip = document.createElement('button');
        chip.className = 'psk-qchip';
        chip.textContent = label;
        chip.addEventListener('click', function () {
          // Remove chips row after selection
          row.remove();
          processUserInput(label);
        });
        row.appendChild(chip);
      });
      col.appendChild(row);
    }

    wrap.appendChild(avatar);
    wrap.appendChild(col);
    messages.appendChild(wrap);
    scrollBottom();
  }

  function addAIMessageRaw(col, text) {
    const bubble = document.createElement('div');
    bubble.className = 'psk-bubble';
    bubble.textContent = text;
    col.appendChild(bubble);
  }

  function addUserMessage(text) {
    const wrap = document.createElement('div');
    wrap.className = 'psk-msg psk-usr';
    const col = document.createElement('div');
    col.className = 'psk-msg-col';
    const bubble = document.createElement('div');
    bubble.className = 'psk-bubble';
    bubble.textContent = text;
    col.appendChild(bubble);
    wrap.appendChild(col);
    messages.appendChild(wrap);
    scrollBottom();
  }

  let typingEl = null;
  let typingPersistEl = null;

  function showTyping(callback, delay) {
    delay = delay || 600;
    const wrap = document.createElement('div');
    wrap.className = 'psk-msg psk-ai';
    const avatar = document.createElement('div');
    avatar.className = 'psk-msg-avatar';
    avatar.textContent = '🧬';
    const typing = document.createElement('div');
    typing.className = 'psk-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    typingEl = wrap;
    wrap.appendChild(avatar);
    wrap.appendChild(typing);
    messages.appendChild(wrap);
    scrollBottom();
    setTimeout(() => {
      if (typingEl) { typingEl.remove(); typingEl = null; }
      if (callback) callback();
    }, delay);
  }

  function showTypingPersist() {
    const wrap = document.createElement('div');
    wrap.className = 'psk-msg psk-ai';
    const avatar = document.createElement('div');
    avatar.className = 'psk-msg-avatar';
    avatar.textContent = '🧬';
    const typing = document.createElement('div');
    typing.className = 'psk-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    typingPersistEl = wrap;
    wrap.appendChild(avatar);
    wrap.appendChild(typing);
    messages.appendChild(wrap);
    scrollBottom();
  }

  function removeTypingPersist() {
    if (typingPersistEl) { typingPersistEl.remove(); typingPersistEl = null; }
  }

  function scrollBottom() {
    setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 50);
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  console.log('✅ PepStack widget loaded');
})();