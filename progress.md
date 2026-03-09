Original prompt: AGENTS.md를 먼저 읽고 전체 구조를 파악한 다음 아래 작업을 진행해줘.

- 2026-03-09: 프로젝트 초기 뼈대와 `window.gameState`, `window.render_game_to_text`, `window.advanceTime` 구성을 추가.
- 2026-03-09: `index.html`에 모듈 스크립트 로드 순서를 정리하고 `game.js -> hero.js -> enemies.js -> map.js -> inventory.js -> robots.js` 순서로 연결.
- 2026-03-09: `game.js`에서 `mapSystem` / `enemySystem` 연동과 경로 데이터 노출을 추가.
- 2026-03-09: `hero.js`와 `inventory.js`의 인벤토리 표현 충돌을 보정.
- 2026-03-09: 안개 시야 누적, 경로 상시 표시, 상태 문자열 한글 복구, 레이아웃 재배치를 반영.
- 2026-03-09: 우측 로봇 관리 레이아웃을 `Base Command`, `Fabricator`, `Path Slots`, `Disassembly`, `Active Robots` 구조로 재편.
- 2026-03-09: 테스트 밸런스용으로 `js/hero.js` 기본 근접 공격력을 48로 상향해 C 적이 2~3회 타격 내에 정리되도록 조정.
- 2026-03-09: `js/enemies.js`에 적 처치 드롭 디버그 로그 오버레이를 추가하고 3초 자동 숨김 처리.
- 2026-03-09: `js/enemies.js`에서 드롭률을 `DEBUG_PART_DROP_RATE` 상수로 분리하고 테스트용 100%로 고정.
