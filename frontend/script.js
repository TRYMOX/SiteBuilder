let state = { name: 'Sans titre', theme: THEMES[0].id, blocks: [], selectedId: null };

// historique annuler/rétablir : pile d'instantanés complets de state.blocks
// (voir pushHistory/undo/redo) — plus simple et plus robuste qu'un suivi
// mutation par mutation, et couvre automatiquement tout futur champ de bloc
let historyStack = [];
let historyIndex = -1;
let restoringHistory = false;
// vrai pendant un glisser (déplacement/redimensionnement) : bloque les
// raccourcis clavier pour éviter toute interférence avec le geste en cours
let gestureActive = false;
// presse-papiers interne (copier/couper/coller de blocs) — pasteCount permet
// à des collages répétés de décaler chaque copie plutôt que de les empiler
// exactement au même endroit
let clipboardBlock = null;
let pasteCount = 0;

const HISTORY_LIMIT = 50;
const DUPLICATE_OFFSET = 20;
const SNAP_THRESHOLD = 6;
const NUDGE_STEP = 1;
const NUDGE_STEP_SHIFT = 10;

// liste affichée dans le panneau "Raccourcis" (bouton de la barre du haut)
const SHORTCUTS = [
  ['Ctrl+Z', 'Annuler'],
  ['Ctrl+Y / Ctrl+Maj+Z', 'Rétablir'],
  ['Ctrl+C', 'Copier le bloc sélectionné'],
  ['Ctrl+X', 'Couper le bloc sélectionné'],
  ['Ctrl+V', 'Coller'],
  ['Ctrl+D', 'Dupliquer le bloc sélectionné'],
  ['Suppr / Retour arrière', 'Supprimer le bloc sélectionné'],
  ['Flèches', 'Déplacer le bloc sélectionné (1px)'],
  ['Maj + Flèches', 'Déplacer le bloc sélectionné (10px)'],
  ['Échap', 'Désélectionner / fermer ce panneau'],
];

const canvasEl = document.getElementById('pageCanvas');
const paletteListEl = document.getElementById('paletteList');
const propsPanelEl = document.getElementById('propsPanel');
const canvasHintEl = document.getElementById('canvasHint');
const themeSelectEl = document.getElementById('themeSelect');
const loadSelectEl = document.getElementById('loadSelect');
const projectNameEl = document.getElementById('projectName');

const ALIGN_OPTIONS = [['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']];

const PROP_SCHEMAS = {
  heading: [
    { key: 'text', label: 'Texte', type: 'textarea' },
    { key: 'level', label: 'Niveau', type: 'select', numeric: true, options: [[1, 'H1 (grand titre)'], [2, 'H2'], [3, 'H3']] },
    { key: 'align', label: 'Alignement', type: 'select', options: ALIGN_OPTIONS },
    { key: 'style', label: 'Style', type: 'select', options: [['default', 'Normal'], ['accent', 'Couleur accent'], ['underline', 'Soulignement accent']] },
  ],
  paragraph: [
    { key: 'text', label: 'Texte', type: 'textarea' },
    { key: 'align', label: 'Alignement', type: 'select', options: ALIGN_OPTIONS },
    { key: 'style', label: 'Style', type: 'select', options: [['default', 'Normal'], ['muted', 'Estompé'], ['lead', 'Intro (plus grand)']] },
  ],
  button: [
    { key: 'text', label: 'Texte du bouton', type: 'text' },
    { key: 'href', label: 'Lien (URL)', type: 'text' },
    { key: 'style', label: 'Style', type: 'select', options: [['primary', 'Plein'], ['secondary', 'Contour'], ['ghost', 'Texte seul']] },
  ],
  image: [
    { key: 'src', label: "URL de l'image", type: 'text' },
    { key: 'alt', label: 'Texte alternatif', type: 'text' },
    { key: 'style', label: 'Forme', type: 'select', options: [['default', 'Coins arrondis (thème)'], ['square', 'Coins carrés'], ['circle', 'Cercle']] },
  ],
  section: [
    { key: 'background', label: 'Couleur', type: 'color' },
    { key: 'padding', label: 'Hauteur', type: 'select', options: [['sm', 'Petite'], ['md', 'Moyenne'], ['lg', 'Grande']] },
    { key: 'style', label: 'Style', type: 'select', options: [['solid', 'Plein'], ['outline', 'Contour'], ['gradient', 'Dégradé (accent)']] },
  ],
  quote: [
    { key: 'text', label: 'Citation', type: 'textarea' },
    { key: 'author', label: 'Auteur (optionnel)', type: 'text' },
    { key: 'style', label: 'Style', type: 'select', options: [['default', 'Normal'], ['accent-bar', 'Barre accent'], ['centered', 'Centré']] },
  ],
  list: [
    { key: 'items', label: 'Éléments (un par ligne)', type: 'list-items' },
    { key: 'style', label: 'Style', type: 'select', options: [['bullet', 'Puces'], ['numbered', 'Numéroté'], ['check', 'Coches']] },
  ],
  divider: [
    { key: 'style', label: 'Style', type: 'select', options: [['solid', 'Trait plein'], ['dashed', 'Tirets'], ['dotted', 'Pointillés']] },
  ],
  card: [
    { key: 'title', label: 'Titre', type: 'text' },
    { key: 'text', label: 'Texte', type: 'textarea' },
    { key: 'style', label: 'Style', type: 'select', options: [['default', 'Normal'], ['bordered', 'Avec bordure'], ['shadow', 'Avec ombre']] },
  ],
  columns: [
    { key: 'leftTitle', label: 'Titre (colonne 1)', type: 'text' },
    { key: 'leftText', label: 'Texte (colonne 1)', type: 'textarea' },
    { key: 'rightTitle', label: 'Titre (colonne 2)', type: 'text' },
    { key: 'rightText', label: 'Texte (colonne 2)', type: 'textarea' },
    { key: 'style', label: 'Style', type: 'select', options: [['default', 'Normal'], ['divided', 'Avec séparateur']] },
  ],
  video: [
    { key: 'url', label: "URL de la vidéo (YouTube ou lien d'intégration)", type: 'text' },
  ],
};

