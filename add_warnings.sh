#!/bin/bash

# Lista de archivos legacy que necesitan warning
FILES=(
  "3-clustering.md"
  "4-normalization.md"
  "5-canonical-store.md"
  "STORYTELLING.md"
)

WARNING='> **⚠️ LEGACY REFERENCE**: Este doc puede contener referencias a arquitectura antigua (2 tablas). La arquitectura correcta está en [ARCHITECTURE-COMPLETE.md](ARCHITECTURE-COMPLETE.md)

---

'

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if warning already exists
    if ! grep -q "LEGACY REFERENCE" "$file"; then
      # Insert warning after first header
      sed -i '' '1 a\
\
'"$WARNING"'
' "$file"
      echo "Added warning to $file"
    else
      echo "Warning already exists in $file"
    fi
  fi
done
