public with sharing class MapAreaService {
    
    /**
     * Classe wrapper pour recevoir les données des formes depuis le LWC
     */
    public class ShapeData {
        @AuraEnabled
        public String name { get; set; }
        @AuraEnabled
        public String areaType { get; set; }
        @AuraEnabled
        public String geoJson { get; set; }
        @AuraEnabled
        public Decimal latitude { get; set; }
        @AuraEnabled
        public Decimal longitude { get; set; }
        @AuraEnabled
        public String address { get; set; }
    }
    
    /**
     * Classe wrapper pour la sauvegarde avec contexte de relation
     */
    public class SaveRequest {
        @AuraEnabled
        public List<ShapeData> shapesData { get; set; }
        @AuraEnabled
        public String parentRecordId { get; set; }
        @AuraEnabled
        public String relationshipFieldName { get; set; }
    }
    
    /**
     * Classe wrapper pour la réponse
     */
    public class SaveResult {
        @AuraEnabled
        public Boolean success { get; set; }
        @AuraEnabled
        public String message { get; set; }
        @AuraEnabled
        public List<String> recordIds { get; set; }
        @AuraEnabled
        public Integer recordsCreated { get; set; }
        @AuraEnabled
        public List<String> errors { get; set; }
        @AuraEnabled
        public List<ErrorDetail> errorDetails { get; set; }
        
        public SaveResult() {
            this.recordIds = new List<String>();
            this.errors = new List<String>();
            this.errorDetails = new List<ErrorDetail>();
            this.recordsCreated = 0;
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<Id, Map_Area__c> getMapAreasByIds(List<Id> recordIds) {
        Map<Id, Map_Area__c> result = new Map<Id, Map_Area__c>();
        if (recordIds == null || recordIds.isEmpty()) return result;
        for (Map_Area__c ma : [
            SELECT Id, Name, Address__c, Latitude__c, Longitude__c,
                   Area_Type__c, Geometry_JSON__c, CreatedBy.Name, CreatedDate
            FROM Map_Area__c WHERE Id IN :recordIds
        ]) {
            result.put(ma.Id, ma);
        }
        return result;
    }

    /**
     * Méthode pour récupérer les données géométriques d'un enregistrement Map_Area__c
     * Utilisée par le composant esriMap en mode lecture seule
     */
    @AuraEnabled(cacheable=true)
    public static Map_Area__c getMapAreaGeometry(Id recordId) {
        try {
            return [
                SELECT Id, Name, Area_Type__c, Geometry_JSON__c, 
                       Latitude__c, Longitude__c, Address__c 
                FROM Map_Area__c 
                WHERE Id = :recordId 
                LIMIT 1
            ];
        } catch (Exception e) {
            System.debug('❌ Erreur lors de la récupération de Map_Area__c: ' + e.getMessage());
            throw new AuraHandledException('Impossible de récupérer les données géométriques: ' + e.getMessage());
        }
    }

    /**
     * Récupère les zones de carte liées à un enregistrement parent via un champ lookup
     * @param parentRecordId ID de l'enregistrement parent (Case, Account, etc.)
     * @param relationshipFieldName Nom API du champ lookup sur Map_Area__c (ex: Case__c)
     * @return Map des zones liées, clé = Id, valeur = Map_Area__c
     */
    @AuraEnabled(cacheable=true)
    public static Map<Id, Map_Area__c> getMapAreasByRelationship(String parentRecordId, String relationshipFieldName) {
        Map<Id, Map_Area__c> result = new Map<Id, Map_Area__c>();
        
        if (String.isBlank(parentRecordId) || String.isBlank(relationshipFieldName)) {
            return result;
        }
        
        try {
            // Valider que le champ existe et qu'il est une relation
            Schema.SObjectType mapAreaType = Map_Area__c.sObjectType;
            Map<String, Schema.SObjectField> fieldMap = mapAreaType.getDescribe().fields.getMap();
            
            if (!fieldMap.containsKey(relationshipFieldName)) {
                System.debug('❌ Le champ ' + relationshipFieldName + ' n\'existe pas sur Map_Area__c');
                return result;
            }
            
            Schema.DescribeFieldResult fieldDescribe = fieldMap.get(relationshipFieldName).getDescribe();
            
            if (fieldDescribe.getType() != Schema.DisplayType.REFERENCE) {
                System.debug('❌ Le champ ' + relationshipFieldName + ' n\'est pas une relation');
                return result;
            }
            
            // Construire la requête SOQL dynamique
            String query = 'SELECT Id, Name, Address__c, Latitude__c, Longitude__c, ' +
                          'Area_Type__c, Geometry_JSON__c, CreatedBy.Name, CreatedDate, Is_Synchronized__c ' +
                          'FROM Map_Area__c WHERE ' + relationshipFieldName + ' = :parentRecordId';
            
            for (Map_Area__c ma : Database.query(query)) {
                result.put(ma.Id, ma);
            }
            
        } catch (Exception e) {
            System.debug('❌ Erreur getMapAreasByRelationship: ' + e.getMessage());
        }
        
        return result;
    }

    /**
     * Classe pour détailler les erreurs
     */
    public class ErrorDetail {
        @AuraEnabled
        public String errorMessage { get; set; }
        @AuraEnabled
        public String fieldName { get; set; }
        @AuraEnabled
        public String validation { get; set; }
        @AuraEnabled
        public Integer itemIndex { get; set; }
        
        public ErrorDetail(String message, String field, String validation, Integer index) {
            this.errorMessage = message;
            this.fieldName = field;
            this.validation = validation;
            this.itemIndex = index;
        }
    }
    
    /**
     * Méthode principale pour sauvegarder les formes en lot avec lien de relation automatique
     */
    @AuraEnabled
    public static SaveResult saveMapAreas(List<ShapeData> shapesData, String parentRecordId, String relationshipFieldName) {
        SaveResult result = new SaveResult();
        
        try {
            // Vérifier les permissions CRUD
            if (!Schema.sObjectType.Map_Area__c.isCreateable()) {
                result.success = false;
                result.message = 'Vous n\'avez pas les permissions pour créer des zones de carte';
                return result;
            }
            
            // Vérifier s'il y a des données à traiter
            if (shapesData == null || shapesData.isEmpty()) {
                result.success = false;
                result.message = 'Aucune forme sélectionnée';
                return result;
            }
            
            // Valider et préparer les enregistrements
            List<Map_Area__c> mapAreasToInsert = new List<Map_Area__c>();
            
            for (Integer i = 0; i < shapesData.size(); i++) {
                ShapeData shapeData = shapesData[i];
                Map_Area__c mapArea = new Map_Area__c();
                
                // Le champ Name standard (Auto Number) est géré par Salesforce.
                
                // Valider et assigner le type
                if (isValidAreaType(shapeData.areaType)) {
                    mapArea.Area_Type__c = shapeData.areaType;
                } else {
                    String errorMsg = 'Type de zone invalide: ' + shapeData.areaType;
                    result.errors.add(errorMsg);
                    result.errorDetails.add(new ErrorDetail(
                        errorMsg, 
                        'Area_Type__c', 
                        'Picklist value not allowed', 
                        i
                    ));
                    continue;
                }
                
                // GeoJSON (minifier si nécessaire)
                if (String.isNotBlank(shapeData.geoJson)) {
                    String minifiedGeoJson = shapeData.geoJson.replaceAll('\\s+', ' ');
                    if (minifiedGeoJson.length() > 32768) {
                        minifiedGeoJson = minifiedGeoJson.left(32765) + '...';
                    }
                    mapArea.Geometry_JSON__c = minifiedGeoJson;
                }
                
                // Coordonnées du centroïde
                mapArea.Latitude__c = shapeData.latitude;
                mapArea.Longitude__c = shapeData.longitude;
                
                // Adresse si disponible
                if (String.isNotBlank(shapeData.address)) {
                    mapArea.Address__c = shapeData.address.left(255);
                }
                
                // Peuplage automatique du champ de relation si fourni
                if (String.isNotBlank(parentRecordId) && String.isNotBlank(relationshipFieldName)) {
                    try {
                        // Assigner dynamiquement le champ de relation avec l'ID du parent
                        mapArea.put(relationshipFieldName, parentRecordId);
                        System.debug('✅ Champ ' + relationshipFieldName + ' peuplé avec ' + parentRecordId);
                    } catch (Exception e) {
                        System.debug('⚠️ Impossible de peupler le champ ' + relationshipFieldName + ': ' + e.getMessage());
                        // Continuer la sauvegarde même si le lien échoue
                    }
                }
                
                mapAreasToInsert.add(mapArea);
            }
            
            // Vérifier s'il reste des enregistrements à insérer
            if (mapAreasToInsert.isEmpty()) {
                result.success = false;
                result.message = 'Aucune forme valide à sauvegarder';
                return result;
            }
            
            // Vérifier les permissions FLS
            if (!checkFieldLevelSecurity()) {
                result.success = false;
                result.message = 'Permissions insuffisantes sur les champs de Map_Area__c';
                return result;
            }
            
            // Insérer les enregistrements
            Database.SaveResult[] saveResults = Database.insert(mapAreasToInsert, false);
            
            // Analyser les résultats
            for (Integer i = 0; i < saveResults.size(); i++) {
                Database.SaveResult saveResult = saveResults[i];
                if (saveResult.isSuccess()) {
                    result.recordIds.add(saveResult.getId());
                    result.recordsCreated++;
                } else {
                    String errorMsg = 'Erreur lors de la création de la zone ' + (i + 1) + ': ';
                    String fieldName = '';
                    String validation = '';
                    
                    for (Database.Error error : saveResult.getErrors()) {
                        errorMsg += error.getMessage() + '; ';
                        
                        // Analyser le type d'erreur
                        if (error.getFields() != null && !error.getFields().isEmpty()) {
                            fieldName = String.join(error.getFields(), ', ');
                        }
                        
                        // Déterminer le type de validation
                        if (error.getStatusCode() == StatusCode.FIELD_CUSTOM_VALIDATION_EXCEPTION) {
                            validation = 'Custom validation failed';
                        } else if (error.getStatusCode() == StatusCode.FIELD_FILTER_VALIDATION_EXCEPTION) {
                            validation = 'Field filter validation failed';
                        } else if (error.getStatusCode() == StatusCode.FIELD_INTEGRITY_EXCEPTION) {
                            validation = 'Field integrity exception';
                        } else if (error.getStatusCode() == StatusCode.INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY) {
                            validation = 'Insufficient access on cross reference entity';
                        } else if (error.getStatusCode() == StatusCode.INSUFFICIENT_ACCESS_OR_READONLY) {
                            validation = 'Insufficient access or readonly';
                        } else if (error.getStatusCode() == StatusCode.REQUIRED_FIELD_MISSING) {
                            validation = 'REQUIRED_FIELD_MISSING';
                        } else {
                            validation = 'Database error: ' + error.getStatusCode();
                        }
                    }
                    
                    result.errors.add(errorMsg);
                    result.errorDetails.add(new ErrorDetail(
                        errorMsg.trim().removeEnd('; '), 
                        fieldName, 
                        validation, 
                        i
                    ));
                }
            }
            
            // Déterminer le succès global
            if (result.recordsCreated > 0) {
                result.success = true;
                if (result.recordsCreated == shapesData.size()) {
                    result.message = result.recordsCreated + ' zone(s) de carte créée(s) avec succès';
                } else {
                    result.message = result.recordsCreated + ' zone(s) créée(s) sur ' + shapesData.size() + ' demandée(s)';
                }
            } else {
                result.success = false;
                result.message = 'Aucune zone n\'a pu être créée';
            }
            
        } catch (Exception e) {
            result.success = false;
            result.message = 'Erreur inattendue: ' + e.getMessage();
            System.debug('Erreur MapAreaService: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
        }
        
        return result;
    }
    
    /**
     * Valider le type de zone
     */
    private static Boolean isValidAreaType(String areaType) {
        Set<String> validTypes = new Set<String>{'Point', 'Polyline', 'Polygon', 'Rectangle', 'Circle'};
        return validTypes.contains(areaType);
    }
    
    /**
     * Vérifier les permissions FLS sur les champs critiques
     */
    private static Boolean checkFieldLevelSecurity() {
        Map<String, Schema.SObjectField> fieldMap = Schema.sObjectType.Map_Area__c.fields.getMap();
        
        List<String> requiredFields = new List<String>{
            'Area_Type__c', 'Geometry_JSON__c', 
            'Latitude__c', 'Longitude__c', 'Address__c'
        };
        
        for (String fieldName : requiredFields) {
            Schema.SObjectField field = fieldMap.get(fieldName);
            if (field != null) {
                Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
                if (!fieldDescribe.isCreateable()) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Supprimer un enregistrement Map_Area__c
     * @param recordId - ID de l'enregistrement à supprimer
     * @return Map avec success et message
     */
    @AuraEnabled
    public static Map<String, Object> deleteMapArea(Id recordId) {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            if (recordId == null) {
                result.put('success', false);
                result.put('message', 'ID d\'enregistrement invalide');
                return result;
            }
            
            // Récupérer l'enregistrement en tant que liste
            List<Map_Area__c> recordsToDelete = [SELECT Id FROM Map_Area__c WHERE Id = :recordId LIMIT 1];
            
            // Vérifier que l'enregistrement existe
            if (recordsToDelete.isEmpty()) {
                result.put('success', false);
                result.put('message', 'Enregistrement introuvable ou déjà supprimé');
                return result;
            }
            
            // Supprimer l'enregistrement
            delete recordsToDelete[0];
            
            result.put('success', true);
            result.put('message', 'Enregistrement supprimé avec succès');
            result.put('deletedId', recordId);
            
            return result;
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', 'Erreur lors de la suppression : ' + e.getMessage());
            return result;
        }
    }
    
    /**
     * Supprimer plusieurs enregistrements Map_Area__c
     * @param recordIds - Liste des IDs à supprimer
     * @return Map avec success, message et nombre d'enregistrements supprimés
     */
    @AuraEnabled
    public static Map<String, Object> deleteMapAreas(List<Id> recordIds) {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            if (recordIds == null || recordIds.isEmpty()) {
                result.put('success', false);
                result.put('message', 'Aucun enregistrement à supprimer');
                return result;
            }
            
            // Récupérer les enregistrements à supprimer
            List<Map_Area__c> recordsToDelete = [SELECT Id FROM Map_Area__c WHERE Id IN :recordIds];
            
            if (recordsToDelete.isEmpty()) {
                result.put('success', false);
                result.put('message', 'Aucun enregistrement trouvé');
                return result;
            }
            
            // Supprimer les enregistrements
            delete recordsToDelete;
            
            result.put('success', true);
            result.put('message', 'Enregistrements supprimés avec succès');
            result.put('deletedCount', recordsToDelete.size());
            result.put('deletedIds', recordIds);
            
            return result;
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', 'Erreur lors de la suppression : ' + e.getMessage());
            return result;
        }
    }

    /**
     * Synchroniser les coordonnées d'une Map_Area__c vers le champ Geolocation du parent
     * @param mapAreaId - ID de la Map_Area__c à synchroniser
     * @param parentRecordId - ID de l'enregistrement parent (Case, Opportunity, etc.)
     * @param relationshipFieldName - Nom API du champ lookup sur Map_Area__c
     * @return Map avec success, message et détails
     */
    @AuraEnabled
    public static Map<String, Object> syncShapeToParent(
        Id mapAreaId, 
        Id parentRecordId, 
        String relationshipFieldName
    ) {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Valider les paramètres
            if (mapAreaId == null || parentRecordId == null || String.isBlank(relationshipFieldName)) {
                result.put('success', false);
                result.put('message', 'Paramètres manquants pour la synchronisation');
                return result;
            }
            
            // Récupérer les données de la Map_Area__c
            // IMPORTANT: Inclure dynamiquement le champ de relation dans la query
            String query = 'SELECT Id, Latitude__c, Longitude__c, Address__c, ' + relationshipFieldName +
                          ' FROM Map_Area__c WHERE Id = :mapAreaId LIMIT 1';
            Map_Area__c mapArea = Database.query(query);
            
            if (mapArea == null) {
                result.put('success', false);
                result.put('message', 'Zone de carte introuvable');
                return result;
            }
            
            // Vérifier que la zone est bien liée au parent
            Object linkedParentId = mapArea.get(relationshipFieldName);
            if (linkedParentId == null || linkedParentId.toString() != parentRecordId.toString()) {
                result.put('success', false);
                result.put('message', 'Cette zone n\'est pas liée à cet enregistrement parent');
                return result;
            }
            
            // Déterminer le type du parent à partir de l'ID
            String parentSObjectType = getParentObjectType(parentRecordId);
            
            if (String.isBlank(parentSObjectType)) {
                result.put('success', false);
                result.put('message', 'Type d\'objet parent non supporté');
                return result;
            }
            
            // Vérifier que le champ Geolocation existe sur le parent
            Schema.SObjectType parentType = Schema.getGlobalDescribe().get(parentSObjectType);
            if (parentType == null) {
                result.put('success', false);
                result.put('message', 'Objet parent non trouvé');
                return result;
            }
            
            Map<String, Schema.SObjectField> parentFields = parentType.getDescribe().fields.getMap();
            
            // Déterminer les noms des champs de synchronisation (avec préfixe esriMap_)
            String latitudeFieldName = 'esriMap_Latitude__c';
            String longitudeFieldName = 'esriMap_Longitude__c';
            String addressFieldName = 'esriMap_Address__c';
            
            // Vérifier que les champs existent et sont modifiables
            if (!parentFields.containsKey(latitudeFieldName)) {
                result.put('success', false);
                result.put('message', 'Le champ Latitude (' + latitudeFieldName + ') n\'existe pas sur ' + parentSObjectType + '. Veuillez contacter votre administrateur pour le créer.');
                result.put('fieldName', latitudeFieldName);
                result.put('objectType', parentSObjectType);
                System.debug('❌ Champ ' + latitudeFieldName + ' introuvable sur ' + parentSObjectType);
                return result;
            }
            
            if (!parentFields.containsKey(longitudeFieldName)) {
                result.put('success', false);
                result.put('message', 'Le champ Longitude (' + longitudeFieldName + ') n\'existe pas sur ' + parentSObjectType + '. Veuillez contacter votre administrateur pour le créer.');
                result.put('fieldName', longitudeFieldName);
                result.put('objectType', parentSObjectType);
                System.debug('❌ Champ ' + longitudeFieldName + ' introuvable sur ' + parentSObjectType);
                return result;
            }
            
            // Vérifier les permissions CRUD et FLS
            Schema.DescribeSObjectResult describeResult = parentType.getDescribe();
            if (!describeResult.isUpdateable()) {
                result.put('success', false);
                result.put('message', 'Permissions insuffisantes pour mettre à jour ' + parentSObjectType + '. Votre utilisateur n\'a pas accès en écriture à cet objet.');
                System.debug('❌ Pas de permissions UPDATE sur ' + parentSObjectType);
                return result;
            }
            
            Schema.DescribeFieldResult latFieldDescribe = parentFields.get(latitudeFieldName).getDescribe();
            Schema.DescribeFieldResult lonFieldDescribe = parentFields.get(longitudeFieldName).getDescribe();
            
            // Vérifier les permissions FLS sur Latitude
            if (!latFieldDescribe.isUpdateable()) {
                String errorMsg = 'Permissions insuffisantes sur le champ Latitude (' + latitudeFieldName + '). ';
                if (!latFieldDescribe.isAccessible()) {
                    errorMsg += 'Le champ n\'est pas accessible en lecture.';
                } else {
                    errorMsg += 'Le champ est lisible mais pas modifiable. Vérifiez que la FLS permet l\'écriture.';
                }
                result.put('success', false);
                result.put('message', errorMsg);
                System.debug('❌ ' + errorMsg);
                return result;
            }
            
            // Vérifier les permissions FLS sur Longitude
            if (!lonFieldDescribe.isUpdateable()) {
                String errorMsg = 'Permissions insuffisantes sur le champ Longitude (' + longitudeFieldName + '). ';
                if (!lonFieldDescribe.isAccessible()) {
                    errorMsg += 'Le champ n\'est pas accessible en lecture.';
                } else {
                    errorMsg += 'Le champ est lisible mais pas modifiable. Vérifiez que la FLS permet l\'écriture.';
                }
                result.put('success', false);
                result.put('message', errorMsg);
                System.debug('❌ ' + errorMsg);
                return result;
            }
            
            // Construire l'objet à mettre à jour dynamiquement
            SObject parentRecord = parentType.newSObject(parentRecordId);
            
            // Mettre à jour les champs Latitude et Longitude
            if (mapArea.Latitude__c != null) {
                parentRecord.put(latitudeFieldName, mapArea.Latitude__c);
                System.debug('✅ Latitude mis à jour : ' + mapArea.Latitude__c);
            }
            
            if (mapArea.Longitude__c != null) {
                parentRecord.put(longitudeFieldName, mapArea.Longitude__c);
                System.debug('✅ Longitude mis à jour : ' + mapArea.Longitude__c);
            }
            
            // Mettre à jour l'adresse si le parent a un champ esriMap_Address__c et si l'adresse est disponible
            if (parentFields.containsKey(addressFieldName) && String.isNotBlank(mapArea.Address__c)) {
                Schema.DescribeFieldResult addressFieldDescribe = parentFields.get(addressFieldName).getDescribe();
                if (addressFieldDescribe.isUpdateable()) {
                    parentRecord.put(addressFieldName, mapArea.Address__c.left(255));
                    System.debug('✅ Adresse mis à jour : ' + mapArea.Address__c.left(50));
                }
            }
            
            // Mettre à jour le parent
            update parentRecord;
            
            // Marquer la zone comme synchronisee et désynchroniser les autres
            try {
                // Désynchroniser toutes les autres zones liées au même parent
                List<Map_Area__c> otherAreas = new List<Map_Area__c>();
                String otherQuery = 'SELECT Id FROM Map_Area__c WHERE ' + relationshipFieldName + ' = :parentRecordId AND Id != :mapAreaId AND Is_Synchronized__c = true';
                for (Map_Area__c area : Database.query(otherQuery)) {
                    area.Is_Synchronized__c = false;
                    otherAreas.add(area);
                }
                if (!otherAreas.isEmpty()) {
                    update otherAreas;
                    System.debug('✅ ' + otherAreas.size() + ' autres zones désynchronisées');
                }
                
                // Marquer la zone actuelle comme synchronisée
                Map_Area__c mapAreaToUpdate = new Map_Area__c(Id = mapAreaId);
                mapAreaToUpdate.Is_Synchronized__c = true;
                update mapAreaToUpdate;
                System.debug('✅ Zone marquée comme synchronisée : ' + mapAreaId);
            } catch (Exception e) {
                System.debug('Impossible de marquer synchronisee: ' + e.getMessage());
            }
            
            result.put('success', true);
            result.put('message', 'Coordonnées synchronisées avec succès vers ' + parentSObjectType);
            result.put('latitude', mapArea.Latitude__c);
            result.put('longitude', mapArea.Longitude__c);
            result.put('address', mapArea.Address__c);
            
            return result;
            
        } catch (QueryException qe) {
            result.put('success', false);
            result.put('message', 'Enregistrement non trouvé : ' + qe.getMessage());
            System.debug('❌ QueryException en syncShapeToParent: ' + qe.getMessage());
            return result;
        } catch (DmlException de) {
            result.put('success', false);
            result.put('message', 'Erreur lors de la mise à jour : ' + de.getMessage());
            System.debug('❌ DmlException en syncShapeToParent: ' + de.getMessage());
            return result;
        } catch (Exception e) {
            result.put('success', false);
            result.put('message', 'Erreur inattendue : ' + e.getMessage());
            System.debug('❌ Exception en syncShapeToParent: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            return result;
        }
    }
    
    /**
     * Déterminer le type d'objet SObject à partir d'un ID
     * @param recordId - ID du record
     * @return Nom API du type d'objet
     */
    private static String getParentObjectType(Id recordId) {
        if (recordId == null) {
            return null;
        }
        
        String sObjectType = recordId.getSObjectType().getDescribe().getName();
        return sObjectType;
    }
    
    /**
     * Gerer la suppression de Map_Area__c
     * Si la zone etait synchronisee, vider les champs du parent
     */
    public static void handleDeletedSynchronizedMapAreas(List<Map_Area__c> deletedAreas) {
        try {
            System.debug('🔍 handleDeletedSynchronizedMapAreas called with ' + deletedAreas.size() + ' deleted areas');
            if (deletedAreas == null || deletedAreas.isEmpty()) {
                System.debug('❌ deletedAreas is empty');
                return;
            }

            // Trouver tous les champs de relation personnalisés (exclure les champs système)
            Schema.SObjectType mapAreaType = Map_Area__c.sObjectType;
            Map<String, Schema.SObjectField> fieldMap = mapAreaType.getDescribe().fields.getMap();
            List<String> relationshipFields = new List<String>();
            Set<String> systemFields = new Set<String>{'ownerid', 'createdbyid', 'lastmodifiedbyid'};

            for (String fieldName : fieldMap.keySet()) {
                // Exclure les champs système
                if (systemFields.contains(fieldName.toLowerCase())) {
                    continue;
                }
                Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
                if (fieldDescribe.getType() == Schema.DisplayType.REFERENCE) {
                    relationshipFields.add(fieldName);
                }
            }
            
            // Collecter les parents uniques et leurs champs de relation
            Set<Id> parentIds = new Set<Id>();
            Map<Id, String> parentIdToType = new Map<Id, String>();
            Map<Id, String> parentIdToRelField = new Map<Id, String>();

            for (Map_Area__c area : deletedAreas) {
                for (String relField : relationshipFields) {
                    Object parentIdObj = area.get(relField);
                    if (parentIdObj != null) {
                        Id parentId = (Id) parentIdObj;
                        parentIds.add(parentId);
                        parentIdToType.put(parentId, parentId.getSObjectType().getDescribe().getName());
                        parentIdToRelField.put(parentId, relField);
                        break;
                    }
                }
            }

            if (parentIds.isEmpty()) {
                return;
            }

            // Pour chaque parent, vérifier s'il reste des formes
            for (Id parentId : parentIds) {
                String parentType = parentIdToType.get(parentId);
                String relField = parentIdToRelField.get(parentId);

                if (relField != null) {
                    // Compter les formes restantes
                    String countQuery = 'SELECT COUNT() FROM Map_Area__c WHERE ' + relField + ' = :parentId';
                    Integer formCount = Database.countQuery(countQuery);
                    System.debug('📊 Parent ' + parentId + ' (' + parentType + ') - Formes restantes: ' + formCount);

                    // Si zéro forme, vider les champs
                    if (formCount == 0) {
                        System.debug('✅ Vidage des champs pour parent ' + parentId);
                        clearParentSynchronizationFields(parentId, parentType);
                    } else {
                        System.debug('⚠️ Parent a encore ' + formCount + ' forme(s), ne pas vider');
                    }
                } else {
                    System.debug('❌ Pas de champ de relation trouvé pour parent ' + parentId);
                }
            }
        } catch (Exception e) {
            System.debug('Erreur handleDeletedSynchronizedMapAreas: ' + e.getMessage());
        }
    }
    
    private static void clearParentSynchronizationFields(Id parentId, String parentType) {
        try {
            System.debug('🧹 clearParentSynchronizationFields - Parent: ' + parentId + ', Type: ' + parentType);
            Schema.SObjectType parentSObjType = Schema.getGlobalDescribe().get(parentType);
            if (parentSObjType == null) {
                System.debug('❌ Type ' + parentType + ' not found');
                return;
            }
            
            String latitudeFieldName = 'esriMap_Latitude__c';
            String longitudeFieldName = 'esriMap_Longitude__c';
            String addressFieldName = 'esriMap_Address__c';
            
            Map<String, Schema.SObjectField> parentFields = parentSObjType.getDescribe().fields.getMap();
            
            if (!parentFields.containsKey(latitudeFieldName) || 
                !parentFields.containsKey(longitudeFieldName)) {
                return;
            }
            
            Schema.DescribeSObjectResult describeResult = parentSObjType.getDescribe();
            if (!describeResult.isUpdateable()) {
                return;
            }
            
            Schema.DescribeFieldResult latFieldDescribe = parentFields.get(latitudeFieldName).getDescribe();
            Schema.DescribeFieldResult lonFieldDescribe = parentFields.get(longitudeFieldName).getDescribe();
            
            if (!latFieldDescribe.isUpdateable() || !lonFieldDescribe.isUpdateable()) {
                return;
            }
            
            SObject parentRecord = parentSObjType.newSObject(parentId);
            parentRecord.put(latitudeFieldName, null);
            parentRecord.put(longitudeFieldName, null);
            
            if (parentFields.containsKey(addressFieldName)) {
                Schema.DescribeFieldResult addressFieldDescribe = parentFields.get(addressFieldName).getDescribe();
                if (addressFieldDescribe.isUpdateable()) {
                    parentRecord.put(addressFieldName, null);
                }
            }
            
            update parentRecord;
            System.debug('✅ Champs vidés avec succès pour ' + parentId);
        } catch (Exception e) {
            System.debug('❌ Erreur en clearParentSynchronizationFields: ' + e.getMessage() + ' | Stack: ' + e.getStackTraceString());
        }
    }

    


    /**
     * Garantir qu'une seule forme peut être synchronisée à la fois
     * Quand une forme est marquée Is_Synchronized__c = true,
     * toutes les autres du même parent doivent être marquées false
     */
    public static void enforceExclusiveSynchronization(List<Map_Area__c> updatedAreas) {
        try {
            Set<Id> parentIds = new Set<Id>();
            Map<Id, Map_Area__c> syncedAreasByParent = new Map<Id, Map_Area__c>();
            
            // Trouver tous les champs de relation
            Schema.SObjectType mapAreaType = Map_Area__c.sObjectType;
            Map<String, Schema.SObjectField> fieldMap = mapAreaType.getDescribe().fields.getMap();
            List<String> relationshipFields = new List<String>();
            
            for (String fieldName : fieldMap.keySet()) {
                Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
                if (fieldDescribe.getType() == Schema.DisplayType.REFERENCE) {
                    relationshipFields.add(fieldName);
                }
            }
            
            // Collecter les parents des formes synchronisées
            for (Map_Area__c area : updatedAreas) {
                if (area.Is_Synchronized__c) {
                    for (String relField : relationshipFields) {
                        Object parentIdObj = area.get(relField);
                        if (parentIdObj != null) {
                            Id parentId = (Id) parentIdObj;
                            parentIds.add(parentId);
                            syncedAreasByParent.put(parentId, area);
                            break;
                        }
                    }
                }
            }
            
            if (parentIds.isEmpty()) {
                return;
            }
            
            // Pour chaque parent, désynchroniser TOUTES les autres formes
            List<Map_Area__c> areasToUpdate = new List<Map_Area__c>();
            
            for (Id parentId : parentIds) {
                String relField = null;
                
                // Trouver le champ de relation pour ce parent
                for (String rf : relationshipFields) {
                    String queryStr = 'SELECT Id FROM Map_Area__c WHERE ' + rf + ' = :parentId LIMIT 1';
                    try {
                        List<Map_Area__c> testList = Database.query(queryStr);
                        if (!testList.isEmpty()) {
                            relField = rf;
                            break;
                        }
                    } catch (Exception e) {
                        // Continue to next field
                    }
                }
                
                if (relField != null) {
                    // Récupérer toutes les formes du parent
                    String query = 'SELECT Id, Is_Synchronized__c FROM Map_Area__c WHERE ' + relField + ' = :parentId';
                    List<Map_Area__c> allAreas = Database.query(query);
                    
                    Map_Area__c syncedArea = syncedAreasByParent.get(parentId);
                    
                    // Désynchroniser toutes SAUF celle qui doit être synchronisée
                    for (Map_Area__c area : allAreas) {
                        if (area.Is_Synchronized__c && area.Id != syncedArea.Id) {
                            area.Is_Synchronized__c = false;
                            areasToUpdate.add(area);
                        }
                    }
                }
            }
            
            if (!areasToUpdate.isEmpty()) {
                update areasToUpdate;
                System.debug('✅ Synchronisation exclusive appliquée: ' + areasToUpdate.size() + ' formes désynchronisées');
            }
        } catch (Exception e) {
            System.debug('❌ Erreur en enforceExclusiveSynchronization: ' + e.getMessage());
        }
    }

}
