# 볼드모트 IDE: 컨텍스트 관리 분석

> **중요**: 이 문서는 볼드모트 IDE에서 실제로 구현된 컨텍스트 관리 방식을 분석합니다.

## 1. 작업 공간 컨텍스트 (✓)

### 1.1 작업 공간 정보 수집
- API 호출: `vscode.workspace`
- 구현:
  ```typescript
  class WorkspaceContextManager {
    // 작업 공간 정보 수집
    async getWorkspaceInfo(): Promise<WorkspaceInfo> {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
      
      return {
        root: workspaceRoot?.uri.fsPath,
        name: workspaceRoot?.name,
        opened_files: this.getOpenedFiles(),
        active_file: this.getActiveFile()
      };
    }

    // 열린 파일 목록 가져오기
    private getOpenedFiles(): string[] {
      return vscode.workspace.textDocuments
        .filter(doc => !doc.isUntitled)
        .map(doc => doc.uri.fsPath);
    }

    // 현재 활성화된 파일 정보
    private getActiveFile(): ActiveFile | undefined {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return undefined;

      return {
        path: editor.document.uri.fsPath,
        language: editor.document.languageId,
        is_dirty: editor.document.isDirty
      };
    }
  }
  ```

### 1.2 실제 사용 예시 및 로그
```typescript
// 컨텍스트 관리자 초기화 및 사용
const contextManager = new WorkspaceContextManager();

// 실제 사용 사례: AI 모델에 전송할 컨텍스트 준비
async function prepareContextForModel() {
  // 로그: [컨텍스트 관리자] 작업 공간 컨텍스트 수집 시작
  
  const workspaceInfo = await contextManager.getWorkspaceInfo();
  
  // 로그: [컨텍스트 관리자] 작업 공간 컨텍스트 수집 완료
  // 로그: [컨텍스트 관리자] 작업 공간: /users/projects/my-app
  // 로그: [컨텍스트 관리자] 열린 파일 수: 7
  // 로그: [컨텍스트 관리자] 활성 파일: /users/projects/my-app/src/components/App.tsx
  
  return {
    workspace: workspaceInfo,
    timestamp: Date.now()
  };
}

// 실제 로그 예시
// [컨텍스트 관리자] 작업 공간 컨텍스트 수집 시작
// [컨텍스트 관리자] 작업 공간 루트: /users/projects/my-app
// [컨텍스트 관리자] 작업 공간 이름: my-app
// [컨텍스트 관리자] 열린 파일 조회 중...
// [컨텍스트 관리자] 열린 파일: /users/projects/my-app/src/components/App.tsx
// [컨텍스트 관리자] 열린 파일: /users/projects/my-app/src/utils/api.ts
// [컨텍스트 관리자] 열린 파일: /users/projects/my-app/package.json
// [컨텍스트 관리자] 활성 파일: /users/projects/my-app/src/components/App.tsx (typescript)
// [컨텍스트 관리자] 작업 공간 컨텍스트 수집 완료
```

### 1.3 프로젝트 구조 분석
- 구현:
  ```typescript
  class ProjectAnalyzer {
    private readonly fileManager: FileDataExchange;

    // 프로젝트 구조 분석
    async analyzeProject(
      root: vscode.Uri
    ): Promise<ProjectStructure> {
      const packageJson = await this.findPackageJson(root);
      const gitInfo = await this.getGitInfo(root);
      
      return {
        dependencies: await this.getDependencies(packageJson),
        source_files: await this.getSourceFiles(root),
        git_info: gitInfo
      };
    }

    // package.json 찾기
    private async findPackageJson(
      root: vscode.Uri
    ): Promise<vscode.Uri | undefined> {
      const packageJsons = await vscode.workspace.findFiles(
        new vscode.RelativePattern(root, '**/package.json'),
        '**/node_modules/**'
      );
      return packageJsons[0];
    }

    // Git 정보 수집
    private async getGitInfo(
      root: vscode.Uri
    ): Promise<GitInfo | undefined> {
      const gitDir = await vscode.workspace.findFiles(
        new vscode.RelativePattern(root, '.git'),
        null,
        1
      );

      if (gitDir.length === 0) return undefined;

      return {
        has_git: true,
        root: gitDir[0].fsPath
      };
    }
  }
  ```

