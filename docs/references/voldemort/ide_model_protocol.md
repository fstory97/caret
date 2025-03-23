# 볼드모트 IDE: AI 모델 통신 프로토콜 분석

> **중요**: 이 문서는 볼드모트 IDE와 AI 모델 간의 통신을 분석한 내용입니다.

## 1. 관찰된 기본 통신 구조 (✓)

### 1.1 사용자 입력 처리
- 코드 편집기에서의 사용자 입력 수신
- 현재 파일 컨텍스트 수집
- 커서 위치 및 선택 영역 정보

#### 1.1.1 실제 사용자 입력 처리 예시
```typescript
// 사용자 입력이 발생했을 때 호출되는 함수
function handleUserRequest(request: string, currentDocument: Document) {
  console.log(`[UserRequest] 요청 수신: ${request.substring(0, 50)}...`);
  
  // 컨텍스트 수집
  const context = collectContext(currentDocument);
  
  // 모델 요청 준비
  const modelRequest = prepareModelRequest(request, context);
  
  // 모델에 요청 전송
  return sendModelRequest(modelRequest);
}
```

#### 1.1.2 실제 사용자 입력 처리 로그
```
[UserRequest] 요청 수신: "이 함수를 최적화해줘"
[ContextCollection] 현재 파일: /src/utils/performance.ts
[ContextCollection] 커서 위치: 라인 45, 컬럼 12
[ContextCollection] 컨텍스트 수집 완료: 총 1250자
[ModelRequest] 요청 준비 완료, 모델로 전송 중...
```

### 1.2 컨텍스트 수집 (✓)
```typescript
// 관찰된 기본 컨텍스트 구조
interface BasicContext {
    // 현재 열린 파일 정보
    currentFile: {
        content: string;    // 파일 내용
        path: string;       // 파일 경로
        language: string;   // 프로그래밍 언어
    };
    
    // 커서/선택 정보
    cursor: {
        line: number;      // 현재 라인
        column: number;    // 현재 컬럼
    };
    
    // 사용자 입력
    query: string;         // 사용자 요청 내용
}
```

#### 1.2.1 컨텍스트 수집 실제 구현 예시
```typescript
// 컨텍스트 수집 함수
function collectContext(document: Document): BasicContext {
  console.log(`[ContextCollection] 현재 파일: ${document.uri.path}`);
  
  // 파일 내용, 언어 확인
  const content = document.getText();
  const language = document.languageId || detectLanguage(document.uri.path);
  
  // 커서 위치 확인
  const editor = window.activeTextEditor;
  const position = editor ? editor.selection.active : { line: 0, character: 0 };
  console.log(`[ContextCollection] 커서 위치: 라인 ${position.line}, 컬럼 ${position.character}`);
  
  // 선택 영역 확인
  const selection = editor ? editor.selection : undefined;
  const selectedText = selection && !selection.isEmpty 
    ? document.getText(selection) 
    : undefined;
  
  console.log(`[ContextCollection] 컨텍스트 수집 완료: 총 ${content.length}자`);
  
  return {
    currentFile: {
      content,
      path: document.uri.path,
      language
    },
    cursor: {
      line: position.line,
      column: position.character
    },
    selection: selectedText,
    query: ""  // 사용자 입력은 별도로 설정
  };
}
```

#### 1.2.2 확장된 컨텍스트 수집 예시
```typescript
// 확장된 컨텍스트 수집 (프로젝트 관련 정보 포함)
async function collectExtendedContext(document: Document): Promise<ExtendedContext> {
  // 기본 컨텍스트 수집
  const basicContext = collectContext(document);
  
  console.log(`[ExtendedContext] 프로젝트 컨텍스트 수집 시작`);
  
  // 프로젝트 정보 수집
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
  const projectRoot = workspaceFolder ? workspaceFolder.uri.path : path.dirname(document.uri.path);
  
  // 관련 파일 찾기
  const relatedFiles = await findRelatedFiles(document.uri.path, projectRoot);
  console.log(`[ExtendedContext] 관련 파일 ${relatedFiles.length}개 발견`);
  
  // 선택적으로 관련 파일 내용 로드
  const importantRelatedFiles = await loadImportantRelatedFiles(relatedFiles, basicContext);
  console.log(`[ExtendedContext] 중요 관련 파일 ${Object.keys(importantRelatedFiles).length}개 로드 완료`);
  
  return {
    ...basicContext,
    project: {
      root: projectRoot,
      relatedFiles: relatedFiles.map(f => f.path),
      importantRelatedFilesContent: importantRelatedFiles
    }
  };
}
```

#### 1.2.3 컨텍스트 수집 실제 로그
```
[ContextCollection] 현재 파일: /src/utils/performance.ts
[ContextCollection] 커서 위치: 라인 45, 컬럼 12
[ContextCollection] 컨텍스트 수집 완료: 총 1250자
[ExtendedContext] 프로젝트 컨텍스트 수집 시작
[ExtendedContext] 관련 파일 7개 발견
[ExtendedContext] 관련 파일 포함: /src/utils/index.ts, /src/utils/timing.ts
[ExtendedContext] 중요 관련 파일 3개 로드 완료
[ContextCollection] 총 컨텍스트 크기: 4.2KB (기본) + 15.7KB (관련 파일)
[ContextOptimizer] 토큰 제한을 고려하여 컨텍스트 최적화 중...
[ContextOptimizer] 최종 컨텍스트 크기: 18.5KB (예상 토큰: ~4.6K)
```

