import * as moment from 'moment';
import { window, OutputChannel } from 'vscode';

import { getEnableLogs } from '../config/spotify-config';

let outputChannel: OutputChannel | undefined;

function getOutputChannel(): OutputChannel {
    if (!outputChannel) {
        outputChannel = window.createOutputChannel('ByteBeats');
    }
    return outputChannel;
}

export function showInformationMessage(message: string) {
    window.showInformationMessage(`ByteBeats: ${message}`);
}

export function showWarningMessage(message: string, ...items: string[]) {
    return window.showWarningMessage(`ByteBeats: ${message}`, ...items);
}

export function showErrorMessage(message: string) {
    window.showErrorMessage(`ByteBeats: ${message}`);
}

export function log(...args: any[]) {
    if (getEnableLogs()) {
        const message = `[${moment().format('YYYY/MM/DD HH:mm:ss.SSS')}] ${args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
        ).join(' ')}`;
        getOutputChannel().appendLine(message);
        console.log(message); // Also log to console for debugging
    }
}

export function showOutput() {
    getOutputChannel().show();
}
