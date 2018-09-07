export interface ExtensionPackageWithSnippets
{
    contributes: {
        snippets: Array<{language:string, path:string}>
    };
}


export function isExtensionPackageWithSnippets(obj: any) : obj is ExtensionPackageWithSnippets
{
    return obj && 'contributes' in obj && obj.contributes && 'snippets' in obj.contributes && obj.contributes.snippets instanceof Array && obj.contributes.snippets.length;
}