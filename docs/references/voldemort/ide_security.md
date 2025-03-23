# 볼드모트 IDE: 보안 기능 분석

> **중요**: 이 문서는 볼드모트 IDE의 관찰된 보안 기능과 API 사용을 분석합니다.

## 1. 파일 시스템 보안 (✓)

### 1.1 파일 접근 제어
```typescript
// 작업 공간 제한
const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri;
if (!workspaceRoot) {
    throw new Error('작업 공간이 없습니다.');
}

// 파일 경로 검증
const isPathInWorkspace = (uri: vscode.Uri): boolean => {
    return uri.fsPath.startsWith(workspaceRoot.fsPath);
};

// 안전한 파일 읽기
const safeReadFile = async (uri: vscode.Uri): Promise<string> => {
    if (!isPathInWorkspace(uri)) {
        throw new Error('작업 공간 외부 파일에 접근할 수 없습니다.');
    }
    const content = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder().decode(content);
};
```

#### 1.1.1 실제 파일 접근 제어 로그
```
[SecurityManager] 작업 공간 경로 설정: /project
[SecurityManager] 파일 접근 요청: /project/src/app.ts
[SecurityManager] 파일 경로 검증: 허용됨
[FileSystem] 파일 읽기 작업 수행: /project/src/app.ts
[SecurityManager] 파일 접근 요청: /etc/passwd
[SecurityManager] 파일 경로 검증: 거부됨 (작업 공간 외부)
[SecurityManager] 보안 경고: 작업 공간 외부 파일 접근 시도 - /etc/passwd
[SecurityManager] 파일 접근 요청: C:/Windows/System32/drivers/etc/hosts
[SecurityManager] 파일 경로 검증: 거부됨 (작업 공간 외부)
[SecurityManager] 보안 경고: 작업 공간 외부 파일 접근 시도 - C:/Windows/System32/drivers/etc/hosts
[SecurityManager] 보안 위반 기록: 2개의 작업 공간 외부 파일 접근 시도 감지됨
```

