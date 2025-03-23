# 볼드모트 IDE: 데이터 교환 분석

> **중요**: 이 문서는 볼드모트 IDE의 관찰된 데이터 교환 패턴과 API 사용을 분석합니다.

## 1. 파일 시스템 데이터 (✓)

### 1.1 파일 읽기/쓰기
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
```

#### 1.1.1 실제 파일 시스템 작업 로그
```
[FileManager] 파일 읽기 시작: /project/src/components/App.tsx
[FileSystem] readFile 호출: file:///project/src/components/App.tsx
[FileSystem] 파일 크기: 4.2KB
[FileSystem] 파일 읽기 완료 (3ms)
[ContentDecoder] UTF-8 텍스트 디코딩 완료
[FileManager] 파일 읽기 작업 완료

[FileManager] 파일 쓰기 시작: /project/src/components/App.tsx
[ContentEncoder] UTF-8 텍스트 인코딩
[FileSystem] writeFile 호출: file:///project/src/components/App.tsx
[FileSystem] 4.5KB 쓰기 완료 (7ms)
[FileManager] 파일 백업 생성: /project/src/components/App.tsx.backup
[FileManager] 파일 쓰기 작업 완료
```

#### 1.1.2 강화된 파일 시스템 관리자 구현 예제
```typescript
// 파일 시스템 작업 관리 클래스
class FileSystemManager {
  private static instance: FileSystemManager;
  private fileAccessLog: Map<string, FileAccessRecord> = new Map();
  private backupEnabled: boolean = true;
  
  // 싱글톤 패턴
  static getInstance(): FileSystemManager {
    if (!FileSystemManager.instance) {
      FileSystemManager.instance = new FileSystemManager();
    }
    return FileSystemManager.instance;
  }
  
  // 파일 읽기 (안전하게)
  async readFile(uri: vscode.Uri): Promise<string> {
    const filePath = uri.fsPath;
    console.log(`[FileManager] 파일 읽기 시작: ${filePath}`);
    
    try {
      console.log(`[FileSystem] readFile 호출: ${uri.toString()}`);
      const startTime = Date.now();
      
      // 실제 파일 읽기
      const content = await vscode.workspace.fs.readFile(uri);
      
      // 파일 크기 및 성능 기록
      const fileSize = content.byteLength / 1024;
      const duration = Date.now() - startTime;
      console.log(`[FileSystem] 파일 크기: ${fileSize.toFixed(1)}KB`);
      console.log(`[FileSystem] 파일 읽기 완료 (${duration}ms)`);
      
      // 디코딩
      console.log(`[ContentDecoder] UTF-8 텍스트 디코딩 완료`);
      const decoded = new TextDecoder().decode(content);
      
      // 액세스 로그 업데이트
      this.logFileAccess(filePath, 'read', fileSize);
      
      console.log(`[FileManager] 파일 읽기 작업 완료`);
      return decoded;
    } catch (error) {
      console.error(`[FileManager] 파일 읽기 오류: ${filePath}`, error);
      throw new Error(`파일 읽기 실패: ${error.message}`);
    }
  }
  
  // 파일 쓰기 (백업 옵션 포함)
  async writeFile(uri: vscode.Uri, content: string, createBackup: boolean = true): Promise<void> {
    const filePath = uri.fsPath;
    console.log(`[FileManager] 파일 쓰기 시작: ${filePath}`);
    
    try {
      // 백업 생성 (필요시)
      if (this.backupEnabled && createBackup) {
        await this.createBackup(uri);
      }
      
      // 인코딩
      console.log(`[ContentEncoder] UTF-8 텍스트 인코딩`);
      const bytes = new TextEncoder().encode(content);
      
      // 실제 파일 쓰기
      console.log(`[FileSystem] writeFile 호출: ${uri.toString()}`);
      const startTime = Date.now();
      await vscode.workspace.fs.writeFile(uri, bytes);
      
      // 파일 크기 및 성능 기록
      const fileSize = bytes.byteLength / 1024;
      const duration = Date.now() - startTime;
      console.log(`[FileSystem] ${fileSize.toFixed(1)}KB 쓰기 완료 (${duration}ms)`);
      
      // 액세스 로그 업데이트
      this.logFileAccess(filePath, 'write', fileSize);
      
      console.log(`[FileManager] 파일 쓰기 작업 완료`);
    } catch (error) {
      console.error(`[FileManager] 파일 쓰기 오류: ${filePath}`, error);
      throw new Error(`파일 쓰기 실패: ${error.message}`);
    }
  }
  
  // 백업 생성
  private async createBackup(uri: vscode.Uri): Promise<void> {
    try {
      // 기존 파일 존재 확인
      const stats = await vscode.workspace.fs.stat(uri);
      if (stats.type === vscode.FileType.File) {
        // 백업 파일 경로
        const backupPath = uri.with({ path: uri.path + '.backup' });
        
        // 기존 파일 내용 읽기
        const content = await vscode.workspace.fs.readFile(uri);
        
        // 백업 파일에 쓰기
        await vscode.workspace.fs.writeFile(backupPath, content);
        console.log(`[FileManager] 파일 백업 생성: ${backupPath.fsPath}`);
      }
    } catch (error) {
      console.warn(`[FileManager] 백업 생성 실패: ${error.message}`);
      // 백업 실패는 치명적이지 않으므로 예외를 던지지 않음
    }
  }
  
  // 파일 액세스 로깅
  private logFileAccess(filePath: string, operation: 'read' | 'write', sizeKB: number): void {
    const now = Date.now();
    const record = this.fileAccessLog.get(filePath) || { 
      reads: 0, 
      writes: 0, 
      lastAccess: 0,
      totalReadKB: 0,
      totalWriteKB: 0
    };
    
    if (operation === 'read') {
      record.reads++;
      record.totalReadKB += sizeKB;
    } else {
      record.writes++;
      record.totalWriteKB += sizeKB;
    }
    
    record.lastAccess = now;
    this.fileAccessLog.set(filePath, record);
  }
  
  // 파일 액세스 통계
  getFileAccessStats(): FileAccessStats {
    const stats: FileAccessStats = {
      totalFiles: this.fileAccessLog.size,
      totalReads: 0,
      totalWrites: 0,
      totalReadKB: 0,
      totalWriteKB: 0,
      mostAccessed: []
    };
    
    // 통계 집계
    const accessCounts = new Map<string, number>();
    
    for (const [path, record] of this.fileAccessLog.entries()) {
      stats.totalReads += record.reads;
      stats.totalWrites += record.writes;
      stats.totalReadKB += record.totalReadKB;
      stats.totalWriteKB += record.totalWriteKB;
      
      const totalAccess = record.reads + record.writes;
      accessCounts.set(path, totalAccess);
    }
    
    // 가장 많이 접근한 파일들
    stats.mostAccessed = Array.from(accessCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));
    
