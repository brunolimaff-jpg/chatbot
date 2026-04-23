import { addKeyword, createFlow, utils } from '@builderbot/bot'

const noopFlow = addKeyword(utils.setEvent('SANDBOX_NOOP')).addAction(async () => {})

export const buildSandboxNoopFlow = () => createFlow([noopFlow])
