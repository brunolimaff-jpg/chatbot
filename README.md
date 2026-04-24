<p align="center">
  <a href="https://builderbot.app/">
    <picture>
      <img src="https://builderbot.app/assets/thumbnail-vector.png" height="80">
    </picture>
    <h2 align="center">BuilderBot</h2>
  </a>
</p>



<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@builderbot/bot">
    <img alt="" src="https://img.shields.io/npm/v/@builderbot/bot?color=%2300c200&label=%40bot-whatsapp">
  </a>
  <a aria-label="Join the community on GitHub" href="https://link.codigoencasa.com/DISCORD">
    <img alt="" src="https://img.shields.io/discord/915193197645402142?logo=discord">
  </a>
</p>

## Runtime Modes

This project supports two channel modes:

- `CHATBOT_CHANNEL_MODE=whatsapp`: connects to Baileys WhatsApp provider.
- `CHATBOT_CHANNEL_MODE=sandbox`: does not connect to WhatsApp and enables local/online flow simulation.

### Environment Variables

- `PORT`: API/server port (default `3008`)
- `CHATBOT_CHANNEL_MODE`: `whatsapp` or `sandbox`
- `HANDOFF_WHATSAPP_NUMBER`: human handoff destination
- `WHATSAPP_USE_PAIRING_CODE`: `true` or `false`
- `WHATSAPP_PAIRING_PHONE`: phone used for pairing code mode
- `DATABASE_URL` (optional): Postgres persistence for leads
- `REDIS_URL` (optional): Redis persistence for sessions/idempotency

### Sandbox Endpoints

- `POST /v1/simulate/message`
- `POST /v1/simulate/reset`
- `GET /v1/simulate/session`
- `GET /sandbox` (playground web para testar conversa no navegador)

All API errors use:

```json
{ "status": "error", "message": "text", "code": "ERROR_CODE" }
```

### Railway sandbox

Para publicar o sandbox no Railway:

- Defina `CHATBOT_CHANNEL_MODE=sandbox`.
- Defina `GEMINI_API_KEY` e `HANDOFF_WHATSAPP_NUMBER`.
- Nao defina `PORT` manualmente nas variaveis; o Railway injeta a porta do container.
- No dominio publico do Railway, deixe o target port automatico ou configure com a porta que aparece nos logs de start.
- Neste deploy validado, o BuilderBot iniciou em `localhost:8080`, entao o Public Networking precisou apontar para `8080`, nao `3008`.

Links esperados:

- `https://<dominio-railway>/health`
- `https://<dominio-railway>/sandbox`

### Execucao facil (Windows)

- Clique duas vezes em `run-chatbot.bat` para escolher o modo:
  - `1` Sandbox (teste de fluxo sem WhatsApp)
  - `2` WhatsApp (integracao real)
- Atalhos diretos:
  - `run-sandbox.bat`
  - `run-whatsapp.bat`

Cada launcher define automaticamente o arquivo de ambiente:
- Sandbox: `.env.sandbox`
- WhatsApp: `.env.whatsapp`


## Getting Started

With this library, you can build automated conversation flows agnostic to the WhatsApp provider, set up automated responses for frequently asked questions, receive and respond to messages automatically, and track interactions with customers. Additionally, you can easily set up triggers to expand functionalities limitlessly.

```
npm create builderbot@latest
```


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.


## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)