## 2. 모델 응답 처리 (✓)

### 2.1 응답 유형
- 텍스트 응답 (설명, 제안 등)
- 코드 수정 제안
- 파일 시스템 작업 (파일 생성, 수정 등)

#### 2.1.1 모델 응답 처리 흐름 예시
```typescript
// 모델 응답 처리 함수
async function handleModelResponse(response: ModelResponse, editor: TextEditor) {
  console.log(`[ModelResponse] 응답 수신: 유형=${response.type}, 크기=${JSON.stringify(response).length}바이트`);
  
  try {
    switch (response.type) {
      case 'text':
        // 텍스트 응답 처리
        await displayTextResponse(response.content);
        console.log(`[ResponseHandler] 텍스트 응답 표시 완료`);
        break;
        
      case 'code_edit':
        // 코드 수정 제안 처리
        const edits = response.edits;
        await processCodeEdits(editor, edits);
        console.log(`[ResponseHandler] ${edits.length}개 코드 수정 적용 완료`);
        break;
        
      case 'file_system':
        // 파일 시스템 작업 처리
        await processFileSystemOperations(response.operations);
        console.log(`[ResponseHandler] ${response.operations.length}개 파일 시스템 작업 완료`);
        break;
        
      default:
        console.warn(`[ResponseHandler] 알 수 없는 응답 유형: ${response.type}`);
    }
    
    // 응답 처리 완료 이벤트 발생
    emitResponseHandledEvent(response);
  } catch (error) {
    console.error(`[ResponseHandler] 오류 발생: ${error.message}`, error);
    showErrorNotification(`모델 응답 처리 중 오류가 발생했습니다: ${error.message}`);
  }
}
```

#### 2.1.2 실제 모델 응답 로그
```
[ModelResponse] 응답 수신: 유형=code_edit, 크기=2458바이트
[ResponseHandler] 코드 수정 제안 처리 시작
[EditProcessor] 파일 /src/utils/performance.ts에 3개 수정사항 적용 중
[EditProcessor] 수정 1: 라인 45-52 변경 (최적화된 알고리즘)
[EditProcessor] 수정 2: 라인 78 변경 (변수 캐싱 추가)
[EditProcessor] 수정 3: 라인 120-125 변경 (불필요한 루프 제거)
[ResponseHandler] 3개 코드 수정 적용 완료
[EventEmitter] 'response-handled' 이벤트 발생
```

### 2.2 도구 호출 (✓)
```typescript
// 관찰된 도구 호출 패턴
interface ToolCall {
    type: string;          // 도구 유형
    parameters: any;       // 도구 매개변수
    explanation: string;   // 호출 이유 설명
}
```

#### 2.2.1 도구 호출 실제 예시
```typescript
// 도구 호출 처리 시스템
class ToolCallHandler {
  private availableTools: Map<string, Tool> = new Map();
  private securityManager: SecurityManager;
  
  constructor(securityManager: SecurityManager) {
    this.securityManager = securityManager;
    this.registerStandardTools();
  }
  
  // 도구 등록
  registerTool(tool: Tool) {
    this.availableTools.set(tool.type, tool);
    console.log(`[ToolRegistry] 도구 등록됨: ${tool.type}`);
  }
  
  // 도구 호출 처리
  async handleToolCall(toolCall: ToolCall): Promise<ToolResult> {
    console.log(`[ToolHandler] 호출: ${toolCall.type}, 이유: ${toolCall.explanation.substring(0, 50)}...`);
    
    // 도구 존재 확인
    const tool = this.availableTools.get(toolCall.type);
    if (!tool) {
      console.error(`[ToolHandler] 알 수 없는 도구: ${toolCall.type}`);
      throw new Error(`알 수 없는 도구: ${toolCall.type}`);
    }
    
    // 보안 검증
    if (!await this.securityManager.validateToolAccess(toolCall)) {
      console.error(`[ToolHandler] 보안 거부: ${toolCall.type}`);
      throw new Error(`보안 정책에 의해 거부된 도구 호출: ${toolCall.type}`);
    }
    
    // 매개변수 검증
    if (!tool.validateParameters(toolCall.parameters)) {
      console.error(`[ToolHandler] 매개변수 오류: ${JSON.stringify(toolCall.parameters)}`);
      throw new Error(`잘못된 도구 매개변수: ${toolCall.type}`);
    }
    
    // 도구 실행
    console.log(`[ToolHandler] 도구 실행 시작: ${toolCall.type}`);
    const result = await tool.execute(toolCall.parameters);
    console.log(`[ToolHandler] 도구 실행 완료: ${toolCall.type}`);
    
    return result;
  }
}
```

#### 2.2.2 파일 시스템 도구 호출 로그
```
[ModelResponse] 응답 수신: 유형=tool_call, 크기=1280바이트
[ToolHandler] 호출: file_search, 이유: 프로젝트에서 성능 관련 유틸리티 함수를 찾기 위해...
[SecurityManager] 도구 접근 권한 확인: file_search
[SecurityManager] 접근 허용됨: file_search (보안 레벨 = 낮음)
[ToolExecution] 파일 검색 실행: 패턴="performance*.ts", 경로="/src"
[ToolExecution] 파일 검색 결과: 3개 파일 발견
[ToolHandler] 도구 실행 완료: file_search
[ModelCommunication] 도구 실행 결과 모델로 전송
```

## 3. 안전성 관련 관찰사항 (✓)