function findBlock(id) {
  return state.blocks.find(b => b.id === id);
}

// ---------- Palette ----------

function renderPalette() {
  paletteListEl.innerHTML = Object.entries(BLOCK_DEFS).map(([type, def]) => `
    <div class="palette-item" draggable="true" data-type="${type}">
      <span class="palette-item-icon">${def.icon}</span>${def.label}
    </div>
  `).join('');

  paletteListEl.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/x-block-type', item.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
    });
  });
}

function renderThemeSelect() {
  themeSelectEl.innerHTML = THEMES.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  themeSelectEl.value = state.theme;
}

// ---------- Canevas ----------

function render() {
  renderCanvas();
  renderProps();
}

function renderCanvas() {
  applyTheme(canvasEl, state.theme);
  canvasHintEl.style.display = state.blocks.length ? 'none' : 'block';

  canvasEl.innerHTML = state.blocks.map(block => `
    <div class="block-wrapper${block.id === state.selectedId ? ' selected' : ''}${block.locked ? ' locked' : ''}" data-id="${block.id}">
      <div class="block-controls">
        <button type="button" class="block-control-btn${block.locked ? ' locked' : ''}" data-action="lock" title="${block.locked ? 'Déverrouiller' : 'Verrouiller'}">L</button>
        <button type="button" class="block-control-btn" data-action="duplicate" title="Dupliquer (Ctrl+D)">⧉</button>
        <button type="button" class="block-control-btn" data-action="delete" title="Supprimer">×</button>
      </div>
      <div class="selection-frame"></div>
      <div class="resize-handles">
        <div class="resize-handle rh-left" data-dir="left" draggable="false"></div>
        <div class="resize-handle rh-right" data-dir="right" draggable="false"></div>
        <div class="resize-handle rh-top" data-dir="top" draggable="false"></div>
        <div class="resize-handle rh-bottom" data-dir="bottom" draggable="false"></div>
      </div>
      ${renderBlockContent(block)}
    </div>
  `).join('');

  canvasEl.querySelectorAll('.block-wrapper').forEach(wrapper => {
    const id = wrapper.dataset.id;
    // navigation bloquée : le bouton "Bouton" rend un vrai <a href>, sans
    // ça un clic dans l'éditeur suivrait le lien au lieu de sélectionner
    wrapper.addEventListener('click', (e) => {
      if (e.target.closest('a')) e.preventDefault();
    });
    wrapper.addEventListener('mousedown', (e) => {
      if (e.target.closest('.block-control-btn, .resize-handle')) return;
      startMove(e, id);
    });
    wrapper.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBlock(id);
    });
    wrapper.querySelector('[data-action="lock"]').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLock(id);
    });
    wrapper.querySelector('[data-action="duplicate"]').addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateBlock(id);
    });
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => startResize(e, id, handle.dataset.dir));
    });
    positionOverlays(wrapper);
  });

  updateCanvasHeight();
  ensureSnapGuides();
}

// aligne le cadre de sélection, les poignées et le bouton de suppression sur
// les bords réels du bloc (block.x/y/width + hauteur mesurée, car elle peut
// être 'auto') — .block-wrapper n'a lui-même aucun positionnement, donc ces
// coordonnées sont directement celles de .page-canvas
function positionOverlays(wrapper) {
  const block = findBlock(wrapper.dataset.id);
  const content = wrapper.querySelector('.blk-resizable');
  if (!block || !content) return;
  const width = block.width || 400;
  const height = content.offsetHeight;
  const handles = wrapper.querySelector('.resize-handles');
  const frame = wrapper.querySelector('.selection-frame');
  const controls = wrapper.querySelector('.block-controls');
  for (const el of [handles, frame]) {
    if (!el) continue;
    el.style.left = block.x + 'px';
    el.style.top = block.y + 'px';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
  }
  if (controls) {
    controls.style.left = (block.x + width - 14) + 'px';
    controls.style.top = (block.y - 12) + 'px';
  }
}

