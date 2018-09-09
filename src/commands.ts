import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import * as extpackage from './extpackage';

function mkdirsSync(p: string) {
    if(!fs.existsSync(p)){
        const parent = path.dirname(p);
        if(!fs.existsSync(parent)) {
            mkdirsSync(parent);
        }
        fs.mkdirSync(p);
    }
}

export interface Snippet {
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
    // console.log('scanOutsideExtensionSnippets');
    const barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    let count = 0;
    barItem.text = "[Snippet in project]Scaning snippets...";
    barItem.show();
    return new Promise(resolve=>{
        for(var ext of vscode.extensions.all){
            if(extpackage.isExtensionPackageWithSnippets(ext.packageJSON)){
                // console.log('scanOutsideExtensionSnippets', ext.id);
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

function getNameWithoutExtension(uri: vscode.Uri) {
    const basename = path.basename(uri.fsPath);
    return basename.substr(0, basename.length - path.extname(uri.fsPath).length);
}

function scanWorkspaceSnippets() {
    if(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
        vscode.workspace.findFiles('snippets/*.json').then(uris=>{
            for(var uri of uris) {
                if(uri.fsPath){
                    let basename = getNameWithoutExtension(uri);
                    if(!(basename in workspaceLanguageSnippets)) {
                        workspaceLanguageSnippets[basename] = [];
                    }
                    workspaceLanguageSnippets[basename] = workspaceLanguageSnippets[basename].concat(getSnippetsByFile(uri.fsPath, basename, uri));
                }
            }
        });
    }
}

function updateWorkspaceSnippets(doc: vscode.TextDocument) {
    const languageId = getNameWithoutExtension(doc.uri);
    const uri = doc.uri.toString();
    // remove same langaugeId & uri
    if(languageId in workspaceLanguageSnippets){
        const snippets = workspaceLanguageSnippets[languageId];
        for(var i=0;i<snippets.length;i++){
            if(snippets[i].uri === uri) {
                snippets.splice(i--, 1);
            }
        }
    }
    try{
        // add snippets
        const snippets = getSnippetsByDocument(doc, languageId);
        if(!(languageId in workspaceLanguageSnippets)){
            workspaceLanguageSnippets[languageId] = [];
        }
        workspaceLanguageSnippets[languageId] = workspaceLanguageSnippets[languageId].concat(snippets);
    }
    catch
    {}
}

export function init(context: vscode.ExtensionContext){
    setTimeout(()=>{
        scanOutsideExtensionSnippets();
        scanWorkspaceSnippets();
    }, 100);

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(onWorkspaceDidChangeTextDocument));
}

function onWorkspaceDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    if(e.contentChanges.length && !e.document.isUntitled && /snippets\/\w+\.json/.test(e.document.uri.path)){
        updateWorkspaceSnippets(e.document);
    }
}

function getSnippetsByFile(path: string, defaultScope: string, uri?: vscode.Uri): Array<Snippet>
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
            for(var line of snippet.body) {
                if(line.indexOf('$0') > -1) {
                    snippet.outSide = true;
                    break;
                }
            }
        }
        if(uri instanceof vscode.Uri) {
             snippet.uri = uri.toString();
        }
        result.push(snippet);
    }
    return result;
}

function getSnippetsByDocument(doc: vscode.TextDocument, defaultScope: string): Array<Snippet>
{
    var result:Array<Snippet> = [];
    var json = doc.getText();
    var snippets = JSON.parse(json) as {[pn:string]: Snippet};
    for(var title in snippets) {
        const snippet = snippets[title];
        if(!('scope' in snippet)) {
            snippet.scope = defaultScope;
        }
        snippet.title = title;
        if(snippet.body && snippet.body.length) {
            for(var line of snippet.body) {
                if(line.indexOf('$0') > -1) {
                    snippet.outSide = true;
                    break;
                }
            }
        }
        snippet.uri = doc.uri.toString();
        result.push(snippet);
    }
    return result;
}