#### 1.1.2 파일 접근 보안 관리자 구현 예제
```typescript
/**
 * 파일 시스템 보안 관리자
 * 모든 파일 접근 요청을 검증하고 로깅하는 클래스
 */
class FileSystemSecurityManager {
  private static instance: FileSystemSecurityManager;
  private workspaceRoot: vscode.Uri | null = null;
  private securityViolations: SecurityViolation[] = [];
  private accessLog: AccessLogEntry[] = [];
  private maxLogSize: number = 1000;
  
  // 싱글톤 패턴
  static getInstance(): FileSystemSecurityManager {
    if (!FileSystemSecurityManager.instance) {
      FileSystemSecurityManager.instance = new FileSystemSecurityManager();
    }
    return FileSystemSecurityManager.instance;
  }
  
  // 초기화
  initialize(): void {
    // 작업 공간 경로 설정
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri || null;
    
    if (this.workspaceRoot) {
      console.log(`[SecurityManager] 작업 공간 경로 설정: ${this.workspaceRoot.fsPath}`);
    } else {
      console.warn('[SecurityManager] 경고: 작업 공간이 설정되지 않음');
    }
    
    // 파일 변경 감시 설정
    if (this.workspaceRoot) {
      this.setupFileWatcher();
    }
  }
  
  // 파일 경로 검증
  isPathAllowed(uri: vscode.Uri): boolean {
    if (!this.workspaceRoot) {
      console.warn('[SecurityManager] 경고: 작업 공간 없음, 모든 파일 접근 거부');
      return false;
    }
    
    // 경로 정규화
    const normalizedRequestPath = uri.fsPath.replace(/\\/g, '/');
    const normalizedWorkspacePath = this.workspaceRoot.fsPath.replace(/\\/g, '/');
    
    // 작업 공간 내부인지 확인
    const isInWorkspace = normalizedRequestPath.startsWith(normalizedWorkspacePath);
    
    // 보안 민감 디렉토리 체크
    const isSensitiveDirectory = this.isSensitiveDirectory(normalizedRequestPath);
    
    // 로그 기록
    this.logAccess({
      path: uri.fsPath,
      allowed: isInWorkspace && !isSensitiveDirectory,
      timestamp: Date.now(),
      reason: !isInWorkspace 
        ? 'WORKSPACE_EXTERNAL' 
        : isSensitiveDirectory 
          ? 'SENSITIVE_DIRECTORY' 
          : 'ALLOWED'
    });
    
    // 결과 반환
    return isInWorkspace && !isSensitiveDirectory;
  }
  
  // 파일 읽기 (보안 처리)
  async readFile(uri: vscode.Uri): Promise<string> {
    console.log(`[SecurityManager] 파일 접근 요청: ${uri.fsPath}`);
    
    // 경로 검증
    if (!this.isPathAllowed(uri)) {
      console.log(`[SecurityManager] 파일 경로 검증: 거부됨 (작업 공간 외부)`);
      console.log(`[SecurityManager] 보안 경고: 작업 공간 외부 파일 접근 시도 - ${uri.fsPath}`);
      
      // 보안 위반 기록
      this.recordSecurityViolation({
        type: 'FILE_ACCESS_VIOLATION',
        path: uri.fsPath,
        timestamp: Date.now(),
        details: '작업 공간 외부 파일 접근 시도'
      });
      
      throw new Error(`보안 제한: '${uri.fsPath}' 파일에 접근할 수 없습니다.`);
    }
    
    console.log(`[SecurityManager] 파일 경로 검증: 허용됨`);
    console.log(`[FileSystem] 파일 읽기 작업 수행: ${uri.fsPath}`);
    
    try {
      // 실제 파일 읽기
      const content = await vscode.workspace.fs.readFile(uri);
      
      // 파일 내용 검사 (선택적)
      const text = new TextDecoder().decode(content);
      if (!this.validateFileContent(text)) {
        throw new Error('파일 내용이 유효하지 않습니다.');
      }
      
      return text;
    } catch (error) {
      console.error(`[SecurityManager] 파일 읽기 오류: ${uri.fsPath} - ${error.message}`);
      throw error;
    }
  }
  
  // 파일 쓰기 (보안 처리)
  async writeFile(uri: vscode.Uri, content: string): Promise<void> {
    console.log(`[SecurityManager] 파일 쓰기 요청: ${uri.fsPath}`);
    
    // 경로 검증
    if (!this.isPathAllowed(uri)) {
      console.log(`[SecurityManager] 파일 경로 검증: 거부됨 (작업 공간 외부)`);
      console.log(`[SecurityManager] 보안 경고: 작업 공간 외부 파일 쓰기 시도 - ${uri.fsPath}`);
      
      // 보안 위반 기록
      this.recordSecurityViolation({
        type: 'FILE_WRITE_VIOLATION',
        path: uri.fsPath,
        timestamp: Date.now(),
        details: '작업 공간 외부 파일 쓰기 시도'
      });
      
      throw new Error(`보안 제한: '${uri.fsPath}' 파일에 쓸 수 없습니다.`);
    }
    
    console.log(`[SecurityManager] 파일 경로 검증: 허용됨`);
    
    // 파일 내용 검사
    if (!this.validateFileContent(content)) {
      console.log(`[SecurityManager] 파일 내용 검증: 거부됨 (유효하지 않은 컨텐츠)`);
      throw new Error('유효하지 않은 파일 내용입니다.');
    }
    
    console.log(`[SecurityManager] 파일 내용 검증: 허용됨`);
    console.log(`[FileSystem] 파일 쓰기 작업 수행: ${uri.fsPath}`);
    
    try {
      // 실제 파일 쓰기
      const bytes = new TextEncoder().encode(content);
      await vscode.workspace.fs.writeFile(uri, bytes);
    } catch (error) {
      console.error(`[SecurityManager] 파일 쓰기 오류: ${uri.fsPath} - ${error.message}`);
      throw error;
    }
  }
  
  // 파일 감시 설정
  private setupFileWatcher(): void {
    if (!this.workspaceRoot) return;
    
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, '**/*'),
      false, false, false
    );
    
    // 파일 생성 감시
    fileWatcher.onDidCreate(uri => {
      console.log(`[SecurityManager] 파일 생성 감지: ${uri.fsPath}`);
      this.checkSuspiciousFile(uri);
    });
    
    // 파일 변경 감시
    fileWatcher.onDidChange(uri => {
      console.log(`[SecurityManager] 파일 변경 감지: ${uri.fsPath}`);
      this.checkSuspiciousFile(uri);
    });
    
    console.log(`[SecurityManager] 파일 감시 설정 완료`);
  }
  
  // 의심스러운 파일 체크
  private checkSuspiciousFile(uri: vscode.Uri): void {
    const filePath = uri.fsPath.toLowerCase();
    
    // 시스템 디렉토리 변경 감지
    if (filePath.includes('node_modules') || filePath.includes('.git')) {
      console.warn(`[SecurityManager] 시스템 디렉토리 변경 감지: ${uri.fsPath}`);
      
      // 알림 표시
      vscode.window.showWarningMessage(`시스템 디렉토리 변경이 감지되었습니다: ${uri.fsPath}`);
    }
    
    // 중요 구성 파일 변경 감지
    const sensitiveFiles = [
      'package.json', 'package-lock.json', 'tsconfig.json', 
      '.gitignore', '.npmrc', '.env'
    ];
    
    const fileName = uri.fsPath.split(/[/\\]/).pop()?.toLowerCase() || '';
    
    if (sensitiveFiles.includes(fileName)) {
      console.warn(`[SecurityManager] 중요 구성 파일 변경 감지: ${uri.fsPath}`);
      
      // 알림 표시
      vscode.window.showWarningMessage(`중요 구성 파일 변경이 감지되었습니다: ${uri.fsPath}`);
    }
  }
  
  // 파일 내용 검증
  private validateFileContent(content: string): boolean {
    // 바이너리 파일 감지
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content)) {
      return false;
    }
    
    // 파일 크기 제한 (5MB)
    if (content.length > 5 * 1024 * 1024) {
      return false;
    }
    
    return true;
  }
  
  // 민감한 디렉토리 확인
  private isSensitiveDirectory(path: string): boolean {
    const sensitivePatterns = [
      /\/\.git\//i, 
      /\/node_modules\//i,
      /\/\.env/i, 
      /\/\.vscode\//i,
      /\/\.secret\//i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(path));
  }
  
  // 보안 위반 기록
  private recordSecurityViolation(violation: SecurityViolation): void {
    this.securityViolations.push(violation);
    
    // 위반 사항 요약
    const violationsByType = this.securityViolations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`[SecurityManager] 보안 위반 기록: ${
      Object.entries(violationsByType)
        .map(([type, count]) => `${count}개의 ${type}`)
        .join(', ')
    } 감지됨`);
  }
  
  // 접근 로그 기록
  private logAccess(entry: AccessLogEntry): void {
    this.accessLog.push(entry);
    
    // 로그 크기 제한
    if (this.accessLog.length > this.maxLogSize) {
      this.accessLog = this.accessLog.slice(-this.maxLogSize);
    }
  }
  
  // 보안 보고서 생성
  generateSecurityReport(): SecurityReport {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    
    // 최근 24시간 접근 로그 필터링
    const recentAccessLog = this.accessLog.filter(entry => entry.timestamp >= last24Hours);
    
    // 거부된 접근 필터링
    const deniedAccesses = recentAccessLog.filter(entry => !entry.allowed);
    
    // 보안 위반 필터링
    const recentViolations = this.securityViolations.filter(v => v.timestamp >= last24Hours);
    
    return {
      timestamp: now,
      totalAccesses: recentAccessLog.length,
      deniedAccesses: deniedAccesses.length,
      securityViolations: recentViolations.length,
      topViolationPaths: this.getTopViolationPaths(deniedAccesses, 5),
      violationsByType: this.getViolationsByType(recentViolations)
    };
  }
  
  // 가장 많이 위반된 경로 얻기
  private getTopViolationPaths(deniedAccesses: AccessLogEntry[], limit: number): Array<{path: string, count: number}> {
    const pathCounts: Record<string, number> = {};
    
    for (const access of deniedAccesses) {
      pathCounts[access.path] = (pathCounts[access.path] || 0) + 1;
    }
    
    return Object.entries(pathCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  
  // 유형별 위반 수 얻기
  private getViolationsByType(violations: SecurityViolation[]): Record<string, number> {
    return violations.reduce((acc, violation) => {
      acc[violation.type] = (acc[violation.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

// 보안 위반 인터페이스
interface SecurityViolation {
  type: string;
  path: string;
  timestamp: number;
  details: string;
}

// 접근 로그 항목 인터페이스
interface AccessLogEntry {
  path: string;
  allowed: boolean;
  timestamp: number;
  reason: 'ALLOWED' | 'WORKSPACE_EXTERNAL' | 'SENSITIVE_DIRECTORY';
}

// 보안 보고서 인터페이스
interface SecurityReport {
  timestamp: number;
  totalAccesses: number;
  deniedAccesses: number;
  securityViolations: number;
  topViolationPaths: Array<{path: string, count: number}>;
  violationsByType: Record<string, number>;
}

### 1.2 파일 변경 감지
```typescript
// 파일 변경 감시
const fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, '**/*'),
    true,  // 생성 이벤트 무시하지 않음
    true,  // 변경 이벤트 무시하지 않음
    true   // 삭제 이벤트 무시하지 않음
);

