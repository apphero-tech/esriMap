# ESRI Map - Salesforce Lightning Web Component

Un composant Salesforce Lightning Web Component (LWC) qui intègre des cartes ESRI/ArcGIS dans vos pages Salesforce.

## 🗺️ Fonctionnalités

- **Carte interactive** : Intégration de cartes ESRI avec Leaflet/OpenStreetMap
- **Géocodage** : Service Apex pour la recherche d'adresses via l'API ArcGIS
- **Interface Lightning** : Composant LWC respectant les standards Salesforce
- **Page Visualforce** : Page personnalisée pour afficher la carte

## 🏗️ Architecture

- **LWC** : `esriMap` - Composant principal de la carte
- **Apex** : `ArcGISGeocodeService` - Service de géocodage
- **Named Credential** : `ArcGIS_Services` - Configuration des appels API
- **Page** : `ArcGISMap` - Page Visualforce d'affichage

## 🚀 Installation

1. Déployez le projet dans votre org Salesforce
2. Activez les permissions d'onglet dans Setup → Profiles → System Administrator → Tab Settings
3. Configurez les Remote Site Settings si nécessaire pour les appels API externes

## 📋 Prérequis

- Org Salesforce avec Lightning Experience activé
- Accès aux composants Lightning Web Components
- Permissions pour créer des composants personnalisés

## 🔧 Configuration

Le composant utilise la Named Credential `ArcGIS_Services` pour les appels API. Assurez-vous que les paramètres d'authentification sont correctement configurés.

## 📱 Utilisation

Ajoutez le composant `esriMap` à vos pages Lightning ou utilisez la page Visualforce `ArcGISMap` directement.

---

*Développé avec Salesforce DX et Lightning Web Components*
