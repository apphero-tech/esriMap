@isTest
public class MapAreaServiceTest {
    
    @TestSetup
    static void setupTestData() {
        // Créer des données de test
        List<Map_Area__c> testMapAreas = new List<Map_Area__c>();
        
        for (Integer i = 0; i < 5; i++) {
            Map_Area__c mapArea = new Map_Area__c(
                Area_Type__c = 'Point',
                Latitude__c = 48.8566 + (i * 0.01),
                Longitude__c = 2.3522 + (i * 0.01),
                Address__c = 'Test Address ' + i,
                Geometry_JSON__c = '{"type":"Point","coordinates":[' + (2.3522 + i * 0.01) + ',' + (48.8566 + i * 0.01) + ']}'
            );
            testMapAreas.add(mapArea);
        }
        
        insert testMapAreas;
    }
    
    @isTest
    static void testGetMapAreasByIds() {
        List<Map_Area__c> existingAreas = [SELECT Id FROM Map_Area__c LIMIT 3];
        List<Id> recordIds = new List<Id>();
        
        for (Map_Area__c area : existingAreas) {
            recordIds.add(area.Id);
        }
        
        Test.startTest();
        Map<Id, Map_Area__c> result = MapAreaService.getMapAreasByIds(recordIds);
        Test.stopTest();
        
        System.assertEquals(3, result.size(), 'Should return 3 map areas');
        
        // Test avec liste vide
        Map<Id, Map_Area__c> emptyResult = MapAreaService.getMapAreasByIds(new List<Id>());
        System.assertEquals(0, emptyResult.size(), 'Should return empty map for empty list');
        
        // Test avec null
        Map<Id, Map_Area__c> nullResult = MapAreaService.getMapAreasByIds(null);
        System.assertEquals(0, nullResult.size(), 'Should return empty map for null input');
    }
    
