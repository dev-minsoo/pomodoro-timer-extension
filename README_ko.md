# 포모도로 타이머 (크롬 확장)

React, TypeScript, Tailwind CSS, Vite로 만든 **간단한 포모도로 타이머 크롬 확장**입니다. 타이머 상태는 MV3 **서비스 워커**가 관리하고, 팝업/옵션 UI는 메시지로 통신합니다.

---

## 주요 기능

### 팝업
- **타이머 제어**: 시작 / 일시정지 / 리셋 / 건너뛰기
- **단계**: 집중 / 휴식 / **긴 휴식**
- **표시 방식**: 텍스트 타이머 또는 **링(원형) 진행률**
- **컴팩트 모드**: 좁은 팝업에서도 보기 좋은 밀도
- **사이클 정보**
  - 완료한 뽀모도로 개수 표시
  - 긴 휴식 사용 시 “Until long break” 진행 표시

### 옵션
- **세션 길이**
  - 집중/휴식/긴 휴식 시간
  - 긴 휴식 간격 및 사용 여부
- **자동 전환**
  - 세션 종료 후 자동 시작
- **알림**
  - 알림(미리보기 포함)
  - 사운드 알림: 사용 여부, 사운드 타입(beep/bell/chime/soft/tick), 반복 횟수, 미리보기
- **배지**
  - 아이콘 배지에 남은 시간 표시
- **테마**
  - 라이트 / 다크

---

## 빠른 사용 방법

1. 확장 아이콘 클릭 → 팝업에서 **Start**.
2. 우측 상단 **설정(⚙)**에서 시간/알림/표시 방식 설정.
3. 세션 종료 시 알림/사운드가 설정에 따라 동작하고, 자동 전환 옵션이 켜져 있으면 다음 단계로 넘어갑니다.

---

## 아키텍처(요약)

- **Popup UI**: `src/app/popup/`
- **Options UI**: `src/app/options/`
- **Background (MV3 Service Worker)**: `src/scripts/background/index.ts`
- **Offscreen Document**: `src/app/offscreen/` (AudioContext로 사운드 재생)
- **Content Script**: `src/scripts/content/index.ts`

### 저장소
- 상태: `pomodoroState`
- 설정: `pomodoroSettings`

### 알람
- `pomodoro-end` (세션 종료)
- `pomodoro-tick` (배지 업데이트)

### 메시지(핵심)
Popup/Options → Background:
- `POMODORO_GET_STATE`
- `POMODORO_START` / `POMODORO_PAUSE` / `POMODORO_RESET` / `POMODORO_SKIP`

Options → Background (미리보기):
- `POMODORO_SETTINGS_UPDATED`
- `POMODORO_PREVIEW_SOUND`
- `POMODORO_PREVIEW_NOTIFICATION`

Background → Offscreen:
- `POMODORO_PLAY_SOUND`

---

## 개발

```bash
npm install
```

```bash
npm run dev      # Vite dev server
npm run build    # Type-check + build + manifest를 dist/로 복사
npm run lint     # ESLint
```

빌드 결과물은 `dist/`에 생성됩니다.

---

## 크롬에 확장 로드

1. 빌드:
   ```bash
   npm run build
   ```
2. `chrome://extensions` 접속
3. **Developer mode(개발자 모드)** 활성화
4. **Load unpacked(압축해제된 확장 프로그램 로드)** 클릭
5. `dist/` 폴더 선택

---

## 프로젝트 구조(요약)

```txt
manifest.json
src/
  app/
    popup/       # 팝업 UI
    options/     # 옵션 UI
    offscreen/   # 오디오 재생
  scripts/
    background/  # MV3 서비스 워커
    content/     # 컨텐츠 스크립트
  shared/
    utils/       # Pomodoro 타입/헬퍼
```
