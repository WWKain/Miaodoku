		"use strict";
		const CONFIG = {
			startSize: 4,
			maxSize: 12,
			pointsPerCat: 10
		};
		const state = {
			level: 1,
			score: 0,
			size: CONFIG.startSize,
			solution: [],
			regions: [],
			cats: new Set(),
			crosses: new Set(),
			catSkins: new Map(),
			maxCats: 0,
			locked: false,
			startCats: new Set(),
			startSkins: new Map(),
			startMaxCats: 0,
			startScore: 0,
			skinsEnabled: true
		};
		const board = document.getElementById("board");
		const levelElement = document.getElementById("level");
		const scoreElement = document.getElementById("score");
		const catsElement = document.getElementById("cats");
		const messageElement = document.getElementById("message");
		const infoButton = document.getElementById("infoButton");
		const infoOverlay = document.getElementById("infoOverlay");
		const closeInfo = document.getElementById("closeInfo");
		const skinButton = document.getElementById("skinButton");
		const resetButton = document.getElementById("resetButton");
		const helpButton = document.getElementById("helpButton");
		const levelOverlay = document.getElementById("levelOverlay");
		const nextButton = document.getElementById("nextButton");
		const nextLevelButton = document.getElementById("nextLevelButton");
		const closeLevelPopup = document.getElementById("closeLevelPopup");
		const congratsOverlay = document.getElementById("congratsOverlay");
		const closeCongrats = document.getElementById("closeCongrats");
		const REGION_COLORS = ["#FF9FC4", "#91CFFF", "#FFE668", "#9EDC91", "#D2A2FF", "#FFB07C", "#72D9D0", "#D598C7", "#B8B26A", "#E58C7A", "#FFD9BA", "#8FA1D8"];
		const imageCache = new Map();
		const FUR_IMAGES = Array.from({length: 12}, (_, i) => `res/${i + 4}.png`);
		function key(row, col) {
			return `${row},${col}`;
		}
		function coordinates(value) {
			return value.split(",").map(Number);
		}
		function shuffle(array) {
			const result = [...array];
			for (let i = result.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[result[i], result[j]] = [result[j], result[i]];
			}
			return result;
		}
		function generateSolution(size) {
			const columns = [];
			const usedColumns = new Set();
			function search(row) {
				if (row === size) {
					return true;
				}
				const candidates = shuffle(Array.from({
					length: size
				}, (_, i) => i));
				for (const col
					of candidates) {
					if (usedColumns.has(col)) {
						continue;
					}
					let valid = true;
					for (let previousRow = 0; previousRow < row; previousRow++) {
						const previousCol = columns[previousRow];
						if (Math.abs(previousRow - row) <= 1 && Math.abs(previousCol - col) <= 1) {
							valid = false;
							break;
						}
					}
					if (!valid) {
						continue;
					}
					columns.push(col);
					usedColumns.add(col);
					if (search(row + 1)) {
						return true;
					}
					columns.pop();
					usedColumns.delete(col);
				}
				return false;
			}
			if (!search(0)) {
				return null;
			}
			return columns.map(
				(col, row) => ({
					row,
					col
				}));
		}
		function generateRegions(size, solution) {
			const regions = Array.from({
				length: size
			}, () => Array(size).fill(-1));
			const frontier = [];
			solution.forEach(
				(cat, region) => {
					regions[cat.row][
						cat.col
					] = region;
					frontier.push({
						row: cat.row,
						col: cat.col,
						region
					});
				});
			const remaining = new Set();
			for (let row = 0; row < size; row++) {
				for (let col = 0; col < size; col++) {
					if (regions[row][col] === -1) {
						remaining.add(key(row, col));
					}
				}
			}
			while (remaining.size > 0) {
				if (frontier.length === 0) {
					return null;
				}
				const frontierIndex = Math.floor(Math.random() * frontier.length);
				const current = frontier[frontierIndex];
				const directions = shuffle([[-1, 0], [1, 0], [0, -1], [0, 1]]);
				let expanded = false;
				for (const [dr, dc] of directions) {
					const row = current.row + dr;
					const col = current.col + dc;
					if (row < 0 || row >= size || col < 0 || col >= size) {
						continue;
					}
					const target = key(row, col);
					if (!remaining.has(target)) {
						continue;
					}
					regions[row][col] = current.region;
					remaining.delete(target);
					frontier.push({
						row,
						col,
						region: current.region
					});
					expanded = true;
					break;
				}
				if (!expanded) {
					frontier.splice(frontierIndex, 1);
				}
			}
			return regions;
		}
		function validatePuzzle(size, solution, regions) {
			if (!solution || !regions || solution.length !== size) {
				return false;
			}
			const rows = new Set();
			const columns = new Set();
			const regionIds = new Set();
			for (const cat
				of solution) {
				if (cat.row < 0 || cat.row >= size || cat.col < 0 || cat.col >= size) {
					return false;
				}
				if (rows.has(cat.row)) {
					return false;
				}
				if (columns.has(cat.col)) {
					return false;
				}
				rows.add(cat.row);
				columns.add(cat.col);
				const region = regions[cat.row][
					cat.col
				];
				if (region < 0 || region >= size) {
					return false;
				}
				if (regionIds.has(region)) {
					return false;
				}
				regionIds.add(region);
			}
			for (let i = 0; i < solution.length; i++) {
				for (let j = i + 1; j < solution.length; j++) {
					const a = solution[i];
					const b = solution[j];
					if (Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1) {
						return false;
					}
				}
			}
			if (regionIds.size !== size) {
				return false;
			}
			for (let region = 0; region < size; region++) {
				let count = 0;
				for (const cat
					of solution) {
					if (regions[cat.row][
							cat.col
						] === region) {
						count++;
					}
				}
				if (count !== 1) {
					return false;
				}
			}
			return true;
		}
		function createLevel() {
			state.locked = true;
			state.cats.clear();
			state.crosses.clear();
			state.catSkins.clear();
			let puzzle = null;
			for (let attempt = 0; attempt < 500; attempt++) {
				const solution = generateSolution(state.size);
				if (!solution) {
					continue;
				}
				const regions = generateRegions(state.size, solution);
				if (!regions) {
					continue;
				}
				if (validatePuzzle(state.size, solution, regions)) {
					puzzle = {
						solution,
						regions
					};
					break;
				}
			}
			if (!puzzle) {
				console.error("Impossibile generare un puzzle valido.");
				return;
			}
			state.solution = puzzle.solution;
			state.regions = puzzle.regions;
			state.maxCats = state.solution.length;
			const first = state.solution[Math.floor(Math.random() * state.solution.length)];
			state.cats.add(key(first.row, first.col));
			render();
			updateStats();
			state.startCats = new Set(state.cats);
			state.startSkins = new Map();
			for (const cat of state.cats) {
				createCat(cat);
			}
			state.startSkins = new Map(state.catSkins);
			state.startMaxCats = state.maxCats;
			state.startScore = state.score;
			state.locked = false;
			hideMessage();
		}
		function render() {
			board.innerHTML = "";
			board.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
			board.style.gridTemplateRows = `repeat(${state.size}, 1fr)`;
			for (let row = 0; row < state.size; row++) {
				for (let col = 0; col < state.size; col++) {
					const cell = document.createElement("div");
					cell.className = "cell";
					cell.dataset.row = row;
					cell.dataset.col = col;
					updateCell(cell, row, col);
					board.appendChild(cell);
				}
			}
		}
		function updateCell(cell, row, col) {
			const region = state.regions[row][
				col
			];
			cell.style.backgroundColor = REGION_COLORS[region % REGION_COLORS.length];
			cell.classList.remove("x");
			cell.innerHTML = "";
			const cellKey = key(row, col);
			if (state.cats.has(cellKey)) {
				cell.appendChild(createCat(cellKey));
				return;
			}
			if (state.crosses.has(cellKey)) {
				cell.classList.add("x");
			}
		}
		function createCat(cellKey) {
			const cat = document.createElement("span");
			cat.className = "cat";
			const normal = imageCache.get("res/1.png").cloneNode(true);
			normal.className = "cat-png cat-normal";
			const angry = imageCache.get("res/2.png").cloneNode(true);
			angry.className = "cat-png cat-angry";
			const escape = imageCache.get("res/3.png").cloneNode(true);
			escape.className = "cat-png cat-escape";
			let skin = state.catSkins.get(cellKey);
			if (!skin) {
				skin = FUR_IMAGES[Math.floor(Math.random() * FUR_IMAGES.length)];
				state.catSkins.set(cellKey, skin);
			}
			if (state.skinsEnabled) {
				const cachedFur = imageCache.get(skin);
				if (cachedFur) {
					const fur = cachedFur.cloneNode(true);
					fur.className = "cat-png cat-fur";
					cat.appendChild(fur);
				}
			}
			cat.appendChild(normal);
			cat.appendChild(angry);
			cat.appendChild(escape);
			return cat;
		}
		let clickTimer = null;
		let lastClickRow = null;
		let lastClickCol = null;
		function processCellClick(row, col, doubleClick) {
			const cellKey = key(row, col);
			const cell = getCell(row, col);
			if (state.locked) return;
			if (state.cats.has(cellKey)) {
				state.cats.delete(cellKey);
				state.catSkins.delete(cellKey);
				updateCell(cell, row, col);
				updateStats();
				return;
			}
			if (doubleClick) {
				state.crosses.delete(cellKey);
				placeCat(row, col);
				return;
			}
			if (state.crosses.has(cellKey)) {
				state.crosses.delete(cellKey);
			}
			else {
				state.crosses.add(cellKey);
			}
			updateCell(cell, row, col);
		}
		function handleClick(row, col) {
			if (clickTimer !== null && lastClickRow === row && lastClickCol === col) {
				clearTimeout(clickTimer);
				clickTimer = null;
				processCellClick(row, col, true);
				return;
			}
			lastClickRow = row;
			lastClickCol = col;
			clickTimer = setTimeout(() => {
				clickTimer = null;
				processCellClick(row, col, false);
			}, 250);
		}
		function getCell(row, col) {
			return board.children[row * state.size + col];
		}
		board.addEventListener("click", event => {
			const cell = event.target.closest(".cell");
			if (!cell || !board.contains(cell)) return;
			handleClick(Number(cell.dataset.row), Number(cell.dataset.col));
		});
		function placeCat(row, col) {
			const cellKey = key(row, col);
			if (state.cats.size >= state.maxCats) {
				state.crosses.add(cellKey);
				const cell = getCell(row, col);
				updateCell(cell, row, col);
				return;
			}
			state.cats.add(cellKey);
			const cell = getCell(row, col);
			updateCell(cell, row, col);
			const conflicts = findConflicts(row, col);
			if (conflicts.length > 0) {
				fight(row, col, conflicts);
				return;
			}
			updateStats();
			if (state.cats.size === state.maxCats) {
				winLevel();
			}
		}
		function findConflicts(row, col) {
			const conflicts = [];
			for (const otherKey
				of state.cats) {
				const [otherRow, otherCol] = coordinates(otherKey);
				if (otherRow === row && otherCol === col) {
					continue;
				}
				if (otherRow === row) {
					conflicts.push(otherKey);
					continue;
				}
				if (otherCol === col) {
					conflicts.push(otherKey);
					continue;
				}
				if (state.regions[otherRow][
						otherCol
					] === state.regions[row][
						col
					]) {
					conflicts.push(otherKey);
					continue;
				}
				if (Math.abs(otherRow - row) <= 1 && Math.abs(otherCol - col) <= 1) {
					conflicts.push(otherKey);
				}
			}
			return conflicts;
		}
		function fight(newRow, newCol, conflicts) {
			state.locked = true;
			const newKey = key(newRow, newCol);
			for (const conflictKey
				of conflicts) {
				const [row, col] = coordinates(conflictKey);
				const cell = getCell(row, col);
				const cat = cell?.querySelector(".cat");
				if (!cat) {
					continue;
				}
				cat.classList.remove("stays-fighting");
				void cat.offsetWidth;
				cat.classList.add("stays-fighting");
				setTimeout(() => {
					cat.classList.remove("stays-fighting");
				}, 700);
			}
			const newCell = getCell(newRow, newCol);
			const newCat = newCell?.querySelector(".cat");
			if (newCat) {
				newCat.classList.remove("running-away");
				void newCat.offsetWidth;
				newCat.classList.add("running-away");
			}
			showMessage("Un gatto è fuggito");
			setTimeout(() => {
				if (!state.cats.has(newKey)) {
					return;
				}
				state.cats.delete(newKey);
				state.catSkins.delete(newKey);
				state.crosses.add(newKey);
				state.maxCats--;
				state.locked = false;
				updateCell(newCell, newRow, newCol);
				updateStats();
				if (state.cats.size === state.maxCats) {
					winLevel();
					return;
				}
			}, 1150);
		}
		function useHelp() {
			if (state.locked) {
				return;
			}
			const cats = [...state.cats];
			for (const catKey
				of cats) {
				const [catRow, catCol] = coordinates(catKey);
				for (let col = 0; col < state.size; col++) {
					const targetKey = key(catRow, col);
					if (state.cats.has(targetKey)) {
						continue;
					}
					state.crosses.add(targetKey);
				}
				for (let row = 0; row < state.size; row++) {
					const targetKey = key(row, catCol);
					if (state.cats.has(targetKey)) {
						continue;
					}
					state.crosses.add(targetKey);
				}
				for (let dr = -1; dr <= 1; dr++) {
					for (let dc = -1; dc <= 1; dc++) {
						if (dr === 0 && dc === 0) {
							continue;
						}
						const row = catRow + dr;
						const col = catCol + dc;
						if (row < 0 || row >= state.size || col < 0 || col >= state.size) {
							continue;
						}
						const targetKey = key(row, col);
						if (state.cats.has(targetKey)) {
							continue;
						}
						state.crosses.add(targetKey);
					}
				}
			}
			for (const catKey of cats) {
				const [r, c] = coordinates(catKey);
				const region = state.regions[r][c];
				for (let row = 0; row < state.size; row++) {
					for (let col = 0; col < state.size; col++) {
						const k = key(row, col);
						if (state.regions[row][col] === region && !state.cats.has(k)) state.crosses.add(k);
					}
				}
			}
			render();
			showMessage("Caselle eliminate");
		}
		function resetLevel() {
			state.locked = false;
			state.cats = new Set(state.startCats);
			state.catSkins = new Map(state.startSkins);
			state.maxCats = state.startMaxCats;
			state.score = state.startScore;
			state.crosses.clear();
			nextButton.classList.remove("active");
			hideMessage();
			render();
			updateStats();
			closeOverlay(levelOverlay);
			showMessage("Livello ripristinato");
		}
		function hideMessage() {
			messageElement.classList.remove("show");
			messageElement.textContent = "";
		}
		function showMessage(text) {
			const rect = board.getBoundingClientRect();
			messageElement.style.top = (rect.bottom - 50) + "px";
			messageElement.textContent = text;
			messageElement.classList.remove("show");
			void messageElement.offsetWidth;
			messageElement.classList.add("show");
		}
		function openOverlay(overlay) {
			overlay.classList.add("open");
			overlay.setAttribute("aria-hidden", "false");
		}
		function closeOverlay(overlay) {
			overlay.classList.remove("open");
			overlay.setAttribute("aria-hidden", "true");
		}
		infoButton.addEventListener("click", () => {
			openOverlay(infoOverlay);
		});
		closeInfo.addEventListener("click", () => {
			closeOverlay(infoOverlay);
		});
		helpButton.addEventListener("click", useHelp);
		resetButton.addEventListener("click", resetLevel);
		function winLevel() {
			state.locked = true;
			if (!currentCatsAreValid()) {
				state.locked = false;
				return;
			}
			const gained = state.cats.size * CONFIG.pointsPerCat;
			state.score += gained;
			updateStats();
			openLevelPopup();
		}
		function currentCatsAreValid() {
			if (state.cats.size !== state.maxCats) {
				return false;
			}
			const cats = [...state.cats];
			for (let i = 0; i < cats.length; i++) {
				const [rowA, colA] = coordinates(cats[i]);
				for (let j = i + 1; j < cats.length; j++) {
					const [rowB, colB] = coordinates(cats[j]);
					if (rowA === rowB) {
						return false;
					}
					if (colA === colB) {
						return false;
					}
					if (state.regions[rowA][
							colA
						] === state.regions[rowB][
							colB
						]) {
						return false;
					}
					if (Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1) {
						return false;
					}
				}
			}
			return true;
		}
		function updateStats() {
			levelElement.textContent = state.level;
			scoreElement.textContent = state.score;
			catsElement.textContent = `${state.cats.size} / ${state.maxCats}`;
		}
		function openLevelPopup() {
			openOverlay(levelOverlay);
			nextButton.classList.add("active");
		}
		function nextLevel() {
			closeOverlay(levelOverlay);
			state.level++;
			state.size = Math.min(CONFIG.maxSize, CONFIG.startSize + state.level - 1);
			nextButton.classList.remove("active");
			createLevel();
			if (state.level === 10) {
				setTimeout(() => {
					openOverlay(congratsOverlay);
				}, 100);
			}
		}
		closeCongrats.addEventListener("click", () => {
			closeOverlay(congratsOverlay);
		});
		nextButton.addEventListener("click", () => {
			if (nextButton.classList.contains("active")) {
				nextLevel();
			}
			else {
				showMessage("Completa il livello per continuare");;
			}
		});
		nextLevelButton.addEventListener("click", nextLevel);
		closeLevelPopup.addEventListener("click", () => {
			closeOverlay(levelOverlay);
		});
		const themeButton = document.getElementById("themeButton");
		if (localStorage.getItem("miaodoku-theme") === "light") {
			document.body.classList.add("light");
		}
		themeButton.addEventListener("click", () => {
			document.body.classList.toggle("light");
			localStorage.setItem("miaodoku-theme", document.body.classList.contains("light") ? "light" : "dark");
			showMessage(document.body.classList.contains("light") ? "Tema chiaro" : "Tema scuro");
		});
		skinButton.addEventListener("click", () => {
			state.skinsEnabled = !state.skinsEnabled;
			render();
			showMessage(state.skinsEnabled ? "Skin attivate" : "Skin disattivate");
		});
		document.addEventListener("contextmenu", event => event.preventDefault());
		document.addEventListener("dragstart", event => event.preventDefault());
		document.addEventListener("drag", event => event.preventDefault());
		document.addEventListener("selectstart", event => event.preventDefault());
		window.addEventListener("load", async () => {
			function updateLoading() {
				loaded++;
				const percent = loaded / files.length * 100;
				progress.style.width = percent + "%";
				loadingText.style.backgroundImage = `linear-gradient(to right, var(--background) 0%, var(--background) ${percent}%, var(--text) ${percent}%, var(--text) 100%)`;
			}
			const files = ["res/C.png", "res/X.png", "res/1.png", "res/2.png", "res/3.png", "res/4.png", "res/5.png", "res/6.png", "res/7.png", "res/8.png", "res/9.png", "res/10.png", "res/11.png", "res/12.png", "res/13.png", "res/14.png", "res/15.png", "res/L.png"];
			const progress = document.querySelector(".loading-progress");
			const loadingText = document.querySelector(".loading-text");
			let loaded = 0;
			await Promise.all(
				files.map(src => new Promise(resolve => {
					const img = new Image();
					img.onload = async () => {
						try {
							await img.decode();
						}
						catch(e) {
						}
						imageCache.set(src, img);
						updateLoading();
						resolve();
					};
					img.onerror = () => {
						updateLoading();
						resolve();
					};
					img.src = src;
				}))
			);
			createLevel();
			setTimeout(() => {
				document.getElementById("loadingScreen").style.display = "none";
			}, 300);
		});