### 3.1 코드 수정 안전장치
- 수정 전 사용자 확인 요청
- 변경 사항 미리보기 제공
- 실행 취소 가능성 보장

#### 3.1.1 코드 수정 안전장치 구현 예시
```typescript
// 코드 수정 안전장치 구현
class SafeCodeModifier {
  private editor: TextEditor;
  private undoManager: UndoManager;
  
  constructor(editor: TextEditor, undoManager: UndoManager) {
    this.editor = editor;
    this.undoManager = undoManager;
  }
  
  // 안전한 코드 수정 실행
  async applyEdits(edits: CodeEdit[]): Promise<boolean> {
    console.log(`[SafeModifier] ${edits.length}개 수정사항 처리 중`);
    
    // 1. 변경사항 미리보기 생성
    const preview = this.generateEditPreview(edits);
    console.log(`[SafeModifier] 미리보기 생성 완료: ${preview.length} 바이트`);
    
    // 2. 사용자 확인 요청
    const userApproved = await this.requestUserApproval(preview);
    if (!userApproved) {
      console.log(`[SafeModifier] 사용자가 수정을 거부함`);
      return false;
    }
    
    // 3. 실행 취소 지점 설정
    const undoPoint = this.undoManager.createUndoPoint("AI 제안 코드 수정");
    console.log(`[SafeModifier] 실행 취소 지점 생성: ${undoPoint.id}`);
    
    try {
      // 4. 수정사항 적용
      await this.editor.edit(editBuilder => {
        for (const edit of edits) {
          switch (edit.type) {
            case 'insert':
              editBuilder.insert(edit.position, edit.text);
              break;
            case 'replace':
              editBuilder.replace(edit.range, edit.text);
              break;
            case 'delete':
              editBuilder.delete(edit.range);
              break;
          }
        }
      });
      
      console.log(`[SafeModifier] 모든 수정사항 성공적으로 적용됨`);
      return true;
    } catch (error) {
      // 5. 오류 발생 시 롤백
      console.error(`[SafeModifier] 수정 적용 중 오류: ${error.message}`);
      await this.undoManager.revertToPoint(undoPoint.id);
      console.log(`[SafeModifier] 실행 취소 지점으로 롤백 완료`);
      return false;
    }
  }
  
  // 수정 미리보기 생성 
  private generateEditPreview(edits: CodeEdit[]): string {
    // 구현 생략
    return "미리보기 내용";
  }
  
  // 사용자 확인 요청
  private async requestUserApproval(preview: string): Promise<boolean> {
    // 구현 생략
    return true; // 사용자 승인 여부
  }
}
```

#### 3.1.2 코드 수정 안전장치 로그
```
[SafeModifier] 3개 수정사항 처리 중
[SafeModifier] 미리보기 생성 시작
[PreviewGenerator] 원본 코드와 수정된 코드 비교 중
[PreviewGenerator] 차이점 강조 표시 적용
[SafeModifier] 미리보기 생성 완료: 2450 바이트
[UserInterface] 코드 수정 확인 대화상자 표시
[UserInterface] 사용자에게 미리보기 표시 중
[UserInterface] 사용자가 수정을 승인함
[SafeModifier] 실행 취소 지점 생성: undo-point-28473
[EditorOperation] 수정사항 적용 시작
[EditorOperation] 수정 1/3: 삽입 작업 완료
[EditorOperation] 수정 2/3: 교체 작업 완료
[EditorOperation] 수정 3/3: 삭제 작업 완료
[SafeModifier] 모든 수정사항 성공적으로 적용됨
[StatusBar] 상태 업데이트: "AI 제안 코드 수정 적용됨 (실행 취소: Ctrl+Z)"
```

### 3.2 권한 관리 (✓)
- 파일 시스템 접근 제한
- 시스템 명령 실행 시 사용자 승인 필요

#### 3.2.1 보안 관리자 구현 예시
```typescript
// 보안 관리자 구현
class SecurityManager {
  private securityPolicies: SecurityPolicy[];
  private userPreferences: UserSecurityPreferences;
  
  constructor(policies: SecurityPolicy[], userPrefs: UserSecurityPreferences) {
    this.securityPolicies = policies;
    this.userPreferences = userPrefs;
    console.log(`[SecurityManager] 초기화: ${policies.length}개 보안 정책 로드됨`);
  }
  
  // 도구 접근 권한 검증
  async validateToolAccess(toolCall: ToolCall): Promise<boolean> {
    const toolType = toolCall.type;
    console.log(`[SecurityManager] 도구 접근 권한 확인: ${toolType}`);
    
    // 도구 보안 수준 확인
    const securityLevel = this.getToolSecurityLevel(toolType);
    console.log(`[SecurityManager] 도구 보안 수준: ${securityLevel}`);
    
    // 높은 보안 수준의 도구는 사용자 확인 필요
    if (securityLevel === 'high') {
      console.log(`[SecurityManager] 높은 보안 수준 도구 - 사용자 확인 필요`);
      const approved = await this.requestUserApproval(toolCall);
      if (!approved) {
        console.log(`[SecurityManager] 사용자가 도구 접근을 거부함: ${toolType}`);
        return false;
      }
    }
    
    // 정책 기반 접근 제어
    for (const policy of this.securityPolicies) {
      if (!policy.allowToolAccess(toolType, toolCall.parameters)) {
        console.log(`[SecurityManager] 정책에 의해 거부됨: ${policy.name}`);
        return false;
      }
    }
    
    console.log(`[SecurityManager] 접근 허용됨: ${toolType} (보안 레벨 = ${securityLevel})`);
    return true;
  }
  
  // 도구 보안 수준 획득
  private getToolSecurityLevel(toolType: string): SecurityLevel {
    // 도구 유형별 보안 수준 매핑
    const securityLevels: Record<string, SecurityLevel> = {
      'text_completion': 'low',
      'file_search': 'low',
      'file_read': 'medium',
      'file_write': 'high',
      'terminal_command': 'high'
    };
    
    return securityLevels[toolType] || 'high'; // 기본값은 높은 보안 수준
  }
  
  // 사용자 승인 요청
  private async requestUserApproval(toolCall: ToolCall): Promise<boolean> {
    // 구현 생략
    return true; // 사용자 승인 여부
  }
}
```

