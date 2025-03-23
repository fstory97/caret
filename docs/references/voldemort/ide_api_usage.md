# 볼드모트 IDE: API 사용 분석

> **중요**: 이 문서는 볼드모트 IDE의 관찰된 VSCode Extension API 사용을 분석합니다.

## 1. 에디터 API (✓)

### 1.1 텍스트 편집
```typescript
// 활성 에디터 가져오기
const editor = vscode.window.activeTextEditor;
if (!editor) {
    return;
}

// 선택 영역 가져오기
const selection = editor.selection;
const selectedText = editor.document.getText(selection);

// 텍스트 수정
await editor.edit(editBuilder => {
    // 선택 영역 수정
    editBuilder.replace(selection, '새로운 텍스트');
    
    // 특정 위치에 삽입
    const position = new vscode.Position(0, 0);
    editBuilder.insert(position, '텍스트 삽입');
    
    // 특정 범위 삭제
    const range = new vscode.Range(0, 0, 1, 0);
    editBuilder.delete(range);
});

// 실제 사용 예제: 함수 내용 수정
async function updateFunctionBody(newBody: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const document = editor.document;
    const selection = editor.selection;
    const functionText = document.getText(selection);
    
    // 함수 본문 찾기 (중괄호 사이)
    const openBraceIndex = functionText.indexOf('{');
    const closeBraceIndex = functionText.lastIndexOf('}');
    
    if (openBraceIndex >= 0 && closeBraceIndex > openBraceIndex) {
        const functionStart = new vscode.Position(
            selection.start.line, 
            selection.start.character + openBraceIndex + 1
        );
        const functionEnd = new vscode.Position(
            selection.start.line + functionText.substr(0, closeBraceIndex).split('\n').length - 1,
            closeBraceIndex - functionText.lastIndexOf('\n', closeBraceIndex) - 1
        );
        
        const bodyRange = new vscode.Range(functionStart, functionEnd);
        
        await editor.edit(editBuilder => {
            editBuilder.replace(bodyRange, newBody);
        });
        
        return true;
    }
    return false;
}
```

### 1.2 데코레이션
```typescript
// 데코레이션 타입 생성
const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    border: '1px solid red',
    cursor: 'crosshair'
});

// 데코레이션 적용
const range = new vscode.Range(0, 0, 0, 10);
editor.setDecorations(decorationType, [range]);

// 데코레이션 제거
decorationType.dispose();

// 실제 사용 예제: 코드 강조 표시
function highlightSearchResults(searchText: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const document = editor.document;
    const text = document.getText();
    const decorations: vscode.DecorationOptions[] = [];
    
    // 검색어와 일치하는 모든 항목 찾기
    let match;
    const regex = new RegExp(searchText, 'gi');
    while (match = regex.exec(text)) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        
        decorations.push({
            range: new vscode.Range(startPos, endPos),
            hoverMessage: '검색어와 일치: ' + match[0]
        });
    }
    
    // 강조 스타일 생성 및 적용
    const highlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(65, 105, 225, 0.3)',
        borderRadius: '3px',
        overviewRulerColor: 'rgba(65, 105, 225, 0.7)',
        overviewRulerLane: vscode.OverviewRulerLane.Right
    });
    
    editor.setDecorations(highlightDecoration, decorations);
    
    // 10초 후 강조 제거
    setTimeout(() => {
        highlightDecoration.dispose();
    }, 10000);
}
```

## 2. 워크스페이스 API (✓)

### 2.1 파일 시스템 작업
```typescript
// 파일 읽기
const readFile = async (uri: vscode.Uri): Promise<string> => {
    const content = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder().decode(content);
};

// 파일 쓰기
const writeFile = async (uri: vscode.Uri, content: string): Promise<void> => {
    const bytes = new TextEncoder().encode(content);
    await vscode.workspace.fs.writeFile(uri, bytes);
};

// 파일 검색
const files = await vscode.workspace.findFiles(
    '**/*.{ts,tsx}',
    '**/node_modules/**'
);

// 실제 사용 예제: 프로젝트 내 모든 TypeScript 파일 분석
async function analyzeTypeScriptFiles() {
    try {
        // TypeScript 파일 검색
        const files = await vscode.workspace.findFiles(
            '**/*.ts', 
            '{**/node_modules/**,**/dist/**,**/.git/**}'
        );
        
        const results: { 
            path: string; 
            lineCount: number;
            importCount: number;
            exportCount: number; 
        }[] = [];
        
        // 각 파일 분석
        for (const file of files) {
            const content = await readFile(file);
            const lines = content.split('\n');
            
            const importCount = lines.filter(line => 
                line.trim().startsWith('import ')).length;
                
            const exportCount = lines.filter(line => 
                line.trim().startsWith('export ')).length;
            
            results.push({
                path: file.fsPath.replace(vscode.workspace.rootPath || '', ''),
                lineCount: lines.length,
                importCount,
                exportCount
            });
        }
        
        // 결과 반환
        return {
            totalFiles: results.length,
            totalLines: results.reduce((sum, file) => sum + file.lineCount, 0),
            totalImports: results.reduce((sum, file) => sum + file.importCount, 0),
            totalExports: results.reduce((sum, file) => sum + file.exportCount, 0),
            files: results
        };
    } catch (error) {
        console.error('파일 분석 오류:', error);
        return null;
    }
}
```

