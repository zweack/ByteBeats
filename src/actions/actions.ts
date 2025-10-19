import { Api, getApi } from '@vscodespotify/spotify-common/lib/spotify/api';
import { Album, Playlist, Track } from '@vscodespotify/spotify-common/lib/spotify/consts';
import autobind from 'autobind-decorator';
import { commands, Uri, window } from 'vscode';
import { SearchResultItem } from '../components/tree-search';

import { createDisposableAuthSever } from '../auth/server/local';
import { getAuthServerUrl } from '../config/spotify-config';
import { SIGN_IN_COMMAND } from '../consts/consts';
import { log, showInformationMessage, showWarningMessage, showErrorMessage, showOutput } from '../info/info';
import { isAlbum } from '../isAlbum';
import { DUMMY_PLAYLIST, ILoginState, ISpotifyStatusState } from '../state/state';
import { getState, getStore } from '../store/store';
import { artistsToArtist } from '../utils/utils';
import {
    UpdateStateAction,
    UPDATE_STATE_ACTION,
    PlaylistsLoadAction,
    PLAYLISTS_LOAD_ACTION,
    AlbumLoadAction,
    ALBUM_LOAD_ACTION,
    SelectPlaylistAction,
    SELECT_PLAYLIST_ACTION,
    SelectAlbumAction,
    SELECT_ALBUM_ACTION,
    SelectTrackAction,
    SELECT_TRACK_ACTION,
    TracksLoadAction,
    TRACKS_LOAD_ACTION,
    SignInAction,
    SIGN_IN_ACTION,
    SignOutAction,
    SIGN_OUT_ACTION
} from './common';

export function withApi() {
    return (_target: any, _key: any, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const api = getSpotifyWebApi();
            if (api) {
                return originalMethod.apply(this, [...args, api]);
            } else {
                (async () => {
                    const signIn = 'Sign in';
                    const result = await showWarningMessage('You should be logged in order to use this feature.', signIn);
                    if (result === signIn) {
                        commands.executeCommand(SIGN_IN_COMMAND);
                    }
                })();
            }
        };

        return descriptor;
    };
}

export function withErrorAsync() {
    return (_target: any, _key: any, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            try {
                return await originalMethod.apply(this, args);
            } catch (e: any) {
                if (e.message && e.message.includes('invalid json response body')) {
                    return;
                }
                if (
                    (e.message && e.message.includes('Restriction violated')) ||
                    (e.status === 403 && e.body && e.body.error && e.body.error.reason === 'UNKNOWN')
                ) {
                    showWarningMessage('Spotify cannot perform this action due to account or device restrictions.');
                    return;
                }
                if (
                    (e.message && e.message.includes('No active device')) ||
                    (e.status === 404 && e.body && e.body.error && e.body.error.reason === 'NO_ACTIVE_DEVICE')
                ) {
                    showWarningMessage('Could not find any active Spotify session. Please start Spotify app or web player');
                    return;
                }
                showWarningMessage('Failed to perform operation ' + (e.message || e));
            }
        };

        return descriptor;
    };
}

function actionCreator() {
    return (_target: any, _key: any, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const action = originalMethod.apply(this, args);
            if (!action) {
                return;
            }
            getStore().dispatch(action);
        };

        return descriptor;
    };
}

function asyncActionCreator() {
    return (_target: any, _key: any, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            (async () => {
                let action;
                try {
                    action = await originalMethod.apply(this, args);
                    if (!action) {
                        return;
                    }
                } catch (e: any) {
                    showWarningMessage('Failed to perform operation ' + (e.message || e));
                    return;
                }
                getStore().dispatch(action);
            })();
        };

        return descriptor;
    };
}

const apiMap = new WeakMap<ILoginState, Api>();
export const getSpotifyWebApi = () => {
    const { loginState } = getState();
    if (!loginState) {
        log('getSpotifyWebApi', 'NOT LOGGED IN');
        return null;
    }
    if (!window.state.focused) {
        log('getSpotifyWebApi', 'NOT FOCUSED');
        return null;
    }
    let api = apiMap.get(loginState);
    if (!api) {
        api = getApi(getAuthServerUrl(), loginState.accessToken, loginState.refreshToken, (token: string) => {
            // Update the store with the new access token and refresh the API instance
            actionsCreator._actionSignIn(token, loginState.refreshToken);
            // Remove old API instance and create a new one with updated token
            apiMap.delete(loginState);
        });
        apiMap.set(loginState, api);
    }
    return api;
};