// agrandit le canevas pour qu'il contienne toujours tous les blocs, quelle
// que soit leur position (mesuré, pas déduit de block.height qui peut être
// 'auto')
function updateCanvasHeight() {
  let maxBottom = 400;
  canvasEl.querySelectorAll('.block-wrapper').forEach(w => {
    const content = w.querySelector('.blk-resizable');
    if (!content) return;
    maxBottom = Math.max(maxBottom, content.offsetTop + content.offsetHeight + 60);
  });
  canvasEl.style.minHeight = maxBottom + 'px';
}

// glisser le corps d'un bloc le déplace n'importe où sur le canevas ; un
// bloc verrouillé se sélectionne toujours mais ne peut pas être déplacé
function startMove(e, id) {
  const block = findBlock(id);
  if (block.locked) { selectBlock(id); return; }
  e.preventDefault();
  gestureActive = true;
  selectBlock(id);
  const wrapper = canvasEl.querySelector(`.block-wrapper[data-id="${id}"]`);
  const content = wrapper.querySelector('.blk-resizable');
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = block.x;
  const startTop = block.y;
  // cibles d'aimantation calculées une seule fois au début du geste (les
  // autres blocs ne bougent pas pendant qu'on déplace celui-ci)
  const snapTargets = computeSnapTargets(id);

  function onMove(ev) {
    const candX = Math.max(0, startLeft + (ev.clientX - startX));
    const candY = Math.max(0, startTop + (ev.clientY - startY));
    const width = block.width || 400;
    const height = content.offsetHeight;

    const xMatch = bestSnapMatch(
      [['left', candX], ['center', candX + width / 2], ['right', candX + width]],
      snapTargets.xs, SNAP_THRESHOLD
    );
    block.x = Math.max(0, xMatch ? candX + (xMatch.target - xMatch.value) : candX);

    const yMatch = bestSnapMatch(
      [['top', candY], ['center', candY + height / 2], ['bottom', candY + height]],
      snapTargets.ys, SNAP_THRESHOLD
    );
    block.y = Math.max(0, yMatch ? candY + (yMatch.target - yMatch.value) : candY);

    content.style.left = block.x + 'px';
    content.style.top = block.y + 'px';
    positionOverlays(wrapper);
    updateCanvasHeight();
    updateSnapGuides(xMatch ? xMatch.target : null, yMatch ? yMatch.target : null);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    hideSnapGuides();
    gestureActive = false;
    pushHistory();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// glisser une poignée ajuste width/height (px) depuis n'importe quel côté ;
// gauche/haut déplacent aussi x/y pour garder le bord opposé fixe, comme
// dans un éditeur de design classique
function startResize(e, id, dir) {
  e.preventDefault();
  e.stopPropagation();
  gestureActive = true;
  const block = findBlock(id);
  const wrapper = canvasEl.querySelector(`.block-wrapper[data-id="${id}"]`);
  const content = wrapper.querySelector('.blk-resizable');
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = block.width || 400;
  const startHeight = block.height || content.getBoundingClientRect().height;
  const startLeft = block.x;
  const startTop = block.y;
  // un seul bord bouge par poignée, pas besoin de comparer gauche/centre/droite
  const snapTargets = computeSnapTargets(id);

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (dir === 'right') {
      const rightEdge = startLeft + Math.max(40, Math.round(startWidth + dx));
      const snapped = findSnap(rightEdge, snapTargets.xs, SNAP_THRESHOLD);
      block.width = Math.max(40, (snapped ?? rightEdge) - block.x);
      updateSnapGuides(snapped, null);
    } else if (dir === 'left') {
      const rawLeft = Math.max(0, Math.round(startLeft + dx));
      const snapped = findSnap(rawLeft, snapTargets.xs, SNAP_THRESHOLD);
      const finalLeft = snapped ?? rawLeft;
      block.width = Math.max(40, (startLeft + startWidth) - finalLeft);
      block.x = finalLeft;
      updateSnapGuides(snapped, null);
    } else if (dir === 'bottom') {
      const bottomEdge = startTop + Math.max(20, Math.round(startHeight + dy));
      const snapped = findSnap(bottomEdge, snapTargets.ys, SNAP_THRESHOLD);
      block.height = Math.max(20, (snapped ?? bottomEdge) - block.y);
      updateSnapGuides(null, snapped);
    } else if (dir === 'top') {
      const rawTop = Math.max(0, Math.round(startTop + dy));
      const snapped = findSnap(rawTop, snapTargets.ys, SNAP_THRESHOLD);
      const finalTop = snapped ?? rawTop;
      block.height = Math.max(20, (startTop + startHeight) - finalTop);
      block.y = finalTop;
      updateSnapGuides(null, snapped);
    }
    updateBlockDom(id);
    syncSizeFields(block);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    hideSnapGuides();
    gestureActive = false;
    pushHistory();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function toggleLock(id) {
  const block = findBlock(id);
  block.locked = !block.locked;
  pushHistory();
  render();
}

// copie un bloc (tous ses réglages) juste après l'original dans state.blocks
// — pas en fin de tableau, sinon il saute visuellement au-dessus de tous les
// autres blocs (l'ordre du tableau pilote l'empilement, voir bringToFront)
function duplicateBlock(id) {
  const block = findBlock(id);
  if (!block) return;
  const [copy] = cloneBlocks([block]);
  copy.id = makeBlockId();
  copy.x = Math.max(0, block.x + DUPLICATE_OFFSET);
  copy.y = Math.max(0, block.y + DUPLICATE_OFFSET);
  const idx = state.blocks.findIndex(b => b.id === id);
  state.blocks.splice(idx + 1, 0, copy);
  state.selectedId = copy.id;
  pushHistory();
  render();
}

// ---------- Copier / Couper / Coller ----------

function copySelected() {
  if (!state.selectedId) return;
  const block = findBlock(state.selectedId);
  if (!block) return;
  clipboardBlock = cloneBlocks([block])[0];
  pasteCount = 0;
}

function cutSelected() {
  if (!state.selectedId) return;
  copySelected();
  deleteBlock(state.selectedId);
}

// colle le bloc copié, décalé un peu plus à chaque collage successif
// (cascade) plutôt que de toujours superposer la copie au même endroit
function pasteClipboard() {
  if (!clipboardBlock) return;
  pasteCount++;
  const [copy] = cloneBlocks([clipboardBlock]);
  copy.id = makeBlockId();
  copy.x = Math.max(0, clipboardBlock.x + DUPLICATE_OFFSET * pasteCount);
  copy.y = Math.max(0, clipboardBlock.y + DUPLICATE_OFFSET * pasteCount);
  state.blocks.push(copy);
  state.selectedId = copy.id;
  pushHistory();
  render();
}

// dépose d'un bloc depuis la palette, à l'endroit précis du curseur
function handleDrop(e) {
  const newType = e.dataTransfer.getData('text/x-block-type');
  if (!newType) return;
  const rect = canvasEl.getBoundingClientRect();
  const block = createBlock(newType);
  block.x = Math.max(0, Math.round(e.clientX - rect.left - block.width / 2));
  block.y = Math.max(0, Math.round(e.clientY - rect.top - 20));
  state.blocks.push(block);
  state.selectedId = block.id;
  pushHistory();
  render();
}

canvasEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  canvasEl.classList.add('drag-over');
});
canvasEl.addEventListener('dragleave', (e) => {
  if (e.target === canvasEl) canvasEl.classList.remove('drag-over');
});
canvasEl.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasEl.classList.remove('drag-over');
  handleDrop(e);
});