export function getSnippets(langId: string, workspace: boolean = false): Array<Snippet> {
    let result: Array<Snippet> = [];
    if(!workspace && langId in outsideLanguageSnippets) {
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
        const editor = vscode.window.activeTextEditor;
        const selection = editor.selection;
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
            pick.onDidAccept(e=>{
                if(pick.selectedItems && pick.selectedItems.length) {
                    let selectedText = editor.document.getText(selection);
                    if(selectedText) {
                        selectedText = selectedText.replace(/\$|}|\\/g, '\\$&');
                    }
                    const insertStart = selection.active.isEqual(selection.start);
                    const body = (<SnippetQuickPickItem>pick.selectedItems[0]).snippet.body;
                    const lines: string[] = [];
                    for(var line of body) {
                        if(line.indexOf('$0')>-1) {
                            const indentTest = /^(\s*)\$0$/.exec(line);
                            if(indentTest && indentTest.length > 1) {
                                selectedText = selectedText.replace(/\n/g, '\n'+indentTest[1]);
                            }
                            line = line.replace('$0', insertStart ? ('$0'+selectedText) : (selectedText + '$0'));
                        }
                        lines.push(line);
                    }
                    editor.insertSnippet(new vscode.SnippetString(lines.join('\n')));
                }
                pick.dispose();
            });
            pick.show();
        }
    }
}

export function createSnippet()
{
    if(!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('create in project snippet require opened folder.');
        return;
    }
    if(vscode.window.activeTextEditor){
        const selection = vscode.window.activeTextEditor.selection;
        const selectionText = selection && !selection.isEmpty ? vscode.window.activeTextEditor.document.getText(selection) : null;
        const config = vscode.workspace.getConfiguration('snippets-project');
        const dir = config.dir || './snippets';
        let workspace = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
        if(!workspace) {
            workspace = vscode.workspace.workspaceFolders[0];
        }
        const fulldir = path.join(workspace.uri.fsPath, dir);
        if(!fs.existsSync(fulldir)) {
            try{
                mkdirsSync(fulldir);
            }catch(e) {
                console.error(e);
            }
        }
        const fullpath = path.join(fulldir, vscode.window.activeTextEditor.document.languageId + '.json');
        fs.exists(fullpath, exists=>{
            if(!exists) {                
                fs.writeFileSync(fullpath, '{\n\t\n}', {encoding: 'utf8'});
            }
            vscode.workspace.openTextDocument(fullpath).then(doc=>{
                const location = findJsonInsertPoint(doc);
                if(location) {
                    const hasProperies = snippetJsonAnyItem(doc);
                    vscode.window.showTextDocument(doc).then(editor=>{
                        const ss = new vscode.SnippetString();
                        let indent = '\t';
                        if(hasProperies) {
                            ss.appendText(',\n');
                            indent = '';
                        } else {
                            ss.appendText('\n');
                        }
                        ss.appendText(indent+'\"');
                        ss.appendPlaceholder('Display Name');
                        ss.appendText('\" : {\n');
                        ss.appendText(indent+'\t\"prefix\" : \"');
                        ss.appendPlaceholder('input');
                        ss.appendText('\",\n');
                        ss.appendText(indent+'\t\"body\" : [');
                        if(selectionText) {
                            let more = false;
                            for(var line of selectionText.split(/\r?\n/)) {
                                ss.appendText((more?',':'') + '\n'+indent+'\t\t' + JSON.stringify(line));
                                more = true;
                            }
                        } 
                        ss.appendText('\n'+indent+'\t]\n');
                        ss.appendText(indent+'}');
                        ss.appendPlaceholder("");
                        editor.insertSnippet(ss, location);
                    });
                } else {
                    vscode.window.showTextDocument(doc);
                    vscode.window.showErrorMessage('Can not found json code insert point, Please fix document format.');
                }
            });
        });
    }
}

function findJsonInsertPoint(doc: vscode.TextDocument): vscode.Position|undefined
{
    const text = doc.getText();
    const ts = /(\s*}\s*)$/.exec(text);
    if(ts && ts.index > 0) {
        return doc.positionAt(ts.index);
    }
    return undefined;
}

function snippetJsonAnyItem(doc: vscode.TextDocument) : boolean
{
    const text = doc.getText();
    return /(}\s*}\s*)$/.test(text);
}