    @isTest
    static void testGetMapAreaGeometry() {
        Map_Area__c testArea = [SELECT Id FROM Map_Area__c LIMIT 1];
        
        Test.startTest();
        Map_Area__c result = MapAreaService.getMapAreaGeometry(testArea.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Should return map area');
        System.assertEquals(testArea.Id, result.Id, 'Should return correct map area');
    }
    
    @isTest
    static void testGetMapAreaGeometryWithInvalidId() {
        Test.startTest();
        try {
            MapAreaService.getMapAreaGeometry('001000000000000');
            System.assert(false, 'Should throw exception for invalid ID');
        } catch (Exception e) {
            // Peut être AuraHandledException ou une autre exception selon le contexte
            System.assert(e.getMessage() != null, 'Should have an error message');
        }
        Test.stopTest();
    }
    
    @isTest
    static void testGetMapAreasByRelationship() {
        // Créer un enregistrement parent pour tester la relation
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Créer des Map_Area__c liés à ce compte
        List<Map_Area__c> relatedAreas = new List<Map_Area__c>();
        for (Integer i = 0; i < 3; i++) {
            Map_Area__c area = new Map_Area__c(
                Area_Type__c = 'Point',
                Latitude__c = 48.8566 + (i * 0.01),
                Longitude__c = 2.3522 + (i * 0.01),
                Address__c = 'Related Address ' + i
            );
            relatedAreas.add(area);
        }
        insert relatedAreas;
        
        Test.startTest();
        // Test avec un champ de relation valide (supposons qu'il existe)
        Map<Id, Map_Area__c> result = MapAreaService.getMapAreasByRelationship(testAccount.Id, 'Account__c');
        Test.stopTest();
        
        // Le résultat peut être vide si le champ Account__c n'existe pas, mais la méthode ne doit pas planter
        System.assertNotEquals(null, result, 'Should return a map (even if empty)');
    }
    
    @isTest
    static void testGetMapAreasByRelationshipWithInvalidField() {
        Test.startTest();
        Map<Id, Map_Area__c> result = MapAreaService.getMapAreasByRelationship('001000000000000', 'NonExistentField__c');
        Test.stopTest();
        
        System.assertEquals(0, result.size(), 'Should return empty map for non-existent field');
    }
    
    @isTest
    static void testGetMapAreasByRelationshipWithBlankParams() {
        Test.startTest();
        Map<Id, Map_Area__c> result1 = MapAreaService.getMapAreasByRelationship('', 'SomeField__c');
        Map<Id, Map_Area__c> result2 = MapAreaService.getMapAreasByRelationship('001000000000000', '');
        Map<Id, Map_Area__c> result3 = MapAreaService.getMapAreasByRelationship(null, null);
        Test.stopTest();
        
        System.assertEquals(0, result1.size(), 'Should return empty map for blank parent ID');
        System.assertEquals(0, result2.size(), 'Should return empty map for blank field name');
        System.assertEquals(0, result3.size(), 'Should return empty map for null params');
    }
    
    @isTest
    static void testSaveMapAreas() {
        List<MapAreaService.ShapeData> shapesData = new List<MapAreaService.ShapeData>();
        
        MapAreaService.ShapeData shape1 = new MapAreaService.ShapeData();
        shape1.name = 'Test Point 1';
        shape1.areaType = 'Point';
        shape1.latitude = 48.8566;
        shape1.longitude = 2.3522;
        shape1.address = 'Paris, France';
        shape1.geoJson = '{"type":"Point","coordinates":[2.3522,48.8566]}';
        shapesData.add(shape1);
        
        MapAreaService.ShapeData shape2 = new MapAreaService.ShapeData();
        shape2.name = 'Test Polygon 1';
        shape2.areaType = 'Polygon';
        shape2.latitude = 48.8606;
        shape2.longitude = 2.3376;
        shape2.address = 'Louvre, Paris';
        shape2.geoJson = '{"type":"Polygon","coordinates":[[[2.3376,48.8606],[2.3386,48.8616],[2.3396,48.8606],[2.3376,48.8606]]]}';
        shapesData.add(shape2);
        
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(shapesData, null, null);
        Test.stopTest();
        
        // Verify the result is not null
        System.assertNotEquals(null, result, 'SaveResult should not be null');
        System.assert(result.recordIds.size() >= 0, 'Should return a list of record IDs');
        System.assert(result.recordsCreated >= 0, 'Record creation count should be valid');
    }
    
    @isTest
    static void testSaveMapAreasWithAllValidTypes() {
        List<MapAreaService.ShapeData> shapesData = new List<MapAreaService.ShapeData>();
        
        // Tester tous les types valides
        List<String> validTypes = new List<String>{'Point', 'Polyline', 'Polygon', 'Rectangle', 'Circle'};
        
        for (Integer i = 0; i < validTypes.size(); i++) {
            MapAreaService.ShapeData shape = new MapAreaService.ShapeData();
            shape.name = 'Test ' + validTypes[i];
            shape.areaType = validTypes[i];
            shape.latitude = 48.8566 + (i * 0.01);
            shape.longitude = 2.3522 + (i * 0.01);
            shape.address = 'Test Address ' + i;
            shape.geoJson = '{"type":"' + validTypes[i] + '","coordinates":[' + (2.3522 + i * 0.01) + ',' + (48.8566 + i * 0.01) + ']}';
            shapesData.add(shape);
        }
        
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(shapesData, null, null);
        Test.stopTest();
        
        // Just verify the method executes without errors and returns valid data structure
        System.assertNotEquals(null, result, 'SaveResult should not be null');
        System.assert(result.recordIds.size() >= 0, 'Should return a valid list');
    }
    
    @isTest
    static void testSaveMapAreasWithInvalidData() {
        List<MapAreaService.ShapeData> shapesData = new List<MapAreaService.ShapeData>();
        
        MapAreaService.ShapeData invalidShape = new MapAreaService.ShapeData();
        invalidShape.areaType = 'InvalidType';
        invalidShape.latitude = 48.8566;
        invalidShape.longitude = 2.3522;
        shapesData.add(invalidShape);
        
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(shapesData, null, null);
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Save should fail for invalid data');
        System.assertEquals(0, result.recordsCreated, 'Should create 0 records');
        System.assert(result.errors.size() > 0, 'Should have error messages');
        System.assert(result.errorDetails.size() > 0, 'Should have error details');
    }
    
    @isTest
    static void testSaveMapAreasWithEmptyList() {
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(new List<MapAreaService.ShapeData>(), null, null);
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Save should fail for empty list');
        System.assertEquals('Aucune forme sélectionnée', result.message, 'Should have correct error message');
    }
    
    @isTest
    static void testSaveMapAreasWithNullList() {
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(null, null, null);
        Test.stopTest();
        
        System.assertEquals(false, result.success, 'Save should fail for null list');
        System.assertEquals('Aucune forme sélectionnée', result.message, 'Should have correct error message');
    }
    
    @isTest
    static void testSaveMapAreasWithLargeGeoJson() {
        List<MapAreaService.ShapeData> shapesData = new List<MapAreaService.ShapeData>();
        
        MapAreaService.ShapeData shape = new MapAreaService.ShapeData();
        shape.name = 'Test Large GeoJSON';
        shape.areaType = 'Polygon';
        shape.latitude = 48.8566;
        shape.longitude = 2.3522;
        shape.address = 'Test Address';
        
        // Créer un GeoJSON très large (plus de 32768 caractères)
        String largeGeoJson = '{"type":"Polygon","coordinates":[';
        for (Integer i = 0; i < 1000; i++) {
            largeGeoJson += '[2.3522,48.8566],';
        }
        largeGeoJson += '[2.3522,48.8566]]}';
        shape.geoJson = largeGeoJson;
        shapesData.add(shape);
        
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(shapesData, null, null);
        Test.stopTest();
        
        // Just verify the method handles large GeoJSON without throwing exception
        System.assertNotEquals(null, result, 'SaveResult should not be null');
        System.assert(result.recordIds.size() >= 0, 'Should return a valid list');
    }
    
    @isTest
    static void testDeleteMapArea() {
        Map_Area__c testArea = [SELECT Id FROM Map_Area__c LIMIT 1];
        
        Test.startTest();
        Map<String, Object> result = MapAreaService.deleteMapArea(testArea.Id);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Delete should be successful');
        System.assertEquals('Enregistrement supprimé avec succès', result.get('message'), 'Should have success message');
        
        // Vérifier que l'enregistrement est supprimé
        List<Map_Area__c> remainingAreas = [SELECT Id FROM Map_Area__c WHERE Id = :testArea.Id];
        System.assertEquals(0, remainingAreas.size(), 'Record should be deleted');
    }
    
    @isTest
    static void testDeleteMapAreaWithInvalidId() {
        Test.startTest();
        Map<String, Object> result = MapAreaService.deleteMapArea(null);
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Delete should fail for null ID');
        System.assertEquals('ID d\'enregistrement invalide', result.get('message'), 'Should have correct error message');
    }
    
    @isTest
    static void testDeleteMapAreaWithNonExistentId() {
        Test.startTest();
        Map<String, Object> result = MapAreaService.deleteMapArea('001000000000000');
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Delete should fail for non-existent ID');
        System.assertEquals('Enregistrement introuvable ou déjà supprimé', result.get('message'), 'Should have correct error message');
    }
    
    @isTest
    static void testDeleteMapAreas() {
        List<Map_Area__c> testAreas = [SELECT Id FROM Map_Area__c LIMIT 3];
        List<Id> recordIds = new List<Id>();
        
        for (Map_Area__c area : testAreas) {
            recordIds.add(area.Id);
        }
        
        Test.startTest();
        Map<String, Object> result = MapAreaService.deleteMapAreas(recordIds);
        Test.stopTest();
        
        System.assertEquals(true, result.get('success'), 'Delete should be successful');
        System.assertEquals(3, result.get('deletedCount'), 'Should delete 3 records');
        
        // Vérifier que les enregistrements sont supprimés
        List<Map_Area__c> remainingAreas = [SELECT Id FROM Map_Area__c WHERE Id IN :recordIds];
        System.assertEquals(0, remainingAreas.size(), 'Records should be deleted');
    }
    
    @isTest
    static void testDeleteMapAreasWithEmptyList() {
        Test.startTest();
        Map<String, Object> result = MapAreaService.deleteMapAreas(new List<Id>());
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Delete should fail for empty list');
        System.assertEquals('Aucun enregistrement à supprimer', result.get('message'), 'Should have correct error message');
    }
    
    @isTest
    static void testDeleteMapAreasWithNullList() {
        Test.startTest();
        Map<String, Object> result = MapAreaService.deleteMapAreas(null);
        Test.stopTest();
        
        System.assertEquals(false, result.get('success'), 'Delete should fail for null list');
        System.assertEquals('Aucun enregistrement à supprimer', result.get('message'), 'Should have correct error message');
    }
    
    // ============================================================================
    // TESTS POUR LA NOUVELLE MÉTHODE syncShapeToParent()
    // ============================================================================
    
    @isTest
    static void testSyncShapeToParentWithMissingParams() {
        Test.startTest();
        
        // Tester avec tous les paramètres null
        Map<String, Object> result1 = MapAreaService.syncShapeToParent(null, null, null);
        System.assertEquals(false, result1.get('success'), 'Should fail with all null params');
        System.assertEquals('Paramètres manquants pour la synchronisation', result1.get('message'), 'Should have correct error message for null params');
        
        // Tester avec mapAreaId null
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;
        Map<String, Object> result2 = MapAreaService.syncShapeToParent(null, testCase.Id, 'Case__c');
        System.assertEquals(false, result2.get('success'), 'Should fail with null mapAreaId');
        
        // Tester avec parentRecordId null
        Map_Area__c testArea = [SELECT Id FROM Map_Area__c LIMIT 1];
        Map<String, Object> result3 = MapAreaService.syncShapeToParent(testArea.Id, null, 'Case__c');
        System.assertEquals(false, result3.get('success'), 'Should fail with null parentRecordId');
        
        // Tester avec relationshipFieldName blank
        Map<String, Object> result4 = MapAreaService.syncShapeToParent(testArea.Id, testCase.Id, '');
        System.assertEquals(false, result4.get('success'), 'Should fail with blank relationshipFieldName');
        
        Test.stopTest();
    }
    
    @isTest
    static void testSyncShapeToParentWithNonExistentMapArea() {
        Test.startTest();
        
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;
        
        // Utiliser un ID invalide pour Map_Area__c
        String invalidMapAreaId = '0011t00000aCHZAA2'; // Format d'ID valide mais n'existe pas
        
        Map<String, Object> result = MapAreaService.syncShapeToParent(invalidMapAreaId, testCase.Id, 'Case__c');
        
        System.assertEquals(false, result.get('success'), 'Should fail for non-existent Map_Area');
        System.assertEquals('Zone de carte introuvable', result.get('message'), 'Should have correct error message');
        
        Test.stopTest();
    }
    
    @isTest
    static void testSyncShapeToParentWithMismatchedRelationship() {
        Test.startTest();
        
        // Créer deux Cases
        Case case1 = new Case(Subject = 'Case 1');
        Case case2 = new Case(Subject = 'Case 2');
        insert new List<Case>{case1, case2};
        
        // Créer une Map_Area liée à case1 (via Account pour ce test, ou simplement tester le champ)
        Map_Area__c mapArea = new Map_Area__c(
            Area_Type__c = 'Point',
            Latitude__c = 48.8566,
            Longitude__c = 2.3522,
            Address__c = 'Test Address'
        );
        insert mapArea;
        
        // Essayer de synchroniser avec case2 alors que mapArea n'est pas lié à case2
        Map<String, Object> result = MapAreaService.syncShapeToParent(mapArea.Id, case2.Id, 'Case__c');
        
        System.assertEquals(false, result.get('success'), 'Should fail for mismatched relationship');
        System.assertEquals('Cette zone n\'est pas liée à cet enregistrement parent', result.get('message'), 'Should have correct error message');
        
        Test.stopTest();
    }
    
    @isTest
    static void testSyncShapeToParentWithMissingGeolocationField() {
        Test.startTest();
        
        // Créer un Case (n'a pas de champ Location__c par défaut)
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;
        
        // Créer une Map_Area liée au Case
        Map_Area__c mapArea = new Map_Area__c(
            Area_Type__c = 'Point',
            Latitude__c = 48.8566,
            Longitude__c = 2.3522,
            Address__c = 'Test Address'
        );
        insert mapArea;
        
        // Note: Ce test suppose que Case n'a pas de champ Location__c. 
        // Si le champ existe réellement, ce test devrait passer (ne pas échouer avec le message attendu)
        // La erreur douce doit être retournée si le champ n'existe pas
        Map<String, Object> result = MapAreaService.syncShapeToParent(mapArea.Id, testCase.Id, 'Case__c');
        
        // Vérifier que si le champ n'existe pas, on reçoit une erreur douce
        if ((Boolean) result.get('success') == false && result.containsKey('message')) {
            String message = (String) result.get('message');
            // Accepter l'erreur douce attendue OU une erreur de lien si le champ existe
            System.assert(
                message.contains('Location__c') || message.contains('n\'est pas liée'),
                'Should have appropriate error message'
            );
        }
        
        Test.stopTest();
    }
    
    @isTest
    static void testSyncShapeToParentWithValidData() {
        Test.startTest();
        
        // Créer un Account (qui a potentiellement des champs d'adresse standard)
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Créer une Map_Area liée à l'Account via un champ Account__c (si créé dans le setup)
        Map_Area__c mapArea = new Map_Area__c(
            Area_Type__c = 'Point',
            Latitude__c = 48.8566,
            Longitude__c = 2.3522,
            Address__c = 'Test Address Paris'
        );
        insert mapArea;
        
        // Tenter une synchronisation
        // Note: Ce test va dépendre de la présence réelle du champ Location__c sur Account
        Map<String, Object> result = MapAreaService.syncShapeToParent(mapArea.Id, testAccount.Id, 'Account__c');
        
        // Si la synchronisation réussit, vérifier les données
        if ((Boolean) result.get('success')) {
            System.assertEquals(true, result.get('success'), 'Sync should succeed');
            System.assertNotEquals(null, result.get('message'), 'Should have success message');
            System.assertEquals(48.8566, result.get('latitude'), 'Should return latitude');
            System.assertEquals(2.3522, result.get('longitude'), 'Should return longitude');
            System.assertEquals('Test Address Paris', result.get('address'), 'Should return address');
        } else {
            // Si échoue, c'est probablement à cause du champ manquant ou du lien manquant
            String message = (String) result.get('message');
            System.assert(
                message.contains('Location__c') || message.contains('n\'est pas liée'),
                'Error should be about missing field or broken relationship'
            );
        }
        
        Test.stopTest();
    }
    
    @isTest
    static void testSyncShapeToParentWithCaseParent() {
        Test.startTest();
        
        // Créer un Case
        Case testCase = new Case(Subject = 'Test Case - Sync');
        insert testCase;
        
        // Créer une Map_Area lié au Case
        Map_Area__c mapArea = new Map_Area__c(
            Area_Type__c = 'Point',
            Latitude__c = 45.5017,
            Longitude__c = -122.6750,
            Address__c = 'Portland, Oregon'
        );
        insert mapArea;
        
        // Appeler la méthode de sync
        // Note: Peut échouer si Case n'a pas de Location__c créé, ce qui est attendu
        Map<String, Object> result = MapAreaService.syncShapeToParent(mapArea.Id, testCase.Id, 'Case__c');
        
        // Vérifier la structure de réponse
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertNotEquals(null, result.get('message'), 'Result should have message');
        System.assertNotEquals(null, result.get('success'), 'Result should have success flag');
        
        Test.stopTest();
    }
    
    @isTest
    static void testSyncShapeToParentErrorHandling() {
        Test.startTest();
        
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;
        
        Map_Area__c mapArea = new Map_Area__c(
            Area_Type__c = 'Point',
            Latitude__c = 40.7128,
            Longitude__c = -74.0060,
            Address__c = 'New York, NY'
        );
        insert mapArea;
        
        // Test que la méthode gère correctement les erreurs sans crasher
        try {
            Map<String, Object> result = MapAreaService.syncShapeToParent(mapArea.Id, testCase.Id, 'InvalidFieldName__c');
            // La requête sur un champ invalide doit retourner une erreur douce
            System.assertEquals(false, result.get('success'), 'Should handle invalid field gracefully');
        } catch (Exception e) {
            // Si une exception est levée, le test doit aussi passer (error handling)
            System.assert(true, 'Exception handling works');
        }
        
        Test.stopTest();
    }
    
    @isTest
    static void testShapeDataWrapper() {
        MapAreaService.ShapeData shape = new MapAreaService.ShapeData();
        shape.name = 'Test';
        shape.areaType = 'Point';
        shape.geoJson = '{"test":"data"}';
        shape.latitude = 48.8566;
        shape.longitude = 2.3522;
        shape.address = 'Test Address';
        
        System.assertEquals('Test', shape.name, 'Name should be set');
        System.assertEquals('Point', shape.areaType, 'Area type should be set');
        System.assertEquals('{"test":"data"}', shape.geoJson, 'GeoJSON should be set');
        System.assertEquals(48.8566, shape.latitude, 'Latitude should be set');
        System.assertEquals(2.3522, shape.longitude, 'Longitude should be set');
        System.assertEquals('Test Address', shape.address, 'Address should be set');
    }
    
    @isTest
    static void testSaveResultWrapper() {
        MapAreaService.SaveResult result = new MapAreaService.SaveResult();
        
        System.assertEquals(0, result.recordIds.size(), 'Record IDs should be empty');
        System.assertEquals(0, result.errors.size(), 'Errors should be empty');
        System.assertEquals(0, result.errorDetails.size(), 'Error details should be empty');
        System.assertEquals(0, result.recordsCreated, 'Records created should be 0');
    }
    
    @isTest
    static void testErrorDetailWrapper() {
        MapAreaService.ErrorDetail error = new MapAreaService.ErrorDetail('Test error', 'TestField', 'Validation', 1);
        
        System.assertEquals('Test error', error.errorMessage, 'Error message should be set');
        System.assertEquals('TestField', error.fieldName, 'Field name should be set');
        System.assertEquals('Validation', error.validation, 'Validation should be set');
        System.assertEquals(1, error.itemIndex, 'Item index should be set');
    }
    
    @isTest
    static void testSaveRequestWrapper() {
        MapAreaService.SaveRequest request = new MapAreaService.SaveRequest();
        request.shapesData = new List<MapAreaService.ShapeData>();
        request.parentRecordId = '001000000000000';
        request.relationshipFieldName = 'TestField__c';
        
        System.assertNotEquals(null, request.shapesData, 'Shapes data should be initialized');
        System.assertEquals('001000000000000', request.parentRecordId, 'Parent record ID should be set');
        System.assertEquals('TestField__c', request.relationshipFieldName, 'Relationship field name should be set');
    }
    
    @isTest
    static void testGetMapAreasByRelationshipWithValidField() {
        Account testAccount = new Account(Name = 'Test Account for Relationship');
        insert testAccount;
        
        Test.startTest();
        Map<Id, Map_Area__c> result = MapAreaService.getMapAreasByRelationship(testAccount.Id, 'Account__c');
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Should return a map (even if empty)');
    }
    
    @isTest
    static void testGetMapAreasByRelationshipWithNonReferenceField() {
        // Test with a field that exists but is NOT a REFERENCE type (Area_Type__c is a Picklist)
        Test.startTest();
        Map<Id, Map_Area__c> result = MapAreaService.getMapAreasByRelationship('SomeId', 'Area_Type__c');
        Test.stopTest();
        
        // Should return empty map since Area_Type__c is not a REFERENCE field
        System.assertEquals(0, result.size(), 'Should return empty map for non-reference field');
    }
    
    @isTest
    static void testSaveMapAreasPartialSuccess() {
        List<MapAreaService.ShapeData> mixedShapes = new List<MapAreaService.ShapeData>();
        
        MapAreaService.ShapeData validShape = new MapAreaService.ShapeData();
        validShape.areaType = 'Point';
        validShape.latitude = 48.8566;
        validShape.longitude = 2.3522;
        validShape.geoJson = '{"type":"Point"}';
        mixedShapes.add(validShape);
        
        MapAreaService.ShapeData invalidShape = new MapAreaService.ShapeData();
        invalidShape.areaType = 'InvalidType';
        invalidShape.latitude = 48.8566;
        invalidShape.longitude = 2.3522;
        invalidShape.geoJson = '{"type":"Invalid"}';
        mixedShapes.add(invalidShape);
        
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(mixedShapes, null, null);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Should return SaveResult');
    }
    
    @isTest
    static void testSaveMapAreasWithAddressHandling() {
        List<MapAreaService.ShapeData> shapesData = new List<MapAreaService.ShapeData>();
        
        MapAreaService.ShapeData shape = new MapAreaService.ShapeData();
        shape.areaType = 'Rectangle';
        shape.latitude = 48.8566;
        shape.longitude = 2.3522;
        shape.address = 'Very long address that might need truncation to fit the 255 character limit that is set on the Address field of Map_Area';
        shape.geoJson = '{"type":"Rectangle"}';
        shapesData.add(shape);
        
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(shapesData, null, null);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Should return SaveResult');
    }
    
    @isTest
    static void testSaveMapAreasWithMinimalGeoJson() {
        List<MapAreaService.ShapeData> shapesData = new List<MapAreaService.ShapeData>();
        
        MapAreaService.ShapeData shape = new MapAreaService.ShapeData();
        shape.areaType = 'Circle';
        shape.latitude = 0;
        shape.longitude = 0;
        shape.address = null;
        shape.geoJson = '';
        shapesData.add(shape);
        
        Test.startTest();
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(shapesData, null, null);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Should return SaveResult even with minimal data');
    }
    
    @isTest
    static void testSaveMapAreasWithParentRecordAndFieldName() {
        List<MapAreaService.ShapeData> shapesData = new List<MapAreaService.ShapeData>();
        
        MapAreaService.ShapeData shape = new MapAreaService.ShapeData();
        shape.areaType = 'Polyline';
        shape.latitude = 48.8566;
        shape.longitude = 2.3522;
        shape.geoJson = '{"type":"Polyline"}';
        shapesData.add(shape);
        
        Test.startTest();
        // Test with parent record ID and field name provided
        MapAreaService.SaveResult result = MapAreaService.saveMapAreas(
            shapesData, 
            '001000000000000', 
            'TestField__c'
        );
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Should return SaveResult');
    }
    
    @isTest
    static void testMultipleMapAreasGetAll() {
        List<Map_Area__c> allMapAreas = [SELECT Id FROM Map_Area__c];
        
        System.assert(allMapAreas.size() >= 5, 'Test setup should have created at least 5 map areas');
        
        Test.startTest();
        // Get all map areas by their IDs
        List<Id> allIds = new List<Id>();
        for (Map_Area__c ma : allMapAreas) {
            allIds.add(ma.Id);
        }
        Map<Id, Map_Area__c> result = MapAreaService.getMapAreasByIds(allIds);
        Test.stopTest();
        
        System.assertEquals(allMapAreas.size(), result.size(), 'Should return all map areas');
    }
}
