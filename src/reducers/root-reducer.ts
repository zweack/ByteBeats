import {
    Action,
    ALBUM_LOAD_ACTION,
    PLAYLISTS_LOAD_ACTION,
    SELECT_ALBUM_ACTION,
    SELECT_PLAYLIST_ACTION,
    SELECT_TRACK_ACTION,
    SIGN_IN_ACTION,
    SIGN_OUT_ACTION,
    TRACKS_LOAD_ACTION,
    UPDATE_STATE_ACTION
} from '../actions/common';
import { log } from '../info/info';
import { isAlbum } from '../isAlbum';
import { DEFAULT_STATE, DUMMY_PLAYLIST, ISpotifyStatusState } from '../state/state';

export function update<T>(obj: T, propertyUpdate: Partial<T>): T {
    return Object.assign({}, obj, propertyUpdate);
}

export default function (state: ISpotifyStatusState, action: Action): ISpotifyStatusState {
    log('root-reducer', action.type, JSON.stringify(action));
    if (action.type === UPDATE_STATE_ACTION) {
        return update(state, action.state);
    }
    if (action.type === SIGN_IN_ACTION) {
        return update(state, {
            loginState: update(
                state.loginState, { accessToken: action.accessToken, refreshToken: action.refreshToken }
            )
        });
    }
    if (action.type === SIGN_OUT_ACTION) {
        return DEFAULT_STATE;
    }
    if (action.type === PLAYLISTS_LOAD_ACTION) {
        return update(state, {
            playlists: (action.playlists && action.playlists.length) ? action.playlists : [DUMMY_PLAYLIST]
        });
    }
    if (action.type === ALBUM_LOAD_ACTION) {
        return update(state, {
            albums: action.albums
        });
    }
    if (action.type === SELECT_ALBUM_ACTION) {
        return update(state, {
            selectedList: action.album
        });
    }
    if (action.type === SELECT_PLAYLIST_ACTION) {
        return update(state, {
            selectedList: action.playlist
        });
    }
    if (action.type === SELECT_TRACK_ACTION) {
        return update(state, {
            selectedTrack: action.track
        });
    }
    if (action.type === TRACKS_LOAD_ACTION) {
        return update(state, {
            tracks: state.tracks.set(
                isAlbum(action.list) ? action.list.album.id : action.list.id,
                action.tracks
            )
        });
    }
    if (action.type === 'SEARCH_RESULTS_ACTION') {
        return update(state, {
            searchResults: { items: action.results },
            searchQuery: action.query
        });
    }
    if (action.type === 'UPDATE_SEARCH_QUERY_ACTION') {
        return update(state, {
            searchQuery: action.query
        });
    }
    return state;
}
