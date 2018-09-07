import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import * as extpackage from './extpackage';

interface Snippet {
    prefix: string;
    body: Array<string>;
    scope?: string;
    title: string;
    description?: string;
    outSide?: boolean;
    uri?: string;
}

interface SnippetQuickPickItem extends vscode.QuickPickItem
{
    snippet: Snippet;
}

let outsideLanguageSnippets:{[languageId:string]:Array<Snippet>} = {};
let workspaceLanguageSnippets:{[languageId:string]:Array<Snippet>} = {};



function createPickItem(snippet:Snippet) : SnippetQuickPickItem
{
    return {label: snippet.prefix, description: snippet.title, detail: snippet.description, snippet:snippet};
}

function scanOutsideExtensionSnippets() {
    console.log('scanOutsideExtensionSnippets');
    const barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    let count = 0;
    barItem.text = "[Snippet in project]Scaning snippets...";
    barItem.show();
    return new Promise(resolve=>{
        for(var ext of vscode.extensions.all){
            if(extpackage.isExtensionPackageWithSnippets(ext.packageJSON)){
                console.log('scanOutsideExtensionSnippets', ext.id);
                for(var st of ext.packageJSON.contributes.snippets){
                    try{
                        var snippets = getSnippetsByFile(path.join(ext.extensionPath, st.path), st.language);
                        if(!(st.language in outsideLanguageSnippets)){
                            outsideLanguageSnippets[st.language] = [];
                        }
                        outsideLanguageSnippets[st.language] = outsideLanguageSnippets[st.language].concat(snippets);
                        count += snippets.length;
                    }
                    catch(e){
                        console.warn(`scan ext ${ext.id} snippet ${st.path} error.`);
                    }
                }
            }
        }
        resolve();
    }).then(()=>{
        console.log(`Scaned ${count} snippets.`);
        barItem.hide();
    }).catch(e=>{
        console.error(e);
        barItem.hide();
    });
}

function scanWorkspaceSnippets() {
    if(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
        vscode.workspace.findFiles('snippets/*.json').then(uris=>{
            for(var uri of uris) {
                if(uri.fsPath){
                    const basename = path.basename(uri.fsPath);
                    getSnippetsByFile(uri.fsPath, basename);
                }
            }
        });
    }
}

export function init(){
    setTimeout(()=>{
        scanOutsideExtensionSnippets();
        scanWorkspaceSnippets();
    }, 500);
}

function getSnippetsByFile(path: string, defaultScope: string): Array<Snippet>
{
    var result:Array<Snippet> = [];
    var json = fs.readFileSync(path, {encoding:'utf8'});
    var snippets = JSON.parse(json) as {[pn:string]: Snippet};
    for(var title in snippets) {
        const snippet = snippets[title];
        if(!('scope' in snippet)) {
            snippet.scope = defaultScope;
        }
        snippet.title = title;
        if(snippet.body && snippet.body.length) {
            for(var line in snippet.body) {
                if(line.includes('$0')) {
                    snippet.outSide = true;
                    break;
                }
            }
        }
        result.push(snippet);
    }
    return result;
}

function getSnippets(langId: string): Array<Snippet> {
    let result: Array<Snippet> = [];
    if(langId in outsideLanguageSnippets) {
        result = result.concat(outsideLanguageSnippets[langId]);
    }
    if(langId in workspaceLanguageSnippets) {
        result = result.concat(workspaceLanguageSnippets[langId]);
    }
    return result;
}

export function insertSnippetOutside()
{
    if(vscode.window.activeTextEditor){
        const selection = vscode.window.activeTextEditor.selection;
        const snippets = getSnippets(vscode.window.activeTextEditor.document.languageId);
        if(snippets.length === 0) {
            vscode.window.showWarningMessage('No found snippet for language \''+vscode.window.activeTextEditor.document.languageId+'\'!');
            return;
        }            
        if(snippets && snippets.length) {
            const pickItems = snippets.filter(s=>s.outSide).map(createPickItem);
            if(pickItems.length === 0) {
                vscode.window.showWarningMessage('No found snippet can insert outside!');
                return;
            }
            const pick = vscode.window.createQuickPick();
            pick.title = "Insert Snippet Outside";
            pick.placeholder = "snippet";
            pick.items = pickItems;
            pick.onDidHide(e=>{
                if(pick.selectedItems.length === 1){
                    
                }
            });
            pick.show();
        }
    }
}