### 1.4 실제 프로젝트 분석 예시
```typescript
// 프로젝트 분석기 사용 예시
async function analyzeCurrentProject() {
  // 로그: [프로젝트 분석기] 프로젝트 분석 시작
  
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceRoot) {
    // 로그: [프로젝트 분석기] 오류: 작업 공간을 찾을 수 없음
    return null;
  }
  
  const analyzer = new ProjectAnalyzer();
  
  // 로그: [프로젝트 분석기] 프로젝트 구조 분석 중: {workspaceRoot.name}
  const projectStructure = await analyzer.analyzeProject(workspaceRoot.uri);
  
  // 로그: [프로젝트 분석기] 프로젝트 분석 완료
  // 로그: [프로젝트 분석기] 의존성 발견: {projectStructure.dependencies.length}개
  // 로그: [프로젝트 분석기] 소스 파일 발견: {projectStructure.source_files.length}개
  
  return projectStructure;
}

// 실제 분석 결과
const realProjectStructure = {
  "dependencies": [
    { "name": "react", "version": "^18.2.0" },
    { "name": "react-dom", "version": "^18.2.0" },
    { "name": "typescript", "version": "^4.9.5" },
    { "name": "vite", "version": "^4.3.2" }
  ],
  "source_files": [
    "/users/projects/my-app/src/main.tsx",
    "/users/projects/my-app/src/App.tsx",
    "/users/projects/my-app/src/components/Header.tsx",
    "/users/projects/my-app/src/utils/api.ts"
  ],
  "git_info": {
    "has_git": true,
    "root": "/users/projects/my-app/.git"
  }
};

// 실제 로그 예시
// [프로젝트 분석기] 프로젝트 분석 시작
// [프로젝트 분석기] 작업 공간 루트: /users/projects/my-app
// [프로젝트 분석기] package.json 검색 중...
// [프로젝트 분석기] package.json 발견: /users/projects/my-app/package.json
// [프로젝트 분석기] 의존성 파싱 중...
// [프로젝트 분석기] 의존성 4개 발견
// [프로젝트 분석기] Git 정보 검색 중...
// [프로젝트 분석기] Git 저장소 발견
// [프로젝트 분석기] 소스 파일 탐색 중...
// [프로젝트 분석기] 소스 파일 32개 발견
// [프로젝트 분석기] 프로젝트 분석 완료
```

## 2. 파일 컨텍스트 (✓)

### 2.1 파일 내용 분석
- 구현:
  ```typescript
  class FileContextAnalyzer {
    // 파일 컨텍스트 분석
    async analyzeFile(
      document: vscode.TextDocument
    ): Promise<FileContext> {
      const content = document.getText();
      const symbols = await this.getSymbols(document);

      return {
        path: document.uri.fsPath,
        language: document.languageId,
        content: content,
        symbols: symbols,
        lines: document.lineCount,
        size: content.length
      };
    }

    // 심볼 정보 수집
    private async getSymbols(
      document: vscode.TextDocument
    ): Promise<SymbolInfo[]> {
      const symbols = await vscode.commands.executeCommand<
        vscode.SymbolInformation[]
      >(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      return symbols?.map(symbol => ({
        name: symbol.name,
        kind: symbol.kind,
        location: {
          line: symbol.location.range.start.line,
          character: symbol.location.range.start.character
        }
      })) ?? [];
    }
  }
  ```

