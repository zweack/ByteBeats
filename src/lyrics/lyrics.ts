import { Event, EventEmitter, ProgressLocation, TextDocumentContentProvider, Uri, window, workspace, QuickPickItem, env } from 'vscode';

import { getLyricsServerUrl, openPanelLyrics } from '../config/spotify-config';
import { showInformationMessage } from '../info/info';
import { xhr } from '../request/request';
import { getState } from '../store/store';
import * as cheerio from 'cheerio';

class TextContentProvider implements TextDocumentContentProvider {
    htmlContent = '';

    private _onDidChange = new EventEmitter<Uri>();

    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }

    provideTextDocumentContent(_uri: Uri): string {
        return this.htmlContent;
    }

    update(uri: Uri) {
        this._onDidChange.fire(uri);
    }
}

interface Song {
    artist: string,
    title: string,
    geniusPath?: string,
    /**
     * String similarity score for the song.
     */
    similarity?: number
}

type V3SongsResponse = {
    songs?: Song[];
};

export class LyricsController {
    private static lyricsContentProvider = new TextContentProvider();

    readonly registration = workspace.registerTextDocumentContentProvider('bytebeats', LyricsController.lyricsContentProvider);

    private readonly previewUri = Uri.parse('bytebeats://authority/bytebeats');

    async findLyrics() {
        window.withProgress({ location: ProgressLocation.Window, title: 'Searching for lyrics. This might take a while.' }, () =>
            this._findLyrics());
    }

    private async _findLyrics() {
        const state = getState();
        const { artist, name } = state.track;

        try {
            const url = `${getLyricsServerUrl()}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(name)}`;
            const result = await xhr({
                url
            });

            const { songs } = JSON.parse(result.responseText) as V3SongsResponse;

            if (!songs || !songs.length) {
                await this._previewLyrics(`Song lyrics for ${artist} - ${name} not found.\nYou can add it on https://genius.com/ .`);
                return;
            }

            let song = songs[0];
            if (song.similarity !== 1) {
                type QuickPickItemSong = QuickPickItem & { song: Song };
                const pick = await window.showQuickPick(
                    Array.from(songs.map((s): QuickPickItemSong => {
                        return {
                            label: `${s.artist} - ${s.title}`,
                            song: s
                        };
                    })),
                    {
                        ignoreFocusOut: true,
                        placeHolder: 'Select one of the songs that we think might be your song.'
                    }
                );
                if (!pick) {
                    return;
                }
                song = pick.song;
            }

            const geniusUrl = `https://genius.com${song.geniusPath}`;
            try {
                const fetchRes = await xhr({
                    url: geniusUrl
                });
                const $ = cheerio.load(fetchRes.responseText);
                
                let lyricsText = "";

                // Lyrics on Genius are typically found within 'div[data-lyrics-container="true"]'.
                $('div[data-lyrics-container="true"]').each(
                    (_i, containerElement) => {
                        $(containerElement)
                            .contents()
                            .each((_j, node) => {
                                if (node.type === "text") {
                                    // Text nodes (e.g., "[Verse 1]", "[Chorus]", etc.)
                                    lyricsText += $(node).text();
                                } else if (node.type === "tag") {
                                    const element = $(node);
                                    if (element.is("br")) {
                                        // <br> tags are treated as newlines.
                                        lyricsText += "\n";
                                    } else if (element.is('a[class^="ReferentFragment-desktop__ClickTarget-"]')) {
                                        // Each line of lyrics is often an 'a' tag with a specific class.
                                        // Get the text from the 'span' tag used for highlighting within it.
                                        const lineText = element
                                            .find('span[class^="ReferentFragment-desktop__Highlight-"]')
                                            .text();
                                        lyricsText += lineText;
                                    }
                                }
                            });
                        // If there are multiple lyrics container blocks, add a separator between them.
                        lyricsText += "\n\n";
                    }
                );

                // Additional Formatting
                const lyrics = lyricsText
                    .split("\n")
                    .map((line) => line.trim())
                    .join("\n")
                    .replace(/\n\n\n+/g, "\n\n")
                    .trim();
                
                await this._previewLyrics(`${artist} - ${name}\n\n${lyrics}`);
            }
            catch (e:any) {
                if (e.status === 403) {
                    // probably captcha. Open in browser
                    await env.openExternal(Uri.parse(geniusUrl));
                    await this._previewLyrics(`Song lyrics for ${artist} - ${name} not found.\nYou can add it on https://genius.com/ .`);
                }
                if (e.status === 404) {
                    await this._previewLyrics(`Song lyrics for ${artist} - ${name} not found.\nYou can add it on https://genius.com/ .`);
                }
                if (e.status === 500) {
                    await this._previewLyrics(`Error: ${e.responseText}`);
                }
            }
        } catch (e:any) {
            if (e.status === 404) {
                await this._previewLyrics(`Song lyrics for ${artist} - ${name} not found.\nYou can add it on https://genius.com/ .`);
            }
            if (e.status === 500) {
                await this._previewLyrics(`Error: ${e.responseText}`);
            }
        }
    }

    private async _previewLyrics(lyrics: string) {
        LyricsController.lyricsContentProvider.htmlContent = lyrics;
        LyricsController.lyricsContentProvider.update(this.previewUri);

        try {
            const document = await workspace.openTextDocument(this.previewUri);
            await window.showTextDocument(document, openPanelLyrics(), true);
        } catch (_ignored) {
            showInformationMessage('Failed to show lyrics' + _ignored);
        }
    }
}
