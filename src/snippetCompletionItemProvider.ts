import * as vscode from 'vscode';
import {getSnippets, Snippet} from './commands';

function toCompletionItem(snippet: Snippet) : vscode.CompletionItem | undefined
{
    try{
        const item = new vscode.CompletionItem(snippet.prefix, vscode.CompletionItemKind.Snippet);
        const snippetBody = snippet.body.join('\n');
        item.insertText = new vscode.SnippetString(snippetBody);
        item.detail = snippet.title;
        const ms = new vscode.MarkdownString();
        if(snippet.description) {
            ms.appendText(snippet.description);
        }
        ms.appendCodeblock(snippetBody, snippet.scope);
        item.documentation = ms;
        return item;
    } catch(e) {
        console.error('Convert snippet to completion error.', e);
    }
    return undefined;
}

export default class SnippetCompletionItemProvider implements vscode.CompletionItemProvider
{
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const snippets = getSnippets(document.languageId, true);
        if(snippets && snippets.length) {
            if(token.isCancellationRequested) {
                return [];
            }
            const result : vscode.CompletionItem[] = [];
            for(var snippet of snippets) {
                if(token.isCancellationRequested) {
                    return [];
                }
                const item = toCompletionItem(snippet);
                if(item) {
                    result.push(item);
                }
            }
            return result;
        }
        return [];
    }

}