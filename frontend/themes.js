// Thèmes de design appliqués à la page en cours d'édition (canevas + export).
// Chaque thème n'est qu'un jeu de variables CSS — changer de thème ne change
// jamais la structure des blocs, seulement leur habillage visuel.
const THEMES = [
  {
    id: 'minimal-light',
    name: 'Minimal clair',
    vars: {
      bg: '#ffffff',
      text: '#1a1a1a',
      textDim: '#666666',
      accent: '#2563eb',
      panel: '#f5f6f8',
      border: '#e4e6ea',
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      radius: '6px',
    },
  },
  {
    id: 'dark-modern',
    name: 'Sombre moderne',
    vars: {
      bg: '#14161a',
      text: '#edeff2',
      textDim: '#8b909c',
      accent: '#5b9fe8',
      panel: '#1b1e24',
      border: '#2c3038',
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      radius: '10px',
    },
  },
  {
    id: 'bold-colorful',
    name: 'Coloré audacieux',
    vars: {
      bg: 'linear-gradient(135deg, #6d28d9, #db2777)',
      text: '#ffffff',
      textDim: 'rgba(255,255,255,0.78)',
      accent: '#ffde59',
      panel: 'rgba(255,255,255,0.1)',
      border: 'rgba(255,255,255,0.25)',
      headingFont: "'Poppins', sans-serif",
      bodyFont: "'Inter', sans-serif",
      radius: '18px',
    },
  },
  {
    id: 'editorial',
    name: 'Éditorial',
    vars: {
      bg: '#f7f3ec',
      text: '#2b2620',
      textDim: '#8a8071',
      accent: '#b45309',
      panel: '#efe9de',
      border: '#ddd4c4',
      headingFont: "'Playfair Display', serif",
      bodyFont: "'Inter', sans-serif",
      radius: '2px',
    },
  },
  {
    id: 'pastel-soft',
    name: 'Pastel doux',
    vars: {
      bg: '#fdf2f8',
      text: '#4a3b47',
      textDim: '#a98da0',
      accent: '#c586d1',
      panel: '#fbe7f0',
      border: '#f3d4e4',
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      radius: '20px',
    },
  },
  {
    id: 'brutalist',
    name: 'Brutaliste',
    vars: {
      bg: '#ffffff',
      text: '#000000',
      textDim: '#555555',
      accent: '#ff3b30',
      panel: '#f0f0f0',
      border: '#000000',
      headingFont: "'Space Grotesk', sans-serif",
      bodyFont: "'Space Grotesk', sans-serif",
      radius: '0px',
    },
  },
  {
    id: 'neon-cyberpunk',
    name: 'Néon cyberpunk',
    vars: {
      bg: '#0a0a12',
      text: '#e0e0ff',
      textDim: '#8888aa',
      accent: '#00f0ff',
      panel: '#12121c',
      border: '#2a2a3d',
      headingFont: "'IBM Plex Mono', monospace",
      bodyFont: "'Inter', sans-serif",
      radius: '2px',
    },
  },
  {
    id: 'nature-earthy',
    name: 'Nature',
    vars: {
      bg: '#f4f1e8',
      text: '#3d3427',
      textDim: '#8a7f68',
      accent: '#6b8f47',
      panel: '#e9e3d3',
      border: '#d6cdb5',
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      radius: '8px',
    },
  },
  {
    id: 'corporate-professional',
    name: 'Corporate',
    vars: {
      bg: '#ffffff',
      text: '#1a2540',
      textDim: '#5b6a8a',
      accent: '#1e3a8a',
      panel: '#f1f4fa',
      border: '#dbe2ef',
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      radius: '4px',
    },
  },
  {
    id: 'luxury-gold',
    name: 'Luxe doré',
    vars: {
      bg: '#0d0d0d',
      text: '#f2e9d8',
      textDim: '#a89a7c',
      accent: '#d4af37',
      panel: '#1a1a1a',
      border: '#3a3324',
      headingFont: "'Playfair Display', serif",
      bodyFont: "'Inter', sans-serif",
      radius: '0px',
    },
  },
  {
    id: 'playful-fun',
    name: 'Ludique',
    vars: {
      bg: '#fff4d6',
      text: '#3a2e1f',
      textDim: '#8a7857',
      accent: '#ff6b35',
      panel: '#ffe8a3',
      border: '#ffd873',
      headingFont: "'Pacifico', cursive",
      bodyFont: "'Inter', sans-serif",
      radius: '24px',
    },
  },
  {
    id: 'ocean-gradient',
    name: 'Dégradé océan',
    vars: {
      bg: 'linear-gradient(135deg, #0f4c81, #00b4a6)',
      text: '#ffffff',
      textDim: 'rgba(255,255,255,0.78)',
      accent: '#ffd166',
      panel: 'rgba(255,255,255,0.1)',
      border: 'rgba(255,255,255,0.25)',
      headingFont: "'Space Grotesk', sans-serif",
      bodyFont: "'Inter', sans-serif",
      radius: '14px',
    },
  },
];

// id 'custom' n'est pas un thème de la liste statique : c'est une palette
// ThemeForge importée, propre au projet en cours (stockée sur state, pas ici)
function getTheme(id, customVars) {
  if (id === 'custom' && customVars) return { id: 'custom', name: 'Personnalisé (ThemeForge)', vars: customVars };
  return THEMES.find(t => t.id === id) || THEMES[0];
}

// applique un thème aux variables CSS de l'élément cible (le canevas
// d'édition et le document exporté utilisent tous deux cette même fonction,
// pour qu'export = ce que montre l'aperçu)
function applyTheme(el, themeId, customVars) {
  const theme = getTheme(themeId, customVars);
  for (const [key, value] of Object.entries(theme.vars)) {
    el.style.setProperty(`--page-${key}`, value);
  }
}