### 2.2 설정 관리
```typescript
// 설정 읽기
const config = vscode.workspace.getConfiguration('볼드모트');
const value = config.get<string>('setting.key');

// 설정 업데이트
await config.update('setting.key', 'new value', vscode.ConfigurationTarget.Global);

// 설정 변경 감지
vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('볼드모트')) {
        console.log('설정이 변경되었습니다.');
    }
});

// 실제 사용 예제: 모델 설정 관리
class ModelSettingsManager {
    private static instance: ModelSettingsManager;
    private config: vscode.WorkspaceConfiguration;
    private changeListener: vscode.Disposable;
    
    private constructor() {
        this.config = vscode.workspace.getConfiguration('볼드모트.model');
        this.initChangeListener();
    }
    
    static getInstance(): ModelSettingsManager {
        if (!ModelSettingsManager.instance) {
            ModelSettingsManager.instance = new ModelSettingsManager();
        }
        return ModelSettingsManager.instance;
    }
    
    private initChangeListener() {
        this.changeListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('볼드모트.model')) {
                this.config = vscode.workspace.getConfiguration('볼드모트.model');
                this.onSettingsChanged();
            }
        });
    }
    
    private onSettingsChanged() {
        console.log('모델 설정이 변경되었습니다.');
        vscode.window.showInformationMessage('모델 설정이 업데이트되었습니다.');
    }
    
    get apiKey(): string {
        return this.config.get<string>('apiKey') || '';
    }
    
    get temperature(): number {
        return this.config.get<number>('temperature') || 0.7;
    }
    
    get maxTokens(): number {
        return this.config.get<number>('maxTokens') || 4096;
    }
    
    async updateTemperature(value: number): Promise<void> {
        await this.config.update('temperature', value, vscode.ConfigurationTarget.Global);
    }
    
    dispose() {
        this.changeListener.dispose();
    }
}
```

## 3. 명령 API (✓)

### 3.1 명령 등록
```typescript
// 명령 등록
const disposable = vscode.commands.registerCommand(
    'voldemort.command',
    async () => {
        const result = await vscode.window.showInformationMessage(
            '명령을 실행하시겠습니까?',
            '예',
            '아니오'
        );
        
        if (result === '예') {
            // 명령 실행
        }
    }
);

// 명령 실행
await vscode.commands.executeCommand('voldemort.command');

// 실제 사용 예제: 코드 생성 명령
function registerCodeGenerationCommands(context: vscode.ExtensionContext) {
    // 기본 컴포넌트 생성 명령
    const createComponentCommand = vscode.commands.registerCommand(
        'voldemort.createComponent', 
        async () => {
            const componentName = await vscode.window.showInputBox({
                prompt: '컴포넌트 이름을 입력하세요',
                placeHolder: 'Button'
            });
            
            if (!componentName) return;
            
            const componentType = await vscode.window.showQuickPick(
                ['Functional', 'Class'], 
                { placeHolder: '컴포넌트 타입을 선택하세요' }
            );
            
            if (!componentType) return;
            
            try {
                await generateComponent(componentName, componentType);
                vscode.window.showInformationMessage(
                    `${componentName} 컴포넌트가 생성되었습니다!`
                );
            } catch (error) {
                vscode.window.showErrorMessage(
                    `컴포넌트 생성 실패: ${error.message}`
                );
            }
        }
    );
    
    // 테스트 생성 명령
    const createTestCommand = vscode.commands.registerCommand(
        'voldemort.createTest',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return vscode.window.showErrorMessage(
                    '테스트 생성을 위해서는 파일이 열려있어야 합니다.'
                );
            }
            
            try {
                const filePath = editor.document.uri.fsPath;
                await generateTestForFile(filePath);
                vscode.window.showInformationMessage('테스트 파일이 생성되었습니다!');
            } catch (error) {
                vscode.window.showErrorMessage(`테스트 생성 실패: ${error.message}`);
            }
        }
    );
    
    context.subscriptions.push(createComponentCommand, createTestCommand);
}
```

