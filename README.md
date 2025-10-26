# 🗺️ ESRI Map - Composant Salesforce ArcGIS

Composant Salesforce Lightning Web Component (LWC) intégrant des cartes ESRI/ArcGIS avec outils de dessin, géocodage automatique et liaison automatique aux enregistrements parent.

## ✨ Fonctionnalités

- **🗺️ Carte ArcGIS interactive** : Intégration native via Maps SDK for JavaScript
- **✏️ Outils de dessin** : Point, Polyline, Polygon, Rectangle, Circle
- **📍 Géocodage automatique** : Clic sur la carte pour obtenir l'adresse
- **💾 Sauvegarde intégrée** : Enregistrement dans `Map_Area__c` avec liaison parent
- **🔗 Liaison automatique** : Zones liées au Case/Account/etc via champ lookup
- **⚙️ Configuration dynamique** : Activation/désactivation des outils via Custom Settings
- **🔄 Synchronisation manuelle** : Bouton pour synchroniser les coordonnées d'une zone vers la Geolocation du Case

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

## ⚙️ Configuration Requise

### Pour la Synchronisation manuelle vers Case

Pour utiliser le bouton "Synchroniser" et remontrer les coordonnées d'une zone vers un Case, vous devez créer les champs personnalisés suivants sur l'objet **Case** :

1. **Champ Geolocation** (obligatoire)
   - Label : "Location"
   - API Name : `Location__c`
   - Type : Geolocation
   - Description : "Localisation géographique de la zone d'intervention"

2. **Champ Texte** (optionnel)
   - Label : "Address"
   - API Name : `Address__c`
   - Type : Text (255)
   - Description : "Adresse de la zone d'intervention"

**Note** : Le bouton "Synchroniser" apparaît pour chaque zone enregistrée. En cliquant dessus, les coordonnées (latitude/longitude) et l'adresse de la zone seront synchronisées vers le Case lié.

## 📱 Utilisation

Ajouter le composant `esriMapEditor` sur une Record Page avec les propriétés :
- `recordId` : ID du Case/Account/etc
- `relationshipFieldName` : Nom du champ lookup (ex: `Case__c`)
- `readOnly` : Mode lecture seule (optionnel)

## 🌐 Technologies

- **Salesforce** : LWC, Visualforce, Apex
- **ArcGIS** : Maps SDK for JavaScript
- **Standards** : GeoJSON, WGS84

## 🔧 Correctifs et Améliorations Récents

### ✅ Géolocalisation dans iframe (Oct 2025)
**Problème** : Le widget Locate d'ArcGIS ne demandait pas la permission de géolocalisation dans les iframes.

**Solution** :
1. Ajout de l'attribut `allow="geolocation *"` aux iframes
2. Ajout de `allow-modals` au sandbox pour permettre les pop-ups de permission
3. Retrait du `goToOverride` qui interférait avec le widget natif

**Impact** : La géolocalisation fonctionne maintenant correctement dans Firefox, Chrome et Safari.

### ✅ Synchronisation manuelle Case → Geolocation (Oct 2025)
**Fonctionnalité** : Bouton "Synchroniser" pour chaque zone enregistrée

**Détails** :
- Permet de synchroniser les coordonnées d'une zone spécifique vers le champ Geolocation du Case
- Gestion d'erreur douce si le champ Geolocation n'existe pas
- Synchronisation optionnelle de l'adresse si le champ `Address__c` existe
- Tests unitaires complets pour assurer la fiabilité

**Impact** : Les utilisateurs peuvent maintenant facilement remonter les données géographiques depuis les zones dessinées vers le Case parent.

---

*Dernière mise à jour : Octobre 2025*
