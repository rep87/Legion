const INVENTORY_SLOT_COUNT = 9;
const INVENTORY_TYPES = ["arm", "legs", "head", "torso", "disassembler"];
const INVENTORY_RANKS = ["C", "B", "A", "S"];
const INVENTORY_RANK_COLORS = {
  C: "#8b98aa",
  B: "#67c1ff",
  A: "#ffb347",
  S: "#ff5f5f",
};

function createInventoryModule() {
  const gameState = window.gameState ?? {};
  const inventoryState = gameState.inventory ?? {
    slots: new Array(INVENTORY_SLOT_COUNT).fill(null),
    combineOffer: null,
    warning: "",
    lastItemId: 0,
  };

  gameState.inventory = inventoryState;
  window.gameState = gameState;

  const styleId = "inventory-module-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .inventory-grid[data-enhanced="true"] {
        display: grid;
        grid-template-columns: repeat(9, minmax(0, 1fr));
        gap: 10px;
      }
      .inventory-slot {
        position: relative;
        min-height: 84px;
        border: 1px solid #243246;
        background:
          linear-gradient(180deg, rgba(25, 35, 50, 0.95), rgba(10, 14, 22, 0.95)),
          linear-gradient(90deg, transparent 49%, rgba(255, 255, 255, 0.04) 50%, transparent 51%);
        padding: 8px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        color: #e7edf7;
        user-select: none;
      }
      .inventory-slot[data-empty="true"] {
        color: #8b98aa;
        justify-content: center;
        align-items: center;
      }
      .inventory-slot[data-dragging="true"] {
        outline: 1px solid #ff6b2d;
      }
      .inventory-index {
        font-size: 10px;
        color: #8b98aa;
      }
      .inventory-item-type {
        font-size: 14px;
        text-transform: uppercase;
      }
      .inventory-item-rank {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        padding: 2px 4px;
        border: 1px solid currentColor;
        font-size: 11px;
      }
      .inventory-item-meta {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }
      .inventory-item-value {
        font-size: 11px;
        color: #8b98aa;
      }
      .inventory-warning {
        margin-top: 10px;
        min-height: 18px;
        font-size: 12px;
        color: #ff9f6b;
      }
      .inventory-popup-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(4, 6, 10, 0.75);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 20;
      }
      .inventory-popup-backdrop[data-open="true"] {
        display: flex;
      }
      .inventory-popup {
        width: min(420px, calc(100vw - 40px));
        border: 1px solid #7a3116;
        background: linear-gradient(180deg, #161f2d, #0b1119);
        padding: 18px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
      }
      .inventory-popup h3 {
        margin: 0 0 10px;
        color: #ff9f6b;
        font-size: 16px;
      }
      .inventory-popup p {
        margin: 0 0 14px;
        color: #cbd5e1;
        font-size: 13px;
        line-height: 1.5;
      }
      .inventory-popup-actions {
        display: flex;
        gap: 10px;
      }
      .inventory-popup-actions button {
        flex: 1;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  const grid = document.getElementById("inventory-grid");
  if (!grid) {
    return null;
  }

  grid.dataset.enhanced = "true";
  const inventorySection = grid.closest(".inventory");
  let warningLine = inventorySection?.querySelector(".inventory-warning");
  if (!warningLine) {
    warningLine = document.createElement("div");
    warningLine.className = "inventory-warning";
    inventorySection?.appendChild(warningLine);
  }

  let popupBackdrop = document.getElementById("inventory-combine-popup");
  if (!popupBackdrop) {
    popupBackdrop = document.createElement("div");
    popupBackdrop.id = "inventory-combine-popup";
    popupBackdrop.className = "inventory-popup-backdrop";
    popupBackdrop.innerHTML = `
      <div class="inventory-popup" role="dialog" aria-modal="true" aria-labelledby="inventory-combine-title">
        <h3 id="inventory-combine-title">조합 가능</h3>
        <p id="inventory-combine-copy"></p>
        <div class="inventory-popup-actions">
          <button type="button" id="inventory-combine-confirm">조합</button>
          <button type="button" id="inventory-combine-dismiss">나중에</button>
        </div>
      </div>
    `;
    document.body.appendChild(popupBackdrop);
  }

  const popupCopy = document.getElementById("inventory-combine-copy");
  const confirmButton = document.getElementById("inventory-combine-confirm");
  const dismissButton = document.getElementById("inventory-combine-dismiss");

  function nextItemId() {
    inventoryState.lastItemId += 1;
    return `item-${inventoryState.lastItemId}`;
  }

  function makeItem(type, rank) {
    const saleValue = { C: 10, B: 25, A: 55, S: 125 }[rank];
    return {
      id: nextItemId(),
      type,
      rank,
      label: type === "disassembler" ? "분해 키트" : `${type.toUpperCase()}-${rank}`,
      saleValue,
      isDisassemblyTool: type === "disassembler",
    };
  }

  function seedInventoryIfEmpty() {
    if (inventoryState.slots.some(Boolean)) {
      return;
    }

    const starterItems = [
      makeItem("arm", "C"),
      makeItem("arm", "C"),
      makeItem("arm", "C"),
      makeItem("legs", "C"),
      makeItem("head", "C"),
      makeItem("torso", "C"),
      makeItem("disassembler", "C"),
      makeItem("torso", "B"),
      makeItem("head", "B"),
    ];
    inventoryState.slots = starterItems.slice(0, INVENTORY_SLOT_COUNT);
  }

  function setWarning(message) {
    inventoryState.warning = message;
    warningLine.textContent = message;
  }

  function findEmptySlot() {
    return inventoryState.slots.findIndex((item) => item === null);
  }

  function addItem(item) {
    const emptySlot = findEmptySlot();
    if (emptySlot === -1) {
      setWarning("인벤토리가 가득 차서 아이템을 받을 수 없습니다.");
      return false;
    }

    inventoryState.slots[emptySlot] = item;
    detectCombineOffer();
    render();
    notifyChanged("add", item);
    return true;
  }

  function removeItemById(itemId) {
    const slotIndex = inventoryState.slots.findIndex((item) => item?.id === itemId);
    if (slotIndex === -1) {
      return null;
    }

    const [item] = inventoryState.slots.splice(slotIndex, 1, null);
    detectCombineOffer();
    render();
    notifyChanged("remove", item);
    return item;
  }

  function consumeItemsByIds(itemIds) {
    return itemIds.map((itemId) => removeItemById(itemId)).filter(Boolean);
  }

  function detectCombineOffer() {
    inventoryState.combineOffer = null;
    const grouped = new Map();

    inventoryState.slots.forEach((item) => {
      if (!item || item.isDisassemblyTool || item.rank === "S") {
        return;
      }
      const key = `${item.type}:${item.rank}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item.id);
    });

    for (const [key, ids] of grouped.entries()) {
      if (ids.length >= 3) {
        const [type, rank] = key.split(":");
        inventoryState.combineOffer = {
          type,
          rank,
          itemIds: ids.slice(0, 3),
          nextRank: INVENTORY_RANKS[INVENTORY_RANKS.indexOf(rank) + 1],
        };
        break;
      }
    }

    updatePopup();
  }

  function updatePopup() {
    const offer = inventoryState.combineOffer;
    if (!offer) {
      popupBackdrop.dataset.open = "false";
      popupCopy.textContent = "";
      return;
    }

    popupBackdrop.dataset.open = "true";
    popupCopy.textContent = `${offer.type.toUpperCase()} ${offer.rank} 부품 3개를 ${offer.nextRank} 등급으로 승급할 수 있습니다.`;
  }

  function combineCurrentOffer() {
    const offer = inventoryState.combineOffer;
    if (!offer) {
      return null;
    }

    consumeItemsByIds(offer.itemIds);
    const upgradedItem = makeItem(offer.type, offer.nextRank);
    addItem(upgradedItem);
    setWarning(`${offer.type.toUpperCase()} 부품이 ${offer.nextRank} 등급으로 조합되었습니다.`);
    detectCombineOffer();
    render();
    notifyChanged("combine", upgradedItem);
    return upgradedItem;
  }

  function dismissOffer() {
    popupBackdrop.dataset.open = "false";
  }

  function sellItem(itemId) {
    const item = removeItemById(itemId);
    if (!item) {
      return false;
    }

    gameState.gold = (gameState.gold ?? 0) + item.saleValue;
    setWarning(`${item.label} 판매 완료: +${item.saleValue}G`);
    notifyChanged("sell", item);
    return true;
  }

  function notifyChanged(reason, item) {
    window.dispatchEvent(new CustomEvent("inventory:changed", { detail: { reason, item } }));
  }

  function getDragPayload(itemId) {
    const item = inventoryState.slots.find((entry) => entry?.id === itemId);
    return item ? JSON.stringify({ id: item.id, type: item.type, rank: item.rank }) : "";
  }

  function render() {
    grid.replaceChildren();
    inventoryState.slots.forEach((item, index) => {
      const slot = document.createElement("div");
      slot.className = "inventory-slot";
      slot.dataset.slotIndex = String(index);
      slot.dataset.empty = item ? "false" : "true";

      if (!item) {
        slot.innerHTML = `
          <span class="inventory-index">SLOT ${index + 1}</span>
          <span>EMPTY</span>
        `;
        grid.appendChild(slot);
        return;
      }

      slot.draggable = true;
      slot.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", getDragPayload(item.id));
        slot.dataset.dragging = "true";
      });
      slot.addEventListener("dragend", () => {
        slot.dataset.dragging = "false";
      });
      slot.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        sellItem(item.id);
        render();
      });

      const rankColor = INVENTORY_RANK_COLORS[item.rank] ?? "#8b98aa";
      slot.innerHTML = `
        <span class="inventory-index">SLOT ${index + 1}</span>
        <strong class="inventory-item-type">${item.isDisassemblyTool ? "KIT" : item.type}</strong>
        <div class="inventory-item-meta">
          <span class="inventory-item-rank" style="color:${rankColor}">${item.rank}</span>
          <span class="inventory-item-value">${item.saleValue}G</span>
        </div>
      `;
      slot.title = item.isDisassemblyTool
        ? "분해 아이템: 분해 구역으로 드래그해 사용"
        : "우클릭으로 판매";
      grid.appendChild(slot);
    });

    warningLine.textContent = inventoryState.warning;
  }

  confirmButton?.addEventListener("click", () => {
    combineCurrentOffer();
  });
  dismissButton?.addEventListener("click", dismissOffer);

  seedInventoryIfEmpty();
  detectCombineOffer();
  render();

  return {
    addItem,
    removeItemById,
    consumeItemsByIds,
    sellItem,
    combineCurrentOffer,
    detectCombineOffer,
    findEmptySlot,
    getState: () => inventoryState,
    makeItem,
  };
}

window.inventorySystem = createInventoryModule();
