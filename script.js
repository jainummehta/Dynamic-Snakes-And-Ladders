(function () {
  'use strict';

  /* ============================================================
     CONSTANTS
  ============================================================ */
  const COLORS = [
    { name: 'Red',    hex: '#e74c3c' },
    { name: 'Blue',   hex: '#3498db' },
    { name: 'Green',  hex: '#2ecc71' },
    { name: 'Yellow', hex: '#f1c40f' }
  ];
  const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const NUM_SNAKES = 5;
  const NUM_LADDERS = 4;
  const MIN_GAP = 3;       // minimum distance between head and tail of an entity
  const SLITHER_DELAY = 550;
  const DICE_ANIM_TIME = 650;

  /* ============================================================
     STATE
  ============================================================ */
  let players = [];       // {id, name, color, position}
  let entities = [];      // {id, type:'snake'|'ladder', head, tail}
  let currentPlayerIndex = 0;
  let gameOver = false;
  let squareEls = {};      // number -> {el, content, players}

  /* ============================================================
     DOM REFS
  ============================================================ */
  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const countButtons = document.getElementById('player-count-buttons');
  const nameInputsWrap = document.getElementById('name-inputs');
  const startBtn = document.getElementById('start-game-btn');
  const setupError = document.getElementById('setup-error');

  const boardGrid = document.getElementById('board-grid');
  const boardSvg = document.getElementById('board-svg');
  const boardContainer = document.getElementById('board-container');
  const turnIndicator = document.getElementById('turn-indicator');
  const diceFaceEl = document.getElementById('dice-face');
  const rollBtn = document.getElementById('roll-btn');
  const playerListEl = document.getElementById('player-list');
  const logContent = document.getElementById('log-content');
  const restartBtn = document.getElementById('restart-btn');
  const winOverlay = document.getElementById('win-overlay');
  const winMessage = document.getElementById('win-message');
  const playAgainBtn = document.getElementById('play-again-btn');

  let selectedCount = 2;

  /* ============================================================
     UTILITIES
  ============================================================ */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function squareRowCol(n) {
    // n: 1-100. Row 0 = squares 1-10 (bottom), zigzag boustrophedon.
    const idx = n - 1;
    const rowFromBottom = Math.floor(idx / 10);
    const posInRow = idx % 10;
    const colFromLeft = (rowFromBottom % 2 === 0) ? posInRow : (9 - posInRow);
    const gridRow = 10 - rowFromBottom; // 1-indexed, row10 at top visually = squares 91-100
    const gridColumn = colFromLeft + 1;
    return { gridRow, gridColumn };
  }

  function log(message, cls) {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = message;
    logContent.appendChild(div);
    logContent.scrollTop = logContent.scrollHeight;
  }

  function clearLog() {
    logContent.innerHTML = '';
  }

  /* ============================================================
     SETUP SCREEN LOGIC
  ============================================================ */
  function buildNameInputs(count) {
    nameInputsWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'name-row';

      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = COLORS[i].hex;

      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 16;
      input.placeholder = `${COLORS[i].name} Player - name`;
      input.id = `name-input-${i}`;

      row.appendChild(swatch);
      row.appendChild(input);
      nameInputsWrap.appendChild(row);
    }
  }

  countButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.count-btn');
    if (!btn) return;
    selectedCount = parseInt(btn.dataset.count, 10);
    [...countButtons.children].forEach(b => b.classList.toggle('active', b === btn));
    buildNameInputs(selectedCount);
  });

  startBtn.addEventListener('click', () => {
    const playerData = [];
    for (let i = 0; i < selectedCount; i++) {
      const input = document.getElementById(`name-input-${i}`);
      const name = (input.value || '').trim() || `${COLORS[i].name} Player`;
      playerData.push({ name, color: COLORS[i] });
    }
    setupError.textContent = '';
    startGame(playerData);
  });

  buildNameInputs(selectedCount);

  /* ============================================================
     ENTITY GENERATION (initial board)
  ============================================================ */
  function occupiedSquares(excludeId) {
    const set = new Set([1, 100]);
    entities.forEach(e => {
      if (e.id === excludeId) return;
      set.add(e.head);
      set.add(e.tail);
    });
    return set;
  }

  function generateInitialEntities() {
    entities = [];
    let nextId = 1;

    // Snakes: head (higher number, the bite point) -> tail (lower number, landing spot)
    for (let i = 0; i < NUM_SNAKES; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 500 && !placed; attempt++) {
        const head = randInt(20, 97);
        const tail = randInt(2, head - MIN_GAP);
        if (tail < 2) continue;
        const occ = occupiedSquares(null);
        if (occ.has(head) || occ.has(tail)) continue;
        entities.push({ id: nextId++, type: 'snake', head, tail });
        placed = true;
      }
    }

    // Ladders: head (top, higher number, destination) , tail (base, lower number, landing spot)
    for (let i = 0; i < NUM_LADDERS; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 500 && !placed; attempt++) {
        const head = randInt(20, 95);
        const tail = randInt(2, head - MIN_GAP);
        if (tail < 2) continue;
        const occ = occupiedSquares(null);
        if (occ.has(head) || occ.has(tail)) continue;
        entities.push({ id: nextId++, type: 'ladder', head, tail });
        placed = true;
      }
    }
  }

  /* ============================================================
     THE SLITHER (board shift before each roll)
  ============================================================ */
  function slitherBoard() {
    entities.forEach(entity => {
      // 90s rule: if head is past 90, entity is locked entirely.
      if (entity.head > 90) return;

      const proposedHead = entity.head + randInt(-2, 2);
      const proposedTail = entity.tail + randInt(-2, 2);

      // Boundaries: cannot go below 2 or above 99.
      if (proposedHead < 2 || proposedHead > 99) return;
      if (proposedTail < 2 || proposedTail > 99) return;

      // Must maintain a sane gap & ordering (head strictly higher than tail)
      if (proposedHead - proposedTail < MIN_GAP) return;

      // No overlap: head cannot land on another entity's head (or tail) square.
      const occ = occupiedSquares(entity.id);
      if (occ.has(proposedHead) || occ.has(proposedTail)) return;

      entity.head = proposedHead;
      entity.tail = proposedTail;
    });
  }

  // The Player Collision Rule (applied right after a slither, before rolling)
  function resolveScoopCollisions() {
    entities.forEach(entity => {
      if (entity.type !== 'ladder') return;
      players.forEach(p => {
        if (gameOver) return;
        if (p.position === entity.tail && p.position !== 100) {
          const from = p.position;
          p.position = entity.head;
          log(`⚡ The board shifted a ladder right under ${p.name}! Scooped from ${from} up to ${entity.head}.`, 'log-scoop');
        }
      });
    });
    // Note: a snake head landing on a player does nothing (per rules) - intentionally no-op.
  }

  /* ============================================================
     BOARD RENDERING
  ============================================================ */
  function buildBoardSquares() {
    boardGrid.innerHTML = '';
    squareEls = {};
    for (let n = 1; n <= 100; n++) {
      const { gridRow, gridColumn } = squareRowCol(n);
      const sq = document.createElement('div');
      sq.className = 'square';
      if ((gridRow + gridColumn) % 2 === 0) sq.classList.add('alt');
      sq.style.gridRowStart = gridRow;
      sq.style.gridColumnStart = gridColumn;
      sq.dataset.number = n;

      const numEl = document.createElement('span');
      numEl.className = 'sq-number';
      numEl.textContent = n;

      const contentEl = document.createElement('div');
      contentEl.className = 'sq-content';

      const playersEl = document.createElement('div');
      playersEl.className = 'sq-players';

      sq.appendChild(numEl);
      sq.appendChild(contentEl);
      sq.appendChild(playersEl);
      boardGrid.appendChild(sq);

      squareEls[n] = { el: sq, content: contentEl, players: playersEl };
    }
  }

  function updateBoardContent() {
    for (let n = 1; n <= 100; n++) {
      squareEls[n].content.textContent = '';
      squareEls[n].players.innerHTML = '';
    }

    entities.forEach(e => {
      if (e.type === 'snake') {
        squareEls[e.head].content.textContent += '🐍';
        squareEls[e.tail].content.textContent += '🔻';
      } else {
        squareEls[e.head].content.textContent += '⬆️';
        squareEls[e.tail].content.textContent += '🪜';
      }
    });

    players.forEach(p => {
      const token = document.createElement('div');
      token.className = 'player-token';
      token.style.background = p.color.hex;
      token.textContent = p.name.charAt(0).toUpperCase();
      token.title = p.name;
      squareEls[p.position].players.appendChild(token);
    });
  }

  function getCenter(n) {
    const rect = squareEls[n].el.getBoundingClientRect();
    const boardRect = boardGrid.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2
    };
  }

  function updateSVGLines() {
    const w = boardGrid.clientWidth;
    const h = boardGrid.clientHeight;
    boardSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    let svgContent = `
      <defs>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#ff4d4d"></path>
        </marker>
        <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#2ecc71"></path>
        </marker>
      </defs>
    `;

    entities.forEach(e => {
      const headC = getCenter(e.head);
      const tailC = getCenter(e.tail);
      if (e.type === 'snake') {
        // solid red line, arrow pointing down at the tail
        svgContent += `<line x1="${headC.x}" y1="${headC.y}" x2="${tailC.x}" y2="${tailC.y}"
          stroke="#ff4d4d" stroke-width="3" marker-end="url(#arrow-red)" stroke-linecap="round"></line>`;
      } else {
        // dashed green line, arrow pointing up at the top (head)
        svgContent += `<line x1="${tailC.x}" y1="${tailC.y}" x2="${headC.x}" y2="${headC.y}"
          stroke="#2ecc71" stroke-width="3" stroke-dasharray="6,5" marker-end="url(#arrow-green)" stroke-linecap="round"></line>`;
      }
    });

    boardSvg.innerHTML = svgContent;
  }

  function redrawBoard() {
    updateBoardContent();
    updateSVGLines();
  }

  window.addEventListener('resize', () => {
    if (!gameOver && players.length) updateSVGLines();
  });

  /* ============================================================
     SIDEBAR / TURN INDICATOR
  ============================================================ */
  function renderPlayerList() {
    playerListEl.innerHTML = '';
    players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'player-row' + (i === currentPlayerIndex && !gameOver ? ' current-turn' : '');

      const dot = document.createElement('div');
      dot.className = 'player-dot';
      dot.style.background = p.color.hex;

      const name = document.createElement('div');
      name.className = 'p-name';
      name.textContent = p.name;

      const pos = document.createElement('div');
      pos.className = 'p-pos';
      pos.textContent = `Square ${p.position}`;

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(pos);
      playerListEl.appendChild(row);
    });
  }

  function updateTurnIndicator() {
    if (gameOver) return;
    const p = players[currentPlayerIndex];
    turnIndicator.textContent = `${p.name}'s turn`;
    turnIndicator.style.borderColor = p.color.hex;
    turnIndicator.style.color = p.color.hex;
    renderPlayerList();
  }

  /* ============================================================
     GAME FLOW
  ============================================================ */
  function startGame(playerData) {
    players = playerData.map((p, i) => ({ id: i, name: p.name, color: p.color, position: 1 }));
    currentPlayerIndex = 0;
    gameOver = false;

    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    winOverlay.classList.add('hidden');

    clearLog();
    buildBoardSquares();
    generateInitialEntities();

    log(`Game started with ${players.length} player(s): ${players.map(p => p.name).join(', ')}.`);
    // Give layout a tick to settle before measuring square centers.
    requestAnimationFrame(() => {
      redrawBoard();
      prepareTurn();
    });
  }

  function prepareTurn() {
    if (gameOver) return;
    log('〰️ The board begins to slither...', 'log-slither');
    boardContainer.classList.add('shifting');
    rollBtn.disabled = true;

    setTimeout(() => {
      slitherBoard();
      resolveScoopCollisions();
      redrawBoard();
      boardContainer.classList.remove('shifting');
      updateTurnIndicator();
      if (!gameOver) rollBtn.disabled = false;
    }, SLITHER_DELAY);
  }

  function diceFace(n) {
    return DICE_FACES[n] || '⚀';
  }

  rollBtn.addEventListener('click', () => {
    if (gameOver) return;
    rollBtn.disabled = true;
    diceFaceEl.classList.add('rolling');

    let ticks = 0;
    const interval = setInterval(() => {
      diceFaceEl.textContent = diceFace(randInt(1, 6));
      ticks++;
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      diceFaceEl.classList.remove('rolling');
      const roll = randInt(1, 6);
      diceFaceEl.textContent = diceFace(roll);
      handleRoll(roll);
    }, DICE_ANIM_TIME);
  });

  function handleRoll(roll) {
    const player = players[currentPlayerIndex];
    log(`🎲 ${player.name} rolled a ${roll}.`);

    const target = player.position + roll;

    if (target > 100) {
      log(`${player.name} needs an exact roll to land on 100 and stays on ${player.position}.`);
      renderPlayerList();
      advanceTurn();
      return;
    }

    player.position = target;
    log(`${player.name} moves to square ${target}.`);
    redrawBoard();
    renderPlayerList();

    const entity = entities.find(e =>
      (e.type === 'snake' && e.head === target) ||
      (e.type === 'ladder' && e.tail === target)
    );

    if (entity) {
      setTimeout(() => {
        if (entity.type === 'snake') {
          log(`🐍 Bitten! ${player.name} slides from ${entity.head} down to ${entity.tail}.`, 'log-bite');
        } else {
          log(`🪜 Lucky! ${player.name} climbs from ${entity.tail} up to ${entity.head}.`, 'log-climb');
        }
        player.position = entity.type === 'snake' ? entity.tail : entity.head;
        redrawBoard();
        renderPlayerList();
        checkWinOrAdvance(player);
      }, 500);
    } else {
      checkWinOrAdvance(player);
    }
  }

  function checkWinOrAdvance(player) {
    if (player.position === 100) {
      gameOver = true;
      log(`🎉 ${player.name} WINS THE GAME! 🎉`, 'log-win');
      rollBtn.disabled = true;
      renderPlayerList();
      showWinOverlay(player);
      return;
    }
    advanceTurn();
  }

  function advanceTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    prepareTurn();
  }

  function showWinOverlay(player) {
    winMessage.textContent = `🎉 ${player.name} Wins! 🎉`;
    winMessage.style.color = player.color.hex;
    winOverlay.classList.remove('hidden');
  }

  function resetToSetup() {
    winOverlay.classList.add('hidden');
    gameScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
  }

  restartBtn.addEventListener('click', resetToSetup);
  playAgainBtn.addEventListener('click', resetToSetup);

})();
