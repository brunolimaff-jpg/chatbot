export class EvaluateRiskUseCase {
    constructor({ safetyGuardService }) {
        this.safetyGuardService = safetyGuardService
    }

    async execute(input) {
        const text = String(input?.text ?? '').trim()
        return this.safetyGuardService.evaluateText(text)
    }
}
