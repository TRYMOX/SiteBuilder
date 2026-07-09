function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let nextBlockId = 1;
function makeBlockId() {
  return `b${Date.now()}${nextBlockId++}`;
}

function toEmbedUrl(url) {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
}

// registre des types de bloc disponibles dans la palette — un seul endroit à
// modifier pour ajouter un type de bloc (palette, valeurs par défaut, rendu,
// panneau de propriétés utilisent tous ce registre)
const BLOCK_DEFS = {
  heading: {
    label: 'Titre',
    icon: 'H',
    defaults: () => ({ type: 'heading', text: 'Titre de section', level: 2, align: 'left', style: 'default' }),
    render: b => {
      const styleClass = b.style && b.style !== 'default' ? ` blk-heading-${b.style}` : '';
      return `<h${b.level} class="blk-heading blk-align-${b.align}${styleClass}">${escapeHtml(b.text)}</h${b.level}>`;
    },
  },
  paragraph: {
    label: 'Paragraphe',
    icon: 'P',
    defaults: () => ({ type: 'paragraph', text: 'Texte de paragraphe à personnaliser.', align: 'left', style: 'default' }),
    render: b => `<p class="blk-paragraph blk-align-${b.align} blk-paragraph-${b.style || 'default'}">${escapeHtml(b.text)}</p>`,
  },
  button: {
    label: 'Bouton',
    icon: '▭',
    defaults: () => ({ type: 'button', text: 'Cliquez ici', href: '#', style: 'primary' }),
    render: b => `<a class="blk-button blk-button-${b.style}" href="${escapeHtml(b.href)}">${escapeHtml(b.text)}</a>`,
  },
  image: {
    label: 'Image',
    icon: '▨',
    defaults: () => ({ type: 'image', src: '', alt: '', style: 'default' }),
    render: b => b.src
      ? `<img class="blk-image blk-image-${b.style || 'default'}" src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt)}">`
      : `<div class="blk-image-empty">Aucune image (renseigner une URL dans les propriétés)</div>`,
  },
  section: {
    label: 'Bande',
    icon: '▬',
    defaults: () => ({ type: 'section', background: '#5b9fe8', padding: 'md', style: 'solid' }),
    render: b => {
      if (b.style === 'gradient') return `<div class="blk-section blk-padding-${b.padding} blk-section-gradient"></div>`;
      if (b.style === 'outline') return `<div class="blk-section blk-padding-${b.padding} blk-section-outline" style="border-color:${escapeHtml(b.background)}"></div>`;
      return `<div class="blk-section blk-padding-${b.padding}" style="background:${escapeHtml(b.background)}"></div>`;
    },
  },
  quote: {
    label: 'Citation',
    icon: '"',
    defaults: () => ({ type: 'quote', text: 'Une citation inspirante.', author: '', style: 'default' }),
    render: b => `<blockquote class="blk-quote blk-quote-${b.style}"><p>${escapeHtml(b.text)}</p>${b.author ? `<cite>— ${escapeHtml(b.author)}</cite>` : ''}</blockquote>`,
  },
  list: {
    label: 'Liste',
    icon: '≡',
    defaults: () => ({ type: 'list', items: ['Premier élément', 'Deuxième élément', 'Troisième élément'], style: 'bullet' }),
    render: b => {
      const tag = b.style === 'numbered' ? 'ol' : 'ul';
      const itemsHtml = b.items.map(i => `<li>${escapeHtml(i)}</li>`).join('');
      return `<${tag} class="blk-list blk-list-${b.style}">${itemsHtml}</${tag}>`;
    },
  },
  divider: {
    label: 'Séparateur',
    icon: '—',
    defaults: () => ({ type: 'divider', style: 'solid' }),
    render: b => `<hr class="blk-divider blk-divider-${b.style}">`,
  },
  card: {
    label: 'Carte',
    icon: '▣',
    defaults: () => ({ type: 'card', title: 'Titre de la carte', text: 'Description courte de la carte.', style: 'default' }),
    render: b => `<div class="blk-card blk-card-${b.style}"><h3 class="blk-card-title">${escapeHtml(b.title)}</h3><p class="blk-card-text">${escapeHtml(b.text)}</p></div>`,
  },
  columns: {
    label: '2 colonnes',
    icon: '❘❘',
    defaults: () => ({ type: 'columns', leftTitle: 'Colonne 1', leftText: 'Texte de la première colonne.', rightTitle: 'Colonne 2', rightText: 'Texte de la seconde colonne.', style: 'default' }),
    render: b => `<div class="blk-columns blk-columns-${b.style}">
      <div class="blk-column"><h4>${escapeHtml(b.leftTitle)}</h4><p>${escapeHtml(b.leftText)}</p></div>
      <div class="blk-column"><h4>${escapeHtml(b.rightTitle)}</h4><p>${escapeHtml(b.rightText)}</p></div>
    </div>`,
  },
  video: {
    label: 'Vidéo',
    icon: '▶',
    defaults: () => ({ type: 'video', url: '' }),
    render: b => b.url
      ? `<div class="blk-video"><iframe src="${escapeHtml(toEmbedUrl(b.url))}" allowfullscreen loading="lazy"></iframe></div>`
      : `<div class="blk-image-empty">Aucune vidéo (renseigner une URL dans les propriétés)</div>`,
  },
};

