import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  clearStoredAuth,
  completeAuthorization,
  loadStoredTokens,
  startSpotifyLogin,
  type TokenSet,
} from './lib/spotifyAuth'
import { SpotifyClient } from './lib/spotifyClient'
import { formatDateTime, formatDuration } from './lib/formatters'

type SortField = 'name' | 'mainArtist' | 'album' | 'addedAt' | 'popularity' | 'durationMs'

interface SortRule {
  id: string
  field: SortField
  direction: 'asc' | 'desc'
}

interface PlaylistSummary {
  id: string
  name: string
  description?: string | null
  totalTracks: number
  imageUrl?: string
  ownerName?: string
}

interface TrackRow {
  id: string
  uri: string
  name: string
  artists: string
  mainArtist: string
  album: string
  popularity?: number | null
  durationMs: number
  addedAt: string
  originalIndex: number
}

interface BannerMessage {
  type: 'success' | 'error' | 'info'
  message: string
}

interface SpotifyImage {
  url: string
  height?: number | null
  width?: number | null
}

interface SpotifyUserProfile {
  id: string
  display_name: string
  images?: SpotifyImage[]
  email?: string
}

interface SpotifyArtist {
  name: string
}

interface SpotifyPlaylistAPI {
  id: string
  name: string
  description: string | null
  images: SpotifyImage[]
  tracks: { total: number }
  owner: { display_name: string | null }
}

interface SpotifyPlaylistsPage {
  items: SpotifyPlaylistAPI[]
  next: string | null
}

interface SpotifyPlaylistTracksResponse {
  items: Array<{
    added_at: string
    track: {
      id: string | null
      uri: string
      name: string
      popularity?: number | null
      duration_ms: number
      artists: SpotifyArtist[]
      album: { name: string }
    } | null
  }>
  next: string | null
}

const sortFieldOptions: Record<SortField, { label: string; description: string }> = {
  name: {
    label: 'Tên bài hát',
    description: 'Sắp xếp theo tên bài hát theo chữ cái.',
  },
  mainArtist: {
    label: 'Nghệ sĩ chính',
    description: 'Sắp xếp theo nghệ sĩ chính của bài hát.',
  },
  album: {
    label: 'Album',
    description: 'Sắp xếp theo tên album.',
  },
  addedAt: {
    label: 'Ngày thêm vào playlist',
    description: 'Sắp xếp theo thời điểm bạn thêm bài hát.',
  },
  popularity: {
    label: 'Độ phổ biến',
    description: 'Sắp xếp dựa trên độ phổ biến Spotify hiện tại.',
  },
  durationMs: {
    label: 'Thời lượng',
    description: 'Sắp xếp theo thời lượng bài hát.',
  },
}

function createStableId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 11)
}

const defaultSortRules: SortRule[] = [
  { id: createStableId(), field: 'addedAt', direction: 'desc' },
  { id: createStableId(), field: 'popularity', direction: 'desc' },
]

function extractPlaylistId(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const urlMatch = trimmed.match(/playlist\/(\w+)/)
  if (urlMatch) return urlMatch[1]
  const uriMatch = trimmed.match(/spotify:playlist:(\w+)/)
  if (uriMatch) return uriMatch[1]
  if (/^[A-Za-z0-9]{16,}$/.test(trimmed)) return trimmed
  return null
}

function compareStrings(a: string, b: string) {
  return a.localeCompare(b, 'vi', { sensitivity: 'base' })
}

function compareNumbers(a: number, b: number) {
  return a - b
}

function compareDates(a: string, b: string) {
  return new Date(a).getTime() - new Date(b).getTime()
}

function chunkArray<T>(source: T[], chunkSize: number) {
  const output: T[][] = []
  for (let i = 0; i < source.length; i += chunkSize) {
    output.push(source.slice(i, i + chunkSize))
  }
  return output
}

