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
