export const SANDBOX_CHAT_PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sandbox Chat - Maêve Estética Avançada</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light; --gold:#d7a51f; --ink:#111b21; --muted:#667781; --line:#e1ded8; --header:#f7f5f1; --chat:#efe7db; --bot:#fff; --user:#d9fdd3; --green:#008069; --panel:#fff; }
    * { box-sizing: border-box; }
    body { margin:0; height:100vh; overflow:hidden; color:var(--ink); font-family:Manrope, Arial, sans-serif; background:#d7d1c6; }
    .shell { height:100vh; display:grid; grid-template-rows:60px 1fr 64px; background:var(--chat); position:relative; }
    .shell:before { content:""; position:absolute; inset:60px 0 64px; pointer-events:none; opacity:.34; background-image:radial-gradient(circle at 20px 20px, #c9bda9 1.3px, transparent 1.4px), radial-gradient(circle at 72px 48px, #c9bda9 1px, transparent 1.2px), linear-gradient(35deg, transparent 46%, rgba(201,189,169,.55) 47%, transparent 49%); background-size:96px 96px, 112px 112px, 120px 120px; }
    .topbar { z-index:2; display:flex; align-items:center; gap:12px; min-width:0; padding:8px 18px; background:var(--header); border-bottom:1px solid var(--line); }
    .avatar { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; background:#050505; border:1px solid rgba(215,165,31,.55); overflow:hidden; color:var(--gold); font-weight:800; flex:0 0 auto; }
    .avatar img { width:145%; height:145%; object-fit:cover; object-position:50% 21%; display:block; }
    .identity { min-width:0; flex:1; }
    .identity strong { display:block; font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .identity span { display:block; color:var(--muted); font-size:12px; margin-top:1px; }
    .top-actions { display:flex; align-items:center; gap:8px; }
    .call { height:38px; border:1px solid #d6d1ca; border-radius:20px; background:#fff; padding:0 16px; font-weight:700; }
    .icon { width:38px; height:38px; border:0; border-radius:50%; background:transparent; color:#111; font-size:20px; cursor:pointer; }
    .feed { z-index:1; overflow:auto; padding:18px min(8vw,70px); display:flex; flex-direction:column; gap:8px; }
    .message { display:flex; align-items:flex-end; gap:7px; max-width:min(760px,92%); animation:rise .14s ease-out; }
    .message.user { align-self:flex-end; justify-content:flex-end; }
    .message.bot { align-self:flex-start; }
    .bubble { padding:8px 10px 6px; border-radius:8px; box-shadow:0 1px .5px rgba(11,20,26,.16); line-height:1.45; font-size:14px; white-space:pre-wrap; overflow-wrap:anywhere; }
    .bot .bubble { background:var(--bot); border-top-left-radius:0; }
    .user .bubble { background:var(--user); border-top-right-radius:0; }
    .time { color:var(--muted); font-size:11px; margin-left:8px; white-space:nowrap; }
    .typing { align-self:flex-start; display:none; padding:8px 12px; border-radius:8px; background:#fff; color:var(--muted); font-size:13px; box-shadow:0 1px .5px rgba(11,20,26,.12); }
    .typing.show { display:block; }
    .composer { z-index:2; display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--header); border-top:1px solid var(--line); }
    .composer textarea { flex:1; height:42px; max-height:120px; resize:none; border:0; outline:0; border-radius:22px; padding:11px 14px; font:15px Manrope, Arial, sans-serif; background:#fff; }
    .send { width:44px; height:44px; border:0; border-radius:50%; background:var(--green); color:#fff; font-size:18px; cursor:pointer; }
    .drawer { position:fixed; z-index:5; top:0; right:0; width:min(420px,100vw); height:100vh; background:var(--panel); box-shadow:-18px 0 50px rgba(0,0,0,.18); transform:translateX(105%); transition:transform .18s ease; display:flex; flex-direction:column; }
    .drawer.open { transform:translateX(0); }
    .drawer header { display:flex; align-items:center; justify-content:space-between; padding:16px; border-bottom:1px solid var(--line); }
    .drawer h2 { margin:0; font-size:16px; }
    .drawer .content { padding:16px; overflow:auto; }
    label { display:block; color:var(--muted); font-size:12px; margin:12px 0 5px; }
    input { width:100%; border:1px solid var(--line); border-radius:8px; padding:10px 11px; font:14px Manrope, Arial, sans-serif; }
    .tools { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }
    .tool { border:1px solid var(--line); border-radius:8px; background:#fff; padding:10px; font-weight:700; cursor:pointer; }
    pre { display:none; margin:14px 0 0; padding:12px; max-height:42vh; overflow:auto; border-radius:8px; background:#101820; color:#dbeafe; font-size:12px; white-space:pre-wrap; }
    pre.open { display:block; }
    .backdrop { position:fixed; inset:0; z-index:4; background:rgba(0,0,0,.28); display:none; }
    .backdrop.open { display:block; }
    @keyframes rise { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @media (max-width:700px) { .topbar { padding:8px 10px; } .call { display:none; } .feed { padding:14px 10px; } .message { max-width:96%; } .bubble { font-size:13px; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="avatar"><img src="/assets/maeve-logo.svg" alt="Maêve" onerror="this.remove(); this.parentNode.textContent='M';"></div>
      <div class="identity"><strong>Maêve Estética Avançada</strong><span>online agora</span></div>
      <div class="top-actions"><button class="call" type="button">Ligar</button><button class="icon" type="button" id="debugBtn" title="Debug">⌕</button><button class="icon" type="button" id="settingsBtn" title="Configurações">⋮</button></div>
    </header>
    <section class="feed" id="feed" aria-live="polite"></section>
    <form class="composer" id="messageForm">
      <button class="icon" type="button" id="newBtn" title="Nova sessão">+</button>
      <textarea id="message" rows="1" placeholder="Digite uma mensagem"></textarea>
      <button class="send" type="submit" title="Enviar">➤</button>
    </form>
  </main>
  <div class="backdrop" id="backdrop"></div>
  <aside class="drawer" id="drawer" aria-label="Configurações do sandbox">
    <header><h2>Sandbox Maêve</h2><button class="icon" type="button" id="closeDrawer">×</button></header>
    <div class="content">
      <label for="from">Número</label><input id="from" value="5565991112222" />
      <label for="sessionId">Sessão</label><input id="sessionId" value="" />
      <label for="sourceCampaign">Campanha</label><input id="sourceCampaign" placeholder="Ex.: Anúncio laser" />
      <label for="sourceAd">Anúncio/referral</label><input id="sourceAd" placeholder="Texto do anúncio ou referral" />
      <label for="sourceUrl">URL de origem</label><input id="sourceUrl" placeholder="https://..." />
      <div class="tools"><button class="tool" type="button" id="resetBtn">Resetar sessão</button><button class="tool" type="button" id="toggleDebugBtn">Mostrar debug</button></div>
      <pre id="debug">{}</pre>
    </div>
  </aside>
  <script>
    const $ = (id) => document.getElementById(id);
    const feedEl = $('feed'), messageEl = $('message'), sessionIdEl = $('sessionId'), debugEl = $('debug'), drawerEl = $('drawer'), backdropEl = $('backdrop');
    const fields = { from: $('from'), sourceCampaign: $('sourceCampaign'), sourceAd: $('sourceAd'), sourceUrl: $('sourceUrl') };
    const now = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const postJson = async (url, body) => {
      try {
        const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) });
        const data = await res.json();
        return res.ok ? data : { status:'error', message:data.message || 'Falha na requisição.' };
      } catch (error) { return { status:'error', message:error instanceof Error ? error.message : 'Erro de rede.' }; }
    };
    const addBubble = (kind, text) => {
      const row = document.createElement('div');
      row.className = 'message ' + kind;
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = text;
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = now();
      bubble.appendChild(time);
      row.appendChild(bubble);
      feedEl.appendChild(row);
      feedEl.scrollTop = feedEl.scrollHeight;
    };
    const setTyping = (visible) => {
      let typing = $('typing');
      if (!typing) { typing = document.createElement('div'); typing.id = 'typing'; typing.className = 'typing'; typing.textContent = 'Maêve digitando...'; feedEl.appendChild(typing); }
      typing.classList.toggle('show', visible);
      feedEl.scrollTop = feedEl.scrollHeight;
    };
    const updateDebug = (data) => {
      sessionIdEl.value = data.sessionId || sessionIdEl.value;
      debugEl.textContent = JSON.stringify(data, null, 2);
    };
    const payloadBase = () => ({
      from: fields.from.value.trim(),
      sessionId: sessionIdEl.value.trim() || null,
      sourceCampaign: fields.sourceCampaign.value.trim() || null,
      sourceAd: fields.sourceAd.value.trim() || null,
      sourceUrl: fields.sourceUrl.value.trim() || null
    });
    $('messageForm').onsubmit = async (event) => {
      event.preventDefault();
      const msg = messageEl.value.trim();
      if (!msg) return;
      addBubble('user', msg);
      messageEl.value = '';
      setTyping(true);
      const data = await postJson('/v1/simulate/message', { ...payloadBase(), message: msg });
      setTyping(false);
      updateDebug(data);
      if (data.status !== 'ok') return addBubble('bot', 'Erro: ' + (data.message || 'falha no envio'));
      (data.messages || []).forEach((line) => addBubble('bot', line));
    };
    messageEl.onkeydown = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('messageForm').requestSubmit(); } };
    $('resetBtn').onclick = async () => { const data = await postJson('/v1/simulate/reset', payloadBase()); updateDebug(data); addBubble('bot', data.status === 'ok' ? 'Sessão resetada.' : 'Erro ao resetar sessão.'); };
    $('newBtn').onclick = () => { sessionIdEl.value = ''; feedEl.innerHTML = ''; debugEl.textContent = '{}'; messageEl.focus(); };
    const openDrawer = () => { drawerEl.classList.add('open'); backdropEl.classList.add('open'); };
    const closeDrawer = () => { drawerEl.classList.remove('open'); backdropEl.classList.remove('open'); };
    $('settingsBtn').onclick = openDrawer; $('debugBtn').onclick = () => { openDrawer(); debugEl.classList.add('open'); };
    $('toggleDebugBtn').onclick = () => { debugEl.classList.toggle('open'); $('toggleDebugBtn').textContent = debugEl.classList.contains('open') ? 'Ocultar debug' : 'Mostrar debug'; };
    $('closeDrawer').onclick = closeDrawer; backdropEl.onclick = closeDrawer;
    addBubble('bot', 'Oi, seja bem-vinda à Maêve. Me conta o que você quer cuidar hoje?');
  </script>
</body>
</html>
`
