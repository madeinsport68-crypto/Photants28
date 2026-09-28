# PhotANTS

Outil de comptoir pour buralistes : prise de vue, recadrage tactile, contrôle ANTS/OACI et impression de planches de photos d'identité 10 × 15 cm à 600 DPI.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
```

La caméra ne fonctionne qu'en HTTPS (ou sur localhost). Sur Vercel, c'est automatique.

## Déployer sur Vercel

1. Pousser ce dossier sur un dépôt GitHub.
2. Sur vercel.com : **Add New → Project**, importer le dépôt (framework détecté : Next.js), **Deploy**.

Aucune variable d'environnement n'est nécessaire.

## Parcours

1. **Format** : ANTS 3,5 × 4,5 cm (8 photos) ou personnalisé 4 × 6 cm (4 photos).
2. **Atelier** : caméra avec ovale guide (retardateur 3 s, bascule avant/arrière) ou téléversement JPG/PNG/HEIC. Recadrage : un doigt pour déplacer, deux doigts pour zoomer, curseurs zoom et rotation. Bandes vertes = zones attendues du sommet du crâne et du menton.
3. **Contrôle** : checklist des 5 piliers, badge « Conforme ANTS à 95%+ » quand tout est vert, bouton de recadrage immédiat.
4. **Planche** : aperçu, export PNG 600 DPI (métadonnée de résolution incluse), impression `window.print()`.

## Formats de sortie (600 DPI)

| Format | Photo | Planche | Orientation |
|---|---|---|---|
| ANTS | 826 × 1062 px | 3543 × 2362 px (15 × 10 cm) | Paysage |
| Personnalisé | 944 × 1417 px | 2362 × 3543 px (10 × 15 cm) | Portrait |

8 photos de 3,5 × 4,5 cm ne tiennent sur du 10 × 15 **qu'en paysage** (4 colonnes × 2 rangées). La feuille d'impression s'adapte automatiquement (`@page { size: 15cm 10cm }`). Dans la fenêtre d'impression : échelle **100 % / Taille réelle**, sans marges.

## Moteur de conformité

| Pilier | Méthode |
|---|---|
| Géométrie | IA (MediaPipe Face Landmarker) : taille de tête, centrage, horizontalité des yeux, visage de face |
| Expression | IA : yeux fermés, sourire, bouche ouverte, regard |
| Fond & éclairage | Analyse pixel : fond blanc/coloré/sombre/non uni, ombres, exposition |
| Visage dégagé | Cases à cocher par le commerçant (lunettes, couvre-chef, mèches, oreilles) |
| Netteté & résolution | Analyse pixel : flou (variance du laplacien), pixels source disponibles |

Le modèle MediaPipe est chargé depuis un CDN (jsDelivr + Google Storage) au premier usage. S'il est indisponible, l'app passe en **mode heuristique** : géométrie et expression deviennent des cases à valider visuellement.

Les seuils sont regroupés dans `lib/compliance.ts`. Ils ont été calibrés sur des images de test synthétiques : à ajuster après quelques jours d'usage réel.

Ce contrôle est une aide, pas une certification officielle.

## Structure

```
app/            layout, page (machine d'étapes), styles + CSS d'impression
components/     Header, StepIndicator, FormatSelector, Workbench, CameraCapture,
                CompliancePanel, SheetPreview, PrintSheet
lib/            formats.ts, image.ts (HEIC, recadrage), compliance.ts, sheet.ts (planche, PNG 600 DPI)
public/logo.jpg Logo PhotANTS
```
