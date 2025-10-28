# 🚀 Cómo subir a GitHub + GitHub Pages

## Paso 1: Crear repo en GitHub

1. Ve a https://github.com/new
2. **Repository name**: `finance-app-v1` (o el nombre que quieras)
3. **Description**: `Complete documentation for Finance App V1 - Simple but complete personal finance tracker`
4. **Public** o **Private** (tú decides)
5. ❌ **NO** marques "Initialize with README" (ya tenemos uno)
6. Click **Create repository**

---

## Paso 2: Conectar repo local con GitHub

Copia estos comandos **UNO POR UNO** (reemplaza `YOUR_USERNAME` con tu username):

```bash
cd "/Users/darwinborges/finance app"

# Agregar remote
git remote add origin https://github.com/YOUR_USERNAME/finance-app-v1.git

# Cambiar a branch main (si estás en master)
git branch -M main

# Push
git push -u origin main
```

**Ejemplo real**:
```bash
git remote add origin https://github.com/darwinborges/finance-app-v1.git
git branch -M main
git push -u origin main
```

---

## Paso 3: Activar GitHub Pages

1. En tu repo, ve a **Settings** → **Pages** (menú lateral)
2. En **Source**, selecciona:
   - Branch: `main`
   - Folder: `/ (root)`
3. Click **Save**
4. ⏳ Espera 1-2 minutos
5. 🎉 Tu documentación estará en: `https://YOUR_USERNAME.github.io/finance-app-v1/`

---

## Paso 4: Verificar

### Repo en GitHub
Deberías ver:
- ✅ 22 archivos markdown (.md)
- ✅ 1 archivo index.html (página principal)
- ✅ 1 archivo .gitignore
- ✅ Commits con descripción clara

### GitHub Pages
Abre: `https://YOUR_USERNAME.github.io/finance-app-v1/`

Deberías ver:
- 🎨 Página bonita con gradiente morado
- 📊 Stats: 22 documentos, ~1,800 LOC
- 📖 Grid con todos los docs organizados por sección
- ⭐ STORYTELLING y Timeline Continuo destacados

---

## 🔧 Troubleshooting

### "Permission denied (publickey)"
Necesitas configurar SSH keys o usar HTTPS con token:

**Opción 1: HTTPS (más fácil)**
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/finance-app-v1.git
# Te pedirá username + personal access token
```

**Opción 2: SSH keys**
Sigue: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### "GitHub Pages no aparece"
- Espera 5 minutos (puede tardar)
- Verifica que el branch sea `main` (no `master`)
- Verifica que esté en folder `/ (root)`
- Force refresh: Cmd+Shift+R (Mac) o Ctrl+Shift+R (Windows)

### "Los markdown no se ven bonitos"
GitHub Pages renderiza markdown automáticamente. Si quieres algo más fancy:
1. Agrega un `_config.yml` con un tema Jekyll
2. O usa un generador estático (Docusaurus, VitePress, etc)

**Pero lo básico ya funciona con el index.html que creé ✅**

---

## 📝 Comandos útiles para después

### Agregar más cambios
```bash
cd "/Users/darwinborges/finance app"
git add .
git commit -m "Update documentation"
git push
```

### Ver status
```bash
git status
```

### Ver logs
```bash
git log --oneline
```

---

## ✨ Resultado final

**Repo**: `https://github.com/YOUR_USERNAME/finance-app-v1`
**Docs**: `https://YOUR_USERNAME.github.io/finance-app-v1/`

🎉 **Documentación pública y navegable!**

---

**Nota**: Reemplaza `YOUR_USERNAME` con tu username real de GitHub en todos los comandos.
