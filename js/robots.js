const ROBOT_REQUIRED_PARTS = ["arm", "legs", "head", "torso"];
const ROBOT_RANKS = ["C", "B", "A", "S"];
const ROBOT_SPRITE_PATH = new URL("../assets/robots/ally_robot_32_base.png", import.meta.url).href;
const ROBOT_PATH_SLOTS = [
  { id: "slot-alpha", label: "Alpha", x: 180, y: 500 },
  { id: "slot-bravo", label: "Bravo", x: 270, y: 360 },
  { id: "slot-charlie", label: "Charlie", x: 430, y: 415 },
  { id: "slot-delta", label: "Delta", x: 600, y: 470 },
];
const ROBOT_RANK_POWER = { C: 2, B: 3, A: 4, S: 5 };
const ROBOT_RANK_AURA = {
  C: { radius: 70, bonus: 0.04 },
  B: { radius: 90, bonus: 0.08 },
  A: { radius: 110, bonus: 0.12 },
  S: { radius: 140, bonus: 0.18 },
};
const ROBOT_RANK_COST = { C: 20, B: 40, A: 75, S: 120 };
const ROBOT_ATTACK_RANGE_BASE = 92;
const ROBOT_ATTACK_DAMAGE_BASE = 12;
const ROBOT_ATTACK_COOLDOWN_BASE = 1.25;
const ROBOT_SPRITE_SIZE = 32;
const ROBOT_ATTACK_FLASH_MS = 140;

function createSpriteAsset(src) {
  const image = new Image();
  const asset = { image, loaded: false, failed: false };
  image.addEventListener("load", () => {
    asset.loaded = true;
  }, { once: true });
  image.addEventListener("error", () => {
    asset.failed = true;
  }, { once: true });
  image.src = src;
  return asset;
}

const robotSpriteAsset = createSpriteAsset(ROBOT_SPRITE_PATH);

