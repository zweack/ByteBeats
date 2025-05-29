import * as path from 'path';
import * as vscode from 'vscode';

import { actionsCreator } from '../actions/actions';
import { isAlbum } from '../isAlbum';
import { Album, Playlist, Track } from '../state/state';
import { getState, getStore } from '../store/store';

const createTrackTreeItem = (t: Track, playlistOrAlbum: Playlist | Album, trackIndex: number) =>
    new TrackTreeItem(t, trackIndex, playlistOrAlbum);

export const connectTrackTreeView = (view: vscode.TreeView<Track>) =>
    vscode.Disposable.from(
        view.onDidChangeSelection(e => {
            const track = e.selection[0];
            actionsCreator.selectTrackAction(track);
            // Also trigger playTrack command with correct arguments
            const provider = (view as any).treeDataProvider as TreeTrackProvider;
            if (provider && provider.selectedList && track) {
                const tracks = provider.tracks;
                const offset = tracks.findIndex(t => t.track.id === track.track.id);
                if (offset !== -1) {
                    vscode.commands.executeCommand('spotify.playTrack', offset, provider.selectedList);
                }
            }
        }),
        view.onDidChangeVisibility(e => {
            if (e.visible) {
                const state = getState();
                const { selectedTrack, selectedList } = state;

                if (selectedTrack && selectedList) {
                    const tracks = state.tracks.get(isAlbum(selectedList) ? selectedList.album.id : selectedList.id);
                    const p = tracks?.find(t => t.track.id === selectedTrack.track.id);

                    if (p && !view.selection.indexOf(p)) {
                        view.reveal(p, { focus: true, select: true });
                    }
                }
            }
        })
    );

export class TreeTrackProvider implements vscode.TreeDataProvider<Track> {
    readonly onDidChangeTreeDataEmitter: vscode.EventEmitter<Track | undefined> = new vscode.EventEmitter<Track | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Track | undefined> = this.onDidChangeTreeDataEmitter.event;

    public tracks: Track[] = [];
    public selectedList?: Playlist | Album;
    private selectedTrack?: Track;
    private view!: vscode.TreeView<Track>;

    constructor() {
        getStore().subscribe(() => {
            const { tracks, selectedList, selectedTrack } = getState();
            const newTracks = tracks.get((isAlbum(selectedList) ? selectedList?.album.id : selectedList?.id) || "");
            if (this.tracks !== newTracks || this.selectedTrack !== selectedTrack) {
                if (this.selectedTrack !== selectedTrack) {
                    this.selectedTrack = selectedTrack!;

                    if (this.selectedTrack && this.view) {
                        this.view.reveal(this.selectedTrack, { focus: true, select: true });
                    }
                }
                this.selectedList = selectedList!;
                this.selectedTrack = selectedTrack!;
                this.tracks = newTracks || [];
                this.refresh();
            }
        });
    }

    bindView(view: vscode.TreeView<Track>): void {
        this.view = view;
    }

    getParent(_t: Track) {
        return void 0; // all tracks are in root
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire(void 0);
    }

    getTreeItem(t: Track): TrackTreeItem {
        const { selectedList, tracks } = this;
        const index = tracks.findIndex(track =>
            t.track.id === track.track.id);
        return createTrackTreeItem(t, selectedList!, index);
    }

    getChildren(element?: Track): Thenable<Track[]> {
        if (element) {
            return Promise.resolve([]);
        }
        if (!this.tracks) {
            return Promise.resolve([]);
        }

        return new Promise(resolve => {
            resolve(this.tracks);
        });
    }
}

const getArtists = (track: Track) =>
    track.track.artists.map(a => a.name).join(', ');
class TrackTreeItem extends vscode.TreeItem {
    constructor(
        public readonly track: Track,
        public readonly offset: number,
        public readonly list: Playlist | Album
    ) {
        super(track.track.name, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: 'spotify.playTrack',
            title: 'Play Track',
            arguments: [offset, list]
        };
    }

    // @ts-ignore
    get tooltip(): string {
        return `${getArtists(this.track)} - ${this.track.track.album.name} - ${this.track.track.name}`;
    }

    iconPath = {
        light: vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'light', 'track.svg')),
        dark: vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'dark', 'track.svg'))
    };

    contextValue = 'track';
}
