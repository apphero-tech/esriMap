# 🗺️ ESRI Map - Composant Salesforce ArcGIS

Un composant Salesforce Lightning Web Component (LWC) qui intègre des cartes ESRI/ArcGIS avec outils de dessin et géocodage automatique.

## ✨ Fonctionnalités Principales

- **🗺️ Carte ArcGIS interactive** : Intégration native via Maps SDK for JavaScript
- **✏️ Outils de dessin** : Point, Polyline, Polygon, Rectangle, Circle
- **📍 Géocodage automatique** : Clic sur la carte pour obtenir l'adresse
- **💾 Sauvegarde intégrée** : Enregistrement automatique dans `Map_Area__c`
- **⚙️ Configuration dynamique** : Activation/désactivation des outils via Custom Settings
- **🎨 Interface Lightning** : Composant LWC respectant les standards Salesforce

## 🏗️ Architecture Technique

### **Composants Principaux**
- **LWC** : `esriMap` - Interface utilisateur et gestion des données
- **Page Visualforce** : `ArcGISMap.page` - Intégration de la carte ArcGIS
- **Service Apex** : `MapAreaService` - Sauvegarde des zones de carte
- **Custom Settings** : `ArcGIS_Tool_Settings__c` - Configuration des outils

### **Objets Salesforce**
- **Map_Area__c** : Stockage des zones de carte avec coordonnées et adresses
- **ArcGIS_Tool_Settings__c** : Configuration des outils de dessin (List Type)

## 🚀 Installation

### **1. Déploiement**
```bash
sf project deploy start --target-org VotreOrg
```

### **2. Configuration des Permissions**
- **Profils** : Accès aux composants LWC et objets personnalisés
- **Permission Sets** : `esriMap_Admin`, `esriMap_Internal`, `esriMap_External`
- **Onglets** : Activation de l'onglet Map Area dans les profils

### **3. Configuration des Outils**
- **Setup** → **Custom Settings** → **ArcGIS Tool Settings**
- **Activer/désactiver** les outils de dessin selon vos besoins

## 📱 Utilisation

### **Ajout du Composant**
```html
<!-- Dans une page Lightning -->
<c-esri-map></c-esri-map>

<!-- Ou utilisation directe de la page Visualforce -->
/apex/ArcGISMap
```

### **Fonctionnalités Disponibles**

#### **🎯 Sélection d'Adresse**
1. **Cliquer** n'importe où sur la carte
2. **Adresse géocodée** automatiquement affichée
3. **Cliquer "Save Shape"** pour sauvegarder
4. **Enregistrement créé** dans `Map_Area__c`

#### **✏️ Dessin de Formes**
1. **Utiliser** les outils Sketch dans la carte
2. **Dessiner** Point, Polyline, Polygon, Rectangle, Circle
3. **Cliquer "Save Shape"** pour sauvegarder
4. **Données géométriques** stockées en GeoJSON

### **Types de Zones Supportés**
- **Point** : Coordonnées précises (utilisé pour les adresses)
- **Polyline** : Lignes et chemins
- **Polygon** : Formes libres fermées
- **Rectangle** : Rectangles par coins
- **Circle** : Cercles par centre et rayon

## 🔧 Configuration Avancée

### **Custom Settings - ArcGIS Tool Settings**
```xml
<!-- Configuration des outils -->
<apex:page>
    <apex:customSettings type="ArcGIS_Tool_Settings__c" />
</apex:page>
```

### **Champs Map_Area__c**
- **Name** : Nom automatique (MAP-XXXX)
- **Area_Type__c** : Type de zone (Point, Polyline, etc.)
- **GeoJSON__c** : Données géométriques au format GeoJSON
- **Latitude__c** : Coordonnée latitude (centroïde)
- **Longitude__c** : Coordonnée longitude (centroïde)
- **Address__c** : Adresse géocodée (si disponible)

## 🌐 Technologies Utilisées

- **Salesforce** : LWC, Visualforce, Apex, Custom Settings
- **ArcGIS** : Maps SDK for JavaScript, Sketch Widget, Geocoding
- **Standards** : GeoJSON, WGS84, SLDS (Salesforce Lightning Design System)

## 📋 Prérequis

- **Org Salesforce** : Lightning Experience activé
- **Composants** : Accès aux LWC et Visualforce
- **Permissions** : Création/modification d'objets personnalisés
- **API** : Accès aux services ArcGIS (géocodage public)

## 🔍 Dépannage

### **Problèmes Courants**

#### **Outils de dessin non visibles**
- Vérifier la configuration dans Custom Settings
- Rafraîchir la page après modification des paramètres

#### **Erreur de sauvegarde**
- Vérifier les permissions FLS sur `Map_Area__c`
- Contrôler la validité des coordonnées

#### **Géocodage non fonctionnel**
- Vérifier la connectivité internet
- Contrôler les restrictions de domaine

## 📚 Ressources

- **Documentation ArcGIS** : [Maps SDK for JavaScript](https://developers.arcgis.com/javascript/)
- **Salesforce LWC** : [Lightning Web Components](https://developer.salesforce.com/docs/component-library/)
- **GeoJSON** : [Format de données géospatiales](https://geojson.org/)

## 🤝 Contribution

Ce projet est maintenu pour l'intégration ArcGIS dans Salesforce. Les contributions sont les bienvenues pour améliorer les fonctionnalités et la stabilité.

## 📄 Licence

Projet interne pour l'intégration ArcGIS-Salesforce.

---

*Développé avec Salesforce DX et ArcGIS Maps SDK* 🗺️✨
