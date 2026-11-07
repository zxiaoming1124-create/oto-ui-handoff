(() => {
  'use strict';
  const KEY = 'oto-prototype-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = (name, size = 20) => window.otoIcons ? window.otoIcons(name, size) : '';
  const keycaps = value => window.otoKeycaps ? window.otoKeycaps(value) : `<kbd class="keycap">${esc(value)}</kbd>`;
  const sampleText = 'Let’s make the important things easy to find. Language, recording shortcuts, and the API key should be right at the top.';
  const sample = () => ({
    version: 4,
    settings: {language:'Auto-detect', shortcut:'Control', paste:true, pointer:true, opacity:100, limit:50, apiConnected:true},
    totals: {words:2400, seconds:1200, englishWords:2400, englishSeconds:1200, characters:0},
    history: [
      {id:'sample-1', text:sampleText, date:Date.now()-8*60*1000, seconds:18, language:'English'},
      {id:'sample-2', text:'I’ll send the updated design this afternoon. Let me know if there’s anything you’d like me to adjust before our next review.', date:Date.now()-48*60*1000, seconds:12, language:'English'},
      {id:'sample-3', text:'A quick reminder for tomorrow: review the settings flow, test the recording shortcut, and keep the interface simple.', date:Date.now()-86400000, seconds:10, language:'English'}
    ]
  });
  const settingsMenus = {
    language:{label:'Transcription language',options:['Auto-detect','English','Chinese (Simplified)','Chinese (Traditional)']},
    shortcut:{label:'Recording shortcut',options:['Control','Fn','AltRight','Off']},
    opacity:{label:'Window opacity',options:[100,90,80]},
    limit:{label:'History limit',options:[25,50,100]}
  };
  let state = sample();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.settings && Array.isArray(saved.history) && saved.totals) {
      const settings = Object.fromEntries(Object.keys(state.settings).map(key => [key,saved.settings[key] ?? state.settings[key]]));
      state = {version:4,settings,totals:{...state.totals,...saved.totals},history:saved.history};
      if ((saved.version || 1) < 2) {
        const original = state.history.find(item => item.id === 'sample-1' && item.text === `${sampleText} Everything else can live in Preferences.`);
        if (original) original.text = sampleText;
      }
    }
  } catch (_) {}
  for (const [key,menu] of Object.entries(settingsMenus)) if (!menu.options.includes(state.settings[key])) state.settings[key]=menu.options[0];
  state.settings.apiConnected = false;
  let apiKey = ''; 
  let apiDraft = apiKey, apiEditing = true, apiVisible = false, apiError = '';
  const steps = ['welcome', 'language', 'api-key', 'try'];
  const finishedKey = 'oto-onboarding-complete';
  function resolveRoute(hash) {
    if ([...steps, 'history', 'settings'].includes(hash)) return hash;
    try { return localStorage.getItem(finishedKey) ? 'settings' : 'welcome'; }
    catch { return 'welcome'; }
  }
  let route = resolveRoute(location.hash.slice(1));
  let practiceText = '';
  let setupKey = '';
  let query = '', dropdown = null, toastTimer = null, undoItem = null;
  const view = $('#view');
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
  const duration = seconds => seconds >= 3600 ? `${Math.floor(seconds/3600)} hr ${Math.floor(seconds%3600/60)} min` : seconds >= 60 ? `${Math.floor(seconds/60)} min` : `${Math.round(seconds)} sec`;
  const btn = (action,label,kind='') => `<button type="button" class="btn ${kind}" data-action="${action}">${label}</button>`;
  const heading = (title,extra='') => `<header class="page-heading heading-row"><h1>${title}</h1>${extra}</header>`;
  const focus = selector => requestAnimationFrame(() => $(selector)?.focus());
  function toast(message,undo=false) {
    const element=$('#toast'); clearTimeout(toastTimer);
    element.innerHTML=`<span>${esc(message)}</span>${undo?btn('undo-delete','Undo','quiet'):''}`;
    element.classList.add('show'); toastTimer=setTimeout(()=>element.classList.remove('show'),5000);
  }
  function nav(next) {
    if (route === 'settings' && apiEditing && !commitApi()) { cancelApi(); toast('API key changes discarded.'); }
    dropdown=null; query=''; route=resolveRoute(next);
    if(location.hash!==`#${route}`) history.replaceState(null,'',`#${route}`);
    render(); view.scrollTop=0;
  }
  function render(focusSelector) {
    const scrollTop=view.scrollTop;
    document.querySelectorAll('[data-route]').forEach(element=>{const active=element.dataset.route===route;element.classList.toggle('active',active);if(active)element.setAttribute('aria-current','page');else element.removeAttribute('aria-current');});
    $('.app-shell')?.style.setProperty('--surface-opacity',state.settings.opacity/100);
    const onboarding = steps.includes(route);
    $('.app-shell').classList.toggle('onboarding', onboarding);
    view.innerHTML = onboarding ? onboardingView() : route === 'history' ? historyView() : settingsView();
    view.scrollTop=scrollTop;
    if(focusSelector)focus(focusSelector);
  }
  function onboardingView() {
    const action = (label, command, disabled = false) =>
      `<button type="button" class="btn primary ob-next" data-onboard="${command}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    const secondary = (label, command) =>
      `<button type="button" class="ob-secondary" data-onboard="${command}">${label}</button>`;
    if (route === 'welcome') {
      return `<section class="ob-page ob-welcome"><div class="ob-brand">${$('.sidebar .brand').innerHTML}</div><h1 tabindex="-1">Turn your voice into text.</h1>${action('Get started', 'language')}</section>`;
    }
    let title, fields, actions;
    if (route === 'language') {
      title = 'Which language do you speak?';
      fields = `<label class="ob-label" for="language-trigger">Transcription language</label>${dropdownControl('language')}<p>You can change this later in Settings.</p>`;
      actions = action('Continue', 'api-key');
    } else if (route === 'api-key') {
      title = 'Bring your own API key.';
      fields = `<label class="ob-label" for="setup-key">OpenAI API key</label><input id="setup-key" class="ob-input" type="password" autocomplete="off" placeholder="Enter your OpenAI API key" value="${esc(setupKey)}"><p>You can change your API key later in Settings.</p><button class="inline-link help-link" type="button">Get an API key from OpenAI ${icon('external',14)}</button>`;
      actions = action('Continue', 'save-key', !setupKey.trim()) + secondary('Set up later', 'try');
    } else {
      title = 'Try OTO.';
      fields = `<div class="ob-instructions">Press ${keycaps('Control')} to start. Press it again to finish. Press ${keycaps('Escape')} to cancel.</div><input id="ob-practice" class="ob-input" type="text" aria-label="Say anything" placeholder="Click here and say anything." value="${esc(practiceText)}"><p>You can change this shortcut later in Settings.</p><button type="button" class="inline-link help-link" data-action="accessibility-settings">Accessibility permissions ${icon('external',14)}</button>`;
      actions = action('Try OTO', 'finish', !practiceText.trim()) + secondary('Skip for now', 'finish');
    }
    return `<section class="ob-page"><div class="ob-step">${steps.indexOf(route) + 1} OF 4</div><h1 tabindex="-1">${title}</h1><div class="ob-fields">${fields}</div><div class="ob-actions">${actions}</div></section>`;
  }

  function advanceSetup(command) {
    if (command === 'save-key') {
      apiKey = setupKey.trim();
      apiDraft = apiKey;
      apiEditing = false;
      state.settings.apiConnected = true;
      save();
      setupKey = '';
      nav('try');
    } else if (command === 'finish') {
      try { localStorage.setItem(finishedKey, '1'); } catch {}
      practiceText = '';
      nav('settings');
    } else {
      if (command === 'try') setupKey = '';
      nav(command);
    }
    focus(steps.includes(route) ? '.ob-page h1' : '.page-heading h1');
  }
  function historyView() {
    const saved=Math.max(0,state.totals.englishWords/40*60-state.totals.englishSeconds), countLabel=state.totals.characters?'Words / characters':'Words dictated';
    return `${heading('History')}<div class="stats-grid" aria-label="Usage statistics"><div class="stat"><strong>${duration(saved)}</strong><span>Time saved</span></div><div class="stat"><strong>${(state.totals.words+state.totals.characters).toLocaleString()}</strong><span>${countLabel}</span></div><div class="stat"><strong>${duration(state.totals.seconds)}</strong><span>Total dictation time</span></div></div><div class="toolbar"><span class="muted">${state.history.length} transcriptions</span><div class="search-field">${icon('search',17)}<input id="history-search" aria-label="Search transcriptions" placeholder="Search history" value="${esc(query)}" autocomplete="off"></div></div><div id="history-list" class="history-list">${historyItems()}</div><p class="hint history-retention">Keeps up to ${state.settings.limit} transcriptions on this device.</p>`;
  }
  function historyItems() {
    const items=state.history.filter(item=>item.text.toLowerCase().includes(query.toLowerCase()));
    if(!items.length)return `<div class="empty-state">${icon('history',30)}<h2>${query?'No matching transcriptions':'No transcriptions yet'}</h2><p>${query?'Try another word or phrase.':'Your transcriptions will appear here.'}</p>${query?btn('clear-search','Clear search','quiet'):''}</div>`;
    return items.map(item=>{const date=new Date(item.date),today=date.toDateString()===new Date().toDateString();return `<article class="history-item"><div class="item-meta"><span>${today?'Today':date.toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span><span>${item.seconds}s · ${esc(item.language)}</span></div><p class="item-text">${esc(item.text)}</p><div class="item-actions"><span class="action-spacer"></span><button class="icon-button" data-action="copy-history" data-id="${esc(item.id)}" aria-label="Copy transcription" title="Copy">${icon('copy',18)}</button><button class="icon-button" data-action="delete-history" data-id="${esc(item.id)}" aria-label="Delete transcription" title="Delete">${icon('trash',18)}</button></div></article>`;}).join('');
  }
  function settingsRow(title,description,control,primary=false,extraClass='') {
    return `<div class="settings-row${primary?' core-row':''}${extraClass?` ${extraClass}`:''}"><div class="row-copy"><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div><div class="row-control">${control}</div></div>`;
  }
  function toggle(key,label) {return `<button class="toggle ${state.settings[key]?'on':''}" role="switch" aria-checked="${state.settings[key]}" aria-label="${label}" data-action="toggle" data-key="${key}"><span></span></button>`;}
  const optionText=(kind,value)=>kind==='opacity'?`${value}%`:kind==='limit'?`${value} items`:value==='AltRight'?'Right Option':String(value);
  function dropdownControl(kind) {
    const {label,options}=settingsMenus[kind],value=state.settings[kind],open=dropdown===kind;
    const optionLabel=option=>kind==='shortcut'&&option!=='Off'?keycaps(option):esc(optionText(kind,option));
    return `<div class="dropdown-wrap"><button class="select dropdown-trigger ${open?'is-open':''}" id="${kind}-trigger" data-action="open-setting" data-key="${kind}" aria-label="${label}: ${esc(optionText(kind,value))}" aria-haspopup="listbox" aria-expanded="${open}"${open?` aria-controls="${kind}-options"`:''}><span>${optionLabel(value)}</span>${icon('chevron',16)}</button>${open?`<div class="dropdown-menu"><div class="dropdown-options" role="listbox" id="${kind}-options" aria-label="${label}">${options.map(option=>`<button type="button" class="dropdown-option ${value===option?'selected':''}" role="option" aria-selected="${value===option}" tabindex="-1" data-action="choose-setting" data-key="${kind}" data-value="${esc(option)}"><span>${optionLabel(option)}</span>${value===option?icon('check',16):'<span class="option-check-space"></span>'}</button>`).join('')}</div></div>`:''}</div>`;
  }
  function apiField() {
    const external=label=>`<button type="button" class="inline-link help-link">${label} ${icon('external',14)}</button>`;
    return `<div class="api-inline-field${apiEditing&&(apiKey||apiDraft)?' is-editing':''}${apiError?' has-error':''}"><input id="api-inline-input" class="api-inline-input" placeholder="Enter your OpenAI API key" type="${apiVisible?'text':'password'}" value="${esc(apiEditing?apiDraft:apiKey)}" ${apiEditing?'':'readonly'} aria-label="${apiKey?'OpenAI API key. Double-click, or press Enter or F2 to edit.':'Enter your OpenAI API key'}" aria-required="${!apiKey}" aria-describedby="api-inline-feedback"${apiError?' aria-invalid="true"':''} title="Double-click to edit" autocomplete="off" spellcheck="false"><button type="button" class="icon-button api-eye" data-action="show-api-key" aria-label="${apiVisible?'Hide API key':'Show API key'}" aria-pressed="${apiVisible}">${icon(apiVisible?'eyeOff':'eye',18)}</button></div><div id="api-inline-feedback" class="api-inline-feedback" role="status">${esc(apiError)}</div><p class="api-required-hint"${apiKey?' hidden':''}>Add an API key to start.</p><div class="api-links">${external('Get an API key from OpenAI')}</div>`;
  }
  function settingsView() {
    const primary=settingsRow('Transcription language','',dropdownControl('language'),true)+`<section class="recording-settings-group" aria-label="Recording controls">${settingsRow('Recording shortcut',state.settings.shortcut==='Off'?'':'Press once to record, again to finish.',`${dropdownControl('shortcut')}<button class="inline-link help-link" data-action="accessibility-settings" data-destination="System Settings > Privacy &amp; Security > Accessibility">Accessibility permissions ${icon('external',14)}</button>`,true)}${settingsRow('Cancel recording','Press Esc to cancel recording.',keycaps('Escape'),true,'cancel-recording-row')}</section>`+settingsRow(`OpenAI API key <span class="api-required-label"${apiKey?' hidden':''}>(* Required)</span>`,'',apiField(),true,'api-row');
    const secondary=settingsRow('Paste at cursor','Insert text into the app you’re using.',toggle('paste','Paste at cursor'))+settingsRow('Status near pointer','Show a small indicator while recording.',toggle('pointer','Status near pointer'))+settingsRow('Window opacity','',dropdownControl('opacity'))+settingsRow('History limit','',dropdownControl('limit'));
    return `${heading('Settings','<span class="autosave-note">Changes save automatically.</span>')}<div class="setting-group primary-settings">${primary}</div><div class="setting-group secondary">${secondary}</div>`;
  }
  function updateApiField() {
    const input=$('#api-inline-input'),field=$('.api-inline-field'),feedback=$('#api-inline-feedback'),eye=$('[data-action="show-api-key"]');
    if(!input)return;
    input.readOnly=!apiEditing;input.setAttribute('aria-label',apiKey?'OpenAI API key. Double-click, or press Enter or F2 to edit.':'Enter your OpenAI API key');const requiredHint=$('.api-required-hint');if(requiredHint)requiredHint.hidden=Boolean(apiKey);const requiredLabel=$('.api-required-label');if(requiredLabel)requiredLabel.hidden=Boolean(apiKey);input.setAttribute('aria-required',String(!apiKey));input.type=apiVisible?'text':'password';
    if(input.value!==(apiEditing?apiDraft:apiKey))input.value=apiEditing?apiDraft:apiKey;
    if(apiError)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
    field?.classList.toggle('is-editing',apiEditing&&Boolean(apiKey||apiDraft));field?.classList.toggle('has-error',Boolean(apiError));
    if(feedback)feedback.textContent=apiError;
    if(eye){eye.setAttribute('aria-label',apiVisible?'Hide API key':'Show API key');eye.setAttribute('aria-pressed',String(apiVisible));eye.innerHTML=icon(apiVisible?'eyeOff':'eye',18);}
  }
  function editApi() {
    if(apiEditing)return;
    closeDropdown(false);apiEditing=true;apiDraft=apiKey;apiError='';updateApiField();
    const input=$('#api-inline-input');input?.focus();input?.select();
  }
  function commitApi() {
    if(!apiEditing)return true;
    const value=apiDraft.trim();
    if(!value&&!apiKey){apiError='';updateApiField();return true;}
    if(!value){apiError='Enter an API key, or press Esc to cancel.';updateApiField();return false;}
    const changed=value!==apiKey;
    apiKey=value;apiDraft=value;apiEditing=false;apiVisible=false;apiError='';state.settings.apiConnected=true;save();updateApiField();
    if(changed)toast('API key updated.');
    return true;
  }
  function cancelApi() {apiDraft=apiKey;apiEditing=!apiKey;apiVisible=false;apiError='';updateApiField();}
  function openDropdown(kind) {
    if(dropdown===kind){closeDropdown();return;}
    dropdown=kind;render();
    requestAnimationFrame(()=>{const menu=$('.dropdown-menu'),trigger=$(`#${kind}-trigger`);if(!menu||!trigger)return;trigger.scrollIntoView({block:'nearest'});const bounds=view.getBoundingClientRect(),field=trigger.getBoundingClientRect(),below=bounds.bottom-field.bottom-12,above=field.top-bounds.top-12,opensUp=below<menu.scrollHeight&&above>below;menu.classList.toggle('opens-up',opensUp);menu.style.maxHeight=Math.max(80,Math.min(310,opensUp?above:below))+'px';$(`#${kind}-options [aria-selected="true"]`)?.focus({preventScroll:true});});
  }
  function closeDropdown(restore=true) {
    if(!dropdown)return;
    const kind=dropdown;dropdown=null;$('.dropdown-menu')?.remove();const trigger=$(`#${kind}-trigger`);trigger?.classList.remove('is-open');trigger?.setAttribute('aria-expanded','false');trigger?.removeAttribute('aria-controls');if(restore)trigger?.focus();
  }
  function chooseSetting(kind,value) {
    state.settings[kind]=kind==='opacity'||kind==='limit'?Number(value):value;
    if(kind==='limit')state.history=state.history.slice(0,state.settings.limit);
    save();dropdown=null;render(`#${kind}-trigger`);toast(`${settingsMenus[kind].label} saved.`);
  }
  async function copyText(value) {
    try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else{const textarea=document.createElement('textarea');textarea.value=value;textarea.style.cssText='position:fixed;left:-9999px';document.body.appendChild(textarea);textarea.select();const copied=document.execCommand('copy');textarea.remove();if(!copied)throw new Error('Copy unavailable');}toast('Copied to clipboard.');}
    catch(_){toast('Copy unavailable here. Select the text to copy it.');}
  }
  document.addEventListener('pointerdown',event=>{if(event.target.closest('[data-action="show-api-key"]'))event.preventDefault();});
  document.addEventListener('dblclick',event=>{if(event.target.id==='api-inline-input')editApi();});
  document.addEventListener('click',async event=>{
    if(dropdown&&!event.target.closest('.dropdown-wrap'))closeDropdown(false);
    const onboardingButton = event.target.closest('[data-onboard]');
    if (onboardingButton) { advanceSetup(onboardingButton.dataset.onboard); return; }
    const navButton=event.target.closest('[data-route]');if(navButton){nav(navButton.dataset.route);return;}
    const element=event.target.closest('[data-action]');if(!element)return;
    switch(element.dataset.action){
      case 'open-setting':openDropdown(element.dataset.key);break;
      case 'choose-setting':chooseSetting(element.dataset.key,element.dataset.value);break;
      case 'show-api-key':{const input=$('#api-inline-input'),start=input?.selectionStart,end=input?.selectionEnd;apiVisible=!apiVisible;updateApiField();if(apiEditing&&input){input.focus();if(start!==null&&end!==null)input.setSelectionRange(start,end);}break;}
      case 'accessibility-settings':toast('System Settings → Privacy & Security → Accessibility');break;
      case 'toggle':state.settings[element.dataset.key]=!state.settings[element.dataset.key];save();render(`[data-action="toggle"][data-key="${element.dataset.key}"]`);toast('Setting saved.');break;
      case 'copy-history':{const item=state.history.find(item=>item.id===element.dataset.id);if(item)await copyText(item.text);break;}
      case 'delete-history':{const index=state.history.findIndex(item=>item.id===element.dataset.id);if(index>=0){undoItem={item:state.history[index],index};state.history.splice(index,1);save();render();toast('Transcription deleted.',true);focus('[data-action="undo-delete"]');}break;}
      case 'undo-delete':if(undoItem){state.history.splice(undoItem.index,0,undoItem.item);undoItem=null;save();render();toast('Transcription restored.');focus('#history-search');}break;
      case 'clear-search':query='';render('#history-search');break;
    }
  });
  document.addEventListener('input',event=>{
    if (event.target.id === 'setup-key' || event.target.id === 'ob-practice') {
      const value = event.target.value;
      if (route === 'api-key') setupKey = value;
      else practiceText = value;
      $('.ob-next').disabled = !value.trim();
    }
    if(event.target.id==='history-search'){query=event.target.value;$('#history-list').innerHTML=historyItems();}
    if(event.target.id==='api-inline-input'&&apiEditing){apiDraft=event.target.value;if(apiError){apiError='';updateApiField();}}
  });
  document.addEventListener('focusout',event=>{if(apiEditing&&event.target.closest('.api-inline-field')&&!event.relatedTarget?.closest('.api-inline-field'))commitApi();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&route==='settings'&&apiEditing&&!dropdown){event.preventDefault();cancelApi();return;}
    if(event.target.id==='api-inline-input') {
      if(event.key==='Enter'){event.preventDefault();if(apiEditing)commitApi();else editApi();return;}
      if(event.key==='F2'){event.preventDefault();editApi();return;}
    }
    if(dropdown){
      if(event.key==='Escape'){event.preventDefault();closeDropdown();return;}
      const options=[...document.querySelectorAll(`#${dropdown}-options [role="option"]`)];
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();let index=options.indexOf(document.activeElement);if(event.key==='Home')index=0;else if(event.key==='End')index=options.length-1;else index=(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[index]?.focus();return;}
      if(event.key==='Tab')closeDropdown();return;
    }
    if(['ArrowDown','ArrowUp'].includes(event.key)&&event.target.matches('.dropdown-trigger')){event.preventDefault();openDropdown(event.target.dataset.key);}
  });
  document.addEventListener('focusin',event=>{if(dropdown&&!event.target.closest('.dropdown-wrap'))closeDropdown(false);});
  window.addEventListener('hashchange',()=>nav(location.hash.slice(1)));
  history.replaceState(null,'',`#${route}`);
  save();render();
})();