class ActionCreator {
    @autobind
    @actionCreator()
    updateStateAction(state: Partial<ISpotifyStatusState>): UpdateStateAction {
        return {
            type: UPDATE_STATE_ACTION,
            state
        };
    }

    @autobind
    @asyncActionCreator()
    @withApi()
    async loadPlaylists(api?: Api): Promise<PlaylistsLoadAction> {
        const playlists = await api!.playlists.getAll();
        return {
            type: PLAYLISTS_LOAD_ACTION,
            playlists
        };
    }

    @autobind
    @asyncActionCreator()
    @withApi()
    async loadAlbums(api?: Api): Promise<AlbumLoadAction> {
        const albums = await api!.albums.getAll();
        return {
            type: ALBUM_LOAD_ACTION,
            albums
        };
    }



    @autobind
    @actionCreator()
    selectPlaylistAction(p: Playlist): SelectPlaylistAction {
        return {
            type: SELECT_PLAYLIST_ACTION,
            playlist: p
        };
    }

    @autobind
    @actionCreator()
    selectAlbumAction(album: Album): SelectAlbumAction {
        return {
            type: SELECT_ALBUM_ACTION,
            album
        };
    }

    @autobind
    @actionCreator()
    selectTrackAction(track: Track): SelectTrackAction {
        return {
            type: SELECT_TRACK_ACTION,
            track
        };
    }

    @autobind
    selectCurrentTrack() {
        const state = getState();
        if (state.playerState && state.track) {
            let track: Track;
            const currentTrack = state.track;
            const playlist = state.playlists.find(p => {
                const tracks = state.tracks.get(p.id);
                if (tracks) {
                    const foundTrack = tracks.find(t => t.track.name === currentTrack.name
                        && t.track.album.name === currentTrack.album
                        && artistsToArtist(t.track.artists) === currentTrack.artist);

                    if (foundTrack) {
                        track = foundTrack;
                        return true;
                    }
                }
                return false;
            });

            if (playlist) {
                this.selectPlaylistAction(playlist);
                this.selectTrackAction(track!);
            }
        }
    }

    @autobind
    loadTracksForSelectedPlaylist(): void {
        this.loadTracks(getState().selectedList);
    }

    @autobind
    loadTracksIfNotLoaded(list: Playlist | Album): void {
        if (!list) {
            return void 0;
        }
        const { tracks } = getState();
        if (!tracks.has(isAlbum(list) ? list.album.id : list.id)) {
            this.loadTracks(list);
        }
    }

    @autobind
    @asyncActionCreator()
    @withApi()
    async loadTracks(list?: Playlist | Album, api?: Api): Promise<TracksLoadAction | undefined> {
        if (isAlbum(list)) {
            const tracks = await api!.albums.tracks.getAll(list);
            return {
                type: TRACKS_LOAD_ACTION,
                list,
                tracks
            };

        }

        if (!list || list.id === DUMMY_PLAYLIST.id) {
            return void 0;
        }
        const tracks = await api!.playlists.tracks.getAll(list);
        return {
            type: TRACKS_LOAD_ACTION,
            list,
            tracks
        };
    }

    @autobind
    @withErrorAsync()
    @withApi()
    async playTrack(offset: number, list: Playlist | Album, api?: Api): Promise<undefined> {
        await api!.player.play.put({
            offset,
            albumUri: isAlbum(list) ? list.album.uri : list.uri
        });
        return;
    }

    @autobind
    @withErrorAsync()
    @withApi()
    async seekTo(time: string, api?: Api): Promise<void> {
        const timeS = time || await window.showInputBox({ prompt: 'Select time to seek to in format mm:ss or ss' });
        if (!timeS) {
            return;
        }
        const invalidTimeFormatError = 'Invalid time format. Should be in format mm:ss or ss';
        const timeA = timeS.split(':');
        if (timeA.length > 2) {
            showErrorMessage(invalidTimeFormatError);
            return;
        }
        let minutes = 0;
        let seconds = 0;
        if (timeA[1]) {
            minutes = parseFloat(timeA[0]);
            seconds = parseFloat(timeA[1]);
        } else {
            seconds = parseFloat(timeA[0]);
        }

        if (Number.isNaN(seconds) || Number.isNaN(minutes)) {
            showErrorMessage(invalidTimeFormatError);
            return;
        }

        const seekTo = Math.round((minutes * 60 + seconds) * 1000);

        await api!.player.seek.put(seekTo);
    }