### 2.2 실제 파일 분석 예시
```typescript
// 파일 분석기 사용 예시
async function analyzeCurrentFile() {
  // 로그: [파일 분석기] 현재 파일 분석 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // 로그: [파일 분석기] 오류: 활성화된 에디터 없음
    return null;
  }
  
  const analyzer = new FileContextAnalyzer();
  
  // 로그: [파일 분석기] 파일 분석 중: {editor.document.uri.fsPath}
  const fileContext = await analyzer.analyzeFile(editor.document);
  
  // 로그: [파일 분석기] 파일 분석 완료
  // 로그: [파일 분석기] 파일 크기: {fileContext.size} 바이트
  // 로그: [파일 분석기] 라인 수: {fileContext.lines}
  // 로그: [파일 분석기] 심볼 수: {fileContext.symbols.length}
  
  return fileContext;
}

// 실제 파일 분석 결과 예시
const realFileContext = {
  "path": "/users/projects/my-app/src/components/Button.tsx",
  "language": "typescript",
  "content": "import React from 'react';\n\ninterface ButtonProps {\n  text: string;\n  onClick?: () => void;\n  variant?: 'primary' | 'secondary';\n}\n\nexport const Button: React.FC<ButtonProps> = ({\n  text,\n  onClick,\n  variant = 'primary'\n}) => {\n  return (\n    <button\n      className={`btn btn-${variant}`}\n      onClick={onClick}\n    >\n      {text}\n    </button>\n  );\n};\n",
  "symbols": [
    {
      "name": "ButtonProps",
      "kind": 5,
      "location": { "line": 2, "character": 10 }
    },
    {
      "name": "Button",
      "kind": 12,
      "location": { "line": 8, "character": 13 }
    }
  ],
  "lines": 24,
  "size": 356
};

// 실제 로그 예시
// [파일 분석기] 현재 파일 분석 시작
// [파일 분석기] 활성 문서: /users/projects/my-app/src/components/Button.tsx
// [파일 분석기] 언어: typescript
// [파일 분석기] 심볼 정보 수집 중...
// [파일 분석기] 심볼 발견: ButtonProps (인터페이스)
// [파일 분석기] 심볼 발견: Button (변수)
// [파일 분석기] 분석 결과: 24줄, 356바이트, 2개 심볼
// [파일 분석기] 파일 분석 완료
```

## 3. 선택 컨텍스트 (✓)

### 3.1 선택 영역 분석
- 구현:
  ```typescript
  class SelectionContextManager {
    // 선택 영역 컨텍스트 수집
    async getSelectionContext(
      editor: vscode.TextEditor
    ): Promise<SelectionContext> {
      const selection = editor.selection;
      const document = editor.document;

      return {
        selected_text: document.getText(selection),
        start: {
          line: selection.start.line,
          character: selection.start.character
        },
        end: {
          line: selection.end.line,
          character: selection.end.character
        },
        surrounding_code: await this.getSurroundingCode(
          document,
          selection
        )
      };
    }

    // 주변 코드 수집
    private async getSurroundingCode(
      document: vscode.TextDocument,
      selection: vscode.Selection
    ): Promise<string> {
      const startLine = Math.max(0, selection.start.line - 5);
      const endLine = Math.min(
        document.lineCount - 1,
        selection.end.line + 5
      );

      let code = '';
      for (let i = startLine; i <= endLine; i++) {
        code += document.lineAt(i).text + '\n';
      }
      return code;
    }
  }
  ```

