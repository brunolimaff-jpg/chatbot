export const sendJson = (res, statusCode, payload) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(payload))
}

export const sendSuccess = (res, statusCode, payload = {}) =>
    sendJson(res, statusCode, {
        status: 'ok',
        ...payload,
    })

export const sendError = (res, statusCode, message, code, extras = {}) =>
    sendJson(res, statusCode, {
        status: 'error',
        message,
        code,
        ...extras,
    })