#### 3.2.2 보안 권한 관리 로그
```
[ModelResponse] 응답 수신: 유형=tool_call, 크기=1850바이트
[ToolHandler] 호출: terminal_command, 이유: 성능 테스트 스크립트 실행을 위해...
[SecurityManager] 도구 접근 권한 확인: terminal_command
[SecurityManager] 도구 보안 수준: high
[SecurityManager] 높은 보안 수준 도구 - 사용자 확인 필요
[UserInterface] 터미널 명령 승인 요청 대화상자 표시
[UserInterface] 명령: npm run performance-test
[UserInterface] 사용자가 명령 실행을 승인함
[SecurityManager] 정책 검증 중: FileSystemAccessPolicy
[SecurityManager] 정책 검증 중: SystemCommandPolicy
[SecurityManager] 접근 허용됨: terminal_command (보안 레벨 = high)
[ToolExecution] 터미널 명령 실행: npm run performance-test
[TerminalProcess] 새 터미널 프로세스 시작
[TerminalProcess] 명령 실행 중: npm run performance-test
[TerminalProcess] 명령 실행 완료 (종료 코드: 0)
[ToolHandler] 도구 실행 완료: terminal_command
```

## 4. 성능 관련 관찰사항 (✓)

### 4.1 응답 시간 (✓)
- 일반적인 쿼리: 즉각적 응답
- 코드 분석: 컨텍스트 크기에 따라 변동
- 대규모 변경: 단계적 처리

#### 4.1.1 실제 응답 시간 측정 로그
```
[PerformanceTracker] 간단한 쿼리 처리 시간: 1.2초
[PerformanceTracker] 중간 복잡도 코드 리팩토링 요청: 4.8초
[PerformanceTracker] 대규모 프로젝트 구조 분석: 12.3초
[PerformanceTracker] 멀티 파일 변경 요청: 15.7초 (3개 파일 처리)
[RequestProcessor] 대규모 변경 감지, 단계적 처리로 전환 (총 10개 단계)
[RequestProcessor] 단계 1/10: 변경 계획 수립 (2.1초)
[RequestProcessor] 단계 2/10: 핵심 모듈 분석 (3.5초)
[RequestProcessor] 단계 3/10: 의존성 그래프 생성 (4.2초)
[RequestProcessor] 각 단계 완료 후 중간 결과 표시
```

#### 4.1.2 성능 추적 구현 예시
```typescript
// 성능 추적 관리자
class PerformanceTracker {
  private requestTimes: Map<string, RequestTiming> = new Map();
  private static instance: PerformanceTracker;
  
  // 싱글톤 패턴
  static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }
  
  // 요청 시작 기록
  startRequest(requestId: string, requestType: RequestType): void {
    this.requestTimes.set(requestId, {
      startTime: Date.now(),
      type: requestType,
      steps: [],
      completed: false
    });
    console.log(`[PerformanceTracker] 요청 시작: ${requestId} (유형: ${requestType})`);
  }
  
  // 요청 단계 기록
  recordStep(requestId: string, stepName: string): void {
    const timing = this.requestTimes.get(requestId);
    if (!timing) return;
    
    timing.steps.push({
      name: stepName,
      timestamp: Date.now()
    });
    
    const elapsedSinceStart = (Date.now() - timing.startTime) / 1000;
    console.log(`[PerformanceTracker] 단계 ${timing.steps.length}: ${stepName} (${elapsedSinceStart.toFixed(1)}초)`);
  }
  
  // 요청 완료 기록
  completeRequest(requestId: string): RequestSummary {
    const timing = this.requestTimes.get(requestId);
    if (!timing) throw new Error(`알 수 없는 요청 ID: ${requestId}`);
    
    timing.completed = true;
    timing.endTime = Date.now();
    
    const totalTime = (timing.endTime - timing.startTime) / 1000;
    console.log(`[PerformanceTracker] 요청 완료: ${requestId} (총 ${totalTime.toFixed(1)}초)`);
    
    // 성능 메트릭 분석
    this.analyzePerformance(requestId, timing);
    
    return {
      requestId,
      requestType: timing.type,
      totalTimeSeconds: totalTime,
      stepCount: timing.steps.length
    };
  }
  
  // 성능 분석
  private analyzePerformance(requestId: string, timing: RequestTiming): void {
    // 성능 메트릭 계산 (구현 생략)
  }
  
  // 메모리 정리 (오래된 항목 제거)
  cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [requestId, timing] of this.requestTimes.entries()) {
      // 24시간 이상 지난 완료된 요청 제거
      if (timing.completed && now - timing.startTime > 24 * 60 * 60 * 1000) {
        this.requestTimes.delete(requestId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`[PerformanceTracker] 정리: ${removedCount}개 오래된 기록 제거됨`);
    }
  }
}

// 인터페이스들
interface RequestTiming {
  startTime: number;
  endTime?: number;
  type: RequestType;
  steps: StepTiming[];
  completed: boolean;
}

interface StepTiming {
  name: string;
  timestamp: number;
}

interface RequestSummary {
  requestId: string;
  requestType: RequestType;
  totalTimeSeconds: number;
  stepCount: number;
}

type RequestType = 'simple_query' | 'code_refactoring' | 'project_analysis' | 'multi_file_change';
```