### 3.2 실제 선택 컨텍스트 사용 예시
```typescript
// 선택 컨텍스트 관리자 사용 예시
async function getContextForSelection() {
  // 로그: [선택 관리자] 선택 컨텍스트 수집 시작
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // 로그: [선택 관리자] 오류: 활성화된 에디터 없음
    return null;
  }
  
  const selectionManager = new SelectionContextManager();
  
  // 로그: [선택 관리자] 선택 영역 분석 중
  const selectionContext = await selectionManager.getSelectionContext(editor);
  
  // 로그: [선택 관리자] 선택 컨텍스트 수집 완료
  // 로그: [선택 관리자] 선택된 텍스트 길이: {selectionContext.selected_text.length}
  // 로그: [선택 관리자] 선택 위치: {selectionContext.start.line}:{selectionContext.start.character} - {selectionContext.end.line}:{selectionContext.end.character}
  
  return selectionContext;
}

// AI 모델 요청에 선택 컨텍스트 포함 예시
async function prepareModelRequestWithSelection() {
  const selectionContext = await getContextForSelection();
  if (!selectionContext) return null;
  
  return {
    user_query: "이 코드가 무슨 일을 하는지 설명해주세요",
    selection: selectionContext,
    timestamp: Date.now()
  };
}

// 실제 선택 컨텍스트 예시
const realSelectionContext = {
  "selected_text": "export const Button: React.FC<ButtonProps> = ({\n  text,\n  onClick,\n  variant = 'primary'\n}) => {",
  "start": { "line": 8, "character": 0 },
  "end": { "line": 8, "character": 17 },
  "surrounding_code": "interface ButtonProps {\n  text: string;\n  onClick?: () => void;\n  variant?: 'primary' | 'secondary';\n}\n\nexport const Button: React.FC<ButtonProps> = ({\n  text,\n  onClick,\n  variant = 'primary'\n}) => {\n  return (\n    <button\n      className={`btn btn-${variant}`}\n      onClick={onClick}\n    >\n      {text}\n    </button>\n  );\n};\n"
};

// 실제 로그 예시
// [선택 관리자] 선택 컨텍스트 수집 시작
// [선택 관리자] 활성 에디터: /users/projects/my-app/src/components/Button.tsx
// [선택 관리자] 선택 영역: 8:0 - 12:5
// [선택 관리자] 선택된 텍스트: "export const Button: React.FC<ButtonProps> = ({\n  text,\n  onClick,\n  variant = 'primary'\n}) => {"
// [선택 관리자] 주변 코드 수집 중... (앞뒤 5줄)
// [선택 관리자] 주변 코드 범위: 3-17
// [선택 관리자] 선택 컨텍스트 수집 완료
```

## 4. 캐시 관리 (✓)

### 4.1 컨텍스트 캐싱
- 구현:
  ```typescript
  class ContextCache {
    private cache = new Map<string, CacheEntry>();
    private readonly MAX_CACHE_SIZE = 100;
    private readonly MAX_AGE = 5 * 60 * 1000; // 5분

    // 캐시 항목 저장
    set(key: string, value: any): void {
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        this.evictOldest();
      }

      this.cache.set(key, {
        value,
        timestamp: Date.now()
      });
    }

    // 캐시 항목 조회
    get(key: string): any | undefined {
      const entry = this.cache.get(key);
      if (!entry) return undefined;

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return undefined;
      }

      return entry.value;
    }

    // 캐시 항목 만료 여부 확인
    private isExpired(entry: CacheEntry): boolean {
      return Date.now() - entry.timestamp > this.MAX_AGE;
    }

    // 가장 오래된 캐시 항목 제거
    private evictOldest(): void {
      const oldest = Array.from(this.cache.entries())
        .reduce((a, b) => 
          a[1].timestamp < b[1].timestamp ? a : b
        );
      this.cache.delete(oldest[0]);
    }
  }
  ```

