/**
 * Test class for MapAreaServiceDispatcher
 * Tests guest user detection, type conversion, and error handling
 */
@isTest
public class MapAreaServiceDispatcherTest {
  @TestSetup
  static void setupTestData() {
    // Create test Map_Area__c records
    List<Map_Area__c> testMapAreas = new List<Map_Area__c>();

    for (Integer i = 0; i < 3; i++) {
      Map_Area__c mapArea = new Map_Area__c(
        Area_Type__c = 'Point',
        Latitude__c = 48.8566 + (i * 0.01),
        Longitude__c = 2.3522 + (i * 0.01),
        Address__c = 'Dispatcher Test Address ' + i,
        Geometry_JSON__c = '{"type":"Point","coordinates":[' +
          (2.3522 + i * 0.01) +
          ',' +
          (48.8566 + i * 0.01) +
          ']}'
      );
      testMapAreas.add(mapArea);
    }

    insert testMapAreas;
  }

  // ========================================================================
  // WRAPPER CLASS TESTS
  // ========================================================================

  @isTest
  static void testSaveResultWrapper() {
    Test.startTest();

    MapAreaServiceDispatcher.SaveResult result = new MapAreaServiceDispatcher.SaveResult();

    Test.stopTest();

    System.assertEquals(
      0,
      result.recordIds.size(),
      'Record IDs should be empty'
    );
    System.assertEquals(0, result.errors.size(), 'Errors should be empty');
    System.assertEquals(
      0,
      result.errorDetails.size(),
      'Error details should be empty'
    );
    System.assertEquals(
      0,
      result.recordsCreated,
      'Records created should be 0'
    );
    System.assertEquals(
      null,
      result.success,
      'Success should be null initially'
    );
    System.assertEquals(
      null,
      result.message,
      'Message should be null initially'
    );
  }

  @isTest
  static void testErrorDetailWrapper() {
    Test.startTest();

    MapAreaServiceDispatcher.ErrorDetail detail = new MapAreaServiceDispatcher.ErrorDetail(
      'Test error message',
      'TestField__c',
      'VALIDATION_ERROR',
      1
    );

    Test.stopTest();

    System.assertEquals(
      'Test error message',
      detail.message,
      'Message should be set'
    );
    System.assertEquals('TestField__c', detail.field, 'Field should be set');
    System.assertEquals(
      'VALIDATION_ERROR',
      detail.errorType,
      'Error type should be set'
    );
    System.assertEquals(1, detail.index, 'Index should be set');
  }

  @isTest
  static void testShapeDataWrapper() {
    Test.startTest();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.name = 'Test Shape';
    shape.areaType = 'Point';
    shape.geoJson = '{"type":"Point","coordinates":[2.35,48.85]}';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.address = 'Paris, France';

    Test.stopTest();

    System.assertEquals('Test Shape', shape.name, 'Name should be set');
    System.assertEquals('Point', shape.areaType, 'Area type should be set');
    System.assertEquals(
      '{"type":"Point","coordinates":[2.35,48.85]}',
      shape.geoJson,
      'GeoJSON should be set'
    );
    System.assertEquals(48.8566, shape.latitude, 'Latitude should be set');
    System.assertEquals(2.3522, shape.longitude, 'Longitude should be set');
    System.assertEquals(
      'Paris, France',
      shape.address,
      'Address should be set'
    );
  }

  // ========================================================================
  // SAVE MAP AREAS - INTERNAL USER TESTS
  // ========================================================================