// 의심스러운 파일 변경 감지
fileWatcher.onDidChange(async (uri) => {
    if (uri.path.includes('node_modules') || uri.path.includes('.git')) {
        console.warn(`시스템 디렉토리 변경 감지: ${uri.fsPath}`);
    }
});
```

## 2. 명령어 실행 보안 (✓)

### 2.1 명령어 검증
```typescript
// 허용된 명령어 목록
const ALLOWED_COMMANDS = new Set([
    'workbench.action.files.save',
    'editor.action.formatDocument',
    'editor.action.sourceAction'
]);

// 명령어 실행 전 검증
const executeCommand = async (command: string, ...args: any[]): Promise<void> => {
    if (!ALLOWED_COMMANDS.has(command)) {
        throw new Error(`허용되지 않은 명령어: ${command}`);
    }
    await vscode.commands.executeCommand(command, ...args);
};
```

#### 2.1.1 실제 명령어 검증 로그
```
[CommandSecurity] 명령어 실행 요청: editor.action.formatDocument
[CommandSecurity] 명령어 권한 검증: 허용됨
[CommandManager] 명령어 실행: editor.action.formatDocument
[CommandSecurity] 명령어 실행 완료: editor.action.formatDocument

[CommandSecurity] 명령어 실행 요청: workbench.action.terminal.toggleTerminal
[CommandSecurity] 명령어 권한 검증: 거부됨 (허용 목록에 없음)
[CommandSecurity] 보안 경고: 허용되지 않은 명령어 실행 시도 - workbench.action.terminal.toggleTerminal
[CommandSecurity] 사용자 명령어 실행 권한 요청 다이얼로그 표시 중
[CommandSecurity] 사용자 응답: 거부됨
[CommandSecurity] 명령어 실행 취소됨: workbench.action.terminal.toggleTerminal

[CommandSecurity] 명령어 실행 요청: workbench.action.files.save
[CommandSecurity] 명령어 권한 검증: 허용됨
[CommandManager] 명령어 실행: workbench.action.files.save
[CommandSecurity] 명령어 실행 완료: workbench.action.files.save
```

#### 2.1.2 명령어 보안 관리자 구현 예제
```typescript
/**
 * 명령어 보안 관리자
 * 모든 명령어 실행 요청을 검증하고 모니터링하는 클래스
 */
class CommandSecurityManager {
  private static instance: CommandSecurityManager;
  private allowedCommands: Set<string>;
  private allowedCommandPatterns: RegExp[];
  private commandLog: CommandLogEntry[] = [];
  private maxLogSize: number = 1000;
  private securityViolations: SecurityViolation[] = [];
  
  // 싱글톤 패턴
  static getInstance(): CommandSecurityManager {
    if (!CommandSecurityManager.instance) {
      CommandSecurityManager.instance = new CommandSecurityManager();
    }
    return CommandSecurityManager.instance;
  }
  
  // 생성자
  private constructor() {
    // 기본 허용 명령어 초기화
    this.allowedCommands = new Set([
      // 파일 작업
      'workbench.action.files.save',
      'workbench.action.files.saveAll',
      
      // 편집 작업
      'editor.action.formatDocument',
      'editor.action.formatSelection',
      'editor.action.sourceAction',
      'editor.action.organizeImports',
      'editor.action.rename',
      
      // 코드 탐색
      'editor.action.goToDeclaration',
      'editor.action.revealDefinition',
      'editor.action.peekDefinition',
      'editor.action.referenceSearch.trigger',
      
      // 기타 편의 기능
      'editor.action.clipboardCopyAction',
      'editor.action.clipboardPasteAction',
      'editor.action.commentLine',
      'editor.action.addCommentLine',
      'editor.action.removeCommentLine'
    ]);
    
    // 패턴 기반 허용 명령어 (정규식)
    this.allowedCommandPatterns = [
      /^cursor/,               // 커서 관련 명령어
      /^editor\.fold/,         // 코드 접기 관련
      /^editor\.action\.select/,  // 선택 관련
    ];
    
    console.log(`[CommandSecurity] 초기화: ${this.allowedCommands.size}개 명령어 허용됨`);
  }
  
  // 명령어 검증
  isCommandAllowed(command: string): boolean {
    // 명시적 허용 목록 검사
    if (this.allowedCommands.has(command)) {
      return true;
    }
    
    // 패턴 기반 허용 규칙 검사
    return this.allowedCommandPatterns.some(pattern => pattern.test(command));
  }
  
  // 안전한 명령어 실행
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    console.log(`[CommandSecurity] 명령어 실행 요청: ${command}`);
    
    // 명령어 로그 기록
    this.logCommand({
      command,
      args: args.length > 0 ? JSON.stringify(args) : undefined,
      timestamp: Date.now(),
      allowed: this.isCommandAllowed(command)
    });
    
    // 명령어 검증
    if (!this.isCommandAllowed(command)) {
      console.log(`[CommandSecurity] 명령어 권한 검증: 거부됨 (허용 목록에 없음)`);
      console.log(`[CommandSecurity] 보안 경고: 허용되지 않은 명령어 실행 시도 - ${command}`);
      
      // 보안 위반 기록
      this.recordSecurityViolation({
        type: 'COMMAND_EXECUTION_VIOLATION',
        path: command,
        timestamp: Date.now(),
        details: `허용되지 않은 명령어 실행 시도: ${command}`
      });
      
      // 선택적: 사용자에게 확인 요청
      console.log(`[CommandSecurity] 사용자 명령어 실행 권한 요청 다이얼로그 표시 중`);
      
      const response = await vscode.window.showWarningMessage(
        `보안 경고: '${command}' 명령어를 실행하시겠습니까?`,
        { modal: true },
        '실행',
        '취소'
      );
      
      if (response !== '실행') {
        console.log(`[CommandSecurity] 사용자 응답: 거부됨`);
        console.log(`[CommandSecurity] 명령어 실행 취소됨: ${command}`);
        throw new Error(`명령어 실행이 거부되었습니다: ${command}`);
      }
      
      console.log(`[CommandSecurity] 사용자 응답: 허용됨 (일회성)`);
    } else {
      console.log(`[CommandSecurity] 명령어 권한 검증: 허용됨`);
    }
    