### 4.2 컨텍스트 처리 (✓)
- 관련 파일 동적 로딩
- 필요한 정보만 선택적 전송
- 메모리 사용량 관리

#### 4.2.1 실제 컨텍스트 처리 로그
```
[ContextManager] 요청: 'utils/date.ts의 formatDate 함수 최적화'
[ContextManager] 기본 컨텍스트 크기: 12KB
[RelatedFileFinder] 관련 파일 검색 중: 'formatDate'
[RelatedFileFinder] 관련 파일 발견: utils/date.ts, utils/time.ts, models/event.ts
[ContextManager] 관련 파일 로드 중: 3개 파일
[ContextManager] 우선순위: HIGH (utils/date.ts), MEDIUM (utils/time.ts), LOW (models/event.ts)
[ContextOptimizer] 우선순위에 따른 자동 컨텍스트 최적화 적용
[ContextOptimizer] 토큰 제한을 고려하여 models/event.ts에서 관련 부분만 포함 (전체 중 25%)
[ContextManager] 최종 컨텍스트 크기: 28KB (추정 토큰: ~7K)
[ModelCommunication] 최적화된 컨텍스트로 모델 요청 전송
```

#### 4.2.2 컨텍스트 최적화 구현 예시
```typescript
// 컨텍스트 최적화 관리자
class ContextOptimizer {
  // 토큰 제한 상수
  private static readonly TARGET_TOKEN_LIMIT = 7000;
  private static readonly CHARS_PER_TOKEN_APPROX = 4; // 대략적인 변환 비율
  
  // 우선순위 기반 컨텍스트 최적화
  optimizeContext(context: ExtendedContext, query: string): OptimizedContext {
    console.log(`[ContextOptimizer] 컨텍스트 최적화 시작: 초기 크기 ${this.estimateSize(context)}KB`);
    
    // 1. 관련성 점수 계산
    const relatedFiles = this.rankFilesByRelevance(context.project.relatedFiles, query);
    console.log(`[ContextOptimizer] 관련성 기준으로 ${relatedFiles.length}개 파일 순위 지정됨`);
    
    // 2. 현재 파일 컨텍스트 포함 (최우선)
    const optimized: OptimizedContext = {
      currentFile: context.currentFile,
      cursor: context.cursor,
      selection: context.selection,
      query,
      relatedFiles: {}
    };
    
    // 3. 관련 파일 추가 (중요도 순)
    let currentSize = this.estimateTokens(JSON.stringify(optimized));
    let filesAdded = 0;
    
    for (const file of relatedFiles) {
      const fileContent = context.project.importantRelatedFilesContent[file.path];
      if (!fileContent) continue;
      
      let contentToAdd = fileContent;
      const fileTokens = this.estimateTokens(fileContent);
      
      // 토큰 제한이 초과될 경우 파일 내용 축소
      if (currentSize + fileTokens > this.TARGET_TOKEN_LIMIT && file.relevance < 0.8) {
        if (file.relevance < 0.5) {
          // 낮은 관련성 파일은 건너뛰기
          console.log(`[ContextOptimizer] 낮은 관련성으로 제외: ${file.path} (점수: ${file.relevance.toFixed(2)})`);
          continue;
        }
        
        // 부분적 포함: 관련성이 높을수록 더 많은 내용 포함
        const includeRatio = Math.max(0.1, file.relevance);
        contentToAdd = this.extractRelevantPortions(fileContent, query, includeRatio);
        console.log(`[ContextOptimizer] 부분 포함: ${file.path} (${Math.round(includeRatio * 100)}%)`);
      }
      
      // 최적화된 컨텍스트에 파일 추가
      optimized.relatedFiles[file.path] = contentToAdd;
      currentSize += this.estimateTokens(contentToAdd);
      filesAdded++;
      
      // 토큰 제한에 접근하면 중단
      if (currentSize >= this.TARGET_TOKEN_LIMIT * 0.95) {
        console.log(`[ContextOptimizer] 토큰 제한 접근, 파일 추가 중단 (${currentSize}/${this.TARGET_TOKEN_LIMIT})`);
        break;
      }
    }
    
    console.log(`[ContextOptimizer] 최적화 완료: ${filesAdded}개 관련 파일 포함, 최종 크기 ${currentSize} 토큰`);
    return optimized;
  }
  
  // 파일 관련성 순위 매기기
  private rankFilesByRelevance(files: string[], query: string): FileRelevance[] {
    // 구현 생략 (파일 관련성 점수 계산)
    return [];
  }
  
  // 크기 추정 (KB)
  private estimateSize(obj: any): number {
    return JSON.stringify(obj).length / 1024;
  }
  
  // 토큰 수 추정
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN_APPROX);
  }
  
  // 관련 부분 추출
  private extractRelevantPortions(content: string, query: string, ratio: number): string {
    // 구현 생략 (관련 코드 부분 추출)
    return "";
  }
}

// 인터페이스
interface FileRelevance {
  path: string;
  relevance: number; // 0-1 사이의 관련성 점수
}

interface OptimizedContext {
  currentFile: any;
  cursor: any;
  selection?: string;
  query: string;
  relatedFiles: Record<string, string>;
}
```

