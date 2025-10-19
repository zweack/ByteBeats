import * as path from 'path';
import * as vscode from 'vscode';
import { Album, Playlist, Track } from '@vscodespotify/spotify-common/src/spotify/consts';
import { getState, getStore } from '../store/store';
import { actionsCreator } from '../actions/actions';

// Simplified types for search results which have a different structure than saved items
export type SearchAlbum = {
    id: string;
    name: string;
    artists: {
        name: string;
        id: string;
        uri: string;
    }[];
    uri: string;
    album_type: string;
    total_tracks: number;
};

export type SearchTrack = {
    id: string;
    name: string;
    artists: {
        name: string;
        id: string;
        uri: string;
    }[];
    uri: string;
    album: {
        id: string;
        name: string;
    };
};

export interface SearchResultItem {
    type: 'album' | 'playlist' | 'track';
    data: SearchAlbum | Playlist | SearchTrack;
}

export interface SearchGroupItem {
    type: 'group';
    label: string;
    items: SearchResultItem[];
}

type TreeItem = SearchGroupItem | SearchResultItem;

export class TreeSearchProvider implements vscode.TreeDataProvider<TreeItem> {
    readonly onDidChangeTreeDataEmitter: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this.onDidChangeTreeDataEmitter.event;

    private searchResults: SearchResultItem[] = [];
    private currentQuery: string = '';

    constructor() {
        getStore().subscribe(() => {
            const state = getState();
            const currentResults = state.searchResults?.items || [];
            const newQuery = state.searchQuery;
            
            if (!this.searchResults || 
                this.searchResults.length !== currentResults.length || 
                this.currentQuery !== newQuery) {
                this.searchResults = currentResults;
                this.currentQuery = newQuery;
                this.refresh();
            }
        });
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire(void 0);
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        if (element.type === 'group') {
            const item = new vscode.TreeItem(
                element.label,
                element.items.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
            );
            if (element.label.startsWith('Search Results')) {
                item.description = `"${this.currentQuery}"`;
            } else {
                item.description = `${element.items.length} items`;
            }
            return item;
        }
        return new SearchResultTreeItem(element, vscode.TreeItemCollapsibleState.None);
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            if (this.searchResults.length === 0) {
                if (this.currentQuery) {
                    return Promise.resolve([{
                        type: 'group',
                        label: 'Search Results for',
                        items: []
                    }]);
                }
                return Promise.resolve([]);
            }

            const tracks = this.searchResults.filter(r => r.type === 'track');
            const albums = this.searchResults.filter(r => r.type === 'album');
            const playlists = this.searchResults.filter(r => r.type === 'playlist');

            return Promise.resolve([
                {
                    type: 'group' as const,
                    label: `Search Results for`,
                    items: []
                },
                {
                    type: 'group' as const,
                    label: 'Tracks',
                    items: tracks
                },
                {
                    type: 'group' as const,
                    label: 'Albums',
                    items: albums
                },
                {
                    type: 'group' as const,
                    label: 'Playlists',
                    items: playlists
                }
            ].filter(group => group.type !== 'group' || group.items.length > 0 || group.label === 'Search Results for'));
        }

        if (element.type === 'group') {
            return Promise.resolve(element.items);
        }

        return Promise.resolve([]);
    }

    getParent(element: TreeItem): TreeItem | undefined {
        return undefined;
    }
}

class SearchResultTreeItem extends vscode.TreeItem {
    private readonly _searchItem: SearchResultItem;

    constructor(
        searchItem: SearchResultItem,
        collapsibleState: vscode.TreeItemCollapsibleState,
        command?: vscode.Command
    ) {
        const label = SearchResultTreeItem.getLabel(searchItem);
        super(label, collapsibleState);
        this._searchItem = searchItem;
        this.tooltip = this.generateTooltip();
        this.contextValue = searchItem.type;
        this.iconPath = {
            light: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'light', `${searchItem.type}.svg`)),
            dark: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'dark', `${searchItem.type}.svg`))
        };
        this.command = {
            command: 'spotify.playSearchResult',
            title: 'Play',
            arguments: [searchItem]
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
            default:
                return 'Unknown item type';
        }
    }

    private static getLabel(item: SearchResultItem): string {
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
            default:
                return 'Unknown item';
        }
    }
}

export const connectSearchTreeView = (view: vscode.TreeView<TreeItem>) =>
    vscode.Disposable.from(
        view.onDidChangeVisibility(e => {
            if (e.visible) {
                vscode.commands.executeCommand('spotify.search');
            }
        })
    );