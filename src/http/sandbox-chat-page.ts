export const SANDBOX_CHAT_PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sandbox Chat - Clinica Estetica</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f8fb;
      --card: #ffffff;
      --line: #d7deea;
      --text: #172033;
      --muted: #5f6b82;
      --accent: #0f766e;
      --accent-soft: #e8f6f5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Segoe UI", Roboto, Arial, sans-serif;
      background: linear-gradient(180deg, #f6f8fb 0%, #edf2f9 100%);
      color: var(--text);
    }
    .wrap { max-width: 920px; margin: 0 auto; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 12px 28px rgba(10, 20, 40, 0.06);
      margin-bottom: 14px;
    }
    h1 { margin: 0 0 6px; font-size: 22px; }
    p { margin: 0; color: var(--muted); }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 14px;
    }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    input, textarea, button {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
    }
    textarea { min-height: 90px; resize: vertical; }
    .row { display: flex; gap: 8px; margin-top: 10px; }
    .row button { width: auto; cursor: pointer; }
    .primary { background: var(--accent); border-color: var(--accent); color: white; }
    .ghost { background: white; color: var(--text); }
    .feed { max-height: 54vh; overflow: auto; padding: 8px; background: #fafcff; border-radius: 10px; border: 1px solid var(--line); }
    .bubble {
      margin: 8px 0;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: white;
    }
    .bubble.user { border-color: #bdd5ff; background: #eef5ff; }
    .bubble.bot { border-color: #bfe5df; background: var(--accent-soft); }
    .meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Sandbox Chat Playground</h1>
      <p>Teste o fluxo conversacional sem WhatsApp usando os endpoints /v1/simulate/*</p>
      <div class="grid">
        <div>
          <label for="from">Numero (from)</label>
          <input id="from" value="5565991112222" />
        </div>
        <div>
          <label for="sessionId">Session ID (opcional)</label>
          <input id="sessionId" value="" />
        </div>
      </div>
      <div style="margin-top:10px;">
        <label for="message">Mensagem</label>
        <textarea id="message" placeholder="Digite: oi"></textarea>
      </div>
      <div class="row">
        <button class="primary" id="sendBtn">Enviar</button>
        <button class="ghost" id="resetBtn">Resetar Sessao</button>
        <button class="ghost" id="newBtn">Nova Sessao</button>
      </div>
      <div class="meta" id="stateMeta">Aguardando mensagens...</div>
    </div>
    <div class="card">
      <div class="feed" id="feed"></div>
    </div>
  </div>
  <script>
    const fromEl = document.getElementById('from');
    const sessionIdEl = document.getElementById('sessionId');
    const messageEl = document.getElementById('message');
    const feedEl = document.getElementById('feed');
    const stateMetaEl = document.getElementById('stateMeta');

    const addBubble = (kind, text) => {
      const box = document.createElement('div');
      box.className = 'bubble ' + kind;
      box.textContent = text;
      feedEl.appendChild(box);
      feedEl.scrollTop = feedEl.scrollHeight;
    };

    const updateMeta = (payload) => {
      const state = payload && payload.state ? payload.state : '-';
      const sid = payload && payload.sessionId ? payload.sessionId : '-';
      stateMetaEl.textContent = 'state: ' + state + ' | sessionId: ' + sid;
      if (payload && payload.sessionId) sessionIdEl.value = payload.sessionId;
    };

    const postJson = async (url, body) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok && (!data || typeof data !== 'object')) {
          return { status: 'error', message: 'Falha na requisicao.' };
        }
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        return { status: 'error', message };
      }
    };

    document.getElementById('sendBtn').onclick = async () => {
      const msg = messageEl.value.trim();
      if (!msg) return;
      addBubble('user', msg);
      messageEl.value = '';

      const payload = {
        from: fromEl.value.trim(),
        message: msg,
      };
      const sessionId = sessionIdEl.value.trim();
      if (sessionId) payload.sessionId = sessionId;

      const data = await postJson('/v1/simulate/message', payload);
      if (data.status !== 'ok') {
        addBubble('bot', 'Erro: ' + (data.message || 'falha no envio'));
        return;
      }
      updateMeta(data);
      (data.messages || []).forEach((line) => addBubble('bot', line));
    };

    document.getElementById('resetBtn').onclick = async () => {
      const payload = {
        from: fromEl.value.trim(),
      };
      const data = await postJson('/v1/simulate/reset', payload);
      addBubble('bot', data.status === 'ok' ? 'Sessao reset solicitada.' : 'Erro ao resetar sessao.');
    };

    document.getElementById('newBtn').onclick = () => {
      sessionIdEl.value = '';
      messageEl.value = '';
      feedEl.innerHTML = '';
      stateMetaEl.textContent = 'Nova sessao local iniciada.';
    };
  </script>
</body>
</html>
`
