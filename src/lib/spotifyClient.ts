import type { TokenSet } from './spotifyAuth'
import { refreshAccessToken, clearStoredAuth } from './spotifyAuth'

const API_BASE = 'https://api.spotify.com/v1'

export class SpotifyClient {
    private tokens: TokenSet
    private onTokenRefresh?: (tokens: TokenSet | null) => void

    constructor(tokens: TokenSet, onTokenRefresh?: (tokens: TokenSet | null) => void) {
        this.tokens = tokens
        this.onTokenRefresh = onTokenRefresh
    }

    updateTokenSet(tokens: TokenSet) {
        this.tokens = tokens
        this.onTokenRefresh?.(tokens)
    }

    get tokenSet() {
        return this.tokens
    }

    logout() {
        clearStoredAuth()
        this.onTokenRefresh?.(null)
    }

    private async ensureFreshAccessToken(): Promise<string> {
        const safetyWindow = 60_000 // refresh 1 minute before expiry
        if (Date.now() + safetyWindow < this.tokens.expiresAt) {
            return this.tokens.accessToken
        }

        const refreshed = await refreshAccessToken(this.tokens)
        this.tokens = refreshed
        this.onTokenRefresh?.(refreshed)
        return refreshed.accessToken
    }

    private async authorizedFetch(
        input: string,
        init: RequestInit = {},
        attempt = 0,
    ): Promise<Response> {
        const accessToken = await this.ensureFreshAccessToken()
        const url = input.startsWith('http') ? input : `${API_BASE}${input}`
        const headers = new Headers(init.headers)
        headers.set('Authorization', `Bearer ${accessToken}`)
        if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
            headers.set('Content-Type', 'application/json')
        }

        const response = await fetch(url, {
            ...init,
            headers,
        })

        if (response.status === 401 && attempt === 0) {
            const refreshed = await refreshAccessToken(this.tokens)
            this.tokens = refreshed
            this.onTokenRefresh?.(refreshed)
            return this.authorizedFetch(input, init, attempt + 1)
        }

        if (response.status === 429) {
            const retryAfter = Number(response.headers.get('retry-after') ?? '2') * 1000
            await new Promise((resolve) => setTimeout(resolve, retryAfter))
            return this.authorizedFetch(input, init, attempt + 1)
        }

        return response
    }

    async get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
        const response = await this.authorizedFetch(path, {
            ...(init ?? {}),
            method: 'GET',
        })
        if (!response.ok) {
            throw await this.toError(response)
        }
        return (await response.json()) as T
    }

    async post<T = unknown>(path: string, body: unknown, init?: RequestInit): Promise<T> {
        const finalInit = {
            ...(init ?? {}),
            method: 'POST',
            body: body instanceof FormData || body instanceof URLSearchParams ? body : JSON.stringify(body),
        }
        if (body instanceof FormData || body instanceof URLSearchParams) {
            const headers = new Headers(finalInit.headers)
            headers.delete('Content-Type')
            finalInit.headers = headers
        }
        const response = await this.authorizedFetch(path, finalInit)
        if (!response.ok) {
            throw await this.toError(response)
        }
        return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
    }

    async put<T = unknown>(path: string, body: unknown, init?: RequestInit): Promise<T> {
        const finalInit = {
            ...(init ?? {}),
            method: 'PUT',
            body: body instanceof FormData || body instanceof URLSearchParams ? body : JSON.stringify(body),
        }
        if (body instanceof FormData || body instanceof URLSearchParams) {
            const headers = new Headers(finalInit.headers)
            headers.delete('Content-Type')
            finalInit.headers = headers
        }
        const response = await this.authorizedFetch(path, finalInit)
        if (!response.ok) {
            throw await this.toError(response)
        }
        return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
    }

    private async toError(response: Response) {
        let details: unknown
        try {
            details = await response.json()
        } catch {
            details = { message: 'Không thể đọc chi tiết lỗi.' }
        }
        const error = new Error(
            `Spotify API trả về lỗi ${response.status}: ${typeof details === 'object' && details && 'error' in details
                ? JSON.stringify(details)
                : response.statusText
            }`,
        )
        return error
    }
}