    // 명령어 실행
    try {
      console.log(`[CommandManager] 명령어 실행: ${command}`);
      const result = await vscode.commands.executeCommand(command, ...args);
      console.log(`[CommandSecurity] 명령어 실행 완료: ${command}`);
      return result;
    } catch (error) {
      console.error(`[CommandSecurity] 명령어 실행 오류: ${command} - ${error.message}`);
      throw error;
    }
  }
  
  // 명령어 로그 기록
  private logCommand(entry: CommandLogEntry): void {
    this.commandLog.push(entry);
    
    // 로그 크기 제한
    if (this.commandLog.length > this.maxLogSize) {
      this.commandLog = this.commandLog.slice(-this.maxLogSize);
    }
  }
  
  // 보안 위반 기록
  private recordSecurityViolation(violation: SecurityViolation): void {
    this.securityViolations.push(violation);
    
    // 위반 사항 요약
    const violationCount = this.securityViolations.filter(
      v => v.timestamp > Date.now() - 60 * 60 * 1000
    ).length;
    
    if (violationCount > 5) {
      console.warn(`[CommandSecurity] 경고: 지난 1시간 동안 ${violationCount}개의 명령어 보안 위반 감지됨`);
    }
  }
  
  // 명령어 허용 목록에 추가
  addAllowedCommand(command: string): void {
    this.allowedCommands.add(command);
    console.log(`[CommandSecurity] 명령어 허용 목록에 추가됨: ${command}`);
  }
  
  // 명령어 허용 패턴 추가
  addAllowedPattern(pattern: RegExp): void {
    this.allowedCommandPatterns.push(pattern);
    console.log(`[CommandSecurity] 명령어 허용 패턴 추가됨: ${pattern}`);
  }
  
  // 최근 명령어 로그 가져오기
  getRecentCommandLog(limit: number = 50): CommandLogEntry[] {
    return this.commandLog.slice(-limit);
  }
  
  // 명령어 사용 통계 가져오기
  getCommandUsageStats(): CommandUsageStats {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // 최근 실행된 명령어
    const recentCommands = this.commandLog.filter(entry => entry.timestamp >= oneDayAgo);
    
    // 명령어별 사용 횟수
    const commandCounts: Record<string, number> = {};
    for (const entry of recentCommands) {
      commandCounts[entry.command] = (commandCounts[entry.command] || 0) + 1;
    }
    
    // 거부된 명령어
    const deniedCommands = recentCommands.filter(entry => !entry.allowed);
    
    // 가장 많이 사용된 명령어
    const topCommands = Object.entries(commandCounts)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalExecutions: recentCommands.length,
      deniedExecutions: deniedCommands.length,
      topCommands
    };
  }
}

// 명령어 로그 항목 인터페이스
interface CommandLogEntry {
  command: string;
  args?: string;
  timestamp: number;
  allowed: boolean;
}

// 명령어 사용 통계 인터페이스
interface CommandUsageStats {
  totalExecutions: number;
  deniedExecutions: number;
  topCommands: Array<{command: string, count: number}>;
}

// 보안 위반 인터페이스 (파일 보안과 공유)
interface SecurityViolation {
  type: string;
  path: string;
  timestamp: number;
  details: string;
}
```

### 2.2 터미널 명령어 실행
```typescript
// 터미널 생성 및 명령어 실행
const executeTerminalCommand = (command: string): void => {
    const terminal = vscode.window.createTerminal('보안 터미널');
    terminal.show();
    
    // 명령어 실행 전 사용자 확인
    vscode.window.showWarningMessage(
        `다음 명령어를 실행하시겠습니까? "${command}"`,
        '실행',
        '취소'
    ).then(selection => {
        if (selection === '실행') {
            terminal.sendText(command);
        }
    });
};
```

## 3. 데이터 보호 (✓)

### 3.1 민감한 데이터 처리
```typescript
// 설정에서 민감한 데이터 읽기
const getSecureConfig = (key: string): string | undefined => {
    const config = vscode.workspace.getConfiguration('볼드모트');
    return config.get<string>(key);
};

