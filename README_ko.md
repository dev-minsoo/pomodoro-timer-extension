# 포모도로 타이머 확장 (Chrome MV3)

React + TypeScript + Vite 기반의 포모도로 타이머 크롬 확장입니다.  
핵심 목적은 **팝업이 닫혀도 타이머 상태를 안정적으로 유지**하고, 알림/사운드/배지까지 포함한 **실사용 가능한 집중 사이클**을 제공하는 것입니다.

## 이 저장소가 제공하는 것

- MV3 서비스 워커 중심 타이머 상태 관리
- Popup/Options UI 분리 구조
- `chrome.alarms`, `chrome.notifications`, `chrome.offscreen` 기반 완료 이벤트 처리
- `chrome.storage.local` 기반 상태/설정 복구

## 핵심 기능

- 세션: Focus / Break / Long Break
- 제어: Start / Pause / Reset / Skip
- 자동 전환: 세션 종료 후 다음 세션 자동 시작 옵션
- 옵션 페이지:
  - 집중/휴식/긴휴식 시간, 긴휴식 간격, 긴휴식 사용 여부
  - 알림 on/off + 알림 미리보기
  - 사운드 on/off + 사운드 타입 + 반복 횟수 + 미리보기
  - 배지 카운트다운 on/off
  - 팝업 표시 모드(Text/Ring), Compact mode
  - 테마(Light/Dark)
- 팝업 UI:
  - 텍스트/링 타이머 표시
  - 현재 상태/세션 표시
  - 긴휴식까지 진행도 표시

## 런타임 아키텍처

```txt
Popup UI  ─┐
           ├─ runtime message ─> Background Service Worker
Options UI ─┘                         ├─ chrome.storage.local (상태/설정)
                                      ├─ chrome.alarms (종료/tick)
                                      ├─ chrome.notifications
                                      ├─ chrome.action badge
                                      └─ Offscreen Document (오디오 재생)
```

### 구성 요소 역할

- `src/scripts/background/index.ts`
  - 타이머 상태 단일 소스(SSOT)
  - 세션 전환 규칙, 알람 스케줄링, 알림/사운드 트리거, 배지 갱신
- `src/app/popup/Popup.tsx`
  - 타이머 렌더링/제어 UI
  - 1초 단위 로컬 카운트다운 + 5초 주기 상태 동기화
- `src/app/options/Options.tsx`
  - 설정 편집/저장
  - 알림/사운드 미리보기 요청
- `src/app/offscreen/main.ts`
  - AudioContext 기반 사운드 재생(MV3 제약 대응)

## 데이터 모델

- `pomodoroState`
  - `status`, `phase`, `remainingMs`, `endTime`, `completedFocusSessions`, `totalCycles`
- `pomodoroSettings`
  - 세션 시간, 자동 전환, 알림/사운드, 배지, UI 표시 설정

## 주요 메시지 계약

- Popup/Options -> Background
  - `POMODORO_GET_STATE`
  - `POMODORO_START`
  - `POMODORO_PAUSE`
  - `POMODORO_RESET`
  - `POMODORO_SKIP`
  - `POMODORO_SETTINGS_UPDATED`
  - `POMODORO_PREVIEW_SOUND`
  - `POMODORO_PREVIEW_NOTIFICATION`
- Background -> Offscreen
  - `POMODORO_PLAY_SOUND`

## 사용하는 Chrome 권한

- `storage`: 상태/설정 저장
- `alarms`: 세션 종료 및 분 단위 처리
- `notifications`: 세션 완료 알림
- `offscreen`: 백그라운드 오디오 재생
- `tabs`, `host_permissions(<all_urls>)`, `content_scripts`
  - 현재는 기본 콘텐츠 스크립트 통신 코드 포함(포모도로 핵심 기능에서 비중 낮음)

## 개발

```bash
npm install
npm run dev
npm run build
npm run lint
```

- 빌드 결과물: `dist/`

## 크롬에 로드하기

1. `npm run build`
2. `chrome://extensions` 접속
3. 개발자 모드 활성화
4. 압축해제된 확장 프로그램 로드 클릭
5. `dist/` 폴더 선택

## 프로젝트 구조

```txt
manifest.json
src/
  app/
    popup/       # Popup UI
    options/     # Settings UI
    offscreen/   # 오디오 재생 런타임
  scripts/
    background/  # MV3 서비스 워커 (타이머 상태 머신)
    content/     # 최소 콘텐츠 스크립트
  shared/
    utils/       # 타입 및 공용 유틸
```
