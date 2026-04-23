import { EventEmitter } from 'node:events'
import { ProviderClass } from '@builderbot/bot'

export class SandboxProvider extends ProviderClass {
    globalVendorArgs = {
        name: 'sandbox',
    }

    beforeHttpServerInit() {}

    afterHttpServerInit() {}

    async initVendor() {
        return new EventEmitter()
    }

    busEvents() {
        return []
    }

    async sendMessage(userId, message) {
        return { userId, message }
    }

    async saveFile() {
        return ''
    }
}