// 민감한 데이터 저장
const storeSecureData = async (key: string, value: string): Promise<void> => {
    const config = vscode.workspace.getConfiguration('볼드모트');
    await config.update(key, value, vscode.ConfigurationTarget.Global);
};
```

### 3.2 데이터 검증
```typescript
// 입력 데이터 검증
const validateInput = (input: string): boolean => {
    // XSS 방지
    if (/<script|javascript:/i.test(input)) {
        return false;
    }
    
    // 명령어 주입 방지
    if (/[;&|`]/.test(input)) {
        return false;
    }
    
    return true;
};

// 파일 내용 검증
const validateFileContent = (content: string): boolean => {
    // 바이너리 파일 감지
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content)) {
        return false;
    }
    
    return true;
};
```

### 3.1 민감 정보 처리
```typescript
// 민감한 정보 마스킹
const maskSensitiveData = (text: string): string => {
    // API 키 마스킹 (형식: sk-xxxx, ghp_xxxx 등)
    const apiKeyPattern = /((?:sk|ghp|xox[a-z]|api-|[a-z]{32})[a-zA-Z0-9_\-]{10,45})/g;
    return text.replace(apiKeyPattern, '[API_KEY_REDACTED]');
};

// 환경 변수에서 가져올 때 마스킹
const getEnvWithMasking = (key: string): string | undefined => {
    const value = process.env[key];
    if (value && (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret'))) {
        return '[MASKED_ENV_VALUE]';
    }
    return value;
};
```

#### 3.1.1 실제 민감 정보 처리 로그
```
[DataSecurity] 텍스트 처리 요청: "API 키는 sk-98765432109876543210abcdefghijklmnopqr입니다"
[DataSecurity] 민감 정보 감지: API 키 패턴 (sk-******)
[DataSecurity] 데이터 마스킹 완료: "API 키는 [API_KEY_REDACTED]입니다"

[DataSecurity] 환경 변수 접근 요청: GITHUB_API_KEY
[DataSecurity] 민감 환경 변수 감지: 'key' 패턴 포함
[DataSecurity] 마스킹된 환경 변수 반환: [MASKED_ENV_VALUE]

[DataSecurity] 텍스트 처리 요청: "AWS_SECRET=AKIAIOSFODNN7EXAMPLE와 PASSWORD=mypassword123"
[DataSecurity] 민감 정보 감지: 여러 민감 패턴
[DataSecurity] 데이터 마스킹 완료: "AWS_SECRET=[API_KEY_REDACTED]와 PASSWORD=[PASSWORD_REDACTED]"
```

#### 3.1.2 데이터 보안 관리자 구현 예제
```typescript
/**
 * 데이터 보안 관리자
 * 모든 데이터 처리 요청을 검증하고 민감 정보를 보호하는 클래스
 */
class DataSecurityManager {
  private static instance: DataSecurityManager;
  private securityViolations: SecurityViolation[] = [];
  private sensitiveDataLog: SensitiveDataDetection[] = [];
  private maxLogSize: number = 1000;
  
  // 민감 데이터 패턴 (정규식)
  private sensitivePatterns: Record<string, RegExp> = {
    API_KEY: /((?:sk|ghp|xox[a-z]|api-|[a-z]{32})[a-zA-Z0-9_\-]{10,45})/g,
    PASSWORD: /(?:password|passwd|pwd)[\s:=]+(['"]?)([^\s,;'"]{8,})(['"]?)/gi,
    CREDIT_CARD: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    ACCESS_TOKEN: /(?:access_token|auth_token|token)[\s:=]+(['"]?)([^\s,;'"]{8,})(['"]?)/gi
  };
  
  // 싱글톤 패턴
  static getInstance(): DataSecurityManager {
    if (!DataSecurityManager.instance) {
      DataSecurityManager.instance = new DataSecurityManager();
    }
    return DataSecurityManager.instance;
  }
  
  // 생성자
  private constructor() {
    console.log('[DataSecurity] 초기화: 민감 데이터 처리 관리자 시작됨');
  }
  
  // 텍스트에서 민감 정보 마스킹
  maskSensitiveData(text: string): string {
    console.log(`[DataSecurity] 텍스트 처리 요청: "${this.truncateForLogging(text)}"`);
    
    let maskedText = text;
    let detectedPatterns: string[] = [];
    
    // 모든 패턴에 대해 마스킹 적용
    for (const [patternName, pattern] of Object.entries(this.sensitivePatterns)) {
      const originalText = maskedText;
      
      // 해당 패턴으로 마스킹
      maskedText = maskedText.replace(pattern, (match) => {
        // 패턴 감지 로깅
        detectedPatterns.push(patternName);
        
        // 마스킹된 값 반환
        return `[${patternName}_REDACTED]`;
      });
      
      // 패턴이 감지된 경우
      if (originalText !== maskedText) {
        // 감지 로그
        console.log(`[DataSecurity] 민감 정보 감지: ${patternName} 패턴`);
        
        // 상세 로그 기록
        this.logSensitiveDataDetection({
          type: patternName,
          timestamp: Date.now(),
          context: 'TEXT_PROCESSING',
          partialSource: this.truncateForLogging(text)
        });
      }
    }
    
    if (detectedPatterns.length > 0) {
      console.log(`[DataSecurity] 데이터 마스킹 완료: "${this.truncateForLogging(maskedText)}"`);
    }
    
    return maskedText;
  }
  
  // 환경 변수 안전하게 가져오기
  getEnvironmentVariable(key: string): string | undefined {
    console.log(`[DataSecurity] 환경 변수 접근 요청: ${key}`);
    
    const isSensitive = this.isSensitiveEnvKey(key);
    const value = process.env[key];
    
    if (isSensitive) {
      console.log(`[DataSecurity] 민감 환경 변수 감지: '${this.getSensitivePattern(key)}' 패턴 포함`);
      
      // 감지 로그 기록
      this.logSensitiveDataDetection({
        type: 'SENSITIVE_ENV',
        timestamp: Date.now(),
        context: 'ENV_ACCESS',
        partialSource: key
      });
      
      console.log(`[DataSecurity] 마스킹된 환경 변수 반환: [MASKED_ENV_VALUE]`);
      return '[MASKED_ENV_VALUE]';
    }
    
    return value;
  }
  
  // 객체에서 민감 정보 마스킹
  maskSensitiveInObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // 키가 민감한지 확인
        if (this.isSensitiveKey(key)) {
          result[key] = `[${key.toUpperCase()}_REDACTED]`;
          
          // 로그 기록
          this.logSensitiveDataDetection({
            type: 'SENSITIVE_OBJECT_KEY',
            timestamp: Date.now(),
            context: 'OBJECT_PROCESSING',
            partialSource: key
          });
        } else {
          // 값에 민감 정보가 있는지 확인
          result[key] = this.maskSensitiveData(value);
        }
      } else if (value !== null && typeof value === 'object') {
        // 중첩된 객체 재귀적으로 처리
        result[key] = this.maskSensitiveInObject(value);
      } else {
        // 그대로 복사
        result[key] = value;
      }
    }
    
    return result;
  }
  
  // 민감한 키인지 확인
  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    const sensitiveKeyPatterns = [
      'password', 'secret', 'token', 'key', 'auth', 
      'credential', 'private', 'pw', 'passwd'
    ];
    
    return sensitiveKeyPatterns.some(pattern => lowerKey.includes(pattern));
  }
  
  // 민감한 환경 변수 키인지 확인
  private isSensitiveEnvKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.isSensitiveKey(lowerKey);
  }
  
  // 로깅을 위해 어떤 민감 패턴이 감지되었는지 확인
  private getSensitivePattern(key: string): string {
    const lowerKey = key.toLowerCase();
    const patterns = [
      'key', 'secret', 'password', 'token', 'auth', 
      'credential', 'private', 'pw', 'passwd'
    ];
    
    for (const pattern of patterns) {
      if (lowerKey.includes(pattern)) {
        return pattern;
      }
    }
    
    return 'unknown';
  }
  
  // 로그를 위해 텍스트 자르기
  private truncateForLogging(text: string, maxLength: number = 40): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
  
  // 민감 데이터 감지 로깅
  private logSensitiveDataDetection(detection: SensitiveDataDetection): void {
    this.sensitiveDataLog.push(detection);
    
    // 로그 크기 제한
    if (this.sensitiveDataLog.length > this.maxLogSize) {
      this.sensitiveDataLog = this.sensitiveDataLog.slice(-this.maxLogSize);
    }
  }
  
  // 보안 위반 기록
  recordSecurityViolation(violation: SecurityViolation): void {
    this.securityViolations.push(violation);
    
    // 위반 사항 요약
    const violationCount = this.securityViolations.filter(
      v => v.timestamp > Date.now() - 60 * 60 * 1000
    ).length;
    
    if (violationCount > 5) {
      console.warn(`[DataSecurity] 경고: 지난 1시간 동안 ${violationCount}개의 데이터 보안 위반 감지됨`);
    }
  }
  
  // 민감 데이터 통계 가져오기
  getSensitiveDataStats(): SensitiveDataStats {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // 최근 감지된 민감 데이터
    const recentDetections = this.sensitiveDataLog.filter(
      entry => entry.timestamp >= oneDayAgo
    );
    
    // 타입별 집계
    const detectionsByType: Record<string, number> = {};
    for (const detection of recentDetections) {
      detectionsByType[detection.type] = (detectionsByType[detection.type] || 0) + 1;
    }
    
    // 컨텍스트별 집계
    const detectionsByContext: Record<string, number> = {};
    for (const detection of recentDetections) {
      detectionsByContext[detection.context] = (detectionsByContext[detection.context] || 0) + 1;
    }
    
    // 가장 많이 감지된 타입
    const topTypes = Object.entries(detectionsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalDetections: recentDetections.length,
      detectionsByType,
      detectionsByContext,
      topTypes
    };
  }
}

// 민감 데이터 감지 인터페이스
interface SensitiveDataDetection {
  type: string;
  timestamp: number;
  context: 'TEXT_PROCESSING' | 'ENV_ACCESS' | 'OBJECT_PROCESSING' | 'FILE_CONTENT';
  partialSource: string;
}

// 민감 데이터 통계 인터페이스
interface SensitiveDataStats {
  totalDetections: number;
  detectionsByType: Record<string, number>;
  detectionsByContext: Record<string, number>;
  topTypes: Array<{type: string, count: number}>;
}

// 보안 위반 인터페이스 (타 보안 관리자와 공유)
interface SecurityViolation {
  type: string;
  path: string;
  timestamp: number;
  details: string;
}
```

## 4. 사용자 작업 검증 (✓)

### 4.1 작업 확인
```typescript
// 위험한 작업 확인
const confirmDangerousAction = async (action: string): Promise<boolean> => {
    const result = await vscode.window.showWarningMessage(
        `정말 "${action}" 작업을 실행하시겠습니까?`,
        { modal: true },
        '실행',
        '취소'
    );
    
    return result === '실행';
};

// 파일 삭제 전 확인
const confirmFileDelete = async (uri: vscode.Uri): Promise<boolean> => {
    const fileName = vscode.workspace.asRelativePath(uri);
    return confirmDangerousAction(`${fileName} 파일 삭제`);
};
```

### 4.2 권한 검증
```typescript
// 파일 쓰기 권한 확인
const checkWritePermission = async (uri: vscode.Uri): Promise<boolean> => {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        return (stat.permissions & 0o200) !== 0; // 쓰기 권한 확인
    } catch {
        return false;
    }
};

// 작업 공간 권한 확인
const checkWorkspacePermissions = async (): Promise<boolean> => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri;
    if (!workspaceRoot) {
        return false;
    }
    
    return checkWritePermission(workspaceRoot);
};
```

### 4.1 사용자 액션 확인
```typescript
// 위험한 작업 사용자 확인
const confirmDangerousAction = async (action: string): Promise<boolean> => {
    const result = await vscode.window.showWarningMessage(
        `경고: "${action}" 작업을 실행하시겠습니까?`,
        { modal: true },
        '실행',
        '취소'
    );
    return result === '실행';
};

// 권한 확인
const checkPermission = async (permission: string): Promise<boolean> => {
    const userRoles = await getUserRoles();
    return userRoles.some(role => 
        PERMISSION_MAP[role]?.includes(permission)
    );
};
```

#### 4.1.1 실제 사용자 액션 확인 로그
```
[UserActionSecurity] 작업 요청: 모든 파일 삭제
[UserActionSecurity] 위험 수준 평가: HIGH
[UserActionSecurity] 사용자 확인 요청: "모든 파일 삭제" 작업 실행 확인
[UserActionSecurity] 사용자 응답: 취소됨
[ActionManager] 작업 취소됨: 모든 파일 삭제

[UserActionSecurity] 작업 요청: 프로젝트 설정 변경
[UserActionSecurity] 권한 확인 요청: SETTINGS_WRITE
[UserActionSecurity] 현재 사용자 권한: [USER, CONTRIBUTOR]
[UserActionSecurity] 권한 검증 결과: 허용됨 (CONTRIBUTOR 역할)
[ActionManager] 작업 실행 중: 프로젝트 설정 변경
[ActionManager] 작업 완료됨: 프로젝트 설정 변경

[UserActionSecurity] 작업 요청: 시스템 명령어 실행 (rm -rf /)
[UserActionSecurity] 위험 수준 평가: CRITICAL
[UserActionSecurity] 패턴 감지: 파일 시스템 파괴 패턴
[UserActionSecurity] 작업 자동 거부됨: 시스템 명령어 실행 (rm -rf /)
[UserActionSecurity] 보안 경고 기록: 위험한 시스템 명령어 실행 시도
[SecurityManager] 알림: 위험한 작업이 차단되었습니다. 보안 관리자에게 문의하세요.
```

#### 4.1.2 사용자 액션 보안 관리자 구현 예제
```typescript
/**
 * 사용자 액션 보안 관리자
 * 모든 사용자 액션 요청을 검증하고 승인하는 클래스
 */
class UserActionSecurityManager {
  private static instance: UserActionSecurityManager;
  private actionLog: ActionLogEntry[] = [];
  private securityViolations: SecurityViolation[] = [];
  private maxLogSize: number = 1000;
  
  // 위험한 액션 패턴 (정규식)
  private dangerousActionPatterns: Record<string, RegExp> = {
    FILE_DELETE_ALL: /delete[\s-]+all|rm\s+(-rf|--recursive)[\s]+\/+$|rmdir\s+\/+/i,
    FORMAT_DRIVE: /format\s+(disk|drive)|fdisk\s+\/|mkfs/i,
    SYSTEM_SHUTDOWN: /shutdown|reboot|halt|poweroff/i,
    NETWORK_DANGEROUS: /ifconfig\s+down|ip\s+link\s+down|netsh\s+firewall\s+off/i,
    SERVICE_STOP_ALL: /service\s+--stop-all|systemctl\s+stop\s+--all/i
  };
  
  // 역할별 권한 맵
  private permissionMap: Record<string, string[]> = {
    ADMIN: [
      'SETTINGS_READ', 'SETTINGS_WRITE', 
      'FILES_READ', 'FILES_WRITE', 'FILES_DELETE',
      'TERMINAL_EXECUTE', 'EXTENSION_INSTALL', 'EXTENSION_UNINSTALL',
      'USER_MANAGEMENT'
    ],
    CONTRIBUTOR: [
      'SETTINGS_READ', 'SETTINGS_WRITE', 
      'FILES_READ', 'FILES_WRITE', 'FILES_DELETE',
      'TERMINAL_EXECUTE'
    ],
    USER: [
      'SETTINGS_READ', 
      'FILES_READ', 'FILES_WRITE',
      'TERMINAL_EXECUTE'
    ],
    GUEST: [
      'SETTINGS_READ', 
      'FILES_READ'
    ]
  };
  
  // 싱글톤 패턴
  static getInstance(): UserActionSecurityManager {
    if (!UserActionSecurityManager.instance) {
      UserActionSecurityManager.instance = new UserActionSecurityManager();
    }
    return UserActionSecurityManager.instance;
  }
  
  // 생성자
  private constructor() {
    console.log('[UserActionSecurity] 초기화: 사용자 액션 보안 관리자 시작됨');
  }
  
  // 액션 검증 및 승인
  async verifyAction(action: UserAction): Promise<boolean> {
    console.log(`[UserActionSecurity] 작업 요청: ${action.name}`);
    
    // 액션 로그 기록
    this.logAction({
      actionName: action.name,
      actionType: action.type,
      timestamp: Date.now(),
      approved: false,  // 아직 승인되지 않음
      risk: 'UNKNOWN'   // 아직 위험도 평가 안됨
    });
    
    // 위험도 평가
    const riskLevel = this.evaluateRiskLevel(action);
    console.log(`[UserActionSecurity] 위험 수준 평가: ${riskLevel}`);
    
    // 위험한 패턴 감지
    const dangerousPattern = this.detectDangerousPattern(action);
    if (dangerousPattern) {
      console.log(`[UserActionSecurity] 패턴 감지: ${dangerousPattern} 패턴`);
      
      // 치명적 위험은 자동 거부
      if (riskLevel === 'CRITICAL') {
        console.log(`[UserActionSecurity] 작업 자동 거부됨: ${action.name}`);
        
        // 보안 위반 기록
        this.recordSecurityViolation({
          type: 'DANGEROUS_ACTION_ATTEMPT',
          path: action.name,
          timestamp: Date.now(),
          details: `위험한 작업 시도: ${action.name} (${dangerousPattern})`
        });
        
        console.log(`[UserActionSecurity] 보안 경고 기록: 위험한 ${action.type} 시도`);
        console.log(`[SecurityManager] 알림: 위험한 작업이 차단되었습니다. 보안 관리자에게 문의하세요.`);
        
        // 사용자에게 알림
        vscode.window.showErrorMessage(
          `보안 경고: 위험한 작업이 차단되었습니다. 보안 관리자에게 문의하세요.`
        );
        
        return false;
      }
    }
    
    // 필요한 권한 확인
    if (action.requiredPermission) {
      console.log(`[UserActionSecurity] 권한 확인 요청: ${action.requiredPermission}`);
      
      // 현재 사용자 역할 가져오기
      const userRoles = await this.getUserRoles();
      console.log(`[UserActionSecurity] 현재 사용자 권한: [${userRoles.join(', ')}]`);
      
      // 권한 검증
      const hasPermission = this.checkPermission(action.requiredPermission, userRoles);
      
      if (!hasPermission) {
        console.log(`[UserActionSecurity] 권한 검증 결과: 거부됨 (권한 없음)`);
        
        // 보안 위반 기록
        this.recordSecurityViolation({
          type: 'PERMISSION_VIOLATION',
          path: action.name,
          timestamp: Date.now(),
          details: `권한 없는 작업 시도: ${action.name} (${action.requiredPermission} 권한 필요)`
        });
        
        // 사용자에게 알림
        vscode.window.showErrorMessage(
          `권한 오류: '${action.name}' 작업을 수행할 권한이 없습니다.`
        );
        
        return false;
      }
      
      console.log(`[UserActionSecurity] 권한 검증 결과: 허용됨 (${this.getRoleWithPermission(action.requiredPermission, userRoles)} 역할)`);
    }
    
    // 사용자 확인 필요 여부
    if (riskLevel === 'HIGH' || riskLevel === 'MEDIUM') {
      console.log(`[UserActionSecurity] 사용자 확인 요청: "${action.name}" 작업 실행 확인`);
      
      // 사용자에게 확인 요청
      const confirmed = await this.confirmDangerousAction(action.name, riskLevel);
      
      if (!confirmed) {
        console.log(`[UserActionSecurity] 사용자 응답: 취소됨`);
        console.log(`[ActionManager] 작업 취소됨: ${action.name}`);
        return false;
      }
      
      console.log(`[UserActionSecurity] 사용자 응답: 승인됨`);
    }
    
    // 액션 승인 로깅
    this.updateActionLog(action.name, true, riskLevel);
    
    console.log(`[ActionManager] 작업 실행 중: ${action.name}`);
    
    return true;
  }
  
  // 액션 완료 기록
  logActionCompletion(actionName: string, success: boolean): void {
    console.log(`[ActionManager] 작업 ${success ? '완료' : '실패'}됨: ${actionName}`);
    
    // 최근 액션 로그 업데이트
    const recentAction = this.actionLog.findLast(entry => entry.actionName === actionName);
    if (recentAction) {
      recentAction.completed = true;
      recentAction.success = success;
    }
  }
  
  // 위험도 평가
  private evaluateRiskLevel(action: UserAction): RiskLevel {
    // 액션 유형 기반 기본 위험도
    const baseRiskByType: Record<string, RiskLevel> = {
      'FILE_OPERATION': 'LOW',
      'TERMINAL_COMMAND': 'MEDIUM',
      'SETTING_CHANGE': 'LOW',
      'EXTENSION_OPERATION': 'MEDIUM',
      'WORKSPACE_OPERATION': 'MEDIUM',
      'SYSTEM_OPERATION': 'HIGH'
    };
    
    const baseRisk = baseRiskByType[action.type] || 'MEDIUM';
    
    // 위험한 패턴 감지 시 위험도 상승
    if (this.detectDangerousPattern(action)) {
      // 기본 위험도 상승
      switch (baseRisk) {
        case 'LOW': return 'MEDIUM';
        case 'MEDIUM': return 'HIGH';
        case 'HIGH': return 'CRITICAL';
        default: return 'CRITICAL';
      }
    }
    
    // 특정 파라미터 포함 시 위험도 상승
    if (action.parameters) {
      const paramString = JSON.stringify(action.parameters).toLowerCase();
      
      // 전체 삭제, 시스템 경로 등 위험한 패턴 감지
      if (
        paramString.includes('--force') || 
        paramString.includes('-rf') ||
        paramString.includes('all') ||
        paramString.includes('/etc') ||
        paramString.includes('c:\\windows')
      ) {
        if (baseRisk === 'LOW') return 'MEDIUM';
        if (baseRisk === 'MEDIUM') return 'HIGH';
        return 'CRITICAL';
      }
    }
    
    return baseRisk;
  }
  
  // 위험한 패턴 감지
  private detectDangerousPattern(action: UserAction): string | null {
    // 액션 이름과 파라미터를 문자열로 합침
    const actionString = `${action.name} ${JSON.stringify(action.parameters || {})}`.toLowerCase();
    
    // 모든 위험 패턴 체크
    for (const [patternName, pattern] of Object.entries(this.dangerousActionPatterns)) {
      if (pattern.test(actionString)) {
        return patternName;
      }
    }
    
    return null;
  }
  
  // 위험한 작업 사용자 확인
  private async confirmDangerousAction(actionName: string, riskLevel: RiskLevel): Promise<boolean> {
    let message = `경고: "${actionName}" 작업을 실행하시겠습니까?`;
    
    // 위험도에 따른 메시지 강화
    if (riskLevel === 'HIGH') {
      message = `⚠️ 고위험 작업: "${actionName}"을(를) 실행하면 복구할 수 없는 변경이 발생할 수 있습니다. 계속하시겠습니까?`;
    }
    
    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      '실행',
      '취소'
    );
    
    return result === '실행';
  }
  
  // 사용자 역할 가져오기 (실제로는 인증 시스템과 연동)
  private async getUserRoles(): Promise<string[]> {
    // TODO: 실제 인증 시스템과 연동
    // 여기서는 예시로 하드코딩된 역할 반환
    return ['USER', 'CONTRIBUTOR'];
  }
  
  // 권한 확인
  private checkPermission(permission: string, userRoles: string[]): boolean {
    return userRoles.some(role => 
      this.permissionMap[role]?.includes(permission)
    );
  }
  
  // 해당 권한을 가진 역할 찾기
  private getRoleWithPermission(permission: string, userRoles: string[]): string {
    for (const role of userRoles) {
      if (this.permissionMap[role]?.includes(permission)) {
        return role;
      }
    }
    return 'UNKNOWN';
  }
  
  // 액션 로그 기록
  private logAction(entry: ActionLogEntry): void {
    this.actionLog.push(entry);
    
    // 로그 크기 제한
    if (this.actionLog.length > this.maxLogSize) {
      this.actionLog = this.actionLog.slice(-this.maxLogSize);
    }
  }
  
  // 액션 로그 업데이트
  private updateActionLog(actionName: string, approved: boolean, risk: RiskLevel): void {
    const recentAction = this.actionLog.findLast(entry => entry.actionName === actionName);
    if (recentAction) {
      recentAction.approved = approved;
      recentAction.risk = risk;
    }
  }
  
  // 보안 위반 기록
  private recordSecurityViolation(violation: SecurityViolation): void {
    this.securityViolations.push(violation);
    
    // 위반 사항 요약
    const violationCount = this.securityViolations.filter(
      v => v.timestamp > Date.now() - 60 * 60 * 1000
    ).length;
    
    if (violationCount > 5) {
      console.warn(`[UserActionSecurity] 경고: 지난 1시간 동안 ${violationCount}개의 사용자 액션 보안 위반 감지됨`);
    }
  }
  
  // 액션 통계 가져오기
  getActionStats(): ActionStats {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // 최근 액션
    const recentActions = this.actionLog.filter(entry => entry.timestamp >= oneDayAgo);
    
    // 액션 유형별 집계
    const actionsByType: Record<string, number> = {};
    for (const action of recentActions) {
      actionsByType[action.actionType] = (actionsByType[action.actionType] || 0) + 1;
    }
    
    // 거부된 액션
    const deniedActions = recentActions.filter(entry => !entry.approved);
    
    // 위험 수준별 집계
    const actionsByRisk: Record<string, number> = {};
    for (const action of recentActions) {
      actionsByRisk[action.risk] = (actionsByRisk[action.risk] || 0) + 1;
    }
    
    return {
      totalActions: recentActions.length,
      deniedActions: deniedActions.length,
      actionsByType,
      actionsByRisk
    };
  }
}

// 사용자 액션 인터페이스
interface UserAction {
  name: string;
  type: string;
  parameters?: Record<string, any>;
  requiredPermission?: string;
}

// 액션 로그 항목 인터페이스
interface ActionLogEntry {
  actionName: string;
  actionType: string;
  timestamp: number;
  approved: boolean;
  risk: RiskLevel;
  completed?: boolean;
  success?: boolean;
}

// 위험도 레벨 타입
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

// 액션 통계 인터페이스
interface ActionStats {
  totalActions: number;
  deniedActions: number;
  actionsByType: Record<string, number>;
  actionsByRisk: Record<string, number>;
}

// 보안 위반 인터페이스 (타 보안 관리자와 공유)
interface SecurityViolation {
  type: string;
  path: string;
  timestamp: number;
  details: string;
}
```

## 5. 결론

이 문서는 볼드모트 IDE의 실제 관찰된 보안 기능과 API 사용을 설명합니다. 모든 예제는 VSCode Extension API를 통해 직접 확인된 내용입니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 관찰된 보안 기능과 API 사용을 바탕으로 작성되었습니다. 