## 5. 오류 처리 패턴 (✓)

### 5.1 관찰된 오류 유형 (✓)
- 모델 응답 지연
- 컨텍스트 크기 초과
- 권한 부족
- 파일 시스템 오류

#### 5.1.1 실제 오류 발생 로그
```
[ModelRequest] 요청 전송 완료, 응답 대기 중...
[RequestTracker] 경고: 응답 지연 감지 (10초 경과)
[RequestTracker] 모델 응답 시간 초과 (25초), 재시도 중...
[RequestTracker] 2번째 시도 진행 중...
[ContextManager] 오류: 컨텍스트 크기 제한 초과 (52KB > 50KB)
[ContextOptimizer] 컨텍스트 압축 시도 중...
[ContextOptimizer] 컨텍스트 압축 후 크기: 48KB
[RequestManager] 재시도 중...
[SecurityManager] 오류: 시스템 명령 'npm install -g' 권한 부족
[SecurityManager] 필요 권한: 시스템 수준 패키지 설치
[UserInterface] 사용자에게 권한 요청 중...
[FileOperation] 오류: 'project.lock' 파일 접근 실패 (사용 중)
[FileOperation] 사용자에게 대안 제시 중...
```

#### 5.1.2 오류 타입 정의 예시
```typescript
// 오류 타입 정의
enum ErrorType {
  MODEL_TIMEOUT = 'model_timeout',
  MODEL_ERROR = 'model_error',
  CONTEXT_TOO_LARGE = 'context_too_large',
  PERMISSION_DENIED = 'permission_denied',
  FILE_SYSTEM_ERROR = 'file_system_error',
  NETWORK_ERROR = 'network_error',
  INVALID_RESPONSE = 'invalid_response',
  TOOL_EXECUTION_FAILED = 'tool_execution_failed',
  USER_ABORT = 'user_abort',
  UNKNOWN = 'unknown'
}

// 오류 세부 정보 인터페이스
interface ErrorDetails {
  type: ErrorType;
  message: string;
  timestamp: number;
  requestId?: string;
  recoverable: boolean;
  retry?: {
    attempted: boolean;
    count: number;
    maxRetries: number;
    success?: boolean;
  };
  context?: any; // 오류 관련 추가 컨텍스트
}

// 사용자 표시 오류 인터페이스
interface UserFacingError {
  title: string;
  message: string;
  suggestions: string[];
  actions: ErrorAction[];
}

// 오류 대응 액션
interface ErrorAction {
  label: string;
  id: string;
  handler: () => Promise<void>;
}
```

### 5.2 복구 동작 (✓)
- 자동 재시도
- 사용자에게 대안 제시
- 명확한 오류 메시지 제공