function App() {
  const [tokenSet, setTokenSet] = useState<TokenSet | null>(() => loadStoredTokens())

  const handleTokenChange = useCallback((tokens: TokenSet | null) => {
    setTokenSet(tokens)
    if (!tokens) {
      clearStoredAuth()
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<HomePage tokenSet={tokenSet} onTokenChange={handleTokenChange} />} />
      <Route path="/callback" element={<AuthCallback onSuccess={handleTokenChange} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

interface HomePageProps {
  tokenSet: TokenSet | null
  onTokenChange: (tokens: TokenSet | null) => void
}

function HomePage({ tokenSet, onTokenChange }: HomePageProps) {
  if (!tokenSet) {
    return <LandingScreen />
  }
  return <Dashboard tokenSet={tokenSet} onTokenChange={onTokenChange} />
}

function LandingScreen() {
  return (
    <div className="relative bg-slate-950 min-h-screen overflow-hidden text-slate-100">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent_55%)] opacity-70 pointer-events-none" />
        <div className="left-0 absolute inset-y-0 bg-gradient-to-r from-slate-950 via-slate-900/40 to-transparent w-1/3 pointer-events-none" />
      </div>
      <div className="z-10 relative flex flex-col justify-center items-center mx-auto px-6 max-w-3xl min-h-screen text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 border border-white/10 rounded-full text-slate-200 text-sm">
          <span className="inline-block bg-emerald-400 rounded-full w-2 h-2" />
          Sortify – trợ thủ Playlist Spotify của bạn
        </div>
        <h1 className="mt-6 font-semibold text-white text-4xl sm:text-5xl tracking-tight">
          Sắp xếp playlist Spotify tinh tế trong vài cú nhấp chuột
        </h1>
        <p className="mt-6 max-w-2xl text-slate-300 text-lg">
          Đăng nhập bằng tài khoản Spotify của bạn, chọn playlist cần sắp xếp,
          kết hợp nhiều tiêu chí cùng lúc và tạo playlist mới ngay tức thì.
        </p>
        <div className="flex sm:flex-row flex-col items-center gap-4 mt-10">
          <button
            type="button"
            onClick={startSpotifyLogin}
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 shadow-brand-500/40 shadow-glow hover:shadow-brand-500/45 hover:shadow-lg px-7 py-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-4 font-semibold text-white text-base hover:scale-[1.02] transition"
          >
            <svg
              className="w-5 h-5 group-hover:scale-110 transition-transform"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.373 0 0 5.372 0 12c0 5.302 3.438 9.799 8.205 11.387.6.111.82-.261.82-.58 0-.286-.011-1.04-.017-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.758-1.333-1.758-1.09-.745.083-.73.083-.73 1.205.084 1.84 1.238 1.84 1.238 1.07 1.832 2.809 1.303 3.492.997.108-.775.419-1.303.762-1.603-2.665-.303-5.466-1.332-5.466-5.931 0-1.31.469-2.381 1.237-3.22-.124-.303-.536-1.523.117-3.176 0 0 1.008-.323 3.301 1.23a11.5 11.5 0 0 1 3.003-.404c1.019.005 2.045.138 3.003.404 2.292-1.553 3.298-1.23 3.298-1.23.655 1.653.243 2.873.12 3.176.77.839 1.236 1.91 1.236 3.22 0 4.61-2.807 5.624-5.48 5.921.43.372.823 1.102.823 2.222 0 1.604-.014 2.898-.014 3.293 0 .321.216.697.825.579C20.565 21.796 24 17.3 24 12 24 5.372 18.627 0 12 0Z" />
            </svg>
            Đăng nhập với Spotify
          </button>
          <div className="text-slate-400 text-sm">
            Không cần cài đặt, hỗ trợ Tailwind CSS 4.1 &amp; Vite
          </div>
        </div>
      </div>
    </div>
  )
}

interface DashboardProps {
  tokenSet: TokenSet
  onTokenChange: (tokens: TokenSet | null) => void
}

function Dashboard({ tokenSet, onTokenChange }: DashboardProps) {
  const client = useMemo(() => new SpotifyClient(tokenSet, onTokenChange), [tokenSet, onTokenChange])

  const [user, setUser] = useState<SpotifyUserProfile | null>(null)
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true)
  const [playlistSearch, setPlaylistSearch] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistSummary | null>(null)
  const [playlistInput, setPlaylistInput] = useState('')
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [sortRules, setSortRules] = useState<SortRule[]>(defaultSortRules)
  const [banner, setBanner] = useState<BannerMessage | null>(null)
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)

  useEffect(() => {
    if (!banner) return
    const timeout = setTimeout(() => setBanner(null), 4200)
    return () => clearTimeout(timeout)
  }, [banner])

  const filteredPlaylists = useMemo(() => {
    if (!playlistSearch.trim()) return playlists
    const keyword = playlistSearch.trim().toLowerCase()
    return playlists.filter((playlist) => playlist.name.toLowerCase().includes(keyword))
  }, [playlistSearch, playlists])

  const sortedTracks = useMemo(() => {
    if (!tracks.length || !sortRules.length) return tracks
    const cloned = [...tracks]
    cloned.sort((a, b) => {
      for (const rule of sortRules) {
        const direction = rule.direction === 'asc' ? 1 : -1
        let comparison = 0
        switch (rule.field) {
          case 'name':
            comparison = compareStrings(a.name, b.name)
            break
          case 'mainArtist':
            comparison = compareStrings(a.mainArtist, b.mainArtist)
            break
          case 'album':
            comparison = compareStrings(a.album, b.album)
            break
          case 'addedAt':
            comparison = compareDates(a.addedAt, b.addedAt)
            break
          case 'popularity':
            comparison = compareNumbers(a.popularity ?? 0, b.popularity ?? 0)
            break
          case 'durationMs':
            comparison = compareNumbers(a.durationMs, b.durationMs)
            break
          default:
            comparison = 0
        }
        if (comparison !== 0) {
          return comparison * direction
        }
      }
      return compareNumbers(a.originalIndex, b.originalIndex)
    })
    return cloned
  }, [tracks, sortRules])

  const activeSortFields = sortRules.map((rule) => rule.field)
  const availableFields = (Object.keys(sortFieldOptions) as SortField[]).filter(
    (field) => !activeSortFields.includes(field),
  )

  const setUserFacingError = useCallback((message: string) => {
    setBanner({ type: 'error', message })
  }, [])

  const fetchProfile = useCallback(async () => {
    setIsLoadingUser(true)
    try {
      const profile = (await client.get<SpotifyUserProfile>('/me')) ?? null
      setUser(profile)
    } catch (error) {
      setUserFacingError(
        error instanceof Error
          ? error.message
          : 'Không thể tải thông tin tài khoản Spotify của bạn.',
      )
    } finally {
      setIsLoadingUser(false)
    }
  }, [client, setUserFacingError])

  const fetchPlaylists = useCallback(async () => {
    setIsLoadingPlaylists(true)
    try {
      const collected: PlaylistSummary[] = []
      let url: string | null = '/me/playlists?limit=50'
      while (url) {
        const response: SpotifyPlaylistsPage = await client.get(url)
        const mapped = response.items.map((item): PlaylistSummary => ({
          id: item.id,
          name: item.name,
          description: item.description,
          totalTracks: item.tracks.total,
          imageUrl: item.images?.[0]?.url,
          ownerName: item.owner?.display_name ?? undefined,
        }))
        collected.push(...mapped)
        if (!response.next) {
          url = null
        } else {
          const nextUrl = new URL(response.next)
          url = `${nextUrl.pathname}${nextUrl.search}`
        }
      }
      setPlaylists(collected)
      if (!selectedPlaylist && collected.length > 0) {
        setSelectedPlaylist(collected[0])
      }
    } catch (error) {
      setUserFacingError(
        error instanceof Error
          ? error.message
          : 'Không thể tải danh sách playlist của bạn.',
      )
    } finally {
      setIsLoadingPlaylists(false)
    }
  }, [client, selectedPlaylist, setUserFacingError])

  const fetchPlaylistTracks = useCallback(
    async (playlist: PlaylistSummary) => {
      setIsLoadingTracks(true)
      try {
        const collected: TrackRow[] = []
        let url: string | null = `/playlists/${playlist.id}/tracks?limit=100`
        let index = 0
        while (url) {
          const response: SpotifyPlaylistTracksResponse = await client.get(url)
          for (const item of response.items) {
            if (!item.track || !item.track.uri) continue
            collected.push({
              id: item.track.id ?? `${playlist.id}-${index}`,
              uri: item.track.uri,
              name: item.track.name,
              artists:
                item.track.artists?.map((artist: SpotifyArtist) => artist.name).join(', ') ??
                'Không rõ',
              mainArtist: item.track.artists?.[0]?.name ?? 'Không rõ',
              album: item.track.album?.name ?? 'Không rõ',
              popularity: item.track.popularity ?? null,
              durationMs: item.track.duration_ms ?? 0,
              addedAt: item.added_at,
              originalIndex: index,
            })
            index += 1
          }
          if (!response.next) {
            url = null
          } else {
            const nextUrl = new URL(response.next)
            url = `${nextUrl.pathname}${nextUrl.search}`
          }
        }
        setTracks(collected)
        setBanner({
          type: 'info',
          message: `Đã tải ${collected.length} bài hát từ “${playlist.name}”.`,
        })
      } catch (error) {
        setUserFacingError(
          error instanceof Error ? error.message : 'Không thể tải track của playlist này.',
        )
      } finally {
        setIsLoadingTracks(false)
      }
    },
    [client, setUserFacingError],
  )

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    void fetchPlaylists()
  }, [fetchPlaylists])

  useEffect(() => {
    if (selectedPlaylist) {
      void fetchPlaylistTracks(selectedPlaylist)
    }
  }, [fetchPlaylistTracks, selectedPlaylist])

  const handleSelectPlaylist = (playlist: PlaylistSummary) => {
    setSelectedPlaylist(playlist)
    setIsCreatePanelOpen(false)
    setNewPlaylistName(`Sortify • ${playlist.name}`)
    setNewPlaylistDescription(
      `Playlist được sắp xếp lại bằng Sortify ngày ${new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'long',
      }).format(new Date())}.`,
    )
    setIsPublic(false)
  }

  const handlePlaylistSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!playlistInput.trim()) return
    const playlistId = extractPlaylistId(playlistInput)
    if (!playlistId) {
      setUserFacingError('Không nhận diện được playlist. Vui lòng nhập đường dẫn hợp lệ.')
      return
    }
    try {
      const playlist = await client.get<SpotifyPlaylistAPI>(`/playlists/${playlistId}`)
      const summary: PlaylistSummary = {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        totalTracks: playlist.tracks.total,
        imageUrl: playlist.images?.[0]?.url,
        ownerName: playlist.owner?.display_name ?? undefined,
      }
      setPlaylists((current) => {
        const exists = current.some((item) => item.id === summary.id)
        return exists ? current : [summary, ...current]
      })
      handleSelectPlaylist(summary)
      setPlaylistInput('')
    } catch (error) {
      setUserFacingError(
        error instanceof Error ? error.message : 'Không thể truy cập playlist này.',
      )
    }
  }

  const toggleSortField = () => {
    if (!availableFields.length) return
    const field = availableFields[0]
    setSortRules((current) => [
      ...current,
      { id: createStableId(), field, direction: 'asc' },
    ])
  }

  const updateSortRule = (id: string, patch: Partial<SortRule>) => {
    setSortRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch, id: rule.id } : rule)),
    )
  }

  const removeSortRule = (id: string) => {
    setSortRules((current) => current.filter((rule) => rule.id !== id))
  }

  const handleCreatePlaylist = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedPlaylist || !user) return
    const uris = sortedTracks.map((track) => track.uri).filter(Boolean)
    if (!uris.length) {
      setUserFacingError('Không có bài hát hợp lệ để tạo playlist mới.')
      return
    }
    if (!newPlaylistName.trim()) {
      setUserFacingError('Vui lòng đặt tên cho playlist mới.')
      return
    }

    setIsCreatingPlaylist(true)
    try {
      const created = await client.post<{ id: string }>(`/users/${user.id}/playlists`, {
        name: newPlaylistName.trim(),
        description: newPlaylistDescription.trim() || undefined,
        public: isPublic,
      })

      for (const chunk of chunkArray(uris, 100)) {
        await client.post(`/playlists/${created.id}/tracks`, {
          uris: chunk,
        })
      }

      setBanner({ type: 'success', message: 'Playlist mới đã được tạo thành công!' })
      setIsCreatePanelOpen(false)
      setNewPlaylistName('')
      setNewPlaylistDescription('')
      setIsPublic(false)
      await fetchPlaylists()
    } catch (error) {
      setUserFacingError(
        error instanceof Error ? error.message : 'Không thể tạo playlist mới. Vui lòng thử lại.',
      )
    } finally {
      setIsCreatingPlaylist(false)
    }
  }

  const handleLogout = () => {
    client.logout()
  }

  return (
    <div className="relative bg-slate-950 min-h-screen text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_rgba(2,6,23,0.95))]" />
      <div className="z-10 relative flex flex-col mx-auto px-6 lg:px-10 pt-10 pb-16 max-w-content min-h-screen">
        <header className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-4">
          <div>
            <p className="font-semibold text-brand-300 text-sm uppercase tracking-[0.35em]">
              Sortify Studio
            </p>
            <h1 className="mt-2 font-semibold text-white text-3xl sm:text-4xl">
              Trình sắp xếp playlist Spotify đa tiêu chí
            </h1>
            <p className="mt-3 max-w-xl text-slate-400 text-sm">
              Dùng khoảng trắng hợp lý, bố cục tối giản và điểm nhấn bằng màu sắc thương hiệu.
              Theo dõi playlist của bạn và tạo phiên bản mới chỉ với một lần nhấn.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="self-start px-4 py-2 border border-white/10 hover:border-white/30 rounded-full font-medium text-slate-200 hover:text-white text-sm transition"
          >
            Đăng xuất
          </button>
        </header>

        {banner ? (
          <div
            className={`mt-8 rounded-2xl border px-4 py-3 text-sm backdrop-blur ${banner.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : banner.type === 'error'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : 'border-brand-500/40 bg-brand-500/10 text-brand-100'
              }`}
          >
            {banner.message}
          </div>
        ) : null}

        <main className="flex-1 gap-10 grid lg:grid-cols-[320px_minmax(0,1fr)] mt-10">
          <aside className="flex flex-col gap-8">
            <section className="bg-white/5 backdrop-blur p-6 border border-white/10 rounded-3xl">
              <div className="flex items-center gap-4">
                <div className="border border-white/10 rounded-2xl w-14 h-14 overflow-hidden">
                  {user?.images?.[0]?.url ? (
                    <img
                      src={user.images[0].url}
                      alt={user.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex justify-center items-center bg-slate-900 w-full h-full font-semibold text-brand-200 text-lg">
                      {user?.display_name?.[0] ?? '🙂'}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-slate-400 text-sm">Tài khoản Spotify</p>
                  <p className="font-medium text-white text-lg truncate">
                    {isLoadingUser ? 'Đang tải…' : user?.display_name ?? 'Không rõ'}
                  </p>
                  {user?.email ? (
                    <p className="text-slate-400 text-sm truncate">{user.email}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void fetchPlaylists()
                  void fetchProfile()
                }}
                className="mt-6 px-3 py-2 border border-white/10 hover:border-brand-500/60 rounded-full w-full text-slate-200 hover:text-white text-sm transition"
              >
                Làm mới dữ liệu
              </button>
            </section>

            <section className="bg-slate-950/60 backdrop-blur p-6 border border-white/10 rounded-3xl">
              <div className="flex justify-between items-center gap-2">
                <h2 className="font-semibold text-white text-base">Playlist của bạn</h2>
                <span className="text-slate-500 text-xs">
                  {isLoadingPlaylists ? 'Đang tải…' : `${playlists.length} playlist`}
                </span>
              </div>
              <div className="mt-4">
                <input
                  type="search"
                  placeholder="Tìm playlist theo tên"
                  value={playlistSearch}
                  onChange={(event) => setPlaylistSearch(event.target.value)}
                  className="bg-slate-900/80 px-4 py-2 border border-white/10 focus:border-brand-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-600/40 w-full text-slate-200 placeholder:text-slate-500 text-sm"
                />
              </div>
              <ul className="flex flex-col gap-2 mt-4 pr-1 max-h-60 overflow-y-auto">
                {filteredPlaylists.map((playlist) => {
                  const isActive = playlist.id === selectedPlaylist?.id
                  return (
                    <li key={playlist.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectPlaylist(playlist)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isActive
                            ? 'border-brand-500/70 bg-brand-500/10 text-white shadow-glow'
                            : 'border-white/5 bg-slate-950/40 text-slate-200 hover:border-brand-500/40 hover:bg-slate-900/60'
                          }`}
                      >
                        <p className="font-medium text-sm truncate">{playlist.name}</p>
                        <p className="mt-1 text-slate-400 text-xs truncate">
                          {playlist.totalTracks} bài hát · {playlist.ownerName ?? 'Bạn'}
                        </p>
                      </button>
                    </li>
                  )
                })}
                {!filteredPlaylists.length && !isLoadingPlaylists ? (
                  <li className="px-4 py-6 border border-white/10 border-dashed rounded-2xl text-slate-500 text-sm text-center">
                    Không tìm thấy playlist phù hợp.
                  </li>
                ) : null}
              </ul>
              <form onSubmit={handlePlaylistSubmit} className="space-y-3 mt-6">
                <label className="font-medium text-slate-400 text-xs uppercase tracking-wide">
                  Hoặc dán liên kết playlist khác
                </label>
                <input
                  type="text"
                  value={playlistInput}
                  onChange={(event) => setPlaylistInput(event.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  className="bg-slate-900/80 px-4 py-2 border border-white/10 focus:border-brand-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-600/40 w-full text-slate-200 placeholder:text-slate-500 text-sm"
                />
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-400 px-4 py-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300 focus-visible:outline-offset-4 w-full font-semibold text-white text-sm transition"
                >
                  Tải playlist tùy chọn
                </button>
              </form>
            </section>
          </aside>

          <section className="flex flex-col gap-6">
            <div className="bg-white/5 backdrop-blur p-6 border border-white/10 rounded-3xl">
              <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3">
                <div>
                  <h2 className="font-semibold text-white text-xl">
                    {selectedPlaylist ? selectedPlaylist.name : 'Chọn playlist để bắt đầu'}
                  </h2>
                  <p className="text-slate-400 text-sm">
                    {selectedPlaylist
                      ? `${selectedPlaylist.totalTracks} bài hát` +
                      (selectedPlaylist.description
                        ? ` · ${selectedPlaylist.description}`
                        : '')
                      : 'Chúng tôi sẽ hiển thị thông tin playlist tại đây.'}
                  </p>
                </div>
                {isLoadingTracks ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 border border-white/10 rounded-full text-slate-300 text-xs">
                    <span className="inline-flex bg-brand-400 rounded-full w-2 h-2 animate-pulse" />
                    Đang tải bài hát…
                  </span>
                ) : null}
              </div>

              <div className="space-y-4 mt-6">
                <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wide">
                  Thứ tự sắp xếp
                </h3>
                <div className="flex flex-col gap-3">
                  {sortRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-3 bg-slate-950/40 p-4 border border-white/5 rounded-2xl"
                    >
                      <div className="flex sm:flex-row flex-col flex-1 sm:items-center gap-2">
                        <div className="flex-1">
                          <label className="font-medium text-slate-400 text-xs">Tiêu chí</label>
                          <select
                            value={rule.field}
                            onChange={(event) =>
                              updateSortRule(rule.id, {
                                field: event.target.value as SortField,
                              })
                            }
                            className="bg-slate-900/80 mt-1 px-3 py-2 border border-white/10 focus:border-brand-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600/40 w-full text-slate-200 text-sm"
                          >
                            {(Object.keys(sortFieldOptions) as SortField[]).map((field) => (
                              <option
                                key={field}
                                value={field}
                                disabled={field !== rule.field && activeSortFields.includes(field)}
                              >
                                {sortFieldOptions[field].label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="font-medium text-slate-400 text-xs">Thứ tự</label>
                          <select
                            value={rule.direction}
                            onChange={(event) =>
                              updateSortRule(rule.id, {
                                direction: event.target.value as 'asc' | 'desc',
                              })
                            }
                            className="bg-slate-900/80 mt-1 px-3 py-2 border border-white/10 focus:border-brand-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600/40 w-full text-slate-200 text-sm"
                          >
                            <option value="asc">Tăng dần</option>
                            <option value="desc">Giảm dần</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSortRule(rule.id)}
                        className="self-start px-3 py-2 border border-white/5 hover:border-rose-500/50 rounded-full font-medium text-slate-300 hover:text-rose-200 text-xs transition"
                      >
                        Gỡ
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={toggleSortField}
                    disabled={!availableFields.length}
                    className="disabled:opacity-70 px-4 py-2 border disabled:border-slate-700 border-brand-500/50 hover:border-brand-400 border-dashed rounded-full font-medium text-brand-300 hover:text-brand-200 disabled:text-slate-600 text-sm transition"
                  >
                    Thêm tiêu chí
                  </button>
                  <span className="text-slate-500 text-xs">
                    Tối đa {Object.keys(sortFieldOptions).length} tiêu chí duy nhất
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/70 backdrop-blur p-6 border border-white/5 rounded-3xl">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-white text-lg">Danh sách bài hát đã sắp xếp</h3>
                <span className="text-slate-500 text-xs">
                  {sortedTracks.length} bài hát
                </span>
              </div>
              <div className="mt-4 border border-white/5 rounded-2xl overflow-hidden">
                <table className="divide-y divide-white/5 min-w-full text-slate-200 text-sm text-left">
                  <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Tên bài hát</th>
                      <th className="px-4 py-3 font-medium">Nghệ sĩ</th>
                      <th className="px-4 py-3 font-medium">Album</th>
                      <th className="px-4 py-3 font-medium">Ngày thêm</th>
                      <th className="px-4 py-3 font-medium text-right">Độ phổ biến</th>
                      <th className="px-4 py-3 font-medium text-right">Thời lượng</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-950/40 divide-y divide-white/5">
                    {sortedTracks.map((track, index) => (
                      <tr key={`${track.id}-${track.originalIndex}`} className="hover:bg-slate-900/60">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{track.name}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm">{track.artists}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{track.album}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{formatDateTime(track.addedAt)}</td>
                        <td className="px-4 py-3 text-slate-300 text-sm text-right">
                          {track.popularity ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-200 text-sm text-right">
                          {formatDuration(track.durationMs)}
                        </td>
                      </tr>
                    ))}
                    {!sortedTracks.length ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-slate-500 text-sm text-center">
                          {isLoadingTracks
                            ? 'Đang tải dữ liệu playlist…'
                            : 'Chưa có dữ liệu. Hãy chọn một playlist ở cột bên trái.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-brand-500/10 backdrop-blur p-6 border border-brand-500/30 rounded-3xl">
              <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-2">
                <div>
                  <h3 className="font-semibold text-white text-lg">Tạo playlist mới</h3>
                  <p className="text-brand-100 text-sm">
                    Sao chép thứ tự hiện tại sang một playlist mới trong tài khoản của bạn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatePanelOpen((value) => !value)}
                  className="self-start hover:bg-brand-500/20 px-4 py-2 border border-brand-500/60 rounded-full font-semibold text-brand-50 text-sm transition"
                >
                  {isCreatePanelOpen ? 'Ẩn biểu mẫu' : 'Mở biểu mẫu'}
                </button>
              </div>

              {isCreatePanelOpen ? (
                <form onSubmit={handleCreatePlaylist} className="gap-4 grid sm:grid-cols-2 mt-6">
                  <div className="sm:col-span-2">
                    <label className="font-medium text-brand-100 text-xs uppercase tracking-wide">
                      Tên playlist mới
                    </label>
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(event) => setNewPlaylistName(event.target.value)}
                      placeholder={selectedPlaylist ? `Sortify • ${selectedPlaylist.name}` : 'Tên playlist của bạn'}
                      className="bg-slate-950/80 mt-2 px-4 py-2 border border-white/10 focus:border-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 w-full text-white placeholder:text-brand-200/60 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-medium text-brand-100 text-xs uppercase tracking-wide">
                      Mô tả (tùy chọn)
                    </label>
                    <textarea
                      rows={3}
                      value={newPlaylistDescription}
                      onChange={(event) => setNewPlaylistDescription(event.target.value)}
                      className="bg-slate-950/80 mt-2 px-4 py-3 border border-white/10 focus:border-white/40 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 w-full text-white placeholder:text-brand-200/60 text-sm"
                      placeholder="Mô tả ngắn gọn về playlist này"
                    />
                  </div>
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <input
                      id="playlist-public"
                      type="checkbox"
                      checked={isPublic}
                      onChange={(event) => setIsPublic(event.target.checked)}
                      className="bg-slate-950 border border-white/20 rounded focus:ring-brand-500 w-4 h-4 text-brand-500"
                    />
                    <label htmlFor="playlist-public" className="text-brand-50 text-sm">
                      Công khai playlist mới này
                    </label>
                  </div>
                  <div className="flex items-center gap-4 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={isCreatingPlaylist || !sortedTracks.length}
                      className="bg-white hover:bg-slate-100 disabled:bg-white/40 px-6 py-2 rounded-full font-semibold text-brand-600 text-sm transition disabled:cursor-not-allowed"
                    >
                      {isCreatingPlaylist ? 'Đang tạo…' : 'Tạo playlist mới'}
                    </button>
                    <span className="text-brand-200 text-xs">
                      Playlist mới sẽ chứa {sortedTracks.length} bài hát theo thứ tự hiện tại.
                    </span>
                  </div>
                </form>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

interface AuthCallbackProps {
  onSuccess: (tokenSet: TokenSet | null) => void
}

function AuthCallback({ onSuccess }: AuthCallbackProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('Đang hoàn tất đăng nhập Spotify…')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const error = params.get('error')
    if (error) {
      setStatus('error')
      setMessage('Spotify đã từ chối quyền truy cập. Vui lòng thử lại.')
      return
    }
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      setStatus('error')
      setMessage('Thiếu mã xác thực từ Spotify. Vui lòng đăng nhập lại.')
      return
    }

    void completeAuthorization(code, state)
      .then((tokenSet) => {
        onSuccess(tokenSet)
        navigate('/', { replace: true })
      })
      .catch((error) => {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Không thể hoàn tất đăng nhập.')
      })
  }, [location.search, navigate, onSuccess])

  return (
    <div className="flex justify-center items-center bg-slate-950 min-h-screen text-slate-200">
      <div className="bg-slate-900/80 shadow-brand-900/30 shadow-xl px-8 py-12 border border-white/10 rounded-3xl text-center">
        {status === 'loading' ? (
          <Fragment>
            <div className="flex justify-center items-center mx-auto border border-brand-500/50 rounded-full w-12 h-12">
              <div className="border-2 border-t-transparent border-brand-400 rounded-full w-6 h-6 animate-spin" />
            </div>
            <p className="mt-6 font-medium text-white text-sm">{message}</p>
          </Fragment>
        ) : (
          <Fragment>
            <p className="font-medium text-rose-300 text-sm">{message}</p>
            <button
              type="button"
              onClick={() => {
                onSuccess(null)
                startSpotifyLogin()
              }}
              className="mt-6 px-4 py-2 border border-white/10 hover:border-brand-500/60 rounded-full font-semibold text-white text-sm"
            >
              Thử đăng nhập lại
            </button>
          </Fragment>
        )}
      </div>
    </div>
  )
}