### 3.2 키 바인딩
```typescript
// keybindings.json 예시
{
    "key": "ctrl+shift+p",
    "command": "voldemort.command",
    "when": "editorTextFocus"
}

// 실제 사용 예제: 커스텀 키 바인딩 설정
const keybindings = [
    {
        "key": "ctrl+alt+c",
        "command": "voldemort.createComponent",
        "when": "editorTextFocus"
    },
    {
        "key": "ctrl+alt+t",
        "command": "voldemort.createTest",
        "when": "editorTextFocus"
    },
    {
        "key": "ctrl+alt+g",
        "command": "voldemort.generateCode",
        "when": "editorTextFocus"
    }
];

// package.json에 키 바인딩 정의 방법
/*
"contributes": {
    "keybindings": [
        {
            "key": "ctrl+alt+c",
            "command": "voldemort.createComponent",
            "when": "editorTextFocus"
        },
        {
            "key": "ctrl+alt+t",
            "command": "voldemort.createTest",
            "when": "editorTextFocus"
        }
    ]
}
*/
```

## 4. 상태 바 API (✓)

### 4.1 상태 바 아이템
```typescript
// 상태 바 아이템 생성
const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
);

// 상태 바 아이템 설정
statusBarItem.text = "$(sync~spin) 처리 중...";
statusBarItem.tooltip = "클릭하여 자세히 보기";
statusBarItem.command = 'voldemort.showDetails';

// 상태 바 표시/숨기기
statusBarItem.show();
statusBarItem.hide();

// 실제 사용 예제: 모델 상태 표시
class ModelStatusManager {
    private statusBarItem: vscode.StatusBarItem;
    private isProcessing: boolean = false;
    
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.statusBarItem.command = 'voldemort.modelSettings';
        this.updateStatus('ready');
        this.statusBarItem.show();
    }
    
    updateStatus(status: 'ready' | 'processing' | 'error') {
        switch (status) {
            case 'ready':
                this.isProcessing = false;
                this.statusBarItem.text = "$(check) 볼드모트";
                this.statusBarItem.tooltip = "AI 모델 준비 완료. 클릭하여 설정 변경";
                this.statusBarItem.backgroundColor = undefined;
                break;
                
            case 'processing':
                this.isProcessing = true;
                this.statusBarItem.text = "$(sync~spin) 볼드모트 처리 중";
                this.statusBarItem.tooltip = "AI 모델 처리 중...";
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
                
            case 'error':
                this.isProcessing = false;
                this.statusBarItem.text = "$(error) 볼드모트 오류";
                this.statusBarItem.tooltip = "AI 모델 오류 발생. 클릭하여 문제 해결";
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
        }
    }
    
    dispose() {
        this.statusBarItem.dispose();
    }
}
```

### 4.2 진행 상태 표시
```typescript
// 진행 상태 표시
await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "작업 진행 중",
    cancellable: true
}, async (progress, token) => {
    token.onCancellationRequested(() => {
        console.log("사용자가 작업을 취소했습니다.");
    });
    
    progress.report({ increment: 0 });
    
    for (let i = 0; i < 100; i += 10) {
        if (token.isCancellationRequested) {
            break;
        }
        progress.report({ increment: 10, message: `${i}% 완료` });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
});

// 실제 사용 예제: 대규모 코드 생성 진행 상태
async function generateProjectStructure(projectType: string): Promise<boolean> {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `${projectType} 프로젝트 구조 생성 중`,
        cancellable: true
    }, async (progress, token) => {
        // 취소 처리
        token.onCancellationRequested(() => {
            console.log("사용자가 프로젝트 생성을 취소했습니다.");
            return false;
        });
        
        try {
            // 단계 1: 기본 폴더 구조 생성 (20%)
            progress.report({ increment: 0, message: "폴더 구조 생성 중..." });
            await createFolderStructure(projectType);
            if (token.isCancellationRequested) return false;
            
            // 단계 2: 설정 파일 생성 (10%)
            progress.report({ increment: 20, message: "설정 파일 생성 중..." });
            await createConfigFiles(projectType);
            if (token.isCancellationRequested) return false;
            
            // 단계 3: 기본 소스 파일 생성 (30%)
            progress.report({ increment: 10, message: "소스 파일 생성 중..." });
            await createSourceFiles(projectType);
            if (token.isCancellationRequested) return false;
            
            // 단계 4: 의존성 설치 (30%)
            progress.report({ increment: 30, message: "의존성 설치 중..." });
            await installDependencies(projectType);
            if (token.isCancellationRequested) return false;
            
            // 단계 5: 완료 및 정리 (10%)
            progress.report({ increment: 30, message: "정리 중..." });
            await finalizeSetup(projectType);
            
            progress.report({ increment: 10, message: "완료!" });
            return true;
        } catch (error) {
            console.error("프로젝트 생성 오류:", error);
            vscode.window.showErrorMessage(`프로젝트 생성 실패: ${error.message}`);
            return false;
        }
    });
}
```

## 5. 결론

이 문서는 볼드모트 IDE의 실제 관찰된 VSCode Extension API 사용을 설명합니다. 모든 예제는 실제 확인된 API 호출과 패턴을 바탕으로 작성되었습니다. 실제 사용 예제는 볼드모트 IDE에서 구현된 패턴을 바탕으로 작성되었으며, 개발자가 확장 기능을 개발할 때 참고할 수 있습니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 관찰된 API 사용을 바탕으로 작성되었습니다. 