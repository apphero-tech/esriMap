# 🗺️ ESRI Map - Composant Salesforce ArcGIS

Un composant Salesforce Lightning Web Component (LWC) qui intègre des cartes ESRI/ArcGIS avec outils de dessin, géocodage automatique et liaison automatique aux enregistrements parent.

## ✨ Fonctionnalités Principales

- **🗺️ Carte ArcGIS interactive** : Intégration native via Maps SDK for JavaScript
- **✏️ Outils de dessin** : Point, Polyline, Polygon, Rectangle, Circle
- **📍 Géocodage automatique** : Clic sur la carte pour obtenir l'adresse
- **💾 Sauvegarde intégrée** : Enregistrement automatique dans `Map_Area__c` avec liaison parent
- **🔗 Liaison automatique** : Les zones sont automatiquement liées au Case/Account/etc via champ lookup
- **⚙️ Configuration dynamique** : Activation/désactivation des outils via Custom Settings
- **🎨 Interface Lightning** : Composant LWC respectant les standards Salesforce
- **🌐 Support Communities** : Compatible avec Salesforce Communities (domaines `.my.site.com`)

## 🏗️ Architecture Technique

### **Composants Principaux**
- **LWC Editor** : `esriMapEditor` - Éditeur avec carte interactive et liaison automatique
- **LWC Viewer** : `esriMapViewer` - Visualisation en lecture seule
- **Page Visualforce** : `ArcGISMap.page` - Intégration de la carte ArcGIS
- **Service Apex** : `MapAreaService` - Sauvegarde des zones avec gestion des relations dynamiques
- **Custom Settings** : `ArcGIS_Tool_Settings__c` - Configuration des outils

### **Objets Salesforce**
- **Map_Area__c** : Stockage des zones de carte (coordonnées, adresses, géométrie)
- **Champ de relation dynamique** : Lookup vers l'objet parent (Case__c, Account__c, etc.)

## 🚀 Installation & Déploiement

### **Orgs Principales**
```
esriMap           → Org de développement principal (par défaut) 🍁
SJSR-TESTCARTE    → Sandbox client pour tests
esriMapNew        → Scratch org temporaire (30j)
esriTestScratch   → Scratch org temporaire (30j)
EsriMapDev        → Ancienne org de dev (problèmes de migration data center)
```

### **Déploiement sur une Org**
```bash
# Déployer sur l'org par défaut (esriMap)
sf project deploy start

# Déployer sur une org spécifique
sf project deploy start --target-org esriMap
sf project deploy start --target-org SJSR-TESTCARTE
sf project deploy start --target-org esriMapNew
sf project deploy start --target-org esriTestScratch
```

### **Configuration Post-Déploiement**
1. **Créer un champ lookup** sur `Map_Area__c` vers l'objet parent (ex: `Case__c`)
2. **Ajouter Permission Sets** : Assigner `esriMap_Admin` ou `esriMap_Internal` aux utilisateurs
3. **Ajouter le composant** sur une Record Page (Case, Account, etc.)
4. **Configurer les propriétés** du composant

## 📱 Utilisation

### **Propriétés du Composant esriMapEditor (CRM)**

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `recordId` | String | Auto | ID du Case/Account/etc (automatique sur Record Page) |
| `relationshipFieldName` | String | — | Nom du champ lookup (ex: `Case__c`) |
| `title` | String | — | Titre personnalisé du composant |
| `readOnly` | Boolean | false | Mode lecture seule |

### **Propriétés du Composant esriMapEditor (Flow)**

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `recordId` | String | — | ID de la zone à afficher |
| `title` | String | — | Titre personnalisé |
| `initialZoom` | Integer | 12 | Niveau de zoom initial (1-28) |
| `readOnly` | Boolean | false | Mode lecture seule |

### **Workflow Typique**

1. **Sur une Case Record Page :**
   - Ajouter `esriMapEditor` 
   - Configurer `relationshipFieldName = "Case__c"`
   - Les zones existantes se chargent automatiquement
   - Les nouvelles zones sont automatiquement liées au Case

2. **Dans un Flow :**
   - Ajouter `esriMapEditor` 
   - Passer l'ID du Case/Account via `recordId`
   - Les zones sont liées automatiquement à la sauvegarde

3. **En Lecture Seule :**
   - Configurer `readOnly = true`
   - Affiche les zones liées sans possibilité de modification

### **Types de Zones Supportés**
- **Point** : Coordonnées précises
- **Polyline** : Lignes et chemins
- **Polygon** : Formes libres fermées
- **Rectangle** : Rectangles par coins
- **Circle** : Cercles par centre et rayon

## 🔧 API Apex

### **MapAreaService.getMapAreasByRelationship()**
```apex
// Récupère les zones liées à un enregistrement parent
Map<Id, Map_Area__c> zones = MapAreaService.getMapAreasByRelationship(
    '001xx000003DHP',  // parentRecordId
    'Case__c'          // relationshipFieldName
);
```

### **MapAreaService.saveMapAreas()**
```apex
// Crée des zones et les lie automatiquement au parent
MapAreaService.SaveResult result = MapAreaService.saveMapAreas(
    shapesList,              // List<ShapeData>
    '001xx000003DHP',        // parentRecordId
    'Case__c'                // relationshipFieldName
);
```

## 🌐 Technologies Utilisées

- **Salesforce** : LWC, Visualforce, Apex, Dynamic Binding
- **ArcGIS** : Maps SDK for JavaScript, Sketch Widget, Geocoding
- **Standards** : GeoJSON, WGS84, SLDS

## 📋 Prérequis

- **Org Salesforce** : Lightning Experience activé
- **Composants** : Accès aux LWC et Visualforce
- **Permissions** : Création/modification d'objets personnalisés
- **API** : Accès aux services ArcGIS (géocodage public)

## 🤝 Support

Pour toute question ou problème, contactez l'équipe de développement.

## 🔄 Changelog

### **v1.1.0 - Janvier 2025**
- ✅ **Support Salesforce Communities** : Ajout du support des domaines `.my.site.com`
- ✅ **Changement d'org par défaut** : Migration de EsriMapDev vers esriMap
- ✅ **Correction bouton "Enregistrer"** : Résolution du problème de bouton grisé dans les Communities
- ✅ **Déploiements réussis** : Validation sur 3 orgs (esriMap, SJSR-TESTCARTE, esriMapNew)

### **v1.0.0 - Décembre 2024**
- 🎉 **Version initiale** : Composant LWC avec intégration ArcGIS complète

---

*Dernière mise à jour : Janvier 2025*  
*Développé avec Salesforce DX et ArcGIS Maps SDK* 🗺️✨