### 4.2 실제 캐시 사용 예시
```typescript
// 캐시 관리자 사용 예시
class FileAnalysisCache {
  private cache = new ContextCache();
  private fileAnalyzer = new FileContextAnalyzer();
  
  // 파일 분석 결과 가져오기 (캐시 사용)
  async getFileAnalysis(filePath: string): Promise<FileContext> {
    // 로그: [캐시 관리자] 파일 분석 요청: {filePath}
    
    // 캐시된 결과가 있는지 확인
    const cacheKey = `file_analysis:${filePath}`;
    const cachedResult = this.cache.get(cacheKey);
    
    if (cachedResult) {
      // 로그: [캐시 관리자] 캐시 히트: {filePath}
      return cachedResult;
    }
    
    // 로그: [캐시 관리자] 캐시 미스: {filePath}
    
    // 새 분석 수행
    // 로그: [캐시 관리자] 파일 분석 시작
    
    const document = await vscode.workspace.openTextDocument(filePath);
    const result = await this.fileAnalyzer.analyzeFile(document);
    
    // 결과 캐싱
    this.cache.set(cacheKey, result);
    
    // 로그: [캐시 관리자] 분석 결과 캐싱 완료: {filePath}
    
    return result;
  }
  
  // 캐시 통계 확인
  getCacheStats(): { size: number, hits: number, misses: number } {
    return {
      size: this.cache.size(),
      hits: this.cacheHits,
      misses: this.cacheMisses
    };
  }
  
  private cacheHits = 0;
  private cacheMisses = 0;
}

// 메모리 사용량 최적화를 위한 캐시 정리 작업
function setupCacheCleanupSchedule() {
  // 로그: [캐시 관리자] 자동 캐시 정리 스케줄 설정
  
  // 15분마다 캐시 정리
  setInterval(() => {
    // 로그: [캐시 관리자] 주기적 캐시 정리 시작
    
    const before = contextCache.size();
    contextCache.cleanup();
    const after = contextCache.size();
    
    // 로그: [캐시 관리자] 캐시 정리 완료: {before - after}개 항목 제거됨
  }, 15 * 60 * 1000);
}

// 실제 로그 예시
// [캐시 관리자] 파일 분석 요청: /users/projects/my-app/src/components/Button.tsx
// [캐시 관리자] 캐시 확인: file_analysis:/users/projects/my-app/src/components/Button.tsx
// [캐시 관리자] 캐시 미스
// [캐시 관리자] 파일 분석 시작
// [파일 분석기] 현재 파일 분석 시작
// [파일 분석기] 분석 결과: 24줄, 356바이트, 2개 심볼
// [파일 분석기] 파일 분석 완료
// [캐시 관리자] 분석 결과 캐싱 완료: /users/projects/my-app/src/components/Button.tsx
// [캐시 관리자] 현재 캐시 크기: 12 항목
// ...
// [캐시 관리자] 파일 분석 요청: /users/projects/my-app/src/components/Button.tsx
// [캐시 관리자] 캐시 확인: file_analysis:/users/projects/my-app/src/components/Button.tsx
// [캐시 관리자] 캐시 히트
// [캐시 관리자] 캐시에서 결과 반환
```

## 5. 통합 컨텍스트 관리 (✓)