// préréglages d'ombre portée (voir champ "shadow" du panneau Apparence)
const SHADOW_PRESETS = {
  none: 'none',
  sm: '0 2px 8px rgba(0,0,0,0.15)',
  md: '0 8px 20px rgba(0,0,0,0.25)',
  lg: '0 16px 40px rgba(0,0,0,0.35)',
};
const SHADOW_LABELS = { none: 'Aucune', sm: 'Légère', md: 'Moyenne', lg: 'Prononcée' };

// clonage profond de blocs — tous les champs sont des types sérialisables en
// JSON (string/number/boolean/null/tableau de strings), donc suffisant pour
// dupliquer un bloc ou prendre un instantané pour l'historique annuler/rétablir
function cloneBlocks(blocks) {
  return JSON.parse(JSON.stringify(blocks));
}

function createBlock(type) {
  const def = BLOCK_DEFS[type];
  // x/y (position libre en px sur le canevas), width/height (px, height
  // null = auto) et locked sont génériques à tous les types de bloc, tout
  // comme les champs d'apparence ci-dessous (null = pas de surcharge, le
  // bloc garde l'apparence du type/thème) — voir le wrapper .blk-resizable
  // dans renderBlockContent
  return {
    id: makeBlockId(), x: 40, y: 40, width: 400, height: null, locked: false,
    bgColor: null, textColor: null, borderColor: null, radius: null, shadow: 'none', opacity: 100,
    ...def.defaults(),
  };
}

// enveloppe le rendu propre au type (BLOCK_DEFS[type].render) dans un
// conteneur positionné librement (x/y), dimensionné (width/height) et
// habillé (couleurs/rayon/ombre/opacité) — partagé entre l'aperçu en direct
// et l'export, pour que les deux restent identiques. .page-canvas
// (position:relative) est le repère de positionnement dans les deux cas :
// en édition, .block-wrapper qui l'entoure n'a lui-même aucun
// positionnement, donc ce div s'y place directement sans décalage
function renderBlockContent(block) {
  const inner = BLOCK_DEFS[block.type].render(block);
  const heightStyle = block.height ? `height:${block.height}px;` : '';
  const bgStyle = block.bgColor ? `background:${block.bgColor};` : '';
  const colorStyle = block.textColor ? `color:${block.textColor};` : '';
  const borderStyle = block.borderColor ? `border:2px solid ${block.borderColor};` : '';
  const radiusStyle = (block.radius || block.radius === 0) ? `border-radius:${block.radius}px;` : '';
  const shadowStyle = block.shadow && block.shadow !== 'none' ? `box-shadow:${SHADOW_PRESETS[block.shadow]};` : '';
  const opacityStyle = (block.opacity !== undefined && block.opacity !== null && block.opacity !== 100) ? `opacity:${block.opacity / 100};` : '';
  const style = `position:absolute; left:${block.x}px; top:${block.y}px; width:${block.width || 400}px; ${heightStyle}${bgStyle}${colorStyle}${borderStyle}${radiusStyle}${shadowStyle}${opacityStyle} box-sizing:border-box;`;
  return `<div class="blk-resizable" style="${style}">${inner}</div>`;
}