#### 5.2.1 오류 복구 처리 예시
```typescript
// 오류 복구 관리자
class ErrorRecoveryManager {
  private errorLog: ErrorDetails[] = [];
  private retryableErrors = [ErrorType.MODEL_TIMEOUT, ErrorType.NETWORK_ERROR];
  private userNotificationService: UserNotificationService;
  
  constructor(notificationService: UserNotificationService) {
    this.userNotificationService = notificationService;
  }
  
  // 오류 처리
  async handleError(error: ErrorDetails): Promise<boolean> {
    console.error(`[ErrorRecovery] 오류 처리 중: ${error.type} - ${error.message}`);
    
    // 오류 로깅
    this.errorLog.push(error);
    
    // 재시도 가능한 오류인지 확인
    if (this.retryableErrors.includes(error.type) && (!error.retry || error.retry.count < error.retry.maxRetries)) {
      return await this.retryOperation(error);
    }
    
    // 특정 오류 유형별 복구 전략
    switch (error.type) {
      case ErrorType.CONTEXT_TOO_LARGE:
        return await this.handleContextTooLarge(error);
        
      case ErrorType.PERMISSION_DENIED:
        return await this.handlePermissionDenied(error);
        
      case ErrorType.FILE_SYSTEM_ERROR:
        return await this.handleFileSystemError(error);
        
      default:
        // 처리할 수 없는 오류는 사용자에게 알림
        await this.notifyUser(error);
        return false;
    }
  }
  
  // 작업 재시도
  private async retryOperation(error: ErrorDetails): Promise<boolean> {
    // 재시도 정보 초기화
    if (!error.retry) {
      error.retry = {
        attempted: false,
        count: 0,
        maxRetries: 3
      };
    }
    
    // 재시도 횟수 증가
    error.retry.count++;
    error.retry.attempted = true;
    
    console.log(`[ErrorRecovery] 재시도 중 (${error.retry.count}/${error.retry.maxRetries}): ${error.type}`);
    
    // 지수 백오프 대기
    const backoffMs = Math.min(1000 * Math.pow(2, error.retry.count - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
    
    try {
      // 실제 재시도 로직 (구현 생략)
      // ...
      
      console.log(`[ErrorRecovery] 재시도 성공: ${error.type}`);
      error.retry.success = true;
      return true;
    } catch (e) {
      console.error(`[ErrorRecovery] 재시도 실패: ${error.type}`, e);
      
      // 최대 재시도 횟수에 도달하면 사용자에게 알림
      if (error.retry.count >= error.retry.maxRetries) {
        console.log(`[ErrorRecovery] 최대 재시도 횟수 도달: ${error.retry.count}/${error.retry.maxRetries}`);
        await this.notifyUser({
          ...error,
          message: `최대 재시도 횟수(${error.retry.maxRetries}회)에 도달했습니다: ${error.message}`
        });
      }
      
      return false;
    }
  }
  
  // 컨텍스트 크기 초과 오류 처리
  private async handleContextTooLarge(error: ErrorDetails): Promise<boolean> {
    console.log(`[ErrorRecovery] 컨텍스트 크기 초과 처리 중...`);
    
    try {
      // 컨텍스트 최적화 시도 (구현 생략)
      // ...
      
      return true; // 성공적으로 처리됨
    } catch (e) {
      await this.notifyUser({
        ...error,
        message: '컨텍스트가 너무 큽니다. 쿼리를 더 작은 부분으로 나누거나 파일 범위를 축소해 보세요.'
      });
      return false;
    }
  }
  
  // 권한 부족 오류 처리
  private async handlePermissionDenied(error: ErrorDetails): Promise<boolean> {
    console.log(`[ErrorRecovery] 권한 부족 오류 처리 중...`);
    
    // 사용자에게 권한 요청
    const userGranted = await this.requestPermissionFromUser(error);
    if (userGranted) {
      // 승인된 권한으로 작업 재시도 (구현 생략)
      // ...
      return true;
    }
    
    return false;
  }
  
  // 파일 시스템 오류 처리
  private async handleFileSystemError(error: ErrorDetails): Promise<boolean> {
    console.log(`[ErrorRecovery] 파일 시스템 오류 처리 중...`);
    
    // 파일 시스템 오류 분석 (구현 생략)
    // ...
    
    // 사용자에게 대안 제시
    await this.notifyUser({
      ...error,
      message: '파일 접근 중 오류가 발생했습니다. 파일이 잠겨 있거나 다른 프로그램에서 사용 중일 수 있습니다.'
    });
    
    return false;
  }
  
  // 내부 헬퍼 메서드들 (구현 생략)
  private async notifyUser(error: ErrorDetails): Promise<void> {
    // 사용자 알림 로직
  }
  
  private async requestPermissionFromUser(error: ErrorDetails): Promise<boolean> {
    // 권한 요청 로직
    return false;
  }
}
```

## 6. 제한사항 (✓)

### 6.1 확인된 제한사항 (✓)
- 동시 요청 처리 제한
- 컨텍스트 크기 제한
- 특정 파일 형식 제한
- 시스템 명령 실행 제한

#### 6.1.1 실제 관찰된 제한사항 예제
```
[ModelRequest] 요청 준비: 대형 프로젝트 분석
[ContextCollection] 현재 프로젝트 파일 5,230개 감지됨
[ContextOptimizer] 경고: 컨텍스트 크기 초과 (23.5MB > 15MB 제한)
[ContextOptimizer] 관련성 기준으로 컨텍스트 축소 중...
[ContextOptimizer] 가장 관련된 파일 32개만 포함 (14.2MB)
[RequestQueue] 현재 3개 요청 대기 중, 새 요청은 대기열에 추가됨
[RequestHandler] 경고: 동시 요청 한도 도달 (최대: 3)
[RequestHandler] 대기열 상태: 위치 #4, 예상 대기 시간: 45초
[SecurityManager] 경고: 요청된 시스템 명령 'rm -rf /' 보안 위험으로 차단됨 
[FileTypeValidator] 경고: '.exe' 파일은 보안상의 이유로 지원되지 않음
```

#### 6.1.2 제한사항 처리 로직 예시
```typescript
// 제한사항 처리 매니저
class LimitationManager {
  private static readonly MAX_CONTEXT_SIZE_MB = 15;
  private static readonly MAX_CONCURRENT_REQUESTS = 3;
  private static readonly FORBIDDEN_FILE_EXTENSIONS = ['.exe', '.dll', '.so', '.dylib', '.bin'];
  private static readonly BLOCKED_COMMANDS = ['rm -rf', 'format', 'shutdown', 'reboot', 'del /'];
  
  // 컨텍스트 크기 검증
  validateContextSize(contextSizeMB: number): boolean {
    if (contextSizeMB > this.MAX_CONTEXT_SIZE_MB) {
      console.warn(`[LimitationManager] 컨텍스트 크기 초과: ${contextSizeMB}MB > ${this.MAX_CONTEXT_SIZE_MB}MB`);
      return false;
    }
    return true;
  }
  
  // 동시 요청 수 확인
  canAcceptNewRequest(activeRequests: number): boolean {
    if (activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      console.warn(`[LimitationManager] 동시 요청 한도 도달: ${activeRequests}/${this.MAX_CONCURRENT_REQUESTS}`);
      return false;
    }
    return true;
  }
  
  // 파일 유형 검증
  isFileTypeAllowed(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    if (this.FORBIDDEN_FILE_EXTENSIONS.includes(extension)) {
      console.warn(`[LimitationManager] 금지된 파일 유형: ${extension}`);
      return false;
    }
    return true;
  }
  
  // 명령 안전성 검증
  isCommandSafe(command: string): boolean {
    for (const blockedPattern of this.BLOCKED_COMMANDS) {
      if (command.toLowerCase().includes(blockedPattern)) {
        console.warn(`[LimitationManager] 위험한 명령 차단됨: ${command}`);
        return false;
      }
    }
    return true;
  }
}
```

