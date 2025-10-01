const durationFormatter = new Intl.NumberFormat('vi-VN', {
    minimumIntegerDigits: 2,
})

export function formatDuration(durationMs: number) {
    const totalSeconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${durationFormatter.format(seconds)}`
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
})

export function formatDateTime(iso: string) {
    try {
        return dateFormatter.format(new Date(iso))
    } catch {
        return iso
    }
}
