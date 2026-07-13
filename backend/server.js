const express = require('express');
const path = require('path');
const fs = require('fs');

// surchageables par le harnais de vérification (jsdom), pour ne jamais toucher
// aux vraies données ni au vrai port pendant le développement/les tests
const PORT = process.env.SITEBUILDER_PORT || 4000;
const DB_PATH = process.env.SITEBUILDER_DB || path.join(__dirname, 'db', 'projects.json');
// où joindre ThemeForge pour importer une palette comme thème personnalisé —
// proxifié côté serveur (comme EnvKeeper/APITester, Moodboard/ThemeForge)
// pour éviter tout souci de CORS entre deux outils sur des ports différents
const THEMEFORGE_URL = process.env.SITEBUILDER_THEMEFORGE_URL || 'http://localhost:4900';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

function loadProjects() {
  if (!fs.existsSync(DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveProjects(projects) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // écrit dans un fichier temporaire puis renomme — renommage atomique, donc
  // le fichier final contient toujours soit l'ancien contenu complet soit le
  // nouveau, jamais un état à moitié écrit
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(projects, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
}

// liste des projets sauvegardés (nom + date, pas le contenu complet)
app.get('/api/projects', (req, res) => {
  const projects = loadProjects();
  const list = Object.values(projects).map(p => ({ name: p.name, updatedAt: p.updatedAt }));
  res.json(list);
});

app.get('/api/projects/:name', (req, res) => {
  const projects = loadProjects();
  const project = projects[req.params.name];
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
  res.json(project);
});

function isValidCustomThemeVars(vars) {
  if (vars === undefined || vars === null) return true;
  return typeof vars === 'object' && Object.values(vars).every((v) => typeof v === 'string');
}

// crée ou remplace un projet (nom = clé) — pas d'auth, outil local mono-utilisateur
app.put('/api/projects/:name', (req, res) => {
  const { theme, customThemeVars, pages } = req.body;
  if (!Array.isArray(pages) || !pages.length) return res.status(400).json({ error: 'pages doit être un tableau non vide.' });
  if (!pages.every(p => p && typeof p === 'object' && Array.isArray(p.blocks))) {
    return res.status(400).json({ error: 'chaque page doit avoir un tableau blocks.' });
  }
  if (!isValidCustomThemeVars(customThemeVars)) {
    return res.status(400).json({ error: 'customThemeVars doit être un objet de chaînes.' });
  }

  const projects = loadProjects();
  projects[req.params.name] = {
    name: req.params.name,
    theme: theme || 'minimal-light',
    customThemeVars: customThemeVars || null,
    pages,
    updatedAt: new Date().toISOString(),
  };
  saveProjects(projects);
  res.json({ ok: true });
});

// liste complète pour le picker d'import — ThemeForge renvoie déjà les
// couleurs dans sa liste, pas de second appel nécessaire
app.get('/api/themeforge/palettes', async (req, res) => {
  try {
    const r = await fetch(`${THEMEFORGE_URL}/api/palettes`);
    if (!r.ok) return res.json([]);
    res.json(await r.json());
  } catch {
    res.json([]);
  }
});

app.delete('/api/projects/:name', (req, res) => {
  const projects = loadProjects();
  delete projects[req.params.name];
  saveProjects(projects);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SiteBuilder lancé sur http://localhost:${PORT}`);
});
