const vscode = require('vscode');

const HEADING_RE = /^[^%]*\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]+)\}/;
const LEVEL = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4 };

let scrollSyncEnabled = false;
let scrollSyncTimer = null;
const SCROLL_DEBOUNCE_MS = 350;

class TexSectionItem extends vscode.TreeItem {
    constructor(label, line, level) {
        const collapsible = level <= 2
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None;
        super(label, collapsible);
        this.line = line;
        this.level = level;
        this.children = [];
        this.tooltip = label;
        this.iconPath = new vscode.ThemeIcon(
            ['book', 'list-unordered', 'symbol-namespace', 'symbol-method', 'symbol-field'][level] || 'symbol-field'
        );
        this.command = {
            command: 'tex-sync-buttons.gotoAndSync',
            title: 'Go to and Sync',
            arguments: [line]
        };
    }
}

class TexOutlineProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.roots = [];
    }
    refresh(uri) {
        this.roots = uri ? parseOutline(uri) : [];
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(el) { return el; }
    getChildren(el) { return el ? el.children : this.roots; }
}

function parseOutline(uri) {
    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
    if (!doc) return [];

    const lines = doc.getText().split('\n');
    const roots = [];
    const stack = [];

    for (let i = 0; i < lines.length; i++) {
        const m = HEADING_RE.exec(lines[i]);
        if (!m) continue;
        const level = LEVEL[m[1]] !== undefined ? LEVEL[m[1]] : 5;
        const item = new TexSectionItem(m[2].trim(), i, level);

        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();

        if (stack.length === 0) {
            roots.push(item);
        } else {
            const parent = stack[stack.length - 1];
            parent.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            parent.children.push(item);
        }
        stack.push(item);
    }
    return roots;
}

function activate(context) {

    // → button in .tex editor title bar: forward sync to PDF
    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.forwardSync', async () => {
            try {
                await vscode.commands.executeCommand('latex-workshop.synctex');
            } catch {
                vscode.window.showErrorMessage(
                    'Forward sync failed. Make sure LaTeX Workshop is installed and the PDF has been built.'
                );
            }
        })
    );

    // Outline panel
    const provider = new TexOutlineProvider();
    context.subscriptions.push(
        vscode.window.createTreeView('texSyncOutline', { treeDataProvider: provider, showCollapseAll: true })
    );

    function refreshForEditor(editor) {
        if (editor && (editor.document.languageId === 'latex' || editor.document.languageId === 'tex')) {
            provider.refresh(editor.document.uri);
        }
    }

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(refreshForEditor));
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'latex' || doc.languageId === 'tex') {
                provider.refresh(doc.uri);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.refreshOutline', () => {
            refreshForEditor(vscode.window.activeTextEditor);
        })
    );

    // Outline item click: jump to .tex line and sync PDF
    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.gotoAndSync', async (line) => {
            const texEditor = findTexEditor();
            if (!texEditor) return;

            const pos = new vscode.Position(line, 0);
            await vscode.window.showTextDocument(texEditor.document, {
                viewColumn: texEditor.viewColumn,
                preserveFocus: false,
                preview: false,
                selection: new vscode.Selection(pos, pos)
            });

            await new Promise(r => setTimeout(r, 80));
            try { await vscode.commands.executeCommand('latex-workshop.synctex'); } catch {}
        })
    );

    // Scroll sync toggle
    vscode.commands.executeCommand('setContext', 'texSyncButtons.scrollSyncOn', false);

    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.enableScrollSync', () => {
            scrollSyncEnabled = true;
            vscode.commands.executeCommand('setContext', 'texSyncButtons.scrollSyncOn', true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.disableScrollSync', () => {
            scrollSyncEnabled = false;
            clearTimeout(scrollSyncTimer);
            vscode.commands.executeCommand('setContext', 'texSyncButtons.scrollSyncOn', false);
        })
    );

    // Scroll listener: sync PDF when user scrolls the .tex editor
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorVisibleRanges(async (e) => {
            if (!scrollSyncEnabled) return;
            const lang = e.textEditor.document.languageId;
            if (lang !== 'latex' && lang !== 'tex') return;
            if (!e.visibleRanges.length) return;

            clearTimeout(scrollSyncTimer);
            scrollSyncTimer = setTimeout(async () => {
                const editor = e.textEditor;
                const range = e.visibleRanges[0];
                const centerLine = Math.floor((range.start.line + range.end.line) / 2);
                const centerPos = new vscode.Position(centerLine, 0);

                const saved = editor.selection;
                editor.selection = new vscode.Selection(centerPos, centerPos);
                try {
                    await vscode.commands.executeCommand('latex-workshop.synctex');
                } catch {}
                editor.selection = saved;
            }, SCROLL_DEBOUNCE_MS);
        })
    );

    refreshForEditor(vscode.window.activeTextEditor);
}

function findTexEditor() {
    const active = vscode.window.activeTextEditor;
    if (active && (active.document.languageId === 'latex' || active.document.languageId === 'tex')) {
        return active;
    }
    return vscode.window.visibleTextEditors.find(
        e => e.document.languageId === 'latex' || e.document.languageId === 'tex'
    );
}

function deactivate() {
    clearTimeout(scrollSyncTimer);
}

module.exports = { activate, deactivate };