function selectBlock(id) {
  state.selectedId = id;
  canvasEl.querySelectorAll('.block-wrapper').forEach(w => {
    w.classList.toggle('selected', w.dataset.id === id);
  });
  const wrapper = canvasEl.querySelector(`.block-wrapper[data-id="${id}"]`);
  if (wrapper) positionOverlays(wrapper);
  renderProps();
}

function deleteBlock(id) {
  state.blocks = state.blocks.filter(b => b.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  pushHistory();
  render();
}

// remplace uniquement le contenu rendu d'un bloc (garde le panneau de
// propriétés et son focus intacts pendant la frappe)
function updateBlockDom(id) {
  const wrapper = canvasEl.querySelector(`.block-wrapper[data-id="${id}"]`);
  if (!wrapper) return;
  const controls = wrapper.querySelector('.block-controls');
  const frame = wrapper.querySelector('.selection-frame');
  const handles = wrapper.querySelector('.resize-handles');
  wrapper.innerHTML = '';
  wrapper.appendChild(controls);
  wrapper.appendChild(frame);
  wrapper.appendChild(handles);
  wrapper.insertAdjacentHTML('beforeend', renderBlockContent(findBlock(id)));
  positionOverlays(wrapper);
  updateCanvasHeight();
}

// ---------- Panneau de propriétés ----------

function renderProps() {
  const block = findBlock(state.selectedId);
  if (!block) {
    propsPanelEl.className = 'sb-props-empty';
    propsPanelEl.textContent = 'Sélectionnez un bloc pour modifier ses propriétés.';
    return;
  }
  propsPanelEl.className = '';

  const schema = PROP_SCHEMAS[block.type];
  propsPanelEl.innerHTML = schema.map(field => renderPropField(block, field)).join('')
    + renderAppearanceFields(block)
    + renderSizeFields(block)
    + `<button type="button" class="prop-delete-btn" id="propsDeleteBtn">Supprimer ce bloc</button>`;

  // chaque liaison est indépendante (élément absent ou erreur ponctuelle
  // ignorés individuellement) pour qu'un seul champ défaillant ne bloque
  // jamais la liaison des autres champs du panneau
  // les champs à validation immédiate (select/checkbox, événement "change")
  // poussent un instantané dès la validation ; les champs à frappe continue
  // (texte/nombre/couleur, événement "input") ne poussent qu'au blur, sinon
  // chaque touche créerait sa propre entrée d'historique (Ctrl+Z ne devrait
  // annuler qu'une modification complète, pas caractère par caractère)
  schema.forEach(field => {
    const input = document.getElementById(`prop-${field.key}`);
    if (!input) { console.error(`champ de propriété introuvable : prop-${field.key}`); return; }
    const isContinuous = field.type === 'text' || field.type === 'textarea' || field.type === 'list-items';
    input.addEventListener(isContinuous ? 'input' : 'change', () => {
      try {
        if (field.type === 'list-items') {
          block[field.key] = input.value.split('\n');
        } else {
          block[field.key] = field.numeric ? Number(input.value) : input.value;
        }
        updateBlockDom(block.id);
        if (!isContinuous) pushHistory();
      } catch (err) {
        console.error(`échec de mise à jour du champ ${field.key} :`, err);
      }
    });
    if (isContinuous) input.addEventListener('blur', () => pushHistory());
  });

  bindOptionalColor(block, 'bgColor');
  bindOptionalColor(block, 'textColor');
  bindOptionalColor(block, 'borderColor');
  bindSizeField('prop-radius', (b, value) => { b.radius = value === '' ? null : Math.max(0, Number(value)); });
  bindSizeField('prop-opacity', (b, value) => { b.opacity = value === '' ? 100 : Math.min(100, Math.max(0, Number(value))); });

  const shadowSelect = document.getElementById('prop-shadow');
  if (shadowSelect) {
    shadowSelect.addEventListener('change', () => {
      block.shadow = shadowSelect.value;
      updateBlockDom(block.id);
      pushHistory();
    });
  }

  bindSizeField('prop-width', (b, value) => { b.width = Math.max(40, Number(value) || 400); });
  bindSizeField('prop-height', (b, value) => { b.height = value ? Math.max(20, Number(value)) : null; });

  const lockedInput = document.getElementById('prop-locked');
  if (lockedInput) {
    lockedInput.addEventListener('change', (e) => {
      block.locked = e.target.checked;
      pushHistory();
      render();
    });
  }

  const frontBtn = document.getElementById('propsFrontBtn');
  if (frontBtn) frontBtn.addEventListener('click', () => bringToFront(block.id));
  const backBtn = document.getElementById('propsBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => sendToBack(block.id));

  const deleteBtn = document.getElementById('propsDeleteBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => deleteBlock(block.id));

  function bindSizeField(id, apply) {
    const input = document.getElementById(id);
    if (!input) { console.error(`champ de taille introuvable : ${id}`); return; }
    input.addEventListener('blur', () => pushHistory());
    input.addEventListener('input', (e) => {
      try {
        apply(block, e.target.value);
        updateBlockDom(block.id);
      } catch (err) {
        console.error(`échec de mise à jour de ${id} :`, err);
      }
    });
  }

  // case "Activer" + sélecteur de couleur : la case pilote si block[key] vaut
  // null (pas de surcharge) ou la couleur choisie
  function bindOptionalColor(b, key) {
    const checkbox = document.getElementById(`prop-${key}-enabled`);
    const colorInput = document.getElementById(`prop-${key}`);
    if (!checkbox || !colorInput) { console.error(`champ couleur introuvable : ${key}`); return; }
    checkbox.addEventListener('change', () => {
      colorInput.disabled = !checkbox.checked;
      b[key] = checkbox.checked ? colorInput.value : null;
      updateBlockDom(b.id);
      pushHistory();
    });
    colorInput.addEventListener('input', () => {
      if (!checkbox.checked) return;
      b[key] = colorInput.value;
      updateBlockDom(b.id);
    });
    colorInput.addEventListener('blur', () => pushHistory());
  }
}

// section Apparence (couleurs, rayon, ombre, opacité) commune à tous les
// blocs, indépendamment de leur type
function renderAppearanceFields(block) {
  return `
    <div class="prop-section-title">Apparence</div>
    ${renderOptionalColor(block, 'bgColor', 'Fond')}
    ${renderOptionalColor(block, 'textColor', 'Texte')}
    ${renderOptionalColor(block, 'borderColor', 'Bordure')}
    <div class="prop-field-row">
      <div class="prop-field"><label>Rayon (px)</label><input type="number" id="prop-radius" min="0" placeholder="thème" value="${block.radius ?? ''}"></div>
      <div class="prop-field"><label>Opacité (%)</label><input type="number" id="prop-opacity" min="0" max="100" value="${block.opacity ?? 100}"></div>
    </div>
    <div class="prop-field">
      <label>Ombre</label>
      <select id="prop-shadow">
        ${Object.keys(SHADOW_LABELS).map(s => `<option value="${s}"${(block.shadow || 'none') === s ? ' selected' : ''}>${escapeHtml(SHADOW_LABELS[s])}</option>`).join('')}
      </select>
    </div>
  `;
}

function renderOptionalColor(block, key, label) {
  const enabled = block[key] != null;
  const value = block[key] || '#000000';
  return `
    <div class="prop-field">
      <label>${escapeHtml(label)}</label>
      <div class="prop-color-row">
        <input type="checkbox" id="prop-${key}-enabled"${enabled ? ' checked' : ''}>
        <input type="color" id="prop-${key}" value="${value}"${enabled ? '' : ' disabled'}>
      </div>
    </div>
  `;
}

// même barre Largeur/Hauteur/Verrouillé/ordre d'empilement pour tous les
// blocs, indépendamment de leur type — s'affiche en plus des champs propres
// au type (schema) et de la section Apparence
function renderSizeFields(block) {
  return `
    <div class="prop-field-row">
      <div class="prop-field"><label>Largeur (px)</label><input type="number" id="prop-width" min="40" value="${block.width || 400}"></div>
      <div class="prop-field"><label>Hauteur (px)</label><input type="number" id="prop-height" min="20" placeholder="auto" value="${block.height || ''}"></div>
    </div>
    <label class="prop-checkbox"><input type="checkbox" id="prop-locked"${block.locked ? ' checked' : ''}> Verrouillé (position et taille figées)</label>
    <div class="prop-field-row">
      <button type="button" class="sb-btn" id="propsFrontBtn">Premier plan</button>
      <button type="button" class="sb-btn" id="propsBackBtn">Arrière-plan</button>
    </div>
  `;
}

// déplace le bloc en fin/début de state.blocks — l'ordre du tableau pilote
// l'ordre de rendu, donc l'empilement visuel des blocs qui se chevauchent
// (pas de z-index à gérer séparément)
function bringToFront(id) {
  const idx = state.blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const [block] = state.blocks.splice(idx, 1);
  state.blocks.push(block);
  pushHistory();
  render();
}

function sendToBack(id) {
  const idx = state.blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const [block] = state.blocks.splice(idx, 1);
  state.blocks.unshift(block);
  pushHistory();
  render();
}

// garde les champs Largeur/Hauteur à jour pendant un glisser de poignée,
// sans reconstruire tout le panneau (perdrait le focus/la frappe en cours)
function syncSizeFields(block) {
  const widthInput = document.getElementById('prop-width');
  const heightInput = document.getElementById('prop-height');
  if (widthInput) widthInput.value = block.width || 400;
  if (heightInput) heightInput.value = block.height || '';
}

function renderPropField(block, field) {
  const value = block[field.key];
  if (field.type === 'list-items') {
    return `<div class="prop-field"><label>${escapeHtml(field.label)}</label><textarea id="prop-${field.key}" placeholder="Un élément par ligne">${escapeHtml(value.join('\n'))}</textarea></div>`;
  }
  if (field.type === 'textarea') {
    return `<div class="prop-field"><label>${escapeHtml(field.label)}</label><textarea id="prop-${field.key}">${escapeHtml(value)}</textarea></div>`;
  }
  if (field.type === 'select') {
    const opts = field.options.map(([v, l]) => `<option value="${v}"${String(v) === String(value) ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('');
    return `<div class="prop-field"><label>${escapeHtml(field.label)}</label><select id="prop-${field.key}">${opts}</select></div>`;
  }
  if (field.type === 'color') {
    return `<div class="prop-field"><label>${escapeHtml(field.label)}</label><input type="color" id="prop-${field.key}" value="${escapeHtml(value)}"></div>`;
  }
  return `<div class="prop-field"><label>${escapeHtml(field.label)}</label><input type="text" id="prop-${field.key}" value="${escapeHtml(value)}"></div>`;
}

// ---------- Historique (annuler/rétablir) ----------

function snapshot() {
  return { blocks: cloneBlocks(state.blocks), selectedId: state.selectedId };
}

function initHistory() {
  historyStack = [snapshot()];
  historyIndex = 0;
  updateHistoryButtons();
}

// ajoute l'état courant comme nouvelle entrée d'historique — appelé une
// seule fois par action terminée (jamais depuis un mousemove/keydown répété,
// voir startMove/startResize/onGlobalKeyup)
function pushHistory() {
  if (restoringHistory) return;
  const entry = snapshot();
  const last = historyStack[historyIndex];
  // déduplique sur le contenu des blocs (pas selectedId) : un simple clic de
  // sélection sans déplacement ne doit jamais créer d'entrée
  if (last && JSON.stringify(last.blocks) === JSON.stringify(entry.blocks)) return;
  historyStack.length = historyIndex + 1; // efface la branche "refaire"
  historyStack.push(entry);
  if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
  historyIndex = historyStack.length - 1;
  updateHistoryButtons();
}

function applyHistorySnapshot(entry) {
  restoringHistory = true;
  state.blocks = cloneBlocks(entry.blocks);
  state.selectedId = entry.selectedId;
  render();
  restoringHistory = false;
  updateHistoryButtons();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  applyHistorySnapshot(historyStack[historyIndex]);
}

function redo() {
  if (historyIndex >= historyStack.length - 1) return;
  historyIndex++;
  applyHistorySnapshot(historyStack[historyIndex]);
}

function updateHistoryButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.disabled = historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

// ---------- Guides d'alignement / aimantation ----------

// re-crées/ré-attachées à chaque renderCanvas() : celui-ci fait
// canvasEl.innerHTML = ..., ce qui détruirait des guides ajoutées une seule
// fois au démarrage — jamais présentes dans state.blocks, donc jamais dans
// l'export (qui ne lit que state.blocks)
function ensureSnapGuides() {
  let v = document.getElementById('snapGuideV');
  let h = document.getElementById('snapGuideH');
  if (!v) { v = document.createElement('div'); v.id = 'snapGuideV'; v.className = 'snap-guide snap-guide-v'; }
  if (!h) { h = document.createElement('div'); h.id = 'snapGuideH'; h.className = 'snap-guide snap-guide-h'; }
  canvasEl.appendChild(v);
  canvasEl.appendChild(h);
}

function updateSnapGuides(guideX, guideY) {
  const v = document.getElementById('snapGuideV');
  const h = document.getElementById('snapGuideH');
  if (v) { if (guideX != null) { v.style.left = guideX + 'px'; v.style.display = 'block'; } else v.style.display = 'none'; }
  if (h) { if (guideY != null) { h.style.top = guideY + 'px'; h.style.display = 'block'; } else h.style.display = 'none'; }
}

function hideSnapGuides() {
  updateSnapGuides(null, null);
}

// bords/centres de tous les autres blocs + bords/centre du canevas — calculé
// une seule fois au début d'un geste (mousedown), pas à chaque mousemove,
// puisque seul le bloc déplacé/redimensionné bouge pendant son propre geste
function computeSnapTargets(excludeId) {
  const xs = new Set([0, canvasEl.clientWidth, canvasEl.clientWidth / 2]);
  const ys = new Set([0]);
  canvasEl.querySelectorAll('.block-wrapper').forEach(w => {
    if (w.dataset.id === excludeId) return;
    const b = findBlock(w.dataset.id);
    const content = w.querySelector('.blk-resizable');
    if (!b || !content) return;
    const width = b.width || 400;
    const height = content.offsetHeight;
    xs.add(b.x); xs.add(b.x + width); xs.add(b.x + width / 2);
    ys.add(b.y); ys.add(b.y + height); ys.add(b.y + height / 2);
  });
  return { xs: [...xs], ys: [...ys] };
}

function findSnap(value, targets, threshold) {
  let best = null, bestDist = threshold;
  for (const t of targets) {
    const d = Math.abs(value - t);
    if (d <= bestDist) { bestDist = d; best = t; }
  }
  return best;
}

// parmi plusieurs bords candidats (gauche/centre/droite ou haut/centre/bas),
// ne retient que le plus proche d'une cible — jamais plusieurs à la fois
function bestSnapMatch(candidates, targets, threshold) {
  let best = null;
  for (const [label, value] of candidates) {
    const t = findSnap(value, targets, threshold);
    if (t == null) continue;
    const dist = Math.abs(value - t);
    if (!best || dist < best.dist) best = { label, value, target: t, dist };
  }
  return best;
}

// ---------- Raccourcis clavier ----------

function isTypingInField() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// remet à jour la position DOM d'un bloc + ses survols (cadre/poignées) +
// la hauteur du canevas — partagé entre startMove.onMove et le nudge clavier
function syncBlockPositionDom(wrapper, block) {
  const content = wrapper.querySelector('.blk-resizable');
  if (content) {
    content.style.left = block.x + 'px';
    content.style.top = block.y + 'px';
  }
  positionOverlays(wrapper);
  updateCanvasHeight();
}

function onGlobalKeydown(e) {
  if (gestureActive) return;
  const ctrlOrCmd = e.ctrlKey || e.metaKey;

  if (ctrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
    if (isTypingInField()) return; // laisse le undo natif du navigateur agir dans le champ
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if (ctrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
    if (isTypingInField()) return;
    e.preventDefault();
    redo();
    return;
  }
  if (ctrlOrCmd && (e.key === 'c' || e.key === 'C')) {
    if (isTypingInField()) return; // laisse le copier natif du navigateur agir dans le champ
    if (state.selectedId) { e.preventDefault(); copySelected(); }
    return;
  }
  if (ctrlOrCmd && (e.key === 'x' || e.key === 'X')) {
    if (isTypingInField()) return;
    if (state.selectedId) { e.preventDefault(); cutSelected(); }
    return;
  }
  if (ctrlOrCmd && (e.key === 'v' || e.key === 'V')) {
    if (isTypingInField()) return; // laisse le coller natif du navigateur agir dans le champ
    if (clipboardBlock) { e.preventDefault(); pasteClipboard(); }
    return;
  }
  if (ctrlOrCmd && (e.key === 'd' || e.key === 'D')) {
    if (isTypingInField()) return;
    if (state.selectedId) { e.preventDefault(); duplicateBlock(state.selectedId); }
    return;
  }

  if (isTypingInField()) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedId) { e.preventDefault(); deleteBlock(state.selectedId); }
    return;
  }
  if (e.key === 'Escape') {
    const panel = document.getElementById('shortcutsPanel');
    if (panel && !panel.hidden) { toggleShortcutsPanel(false); return; }
    if (state.selectedId) selectBlock(null);
    return;
  }
  if (e.key.startsWith('Arrow')) {
    if (!state.selectedId) return;
    const block = findBlock(state.selectedId);
    if (!block || block.locked) return; // cohérent avec startMove qui refuse de déplacer un bloc verrouillé
    e.preventDefault();
    const step = e.shiftKey ? NUDGE_STEP_SHIFT : NUDGE_STEP;
    if (e.key === 'ArrowLeft') block.x = Math.max(0, block.x - step);
    else if (e.key === 'ArrowRight') block.x = Math.max(0, block.x + step);
    else if (e.key === 'ArrowUp') block.y = Math.max(0, block.y - step);
    else if (e.key === 'ArrowDown') block.y = Math.max(0, block.y + step);
    const wrapper = canvasEl.querySelector(`.block-wrapper[data-id="${block.id}"]`);
    if (wrapper) syncBlockPositionDom(wrapper, block);
  }
}

function onGlobalKeyup(e) {
  // un appui maintenu répète keydown mais keyup ne fire qu'une fois au
  // relâchement : la pression entière ne compte que pour une seule entrée
  // d'historique, comme un geste de glisser
  if (e.key.startsWith('Arrow')) pushHistory();
}

document.addEventListener('keydown', onGlobalKeydown);
document.addEventListener('keyup', onGlobalKeyup);

// panneau de référence listant tous les raccourcis (bouton "Raccourcis" de
// la barre du haut), à la manière du menu Édition de VSCode
function renderShortcutsList() {
  const list = document.getElementById('shortcutsList');
  if (!list) return;
  list.innerHTML = SHORTCUTS.map(([keys, label]) => `
    <li><span class="shortcut-label">${escapeHtml(label)}</span><span class="shortcut-keys">${escapeHtml(keys)}</span></li>
  `).join('');
}

function toggleShortcutsPanel(show) {
  const panel = document.getElementById('shortcutsPanel');
  if (!panel) return;
  panel.hidden = show === undefined ? !panel.hidden : !show;
}

document.getElementById('shortcutsBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleShortcutsPanel();
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('shortcutsPanel');
  if (!panel || panel.hidden) return;
  if (!panel.contains(e.target) && e.target.id !== 'shortcutsBtn') toggleShortcutsPanel(false);
});

// ---------- Thème, sauvegarde, chargement, export ----------

themeSelectEl.addEventListener('change', () => {
  state.theme = themeSelectEl.value;
  applyTheme(canvasEl, state.theme);
});

projectNameEl.addEventListener('input', () => { state.name = projectNameEl.value; });

async function refreshLoadList() {
  const res = await fetch('/api/projects');
  const list = await res.json();
  loadSelectEl.innerHTML = '<option value="">Charger…</option>'
    + list.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
}

loadSelectEl.addEventListener('change', async () => {
  const name = loadSelectEl.value;
  if (!name) return;
  const res = await fetch(`/api/projects/${encodeURIComponent(name)}`);
  if (!res.ok) { alert('Impossible de charger ce projet.'); return; }
  const project = await res.json();
  state = { name: project.name, theme: project.theme, blocks: project.blocks, selectedId: null };
  projectNameEl.value = state.name;
  themeSelectEl.value = state.theme;
  render();
  // charger un autre projet ne doit pas permettre d'annuler vers les blocs
  // du projet précédent — historique repart de zéro sur ce nouvel état
  initHistory();
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const name = projectNameEl.value.trim();
  if (!name) { alert("Donnez un nom au projet avant d'enregistrer."); return; }
  state.name = name;
  const res = await fetch(`/api/projects/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: state.theme, blocks: state.blocks }),
  });
  if (!res.ok) { alert("Échec de l'enregistrement."); return; }
  await refreshLoadList();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const theme = getTheme(state.theme);
  const varsCss = ':root{' + Object.entries(theme.vars).map(([k, v]) => `--page-${k}: ${v};`).join(' ') + '}';
  const blocksHtml = state.blocks.map(renderBlockContent).join('\n');
  const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700&family=Playfair+Display:wght@600;700&family=Space+Grotesk:wght@500;700&family=Pacifico&display=swap');";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(state.name)}</title>
<style>
${fontImport}
${varsCss}
${PAGE_CSS}
</style>
</head>
<body>
<div class="page-canvas">
${blocksHtml}
</div>
</body>
</html>
`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'page'}.html`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Démarrage ----------

// PAGE_CSS (blocks.js) ne stylait jusqu'ici que le document exporté — sans
// cette injection, aucun style de bloc (police, alignement, boutons...) ne
// s'appliquait dans l'éditeur en direct, seulement dans le fichier exporté
function injectPageCss() {
  const style = document.createElement('style');
  style.textContent = PAGE_CSS;
  document.head.appendChild(style);
}

function init() {
  injectPageCss();
  renderPalette();
  renderThemeSelect();
  renderShortcutsList();
  refreshLoadList();
  render();
  initHistory();
}

init();
