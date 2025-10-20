# 🗺️ ESRI Map - Composant Salesforce ArcGIS

Composant Salesforce Lightning Web Component (LWC) intégrant des cartes ESRI/ArcGIS avec outils de dessin, géocodage automatique et liaison automatique aux enregistrements parent.

## ✨ Fonctionnalités

- **🗺️ Carte ArcGIS interactive** : Intégration native via Maps SDK for JavaScript
- **✏️ Outils de dessin** : Point, Polyline, Polygon, Rectangle, Circle
- **📍 Géocodage automatique** : Clic sur la carte pour obtenir l'adresse
- **💾 Sauvegarde intégrée** : Enregistrement dans `Map_Area__c` avec liaison parent
- **🔗 Liaison automatique** : Zones liées au Case/Account/etc via champ lookup
- **⚙️ Configuration dynamique** : Activation/désactivation des outils via Custom Settings

## 🏗️ Architecture

- **LWC Editor** : `esriMapEditor` - Éditeur interactif
- **LWC Viewer** : `esriMapViewer` - Visualisation en lecture seule
- **Visualforce** : `ArcGISMap.page` - Intégration ArcGIS
- **Apex** : `MapAreaService` - Gestion des données
- **Custom Settings** : `ArcGIS_Tool_Settings__c` - Configuration

## 🚀 Installation

```bash
# Déployer sur l'org par défaut
sf project deploy start

# Déployer sur une org spécifique
sf project deploy start --target-org esriMap
```

## 📱 Utilisation

Ajouter le composant `esriMapEditor` sur une Record Page avec les propriétés :
- `recordId` : ID du Case/Account/etc
- `relationshipFieldName` : Nom du champ lookup (ex: `Case__c`)
- `readOnly` : Mode lecture seule (optionnel)

## 🌐 Technologies

- **Salesforce** : LWC, Visualforce, Apex
- **ArcGIS** : Maps SDK for JavaScript
- **Standards** : GeoJSON, WGS84

## 🔧 Correctifs Récents

### ✅ Géolocalisation dans iframe (Oct 2025)
**Problème** : Le widget Locate d'ArcGIS ne demandait pas la permission de géolocalisation dans les iframes.

**Solution** :
1. Ajout de l'attribut `allow="geolocation *"` aux iframes
2. Ajout de `allow-modals` au sandbox pour permettre les pop-ups de permission
3. Retrait du `goToOverride` qui interférait avec le widget natif

**Impact** : La géolocalisation fonctionne maintenant correctement dans Firefox, Chrome et Safari.

---

*Dernière mise à jour : Octobre 2025*
