## RÈGLES DE DÉVELOPPEMENT - esriMap

### Test-Driven Development (TDD)
- **OBLIGATOIRE** : Couverture de tests à 100% pour tout nouveau code Apex
- Avant de créer/modifier du code Apex, créer/mettre à jour les tests correspondants
- Les tests doivent passer avant tout déploiement
- Vérifier la couverture avec : `sf apex run test --synchronous --code-coverage --result-format human --test-level RunLocalTests`

### Exigences 2GP (Second Generation Package)
- Couverture minimale requise par Salesforce : 75%
- Notre objectif : **100%** de couverture
- Chaque classe Apex du package doit être testée individuellement

### Classes Apex du package (couverture actuelle)
| Classe | Test | Couverture |
|--------|------|------------|
| MapAreaService.cls | MapAreaServiceTest.cls | 77% |
| MapAreaServiceDispatcher.cls | MapAreaServiceDispatcherTest.cls | 91% |
| Map_AreaTrigger.trigger | MapAreaServiceTest.cls | 100% |

### Composants LWC
- Tests Jest obligatoires pour chaque composant
- Fichiers : `__tests__/*.test.js`
- Exécuter les tests : `npm test`

### Champs personnalisés sur Case (pour synchronisation)
Le package inclut ces champs sur l'objet Case pour la synchronisation des coordonnées :
- `esriMap_Latitude__c` (Number)
- `esriMap_Longitude__c` (Number)
- `esriMap_Address__c` (Text)

### Règles de synchronisation Map_Area
- Une seule `Map_Area__c` peut être synchronisée par parent (via `Is_Synchronized__c`)
- Quand une zone est synchronisée, les autres du même parent sont automatiquement désynchronisées
- À la suppression de toutes les zones d'un parent, les champs `esriMap_*` sont vidés

### Commandes utiles
```bash
# Déployer le code
sf project deploy start --source-dir force-app -w 10

# Exécuter les tests Apex avec couverture
sf apex run test --synchronous --code-coverage --result-format human --test-level RunLocalTests

# Exécuter les tests Jest
npm test

# Créer une version du package
sf package version create -p esriMap -w 60 --code-coverage
```