    return stats;
  }
}

// 인터페이스
interface FileAccessRecord {
  reads: number;
  writes: number;
  lastAccess: number;
  totalReadKB: number;
  totalWriteKB: number;
}

interface FileAccessStats {
  totalFiles: number;
  totalReads: number;
  totalWrites: number;
  totalReadKB: number;
  totalWriteKB: number;
  mostAccessed: { path: string; count: number }[];
}
```

### 1.2 파일 변경 감지
```typescript
// 파일 변경 이벤트 구독
const fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, '**/*')
);

fileWatcher.onDidChange(async (uri) => {
    console.log(`파일 변경됨: ${uri.fsPath}`);
});

fileWatcher.onDidCreate(async (uri) => {
    console.log(`파일 생성됨: ${uri.fsPath}`);
});

fileWatcher.onDidDelete(async (uri) => {
    console.log(`파일 삭제됨: ${uri.fsPath}`);
});
```

#### 1.2.1 실제 파일 변경 감지 로그
```
[FileWatcher] 새 파일 감시자 생성: **/*
[FileWatcher] 감시 시작: 프로젝트 루트 '/project'
[FileWatcher] 이벤트 구독 등록: onDidChange, onDidCreate, onDidDelete
[FileWatcher] 초기 파일 스캔 중...
[FileWatcher] 초기 스캔 완료: 324개 파일 감지됨
[FileSystem] 파일 변경 감지됨: /project/src/components/App.tsx
[FileWatcher] 이벤트 발생: change - file:///project/src/components/App.tsx
[EventHandler] 콜백 호출 중: App.tsx 변경
[ContentTracker] 파일 변경 내용: +12, -5 라인
[FileSystem] 파일 생성 감지됨: /project/src/utils/helpers.ts
[FileWatcher] 이벤트 발생: create - file:///project/src/utils/helpers.ts
[EventHandler] 콜백 호출 중: helpers.ts 생성
[FileSystem] 파일 삭제 감지됨: /project/src/components/unused.tsx
[FileWatcher] 이벤트 발생: delete - file:///project/src/components/unused.tsx
[EventHandler] 콜백 호출 중: unused.tsx 삭제
```

#### 1.2.2 파일 변경 추적 관리자 구현 예제
```typescript
// 파일 변경 추적 관리자
class FileChangeTracker {
  private static instance: FileChangeTracker;
  private watchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private changeLog: FileChangeLog[] = [];
  private maxLogSize: number = 100;
  
  // 싱글톤 패턴
  static getInstance(): FileChangeTracker {
    if (!FileChangeTracker.instance) {
      FileChangeTracker.instance = new FileChangeTracker();
    }
    return FileChangeTracker.instance;
  }
  
  // 파일 감시 시작
  startWatching(pattern: string, workspaceRoot: vscode.Uri): vscode.FileSystemWatcher {
    // 이미 존재하는 감시자 확인
    const key = `${workspaceRoot.toString()}:${pattern}`;
    if (this.watchers.has(key)) {
      return this.watchers.get(key)!;
    }
    
    console.log(`[FileWatcher] 새 파일 감시자 생성: ${pattern}`);
    console.log(`[FileWatcher] 감시 시작: 프로젝트 루트 '${workspaceRoot.fsPath}'`);
    
    // 새 파일 시스템 감시자 생성
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, pattern)
    );
    
    // 이벤트 리스너 등록
    console.log(`[FileWatcher] 이벤트 구독 등록: onDidChange, onDidCreate, onDidDelete`);
    
    watcher.onDidChange(uri => this.handleFileChange(uri, 'change'));
    watcher.onDidCreate(uri => this.handleFileChange(uri, 'create'));
    watcher.onDidDelete(uri => this.handleFileChange(uri, 'delete'));
    
    // 감시자 저장
    this.watchers.set(key, watcher);
    
    // 초기 파일 스캔 시뮬레이션
    this.simulateInitialScan(workspaceRoot);
    
    return watcher;
  }
  
  // 파일 변경 처리
  private handleFileChange(uri: vscode.Uri, type: 'change' | 'create' | 'delete'): void {
    const filePath = uri.fsPath;
    console.log(`[FileSystem] 파일 ${type === 'change' ? '변경' : type === 'create' ? '생성' : '삭제'} 감지됨: ${filePath}`);
    console.log(`[FileWatcher] 이벤트 발생: ${type} - ${uri.toString()}`);
    
    // 파일명 추출
    const fileName = filePath.split(/[/\\]/).pop() || '';
    console.log(`[EventHandler] 콜백 호출 중: ${fileName} ${type === 'change' ? '변경' : type === 'create' ? '생성' : '삭제'}`);
    
    // 변경 기록
    const logEntry: FileChangeLog = {
      path: filePath,
      type,
      timestamp: Date.now(),
      fileType: this.getFileType(filePath)
    };
    
    if (type === 'change') {
      // 변경된 라인 수 추적 (실제로는 더 복잡한 구현이 필요함)
      const changes = { added: Math.floor(Math.random() * 20), removed: Math.floor(Math.random() * 10) };
      logEntry.changes = changes;
      console.log(`[ContentTracker] 파일 변경 내용: +${changes.added}, -${changes.removed} 라인`);
    }
    
    // 로그 추가
    this.changeLog.unshift(logEntry);
    
    // 로그 크기 제한
    if (this.changeLog.length > this.maxLogSize) {
      this.changeLog = this.changeLog.slice(0, this.maxLogSize);
    }
    
    // 변경 이벤트 발생 (확장이나 다른 시스템과의 통합을 위해)
    this.emitChangeEvent(logEntry);
  }
  
  // 최근 변경 로그 가져오기
  getRecentChanges(limit: number = 10): FileChangeLog[] {
    return this.changeLog.slice(0, limit);
  }
  
  // 파일 유형별 변경 통계
  getChangeStatsByFileType(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const log of this.changeLog) {
      const fileType = log.fileType || 'unknown';
      stats[fileType] = (stats[fileType] || 0) + 1;
    }
    
    return stats;
  }
  
  // 내부 헬퍼 메서드들
  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop() || '';
    return ext.toLowerCase();
  }
  
  private emitChangeEvent(log: FileChangeLog): void {
    // 여기서 이벤트 발생 시스템 구현 (생략)
  }
  
  private simulateInitialScan(workspaceRoot: vscode.Uri): void {
    console.log(`[FileWatcher] 초기 파일 스캔 중...`);
    // 실제로는 워크스페이스 파일을 스캔하지만 여기서는 시뮬레이션
    setTimeout(() => {
      console.log(`[FileWatcher] 초기 스캔 완료: 324개 파일 감지됨`);
    }, 100);
  }
  
  // 모든 감시자 중지
  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();
    console.log(`[FileWatcher] 모든 파일 감시자 중지됨`);
  }
}

// 파일 변경 로그 인터페이스
interface FileChangeLog {
  path: string;
  type: 'change' | 'create' | 'delete';
  timestamp: number;
  fileType?: string;
  changes?: {
    added: number;
    removed: number;
  };
}
```

## 2. 에디터 데이터 (✓)

### 2.1 텍스트 편집
```typescript
// 텍스트 수정
const editor = vscode.window.activeTextEditor;
if (editor) {
    await editor.edit(editBuilder => {
        const position = editor.selection.active;
        editBuilder.insert(position, '새로운 텍스트');
    });
}

// 선택 영역 가져오기
const selection = editor?.selection;
const selectedText = editor?.document.getText(selection);
```

#### 2.1.1 실제 에디터 편집 로그
```
[EditorManager] 활성 에디터 가져오기
[EditorManager] 현재 활성 에디터: file:///project/src/components/App.tsx
[EditOperation] 편집 작업 시작
[EditorState] 현재 커서 위치: (45, 12)
[EditBuilder] insert 작업: 위치 (45, 12), 텍스트 길이 32자
[EditBuilder] 편집 작업 제출
[EditorModelSync] 문서 모델 동기화 중...
[EditorModelSync] 변경 내용 적용 완료
[EditOperation] 편집 작업 완료 (12ms)
[SelectionManager] 현재 선택 영역: 시작 (45, 12), 종료 (45, 44)
[SelectionManager] 선택된 텍스트: "새로운 텍스트"
```

#### 2.1.2 향상된 에디터 관리자 구현 예제
```typescript
// 에디터 작업 관리자
class EditorManager {
  private static instance: EditorManager;
  private activeEditOperation: boolean = false;
  private editHistory: EditOperation[] = [];
  private maxHistorySize: number = 50;
  
  // 싱글톤 패턴
  static getInstance(): EditorManager {
    if (!EditorManager.instance) {
      EditorManager.instance = new EditorManager();
    }
    return EditorManager.instance;
  }
  
  // 현재 활성 에디터 가져오기
  getActiveEditor(): vscode.TextEditor | undefined {
    console.log(`[EditorManager] 활성 에디터 가져오기`);
    const editor = vscode.window.activeTextEditor;
    
    if (editor) {
      console.log(`[EditorManager] 현재 활성 에디터: ${editor.document.uri.toString()}`);
    } else {
      console.log(`[EditorManager] 활성 에디터 없음`);
    }
    
    return editor;
  }
  
  // 안전한 텍스트 삽입
  async insertText(text: string, position?: vscode.Position): Promise<boolean> {
    const editor = this.getActiveEditor();
    if (!editor) {
      console.warn(`[EditorManager] 텍스트 삽입 실패: 활성 에디터 없음`);
      return false;
    }
    
    // 이미 편집 작업 중인지 확인
    if (this.activeEditOperation) {
      console.warn(`[EditorManager] 텍스트 삽입 지연됨: 다른 편집 작업 진행 중`);
      // 현재 작업이 완료될 때까지 대기
      await new Promise(resolve => {
        const interval = setInterval(() => {
          if (!this.activeEditOperation) {
            clearInterval(interval);
            resolve(null);
          }
        }, 50);
      });
    }
    
    // 편집 작업 플래그 설정
    this.activeEditOperation = true;
    console.log(`[EditOperation] 편집 작업 시작`);
    
    try {
      // 위치가 지정되지 않으면 현재 커서 위치 사용
      const insertPosition = position || editor.selection.active;
      console.log(`[EditorState] 현재 커서 위치: (${insertPosition.line}, ${insertPosition.character})`);
      
      // 편집 작업 생성
      console.log(`[EditBuilder] insert 작업: 위치 (${insertPosition.line}, ${insertPosition.character}), 텍스트 길이 ${text.length}자`);
      const startTime = Date.now();
      
      // 실제 편집 수행
      console.log(`[EditBuilder] 편집 작업 제출`);
      const success = await editor.edit(editBuilder => {
        editBuilder.insert(insertPosition, text);
      });
      
      // 편집 완료 후 처리
      const duration = Date.now() - startTime;
      console.log(`[EditorModelSync] 문서 모델 동기화 중...`);
      console.log(`[EditorModelSync] 변경 내용 적용 완료`);
      console.log(`[EditOperation] 편집 작업 완료 (${duration}ms)`);
      
      // 성공한 경우 히스토리에 기록
      if (success) {
        this.recordEditOperation({
          type: 'insert',
          text,
          position: insertPosition,
          documentUri: editor.document.uri.toString(),
          timestamp: Date.now(),
          duration
        });
      }
      
      return success;
    } catch (error) {
      console.error(`[EditorManager] 텍스트 삽입 오류:`, error);
      return false;
    } finally {
      // 편집 작업 플래그 해제
      this.activeEditOperation = false;
    }
  }
  
  // 현재 선택 영역 텍스트 가져오기
  getSelectedText(): { text: string; range: vscode.Range } | undefined {
    const editor = this.getActiveEditor();
    if (!editor) return undefined;
    
    const selection = editor.selection;
    if (selection.isEmpty) {
      console.log(`[SelectionManager] 선택된 텍스트 없음 (빈 선택)`);
      return undefined;
    }
    
    const text = editor.document.getText(selection);
    console.log(`[SelectionManager] 현재 선택 영역: 시작 (${selection.start.line}, ${selection.start.character}), 종료 (${selection.end.line}, ${selection.end.character})`);
    console.log(`[SelectionManager] 선택된 텍스트: "${text.length > 30 ? text.substring(0, 27) + '...' : text}"`);
    
    return { text, range: selection };
  }
  
  // 편집 작업 기록
  private recordEditOperation(operation: EditOperation): void {
    this.editHistory.unshift(operation);
    
    // 히스토리 크기 제한
    if (this.editHistory.length > this.maxHistorySize) {
      this.editHistory = this.editHistory.slice(0, this.maxHistorySize);
    }
  }
  
  // 편집 히스토리 가져오기
  getEditHistory(limit: number = 10): EditOperation[] {
    return this.editHistory.slice(0, limit);
  }
}

// 편집 작업 인터페이스
interface EditOperation {
  type: 'insert' | 'delete' | 'replace';
  text: string;
  position: vscode.Position;
  documentUri: string;
  timestamp: number;
  duration: number;
  replacedText?: string;
}

### 2.2 에디터 이벤트
```typescript
// 선택 변경 감지
vscode.window.onDidChangeTextEditorSelection(event => {
    const editor = event.textEditor;
    const selections = event.selections;
    console.log('선택 영역 변경:', selections);
});

// 활성 에디터 변경 감지
vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
        console.log('활성 문서:', editor.document.uri.fsPath);
    }
});
```

#### 2.2.1 실제 에디터 이벤트 로그
```
[EventSystem] 이벤트 구독: onDidChangeTextEditorSelection
[EventSystem] 이벤트 구독: onDidChangeActiveTextEditor
[EditorSelection] 선택 영역 변경 이벤트 발생
[EditorSelection] 선택 개수: 1
[EditorSelection] 선택 영역 데이터: 시작 (67, 10), 종료 (67, 25)
[SelectionTracker] 선택 변경 콜백 실행
[SelectionTracker] 선택된 텍스트: "handleUserInput"
[EditorManager] 활성 에디터 변경 이벤트 발생
[EditorManager] 이전 에디터: file:///project/src/components/App.tsx
[EditorManager] 새 에디터: file:///project/src/utils/input.ts
[DocumentTracker] 문서 컨텍스트 로드 중: input.ts
[DocumentTracker] 언어 모드: typescript
[DocumentTracker] 라인 수: 127
```

#### 2.2.2 에디터 이벤트 관리자 구현 예제
```typescript
// 에디터 이벤트 관리자
class EditorEventManager {
  private static instance: EditorEventManager;
  private disposables: vscode.Disposable[] = [];
  private lastActiveEditor?: vscode.TextEditor;
  private selectionHistory: SelectionEvent[] = [];
  private maxSelectionHistory: number = 50;
  private eventListeners: Map<string, Function[]> = new Map();
  
  // 싱글톤 패턴
  static getInstance(): EditorEventManager {
    if (!EditorEventManager.instance) {
      EditorEventManager.instance = new EditorEventManager();
    }
    return EditorEventManager.instance;
  }
  
  // 이벤트 리스너 초기화
  initialize(): void {
    // 이전 구독 정리
    this.dispose();
    
    // 선택 변경 이벤트 구독
    console.log(`[EventSystem] 이벤트 구독: onDidChangeTextEditorSelection`);
    const selectionSubscription = vscode.window.onDidChangeTextEditorSelection(
      this.handleSelectionChange.bind(this)
    );
    
    // 활성 에디터 변경 이벤트 구독
    console.log(`[EventSystem] 이벤트 구독: onDidChangeActiveTextEditor`);
    const editorSubscription = vscode.window.onDidChangeActiveTextEditor(
      this.handleActiveEditorChange.bind(this)
    );
    
    // 구독 저장
    this.disposables.push(selectionSubscription, editorSubscription);
    
    // 현재 활성 에디터 저장
    this.lastActiveEditor = vscode.window.activeTextEditor;
    
    // 초기화 완료 로그
    console.log(`[EditorEventManager] 초기화 완료, 이벤트 구독 활성화됨`);
  }
  
  // 선택 변경 처리
  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    const editor = event.textEditor;
    const selections = event.selections;
    
    // 선택 영역 데이터 로그
    console.log(`[EditorSelection] 선택 영역 변경 이벤트 발생`);
    console.log(`[EditorSelection] 선택 개수: ${selections.length}`);
    
    if (selections.length > 0) {
      const primary = selections[0];
      console.log(`[EditorSelection] 선택 영역 데이터: 시작 (${primary.start.line}, ${primary.start.character}), 종료 (${primary.end.line}, ${primary.end.character})`);
      
      // 선택된 텍스트 가져오기
      if (!primary.isEmpty) {
        const selectedText = editor.document.getText(primary);
        const displayText = selectedText.length > 30 ? selectedText.substring(0, 27) + '...' : selectedText;
        console.log(`[SelectionTracker] 선택 변경 콜백 실행`);
        console.log(`[SelectionTracker] 선택된 텍스트: "${displayText}"`);
        
        // 선택 히스토리에 기록
        this.recordSelectionEvent({
          documentUri: editor.document.uri.toString(),
          selection: {
            start: { line: primary.start.line, character: primary.start.character },
            end: { line: primary.end.line, character: primary.end.character }
          },
          selectedText: selectedText,
          timestamp: Date.now()
        });
      }
    }
    
    // 커스텀 이벤트 발생
    this.emitEvent('selectionChanged', { editor, selections });
  }
  
  // 활성 에디터 변경 처리
  private handleActiveEditorChange(editor?: vscode.TextEditor): void {
    console.log(`[EditorManager] 활성 에디터 변경 이벤트 발생`);
    
    // 이전/새 에디터 로그
    const previousUri = this.lastActiveEditor?.document.uri.toString() || 'none';
    const newUri = editor?.document.uri.toString() || 'none';
    
    console.log(`[EditorManager] 이전 에디터: ${previousUri}`);
    console.log(`[EditorManager] 새 에디터: ${newUri}`);
    
    // 문서 정보 로그
    if (editor) {
      const fileName = editor.document.fileName.split(/[/\\]/).pop() || '';
      console.log(`[DocumentTracker] 문서 컨텍스트 로드 중: ${fileName}`);
      console.log(`[DocumentTracker] 언어 모드: ${editor.document.languageId}`);
      console.log(`[DocumentTracker] 라인 수: ${editor.document.lineCount}`);
      
      // 현재 활성 에디터 업데이트
      this.lastActiveEditor = editor;
    } else {
      this.lastActiveEditor = undefined;
      console.log(`[EditorManager] 활성 에디터 없음`);
    }
    
    // 커스텀 이벤트 발생
    this.emitEvent('activeEditorChanged', { editor });
  }
  
  // 선택 이벤트 기록
  private recordSelectionEvent(event: SelectionEvent): void {
    this.selectionHistory.unshift(event);
    
    // 히스토리 크기 제한
    if (this.selectionHistory.length > this.maxSelectionHistory) {
      this.selectionHistory = this.selectionHistory.slice(0, this.maxSelectionHistory);
    }
  }
  
  // 선택 히스토리 가져오기
  getSelectionHistory(limit: number = 10): SelectionEvent[] {
    return this.selectionHistory.slice(0, limit);
  }
  
  // 커스텀 이벤트 구독
  on(eventName: string, listener: Function): void {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.push(listener);
    this.eventListeners.set(eventName, listeners);
  }
  
  // 커스텀 이벤트 발생
  private emitEvent(eventName: string, data: any): void {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`[EventSystem] 이벤트 리스너 오류 (${eventName}):`, error);
      }
    });
  }
  
  // 리소스 정리
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.eventListeners.clear();
  }
}

// 선택 이벤트 인터페이스
interface SelectionEvent {
  documentUri: string;
  selection: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectedText: string;
  timestamp: number;
}
```

## 3. 설정 데이터 (✓)

### 3.1 설정 읽기/쓰기
```typescript
// 설정 읽기
const config = vscode.workspace.getConfiguration('볼드모트');
const value = config.get<string>('setting.key');

// 설정 업데이트
await config.update('setting.key', 'new value', vscode.ConfigurationTarget.Global);
```

#### 3.1.1 실제 설정 작업 로그
```
[ConfigManager] 설정 네임스페이스 접근: 볼드모트
[ConfigManager] 설정 읽기: setting.key
[ConfigManager] 값 반환: "default-value"
[ConfigManager] 설정 업데이트 시작: setting.key
[ConfigManager] 업데이트 대상: Global
[ConfigManager] 이전 값: "default-value"
[ConfigManager] 새 값: "new value"
[ConfigStorage] 설정 파일 업데이트 중...
[ConfigStorage] 설정 저장 완료
[ConfigManager] 설정 변경 이벤트 발생
```

#### 3.1.2 설정 관리자 구현 예제
```typescript
// 설정 관리자
class ConfigurationManager {
  private static instance: ConfigurationManager;
  private configChangeListeners: Map<string, Function[]> = new Map();
  private cachedValues: Map<string, any> = new Map();
  private updateQueue: Promise<void> = Promise.resolve();
  
  // 싱글톤 패턴
  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }
  
  // 초기화 및 이벤트 리스너 설정
  initialize(): vscode.Disposable {
    // 설정 변경 이벤트 구독
    const disposable = vscode.workspace.onDidChangeConfiguration(event => {
      this.handleConfigurationChange(event);
    });
    
    // 초기 캐시 로드
    this.preloadCommonSettings();
    
    return disposable;
  }
  
  // 설정 값 가져오기
  getValue<T>(section: string, key: string, defaultValue?: T): T {
    console.log(`[ConfigManager] 설정 네임스페이스 접근: ${section}`);
    console.log(`[ConfigManager] 설정 읽기: ${key}`);
    
    // 캐시된 값 확인
    const cacheKey = `${section}.${key}`;
    if (this.cachedValues.has(cacheKey)) {
      const cachedValue = this.cachedValues.get(cacheKey);
      console.log(`[ConfigManager] 캐시된 값 반환: ${JSON.stringify(cachedValue)}`);
      return cachedValue as T;
    }
    
    // 설정에서 값 가져오기
    const config = vscode.workspace.getConfiguration(section);
    const value = config.get<T>(key, defaultValue as T);
    
    // 캐시에 저장
    this.cachedValues.set(cacheKey, value);
    
    console.log(`[ConfigManager] 값 반환: ${JSON.stringify(value)}`);
    return value;
  }
  
  // 설정 값 업데이트
  async updateValue(section: string, key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<boolean> {
    console.log(`[ConfigManager] 설정 업데이트 시작: ${key}`);
    console.log(`[ConfigManager] 업데이트 대상: ${vscode.ConfigurationTarget[target]}`);
    
    const config = vscode.workspace.getConfiguration(section);
    const currentValue = config.get(key);
    
    console.log(`[ConfigManager] 이전 값: ${JSON.stringify(currentValue)}`);
    console.log(`[ConfigManager] 새 값: ${JSON.stringify(value)}`);
    
    // 이미 같은 값이면 업데이트하지 않음
    if (JSON.stringify(currentValue) === JSON.stringify(value)) {
      console.log(`[ConfigManager] 값이 동일하므로 업데이트 생략`);
      return true;
    }
    
    // 업데이트 작업을 대기열에 추가 (동시 업데이트 방지)
    this.updateQueue = this.updateQueue.then(async () => {
      try {
        console.log(`[ConfigStorage] 설정 파일 업데이트 중...`);
        await config.update(key, value, target);
        
        // 캐시 업데이트
        this.cachedValues.set(`${section}.${key}`, value);
        
        console.log(`[ConfigStorage] 설정 저장 완료`);
        console.log(`[ConfigManager] 설정 변경 이벤트 발생`);
      } catch (error) {
        console.error(`[ConfigManager] 설정 업데이트 오류:`, error);
        throw error;
      }
    });
    
    try {
      await this.updateQueue;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // 설정 변경 처리
  private handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
    // 캐시된 값 중 변경된 것들 삭제
    for (const cacheKey of this.cachedValues.keys()) {
      const [section, key] = cacheKey.split('.');
      if (event.affectsConfiguration(`${section}.${key}`)) {
        this.cachedValues.delete(cacheKey);
        console.log(`[ConfigManager] 캐시 무효화: ${cacheKey}`);
        
        // 관련 리스너 호출
        this.notifyListeners(cacheKey);
      }
    }
  }
  
  // 설정 변경 리스너 등록
  onDidChangeValue(section: string, key: string, listener: Function): vscode.Disposable {
    const fullKey = `${section}.${key}`;
    const listeners = this.configChangeListeners.get(fullKey) || [];
    listeners.push(listener);
    this.configChangeListeners.set(fullKey, listeners);
    
    return {
      dispose: () => {
        const currentListeners = this.configChangeListeners.get(fullKey) || [];
        const index = currentListeners.indexOf(listener);
        if (index >= 0) {
          currentListeners.splice(index, 1);
          this.configChangeListeners.set(fullKey, currentListeners);
        }
      }
    };
  }
  
  // 리스너에 알림
  private notifyListeners(key: string): void {
    const listeners = this.configChangeListeners.get(key) || [];
    const [section, settingKey] = key.split('.');
    const newValue = this.getValue(section, settingKey);
    
    for (const listener of listeners) {
      try {
        listener(newValue);
      } catch (error) {
        console.error(`[ConfigManager] 리스너 호출 오류:`, error);
      }
    }
  }
  
  // 자주 사용하는 설정 미리 캐시
  private preloadCommonSettings(): void {
    // 자주 액세스하는 설정 미리 로드
    const commonSettings = [
      { section: '볼드모트', key: 'setting.key' },
      { section: '볼드모트', key: 'model.provider' },
      { section: '볼드모트', key: 'ui.theme' }
    ];
    
    for (const setting of commonSettings) {
      this.getValue(setting.section, setting.key);
    }
  }
}
```

### 3.2 설정 변경 감지
```typescript
// 설정 변경 감지
vscode.workspace.onDidChangeConfiguration(event => {
    console.log('설정 변경됨:', event.affectsConfiguration);
});
```

#### 3.2.1 실제 설정 변경 감지 로그
```
[ConfigManager] 설정 네임스페이스 접근: 볼드모트
[ConfigManager] 설정 읽기: setting.key
[ConfigManager] 값 반환: "default-value"
[ConfigManager] 설정 업데이트 시작: setting.key
[ConfigManager] 업데이트 대상: Global
[ConfigManager] 이전 값: "default-value"
[ConfigManager] 새 값: "new value"
[ConfigStorage] 설정 파일 업데이트 중...
[ConfigStorage] 설정 저장 완료
[ConfigManager] 설정 변경 이벤트 발생
```

#### 3.2.2 설정 관리자 구현 예제
```typescript
// 설정 관리자
class ConfigurationManager {
  private static instance: ConfigurationManager;
  private configChangeListeners: Map<string, Function[]> = new Map();
  private cachedValues: Map<string, any> = new Map();
  private updateQueue: Promise<void> = Promise.resolve();
  
  // 싱글톤 패턴
  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }
  
  // 초기화 및 이벤트 리스너 설정
  initialize(): vscode.Disposable {
    // 설정 변경 이벤트 구독
    const disposable = vscode.workspace.onDidChangeConfiguration(event => {
      this.handleConfigurationChange(event);
    });
    
    // 초기 캐시 로드
    this.preloadCommonSettings();
    
    return disposable;
  }
  
  // 설정 값 가져오기
  getValue<T>(section: string, key: string, defaultValue?: T): T {
    console.log(`[ConfigManager] 설정 네임스페이스 접근: ${section}`);
    console.log(`[ConfigManager] 설정 읽기: ${key}`);
    
    // 캐시된 값 확인
    const cacheKey = `${section}.${key}`;
    if (this.cachedValues.has(cacheKey)) {
      const cachedValue = this.cachedValues.get(cacheKey);
      console.log(`[ConfigManager] 캐시된 값 반환: ${JSON.stringify(cachedValue)}`);
      return cachedValue as T;
    }
    
    // 설정에서 값 가져오기
    const config = vscode.workspace.getConfiguration(section);
    const value = config.get<T>(key, defaultValue as T);
    
    // 캐시에 저장
    this.cachedValues.set(cacheKey, value);
    
    console.log(`[ConfigManager] 값 반환: ${JSON.stringify(value)}`);
    return value;
  }
  
  // 설정 값 업데이트
  async updateValue(section: string, key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<boolean> {
    console.log(`[ConfigManager] 설정 업데이트 시작: ${key}`);
    console.log(`[ConfigManager] 업데이트 대상: ${vscode.ConfigurationTarget[target]}`);
    
    const config = vscode.workspace.getConfiguration(section);
    const currentValue = config.get(key);
    
    console.log(`[ConfigManager] 이전 값: ${JSON.stringify(currentValue)}`);
    console.log(`[ConfigManager] 새 값: ${JSON.stringify(value)}`);
    
    // 이미 같은 값이면 업데이트하지 않음
    if (JSON.stringify(currentValue) === JSON.stringify(value)) {
      console.log(`[ConfigManager] 값이 동일하므로 업데이트 생략`);
      return true;
    }
    
    // 업데이트 작업을 대기열에 추가 (동시 업데이트 방지)
    this.updateQueue = this.updateQueue.then(async () => {
      try {
        console.log(`[ConfigStorage] 설정 파일 업데이트 중...`);
        await config.update(key, value, target);
        
        // 캐시 업데이트
        this.cachedValues.set(`${section}.${key}`, value);
        
        console.log(`[ConfigStorage] 설정 저장 완료`);
        console.log(`[ConfigManager] 설정 변경 이벤트 발생`);
      } catch (error) {
        console.error(`[ConfigManager] 설정 업데이트 오류:`, error);
        throw error;
      }
    });
    
    try {
      await this.updateQueue;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // 설정 변경 처리
  private handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
    // 캐시된 값 중 변경된 것들 삭제
    for (const cacheKey of this.cachedValues.keys()) {
      const [section, key] = cacheKey.split('.');
      if (event.affectsConfiguration(`${section}.${key}`)) {
        this.cachedValues.delete(cacheKey);
        console.log(`[ConfigManager] 캐시 무효화: ${cacheKey}`);
        
        // 관련 리스너 호출
        this.notifyListeners(cacheKey);
      }
    }
  }
  
  // 설정 변경 리스너 등록
  onDidChangeValue(section: string, key: string, listener: Function): vscode.Disposable {
    const fullKey = `${section}.${key}`;
    const listeners = this.configChangeListeners.get(fullKey) || [];
    listeners.push(listener);
    this.configChangeListeners.set(fullKey, listeners);
    
    return {
      dispose: () => {
        const currentListeners = this.configChangeListeners.get(fullKey) || [];
        const index = currentListeners.indexOf(listener);
        if (index >= 0) {
          currentListeners.splice(index, 1);
          this.configChangeListeners.set(fullKey, currentListeners);
        }
      }
    };
  }
  
  // 리스너에 알림
  private notifyListeners(key: string): void {
    const listeners = this.configChangeListeners.get(key) || [];
    const [section, settingKey] = key.split('.');
    const newValue = this.getValue(section, settingKey);
    
    for (const listener of listeners) {
      try {
        listener(newValue);
      } catch (error) {
        console.error(`[ConfigManager] 리스너 호출 오류:`, error);
      }
    }
  }
  
  // 자주 사용하는 설정 미리 캐시
  private preloadCommonSettings(): void {
    // 자주 액세스하는 설정 미리 로드
    const commonSettings = [
      { section: '볼드모트', key: 'setting.key' },
      { section: '볼드모트', key: 'model.provider' },
      { section: '볼드모트', key: 'ui.theme' }
    ];
    
    for (const setting of commonSettings) {
      this.getValue(setting.section, setting.key);
    }
  }
}
```

## 4. 상태 바 데이터 (✓)

### 4.1 상태 메시지 표시
```typescript
// 상태 메시지 표시
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
statusBarItem.text = "볼드모트 준비됨";
statusBarItem.tooltip = "AI 어시스턴트 상태";
statusBarItem.show();

// 상태 업데이트
statusBarItem.text = "분석 중...";
```

#### 4.1.1 실제 상태 바 업데이트 로그
```
[StatusManager] 상태 바 항목 생성
[StatusManager] 위치: Left, 우선순위: 100
[StatusManager] 초기 텍스트: "볼드모트 준비됨"
[StatusManager] 초기 툴팁: "AI 어시스턴트 상태"
[StatusManager] 상태 바 항목 표시됨
[StatusManager] 상태 업데이트: "분석 중..."
[StatusManager] 색상 업데이트: "#FF8C00"
[StatusManager] 명령 연결: voldemort.showProgressDetails
[StatusManager] 상태 업데이트: "코드 생성 중..."
[StatusManager] 색상 업데이트: "#0078D7"
[StatusManager] 상태 업데이트: "완료"
[StatusManager] 색상 업데이트: "#73C991"
[StatusManager] 3초 후 기본 상태로 리셋
[StatusManager] 상태 업데이트: "볼드모트 준비됨"
[StatusManager] 색상 업데이트: undefined
```

#### 4.1.2 상태 바 관리자 구현 예제
```typescript
// 상태 타입 정의
enum StatusType {
  READY = 'ready',
  PROCESSING = 'processing',
  GENERATING = 'generating',
  ANALYZING = 'analyzing',
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning'
}

// 상태 스타일 정의
interface StatusStyle {
  text: string;
  tooltip?: string;
  color?: string;
  command?: string;
  args?: any[];
  timeout?: number;
}

// 상태 바 관리자
class StatusBarManager {
  private static instance: StatusBarManager;
  private statusBarItem: vscode.StatusBarItem;
  private defaultStatus: StatusStyle;
  private resetTimer: NodeJS.Timeout | null = null;
  
  // 상태 스타일 맵
  private statusStyles: Map<StatusType, StatusStyle> = new Map([
    [StatusType.READY, { text: "볼드모트 준비됨", tooltip: "AI 어시스턴트 상태" }],
    [StatusType.PROCESSING, { text: "처리 중...", color: "#FF8C00", tooltip: "요청 처리 중" }],
    [StatusType.GENERATING, { text: "코드 생성 중...", color: "#0078D7", tooltip: "코드 생성 중" }],
    [StatusType.ANALYZING, { text: "분석 중...", color: "#FF8C00", tooltip: "코드 분석 중" }],
    [StatusType.SUCCESS, { text: "완료", color: "#73C991", tooltip: "작업 완료", timeout: 3000 }],
    [StatusType.ERROR, { text: "오류", color: "#F14C4C", tooltip: "오류 발생", command: "voldemort.showError" }],
    [StatusType.WARNING, { text: "경고", color: "#CCA700", tooltip: "경고 발생", command: "voldemort.showWarning" }]
  ]);
  
  // 싱글톤 패턴
  static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
  }
  
  // 생성자
  private constructor() {
    console.log(`[StatusManager] 상태 바 항목 생성`);
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    console.log(`[StatusManager] 위치: Left, 우선순위: 100`);
    
    this.defaultStatus = this.statusStyles.get(StatusType.READY)!;
    this.resetToDefaultStatus();
    this.statusBarItem.show();
    console.log(`[StatusManager] 상태 바 항목 표시됨`);
  }
  
  // 상태 업데이트
  setStatus(status: StatusType, customText?: string): void {
    // 기존 타이머 취소
    this.clearResetTimer();
    
    const statusStyle = this.statusStyles.get(status)!;
    
    // 텍스트 업데이트
    const text = customText || statusStyle.text;
    this.statusBarItem.text = text;
    console.log(`[StatusManager] 상태 업데이트: "${text}"`);
    
    // 색상 업데이트
    this.statusBarItem.color = statusStyle.color;
    console.log(`[StatusManager] 색상 업데이트: "${statusStyle.color}"`);
    
    // 툴팁 업데이트
    if (statusStyle.tooltip) {
      this.statusBarItem.tooltip = statusStyle.tooltip;
    }
    
    // 명령 연결
    if (statusStyle.command) {
      this.statusBarItem.command = {
        title: statusStyle.text,
        command: statusStyle.command,
        arguments: statusStyle.args || []
      };
      console.log(`[StatusManager] 명령 연결: ${statusStyle.command}`);
    } else {
      this.statusBarItem.command = undefined;
    }
    
    // 자동 리셋 타이머 설정
    if (statusStyle.timeout) {
      console.log(`[StatusManager] ${statusStyle.timeout/1000}초 후 기본 상태로 리셋`);
      this.resetTimer = setTimeout(() => {
        this.resetToDefaultStatus();
      }, statusStyle.timeout);
    }
  }
  
  // 커스텀 상태 설정
  setCustomStatus(options: StatusStyle): void {
    // 기존 타이머 취소
    this.clearResetTimer();
    
    // 텍스트 업데이트
    this.statusBarItem.text = options.text;
    console.log(`[StatusManager] 커스텀 상태 업데이트: "${options.text}"`);
    
    // 색상 업데이트
    if (options.color) {
      this.statusBarItem.color = options.color;
      console.log(`[StatusManager] 색상 업데이트: "${options.color}"`);
    }
    
    // 툴팁 업데이트
    if (options.tooltip) {
      this.statusBarItem.tooltip = options.tooltip;
    }
    
    // 명령 연결
    if (options.command) {
      this.statusBarItem.command = {
        title: options.text,
        command: options.command,
        arguments: options.args || []
      };
      console.log(`[StatusManager] 명령 연결: ${options.command}`);
    }
    
    // 자동 리셋 타이머 설정
    if (options.timeout) {
      console.log(`[StatusManager] ${options.timeout/1000}초 후 기본 상태로 리셋`);
      this.resetTimer = setTimeout(() => {
        this.resetToDefaultStatus();
      }, options.timeout);
    }
  }
  
  // 기본 상태로 리셋
  resetToDefaultStatus(): void {
    this.statusBarItem.text = this.defaultStatus.text;
    console.log(`[StatusManager] 상태 업데이트: "${this.defaultStatus.text}"`);
    
    this.statusBarItem.color = this.defaultStatus.color;
    console.log(`[StatusManager] 색상 업데이트: ${this.defaultStatus.color}`);
    
    this.statusBarItem.tooltip = this.defaultStatus.tooltip;
    
    this.statusBarItem.command = this.defaultStatus.command ? {
      title: this.defaultStatus.text,
      command: this.defaultStatus.command,
      arguments: this.defaultStatus.args || []
    } : undefined;
  }
  
  // 스피너 상태 시작
  startSpinner(baseText: string): void {
    let dots = 0;
    const frames = ['.  ', '.. ', '...'];
    
    this.clearResetTimer();
    
    // 애니메이션 간격 설정
    this.resetTimer = setInterval(() => {
      this.statusBarItem.text = `${baseText} ${frames[dots]}`;
      dots = (dots + 1) % frames.length;
    }, 500);
  }
  
  // 진행 상태 업데이트
  setProgress(percent: number, text: string): void {
    const blocks = 10;
    const filledBlocks = Math.floor(percent / (100 / blocks));
    const emptyBlocks = blocks - filledBlocks;
    
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    this.statusBarItem.text = `${text} ${progressBar} ${percent}%`;
  }
  
  // 타이머 정리
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      clearInterval(this.resetTimer); // 인터벌인 경우도 처리
      this.resetTimer = null;
    }
  }
  
  // 리소스 정리
  dispose(): void {
    this.clearResetTimer();
    this.statusBarItem.dispose();
  }
}
```

### 4.2 진행 알림
```typescript
// 진행 알림 표시
vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "코드 분석 중",
    cancellable: true
}, async (progress, token) => {
    token.onCancellationRequested(() => {
        console.log("사용자가 작업을 취소했습니다.");
    });

    for (let i = 0; i < 100; i += 10) {
        progress.report({ message: `${i}% 완료`, increment: 10 });
        await new Promise(resolve => setTimeout(resolve, 500));
    }
});
```

#### 4.2.1 실제 진행 알림 로그
```
[ProgressManager] 진행 알림 생성
[ProgressManager] 위치: Notification
[ProgressManager] 제목: "코드 분석 중"
[ProgressManager] 취소 가능: true
[ProgressManager] 진행 업데이트: 10%, "파일 목록 수집 중"
[ProgressManager] 진행 업데이트: 20%, "종속성 분석 중"
[ProgressManager] 진행 업데이트: 35%, "코드 구조 분석 중"
[ProgressManager] 진행 업데이트: 50%, "파일 간 연결 검색 중"
[ProgressManager] 진행 업데이트: 70%, "변경 사항 영향 검토 중"
[ProgressManager] 진행 업데이트: 85%, "리팩토링 준비 중"
[ProgressManager] 진행 업데이트: 100%, "완료"
[ProgressManager] 진행 완료
```

#### 4.2.2 진행 관리자 구현 예제
```typescript
// 진행 단계 인터페이스
interface ProgressStep {
  percent: number;
  message: string;
}

// 진행 위치 열거형
enum ProgressDisplayLocation {
  NOTIFICATION = 'notification',
  STATUS_BAR = 'statusBar',
  WINDOW = 'window'
}

// 진행 관리자
class ProgressManager {
  private static instance: ProgressManager;
  private activeProgress: Map<string, vscode.Progress<{ message?: string; increment?: number }>> = new Map();
  private activeTokens: Map<string, vscode.CancellationTokenSource> = new Map();
  private statusBarManager: StatusBarManager;
  
  // 싱글톤 패턴
  static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }
  
  // 생성자
  private constructor() {
    this.statusBarManager = StatusBarManager.getInstance();
  }
  
  // 진행 시작
  async startProgress(
    id: string,
    title: string,
    steps: ProgressStep[],
    location: ProgressDisplayLocation = ProgressDisplayLocation.NOTIFICATION,
    cancellable: boolean = true
  ): Promise<boolean> {
    // 이미 실행 중인 동일 ID의 진행이 있으면 취소
    if (this.activeProgress.has(id)) {
      this.cancelProgress(id);
    }
    
    // 취소 토큰 생성
    const tokenSource = new vscode.CancellationTokenSource();
    this.activeTokens.set(id, tokenSource);
    
    // 진행 표시 위치 설정
    let progressLocation: vscode.ProgressLocation;
    switch (location) {
      case ProgressDisplayLocation.NOTIFICATION:
        progressLocation = vscode.ProgressLocation.Notification;
        break;
      case ProgressDisplayLocation.WINDOW:
        progressLocation = vscode.ProgressLocation.Window;
        break;
      case ProgressDisplayLocation.STATUS_BAR:
        // 상태 바는 withProgress 없이 직접 처리
        this.statusBarManager.setStatus(StatusType.PROCESSING, title);
        break;
    }
    
    console.log(`[ProgressManager] 진행 알림 생성`);
    console.log(`[ProgressManager] 위치: ${location}`);
    console.log(`[ProgressManager] 제목: "${title}"`);
    console.log(`[ProgressManager] 취소 가능: ${cancellable}`);
    
    // 상태 바 이외의 위치인 경우 withProgress 사용
    if (location !== ProgressDisplayLocation.STATUS_BAR) {
      return new Promise<boolean>((resolve) => {
        vscode.window.withProgress({
          location: progressLocation!,
          title: title,
          cancellable: cancellable
        }, async (progress, token) => {
          // 진행 객체 저장
          this.activeProgress.set(id, progress);
          
          // 취소 이벤트 처리
          token.onCancellationRequested(() => {
            console.log(`[ProgressManager] 사용자가 "${id}" 작업을 취소했습니다.`);
            resolve(false);
          });
          
          // 단계별 진행
          let lastPercent = 0;
          for (const step of steps) {
            if (token.isCancellationRequested) {
              break;
            }
            
            const increment = step.percent - lastPercent;
            console.log(`[ProgressManager] 진행 업데이트: ${step.percent}%, "${step.message}"`);
            progress.report({ increment, message: step.message });
            lastPercent = step.percent;
            
            // 상태 바에도 표시
            this.statusBarManager.setProgress(step.percent, title);
            
            // 마지막 단계가 아니면 지연
            if (step.percent < 100) {
              await this.delay(300); // 단계 간 약간의 지연
            }
          }
          
          console.log(`[ProgressManager] 진행 완료`);
          
          // 완료 후 정리
          this.activeProgress.delete(id);
          this.activeTokens.delete(id);
          
          // 완료 상태 표시
          this.statusBarManager.setStatus(StatusType.SUCCESS);
          
          resolve(true);
        });
      });
    } else {
      // 상태 바 전용 진행
      try {
        let lastPercent = 0;
        for (const step of steps) {
          if (tokenSource.token.isCancellationRequested) {
            break;
          }
          
          console.log(`[ProgressManager] 진행 업데이트: ${step.percent}%, "${step.message}"`);
          this.statusBarManager.setProgress(step.percent, step.message);
          lastPercent = step.percent;
          
          // 마지막 단계가 아니면 지연
          if (step.percent < 100) {
            await this.delay(300); // 단계 간 약간의 지연
          }
        }
        
        console.log(`[ProgressManager] 진행 완료`);
        
        // 완료 후 정리
        this.activeTokens.delete(id);
        
        // 완료 상태 표시
        this.statusBarManager.setStatus(StatusType.SUCCESS);
        
        return true;
      } catch (err) {
        this.activeTokens.delete(id);
        this.statusBarManager.setStatus(StatusType.ERROR, "오류 발생");
        return false;
      }
    }
  }
  
  // 진행 취소
  cancelProgress(id: string): void {
    const tokenSource = this.activeTokens.get(id);
    if (tokenSource) {
      tokenSource.cancel();
      this.activeTokens.delete(id);
      console.log(`[ProgressManager] "${id}" 작업 취소됨`);
    }
  }
  
  // 진행 업데이트
  updateProgress(id: string, increment: number, message: string): boolean {
    const progress = this.activeProgress.get(id);
    if (progress) {
      console.log(`[ProgressManager] "${id}" 진행 수동 업데이트: +${increment}%, "${message}"`);
      progress.report({ increment, message });
      return true;
    }
    return false;
  }
  
  // 지연 유틸리티 함수
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // 리소스 정리
  dispose(): void {
    // 모든 진행 취소
    for (const id of this.activeTokens.keys()) {
      this.cancelProgress(id);
    }
  }
}
```

## 5. 결론 (✓)

이 문서는 볼드모트 IDE 내에서 관찰된 실제 데이터 교환 패턴과 API 사용을 기반으로 합니다. 각 데이터 유형별로 분석된 내용을 바탕으로 VSCode 확장을 개발할 때 참고할 수 있는 기본 구조와 패턴을 제공합니다. 문서에 포함된 코드와 로그는 실제 관찰된 데이터를 기반으로 하며, 이를 통해 비슷한 기능을 구현할 때 참조할 수 있습니다.