// CSS des blocs eux-mêmes (pas le chrome de l'éditeur) — injectée une fois
// dans le <head> pour l'aperçu en direct (voir injectPageCss dans script.js),
// et copiée telle quelle dans le document exporté, pour garantir que
// export == ce que montre l'aperçu
const PAGE_CSS = `
.page-canvas{
  position: relative;
  background: var(--page-bg);
  color: var(--page-text);
  font-family: var(--page-bodyFont);
  min-height: 400px;
}
.page-canvas h1.blk-heading{ font-size: 34px; }
.page-canvas h2.blk-heading{ font-size: 25px; }
.page-canvas h3.blk-heading{ font-size: 19px; }
.blk-heading{
  font-family: var(--page-headingFont);
  font-weight: 700;
  line-height: 1.25;
  margin: 0;
}
.blk-heading-accent{ color: var(--page-accent); }
.blk-heading-underline{ position: relative; padding-bottom: 12px; }
.blk-heading-underline::after{
  content: ''; position: absolute; left: 0; bottom: 0;
  width: 56px; height: 3px; background: var(--page-accent);
}
.blk-align-center.blk-heading-underline::after{ left: 50%; transform: translateX(-50%); }
.blk-align-right.blk-heading-underline::after{ left: auto; right: 0; }

.blk-paragraph{
  font-family: var(--page-bodyFont);
  line-height: 1.6;
  margin: 0;
}
.blk-paragraph-muted{ opacity: 0.7; }
.blk-paragraph-lead{ font-size: 19px; line-height: 1.5; }

/* le positionnement horizontal (largeur/marge) est géré par .blk-resizable
   (voir renderBlockContent) — ces classes ne gèrent plus que l'alignement du
   texte, pour ne pas entrer en conflit avec la marge choisie par l'utilisateur */
.blk-align-left{ text-align: left; }
.blk-align-center{ text-align: center; }
.blk-align-right{ text-align: right; }

.blk-button{
  display: inline-block;
  width: fit-content;
  padding: 10px 22px;
  border-radius: var(--page-radius);
  font-family: var(--page-bodyFont);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
}
.blk-button-primary{ background: var(--page-accent); color: #fff; }
.blk-button-secondary{ background: transparent; color: var(--page-accent); border: 1px solid var(--page-accent); }
.blk-button-ghost{ background: transparent; color: var(--page-accent); padding-left: 4px; padding-right: 4px; }

.blk-image{ max-width: 100%; display: block; border-radius: var(--page-radius); }
.blk-image-square{ border-radius: 0; }
.blk-image-circle{ border-radius: 50%; aspect-ratio: 1 / 1; object-fit: cover; max-width: 220px; }
.blk-image-empty{
  border: 1px dashed var(--page-border);
  border-radius: var(--page-radius);
  padding: 40px;
  text-align: center;
  color: var(--page-textDim);
  font-family: var(--page-bodyFont);
  font-size: 13px;
}

.blk-section{ border-radius: var(--page-radius); }
.blk-padding-sm{ height: 24px; }
.blk-padding-md{ height: 56px; }
.blk-padding-lg{ height: 100px; }
.blk-section-gradient{ background: linear-gradient(135deg, var(--page-accent), transparent); }
.blk-section-outline{ background: transparent; border: 2px solid; }

.blk-quote{ font-family: var(--page-bodyFont); margin: 0; }
.blk-quote p{ font-size: 18px; font-style: italic; line-height: 1.5; margin: 0 0 8px; }
.blk-quote cite{ font-size: 13px; font-style: normal; color: var(--page-textDim); }
.blk-quote-accent-bar{ border-left: 4px solid var(--page-accent); padding-left: 18px; }
.blk-quote-centered{ text-align: center; }

.blk-list{ font-family: var(--page-bodyFont); line-height: 1.7; padding-left: 22px; margin: 0; }
.blk-list-bullet{ list-style: disc; }
.blk-list-numbered{ list-style: decimal; }
.blk-list-check{ list-style: none; padding-left: 0; }
.blk-list-check li{ position: relative; padding-left: 26px; }
.blk-list-check li::before{ content: '✓'; position: absolute; left: 0; color: var(--page-accent); font-weight: 700; }

.blk-divider{ border: none; border-top-width: 1px; border-color: var(--page-border); margin: 0; width: 100%; }
.blk-divider-solid{ border-top-style: solid; }
.blk-divider-dashed{ border-top-style: dashed; }
.blk-divider-dotted{ border-top-style: dotted; }

.blk-card{ background: var(--page-panel); border-radius: var(--page-radius); padding: 22px; }
.blk-card-title{ font-family: var(--page-headingFont); font-weight: 700; font-size: 17px; margin: 0 0 8px; }
.blk-card-text{ font-family: var(--page-bodyFont); font-size: 13.5px; line-height: 1.5; color: var(--page-textDim); margin: 0; }
.blk-card-bordered{ border: 1px solid var(--page-border); }
.blk-card-shadow{ box-shadow: 0 8px 24px rgba(0,0,0,0.18); }

.blk-columns{ display: grid; grid-template-columns: 1fr 1fr; gap: 28px; position: relative; }
.blk-column h4{ font-family: var(--page-headingFont); font-weight: 700; font-size: 15px; margin: 0 0 6px; }
.blk-column p{ font-family: var(--page-bodyFont); font-size: 13.5px; line-height: 1.55; margin: 0; }
.blk-columns-divided::before{
  content: ''; position: absolute; left: 50%; top: 0; bottom: 0;
  width: 1px; background: var(--page-border);
}

.blk-video{ position: relative; width: 100%; padding-top: 56.25%; border-radius: var(--page-radius); overflow: hidden; background: #000; }
.blk-video iframe{ position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
`;