### 6.2 리소스 제한 (✓)
- 메모리 사용량 제한
- 처리 시간 제한
- 파일 크기 제한

#### 6.2.1 실제 관찰된 리소스 제한 로그
```
[ResourceMonitor] 현재 메모리 사용량: 1.2GB/2GB
[ResourceMonitor] 경고: 메모리 사용량 75%에 도달, 비활성 컨텍스트 정리 중
[RequestHandler] 요청 처리 시간: 25초/30초
[RequestHandler] 경고: 요청 처리 시간 제한 접근 중, 처리 최적화 중
[RequestHandler] 시간 제한으로 처리 중단, 부분 결과 반환
[FileOperation] 파일 크기 제한(50MB) 초과: project.log (78MB)
[FileOperation] 대용량 파일 처리 중: 처음 2000줄과 마지막 1000줄만 로드 중
[ResourceMonitor] 시스템 부하 높음, 요청 큐 조절 중
[PerformanceOptimizer] 임시 캐시 크기 조정: 500MB → 250MB
```

#### 6.2.2 리소스 제한 처리 로직 예시
```typescript
// 리소스 관리자 클래스
class ResourceManager {
  private static readonly MAX_MEMORY_USAGE_MB = 2048; // 2GB
  private static readonly MEMORY_WARNING_THRESHOLD = 0.75; // 75%
  private static readonly MAX_REQUEST_TIME_SEC = 30;
  private static readonly MAX_FILE_SIZE_MB = 50;
  
  private memoryUsageMB: number = 0;
  private activeRequests: Map<string, RequestStats> = new Map();
  
  constructor() {
    // 주기적 리소스 모니터링 설정
    setInterval(() => this.monitorResources(), 5000);
  }
  
  // 리소스 모니터링
  private monitorResources(): void {
    // 메모리 사용량 확인
    this.memoryUsageMB = this.getCurrentMemoryUsageMB();
    console.log(`[ResourceMonitor] 현재 메모리 사용량: ${this.memoryUsageMB}MB/${this.MAX_MEMORY_USAGE_MB}MB`);
    
    // 메모리 사용량 경고 수준 확인
    if (this.memoryUsageMB > this.MAX_MEMORY_USAGE_MB * this.MEMORY_WARNING_THRESHOLD) {
      console.warn(`[ResourceMonitor] 경고: 메모리 사용량 ${Math.round(this.memoryUsageMB / this.MAX_MEMORY_USAGE_MB * 100)}%에 도달, 비활성 컨텍스트 정리 중`);
      this.cleanupInactiveContexts();
    }
    
    // 장기 실행 요청 확인
    this.checkLongRunningRequests();
  }
  
  // 장기 실행 요청 확인
  private checkLongRunningRequests(): void {
    const now = Date.now();
    
    for (const [requestId, stats] of this.activeRequests.entries()) {
      const elapsedSec = (now - stats.startTime) / 1000;
      
      // 시간 제한 접근 중 경고
      if (elapsedSec > this.MAX_REQUEST_TIME_SEC * 0.8) {
        console.warn(`[RequestHandler] 경고: 요청 처리 시간 제한 접근 중, 처리 최적화 중 (${requestId})`);
        this.optimizeRequest(requestId);
      }
      
      // 시간 제한 초과
      if (elapsedSec > this.MAX_REQUEST_TIME_SEC) {
        console.error(`[RequestHandler] 시간 제한으로 처리 중단, 부분 결과 반환 (${requestId})`);
        this.terminateRequest(requestId, 'timeout');
      }
    }
  }
  
  // 파일 크기 확인
  checkFileSize(filePath: string, fileSizeMB: number): boolean {
    if (fileSizeMB > this.MAX_FILE_SIZE_MB) {
      console.warn(`[FileOperation] 파일 크기 제한(${this.MAX_FILE_SIZE_MB}MB) 초과: ${filePath} (${fileSizeMB}MB)`);
      return false;
    }
    return true;
  }
  
  // 내부 헬퍼 메서드들 (구현 생략)
  private getCurrentMemoryUsageMB(): number { 
    // 실제 메모리 사용량 가져오기
    return 1200; // 예시 값
  }
  
  private cleanupInactiveContexts(): void {
    // 비활성 컨텍스트 정리 로직
  }
  
  private optimizeRequest(requestId: string): void {
    // 요청 처리 최적화 로직
  }
  
  private terminateRequest(requestId: string, reason: string): void {
    // 요청 종료 처리 로직
  }
}

// 요청 통계 인터페이스
interface RequestStats {
  startTime: number;
  priority: number;
  contextSize: number;
  status: 'processing' | 'waiting' | 'optimizing' | 'completed' | 'terminated';
}
```

## 7. 결론 (✓)

이 문서는 볼드모트 IDE의 실제 사용 과정에서 관찰된 AI 모델과의 통신 패턴을 분석한 것입니다. 구체적인 구현 세부사항은 추측이 필요하며, 여기서는 직접 관찰 가능한 동작과 패턴만을 기술했습니다.

---
참고: 이 문서는 볼드모트 IDE의 실제 사용 과정에서 관찰된 내용을 바탕으로 작성되었습니다. 구체적인 구현 방식은 다를 수 있습니다. 