function createRobotsModule() {
  const gameState = window.gameState ?? {};
  const inventorySystem = window.inventorySystem;
  if (!inventorySystem) {
    return null;
  }

  const robotsState = gameState.robotFactory ?? {
    selectedPartIds: {
      arm: null,
      legs: null,
      head: null,
      torso: null,
    },
    robots: [],
    lastRobotId: 0,
    warning: "",
    pathSlots: ROBOT_PATH_SLOTS.map((slot) => ({ ...slot, robotIds: [], turretCount: slot.id === "slot-alpha" ? 1 : 0 })),
  };

  gameState.robotFactory = robotsState;
  gameState.placedRobots = robotsState.robots;
  window.gameState = gameState;

  const styleId = "robots-module-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #robots-module-root {
        display: grid;
        grid-template-columns: minmax(260px, 320px) minmax(300px, 1fr);
        gap: 16px;
        min-height: 100%;
      }
      .robot-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .robot-panel {
        border: 1px solid #243246;
        background: linear-gradient(180deg, rgba(22, 31, 45, 0.92), rgba(10, 14, 22, 0.92));
        padding: 12px;
      }
      .robot-subtitle {
        margin: 0 0 10px;
        font-size: 13px;
        color: #ff9f6b;
        text-transform: uppercase;
      }
      .robot-parts,
      .robot-list,
      .robot-systems {
        display: grid;
        gap: 8px;
      }
      .robot-part-row,
      .robot-slot-row,
      .robot-card {
        border: 1px solid #243246;
        background: rgba(7, 10, 15, 0.7);
        padding: 8px;
      }
      .robot-part-row strong,
      .robot-slot-row strong,
      .robot-card strong {
        display: block;
        margin-bottom: 4px;
      }
      .robot-part-row button,
      .robot-slot-row button,
      .robot-card button {
        margin-top: 8px;
      }
      .robot-meta,
      .robot-warning {
        font-size: 12px;
        color: #cbd5e1;
      }
      .robot-warning {
        min-height: 18px;
        color: #ff9f6b;
        margin-top: 10px;
      }
      .robot-list {
        max-height: 420px;
        overflow: auto;
      }
      .robot-dropzone {
        min-height: 72px;
        border: 1px dashed #7a3116;
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #8b98aa;
        text-align: center;
      }
      .robot-dropzone[data-active="true"] {
        border-color: #ff6b2d;
        color: #e7edf7;
      }
      .robot-commands {
        display: grid;
        gap: 6px;
      }
      .robot-inline-select {
        width: 100%;
        margin-top: 10px;
        background: #0b1119;
        color: #e7edf7;
        border: 1px solid #243246;
        padding: 8px;
      }
      @media (max-width: 1180px) {
        #robots-module-root {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const layoutMount = document.getElementById("robot-layout");
  if (!layoutMount) {
    return null;
  }

  let mount = document.getElementById("robots-module-root");
  if (!mount) {
    mount = document.createElement("section");
    mount.id = "robots-module-root";
    layoutMount.appendChild(mount);
  }

  function setWarning(message) {
    robotsState.warning = message;
    const warning = mount.querySelector(".robot-warning");
    if (warning) {
      warning.textContent = message;
    }
  }

  function nextRobotId() {
    robotsState.lastRobotId += 1;
    return `robot-${robotsState.lastRobotId}`;
  }

  function getInventoryItems() {
    return inventorySystem.getState().slots.filter(Boolean);
  }

  function getItemById(itemId) {
    return inventorySystem.getState().slots.find((item) => item?.id === itemId) ?? null;
  }

  function findSelectablePart(type) {
    return getInventoryItems().find((item) => item.type === type && !item.isDisassemblyTool) ?? null;
  }

  function autoFillSelection() {
    ROBOT_REQUIRED_PARTS.forEach((type) => {
      const existing = getItemById(robotsState.selectedPartIds[type]);
      if (existing) {
        return;
      }
      const candidate = findSelectablePart(type);
      robotsState.selectedPartIds[type] = candidate?.id ?? null;
    });
  }

  function getSelectedParts() {
    return ROBOT_REQUIRED_PARTS.map((type) => getItemById(robotsState.selectedPartIds[type])).filter(Boolean);
  }

  function calculateRobotRank(parts) {
    const ranks = parts.map((part) => part.rank);
    return ranks.sort((a, b) => ROBOT_RANKS.indexOf(a) - ROBOT_RANKS.indexOf(b))[0] ?? "C";
  }

  function calculatePowerCost(parts) {
    const rank = calculateRobotRank(parts);
    return ROBOT_RANK_POWER[rank];
  }

  function calculateGoldCost(parts) {
    const total = parts.reduce((sum, part) => sum + ROBOT_RANK_COST[part.rank], 0);
    return Math.floor(total * 0.5);
  }

  function getRankIndex(rank) {
    return Math.max(0, ROBOT_RANKS.indexOf(rank));
  }

  function computeAttackRange(parts) {
    const armRank = parts.find((part) => part.type === "arm")?.rank ?? "C";
    const headRank = parts.find((part) => part.type === "head")?.rank ?? "C";
    return ROBOT_ATTACK_RANGE_BASE + getRankIndex(armRank) * 16 + getRankIndex(headRank) * 12;
  }

  function computeAttackDamage(parts) {
    const armRank = parts.find((part) => part.type === "arm")?.rank ?? "C";
    const legsRank = parts.find((part) => part.type === "legs")?.rank ?? "C";
    return ROBOT_ATTACK_DAMAGE_BASE + getRankIndex(armRank) * 7 + getRankIndex(legsRank) * 4;
  }

  function computeAttackCooldown(parts) {
    const headRank = parts.find((part) => part.type === "head")?.rank ?? "C";
    const armRank = parts.find((part) => part.type === "arm")?.rank ?? "C";
    return Math.max(0.32, ROBOT_ATTACK_COOLDOWN_BASE - getRankIndex(headRank) * 0.15 - getRankIndex(armRank) * 0.08);
  }

  function assembleRobot() {
    autoFillSelection();
    const selectedItems = getSelectedParts();
    if (selectedItems.length !== ROBOT_REQUIRED_PARTS.length) {
      setWarning("팔, 다리, 머리, 몸통을 각각 하나씩 선택해야 조립할 수 있습니다.");
      render();
      return null;
    }

    const itemIds = selectedItems.map((item) => item.id);
    if (new Set(itemIds).size !== itemIds.length) {
      setWarning("같은 부품이 중복 선택되었습니다. 다시 선택해 주세요.");
      render();
      return null;
    }

    const goldCost = calculateGoldCost(selectedItems);
    const powerCost = calculatePowerCost(selectedItems);

    if ((gameState.gold ?? 0) < goldCost) {
      setWarning(`골드가 부족합니다. 필요 골드: ${goldCost}`);
      render();
      return null;
    }

    if ((gameState.usedPower ?? 0) + powerCost > (gameState.maxPower ?? 0)) {
      setWarning(`전력이 부족합니다. 필요 전력: ${powerCost}`);
      render();
      return null;
    }

    const consumedParts = inventorySystem.consumeItemsByIds(itemIds);
    if (consumedParts.length !== ROBOT_REQUIRED_PARTS.length) {
      setWarning("선택한 부품을 인벤토리에서 확인할 수 없습니다.");
      render();
      return null;
    }

    const rank = calculateRobotRank(consumedParts);
    const robot = {
      id: nextRobotId(),
      name: `RF-${robotsState.lastRobotId.toString().padStart(2, "0")}`,
      parts: Object.fromEntries(consumedParts.map((part) => [part.type, part])),
      rank,
      hp: 90 + ROBOT_RANKS.indexOf(rank) * 35,
      maxHP: 90 + ROBOT_RANKS.indexOf(rank) * 35,
      status: "idle",
      powerCost,
      aura: ROBOT_RANK_AURA[consumedParts.find((part) => part.type === "torso")?.rank ?? rank],
      x: 96,
      y: 478,
      destination: { x: 96, y: 478, label: "Base" },
      slotId: null,
      auraTargets: [],
      recoveryRemaining: 0,
      isRecovering: false,
      combatEnabled: true,
      attackRange: computeAttackRange(consumedParts),
      attackDamage: computeAttackDamage(consumedParts),
      attackCooldown: computeAttackCooldown(consumedParts),
      lastAttackAt: 0,
      currentTargetId: null,
      attackFlashUntil: 0,
    };

    gameState.gold -= goldCost;
    gameState.usedPower = (gameState.usedPower ?? 0) + powerCost;
    robotsState.robots.push(robot);
    robotsState.selectedPartIds = { arm: null, legs: null, head: null, torso: null };
    setWarning(`${robot.name} 조립 완료. 비용: ${goldCost}G / ${powerCost} 전력`);
    syncPlacedRobots();
    render();
    return robot;
  }

  function getPathSlot(slotId) {
    return robotsState.pathSlots.find((slot) => slot.id === slotId) ?? null;
  }

  function moveRobotToSlot(robotId, slotId) {
    const robot = robotsState.robots.find((entry) => entry.id === robotId);
    const slot = getPathSlot(slotId);
    if (!robot || !slot) {
      return false;
    }

    if (slot.robotIds.length >= 3) {
      setWarning(`${slot.label} 위치는 이미 로봇 3대로 가득 찼습니다.`);
      render();
      return false;
    }

    robotsState.pathSlots.forEach((pathSlot) => {
      pathSlot.robotIds = pathSlot.robotIds.filter((entry) => entry !== robot.id);
    });

    slot.robotIds.push(robot.id);
    robot.slotId = slot.id;
    robot.destination = { x: slot.x, y: slot.y, label: slot.label };
    robot.status = "moving";
    setWarning(`${robot.name} 이동 명령: ${slot.label}`);
    syncPlacedRobots();
    render();
    return true;
  }

  function returnRobotToBase(robotId) {
    const robot = robotsState.robots.find((entry) => entry.id === robotId);
    if (!robot) {
      return false;
    }

    robotsState.pathSlots.forEach((slot) => {
      slot.robotIds = slot.robotIds.filter((entry) => entry !== robot.id);
    });
    robot.slotId = null;
    robot.destination = { x: 96, y: 478, label: "Base" };
    robot.status = "returning";
    syncPlacedRobots();
    render();
    return true;
  }

  function damageRobot(robotId, amount) {
    const robot = robotsState.robots.find((entry) => entry.id === robotId);
    if (!robot || robot.isRecovering) {
      return false;
    }

    robot.hp = Math.max(0, robot.hp - amount);
    if (robot.hp === 0) {
      startRobotRecovery(robot);
    }

    render();
    return true;
  }

  function startRobotRecovery(robot) {
    if (!robot || robot.isRecovering) {
      return;
    }

    robot.isRecovering = true;
    robot.combatEnabled = false;
    robot.status = "recovering";
    robot.recoveryRemaining = 6 + ROBOT_RANKS.indexOf(robot.rank) * 2;
    robot.destination = { x: 96, y: 478, label: "Repair Bay" };
    robot.currentTargetId = null;
    robotsState.pathSlots.forEach((slot) => {
      slot.robotIds = slot.robotIds.filter((entry) => entry !== robot.id);
    });
    robot.slotId = null;
    setWarning(`${robot.name} 파괴. 자동 회복 프로토콜 시작`);
  }

  function computeAuraTargets() {
    robotsState.robots.forEach((robot) => {
      robot.auraTargets = [];
    });

    robotsState.robots.forEach((source) => {
      robotsState.robots.forEach((target) => {
        if (source.id === target.id) {
          return;
        }
        const dx = source.x - target.x;
        const dy = source.y - target.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= source.aura.radius) {
          target.auraBonus = Math.max(target.auraBonus ?? 0, source.aura.bonus);
          source.auraTargets.push(target.id);
        }
      });
    });
  }

  function syncPlacedRobots() {
    gameState.placedRobots = robotsState.robots.filter((robot) => robot.slotId && robot.combatEnabled && !robot.isRecovering);
  }

  function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function findNearestEnemy(robot, enemies) {
    let target = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const effectiveRange = robot.attackRange * (1 + (robot.auraBonus ?? 0));

    for (const enemy of enemies) {
      if (!enemy || enemy.hp <= 0 || enemy.isDead || enemy.dead) {
        continue;
      }

      const enemyDistance = distanceBetween(robot, enemy);
      if (enemyDistance <= effectiveRange && enemyDistance < bestDistance) {
        target = enemy;
        bestDistance = enemyDistance;
      }
    }

    return target;
  }

  function applyDamageToEnemy(enemy, amount) {
    if (!enemy || amount <= 0) {
      return;
    }

    if (window.enemySystem?.damageEnemy) {
      window.enemySystem.damageEnemy(enemy.id, amount);
      return;
    }

    enemy.hp = Math.max(0, (enemy.hp ?? 0) - amount);
    if (enemy.hp === 0) {
      enemy.isDead = true;
      enemy.dead = true;
    }
  }

  function updateRobotCombat(nowSeconds) {
    const enemies = Array.isArray(gameState.enemies) ? gameState.enemies : [];
    if (enemies.length === 0) {
      robotsState.robots.forEach((robot) => {
        robot.currentTargetId = null;
      });
      return;
    }

    robotsState.robots.forEach((robot) => {
      if (!robot.slotId || !robot.combatEnabled || robot.isRecovering || robot.status === "moving" || robot.status === "returning") {
        robot.currentTargetId = null;
        return;
      }

      const target = findNearestEnemy(robot, enemies);
      if (!target) {
        robot.currentTargetId = null;
        return;
      }

      robot.currentTargetId = target.id;
      if (nowSeconds - robot.lastAttackAt < robot.attackCooldown) {
        return;
      }

      const totalDamage = Math.round(robot.attackDamage * (1 + (robot.auraBonus ?? 0)));
      applyDamageToEnemy(target, totalDamage);
      robot.lastAttackAt = nowSeconds;
      robot.attackFlashUntil = performance.now() + ROBOT_ATTACK_FLASH_MS;
      robot.status = "attacking";
      gameState.message = `${robot.name}이(가) 적 로봇에 ${totalDamage} 피해를 입혔습니다.`;
    });
  }

  function drawRobotSprites() {
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas?.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (const robot of robotsState.robots) {
      if (!robot || typeof robot.x !== "number" || typeof robot.y !== "number") {
        continue;
      }

      const drawX = Math.round(robot.x - ROBOT_SPRITE_SIZE / 2);
      const drawY = Math.round(robot.y - ROBOT_SPRITE_SIZE / 2);
      if (robotSpriteAsset.loaded) {
        ctx.drawImage(robotSpriteAsset.image, drawX, drawY, ROBOT_SPRITE_SIZE, ROBOT_SPRITE_SIZE);
      } else {
        ctx.fillStyle = robot.isRecovering ? "#6b7280" : "#d7dde8";
        ctx.fillRect(drawX, drawY, ROBOT_SPRITE_SIZE, ROBOT_SPRITE_SIZE);
        ctx.fillStyle = "#ff6b2d";
        ctx.fillRect(drawX + 10, drawY + 4, 12, 6);
      }

      ctx.fillStyle = "rgba(5, 7, 12, 0.72)";
      ctx.fillRect(drawX, drawY - 8, ROBOT_SPRITE_SIZE, 4);
      ctx.fillStyle = robot.isRecovering ? "#94a3b8" : "#7cff8f";
      ctx.fillRect(drawX, drawY - 8, Math.round((robot.hp / robot.maxHP) * ROBOT_SPRITE_SIZE), 4);

      if (robot.attackFlashUntil > performance.now() && robot.currentTargetId) {
        const target = (gameState.enemies ?? []).find((enemy) => enemy.id === robot.currentTargetId);
        if (target) {
          ctx.strokeStyle = "rgba(255, 159, 107, 0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.round(robot.x), Math.round(robot.y - 4));
          ctx.lineTo(Math.round(target.x), Math.round(target.y));
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function updateRobots(deltaSeconds) {
    const nowSeconds = performance.now() / 1000;
    robotsState.robots.forEach((robot) => {
      robot.auraBonus = 0;

      if (!robot.isRecovering && robot.hp <= 0) {
        startRobotRecovery(robot);
      }

      const destination = robot.destination ?? { x: robot.x, y: robot.y };
      const dx = destination.x - robot.x;
      const dy = destination.y - robot.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 1) {
        const speed = robot.isRecovering ? 60 : 84;
        robot.x += (dx / distance) * speed * deltaSeconds;
        robot.y += (dy / distance) * speed * deltaSeconds;
      } else if (robot.status === "moving" || robot.status === "returning" || robot.status === "attacking") {
        robot.status = robot.slotId ? "defending" : "idle";
      }

      if (robot.isRecovering) {
        robot.recoveryRemaining = Math.max(0, robot.recoveryRemaining - deltaSeconds);
        if (robot.recoveryRemaining === 0) {
          robot.isRecovering = false;
          robot.combatEnabled = true;
          robot.hp = robot.maxHP;
          robot.status = "idle";
          setWarning(`${robot.name} 회복 완료. 재전투 가능`);
        }
      }
    });

    computeAuraTargets();
    updateRobotCombat(nowSeconds);
    syncPlacedRobots();
  }

  function canDisassemble(robot) {
    return !robot.slotId && Math.hypot(robot.x - 96, robot.y - 478) <= 18;
  }

  function disassembleRobot(robotId, toolItemId) {
    const robot = robotsState.robots.find((entry) => entry.id === robotId);
    if (!robot) {
      return false;
    }

    if (!canDisassemble(robot)) {
      setWarning("분해는 기지 귀환 상태에서만 가능합니다.");
      render();
      return false;
    }

    const tool = getItemById(toolItemId);
    if (!tool?.isDisassemblyTool) {
      setWarning("분해 키트를 드래그해 넣어야 합니다.");
      render();
      return false;
    }

    inventorySystem.removeItemById(toolItemId);
    Object.values(robot.parts).forEach((part) => {
      inventorySystem.addItem({ ...part, id: inventorySystem.makeItem(part.type, part.rank).id });
    });

    gameState.usedPower = Math.max(0, (gameState.usedPower ?? 0) - robot.powerCost);
    robotsState.robots = robotsState.robots.filter((entry) => entry.id !== robotId);
    gameState.robotFactory.robots = robotsState.robots;
    setWarning(`${robot.name} 분해 완료. 부품이 인벤토리로 환원되었습니다.`);
    syncPlacedRobots();
    render();
    return true;
  }

  function choosePart(type, itemId) {
    robotsState.selectedPartIds[type] = itemId;
    render();
  }

  function renderPartsPanel() {
    const inventoryItems = getInventoryItems();
    const rows = ROBOT_REQUIRED_PARTS.map((type) => {
      const selected = getItemById(robotsState.selectedPartIds[type]);
      const candidates = inventoryItems.filter((item) => item.type === type && !item.isDisassemblyTool);
      const candidateButtons = candidates.length > 0
        ? candidates.map((item) => `
            <button type="button" data-action="select-part" data-type="${type}" data-item-id="${item.id}">
              ${item.label}
            </button>
          `).join("")
        : `<div class="robot-meta">사용 가능한 ${type} 부품 없음</div>`;

      return `
        <div class="robot-part-row">
          <strong>${type.toUpperCase()}</strong>
          <div class="robot-meta">선택: ${selected ? `${selected.label} / ${selected.saleValue}G` : "없음"}</div>
          ${candidateButtons}
        </div>
      `;
    }).join("");

    const selectedParts = getSelectedParts();
    const ready = selectedParts.length === ROBOT_REQUIRED_PARTS.length;
    const goldCost = ready ? calculateGoldCost(selectedParts) : 0;
    const powerCost = ready ? calculatePowerCost(selectedParts) : 0;

    return `
      <section class="robot-panel">
        <h3 class="robot-subtitle">Fabricator</h3>
        <div class="robot-parts">${rows}</div>
        <div class="robot-meta" style="margin-top:10px;">예상 비용: ${goldCost}G / ${powerCost} 전력</div>
        <button type="button" data-action="assemble-robot">조립 실행</button>
      </section>
    `;
  }

  function renderSlotsPanel() {
    const rows = robotsState.pathSlots.map((slot) => `
      <div class="robot-slot-row">
        <strong>${slot.label}</strong>
        <div class="robot-meta">로봇 ${slot.robotIds.length}/3, 포탑 ${slot.turretCount}/1</div>
      </div>
    `).join("");

    return `
      <section class="robot-panel">
        <h3 class="robot-subtitle">Path Slots</h3>
        <div class="robot-systems">${rows}</div>
      </section>
    `;
  }

  function renderRobotCard(robot) {
    const commandButtons = ROBOT_PATH_SLOTS.map((slot) => `
      <button type="button" data-action="move-robot" data-robot-id="${robot.id}" data-slot-id="${slot.id}">
        ${slot.label} 이동
      </button>
    `).join("");

    return `
      <article class="robot-card">
        <strong>${robot.name} / ${robot.rank}</strong>
        <div class="robot-meta">HP ${Math.round(robot.hp)}/${robot.maxHP} / 상태 ${robot.status}</div>
        <div class="robot-meta">위치 ${Math.round(robot.x)}, ${Math.round(robot.y)} / 오라 +${Math.round((robot.auraBonus ?? 0) * 100)}%</div>
        <div class="robot-meta">목표 ${robot.destination?.label ?? "Base"} / 버프 대상 ${robot.auraTargets.length}기</div>
        <div class="robot-commands">
          ${commandButtons}
          <button type="button" data-action="return-robot" data-robot-id="${robot.id}">기지 귀환</button>
          <button type="button" data-action="damage-robot" data-robot-id="${robot.id}">피해 테스트</button>
        </div>
      </article>
    `;
  }

  function renderDisassemblyPanel() {
    const idleRobots = robotsState.robots.filter((robot) => canDisassemble(robot));
    const robotOptions = idleRobots.length > 0
      ? idleRobots.map((robot) => `<option value="${robot.id}">${robot.name}</option>`).join("")
      : `<option value="">기지 대기 로봇 없음</option>`;

    return `
      <section class="robot-panel">
        <h3 class="robot-subtitle">Disassembly</h3>
        <div class="robot-meta">로봇을 기지로 귀환시킨 뒤 분해 키트를 드래그해 넣습니다.</div>
        <select id="robot-disassembly-target" class="robot-inline-select">
          ${robotOptions}
        </select>
        <div class="robot-dropzone" id="robot-disassembly-dropzone">분해 키트를 여기로 드래그</div>
      </section>
    `;
  }

  function renderRosterPanel() {
    const cards = robotsState.robots.length > 0
      ? robotsState.robots.map(renderRobotCard).join("")
      : `<div class="robot-meta">조립된 로봇이 아직 없습니다.</div>`;

    return `
      <section class="robot-panel">
        <h3 class="robot-subtitle">Active Robots</h3>
        <div class="robot-list">${cards}</div>
        <div class="robot-warning">${robotsState.warning}</div>
      </section>
    `;
  }

  function render() {
    autoFillSelection();
    mount.innerHTML = `
      <section class="robot-column robot-column-primary">
        ${renderPartsPanel()}
      </section>
      <section class="robot-column robot-column-secondary">
        ${renderSlotsPanel()}
        ${renderDisassemblyPanel()}
        ${renderRosterPanel()}
      </section>
    `;

    mount.querySelectorAll("[data-action='select-part']").forEach((button) => {
      button.addEventListener("click", () => choosePart(button.dataset.type, button.dataset.itemId));
    });
    mount.querySelector("[data-action='assemble-robot']")?.addEventListener("click", assembleRobot);
    mount.querySelectorAll("[data-action='move-robot']").forEach((button) => {
      button.addEventListener("click", () => moveRobotToSlot(button.dataset.robotId, button.dataset.slotId));
    });
    mount.querySelectorAll("[data-action='return-robot']").forEach((button) => {
      button.addEventListener("click", () => returnRobotToBase(button.dataset.robotId));
    });
    mount.querySelectorAll("[data-action='damage-robot']").forEach((button) => {
      button.addEventListener("click", () => damageRobot(button.dataset.robotId, 45));
    });

    const dropzone = document.getElementById("robot-disassembly-dropzone");
    dropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.dataset.active = "true";
    });
    dropzone?.addEventListener("dragleave", () => {
      dropzone.dataset.active = "false";
    });
    dropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.dataset.active = "false";
      const payloadText = event.dataTransfer?.getData("text/plain") ?? "";
      if (!payloadText) {
        return;
      }
      const payload = JSON.parse(payloadText);
      const targetSelect = document.getElementById("robot-disassembly-target");
      const robotId = targetSelect?.value;
      if (robotId) {
        disassembleRobot(robotId, payload.id);
      }
    });
  }

  let lastTick = performance.now();
  function tick(timestamp) {
    const deltaSeconds = Math.min(0.05, (timestamp - lastTick) / 1000);
    lastTick = timestamp;
    updateRobots(deltaSeconds);
    drawRobotSprites();
    window.requestAnimationFrame(tick);
  }

  window.addEventListener("inventory:changed", () => {
    render();
  });

  render();
  syncPlacedRobots();
  window.requestAnimationFrame(tick);

  return {
    assembleRobot,
    moveRobotToSlot,
    returnRobotToBase,
    damageRobot,
    disassembleRobot,
    updateRobots,
    getState: () => robotsState,
  };
}

window.robotSystem = createRobotsModule();
