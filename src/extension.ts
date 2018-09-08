'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {init, insertSnippetOutside, createSnippet} from './commands';
import SnippetCompletionItemProvider from './snippetCompletionItemProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    init(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('snippets-project.insertSnippetOutside', insertSnippetOutside),
        vscode.commands.registerCommand('snippets-project.createSnippet', createSnippet),
        vscode.languages.registerCompletionItemProvider({pattern:'**'}, new SnippetCompletionItemProvider(), 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z')
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
}