    @autobind
    @withErrorAsync()
    @withApi()
    async skipForward(seconds: number, api?: Api): Promise<void> {
        const state = getState();
        const currentPosition = state.playerState.position;
        // currentPosition is already in milliseconds
        const seekTo = currentPosition + (seconds * 1000);
        await api!.player.seek.put(seekTo);
    }

    @autobind
    @withErrorAsync()
    @withApi()
    async skipBack(seconds: number, api?: Api): Promise<void> {
        const state = getState();
        const currentPosition = state.playerState.position;
        // currentPosition is already in milliseconds
        const seekTo = Math.max(currentPosition - (seconds * 1000), 0);
        await api!.player.seek.put(seekTo);
    }

    @autobind
    actionSignIn() {
        Promise.resolve(commands.executeCommand('vscode.open', Uri.parse(`${getAuthServerUrl()}/login`))).then(() => {
            const { createServerPromise, dispose } = createDisposableAuthSever();
            createServerPromise.then(({ accessToken, refreshToken }) => {
                this._actionSignIn(accessToken, refreshToken);
            }).catch(e => {
                showInformationMessage(`Failed to retrieve access token : ${JSON.stringify(e)}`);
            }).then(() => {
                dispose();
            });
        }).catch(e => {
            showErrorMessage(`Failed to open login URL: ${e.message || e}`);
        });
    }

    @autobind
    @actionCreator()
    _actionSignIn(accessToken: string, refreshToken: string): SignInAction {
        return {
            accessToken,
            refreshToken,
            type: SIGN_IN_ACTION
        };
    }

    @autobind
    @actionCreator()
    actionSignOut(): SignOutAction {
        return {
            type: SIGN_OUT_ACTION
        };
    }

    @autobind
    @withErrorAsync()
    @withApi()
    async search(api?: Api): Promise<void> {
        const query = await window.showInputBox({
            placeHolder: 'Search for tracks, albums, or playlists...',
            prompt: 'Enter search query'
        });

        if (!query) {
            return;
        }

        showOutput(); // Show the output panel after user enters query

        log('search', 'Searching for:', query);
        const results = await api!.search.get(query, ['track', 'album', 'playlist']);
        log('search', 'Raw API results:', JSON.stringify(results, null, 2));
        
        const searchResults: SearchResultItem[] = [];

        if (results.tracks?.items) {
            log('search', 'Processing tracks:', results.tracks.items.length);
            for (const item of results.tracks.items as any[]) {
                try {
                    log('search', 'Processing track:', item.name);
                    searchResults.push({
                        type: 'track' as const,
                        data: {
                            id: item.id,
                            name: item.name,
                            artists: item.artists,
                            uri: item.uri,
                            album: item.album
                        }
                    });
                } catch (err) {
                    log('search', 'Error processing track:', err);
                }
            }
        }
        
        if (results.albums?.items) {
            log('search', 'Processing albums:', results.albums.items.length);
            for (const item of results.albums.items as any[]) {
                try {
                    log('search', 'Processing album:', item.name);
                    searchResults.push({
                        type: 'album' as const, 
                        data: {
                            id: item.id,
                            name: item.name,
                            artists: item.artists,
                            uri: item.uri,
                            album_type: item.album_type,
                            total_tracks: item.total_tracks
                        }
                    });
                } catch (err) {
                    log('search', 'Error processing album:', err);
                }
            }
        }

        if (results.playlists?.items) {
            log('search', 'Processing playlists:', results.playlists.items.length);
            for (const playlist of results.playlists.items) {
                try {
                    log('search', 'Processing playlist:', playlist.name);
                    searchResults.push({ type: 'playlist' as const, data: playlist });
                } catch (err) {
                    log('search', 'Error processing playlist:', err);
                }
            }
        }

        log('search', 'Final searchResults length:', searchResults.length);
        
        getStore().dispatch({
            type: 'SEARCH_RESULTS_ACTION' as const,
            results: searchResults,
            query
        });

        log('search', 'Final processed results:', JSON.stringify(searchResults, null, 2));
    }

    @autobind
    @actionCreator()
    updateSearchQuery(query: string) {
        return {
            type: 'UPDATE_SEARCH_QUERY_ACTION' as const,
            query
        };
    }
}

export const actionsCreator = new ActionCreator();
