const vscode = require('vscode');

const HEADING_RE = /^[^%]*\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]+)\}/;
const LEVEL = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4 };

let scrollSyncEnabled = false;
let scrollSyncTimer = null;

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
        const icons = ['book', 'list-unordered', 'symbol-namespace', 'symbol-method', 'symbol-field'];
        this.iconPath = new vscode.ThemeIcon(icons[level] || 'symbol-field');
        this.command = {
            command: 'tex-sync-buttons.gotoAndSync',
            title: 'Go to section',
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
    const doc = vscode.workspace.textDocuments.find(function(d) {
        return d.uri.toString() === uri.toString();
    });
    if (!doc) { return []; }

    const lines = doc.getText().split('\n');
    const roots = [];
    const stack = [];

    for (let i = 0; i < lines.length; i++) {
        const m = HEADING_RE.exec(lines[i]);
        if (!m) { continue; }
        const lvl = LEVEL[m[1]] !== undefined ? LEVEL[m[1]] : 5;
        const item = new TexSectionItem(m[2].trim(), i, lvl);

        while (stack.length > 0 && stack[stack.length - 1].level >= lvl) {
            stack.pop();
        }

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

function isTexEditor(editor) {
    return editor && (editor.document.languageId === 'latex' || editor.document.languageId === 'tex');
}

function findTexEditor() {
    if (isTexEditor(vscode.window.activeTextEditor)) {
        return vscode.window.activeTextEditor;
    }
    return vscode.window.visibleTextEditors.find(function(e) {
        return e.document.languageId === 'latex' || e.document.languageId === 'tex';
    });
}

function activate(context) {

    // Forward sync: jump PDF to current cursor position in .tex editor
    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.forwardSync', function() {
            vscode.commands.executeCommand('latex-workshop.synctex').then(undefined, function() {
                vscode.window.showErrorMessage(
                    'Forward sync failed. Make sure LaTeX Workshop is installed and the PDF has been built.'
                );
            });
        })
    );

    // Outline tree view
    const provider = new TexOutlineProvider();
    context.subscriptions.push(
        vscode.window.createTreeView('texSyncOutline', { treeDataProvider: provider, showCollapseAll: true })
    );

    function refreshForEditor(editor) {
        if (isTexEditor(editor)) {
            provider.refresh(editor.document.uri);
        }
    }

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(refreshForEditor));
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(function(doc) {
            if (doc.languageId === 'latex' || doc.languageId === 'tex') {
                provider.refresh(doc.uri);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.refreshOutline', function() {
            refreshForEditor(vscode.window.activeTextEditor);
        })
    );

    // Outline click: navigate to section line and forward sync
    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.gotoAndSync', function(line) {
            const texEditor = findTexEditor();
            if (!texEditor) { return; }

            const pos = new vscode.Position(line, 0);
            const sel = new vscode.Selection(pos, pos);

            vscode.window.showTextDocument(texEditor.document, {
                viewColumn: texEditor.viewColumn,
                preserveFocus: false,
                preview: false,
                selection: sel
            }).then(function() {
                vscode.commands.executeCommand('latex-workshop.synctex');
            });
        })
    );

    // Scroll sync toggle
    vscode.commands.executeCommand('setContext', 'texSyncButtons.scrollSyncOn', false);

    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.enableScrollSync', function() {
            scrollSyncEnabled = true;
            vscode.commands.executeCommand('setContext', 'texSyncButtons.scrollSyncOn', true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('tex-sync-buttons.disableScrollSync', function() {
            scrollSyncEnabled = false;
            clearTimeout(scrollSyncTimer);
            vscode.commands.executeCommand('setContext', 'texSyncButtons.scrollSyncOn', false);
        })
    );

    // Scroll listener: when enabled, sync PDF to visible center of .tex editor
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorVisibleRanges(function(e) {
            if (!scrollSyncEnabled) { return; }
            const lang = e.textEditor.document.languageId;
            if (lang !== 'latex' && lang !== 'tex') { return; }
            if (!e.visibleRanges.length) { return; }

            clearTimeout(scrollSyncTimer);
            scrollSyncTimer = setTimeout(function() {
                const editor = e.textEditor;
                const range = e.visibleRanges[0];
                const centerLine = Math.floor((range.start.line + range.end.line) / 2);
                const centerPos = new vscode.Position(centerLine, 0);
                const saved = editor.selection;
                editor.selection = new vscode.Selection(centerPos, centerPos);
                vscode.commands.executeCommand('latex-workshop.synctex').then(function() {
                    editor.selection = saved;
                }, function() {
                    editor.selection = saved;
                });
            }, 350);
        })
    );

    refreshForEditor(vscode.window.activeTextEditor);
}

function deactivate() {
    clearTimeout(scrollSyncTimer);
}

module.exports = { activate, deactivate };
