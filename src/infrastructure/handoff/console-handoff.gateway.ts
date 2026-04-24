export class ConsoleHandoffGateway {
    async dispatch(payload) {
        const handoffId = `handoff-${Date.now()}`
        const dispatchedAt = new Date().toISOString()

        console.log(
            JSON.stringify(
                {
                    event: 'lead_handoff',
                    handoffId,
                    dispatchedAt,
                    payload,
                },
                null,
                2
            )
        )

        return {
            handoffId,
            dispatchedAt,
            channel: 'human_team',
        }
    }
}