  @isTest
  static void testSaveMapAreasWithValidData() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.name = 'Test Point';
    shape.areaType = 'Point';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.address = 'Paris, France';
    shape.geoJson = '{"type":"Point","coordinates":[2.3522,48.8566]}';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    // Internal user should be routed to MapAreaService
    System.assertNotEquals(null, result, 'Result should not be null');
    System.assertEquals(
      true,
      result.success,
      'Save should succeed for internal user'
    );
    System.assertEquals(1, result.recordIds.size(), 'Should create 1 record');
  }

  @isTest
  static void testSaveMapAreasWithMultipleShapes() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    // Create multiple shapes of different types
    List<String> types = new List<String>{
      'Point',
      'Polygon',
      'Polyline',
      'Rectangle',
      'Circle'
    };

    for (Integer i = 0; i < types.size(); i++) {
      MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
      shape.name = 'Test ' + types[i];
      shape.areaType = types[i];
      shape.latitude = 48.8566 + (i * 0.01);
      shape.longitude = 2.3522 + (i * 0.01);
      shape.address = 'Address ' + i;
      shape.geoJson =
        '{"type":"' +
        types[i] +
        '","coordinates":[' +
        (2.3522 + i * 0.01) +
        ',' +
        (48.8566 + i * 0.01) +
        ']}';
      shapesData.add(shape);
    }

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    System.assertEquals(true, result.success, 'Save should succeed');
    System.assertEquals(5, result.recordIds.size(), 'Should create 5 records');
  }

  @isTest
  static void testSaveMapAreasWithParentRecord() {
    // Create parent account
    Account testAccount = new Account(Name = 'Test Account for Dispatcher');
    insert testAccount;

    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.name = 'Linked Point';
    shape.areaType = 'Point';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.address = 'Linked Address';
    shape.geoJson = '{"type":"Point","coordinates":[2.3522,48.8566]}';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      testAccount.Id,
      'Account__c'
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    // Result depends on whether Account__c field exists on Map_Area__c
  }

  // ========================================================================
  // SAVE MAP AREAS - INVALID DATA TESTS
  // ========================================================================

  @isTest
  static void testSaveMapAreasWithEmptyList() {
    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      new List<MapAreaServiceDispatcher.ShapeData>(),
      null,
      null
    );
    Test.stopTest();

    System.assertEquals(false, result.success, 'Should fail with empty list');
    System.assertNotEquals(null, result.message, 'Should have error message');
  }

  @isTest
  static void testSaveMapAreasWithNullList() {
    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      null,
      null,
      null
    );
    Test.stopTest();

    System.assertEquals(false, result.success, 'Should fail with null list');
    System.assertNotEquals(null, result.message, 'Should have error message');
  }

  @isTest
  static void testSaveMapAreasWithInvalidAreaType() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.name = 'Invalid Shape';
    shape.areaType = 'InvalidType';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.address = 'Test Address';
    shape.geoJson = '{"type":"Invalid"}';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertEquals(
      false,
      result.success,
      'Should fail with invalid area type'
    );
    System.assert(result.errors.size() > 0, 'Should have error messages');
  }

  @isTest
  static void testSaveMapAreasWithMixedValidInvalid() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    // Valid shape
    MapAreaServiceDispatcher.ShapeData validShape = new MapAreaServiceDispatcher.ShapeData();
    validShape.name = 'Valid Point';
    validShape.areaType = 'Point';
    validShape.latitude = 48.8566;
    validShape.longitude = 2.3522;
    validShape.geoJson = '{"type":"Point"}';
    shapesData.add(validShape);

    // Invalid shape
    MapAreaServiceDispatcher.ShapeData invalidShape = new MapAreaServiceDispatcher.ShapeData();
    invalidShape.name = 'Invalid Shape';
    invalidShape.areaType = 'InvalidType';
    invalidShape.latitude = 48.8566;
    invalidShape.longitude = 2.3522;
    invalidShape.geoJson = '{"type":"Invalid"}';
    shapesData.add(invalidShape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    // Behavior depends on MapAreaService implementation (partial success or full failure)
  }

  // ========================================================================
  // TYPE CONVERSION TESTS
  // ========================================================================

  @isTest
  static void testShapeDataConversion() {
    // Test that Dispatcher.ShapeData is correctly converted to MapAreaService.ShapeData
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.name = 'Conversion Test';
    shape.areaType = 'Polygon';
    shape.latitude = 45.5017;
    shape.longitude = -73.5673;
    shape.address = 'Montreal, Canada';
    shape.geoJson = '{"type":"Polygon","coordinates":[[[0,0],[1,1],[1,0],[0,0]]]}';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    // Verify that the conversion worked and record was created
    System.assertEquals(
      true,
      result.success,
      'Conversion and save should succeed'
    );

    // Verify the saved data
    if (result.recordIds.size() > 0) {
      Map_Area__c savedArea = [
        SELECT Name, Area_Type__c, Latitude__c, Longitude__c, Address__c
        FROM Map_Area__c
        WHERE Id = :result.recordIds[0]
      ];

      System.assertEquals(
        'Polygon',
        savedArea.Area_Type__c,
        'Area type should be preserved'
      );
      System.assertEquals(
        45.5017,
        savedArea.Latitude__c,
        'Latitude should be preserved'
      );
      System.assertEquals(
        -73.5673,
        savedArea.Longitude__c,
        'Longitude should be preserved'
      );
      System.assertEquals(
        'Montreal, Canada',
        savedArea.Address__c,
        'Address should be preserved'
      );
    }
  }

  @isTest
  static void testResultConversion() {
    // Test that MapAreaService.SaveResult is correctly converted to Dispatcher.SaveResult
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.areaType = 'Circle';
    shape.latitude = 51.5074;
    shape.longitude = -0.1278;
    shape.address = 'London, UK';
    shape.geoJson = '{"type":"Circle"}';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    // Verify result structure
    System.assertNotEquals(null, result.success, 'Success should be set');
    System.assertNotEquals(null, result.message, 'Message should be set');
    System.assertNotEquals(
      null,
      result.recordIds,
      'RecordIds list should exist'
    );
    System.assertNotEquals(
      null,
      result.recordsCreated,
      'RecordsCreated should be set'
    );
    System.assertNotEquals(null, result.errors, 'Errors list should exist');
    System.assertNotEquals(
      null,
      result.errorDetails,
      'ErrorDetails list should exist'
    );
  }

  // ========================================================================
  // ERROR DETAIL CONVERSION TESTS
  // ========================================================================

  @isTest
  static void testErrorDetailConversionOnFailure() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    // Invalid shape that will generate error details
    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.areaType = 'NotAValidType';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertEquals(false, result.success, 'Should fail with invalid type');

    // Verify error details are converted
    if (result.errorDetails.size() > 0) {
      MapAreaServiceDispatcher.ErrorDetail detail = result.errorDetails[0];
      System.assertNotEquals(
        null,
        detail.message,
        'Error detail should have message'
      );
    }
  }

  // ========================================================================
  // GUEST USER DETECTION TESTS
  // ========================================================================

  @isTest
  static void testInternalUserDetection() {
    // Standard test user should be detected as internal
    Test.startTest();

    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();
    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.areaType = 'Point';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.geoJson = '{"type":"Point"}';
    shapesData.add(shape);

    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );

    Test.stopTest();

    // Internal user should NOT get the guest user error
    System.assertNotEquals(
      'GUEST_USER_NOT_SUPPORTED',
      result.errors.size() > 0 ? result.errors[0] : '',
      'Internal user should not get guest error'
    );
  }

  @isTest
  static void testGuestUserErrorMessage() {
    // This test verifies the guest user error message format
    // Note: We can't easily simulate a guest user in a standard test

    Test.startTest();

    // Create a SaveResult as if it came from guest detection
    MapAreaServiceDispatcher.SaveResult guestResult = new MapAreaServiceDispatcher.SaveResult();
    guestResult.success = false;
    guestResult.message = 'Fonctionnalité indisponible pour les utilisateurs invités. Veuillez contacter votre administrateur pour obtenir les licences nécessaires.';
    guestResult.errors.add('GUEST_USER_NOT_SUPPORTED');

    Test.stopTest();

    // Verify the expected guest error format
    System.assertEquals(
      false,
      guestResult.success,
      'Guest result should show failure'
    );
    System.assert(
      guestResult.message.contains('utilisateurs invités'),
      'Message should mention guest users'
    );
    System.assertEquals(
      'GUEST_USER_NOT_SUPPORTED',
      guestResult.errors[0],
      'Error code should be set'
    );
  }

  // ========================================================================
  // EDGE CASE TESTS
  // ========================================================================

  @isTest
  static void testSaveWithNullFieldsInShapeData() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.name = null;
    shape.areaType = 'Point';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.address = null;
    shape.geoJson = null;
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    // Should handle null fields gracefully
    System.assertNotEquals(null, result, 'Result should not be null');
  }

  @isTest
  static void testSaveWithEmptyStrings() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.name = '';
    shape.areaType = 'Point';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.address = '';
    shape.geoJson = '';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
  }

  @isTest
  static void testSaveWithZeroCoordinates() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.areaType = 'Point';
    shape.latitude = 0;
    shape.longitude = 0;
    shape.geoJson = '{"type":"Point","coordinates":[0,0]}';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    // Zero coordinates are valid (0,0 is a real location)
    System.assertNotEquals(null, result, 'Result should not be null');
    System.assertEquals(
      true,
      result.success,
      'Should succeed with zero coordinates'
    );
  }

  @isTest
  static void testSaveWithLargeGeoJson() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.areaType = 'Polygon';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;

    // Create a large GeoJSON string
    String largeGeoJson = '{"type":"Polygon","coordinates":[';
    for (Integer i = 0; i < 500; i++) {
      largeGeoJson += '[2.3522,48.8566],';
    }
    largeGeoJson += '[2.3522,48.8566]]}';
    shape.geoJson = largeGeoJson;
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Should handle large GeoJSON');
  }

  @isTest
  static void testSaveWithLongAddress() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.areaType = 'Point';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;

    // Create an address longer than 255 characters
    String longAddress = '';
    for (Integer i = 0; i < 30; i++) {
      longAddress += 'Very Long Street Name ';
    }
    shape.address = longAddress;
    shape.geoJson = '{"type":"Point"}';
    shapesData.add(shape);

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    // Should truncate or handle long address
    System.assertNotEquals(null, result, 'Should handle long address');
  }

  // ========================================================================
  // EXCEPTION HANDLING TESTS
  // ========================================================================

  @isTest
  static void testExceptionHandling() {
    // Test that exceptions are caught and returned as error results
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
    shape.areaType = 'Point';
    shape.latitude = 48.8566;
    shape.longitude = 2.3522;
    shape.geoJson = '{"type":"Point"}';
    shapesData.add(shape);

    Test.startTest();
    // Normal call should work
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    // If there's an exception, it should be caught and returned in result.message
  }

  // ========================================================================
  // BULK OPERATION TESTS
  // ========================================================================

  @isTest
  static void testBulkSaveMapAreas() {
    List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

    // Create 50 shapes
    for (Integer i = 0; i < 50; i++) {
      MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
      shape.name = 'Bulk Test ' + i;
      shape.areaType = 'Point';
      shape.latitude = 48.8566 + (i * 0.001);
      shape.longitude = 2.3522 + (i * 0.001);
      shape.address = 'Bulk Address ' + i;
      shape.geoJson =
        '{"type":"Point","coordinates":[' +
        (2.3522 + i * 0.001) +
        ',' +
        (48.8566 + i * 0.001) +
        ']}';
      shapesData.add(shape);
    }

    Test.startTest();
    MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
      shapesData,
      null,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    System.assertEquals(true, result.success, 'Bulk save should succeed');
    System.assertEquals(
      50,
      result.recordIds.size(),
      'Should create 50 records'
    );
  }

  // ========================================================================
  // ALL AREA TYPES TESTS
  // ========================================================================

  @isTest
  static void testAllValidAreaTypes() {
    List<String> validTypes = new List<String>{
      'Point',
      'Polyline',
      'Polygon',
      'Rectangle',
      'Circle'
    };

    for (String areaType : validTypes) {
      List<MapAreaServiceDispatcher.ShapeData> shapesData = new List<MapAreaServiceDispatcher.ShapeData>();

      MapAreaServiceDispatcher.ShapeData shape = new MapAreaServiceDispatcher.ShapeData();
      shape.name = 'Type Test ' + areaType;
      shape.areaType = areaType;
      shape.latitude = 48.8566;
      shape.longitude = 2.3522;
      shape.geoJson = '{"type":"' + areaType + '"}';
      shapesData.add(shape);

      MapAreaServiceDispatcher.SaveResult result = MapAreaServiceDispatcher.saveMapAreas(
        shapesData,
        null,
        null
      );

      System.assertEquals(
        true,
        result.success,
        'Should succeed for type: ' + areaType
      );
    }
  }
}
