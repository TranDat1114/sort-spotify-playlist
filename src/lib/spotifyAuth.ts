const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined
const SCOPES = (import.meta.env.VITE_SPOTIFY_SCOPES as string | undefined) ??
    'playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-read-email'

export const CODE_VERIFIER_KEY = 'spotify:pkce_code_verifier'
export const STATE_KEY = 'spotify:auth_state'
export const TOKEN_STORAGE_KEY = 'spotify:token_set'

export interface TokenSet {
    accessToken: string
    refreshToken: string
    expiresAt: number
    scope: string
}

function assertEnv(name: string, value: string | undefined): string {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
}

function generateRandomString(length: number) {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    const base62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from(array, (x) => base62[x % base62.length]).join('')
}

async function sha256(base: string) {
    const bytes = new TextEncoder().encode(base)
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
    return hashBuffer
}

function base64UrlEncode(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte)
    })
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createCodeChallenge(codeVerifier: string) {
    const hashed = await sha256(codeVerifier)
    return base64UrlEncode(hashed)
}

export async function startSpotifyLogin() {
    const clientId = assertEnv('VITE_SPOTIFY_CLIENT_ID', CLIENT_ID)
    const redirectUri = assertEnv('VITE_SPOTIFY_REDIRECT_URI', REDIRECT_URI)
    const state = generateRandomString(64)
    const codeVerifier = generateRandomString(128)
    const codeChallenge = await createCodeChallenge(codeVerifier)

    sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier)
    sessionStorage.setItem(STATE_KEY, state)

    const url = new URL('https://accounts.spotify.com/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', SCOPES)
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('code_challenge', codeChallenge)

    window.location.assign(url.toString())
}

export function loadStoredTokens(): TokenSet | null {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as TokenSet
        if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
            return parsed
        }
    } catch (error) {
        console.warn('Failed to parse stored token', error)
    }
    return null
}

export function storeTokens(tokenSet: TokenSet) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenSet))
}

export function clearStoredAuth() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(CODE_VERIFIER_KEY)
    sessionStorage.removeItem(STATE_KEY)
}

interface TokenEndpointResponse {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
    token_type: 'Bearer'
}

function buildTokenSet(data: TokenEndpointResponse, previousRefreshToken?: string): TokenSet {
    const refreshToken = data.refresh_token ?? previousRefreshToken
    if (!refreshToken) {
        throw new Error('Missing refresh token from Spotify response')
    }
    return {
        accessToken: data.access_token,
        refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope,
    }
}

export async function completeAuthorization(code: string, returnedState: string): Promise<TokenSet> {
    const clientId = assertEnv('VITE_SPOTIFY_CLIENT_ID', CLIENT_ID)
    const redirectUri = assertEnv('VITE_SPOTIFY_REDIRECT_URI', REDIRECT_URI)
    const expectedState = sessionStorage.getItem(STATE_KEY)
    const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY)

    if (!expectedState || returnedState !== expectedState) {
        throw new Error('Trạng thái xác thực không hợp lệ, vui lòng thử lại.')
    }
    if (!codeVerifier) {
        throw new Error('Thiếu mã xác minh PKCE, hãy khởi động lại bước đăng nhập.')
    }

    const body = new URLSearchParams()
    body.set('grant_type', 'authorization_code')
    body.set('code', code)
    body.set('redirect_uri', redirectUri)
    body.set('client_id', clientId)
    body.set('code_verifier', codeVerifier)

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown_error' }))
        throw new Error(`Không thể hoàn tất đăng nhập Spotify: ${error.error ?? response.status}`)
    }

    const data = (await response.json()) as TokenEndpointResponse
    const tokenSet = buildTokenSet(data)
    storeTokens(tokenSet)
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(CODE_VERIFIER_KEY)
    return tokenSet
}

export async function refreshAccessToken(previous: TokenSet): Promise<TokenSet> {
    const clientId = assertEnv('VITE_SPOTIFY_CLIENT_ID', CLIENT_ID)
    const body = new URLSearchParams()
    body.set('grant_type', 'refresh_token')
    body.set('refresh_token', previous.refreshToken)
    body.set('client_id', clientId)

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    })

    if (!response.ok) {
        clearStoredAuth()
        throw new Error('Phiên Spotify đã hết hạn. Vui lòng đăng nhập lại.')
    }

    const data = (await response.json()) as TokenEndpointResponse
    const tokenSet = buildTokenSet(data, previous.refreshToken)
    storeTokens(tokenSet)
    return tokenSet
}