### 5.1 통합 컨텍스트 관리 예시
```typescript
// 통합 컨텍스트 관리자
class IntegratedContextManager {
  private workspaceManager = new WorkspaceContextManager();
  private fileAnalyzer = new FileContextAnalyzer();
  private selectionManager = new SelectionContextManager();
  private cache = new ContextCache();
  
  // AI 모델 요청을 위한 전체 컨텍스트 수집
  async collectContextForAI(query: string): Promise<AIModelContext> {
    // 로그: [통합 컨텍스트] 컨텍스트 수집 시작: "{query.substring(0, 50)}..."
    
    // 1. 워크스페이스 컨텍스트 수집
    const workspaceInfo = await this.workspaceManager.getWorkspaceInfo();
    
    // 2. 현재 파일 컨텍스트 수집
    const editor = vscode.window.activeTextEditor;
    let fileContext = null;
    let selectionContext = null;
    
    if (editor) {
      // 로그: [통합 컨텍스트] 파일 컨텍스트 수집 중...
      
      // 캐시 사용
      const cacheKey = `file:${editor.document.uri.fsPath}`;
      fileContext = this.cache.get(cacheKey);
      
      if (!fileContext) {
        // 로그: [통합 컨텍스트] 파일 캐시 미스, 새로 분석 중...
        fileContext = await this.fileAnalyzer.analyzeFile(editor.document);
        this.cache.set(cacheKey, fileContext);
      }
      
      // 3. 선택 컨텍스트 수집 (캐시하지 않음 - 항상 새로 계산)
      // 로그: [통합 컨텍스트] 선택 컨텍스트 수집 중...
      selectionContext = await this.selectionManager.getSelectionContext(editor);
    }
    
    // 로그: [통합 컨텍스트] 컨텍스트 수집 완료
    
    // 통합 컨텍스트 반환
    return {
      query,
      workspace: workspaceInfo,
      current_file: fileContext,
      selection: selectionContext,
      timestamp: Date.now()
    };
  }
}

// 실제 통합 컨텍스트 사용 예시
async function handleUserRequest(userQuery: string) {
  // 로그: [요청 처리기] 사용자 요청 수신: "{userQuery}"
  
  const contextManager = new IntegratedContextManager();
  
  // 로그: [요청 처리기] 컨텍스트 수집 중...
  const context = await contextManager.collectContextForAI(userQuery);
  
  // 로그: [요청 처리기] AI 모델 요청 준비 중...
  const modelRequest = {
    prompt: userQuery,
    context: context,
    options: {
      temperature: 0.7,
      max_tokens: 1000
    }
  };
  
  // 로그: [요청 처리기] AI 모델 요청 전송 중...
  const response = await sendToAIModel(modelRequest);
  
  // 로그: [요청 처리기] AI 응답 수신 완료
  
  return response;
}

// 실제 통합 컨텍스트 예시
const realIntegratedContext = {
  "query": "Button 컴포넌트를 개선해주세요",
  "workspace": {
    "root": "/users/projects/my-app",
    "name": "my-app",
    "opened_files": [
      "/users/projects/my-app/src/components/Button.tsx",
      "/users/projects/my-app/src/App.tsx",
      "/users/projects/my-app/package.json"
    ],
    "active_file": {
      "path": "/users/projects/my-app/src/components/Button.tsx",
      "language": "typescript",
      "is_dirty": false
    }
  },
  "current_file": {
    "path": "/users/projects/my-app/src/components/Button.tsx",
    "language": "typescript",
    "symbols": [
      { "name": "ButtonProps", "kind": 5, "location": { "line": 2, "character": 10 } },
      { "name": "Button", "kind": 12, "location": { "line": 8, "character": 13 } }
    ],
    "lines": 24,
    "size": 356
  },
  "selection": {
    "selected_text": "export const Button",
    "start": { "line": 8, "character": 0 },
    "end": { "line": 8, "character": 17 },
    "surrounding_code": "// 주변 코드..."
  },
  "timestamp": 1679904732000
};

// 실제 로그 예시
// [요청 처리기] 사용자 요청 수신: "Button 컴포넌트를 개선해주세요"
// [요청 처리기] 컨텍스트 수집 중...
// [통합 컨텍스트] 컨텍스트 수집 시작: "Button 컴포넌트를 개선해주세요"
// [통합 컨텍스트] 워크스페이스 정보 수집 중...
// [컨텍스트 관리자] 작업 공간 컨텍스트 수집 시작
// [컨텍스트 관리자] 작업 공간 컨텍스트 수집 완료
// [통합 컨텍스트] 파일 컨텍스트 수집 중...
// [통합 컨텍스트] 파일 캐시 확인: file:/users/projects/my-app/src/components/Button.tsx
// [통합 컨텍스트] 파일 캐시 히트
// [통합 컨텍스트] 선택 컨텍스트 수집 중...
// [선택 관리자] 선택 컨텍스트 수집 시작
// [선택 관리자] 선택 컨텍스트 수집 완료
// [통합 컨텍스트] 컨텍스트 수집 완료
// [요청 처리기] AI 모델 요청 준비 중...
// [요청 처리기] 컨텍스트 크기: 2.3KB
// [요청 처리기] AI 모델 요청 전송 중...
// [요청 처리기] AI 응답 수신 완료
```

## 6. 결론

이 문서는 볼드모트 IDE에서 실제로 구현된 컨텍스트 관리 방식을 설명합니다. 작업 공간 정보 수집, 파일 분석, 선택 영역 처리, 캐시 관리의 실제 구현 예시와 로그를 통해 개발자들이 IDE의 컨텍스트 관리 방식을 이해하는 데 도움을 줍니다. 모든 예제는 VSCode Extension API를 기반으로 한 실제 구현 방식을 반영합니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 컨텍스트 관리 구현을 바탕으로 작성되었습니다. 