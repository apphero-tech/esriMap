# 🗺️ ESRI Map - Composant Salesforce ArcGIS

Composant Salesforce Lightning Web Component (LWC) intégrant des cartes ESRI/ArcGIS avec outils de dessin, géocodage automatique et liaison automatique aux enregistrements parent.

## ✨ Fonctionnalités

- **🗺️ Carte ArcGIS interactive** : Intégration native via Maps SDK for JavaScript
- **✏️ Outils de dessin** : Point, Polyline, Polygon, Rectangle, Circle
- **📍 Géocodage automatique** : Clic sur la carte pour obtenir l'adresse
- **💾 Sauvegarde intégrée** : Enregistrement dans `Map_Area__c` avec liaison parent
- **🔗 Liaison automatique** : Zones liées au Case/Account/etc via champ lookup
- **⚙️ Configuration dynamique** : Activation/désactivation des outils via Custom Settings
- **🔄 Synchronisation manuelle** : Bouton pour synchroniser les coordonnées d'une zone vers les champs Number du Case/Opportunity

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

Pour utiliser le bouton "Synchroniser" et remonter les coordonnées d'une zone vers un Case, les 3 champs suivants sont **automatiquement créés** lors du déploiement du package sur l'objet **Case** :

1. **Champ Nombre - Latitude** 
   - Label : "esriMap - Latitude"
   - API Name : `esriMap_Latitude__c`
   - Type : Number (18 chiffres, 6 décimales)
   - Description : "Latitude de la zone d'intervention"

2. **Champ Nombre - Longitude**
   - Label : "esriMap - Longitude"
   - API Name : `esriMap_Longitude__c`
   - Type : Number (18 chiffres, 6 décimales)
   - Description : "Longitude de la zone d'intervention"

3. **Champ Texte - Adresse** (optionnel)
   - Label : "esriMap - Adresse"
   - API Name : `esriMap_Address__c`
   - Type : Text (255)
   - Description : "Adresse de la zone d'intervention"

#### 📋 Ajouter les champs à la page layout du Case

Après le déploiement, les 3 champs existent dans votre org mais **ne s'affichent pas automatiquement** sur la Record Page du Case. Vous devez les ajouter manuellement au layout.

##### ⚙️ Étapes pour ajouter les champs au layout :

1. **Accéder à l'Object Manager**
   - Aller à **Setup** (en haut à droite)
   - Chercher **Object Manager** dans la barre de recherche
   - Cliquer sur **Object Manager**

2. **Sélectionner l'objet Case**
   - Chercher et cliquer sur **Case**

3. **Ouvrir les Layouts**
   - Dans le menu à gauche, cliquer sur **Layouts**
   - Vous verrez une liste de layouts (ex: "Case Layout", "Web to Case")

4. **Éditer le layout que vous utilisez**
   - Cliquer sur le layout que vous utilisez (généralement "Case Layout")
   - Le layout editor s'ouvre

5. **Ajouter les 3 champs esriMap**
   - Sur la gauche, dans **Fields**, chercher les 3 champs :
     - `esriMap_Address__c` (Adresse)
     - `esriMap_Latitude__c` (Latitude)
     - `esriMap_Longitude__c` (Longitude)
   - Glisser-déposer chaque champ dans une section visible du layout
   - **Recommandation** : Créer une nouvelle section "ESRI Map" ou les ajouter dans "Additional Information"

6. **Sauvegarder le layout**
   - Cliquer sur **Save** en haut à gauche
   - Le message "Successfully saved" devrait apparaître

7. **Rafraîchir la page**
   - Rafraîchir votre navigateur (F5 ou Cmd+R)
   - Ouvrir un enregistrement Case
   - Les 3 champs devraient maintenant être visibles

##### ✅ Vérification

Une fois les champs ajoutés, vous devriez voir :
- **esriMap - Adresse** : Champ texte vide (ou rempli après synchronisation)
- **esriMap - Latitude** : Nombre (ex: 45.521235)
- **esriMap - Longitude** : Nombre (ex: -122.675000)

Ces valeurs se rempliront automatiquement quand vous utiliserez le bouton "Synchroniser" du composant esriMapEditor.

##### 📝 Notes importantes

- Ces champs sont **disponibles dans tous les profils** via les Permission Sets esriMap (Admin, Internal, External)
- Vous n'avez **pas besoin** de configurer Field Level Security (FLS) - c'est déjà fait
- Les champs restent **vides jusqu'à la première synchronisation** d'une zone depuis la carte
- Si vous utilisez d'autres objets (Opportunity, Account, etc.), vous devez créer manuellement les 3 mêmes champs

#### ✅ Bouton "Synchroniser"

Le bouton "Synchroniser" apparaît pour chaque zone enregistrée. En cliquant dessus, les coordonnées (latitude/longitude) et l'adresse de la zone seront synchronisées vers le Case lié.

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

### ✅ Synchronisation manuelle Case → Champs Number (Oct 2025)
**Fonctionnalité** : Bouton "Synchroniser" pour chaque zone enregistrée

**Détails** :
- Synchronisation des coordonnées d'une zone vers 2 champs Number : `esriMap_Latitude__c` et `esriMap_Longitude__c`
- Synchronisation optionnelle de l'adresse vers `esriMap_Address__c` si elle existe
- Gestion d'erreur douce si les champs n'existent pas sur l'objet parent
- Vérification des permissions (CRUD et FLS) avec messages d'erreur détaillés
- Tests unitaires complets pour assurer la fiabilité
- Approche générique : fonctionne avec Case, Opportunity, ou tout autre objet personnalisé

**Solution technique** :
- Remplacement du champ Geolocation (qui ne peut pas être mis à jour via Apex) par des champs Number
- Les champs Number (18 chiffres, 6 décimales) offrent une précision suffisante pour les coordonnées GPS
- Approche scalable pour un package multi-clients

**Impact** : Les utilisateurs peuvent maintenant facilement remonter les données géographiques depuis les zones dessinées vers l'objet parent sans erreur de permission.

---

*Dernière mise à jour : Octobre 2025*

## 🔒 Configuration Field Level Security (FLS) - Important

**Le champ `Is_Synchronized__c` (Synchronisée)** est un champ Checkbox qui nécessite une configuration FLS manuelle pour être visible sur la page layout de Map_Area__c.

**Pour rendre le champ visible :**

1. Allez à **Setup → Fields and Relationships → Map_Area__c → Synchronisée** (ou `Is_Synchronized__c`)
2. Cliquez sur **View** pour accéder à la configuration FLS
3. Pour chaque **Profil** qui doit voir ce champ, cochez :
   - ✅ **Readable** (pour voir le champ)
   - ✅ **Editable** (optionnel)
4. **Sauvegardez**

**Note** : Les champs Number et Text (Latitude, Longitude, Address) sont visibles par défaut, mais les champs Checkbox comme `Is_Synchronized__c` nécessitent cette configuration FLS supplémentaire.
