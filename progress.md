Original prompt: AGENTS.md를 먼저 읽고 전체 구조를 파악한 다음 아래 작업을 진행해줘.
버려진 행성 배경 타워디펜스 게임 기반을 만들어줘.
- HTML5 Canvas + Vanilla JS, 파일 분리 구조 (index.html + js/ 폴더)
- 800×600 캔버스, 다크 SF 픽셀아트 스타일
- 웨이브 시스템: 지역당 10웨이브, 5·10웨이브는 보스웨이브
- 지역 구조: A지역 → 보스 처치 → B지역 전환
- 기지 HP, 전력(Power) 수치 UI 표시
- game.js에 전역 gameState 객체 정의 (다른 모듈 참조용)
- 작업 끝나면 git add, commit, push까지 해줘

- 2026-03-09: 저장소에 `index.html`, `js/` 폴더, `game.js`가 없는 초기 상태 확인.
- 2026-03-09: AGENTS.md 기준 에이전트 1 범위인 `index.html`, `js/game.js` 중심으로 초기 뼈대 작성.
- 2026-03-09: `window.gameState`, `window.render_game_to_text`, `window.advanceTime` 추가.
- 2026-03-09: `node --check js/game.js` 통과.
- 2026-03-09: Playwright 클라이언트 확인 시 `playwright` 패키지 부재로 자동 브라우저 검증은 미실행.
- 2026-03-09: 에이전트 5 범위로 `js/map.js` 추가. 경로, 슬롯 UI, 암흑시야, 미니맵, 포탑 설치 훅을 `window.mapSystem`에 노출.
- 2026-03-09: `index.html` script tags를 module로 정리하고 `game.js -> hero.js -> enemies.js -> map.js -> inventory.js -> robots.js` 순서로 로드 연결.
- 2026-03-09: `js/game.js`에 `gameState.paths` 추가, `window.enemySystem` 업데이트 훅과 `window.mapSystem.renderScene(ctx)` 렌더 위임 추가.
- 2026-03-09: 로드 검증 중 `hero.js` 배열형 inventory와 `inventory.js` 객체형 inventory 충돌로 `undefined.some` 런타임 에러 확인.
- 2026-03-09: `hero.js`에 inventory slots 접근 헬퍼를 추가하고 `inventory.js`에서 기존 배열 inventory를 객체형 상태로 승격하도록 보정.
- 2026-03-09: `index.html` 레이아웃을 재정리해 테스트 버튼을 우측 상단으로 분리하고 인벤토리를 캔버스 바로 아래로 이동.
- 2026-03-09: `js/map.js`에서 누적 시야 키를 현재 reveal zone들과 동기화하고, 경로를 안개 위에 다시 그려 항상 보이도록 수정.
- 2026-03-09: `js/game.js`의 깨진 한글 상태 문구를 정상 문자열로 교체하고, 전장 초기화 시 `mapData`를 함께 리셋하도록 보정.
- 2026-03-09: `js/hero.js`가 시야를 직접 배열에 밀어 넣지 않고 `window.mapSystem.revealArea()`를 우선 사용하도록 수정.
- 2026-03-09: Playwright 검증에서 `#use-power-button` 클릭 후 상태 문구가 정상 한글로 출력되고 `power: 8`, `usedPower: 2`로 반영되는 것 확인.
- 2026-03-09: 캔버스 클릭 이동 후 영웅 좌표가 `(400, 300) -> (686, 128)`로 바뀌고 `visibleZones`가 `4 -> 28`로 증가해 시야 누적을 확인.
