import * as path from 'path';
import * as vscode from 'vscode';
import { Album, Playlist, Track, SearchResultItem } from '@vscodespotify/spotify-common/src/spotify/consts';
import { getState, getStore } from '../store/store';
import { actionsCreator } from '../actions/actions';

// Simplified types for search results which have a different structure than saved items
type SearchAlbum = {
    id: string;
    name: string;
    artists: {
        name: string;
        id: string;
        uri: string;
    }[];
    uri: string;
};

type SearchTrack = {
    id: string;
    name: string;
    artists: {
        name: string;
        id: string;
        uri: string;
    }[];
    uri: string;
};

export interface SearchItem {
    type: 'album' | 'playlist' | 'track';
    data: SearchAlbum | Playlist | SearchTrack;
}

export class TreeSearchProvider implements vscode.TreeDataProvider<SearchItem> {
    readonly onDidChangeTreeDataEmitter: vscode.EventEmitter<SearchItem | undefined> = new vscode.EventEmitter<SearchItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<SearchItem | undefined> = this.onDidChangeTreeDataEmitter.event;

    private searchResults: SearchItem[] = [];

    constructor() {
        getStore().subscribe(() => {
            const state = getState();
            const currentResults = state.searchResults?.items || [];
            if (!this.searchResults || this.searchResults.length !== currentResults.length) {

                this.searchResults = state.searchResults?.items || [];
                this.refresh();
            }
        });
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire(void 0);
    }

    getTreeItem(item: SearchItem): vscode.TreeItem {
        return new SearchTreeItem(item, vscode.TreeItemCollapsibleState.None);
    }

    getChildren(element?: SearchItem): Thenable<SearchItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.searchResults || []);
    }

    getParent(_: SearchItem) {
        return void 0;
    }
}

class SearchTreeItem extends vscode.TreeItem {
    private readonly _searchItem: SearchItem;
    private readonly _tooltip: string;
    private readonly _label: string;

    constructor(
        searchItem: SearchItem,
        collapsibleState: vscode.TreeItemCollapsibleState,
        command?: vscode.Command
    ) {
        const label = SearchTreeItem.getLabel(searchItem);
        super(label, collapsibleState);
        this._searchItem = searchItem;
        this._label = label;
        this._tooltip = this.generateTooltip();
        this.tooltip = this._tooltip;
        this.contextValue = searchItem.type;
        this.iconPath = {
            light: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'light', `${searchItem.type}.svg`)),
            dark: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'dark', `${searchItem.type}.svg`))
        };
    }

    private generateTooltip(): string {
        switch (this._searchItem.type) {
            case 'album':
                const album = this._searchItem.data as SearchAlbum;
                return `Album: ${album.name} by ${album.artists[0].name}`;
            case 'playlist':
                const playlist = this._searchItem.data as Playlist;
                return `Playlist: ${playlist.name} by ${playlist.owner.display_name}`;
            case 'track':
                const track = this._searchItem.data as SearchTrack;
                return `Track: ${track.name} by ${track.artists[0].name}`;
        }
    }

    private static getLabel(item: SearchItem): string {
        switch (item.type) {
            case 'album':
                const album = item.data as SearchAlbum;
                return `${album.name} - ${album.artists[0].name}`;
            case 'playlist':
                const playlist = item.data as Playlist;
                return playlist.name;
            case 'track':
                const track = item.data as SearchTrack;
                return `${track.name} - ${track.artists[0].name}`;
        }
    }
}

export const connectSearchTreeView = (view: vscode.TreeView<SearchItem>) =>
    vscode.Disposable.from(
        view.onDidChangeVisibility(e => {
            if (e.visible) {
                vscode.commands.executeCommand('spotify.search');
            }
        })
    );