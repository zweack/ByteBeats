import { Album, Playlist, Track } from '@vscodespotify/spotify-common/lib/spotify/consts';
import { ISpotifyStatusState } from '../state/state';
import { SearchResultItem } from '../components/tree-search';

export const UPDATE_STATE_ACTION = 'UPDATE_STATE_ACTION' as 'UPDATE_STATE_ACTION';
export const SIGN_IN_ACTION = 'SIGN_IN_ACTION' as 'SIGN_IN_ACTION';
export const SIGN_OUT_ACTION = 'SIGN_OUT_ACTION' as 'SIGN_OUT_ACTION';
export const PLAYLISTS_LOAD_ACTION = 'PLAYLISTS_LOAD_ACTION' as 'PLAYLISTS_LOAD_ACTION';
export const ALBUM_LOAD_ACTION = 'ALBUM_LOAD_ACTION' as const;
export const SELECT_PLAYLIST_ACTION = 'SELECT_PLAYLIST_ACTION' as 'SELECT_PLAYLIST_ACTION';
export const SELECT_ALBUM_ACTION = 'SELECT_ALBUM_ACTION' as const;
export const TRACKS_LOAD_ACTION = 'TRACKS_LOAD_ACTION' as 'TRACKS_LOAD_ACTION';
export const SELECT_TRACK_ACTION = 'SELECT_TRACK_ACTION' as 'SELECT_TRACK_ACTION';
export const SEARCH_RESULTS_ACTION = 'SEARCH_RESULTS_ACTION' as const;
export const UPDATE_SEARCH_QUERY_ACTION = 'UPDATE_SEARCH_QUERY_ACTION' as const;

export interface UpdateStateAction {
    type: typeof UPDATE_STATE_ACTION;
    state: Partial<ISpotifyStatusState>;
}

export interface SignInAction {
    type: typeof SIGN_IN_ACTION;
    accessToken: string;
    refreshToken: string;
}

export interface SignOutAction {
    type: typeof SIGN_OUT_ACTION;
}

export interface PlaylistsLoadAction {
    type: typeof PLAYLISTS_LOAD_ACTION;
    playlists: Playlist[];
}

export interface AlbumLoadAction {
    type: typeof ALBUM_LOAD_ACTION;
    albums: Album[];
}

export interface TracksLoadAction {
    type: typeof TRACKS_LOAD_ACTION;
    list: Playlist | Album;
    tracks: Track[];
}

export interface SelectPlaylistAction {
    type: typeof SELECT_PLAYLIST_ACTION;
    playlist: Playlist;
}

export interface SelectAlbumAction {
    type: typeof SELECT_ALBUM_ACTION;
    album: Album;
}

export interface SelectTrackAction {
    type: typeof SELECT_TRACK_ACTION;
    track: Track;
}

export interface SearchResultsAction {
    type: typeof SEARCH_RESULTS_ACTION;
    results: SearchResultItem[];
    query: string;
}

export interface UpdateSearchQueryAction {
    type: typeof UPDATE_SEARCH_QUERY_ACTION;
    query: string;
}

export type Action = UpdateStateAction |
    SignInAction |
    SignOutAction |
    PlaylistsLoadAction |
    AlbumLoadAction |
    SelectPlaylistAction |
    SelectAlbumAction |
    TracksLoadAction |
    SelectTrackAction |
    SearchResultsAction |
    UpdateSearchQueryAction;
