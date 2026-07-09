let state = { name: 'Sans titre', theme: THEMES[0].id, blocks: [], selectedId: null };

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
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => startResize(e, id, handle.dataset.dir));
    });
    positionOverlays(wrapper);
  });

  updateCanvasHeight();
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
  selectBlock(id);
  const wrapper = canvasEl.querySelector(`.block-wrapper[data-id="${id}"]`);
  const content = wrapper.querySelector('.blk-resizable');
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = block.x;
  const startTop = block.y;

  function onMove(ev) {
    block.x = Math.max(0, startLeft + (ev.clientX - startX));
    block.y = Math.max(0, startTop + (ev.clientY - startY));
    content.style.left = block.x + 'px';
    content.style.top = block.y + 'px';
    positionOverlays(wrapper);
    updateCanvasHeight();
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
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
  const block = findBlock(id);
  const wrapper = canvasEl.querySelector(`.block-wrapper[data-id="${id}"]`);
  const content = wrapper.querySelector('.blk-resizable');
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = block.width || 400;
  const startHeight = block.height || content.getBoundingClientRect().height;
  const startLeft = block.x;
  const startTop = block.y;

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (dir === 'right') {
      block.width = Math.max(40, Math.round(startWidth + dx));
    } else if (dir === 'left') {
      block.width = Math.max(40, Math.round(startWidth - dx));
      block.x = Math.max(0, Math.round(startLeft + dx));
    } else if (dir === 'bottom') {
      block.height = Math.max(20, Math.round(startHeight + dy));
    } else if (dir === 'top') {
      block.height = Math.max(20, Math.round(startHeight - dy));
      block.y = Math.max(0, Math.round(startTop + dy));
    }
    updateBlockDom(id);
    syncSizeFields(block);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function toggleLock(id) {
  const block = findBlock(id);
  block.locked = !block.locked;
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
  schema.forEach(field => {
    const input = document.getElementById(`prop-${field.key}`);
    if (!input) { console.error(`champ de propriété introuvable : prop-${field.key}`); return; }
    const evtName = field.type === 'text' || field.type === 'textarea' || field.type === 'list-items' ? 'input' : 'change';
    input.addEventListener(evtName, () => {
      try {
        if (field.type === 'list-items') {
          block[field.key] = input.value.split('\n');
        } else {
          block[field.key] = field.numeric ? Number(input.value) : input.value;
        }
        updateBlockDom(block.id);
      } catch (err) {
        console.error(`échec de mise à jour du champ ${field.key} :`, err);
      }
    });
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
    });
  }

  bindSizeField('prop-width', (b, value) => { b.width = Math.max(40, Number(value) || 400); });
  bindSizeField('prop-height', (b, value) => { b.height = value ? Math.max(20, Number(value)) : null; });

  const lockedInput = document.getElementById('prop-locked');
  if (lockedInput) {
    lockedInput.addEventListener('change', (e) => {
      block.locked = e.target.checked;
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
    });
    colorInput.addEventListener('input', () => {
      if (!checkbox.checked) return;
      b[key] = colorInput.value;
      updateBlockDom(b.id);
    });
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
  render();
}

function sendToBack(id) {
  const idx = state.blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const [block] = state.blocks.splice(idx, 1);
  state.blocks.unshift(block);
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
  refreshLoadList();
  render();
}

init();
