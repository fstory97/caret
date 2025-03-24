#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// .env 파일 로드 함수
function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        // 주석이나 빈 줄 무시
        if (!line || line.startsWith('#')) return;
        
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // 따옴표 제거
          envVars[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      });
      
      return envVars;
    }
  } catch (error) {
    console.error(`Error loading .env file: ${error.message}`);
  }
  
  return {};
}

// CLI 옵션 처리
const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(`
Usage: node doc-watcher.cjs [options]

Options:
  -v, --verbose    Verbose logging
  -s, --silent     Minimal logging
  -h, --help       Show help
`);
  process.exit(0);
}

const verbose = args.includes('-v') || args.includes('--verbose');
const silent = args.includes('-s') || args.includes('--silent');

// 로깅 유틸리티
function log(message, level = 'info') {
  if (silent && level !== 'error') return;
  if (!verbose && level === 'debug') return;

  const timestamp = new Date().toLocaleTimeString();
  const prefix = level === 'error' ? '\x1b[31m[ERROR]\x1b[0m' : 
                level === 'debug' ? '\x1b[36m[DEBUG]\x1b[0m' : 
                '\x1b[32m[INFO]\x1b[0m';
  
  console.log(`${prefix} ${timestamp} - ${message}`);
}

// 토큰 수 계산 (근사치)
function estimateTokens(text) {
  if (!text) return 0;
  
  // 코드 블록 처리
  const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
  let codeTokens = 0;
  codeBlocks.forEach(block => {
    const lines = block.split('\n').length;
    codeTokens += lines * 3;
    text = text.replace(block, '');
  });

  // 영어 단어 처리
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const englishWords = words.filter(w => /[a-zA-Z]/.test(w)).length;
  
  // 마크다운 및 기타 문자
  const specialChars = (text.match(/[#*`_\-\[\]():|]/g) || []).length;
  const markdownTokens = Math.round(specialChars * 0.5);
  
  return Math.round(
    englishWords * 1.4 +    // 영어 단어
    markdownTokens +        // 마크다운
    codeTokens              // 코드 블록
  );
}

// 토큰 정보 포맷팅
function formatTokenInfo(tokens) {
  const maxTokens = 10000;
  const percentage = ((tokens / maxTokens) * 100).toFixed(1);
  let warning = '';
  
  if (tokens >= maxTokens) {
    warning = ' ⚠️ Token limit exceeded!';
  }
  
  return `📊 Current size: ${tokens.toLocaleString()} tokens (${percentage}% / ${maxTokens.toLocaleString()})${warning}`;
}

// 환경 변수 로드
const envVars = loadEnvFile();

// 감시할 규칙 파일 경로 설정 (.env에서 가져오거나 기본값 사용)
const rulesFile = envVars.RULES_FILE || './agents-rules/alpha/project-rules.json';
const targetCursorRules = envVars.CURSOR_RULES_FILE || '.cursorrules';
const targetWindsurfRules = envVars.WINDSURF_RULES_FILE || '.windsurfrules';

log(`Using rules file: ${rulesFile}`, 'debug');
log(`Target Cursor rules: ${targetCursorRules}`, 'debug');
log(`Target Windsurf rules: ${targetWindsurfRules}`, 'debug');

// 규칙 파일 업데이트
function updateRules() {
  try {
    if (fs.existsSync(rulesFile)) {
      const content = fs.readFileSync(rulesFile, 'utf8');
      const tokens = estimateTokens(content);
      
      fs.writeFileSync(targetWindsurfRules, content);
      fs.writeFileSync(targetCursorRules, content);
      
      log(`Rules updated: ${formatTokenInfo(tokens)}`);
      log(`Updated rules in ${targetWindsurfRules} and ${targetCursorRules}`);
    } else {
      log(`Rules file not found: ${rulesFile}`, 'error');
    }
  } catch (error) {
    log(`Error updating rules: ${error.message}`, 'error');
  }
}

// 파일 변경 감지 및 처리
const watcher = chokidar.watch(rulesFile, {
  persistent: true,
  ignoreInitial: true
});

watcher.on('change', (path) => {
  log(`Rules file changed: ${path}`);
  updateRules();
});

// 스크립트 시작
updateRules();

// 종료 처리
process.on('SIGINT', () => {
  log('Stopping watcher...');
  watcher.close();
  process.exit(0);
});

log(`Rules watcher started (${new Date().toLocaleString()})`);
log('Press Ctrl+C to exit');

log('doc-watcher.cjs v1.4.0', 'debug');