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
                          'Area_Type__c, Geometry_JSON__c, CreatedBy.Name, CreatedDate ' +
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
}
